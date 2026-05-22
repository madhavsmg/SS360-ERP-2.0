from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import get_settings
from app.services.image_preprocess_service import preprocess_image
from app.services.invoice_parser_service import parse_invoice_text
from app.services.invoice_validation_service import validate_invoice
from app.services.paddle_ocr_service import run_ocr_with_fallback
from app.services.pdf_service import convert_pdf_to_images, extract_pdf_text_pages, has_usable_pdf_text
from app.utils.file_utils import cleanup_paths, is_supported_upload_metadata, save_upload_file


router = APIRouter()
settings = get_settings()


class ParseTextRequest(BaseModel):
    rawText: str


@router.post("/ocr/extract")
async def extract_ocr(
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(default=None),
):
    if not is_supported_upload_metadata(file):
        raise HTTPException(status_code=400, detail="Supported files are pdf, png, jpg, and jpeg.")

    saved_path = await save_upload_file(file, settings.temp_dir, settings.max_upload_bytes)
    generated_paths = []

    try:
        embedded_pages = _extract_embedded_pdf_pages(saved_path)
        if embedded_pages:
            return _build_extract_response(file.filename, embedded_pages, document_type)

        image_pages = _build_image_pages(saved_path)
        generated_paths.extend([Path(page["path"]) for page in image_pages if page["path"] != str(saved_path)])
        pages = []

        for page_index, page in enumerate(image_pages, start=1):
            original_path = Path(page["path"])
            preprocessed_path = preprocess_image(original_path, settings.temp_dir)
            if preprocessed_path:
                generated_paths.append(preprocessed_path)

            lines = run_ocr_with_fallback(original_path, preprocessed_path)
            page_text = "\n".join(line["text"] for line in lines).strip()
            pages.append(
                {
                    "pageNumber": page.get("pageNumber", page_index),
                    "text": page_text,
                    "lines": lines,
                    "engine": "PaddleOCR",
                }
            )

        return _build_extract_response(file.filename, pages, document_type)
    finally:
        cleanup_paths([saved_path, *generated_paths])


@router.post("/ocr/raw")
async def raw_ocr(file: UploadFile = File(...)):
    if not is_supported_upload_metadata(file):
        raise HTTPException(status_code=400, detail="Supported files are pdf, png, jpg, and jpeg.")

    saved_path = await save_upload_file(file, settings.temp_dir, settings.max_upload_bytes)
    generated_paths = []

    try:
        embedded_pages = _extract_embedded_pdf_pages(saved_path)
        if embedded_pages:
            return {
                "success": True,
                "sourceFileName": file.filename or "",
                "pageCount": len(embedded_pages),
                "pages": embedded_pages,
            }

        image_pages = _build_image_pages(saved_path)
        generated_paths.extend([Path(page["path"]) for page in image_pages if page["path"] != str(saved_path)])
        pages = []

        for page_index, page in enumerate(image_pages, start=1):
            original_path = Path(page["path"])
            preprocessed_path = preprocess_image(original_path, settings.temp_dir)
            if preprocessed_path:
                generated_paths.append(preprocessed_path)

            lines = run_ocr_with_fallback(original_path, preprocessed_path)
            pages.append(
                {
                    "pageNumber": page.get("pageNumber", page_index),
                    "text": "\n".join(line["text"] for line in lines).strip(),
                    "lines": lines,
                    "engine": "PaddleOCR",
                }
            )

        return {
            "success": True,
            "sourceFileName": file.filename or "",
            "pageCount": len(pages),
            "pages": pages,
        }
    finally:
        cleanup_paths([saved_path, *generated_paths])


@router.post("/ocr/parse-text")
async def parse_text(payload: ParseTextRequest):
    invoice = parse_invoice_text(payload.rawText, [], document_type=None)
    invoice = validate_invoice(invoice)

    return {
        "success": True,
        "rawText": payload.rawText,
        "invoice": invoice,
    }


def _build_image_pages(saved_path: Path):
    if saved_path.suffix.lower() == ".pdf":
        return convert_pdf_to_images(saved_path, settings.temp_dir, zoom=2.5)

    return [{"pageNumber": 1, "path": str(saved_path)}]


def _extract_embedded_pdf_pages(saved_path: Path):
    if saved_path.suffix.lower() != ".pdf":
        return None

    pages = extract_pdf_text_pages(saved_path)
    return pages if has_usable_pdf_text(pages) else None


def _build_extract_response(source_file_name, pages, document_type):
    raw_text = "\n".join(page["text"] for page in pages if page["text"]).strip()
    invoice = parse_invoice_text(raw_text, _flatten_lines(pages), document_type=document_type)
    invoice = validate_invoice(invoice)

    return {
        "success": True,
        "sourceFileName": source_file_name or "",
        "pageCount": len(pages),
        "rawText": raw_text,
        "pages": pages,
        "invoice": invoice,
        "engine": pages[0].get("engine", "PaddleOCR") if pages else "PaddleOCR",
    }


def _flatten_lines(pages):
    all_lines = []
    for page in pages:
        for line in page.get("lines", []):
            all_lines.append({**line, "pageNumber": page.get("pageNumber")})
    return all_lines
