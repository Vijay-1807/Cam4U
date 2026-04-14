import torch
from ultralytics import YOLO
import os

model_path = r"c:\Users\Bonth\Downloads\object-detection-using-webcam\backend\models\YOLO26M_L4_768_weights_best.pt"

if not os.path.exists(model_path):
    print(f"FAIL: {model_path} not found")
else:
    try:
        model = YOLO(model_path)
        print(f"SUCCESS: Loaded {model_path}")
        print(f"Task: {model.task}")
        print(f"Classes found ({len(model.names)}):")
        for i in range(min(20, len(model.names))):
            print(f"  ID {i}: {model.names[i]}")
        
        # Check specific IDs user mentioned
        for i in [11, 14]:
            if i in model.names:
                print(f"  ID {i}: {model.names[i]}")
            else:
                print(f"  ID {i}: NOT IN NAMES")
                
    except Exception as e:
        print(f"ERROR: {e}")
