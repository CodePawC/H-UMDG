from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.tables import (
    DepartmentDisciplineMapping,
    DictCampus,
    DictDepartment,
    DictDiscipline,
    DictPerson,
)


ORG_MASTER_VERSION = "ORG-MDM-20260528"


def normalize_page(page: int, page_size: int, *, max_size: int = 200) -> tuple[int, int]:
    return max(page, 1), min(max(page_size, 1), max_size)


def _iso(value: Any) -> str | None:
    return value.isoformat() if value is not None and hasattr(value, "isoformat") else None


def _enabled(status: str | None) -> bool:
    return str(status or "").upper() == "ACTIVE"


def _version(updated_at: Any) -> str:
    return _iso(updated_at) or ORG_MASTER_VERSION


def _uuid(value: Any) -> str | None:
    return str(value) if value else None


def _dict_by_id(rows: list[Any], key: str) -> dict[Any, Any]:
    return {getattr(row, key): row for row in rows}


def campus_payload(row: DictCampus) -> dict[str, Any]:
    return {
        "id": str(row.campus_id),
        "code": row.campus_code,
        "name": row.campus_name,
        "shortName": row.campus_short_name,
        "campusId": str(row.campus_id),
        "campusCode": row.campus_code,
        "campusName": row.campus_name,
        "campusShortName": row.campus_short_name,
        "campus_id": str(row.campus_id),
        "campus_code": row.campus_code,
        "campus_name": row.campus_name,
        "campus_short_name": row.campus_short_name,
        "organizationId": row.organization_id,
        "organization_id": row.organization_id,
        "address": row.address,
        "status": row.status,
        "enabled": _enabled(row.status),
        "sortOrder": row.sort_order,
        "sort_order": row.sort_order,
        "remark": row.remark,
        "source": "h-mdm",
        "version": _version(row.updated_at),
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
    }


def department_payload(
    row: DictDepartment,
    *,
    campus: DictCampus | None = None,
    parent: DictDepartment | None = None,
) -> dict[str, Any]:
    return {
        "id": str(row.dept_id),
        "code": row.dept_code,
        "name": row.dept_name,
        "shortName": row.dept_short_name or row.dept_alias,
        "departmentId": str(row.dept_id),
        "departmentCode": row.dept_code,
        "departmentName": row.dept_name,
        "departmentShortName": row.dept_short_name or row.dept_alias,
        "department_id": str(row.dept_id),
        "department_code": row.dept_code,
        "department_name": row.dept_name,
        "department_short_name": row.dept_short_name or row.dept_alias,
        "departmentAlias": row.dept_alias,
        "dept_alias": row.dept_alias,
        "parentId": _uuid(row.parent_dept_id),
        "parentDepartmentId": _uuid(row.parent_dept_id),
        "parentDepartmentName": parent.dept_name if parent else None,
        "parent_department_id": _uuid(row.parent_dept_id),
        "campusId": _uuid(row.campus_id),
        "campusCode": campus.campus_code if campus else None,
        "campusName": campus.campus_name if campus else None,
        "campus_id": _uuid(row.campus_id),
        "campus_code": campus.campus_code if campus else None,
        "campus_name": campus.campus_name if campus else None,
        "type": row.dept_type,
        "departmentType": row.dept_type,
        "department_type": row.dept_type,
        "isClinical": row.is_clinical,
        "isMedtech": row.is_medtech,
        "isNursingUnit": row.is_nursing_unit,
        "isAdmin": row.is_admin,
        "isLogistics": row.is_logistics,
        "wardFlag": row.ward_flag,
        "is_clinical": row.is_clinical,
        "is_medtech": row.is_medtech,
        "is_nursing_unit": row.is_nursing_unit,
        "is_admin": row.is_admin,
        "is_logistics": row.is_logistics,
        "ward_flag": row.ward_flag,
        "costCenterCode": row.cost_center_code,
        "hisDepartmentCode": row.his_department_code,
        "hrisDepartmentCode": row.hris_department_code,
        "financeDepartmentCode": row.finance_department_code,
        "cost_center_code": row.cost_center_code,
        "his_department_code": row.his_department_code,
        "hris_department_code": row.hris_department_code,
        "finance_department_code": row.finance_department_code,
        "oid": row.oid,
        "status": row.status,
        "enabled": _enabled(row.status),
        "sortOrder": row.sort_order,
        "sort_order": row.sort_order,
        "effectiveDate": _iso(row.effective_date),
        "expiredDate": _iso(row.expired_date),
        "effective_date": _iso(row.effective_date),
        "expired_date": _iso(row.expired_date),
        "remark": row.remark,
        "source": "h-mdm",
        "version": _version(row.updated_at),
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
    }


