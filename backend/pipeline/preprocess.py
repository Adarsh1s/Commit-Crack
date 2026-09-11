"""
backend/pipeline/preprocess.py
AquaSentinel AI - Sonar Signal Preprocessing Pipeline
Applies water-column excision, empirical gain normalization across the swath, and CLAHE.
"""
from typing import Tuple
import numpy as np
import cv2


def preprocess_sonar_image(
    image: np.ndarray,
    remove_water_column: bool = True,
    nadir_width_ratio: float = 0.05,
    apply_clahe: bool = True,
    clahe_clip_limit: float = 2.5,
    clahe_grid_size: Tuple[int, int] = (8, 8),
    apply_gain_normalization: bool = True
) -> np.ndarray:
    """
    Standard preprocessing pipeline for Side-Scan & Multibeam Sonar imagery.
    Operates on grayscale or RGB acoustic waterfalls/tiles.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        is_color = True
    else:
        gray = image.copy()
        is_color = False

    h, w = gray.shape

    # 1. Water-column excision / nadir blanking
    if remove_water_column and nadir_width_ratio > 0.0:
        mid_x = w // 2
        nadir_half_width = int((w * nadir_width_ratio) / 2)
        x_start = max(0, mid_x - nadir_half_width)
        x_end = min(w, mid_x + nadir_half_width)
        # Attenuate water column intensity (simulate excision/blanking)
        gray[:, x_start:x_end] = (gray[:, x_start:x_end] * 0.1).astype(np.uint8)

    # 2. Empirical Swath Gain Normalization (EGN)
    if apply_gain_normalization:
        # Compute mean intensity per column across the swath
        col_means = np.mean(gray.astype(np.float32), axis=0) + 1e-5
        overall_mean = np.mean(col_means)
        gain_curve = overall_mean / col_means
        # Smooth gain curve with 1D Gaussian kernel to avoid high-frequency striping
        gain_curve_smoothed = cv2.GaussianBlur(gain_curve.reshape(1, -1), (15, 1), 3.0).flatten()
        # Apply gain curve across columns
        normalized = gray.astype(np.float32) * gain_curve_smoothed
        gray = np.clip(normalized, 0, 255).astype(np.uint8)

    # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    if apply_clahe:
        clahe = cv2.createCLAHE(clipLimit=clahe_clip_limit, tileGridSize=clahe_grid_size)
        gray = clahe.apply(gray)

    if is_color:
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    return gray
