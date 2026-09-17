"""
Aqua Sentinel — Advanced Sonar Batch Test & Side-by-Side Validation Runner
==========================================================================
Processes sonar image surveys through the complete AquaSentinel AI pipeline:
- Authoritative Batch Processor & Scheduler with configurable test interval.
- Arabian Sea Submarine Route & GPS Telemetry Simulator (Mumbai -> Kochi).
- Evaluates the Graceful Degradation Ladder (FULL, PARTIAL, NONE).
- Executes DSP enhancements (Slant-Range, CLAHE, Gain Normalization, Nadir Excision).
- Runs AI tests and multi-scale detections on the PREPROCESSED sonar image.
- Physics-Informed Acoustic Shadow Gating (highlight-shadow geometry, relief height).
- Real-world 3D Metric Dimensions & WGS84 Geolocation Projection.
- Hazard Risk Assessment across all 5 Canonical Classes.
- Combines BOTH images in ONE side-by-side composite:
    [ 1. ORIGINAL RAW SONAR ] | [ 2. PREPROCESSED + AI DETECTIONS ]
- Exports batch-dedicated artifacts:
    outputs/batch_YYYYMMDD_HHMMSS/
      ├── processed/
      ├── csv/batch_results.csv
      ├── json/batch_results.json
      └── run_summary.json
      └── outputs/batch_YYYYMMDD_HHMMSS.zip

Usage:
    python test_run.py
    python test_run.py --input Test_Data --output outputs --conf 0.25 --pad 12 --sim-route
    python test_run.py --single Test_Data/0001_2010.jpg
    python test_run.py --save-both --altitude 8.5 --swath 120.0
"""

import argparse
import csv
from datetime import datetime, timezone
import io
import json
import math
import os
from pathlib import Path
import shutil
import sys
import time
from typing import Dict, Any, List, Optional, Tuple, Callable, Generator
import uuid
import zipfile

# Reconfigure stdout/stderr for Windows console unicode support
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Add backend directory to sys.path so pipeline imports resolve
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

import cv2
import numpy as np

from input_normalizer import normalize_input_sources
from pipeline.preprocess import preprocess_sonar_image
from pipeline.slant_range import apply_slant_range_correction
from pipeline.tiling import generate_tiles, map_detections_to_global, apply_cross_tile_nms
from pipeline.inference import AdaptiveInferenceEngine, FRONTEND_CLASS_MAP
from pipeline.shadow_gate import verify_acoustic_shadow
from pipeline.geolocation import (
    compute_target_dimensions,
    project_detection_geolocation,
    compute_risk_score,
)
from pipeline.simulation import (
    interpolate_route,
    get_mumbai_kochi_route,
    ARABIAN_SEA_MUMBAI_KOCHI_WAYPOINTS,
)
from inference import _draw_annotations, get_inference_engine, _crop_thumbnail, _img_to_data_url

# ==============================================================================
# CONFIGURABLE BATCH TEST SETTINGS (EDITABLE DIRECTLY FROM PYTHON FILE)
# ==============================================================================
TEST_INTERVAL_SECONDS: float = 2.0  # Configurable delay in seconds between sequential frames
# ==============================================================================

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp", ".pbm"}


def parse_nav_csv_log(csv_path: Path) -> List[Dict[str, float]]:
    """
    Parses navigation CSV telemetry logs containing timestamp, latitude, longitude, altitude, heading.
    Gracefully handles missing or non-standard headers.
    """
    fixes = []
    try:
        if not csv_path.exists():
            return fixes

        with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
                    lat = float(clean_row.get("latitude") or clean_row.get("lat", 0.0))
                    lon = float(clean_row.get("longitude") or clean_row.get("lon", 0.0))
                    alt = float(clean_row.get("altitude") or clean_row.get("alt", 8.0))
                    hdg = float(clean_row.get("heading") or clean_row.get("hdg", 0.0))
                    ts = float(clean_row.get("timestamp") or clean_row.get("time", 0.0))
                    fixes.append({
                        "timestamp": ts,
                        "latitude": lat,
                        "longitude": lon,
                        "altitude": alt,
                        "heading": hdg,
                    })
                except (ValueError, TypeError):
                    continue
    except Exception:
        pass
    return fixes


