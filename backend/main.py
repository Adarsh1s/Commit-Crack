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
from pipeline.simulation import (
    get_mumbai_kochi_route,
    interpolate_route,
    get_available_routes,
    select_route,
    generate_patrol_simulation,
    PATROL_ROUTES,
)
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
async def get_simulation_route(route: Optional[str] = None):
    """Returns naval patrol route waypoints and available corridor catalog."""
    selected = select_route(route)
    return {
        "route_id": selected["id"],
        "route_name": selected["name"],
        "region": selected["region"],
        "origin": selected["start"],
        "destination": selected["end"],
        "description": selected["description"],
        "waypoints": [{"lat": lat, "lon": lon} for lat, lon, _ in selected["waypoints"]],
        "available_routes": get_available_routes(),
    }


# Live mission event subscribers for real-time web UI sync from terminal commands
ACTIVE_MISSION_SUBSCRIBERS: List[asyncio.Queue] = []


@app.post('/api/v1/mission/broadcast', tags=['Simulation'])
async def broadcast_mission_event(event: Dict[str, Any]):
    """Receives live mission telemetry and detection events from CLI and forwards to web clients."""
    for q in list(ACTIVE_MISSION_SUBSCRIBERS):
        try:
            q.put_nowait(event)
        except Exception:
            pass
    return {"status": "broadcasted", "subscribers": len(ACTIVE_MISSION_SUBSCRIBERS)}


@app.get('/api/v1/mission/live', tags=['Simulation'])
async def live_mission_stream():
    """Server-Sent Events endpoint streaming live submarine telemetry and mission progress to frontend."""
    queue: asyncio.Queue = asyncio.Queue()
    ACTIVE_MISSION_SUBSCRIBERS.append(queue)

    async def event_generator():
        # Immediate ping to establish connection in browser
        yield ": connected\n\n"
        try:
            while True:
                data = await queue.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if queue in ACTIVE_MISSION_SUBSCRIBERS:
                ACTIVE_MISSION_SUBSCRIBERS.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )




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


@app.get('/api/v1/batch/demo-info', tags=['Batch'])
async def get_demo_batch_info():
    """Returns information about available local demo survey datasets."""
    root = Path(__file__).parent.parent
    test_data_dir = root / "Test_Data"
    samples_dir = root / "ml" / "samples"

    target_dir = test_data_dir if test_data_dir.exists() else samples_dir
    files = sorted([f.name for f in target_dir.iterdir() if f.is_file() and f.suffix.lower() in {".jpg", ".png", ".jpeg"}]) if target_dir.exists() else []

    return {
        "dataset_name": target_dir.name,
        "total_images": len(files),
        "files_preview": files[:5],
        "default_duration": getattr(test_run, 'TOTAL_MISSION_DURATION_SECONDS', 30.0),
        "default_route": getattr(test_run, 'PATROL_ROUTE', 'random'),
        "hotspots_enabled": getattr(test_run, 'SIMULATE_HOTSPOTS', True),
        "hotspot_count": getattr(test_run, 'HOTSPOT_COUNT', 3),
    }


@app.post('/api/v1/batch/start', tags=['Batch'])
async def start_batch(
    files: Optional[List[UploadFile]] = File(None),
    use_demo_folder: bool = Form(False),
    duration_seconds: Optional[float] = Form(None),
    interval_seconds: Optional[float] = Form(None),
    route_name: Optional[str] = Form(None),
    simulate_hotspots: Optional[bool] = Form(None),
    hotspot_count: Optional[int] = Form(None),
    slant_range_correction: bool = Form(True),
    clahe_equalization: bool = Form(True),
    nadir_excision: bool = Form(False),
    confidence_threshold: float = Form(0.20),
):
    """
    Authoritative batch processing endpoint.
    Receives folder images or triggers local Test_Data demo survey.
    Inherits simulation parameters from test_run.py settings automatically.
    """
    images_payload: List[Tuple[str, Any]] = []

    # Helper for natural sorting (e.g. image_1, image_2, ... image_10)
    import re
    def natural_sort_key(name: str):
        return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', name)]

    # 1. Check if loading local demo survey (fast, zero upload overhead)
    if use_demo_folder or not files:
        root = Path(__file__).parent.parent
        data_dir = root / "Test_Data" if (root / "Test_Data").exists() else (root / "ml" / "samples")
        if data_dir.exists():
            valid_paths = [p for p in data_dir.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".png", ".jpeg", ".bmp"}]
            for p in sorted(valid_paths, key=lambda p: natural_sort_key(p.name)):
                images_payload.append((p.name, p))

    # 2. Or parse uploaded client files
    if not images_payload and files:
        sorted_files = sorted(files, key=lambda f: natural_sort_key(f.filename or ""))
        for f in sorted_files:
            b = await f.read()
            if b:
                images_payload.append((f.filename, b))

    if not images_payload:
        raise HTTPException(400, "No valid sonar images provided. Upload files or select demo folder.")

    # Inherit authoritative parameters from test_run.py top-level variables
    eff_duration = duration_seconds if duration_seconds is not None else getattr(test_run, 'TOTAL_MISSION_DURATION_SECONDS', 30.0)
    eff_route = route_name if (route_name and route_name != "random") else getattr(test_run, 'PATROL_ROUTE', 'random')
    eff_hotspots = simulate_hotspots if simulate_hotspots is not None else getattr(test_run, 'SIMULATE_HOTSPOTS', True)
    eff_hs_count = hotspot_count if hotspot_count is not None else getattr(test_run, 'HOTSPOT_COUNT', 3)

    batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"

    with _BATCH_LOCK:
        BATCH_CANCELLATION_FLAGS[batch_id] = False
        BATCH_METADATA[batch_id] = {
            "batch_id": batch_id,
            "total_images": len(images_payload),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    def event_stream():
        generator = test_run.execute_batch_generator(
            images_list=images_payload,
            batch_id=batch_id,
            output_root=str(Path(__file__).parent.parent / "outputs"),
            duration_seconds=eff_duration,
            interval_seconds=interval_seconds,
            sim_route=True,
            route_name=eff_route,
            simulate_hotspots=eff_hotspots,
            hotspot_count=eff_hs_count,
            cancellation_check=is_batch_cancelled,
            confidence_threshold=confidence_threshold,
            slant_range=slant_range_correction,
            clahe=clahe_equalization,
            nadir_excision=nadir_excision,
        )
        for event in generator:
            # Broadcast to live mission SSE subscribers (real-time sync across all windows)
            for q in list(ACTIVE_MISSION_SUBSCRIBERS):
                try:
                    q.put_nowait(event)
                except Exception:
                    pass
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
