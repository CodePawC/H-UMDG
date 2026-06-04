from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select

from app.api.deps import DbSession, EquipmentManageAuth
from app.api.schemas import ApiEnvelope, PageMeta, PagedResult
from app.models.tables import MdmEquipmentBrandModel, MdmStandardEquipment


brand_models_router = APIRouter(prefix="/equipment-brand-models")
standard_equipment_router = APIRouter(prefix="/standard-equipment-library")
master_data_router = APIRouter(prefix="/master-data")


class StatusIn(BaseModel):
    status: str


class EquipmentBrandModelIn(BaseModel):
    code: str | None = None
    brand: str
    model: str
    generic_name: str
    standard_name: str | None = None
    manufacturer_name: str | None = None
    registration_no: str | None = None
    status: str = "ACTIVE"
    attributes: dict[str, Any] = Field(default_factory=dict)


class StandardEquipmentIn(BaseModel):
    code: str
    name: str
    generic_name: str
    category_code: str | None = None
    category_name: str | None = None
    management_class: str | None = None
    brand: str | None = None
    model: str | None = None
    status: str = "ACTIVE"
    attributes: dict[str, Any] = Field(default_factory=dict)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _normalize_status(value: str | None) -> str:
    s = (value or "ACTIVE").strip().upper()
    if s in {"ACTIVE", "ENABLED", "启用"}:
        return "ACTIVE"
    if s in {"INACTIVE", "DISABLED", "停用"}:
        return "INACTIVE"
    if s in {"REVOKED", "撤销", "作废"}:
        return "REVOKED"
    return s or "ACTIVE"


def _bm_to_dict(row: MdmEquipmentBrandModel) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "code": row.code or "",
        "name": f"{row.brand} {row.model}",
        "brand": row.brand,
        "model": row.model,
        "generic_name": row.generic_name,
        "standard_name": row.standard_name,
        "manufacturer_name": row.manufacturer_name,
        "registration_no": row.registration_no,
        "status": row.status,
        "attributes": row.attributes or {},
        "created_at": row.created_at.isoformat() if row.created_at else _now(),
        "updated_at": row.updated_at.isoformat() if row.updated_at else _now(),
    }


def _se_to_dict(row: MdmStandardEquipment) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "code": row.code,
        "name": row.name,
        "generic_name": row.generic_name,
        "category_code": row.category_code,
        "category_name": row.category_name,
        "management_class": row.management_class,
        "brand": row.brand,
        "model": row.model,
        "status": row.status,
        "attributes": row.attributes or {},
        "created_at": row.created_at.isoformat() if row.created_at else _now(),
        "updated_at": row.updated_at.isoformat() if row.updated_at else _now(),
    }


# ---- Brand Model CRUD ----

@brand_models_router.get("", response_model=ApiEnvelope)
def list_equipment_brand_models(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> ApiEnvelope:
    q = select(MdmEquipmentBrandModel)
    if keyword:
        q = q.where(or_(MdmEquipmentBrandModel.brand.ilike(f"%{keyword}%"), MdmEquipmentBrandModel.model.ilike(f"%{keyword}%"), MdmEquipmentBrandModel.generic_name.ilike(f"%{keyword}%")))
    if status and status != "all":
        q = q.where(MdmEquipmentBrandModel.status == _normalize_status(status))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmEquipmentBrandModel.brand, MdmEquipmentBrandModel.model).offset((page - 1) * page_size).limit(page_size)).all()
    return ApiEnvelope(data=PagedResult(items=[_bm_to_dict(r) for r in rows], page=PageMeta(page=page, page_size=page_size, total=total)))


@brand_models_router.post("", response_model=ApiEnvelope)
def create_brand_model(payload: EquipmentBrandModelIn, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = MdmEquipmentBrandModel(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_bm_to_dict(row))


@brand_models_router.patch("/{record_id}", response_model=ApiEnvelope)
def patch_brand_model(record_id: str, payload: EquipmentBrandModelIn, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmEquipmentBrandModel, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "brand model not found"})
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_bm_to_dict(row))


@brand_models_router.patch("/{record_id}/status", response_model=ApiEnvelope)
def patch_brand_model_status(record_id: str, payload: StatusIn, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmEquipmentBrandModel, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "brand model not found"})
    row.status = _normalize_status(payload.status)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_bm_to_dict(row))


