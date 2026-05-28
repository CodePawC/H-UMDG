from __future__ import annotations

import json
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any
from uuid import uuid4

import py7zr
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.tables import SysImportBatch
from app.services.import_tasks import (
    IMPORTERS,
    create_import_batch,
    file_extension,
    import_spool_path,
    safe_spool_segment,
)
from app.services.tabular_io import inspect_tabular_file
from app.services.upload_guard import spool_upload_with_limit

ARCHIVE_DIR = "archive-preflight"
SUPPORTED_TABULAR_SUFFIXES = {".csv", ".xlsx", ".xlsm"}
TAR_SUFFIXES = {".tar", ".tgz", ".tbz2", ".txz", ".tar.gz", ".tar.bz2", ".tar.xz"}


@dataclass(frozen=True)
class ArchiveEntry:
    entry_path: str
    file_name: str
    size: int
    is_dir: bool = False


def archive_spool_dir(archive_id: str) -> Path:
    root = get_settings().resolved_import_spool_dir() / ARCHIVE_DIR
    path = (root / safe_spool_segment(archive_id)).resolve()
    path.relative_to(root.resolve())
    path.mkdir(parents=True, exist_ok=True)
    return path


def archive_spool_path(archive_id: str) -> Path:
    return archive_spool_dir(archive_id) / "source.archive"


async def spool_archive_upload(file: UploadFile) -> tuple[str, Path]:
    archive_id = f"ARCHIVE-{uuid4().hex[:12]}"
    target = archive_spool_path(archive_id)
    await spool_upload_with_limit(file, target)
    return archive_id, target


def archive_path_for_id(archive_id: str) -> Path:
    path = archive_spool_path(archive_id).resolve()
    path.relative_to((get_settings().resolved_import_spool_dir() / ARCHIVE_DIR).resolve())
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail={"code": "ARCHIVE_NOT_FOUND", "message": archive_id},
        )
    return path


def cleanup_archive(archive_id: str) -> None:
    directory = archive_spool_dir(archive_id)
    for child in directory.iterdir():
        if child.is_file():
            child.unlink(missing_ok=True)
    try:
        directory.rmdir()
    except OSError:
        pass


def infer_source_type(filename: str) -> tuple[str | None, str | None]:
    normalized = filename.lower()
    if "停用表" in filename or "disabled" in normalized:
        return "NHSA_DISABLED", None
    if "转码表" in filename or "transcode" in normalized:
        return "NHSA_TRANSCODE", None
    if "全量规格型号信息" in filename or "full-spec" in normalized or "full_spec" in normalized:
        return "NHSA_FULL_SPEC", None
    if "template-materials" in normalized or "materials" in normalized:
        return "MVP_TEMPLATE", None
    if "医疗器械分类目录" in filename or "device" in normalized:
        return "DEVICE_CLASSIFICATION_CATALOG", None
    return None, "unrecognized file name"


def _archive_suffix(filename: str) -> str:
    lowered = filename.lower()
    for suffix in (".tar.gz", ".tar.bz2", ".tar.xz"):
        if lowered.endswith(suffix):
            return suffix
    return Path(lowered).suffix


def _total_size(entries: list[ArchiveEntry]) -> int:
    return sum(max(entry.size, 0) for entry in entries)


def detect_archive_format(path: Path, archive_file_name: str) -> str:
    suffix = _archive_suffix(archive_file_name)
    if suffix == ".rar":
        raise ValueError("RAR archives are not supported because they require an external unrar runtime")
    if suffix == ".7z":
        return "7Z"
    if suffix == ".zip":
        return "ZIP"
    if suffix in TAR_SUFFIXES:
        return "TAR"
    if zipfile.is_zipfile(path):
        return "ZIP"
    if py7zr.is_7zfile(path):
        return "7Z"
    if tarfile.is_tarfile(path):
        return "TAR"
    raise ValueError(f"unsupported archive type: {suffix or 'unknown'}")


def _visible_entry(entry_path: str, is_dir: bool) -> bool:
    if is_dir:
        return False
    normalized = entry_path.replace("\\", "/")
    posix = PurePosixPath(normalized)
    if posix.is_absolute() or ".." in posix.parts:
        return False
    if normalized.startswith("__MACOSX/"):
        return False
    return not Path(normalized).name.startswith(".")


def _list_zip_entries(path: Path) -> list[ArchiveEntry]:
    with zipfile.ZipFile(path) as archive:
        return [
            ArchiveEntry(info.filename, Path(info.filename).name, info.file_size, info.is_dir())
            for info in archive.infolist()
            if _visible_entry(info.filename, info.is_dir())
        ]


