from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.config import get_settings


settings = get_settings()


@lru_cache(maxsize=1)
def get_ocr_engine():
    from paddleocr import PaddleOCR

    device = "gpu" if settings.use_gpu else "cpu"
    return PaddleOCR(
        lang=settings.ocr_lang,
        device=device,
        enable_mkldnn=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
    )


def recognize_image(image_path: Path):
    engine = get_ocr_engine()
    raw_result = engine.predict(str(image_path))
    lines = _normalize_paddle_result(raw_result)
    return _sort_lines(lines)


def run_ocr_with_fallback(original_path: Path, preprocessed_path: Optional[Path]):
    original_lines = recognize_image(original_path)

    if not preprocessed_path or not preprocessed_path.exists():
        return original_lines

    if _line_score(original_lines) >= 250:
        return original_lines

    processed_lines = recognize_image(preprocessed_path)
    return processed_lines if _line_score(processed_lines) >= _line_score(original_lines) else original_lines


def _normalize_paddle_result(raw_result):
    rows = []

    if not raw_result:
        return rows

    if isinstance(raw_result, list) and len(raw_result) == 1 and isinstance(raw_result[0], list):
        candidates = raw_result[0]
    else:
        candidates = raw_result

    for item in candidates or []:
        if hasattr(item, "keys"):
            rows.extend(_parse_ocr_result(item))
            continue

        parsed = _parse_line(item)
        if parsed:
            rows.append(parsed)

    return rows


def _parse_ocr_result(result):
    texts = list(result.get("rec_texts", []) or [])
    scores = list(result.get("rec_scores", []) or [])
    polygons = result.get("rec_polys", None)
    if polygons is None:
        polygons = result.get("dt_polys", None)
    if polygons is None:
        polygons = []
    rows = []

    for index, text in enumerate(texts):
        confidence = scores[index] if index < len(scores) else 0
        bbox = polygons[index] if index < len(polygons) else []
        parsed = _clean_line(text, confidence, bbox)
        if parsed:
            rows.append(parsed)

    return rows


def _parse_line(item):
    if isinstance(item, dict):
        text = item.get("text") or item.get("rec_text") or ""
        confidence = item.get("confidence") or item.get("score") or item.get("rec_score") or 0
        bbox = item.get("bbox") or item.get("points") or item.get("dt_polys") or []
        return _clean_line(text, confidence, bbox)

    if not isinstance(item, (list, tuple)) or len(item) < 2:
        return None

    bbox = item[0]
    text_part = item[1]

    if isinstance(text_part, (list, tuple)) and len(text_part) >= 2:
        text, confidence = text_part[0], text_part[1]
    else:
        text, confidence = str(text_part), 0

    return _clean_line(text, confidence, bbox)


def _clean_line(text, confidence, bbox):
    clean_text = " ".join(str(text or "").split())
    if not clean_text:
        return None

    return {
        "text": clean_text,
        "confidence": round(float(confidence or 0), 4),
        "bbox": _clean_bbox(bbox),
    }


def _clean_bbox(bbox):
    points = []
    if bbox is None:
        return points

    for point in bbox:
        try:
            if len(point) >= 2:
                points.append([float(point[0]), float(point[1])])
        except (TypeError, ValueError):
            continue

    return points[:4]


def _sort_lines(lines):
    return sorted(lines, key=lambda line: (_top(line.get("bbox", [])), _left(line.get("bbox", []))))


def _top(bbox):
    return min((point[1] for point in bbox), default=0)


def _left(bbox):
    return min((point[0] for point in bbox), default=0)


def _line_score(lines):
    text_length = sum(len(line.get("text", "")) for line in lines)
    confidence = sum(float(line.get("confidence") or 0) for line in lines)
    return text_length + confidence * 10
