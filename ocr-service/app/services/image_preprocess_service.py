from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np


def preprocess_image(image_path: Path, temp_dir: Path):
    image = cv2.imread(str(image_path))
    if image is None:
        return None

    processed = _resize_if_small(image)
    gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
    gray = cv2.fastNlMeansDenoising(gray, None, 12, 7, 21)
    gray = _deskew(gray)
    gray = _enhance_contrast(gray)

    threshold = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    output_path = Path(temp_dir) / f"preprocessed-{uuid4().hex}.png"
    cv2.imwrite(str(output_path), threshold)
    return output_path


def _resize_if_small(image):
    height, width = image.shape[:2]
    if width >= 1400:
        return image

    scale = min(2.0, 1400 / max(width, 1))
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def _enhance_contrast(gray):
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _deskew(gray):
    coords = np.column_stack(np.where(gray < 245))
    if len(coords) < 50:
        return gray

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.5 or abs(angle) > 12:
        return gray

    height, width = gray.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        gray,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
