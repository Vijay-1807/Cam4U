"""
Detection Service - Manages object and anomaly detection sessions
Can be controlled via API
"""

import cv2
import threading
import time
import base64
from pathlib import Path
from typing import Optional, Callable
from collections import deque
import logging

from app import AdvancedObjectDetector
from services import CloudinaryService, MongoDBService
from config import Config

logger = logging.getLogger(__name__)


class DetectionService:
    """Service to manage detection sessions"""
    
    def __init__(self):
        self.active_sessions = {}  # {user_id: DetectionSession}
        self.lock = threading.Lock()
    
    def start_detection(
        self,
        user_id: str,
        camera_id: int = 0,
        camera_name: str = None,
        enable_anomaly: bool = False,
        frame_callback: Optional[Callable] = None
    ) -> bool:
        """Start a detection session for a user"""
        with self.lock:
            if user_id in self.active_sessions:
                logger.warning(f"Session already exists for user {user_id}")
                return False
            
            try:
                session = DetectionSession(
                    user_id=user_id,
                    camera_id=camera_id,
                    camera_name=camera_name or f'Camera {camera_id}',
                    enable_anomaly=enable_anomaly,
                    frame_callback=frame_callback
                )
                self.active_sessions[user_id] = session
                session.start()
                logger.info(f"Started detection session for user {user_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to start detection: {e}")
                return False
    
    def stop_detection(self, user_id: str) -> bool:
        """Stop a detection session"""
        with self.lock:
            if user_id not in self.active_sessions:
                return False
            
            session = self.active_sessions[user_id]
            session.stop()
            del self.active_sessions[user_id]
            logger.info(f"Stopped detection session for user {user_id}")
            return True
    
    def get_session(self, user_id: str) -> Optional['DetectionSession']:
        """Get active session for user"""
        return self.active_sessions.get(user_id)
    
    def is_active(self, user_id: str) -> bool:
        """Check if user has active session and it is actually running"""
        if user_id not in self.active_sessions:
            return False
            
        session = self.active_sessions[user_id]
        # Check if session is running OR has an error (but still exists)
        # This prevents premature deletion during initialization or temporary errors
        if not session.running:
            # Only cleanup if there's a critical error (camera failure)
            # Give it a chance to recover from non-critical errors
            if session.last_error and ("Camera" in session.last_error or "failed to open" in session.last_error.lower()):
                # Critical error - cleanup
                with self.lock:
                    if user_id in self.active_sessions:
                        del self.active_sessions[user_id]
                return False
            # For non-critical errors, keep session alive for 5 seconds to allow recovery
            # This prevents premature 404s during initialization
            if not hasattr(session, '_stop_time'):
                session._stop_time = time.time()
            elif time.time() - session._stop_time > 5.0:
                # Session stopped for more than 5 seconds - cleanup
                with self.lock:
                    if user_id in self.active_sessions:
                        del self.active_sessions[user_id]
                return False
            # Session stopped but less than 5 seconds ago - keep it alive for recovery
            return True
            
        # Reset stop time if session is running again
        if hasattr(session, '_stop_time'):
            session._stop_time = None
            
        return True


