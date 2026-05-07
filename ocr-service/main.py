from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.ocr_routes import router as ocr_router
from app.utils.file_utils import ensure_runtime_dirs


settings = get_settings()
ensure_runtime_dirs([settings.temp_dir, settings.output_dir])

app = FastAPI(
    title="SS360 OCR Service",
    description="Free local OCR service for SS360 ERP tea invoices.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "SS360 OCR Service",
        "engine": "PaddleOCR",
        "freeLocal": True,
    }
