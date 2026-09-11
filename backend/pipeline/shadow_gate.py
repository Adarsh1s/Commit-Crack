"""
backend/pipeline/shadow_gate.py
AquaSentinel AI - Acoustic Shadow Verification Engine
Inspects expected down-range acoustic shadow region in the sonar propagation direction.
Acts as an evidence rater (SUPPORTING, NEUTRAL, ABSENT).
"""
from typing import Dict, Any, Optional
import numpy as np
import cv2


def verify_acoustic_shadow(
    image: np.ndarray,
    detection: Dict[str, Any],
    nadir_x: Optional[int] = None,
    altitude_m: Optional[float] = None,
    meters_per_pixel: float = 0.05
) -> Dict[str, Any]:
    """
    Evaluates acoustic shadow evidence behind a candidate target.

    Evidence States:
    - SUPPORTING: Shadow distinctly detected down-range -> boosts confidence & calculates relief height.
    - NEUTRAL: Shadow region ambiguous or noisy -> retains visual confidence.
    - ABSENT: Clear seafloor highlight where shadow is expected but missing -> soft penalty.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    h, w = gray.shape
    if nadir_x is None:
        nadir_x = w // 2

    x_min = max(0, detection["x_min"])
    y_min = max(0, detection["y_min"])
    x_max = min(w, detection["x_max"])
    y_max = min(h, detection["y_max"])
    target_w = max(1, x_max - x_min)
    target_h = max(1, y_max - y_min)

    # Determine propagation direction
    # Starboard (right of nadir): sound travels left-to-right -> shadow to right
    # Port (left of nadir): sound travels right-to-left -> shadow to left
    target_cx = (x_min + x_max) // 2
    is_starboard = (target_cx >= nadir_x)

    max_shadow_search_px = min(w // 4, max(40, target_w * 3))

    if is_starboard:
        shadow_x1 = x_max
        shadow_x2 = min(w, x_max + max_shadow_search_px)
    else:
        shadow_x1 = max(0, x_min - max_shadow_search_px)
        shadow_x2 = x_min

    shadow_y1 = max(0, y_min - 5)
    shadow_y2 = min(h, y_max + 5)

    shadow_crop = gray[shadow_y1:shadow_y2, shadow_x1:shadow_x2]
    target_crop = gray[y_min:y_max, x_min:x_max]

    # Reference seabed backscatter in adjacent area
    ref_y1 = max(0, y_min - 20)
    ref_y2 = min(h, y_max + 20)
    ref_x1 = max(0, x_min - 20)
    ref_x2 = min(w, x_max + 20)
    ref_seabed = gray[ref_y1:ref_y2, ref_x1:ref_x2]

    mean_seabed = float(np.mean(ref_seabed)) + 1e-5
    mean_target = float(np.mean(target_crop)) if target_crop.size > 0 else 0.0

    if shadow_crop.size == 0:
        return {
            "evidence": "NEUTRAL",
            "review_status": "UNVERIFIED",
            "shadow_contrast": 0.0,
            "relief_height_m": 0.5,
            "shadow_bbox": None,
            "confidence_adjusted": detection.get("confidence_ai", 0.75)
        }

    mean_shadow = float(np.mean(shadow_crop))
    shadow_contrast = max(0.0, min(1.0, 1.0 - (mean_shadow / mean_seabed)))

    # Estimate physical shadow length
    shadow_mask = (shadow_crop < (mean_seabed * 0.55))
    col_has_shadow = np.any(shadow_mask, axis=0)
    if not is_starboard:
        col_has_shadow = col_has_shadow[::-1]

    shadow_length_px = 0
    for has_shadow in col_has_shadow:
        if has_shadow:
            shadow_length_px += 1
        else:
            if shadow_length_px > 5:
                break

    # Relief height calculation: H = (L_shadow * Altitude) / (R_slant + L_shadow)
    relief_height_m = None
    if altitude_m and altitude_m > 0 and shadow_length_px > 0:
        slant_range_px = abs(target_cx - nadir_x)
        if (slant_range_px + shadow_length_px) > 0:
            h_est = (shadow_length_px * altitude_m) / (slant_range_px + shadow_length_px)
            relief_height_m = round(float(h_est), 2)
    else:
        # Physical proxy using shadow length in meters
        relief_height_m = round(max(0.3, shadow_length_px * meters_per_pixel * 0.8), 2)

    shadow_bbox = [shadow_x1, shadow_y1, shadow_x2, shadow_y2]

    conf_ai = detection.get("confidence_ai", 0.75)
    if shadow_contrast > 0.35 and shadow_length_px >= 3:
        evidence = "SUPPORTING"
        review_status = "VERIFIED_3D"
        conf_adj = min(0.98, conf_ai + 0.12)
    elif shadow_contrast < 0.15 and (mean_target > mean_seabed * 1.5):
        evidence = "ABSENT"
        review_status = "FLAGGED_FOR_REVIEW"
        conf_adj = max(0.20, conf_ai - 0.15)
    else:
        evidence = "NEUTRAL"
        review_status = "UNVERIFIED"
        conf_adj = conf_ai

    return {
        "evidence": evidence,
        "review_status": review_status,
        "shadow_contrast": round(shadow_contrast, 3),
        "relief_height_m": relief_height_m or 0.5,
        "shadow_bbox": shadow_bbox,
        "confidence_adjusted": round(conf_adj, 4)
    }
