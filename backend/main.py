from __future__ import annotations
import asyncio
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import sys
import threading
from typing import Optional, List, Dict, Any
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse

load_dotenv(Path(__file__).parent / '.env', verbose=False)

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))
# Add project root directory to sys.path so test_run imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import AnalysisResult, HealthResponse, SystemHardwareResponse
from inference import run_inference
from system_info import get_system_hardware_cached
from pipeline.simulation import get_mumbai_kochi_route, interpolate_route
import test_run

app = FastAPI(title='Aqua Sentinel API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
    expose_headers=['*'],
)

# In-memory thread-safe registry of active batches
BATCH_CANCELLATION_FLAGS: Dict[str, bool] = {}
BATCH_METADATA: Dict[str, Dict[str, Any]] = {}
_BATCH_LOCK = threading.Lock()


def is_batch_cancelled(batch_id: str) -> bool:
    with _BATCH_LOCK:
        return BATCH_CANCELLATION_FLAGS.get(batch_id, False)


@app.get('/system-info', response_model=SystemHardwareResponse, tags=['System'])
@app.get('/api/v1/system/status', tags=['System'])
async def system_info():
    return SystemHardwareResponse(**get_system_hardware_cached())


@app.get('/health', response_model=HealthResponse, tags=['System'])
@app.get('/api/v1/health', response_model=HealthResponse, tags=['System'])
async def health():
    hp = get_system_hardware_cached()
    return HealthResponse(
        status='ok',
        model='yolov8n',
        model_path=os.getenv('MODEL_PATH', 'MODELS/yolov8n.pt'),
        version='1.0.0',
        hardware=SystemHardwareResponse(**hp),
    )


@app.get('/api/v1/simulation/route', tags=['Simulation'])
async def get_simulation_route():
    """Returns the authoritative Arabian Sea Mumbai -> Kochi base route waypoints."""
    return {
        "route_name": "Arabian Sea Western Shelf Deep Water Corridor",
        "origin": "Mumbai Deep Offshore Anchorage",
        "destination": "Kochi Roadstead / Naval Channel",
        "waypoints": get_mumbai_kochi_route(),
    }


@app.post('/analyze', response_model=AnalysisResult, tags=['Inference'])
@app.post('/api/v1/surveys/process', response_model=AnalysisResult, tags=['Inference'])
@app.post('/api/v1/analyze', response_model=AnalysisResult, tags=['Inference'])
async def analyze(
    file: UploadFile = File(...),
    nav_csv: Optional[UploadFile] = File(None),
    slant_range_correction: bool = Form(True),
    clahe_equalization: bool = Form(True),
    nadir_excision: bool = Form(False),
    confidence_threshold: float = Form(0.25),
    vessel_lat: Optional[str] = Form(None),
    vessel_lon: Optional[str] = Form(None),
):
    img_bytes = await file.read()
    if not img_bytes:
        raise HTTPException(400, 'Empty file received.')
    lat, lon = None, None
    if vessel_lat and str(vessel_lat).strip() not in {'', 'undefined', 'null', 'NaN'}:
        try:
            lat = float(str(vessel_lat).strip())
        except Exception:
            lat = None
    if vessel_lon and str(vessel_lon).strip() not in {'', 'undefined', 'null', 'NaN'}:
        try:
            lon = float(str(vessel_lon).strip())
        except Exception:
            lon = None
    if nav_csv is not None and (lat is None or lon is None):
        try:
            csv_bytes = await nav_csv.read()
            csv_text = csv_bytes.decode('utf-8', errors='ignore')
            for line in csv_text.splitlines():
                line = line.strip()
                if not line or line.lower().startswith(('time', 'lat', '#')):
                    continue
                parts = line.split(',')
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
            pass
    if lat is None or lon is None:
        # Default to Arabian Sea operational transit corridor if external navigation telemetry is omitted
        lat = 15.2993
        lon = 73.7240
    try:
        res = run_inference(
            img_bytes,
            slant_range_correction=slant_range_correction,
            clahe_equalization=clahe_equalization,
            nadir_excision=nadir_excision,
            confidence_threshold=confidence_threshold,
            vessel_lat=lat,
            vessel_lon=lon,
        )
        return JSONResponse(content=res)
    except Exception as e:
        raise HTTPException(500, f'Inference error: {e}')


