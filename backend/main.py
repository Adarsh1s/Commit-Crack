from __future__ import annotations
import os, sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).parent / '.env', verbose=False)

from models import AnalysisResult, HealthResponse, SystemHardwareResponse
from inference import run_inference
from system_info import get_system_hardware_cached

app = FastAPI(title='Aqua Sentinel API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

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

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
