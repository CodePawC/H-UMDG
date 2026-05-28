from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from time import sleep
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.models.tables import SysImportBatch, SysImportFailure
from app.services.import_pipeline import (
    import_device_classification_docx,
    import_materials_mvp_template,
    import_nhsa_disabled,
    import_nhsa_full_spec,
    import_nhsa_full_spec_from_path,
    import_nhsa_transcode,
)
from app.services.equipment_dictionary import import_equipment_categories, import_equipment_standard_names

IMPORTERS: dict[str, Callable[..., dict[str, Any]]] = {
    "MVP_TEMPLATE": import_materials_mvp_template,
    "NHSA_FULL_SPEC": import_nhsa_full_spec,
    "NHSA_DISABLED": import_nhsa_disabled,
    "NHSA_TRANSCODE": import_nhsa_transcode,
}

EQUIPMENT_IMPORTERS: dict[str, Callable[..., dict[str, Any]]] = {
    "EQUIPMENT_CATEGORY": import_equipment_categories,
    "EQUIPMENT_STANDARD_NAME": import_equipment_standard_names,
}


def new_batch_id(source_type: str) -> str:
    return f"IMPORT-{source_type}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"


def safe_spool_segment(raw: str) -> str:
    allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
    cleaned = "".join(ch if ch in allowed else "_" for ch in raw.strip())
    return cleaned[:120] or "import"


def import_spool_path(batch_id: str, filename: str) -> Path:
    settings = get_settings()
    batch_dir = settings.resolved_import_spool_dir() / safe_spool_segment(batch_id)
    batch_dir.mkdir(parents=True, exist_ok=True)
    return batch_dir / safe_spool_segment(Path(filename).name)


def cleanup_import_spool_path(raw_path: str | None) -> None:
    if not raw_path or not get_settings().effective_import_cleanup_spool_on_finish:
        return
    spool_root = get_settings().resolved_import_spool_dir()
    file_path = Path(raw_path).expanduser().resolve()
    try:
        file_path.relative_to(spool_root)
    except ValueError:
        return
    for attempt in range(3):
        try:
            file_path.unlink(missing_ok=True)
            break
        except PermissionError:
            if attempt == 2:
                return
            sleep(0.25)
    parent = file_path.parent
    if parent != spool_root:
        try:
            parent.rmdir()
        except OSError:
            pass


def create_import_batch(
    db: Session,
    *,
    batch_id: str,
    source_type: str,
    source_system: str,
    source_file_name: str,
    source_file_path: str | None,
    sheet_name: str | None,
) -> SysImportBatch:
    row = SysImportBatch(
        batch_id=batch_id,
        source_type=source_type,
        source_system=source_system,
        source_file_name=source_file_name,
        source_file_path=source_file_path,
        sheet_name=sheet_name,
        status="PENDING",
        progress_percent=0,
    )
    db.add(row)
    return row


def file_extension(filename: str | None) -> str | None:
    if not filename:
        return None
    suffix = Path(filename).suffix.lower()
    return suffix or None


def make_single_file_artifact(
    *,
    file_name: str,
    file_size_bytes: int | None,
    source_type: str,
    sheet_name: str | None,
) -> dict[str, Any]:
    return {
        "upload_mode": "single_file",
        "source_file_name": Path(file_name).name,
        "source_file_extension": file_extension(file_name),
        "source_file_size_bytes": file_size_bytes,
        "detected_source_type": source_type,
        "detected_sheet_name": sheet_name,
    }


def _record_failures(db: Session, batch_id: str, failures: list[dict[str, Any]]) -> None:
    for item in failures:
        db.add(
            SysImportFailure(
                batch_id=batch_id,
                row_number=item.get("row"),
                field_name=item.get("field"),
                message=str(item.get("message") or "import failure"),
                raw_payload=item,
            )
        )


def _apply_report(batch: SysImportBatch, report: dict[str, Any]) -> None:
    existing_payload = batch.result_payload if isinstance(batch.result_payload, dict) else {}
    source_artifact = existing_payload.get("source_artifact")
    batch.source_row_count = int(report.get("source_row_count") or 0)
    batch.unique_key_count = int(report.get("unique_key_count") or 0)
    batch.success_count = int(report.get("success_count") or 0)
    batch.failed_count = int(report.get("failed_count") or 0)
    batch.skipped_duplicate_count = int(report.get("skipped_duplicate_count") or 0)
    batch.duplicate_count = int(report.get("duplicate_count") or 0)
    batch.result_payload = dict(report)
    if isinstance(source_artifact, dict):
        batch.result_payload["source_artifact"] = source_artifact


def _apply_progress(batch: SysImportBatch, report: dict[str, Any]) -> None:
    batch.source_row_count = int(report.get("source_row_count") or 0)
    batch.unique_key_count = int(report.get("unique_key_count") or 0)
    batch.success_count = int(report.get("success_count") or 0)
    batch.failed_count = int(report.get("failed_count") or 0)
    batch.skipped_duplicate_count = int(report.get("skipped_duplicate_count") or 0)
    total_rows = int(report.get("total_rows") or 0)
    if total_rows > 0:
        batch.progress_percent = min(95, max(5, int(batch.source_row_count * 95 / total_rows)))
    else:
        batch.progress_percent = min(95, max(batch.progress_percent or 5, 10))


