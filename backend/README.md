# Aqua Sentinel Backend

FastAPI-based backend for underwater sonar object detection using YOLOv8n.

## Quick Start

### 1. Prerequisites
- Python 3.10 or newer
- pip

### 2. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure environment (optional)
```bash
cp .env.example .env
# Edit .env to set custom model path or other settings
```

### 4. Start the server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The first startup will automatically download YOLOv8n weights (~6 MB) from Ultralytics CDN.

### 5. Verify
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","model":"yolov8n","model_path":"yolov8n","version":"1.0.0"}
```

### 6. API Docs
Open http://localhost:8000/docs for Swagger UI.

---

## API Endpoints

### `GET /health`
Returns server status and model info. Polled every 10s by the frontend.

**Response:**
```json
{
  "status": "ok",
  "model": "yolov8n",
  "model_path": "yolov8n",
  "version": "1.0.0"
}
```

### `POST /analyze`
Analyze a sonar image for underwater objects.

**Form fields:**
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | File | ✅ | — | Sonar image (PNG/JPG/TIFF/PBM) |
| `nav_csv` | File | ❌ | — | Navigation CSV with lat/lon |
| `slant_range_correction` | bool | ❌ | true | Apply slant-range correction |
| `clahe_equalization` | bool | ❌ | true | Apply CLAHE contrast enhancement |
| `nadir_excision` | bool | ❌ | false | Blank the nadir zone |
| `confidence_threshold` | float | ❌ | 0.25 | Detection confidence cutoff (0–1) |
| `vessel_lat` | float | ❌ | — | Vessel GPS latitude |
| `vessel_lon` | float | ❌ | — | Vessel GPS longitude |

**Response:** `AnalysisResult` JSON (see `models.py`)

---

## Custom Model Weights

To use custom fine-tuned weights trained on sonar imagery:

1. Place your `.pt` file at `../ml/weights/best.pt`
2. Set in `.env`:
   ```
   MODEL_PATH=../ml/weights/best.pt
   ```
3. Restart the server

---

## Project Structure

```
backend/
├── main.py           ← FastAPI app, routes, request validation
├── inference.py      ← YOLO inference + preprocessing pipeline
├── models.py         ← Pydantic models (mirrors frontend TypeScript types)
├── requirements.txt  ← Python dependencies
├── .env.example      ← Environment variable template
└── README.md         ← This file
```
