from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select

from app.api.deps import ImportManageAuth, DbSession
from app.api.schemas import ApiEnvelope, PageMeta, PagedResult
from app.models.tables import SysImportFailure
from app.services.archive_import import (
    archive_path_for_id,
    cleanup_archive,
    create_archive_import_batches,
    inspect_archive,
    parse_archive_selection,
    spool_archive_upload,
)
from app.services.import_tasks import (
    EQUIPMENT_IMPORTERS,
    IMPORTERS,
    create_import_batch,
    get_batch,
    import_spool_path,
    list_batches,
    make_single_file_artifact,
    new_batch_id,
    run_import_batch,
    serialize_batch,
)
from app.services.upload_guard import spool_upload_with_limit

router = APIRouter()


@router.post("/import-tasks/materials", response_model=ApiEnvelope)
async def create_material_import_task(
    _: ImportManageAuth,
    db: DbSession,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_type: str = Form("MVP_TEMPLATE"),
    source_system: str = Form("MVP"),
    source_tx_id: str | None = Form(None),
    sheet_name: str | None = Form(None),
) -> ApiEnvelope:
    if source_type not in IMPORTERS and source_type not in EQUIPMENT_IMPORTERS and source_type != "DEVICE_CLASSIFICATION_CATALOG":
        raise HTTPException(status_code=400, detail={"code": "INVALID_SOURCE_TYPE", "message": source_type})
    batch_id = source_tx_id or new_batch_id(source_type)
    if get_batch(db, batch_id) is not None:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE_IMPORT_BATCH", "message": batch_id})
    source_file_name = file.filename or "materials"
    spool_path = import_spool_path(batch_id, source_file_name)
    upload_size = await spool_upload_with_limit(file, spool_path)
    row = create_import_batch(
        db,
        batch_id=batch_id,
        source_type=source_type,
        source_system=source_system,
        source_file_name=source_file_name,
        source_file_path=str(spool_path),
        sheet_name=sheet_name,
    )
    row.result_payload = {
        "source_artifact": make_single_file_artifact(
            file_name=source_file_name,
            file_size_bytes=upload_size,
            source_type=source_type,
            sheet_name=sheet_name,
        )
    }
    db.commit()
    background_tasks.add_task(run_import_batch, batch_id)
    return ApiEnvelope(data=serialize_batch(row), message="Import task accepted")


@router.post("/import-tasks/materials/archive/inspect", response_model=ApiEnvelope)
async def inspect_material_import_archive(
    _: ImportManageAuth,
    file: UploadFile = File(...),
) -> ApiEnvelope:
    archive_id, path = await spool_archive_upload(file)
    try:
        inspection = inspect_archive(path, archive_id, file.filename or "archive.zip")
    except ValueError as exc:
        cleanup_archive(archive_id)
        raise HTTPException(status_code=400, detail={"code": "IMPORT_ARCHIVE_INVALID", "message": str(exc)}) from exc
    return ApiEnvelope(data=inspection)


@router.post("/import-tasks/materials/archive", response_model=ApiEnvelope)
async def create_material_import_archive_tasks(
    _: ImportManageAuth,
    db: DbSession,
    background_tasks: BackgroundTasks,
    archive_id: str = Form(...),
    archive_file_name: str = Form("archive.zip"),
    source_system: str = Form("MVP"),
    source_tx_id: str | None = Form(None),
    items: str | None = Form(None),
) -> ApiEnvelope:
    try:
        path = archive_path_for_id(archive_id)
        inspection = inspect_archive(path, archive_id, archive_file_name)
        selected_items = parse_archive_selection(items, inspection)
        rows = create_archive_import_batches(
            db,
            archive_path=path,
            archive_file_name=archive_file_name,
            archive_id=archive_id,
            source_system=source_system,
            source_tx_id=source_tx_id,
            selected_items=selected_items,
            inspection=inspection,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "IMPORT_ARCHIVE_INVALID", "message": str(exc)}) from exc
    db.commit()
    for row in rows:
        background_tasks.add_task(run_import_batch, row.batch_id)
    cleanup_archive(archive_id)
    return ApiEnvelope(
        data={
            "archive_id": archive_id,
            "archive_file_name": archive_file_name,
            "task_count": len(rows),
            "tasks": [serialize_batch(row) for row in rows],
        },
        message="Archive import tasks accepted",
    )


@router.get("/import-tasks/{batch_id}", response_model=ApiEnvelope)
def get_import_task(_: ImportManageAuth, db: DbSession, batch_id: str) -> ApiEnvelope:
    row = get_batch(db, batch_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "IMPORT_BATCH_NOT_FOUND", "message": batch_id})
    return ApiEnvelope(data=serialize_batch(row))


@router.get("/import-tasks", response_model=ApiEnvelope)
def list_import_tasks(
    _: ImportManageAuth,
    db: DbSession,
    status: str | None = None,
    source_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows, total = list_batches(db, status=status, source_type=source_type, page=page, page_size=page_size)
    return ApiEnvelope(
        data=PagedResult(
            items=[serialize_batch(row) for row in rows],
            page=PageMeta(page=page, page_size=page_size, total=total),
        )
    )


@router.get("/import-tasks/{batch_id}/failures", response_model=ApiEnvelope)
def list_import_failures(
    operator: ImportManageAuth,
    db: DbSession,
    batch_id: str,
    page: int = 1,
    page_size: int = 50,
    include_raw_payload: bool = False,
) -> ApiEnvelope:
    if include_raw_payload and "raw_payload.view" not in operator.permissions:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "FORBIDDEN",
                "message": "operator role does not have permission raw_payload.view",
            },
        )
    if get_batch(db, batch_id) is None:
        raise HTTPException(status_code=404, detail={"code": "IMPORT_BATCH_NOT_FOUND", "message": batch_id})
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    stmt = select(SysImportFailure).where(SysImportFailure.batch_id == batch_id)
    count_stmt = select(func.count()).select_from(SysImportFailure).where(SysImportFailure.batch_id == batch_id)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(SysImportFailure.failure_id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    items = []
    for row in rows:
        item = {
            "failure_id": row.failure_id,
            "batch_id": row.batch_id,
            "row_number": row.row_number,
            "field_name": row.field_name,
            "message": row.message,
            "raw_payload_included": include_raw_payload,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        if include_raw_payload:
            item["raw_payload"] = row.raw_payload
        items.append(item)

    return ApiEnvelope(
        data=PagedResult(
            items=items,
            page=PageMeta(page=page, page_size=page_size, total=total),
        )
    )