def person_payload(
    row: DictPerson,
    *,
    department: DictDepartment | None = None,
    campus: DictCampus | None = None,
) -> dict[str, Any]:
    return {
        "id": str(row.person_id),
        "code": row.person_code,
        "name": row.person_name,
        "personId": str(row.person_id),
        "personCode": row.person_code,
        "employeeNo": row.employee_no,
        "personName": row.person_name,
        "person_id": str(row.person_id),
        "person_code": row.person_code,
        "employee_no": row.employee_no,
        "person_name": row.person_name,
        "gender": row.gender,
        "departmentId": _uuid(row.department_id),
        "departmentCode": department.dept_code if department else None,
        "departmentName": department.dept_name if department else None,
        "department_id": _uuid(row.department_id),
        "department_code": department.dept_code if department else None,
        "department_name": department.dept_name if department else None,
        "campusId": _uuid(row.campus_id),
        "campusCode": campus.campus_code if campus else None,
        "campusName": campus.campus_name if campus else None,
        "campus_id": _uuid(row.campus_id),
        "campus_code": campus.campus_code if campus else None,
        "campus_name": campus.campus_name if campus else None,
        "position": row.position,
        "jobTitle": row.job_title,
        "professionalTitle": row.professional_title,
        "type": row.person_type,
        "personType": row.person_type,
        "job_title": row.job_title,
        "professional_title": row.professional_title,
        "person_type": row.person_type,
        "phone": row.phone,
        "email": row.email,
        "status": row.status,
        "enabled": _enabled(row.status),
        "loginAccount": row.login_account,
        "externalUserId": row.external_user_id,
        "login_account": row.login_account,
        "external_user_id": row.external_user_id,
        "sortOrder": row.sort_order,
        "sort_order": row.sort_order,
        "remark": row.remark,
        "source": "h-mdm",
        "version": _version(row.updated_at),
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
    }


def discipline_payload(
    row: DictDiscipline,
    *,
    parent: DictDiscipline | None = None,
    departments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "id": str(row.discipline_id),
        "code": row.discipline_code,
        "name": row.discipline_name,
        "shortName": row.discipline_short_name,
        "disciplineId": str(row.discipline_id),
        "disciplineCode": row.discipline_code,
        "disciplineName": row.discipline_name,
        "disciplineShortName": row.discipline_short_name,
        "discipline_id": str(row.discipline_id),
        "discipline_code": row.discipline_code,
        "discipline_name": row.discipline_name,
        "discipline_short_name": row.discipline_short_name,
        "type": row.discipline_type,
        "disciplineType": row.discipline_type,
        "discipline_type": row.discipline_type,
        "parentId": _uuid(row.parent_discipline_id),
        "parentDisciplineId": _uuid(row.parent_discipline_id),
        "parentDisciplineName": parent.discipline_name if parent else None,
        "parent_discipline_id": _uuid(row.parent_discipline_id),
        "level": row.level,
        "isKeyDiscipline": row.is_key_discipline,
        "is_key_discipline": row.is_key_discipline,
        "relatedDepartments": departments or [],
        "related_departments": departments or [],
        "status": row.status,
        "enabled": _enabled(row.status),
        "sortOrder": row.sort_order,
        "sort_order": row.sort_order,
        "remark": row.remark,
        "source": "h-mdm",
        "version": _version(row.updated_at),
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
    }


