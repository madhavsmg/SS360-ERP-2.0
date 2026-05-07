import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel


load_dotenv()


class Settings(BaseModel):
    host: str = os.getenv("OCR_HOST", "127.0.0.1")
    port: int = int(os.getenv("OCR_PORT", "8001"))
    temp_dir: Path = Path(os.getenv("OCR_TEMP_DIR", "./temp"))
    output_dir: Path = Path(os.getenv("OCR_OUTPUT_DIR", "./output"))
    ocr_lang: str = os.getenv("OCR_LANG", "en")
    use_gpu: bool = os.getenv("OCR_USE_GPU", "false").strip().lower() in {"1", "true", "yes"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
