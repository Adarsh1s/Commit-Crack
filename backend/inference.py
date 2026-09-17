"""
backend/inference.py
Aqua Sentinel - Full Production Sonar Inference Pipeline
Orchestrates Input Normalization, EGN & CLAHE Preprocessing, Slant-Range Correction,
Adaptive YOLO + Acoustic Anomaly Inference, Acoustic Shadow Gating, and Geolocation.
"""
from __future__ import annotations

import base64
import io
import math
import os
from pathlib import Path
import time
from typing import Optional, List, Dict, Any
import uuid

import cv2
import numpy as np
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

from input_normalizer import normalize_input_sources
from pipeline.preprocess import preprocess_sonar_image
from pipeline.slant_range import apply_slant_range_correction
from pipeline.quality import assess_image_quality
from pipeline.tiling import generate_tiles, map_detections_to_global, apply_cross_tile_nms
from pipeline.inference import AdaptiveInferenceEngine, FRONTEND_CLASS_MAP
from pipeline.shadow_gate import verify_acoustic_shadow
from pipeline.geolocation import compute_target_dimensions, project_detection_geolocation, compute_risk_score

# ─── Singleton Inference Engine ────────────────────────────────────────────────
_ENGINE: Optional[AdaptiveInferenceEngine] = None


def get_inference_engine() -> AdaptiveInferenceEngine:
    global _ENGINE
    if _ENGINE is None:
        model_path = os.getenv("MODEL_PATH", "MODELS/yolov8n.pt")
        _ENGINE = AdaptiveInferenceEngine(model_path=model_path)
    return _ENGINE


