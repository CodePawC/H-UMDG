from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.deps import DbSession, OrganizationManageAuth
from app.api.schemas import (
    ApiEnvelope,
    CampusRequest,
    CampusStatusUpdate,
    DepartmentDisciplineMappingRequest,
    DisciplineRequest,
    DisciplineStatusUpdate,
    PageMeta,
    PagedResult,
    PersonRequest,
    PersonStatusUpdate,
)
from app.models.tables import (
    DepartmentDisciplineMapping,
    DictCampus,
    DictDepartment,
    DictDiscipline,
    DictPerson,
)
from app.services.organization_master import (
    campus_payload,
    department_payload,
    discipline_payload,
    ensure_organization_seed_data,
    list_campuses,
    list_department_discipline_mappings,
    list_departments,
    list_disciplines,
    list_persons,
    mapping_payload,
    person_payload,
)

router = APIRouter()


def _status(value: str) -> str:
    status = value.strip().upper()
    if status not in {"ACTIVE", "INACTIVE"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_FAILED", "message": "status must be ACTIVE or INACTIVE"},
        )
    return status


def _paged(items: list[dict], page: int, page_size: int, total: int) -> ApiEnvelope:
    return ApiEnvelope(data=PagedResult(items=items, page=PageMeta(page=page, page_size=page_size, total=total)))


@router.post("/campuses", response_model=ApiEnvelope)
def upsert_campus(
    payload: CampusRequest,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    row = db.scalar(select(DictCampus).where(DictCampus.campus_code == payload.campus_code))
    if row is None:
        row = DictCampus(campus_code=payload.campus_code, campus_name=payload.campus_name)
        db.add(row)
    row.campus_name = payload.campus_name
    row.campus_short_name = payload.campus_short_name
    row.organization_id = payload.organization_id
    row.address = payload.address
    row.status = _status(payload.status)
    row.sort_order = payload.sort_order
    row.remark = payload.remark
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=campus_payload(row))


@router.get("/campuses", response_model=ApiEnvelope)
def search_campuses(
    _: OrganizationManageAuth,
    db: DbSession,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> ApiEnvelope:
    items, total, page, page_size = list_campuses(db, keyword=keyword, status=status, page=page, page_size=page_size)
    return _paged(items, page, page_size, total)


@router.patch("/campuses/{campus_code}/status", response_model=ApiEnvelope)
def update_campus_status(
    campus_code: str,
    payload: CampusStatusUpdate,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    row = db.scalar(select(DictCampus).where(DictCampus.campus_code == campus_code))
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "CAMPUS_NOT_FOUND", "message": f"campus {campus_code} was not found"})
    row.status = _status(payload.status)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=campus_payload(row))


