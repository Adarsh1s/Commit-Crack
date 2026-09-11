"""
backend/models.py
Pydantic models mirroring the frontend TypeScript types in src/types/sonar.ts
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel


HazardRisk = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
TargetClass = Literal["crab_pot", "ghost_gear", "mine_cylinder", "debris_anomaly"]
ShadowEvidence = Literal["SUPPORTING", "NEUTRAL", "ABSENT"]


class GeoCoordinate(BaseModel):
    lat: float
    lon: float


class LocalOffset(BaseModel):
    x_m: float
    y_m: float


class DetectionDimensions(BaseModel):
    length_m: float
    width_m: float
    area_m2: float
    relief_height_m: float


class Detection(BaseModel):
    id: str
    target_class: TargetClass
    confidence: float
    shadow_evidence: ShadowEvidence
    dimensions: DetectionDimensions
    geolocation: Optional[GeoCoordinate]
    local_offset: Optional[LocalOffset]
    hazard_risk: HazardRisk
    # [x1, y1, x2, y2] in pixels (original image space)
    bounding_box: tuple[float, float, float, float]
    # Polygon contour points for mask overlay
    mask_contour: list[tuple[float, float]]
    # base64-encoded thumbnail crop of the detection region
    thumbnail_base64: str


class KpiSummary(BaseModel):
    total_surveys: int
    total_detections: int
    verified_3d_objects: int
    critical_hazards: int


class ProcessingMeta(BaseModel):
    slant_range_corrected: bool
    clahe_applied: bool
    nadir_excised: bool
    confidence_threshold: float
    processing_time_ms: float


class AnalysisResult(BaseModel):
    raw_image_url: str
    enhanced_image_url: str
    detections: list[Detection]
    kpis: KpiSummary
    processing_meta: ProcessingMeta


class GpuInfo(BaseModel):
    name: str
    vram_gb: Optional[float] = None


class SystemHardwareResponse(BaseModel):
    cpu_name: str
    physical_cores: int
    logical_cores: int
    ram_total_gb: float
    ram_available_gb: float
    gpus: list[GpuInfo] = []
    primary_gpu: Optional[str] = None
    vram_gb: Optional[float] = None


class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str
    model: str
    model_path: str
    version: str = "1.0.0"
    hardware: Optional[SystemHardwareResponse] = None