def _list_tar_entries(path: Path) -> list[ArchiveEntry]:
    with tarfile.open(path, mode="r:*") as archive:
        return [
            ArchiveEntry(info.name, Path(info.name).name, info.size, not info.isfile())
            for info in archive.getmembers()
            if _visible_entry(info.name, not info.isfile())
        ]


def _list_7z_entries(path: Path) -> list[ArchiveEntry]:
    with py7zr.SevenZipFile(path, "r") as archive:
        return [
            ArchiveEntry(info.filename, Path(info.filename).name, int(info.uncompressed or 0), info.is_directory)
            for info in archive.list()
            if _visible_entry(info.filename, info.is_directory)
        ]


def list_archive_entries(path: Path, archive_file_name: str) -> tuple[str, list[ArchiveEntry]]:
    archive_format = detect_archive_format(path, archive_file_name)
    try:
        if archive_format == "ZIP":
            return archive_format, _list_zip_entries(path)
        if archive_format == "TAR":
            return archive_format, _list_tar_entries(path)
        if archive_format == "7Z":
            return archive_format, _list_7z_entries(path)
    except (tarfile.TarError, zipfile.BadZipFile, py7zr.Bad7zFile) as exc:
        raise ValueError(f"invalid {archive_format.lower()} archive") from exc
    raise ValueError(f"unsupported archive type: {archive_format}")


def _validate_archive_entries(entries: list[ArchiveEntry]) -> None:
    settings = get_settings()
    if len(entries) > settings.effective_import_max_archive_entries:
        raise ValueError(f"archive contains {len(entries)} files; limit is {settings.effective_import_max_archive_entries}")
    total = sum(entry.size for entry in entries)
    if total > settings.effective_import_max_archive_uncompressed_bytes:
        raise ValueError(
            f"archive uncompressed size {total} exceeds {settings.effective_import_max_archive_uncompressed_bytes} bytes"
        )


def read_archive_entry(path: Path, archive_file_name: str, entry_path: str) -> bytes:
    archive_format = detect_archive_format(path, archive_file_name)
    if archive_format == "ZIP":
        with zipfile.ZipFile(path) as archive:
            return archive.read(entry_path)
    if archive_format == "TAR":
        with tarfile.open(path, mode="r:*") as archive:
            member = archive.getmember(entry_path)
            source = archive.extractfile(member)
            if source is None:
                raise ValueError(f"archive entry is not a file: {entry_path}")
            with source:
                return source.read()
    if archive_format == "7Z":
        with py7zr.SevenZipFile(path, "r") as archive:
            payload = archive.read([entry_path]).get(entry_path)
            if payload is None:
                raise ValueError(f"archive entry not found: {entry_path}")
            return payload.read()
    raise ValueError(f"unsupported archive type: {archive_format}")


def _inspect_archive_entry(path: Path, archive_file_name: str, entry: ArchiveEntry) -> dict[str, Any]:
    filename = entry.file_name
    suffix = Path(filename).suffix.lower()
    source_type, reason = infer_source_type(filename)
    supported = bool(source_type and (suffix in SUPPORTED_TABULAR_SUFFIXES or suffix == ".docx"))
    item: dict[str, Any] = {
        "entry_path": entry.entry_path,
        "file_name": filename,
        "extension": suffix or None,
        "size": entry.size,
        "source_type": source_type,
        "supported": supported,
        "reason": None if supported else reason or f"unsupported file type: {suffix or 'none'}",
        "sheet_name": None,
        "inspection": None,
    }
    if not supported:
        return item
    if suffix == ".docx":
        item["inspection"] = {
            "file_type": "DOCX",
            "sheet_required": False,
            "default_sheet_name": None,
            "sheets": [],
            "row_count": None,
            "headers": [],
        }
        return item
    inspection = inspect_tabular_file(read_archive_entry(path, archive_file_name, entry.entry_path), filename)
    item["inspection"] = inspection
    item["sheet_name"] = inspection.get("default_sheet_name")
    item["row_count"] = inspection.get("row_count")
    item["sheet_count"] = len(inspection.get("sheets") or [])
    item["headers"] = inspection.get("headers") or []
    return item


def inspect_archive(path: Path, archive_id: str, archive_file_name: str) -> dict[str, Any]:
    archive_format, entries = list_archive_entries(path, archive_file_name)
    _validate_archive_entries(entries)
    items = [_inspect_archive_entry(path, archive_file_name, entry) for entry in entries]
    importable = [item for item in items if item["supported"]]
    source_type_counts: dict[str, int] = {}
    for item in importable:
        source_type = str(item.get("source_type") or "UNKNOWN")
        source_type_counts[source_type] = source_type_counts.get(source_type, 0) + 1
    return {
        "archive_id": archive_id,
        "archive_file_name": archive_file_name,
        "archive_file_extension": _archive_suffix(archive_file_name) or file_extension(archive_file_name),
        "archive_file_size_bytes": path.stat().st_size,
        "archive_format": archive_format,
        "total_entries": len(items),
        "total_uncompressed_size_bytes": _total_size(entries),
        "importable_size_bytes": sum(int(item.get("size") or 0) for item in importable),
        "importable_count": len(importable),
        "unsupported_count": len(items) - len(importable),
        "source_type_counts": source_type_counts,
        "items": items,
    }


