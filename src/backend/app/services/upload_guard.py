from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings

CHUNK_SIZE = 1024 * 1024


def _payload_too_large() -> HTTPException:
    settings = get_settings()
    return HTTPException(
        status_code=413,
        detail={
            "code": "UPLOAD_TOO_LARGE",
            "message": f"upload exceeds {settings.effective_import_max_upload_bytes} bytes",
        },
    )


async def read_upload_with_limit(file: UploadFile) -> bytes:
    limit = get_settings().effective_import_max_upload_bytes
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(CHUNK_SIZE):
        total += len(chunk)
        if total > limit:
            raise _payload_too_large()
        chunks.append(chunk)
    return b"".join(chunks)


async def spool_upload_with_limit(file: UploadFile, target_path: Path) -> int:
    limit = get_settings().effective_import_max_upload_bytes
    total = 0
    try:
        with target_path.open("wb") as out:
            while chunk := await file.read(CHUNK_SIZE):
                total += len(chunk)
                if total > limit:
                    raise _payload_too_large()
                out.write(chunk)
    except Exception:
        target_path.unlink(missing_ok=True)
        raise
    return total
