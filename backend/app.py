# Advanced YOLO26s Object Detection with Webcam + Anomaly Detection
# pip install opencv-python ultralytics torch torchvision pillow

import cv2
from ultralytics import YOLO
import time
from collections import defaultdict, deque
from datetime import datetime
import os
import numpy as np
from pathlib import Path

# Optional: Import anomaly detection module
import sys
sys.path.append(str(Path(__file__).parent))

try:
    from anomaly_detector import AnomalyDetector
    ANOMALY_DETECTION_AVAILABLE = True
except ImportError:
    ANOMALY_DETECTION_AVAILABLE = False
    print("⚠ Anomaly detection module not available. Install torch and torchvision for anomaly detection.")


class AdvancedObjectDetector:
    def __init__(self, model_path=None, camera_id=0, 
                 enable_anomaly_detection=False, 
                 anomaly_model_path=None,
                 i3d_model_path=None):
        """Initialize the advanced object detector with optional anomaly detection"""
        # Load YOLO model
        if model_path is None:
            # Default to backend models folder
            backend_dir = Path(__file__).parent
            model_path = backend_dir / "models" / "YOLO26M_L4_768_weights_best.pt"
        
        try:
            # Check for GPU - OPTIMIZED FOR RTX 3050
            import torch
            if torch.cuda.is_available():
                device = 'cuda:0'
                gpu_name = torch.cuda.get_device_name(0)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
                print(f"✓ GPU DETECTED: {gpu_name} ({gpu_memory:.1f} GB)", flush=True)
                print(f"✓ CUDA Version: {torch.version.cuda}", flush=True)
                # Enable TensorFloat-32 for faster inference on RTX 30xx series
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
                print(f"✓ TF32 Enabled for RTX 3050 (faster inference)", flush=True)
            else:
                device = 'cpu'
                print(f"⚠ WARNING: No GPU detected! Using CPU (will be slow)", flush=True)
            
            self.model = YOLO(str(model_path), task='detect')
            self.model.to(device)
            
            # OPTIMIZE FOR RTX 3050: Use half precision (FP16) for 2x speedup
            if device.startswith('cuda'):
                try:
                    # Enable FP16 inference
                    self.model.fuse()  # Fuse layers for faster inference
                    print(f"✓ Model optimized for GPU (FP16 ready)", flush=True)
                except:
                    pass
            
            print(f"✓ Model loaded: {model_path}", flush=True)
        except Exception as e:
            print(f"✗ Error loading model: {e}")
            raise
        
        # Initialize anomaly detector if requested
        self.anomaly_detector = None
        self.anomaly_detection_enabled = False
        if enable_anomaly_detection and ANOMALY_DETECTION_AVAILABLE:
            try:
                self.anomaly_detector = AnomalyDetector(
                    learner_model_path=anomaly_model_path,
                    i3d_model_path=i3d_model_path,
                    window_size=64,  # Fixed: matches training config & anomaly_detector.py default
                    anomaly_threshold=0.6  # Increased to reduce false positives
                )
                self.anomaly_detection_enabled = True
                print("✓ Anomaly detection enabled (MIL I3D model loaded)")
            except Exception as e:
                print(f"⚠ Warning: Could not initialize anomaly detector: {e}")
                print("  Continuing with object detection only...")
        elif enable_anomaly_detection and not ANOMALY_DETECTION_AVAILABLE:
            print("⚠ Warning: Anomaly detection requested but module not available.")
            print("  Install torch and torchvision: pip install torch torchvision")

        # Initialize camera - Priority: DirectShow (Windows) -> Default
        # robust camera opening with auto-scan
        found_working_camera = False
        
        # Check if camera_id is a string URL (IP camera)
        if isinstance(camera_id, str):
            print(f"  > Testing IP Camera URL: {camera_id}...")
            temp_cap = cv2.VideoCapture(camera_id)
            if temp_cap.isOpened():
                ret, frame = temp_cap.read()
                if ret and frame is not None and frame.size > 0:
                    print(f"  > ✓ IP Camera is working!")
                    self.cap = temp_cap
                    self.camera_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    self.camera_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    found_working_camera = True
                else:
                    print(f"  > ✗ IP Camera opened but returned no frame.")
                    temp_cap.release()
            else:
                 print(f"  > ✗ IP Camera failed to open.")
        else:
            # It's an integer index (USB camera)
            start_index = int(camera_id)
            
            # Try indices starting from camera_id up to 2 + camera_id
            for i in range(start_index, start_index + 3):
                print(f"  > Testing Camera Index {i}...")
                if os.name == 'nt':
                    temp_cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
                else:
                    temp_cap = cv2.VideoCapture(i)
                
                if temp_cap.isOpened():
                    # Try to read a frame to confirm it works
                    ret, frame = temp_cap.read()
                    if ret and frame is not None and frame.size > 0:
                        print(f"  > ✓ Camera Index {i} is working!")
                        self.cap = temp_cap
                        self.camera_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        self.camera_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        found_working_camera = True
                        break
                    else:
                        print(f"  > ✗ Camera Index {i} opened but returned no frame.")
                        temp_cap.release()
                else:
                     print(f"  > ✗ Camera Index {i} failed to open.")

        if not found_working_camera:
             raise RuntimeError(f"Could not find any working camera for {camera_id}")

        # Configuration - Optimized for better FPS
        self.conf_threshold = 0.20
        self.nms_threshold = 0.45
        self.imgsz = 768  # Match custom model training size (was 640)
        self.classes_filter = None
        self.tracking = False  # Disable tracking for better FPS (can enable with 't' key)
        self.max_det = 300

        # FPS calculation
        self.prev_time = time.time()
        self.fps = 0
        self.fps_history = deque(maxlen=30)

        # Statistics
        self.frame_count = 0
        self.total_detections = 0
        self.start_time = time.time()

        # Video recording
        self.recording = False
        self.video_writer = None
        # Local recording path - won't auto-create folder unless manually triggered
        project_root = Path(__file__).parent.parent
        self.record_path = project_root / "outputs" / "detections_output"
        # os.makedirs(self.record_path, exist_ok=True)  # Removed so it doesn't auto-create the outputs folder

        # Snapshot counter
        self.snapshot_counter = 0

        # Object tracking history (for trails)
        self.track_history = defaultdict(lambda: deque(maxlen=30))

        # Performance metrics
        self.inference_times = deque(maxlen=100)
        
        # Anomaly detection state - auto-activate if enabled
        self.anomaly_detection_active = True if self.anomaly_detector else None

        print(f"✓ Camera initialized: {self.camera_width}x{self.camera_height}")
        print(f"✓ Classes available: {len(self.model.names)}")
        print("\n" + "=" * 50)
        print("CONTROLS:")
        print("  'q' - Quit")
        print("  's' - Save snapshot")
        print("  'r' - Start/Stop recording")
        print("  '+' - Increase confidence threshold")
        print("  '-' - Decrease confidence threshold")
        print("  't' - Toggle tracking on/off")
        print("  'c' - Toggle class filtering (person only)")
        print("  'i' - Show/hide info panel")
        print("  'f' - Toggle FPS display")
        print("  'h' - Toggle tracking trails")
        print("  'n' - Toggle NMS threshold adjustment")
        print("  'm' - Toggle image size (640/1280)")
        if self.anomaly_detection_enabled:
            print("  'a' - Toggle anomaly detection on/off")
            print("  '[' - Decrease anomaly threshold")
            print("  ']' - Increase anomaly threshold")
        print("=" * 50)
        print(f"\nCurrent Detection Settings:")
        print(f"  Confidence: {self.conf_threshold:.2f}")
        print(f"  Image Size: {self.imgsz} (lower = faster FPS)")
        print(f"  Tracking: {'ON' if self.tracking else 'OFF'} (tracking reduces FPS)")
        print(f"  Max Detections: {self.max_det}")
        print("\n💡 TIP: Press 'm' to reduce image size (640) for better FPS")
        print("💡 TIP: Press 't' to disable tracking for faster detection")
        print("=" * 50 + "\n")

    def calculate_fps(self):
        """Calculate and smooth FPS"""
        current_time = time.time()
        delta_time = current_time - self.prev_time
        if delta_time > 0:
            current_fps = 1.0 / delta_time
            self.fps_history.append(current_fps)
            self.fps = np.median(list(self.fps_history)) if self.fps_history else current_fps
        self.prev_time = current_time

    def count_objects_by_class(self, results):
        """Count detected objects by class"""
        class_counts = defaultdict(int)
        if results[0].boxes is not None and len(results[0].boxes) > 0:
            for box in results[0].boxes:
                cls_id = int(box.cls[0])
                class_name = self.model.names[cls_id]
                class_counts[class_name] += 1
        return class_counts

    def draw_stats_panel(self, frame, class_counts, show_info=True, show_fps=True, show_trails=False):
        """Draw information panel on frame"""
        if not show_info and not show_fps:
            return frame

        # Transparent background - no rectangle
        # overlay = frame.copy()
        # panel_height = 220 if show_info else 50
        # if self.anomaly_detection_enabled and self.anomaly_detection_active:
        #     panel_height += 30  # Extra space for anomaly info

        # cv2.rectangle(overlay, (10, 10), (420, panel_height), (0, 0, 0), -1)
        # cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
        # cv2.rectangle(frame, (10, 10), (420, panel_height), (100, 100, 100), 2)

        y_offset = 35
        line_height = 25

        if show_fps:
            # Color coding: Green > 15, Yellow > 5, Red <= 5
            fps_color = (0, 255, 0) if self.fps > 15 else ((0, 255, 255) if self.fps > 5 else (0, 0, 255))
            # Format FPS with 2 decimal places for better readability
            fps_text = f"FPS: {self.fps:.2f}" if self.fps < 1 else f"FPS: {self.fps:.1f}"
            # Draw shadow
            cv2.putText(frame, fps_text, (20 + 1, y_offset + 1), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
            cv2.putText(frame, fps_text, (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.7, fps_color, 2)
            y_offset += line_height

        if show_info:
            total = sum(class_counts.values())
            # Draw shadow
            cv2.putText(frame, f"Objects: {total}", (20 + 1, y_offset + 1),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 2)
            cv2.putText(frame, f"Objects: {total}", (20, y_offset),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            y_offset += line_height
            
            # Show anomaly detection info if enabled
            if self.anomaly_detection_enabled and self.anomaly_detection_active and self.anomaly_detector:
                stats = self.anomaly_detector.get_statistics()
                anomaly_color = (0, 0, 255) if stats['anomaly_detected'] else (0, 255, 0)
                status_text = "⚠ ANOMALY" if stats['anomaly_detected'] else "✓ Normal"
                
                # Show calibration status
                if not stats.get('calibrated', False):
                    calib_text = f"Calibrating... ({stats.get('frame_count', 0)}/100)"
                    cv2.putText(frame, calib_text, (20, y_offset),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                    y_offset += line_height
                else:
                    # Show adaptive threshold status
                    adaptive_text = "Adaptive ON" if self.anomaly_detector.adaptive_threshold else "Fixed"
                    cv2.putText(frame, adaptive_text, (20, y_offset),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                    y_offset += line_height
                
                anomaly_text = f"{status_text}: {stats['current_score']:.3f}"
                cv2.putText(frame, anomaly_text, (20, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, anomaly_color, 2)
                y_offset += line_height
                
                # Show smoothed score if calibrated
                if stats.get('calibrated', False):
                    smooth_text = f"Smoothed: {stats.get('smoothed_score', 0.0):.3f}"
                    cv2.putText(frame, smooth_text, (20, y_offset),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                    y_offset += line_height
                
                # Show threshold
                threshold_text = f"Threshold: {stats.get('threshold', self.anomaly_detector.anomaly_threshold):.2f}"
                cv2.putText(frame, threshold_text, (20, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                y_offset += line_height
                
                # Show baseline if calibrated
                if stats.get('calibrated', False):
                    baseline_text = f"Baseline: {stats.get('baseline_mean', 0.0):.3f}±{stats.get('baseline_std', 0.0):.3f}"
                    cv2.putText(frame, baseline_text, (20, y_offset),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
                    y_offset += line_height

        return frame

    def process_frame(self, frame, show_info=True, show_fps=True, show_trails=False):
        """Process a single frame"""
        inference_start = time.time()
        
        # Enforce tracking for anomaly detection (needed for per-person clips)
        # Always use tracking if anomaly detection is initialized, or if manually enabled
        use_tracking = self.tracking or (self.anomaly_detector is not None and self.anomaly_detection_active)
        
        if use_tracking:
            results = self.model.track(
                frame, conf=self.conf_threshold, iou=self.nms_threshold,
                imgsz=self.imgsz, classes=self.classes_filter,
                max_det=self.max_det, persist=True, verbose=False,
                tracker="botsort.yaml" # Use robust tracker
            )
        else:
            results = self.model.predict(
                frame, conf=self.conf_threshold, iou=self.nms_threshold,
                imgsz=self.imgsz, classes=self.classes_filter,
                max_det=self.max_det, verbose=False
            )

        inference_time = time.time() - inference_start
        self.inference_times.append(inference_time)

        annotated_frame = results[0].plot()
        class_counts = self.count_objects_by_class(results)
        
        # Run anomaly detection if enabled and active
        if self.anomaly_detection_enabled and self.anomaly_detection_active and self.anomaly_detector:
            try:
                # Pass results for tracking info
                anomaly_score, is_anomaly = self.anomaly_detector.detect(frame, results)
                
                # Always show anomaly score (even if not detected)
                h, w = annotated_frame.shape[:2]
                score_text = f"Anomaly Score: {anomaly_score:.3f}"
                score_color = (0, 0, 255) if is_anomaly else (0, 255, 0)
                
                # Draw score background
                text_size = cv2.getTextSize(score_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
                cv2.rectangle(annotated_frame, (10, h - 40), (20 + text_size[0], h - 10), (0, 0, 0), -1)
                cv2.rectangle(annotated_frame, (10, h - 40), (20 + text_size[0], h - 10), score_color, 2)
                cv2.putText(annotated_frame, score_text, (15, h - 15),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, score_color, 2)
                
                # Visual alert if anomaly detected
                if is_anomaly:
                    # Draw red border to indicate anomaly
                    cv2.rectangle(annotated_frame, (0, 0), (w, h), (0, 0, 255), 5)
                    # Add warning text
                    cv2.putText(annotated_frame, "ANOMALY DETECTED!", (w//2 - 150, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)
            except Exception as e:
                print(f"Anomaly detection error: {e}")
                import traceback
                traceback.print_exc()
        
        self.frame_count += 1
        self.total_detections += len(results[0].boxes) if results[0].boxes is not None else 0

        # Process Tracking Information for "Walking" Detection
        if self.tracking and results[0].boxes is not None and results[0].boxes.id is not None:
             track_ids = results[0].boxes.id.int().cpu().tolist()
             boxes = results[0].boxes.xywh.cpu()
             
             for box, track_id in zip(boxes, track_ids):
                 x, y, w, h = box
                 center = (float(x), float(y))
                 
                 # Access track history for this ID
                 track = self.track_history[track_id]
                 track.append((float(x), float(y)))
                 
                 # Calculate speed (pixels per frame)
                 speed = 0
                 status = "Standing"
                 if len(track) > 2:
                     # distance between last point and 5 frames ago (or less)
                     idx = max(0, len(track) - 5)
                     prev_pt = track[idx]
                     curr_pt = track[-1]
                     dist = ((curr_pt[0] - prev_pt[0])**2 + (curr_pt[1] - prev_pt[1])**2)**0.5
                     speed = dist / (len(track) - idx) # px/frame
                     
                     if speed > 2.0: # Threshold for movement
                         status = "Walking/Moving"
                         
                 # Draw status on frame
                 # Find the box in the plot result (this is a bit tricky since plot() is already done)
                 # We will add text overlay on top of the annotated frame
                 cv2.putText(annotated_frame, f"{status} ({speed:.1f})", 
                            (int(x - w/2), int(y - h/2) - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

        annotated_frame = self.draw_stats_panel(annotated_frame, class_counts, show_info, show_fps, show_trails)
        return annotated_frame

    def run(self):
        """Main loop"""
        show_info = True
        show_fps = True
        show_trails = False

        try:
            print("Starting detection... Press 'q' to quit\n")
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    print("✗ Failed to read frame")
                    break  # FIXED: this line was misindented

                annotated_frame = self.process_frame(frame, show_info, show_fps, show_trails)
                self.calculate_fps()

                if self.recording and self.video_writer:
                    self.video_writer.write(annotated_frame)

                try:
                    cv2.imshow("Advanced Object Detection", annotated_frame)
                    key = cv2.waitKey(1) & 0xFF
                except cv2.error as e:
                    # If GUI is not available, show error and exit
                    print(f"\n✗ OpenCV GUI Error: {e}")
                    print("  This usually means OpenCV doesn't have GUI support on Windows.")
                    print("  Try: pip uninstall opencv-python && pip install opencv-python")
                    print("  Or: pip install opencv-contrib-python")
                    break

                if key == ord('q'):
                    break
                elif key == ord('s'):
                    self.save_snapshot(annotated_frame)
                elif key == ord('r'):
                    if self.recording:
                        self.stop_recording()
                    else:
                        self.start_recording(annotated_frame)
                elif key == ord('+') or key == ord('='):
                    self.conf_threshold = min(0.95, self.conf_threshold + 0.05)
                    print(f"Confidence threshold: {self.conf_threshold:.2f}")
                elif key == ord('-') or key == ord('_'):
                    self.conf_threshold = max(0.1, self.conf_threshold - 0.05)
                    print(f"Confidence threshold: {self.conf_threshold:.2f}")
                elif key == ord('t'):
                    self.tracking = not self.tracking
                    self.track_history.clear()
                    print(f"Tracking: {'ON' if self.tracking else 'OFF'}")
                elif key == ord('c'):
                    if self.classes_filter is None:
                        self.classes_filter = [0]  # Person only
                        print("Class filter: Person only")
                    else:
                        self.classes_filter = None  # All classes
                        print("Class filter: All classes")
                elif key == ord('i'):
                    show_info = not show_info
                    print(f"Info panel: {'ON' if show_info else 'OFF'}")
                elif key == ord('f'):
                    show_fps = not show_fps
                    print(f"FPS display: {'ON' if show_fps else 'OFF'}")
                elif key == ord('n'):
                    # Toggle NMS threshold
                    if self.nms_threshold == 0.45:
                        self.nms_threshold = 0.6
                    else:
                        self.nms_threshold = 0.45
                    print(f"NMS threshold: {self.nms_threshold:.2f}")
                elif key == ord('m'):
                    # Toggle image size between 640 and 1280
                    if self.imgsz == 1280:
                        self.imgsz = 640
                        print("Image size: 640 (faster, less accurate)")
                    else:
                        self.imgsz = 1280
                        print("Image size: 1280 (slower, more accurate)")
                elif key == ord('a') and self.anomaly_detection_enabled:
                    # Toggle anomaly detection
                    self.anomaly_detection_active = not self.anomaly_detection_active
                    print(f"Anomaly detection: {'ON' if self.anomaly_detection_active else 'OFF'}")
                elif key == ord('[') and self.anomaly_detection_enabled and self.anomaly_detector:
                    # Decrease base threshold
                    new_threshold = max(0.1, self.anomaly_detector.base_threshold - 0.05)
                    self.anomaly_detector.base_threshold = new_threshold
                    print(f"Base threshold: {new_threshold:.2f}")
                    if not self.anomaly_detector.adaptive_threshold:
                        self.anomaly_detector.set_threshold(new_threshold)
                elif key == ord(']') and self.anomaly_detection_enabled and self.anomaly_detector:
                    # Increase anomaly threshold
                    new_threshold = min(1.0, self.anomaly_detector.base_threshold + 0.05)
                    self.anomaly_detector.base_threshold = new_threshold
                    print(f"Base threshold: {new_threshold:.2f}")
                    if not self.anomaly_detector.adaptive_threshold:
                        self.anomaly_detector.set_threshold(new_threshold)
                elif key == ord('k') and self.anomaly_detection_enabled and self.anomaly_detector:
                    # Recalibrate
                    self.anomaly_detector.recalibrate()
                    print("Recalibrating anomaly detector...")
                elif key == ord('h') and self.anomaly_detection_enabled and self.anomaly_detector:
                    # Toggle adaptive threshold
                    self.anomaly_detector.adaptive_threshold = not self.anomaly_detector.adaptive_threshold
                    status = "ON" if self.anomaly_detector.adaptive_threshold else "OFF"
                    print(f"Adaptive threshold: {status}")
        except KeyboardInterrupt:
            print("\n✗ Interrupted by user")
        finally:
            self.cleanup()

    def save_snapshot(self, frame):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        os.makedirs(self.record_path, exist_ok=True)  # Create only if explicitly triggered
        filename = os.path.join(self.record_path, f"snapshot_{timestamp}.jpg")
        cv2.imwrite(filename, frame)
        print(f"✓ Snapshot saved: {filename}")

    def start_recording(self, frame):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        os.makedirs(self.record_path, exist_ok=True)  # Create only if explicitly triggered
        filename = os.path.join(self.record_path, f"recording_{timestamp}.mp4")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        height, width = frame.shape[:2]
        fps = max(20, int(self.fps)) if self.fps > 0 else 20
        self.video_writer = cv2.VideoWriter(filename, fourcc, fps, (width, height))
        self.recording = True
        print(f"✓ Recording started: {filename}")

    def stop_recording(self):
        if self.recording and self.video_writer:
            self.video_writer.release()
            self.video_writer = None
            self.recording = False
            print("✓ Recording stopped")

    def cleanup(self):
        """Cleanup resources"""
        self.stop_recording()
        self.cap.release()
        try:
            cv2.destroyAllWindows()
        except cv2.error:
            # If GUI is not available, ignore the error
            pass

        elapsed_time = time.time() - self.start_time
        avg_fps = self.frame_count / elapsed_time if elapsed_time > 0 else 0
        avg_inference = np.mean(list(self.inference_times)) * 1000 if self.inference_times else 0

        print("\n" + "=" * 50)
        print("SESSION STATISTICS:")
        print("=" * 50)
        print(f"  Total frames processed: {self.frame_count}")
        print(f"  Total detections: {self.total_detections}")
        print(f"  Session duration: {elapsed_time:.1f} seconds")
        print(f"  Average FPS: {avg_fps:.1f}")
        print(f"  Average inference time: {avg_inference:.1f} ms")
        print("=" * 50)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Smart Surveillance System with Object Detection and Anomaly Detection')
    parser.add_argument('--anomaly', action='store_true', help='Enable anomaly detection')
    parser.add_argument('--anomaly-model', type=str, default=None, help='Path to anomaly detection model weights')
    parser.add_argument('--i3d-model', type=str, default=None, help='Path to I3D feature extractor weights')
    parser.add_argument('--camera', type=int, default=0, help='Camera ID (default: 0)')
    parser.add_argument('--model', type=str, default=None, help='YOLO model path (default: backend/models/YOLO26M_L4_768_weights_best.pt)')
    
    args = parser.parse_args()
    
    try:
        detector = AdvancedObjectDetector(
            model_path=args.model,
            camera_id=args.camera,
            enable_anomaly_detection=args.anomaly,
            anomaly_model_path=args.anomaly_model,
            i3d_model_path=args.i3d_model
        )
        detector.run()
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("Make sure your camera is connected and the model file exists.")
