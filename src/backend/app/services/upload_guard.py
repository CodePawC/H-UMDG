from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings

CHUNK_SIZE = 1024 * 1024

ALLOWED_EXTENSIONS = frozenset({
    ".xlsx", ".xls", ".csv", ".json", ".xml",
    ".docx", ".doc", ".pdf", ".txt", ".zip", ".7z",
})
BLOCKED_EXTENSIONS = frozenset({
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".jse",
    ".vbe", ".wsf", ".wsh", ".msi", ".scr", ".com", ".pif",
    ".hta", ".cpl", ".jar", ".py", ".rb", ".php", ".asp", ".aspx",
})


def _validate_file_extension(filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=400, detail={"code": "FILE_TYPE_BLOCKED", "message": f"文件类型 {ext} 不允许上传"})
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail={"code": "FILE_TYPE_NOT_ALLOWED", "message": f"文件类型 {ext} 不在允许列表中"})


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
    if file.filename:
        _validate_file_extension(file.filename)
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
    if file.filename:
        _validate_file_extension(file.filename)
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
