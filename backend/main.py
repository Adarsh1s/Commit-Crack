"""
backend/main.py
Aqua Sentinel FastAPI Backend — Underwater Object Detection API

Endpoints:
  GET  /health         → system health + model info
  POST /analyze        → sonar image inference → AnalysisResult JSON

Run with:
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load .env if present (silently skip if absent)
load_dotenv(Path(__file__).parent / ".env", verbose=False)

from models import AnalysisResult, HealthResponse
from inference import run_inference

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Aqua Sentinel API",
    description=(
        "Maritime Underwater Object Detection backend. "
        "Accepts sonar images and returns YOLOv8n detections in AnalysisResult format."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Supported image MIME types ─────────────────────────────────────────────────
_ALLOWED_MIME = {
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/x-portable-bitmap",
    "application/octet-stream",  # for .pbm files that don't get typed correctly
}

_MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health() -> HealthResponse:
    """
    Returns service health and model metadata.
    The frontend polls this every 10 seconds to set `backendOnline`.
    """
    model_path = os.getenv("MODEL_PATH", "yolov8n")
    return HealthResponse(
        status="ok",
        model="yolov8n",
        model_path=model_path,
        version="1.0.0",
    )


# ── Analyze endpoint ──────────────────────────────────────────────────────────
@app.post("/analyze", response_model=AnalysisResult, tags=["Inference"])
async def analyze(
    file: UploadFile = File(description="Sonar image (PNG/JPG/WebP/TIFF/BMP)"),
    nav_csv: Optional[UploadFile] = File(None, description="Navigation CSV (optional)"),
    slant_range_correction: bool = Form(True),
    clahe_equalization: bool = Form(True),
    nadir_excision: bool = Form(False),
    confidence_threshold: float = Form(0.25, ge=0.01, le=1.0),
    vessel_lat: Optional[str] = Form(None),
    vessel_lon: Optional[str] = Form(None),
) -> JSONResponse:
    """
    Analyze a sonar image for underwater object detection.

    Returns an `AnalysisResult` JSON object with:
    - `raw_image_url` — base64 original image
    - `enhanced_image_url` — base64 annotated image with bounding boxes
    - `detections` — list of detected targets with bounding boxes, class, risk
    - `kpis` — summary statistics
    - `processing_meta` — timing and preprocessing flags
    """
    # ── Validate file type ────────────────────────────────────────────────────
    ext = Path(file.filename or "").suffix.lower()
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif", ".pbm", ".gif"}
    is_image_mime = bool(file.content_type and file.content_type.startswith("image/"))

    if not is_image_mime and ext not in allowed_exts and file.content_type != "application/octet-stream":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Please upload PNG, JPG, WebP, TIFF, or BMP.",
        )

    # ── Read image bytes ──────────────────────────────────────────────────────
    image_bytes = await file.read()
    if len(image_bytes) > _MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 50 MB limit.",
        )
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file received.",
        )

    # ── Safely parse vessel coordinates ───────────────────────────────────────
    lat: Optional[float] = None
    lon: Optional[float] = None
    if vessel_lat is not None and str(vessel_lat).strip() not in {"", "undefined", "null", "NaN"}:
        try:
            lat = float(str(vessel_lat).strip())
        except (ValueError, TypeError):
            lat = None

    if vessel_lon is not None and str(vessel_lon).strip() not in {"", "undefined", "null", "NaN"}:
        try:
            lon = float(str(vessel_lon).strip())
        except (ValueError, TypeError):
            lon = None

    # ── Parse NAV CSV for vessel coordinates if not provided ──────────────────
    if nav_csv is not None and (lat is None or lon is None):
        try:
            csv_bytes = await nav_csv.read()
            csv_text = csv_bytes.decode("utf-8", errors="ignore")
            for line in csv_text.splitlines():
                line = line.strip()
                if not line or line.lower().startswith(("time", "lat", "#")):
                    continue
                parts = line.split(",")
                nums = []
                for p in parts:
                    try:
                        nums.append(float(p.strip()))
                    except ValueError:
                        pass
                if len(nums) >= 2:
                    lat, lon = nums[0], nums[1]
                    break
        except Exception:
            pass  # NAV parsing failure is non-fatal

    # ── Run inference ─────────────────────────────────────────────────────────
    try:
        result = run_inference(
            image_bytes,
            slant_range_correction=slant_range_correction,
            clahe_equalization=clahe_equalization,
            nadir_excision=nadir_excision,
            confidence_threshold=confidence_threshold,
            vessel_lat=lat,
            vessel_lon=lon,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference pipeline error: {str(exc)}",
        )

    return JSONResponse(content=result)



# ── Dev entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "true").lower() == "true",
    )
