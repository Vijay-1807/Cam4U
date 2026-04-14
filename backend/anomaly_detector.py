"""
Real-time Anomaly Detection Module
Uses InceptionI3D + MIL Classifier on the FULL FRAME (No YOLO required)
Matches the exact logic of the live I3D demo script.
"""

import torch
import torch.nn as nn
import numpy as np
import cv2
from collections import deque
import os
import sys
from pathlib import Path
import time

# Add backend directory to path
sys.path.append(str(Path(__file__).parent))

from i3d import InceptionI3d

############################################
# MULTIPLE INSTANCE LEARNING MODEL
############################################
class MILModel(nn.Module):
    def __init__(self, input_dim=1024):
        super(MILModel, self).__init__()
        
        # New Attention-Hybrid Feature Head
        self.feature_head = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.LayerNorm(256),
            nn.GELU(),
            nn.Dropout(0.4),
        )

        # Simplified Attention Mechanism
        self.attention = nn.Sequential(
            nn.Linear(256, 128),
            nn.Tanh(),
            nn.Linear(128, 1)
        )

        # Final score
        self.classifier = nn.Linear(256, 1)

    def forward(self, x, lengths=None):
        # Handle both single instance and batch
        if len(x.shape) == 2:
            x = x.unsqueeze(0)
            
        batch, num_windows, dim = x.shape
        x_flat = x.view(-1, dim)

        h = self.feature_head(x_flat)            # [B*T, 256]
        
        # Get instance scores and raw attention weights
        instance_scores = self.classifier(h).view(batch, num_windows)
        attn_logits = self.attention(h).view(batch, num_windows)

        video_scores = []
        for i in range(batch):
            T = lengths[i].item() if lengths is not None else num_windows
            if T == 0:
                video_scores.append(torch.tensor(0.0, device=x.device))
                continue

            s = instance_scores[i, :T]
            a = attn_logits[i, :T]

            # 1. Attention pooling
            w = torch.softmax(a, dim=0)
            attn_score = (w * s).sum()

            # 2. Top-K pooling (10% - Matches new training config)
            k = max(1, int(0.1 * T))
            topk_score = torch.topk(s, k=k)[0].mean()

            # Hybrid (0.5 weight each)
            out = 0.5 * attn_score + 0.5 * topk_score
            video_scores.append(out)

        video_scores = torch.stack(video_scores).unsqueeze(1)
        return video_scores, instance_scores

