import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


def ensure_runtime_dirs(paths):
    for path in paths:
        Path(path).mkdir(parents=True, exist_ok=True)


def is_supported_upload(filename):
    return Path(filename or "").suffix.lower() in SUPPORTED_EXTENSIONS


async def save_upload_file(file: UploadFile, temp_dir: Path):
    ensure_runtime_dirs([temp_dir])
    suffix = Path(file.filename or "").suffix.lower()
    output_path = Path(temp_dir) / f"upload-{uuid4().hex}{suffix}"

    with output_path.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    return output_path


def cleanup_paths(paths):
    for path in paths:
        if not path:
            continue
        try:
            Path(path).unlink(missing_ok=True)
        except OSError:
            pass
