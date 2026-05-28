from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
import hashlib
import time
import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.models.tables import (
    ApiCallLog,
    ApiClient,
    CatalogChangeHistory,
    CatalogCorrectionOrder,
    DeviceClassificationCatalogVersion,
    DictDepartment,
    DictDiscipline,
    DictPerson,
    RefDeviceClassificationCatalog,
    RefDeviceClassificationRevision,
)
from app.services.organization_master import (
    department_tree,
    discipline_tree,
    list_campuses,
    list_department_discipline_mappings,
    list_departments,
    list_disciplines,
    list_persons,
)
from app.services.manufacturer_vendors import (
    match_business_partner,
    normalize_role_type,
    search_vendors,
    vendor_payload,
    list_mdm_external_mappings,
    list_organization_qualifications,
    list_vendor_roles,
)

router = APIRouter(prefix="/master-data")

DEFAULT_CLIENTS = [
    ("HOSPITAL_DATA_BUS", "医院数据总线", "hudmp-dbus-dev-20260525"),
    ("EQUIPMENT_OS", "医学装备运营平台", "hudmp-equipment-os-dev-20260525"),
    ("HIS", "HIS系统", "hudmp-his-dev-20260525"),
    ("SPD", "SPD系统", "hudmp-spd-dev-20260525"),
    ("MEDICAL_INSURANCE", "医保接口平台", "hudmp-mi-dev-20260525"),
]
DEFAULT_SCOPES = [
    "md:device-classification:read",
    "md:device-classification:tree",
    "md:device-classification:changes",
    "md:organization:read",
    "md:organization:tree",
    "md:person:read",
    "md:discipline:read",
    "md:discipline:tree",
    "md:business-partner:read",
    "md:business-partner:match",
]
VISIBLE_STATUSES = {"effective"}
HISTORY_STATUSES = {"pending_confirm", "parse_abnormal", "corrected", "deprecated", "merged", "rollbacked"}


class ExternalApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


def _now() -> datetime:
    return datetime.now(UTC)


def _timestamp() -> str:
    return _now().isoformat()


def _trace_id(request: Request) -> str:
    return request.headers.get("X-Request-ID") or f"req-{uuid.uuid4().hex[:16]}"


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else None