@brand_models_router.delete("/{record_id}", response_model=ApiEnvelope)
def delete_brand_model(record_id: str, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmEquipmentBrandModel, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "brand model not found"})
    db.delete(row)
    db.commit()
    return ApiEnvelope(data={"deleted": 1, "id": record_id})


# ---- Standard Equipment CRUD ----

@standard_equipment_router.get("", response_model=ApiEnvelope)
def list_standard_equipment(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> ApiEnvelope:
    q = select(MdmStandardEquipment)
    if keyword:
        q = q.where(or_(MdmStandardEquipment.name.ilike(f"%{keyword}%"), MdmStandardEquipment.generic_name.ilike(f"%{keyword}%")))
    if status and status != "all":
        q = q.where(MdmStandardEquipment.status == _normalize_status(status))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmStandardEquipment.name).offset((page - 1) * page_size).limit(page_size)).all()
    return ApiEnvelope(data=PagedResult(items=[_se_to_dict(r) for r in rows], page=PageMeta(page=page, page_size=page_size, total=total)))


@standard_equipment_router.post("", response_model=ApiEnvelope)
def create_standard_equipment(payload: StandardEquipmentIn, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = MdmStandardEquipment(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_se_to_dict(row))


@standard_equipment_router.patch("/{record_id}", response_model=ApiEnvelope)
def patch_standard_equipment(record_id: str, payload: StandardEquipmentIn, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmStandardEquipment, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "standard equipment not found"})
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_se_to_dict(row))


@standard_equipment_router.patch("/{record_id}/status", response_model=ApiEnvelope)
def patch_standard_equipment_status(record_id: str, payload: StatusIn, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmStandardEquipment, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "standard equipment not found"})
    row.status = _normalize_status(payload.status)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_se_to_dict(row))


@standard_equipment_router.delete("/{record_id}", response_model=ApiEnvelope)
def delete_standard_equipment(record_id: str, _: EquipmentManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmStandardEquipment, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "standard equipment not found"})
    db.delete(row)
    db.commit()
    return ApiEnvelope(data={"deleted": 1, "id": record_id})


# ---- Master Data External API ----

@master_data_router.get("/equipment-brand-models")
def list_master_brand_models(db: DbSession, keyword: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> dict:
    q = select(MdmEquipmentBrandModel).where(MdmEquipmentBrandModel.status == "ACTIVE")
    if keyword:
        q = q.where(or_(MdmEquipmentBrandModel.brand.ilike(f"%{keyword}%"), MdmEquipmentBrandModel.model.ilike(f"%{keyword}%")))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmEquipmentBrandModel.brand).offset((page - 1) * page_size).limit(page_size)).all()
    records = [{"id": str(r.id), "code": r.code or "", "name": f"{r.brand} {r.model}", "brand": r.brand, "model": r.model, "generic_name": r.generic_name, "manufacturer_name": r.manufacturer_name, "registration_no": r.registration_no, "status": r.status} for r in rows]
    return ApiEnvelope(data={"records": records, "total": total, "page": page, "page_size": page_size}).model_dump()


@master_data_router.get("/equipment-brand-models/{record_id}")
def get_master_brand_model_detail(db: DbSession, record_id: str) -> dict:
    row = db.get(MdmEquipmentBrandModel, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "brand model not found"})
    return ApiEnvelope(data=_bm_to_dict(row)).model_dump()


@master_data_router.get("/standard-equipment-library")
def list_master_standard_equipment(db: DbSession, keyword: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> dict:
    q = select(MdmStandardEquipment).where(MdmStandardEquipment.status == "ACTIVE")
    if keyword:
        q = q.where(or_(MdmStandardEquipment.name.ilike(f"%{keyword}%"), MdmStandardEquipment.generic_name.ilike(f"%{keyword}%")))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmStandardEquipment.name).offset((page - 1) * page_size).limit(page_size)).all()
    records = [{"id": str(r.id), "code": r.code, "name": r.name, "generic_name": r.generic_name, "category_name": r.category_name, "management_class": r.management_class, "status": r.status} for r in rows]
    return ApiEnvelope(data={"records": records, "total": total, "page": page, "page_size": page_size}).model_dump()


@master_data_router.get("/standard-equipment-library/{record_id}")
def get_master_standard_equipment_detail(db: DbSession, record_id: str) -> dict:
    row = db.get(MdmStandardEquipment, UUID(record_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "standard equipment not found"})
    return ApiEnvelope(data=_se_to_dict(row)).model_dump()