def mapping_payload(
    row: DepartmentDisciplineMapping,
    *,
    department: DictDepartment | None = None,
    discipline: DictDiscipline | None = None,
) -> dict[str, Any]:
    return {
        "id": str(row.mapping_id),
        "mappingId": str(row.mapping_id),
        "mapping_id": str(row.mapping_id),
        "departmentId": str(row.department_id),
        "departmentCode": department.dept_code if department else None,
        "departmentName": department.dept_name if department else None,
        "department_id": str(row.department_id),
        "department_code": department.dept_code if department else None,
        "department_name": department.dept_name if department else None,
        "disciplineId": str(row.discipline_id),
        "disciplineCode": discipline.discipline_code if discipline else None,
        "disciplineName": discipline.discipline_name if discipline else None,
        "discipline_id": str(row.discipline_id),
        "discipline_code": discipline.discipline_code if discipline else None,
        "discipline_name": discipline.discipline_name if discipline else None,
        "relationType": row.relation_type,
        "relation_type": row.relation_type,
        "isPrimary": row.is_primary,
        "is_primary": row.is_primary,
        "weight": float(row.weight) if row.weight is not None else None,
        "effectiveDate": _iso(row.effective_date),
        "expiredDate": _iso(row.expired_date),
        "effective_date": _iso(row.effective_date),
        "expired_date": _iso(row.expired_date),
        "status": row.status,
        "enabled": _enabled(row.status),
        "remark": row.remark,
        "source": "h-mdm",
        "version": _version(row.updated_at),
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
    }


def ensure_organization_seed_data(db: Session) -> None:
    campus = db.scalar(select(DictCampus).where(DictCampus.campus_code == "MAIN"))
    if campus is None:
        campus = DictCampus(
            campus_code="MAIN",
            campus_name="主院区",
            campus_short_name="主院区",
            organization_id="ORG-HOSPITAL",
            status="ACTIVE",
            sort_order=1,
            remark="系统默认院区，多院区治理预留",
        )
        db.add(campus)
        db.flush()

    def department(code: str, name: str, dept_type: str, **flags: Any) -> DictDepartment:
        row = db.scalar(select(DictDepartment).where(DictDepartment.dept_code == code))
        if row is None:
            row = DictDepartment(
                dept_code=code,
                dept_name=name,
                dept_short_name=flags.pop("dept_short_name", None),
                dept_type=dept_type,
                campus_id=campus.campus_id,
                status="ACTIVE",
                sort_order=flags.pop("sort_order", 0),
                **flags,
            )
            db.add(row)
            db.flush()
        elif row.campus_id is None:
            row.campus_id = campus.campus_id
        return row

    icu = department(
        "DEPT-ICU-01",
        "ICU一病区",
        "临床科室",
        dept_short_name="ICU",
        is_clinical=True,
        ward_flag=True,
        cost_center_code="CC-ICU-01",
        sort_order=10,
    )
    emergency = department(
        "DEPT-EMERGENCY",
        "急诊科",
        "临床科室",
        dept_short_name="急诊",
        is_clinical=True,
        sort_order=20,
    )
    equipment = department(
        "DEPT-EQUIP",
        "医学工程科",
        "行政职能科室",
        dept_short_name="医工科",
        is_admin=True,
        sort_order=30,
    )

    def person(code: str, name: str, dept: DictDepartment, **values: Any) -> DictPerson:
        row = db.scalar(select(DictPerson).where(DictPerson.person_code == code))
        if row is None:
            row = DictPerson(
                person_code=code,
                person_name=name,
                department_id=dept.dept_id,
                campus_id=campus.campus_id,
                status="ACTIVE",
                **values,
            )
            db.add(row)
            db.flush()
        return row

    person("P-ZHANG-ICU", "张主任", icu, employee_no="E1001", person_type="医生", position="科主任")
    person("P-LI-ENG", "李工程师", equipment, employee_no="E2001", person_type="设备工程师", position="设备工程师")

    def discipline(code: str, name: str, dtype: str, **values: Any) -> DictDiscipline:
        row = db.scalar(select(DictDiscipline).where(DictDiscipline.discipline_code == code))
        if row is None:
            row = DictDiscipline(
                discipline_code=code,
                discipline_name=name,
                discipline_type=dtype,
                status="ACTIVE",
                **values,
            )
            db.add(row)
            db.flush()
        return row

    critical = discipline("DISC-CCM", "重症医学", "二级学科", level=2, is_key_discipline=True, sort_order=10)
    emergency_disc = discipline("DISC-EM", "急诊医学", "二级学科", level=2, sort_order=20)
    medeng = discipline("DISC-ME", "医学工程", "平台支撑方向", level=1, sort_order=30)

    def mapping(dept: DictDepartment, disc: DictDiscipline, relation: str, primary: bool) -> None:
        exists = db.scalar(
            select(DepartmentDisciplineMapping).where(
                DepartmentDisciplineMapping.department_id == dept.dept_id,
                DepartmentDisciplineMapping.discipline_id == disc.discipline_id,
                DepartmentDisciplineMapping.status == "ACTIVE",
            )
        )
        if exists is None:
            db.add(
                DepartmentDisciplineMapping(
                    department_id=dept.dept_id,
                    discipline_id=disc.discipline_id,
                    relation_type=relation,
                    is_primary=primary,
                    weight=Decimal("100.00") if primary else Decimal("60.00"),
                    status="ACTIVE",
                )
            )

    mapping(icu, critical, "主责学科", True)
    mapping(emergency, emergency_disc, "主责学科", True)
    mapping(equipment, medeng, "平台支撑", True)
    db.flush()


