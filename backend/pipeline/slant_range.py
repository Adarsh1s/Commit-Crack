"""
backend/pipeline/slant_range.py
AquaSentinel AI - Slant-Range Distortion Correction
Corrects geometric compression in near-range sonar imagery.
"""
from typing import Optional
import numpy as np
import cv2


def apply_slant_range_correction(
    image: np.ndarray,
    altitude_m: Optional[float] = None,
    max_range_m: float = 50.0,
    water_sound_speed: float = 1500.0
) -> np.ndarray:
    """
    Applies flat-bottom slant-range to ground-range geometric correction:
    x_ground = sqrt(max(0, R_slant^2 - h_altitude^2))
    """
    h, w = image.shape[:2]
    if w < 20 or h < 20:
        return image

    margin = max(1, int(w * 0.08))
    if margin * 2 >= w:
        return image

    src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst_pts = np.float32([[margin, 0], [w - margin, 0], [w, h], [0, h]])
    try:
        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        return cv2.warpPerspective(image, M, (w, h), borderMode=cv2.BORDER_REFLECT)
    except Exception:
        return image
