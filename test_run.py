"""
Aqua Sentinel — Advanced Sonar Batch Test & Physics Validation Runner
======================================================================
Processes sonar image surveys through the complete AquaSentinel AI pipeline:
- Ingests sonar images and auto-detects navigation/telemetry sidecar logs.
- Evaluates the Graceful Degradation Ladder (FULL, PARTIAL, NONE).
- Executes DSP enhancements (Slant-Range, CLAHE, Gain Normalization, Nadir Excision).
- Performs Multi-Scale Tiled + Full-Frame YOLOv8 & heuristic fallback detection.
- Physics-Informed Acoustic Shadow Gating (highlight-shadow geometry, relief height).
- Real-world 3D Metric Dimensions & WGS84 Geolocation Projection.
- Hazard Risk Assessment (CRITICAL, HIGH, MEDIUM, LOW).
- Renders padded bounding boxes on Unprocessed (Raw) or Enhanced sonar canvases.
- Exports GIS-ready GeoJSON FeatureCollection, summary CSV, and comprehensive JSON.

Usage:
    python test_run.py
    python test_run.py --input Test_Data --output outputs --conf 0.25 --pad 12
    python test_run.py --save-both --altitude 8.5 --swath 120.0
"""

import argparse
import csv
import io
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

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
from inference import _draw_annotations, get_inference_engine


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}


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
    image_path: Path,
    global_nav_fixes: List[Dict[str, float]],
    default_altitude: float = 8.0,
    default_swath: float = 100.0,
    default_heading: float = 0.0,
) -> Tuple[str, Optional[Dict[str, float]]]:
    """
    Resolves telemetry and Graceful Degradation Tier for a sonar image:
    - Tier 'FULL': Has GPS coordinates + Altitude + Heading (from sidecar CSV/JSON or global log)
    - Tier 'PARTIAL': Has Altitude/metadata without full GPS
    - Tier 'NONE': Raw imagery only
    """
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


def process_single_image(
    image_path: Path,
    engine: AdaptiveInferenceEngine,
    confidence_threshold: float = 0.20,
    padding: int = 12,
    slant_range: bool = True,
    clahe: bool = True,
    nadir_excision: bool = False,
    telemetry_tier: str = "NONE",
    telemetry_data: Optional[Dict[str, float]] = None,
    meters_per_pixel: float = 0.05,
) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Runs full DSP, multi-scale AI inference, acoustic shadow evidence gating,
    and geospatial/metric projection on a single sonar image.
    """
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    norm_input = normalize_input_sources(image_bytes)
    raw_bgr = norm_input.image_bgr
    img_h, img_w = raw_bgr.shape[:2]

    # Preprocessing for AI detection
    enhanced_bgr = preprocess_sonar_image(
        raw_bgr,
        remove_water_column=nadir_excision,
        nadir_width_ratio=0.05 if nadir_excision else 0.0,
        apply_clahe=clahe,
        apply_gain_normalization=True,
    )

    if slant_range:
        enhanced_bgr = apply_slant_range_correction(enhanced_bgr)

    # Multi-Scale Inference: Full-frame + Tiled
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

    # If enhanced image yielded no detections, try raw image
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

    # Extract platform telemetry parameters
    vessel_lat = telemetry_data.get("latitude") if telemetry_data else None
    vessel_lon = telemetry_data.get("longitude") if telemetry_data else None
    altitude_m = telemetry_data.get("altitude", 8.0) if telemetry_data else 8.0
    heading_deg = telemetry_data.get("heading", 0.0) if telemetry_data else 0.0
    swath_width_m = telemetry_data.get("swath_width_m", 100.0) if telemetry_data else 100.0

    final_detections = []
    for idx, d in enumerate(merged_detections):
        x1, y1, x2, y2 = d["x_min"], d["y_min"], d["x_max"], d["y_max"]

        # Skip whole-canvas false positives (only reject if covering nearly the full frame in BOTH dimensions or >75% total area)
        det_w = max(1, x2 - x1)
        det_h = max(1, y2 - y1)
        if (det_w > img_w * 0.85 and det_h > img_h * 0.85) or (det_w * det_h > img_w * img_h * 0.75):
            continue

        # Apply configurable bounding box padding around detected object
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

        final_detections.append({
            "id": f"tgt-{idx + 1:02d}",
            "target_class": target_cls,
            "confidence_ai": round(float(conf_ai), 4),
            "confidence": round(float(conf_adj), 4),
            "shadow_evidence": shadow_ev,
            "review_status": review_status,
            "shadow_contrast": shadow_contrast,
            "dimensions": dimensions,
            "hazard_risk": hazard_risk,
            "bounding_box": padded_bbox,
            "raw_box": [float(x1), float(y1), float(x2), float(y2)],
            "local_offset_m": local_offset,
            "geolocation": geo_coords,
        })

    # Render annotations directly onto UNPROCESSED (raw) image canvas
    annotated_raw_bgr = _draw_annotations(raw_bgr, final_detections)
    # Also render onto enhanced image for dual-output options
    annotated_enhanced_bgr = _draw_annotations(enhanced_bgr, final_detections)

    metadata = {
        "dimensions": [img_w, img_h],
        "degradation_tier": telemetry_tier,
        "telemetry": telemetry_data,
    }

    return annotated_raw_bgr, annotated_enhanced_bgr, final_detections, metadata


def build_geojson_feature_collection(
    all_results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Compiles all detected sonar targets into a valid GeoJSON FeatureCollection.
    Ready for import into QGIS, ArcGIS, Mapbox, or Leaflet.
    """
    features = []

    for res in all_results:
        img_name = res["filename"]
        for d in res["detections"]:
            geo = d.get("geolocation")
            local = d.get("local_offset_m") or {}
            dim = d.get("dimensions") or {}

            # Use WGS84 GPS if available; otherwise use local metric offset
            if geo and geo.get("lon") is not None and geo.get("lat") is not None:
                geometry = {
                    "type": "Point",
                    "coordinates": [geo["lon"], geo["lat"]]
                }
            else:
                geometry = {
                    "type": "Point",
                    "coordinates": [local.get("x_m", 0.0), local.get("y_m", 0.0)]
                }

            feature = {
                "type": "Feature",
                "id": f"{img_name}_{d['id']}",
                "geometry": geometry,
                "properties": {
                    "image_name": img_name,
                    "target_id": d["id"],
                    "class_name": d["target_class"],
                    "confidence_ai": d.get("confidence_ai", d["confidence"]),
                    "confidence_final": d["confidence"],
                    "hazard_risk": d["hazard_risk"],
                    "shadow_evidence": d["shadow_evidence"],
                    "review_status": d["review_status"],
                    "length_m": dim.get("length_m"),
                    "width_m": dim.get("width_m"),
                    "area_m2": dim.get("area_m2"),
                    "relief_height_m": dim.get("relief_height_m"),
                    "bbox": d["bounding_box"],
                    "coordinate_frame": "WGS84" if geo else "LOCAL_TRACK_METRIC",
                }
            }
            features.append(feature)

    return {
        "type": "FeatureCollection",
        "name": "AquaSentinel_Sonar_Detections",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": features,
    }


