"""
backend/input_normalizer.py
AquaSentinel AI - Multi-format Sonar Image Normalizer
"""
from dataclasses import dataclass
from typing import Optional
import io
import cv2
import numpy as np
from PIL import Image, ImageFile, ImageOps

ImageFile.LOAD_TRUNCATED_IMAGES = True


@dataclass
class NormalizedSurveyInput:
    image_bgr: np.ndarray
    original_width: int
    original_height: int
    channels: int
    is_multipage: bool = False


def normalize_input_sources(file_bytes: bytes, filename: str = "sonar.png") -> NormalizedSurveyInput:
    """
    Decodes raw uploaded file bytes into a normalized 8-bit BGR OpenCV numpy array.
    Supports PNG, JPG, WebP, TIFF (8-bit and 16-bit), BMP, and PBM.
    """
    img_bgr = None

    # 1. Try OpenCV direct decode
    try:
        nparr = np.frombuffer(file_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    except Exception:
        img_bgr = None

    # 2. Try PIL decode if OpenCV failed or for 16-bit / multi-channel TIFFs
    if img_bgr is None:
        try:
            pil_img = Image.open(io.BytesIO(file_bytes))
            pil_img = ImageOps.exif_transpose(pil_img)

            if pil_img.mode in ("I;16", "I", "F"):
                # 16-bit or float sonar depth scan -> normalized 8-bit
                arr = np.array(pil_img, dtype=np.float32)
                p02 = np.percentile(arr, 2)
                p98 = np.percentile(arr, 98)
                if p98 > p02:
                    arr = np.clip((arr - p02) / (p98 - p02) * 255.0, 0, 255).astype(np.uint8)
                else:
                    arr = np.clip(arr, 0, 255).astype(np.uint8)
                img_bgr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
            elif pil_img.mode == "RGBA":
                rgb = pil_img.convert("RGB")
                img_bgr = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
            elif pil_img.mode == "L":
                gray = np.array(pil_img)
                img_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
            else:
                rgb = pil_img.convert("RGB")
                img_bgr = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Could not decode image stream: {e}")

    if img_bgr is None or img_bgr.size == 0:
        raise ValueError("Decoded image buffer is empty or corrupted.")

    # 3. Ensure 8-bit BGR
    if img_bgr.dtype != np.uint8:
        arr = img_bgr.astype(np.float32)
        arr = (arr - arr.min()) / max(1.0, (arr.max() - arr.min())) * 255.0
        img_bgr = arr.astype(np.uint8)

    if len(img_bgr.shape) == 2:
        img_bgr = cv2.cvtColor(img_bgr, cv2.COLOR_GRAY2BGR)
    elif img_bgr.shape[2] == 4:
        img_bgr = cv2.cvtColor(img_bgr, cv2.COLOR_BGRA2BGR)

    h, w = img_bgr.shape[:2]
    return NormalizedSurveyInput(
        image_bgr=img_bgr,
        original_width=w,
        original_height=h,
        channels=3,
        is_multipage=False
    )
