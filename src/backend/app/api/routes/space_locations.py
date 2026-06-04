from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.api.deps import DbSession, OrganizationManageAuth
from app.api.schemas import ApiEnvelope, PageMeta, PagedResult
from app.models.tables import (
    MdmSpaceLocation,
    MdmRegistrationCertificate,
    MdmUdi,
)


router = APIRouter(prefix="/space-locations")
registration_certificates_router = APIRouter(prefix="/registration-certificates")
udis_router = APIRouter(prefix="/udis")
master_data_router = APIRouter(prefix="/master-data")

LOCATION_TYPES = {"campus", "building", "floor", "room"}
TYPE_ORDER = {"campus": 0, "building": 1, "floor": 2, "room": 3}


class SpaceLocationIn(BaseModel):
    type: str = Field(..., pattern="^(campus|building|floor|room)$")
    code: str
    name: str
    parent_id: str | None = None
    short_name: str | None = None
    status: str = "ACTIVE"
    attributes: dict[str, Any] = Field(default_factory=dict)


class SpaceLocationStatusIn(BaseModel):
    status: str


class RegistrationCertificateIn(BaseModel):
    registration_no: str
    product_name: str
    generic_name: str | None = None
    brand: str | None = None
    model: str | None = None
    holder_name: str | None = None
    valid_to: str | None = None
    status: str = "ACTIVE"
    attributes: dict[str, Any] = Field(default_factory=dict)


class UdiIn(BaseModel):
    di: str
    product_name: str
    generic_name: str | None = None
    brand: str | None = None
    model: str | None = None
    registration_no: str | None = None
    status: str = "ACTIVE"
    attributes: dict[str, Any] = Field(default_factory=dict)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _loc_to_dict(row: MdmSpaceLocation) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "type": row.type,
        "code": row.code,
        "name": row.name,
        "parent_id": str(row.parent_id) if row.parent_id else None,
        "short_name": row.short_name,
        "status": row.status,
        "attributes": row.attributes or {},
        "created_at": row.created_at.isoformat() if row.created_at else _now(),
        "updated_at": row.updated_at.isoformat() if row.updated_at else _now(),
        "children": [],
    }


def _filter_locations(q, *, keyword: str | None, location_type: str | None, status: str | None):
    if keyword:
        q = q.where(MdmSpaceLocation.name.ilike(f"%{keyword}%") | MdmSpaceLocation.code.ilike(f"%{keyword}%"))
    if location_type:
        q = q.where(MdmSpaceLocation.type == location_type)
    if status and status != "all":
        q = q.where(MdmSpaceLocation.status == status)
    return q


# ── 空间位置管理 API ──

@router.get("", response_model=ApiEnvelope)
def list_space_locations(
    db: DbSession,
    keyword: str | None = Query(None),
    location_type: str | None = Query(None, alias="type"),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
) -> ApiEnvelope:
    q = select(MdmSpaceLocation).order_by(MdmSpaceLocation.type, MdmSpaceLocation.code)
    q = _filter_locations(q, keyword=keyword, location_type=location_type, status=status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()
    return ApiEnvelope(data=PagedResult(
        items=[_loc_to_dict(r) for r in rows],
        page=PageMeta(page=page, page_size=page_size, total=total),
    ))


@router.get("/tree", response_model=ApiEnvelope)
def get_space_location_tree(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None)) -> ApiEnvelope:
    q = select(MdmSpaceLocation)
    q = _filter_locations(q, keyword=keyword, location_type=None, status=status)
    all_rows = db.scalars(q.order_by(MdmSpaceLocation.type, MdmSpaceLocation.code)).all()
    items_by_id = {str(r.id): _loc_to_dict(r) for r in all_rows}
    roots = []
    for item in items_by_id.values():
        pid = item["parent_id"]
        if pid and pid in items_by_id:
            items_by_id[pid]["children"].append(item)
        else:
            roots.append(item)
    return ApiEnvelope(data={"items": roots, "total": len(roots)})


@router.post("", response_model=ApiEnvelope)
def upsert_space_location(payload: SpaceLocationIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = MdmSpaceLocation(type=payload.type, code=payload.code, name=payload.name, parent_id=UUID(payload.parent_id) if payload.parent_id else None, short_name=payload.short_name, status=payload.status, attributes=payload.attributes)
    db.add(row)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_loc_to_dict(row))


@router.patch("/{location_id}", response_model=ApiEnvelope)
def patch_space_location(location_id: str, payload: SpaceLocationIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmSpaceLocation, UUID(location_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "location not found"})
    row.type = payload.type
    row.code = payload.code
    row.name = payload.name
    row.parent_id = UUID(payload.parent_id) if payload.parent_id else None
    row.short_name = payload.short_name
    row.status = payload.status
    row.attributes = payload.attributes
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_loc_to_dict(row))