class DetectionSession:
    """Individual detection session"""
    
    def __init__(
        self,
        user_id: str,
        camera_id: int = 0,
        camera_name: str = None,
        enable_anomaly: bool = False,
        frame_callback: Optional[Callable] = None
    ):
        self.user_id = user_id
        self.camera_id = camera_id
        self.camera_name = camera_name or f'Camera {camera_id}'
        self.enable_anomaly = enable_anomaly
        self.frame_callback = frame_callback
        self.running = False
        self.thread = None
        self.detector = None
        
        # Detection stats
        self.current_frame = None
        self.current_detections = []
        self.current_anomaly_score = 0.0
        self.is_anomaly = False
        self.fps = 0.0
        self.last_results = None  # Store last detection results
        self.last_error = None    # Store detailed error message
        
        # WebSocket support
        self.socketio = None  # SocketIO instance for real-time updates
        self.user_room = None  # Room name for this user
        
        # Database services (optional)
        self.cloudinary_service = None
        self.mongodb_service = None
        self.firebase_service = None
        self.email_service = None
        try:
            self.cloudinary_service = CloudinaryService(**Config.get_cloudinary_config())
            self.mongodb_service = MongoDBService(Config.MONGODB_URI, Config.MONGODB_DATABASE)
            
            # Initialize Firebase and Email
            from services import get_firebase_service, EmailService
            self.firebase_service = get_firebase_service()
            
            if self.firebase_service and self.firebase_service.is_configured():
                logger.info("Firebase service enabled for detection session")
            else:
                self.firebase_service = None
            
            # Initialize Email Service
            if Config.EMAIL_USER and Config.EMAIL_PASS:
                self.email_service = EmailService(Config.EMAIL_USER, Config.EMAIL_PASS)
                logger.info("Email service enabled for detection session")
            else:
                logger.info("Email service not configured (EMAIL_USER or EMAIL_PASS missing)")
                
        except Exception as e:
            logger.warning(f"Database/Firebase/Email services not available: {e}")
        
        # Anomaly detection tracking
        self.last_anomaly_save_time = 0
        self.anomaly_save_cooldown = 30.0  # Save at most once every 30 seconds

        # Person tracking / dwell / exit events
        # We use YOLO's built-in tracker IDs (ByteTrack under the hood when using model.track(...)).
        self.track_exit_grace_seconds = 5.0  # grace period to prevent false exits
        self.track_loiter_threshold_seconds = 120.0  # dwell threshold for loitering
        # track_id -> state
        self.person_tracks = {}
        # throttle to avoid spamming "entered" events for jittery IDs
        self._recent_enter_events = {}  # track_id -> ts
        self._enter_event_cooldown = 30.0  # 30s cooldown between enter events per track
    
    def set_socketio(self, socketio_instance):
        """Set SocketIO instance for real-time WebSocket updates"""
        self.socketio = socketio_instance
    
    def set_user_room(self, room):
        """Set WebSocket room for this user"""
        self.user_room = room
    
    def start(self):
        """Start detection in background thread"""
        if self.running:
            return
        
        self.running = True
        self.last_error = None
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
    
    def stop(self):
        """Stop detection"""
        self.running = False
        if self.detector:
            self.detector.cleanup()
        if self.thread:
            self.thread.join(timeout=2.0)
    
    def _run(self):
        """Main detection loop"""
        try:
            # Initialize detector
            # detection_service.py is in backend/, and models is in backend/models/
            backend_dir = Path(__file__).parent
            
            # ONLY use the custom trained model — NO fallback to standard YOLO
            model_path = backend_dir / "models" / "YOLO26M_L4_768_weights_best.pt"
            
            if not model_path.exists():
                error_msg = f"Custom model 'YOLO26M_L4_768_weights_best.pt' not found at {model_path}. Detection cannot start."
                logger.error(error_msg)
                self.last_error = error_msg
                return
            
            anomaly_model_path = None
            i3d_model_path = None
            if self.enable_anomaly:
                anomaly_model_path = backend_dir / "models" / "mil_i3d_model.pth"
                i3d_model_path = backend_dir / "models" / "rgb_imagenet.pt"
            
            # Initialize detector with explicit improved settings
            logger.info(f"Initializing detector with model: {model_path} on Camera {self.camera_id}")
            self.detector = AdvancedObjectDetector(
                model_path=str(model_path),
                camera_id=self.camera_id,
                enable_anomaly_detection=self.enable_anomaly,
                anomaly_model_path=str(anomaly_model_path) if anomaly_model_path and anomaly_model_path.exists() else None,
                i3d_model_path=str(i3d_model_path) if i3d_model_path and i3d_model_path.exists() else None
            )
            # Detector initialized
            
            # --- DYNAMIC CONFIGURATION BASED ON MODEL TYPE ---
            self.model_type = "custom"
            self.person_class_id = 0  # Default to 0 (Standard YOLO)
            
            # 1. Determine Person Class ID
            try:
                if hasattr(self.detector.model, 'names'):
                    names = self.detector.model.names
                    found = False
                    for cls_id, cls_name in names.items():
                        if cls_name.lower() == 'person':
                            self.person_class_id = int(cls_id)
                            found = True
                            logger.info(f"Identified 'person' class ID: {self.person_class_id}")
                            break
                    
                    if not found:
                         # If 'person' isn't exact match, look for standard YOLO person (class 0)
                         # This handles standard models where class 0 is definitely person
                         if 0 in names and names[0] == 'person':
                             self.person_class_id = 0
                             self.model_type = "standard"
                             found = True
                         else:
                             logger.warning("Class 'person' NOT found in model! Person tracking might be disabled.")
                             self.person_class_id = -1
            except Exception as e:
                logger.error(f"Error determining person class ID: {e}")

            # 2. Configure Threat Classes based on available classes
            # We start with a superset of all potential threats
            POTENTIAL_THREATS = {
                # Custom Model Threats
                'knife', 'cricket bat', 'handgun', 'sickle', 'axe', 'hammer', 'face mask', 'fire',
                # Standard YOLO Threats (COCO classes)
                'knife', 'baseball bat', 'scissors', 'fire hydrant' # mapping some similar concepts
            }
            
            self.active_threat_classes = set()
            try:
                if hasattr(self.detector.model, 'names'):
                    names = self.detector.model.names
                    # validation: only add threats that actually exist in this model
                    for cls_name in names.values():
                        cls_lower = cls_name.lower()
                        if cls_lower in POTENTIAL_THREATS:
                            self.active_threat_classes.add(cls_lower)
                    
                    # Logic: If standard YOLO (chances are 'person' is class 0 and we have 80 classes)
                    # We might want to Map 'baseball bat' -> 'cricket bat' logic if needed, 
                    # but for now we just listen to what the model HAS.
                    
                    logger.info(f"Active Threat Classes for this model: {self.active_threat_classes}")
            except Exception as e:
                logger.error(f"Error configuring threat classes: {e}")
                # Fallback to hardcoded list if dynamic fails
                self.active_threat_classes = {'knife', 'cricket bat', 'handgun', 'sickle', 'axe', 'hammer', 'face mask', 'fire'}

            
            # Verify camera is actually reading
            if not self.detector.cap.isOpened():
                error_msg = f"Camera {self.camera_id} failed to open during initialization"
                logger.error(error_msg)
                self.last_error = error_msg
                return
                
            # Read one frame to ensure connection
            ret, _ = self.detector.cap.read()
            if not ret:
                 error_msg = f"Camera {self.camera_id} opened but failed to read initial frame"
                 logger.warning(error_msg)
                 self.last_error = error_msg
            
            # OPTIMIZE FOR RTX 3050 GPU - BEST FPS SETTINGS
            import torch
            # MATCH MODEL TRAINING RESOLUTION (768) FOR BEST ACCURACY
            if torch.cuda.is_available():
                # The model YOLO26M_L4_768 was trained at 768px.
                # Running at lower resolutions like 480 causes poor detection.
                self.detector.imgsz = 768  
                logger.info("GPU Mode: Using 768px resolution to match custom model training size")
            else:
                # CPU only - resolution is critical for performance
                self.detector.imgsz = 640 
                logger.warning("CPU Mode: Using 640px resolution (Performance trade-off)")
            
            self.detector.conf_threshold = 0.20  # Increased sensitivity (was 0.25)
            self.detector.tracking = True  # Enable tracking for movement analysis
            
            # GPU-optimized settings
            if torch.cuda.is_available():
                # FP16 will be enabled in inference calls (safer than model.half())
                logger.info("GPU Mode: FP16 will be used during inference for 2x speedup")
            
            # Optimize anomaly detector if enabled - MAXIMUM PERFORMANCE
            if self.enable_anomaly and self.detector.anomaly_detector:
                # Reduce computation frequency for best FPS
                self.detector.anomaly_detector.compute_skip_frames = 4  # Compute every 5th frame for max FPS
                # Reduce buffer size for faster processing
                self.detector.anomaly_detector.buffer_size = 48  # Reduced from 64 for faster processing
                # Reduce max clips for faster computation
                logger.info("Anomaly detection: Computing every 5th frame for MAXIMUM FPS")
                logger.info("Anomaly detection: Optimized buffer size for faster processing")
            
            frame_times = deque(maxlen=30)  # Use deque for better performance
            last_fps_update = time.time()
            frame_count_for_fps = 0
            
            while self.running:
                loop_start = time.time()
                ret, frame = self.detector.cap.read()
                if not ret:
                    # Camera read failed - try to recover
                    logger.warning("Failed to read frame from camera, attempting recovery...")
                    time.sleep(0.1)
                    # Try reading again
                    ret, frame = self.detector.cap.read()
                    if not ret:
                        error_msg = f"Camera {self.camera_id} stopped responding"
                        logger.error(error_msg)
                        self.last_error = error_msg
                        break
                if not self.enable_anomaly:
                    # --- OBJECT DETECTION (YOLO) ONLY PIPELINE ---
                    import torch
                    use_half = torch.cuda.is_available() and hasattr(self.detector.model, 'half')
                    
                    if self.detector.tracking:
                        results = self.detector.model.track(
                            frame, 
                            conf=self.detector.conf_threshold, 
                            iou=self.detector.nms_threshold,
                            imgsz=self.detector.imgsz, 
                            classes=self.detector.classes_filter,
                            max_det=self.detector.max_det, 
                            persist=True, 
                            verbose=False,
                            half=use_half,
                            device=0 if torch.cuda.is_available() else 'cpu'
                        )
                    else:
                        results = self.detector.model.predict(
                            frame, 
                            conf=self.detector.conf_threshold, 
                            iou=self.detector.nms_threshold,
                            imgsz=self.detector.imgsz, 
                            classes=self.detector.classes_filter,
                            max_det=self.detector.max_det, 
                            verbose=False,
                            half=use_half,
                            device=0 if torch.cuda.is_available() else 'cpu'
                        )
                    
                    self.last_results = results
                    self.current_detections = self._extract_detections()
                    
                    self.detector.frame_count += 1
                    if results[0].boxes is not None:
                        self.detector.total_detections += len(results[0].boxes)
                    
                    annotated_frame = results[0].plot()
                    
                    try:
                        class_counts = self.detector.count_objects_by_class(results)
                        annotated_frame = self.detector.draw_stats_panel(
                            annotated_frame, class_counts, show_info=True, show_fps=True, show_trails=False
                        )
                    except Exception as e:
                        logger.debug(f"Stats panel error (continuing): {e}")
                        
                    self.current_frame = annotated_frame
                    
                    try:
                        self._update_person_tracks(frame, results)
                        self._process_weapon_detections(frame, results)
                    except Exception as e:
                        logger.debug(f"Tracking/weapon error (continuing): {e}")

                else:
                    # --- FULL-FRAME ANOMALY (I3D + MIL) ONLY PIPELINE ---
                    annotated_frame = frame.copy()
                    self.detector.frame_count += 1
                    self.last_results = None
                    self.current_detections = []
                    
                    if self.detector.anomaly_detector:
                        try:
                            anomaly_score, is_anomaly = self.detector.anomaly_detector.detect(frame, None)
                            self.current_anomaly_score = float(anomaly_score)
                            self.is_anomaly = bool(is_anomaly)
                            
                            # Draw Anomaly UI directly matching the user's preferred layout
                            color = (0, 0, 255) if is_anomaly else (0, 255, 0)
                            
                            if is_anomaly:
                                cv2.putText(annotated_frame, "ALERT ACTIVE!", (20, 110),
                                            cv2.FONT_HERSHEY_DUPLEX, 1.2, color, 3)
                                # Red warning border
                                cv2.rectangle(annotated_frame, (0, 0), (annotated_frame.shape[1], annotated_frame.shape[0]), color, 8)
                            else:
                                cv2.putText(annotated_frame, "NORMAL", (20, 110),
                                            cv2.FONT_HERSHEY_DUPLEX, 1.2, color, 3)
                                            
                            # Calibration Status / Threshold UI
                            stats = self.detector.anomaly_detector.get_statistics()
                            if not stats.get('calibrated', True):
                                cv2.putText(annotated_frame, f"CALIBRATING...", (20, 150),
                                            cv2.FONT_HERSHEY_DUPLEX, 1.0, (0, 255, 255), 2)
                            else:
                                threshold = stats.get('threshold', 0.5)
                                cv2.putText(annotated_frame, f"Threshold: {threshold:.2f}", (20, 150),
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
                                            
                            cv2.putText(annotated_frame, f"Smooth Score: {self.current_anomaly_score:.2f}", (20, 50),
                                        cv2.FONT_HERSHEY_DUPLEX, 1.0, color, 2)
                                        
                        except Exception as e:
                            logger.warning(f"Anomaly detection error (continuing): {e}")
                            if hasattr(self.detector.anomaly_detector, 'current_score'):
                                self.current_anomaly_score = float(self.detector.anomaly_detector.current_score)
                    
                    self.current_frame = annotated_frame
                    
                    # Save anomaly event to database (MongoDB required, Cloudinary optional)
                    if self.is_anomaly and self.mongodb_service:
                        current_time = time.time()
                        if current_time - self.last_anomaly_save_time > self.anomaly_save_cooldown:
                            self._save_anomaly_event(frame)
                            self.last_anomaly_save_time = current_time
                
                # WEBSOCKET: Emit frame via WebSocket for real-time streaming
                if self.socketio and self.user_room:
                    try:
                        frame_base64 = self.get_frame_base64()
                        if frame_base64:
                            status = self.get_status()
                            self.socketio.emit('detection_frame', {
                                'frame': f'data:image/jpeg;base64,{frame_base64}',
                                'status': status,
                                'ready': True
                            }, room=self.user_room)
                    except Exception as e:
                        logger.debug(f"WebSocket emit error (continuing): {e}")

                processing_time = time.time() - loop_start
                frame_count_for_fps += 1
                
                # Update FPS every second or every 10 frames (whichever comes first)
                current_time = time.time()
                time_since_update = current_time - last_fps_update
                
                if time_since_update >= 1.0 or frame_count_for_fps >= 10:
                    # Calculate FPS based on actual frames processed
                    if time_since_update > 0:
                        self.fps = frame_count_for_fps / time_since_update
                    else:
                        self.fps = 0
                    
                    # Update detector's FPS so it shows in video overlay
                    self.detector.fps = self.fps
                    self.detector.prev_time = current_time
                    
                    # Reset counters
                    frame_count_for_fps = 0
                    last_fps_update = current_time
                
                # MAXIMUM PERFORMANCE: No sleep - let GPU run at full speed
                # Only sleep if we're significantly ahead (to prevent excessive CPU usage)
                processing_time = time.time() - loop_start
                target_frame_time = 1.0 / 60.0  # Target 60 FPS (let GPU run fast)
                if processing_time < target_frame_time * 0.5:  # Only sleep if way ahead
                    time.sleep(0.001)  # Minimal sleep to allow other threads
                
                # Callback for frame updates
                if self.frame_callback:
                    try:
                        self.frame_callback(self)
                    except Exception as e:
                        logger.error(f"Frame callback error: {e}")
                
        except KeyboardInterrupt:
            logger.info("Detection session interrupted by user")
            self.last_error = "Session interrupted"
        except Exception as e:
            logger.error(f"Detection session error: {e}")
            self.last_error = str(e)
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Don't immediately stop - allow retry mechanism
            # Only stop if it's a critical error (camera failure, etc.)
            if "Camera" in str(e) or "failed to open" in str(e).lower():
                logger.error("Critical camera error - stopping session")
            else:
                logger.warning(f"Non-critical error - session will continue: {e}")
        finally:
            self.running = False
            if self.detector:
                try:
                    self.detector.cleanup()
                except Exception as e:
                    logger.warning(f"Error during cleanup: {e}")
    
    def _extract_detections(self):
        """Extract detection information from current frame"""
        if self.last_results is None or len(self.last_results) == 0:
            return []
        
        try:
            result = self.last_results[0]
            detections = []
            
            if result.boxes is not None:
                # Get class names from model
                class_names = self.detector.model.names if hasattr(self.detector.model, 'names') else {}
                
                # Count boxes
                num_boxes = len(result.boxes) if hasattr(result.boxes, '__len__') else 0
                
                for i in range(num_boxes):
                    try:
                        box = result.boxes[i]
                        
                        # Get class ID
                        if hasattr(box.cls, '__len__') and len(box.cls) > 0:
                            cls_id = int(box.cls[0].item())
                        else:
                            cls_id = int(box.cls.item())
                        
                        # Get confidence
                        if hasattr(box.conf, '__len__') and len(box.conf) > 0:
                            conf = float(box.conf[0].item())
                        else:
                            conf = float(box.conf.item())
                        
                        # Get class name
                        class_name = class_names.get(cls_id, f"class_{cls_id}")
                        
                        # Only add if confidence is above threshold
                        if conf >= self.detector.conf_threshold:
                            detections.append(class_name)
                    except Exception as e:
                        logger.debug(f"Error processing box {i}: {e}")
                        continue
            
            return detections
        except Exception as e:
            logger.error(f"Error extracting detections: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_frame_base64(self) -> Optional[str]:
        """Get current frame as base64 encoded JPEG (optimized)"""
        if self.current_frame is None:
            return None
        
        try:
            # Optimize encoding: speed over quality
            # Use quality 50 for much faster transmission (still good for preview)
            encode_params = [
                cv2.IMWRITE_JPEG_QUALITY, 50,
                cv2.IMWRITE_JPEG_OPTIMIZE, 0  # Disable optimization for speed
            ]
            
            # Resize frame if too large (critical for speed)
            try:
                height, width = self.current_frame.shape[:2]
                if width > 640:
                    scale = 640 / width
                    new_width = 640
                    new_height = int(height * scale)
                    resized = cv2.resize(self.current_frame, (new_width, new_height), interpolation=cv2.INTER_NEAREST)
                else:
                    resized = self.current_frame
            except Exception as e:
                logger.error(f"Resize failed: {e}")
                resized = self.current_frame
            
            # Use imencode with optimized params
            success, buffer = cv2.imencode('.jpg', resized, encode_params)
            if not success:
                logger.error("Opencv imencode failed")
                return None
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            return frame_base64
        except Exception as e:
            logger.error(f"Error encoding frame details: {e}")
            return None
    
    def _save_anomaly_event(self, frame):
        """Save anomaly event to database"""
        try:
            from datetime import datetime
            import os
            
            # Upload to Cloudinary (using in-memory buffer)
            image_url = None
            try:
                if self.cloudinary_service:
                    import io
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    # Encode frame to memory
                    success, buffer = cv2.imencode('.jpg', frame)
                    if success:
                        image_stream = io.BytesIO(buffer)
                        image_stream.seek(0)
                        
                        image_result = self.cloudinary_service.upload_image(
                            image_stream,
                            folder=f"detections/{self.user_id}",
                            public_id=f"anomaly_{timestamp}"
                        )
                        image_url = image_result.get('secure_url')
                    else:
                        logger.error("Failed to encode anomaly frame")
            except Exception as e:
                logger.error(f"Failed to upload image: {e}")
            
            # Save to MongoDB
            event_data = {
                'userId': self.user_id,
                'detectionType': 'anomaly',
                'objects': self.current_detections,
                'confidence': self.current_anomaly_score,
                'fps': self.fps,
                'frameCount': getattr(self.detector, 'frame_count', 0),
                'location': self.camera_name,
                'metadata': {
                    'anomalyScore': self.current_anomaly_score,
                    'model': 'YOLO26M_L4_768 + MIL I3D',  # Fixed: show actual model name
                    'eventType': 'anomaly'  # Explicitly add eventType for notification logic
                }
            }
            
            self.mongodb_service.save_detection_event(
                event_data=event_data,
                image_url=image_url,
                video_url=None
            )
            
            logger.info(f"Anomaly detected! Score: {self.current_anomaly_score:.2f}. Processing notifications...")
            
            # Send Push & Email Notifications for Anomaly
            user = self.mongodb_service.get_user(self.user_id)
            if not user:
                logger.warning(f"Could not find user {self.user_id} for anomaly notification")
                return

            # Robust preference check
            prefs = user.get('notificationPrefs')
            if not isinstance(prefs, dict):
                prefs = {'email': True, 'push': False}
            
            email_enabled = prefs.get('email', True)
            push_enabled = prefs.get('push', False)

            # 1. Push Notification
            if self.firebase_service and push_enabled:
                try:
                    if user.get('fcmToken'):
                        logger.info(f"Sending anomaly push notification to user {self.user_id}")
                        self.firebase_service.send_notification(
                            token=user['fcmToken'],
                            title="⚠️ Anomaly Detected",
                            body=f"Suspicious activity detected at Camera {self.camera_id}. Score: {self.current_anomaly_score:.2f}",
                            data={'detectionType': 'anomaly', 'score': str(self.current_anomaly_score)}
                        )
                except Exception as ex:
                    logger.error(f"Failed to send anomaly push notification: {ex}")

            # 2. Email Notification
            if self.email_service and email_enabled:
                try:
                    logger.info(f"Sending anomaly alert email to {user['email']}")
                    full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "User"
                    success = self.email_service.send_alert_email(
                        recipient=user['email'],
                        name=full_name,
                        alert_type="Anomaly (Suspicious Activity)",
                        location=f"Camera {self.camera_id}",
                        confidence=self.current_anomaly_score
                    )
                    if success:
                        logger.info(f"Anomaly email sent successfully to {user['email']}")
                    else:
                        logger.warning(f"EmailService returned False for anomaly email to {user['email']}")
                except Exception as ex:
                    logger.error(f"Failed to send anomaly email notification: {ex}")

        except Exception as e:
            logger.error(f"Failed to save anomaly event: {e}")

    def _get_person_detections_with_tracks(self, results):
        """
        Extract tracked person detections from YOLO results.

        Returns:
            List of dicts: {track_id, conf, bbox_xyxy}
        """
        if not results or len(results) == 0:
            return []

        result = results[0]
        if result.boxes is None:
            return []

        boxes = result.boxes

        # Ultralytics: boxes.id contains tracker IDs when using model.track(persist=True)
        track_ids = getattr(boxes, "id", None)
        if track_ids is None:
            return []

        try:
            import torch
            xyxy = boxes.xyxy
            cls = boxes.cls
            conf = boxes.conf

            # Convert to CPU tensors for safe .tolist()
            if hasattr(xyxy, "detach"):
                xyxy = xyxy.detach().cpu()
            if hasattr(cls, "detach"):
                cls = cls.detach().cpu()
            if hasattr(conf, "detach"):
                conf = conf.detach().cpu()
            if hasattr(track_ids, "detach"):
                track_ids = track_ids.detach().cpu()

            person_dets = []
            for i in range(len(xyxy)):
                # COCO person class is usually 0, but we use the dynamic ID
                try:
                    cls_id = int(cls[i].item()) if hasattr(cls[i], "item") else int(cls[i])
                except Exception:
                    continue

                # If person class was not found in model (-1), skip person tracking
                if self.person_class_id == -1:
                    continue

                if cls_id != self.person_class_id:
                    continue

                try:
                    c = float(conf[i].item()) if hasattr(conf[i], "item") else float(conf[i])
                except Exception:
                    c = 0.0

                if c < self.detector.conf_threshold:
                    continue

                try:
                    tid = int(track_ids[i].item()) if hasattr(track_ids[i], "item") else int(track_ids[i])
                except Exception:
                    continue

                x1, y1, x2, y2 = [float(v) for v in xyxy[i].tolist()]
                person_dets.append({
                    "track_id": tid,
                    "conf": c,
                    "bbox_xyxy": (x1, y1, x2, y2),
                })

            return person_dets

        except Exception as e:
            logger.debug(f"Failed to extract tracked person detections: {e}")
            return []

    def _crop_bbox(self, frame, bbox_xyxy):
        """Crop a bbox from a frame (clamped)."""
        import numpy as np
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = bbox_xyxy
        x1 = int(max(0, min(w - 1, x1)))
        x2 = int(max(0, min(w, x2)))
        y1 = int(max(0, min(h - 1, y1)))
        y2 = int(max(0, min(h, y2)))
        if x2 <= x1 or y2 <= y1:
            return None
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return None
        return crop

    def _upload_crop_to_cloudinary(self, crop, prefix: str):
        """Upload a cropped image to Cloudinary and return URL (or None)."""
        if not self.cloudinary_service:
            return None
        try:
            from datetime import datetime
            import cv2
            import io
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # Encode crop to memory
            success, buffer = cv2.imencode('.jpg', crop)
            if not success:
                logger.error("Failed to encode crop for upload")
                return None
                
            image_stream = io.BytesIO(buffer)
            image_stream.seek(0)

            result = self.cloudinary_service.upload_image(
                image_stream,
                folder=f"detections/{self.user_id}",
                public_id=f"{prefix}_{timestamp}"
            )
            return result.get("secure_url")
        except Exception as e:
            logger.error(f"Failed to upload crop: {e}")
            return None

    def _save_person_event(self, event_type: str, track_id: int, confidence: float, snapshot_url: str | None, meta: dict):
        """Persist a person tracking event to MongoDB."""
        if not self.mongodb_service:
            return
        try:
            event_data = {
                "userId": self.user_id,
                "detectionType": "person",
                "objects": ["person"],
                "confidence": confidence,
                "fps": self.fps,
                "frameCount": getattr(self.detector, "frame_count", 0),
                "location": self.camera_name,
                "metadata": {
                    "eventType": event_type,   # entered | left | loitering
                    "trackId": track_id,
                    **(meta or {}),
                },
            }
            self.mongodb_service.save_detection_event(
                event_data=event_data,
                image_url=snapshot_url,
                video_url=None,
            )

            # Send Push & Email Notifications
            user = self.mongodb_service.get_user(self.user_id)
            if not user:
                return

            # Robust preference check
            prefs = user.get('notificationPrefs')
            if not isinstance(prefs, dict):
                prefs = {'email': True, 'push': False}
            
            email_enabled = prefs.get('email', True)
            push_enabled = prefs.get('push', False)
            
            # 1. Push Notification
            if self.firebase_service and push_enabled:
                try:
                    if user.get('fcmToken'):
                        title_map = {
                            "entered": "Person Detected",
                            "loitering": "Loitering Alert"
                        }
                        if event_type in ['entered', 'loitering']:
                            title = title_map.get(event_type, "Security Alert")
                            body = f"Person detected at Camera {self.camera_id}"
                            if event_type == 'loitering':
                                body = f"Person loitering for {meta.get('dwellSeconds')}s at Camera {self.camera_id}"
                            
                            logger.info(f"Sending person push notification to user {self.user_id}")
                            self.firebase_service.send_notification(
                                token=user['fcmToken'],
                                title=title,
                                body=body,
                                data={'detectionType': 'person', 'eventType': str(event_type)}
                            )
                except Exception as ex:
                    logger.error(f"Failed to send person push notification: {ex}")

            # 2. Email Notification
            if self.email_service and email_enabled:
                try:
                    logger.info(f"Sending person alert email to {user['email']}")
                    full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "User"
                    alert_type = f"Person {event_type}"
                    self.email_service.send_alert_email(
                        recipient=user['email'],
                        name=full_name,
                        alert_type=alert_type,
                        location=f"Camera {self.camera_id}",
                        confidence=confidence
                    )
                except Exception as ex:
                    logger.error(f"Failed to send person email notification: {ex}")

        except Exception as e:
            logger.error(f"Failed to save person event: {e}")

    def _process_weapon_detections(self, frame, results):
        """
        Process detections for weapons and trigger alerts.
        """
        if not results or len(results) == 0:
            return

        # Use the dynamically determined threat classes for this specific model
        THREAT_CLASSES = self.active_threat_classes
        
        try:
            result = results[0]
            if result.boxes is None:
                return

            # Get class names
            class_names = self.detector.model.names if hasattr(self.detector.model, 'names') else {}
            
            # Cooldown check for weapon alerts (to avoid spamming every frame)
            # Use a dict to track last alert time per threat type
            if not hasattr(self, '_last_weapon_alert'):
                self._last_weapon_alert = {}
            
            current_time = time.time()
            WEAPON_ALERT_COOLDOWN = 30.0  # 30s between alerts for same threat type

            for i, box in enumerate(result.boxes):
                try:
                    # Get class ID and name
                    if hasattr(box.cls, '__len__') and len(box.cls) > 0:
                        cls_id = int(box.cls[0].item())
                    else:
                        cls_id = int(box.cls.item())
                    
                    class_name = class_names.get(cls_id, f"class_{cls_id}").lower()
                    
                    # Check if it's a threat
                    if class_name in THREAT_CLASSES:
                        # Get confidence
                        if hasattr(box.conf, '__len__') and len(box.conf) > 0:
                            conf = float(box.conf[0].item())
                        else:
                            conf = float(box.conf.item())
                        
                        # Only alert if high confidence — use 50% minimum for weapons
                        # (General detection uses 25%, but weapon ALERTS need higher certainty)
                        WEAPON_MIN_CONFIDENCE = 0.50
                        if conf < WEAPON_MIN_CONFIDENCE:
                            continue

                        # Check cooldown
                        last_alert = self._last_weapon_alert.get(class_name, 0)
                        if current_time - last_alert > WEAPON_ALERT_COOLDOWN:
                            # Update cooldown
                            self._last_weapon_alert[class_name] = current_time
                            
                            # Capture snapshot
                            bbox = box.xyxy[0].tolist()
                            crop = self._crop_bbox(frame, bbox)
                            snapshot_url = None
                            if crop is not None and self.cloudinary_service:
                                snapshot_url = self._upload_crop_to_cloudinary(crop, f"threat_{class_name}")

                            # Save Event & Send Notification
                            self._save_threat_event(
                                threat_type=class_name,
                                confidence=conf,
                                snapshot_url=snapshot_url
                            )
                            logger.info(f"THREAT DETECTED: {class_name} ({conf:.2f})")
                            
                except Exception as e:
                    logger.debug(f"Error processing box {i} for threats: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error in weapon detection processing: {e}")

    def _save_threat_event(self, threat_type: str, confidence: float, snapshot_url: str | None):
        """Save threat event and send IMMEDIATE notification"""
        if not self.mongodb_service:
            return
            
        try:
            event_data = {
                "userId": self.user_id,
                "detectionType": "threat",
                "objects": [threat_type],
                "confidence": confidence,
                "fps": self.fps,
                "frameCount": getattr(self.detector, "frame_count", 0),
                "location": self.camera_name,
                "metadata": {
                    "threatType": threat_type,
                    "priority": "high"
                },
            }
            
            # Save to DB
            self.mongodb_service.save_detection_event(
                event_data=event_data,
                image_url=snapshot_url,
                video_url=None,
            )

            # Send Push & Email Notifications
            user = self.mongodb_service.get_user(self.user_id)
            if not user:
                return

            # Robust preference check
            prefs = user.get('notificationPrefs')
            if not isinstance(prefs, dict):
                prefs = {'email': True, 'push': False}
            
            email_enabled = prefs.get('email', True)
            push_enabled = prefs.get('push', False)

            # 1. Push Notification
            if self.firebase_service and push_enabled:
                try:
                    if user.get('fcmToken'):
                        logger.info(f"Sending threat push notification to user {self.user_id}")
                        self.firebase_service.send_notification(
                            token=user['fcmToken'],
                            title=f"⚠️ Security Alert: {threat_type.title()} Detected!",
                            body=f"A {threat_type} was detected on Camera {self.camera_id}. Check live feed immediately.",
                            data={
                                'detectionType': 'threat', 
                                'threatType': threat_type,
                                'priority': 'high'
                            }
                        )
                except Exception as ex:
                    logger.error(f"Failed to send threat push notification: {ex}")

            # 2. Email Notification
            if self.email_service and email_enabled:
                try:
                    logger.info(f"Sending threat alert email to {user['email']}")
                    full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "User"
                    self.email_service.send_alert_email(
                        recipient=user['email'],
                        name=full_name,
                        alert_type=threat_type,
                        location=f"Camera {self.camera_id}",
                        confidence=confidence
                    )
                except Exception as ex:
                    logger.error(f"Failed to send threat email notification: {ex}")
                    
        except Exception as e:
            logger.error(f"Failed to save threat event: {e}")

    def _update_person_tracks(self, frame, results):
        """
        Update person tracks and emit:
        - Person Entered (new track id)
        - Person Left (unseen > grace seconds)
        - Person Loitering (dwell > threshold)

        Snapshots are uploaded ONLY on:
        - left
        - loitering
        (and anomalies are handled separately already)
        """
        now = time.time()
        dets = self._get_person_detections_with_tracks(results)

        seen_track_ids = set()
        for det in dets:
            tid = det["track_id"]
            conf = det["conf"]
            bbox = det["bbox_xyxy"]
            seen_track_ids.add(tid)

            state = self.person_tracks.get(tid)
            if not state:
                state = {
                    "entered_at": now,
                    "last_seen": now,
                    "loitering_sent": False,
                    "last_conf": conf,
                    "last_bbox": bbox,
                    "last_crop": None,
                }
                self.person_tracks[tid] = state

                # Enter event (throttled)
                last_enter = self._recent_enter_events.get(tid, 0)
                if now - last_enter > self._enter_event_cooldown:
                    self._recent_enter_events[tid] = now
                    
                    # Capture snapshot for entered event
                    snapshot_url = None
                    crop = self._crop_bbox(frame, bbox)
                    if crop is not None:
                        state["last_crop"] = crop
                        if self.cloudinary_service:
                            snapshot_url = self._upload_crop_to_cloudinary(crop, f"entered_person_{tid}")

                    self._save_person_event(
                        event_type="entered",
                        track_id=tid,
                        confidence=conf,
                        snapshot_url=snapshot_url,  # Save the snapshot
                        meta={"enteredAt": now},
                    )

            # Update state
            state["last_seen"] = now
            state["last_conf"] = conf
            state["last_bbox"] = bbox

            # Keep a small crop for later exit snapshot (not saved to DB until event)
            crop = self._crop_bbox(frame, bbox)
            if crop is not None:
                state["last_crop"] = crop

            # Loitering check
            dwell = now - state["entered_at"]
            if (not state["loitering_sent"]) and dwell >= self.track_loiter_threshold_seconds:
                state["loitering_sent"] = True
                snapshot_url = None
                if state.get("last_crop") is not None and self.cloudinary_service:
                    snapshot_url = self._upload_crop_to_cloudinary(state["last_crop"], f"loitering_person_{tid}")
                self._save_person_event(
                    event_type="loitering",
                    track_id=tid,
                    confidence=conf,
                    snapshot_url=snapshot_url,
                    meta={"dwellSeconds": int(dwell), "thresholdSeconds": int(self.track_loiter_threshold_seconds)},
                )

        # Exit check (grace period)
        to_delete = []
        for tid, state in list(self.person_tracks.items()):
            if tid in seen_track_ids:
                continue
            if now - state["last_seen"] >= self.track_exit_grace_seconds:
                dwell = now - state["entered_at"]
                snapshot_url = None
                if state.get("last_crop") is not None and self.cloudinary_service:
                    snapshot_url = self._upload_crop_to_cloudinary(state["last_crop"], f"exit_person_{tid}")
                self._save_person_event(
                    event_type="left",
                    track_id=tid,
                    confidence=float(state.get("last_conf", 0.0)),
                    snapshot_url=snapshot_url,
                    meta={"enteredAt": state["entered_at"], "leftAt": now, "dwellSeconds": int(dwell)},
                )
                to_delete.append(tid)

        for tid in to_delete:
            self.person_tracks.pop(tid, None)
    
    def get_status(self) -> dict:
        """Get current detection status"""
        # Get actual detection count from results if available
        detection_count = len(self.current_detections)
        
        # Also try to get count from last results
        if self.last_results and len(self.last_results) > 0:
            try:
                result = self.last_results[0]
                if result.boxes is not None:
                    # Count boxes above confidence threshold
                    count = 0
                    for box in result.boxes:
                        try:
                            if hasattr(box.conf, '__len__') and len(box.conf) > 0:
                                conf = float(box.conf[0].item())
                            else:
                                conf = float(box.conf.item())
                            
                            if conf >= self.detector.conf_threshold:
                                count += 1
                        except Exception:
                            continue
                    
                    # Use the higher count
                    detection_count = max(detection_count, count)
            except Exception as e:
                logger.debug(f"Error getting detection count: {e}")
        
        # Convert numpy bools to Python bools for JSON serialization
        is_anomaly = bool(self.is_anomaly) if self.is_anomaly is not None else False
        running = bool(self.running) if self.running is not None else False
        
        return {
            'running': running,
            'fps': round(self.fps, 1),
            'detections': detection_count,
            'anomaly_score': round(self.current_anomaly_score, 3),
            'is_anomaly': is_anomaly,
            'camera_id': self.camera_id,
            'error': self.last_error
        }


# Global detection service instance
detection_service = DetectionService()

