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


def apply_cross_tile_nms(
    detections: List[Dict[str, Any]],
    iou_threshold: float = 0.45
) -> List[Dict[str, Any]]:
    """
    Applies Cross-Tile Non-Maximum Suppression across merged detections.
    """
    if not detections:
        return []

    # Sort descending by confidence
    sorted_dets = sorted(detections, key=lambda x: x.get("confidence_ai", 0.0), reverse=True)
    kept = []

    while sorted_dets:
        current = sorted_dets.pop(0)
        kept.append(current)

        remaining = []
        for other in sorted_dets:
            # Same class or general overlap
            iou = _compute_iou(current, other)
            if iou < iou_threshold:
                remaining.append(other)
        sorted_dets = remaining

    return kept


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
