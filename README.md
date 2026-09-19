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

---

## ⚡ CLI Simulation & Automated Patrol Testing (`test_run.py`)

Aqua Sentinel includes a standalone CLI script [`test_run.py`](test_run.py) to simulate autonomous submarine reconnaissance missions, process sonar frames, cluster detections into realistic tactical anomaly hotspots, and **stream real-time updates directly to the web dashboard**.

> [!NOTE]
> When `test_run.py` runs, it automatically broadcasts telemetry and detection results via SSE to the running backend (`http://localhost:8000/api/v1/mission/broadcast`). If your web dashboard is open at `http://localhost:5173`, the interactive tactical map and analytics will update **live in real-time**!

### 🕹️ Quick Command Reference

```bash
# 1. Standard Autonomous Patrol (Default: random route, 30s total duration, 2-3 hotspots)
python test_run.py

# 2. Fast Reconnaissance Simulation (15 seconds total mission duration)
python test_run.py --duration 15

# 3. High-Fidelity Extended Patrol (60 seconds mission duration)
python test_run.py --duration 60

# 4. Eastern Naval Command Patrol (Visakhapatnam to Chennai)
python test_run.py --route vizag_chennai --duration 30

# 5. Western Naval Command Arabian Sea Corridor (Mumbai to Kochi)
python test_run.py --route mumbai_kochi --duration 45

# 6. Strategic Chokepoint Patrol (Gulf of Kutch to Mumbai Offshore)
python test_run.py --route kutch_mumbai --duration 30

# 7. Island Defense Patrol (Lakshadweep Archipelago Deep-Sea Transect)
python test_run.py --route lakshadweep --duration 40

# 8. High-Density Tactical Hotspots (Simulate 4 distinct contact clusters)
python test_run.py --hotspots --hotspot-count 4 --duration 35

# 9. Custom Confidence Threshold & Bounding Box Padding
python test_run.py --conf 0.35 --pad 0.15

# 10. Single Sonar Image Inspection
python test_run.py --single "C:/path/to/sonar_scan.jpg"

# 11. Custom Sonar Image Directory
python test_run.py --dir "ml/samples" --route vizag_chennai
```

### ⚙️ Command-Line Arguments Table

| Flag / Option | Type | Default | Description |
|---|---|---|---|
| `--duration` | `float` | `30.0` | **Total duration (in seconds)** for the submarine to complete the route. Submarine travel time is automatically calculated per frame (`duration / total_frames`). |
| `--route` | `string` | `random` | Selected naval corridor: `mumbai_kochi`, `vizag_chennai`, `kutch_mumbai`, `lakshadweep`, or `random`. |
| `--hotspots` / `--no-hotspots` | `flag` | `True` | Cluster sonar frames into 2-3 realistic acoustic anomaly hotspots along the transit route. |
| `--hotspot-count` | `int` | `3` | Number of anomaly clusters to generate along the route (e.g. 2 to 5). |
| `--interval` | `float` | `None` | (Optional) Override frame-to-frame pause in seconds directly. |
| `--single` | `path` | `None` | Run one-off inference on a single sonar image file. |
| `--dir` | `path` | Auto-detect | Directory containing multibeam sonar frames (`ml/samples/` or dataset). |
| `--conf` | `float` | `0.25` | YOLO detection confidence threshold ($0.05 - 0.95$). |
| `--pad` | `float` | `0.10` | Bounding box margin padding fraction ($0.0 - 0.5$). |
| `--backend` | `url` | `http://127.0.0.1:8000` | Target FastAPI backend URL for live streaming to the web app. |

### 🛠️ In-Code Configuration

You can also edit the top-level variables directly at the beginning of [`test_run.py`](test_run.py):
```python
# ==============================================================================
# MISSION EXECUTION PARAMETERS (EDIT FREELY FOR RAPID TESTING)
# ==============================================================================
TOTAL_MISSION_DURATION_SECONDS: float = 30.0  # Total time (s) for the sub to finish
PATROL_ROUTE: str = "random"                  # "mumbai_kochi" | "vizag_chennai" | "kutch_mumbai" | "lakshadweep" | "random"
SIMULATE_HOTSPOTS: bool = True               # Cluster frames into tactical anomaly hotspots
HOTSPOT_COUNT: int = 3                       # Number of anomaly clusters
```

---

## 🖥️ Web Dashboard Features

- **Dynamic Indian Naval Corridors**: Real-time GPS path interpolation across 4 authentic strategic maritime routes.
- **Dynamic Hotspot Clustering**: Denser sonar pings and detections in high-risk zones, quiet clear-water transits in between.
- **Marker Clustering & Heatmap Layering**: Submarine anomaly markers cluster seamlessly at lower zoom levels, while the continuous radiant density heatmap reveals contact concentration zones.
- **In-App CLI Commands Panel**: Click the `[>_ CLI Commands]` button on the top navigation bar to view, copy, and explore all terminal commands directly inside the app.
- **Live CLI Telemetry Sync**: Real-time Server-Sent Events (SSE) pipe simulation data from any external CLI run directly into the open browser tab.
- **Streamlined Mission Execution**: Intuitive `Start Mission` control with live GPS route status updates.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, React-Leaflet, Leaflet Heat, Lucide Icons |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic v2, SSE Starlette |
| **Vision & ML** | Ultralytics YOLOv8, OpenCV (`cv2`), NumPy, Pillow |
| **Dataset & Taxonomy** | UATD (Underwater Acoustic Target Detection Dataset) |

---

## 📄 License

This project is licensed under the terms of the [LICENSE](LICENSE) file included in this repository.


