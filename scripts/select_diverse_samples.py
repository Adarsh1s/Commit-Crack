# scripts/select_diverse_samples.py
"""
Deduplicate and sample 100 distinct, non-similar sonar images from source dataset.
Uses Perceptual Difference Hashing (dHash), sequence stem filtering, and cosine/correlation distance.
"""

import os
import shutil
import hashlib
import random
import cv2
import numpy as np
from PIL import Image

SRC_DIR = r"D:\Projects\Test Data SIH 26"
DST_DIR = r"d:\Projects\SIH_2026_Final\test_heatmap"
TARGET_COUNT = 100

def get_dhash(img_path, hash_size=16):
    """Computes a difference hash (dHash) for an image."""
    try:
        with Image.open(img_path) as img:
            img = img.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.BILINEAR)
            pixels = np.array(img, dtype=np.float32)
            # Compare adjacent pixels
            diff = pixels[:, 1:] > pixels[:, :-1]
            return diff.flatten()
    except Exception as e:
        return None

def get_small_repr(img_path, size=32):
    """Computes normalized downscaled representation for correlation check."""
    try:
        with Image.open(img_path) as img:
            img = img.convert('L').resize((size, size), Image.Resampling.BILINEAR)
            arr = np.array(img, dtype=np.float32)
            std = np.std(arr)
            if std > 1e-5:
                arr = (arr - np.mean(arr)) / std
            return arr.flatten()
    except Exception:
        return None

def hamming_distance(h1, h2):
    return np.sum(h1 != h2)

def cosine_similarity(v1, v2):
    denom = (np.linalg.norm(v1) * np.linalg.norm(v2))
    if denom == 0:
        return 0.0
    return np.dot(v1, v2) / denom

def get_sequence_prefix(filename):
    """Extracts base survey sequence prefix to avoid selecting consecutive frames."""
    # Examples: baycove_07_06_png_jpg.rf.xxxx -> baycove_07
    # 0001_2010.jpg -> 0001
    parts = filename.split('_')
    if len(parts) >= 2:
        return f"{parts[0]}_{parts[1]}"
    return parts[0]

def main():
    print(f"Scanning source directory: {SRC_DIR}...")
    all_candidates = []
    
    # Collect all image files grouped by folder for balanced representation
    folder_map = {}
    for root, _, files in os.walk(SRC_DIR):
        valid_files = [
            os.path.join(root, f) for f in files 
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'))
        ]
        if valid_files:
            folder_map[root] = valid_files
            print(f"  Found {len(valid_files)} images in: {root}")

    # Interleave / shuffle candidates from diverse folders
    random.seed(42)
    for folder, file_list in folder_map.items():
        random.shuffle(file_list)
        all_candidates.append(file_list)

    # Round-robin selection pool
    interleaved_candidates = []
    max_len = max(len(fl) for fl in all_candidates)
    for i in range(max_len):
        for fl in all_candidates:
            if i < len(fl):
                interleaved_candidates.append(fl[i])

    print(f"\nTotal candidate images assembled: {len(interleaved_candidates)}")
    print("Filtering exact duplicates, similar images, and consecutive sequence frames...\n")

    selected_paths = []
    selected_md5s = set()
    selected_dhashes = []
    selected_reprs = []
    selected_stems = {}

    for path in interleaved_candidates:
        if len(selected_paths) >= TARGET_COUNT:
            break

        filename = os.path.basename(path)
        stem = get_sequence_prefix(filename)

        # 1. Limit max images per sequence stem to ensure visual variety (max 2 per sequence stem)
        if selected_stems.get(stem, 0) >= 2:
            continue

        # 2. Check MD5 hash (exact duplicate check)
        try:
            with open(path, 'rb') as f:
                file_md5 = hashlib.md5(f.read()).hexdigest()
        except Exception:
            continue

        if file_md5 in selected_md5s:
            continue

        # 3. Compute perceptual difference hash (dHash 16x16 = 256 bits)
        dhash = get_dhash(path, hash_size=16)
        if dhash is None:
            continue

        # 4. Compute downscaled representation
        s_repr = get_small_repr(path, size=32)
        if s_repr is None:
            continue

        # 5. Similarity check against already selected images
        is_similar = False
        for prev_dhash, prev_repr in zip(selected_dhashes, selected_reprs):
            h_dist = hamming_distance(dhash, prev_dhash)
            # 256-bit dhash: distance <= 35 (~13.6% diff) means very high similarity
            if h_dist <= 35:
                is_similar = True
                break

            # Correlation check on normalized texture
            sim = cosine_similarity(s_repr, prev_repr)
            if sim > 0.88:
                is_similar = True
                break

        if is_similar:
            continue

        # Accept image
        selected_paths.append(path)
        selected_md5s.add(file_md5)
        selected_dhashes.append(dhash)
        selected_reprs.append(s_repr)
        selected_stems[stem] = selected_stems.get(stem, 0) + 1

    print(f"Selection complete! Selected {len(selected_paths)} uniquely distinct images.")

    # Re-create destination directory
    if os.path.exists(DST_DIR):
        shutil.rmtree(DST_DIR)
    os.makedirs(DST_DIR, exist_ok=True)

    print(f"Copying {len(selected_paths)} deduplicated images to {DST_DIR}...")
    for idx, img_path in enumerate(selected_paths):
        filename = os.path.basename(img_path)
        dst_path = os.path.join(DST_DIR, filename)
        if os.path.exists(dst_path):
            name, ext = os.path.splitext(filename)
            dst_path = os.path.join(DST_DIR, f"{name}_{idx}{ext}")
        shutil.copy2(img_path, dst_path)

    copied_files = os.listdir(DST_DIR)
    print(f" Successfully populated {len(copied_files)} unique, non-duplicate images in {DST_DIR}")

if __name__ == "__main__":
    main()
