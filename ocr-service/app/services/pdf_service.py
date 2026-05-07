from pathlib import Path
from uuid import uuid4

import fitz


DUPLICATE_PAGE_MARKERS = (
    "DUPLICATE FOR TRANSPORTER",
    "TRIPLICATE",
    "EXTRA COPY",
)


def convert_pdf_to_images(pdf_path: Path, temp_dir: Path, zoom: float = 2.5):
    document = fitz.open(str(pdf_path))
    pages = []
    saw_original = False

    try:
        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            page_text = (page.get_text("text") or "").upper()
            is_duplicate = any(marker in page_text for marker in DUPLICATE_PAGE_MARKERS)

            if is_duplicate and saw_original:
                continue

            if not is_duplicate:
                saw_original = True

            matrix = fitz.Matrix(zoom, zoom)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            output_path = Path(temp_dir) / f"pdf-page-{page_index + 1}-{uuid4().hex}.png"
            pixmap.save(str(output_path))
            pages.append({"pageNumber": page_index + 1, "path": str(output_path)})
    finally:
        document.close()

    return pages


def extract_pdf_text_pages(pdf_path: Path):
    document = fitz.open(str(pdf_path))
    pages = []
    saw_original = False

    try:
        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            page_text = (page.get_text("text") or "").strip()
            upper_text = page_text.upper()
            is_duplicate = any(marker in upper_text for marker in DUPLICATE_PAGE_MARKERS)

            if is_duplicate and saw_original:
                continue

            if not is_duplicate:
                saw_original = True

            pages.append(
                {
                    "pageNumber": page_index + 1,
                    "text": page_text,
                    "lines": _extract_text_lines(page),
                    "engine": "PyMuPDF embedded text",
                }
            )
    finally:
        document.close()

    return pages


def has_usable_pdf_text(pages):
    raw_text = "\n".join(page.get("text", "") for page in pages).strip()
    upper_text = raw_text.upper()
    return len(raw_text) >= 120 and any(
        keyword in upper_text
        for keyword in ("TAX INVOICE", "PROFORMA INVOICE", "GSTIN", "HSN/SAC", "INVOICE NO")
    )


def _extract_text_lines(page):
    rows = []

    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            spans = [span.get("text", "") for span in line.get("spans", [])]
            text = " ".join(" ".join(spans).split())
            if not text:
                continue

            x1, y1, x2, y2 = line.get("bbox", [0, 0, 0, 0])
            rows.append(
                {
                    "text": text,
                    "confidence": 1.0,
                    "bbox": [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
                }
            )

    return sorted(rows, key=lambda row: (_top(row["bbox"]), _left(row["bbox"])))


def _top(bbox):
    return min((point[1] for point in bbox), default=0)


def _left(bbox):
    return min((point[0] for point in bbox), default=0)
