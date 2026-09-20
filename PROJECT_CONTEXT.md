# 🌊 Aqua Sentinel — Project Context & Complete Technical Specification

> **Note**: Comprehensive reference document containing every detail about the Aqua Sentinel codebase, directory architecture, AI pipeline, frontend/backend specifications, data models, ML taxonomy, and execution commands.

---

## 📌 1. Project Overview & Identity

- **Project Name**: Aqua Sentinel — Underwater Sonar Object Detection & Maritime Intelligence Platform
- **Repository Name**: `Commit-Crack` / `SIH_2026_Final`
- **Domain**: Maritime hydrography, underwater acoustic target detection (UATD), subsea hazard identification, and geospatial mapping.
- **Core Functionality**:
  - Ingests multibeam forward-looking and side-scan sonar imagery (JPG, PNG, BMP, TIFF, WebP).
  - Processes sonar scans through Digital Signal Processing (DSP) steps: Empirical Gain Normalization (EGN), Contrast Limited Adaptive Histogram Equalization (CLAHE), Nadir Excision, and Slant-Range Correction.
  - Detects, classifies, and localizes underwater targets using **YOLOv8** augmented with deterministic Acoustic Highlight & Shadow Detection (AHSD) physics verification.
  - Optional human-in-the-loop Expert Verification for high-risk targets (`0.35 < confidence < 0.75`).
  - Projects 3D metric dimensions (length, width, area, relief height) and WGS84 GPS geolocation from vessel navigation telemetry.
  - Provides a high-performance React 19 / Vite dashboard with interactive image visualizer (toggling annotated vs. raw image), Leaflet geospatial map, target inspection drawer, and CSV/JSON export tools.

---

## 📁 2. Repository Directory Structure

```
SIH_2026_Final/
├── FRONTEND_GUIDE.md        # Comprehensive frontend design & component documentation
├── LICENSE                  # MIT License file
├── ProjectStart.md          # Quick reference launcher instructions
├── README.md                # Main repository documentation & quickstart
├── start.bat                # 1-Click Windows batch script to launch Backend & Frontend
├── test_run.py              # Advanced batch test & side-by-side validation script
├── training.ipynb           # Jupyter notebook for YOLO model training & evaluation
│
├── MODELS/                  # Neural network weight storage
│   └── yolov8n.pt           # Fine-tuned YOLOv8s (Small) weights (11.14M parameters, 22.5 MB)
│
├── ml/                      # ML taxonomy metadata & configuration
│   ├── class_map.json       # 5 Canonical hydrographic target taxonomy mapping & dimensions
│   ├── model_info.json      # Model performance metrics (mAP 0.83), architecture, & paths
│   ├── README.md            # Machine learning documentation
│   ├── samples/             # Sample multibeam sonar test images
│   └── weights/             # Custom fine-tuned weight directory
│
├── backend/                 # FastAPI Python Inference & Analytics Server
│   ├── .env.example         # Environment variables configuration template
│   ├── main.py              # REST API routing, CORS configuration, & endpoints
│   ├── models.py            # Pydantic schemas mirroring TypeScript frontend interfaces
│   ├── inference.py         # Main orchestration pipeline & overlay generator
│   ├── input_normalizer.py  # Image format decoding, color space conversion, & orientation fix
│   ├── system_info.py       # Host hardware inspection (CPU cores, RAM, GPU/VRAM, compute tiers)
│   ├── requirements.txt     # Python dependencies (fastapi, uvicorn, ultralytics, opencv, etc.)
│   ├── README.md            # Backend developer documentation
│   ├── tests/               # Backend unit test suite
│   │   └── test_expert_verification.py
│   └── pipeline/            # Modular DSP & Physics Pipeline
│       ├── __init__.py      # Package initialization
│       ├── preprocess.py    # EGN swath normalization, CLAHE enhancement, Nadir excision
│       ├── slant_range.py   # Ground-range projection & geometric unwarping
│       ├── quality.py       # Sonar signal-to-noise ratio (SNR), contrast, & blur assessment
│       ├── tiling.py        # Swath window tiling (640x640, 20% overlap) & Cross-Tile NMS
│       ├── inference.py     # AdaptiveInferenceEngine & heuristic fallback scanner
│       ├── shadow_gate.py   # Acoustic shadow physics verification & relief height estimation
│       ├── geolocation.py   # Metric dimensioning, WGS84 coordinate math, & risk matrix
│       └── simulation.py    # Arabian sea simulation route generator
│
├── frontend/                # React 19 + Vite + TypeScript Dashboard UI
│   ├── index.html           # Single Page Application entry HTML
│   ├── package.json         # React, Vite, TailwindCSS, Leaflet, Lucide dependencies
│   ├── postcss.config.js    # PostCSS configuration
│   ├── tailwind.config.js   # Tailwind design tokens, custom colors, animations
│   ├── tsconfig.json        # Base TypeScript config
│   ├── tsconfig.app.json    # App TypeScript compiler config
│   ├── tsconfig.node.json   # Node build TypeScript config
│   ├── vite.config.ts       # Vite build & server configuration
│   ├── public/              # Static assets & sample sonar images
│   ├── scripts/             # Integration and verification test scripts
│   │   └── test_expert_verification.mjs
│   └── src/                 # Application Source Code
│       ├── main.tsx         # React root DOM renderer
│       ├── App.tsx          # Main application container component
│       ├── index.css        # Global CSS styles & Tailwind directives
│       ├── App.css          # App-specific UI tweaks
│       ├── types/
│       │   └── sonar.ts     # TypeScript interfaces & domain types
│       ├── store/
│       │   ├── AppContext.tsx # React Context provider for state distribution
│       │   └── appReducer.ts # App state reducer logic
│       ├── hooks/           # Custom React hooks (e.g. useAnalysis, useSystemInfo)
│       ├── utils/           # Helper functions & formatting utilities
│       │   └── expertVerification.ts
│       └── components/      # UI Component Architecture
│           ├── common/      # Reusable UI badges, buttons, modal wrappers
│           ├── controls/    # DSP sliders, toggles, confidence inputs, RunButton
│           ├── dashboard/   # Header, main layout, metric cards, target table
│           ├── export/      # Export modal (CSV, JSON, GeoJSON download)
│           ├── inspector/   # Target inspection drawer with acoustic thumbnail & verification
│           ├── layout/      # Navbar, footer, status bar, AppShell
│           ├── loading/     # Processing skeleton loaders & progress indicators
│           ├── map/         # Leaflet interactive map with target markers & telemetry
│           └── upload/      # File upload dropzone & pre-loaded sample image selector
│
└── Test_Data/               # Authentic test sonar dataset (84 imagery files)
```