@router.patch("/{location_id}/status", response_model=ApiEnvelope)
def patch_space_location_status(location_id: str, payload: SpaceLocationStatusIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmSpaceLocation, UUID(location_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "location not found"})
    row.status = payload.status
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_loc_to_dict(row))


@router.delete("/{location_id}", response_model=ApiEnvelope)
def delete_space_location(location_id: str, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmSpaceLocation, UUID(location_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "location not found"})
    db.delete(row)
    db.commit()
    return ApiEnvelope(data={"deleted": 1, "id": location_id})


# ── 主数据外部 API ──

@master_data_router.get("/locations")
def list_master_locations(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> dict:
    q = select(MdmSpaceLocation)
    q = _filter_locations(q, keyword=keyword, location_type=None, status=status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmSpaceLocation.type, MdmSpaceLocation.code).offset((page - 1) * page_size).limit(page_size)).all()
    records = [{"id": str(r.id), "code": r.code, "name": r.name, "type": r.type, "short_name": r.short_name, "parent_id": str(r.parent_id) if r.parent_id else None, "status": r.status} for r in rows]
    return ApiEnvelope(data={"records": records, "total": total, "page": page, "page_size": page_size}).model_dump()


@master_data_router.get("/locations/tree")
def get_master_location_tree(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None)) -> dict:
    q = select(MdmSpaceLocation)
    q = _filter_locations(q, keyword=keyword, location_type=None, status=status)
    all_rows = db.scalars(q.order_by(MdmSpaceLocation.type, MdmSpaceLocation.code)).all()
    items_by_id = {}
    for r in all_rows:
        d = {"id": str(r.id), "code": r.code, "name": r.name, "type": r.type, "short_name": r.short_name, "parent_id": str(r.parent_id) if r.parent_id else None, "status": r.status, "children": []}
        items_by_id[d["id"]] = d
    roots = []
    for item in items_by_id.values():
        pid = item["parent_id"]
        if pid and pid in items_by_id:
            items_by_id[pid]["children"].append(item)
        else:
            roots.append(item)
    return ApiEnvelope(data={"records": roots, "total": len(roots)}).model_dump()


@master_data_router.get("/locations/{location_id}")
def get_master_location_detail(db: DbSession, location_id: str) -> dict:
    row = db.get(MdmSpaceLocation, UUID(location_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "location not found"})
    return ApiEnvelope(data=_loc_to_dict(row)).model_dump()


# ── 注册证管理 API ──

def _cert_to_dict(row: MdmRegistrationCertificate) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "registration_no": row.registration_no,
        "product_name": row.product_name,
        "generic_name": row.generic_name,
        "brand": row.brand,
        "model": row.model,
        "holder_name": row.holder_name,
        "valid_to": row.valid_to,
        "status": row.status,
        "attributes": row.attributes or {},
        "created_at": row.created_at.isoformat() if row.created_at else _now(),
        "updated_at": row.updated_at.isoformat() if row.updated_at else _now(),
    }