def list_campuses(
    db: Session,
    *,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict[str, Any]], int, int, int]:
    ensure_organization_seed_data(db)
    query = select(DictCampus)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.where(or_(DictCampus.campus_code.ilike(like), DictCampus.campus_name.ilike(like)))
    if status and status != "all":
        query = query.where(DictCampus.status == status.upper())
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    page, page_size = normalize_page(page, page_size)
    rows = db.scalars(query.order_by(DictCampus.sort_order.asc(), DictCampus.campus_code.asc()).offset((page - 1) * page_size).limit(page_size)).all()
    return [campus_payload(row) for row in rows], total, page, page_size


def list_departments(
    db: Session,
    *,
    keyword: str | None = None,
    campus_id: UUID | str | None = None,
    department_type: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict[str, Any]], int, int, int]:
    ensure_organization_seed_data(db)
    query = select(DictDepartment)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.where(or_(DictDepartment.dept_code.ilike(like), DictDepartment.dept_name.ilike(like), DictDepartment.dept_alias.ilike(like)))
    if campus_id:
        query = query.where(DictDepartment.campus_id == campus_id)
    if department_type:
        query = query.where(DictDepartment.dept_type == department_type)
    if status and status != "all":
        query = query.where(DictDepartment.status == status.upper())
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    page, page_size = normalize_page(page, page_size)
    rows = db.scalars(query.order_by(DictDepartment.sort_order.asc(), DictDepartment.dept_code.asc()).offset((page - 1) * page_size).limit(page_size)).all()
    campus_map = _dict_by_id(db.scalars(select(DictCampus)).all(), "campus_id")
    dept_map = _dict_by_id(db.scalars(select(DictDepartment)).all(), "dept_id")
    return [
        department_payload(row, campus=campus_map.get(row.campus_id), parent=dept_map.get(row.parent_dept_id))
        for row in rows
    ], total, page, page_size


def department_tree(db: Session, *, keyword: str | None = None, campus_id: UUID | str | None = None) -> list[dict[str, Any]]:
    rows, _total, _page, _page_size = list_departments(
        db,
        keyword=keyword,
        campus_id=campus_id,
        status="ACTIVE",
        page=1,
        page_size=10000,
    )
    nodes = [{**row, "children": []} for row in rows]
    node_map = {row["id"]: row for row in nodes}
    roots: list[dict[str, Any]] = []
    for node in nodes:
        parent_id = node.get("parentId")
        parent = node_map.get(parent_id)
        if parent is not None:
            parent["children"].append(node)
        else:
            roots.append(node)
    return roots