---

## 🛠️ 3. Technology Stack & Dependencies

| Layer | Framework / Library | Version / Details |
|---|---|---|
| **Frontend Core** | React | 19.2.8 |
| **Build System** | Vite | 8.3.0 |
| **Language** | TypeScript | 6.0.2 |
| **Styling** | TailwindCSS | 4.3.3 |
| **Icons** | Lucide React | 1.44.0 |
| **Mapping** | Leaflet & React-Leaflet | Leaflet 1.9.4, React-Leaflet 5.0.0 |
| **Typography** | Fontsource | `@fontsource/inter`, `@fontsource/jetbrains-mono` |
| **Linting** | Oxlint | 1.81.0 |
| **Backend Core** | FastAPI | Python 3.10+ |
| **Server WSGI/ASGI** | Uvicorn | 0.20+ |
| **Data Validation** | Pydantic | v2.0+ (`models.py`) |
| **Computer Vision** | OpenCV (`cv2`) & Pillow | Image processing, CLAHE, overlay rendering |
| **AI / Deep Learning** | Ultralytics YOLOv8 | PyTorch backend (`yolov8n.pt`) |
| **Numerical Engine** | NumPy | Matrix mathematics, signal analysis |

---

## ⚙️ 4. System Architecture & Processing Pipeline

```
[ User Input: Single Image / Folder of Sonar Images + Optional CSV Telemetry ]
                                     │
                                     ▼
                          [ Frontend React UI ]
                                     │
                            (POST /analyze payload)
                                     ▼
                        [ FastAPI Backend (main.py) ]
                                     │
                                     ▼
         [ 1. input_normalizer.py ] ──> Multi-format decoding & orientation fix
                                     │
                                     ▼
          [ 2. preprocess.py ] ─────> EGN Gain Normalization + CLAHE + Nadir Excision
                                     │
                                     ▼
          [ 3. slant_range.py ] ────> Slant-Range Ground Mapping Projection
                                     │
                                     ▼
          [ 4. tiling.py ] ─────────> 640x640 Swath Window Tiling
                                     │
                                     ▼
        [ 5. pipeline/inference.py ] ─> Adaptive YOLOv8 + Heuristic Fallback Scan
                                     │
                                     ▼
            [ Cross-Tile NMS ] ─────> Merges duplicate bounding boxes (IoU > 0.40)
                                     │
                                     ▼
         [ 6. shadow_gate.py ] ─────> Physics Highlight-Shadow Gating & Relief Height
                                     │
                                     ▼
         [ 7. geolocation.py ] ─────> Real 3D Metric Size, GPS Math, Hazard Scoring
                                     │
                                     ▼
        [ 8. inference.py Overlay ] ─> Renders annotated bounding boxes & badges
                                     │
                                     ▼
    [ Response: JSON AnalysisResult ] ──> Frontend Visualizer, Map, & Inspector
```

---

## 🎯 5. Machine Learning Taxonomy (5 Canonical Classes)

The model detects objects across 5 standardized hydrographic categories defined in `ml/class_map.json`:

| Index | Class Label | Display Name | Hazard Risk | Typical Size (L x W x H) | Shadow Signature |
|---|---|---|---|---|---|
| **0** | `crab_pot` | Crab Pot | `LOW` | 0.8m x 0.8m x 0.6m | Supporting |
| **1** | `submarine_pipeline` | Submarine Pipeline | `HIGH` | 15.0m x 0.8m x 0.8m | Supporting |
| **2** | `shipwreck` | Shipwreck | `HIGH` | 12.0m x 4.5m x 2.5m | Supporting |
| **3** | `ghost_net` | Ghost Net | `MEDIUM` | 3.0m x 2.0m x 0.5m | Neutral |
| **4** | `mine_cylinder` | Mine / Cylinder | `CRITICAL` | 1.8m x 0.6m x 0.6m | Supporting |

