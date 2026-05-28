from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import func, or_, select

from app.api.deps import DepartmentManageAuth, DbSession
from app.api.schemas import ApiEnvelope, DepartmentStatusUpdate, PageMeta, PagedResult
from app.models.tables import DictDepartment
from app.services.import_pipeline import import_departments
from app.services.exchange import build_file_payload_hash, finish_exchange, start_exchange
from app.services.standard_departments import standard_department_metadata, sync_standard_departments
from app.services.tabular_io import inspect_tabular_file
from app.services.upload_guard import read_upload_with_limit

router = APIRouter()


def department_payload(row: DictDepartment) -> dict:
    return {
        "dept_id": str(row.dept_id),
        "dept_code": row.dept_code,
        "dept_name": row.dept_name,
        "dept_alias": row.dept_alias,
        "parent_dept_id": str(row.parent_dept_id) if row.parent_dept_id else None,
        "campus_id": str(row.campus_id) if row.campus_id else None,
        "dept_short_name": row.dept_short_name,
        "dept_type": row.dept_type,
        "is_clinical": row.is_clinical,
        "is_medtech": row.is_medtech,
        "is_nursing_unit": row.is_nursing_unit,
        "is_admin": row.is_admin,
        "is_logistics": row.is_logistics,
        "ward_flag": row.ward_flag,
        "cost_center_code": row.cost_center_code,
        "his_department_code": row.his_department_code,
        "hris_department_code": row.hris_department_code,
        "finance_department_code": row.finance_department_code,
        "oid": row.oid,
        "status": row.status,
        "sort_order": row.sort_order,
        "effective_date": row.effective_date.isoformat() if row.effective_date else None,
        "expired_date": row.expired_date.isoformat() if row.expired_date else None,
        "remark": row.remark,
        "source_batch_id": row.source_batch_id,
        **standard_department_metadata(row.dept_code),
    }


@router.get("/departments/search", response_model=ApiEnvelope)
def search_departments(
    _: DepartmentManageAuth,
    db: DbSession,
    keyword: str | None = None,
    source_batch_id: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(DictDepartment)
    count_stmt = select(func.count()).select_from(DictDepartment)
    filters = []
    if keyword:
        like = f"%{keyword}%"
        filters.append(
            or_(
                DictDepartment.dept_code.ilike(like),
                DictDepartment.dept_name.ilike(like),
                DictDepartment.dept_alias.ilike(like),
            )
        )
    if source_batch_id:
        filters.append(DictDepartment.source_batch_id == source_batch_id)
    if status:
        filters.append(DictDepartment.status == status)
    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(DictDepartment.dept_code).offset((page - 1) * page_size).limit(page_size)
    ).all()
    items = [department_payload(r) for r in rows]
    return ApiEnvelope(data=PagedResult(items=items, page=PageMeta(page=page, page_size=page_size, total=total)))


@router.post("/departments/standard-library/sync", response_model=ApiEnvelope)
def sync_department_standard_library(operator: DepartmentManageAuth, db: DbSession) -> ApiEnvelope:
    report = sync_standard_departments(db, operator.name)
    db.commit()
    return ApiEnvelope(data=report)


@router.patch("/departments/{dept_code}/status", response_model=ApiEnvelope)
def update_department_status(
    dept_code: str,
    payload: DepartmentStatusUpdate,
    operator: DepartmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    status = payload.status.strip().upper()
    if status not in {"ACTIVE", "INACTIVE"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_FAILED", "message": "status must be ACTIVE or INACTIVE"},
        )
    department = db.scalar(select(DictDepartment).where(DictDepartment.dept_code == dept_code))
    if department is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "DEPARTMENT_NOT_FOUND", "message": f"department {dept_code} was not found"},
        )
    department.status = status
    department.updated_by = operator.name
    db.commit()
    db.refresh(department)
    return ApiEnvelope(data=department_payload(department))


@router.post("/departments/import/inspect", response_model=ApiEnvelope)
async def inspect_department_import_file(
    _: DepartmentManageAuth,
    file: UploadFile = File(...),
    sheet_name: str | None = Form(None),
) -> ApiEnvelope:
    content = await read_upload_with_limit(file)
    try:
        inspection = inspect_tabular_file(content, file.filename or "departments", sheet_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "IMPORT_FILE_INVALID", "message": str(exc)}) from exc
    inspection["source_file_name"] = file.filename or "departments"
    return ApiEnvelope(data=inspection)


@router.post("/departments/import", response_model=ApiEnvelope)
async def import_departments_endpoint(
    _: DepartmentManageAuth,
    db: DbSession,
    file: UploadFile = File(...),
    source_system: str = Form("MVP"),
    source_tx_id: str | None = Form(None),
    sheet_name: str | None = Form(None),
) -> ApiEnvelope:
    content = await read_upload_with_limit(file)
    batch_id = source_tx_id or f"DEPT-{uuid.uuid4().hex[:12]}"
    request_summary = {
        "operation": "departments_import",
        "file_name": file.filename or "departments",
        "file_payload_hash": build_file_payload_hash(
            content,
            {"source_system": source_system, "sheet_name": sheet_name},
        ),
        "sheet_name": sheet_name,
    }
    exchange_ctx, previous = start_exchange(
        db,
        source_system=source_system,
        source_tx_id=source_tx_id,
        data_category="department",
        request_payload=request_summary,
    )
    if previous is not None:
        return ApiEnvelope(data=previous)
    try:
        report = import_departments(db, content, file.filename or "departments", sheet_name, batch_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "IMPORT_FILE_INVALID", "message": str(exc)}) from exc
    report["source_system"] = source_system
    finish_exchange(db, exchange_ctx, request_payload=request_summary, response_payload=report)
    db.commit()
    return ApiEnvelope(data=report)
