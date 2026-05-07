# SS360 OCR Service

This service is a free local OCR engine for SS360 ERP invoice intake. It uses FastAPI, PaddleOCR, OpenCV, PyMuPDF, Pillow, and NumPy. It does not call paid APIs or cloud OCR services.

## Setup

Windows/macOS/Linux:

```bash
cd ocr-service
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

## Endpoints

- `GET /health`
- `POST /ocr/extract` with multipart field `file` and optional `document_type`
- `POST /ocr/raw` with multipart field `file`
- `POST /ocr/parse-text` with JSON `{ "rawText": "..." }`

## Expected Local URLs

- OCR service: `http://localhost:8001`
- OCR health: `http://localhost:8001/health`

The service writes temporary page images and preprocessed files under `temp/`. These runtime files are ignored by Git.
