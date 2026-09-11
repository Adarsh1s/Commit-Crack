"""
backend/pipeline/tiling.py
AquaSentinel AI - Adaptive Swath Tiling & Cross-Tile Non-Maximum Suppression
"""
from typing import List, Tuple, Dict, Any
import numpy as np


def generate_tiles(
    image: np.ndarray,
    tile_size: int = 640,
    overlap_ratio: float = 0.15
) -> List[Tuple[np.ndarray, int, int]]:
    """
    Generates overlapping tiles for inference across large sonar swaths.
    Returns list of (tile_crop, global_x_offset, global_y_offset).
    """
    h, w = image.shape[:2]

    # If image is small enough, no tiling needed
    if h <= tile_size and w <= tile_size:
        return [(image, 0, 0)]

    stride = int(tile_size * (1.0 - overlap_ratio))
    tiles = []

    y_offsets = list(range(0, max(1, h - tile_size + 1), stride))
    if not y_offsets or y_offsets[-1] + tile_size < h:
        y_offsets.append(max(0, h - tile_size))

    x_offsets = list(range(0, max(1, w - tile_size + 1), stride))
    if not x_offsets or x_offsets[-1] + tile_size < w:
        x_offsets.append(max(0, w - tile_size))

    # Deduplicate offsets
    y_offsets = sorted(list(set(y_offsets)))
    x_offsets = sorted(list(set(x_offsets)))

    for y in y_offsets:
        for x in x_offsets:
            crop = image[y:y+tile_size, x:x+tile_size]
            tiles.append((crop, x, y))

    return tiles


def map_detections_to_global(
    tile_detections: List[Dict[str, Any]],
    x_offset: int,
    y_offset: int
) -> List[Dict[str, Any]]:
    """
    Remaps detection bounding box and polygon coordinates from local tile space to full survey space.
    """
    global_dets = []
    for d in tile_detections:
        d_copy = dict(d)
        d_copy["x_min"] = d["x_min"] + x_offset
        d_copy["y_min"] = d["y_min"] + y_offset
        d_copy["x_max"] = d["x_max"] + x_offset
        d_copy["y_max"] = d["y_max"] + y_offset

        if "polygon" in d and d["polygon"]:
            # Polygon is [x1, y1, x2, y2, ...]
            poly = d["polygon"]
            remapped_poly = []
            for i in range(0, len(poly), 2):
                remapped_poly.append(poly[i] + x_offset)
                if i + 1 < len(poly):
                    remapped_poly.append(poly[i + 1] + y_offset)
            d_copy["polygon"] = remapped_poly

        global_dets.append(d_copy)
    return global_dets


def apply_weighted_box_fusion(
    detections: List[Dict[str, Any]],
    iou_threshold: float = 0.45
) -> List[Dict[str, Any]]:
    """
    Applies Weighted Box Fusion (WBF) across multi-pass, multi-tile, and TTA detections.
    Fuses spatial coordinates weighted by AI confidence and boosts consensus scores.
    """
    if not detections:
        return []

    # Sort descending by AI confidence
    sorted_dets = sorted(detections, key=lambda x: x.get("confidence_ai", 0.0), reverse=True)
    clusters: List[List[Dict[str, Any]]] = []

    for det in sorted_dets:
        matched = False
        for cluster in clusters:
            # Check overlap with cluster representative (first/highest conf detection)
            rep = cluster[0]
            # Prioritize matching same class, or allow compatible general overlap
            same_class = (det.get("class_id") == rep.get("class_id"))
            iou = _compute_iou(det, rep)

            if (same_class and iou >= iou_threshold) or (iou >= max(0.60, iou_threshold + 0.15)):
                cluster.append(det)
                matched = True
                break

        if not matched:
            clusters.append([det])

    fused_results = []
    for cluster in clusters:
        if len(cluster) == 1:
            fused_results.append(cluster[0])
            continue

        # Weighted spatial coordinate fusion
        weights = [max(0.1, d.get("confidence_ai", 0.5)) for d in cluster]
        total_w = sum(weights)

        fused_xmin = sum(d["x_min"] * w for d, w in zip(cluster, weights)) / total_w
        fused_ymin = sum(d["y_min"] * w for d, w in zip(cluster, weights)) / total_w
        fused_xmax = sum(d["x_max"] * w for d, w in zip(cluster, weights)) / total_w
        fused_ymax = sum(d["y_max"] * w for d, w in zip(cluster, weights)) / total_w

        # Take primary class from highest confidence candidate in cluster
        best_candidate = cluster[0]
        max_conf = best_candidate.get("confidence_ai", 0.75)
        # Consensus boost: multi-pass agreement increases detection certainty
        consensus_bonus = min(0.10, 0.03 * (len(cluster) - 1))
        fused_conf = min(0.99, max_conf + consensus_bonus)

        fused_item = dict(best_candidate)
        fused_item["x_min"] = int(round(fused_xmin))
        fused_item["y_min"] = int(round(fused_ymin))
        fused_item["x_max"] = int(round(fused_xmax))
        fused_item["y_max"] = int(round(fused_ymax))
        fused_item["confidence_ai"] = round(fused_conf, 4)

        fused_results.append(fused_item)

    return fused_results


def apply_cross_tile_nms(
    detections: List[Dict[str, Any]],
    iou_threshold: float = 0.45
) -> List[Dict[str, Any]]:
    """
    Applies Weighted Box Fusion across multi-scale / multi-tile detections.
    """
    return apply_weighted_box_fusion(detections, iou_threshold=iou_threshold)


def _compute_iou(d1: Dict[str, Any], d2: Dict[str, Any]) -> float:
    x1 = max(d1["x_min"], d2["x_min"])
    y1 = max(d1["y_min"], d2["y_min"])
    x2 = min(d1["x_max"], d2["x_max"])
    y2 = min(d1["y_max"], d2["y_max"])

    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter_area = inter_w * inter_h

    if inter_area == 0:
        return 0.0

    area1 = (d1["x_max"] - d1["x_min"]) * (d1["y_max"] - d1["y_min"])
    area2 = (d2["x_max"] - d2["x_min"]) * (d2["y_max"] - d2["y_min"])
    union_area = float(area1 + area2 - inter_area)

    return inter_area / union_area if union_area > 0 else 0.0