def run_batch_test(
    input_dir: str = "Test_Data",
    output_dir: str = "outputs",
    confidence_threshold: float = 0.20,
    padding: int = 12,
    nav_file: Optional[str] = None,
    altitude: float = 8.0,
    swath_width: float = 100.0,
    heading: float = 0.0,
    save_both: bool = False,
    use_enhanced: bool = False,
    export_geojson: bool = True,
    slant_range: bool = True,
    clahe: bool = True,
    nadir_excision: bool = False,
):
    input_path = Path(input_dir).resolve()
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"❌ Error: Input directory '{input_path}' does not exist.")
        sys.exit(1)

    image_files = sorted([
        f for f in input_path.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ])

    total_images = len(image_files)
    if total_images == 0:
        print(f"⚠️ No supported images found in '{input_path}'.")
        return

    # Ingest global navigation CSV if provided
    global_nav_fixes = []
    if nav_file:
        nav_path = Path(nav_file).resolve()
        if nav_path.exists():
            global_nav_fixes = parse_nav_csv_log(nav_path)
            print(f"📡 Loaded {len(global_nav_fixes)} GPS navigation fixes from: {nav_path.name}")
        else:
            print(f"⚠️ Navigation file '{nav_file}' not found. Falling back to sidecar/local.")

    mode_label = "Both Raw & Enhanced" if save_both else ("Enhanced" if use_enhanced else "Unprocessed (Raw)")

    print("=" * 75)
    print("🌊 Aqua Sentinel — Advanced Sonar Batch Test & Physics Validation Runner")
    print("=" * 75)
    print(f"📁 Input Directory:     {input_path}")
    print(f"💾 Output Directory:    {output_path}")
    print(f"🖼️ Total Images:        {total_images}")
    print(f"🎯 Conf Threshold:      {confidence_threshold:.2f}")
    print(f"📦 Box Padding:         {padding}px")
    print(f"🎨 Output Image Canvas: {mode_label}")
    print(f"📐 Swath / Altitude:    {swath_width:.1f}m / {altitude:.1f}m")
    print(f"⚙️ DSP Pipeline:        Slant-Range={'ON' if slant_range else 'OFF'}, CLAHE={'ON' if clahe else 'OFF'}, Nadir={'ON' if nadir_excision else 'OFF'}")
    print("=" * 75)

    engine = get_inference_engine()
    all_results = []
    class_counts: Dict[str, int] = {}
    risk_counts: Dict[str, int] = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    evidence_counts: Dict[str, int] = {"SUPPORTING": 0, "NEUTRAL": 0, "ABSENT": 0}
    tier_counts: Dict[str, int] = {"FULL": 0, "PARTIAL": 0, "NONE": 0}
    total_detections_count = 0

    t_start = time.perf_counter()

    for idx, img_file in enumerate(image_files, 1):
        t0 = time.perf_counter()
        try:
            # Resolve Degradation Tier and Telemetry Fixes
            tier, telemetry = resolve_image_telemetry(
                image_path=img_file,
                global_nav_fixes=global_nav_fixes,
                default_altitude=altitude,
                default_swath=swath_width,
                default_heading=heading,
            )
            tier_counts[tier] = tier_counts.get(tier, 0) + 1

            annotated_raw_img, annotated_enhanced_img, detections, meta = process_single_image(
                image_path=img_file,
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

            # Ensure output directory exists
            output_path.mkdir(parents=True, exist_ok=True)

            # Save annotated outputs
            if save_both:
                raw_out_file = output_path / f"annotated_raw_{img_file.name}"
                enh_out_file = output_path / f"annotated_enhanced_{img_file.name}"
                cv2.imwrite(str(raw_out_file), annotated_raw_img)
                cv2.imwrite(str(enh_out_file), annotated_enhanced_img)
                primary_out = raw_out_file.name
            else:
                out_file = output_path / f"annotated_{img_file.name}"
                img_to_save = annotated_enhanced_img if use_enhanced else annotated_raw_img
                cv2.imwrite(str(out_file), img_to_save)
                primary_out = out_file.name

            elapsed = (time.perf_counter() - t0) * 1000

            # Record metrics
            total_detections_count += len(detections)
            det_summaries = []
            for d in detections:
                cls = d["target_class"]
                risk = d["hazard_risk"]
                ev = d["shadow_evidence"]
                class_counts[cls] = class_counts.get(cls, 0) + 1
                risk_counts[risk] = risk_counts.get(risk, 0) + 1
                evidence_counts[ev] = evidence_counts.get(ev, 0) + 1
                det_summaries.append(f"{cls} ({d['confidence']*100:.0f}%, {risk}, {ev[:4]})")

            summary_str = ", ".join(det_summaries) if det_summaries else "No targets detected"
            print(f"[{idx:02d}/{total_images:02d}] [{tier:<7}] {img_file.name[:28]:<28} -> {len(detections)} targets ({elapsed:4.0f}ms) | {summary_str}")

            all_results.append({
                "filename": img_file.name,
                "output_image": primary_out,
                "degradation_tier": tier,
                "dimensions": meta["dimensions"],
                "detection_count": len(detections),
                "inference_time_ms": round(elapsed, 1),
                "detections": detections,
            })

        except Exception as e:
            print(f"[{idx:02d}/{total_images:02d}] ❌ Error processing {img_file.name}: {e}")

    total_time = time.perf_counter() - t_start
    fps = total_images / max(0.001, total_time)
    avg_latency = (total_time / max(1, total_images)) * 1000

    output_path.mkdir(parents=True, exist_ok=True)

    # 1. Save Summary JSON
    json_path = output_path / "summary.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "survey_metadata": {
                "total_images": total_images,
                "total_detections": total_detections_count,
                "total_time_seconds": round(total_time, 2),
                "throughput_fps": round(fps, 2),
                "avg_latency_ms": round(avg_latency, 1),
                "confidence_threshold": confidence_threshold,
                "box_padding_px": padding,
                "altitude_m": altitude,
                "swath_width_m": swath_width,
            },
            "degradation_distribution": tier_counts,
            "class_distribution": class_counts,
            "risk_distribution": risk_counts,
            "evidence_distribution": evidence_counts,
            "results": all_results,
        }, f, indent=2)

    # 2. Save Summary CSV
    csv_path = output_path / "summary.csv"
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "image_name",
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
            "latitude",
            "longitude",
            "local_x_m",
            "local_y_m",
            "bbox_x1",
            "bbox_y1",
            "bbox_x2",
            "bbox_y2",
            "degradation_tier",
        ])
        for res in all_results:
            img_name = res["filename"]
            tier = res["degradation_tier"]
            for d in res["detections"]:
                dim = d.get("dimensions", {})
                box = d["bounding_box"]
                geo = d.get("geolocation") or {}
                local = d.get("local_offset_m") or {}
                writer.writerow([
                    img_name,
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
                    geo.get("lat", ""),
                    geo.get("lon", ""),
                    local.get("x_m", ""),
                    local.get("y_m", ""),
                    f"{box[0]:.0f}",
                    f"{box[1]:.0f}",
                    f"{box[2]:.0f}",
                    f"{box[3]:.0f}",
                    tier,
                ])

    # 3. Save GeoJSON FeatureCollection
    geojson_path = output_path / "summary.geojson"
    if export_geojson:
        geojson_data = build_geojson_feature_collection(all_results)
        with open(geojson_path, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, indent=2)

    # Console Summary Presentation
    print("\n" + "=" * 75)
    print("📊 BATCH INFERENCE & PHYSICS VALIDATION COMPLETE")
    print("=" * 75)
    print(f"⏱️ Total Execution Time: {total_time:.2f}s | Avg Latency: {avg_latency:.1f}ms/img | Throughput: {fps:.1f} FPS")
    print(f"🎯 Total Targets:        {total_detections_count} detections across {total_images} sonar frames")

    print("\n🪜 Degradation Ladder Distribution:")
    for t, cnt in tier_counts.items():
        print(f"   • {t:<10} : {cnt:3d} images")

    print("\n📦 Target Class Breakdown:")
    for cls, cnt in sorted(class_counts.items()):
        pct = (cnt / max(1, total_detections_count)) * 100
        print(f"   • {cls:<22} : {cnt:3d} ({pct:4.1f}%)")

    print("\n⚠️ Hazard Risk Distribution:")
    for risk, cnt in risk_counts.items():
        pct = (cnt / max(1, total_detections_count)) * 100
        print(f"   • {risk:<12} : {cnt:3d} ({pct:4.1f}%)")

    print("\n🔍 Acoustic Shadow Evidence Distribution:")
    for ev, cnt in evidence_counts.items():
        pct = (cnt / max(1, total_detections_count)) * 100
        print(f"   • {ev:<12} : {cnt:3d} ({pct:4.1f}%)")

    print(f"\n✅ Annotated images saved to: {output_path} (Unprocessed Sonar Canvas)")
    print(f"📄 Summary JSON:              {json_path}")
    print(f"📄 Summary CSV:               {csv_path}")
    if export_geojson:
        print(f"🗺️ Summary GeoJSON:           {geojson_path}")
    print("=" * 75)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aqua Sentinel Advanced Sonar Batch Test Runner")
    parser.add_argument("--input", "-i", default="Test_Data", help="Path to input images directory (default: Test_Data)")
    parser.add_argument("--output", "-o", default="outputs", help="Path to output directory (default: outputs)")
    parser.add_argument("--conf", "-c", type=float, default=0.20, help="Confidence threshold (default: 0.20)")
    parser.add_argument("--pad", "-p", type=int, default=12, help="Padding in pixels added around bounding boxes (default: 12)")
    parser.add_argument("--nav", default=None, help="Optional path to navigation CSV log (for WGS84 GPS mapping)")
    parser.add_argument("--altitude", type=float, default=8.0, help="Sonar altitude above seabed in meters (default: 8.0)")
    parser.add_argument("--swath", type=float, default=100.0, help="Sonar swath width in meters (default: 100.0)")
    parser.add_argument("--heading", type=float, default=0.0, help="Platform heading in degrees (default: 0.0)")
    parser.add_argument("--save-both", action="store_true", help="Save both raw and enhanced annotated images")
    parser.add_argument("--use-enhanced", action="store_true", help="Draw on enhanced image instead of raw unprocessed image")
    parser.add_argument("--no-geojson", action="store_true", help="Disable GeoJSON export")
    parser.add_argument("--no-slant", action="store_true", help="Disable Slant-Range Correction")
    parser.add_argument("--no-clahe", action="store_true", help="Disable CLAHE Equalization")
    parser.add_argument("--nadir", action="store_true", help="Enable Nadir Excision")

    args = parser.parse_args()

    run_batch_test(
        input_dir=args.input,
        output_dir=args.output,
        confidence_threshold=args.conf,
        padding=args.pad,
        nav_file=args.nav,
        altitude=args.altitude,
        swath_width=args.swath,
        heading=args.heading,
        save_both=args.save_both,
        use_enhanced=args.use_enhanced,
        export_geojson=not args.no_geojson,
        slant_range=not args.no_slant,
        clahe=not args.no_clahe,
        nadir_excision=args.nadir,
    )
