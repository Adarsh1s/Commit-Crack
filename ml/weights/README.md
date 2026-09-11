# ML Model Weights

Place your custom fine-tuned YOLOv8n weights here as `best.pt`.

## Using Custom Weights

1. Copy your trained weights: `cp /path/to/your/best.pt ./best.pt`
2. Update backend/.env:
   ```
   MODEL_PATH=../ml/weights/best.pt
   ```
3. Restart the backend server.

## Training Your Own Weights

See the parent `ml/README.md` for full training instructions.

## Base Model

If no custom weights are found, the backend automatically downloads
`yolov8n.pt` (YOLOv8 Nano, COCO-pretrained) from Ultralytics CDN.

Source model repository: https://github.com/ahmad-kaif/UnderWaterObjectDetection
