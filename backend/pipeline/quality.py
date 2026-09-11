"""
backend/pipeline/quality.py
AquaSentinel AI - Acoustic Imagery Quality Assessment Gate
"""
from typing import Dict, Any
import numpy as np
import cv2


def assess_image_quality(image: np.ndarray) -> Dict[str, Any]:
    """
    Evaluates contrast, blur (Laplacian variance), and signal-to-noise ratio (SNR).
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # 1. Blur via Laplacian variance
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

    # 2. Contrast via standard deviation
    std_dev = float(np.std(gray))

    # 3. Dynamic range / SNR proxy
    p95 = np.percentile(gray, 95)
    p05 = np.percentile(gray, 5)
    dynamic_range = float(p95 - p05)

    is_usable = (laplacian_var > 15.0) and (std_dev > 10.0)

    quality_grade = "GOOD"
    if not is_usable:
        quality_grade = "POOR"
    elif laplacian_var < 50.0 or std_dev < 20.0:
        quality_grade = "FAIR"

    return {
        "is_usable": is_usable,
        "quality_grade": quality_grade,
        "laplacian_var": round(laplacian_var, 2),
        "std_dev": round(std_dev, 2),
        "dynamic_range": round(dynamic_range, 2)
    }
