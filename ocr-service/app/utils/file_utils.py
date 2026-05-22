from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile


SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
SUPPORTED_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg"}


def ensure_runtime_dirs(paths):
    for path in paths:
        Path(path).mkdir(parents=True, exist_ok=True)


def is_supported_upload(filename):
    return Path(filename or "").suffix.lower() in SUPPORTED_EXTENSIONS


def is_supported_upload_metadata(file: UploadFile):
    return is_supported_upload(file.filename) and file.content_type in SUPPORTED_MIME_TYPES


async def save_upload_file(file: UploadFile, temp_dir: Path, max_bytes: int):
    ensure_runtime_dirs([temp_dir])
    suffix = Path(file.filename or "").suffix.lower()
    output_path = Path(temp_dir) / f"upload-{uuid4().hex}{suffix}"
    total_bytes = 0

    with output_path.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            total_bytes += len(chunk)
            if total_bytes > max_bytes:
                output.close()
                output_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Invoice upload exceeds the 25 MB limit.")
            output.write(chunk)

    await file.seek(0)
    if not has_supported_signature(output_path, file.content_type):
        output_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="The uploaded file content does not match a supported PDF or image invoice.",
        )

    return output_path


def has_supported_signature(file_path: Path, content_type: str):
    header = file_path.read_bytes()[:8]

    if content_type == "application/pdf":
        return header.startswith(b"%PDF")

    if content_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")

    if content_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")

    return False


def cleanup_paths(paths):
    for path in paths:
        if not path:
            continue
        try:
            Path(path).unlink(missing_ok=True)
        except OSError:
            pass