---

## 📋 6. Data Models Specifications

### Target Hazard Risk Levels
- `CRITICAL`: Bright Red badge (`#EF2222`)
- `HIGH`: Deep Amber / Orange badge (`#FF8C00`)
- `MEDIUM`: Bright Yellow badge (`#FFD700`)
- `LOW`: Emerald Green badge (`#32CD32`)

### Main TypeScript / Pydantic Models Structure
```typescript
interface Detection {
  id: string;                          // e.g. "tgt-a1b2c3-01"
  target_class: TargetClass;           // 'crab_pot' | 'submarine_pipeline' | ...
  confidence: number;                  // 0.0 to 1.0 (e.g. 0.875)
  shadow_evidence: ShadowEvidence;     // 'SUPPORTING' | 'NEUTRAL' | 'ABSENT'
  expert_status?: ExpertStatus;        // 'UNVERIFIED' | 'CONFIRMED' | 'SKIPPED'
  expert_verified?: boolean;           // true if confirmed by human expert
  dimensions: {
    length_m: number;                  // Estimated real length in meters
    width_m: number;                   // Estimated real width in meters
    area_m2: number;                   // Real area footprint in m^2
    relief_height_m: number;           // Calculated shadow height above seafloor
  };
  geolocation: { lat: number; lon: number; heading?: number } | null;
  local_offset: { x_m: number; y_m: number } | null;
  hazard_risk: HazardRisk;             // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  bounding_box: [number, number, number, number]; // [x1, y1, x2, y2] pixel space
  mask_contour: Array<[number, number]>;          // Polygon points
  thumbnail_base64: string;                       // Data URL 128x128 crop JPEG
}
```

---

## 🗺️ 7. Dynamic Map Heatmap & Spatial Clustering Engine

AquaSentinel features a high-performance, zoom-aware geographic clustering engine designed for large sonar surveys, folder batches, and multi-file acoustic missions.

### Key Architectural Principles
1. **Dynamic View Projections**: Clusters are never stored as permanent detection records. They are computed on-the-fly directly from active detections (`state.result.detections` + `state.batchResults[].detections`), which remain the single source of truth.
2. **Hierarchical Zoom Behavior**:
   - **Wide Zoom (Zoom 3–6)**: Aggregates regional contacts into high-level concentration clusters.
   - **Medium Zoom (Zoom 7–14)**: Dynamically splits into smaller sub-clusters as the user navigates.
   - **Deep Zoom (Zoom 15+)**: Dissolves clusters into individual anomaly markers showing target rotation, hazard color, and expert verification badges.
3. **Spatial Concentration vs. Hazard Risk Distinction**:
   - **Cluster Color Coding strictly indicates Geographic Concentration**:
     - 🔴 **RED**: High Concentration ($\ge 15$ detections)
     - 🟠 **ORANGE**: Medium Concentration ($8 - 14$ detections)
     - 🟡 **YELLOW**: Low / Moderate Concentration ($4 - 7$ detections)
     - 🟢 **GREEN**: Sparse Concentration ($2 - 3$ detections)
   - **Hazard Risk** (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) is indicated on individual markers, cluster badges, inspector headers, and the dual HUD legend.
4. **Interactive Inspection & Zooming**:
   - Clicking a cluster marker automatically fits the map viewport to the cluster's geographic bounding box (`map.fitBounds`) and opens the `ClusterDrawer` in the right sidebar.
   - The `ClusterDrawer` displays total contact count, geographic spread in km, highest hazard risk, risk breakdown bars, verified target counts, class tags, and a scrollable target list with direct drilldown.
5. **Interactive Filter Toolbar**:
   - Allows tactical filtering by Hazard Risk (`ALL`, `HIGH RISK ONLY`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and Target Class.
   - Clusters recalculate in real-time ($<2$ms) upon filter adjustments.
6. **Multi-File & Folder Survey Integration**:
   - Aggregates all detections across single-image and batch/folder surveys. Frames with 0 detections produce no phantom markers or clusters.
   - Invalid or missing coordinates (e.g. `[0, 0]` null-island or `NaN`) are safely excluded.
7. **Expert Verification Sync**:
   - Rejecting a target ("Nothing There") immediately removes it from active clusters, recalculating cluster bounds or dissolving into single markers.
   - Confirming a target increments the verified counter on the cluster badge and sidebar summary.

---

## 🚀 8. How to Run the Application

### Option A: 1-Click Launch (Windows)
Double-click **`start.bat`** in the project root directory.
- Terminal 1 starts FastAPI backend on `http://localhost:8000`
- Terminal 2 starts Vite frontend on `http://localhost:5173`

### Option B: Manual Terminal Launch
- Backend: `cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- Frontend: `cd frontend && npm run dev`