def run_import_batch(batch_id: str) -> None:
    source_file_path: str | None = None
    SessionLocal = get_session_factory()
    with SessionLocal() as db:
        batch = db.get(SysImportBatch, batch_id)
        if batch is None:
            return
        source_file_path = batch.source_file_path
        batch.status = "RUNNING"
        batch.started_at = datetime.now(timezone.utc)
        batch.progress_percent = 5
        db.commit()

        try:
            if not batch.source_file_path:
                raise FileNotFoundError("import source_file_path is empty")
            file_path = Path(batch.source_file_path)
            if not file_path.exists():
                raise FileNotFoundError(str(file_path))
            if batch.source_type == "NHSA_FULL_SPEC":
                report = import_nhsa_full_spec_from_path(
                    db,
                    file_path,
                    batch.source_file_name,
                    batch.sheet_name,
                    batch.batch_id,
                    progress_callback=lambda progress: (
                        _apply_progress(batch, progress),
                        db.commit(),
                    ),
                )
            elif batch.source_type == "DEVICE_CLASSIFICATION_CATALOG":
                file_content = file_path.read_bytes()
                report = import_device_classification_docx(
                    db,
                    file_content,
                    batch.source_file_name,
                    batch.batch_id,
                )
            elif batch.source_type in EQUIPMENT_IMPORTERS:
                file_content = file_path.read_bytes()
                importer = EQUIPMENT_IMPORTERS[batch.source_type]
                report = importer(
                    db,
                    file_content,
                    batch.source_file_name,
                    batch.sheet_name,
                    batch.batch_id,
                    batch.source_system,
                )
            else:
                file_content = file_path.read_bytes()
                importer = IMPORTERS[batch.source_type]
                report = importer(db, file_content, batch.source_file_name, batch.sheet_name, batch.batch_id)
            _apply_report(batch, report)
            _record_failures(db, batch_id, report.get("failures") or [])
            batch.status = "COMPLETED" if batch.failed_count == 0 else "COMPLETED_WITH_ERRORS"
            batch.progress_percent = 100
            batch.finished_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as exc:
            db.rollback()
            batch = db.get(SysImportBatch, batch_id)
            if batch is None:
                return
            batch.status = "FAILED"
            batch.error_code = exc.__class__.__name__
            batch.error_message = str(exc)
            batch.progress_percent = 100
            batch.finished_at = datetime.now(timezone.utc)
            db.add(
                SysImportFailure(
                    batch_id=batch_id,
                    row_number=None,
                    field_name=None,
                    message=str(exc),
                    raw_payload={"error_type": exc.__class__.__name__},
                )
            )
            db.commit()
        finally:
            cleanup_import_spool_path(source_file_path)


def serialize_batch(batch: SysImportBatch) -> dict[str, Any]:
    result_payload = batch.result_payload if isinstance(batch.result_payload, dict) else {}
    source_artifact = result_payload.get("source_artifact")
    artifact = source_artifact if isinstance(source_artifact, dict) else {}
    source_file_name = Path(batch.source_file_name).name
    source_file_extension = artifact.get("source_file_extension") or file_extension(source_file_name)
    source_file_size_bytes = artifact.get("source_file_size_bytes")
    archive_file_name = artifact.get("archive_file_name") or result_payload.get("archive_file_name")
    archive_entry_path = artifact.get("archive_entry_path") or result_payload.get("archive_entry_path")
    return {
        "batch_id": batch.batch_id,
        "source_type": batch.source_type,
        "source_system": batch.source_system,
        "source_file_name": source_file_name,
        "source_file_extension": source_file_extension,
        "source_file_size_bytes": source_file_size_bytes,
        "archive_id": artifact.get("archive_id") or result_payload.get("archive_id"),
        "archive_file_name": archive_file_name,
        "archive_file_extension": artifact.get("archive_file_extension") or file_extension(str(archive_file_name or "")),
        "archive_file_size_bytes": artifact.get("archive_file_size_bytes"),
        "archive_format": artifact.get("archive_format"),
        "archive_total_entries": artifact.get("archive_total_entries"),
        "archive_importable_count": artifact.get("archive_importable_count"),
        "archive_uncompressed_size_bytes": artifact.get("archive_uncompressed_size_bytes"),
        "archive_entry_path": archive_entry_path,
        "archive_entry_size_bytes": artifact.get("archive_entry_size_bytes"),
        "detected_row_count": artifact.get("detected_row_count"),
        "detected_sheet_count": artifact.get("detected_sheet_count"),
        "detected_headers": artifact.get("detected_headers") or [],
        "source_artifact": artifact or None,
        "sheet_name": batch.sheet_name,
        "status": batch.status,
        "progress_percent": batch.progress_percent,
        "source_row_count": batch.source_row_count,
        "unique_key_count": batch.unique_key_count,
        "success_count": batch.success_count,
        "failed_count": batch.failed_count,
        "skipped_duplicate_count": batch.skipped_duplicate_count,
        "duplicate_count": batch.duplicate_count,
        "error_code": batch.error_code,
        "error_message": batch.error_message,
        "created_at": batch.created_at.isoformat() if batch.created_at else None,
        "started_at": batch.started_at.isoformat() if batch.started_at else None,
        "finished_at": batch.finished_at.isoformat() if batch.finished_at else None,
    }


def get_batch(db: Session, batch_id: str) -> SysImportBatch | None:
    return db.get(SysImportBatch, batch_id)


def list_batches(
    db: Session,
    *,
    status: str | None,
    source_type: str | None,
    page: int,
    page_size: int,
) -> tuple[list[SysImportBatch], int]:
    from sqlalchemy import func

    stmt = select(SysImportBatch)
    count_stmt = select(func.count()).select_from(SysImportBatch)
    if status:
        stmt = stmt.where(SysImportBatch.status == status)
        count_stmt = count_stmt.where(SysImportBatch.status == status)
    if source_type:
        stmt = stmt.where(SysImportBatch.source_type == source_type)
        count_stmt = count_stmt.where(SysImportBatch.source_type == source_type)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(SysImportBatch.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return rows, total