@registration_certificates_router.get("", response_model=ApiEnvelope)
def list_registration_certificates(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> ApiEnvelope:
    q = select(MdmRegistrationCertificate)
    if keyword:
        q = q.where(MdmRegistrationCertificate.product_name.ilike(f"%{keyword}%") | MdmRegistrationCertificate.registration_no.ilike(f"%{keyword}%"))
    if status and status != "all":
        q = q.where(MdmRegistrationCertificate.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmRegistrationCertificate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return ApiEnvelope(data=PagedResult(items=[_cert_to_dict(r) for r in rows], page=PageMeta(page=page, page_size=page_size, total=total)))


@registration_certificates_router.post("", response_model=ApiEnvelope)
def create_registration_certificate(payload: RegistrationCertificateIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = MdmRegistrationCertificate(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_cert_to_dict(row))


@registration_certificates_router.patch("/{certificate_id}", response_model=ApiEnvelope)
def patch_registration_certificate(certificate_id: str, payload: RegistrationCertificateIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmRegistrationCertificate, UUID(certificate_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "certificate not found"})
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_cert_to_dict(row))


@registration_certificates_router.patch("/{certificate_id}/status", response_model=ApiEnvelope)
def patch_registration_certificate_status(certificate_id: str, payload: SpaceLocationStatusIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmRegistrationCertificate, UUID(certificate_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "certificate not found"})
    row.status = payload.status
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_cert_to_dict(row))


@registration_certificates_router.delete("/{certificate_id}", response_model=ApiEnvelope)
def delete_registration_certificate(certificate_id: str, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmRegistrationCertificate, UUID(certificate_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "certificate not found"})
    db.delete(row)
    db.commit()
    return ApiEnvelope(data={"deleted": 1, "id": certificate_id})


# ── 注册证主数据外部 API ──

@master_data_router.get("/registration-certificates")
def list_master_registration_certificates(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> dict:
    q = select(MdmRegistrationCertificate)
    if keyword:
        q = q.where(MdmRegistrationCertificate.product_name.ilike(f"%{keyword}%") | MdmRegistrationCertificate.registration_no.ilike(f"%{keyword}%"))
    if status and status != "all":
        q = q.where(MdmRegistrationCertificate.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmRegistrationCertificate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    records = [{"id": str(r.id), "registration_no": r.registration_no, "code": r.registration_no, "name": r.product_name, "product_name": r.product_name, "holder_name": r.holder_name, "status": r.status} for r in rows]
    return ApiEnvelope(data={"records": records, "total": total, "page": page, "page_size": page_size}).model_dump()


@master_data_router.get("/registration-certificates/{certificate_id}")
def get_master_registration_certificate_detail(db: DbSession, certificate_id: str) -> dict:
    row = db.get(MdmRegistrationCertificate, UUID(certificate_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "certificate not found"})
    return ApiEnvelope(data=_cert_to_dict(row)).model_dump()


# ── UDI 管理 API ──

def _udi_to_dict(row: MdmUdi) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "di": row.di,
        "product_name": row.product_name,
        "generic_name": row.generic_name,
        "brand": row.brand,
        "model": row.model,
        "registration_no": row.registration_no,
        "status": row.status,
        "attributes": row.attributes or {},
        "created_at": row.created_at.isoformat() if row.created_at else _now(),
        "updated_at": row.updated_at.isoformat() if row.updated_at else _now(),
    }


@udis_router.get("", response_model=ApiEnvelope)
def list_udis(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> ApiEnvelope:
    q = select(MdmUdi)
    if keyword:
        q = q.where(MdmUdi.product_name.ilike(f"%{keyword}%") | MdmUdi.di.ilike(f"%{keyword}%"))
    if status and status != "all":
        q = q.where(MdmUdi.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmUdi.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return ApiEnvelope(data=PagedResult(items=[_udi_to_dict(r) for r in rows], page=PageMeta(page=page, page_size=page_size, total=total)))


@udis_router.post("", response_model=ApiEnvelope)
def create_udi(payload: UdiIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = MdmUdi(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_udi_to_dict(row))


@udis_router.patch("/{udi_id}", response_model=ApiEnvelope)
def patch_udi(udi_id: str, payload: UdiIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmUdi, UUID(udi_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "UDI not found"})
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_udi_to_dict(row))


@udis_router.patch("/{udi_id}/status", response_model=ApiEnvelope)
def patch_udi_status(udi_id: str, payload: SpaceLocationStatusIn, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmUdi, UUID(udi_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "UDI not found"})
    row.status = payload.status
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_udi_to_dict(row))


@udis_router.delete("/{udi_id}", response_model=ApiEnvelope)
def delete_udi(udi_id: str, _: OrganizationManageAuth, db: DbSession) -> ApiEnvelope:
    row = db.get(MdmUdi, UUID(udi_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "UDI not found"})
    db.delete(row)
    db.commit()
    return ApiEnvelope(data={"deleted": 1, "id": udi_id})


# ── UDI 主数据外部 API ──

@master_data_router.get("/udis")
def list_master_udis(db: DbSession, keyword: str | None = Query(None), status: str | None = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> dict:
    q = select(MdmUdi)
    if keyword:
        q = q.where(MdmUdi.product_name.ilike(f"%{keyword}%") | MdmUdi.di.ilike(f"%{keyword}%"))
    if status and status != "all":
        q = q.where(MdmUdi.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(MdmUdi.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    records = [{"id": str(r.id), "di": r.di, "code": r.di, "name": r.product_name, "product_name": r.product_name, "registration_no": r.registration_no, "status": r.status} for r in rows]
    return ApiEnvelope(data={"records": records, "total": total, "page": page, "page_size": page_size}).model_dump()


@master_data_router.get("/udis/{udi_id}")
def get_master_udi_detail(db: DbSession, udi_id: str) -> dict:
    row = db.get(MdmUdi, UUID(udi_id))
    if not row:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "UDI not found"})
    return ApiEnvelope(data=_udi_to_dict(row)).model_dump()
