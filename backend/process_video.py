"""
Process Video File for Object Detection and Anomaly Detection
Supports both YOLO object detection and I3D anomaly detection on video files
"""

import cv2
from ultralytics import YOLO
import time
import os
from collections import defaultdict, deque
from datetime import datetime
import numpy as np
import argparse

# Optional: Import anomaly detection module
try:
    from anomaly_detector import AnomalyDetector
    ANOMALY_DETECTION_AVAILABLE = True
except ImportError:
    ANOMALY_DETECTION_AVAILABLE = False
    print("⚠ Anomaly detection module not available. Install torch and torchvision for anomaly detection.")


class VideoProcessor:
    def __init__(self, 
                 video_path,
                 model_path='models/YOLO26M_L4_768_weights_best.pt',
                 enable_anomaly_detection=False,
                 anomaly_model_path=None,
                 i3d_model_path=None,
                 output_path=None,
                 anomaly_threshold=0.3):
        """Initialize video processor"""
        
        # Load YOLO model
        try:
            self.model = YOLO(model_path)
            print(f"✓ Model loaded: {model_path}")
        except Exception as e:
            print(f"✗ Error loading model: {e}")
            raise
        
        # Initialize anomaly detector if requested
        self.anomaly_detector = None
        self.anomaly_detection_enabled = False
        if enable_anomaly_detection and ANOMALY_DETECTION_AVAILABLE:
            try:
                # Use lower threshold for better detection (car crashes score ~0.3-0.4)
                # Default 0.3 works better than 0.4 for detecting crashes
                self.anomaly_detector = AnomalyDetector(
                    learner_model_path=anomaly_model_path,
                    i3d_model_path=i3d_model_path,
                    window_size=64,  # Fixed: matches training config & anomaly_detector.py default
                    anomaly_threshold=anomaly_threshold
                )
                print(f"  Anomaly threshold: {anomaly_threshold} (adjustable with --threshold)")
                self.anomaly_detection_enabled = True
                print("✓ Anomaly detection enabled")
            except Exception as e:
                print(f"⚠ Warning: Could not initialize anomaly detector: {e}")
                print("  Continuing with object detection only...")
        
        # Open video file
        self.cap = cv2.VideoCapture(video_path)
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open video: {video_path}")
        
        # Get video properties
        self.fps = int(self.cap.get(cv2.CAP_PROP_FPS))
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"✓ Video loaded: {video_path}")
        print(f"  Resolution: {self.width}x{self.height}")
        print(f"  FPS: {self.fps}")
        print(f"  Total frames: {self.total_frames}")
        print(f"  Duration: {self.total_frames/self.fps:.1f} seconds")
        
        # Output video
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = os.path.join("detections_output", f"processed_{timestamp}.mp4")
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.video_writer = cv2.VideoWriter(output_path, fourcc, self.fps, (self.width, self.height))
        self.output_path = output_path
        
        # Configuration
        self.conf_threshold = 0.25
        self.nms_threshold = 0.45
        self.imgsz = 640
        
        # Statistics
        self.frame_count = 0
        self.total_detections = 0
        self.start_time = time.time()
        self.anomaly_detection_active = True if self.anomaly_detector else False
        
        print(f"\n✓ Output will be saved to: {output_path}")
        print("=" * 60)
    
    def count_objects_by_class(self, results):
        """Count detected objects by class"""
        class_counts = defaultdict(int)
        if results[0].boxes is not None and len(results[0].boxes) > 0:
            for box in results[0].boxes:
                cls_id = int(box.cls[0])
                class_name = self.model.names[cls_id]
                class_counts[class_name] += 1
        return class_counts
    
    def draw_stats_panel(self, frame, class_counts):
        """Draw information panel on frame"""
        overlay = frame.copy()
        panel_height = 200
        
        if self.anomaly_detection_enabled and self.anomaly_detection_active:
            panel_height += 30
        
        cv2.rectangle(overlay, (10, 10), (420, panel_height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
        cv2.rectangle(frame, (10, 10), (420, panel_height), (100, 100, 100), 2)
        
        y_offset = 35
        line_height = 25
        
        # Frame info
        progress = (self.frame_count / self.total_frames) * 100 if self.total_frames > 0 else 0
        cv2.putText(frame, f"Frame: {self.frame_count}/{self.total_frames} ({progress:.1f}%)", 
                   (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += line_height
        
        # Object count
        total = sum(class_counts.values())
        cv2.putText(frame, f"Objects: {total}", (20, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
        y_offset += line_height
        
        # Anomaly detection info
        if self.anomaly_detection_enabled and self.anomaly_detection_active and self.anomaly_detector:
            stats = self.anomaly_detector.get_statistics()
            anomaly_color = (0, 0, 255) if stats['anomaly_detected'] else (0, 255, 0)
            status_text = "⚠ ANOMALY" if stats['anomaly_detected'] else "✓ Normal"
            anomaly_text = f"{status_text}: {stats['current_score']:.3f}"
            cv2.putText(frame, anomaly_text, (20, y_offset),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, anomaly_color, 2)
            y_offset += line_height
            threshold_text = f"Threshold: {self.anomaly_detector.anomaly_threshold:.2f}"
            cv2.putText(frame, threshold_text, (20, y_offset),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
            y_offset += line_height
        
        # Top classes
        if class_counts:
            top_classes = sorted(class_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            for class_name, count in top_classes:
                cv2.putText(frame, f"  {class_name}: {count}", (20, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                y_offset += line_height
        
        return frame
    
    def process_frame(self, frame):
        """Process a single frame"""
        # Object detection
        results = self.model.predict(
            frame, conf=self.conf_threshold, iou=self.nms_threshold,
            imgsz=self.imgsz, verbose=False
        )
        
        annotated_frame = results[0].plot()
        class_counts = self.count_objects_by_class(results)
        
        # Anomaly detection
        if self.anomaly_detection_enabled and self.anomaly_detection_active and self.anomaly_detector:
            try:
                anomaly_score, is_anomaly = self.anomaly_detector.detect(frame)
                
                # Show anomaly score
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
                    cv2.rectangle(annotated_frame, (0, 0), (w, h), (0, 0, 255), 5)
                    cv2.putText(annotated_frame, "ANOMALY DETECTED!", (w//2 - 150, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)
            except Exception as e:
                print(f"Anomaly detection error: {e}")
        
        self.frame_count += 1
        self.total_detections += len(results[0].boxes) if results[0].boxes is not None else 0
        
        annotated_frame = self.draw_stats_panel(annotated_frame, class_counts)
        return annotated_frame
    
    def process(self, show_preview=True):
        """Process entire video"""
        print("\nProcessing video...")
        print("Press 'q' to quit (if preview enabled)")
        print("=" * 60)
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    break
                
                processed_frame = self.process_frame(frame)
                self.video_writer.write(processed_frame)
                
                if show_preview:
                    cv2.imshow("Video Processing", processed_frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                
                # Progress update
                if self.frame_count % 30 == 0:
                    progress = (self.frame_count / self.total_frames) * 100 if self.total_frames > 0 else 0
                    elapsed = time.time() - self.start_time
                    fps_actual = self.frame_count / elapsed if elapsed > 0 else 0
                    print(f"Progress: {progress:.1f}% | Frame: {self.frame_count}/{self.total_frames} | "
                          f"FPS: {fps_actual:.1f} | Detections: {self.total_detections}")
        
        except KeyboardInterrupt:
            print("\n✗ Processing interrupted by user")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Cleanup resources"""
        self.cap.release()
        self.video_writer.release()
        cv2.destroyAllWindows()
        
        elapsed_time = time.time() - self.start_time
        avg_fps = self.frame_count / elapsed_time if elapsed_time > 0 else 0
        
        print("\n" + "=" * 60)
        print("PROCESSING COMPLETE!")
        print("=" * 60)
        print(f"  Total frames processed: {self.frame_count}")
        print(f"  Total detections: {self.total_detections}")
        print(f"  Processing time: {elapsed_time:.1f} seconds")
        print(f"  Average FPS: {avg_fps:.1f}")
        print(f"  Output saved to: {self.output_path}")
        print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process video file for object and anomaly detection')
    parser.add_argument('video_path', type=str, help='Path to input video file')
    parser.add_argument('--model', type=str, default='models/YOLO26M_L4_768_weights_best.pt', help='YOLO model path')
    parser.add_argument('--anomaly', action='store_true', help='Enable anomaly detection')
    parser.add_argument('--anomaly-model', type=str, default=None, help='Path to anomaly detection model')
    parser.add_argument('--i3d-model', type=str, default=None, help='Path to I3D model')
    parser.add_argument('--output', type=str, default=None, help='Output video path')
    parser.add_argument('--no-preview', action='store_true', help='Disable preview window')
    parser.add_argument('--threshold', type=float, default=0.3, help='Anomaly detection threshold (default: 0.3)')
    
    args = parser.parse_args()
    
    try:
        processor = VideoProcessor(
            video_path=args.video_path,
            model_path=args.model,
            enable_anomaly_detection=args.anomaly,
            anomaly_model_path=args.anomaly_model,
            i3d_model_path=args.i3d_model,
            output_path=args.output,
            anomaly_threshold=args.threshold
        )
        processor.process(show_preview=not args.no_preview)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()