def parse_archive_selection(raw: str | None, inspection: dict[str, Any]) -> list[dict[str, Any]]:
    importable = [item for item in inspection["items"] if item.get("supported")]
    if not raw:
        return importable
    try:
        selected = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("invalid items JSON") from exc
    if not isinstance(selected, list):
        raise ValueError("items must be a JSON array")
    by_entry = {item["entry_path"]: item for item in importable}
    out: list[dict[str, Any]] = []
    for raw_item in selected:
        if not isinstance(raw_item, dict):
            raise ValueError("each item must be an object")
        entry_path = str(raw_item.get("entry_path") or "")
        base = by_entry.get(entry_path)
        if base is None:
            raise ValueError(f"unsupported or missing archive entry: {entry_path}")
        item = dict(base)
        source_type = str(raw_item.get("source_type") or item["source_type"])
        if source_type not in IMPORTERS and source_type != "DEVICE_CLASSIFICATION_CATALOG":
            raise ValueError(f"invalid source type: {source_type}")
        item["source_type"] = source_type
        if raw_item.get("sheet_name") is not None:
            item["sheet_name"] = str(raw_item.get("sheet_name") or "") or None
        out.append(item)
    return out


def create_archive_import_batches(
    db: Session,
    *,
    archive_path: Path,
    archive_file_name: str,
    archive_id: str,
    source_system: str,
    source_tx_id: str | None,
    selected_items: list[dict[str, Any]],
    inspection: dict[str, Any] | None = None,
) -> list[SysImportBatch]:
    if not selected_items:
        raise ValueError("no importable archive entries selected")
    archive_format, archive_entries = list_archive_entries(archive_path, archive_file_name)
    inspection_snapshot = inspection or inspect_archive(archive_path, archive_id, archive_file_name)
    available_entries = {entry.entry_path for entry in archive_entries}
    rows: list[SysImportBatch] = []
    prefix = safe_spool_segment(source_tx_id or archive_id)[:42]
    for index, item in enumerate(selected_items, start=1):
        entry_path = item["entry_path"]
        if entry_path not in available_entries:
            raise ValueError(f"archive entry not found: {entry_path}")
        source_type = item["source_type"]
        batch_id = f"{prefix}-{index:02d}-{source_type}-{uuid4().hex[:8]}"[:100]
        source_file_name = item["file_name"]
        target_path = import_spool_path(batch_id, source_file_name)
        target_path.write_bytes(read_archive_entry(archive_path, archive_file_name, entry_path))
        row = create_import_batch(
            db,
            batch_id=batch_id,
            source_type=source_type,
            source_system=source_system,
            source_file_name=source_file_name,
            source_file_path=str(target_path),
            sheet_name=item.get("sheet_name"),
        )
        item_inspection = item.get("inspection") if isinstance(item.get("inspection"), dict) else {}
        row.result_payload = {
            "source_artifact": {
                "upload_mode": "archive_entry",
                "archive_id": archive_id,
                "archive_file_name": archive_file_name,
                "archive_file_extension": inspection_snapshot.get("archive_file_extension"),
                "archive_file_size_bytes": inspection_snapshot.get("archive_file_size_bytes"),
                "archive_format": archive_format,
                "archive_total_entries": inspection_snapshot.get("total_entries"),
                "archive_importable_count": inspection_snapshot.get("importable_count"),
                "archive_uncompressed_size_bytes": inspection_snapshot.get("total_uncompressed_size_bytes"),
                "archive_entry_path": entry_path,
                "archive_entry_size_bytes": int(item.get("size") or 0),
                "source_file_name": source_file_name,
                "source_file_extension": file_extension(source_file_name),
                "source_file_size_bytes": int(item.get("size") or 0),
                "detected_source_type": source_type,
                "detected_sheet_name": item.get("sheet_name"),
                "detected_row_count": item_inspection.get("row_count"),
                "detected_sheet_count": len(item_inspection.get("sheets") or []),
                "detected_headers": (item_inspection.get("headers") or [])[:12],
            },
            "archive_id": archive_id,
            "archive_file_name": archive_file_name,
            "archive_entry_path": entry_path,
        }
        rows.append(row)
    return rows