def resolve_image_telemetry(
    image_path: Optional[Path],
    global_nav_fixes: List[Dict[str, float]],
    simulated_gps: Optional[Dict[str, float]] = None,
    default_altitude: float = 8.0,
    default_swath: float = 100.0,
    default_heading: float = 0.0,
) -> Tuple[str, Optional[Dict[str, float]]]:
    """
    Resolves telemetry and Graceful Degradation Tier for a sonar image:
    - If simulated_gps is provided (DEMO mode), uses simulated Arabian Sea WGS84 fix.
    - Otherwise checks sidecar JSON/CSV or global nav log.
    - Tier 'FULL': Has GPS coordinates + Altitude + Heading
    - Tier 'PARTIAL': Has Altitude/metadata without full GPS
    - Tier 'NONE': Raw imagery only
    """
    if simulated_gps and simulated_gps.get("lat") is not None and simulated_gps.get("lon") is not None:
        return "FULL", {
            "latitude": float(simulated_gps["lat"]),
            "longitude": float(simulated_gps["lon"]),
            "altitude": float(simulated_gps.get("alt", default_altitude)),
            "heading": float(simulated_gps.get("heading", default_heading)),
            "swath_width_m": default_swath,
            "simulated": True,
        }

    if image_path:
        stem = image_path.stem
        parent = image_path.parent

        # 1. Check for sidecar JSON
        sidecar_json = parent / f"{stem}.json"
        if sidecar_json.exists():
            try:
                with open(sidecar_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    lat = data.get("latitude") or data.get("lat")
                    lon = data.get("longitude") or data.get("lon")
                    alt = data.get("altitude_m") or data.get("altitude") or default_altitude
                    hdg = data.get("heading_deg") or data.get("heading") or default_heading
                    swath = data.get("swath_width_m") or data.get("swath") or default_swath
                    if lat is not None and lon is not None:
                        return "FULL", {
                            "latitude": float(lat),
                            "longitude": float(lon),
                            "altitude": float(alt),
                            "heading": float(hdg),
                            "swath_width_m": float(swath),
                        }
                    elif alt is not None:
                        return "PARTIAL", {
                            "altitude": float(alt),
                            "heading": float(hdg),
                            "swath_width_m": float(swath),
                        }
            except Exception:
                pass

        # 2. Check for sidecar CSV
        sidecar_csv = parent / f"{stem}.csv"
        if sidecar_csv.exists():
            fixes = parse_nav_csv_log(sidecar_csv)
            if fixes:
                first_fix = fixes[0]
                return "FULL", {
                    "latitude": first_fix["latitude"],
                    "longitude": first_fix["longitude"],
                    "altitude": first_fix["altitude"],
                    "heading": first_fix["heading"],
                    "swath_width_m": default_swath,
                }

    # 3. Check global navigation fixes
    if global_nav_fixes:
        first_fix = global_nav_fixes[0]
        return "FULL", {
            "latitude": first_fix["latitude"],
            "longitude": first_fix["longitude"],
            "altitude": first_fix["altitude"],
            "heading": first_fix["heading"],
            "swath_width_m": default_swath,
        }

    # 4. Fallback to Partial tier with default altitude if specified
    if default_altitude > 0:
        return "PARTIAL", {
            "altitude": default_altitude,
            "heading": default_heading,
            "swath_width_m": default_swath,
        }

    return "NONE", None


def create_side_by_side_comparison(
    raw_bgr: np.ndarray,
    processed_annotated_bgr: np.ndarray,
    target_count: int = 0
) -> np.ndarray:
    """
    Creates a high-contrast side-by-side composite image:
    [ LEFT: 1. ORIGINAL RAW SONAR ] | [ RIGHT: 2. PREPROCESSED + AI DETECTIONS ]
    Includes HUD header labels, target count badge, and a clean separating divider.
    """
    h_raw, w_raw = raw_bgr.shape[:2]
    h_proc, w_proc = processed_annotated_bgr.shape[:2]

    # Harmonize heights
    target_h = max(h_raw, h_proc)
    if h_raw != target_h:
        w_new = int(w_raw * (target_h / max(1, h_raw)))
        raw_bgr = cv2.resize(raw_bgr, (w_new, target_h), interpolation=cv2.INTER_AREA)
        w_raw = w_new
    if h_proc != target_h:
        w_new = int(w_proc * (target_h / max(1, h_proc)))
        processed_annotated_bgr = cv2.resize(processed_annotated_bgr, (w_new, target_h), interpolation=cv2.INTER_AREA)
        w_proc = w_new

    header_h = 34
    divider_w = 4
    total_w = w_raw + w_proc + divider_w
    total_h = target_h + header_h

    # Create dark HUD canvas (BGR: 16, 20, 24)
    canvas = np.full((total_h, total_w, 3), (16, 20, 24), dtype=np.uint8)

    # Place left image (Original Raw)
    canvas[header_h:header_h + target_h, 0:w_raw] = raw_bgr

    # Vertical divider line (Cyan / Electric Blue)
    div_x = w_raw + (divider_w // 2)
    cv2.line(canvas, (div_x, 0), (div_x, total_h), (50, 180, 240), 2)

    # Place right image (Preprocessed + AI Detections)
    canvas[header_h:header_h + target_h, w_raw + divider_w:total_w] = processed_annotated_bgr

    # Render Header HUD Badges
    font = cv2.FONT_HERSHEY_SIMPLEX

    # Left Badge: "1. ORIGINAL RAW SONAR"
    cv2.rectangle(canvas, (10, 6), (230, 28), (28, 36, 44), -1)
    cv2.rectangle(canvas, (10, 6), (230, 28), (60, 80, 100), 1)
    cv2.putText(canvas, "1. ORIGINAL RAW SONAR", (18, 22), font, 0.46, (210, 225, 240), 1, cv2.LINE_AA)

    # Right Badge: "2. PREPROCESSED + AI DETECTIONS (N targets)"
    right_x = w_raw + divider_w + 10
    tgt_suffix = f" ({target_count} target{'s' if target_count != 1 else ''})" if target_count > 0 else " (0 targets)"
    right_text = f"2. PREPROCESSED + AI DETECTIONS{tgt_suffix}"
    (tw, th), _ = cv2.getTextSize(right_text, font, 0.46, 1)

    cv2.rectangle(canvas, (right_x, 6), (right_x + tw + 16, 28), (20, 45, 40), -1)
    cv2.rectangle(canvas, (right_x, 6), (right_x + tw + 16, 28), (0, 200, 150), 1)
    cv2.putText(canvas, right_text, (right_x + 8, 22), font, 0.46, (0, 240, 180), 1, cv2.LINE_AA)

    return canvas


def process_single_image(
    image_input: Any,  # Path or bytes
    engine: Optional[AdaptiveInferenceEngine] = None,
    confidence_threshold: float = 0.20,
    padding: int = 12,
    slant_range: bool = True,
    clahe: bool = True,
    nadir_excision: bool = False,
    telemetry_tier: str = "NONE",
    telemetry_data: Optional[Dict[str, float]] = None,
    meters_per_pixel: float = 0.05,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Runs full DSP preprocessing, multi-scale AI inference, acoustic shadow gating,
    and geolocation projection on a single sonar image.
    Returns (raw_bgr, annotated_enhanced_bgr, side_by_side_bgr, final_detections, metadata).
    """
    if engine is None:
        engine = get_inference_engine()

    if isinstance(image_input, (str, Path)):
        with open(image_input, "rb") as f:
            image_bytes = f.read()
    elif isinstance(image_input, bytes):
        image_bytes = image_input
    else:
        raise ValueError(f"Unsupported image_input type: {type(image_input)}")

    norm_input = normalize_input_sources(image_bytes)
    raw_bgr = norm_input.image_bgr
    img_h, img_w = raw_bgr.shape[:2]

    # 1. DSP Preprocessing (Gain Normalization + CLAHE + Slant-Range)
    enhanced_bgr = preprocess_sonar_image(
        raw_bgr,
        remove_water_column=nadir_excision,
        nadir_width_ratio=0.05 if nadir_excision else 0.0,
        apply_clahe=clahe,
        apply_gain_normalization=True,
    )

    if slant_range:
        enhanced_bgr = apply_slant_range_correction(enhanced_bgr)

    # 2. Multi-Scale Inference executed ON the PREPROCESSED image
    all_tile_detections = []
    full_frame_dets = engine.predict_tile(
        enhanced_bgr,
        confidence_threshold=confidence_threshold,
        filter_distractors=False,
    )
    all_tile_detections.extend(full_frame_dets)

    if img_w > 640 or img_h > 640:
        tiles = generate_tiles(enhanced_bgr, tile_size=640, overlap_ratio=0.20)
        for tile_crop, x_off, y_off in tiles:
            t_dets = engine.predict_tile(
                tile_crop,
                confidence_threshold=confidence_threshold,
                filter_distractors=False,
            )
            remapped = map_detections_to_global(t_dets, x_off, y_off)
            all_tile_detections.extend(remapped)

    # If enhanced image yielded no detections, try raw image as fallback
    if not all_tile_detections:
        raw_dets = engine.predict_tile(
            raw_bgr,
            confidence_threshold=confidence_threshold,
            filter_distractors=False,
        )
        all_tile_detections.extend(raw_dets)

    merged_detections = apply_cross_tile_nms(all_tile_detections, iou_threshold=0.40)

    # Fallback to acoustic heuristic detector if neural model finds nothing
    if not merged_detections:
        fallback_dets = engine._heuristic_sonar_detector(enhanced_bgr, conf_thresh=confidence_threshold)
        merged_detections = fallback_dets

    # 3. Extract platform telemetry parameters
    vessel_lat = telemetry_data.get("latitude") if telemetry_data else None
    vessel_lon = telemetry_data.get("longitude") if telemetry_data else None
    altitude_m = telemetry_data.get("altitude", 8.0) if telemetry_data else 8.0
    heading_deg = telemetry_data.get("heading", 0.0) if telemetry_data else 0.0
    swath_width_m = telemetry_data.get("swath_width_m", 100.0) if telemetry_data else 100.0

    final_detections = []
    for idx, d in enumerate(merged_detections):
        x1, y1, x2, y2 = d["x_min"], d["y_min"], d["x_max"], d["y_max"]

        # Reject full-canvas false positives
        det_w = max(1, x2 - x1)
        det_h = max(1, y2 - y1)
        if (det_w > img_w * 0.85 and det_h > img_h * 0.85) or (det_w * det_h > img_w * img_h * 0.75):
            continue

        pad_x = max(padding, int(det_w * 0.08))
        pad_y = max(padding, int(det_h * 0.08))
        bx1 = max(0, x1 - pad_x)
        by1 = max(0, y1 - pad_y)
        bx2 = min(img_w, x2 + pad_x)
        by2 = min(img_h, y2 + pad_y)
        padded_bbox = (float(bx1), float(by1), float(bx2), float(by2))

        # Acoustic shadow physics evaluation
        shadow_eval = verify_acoustic_shadow(
            enhanced_bgr,
            d,
            nadir_x=img_w // 2,
            altitude_m=altitude_m,
            meters_per_pixel=meters_per_pixel,
        )
        shadow_ev = shadow_eval.get("evidence", "NEUTRAL")
        review_status = shadow_eval.get("review_status", "UNVERIFIED")
        conf_ai = d.get("confidence_ai", 0.75)
        conf_adj = shadow_eval.get("confidence_adjusted", conf_ai)
        relief_h = shadow_eval.get("relief_height_m", 0.5)
        shadow_contrast = shadow_eval.get("shadow_contrast", 0.0)

        # Enforce user-configured confidence threshold
        if conf_adj < confidence_threshold:
            continue

        # Physical 3D dimensions
        dimensions = compute_target_dimensions(d, meters_per_pixel=meters_per_pixel)
        dimensions["relief_height_m"] = relief_h

        # Target class & Hazard Risk classification
        target_cls = d.get("target_class", "mine_cylinder")
        hazard_risk = compute_risk_score(target_cls, shadow_ev, conf_adj)

        # Geospatial WGS84 projection & local track offset
        geo_coords, local_offset = project_detection_geolocation(
            detection=d,
            img_width=img_w,
            img_height=img_h,
            vessel_lat=vessel_lat,
            vessel_lon=vessel_lon,
            swath_width_m=swath_width_m,
            heading_deg=heading_deg,
        )

        # Polygon contour mask points
        poly = d.get("polygon", [])
        mask_contour = []
        if poly and len(poly) >= 6:
            for i in range(0, len(poly) - 1, 2):
                mask_contour.append((float(poly[i]), float(poly[i + 1])))
        else:
            mask_contour = [(float(bx1), float(by1)), (float(bx2), float(by1)), (float(bx2), float(by2)), (float(bx1), float(by2))]

        # Thumbnail crop
        thumbnail_b64 = _crop_thumbnail(raw_bgr, int(bx1), int(by1), int(bx2), int(by2))

        final_detections.append({
            "id": f"tgt-{idx + 1:02d}",
            "target_class": target_cls,
            "confidence_ai": round(float(conf_ai), 4),
            "confidence": round(float(conf_adj), 4),
            "shadow_evidence": shadow_ev,
            "review_status": review_status,
            "shadow_contrast": round(float(shadow_contrast), 4),
            "dimensions": dimensions,
            "hazard_risk": hazard_risk,
            "bounding_box": padded_bbox,
            "raw_box": [float(x1), float(y1), float(x2), float(y2)],
            "local_offset_m": local_offset,
            "geolocation": geo_coords,
            "mask_contour": mask_contour,
            "thumbnail_base64": thumbnail_b64,
        })

    # 4. Render annotations onto images
    annotated_enhanced_bgr = _draw_annotations(enhanced_bgr, final_detections)
    annotated_raw_bgr = _draw_annotations(raw_bgr, final_detections)

    # 5. Build Side-by-Side Composite: [ 1. Original Raw ] | [ 2. Preprocessed + Detections ]
    side_by_side_bgr = create_side_by_side_comparison(
        raw_bgr=raw_bgr,
        processed_annotated_bgr=annotated_enhanced_bgr,
        target_count=len(final_detections)
    )

    metadata = {
        "dimensions": [img_w, img_h],
        "degradation_tier": telemetry_tier,
        "telemetry": telemetry_data,
    }

    return raw_bgr, annotated_enhanced_bgr, side_by_side_bgr, final_detections, metadata


def execute_batch_generator(
    images_list: List[Tuple[str, Any]],  # List of (filename, Path_or_bytes)
    batch_id: Optional[str] = None,
    output_root: str = "outputs",
    interval_seconds: float = TEST_INTERVAL_SECONDS,
    sim_route: bool = True,
    cancellation_check: Optional[Callable[[str], bool]] = None,
    confidence_threshold: float = 0.20,
    padding: int = 12,
    altitude: float = 8.0,
    swath_width: float = 100.0,
    heading: float = 0.0,
    slant_range: bool = True,
    clahe: bool = True,
    nadir_excision: bool = False,
) -> Generator[Dict[str, Any], None, Dict[str, Any]]:
    """
    Authoritative sequential batch execution generator with streaming events.
    Yields events:
      - 'batch_started'
      - 'image_started'
      - 'image_processed'
      - 'image_failed'
      - 'batch_cancelled'
      - 'batch_completed'
    """
    started_at = datetime.now(timezone.utc).isoformat()
    total_images = len(images_list)

    if not batch_id:
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"

    batch_dir = Path(output_root).resolve() / batch_id
    processed_dir = batch_dir / "processed"
    csv_dir = batch_dir / "csv"
    json_dir = batch_dir / "json"

    processed_dir.mkdir(parents=True, exist_ok=True)
    csv_dir.mkdir(parents=True, exist_ok=True)
    json_dir.mkdir(parents=True, exist_ok=True)

    # Compute Arabian Sea simulation route coordinates for all frames
    sim_coordinates: List[Dict[str, float]] = []
    if sim_route and total_images > 0:
        sim_coordinates = interpolate_route(total_images)

    # Yield initial start event immediately
    yield {
        "type": "batch_started",
        "batch_id": batch_id,
        "total_images": total_images,
        "processing_interval_seconds": interval_seconds,
        "started_at": started_at,
        "gps_mode": "SIMULATION" if sim_route else "LIVE/SIDECAR",
        "route": {
            "start": "Mumbai Offshore Anchorage",
            "end": "Kochi Roadstead Channel",
            "waypoints": get_mumbai_kochi_route(),
        } if sim_route else None,
    }

    engine = get_inference_engine()
    batch_image_records: List[Dict[str, Any]] = []
    csv_rows: List[List[Any]] = []
    class_counts: Dict[str, int] = {}
    risk_counts: Dict[str, int] = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    evidence_counts: Dict[str, int] = {"SUPPORTING": 0, "NEUTRAL": 0, "ABSENT": 0}
    tier_counts: Dict[str, int] = {"FULL": 0, "PARTIAL": 0, "NONE": 0}
    total_detections_count = 0
    processed_count = 0
    failed_count = 0
    was_cancelled = False

    t_batch_start = time.perf_counter()

    for seq_idx, (img_name, img_data) in enumerate(images_list, 1):
        # 1. Check for cancellation before processing frame
        if cancellation_check and cancellation_check(batch_id):
            was_cancelled = True
            break

        frame_start_time = datetime.now(timezone.utc).isoformat()
        current_gps = sim_coordinates[seq_idx - 1] if sim_route and (seq_idx - 1) < len(sim_coordinates) else None

        yield {
            "type": "image_started",
            "batch_id": batch_id,
            "sequence": seq_idx,
            "total": total_images,
            "filename": img_name,
            "timestamp": frame_start_time,
            "gps": current_gps if current_gps else None,
        }

        t0 = time.perf_counter()
        try:
            # Resolve Telemetry
            img_path = Path(img_data) if isinstance(img_data, (str, Path)) else None
            tier, telemetry = resolve_image_telemetry(
                image_path=img_path,
                global_nav_fixes=[],
                simulated_gps=current_gps,
                default_altitude=altitude,
                default_swath=swath_width,
                default_heading=current_gps.get("heading", heading) if current_gps else heading,
            )
            tier_counts[tier] = tier_counts.get(tier, 0) + 1

            raw_bgr, enh_bgr, sbs_bgr, detections, meta = process_single_image(
                image_input=img_data,
                engine=engine,
                confidence_threshold=confidence_threshold,
                padding=padding,
                slant_range=slant_range,
                clahe=clahe,
                nadir_excision=nadir_excision,
                telemetry_tier=tier,
                telemetry_data=telemetry,
                meters_per_pixel=0.05,
            )

            # Save processed side-by-side composite
            out_img_filename = f"annotated_{img_name}"
            out_img_path = processed_dir / out_img_filename
            cv2.imwrite(str(out_img_path), sbs_bgr)

            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            processed_count += 1
            total_detections_count += len(detections)

            # Update metrics
            for d in detections:
                cls = d["target_class"]
                risk = d["hazard_risk"]
                ev = d["shadow_evidence"]
                class_counts[cls] = class_counts.get(cls, 0) + 1
                risk_counts[risk] = risk_counts.get(risk, 0) + 1
                evidence_counts[ev] = evidence_counts.get(ev, 0) + 1

            # Format detection items for structured JSON
            json_detections = []
            for d in detections:
                box = d["bounding_box"]
                dim = d.get("dimensions") or {}
                json_detections.append({
                    "id": d["id"],
                    "class": d["target_class"],
                    "confidence": d["confidence"],
                    "confidence_ai": d.get("confidence_ai", d["confidence"]),
                    "hazard_risk": d["hazard_risk"],
                    "shadow_evidence": d["shadow_evidence"],
                    "review_status": d["review_status"],
                    "bbox": {
                        "x": box[0],
                        "y": box[1],
                        "width": box[2] - box[0],
                        "height": box[3] - box[1],
                    },
                    "dimensions": {
                        "length_m": dim.get("length_m"),
                        "width_m": dim.get("width_m"),
                        "area_m2": dim.get("area_m2"),
                        "relief_height_m": dim.get("relief_height_m"),
                    },
                    "geolocation": d.get("geolocation"),
                })

            # Record JSON entry for this image
            image_record = {
                "sequence": seq_idx,
                "filename": img_name,
                "timestamp": frame_start_time,
                "image_width": meta["dimensions"][0],
                "image_height": meta["dimensions"][1],
                "detection_count": len(detections),
                "gps": {
                    "lat": current_gps["lat"] if current_gps else (telemetry.get("latitude") if telemetry else None),
                    "lon": current_gps["lon"] if current_gps else (telemetry.get("longitude") if telemetry else None),
                    "latitude": current_gps["lat"] if current_gps else (telemetry.get("latitude") if telemetry else None),
                    "longitude": current_gps["lon"] if current_gps else (telemetry.get("longitude") if telemetry else None),
                    "heading": current_gps.get("heading") if current_gps else (telemetry.get("heading") if telemetry else None),
                    "progress_pct": current_gps.get("progress_pct") if current_gps else None,
                },
                "degradation_tier": tier,
                "detections": json_detections,
                "evaluation": {
                    "slant_range_corrected": slant_range,
                    "clahe_applied": clahe,
                    "nadir_excised": nadir_excision,
                    "confidence_threshold": confidence_threshold,
                },
                "processing_time_ms": elapsed_ms,
                "status": "processed",
                "processed_image_file": out_img_filename,
            }
            batch_image_records.append(image_record)

            # Record CSV Rows (One row per detection; or 1 row if 0 detections)
            gps_lat = current_gps["lat"] if current_gps else (telemetry.get("latitude") if telemetry else "")
            gps_lon = current_gps["lon"] if current_gps else (telemetry.get("longitude") if telemetry else "")
            hdg = current_gps.get("heading") if current_gps else (telemetry.get("heading") if telemetry else "")

            if detections:
                for d in detections:
                    box = d["bounding_box"]
                    dim = d.get("dimensions") or {}
                    geo = d.get("geolocation") or {}
                    csv_rows.append([
                        seq_idx,
                        img_name,
                        frame_start_time,
                        "processed",
                        d["id"],
                        d["target_class"],
                        f"{d.get('confidence_ai', d['confidence'])*100:.1f}",
                        f"{d['confidence']*100:.1f}",
                        d["hazard_risk"],
                        d["shadow_evidence"],
                        d["review_status"],
                        dim.get("relief_height_m", ""),
                        dim.get("length_m", ""),
                        dim.get("width_m", ""),
                        dim.get("area_m2", ""),
                        gps_lat,
                        gps_lon,
                        hdg,
                        geo.get("lat", ""),
                        geo.get("lon", ""),
                        f"{box[0]:.0f}",
                        f"{box[1]:.0f}",
                        f"{box[2]:.0f}",
                        f"{box[3]:.0f}",
                        tier,
                        elapsed_ms,
                        "",
                    ])
            else:
                # 0-detection row so image is never lost
                csv_rows.append([
                    seq_idx,
                    img_name,
                    frame_start_time,
                    "processed",
                    "",
                    "no_targets",
                    "",
                    "",
                    "NONE",
                    "NONE",
                    "UNVERIFIED",
                    "",
                    "",
                    "",
                    "",
                    gps_lat,
                    gps_lon,
                    hdg,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    tier,
                    elapsed_ms,
                    "",
                ])

            # Prepare live frontend payload
            raw_url = _img_to_data_url(raw_bgr)
            enh_url = _img_to_data_url(enh_bgr)

            yield {
                "type": "image_processed",
                "batch_id": batch_id,
                "sequence": seq_idx,
                "total": total_images,
                "filename": img_name,
                "timestamp": frame_start_time,
                "gps": image_record["gps"],
                "detections": detections,
                "detection_count": len(detections),
                "processing_time_ms": elapsed_ms,
                "status": "processed",
                "result": {
                    "raw_image_url": raw_url,
                    "enhanced_image_url": enh_url,
                    "detections": detections,
                    "kpis": {
                        "total_surveys": seq_idx,
                        "total_detections": total_detections_count,
                        "verified_3d_objects": sum(1 for det in detections if det.get("shadow_evidence") == "SUPPORTING"),
                        "critical_hazards": sum(1 for det in detections if det.get("hazard_risk") == "CRITICAL"),
                    },
                    "processing_meta": {
                        "slant_range_corrected": slant_range,
                        "clahe_applied": clahe,
                        "nadir_excised": nadir_excision,
                        "confidence_threshold": confidence_threshold,
                        "processing_time_ms": elapsed_ms,
                    }
                }
            }

        except Exception as err:
            failed_count += 1
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            err_msg = str(err)

            failed_record = {
                "sequence": seq_idx,
                "filename": img_name,
                "timestamp": frame_start_time,
                "image_width": None,
                "image_height": None,
                "detection_count": 0,
                "gps": {
                    "latitude": current_gps["lat"] if current_gps else None,
                    "longitude": current_gps["lon"] if current_gps else None,
                },
                "detections": [],
                "evaluation": {},
                "processing_time_ms": elapsed_ms,
                "status": "failed",
                "error": err_msg,
            }
            batch_image_records.append(failed_record)

            csv_rows.append([
                seq_idx,
                img_name,
                frame_start_time,
                "failed",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                current_gps["lat"] if current_gps else "",
                current_gps["lon"] if current_gps else "",
                current_gps.get("heading", "") if current_gps else "",
                "",
                "",
                "",
                "",
                "",
                "",
                "NONE",
                elapsed_ms,
                err_msg,
            ])

            yield {
                "type": "image_failed",
                "batch_id": batch_id,
                "sequence": seq_idx,
                "total": total_images,
                "filename": img_name,
                "timestamp": frame_start_time,
                "gps": failed_record["gps"],
                "error": err_msg,
                "status": "failed",
            }

        # Pause for configured interval between frames (unless last frame or cancelled)
        if seq_idx < total_images and interval_seconds > 0:
            sleep_step = 0.1
            slept = 0.0
            while slept < interval_seconds:
                if cancellation_check and cancellation_check(batch_id):
                    was_cancelled = True
                    break
                time.sleep(min(sleep_step, interval_seconds - slept))
                slept += sleep_step
            if was_cancelled:
                break

    completed_at = datetime.now(timezone.utc).isoformat()
    total_batch_time = round(time.perf_counter() - t_batch_start, 2)
    final_status = "cancelled" if was_cancelled else "completed"

    # 1. Write CSV
    csv_file = csv_dir / "batch_results.csv"
    with open(csv_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "sequence",
            "image_name",
            "timestamp",
            "status",
            "target_id",
            "target_class",
            "confidence_ai_pct",
            "confidence_final_pct",
            "hazard_risk",
            "shadow_evidence",
            "review_status",
            "relief_height_m",
            "length_m",
            "width_m",
            "area_m2",
            "vessel_latitude",
            "vessel_longitude",
            "vessel_heading",
            "target_latitude",
            "target_longitude",
            "bbox_x1",
            "bbox_y1",
            "bbox_x2",
            "bbox_y2",
            "degradation_tier",
            "processing_time_ms",
            "error_info",
        ])
        writer.writerows(csv_rows)

    # 2. Write JSON
    full_batch_json = {
        "run_id": batch_id,
        "source_folder": str(images_list[0][0]) if images_list else "unknown",
        "total_images": total_images,
        "processed_images": processed_count,
        "failed_images": failed_count,
        "processing_interval_seconds": interval_seconds,
        "started_at": started_at,
        "completed_at": completed_at,
        "gps_mode": "SIMULATION" if sim_route else "LIVE/SIDECAR",
        "status": final_status,
        "route": {
            "start": "Mumbai",
            "end": "Kochi",
        } if sim_route else None,
        "summary": {
            "total_detections": total_detections_count,
            "total_time_seconds": total_batch_time,
            "class_distribution": class_counts,
            "risk_distribution": risk_counts,
            "evidence_distribution": evidence_counts,
            "degradation_distribution": tier_counts,
        },
        "images": batch_image_records,
    }

    json_file = json_dir / "batch_results.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(full_batch_json, f, indent=2)

    summary_file = batch_dir / "run_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump({
            "run_id": batch_id,
            "status": final_status,
            "started_at": started_at,
            "completed_at": completed_at,
            "total_images": total_images,
            "processed_images": processed_count,
            "failed_images": failed_count,
            "total_detections": total_detections_count,
            "total_time_seconds": total_batch_time,
            "class_distribution": class_counts,
            "risk_distribution": risk_counts,
        }, f, indent=2)

    # 3. Create ZIP archive of the batch folder
    zip_path = Path(output_root).resolve() / f"{batch_id}.zip"
    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(str(batch_dir)):
            for file in files:
                file_full = Path(root) / file
                rel_path = file_full.relative_to(batch_dir)
                zf.write(file_full, arcname=f"{batch_id}/{rel_path}")

    final_event = {
        "type": "batch_cancelled" if was_cancelled else "batch_completed",
        "batch_id": batch_id,
        "status": final_status,
        "total_images": total_images,
        "processed_images": processed_count,
        "failed_images": failed_count,
        "total_detections": total_detections_count,
        "total_time_seconds": total_batch_time,
        "download_urls": {
            "csv": f"/api/v1/batch/{batch_id}/download/csv",
            "json": f"/api/v1/batch/{batch_id}/download/json",
            "zip": f"/api/v1/batch/{batch_id}/download/zip",
        },
        "output_directory": str(batch_dir),
        "zip_path": str(zip_path),
    }

    yield final_event
    return final_event


def run_batch_test(
    input_dir: str = "Test_Data",
    output_dir: str = "outputs",
    confidence_threshold: float = 0.20,
    padding: int = 12,
    nav_file: Optional[str] = None,
    altitude: float = 8.0,
    swath_width: float = 100.0,
    heading: float = 0.0,
    sim_route: bool = True,
    interval_seconds: float = TEST_INTERVAL_SECONDS,
    save_both: bool = False,
    single_file: Optional[str] = None,
):
    """
    CLI runner that invokes the authoritative execute_batch_generator.
    """
    input_path = Path(input_dir).resolve()
    image_files: List[Path] = []

    if single_file:
        single_path = Path(single_file).resolve()
        if not single_path.exists():
            print(f"❌ Error: Single file '{single_path}' not found.")
            return
        image_files = [single_path]
    elif input_path.is_file():
        image_files = [input_path]
    elif input_path.is_dir():
        image_files = sorted([
            f for f in input_path.iterdir()
            if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
        ])
    else:
        print(f"❌ Error: Input path '{input_path}' does not exist.")
        return

    if not image_files:
        print(f"⚠️ No supported images found in '{input_path}'.")
        return

    images_payload = [(f.name, f) for f in image_files]

    print("=" * 78)
    print("🌊 Aqua Sentinel — Authoritative Sonar Batch Runner & Arabian Sea Simulator")
    print("=" * 78)
    print(f"📁 Input Target:       {input_path}")
    print(f"🖼️ Total Images:       {len(image_files)}")
    print(f"⏱️ Interval:           {interval_seconds:.1f}s")
    print(f"⚓ Arabian Sea Route:  {'ON (Mumbai -> Kochi)' if sim_route else 'OFF'}")
    print(f"🎯 Conf Threshold:     {confidence_threshold:.2f}")
    print("=" * 78)

    generator = execute_batch_generator(
        images_list=images_payload,
        output_root=output_dir,
        interval_seconds=interval_seconds,
        sim_route=sim_route,
        confidence_threshold=confidence_threshold,
        padding=padding,
        altitude=altitude,
        swath_width=swath_width,
        heading=heading,
    )

    for event in generator:
        ev_type = event.get("type")
        if ev_type == "batch_started":
            print(f"🚀 Batch started: {event['batch_id']} ({event['total_images']} frames)")
        elif ev_type == "image_processed":
            seq = event["sequence"]
            tot = event["total"]
            name = event["filename"]
            t_ms = event["processing_time_ms"]
            dets = event["detection_count"]
            gps = event["gps"] or {}
            gps_str = f"[{gps.get('latitude', 0.0):.4f}N, {gps.get('longitude', 0.0):.4f}E]" if gps else "[No GPS]"
            print(f"[{seq:02d}/{tot:02d}] {gps_str} {name[:24]:<24} -> {dets} targets ({t_ms:4.0f}ms)")
        elif ev_type == "image_failed":
            print(f"[{event['sequence']:02d}/{event['total']:02d}] ❌ Failed: {event['filename']} ({event['error']})")
        elif ev_type in ("batch_completed", "batch_cancelled"):
            print("\n" + "=" * 78)
            print(f"🏁 Batch {event['status'].upper()}: {event['batch_id']}")
            print(f"📦 Outputs: {event['output_directory']}")
            print(f"🗜️ Archive: {event['zip_path']}")
            print("=" * 78)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aqua Sentinel Authoritative Batch Runner & GPS Simulator")
    parser.add_argument("--input", "-i", default="Test_Data", help="Input directory or image file")
    parser.add_argument("--single", "-s", default=None, help="Evaluate a single image file")
    parser.add_argument("--output", "-o", default="outputs", help="Output directory root")
    parser.add_argument("--conf", "-c", type=float, default=0.20, help="Confidence threshold")
    parser.add_argument("--pad", "-p", type=int, default=12, help="Padding in pixels")
    parser.add_argument("--interval", type=float, default=TEST_INTERVAL_SECONDS, help="Delay in seconds between frames")
    parser.add_argument("--sim-route", action="store_true", default=True, help="Enable simulated Arabian Sea route")
    parser.add_argument("--no-sim-route", action="store_false", dest="sim_route", help="Disable simulated route")
    parser.add_argument("--altitude", type=float, default=8.0, help="Altitude in meters")
    parser.add_argument("--swath", type=float, default=100.0, help="Swath width in meters")
    parser.add_argument("--heading", type=float, default=0.0, help="Platform heading")
    parser.add_argument("--save-both", action="store_true", help="Save side-by-side images")

    args = parser.parse_args()

    run_batch_test(
        input_dir=args.input,
        output_dir=args.output,
        confidence_threshold=args.conf,
        padding=args.pad,
        altitude=args.altitude,
        swath_width=args.swath,
        heading=args.heading,
        sim_route=args.sim_route,
        interval_seconds=args.interval,
        save_both=args.save_both,
        single_file=args.single,
    )
