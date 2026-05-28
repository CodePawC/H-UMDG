from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import func, or_, select

from app.api.deps import MaterialManageAuth, DbSession
from app.api.schemas import ApiEnvelope, PageMeta, PagedResult, TranscodeResolveResult
from app.models.tables import DictMaterialSpec, StgNhsaMaterialTranscode
from app.services.import_pipeline import (
    import_device_classification_docx,
    import_materials_mvp_template,
    import_nhsa_disabled,
    import_nhsa_full_spec,
    import_nhsa_transcode,
)
from app.services.exchange import build_file_payload_hash, finish_exchange, start_exchange
from app.services.tabular_io import inspect_tabular_file
from app.services.upload_guard import read_upload_with_limit

router = APIRouter()

SOURCE_IMPORTERS = {
    "MVP_TEMPLATE": import_materials_mvp_template,
    "NHSA_FULL_SPEC": import_nhsa_full_spec,
    "NHSA_DISABLED": import_nhsa_disabled,
    "NHSA_TRANSCODE": import_nhsa_transcode,
}


@router.get("/materials/search", response_model=ApiEnvelope)
def search_materials(
    _: MaterialManageAuth,
    db: DbSession,
    keyword: str | None = None,
    yb_code_27: str | None = None,
    reg_number: str | None = None,
    source_batch_id: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(DictMaterialSpec)
    count_stmt = select(func.count()).select_from(DictMaterialSpec)
    filters = []
    if keyword:
        like = f"%{keyword}%"
        filters.append(or_(DictMaterialSpec.generic_name.ilike(like), DictMaterialSpec.insurance_generic_name.ilike(like)))
    if yb_code_27:
        filters.append(DictMaterialSpec.yb_code_27 == yb_code_27)
    if reg_number:
        filters.append(DictMaterialSpec.reg_number.ilike(f"%{reg_number}%"))
    if source_batch_id:
        filters.append(DictMaterialSpec.source_batch_id == source_batch_id)
    if status:
        filters.append(DictMaterialSpec.status == status)
    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(DictMaterialSpec.yb_code_27).offset((page - 1) * page_size).limit(page_size)
    ).all()
    items = [
        {
            "material_id": str(r.material_id),
            "yb_code_27": r.yb_code_27,
            "yb_code_20": r.yb_code_20,
            "generic_name": r.generic_name,
            "cat_level_1": r.cat_level_1,
            "cat_level_2": r.cat_level_2,
            "cat_level_3": r.cat_level_3,
            "reg_number": r.reg_number,
            "status": r.status,
            "source_batch_id": r.source_batch_id,
        }
        for r in rows
    ]
    return ApiEnvelope(data=PagedResult(items=items, page=PageMeta(page=page, page_size=page_size, total=total)))


@router.get("/materials/transcode/resolve", response_model=ApiEnvelope)
def resolve_material_transcode(
    _: MaterialManageAuth,
    db: DbSession,
    original_yb_code_27: str,
    batch_id: str | None = None,
    change_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(StgNhsaMaterialTranscode)
    count_stmt = select(func.count()).select_from(StgNhsaMaterialTranscode)
    filters = [StgNhsaMaterialTranscode.original_yb_code_27 == original_yb_code_27]
    if batch_id:
        filters.append(StgNhsaMaterialTranscode.batch_id == batch_id)
    if change_type:
        filters.append(StgNhsaMaterialTranscode.change_type == change_type)
    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(StgNhsaMaterialTranscode.created_at.desc(), StgNhsaMaterialTranscode.stg_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        {
            "stg_id": r.stg_id,
            "batch_id": r.batch_id,
            "source_file_name": r.source_file_name,
            "sheet_name": r.sheet_name,
            "row_number": r.row_number,
            "original_yb_code_27": r.original_yb_code_27,
            "original_code_status": r.original_code_status,
            "yb_code_27": r.yb_code_27,
            "change_type": r.change_type,
            "created_at": r.created_at,
        }
        for r in rows
    ]
    result = TranscodeResolveResult(
        status="FOUND" if total else "NOT_FOUND",
        original_yb_code_27=original_yb_code_27,
        items=items,
        page=PageMeta(page=page, page_size=page_size, total=total),
    )
    return ApiEnvelope(data=result)


@router.post("/materials/import/inspect", response_model=ApiEnvelope)
async def inspect_material_import_file(
    _: MaterialManageAuth,
    file: UploadFile = File(...),
    source_type: str = Form("MVP_TEMPLATE"),
    sheet_name: str | None = Form(None),
) -> ApiEnvelope:
    if source_type != "DEVICE_CLASSIFICATION_CATALOG" and source_type not in SOURCE_IMPORTERS:
        raise HTTPException(status_code=400, detail={"code": "INVALID_SOURCE_TYPE", "message": source_type})
    content = await read_upload_with_limit(file)
    try:
        inspection = inspect_tabular_file(content, file.filename or "materials", sheet_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "IMPORT_FILE_INVALID", "message": str(exc)}) from exc
    inspection["source_type"] = source_type
    inspection["source_file_name"] = file.filename or "materials"
    return ApiEnvelope(data=inspection)


@router.post("/materials/import", response_model=ApiEnvelope)
async def import_materials_endpoint(
    _: MaterialManageAuth,
    db: DbSession,
    file: UploadFile = File(...),
    source_type: str = Form("MVP_TEMPLATE"),
    source_system: str = Form("MVP"),
    source_tx_id: str | None = Form(None),
    sheet_name: str | None = Form(None),
) -> ApiEnvelope:
    content = await read_upload_with_limit(file)
    batch_id = source_tx_id or f"MAT-{uuid.uuid4().hex[:12]}"
    request_summary = {
        "operation": "materials_import",
        "source_type": source_type,
        "file_name": file.filename or "materials",
        "file_payload_hash": build_file_payload_hash(
            content,
            {"source_type": source_type, "source_system": source_system, "sheet_name": sheet_name},
        ),
        "sheet_name": sheet_name,
    }
    exchange_ctx, previous = start_exchange(
        db,
        source_system=source_system,
        source_tx_id=source_tx_id,
        data_category="material",
        request_payload=request_summary,
    )
    if previous is not None:
        return ApiEnvelope(data=previous)
    try:
        if source_type == "DEVICE_CLASSIFICATION_CATALOG":
            report = import_device_classification_docx(db, content, file.filename or "device-catalog.docx", batch_id)
        else:
            importer = SOURCE_IMPORTERS.get(source_type)
            if importer is None:
                raise HTTPException(status_code=400, detail={"code": "INVALID_SOURCE_TYPE", "message": source_type})
            report = importer(db, content, file.filename or "materials", sheet_name, batch_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "IMPORT_FILE_INVALID", "message": str(exc)}) from exc
    finish_exchange(db, exchange_ctx, request_payload=request_summary, response_payload=report)
    db.commit()
    return ApiEnvelope(data=report)
