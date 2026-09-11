# 🌊 Aqua Sentinel — Underwater Sonar Object Detection

A full-stack maritime intelligence platform for detecting, classifying, and localizing underwater objects in multibeam forward-looking sonar imagery using **YOLOv8** and computer vision algorithms.

---

## 📁 Repository Structure

The project is organized into dedicated, self-contained modules:

```
Commit-Crack/
├── frontend/             # React 18 + Vite + TypeScript dashboard UI
│   ├── src/              # Components, state management, hooks & styles
│   ├── public/           # Static assets & sample sonar imagery
│   └── package.json      # Frontend scripts & dependencies
│
├── backend/              # FastAPI Python inference server
│   ├── main.py           # REST endpoints (GET /health, POST /analyze)
│   ├── inference.py      # YOLOv8 + AHSD acoustic target inference pipeline
│   ├── models.py         # Pydantic schemas mirroring frontend types
│   └── requirements.txt  # Python backend dependencies
│
├── MODELS/               # Dedicated model weights directory
│   └── yolov8n.pt        # Neural network weights for object detection
│
├── ml/                   # Machine learning metadata & references
│   ├── class_map.json    # 10-Class UATD sonar taxonomy mapping
│   ├── model_info.json   # Model architecture & benchmark specs
│   └── samples/          # Multibeam sonar test images
│
├── start.bat             # 1-Click Windows launcher (starts backend & frontend)
└── README.md             # Project documentation
```

---

## 🎯 Features

- **Deep Learning Sonar Inference**: YOLOv8n object detection augmented with Acoustic Highlight & Shadow Detection (AHSD) for low-contrast multibeam sonar scans.
- **10 Underwater Target Categories**: Detects Cubes, Cylinders (mines/pipes), Tyres, Floats, Human silhouettes, Cages, Drums, Aircraft wreckage, and Submersibles (ROVs).
- **Interactive Visualizer**: Dynamic center viewport toggling between annotated bounding boxes with confidence pills and raw sonar imagery.
- **Geospatial & Metric Estimation**: Estimates object length, width, area, relief height, and computes geographic GPS coordinates from vessel telemetry.
- **Target Inspection Drawer & Export**: Detailed acoustic thumbnail inspection, hazard risk indicators (Critical, High, Medium, Low), and 1-click CSV/JSON export.
- **1-Click Sample Testing**: Built-in button to load authentic multibeam sonar images (`07600.jpg`) directly into the pipeline.

---

## 🚀 Quickstart

### Option 1: One-Click Launch (Windows)
Double-click **`start.bat`** in the project root. Both the FastAPI backend (`:8000`) and the Vite frontend (`:5173`) will launch automatically in separate terminal windows.

### Option 2: Manual Launch

#### 1. Start Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API Documentation will be live at: `http://localhost:8000/docs`

#### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, React-Leaflet, Lucide Icons |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic v2 |
| **Vision & ML** | Ultralytics YOLOv8, OpenCV (`cv2`), NumPy, Pillow |
| **Dataset & Taxonomy** | UATD (Underwater Acoustic Target Detection Dataset) |

---

## 📄 License

This project is licensed under the terms of the [LICENSE](LICENSE) file included in this repository.