@router.post("/departments", response_model=ApiEnvelope)
def upsert_department(
    payload: dict,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    ensure_organization_seed_data(db)
    dept_code = str(payload.get("dept_code") or payload.get("department_code") or "").strip()
    dept_name = str(payload.get("dept_name") or payload.get("department_name") or "").strip()
    if not dept_code or not dept_name:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION_FAILED", "message": "dept_code and dept_name are required"})
    campus_id = payload.get("campus_id")
    if not campus_id and payload.get("campus_code"):
        campus = db.scalar(select(DictCampus).where(DictCampus.campus_code == str(payload["campus_code"])))
        campus_id = campus.campus_id if campus else None
    if campus_id and db.get(DictCampus, campus_id) is None:
        raise HTTPException(status_code=422, detail={"code": "CAMPUS_NOT_FOUND", "message": "campus_id does not exist"})
    row = db.scalar(select(DictDepartment).where(DictDepartment.dept_code == dept_code))
    if row is None:
        row = DictDepartment(dept_code=dept_code, dept_name=dept_name, status="ACTIVE")
        db.add(row)
    row.dept_name = dept_name
    row.dept_alias = payload.get("dept_alias") or payload.get("department_alias")
    row.dept_short_name = payload.get("dept_short_name") or payload.get("department_short_name")
    row.campus_id = campus_id
    row.parent_dept_id = payload.get("parent_dept_id") or payload.get("parent_department_id")
    row.dept_type = payload.get("dept_type") or payload.get("department_type")
    row.is_clinical = bool(payload.get("is_clinical", row.is_clinical))
    row.is_medtech = bool(payload.get("is_medtech", row.is_medtech))
    row.is_nursing_unit = bool(payload.get("is_nursing_unit", row.is_nursing_unit))
    row.is_admin = bool(payload.get("is_admin", row.is_admin))
    row.is_logistics = bool(payload.get("is_logistics", row.is_logistics))
    row.ward_flag = bool(payload.get("ward_flag", row.ward_flag))
    row.cost_center_code = payload.get("cost_center_code")
    row.his_department_code = payload.get("his_department_code")
    row.hris_department_code = payload.get("hris_department_code")
    row.finance_department_code = payload.get("finance_department_code")
    row.oid = payload.get("oid")
    row.status = _status(str(payload.get("status") or row.status or "ACTIVE"))
    row.sort_order = int(payload.get("sort_order") or row.sort_order or 0)
    row.remark = payload.get("remark")
    db.commit()
    db.refresh(row)
    campus = db.get(DictCampus, row.campus_id) if row.campus_id else None
    parent = db.get(DictDepartment, row.parent_dept_id) if row.parent_dept_id else None
    return ApiEnvelope(data=department_payload(row, campus=campus, parent=parent))


@router.post("/persons", response_model=ApiEnvelope)
def upsert_person(
    payload: PersonRequest,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    ensure_organization_seed_data(db)
    if payload.department_id and db.get(DictDepartment, payload.department_id) is None:
        raise HTTPException(status_code=422, detail={"code": "DEPARTMENT_NOT_FOUND", "message": "department_id does not exist"})
    if payload.campus_id and db.get(DictCampus, payload.campus_id) is None:
        raise HTTPException(status_code=422, detail={"code": "CAMPUS_NOT_FOUND", "message": "campus_id does not exist"})
    row = db.scalar(select(DictPerson).where(DictPerson.person_code == payload.person_code))
    if row is None:
        row = DictPerson(person_code=payload.person_code, person_name=payload.person_name)
        db.add(row)
    row.employee_no = payload.employee_no
    row.person_name = payload.person_name
    row.gender = payload.gender
    row.department_id = payload.department_id
    row.campus_id = payload.campus_id
    row.position = payload.position
    row.job_title = payload.job_title
    row.professional_title = payload.professional_title
    row.person_type = payload.person_type
    row.phone = payload.phone
    row.email = payload.email
    row.status = _status(payload.status)
    row.login_account = payload.login_account
    row.external_user_id = payload.external_user_id
    row.sort_order = payload.sort_order
    row.remark = payload.remark
    db.commit()
    db.refresh(row)
    return ApiEnvelope(
        data=person_payload(
            row,
            department=db.get(DictDepartment, row.department_id) if row.department_id else None,
            campus=db.get(DictCampus, row.campus_id) if row.campus_id else None,
        )
    )


@router.get("/persons/search", response_model=ApiEnvelope)
def search_persons(
    _: OrganizationManageAuth,
    db: DbSession,
    keyword: str | None = None,
    department_id: UUID | None = None,
    campus_id: UUID | None = None,
    person_type: str | None = None,
    status: str | None = "ACTIVE",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> ApiEnvelope:
    items, total, page, page_size = list_persons(
        db,
        keyword=keyword,
        department_id=department_id,
        campus_id=campus_id,
        person_type=person_type,
        status=status,
        page=page,
        page_size=page_size,
    )
    return _paged(items, page, page_size, total)


@router.patch("/persons/{person_code}/status", response_model=ApiEnvelope)
def update_person_status(
    person_code: str,
    payload: PersonStatusUpdate,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    row = db.scalar(select(DictPerson).where(DictPerson.person_code == person_code))
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "PERSON_NOT_FOUND", "message": f"person {person_code} was not found"})
    row.status = _status(payload.status)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=person_payload(row))


@router.post("/disciplines", response_model=ApiEnvelope)
def upsert_discipline(
    payload: DisciplineRequest,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    ensure_organization_seed_data(db)
    if payload.parent_discipline_id and db.get(DictDiscipline, payload.parent_discipline_id) is None:
        raise HTTPException(status_code=422, detail={"code": "DISCIPLINE_NOT_FOUND", "message": "parent_discipline_id does not exist"})
    row = db.scalar(select(DictDiscipline).where(DictDiscipline.discipline_code == payload.discipline_code))
    if row is None:
        row = DictDiscipline(discipline_code=payload.discipline_code, discipline_name=payload.discipline_name)
        db.add(row)
    row.discipline_name = payload.discipline_name
    row.discipline_short_name = payload.discipline_short_name
    row.discipline_type = payload.discipline_type
    row.parent_discipline_id = payload.parent_discipline_id
    row.level = payload.level
    row.is_key_discipline = payload.is_key_discipline
    row.status = _status(payload.status)
    row.sort_order = payload.sort_order
    row.remark = payload.remark
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=discipline_payload(row))


@router.get("/disciplines/search", response_model=ApiEnvelope)
def search_disciplines(
    _: OrganizationManageAuth,
    db: DbSession,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> ApiEnvelope:
    items, total, page, page_size = list_disciplines(db, keyword=keyword, status=status, page=page, page_size=page_size)
    return _paged(items, page, page_size, total)


@router.patch("/disciplines/{discipline_code}/status", response_model=ApiEnvelope)
def update_discipline_status(
    discipline_code: str,
    payload: DisciplineStatusUpdate,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    row = db.scalar(select(DictDiscipline).where(DictDiscipline.discipline_code == discipline_code))
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "DISCIPLINE_NOT_FOUND", "message": f"discipline {discipline_code} was not found"})
    row.status = _status(payload.status)
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=discipline_payload(row))


