"""
backend/pipeline/geolocation.py
AquaSentinel AI - Geospatial Projection & Metric Dimension Calculator
"""
import math
from typing import Dict, Any, Optional, Tuple


def compute_target_dimensions(
    detection: Dict[str, Any],
    meters_per_pixel: float = 0.05
) -> Dict[str, float]:
    """
    Computes real-world physical dimensions (meters) and estimated area (sq meters).
    """
    w_px = max(1, detection["x_max"] - detection["x_min"])
    h_px = max(1, detection["y_max"] - detection["y_min"])

    width_m = round(w_px * meters_per_pixel, 2)
    length_m = round(h_px * meters_per_pixel, 2)
    area_m2 = round(width_m * length_m, 2)

    return {
        "length_m": max(0.4, length_m),
        "width_m": max(0.4, width_m),
        "area_m2": max(0.16, area_m2)
    }


def project_detection_geolocation(
    detection: Dict[str, Any],
    img_width: int,
    img_height: int,
    vessel_lat: Optional[float] = None,
    vessel_lon: Optional[float] = None,
    swath_width_m: float = 100.0,
    heading_deg: float = 0.0
) -> Tuple[Optional[Dict[str, float]], Optional[Dict[str, float]]]:
    """
    Projects pixel position to local metric coordinates (x_m, y_m) and WGS84 GPS (lat, lon).
    """
    cx_px = (detection["x_min"] + detection["x_max"]) / 2.0
    cy_px = (detection["y_min"] + detection["y_max"]) / 2.0

    # Local metric coordinates relative to vessel track (origin at center)
    x_m = (cx_px / max(1, img_width) - 0.5) * swath_width_m
    y_m = (0.5 - cy_px / max(1, img_height)) * swath_width_m

    local_offset = {
        "x_m": round(x_m, 2),
        "y_m": round(y_m, 2)
    }

    if vessel_lat is None or vessel_lon is None:
        return None, local_offset

    # Rotate by vessel heading if provided
    rad = math.radians(heading_deg)
    rot_east = x_m * math.cos(rad) + y_m * math.sin(rad)
    rot_north = -x_m * math.sin(rad) + y_m * math.cos(rad)

    # WGS84 approximation
    R = 6_378_137.0
    d_lat = rot_north / R
    d_lon = rot_east / (R * math.cos(math.radians(vessel_lat)))

    geo = {
        "lat": round(vessel_lat + math.degrees(d_lat), 7),
        "lon": round(vessel_lon + math.degrees(d_lon), 7)
    }
    return geo, local_offset


def compute_risk_score(class_name: str, shadow_evidence: str, conf: float) -> str:
    """
    Hazard risk classification: LOW, MEDIUM, HIGH, CRITICAL.
    """
    cls_lower = class_name.lower()

    if any(k in cls_lower for k in ["mine", "cylinder", "torpedo", "ordnance", "aircraft"]):
        return "CRITICAL"
    if any(k in cls_lower for k in ["pipeline", "wreck", "shipwreck", "submarine", "submersible", "rov"]):
        return "HIGH"
    if any(k in cls_lower for k in ["ghost", "net", "cage", "trap", "drum", "bucket"]):
        return "MEDIUM"
    if any(k in cls_lower for k in ["pot", "crab", "ball", "float", "tyre"]):
        return "LOW"

    if conf >= 0.85 and shadow_evidence == "SUPPORTING":
        return "HIGH"
    return "MEDIUM"