class AnomalyDetector:
    """
    SOTA Full-Frame Anomaly Detector.
    Pipeline:
    1. Full Frame Resizing (224x224 RGB)
    2. Temporal Buffering (64 frames)
    3. I3D Feature Extraction (RGB Stream)
    4. Attention-Hybrid MIL score calculation
    """
    
    def __init__(self, 
                 learner_model_path=None,
                 i3d_model_path=None,
                 device='cuda' if torch.cuda.is_available() else 'cpu',
                 window_size=64,          # Size of one clip for I3D
                 buffer_size=64,          # Total buffer size for aggregation
                 anomaly_threshold=0.0884, # NEW OPTIMAL THRESHOLD (90% ACC)
                 smoothing_window=5):     # Temporal smoothing for final output
        
        # GPU OPTIMIZATION for RTX 3050
        if device == 'cuda' and torch.cuda.is_available():
            self.device = 'cuda:0'
            gpu_name = torch.cuda.get_device_name(0)
            print(f"✓ Anomaly Detector using GPU: {gpu_name}", flush=True)
            # Enable TF32 for RTX 30xx series
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
        else:
            self.device = 'cpu'
            print(f"⚠ Anomaly Detector using CPU (slower)", flush=True)
            
        self.window_size = window_size
        self.buffer_size = buffer_size
        self.anomaly_threshold = anomaly_threshold
        
        # Track buffers: single deque of frames
        # We keep 64 frames (roughly 2-3 seconds at 30fps)
        self.frame_buffer = deque(maxlen=self.window_size)
        
        # Track scores for smoothing
        self.score_history = []
        self.smoothed_history = []
        self.smoothing_window = smoothing_window
        
        # Statistics
        self.current_score = 0.0
        self.anomaly_detected = False
        self.frame_count = 0
        
        # Calibration (Adapted for low threshold)
        self.calibrated = False
        self.calibration_scores = []
        self.CALIBRATION_FRAMES = 100
        self.baseline_score = 0.0
        self.MARGIN = 0.02 # Smaller margin for sensitive models
        self.adaptive_threshold = True
        self.base_threshold = anomaly_threshold
        
        # Load I3D Feature Extractor - GPU OPTIMIZED
        print(f"Initializing InceptionI3D on {self.device}...")
        self.i3d = InceptionI3d(num_classes=400, in_channels=3)
        self.i3d.to(self.device)
        self.i3d.eval()
        
        # Setup logic will be applied after loading weights
        
        # OPTIMIZE FOR RTX 3050: Use half precision if GPU available
        if self.device.startswith('cuda'):
            try:
                self.i3d = self.i3d.half()  # FP16 for 2x speedup
                print(f"✓ I3D using FP16", flush=True)
            except:
                pass
        
        # Load I3D Weights
        self.load_i3d_weights(i3d_model_path)
        
        # Load MIL Model (classifier) - GPU OPTIMIZED
        self.learner = MILModel(input_dim=1024).to(self.device)
        self.learner.eval()
        
        # OPTIMIZE FOR RTX 3050: Use half precision if GPU available
        if self.device.startswith('cuda'):
            try:
                self.learner = self.learner.half()  # FP16 for 2x speedup
                print(f"✓ Learner using FP16", flush=True)
            except:
                pass
        
        self.load_learner_weights(learner_model_path)
        
        print("✓ Full-Frame Anomaly Detector Initialized successfully!", flush=True)

    def load_i3d_weights(self, path):
        if not path:
             print("⚠ No I3D weights provided!")
             return

        # Resolve path
        if not os.path.isabs(path):
            if os.path.exists(path):
                pass
            else:
                project_root = Path(__file__).parent.parent
                path = project_root / "models" / "weights" / Path(path).name
            
        if os.path.exists(path):
            try:
                state_dict = torch.load(path, map_location=self.device)
                if 'state_dict' in state_dict:
                    state_dict = state_dict['state_dict']
                self.i3d.load_state_dict(state_dict, strict=False)
                print(f"✓ Loaded I3D weights from {path}")
            except Exception as e:
                print(f"✗ Failed to load I3D: {e}")
        else:
            print(f"⚠ I3D weights not found at {path}")

    def load_learner_weights(self, path):
        if not path:
            print("⚠ No Learner weights provided!")
            return

        if not os.path.isabs(path):
            if os.path.exists(path):
                pass
            else:
                project_root = Path(__file__).parent.parent
                path = project_root / "models" / "weights" / Path(path).name
            
        if os.path.exists(path):
            try:
                checkpoint = torch.load(path, map_location=self.device)
                if 'net' in checkpoint:
                    self.learner.load_state_dict(checkpoint['net'], strict=False)
                elif 'state_dict' in checkpoint:
                     self.learner.load_state_dict(checkpoint['state_dict'], strict=False)
                else:
                    self.learner.load_state_dict(checkpoint, strict=False)
                print(f"✓ Loaded Learner weights from {path}")
            except Exception as e:
                print(f"✗ Failed to load Learner: {e}")
        else:
            print(f"⚠ Learner weights not found at {path}")

    def extract_features_clip(self, clip_tensor):
        """Extract features for a clip input (1, 3, T, 224, 224)."""
        with torch.no_grad():
            features = self.i3d.extract_features(clip_tensor)
            return features

    def detect(self, frame, results=None):
        """
        Main detection loop. We don't need YOLO results.
        Args:
            frame: Full Original Frame (numpy)
            results: Ignored (kept for signature compatibility)
        """
        self.frame_count += 1
        
        # I3D requires 224x224 RGB inputs normalized between [-1, 1]
        resized_frame = cv2.resize(frame, (224, 224))
        rgb_frame = cv2.cvtColor(resized_frame, cv2.COLOR_BGR2RGB)
        self.frame_buffer.append(rgb_frame)
        
        # Wait for buffer to fill 16/64 frames
        if len(self.frame_buffer) == self.window_size:
            # Prepare 64-frame clip strictly identical to training script
            clip = np.array(self.frame_buffer, dtype=np.float32) / 255.0
            clip = clip * 2 - 1
            
            # [Batch, Channels, Depth, Height, Width]
            clip = torch.from_numpy(clip).permute(3,0,1,2).unsqueeze(0).to(self.device)
            
            # Convert to float16 for GPU performance if enabled
            if self.device.startswith('cuda') and hasattr(self.i3d, 'half'):
                clip = clip.half()

            try:
                with torch.no_grad():
                    with torch.amp.autocast(device_type=self.device.split(':')[0] if ':' in self.device else self.device):
                        feat = self.extract_features_clip(clip)
                        feat = feat.mean([2, 3, 4]) # Reduce to [1, 1024] feature vector
                        
                        # Pass through new Attention-Hybrid MIL model
                        video_scores, instance_scores = self.learner(feat)
                        
                        # Apply Sigmoid to the video-level score
                        score = torch.sigmoid(video_scores).item()
                        
            except Exception as e:
                import traceback
                print(f"Compute error: {e}\n{traceback.format_exc()}", flush=True)
                score = self.current_score
                
            self.score_history.append(score)
            
            # Smoothing Logic (moving average)
            if len(self.score_history) >= self.smoothing_window:
                smooth_score = np.mean(self.score_history[-self.smoothing_window:])
            else:
                smooth_score = score
                
            self.smoothed_history.append(smooth_score)
            self.current_score = smooth_score
            
            # Auto-Calibration
            if not self.calibrated:
                self.calibration_scores.append(smooth_score)
                self.anomaly_detected = False
                
                if len(self.calibration_scores) >= self.CALIBRATION_FRAMES:
                    self.calibrated = True
                    self.baseline_score = np.mean(self.calibration_scores)
                    
                    if self.adaptive_threshold:
                        self.anomaly_threshold = min(0.9, self.baseline_score + self.MARGIN)
                    
                    print(f"✓ Calibration Done! Baseline: {self.baseline_score:.3f} | Threshold: {self.anomaly_threshold:.3f}")
            else:
                # Normal Operation
                self.anomaly_detected = self.current_score > self.anomaly_threshold
        
        return self.current_score, self.anomaly_detected

    def get_statistics(self):
        """Used by external dashboards to read stats"""
        return {
            'current_score': self.current_score,
            'anomaly_detected': self.anomaly_detected,
            'threshold': self.anomaly_threshold,
            'calibrated': self.calibrated,
            'frame_count': self.frame_count,
            'history': self.smoothed_history[-100:] if self.smoothed_history else []  # return graph data points
        }
        
    def set_threshold(self, threshold):
        """Set anomaly threshold manually"""
        self.anomaly_threshold = max(0.01, min(1.0, threshold))
        self.base_threshold = self.anomaly_threshold
    
    def recalibrate(self):
        """Reset and recalibrate"""
        self.calibrated = False
        self.calibration_scores.clear()
        self.score_history.clear()
        self.smoothed_history.clear()
        self.current_score = 0.0
        self.anomaly_detected = False
    
    def reset(self):
        self.frame_buffer.clear()
        self.score_history.clear()
        self.smoothed_history.clear()
        self.current_score = 0.0
        self.anomaly_detected = False