@router.post("/department-discipline-mappings", response_model=ApiEnvelope)
def upsert_department_discipline_mapping(
    payload: DepartmentDisciplineMappingRequest,
    _: OrganizationManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    ensure_organization_seed_data(db)
    department = db.get(DictDepartment, payload.department_id)
    discipline = db.get(DictDiscipline, payload.discipline_id)
    if department is None:
        raise HTTPException(status_code=422, detail={"code": "DEPARTMENT_NOT_FOUND", "message": "department_id does not exist"})
    if discipline is None:
        raise HTTPException(status_code=422, detail={"code": "DISCIPLINE_NOT_FOUND", "message": "discipline_id does not exist"})
    row = db.scalar(
        select(DepartmentDisciplineMapping).where(
            DepartmentDisciplineMapping.department_id == payload.department_id,
            DepartmentDisciplineMapping.discipline_id == payload.discipline_id,
            DepartmentDisciplineMapping.relation_type == payload.relation_type,
        )
    )
    if row is None:
        row = DepartmentDisciplineMapping(
            department_id=payload.department_id,
            discipline_id=payload.discipline_id,
            relation_type=payload.relation_type,
        )
        db.add(row)
    row.is_primary = payload.is_primary
    row.weight = Decimal(str(payload.weight)) if payload.weight is not None else None
    row.effective_date = payload.effective_date
    row.expired_date = payload.expired_date
    row.status = _status(payload.status)
    row.remark = payload.remark
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=mapping_payload(row, department=department, discipline=discipline))


@router.get("/department-discipline-mappings", response_model=ApiEnvelope)
def search_department_discipline_mappings(
    _: OrganizationManageAuth,
    db: DbSession,
    department_id: UUID | None = None,
    discipline_id: UUID | None = None,
    status: str | None = "ACTIVE",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> ApiEnvelope:
    items, total, page, page_size = list_department_discipline_mappings(
        db,
        department_id=department_id,
        discipline_id=discipline_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    return _paged(items, page, page_size, total)