@app.post('/api/v1/batch/start', tags=['Batch'])
async def start_batch(
    files: List[UploadFile] = File(...),
    interval_seconds: Optional[float] = Form(None),
    slant_range_correction: bool = Form(True),
    clahe_equalization: bool = Form(True),
    nadir_excision: bool = Form(False),
    confidence_threshold: float = Form(0.20),
):
    """
    Authoritative batch processing endpoint.
    Receives folder images, initializes batch session in test_run.py,
    and returns an SSE stream yielding immediate live inference & GPS events.
    """
    if not files:
        raise HTTPException(400, "No files provided for batch processing.")

    # Read all files into memory payload
    images_payload = []
    for f in files:
        b = await f.read()
        if b:
            images_payload.append((f.filename, b))

    if not images_payload:
        raise HTTPException(400, "No valid image data found in uploaded files.")

    batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"

    with _BATCH_LOCK:
        BATCH_CANCELLATION_FLAGS[batch_id] = False
        BATCH_METADATA[batch_id] = {
            "batch_id": batch_id,
            "total_images": len(images_payload),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    # Determine interval from form or test_run.py default
    interval = interval_seconds if interval_seconds is not None else test_run.TEST_INTERVAL_SECONDS

    def event_stream():
        generator = test_run.execute_batch_generator(
            images_list=images_payload,
            batch_id=batch_id,
            output_root=str(Path(__file__).parent.parent / "outputs"),
            interval_seconds=interval,
            sim_route=True,
            cancellation_check=is_batch_cancelled,
            confidence_threshold=confidence_threshold,
            slant_range=slant_range_correction,
            clahe=clahe_equalization,
            nadir_excision=nadir_excision,
        )
        for event in generator:
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Batch-ID": batch_id,
        },
    )


@app.post('/api/v1/batch/{batch_id}/cancel', tags=['Batch'])
@app.post('/api/v1/batch/cancel', tags=['Batch'])
async def cancel_batch(batch_id: Optional[str] = None):
    """Signals cancellation specifically for batch_id and all active batches."""
    with _BATCH_LOCK:
        if batch_id:
            BATCH_CANCELLATION_FLAGS[batch_id] = True
        for bid in list(BATCH_CANCELLATION_FLAGS.keys()):
            BATCH_CANCELLATION_FLAGS[bid] = True
    return {"status": "cancelled", "batch_id": batch_id}


@app.get('/api/v1/batch/{batch_id}/download/{file_type}', tags=['Batch'])
async def download_batch_artifact(batch_id: str, file_type: str):
    """
    Downloads dedicated batch artifacts:
    - 'csv': outputs/{batch_id}/csv/batch_results.csv
    - 'json': outputs/{batch_id}/json/batch_results.json
    - 'zip': outputs/{batch_id}.zip
    """
    outputs_root = Path(__file__).parent.parent / "outputs"
    batch_dir = outputs_root / batch_id

    if file_type == 'csv':
        file_path = batch_dir / "csv" / "batch_results.csv"
        if not file_path.exists():
            raise HTTPException(404, f"CSV for batch {batch_id} not found.")
        return FileResponse(str(file_path), media_type="text/csv", filename=f"{batch_id}_results.csv")

    elif file_type == 'json':
        file_path = batch_dir / "json" / "batch_results.json"
        if not file_path.exists():
            raise HTTPException(404, f"JSON for batch {batch_id} not found.")
        return FileResponse(str(file_path), media_type="application/json", filename=f"{batch_id}_results.json")

    elif file_type == 'zip':
        file_path = outputs_root / f"{batch_id}.zip"
        if not file_path.exists():
            raise HTTPException(404, f"ZIP archive for batch {batch_id} not found.")
        return FileResponse(str(file_path), media_type="application/zip", filename=f"{batch_id}.zip")

    else:
        raise HTTPException(400, f"Unsupported download type '{file_type}'. Use 'csv', 'json', or 'zip'.")


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