def _api_key_hash(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def _extract_api_key(request: Request) -> str | None:
    authorization = request.headers.get("authorization") or request.headers.get("Authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return request.headers.get("X-API-Key")


def _seed_api_clients(db: Session) -> None:
    existing = db.scalar(select(func.count()).select_from(ApiClient))
    if existing:
        return
    for client_id, client_name, api_key in DEFAULT_CLIENTS:
        db.add(
            ApiClient(
                client_id=client_id,
                client_name=client_name,
                api_key_hash=_api_key_hash(api_key),
                allowed_scopes=DEFAULT_SCOPES,
                status="active",
            )
        )
    db.flush()


def _authenticate_client(db: Session, request: Request, required_scope: str) -> ApiClient:
    api_key = _extract_api_key(request)
    if not api_key:
        raise ExternalApiError(401, "API_KEY_MISSING", "API Key is required")
    _seed_api_clients(db)
    client = db.scalar(select(ApiClient).where(ApiClient.api_key_hash == _api_key_hash(api_key)))
    if client is None or client.status != "active":
        raise ExternalApiError(401, "API_KEY_INVALID", "API Key invalid or disabled")
    scopes = set(client.allowed_scopes or [])
    if required_scope not in scopes:
        raise ExternalApiError(403, "SCOPE_FORBIDDEN", f"scope {required_scope} is required")
    client.last_used_at = _now()
    return client


def _response(data: Any, trace_id: str) -> dict[str, Any]:
    return {
        "success": True,
        "code": "OK",
        "message": "success",
        "data": data,
        "traceId": trace_id,
        "timestamp": _timestamp(),
    }


def _error_response(status_code: int, code: str, message: str, trace_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "code": code,
            "message": message,
            "data": None,
            "traceId": trace_id,
            "timestamp": _timestamp(),
        },
    )


def _record_call(
    db: Session,
    request: Request,
    *,
    trace_id: str,
    client_id: str | None,
    status_code: int,
    success: bool,
    started_at: float,
    result_count: int | None = None,
    error_message: str | None = None,
) -> None:
    db.add(
        ApiCallLog(
            trace_id=trace_id,
            client_id=client_id,
            endpoint=request.url.path,
            method=request.method,
            query_params=dict(request.query_params),
            status_code=status_code,
            success=success,
            duration_ms=max(int((time.perf_counter() - started_at) * 1000), 0),
            result_count=result_count,
            client_ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            error_message=error_message,
        )
    )


def _run_external(
    db: Session,
    request: Request,
    *,
    required_scope: str,
    handler: Callable[[ApiClient], tuple[Any, int | None]],
):
    started_at = time.perf_counter()
    trace_id = _trace_id(request)
    client_id: str | None = None
    try:
        client = _authenticate_client(db, request, required_scope)
        client_id = client.client_id
        data, result_count = handler(client)
        _record_call(
            db,
            request,
            trace_id=trace_id,
            client_id=client_id,
            status_code=200,
            success=True,
            started_at=started_at,
            result_count=result_count,
        )
        db.commit()
        return _response(data, trace_id)
    except ExternalApiError as exc:
        _record_call(
            db,
            request,
            trace_id=trace_id,
            client_id=client_id,
            status_code=exc.status_code,
            success=False,
            started_at=started_at,
            error_message=exc.message,
        )
        db.commit()
        return _error_response(exc.status_code, exc.code, exc.message, trace_id)
    except Exception as exc:
        db.rollback()
        _record_call(
            db,
            request,
            trace_id=trace_id,
            client_id=client_id,
            status_code=500,
            success=False,
            started_at=started_at,
            error_message=str(exc),
        )
        db.commit()
        return _error_response(500, "INTERNAL_ERROR", "master data service error", trace_id)


def _catalog_code(row: RefDeviceClassificationCatalog) -> str:
    return row.category_no or row.level_2_category_no or row.level_1_category_no or row.major_category_no or ""


def _catalog_name(row: RefDeviceClassificationCatalog) -> str:
    return row.level_2_category or row.level_1_category or row.major_category_name or ""


def _level_no(row: RefDeviceClassificationCatalog) -> int:
    if row.level_2_category or row.level_2_category_no or row.category_no:
        return 3
    if row.level_1_category or row.level_1_category_no:
        return 2
    return 1


def _parent_id(row: RefDeviceClassificationCatalog) -> str | None:
    if _level_no(row) == 3:
        return row.level_1_category_no or row.major_category_no
    if _level_no(row) == 2:
        return row.major_category_no
    return None


def _catalog_payload(row: RefDeviceClassificationCatalog) -> dict[str, Any]:
    return {
        "id": str(row.catalog_id),
        "code": _catalog_code(row),
        "parentId": _parent_id(row),
        "level": _level_no(row),
        "name": _catalog_name(row),
        "majorCategoryCode": row.major_category_no,
        "majorCategoryName": row.major_category_name,
        "level1CategoryCode": row.level_1_category_no,
        "level1CategoryName": row.level_1_category,
        "level2CategoryCode": row.level_2_category_no,
        "level2CategoryName": row.level_2_category,
        "productDescription": row.product_description,
        "intendedUse": row.intended_use,
        "productExamples": row.product_examples,
        "managementClass": row.management_class,
        "status": row.data_status,
        "sourceBatchId": row.batch_id,
        "sourceFileName": row.source_file_name,
        "sourcePosition": f"第 {row.row_number} 行" if row.row_number else None,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


def _base_catalog_query(
    *,
    include_deprecated: bool,
    status: str | None = "effective",
):
    query = select(RefDeviceClassificationCatalog)
    if include_deprecated:
        if status and status != "all":
            query = query.where(RefDeviceClassificationCatalog.data_status == status)
    else:
        query = query.where(
            RefDeviceClassificationCatalog.data_status == "effective",
            RefDeviceClassificationCatalog.hidden_in_tree.is_(False),
        )
    return query


def _apply_catalog_filters(
    db: Session,
    query,
    *,
    keyword: str | None,
    category_code: str | None,
    parent_id: str | None,
    level: int | None,
    management_class: str | None,
    version_id: str | None,
):
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.where(
            or_(
                RefDeviceClassificationCatalog.major_category_name.ilike(like),
                RefDeviceClassificationCatalog.level_1_category.ilike(like),
                RefDeviceClassificationCatalog.level_2_category.ilike(like),
                RefDeviceClassificationCatalog.product_description.ilike(like),
                RefDeviceClassificationCatalog.intended_use.ilike(like),
                RefDeviceClassificationCatalog.product_examples.ilike(like),
                RefDeviceClassificationCatalog.category_no.ilike(like),
                RefDeviceClassificationCatalog.major_category_no.ilike(like),
                RefDeviceClassificationCatalog.level_1_category_no.ilike(like),
                RefDeviceClassificationCatalog.level_2_category_no.ilike(like),
            )
        )
    if category_code:
        query = query.where(
            or_(
                RefDeviceClassificationCatalog.category_no == category_code,
                RefDeviceClassificationCatalog.major_category_no == category_code,
                RefDeviceClassificationCatalog.level_1_category_no == category_code,
                RefDeviceClassificationCatalog.level_2_category_no == category_code,
            )
        )
    if parent_id:
        query = query.where(
            or_(
                RefDeviceClassificationCatalog.major_category_no == parent_id,
                RefDeviceClassificationCatalog.level_1_category_no == parent_id,
                RefDeviceClassificationCatalog.level_2_category_no == parent_id,
            )
        )
    if level == 1:
        query = query.where(RefDeviceClassificationCatalog.level_1_category_no.is_(None), RefDeviceClassificationCatalog.level_2_category_no.is_(None))
    elif level == 2:
        query = query.where(RefDeviceClassificationCatalog.level_1_category_no.is_not(None), RefDeviceClassificationCatalog.level_2_category_no.is_(None))
    elif level == 3:
        query = query.where(or_(RefDeviceClassificationCatalog.level_2_category_no.is_not(None), RefDeviceClassificationCatalog.category_no.is_not(None)))
    if management_class:
        query = query.where(RefDeviceClassificationCatalog.management_class == management_class)
    if version_id:
        resolved_batch_id = _resolve_version_batch_id(db, version_id)
        query = query.where(RefDeviceClassificationCatalog.batch_id == resolved_batch_id)
    return query


def _resolve_version_batch_id(db: Session, version_id: str) -> str:
    version = None
    try:
        version_uuid = uuid.UUID(str(version_id))
        version = db.get(DeviceClassificationCatalogVersion, version_uuid)
    except ValueError:
        version = db.scalar(
            select(DeviceClassificationCatalogVersion).where(DeviceClassificationCatalogVersion.version_no == version_id).limit(1)
        )
    return version.batch_id if version else version_id


def _order_catalog_query(query):
    return query.order_by(
        RefDeviceClassificationCatalog.major_category_no.nulls_last(),
        RefDeviceClassificationCatalog.level_1_category_no.nulls_last(),
        RefDeviceClassificationCatalog.level_2_category_no.nulls_last(),
        RefDeviceClassificationCatalog.category_no.nulls_last(),
        RefDeviceClassificationCatalog.row_number.asc(),
    )


def _require_history_scope(client: ApiClient, include_history: bool) -> None:
    if include_history and "md:device-classification:history" not in set(client.allowed_scopes or []):
        raise ExternalApiError(403, "SCOPE_FORBIDDEN", "includeDeprecated requires md:device-classification:history")


@router.get("/device-classification/catalog")
def list_device_classification_catalog(
    request: Request,
    db: DbSession,
    keyword: str | None = None,
    categoryCode: str | None = None,
    parentId: str | None = None,
    level: int | None = None,
    managementClass: str | None = None,
    status: str = "effective",
    versionId: str | None = None,
    page: int = 1,
    pageSize: int = 20,
):
    def handler(client: ApiClient):
        include_history = status != "effective"
        _require_history_scope(client, include_history)
        query = _base_catalog_query(include_deprecated=include_history, status=status)
        query = _apply_catalog_filters(
            db,
            query,
            keyword=keyword,
            category_code=categoryCode,
            parent_id=parentId,
            level=level,
            management_class=managementClass,
            version_id=versionId,
        )
        total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
        page_no = max(page, 1)
        page_size = min(max(pageSize, 1), 200)
        rows = db.scalars(_order_catalog_query(query).offset((page_no - 1) * page_size).limit(page_size)).all()
        records = [_catalog_payload(row) for row in rows]
        return {"records": records, "page": page_no, "pageSize": page_size, "total": total}, len(records)

    return _run_external(db, request, required_scope="md:device-classification:read", handler=handler)


@router.get("/device-classification/catalog/{id}")
def get_device_classification_catalog_detail(request: Request, db: DbSession, id: uuid.UUID, includeDeprecated: bool = False):
    def handler(client: ApiClient):
        _require_history_scope(client, includeDeprecated)
        row = db.get(RefDeviceClassificationCatalog, id)
        if row is None or (not includeDeprecated and (row.data_status != "effective" or row.hidden_in_tree)):
            raise ExternalApiError(404, "CATALOG_NOT_FOUND", "catalog item not found")
        return _catalog_payload(row), 1

    return _run_external(db, request, required_scope="md:device-classification:read", handler=handler)


@router.get("/device-classification/catalog/by-code/{code}")
def get_device_classification_catalog_by_code(request: Request, db: DbSession, code: str, includeDeprecated: bool = False):
    def handler(client: ApiClient):
        _require_history_scope(client, includeDeprecated)
        query = _base_catalog_query(include_deprecated=includeDeprecated, status="all" if includeDeprecated else "effective")
        query = query.where(
            or_(
                RefDeviceClassificationCatalog.category_no == code,
                RefDeviceClassificationCatalog.major_category_no == code,
                RefDeviceClassificationCatalog.level_1_category_no == code,
                RefDeviceClassificationCatalog.level_2_category_no == code,
            )
        )
        row = db.scalars(_order_catalog_query(query).limit(1)).first()
        if row is None:
            raise ExternalApiError(404, "CATALOG_NOT_FOUND", "catalog item not found")
        return _catalog_payload(row), 1

    return _run_external(db, request, required_scope="md:device-classification:read", handler=handler)


def _tree_node(node_id: str, code: str, name: str, level: int, parent_id: str | None = None) -> dict[str, Any]:
    return {"id": node_id, "code": code, "name": name, "level": level, "parentId": parent_id, "children": []}


@router.get("/device-classification/tree")
def get_device_classification_tree(
    request: Request,
    db: DbSession,
    versionId: str | None = None,
    includeDeprecated: bool = False,
    maxDepth: int | None = None,
    keyword: str | None = None,
):
    def handler(client: ApiClient):
        _require_history_scope(client, includeDeprecated)
        query = _base_catalog_query(include_deprecated=includeDeprecated, status="all" if includeDeprecated else "effective")
        query = _apply_catalog_filters(
            db,
            query,
            keyword=keyword,
            category_code=None,
            parent_id=None,
            level=None,
            management_class=None,
            version_id=versionId,
        )
        rows = db.scalars(_order_catalog_query(query).limit(10000)).all()
        roots: dict[str, dict[str, Any]] = {}
        level1_index: dict[tuple[str, str], dict[str, Any]] = {}
        for row in rows:
            if str(_catalog_name(row)).startswith("-"):
                continue
            if maxDepth is not None and maxDepth < _level_no(row):
                continue
            major_code = row.major_category_no or "UNCLASSIFIED"
            major_name = row.major_category_name or "未分类"
            major = roots.setdefault(major_code, _tree_node(major_code, major_code, major_name, 1))
            if maxDepth == 1:
                continue
            level1_code = row.level_1_category_no or row.category_no or major_code
            level1_name = row.level_1_category or row.level_2_category or major_name
            key = (major_code, level1_code)
            level1_node = level1_index.get(key)
            if level1_node is None:
                level1_node = _tree_node(level1_code, level1_code, level1_name, 2, major_code)
                level1_index[key] = level1_node
                major["children"].append(level1_node)
            if maxDepth == 2:
                continue
            if row.level_2_category_no or row.category_no or row.level_2_category:
                child_code = row.category_no or row.level_2_category_no or str(row.catalog_id)
                child_name = row.level_2_category or _catalog_name(row)
                if child_name and not child_name.startswith("-"):
                    level1_node["children"].append(_tree_node(str(row.catalog_id), child_code, child_name, 3, level1_code))
        records = list(roots.values())
        return {"records": records, "total": len(records)}, len(records)

    return _run_external(db, request, required_scope="md:device-classification:tree", handler=handler)


@router.get("/device-classification/current-version")
def get_device_classification_current_version(request: Request, db: DbSession):
    def handler(_: ApiClient):
        version = db.scalar(
            select(DeviceClassificationCatalogVersion)
            .where(DeviceClassificationCatalogVersion.is_current.is_(True))
            .order_by(DeviceClassificationCatalogVersion.created_at.desc())
            .limit(1)
        )
        if version is None:
            return {
                "versionId": None,
                "versionNo": "NMPA-2017-104",
                "status": "active",
                "isCurrent": True,
                "itemCount": int(db.scalar(select(func.count()).select_from(RefDeviceClassificationCatalog).where(RefDeviceClassificationCatalog.data_status == "effective")) or 0),
            }, 1
        return {
            "versionId": str(version.version_id),
            "versionNo": version.version_no,
            "status": "active" if version.is_current else "inactive",
            "isCurrent": version.is_current,
            "sourceFileName": version.source_file_name,
            "sourceSystem": version.source_system,
            "publishDate": version.publish_date.isoformat() if version.publish_date else None,
            "effectiveDate": version.effective_date.isoformat() if version.effective_date else None,
            "itemCount": version.item_count,
            "abnormalCount": version.abnormal_count,
            "createdAt": version.created_at.isoformat() if version.created_at else None,
        }, 1

    return _run_external(db, request, required_scope="md:device-classification:read", handler=handler)


def _parse_since(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        raise ExternalApiError(400, "INVALID_SINCE", "since must be ISO datetime") from None


@router.get("/device-classification/changes")
def list_device_classification_changes(
    request: Request,
    db: DbSession,
    since: str | None = None,
    versionId: str | None = None,
    changeType: str | None = None,
    page: int = 1,
    pageSize: int = 20,
):
    def handler(_: ApiClient):
        since_dt = _parse_since(since)
        records: list[dict[str, Any]] = []
        revision_query = select(RefDeviceClassificationRevision)
        if since_dt is not None:
            revision_query = revision_query.where(RefDeviceClassificationRevision.created_at >= since_dt)
        if versionId:
            revision_query = revision_query.where(RefDeviceClassificationRevision.batch_id == versionId)
        if changeType:
            revision_query = revision_query.where(RefDeviceClassificationRevision.change_type == changeType)
        for row in db.scalars(revision_query.order_by(RefDeviceClassificationRevision.created_at.desc()).limit(5000)).all():
            records.append(
                {
                    "changeId": str(row.revision_id),
                    "changeType": row.change_type,
                    "catalogId": str(row.new_catalog_id or row.old_catalog_id) if (row.new_catalog_id or row.old_catalog_id) else None,
                    "catalogCode": (row.new_payload or {}).get("category_no") or (row.old_payload or {}).get("category_no"),
                    "sourceBatchId": row.batch_id,
                    "sourceFileName": row.source_file_name,
                    "beforeData": row.old_payload or {},
                    "afterData": row.new_payload or {},
                    "reason": row.reason,
                    "changedAt": row.created_at.isoformat() if row.created_at else None,
                }
            )

        history_query = select(CatalogChangeHistory)
        if since_dt is not None:
            history_query = history_query.where(CatalogChangeHistory.created_at >= since_dt)
        if changeType:
            history_query = history_query.where(CatalogChangeHistory.change_type == changeType)
        for row in db.scalars(history_query.order_by(CatalogChangeHistory.created_at.desc()).limit(5000)).all():
            records.append(
                {
                    "changeId": str(row.history_id),
                    "changeType": row.change_type,
                    "catalogId": str(row.catalog_id),
                    "catalogCode": (row.after_data or {}).get("category_no") or (row.before_data or {}).get("category_no"),
                    "sourceBatchId": None,
                    "beforeData": row.before_data or {},
                    "afterData": row.after_data or {},
                    "reason": row.reason,
                    "operatorName": row.operator_name,
                    "changedAt": row.created_at.isoformat() if row.created_at else None,
                }
            )

        correction_query = select(CatalogCorrectionOrder)
        if since_dt is not None:
            correction_query = correction_query.where(CatalogCorrectionOrder.created_at >= since_dt)
        for row in db.scalars(correction_query.order_by(CatalogCorrectionOrder.created_at.desc()).limit(5000)).all():
            mapped_type = "纠错" if row.correction_action != "标记作废" else "作废"
            if changeType and mapped_type != changeType:
                continue
            records.append(
                {
                    "changeId": str(row.correction_id),
                    "changeType": mapped_type,
                    "catalogId": str(row.catalog_id),
                    "sourceBatchId": row.source_batch_id,
                    "beforeData": row.before_data or {},
                    "afterData": row.after_data or {},
                    "reason": row.reason,
                    "status": row.status,
                    "changedAt": (row.executed_at or row.reviewed_at or row.created_at).isoformat() if (row.executed_at or row.reviewed_at or row.created_at) else None,
                }
            )
        records.sort(key=lambda item: str(item.get("changedAt") or ""), reverse=True)
        page_no = max(page, 1)
        page_size = min(max(pageSize, 1), 200)
        start = (page_no - 1) * page_size
        paged = records[start : start + page_size]
        return {"records": paged, "page": page_no, "pageSize": page_size, "total": len(records)}, len(paged)

    return _run_external(db, request, required_scope="md:device-classification:changes", handler=handler)


@router.get("/campuses")
def list_master_campuses(
    request: Request,
    db: DbSession,
    keyword: str | None = None,
    status: str = "ACTIVE",
    page: int = 1,
    pageSize: int = 50,
):
    def handler(_: ApiClient):
        records, total, page_no, page_size = list_campuses(
            db,
            keyword=keyword,
            status=status,
            page=page,
            page_size=pageSize,
        )
        return {"records": records, "page": page_no, "pageSize": page_size, "total": total}, len(records)

    return _run_external(db, request, required_scope="md:organization:read", handler=handler)


@router.get("/departments")
def list_master_departments(
    request: Request,
    db: DbSession,
    keyword: str | None = None,
    campusId: str | None = None,
    departmentType: str | None = None,
    status: str = "ACTIVE",
    page: int = 1,
    pageSize: int = 50,
):
    def handler(_: ApiClient):
        records, total, page_no, page_size = list_departments(
            db,
            keyword=keyword,
            campus_id=campusId,
            department_type=departmentType,
            status=status,
            page=page,
            page_size=pageSize,
        )
        return {"records": records, "page": page_no, "pageSize": page_size, "total": total}, len(records)

    return _run_external(db, request, required_scope="md:organization:read", handler=handler)


@router.get("/departments/tree")
def get_master_department_tree(
    request: Request,
    db: DbSession,
    keyword: str | None = None,
    campusId: str | None = None,
):
    def handler(_: ApiClient):
        records = department_tree(db, keyword=keyword, campus_id=campusId)
        return {"records": records, "total": len(records)}, len(records)

    return _run_external(db, request, required_scope="md:organization:tree", handler=handler)


def _department_by_id_or_code(db: Session, value: str) -> DictDepartment | None:
    try:
        return db.get(DictDepartment, uuid.UUID(str(value)))
    except ValueError:
        return db.scalar(select(DictDepartment).where(DictDepartment.dept_code == value).limit(1))


@router.get("/departments/{id}")
def get_master_department_detail(request: Request, db: DbSession, id: str):
    def handler(_: ApiClient):
        rows, _total, _page, _page_size = list_departments(db, status="all", page=1, page_size=10000)
        row = next((item for item in rows if item.get("id") == id or item.get("code") == id), None)
        if row is None:
            if _department_by_id_or_code(db, id) is None:
                raise ExternalApiError(404, "DEPARTMENT_NOT_FOUND", "department not found")
            rows, _total, _page, _page_size = list_departments(db, keyword=id, status="all", page=1, page_size=1)
            row = rows[0] if rows else None
        if row is None:
            raise ExternalApiError(404, "DEPARTMENT_NOT_FOUND", "department not found")
        return row, 1

    return _run_external(db, request, required_scope="md:organization:read", handler=handler)


@router.get("/persons")
def list_master_persons(
    request: Request,
    db: DbSession,
    keyword: str | None = None,
    departmentId: str | None = None,
    campusId: str | None = None,
    personType: str | None = None,
    status: str = "ACTIVE",
    page: int = 1,
    pageSize: int = 50,
):
    def handler(_: ApiClient):
        records, total, page_no, page_size = list_persons(
            db,
            keyword=keyword,
            department_id=departmentId,
            campus_id=campusId,
            person_type=personType,
            status=status,
            page=page,
            page_size=pageSize,
        )
        return {"records": records, "page": page_no, "pageSize": page_size, "total": total}, len(records)

    return _run_external(db, request, required_scope="md:person:read", handler=handler)


def _person_by_id_or_code(db: Session, value: str) -> DictPerson | None:
    try:
        return db.get(DictPerson, uuid.UUID(str(value)))
    except ValueError:
        return db.scalar(select(DictPerson).where(DictPerson.person_code == value).limit(1))


@router.get("/persons/{id}")
def get_master_person_detail(request: Request, db: DbSession, id: str):
    def handler(_: ApiClient):
        rows, _total, _page, _page_size = list_persons(db, status="all", page=1, page_size=10000)
        row = next((item for item in rows if item.get("id") == id or item.get("code") == id), None)
        if row is None and _person_by_id_or_code(db, id) is not None:
            rows, _total, _page, _page_size = list_persons(db, keyword=id, status="all", page=1, page_size=1)
            row = rows[0] if rows else None
        if row is None:
            raise ExternalApiError(404, "PERSON_NOT_FOUND", "person not found")
        return row, 1

    return _run_external(db, request, required_scope="md:person:read", handler=handler)


@router.get("/disciplines")
def list_master_disciplines(
    request: Request,
    db: DbSession,
    keyword: str | None = None,
    status: str = "ACTIVE",
    page: int = 1,
    pageSize: int = 50,
):
    def handler(_: ApiClient):
        records, total, page_no, page_size = list_disciplines(
            db,
            keyword=keyword,
            status=status,
            page=page,
            page_size=pageSize,
        )
        return {"records": records, "page": page_no, "pageSize": page_size, "total": total}, len(records)

    return _run_external(db, request, required_scope="md:discipline:read", handler=handler)


@router.get("/disciplines/tree")
def get_master_discipline_tree(request: Request, db: DbSession, keyword: str | None = None):
    def handler(_: ApiClient):
        records = discipline_tree(db, keyword=keyword)
        return {"records": records, "total": len(records)}, len(records)

    return _run_external(db, request, required_scope="md:discipline:tree", handler=handler)


def _discipline_by_id_or_code(db: Session, value: str) -> DictDiscipline | None:
    try:
        return db.get(DictDiscipline, uuid.UUID(str(value)))
    except ValueError:
        return db.scalar(select(DictDiscipline).where(DictDiscipline.discipline_code == value).limit(1))


@router.get("/disciplines/{id}")
def get_master_discipline_detail(request: Request, db: DbSession, id: str):
    def handler(_: ApiClient):
        rows, _total, _page, _page_size = list_disciplines(db, status="all", page=1, page_size=10000)
        row = next((item for item in rows if item.get("id") == id or item.get("code") == id), None)
        if row is None and _discipline_by_id_or_code(db, id) is not None:
            rows, _total, _page, _page_size = list_disciplines(db, keyword=id, status="all", page=1, page_size=1)
            row = rows[0] if rows else None
        if row is None:
            raise ExternalApiError(404, "DISCIPLINE_NOT_FOUND", "discipline not found")
        return row, 1

    return _run_external(db, request, required_scope="md:discipline:read", handler=handler)


@router.get("/department-discipline-mappings")
def list_master_department_discipline_mappings(
    request: Request,
    db: DbSession,
    departmentId: str | None = None,
    disciplineId: str | None = None,
    status: str = "ACTIVE",
    page: int = 1,
    pageSize: int = 50,
):
    def handler(_: ApiClient):
        records, total, page_no, page_size = list_department_discipline_mappings(
            db,
            department_id=departmentId,
            discipline_id=disciplineId,
            status=status,
            page=page,
            page_size=pageSize,
        )
        return {"records": records, "page": page_no, "pageSize": page_size, "total": total}, len(records)

    return _run_external(db, request, required_scope="md:discipline:read", handler=handler)


@router.get("/business-partners")
def list_master_business_partners(
    request: Request,
    db: DbSession,
    keyword: str | None = None,
    roleType: str | None = None,
    businessDomain: str | None = None,
    status: str = "enabled",
    page: int = 1,
    pageSize: int = 20,
):
    def handler(_: ApiClient):
        records, total = search_vendors(
            db,
            keyword=keyword,
            role_type=roleType,
            business_domain=businessDomain,
            status=status,
            page=page,
            page_size=pageSize,
        )
        items = [
            vendor_payload(
                row,
                roles=list_vendor_roles(db, row.id),
                qualifications=list_organization_qualifications(db, row.id),
                external_mappings=list_mdm_external_mappings(db, row.id),
            )
            for row in records
        ]
        return {"records": items, "page": max(page, 1), "pageSize": min(max(pageSize, 1), 100), "total": total}, len(items)

    return _run_external(db, request, required_scope="md:business-partner:read", handler=handler)


@router.get("/business-partners/{id}")
def get_master_business_partner(request: Request, db: DbSession, id: str):
    def handler(_: ApiClient):
        try:
            target_id = uuid.UUID(str(id))
        except ValueError:
            rows, _total = search_vendors(db, keyword=id, status="enabled", page=1, page_size=1)
            row = rows[0] if rows else None
        else:
            rows, _total = search_vendors(db, status="enabled", page=1, page_size=10000)
            row = next((item for item in rows if item.id == target_id or item.organization_code == id), None)
        if row is None:
            raise ExternalApiError(404, "BUSINESS_PARTNER_NOT_FOUND", "business partner not found")
        return vendor_payload(
            row,
            roles=list_vendor_roles(db, row.id),
            qualifications=list_organization_qualifications(db, row.id),
            external_mappings=list_mdm_external_mappings(db, row.id),
        ), 1

    return _run_external(db, request, required_scope="md:business-partner:read", handler=handler)


@router.post("/business-partners/match")
async def match_master_business_partner(request: Request, db: DbSession):
    payload = await request.json()
    role_type = payload.get("roleType") or payload.get("role_type")
    if role_type:
        role_type = normalize_role_type(role_type)
    keyword = payload.get("keyword") or payload.get("name") or payload.get("orgName")

    def handler(_: ApiClient):
        candidates, recommendation = match_business_partner(
            db,
            keyword=keyword,
            role_type=role_type,
            page_size=int(payload.get("pageSize") or payload.get("page_size") or 8),
        )
        return {
            "connected": True,
            "source": "h-mdm",
            "degraded": False,
            "recommendation": recommendation,
            "candidates": candidates,
            "message": None if candidates else "未找到匹配的往来单位主数据，请检查关键词或提交主数据补充申请。",
        }, len(candidates)

    return _run_external(db, request, required_scope="md:business-partner:match", handler=handler)


@router.get("/health")
def master_data_health(request: Request, db: DbSession):
    def handler(_: ApiClient):
        db.execute(select(1))
        return {"status": "ok", "database": "ok", "timestamp": _timestamp()}, 1

    return _run_external(db, request, required_scope="md:device-classification:read", handler=handler)