def list_persons(
    db: Session,
    *,
    keyword: str | None = None,
    department_id: UUID | str | None = None,
    campus_id: UUID | str | None = None,
    person_type: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict[str, Any]], int, int, int]:
    ensure_organization_seed_data(db)
    query = select(DictPerson)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.where(or_(DictPerson.person_code.ilike(like), DictPerson.employee_no.ilike(like), DictPerson.person_name.ilike(like)))
    if department_id:
        query = query.where(DictPerson.department_id == department_id)
    if campus_id:
        query = query.where(DictPerson.campus_id == campus_id)
    if person_type:
        query = query.where(DictPerson.person_type == person_type)
    if status and status != "all":
        query = query.where(DictPerson.status == status.upper())
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    page, page_size = normalize_page(page, page_size)
    rows = db.scalars(query.order_by(DictPerson.sort_order.asc(), DictPerson.employee_no.asc().nulls_last(), DictPerson.person_code.asc()).offset((page - 1) * page_size).limit(page_size)).all()
    department_map = _dict_by_id(db.scalars(select(DictDepartment)).all(), "dept_id")
    campus_map = _dict_by_id(db.scalars(select(DictCampus)).all(), "campus_id")
    return [
        person_payload(row, department=department_map.get(row.department_id), campus=campus_map.get(row.campus_id))
        for row in rows
    ], total, page, page_size


def list_disciplines(
    db: Session,
    *,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict[str, Any]], int, int, int]:
    ensure_organization_seed_data(db)
    query = select(DictDiscipline)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.where(or_(DictDiscipline.discipline_code.ilike(like), DictDiscipline.discipline_name.ilike(like)))
    if status and status != "all":
        query = query.where(DictDiscipline.status == status.upper())
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    page, page_size = normalize_page(page, page_size)
    rows = db.scalars(query.order_by(DictDiscipline.sort_order.asc(), DictDiscipline.discipline_code.asc()).offset((page - 1) * page_size).limit(page_size)).all()
    discipline_map = _dict_by_id(db.scalars(select(DictDiscipline)).all(), "discipline_id")
    related = related_departments_by_discipline(db)
    return [
        discipline_payload(row, parent=discipline_map.get(row.parent_discipline_id), departments=related.get(row.discipline_id, []))
        for row in rows
    ], total, page, page_size


def discipline_tree(db: Session, *, keyword: str | None = None) -> list[dict[str, Any]]:
    rows, _total, _page, _page_size = list_disciplines(db, keyword=keyword, status="ACTIVE", page=1, page_size=10000)
    nodes = [{**row, "children": []} for row in rows]
    node_map = {row["id"]: row for row in nodes}
    roots: list[dict[str, Any]] = []
    for node in nodes:
        parent_id = node.get("parentId")
        parent = node_map.get(parent_id)
        if parent is not None:
            parent["children"].append(node)
        else:
            roots.append(node)
    return roots


def related_departments_by_discipline(db: Session) -> dict[Any, list[dict[str, Any]]]:
    mappings = db.scalars(
        select(DepartmentDisciplineMapping).where(DepartmentDisciplineMapping.status == "ACTIVE")
    ).all()
    department_map = _dict_by_id(db.scalars(select(DictDepartment)).all(), "dept_id")
    result: dict[Any, list[dict[str, Any]]] = {}
    for mapping in mappings:
        department = department_map.get(mapping.department_id)
        if department is None:
            continue
        result.setdefault(mapping.discipline_id, []).append(
            {
                "departmentId": str(department.dept_id),
                "departmentCode": department.dept_code,
                "departmentName": department.dept_name,
                "relationType": mapping.relation_type,
                "isPrimary": mapping.is_primary,
            }
        )
    return result


def list_department_discipline_mappings(
    db: Session,
    *,
    department_id: UUID | str | None = None,
    discipline_id: UUID | str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict[str, Any]], int, int, int]:
    ensure_organization_seed_data(db)
    query = select(DepartmentDisciplineMapping)
    if department_id:
        query = query.where(DepartmentDisciplineMapping.department_id == department_id)
    if discipline_id:
        query = query.where(DepartmentDisciplineMapping.discipline_id == discipline_id)
    if status and status != "all":
        query = query.where(DepartmentDisciplineMapping.status == status.upper())
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    page, page_size = normalize_page(page, page_size)
    rows = db.scalars(query.order_by(DepartmentDisciplineMapping.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    department_map = _dict_by_id(db.scalars(select(DictDepartment)).all(), "dept_id")
    discipline_map = _dict_by_id(db.scalars(select(DictDiscipline)).all(), "discipline_id")
    return [
        mapping_payload(row, department=department_map.get(row.department_id), discipline=discipline_map.get(row.discipline_id))
        for row in rows
    ], total, page, page_size
