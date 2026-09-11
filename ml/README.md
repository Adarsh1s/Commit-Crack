# 🎯 Aqua Sentinel — ML Model Documentation

## Model Overview

| Property | Value |
|---|---|
| Architecture | YOLOv8n (You Only Look Once, Nano) |
| Task | Object Detection (Bounding Boxes + Classification) |
| mAP@0.5 | ~83% |
| Input Resolution | 640 × 640 px |
| Framework | Ultralytics YOLOv8 |
| Training Dataset | Forward-Looking Sonar (FLS) Imagery |

## Source

> **Repository**: https://github.com/ahmad-kaif/UnderWaterObjectDetection  
> **Primary Model**: `objectDetectionDL_YOLOv8n/`

## Detection Classes

| Class ID | Label | Hazard Risk | Description |
|---|---|---|---|
| 0 | `crab_pot` | LOW | Submerged crab/lobster traps |
| 1 | `submarine_pipeline` | HIGH | Subsea oil/gas or water pipelines |
| 2 | `shipwreck` | HIGH | Sunken vessel wreckage & hull structures |
| 3 | `ghost_net` | MEDIUM | Abandoned fishing nets & derelict gear |
| 4 | `mine_cylinder` | CRITICAL | Cylindrical sea mines & unexploded ordnance |

## Performance Benchmarks

| Metric | Value |
|---|---|
| mAP@0.5 | 83% |
| Precision | ~87% |
| Recall | ~79% |
| Inference Speed (CPU) | ~45–60ms/image |

## Model Weights

On first backend startup, `ultralytics` automatically downloads `yolov8n.pt`.

To use custom fine-tuned weights:
1. Place your `.pt` file in `ml/weights/best.pt`
2. Set `MODEL_PATH=../ml/weights/best.pt` in `backend/.env`

## Retraining

```bash
yolo detect train model=yolov8n.pt data=dataset.yaml epochs=100 imgsz=640 batch=16
```

dataset.yaml:
```yaml
path: ./dataset
train: images/train
val: images/val
nc: 5
names: ['crab_pot', 'submarine_pipeline', 'shipwreck', 'ghost_net', 'mine_cylinder']
```

*Aqua Sentinel v1.0 — Maritime Acoustic Intelligence*