def _crop_thumbnail(img_bgr: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> str:
    """Crop bounding box region, resize to 128x128, return data URL."""
    h, w = img_bgr.shape[:2]
    x1c, y1c = max(0, int(x1)), max(0, int(y1))
    x2c, y2c = min(w, int(x2)), min(h, int(y2))
    crop = img_bgr[y1c:y2c, x1c:x2c]
    if crop.size == 0 or crop.shape[0] < 2 or crop.shape[1] < 2:
        crop = np.zeros((128, 128, 3), dtype=np.uint8)
    crop_resized = cv2.resize(crop, (128, 128), interpolation=cv2.INTER_LINEAR)
    crop_rgb = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(crop_rgb)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _img_to_data_url(img_bgr: np.ndarray, quality: int = 88) -> str:
    """Encode OpenCV BGR image into JPEG data URL."""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(img_rgb)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _draw_annotations(
    img_bgr: np.ndarray,
    detections: List[Dict[str, Any]],
) -> np.ndarray:
    """
    Renders high-visibility maritime intelligence bounding boxes, class labels,
    confidence badges, and shadow detection indicators on the enhanced sonar image.
    """
    canvas = img_bgr.copy()
    h, w = canvas.shape[:2]

    color_map = {
        "CRITICAL": (34, 34, 239),    # Bright Red (BGR)
        "HIGH": (0, 140, 255),        # Deep Amber / Orange
        "MEDIUM": (0, 215, 255),      # Bright Yellow
        "LOW": (80, 200, 50),         # Emerald Green
    }

    for d in detections:
        x1, y1, x2, y2 = [int(v) for v in d["bounding_box"]]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        risk = d.get("hazard_risk", "MEDIUM")
        color = color_map.get(risk, (0, 200, 255))
        cls_name = d.get("target_class", "mine_cylinder").replace("_", " ").title()
        conf = int(d.get("confidence", 0.75) * 100)
        shadow_ev = d.get("shadow_evidence", "NEUTRAL")

        # 1. Bounding box outline
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)

        # 2. Corner accent markers
        corner_len = max(6, min(14, (x2 - x1) // 4, (y2 - y1) // 4))
        # Top-left
        cv2.line(canvas, (x1, y1), (x1 + corner_len, y1), color, 3, cv2.LINE_AA)
        cv2.line(canvas, (x1, y1), (x1, y1 + corner_len), color, 3, cv2.LINE_AA)
        # Top-right
        cv2.line(canvas, (x2, y1), (x2 - corner_len, y1), color, 3, cv2.LINE_AA)
        cv2.line(canvas, (x2, y1), (x2, y1 + corner_len), color, 3, cv2.LINE_AA)
        # Bottom-left
        cv2.line(canvas, (x1, y2), (x1 + corner_len, y2), color, 3, cv2.LINE_AA)
        cv2.line(canvas, (x1, y2), (x1, y2 - corner_len), color, 3, cv2.LINE_AA)
        # Bottom-right
        cv2.line(canvas, (x2, y2), (x2 - corner_len, y2), color, 3, cv2.LINE_AA)
        cv2.line(canvas, (x2, y2), (x2, y2 - corner_len), color, 3, cv2.LINE_AA)

        # 3. Label tag — always kept inside image bounds
        label_text = f"{cls_name} {conf}%"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.42
        thickness = 1
        (tw, th), baseline = cv2.getTextSize(label_text, font, font_scale, thickness)

        tag_h = th + 8
        tag_w = min(w, tw + 10)

        # If the label above the box would clip outside the image, put it INSIDE the box
        if y1 - tag_h < 0:
            # Place label inside the box at the top
            tag_y1 = y1
            tag_y2 = min(h, y1 + tag_h)
        else:
            # Place label above the box (normal case)
            tag_y1 = y1 - tag_h
            tag_y2 = y1

        tag_x1 = max(0, x1)
        tag_x2 = min(w, tag_x1 + tag_w)

        # Dark translucent badge background
        overlay = canvas.copy()
        cv2.rectangle(overlay, (tag_x1, tag_y1), (tag_x2, tag_y2), (15, 23, 42), -1)
        cv2.addWeighted(overlay, 0.82, canvas, 0.18, 0, canvas)
        cv2.rectangle(canvas, (tag_x1, tag_y1), (tag_x2, tag_y2), color, 1, cv2.LINE_AA)

        cv2.putText(
            canvas,
            label_text,
            (tag_x1 + 4, tag_y2 - 4),
            font,
            font_scale,
            (240, 245, 255),
            thickness,
            cv2.LINE_AA,
        )

        # 4. Shadow verification dot
        if shadow_ev == "SUPPORTING":
            cv2.circle(canvas, (x2 - 5, y1 + 5), 4, (50, 205, 50), -1, cv2.LINE_AA)

    return canvas


def run_inference(
    image_bytes: bytes,
    *,
    slant_range_correction: bool = True,
    clahe_equalization: bool = True,
    nadir_excision: bool = False,
    confidence_threshold: float = 0.20,
    vessel_lat: Optional[float] = None,
    vessel_lon: Optional[float] = None,
) -> dict:
    """
    Main sonar target detection pipeline:
    1. Robust normalization & decoding (multi-format support).
    2. Sonar signal enhancement (EGN Swath Normalization, CLAHE, Nadir Excision).
    3. Slant-range ground mapping.
    4. Swath tiling + Adaptive YOLOv8 / Deterministic Acoustic Anomaly Detection.
    5. Acoustic shadow physics gating & relief height estimation.
    6. Metric dimensions & GPS geolocation projection.
    7. High-visibility overlay generation & thumbnail crop.
    """
    t_start = time.perf_counter()

    # 1. Normalization & Decode
    norm_input = normalize_input_sources(image_bytes)
    raw_bgr = norm_input.image_bgr
    img_h, img_w = raw_bgr.shape[:2]
    raw_data_url = _img_to_data_url(raw_bgr)

    # 2. Quality assessment
    quality_metrics = assess_image_quality(raw_bgr)

    # 3. Sonar Preprocessing (EGN + CLAHE + Nadir)
    enhanced_bgr = preprocess_sonar_image(
        raw_bgr,
        remove_water_column=nadir_excision,
        nadir_width_ratio=0.05 if nadir_excision else 0.0,
        apply_clahe=clahe_equalization,
        apply_gain_normalization=True
    )

    # 4. Slant-Range Correction
    if slant_range_correction:
        enhanced_bgr = apply_slant_range_correction(enhanced_bgr)

    # 5. Adaptive Swath Tiling & Multi-Scale Inference
    engine = get_inference_engine()
    all_tile_detections = []

    # A. Full frame inference (scaled to 640 for global context)
    full_frame_dets = engine.predict_tile(
        enhanced_bgr,
        confidence_threshold=confidence_threshold,
        filter_distractors=False
    )
    all_tile_detections.extend(full_frame_dets)

    # B. Swath tiles (if survey image is larger than single 640 window)
    if img_w > 640 or img_h > 640:
        tiles = generate_tiles(enhanced_bgr, tile_size=640, overlap_ratio=0.20)
        for tile_crop, x_off, y_off in tiles:
            t_dets = engine.predict_tile(
                tile_crop,
                confidence_threshold=confidence_threshold,
                filter_distractors=False
            )
            remapped = map_detections_to_global(t_dets, x_off, y_off)
            all_tile_detections.extend(remapped)

    # C. Fallback: if enhanced image produced zero neural detections, try unwarped raw image
    if not all_tile_detections:
        raw_dets = engine.predict_tile(
            raw_bgr,
            confidence_threshold=confidence_threshold,
            filter_distractors=False
        )
        all_tile_detections.extend(raw_dets)

    # Cross-Tile Non-Maximum Suppression
    merged_detections = apply_cross_tile_nms(all_tile_detections, iou_threshold=0.40)

    # D. Sensitive salient anomaly heuristic scan fallback
    if not merged_detections:
        fallback_dets = engine._heuristic_sonar_detector(enhanced_bgr, conf_thresh=confidence_threshold)
        merged_detections = fallback_dets

    # 6. Acoustic Shadow Gating & Telemetry Extraction
    final_detections = []
    for idx, d in enumerate(merged_detections):
        x1, y1, x2, y2 = d["x_min"], d["y_min"], d["x_max"], d["y_max"]

        # Skip whole-canvas false positives (only reject if covering nearly the full frame in BOTH dimensions or >75% total area)
        det_w = max(1, x2 - x1)
        det_h = max(1, y2 - y1)
        if (det_w > img_w * 0.85 and det_h > img_h * 0.85) or (det_w * det_h > img_w * img_h * 0.75):
            continue

        bbox = (float(x1), float(y1), float(x2), float(y2))

        # Acoustic shadow physics evaluation
        shadow_eval = verify_acoustic_shadow(
            enhanced_bgr,
            d,
            nadir_x=img_w // 2,
            altitude_m=10.0,
            meters_per_pixel=0.05
        )

        shadow_ev = shadow_eval.get("evidence", "NEUTRAL")
        conf_adj = shadow_eval.get("confidence_adjusted", d.get("confidence_ai", 0.75))
        relief_h = shadow_eval.get("relief_height_m", 0.5)

        # Enforce user-configured confidence threshold
        if conf_adj < confidence_threshold:
            continue

        # Physical metric dimensions
        dims_metric = compute_target_dimensions(d, meters_per_pixel=0.05)
        dimensions = {
            "length_m": dims_metric["length_m"],
            "width_m": dims_metric["width_m"],
            "area_m2": dims_metric["area_m2"],
            "relief_height_m": relief_h,
        }

        # Geolocation & local offset
        geo, local_off = project_detection_geolocation(
            d,
            img_width=img_w,
            img_height=img_h,
            vessel_lat=vessel_lat,
            vessel_lon=vessel_lon,
            swath_width_m=60.0
        )

        # Risk scoring
        hazard_risk = compute_risk_score(d.get("class_name", "anomaly"), shadow_ev, conf_adj)

        # Polygon mask contour points
        poly = d.get("polygon", [])
        mask_contour = []
        if poly and len(poly) >= 6:
            for i in range(0, len(poly) - 1, 2):
                mask_contour.append((float(poly[i]), float(poly[i + 1])))
        else:
            mask_contour = [(float(x1), float(y1)), (float(x2), float(y1)), (float(x2), float(y2)), (float(x1), float(y2))]

        # Thumbnail crop
        thumbnail_b64 = _crop_thumbnail(raw_bgr, int(x1), int(y1), int(x2), int(y2))

        target_cls = d.get("target_class", "mine_cylinder")

        final_detections.append({
            "id": f"tgt-{uuid.uuid4().hex[:6]}-{idx + 1:02d}",
            "target_class": target_cls,
            "confidence": round(float(conf_adj), 4),
            "shadow_evidence": shadow_ev,
            "dimensions": dimensions,
            "geolocation": geo,
            "local_offset": local_off,
            "hazard_risk": hazard_risk,
            "bounding_box": bbox,
            "mask_contour": mask_contour,
            "thumbnail_base64": thumbnail_b64,
        })

    # 7. Render Enhanced Image with Overlays
    annotated_bgr = _draw_annotations(enhanced_bgr, final_detections)
    enhanced_data_url = _img_to_data_url(annotated_bgr)

    # 8. KPIs Summary
    kpis = {
        "total_surveys": 1,
        "total_detections": len(final_detections),
        "verified_3d_objects": sum(1 for det in final_detections if det["shadow_evidence"] == "SUPPORTING"),
        "critical_hazards": sum(1 for det in final_detections if det["hazard_risk"] == "CRITICAL"),
    }

    t_elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)

    processing_meta = {
        "slant_range_corrected": slant_range_correction,
        "clahe_applied": clahe_equalization,
        "nadir_excised": nadir_excision,
        "confidence_threshold": confidence_threshold,
        "processing_time_ms": t_elapsed_ms,
    }

    return {
        "raw_image_url": raw_data_url,
        "enhanced_image_url": enhanced_data_url,
        "detections": final_detections,
        "kpis": kpis,
        "processing_meta": processing_meta,
    }
