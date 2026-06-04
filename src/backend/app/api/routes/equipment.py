from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.deps import ApiKeyAuth, DbSession, EquipmentManageAuth
from app.api.schemas import ApiEnvelope, PageMeta, PagedResult
from app.services.equipment_dictionary import (
    analyze_device_classification_impact,
    category_payload,
    catalog_correction_payload,
    create_catalog_correction_order,
    device_classification_payload,
    device_revision_summary,
    execute_catalog_correction_order,
    get_device_classification_governance_detail,
    import_device_classification_catalog,
    import_equipment_categories,
    import_equipment_standard_names,
    list_invalid_device_classifications,
    mark_invalid_device_classifications_for_governance,
    list_catalog_correction_orders,
    list_same_batch_abnormalities,
    review_catalog_correction_order,
    latest_device_revisions_for_catalogs,
    list_device_classifications_for_tree,
    list_device_revisions,
    list_equipment_categories_for_tree,
    search_device_classifications,
    search_equipment_categories,
    search_equipment_standard_names,
    standard_name_payload,
    device_revision_payload,
)
from app.services.device_classification_export import (
    create_export_task,
    estimate_export_count,
    export_templates,
    get_export_record,
    list_export_records,
    record_export_download,
)
from app.services.equipment_source_files import (
    equipment_source_file_path,
    equipment_source_file_path_from_record,
    list_equipment_source_files,
    save_equipment_source_file,
)
from app.services.hashing import file_sha256
from app.services.import_pipeline import preview_device_classification_file
from app.services.upload_guard import read_upload_with_limit
from app.models.tables import (
    DeviceClassificationImportAuditLog,
    DeviceClassificationImportStaging,
    DeviceClassificationImportValidationResult,
    DeviceClassificationSourceFile,
    DeviceClassificationCatalogVersion,
    DictEquipmentStandardName,
    RefDeviceClassificationCatalog,
    SysImportBatch,
)
from sqlalchemy import select, func

router = APIRouter()
external_router = APIRouter(prefix="/api/external")

EQUIPMENT_SOURCE_TYPES = {
    "EQUIPMENT_CATEGORY",
    "EQUIPMENT_STANDARD_NAME",
    "DEVICE_CLASSIFICATION_CATALOG",
}


class EquipmentStandardNameIn(BaseModel):
    standard_code: str | None = None
    standard_name: str
    alias_names: list[str] = Field(default_factory=list)
    category_id: uuid.UUID | None = None
    device_classification_id: uuid.UUID | None = None
    common_manufacturer_org_ids: list[str] = Field(default_factory=list)
    management_class: str | None = None
    source_system: str | None = "H-UMDG"
    source_batch_id: str | None = None
    status: str = "ACTIVE"
    remark: str | None = None


class EquipmentStandardNameStatusIn(BaseModel):
    status: str

DEVICE_CLASSIFICATION_STANDARD_SOURCE = "国家药监局《医疗器械分类目录》（2017年第104号）"
IMPORT_STATUS_LABELS = {
    "DRAFT": "草稿",
    "UPLOADED": "已上传",
    "STAGED": "已解析",
    "PENDING_CONFIRM": "待确认",
    "COMPLETED": "已入库",
    "FAILED": "入库失败",
    "ROLLED_BACK": "已回滚",
}
AUDIT_ACTION_LABELS = {
    "BATCH_CREATED": "创建导入批次",
    "SOURCE_UPLOADED": "上传原始文件",
    "PREVIEW_STAGED": "文件解析",
    "PREVIEW_READY": "数据预览",
    "VALIDATION_RECORDED": "质量核验",
    "CONFIRM_START": "人工确认",
    "CONFIRM_COMMIT": "写入正式库",
    "VERSION_CREATED": "生成版本",
    "AUDIT_RECORDED": "生成审计日志",
    "SOURCE_ARCHIVED": "原始文件归档",
}


def _truthy_form_value(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "是"}


def _parse_optional_date(value: str | None) -> date | None:
    if not value or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else None


def _operator_department(operator_name: str | None) -> str:
    if not operator_name:
        return "未识别"
    return "主数据中心"


def _status_label(status: str | None) -> str:
    return IMPORT_STATUS_LABELS.get(status or "", status or "草稿")


def _audit_label(action: str | None) -> str:
    return AUDIT_ACTION_LABELS.get(action or "", action or "过程记录")


def _device_import_batch_id(source_file_name: str, explicit_batch_id: str | None = None) -> str:
    if explicit_batch_id and explicit_batch_id.strip():
        return explicit_batch_id.strip()
    stem = source_file_name.rsplit(".", 1)[0][:40] or "device-catalog"
    return f"DEVICE_CLASSIFICATION_CATALOG-{stem}-{uuid.uuid4().hex[:8]}"


def _upsert_device_import_batch(
    db: DbSession,
    *,
    batch_id: str,
    source_system: str,
    source_file_name: str,
    status: str,
    preview: dict | None = None,
    source_file_path: str | None = None,
    source_file_id: uuid.UUID | None = None,
    artifact: dict | None = None,
    import_mode: str | None = None,
    import_reason: str | None = None,
    source_url: str | None = None,
    catalog_version: str | None = None,
    operator_user_id: str | None = None,
    operator_name: str | None = None,
    operator_department: str | None = None,
    operator_role: str | None = None,
    client_ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    row = db.get(SysImportBatch, batch_id)
    now = datetime.now(UTC)
    result_payload = {
        **(row.result_payload or {} if row else {}),
        **(artifact or {}),
    }
    if preview:
        result_payload.update({
            "preview": {
                "source_row_count": preview.get("source_row_count", 0),
                "parse_success_count": preview.get("parse_success_count", 0),
                "parse_failed_count": preview.get("parse_failed_count", 0),
                "pending_confirm_count": preview.get("pending_confirm_count", 0),
                "invalid_count": preview.get("invalid_count", 0),
                "duplicate_count": preview.get("duplicate_count", 0),
            }
        })
    if row is None:
        row = SysImportBatch(
            batch_id=batch_id,
            source_type="DEVICE_CLASSIFICATION_CATALOG",
            source_system=source_system,
            source_file_name=source_file_name,
            source_file_path=source_file_path,
            source_file_id=source_file_id,
            sheet_name=None,
            import_mode=import_mode,
            import_reason=import_reason,
            source_url=source_url,
            catalog_version=catalog_version,
            operator_user_id=operator_user_id,
            operator_name=operator_name,
            operator_department=operator_department,
            operator_role=operator_role,
            client_ip=client_ip,
            user_agent=user_agent,
            status=status,
            result_payload=result_payload,
            source_row_count=int(preview.get("source_row_count", 0) if preview else 0),
            unique_key_count=int(preview.get("catalog_item_count", 0) if preview else 0),
            success_count=int(preview.get("parse_success_count", 0) if preview else 0),
            failed_count=int(preview.get("parse_failed_count", 0) if preview else 0),
            duplicate_count=int(preview.get("duplicate_count", 0) if preview else 0),
            inserted_count=int((preview.get("change_type_counts", {}) if preview else {}).get("新增", 0)),
            updated_count=int((preview.get("change_type_counts", {}) if preview else {}).get("修改", 0))
            + int((preview.get("change_type_counts", {}) if preview else {}).get("调整", 0)),
            deprecated_count=int((preview.get("change_type_counts", {}) if preview else {}).get("废止", 0)),
            progress_percent=50 if status == "STAGED" else 100,
            started_at=now if status == "STAGED" else None,
            finished_at=now if status == "COMPLETED" else None,
        )
        db.add(row)
    else:
        row.source_system = source_system
        row.source_file_name = source_file_name
        row.source_file_path = source_file_path or row.source_file_path
        row.source_file_id = source_file_id or row.source_file_id
        row.import_mode = import_mode or row.import_mode
        row.import_reason = import_reason or row.import_reason
        row.source_url = source_url or row.source_url
        row.catalog_version = catalog_version or row.catalog_version
        row.operator_user_id = operator_user_id or row.operator_user_id
        row.operator_name = operator_name or row.operator_name
        row.operator_department = operator_department or row.operator_department
        row.operator_role = operator_role or row.operator_role
        row.client_ip = client_ip or row.client_ip
        row.user_agent = user_agent or row.user_agent
        row.status = status
        row.result_payload = result_payload
        row.source_row_count = int(preview.get("source_row_count", row.source_row_count) if preview else row.source_row_count)
        row.unique_key_count = int(preview.get("catalog_item_count", row.unique_key_count) if preview else row.unique_key_count)
        row.success_count = int(preview.get("parse_success_count", row.success_count) if preview else row.success_count)
        row.failed_count = int(preview.get("parse_failed_count", row.failed_count) if preview else row.failed_count)
        row.duplicate_count = int(preview.get("duplicate_count", row.duplicate_count) if preview else row.duplicate_count)
        if preview:
            change_counts = preview.get("change_type_counts", {}) or {}
            row.inserted_count = int(change_counts.get("新增", row.inserted_count))
            row.updated_count = int(change_counts.get("修改", 0)) + int(change_counts.get("调整", 0))
            row.deprecated_count = int(change_counts.get("废止", row.deprecated_count))
        row.progress_percent = 50 if status == "STAGED" else 100
        row.started_at = row.started_at or (now if status == "STAGED" else None)
        row.finished_at = now if status == "COMPLETED" else row.finished_at


def _record_device_preview_pipeline(
    db: DbSession,
    *,
    batch_id: str,
    source_file: dict,
    preview: dict,
    file_type: str | None,
    source_system: str,
    source_link: str | None,
    publish_date: str | None,
    effective_date: str | None,
    authoritative: str | None,
    operator_name: str | None,
) -> uuid.UUID | None:
    db.query(DeviceClassificationImportStaging).filter(DeviceClassificationImportStaging.batch_id == batch_id).delete()
    db.query(DeviceClassificationImportValidationResult).filter(
        DeviceClassificationImportValidationResult.batch_id == batch_id
    ).delete()
    db.query(DeviceClassificationSourceFile).filter(DeviceClassificationSourceFile.batch_id == batch_id).delete()

    source_row = DeviceClassificationSourceFile(
        batch_id=batch_id,
        source_file_name=str(source_file.get("source_file_name") or preview.get("source_file_name") or ""),
        stored_file_name=source_file.get("stored_file_name"),
        source_file_size_bytes=source_file.get("source_file_size_bytes"),
        sha256=source_file.get("sha256"),
        file_type=file_type,
        source_system=source_system,
        source_link=source_link,
        publish_date=_parse_optional_date(publish_date),
        effective_date=_parse_optional_date(effective_date),
        authoritative=_truthy_form_value(authoritative),
        metadata_payload=source_file,
    )
    db.add(source_row)
    db.flush()

    for row in preview.get("samples", []):
        db.add(
            DeviceClassificationImportStaging(
                batch_id=batch_id,
                source_file_name=str(preview.get("source_file_name") or source_file.get("source_file_name") or ""),
                row_number=int(row.get("row_number") or 0),
                catalog_code=row.get("catalog_code"),
                major_category_no=row.get("major_category_no"),
                major_category_name=row.get("major_category_name"),
                level_1_category_no=row.get("level_1_category_no"),
                level_1_category=row.get("level_1_category"),
                level_2_category_no=row.get("level_2_category_no"),
                level_2_category=row.get("level_2_category"),
                product_description=row.get("product_description"),
                intended_use=row.get("intended_use"),
                product_examples=row.get("product_examples"),
                management_class=row.get("management_class"),
                change_type=row.get("change_type"),
                parse_status=str(row.get("parse_status") or "通过"),
                issue_message=row.get("issue_message"),
                raw_payload=row,
            )
        )

    for item in preview.get("validation_results", []):
        db.add(
            DeviceClassificationImportValidationResult(
                batch_id=batch_id,
                validation_key=str(item.get("key") or ""),
                validation_label=str(item.get("label") or ""),
                status=str(item.get("status") or "待人工确认"),
                message=item.get("message"),
                issue_count=int(item.get("count") or 0),
                result_payload=item,
            )
        )

    db.add(
        DeviceClassificationImportAuditLog(
            batch_id=batch_id,
            action="PREVIEW_STAGED",
            operator_name=operator_name,
            message="原始文件已解析到医疗器械分类目录暂存区",
            payload={
                "source_file_name": preview.get("source_file_name"),
                "source_row_count": preview.get("source_row_count", 0),
                "validation_count": len(preview.get("validation_results", [])),
            },
        )
    )
    db.add(
        DeviceClassificationImportAuditLog(
            batch_id=batch_id,
            action="BATCH_CREATED",
            operator_name=operator_name,
            message="创建医疗器械分类目录导入批次",
            payload={"batch_id": batch_id},
        )
    )
    db.add(
        DeviceClassificationImportAuditLog(
            batch_id=batch_id,
            action="SOURCE_UPLOADED",
            operator_name=operator_name,
            message="原始文件已上传并归档到导入工作区",
            payload=source_file,
        )
    )
    db.add(
        DeviceClassificationImportAuditLog(
            batch_id=batch_id,
            action="PREVIEW_READY",
            operator_name=operator_name,
            message="解析预览已生成",
            payload={"sample_count": len(preview.get("samples", []))},
        )
    )
    db.add(
        DeviceClassificationImportAuditLog(
            batch_id=batch_id,
            action="VALIDATION_RECORDED",
            operator_name=operator_name,
            message="质量核验结果已记录",
            payload={"validation_count": len(preview.get("validation_results", []))},
        )
    )
    db.add(
        DeviceClassificationImportAuditLog(
            batch_id=batch_id,
            action="SOURCE_ARCHIVED",
            operator_name=operator_name,
            message="原始文件归档记录已生成",
            payload={"stored_file_name": source_file.get("stored_file_name")},
        )
    )
    return source_row.source_file_id


@router.get("/equipment/categories", response_model=ApiEnvelope)
def list_equipment_categories(
    _: EquipmentManageAuth,
    db: DbSession,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_equipment_categories(db, keyword=keyword, status=status, page=page, page_size=page_size)
    return ApiEnvelope(
        data=PagedResult(
            items=[category_payload(row) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@router.get("/equipment/categories/tree-data", response_model=ApiEnvelope)
def list_equipment_categories_tree_data(
    _: EquipmentManageAuth,
    db: DbSession,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    limit: int = 5000,
) -> ApiEnvelope:
    rows = list_equipment_categories_for_tree(db, keyword=keyword, status=status, limit=limit)
    return ApiEnvelope(data={"items": [category_payload(row) for row in rows], "total": len(rows)})


@router.get("/equipment/standard-names", response_model=ApiEnvelope)
def list_equipment_standard_names(
    _: EquipmentManageAuth,
    db: DbSession,
    keyword: str | None = None,
    category_id: uuid.UUID | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_equipment_standard_names(
        db,
        keyword=keyword,
        category_id=category_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[standard_name_payload(row) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@router.post("/equipment/standard-names", response_model=ApiEnvelope)
def upsert_equipment_standard_name(
    payload: EquipmentStandardNameIn,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    standard_name = payload.standard_name.strip()
    if not standard_name:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION_FAILED", "message": "standard_name is required"})
    standard_code = (payload.standard_code or "").strip() or f"EQ-{uuid.uuid5(uuid.NAMESPACE_DNS, standard_name).hex[:12].upper()}"
    row = db.scalar(
        select(DictEquipmentStandardName).where(
            (DictEquipmentStandardName.standard_code == standard_code)
            | (DictEquipmentStandardName.standard_name == standard_name)
        )
    )
    if row is None:
        row = DictEquipmentStandardName(standard_code=standard_code, standard_name=standard_name)
        db.add(row)
    row.standard_name = standard_name
    row.alias_names = payload.alias_names
    row.category_id = payload.category_id
    row.device_classification_id = payload.device_classification_id
    row.common_manufacturer_org_ids = payload.common_manufacturer_org_ids
    row.management_class = payload.management_class
    row.source_system = payload.source_system or "H-UMDG"
    row.source_batch_id = payload.source_batch_id
    row.status = payload.status.strip().upper() or "ACTIVE"
    row.remark = payload.remark
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=standard_name_payload(row))


@router.patch("/equipment/standard-names/{standard_id}", response_model=ApiEnvelope)
def patch_equipment_standard_name(
    standard_id: uuid.UUID,
    payload: EquipmentStandardNameIn,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    row = db.get(DictEquipmentStandardName, standard_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "EQUIPMENT_STANDARD_NAME_NOT_FOUND", "message": "设备标准名称不存在"})
    row.standard_name = payload.standard_name.strip()
    row.alias_names = payload.alias_names
    row.category_id = payload.category_id
    row.device_classification_id = payload.device_classification_id
    row.common_manufacturer_org_ids = payload.common_manufacturer_org_ids
    row.management_class = payload.management_class
    row.source_system = payload.source_system or row.source_system
    row.source_batch_id = payload.source_batch_id
    row.status = payload.status.strip().upper() or row.status
    row.remark = payload.remark
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=standard_name_payload(row))


@router.patch("/equipment/standard-names/{standard_id}/status", response_model=ApiEnvelope)
def patch_equipment_standard_name_status(
    standard_id: uuid.UUID,
    payload: EquipmentStandardNameStatusIn,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    row = db.get(DictEquipmentStandardName, standard_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "EQUIPMENT_STANDARD_NAME_NOT_FOUND", "message": "设备标准名称不存在"})
    row.status = payload.status.strip().upper() or row.status
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=standard_name_payload(row))


@router.delete("/equipment/standard-names/{standard_id}", response_model=ApiEnvelope)
def delete_equipment_standard_name(
    standard_id: uuid.UUID,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    row = db.get(DictEquipmentStandardName, standard_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "EQUIPMENT_STANDARD_NAME_NOT_FOUND", "message": "设备标准名称不存在"})
    db.delete(row)
    db.commit()
    return ApiEnvelope(data={"deleted": 1, "id": str(standard_id)})


@router.get("/equipment/device-classifications", response_model=ApiEnvelope)
def list_device_classifications(
    _: EquipmentManageAuth,
    db: DbSession,
    keyword: str | None = None,
    management_class: str | None = None,
    data_status: str | None = "effective",
    include_hidden: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_device_classifications(
        db,
        keyword=keyword,
        management_class=management_class,
        data_status=data_status,
        include_hidden=include_hidden,
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[device_classification_payload(row) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@router.get("/equipment/device-classifications/tree-data", response_model=ApiEnvelope)
def list_device_classifications_tree_data(
    _: EquipmentManageAuth,
    db: DbSession,
    keyword: str | None = None,
    management_class: str | None = None,
    data_status: str | None = "effective",
    include_hidden: bool = False,
    limit: int = 5000,
) -> ApiEnvelope:
    rows = list_device_classifications_for_tree(
        db,
        keyword=keyword,
        management_class=management_class,
        data_status=data_status,
        include_hidden=include_hidden,
        limit=limit,
    )
    latest_revisions = latest_device_revisions_for_catalogs(db, [row.catalog_id for row in rows])
    return ApiEnvelope(
        data={
            "items": [device_classification_payload(row, latest_revisions.get(row.catalog_id)) for row in rows],
            "total": len(rows),
            "revision_summary": device_revision_summary(db),
        }
    )


@router.get("/equipment/device-classifications/revisions", response_model=ApiEnvelope)
def list_device_classification_revisions(
    _: EquipmentManageAuth,
    db: DbSession,
    catalog_id: uuid.UUID | None = None,
    batch_id: str | None = None,
    limit: int = 200,
) -> ApiEnvelope:
    rows = list_device_revisions(db, catalog_id=catalog_id, batch_id=batch_id, limit=limit)
    return ApiEnvelope(data={"items": [device_revision_payload(row) for row in rows], "total": len(rows)})


@router.get("/equipment/device-classifications/invalid-candidates", response_model=ApiEnvelope)
def list_invalid_device_classification_candidates(
    _: EquipmentManageAuth,
    db: DbSession,
    limit: int = 500,
) -> ApiEnvelope:
    rows = list_invalid_device_classifications(db, limit=limit)
    return ApiEnvelope(data={"items": rows, "total": len(rows)})


@router.get("/equipment/device-classifications/export/templates", response_model=ApiEnvelope)
def list_device_classification_export_templates(_: EquipmentManageAuth) -> ApiEnvelope:
    return ApiEnvelope(data={"items": export_templates()})


@router.get("/equipment/device-classifications/export/tasks", response_model=ApiEnvelope)
def list_device_classification_export_tasks(_: EquipmentManageAuth) -> ApiEnvelope:
    rows = list_export_records()
    return ApiEnvelope(data={"items": rows, "total": len(rows)})


@router.post("/equipment/device-classifications/export/estimate", response_model=ApiEnvelope)
async def estimate_device_classification_export(
    request: Request,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    payload = await request.json()
    criteria = dict(payload.get("criteria") or {})
    criteria.setdefault("scope_type", payload.get("scope_type") or "effective")
    template_id = str(payload.get("template_id") or "standard")
    return ApiEnvelope(data={"estimated_count": estimate_export_count(db, criteria, template_id)})


@router.post("/equipment/device-classifications/export/tasks", response_model=ApiEnvelope)
async def create_device_classification_export_task(
    request: Request,
    operator: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    payload = await request.json()
    try:
        result = create_export_task(
            db,
            payload,
            operator_name=operator.display_name or operator.name,
            operator_role=getattr(operator, "role", None),
            client_ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except ValueError as exc:
        status_code = 400 if str(exc) == "EXPORT_FORMAT_NOT_SUPPORTED" else 404
        raise HTTPException(status_code=status_code, detail={"code": str(exc), "message": str(exc)}) from exc
    db.commit()
    return ApiEnvelope(data=result.record)


@router.get("/equipment/device-classifications/export/tasks/{task_no}", response_model=ApiEnvelope)
def get_device_classification_export_task(
    task_no: str,
    _: EquipmentManageAuth,
) -> ApiEnvelope:
    record = get_export_record(task_no)
    if record is None:
        raise HTTPException(status_code=404, detail={"code": "EXPORT_TASK_NOT_FOUND", "message": task_no})
    return ApiEnvelope(data=record)


@router.get("/equipment/device-classifications/export/tasks/{task_no}/download")
def download_device_classification_export_task(
    task_no: str,
    request: Request,
    operator: EquipmentManageAuth,
    db: DbSession,
) -> FileResponse:
    record = get_export_record(task_no)
    if record is None:
        raise HTTPException(status_code=404, detail={"code": "EXPORT_TASK_NOT_FOUND", "message": task_no})
    path = Path(str(record.get("file_path") or ""))
    if not path.exists():
        raise HTTPException(status_code=404, detail={"code": "EXPORT_FILE_NOT_FOUND", "message": task_no})
    record_export_download(
        db,
        record,
        operator_name=operator.display_name or operator.name,
        client_ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    return FileResponse(path, media_type="application/octet-stream", filename=str(record.get("file_name") or path.name))


@router.delete("/equipment/device-classifications/invalid-candidates", response_model=ApiEnvelope)
def mark_invalid_device_classification_candidates(
    operator: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    result = mark_invalid_device_classifications_for_governance(
        db,
        operator_name=operator.display_name or operator.name,
    )
    db.commit()
    return ApiEnvelope(data=result)


@router.get("/equipment/device-classifications/corrections", response_model=ApiEnvelope)
def list_device_classification_corrections(
    _: EquipmentManageAuth,
    db: DbSession,
    status: str | None = None,
    abnormal_type: str | None = None,
    correction_action: str | None = None,
    source_batch_id: str | None = None,
    applicant_name: str | None = None,
    limit: int = 200,
) -> ApiEnvelope:
    rows = list_catalog_correction_orders(
        db,
        status=status,
        abnormal_type=abnormal_type,
        correction_action=correction_action,
        source_batch_id=source_batch_id,
        applicant_name=applicant_name,
        limit=limit,
    )
    return ApiEnvelope(data={"items": rows, "total": len(rows)})


@router.post("/equipment/device-classifications/corrections/{correction_id}/execute", response_model=ApiEnvelope)
def execute_device_classification_correction(
    correction_id: uuid.UUID,
    operator: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    try:
        payload = execute_catalog_correction_order(
            db,
            correction_id,
            reviewer_user_id=operator.name,
            reviewer_name=operator.display_name or operator.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": str(exc), "message": str(exc)}) from exc
    db.commit()
    return ApiEnvelope(data=payload)


@router.post("/equipment/device-classifications/corrections/{correction_id}/approve", response_model=ApiEnvelope)
def approve_device_classification_correction(
    correction_id: uuid.UUID,
    operator: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    try:
        payload = review_catalog_correction_order(
            db,
            correction_id,
            approved=True,
            reviewer_user_id=operator.name,
            reviewer_name=operator.display_name or operator.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": str(exc), "message": str(exc)}) from exc
    db.commit()
    return ApiEnvelope(data=payload)


@router.post("/equipment/device-classifications/corrections/{correction_id}/reject", response_model=ApiEnvelope)
def reject_device_classification_correction(
    correction_id: uuid.UUID,
    operator: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    try:
        payload = review_catalog_correction_order(
            db,
            correction_id,
            approved=False,
            reviewer_user_id=operator.name,
            reviewer_name=operator.display_name or operator.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": str(exc), "message": str(exc)}) from exc
    db.commit()
    return ApiEnvelope(data=payload)


@router.get("/equipment/device-classifications/{catalog_id}/governance", response_model=ApiEnvelope)
def get_device_classification_governance(
    catalog_id: uuid.UUID,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    try:
        return ApiEnvelope(data=get_device_classification_governance_detail(db, catalog_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": str(exc), "message": str(exc)}) from exc


@router.get("/equipment/device-classifications/{catalog_id}/impact-analysis", response_model=ApiEnvelope)
def get_device_classification_impact_analysis(
    catalog_id: uuid.UUID,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    try:
        return ApiEnvelope(data=analyze_device_classification_impact(db, catalog_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": str(exc), "message": str(exc)}) from exc


@router.get("/equipment/device-classifications/{catalog_id}/batch-abnormalities", response_model=ApiEnvelope)
def get_same_batch_device_abnormalities(
    catalog_id: uuid.UUID,
    _: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    try:
        rows = list_same_batch_abnormalities(db, catalog_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": str(exc), "message": str(exc)}) from exc
    return ApiEnvelope(data={"items": rows, "total": len(rows)})


@router.post("/equipment/device-classifications/{catalog_id}/corrections", response_model=ApiEnvelope)
async def create_device_classification_correction(
    catalog_id: uuid.UUID,
    request: Request,
    operator: EquipmentManageAuth,
    db: DbSession,
) -> ApiEnvelope:
    payload = await request.json()
    try:
        result = create_catalog_correction_order(
            db,
            catalog_id,
            payload,
            applicant_user_id=operator.name,
            applicant_name=operator.display_name or operator.name,
        )
    except ValueError as exc:
        status_code = 409 if str(exc) == "TARGET_CATALOG_REQUIRED" else 404
        raise HTTPException(status_code=status_code, detail={"code": str(exc), "message": str(exc)}) from exc
    db.commit()
    return ApiEnvelope(data=result)


@router.get("/equipment/source-files", response_model=ApiEnvelope)
def list_equipment_source_file_records(_: EquipmentManageAuth) -> ApiEnvelope:
    return ApiEnvelope(data={"items": list_equipment_source_files()})


@router.get("/equipment/source-files/{batch_id}/download")
def download_equipment_source_file(_: EquipmentManageAuth, batch_id: str) -> FileResponse:
    try:
        path, metadata = equipment_source_file_path(batch_id)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail={"code": "SOURCE_FILE_NOT_FOUND", "message": batch_id}) from exc
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=str(metadata.get("source_file_name") or path.name),
    )


@router.get("/equipment/device-classifications/{catalog_id}/source-file/download")
def download_device_classification_source_file(
    _: EquipmentManageAuth,
    db: DbSession,
    catalog_id: uuid.UUID,
) -> FileResponse:
    catalog = db.get(RefDeviceClassificationCatalog, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=404, detail={"code": "CATALOG_NOT_FOUND", "message": str(catalog_id)})
    source_file = db.scalar(select(DeviceClassificationSourceFile).where(DeviceClassificationSourceFile.batch_id == catalog.batch_id))
    try:
        path, metadata = equipment_source_file_path(catalog.batch_id)
    except (FileNotFoundError, ValueError):
        if source_file is None:
            raise HTTPException(status_code=404, detail={"code": "SOURCE_FILE_NOT_FOUND", "message": catalog.batch_id})
        try:
            path, metadata = equipment_source_file_path_from_record(
                batch_id=catalog.batch_id,
                source_file_name=source_file.source_file_name,
                stored_file_name=source_file.stored_file_name,
                metadata_payload=source_file.metadata_payload,
            )
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=404, detail={"code": "SOURCE_FILE_NOT_FOUND", "message": catalog.batch_id}) from exc
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=str(metadata.get("source_file_name") or catalog.source_file_name or path.name),
    )


def _batch_history_payload(batch: SysImportBatch, source_file: DeviceClassificationSourceFile | None) -> dict:
    artifact = batch.result_payload or {}
    preview = artifact.get("preview") if isinstance(artifact.get("preview"), dict) else {}
    return {
        "import_batch_id": batch.batch_id,
        "source_file_id": str(source_file.source_file_id) if source_file else (str(batch.source_file_id) if batch.source_file_id else None),
        "import_mode": batch.import_mode or artifact.get("import_mode"),
        "source_file_name": batch.source_file_name,
        "source_name": batch.source_system,
        "source_url": batch.source_url or (source_file.source_link if source_file else None),
        "catalog_version": batch.catalog_version or artifact.get("catalog_version"),
        "import_reason": batch.import_reason,
        "operator_user_id": batch.operator_user_id,
        "operator_name": batch.operator_name,
        "operator_department": batch.operator_department,
        "operator_role": batch.operator_role,
        "client_ip": batch.client_ip,
        "user_agent": batch.user_agent,
        "started_at": batch.started_at.isoformat() if batch.started_at else batch.created_at.isoformat(),
        "completed_at": batch.finished_at.isoformat() if batch.finished_at else None,
        "parsed_count": batch.source_row_count,
        "inserted_count": batch.inserted_count,
        "updated_count": batch.updated_count,
        "deprecated_count": batch.deprecated_count,
        "error_count": batch.failed_count,
        "imported_count": batch.success_count,
        "rollback_status": batch.rollback_status,
        "status": _status_label(batch.status),
        "raw_status": batch.status,
        "change_type_counts": preview.get("change_type_counts", {}),
    }


@router.get("/equipment/device-classifications/import/history", response_model=ApiEnvelope)
def list_device_classification_import_history(
    _: EquipmentManageAuth,
    db: DbSession,
    limit: int = 20,
) -> ApiEnvelope:
    rows = db.scalars(
        select(SysImportBatch)
        .where(SysImportBatch.source_type == "DEVICE_CLASSIFICATION_CATALOG")
        .order_by(SysImportBatch.created_at.desc())
        .limit(min(max(limit, 1), 100))
    ).all()
    batch_ids = [row.batch_id for row in rows]
    source_rows = db.scalars(
        select(DeviceClassificationSourceFile).where(DeviceClassificationSourceFile.batch_id.in_(batch_ids))
    ).all() if batch_ids else []
    source_by_batch = {row.batch_id: row for row in source_rows}
    return ApiEnvelope(data={"items": [_batch_history_payload(row, source_by_batch.get(row.batch_id)) for row in rows]})


@router.get("/equipment/device-classifications/import/history/{batch_id}", response_model=ApiEnvelope)
def get_device_classification_import_history_detail(
    _: EquipmentManageAuth,
    db: DbSession,
    batch_id: str,
) -> ApiEnvelope:
    batch = db.get(SysImportBatch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail={"code": "IMPORT_BATCH_NOT_FOUND", "message": batch_id})
    source_file = db.scalar(select(DeviceClassificationSourceFile).where(DeviceClassificationSourceFile.batch_id == batch_id))
    validation_rows = db.scalars(
        select(DeviceClassificationImportValidationResult)
        .where(DeviceClassificationImportValidationResult.batch_id == batch_id)
        .order_by(DeviceClassificationImportValidationResult.created_at)
    ).all()
    audit_rows = db.scalars(
        select(DeviceClassificationImportAuditLog)
        .where(DeviceClassificationImportAuditLog.batch_id == batch_id)
        .order_by(DeviceClassificationImportAuditLog.created_at)
    ).all()
    staging_total = db.scalar(
        select(func.count()).select_from(DeviceClassificationImportStaging).where(DeviceClassificationImportStaging.batch_id == batch_id)
    ) or 0
    version = db.scalar(select(DeviceClassificationCatalogVersion).where(DeviceClassificationCatalogVersion.batch_id == batch_id))
    timeline = [
        {
            "step": _audit_label(row.action),
            "action": row.action,
            "operator_name": row.operator_name or batch.operator_name,
            "occurred_at": row.created_at.isoformat() if row.created_at else None,
            "result": "完成",
            "message": row.message,
            "payload": row.payload,
        }
        for row in audit_rows
    ]
    return ApiEnvelope(
        data={
            "batch": _batch_history_payload(batch, source_file),
            "source_file": {
                "source_file_id": str(source_file.source_file_id),
                "source_file_name": source_file.source_file_name,
                "source_file_size_bytes": source_file.source_file_size_bytes,
                "file_type": source_file.file_type,
                "source_system": source_file.source_system,
                "source_link": source_file.source_link,
                "created_at": source_file.created_at.isoformat() if source_file.created_at else None,
            } if source_file else None,
            "timeline": timeline,
            "validation_results": [
                {
                    "key": row.validation_key,
                    "label": row.validation_label,
                    "status": row.status,
                    "message": row.message,
                    "count": row.issue_count,
                }
                for row in validation_rows
            ],
            "staging_total": staging_total,
            "catalog_version": {
                "version_no": version.version_no,
                "item_count": version.item_count,
                "abnormal_count": version.abnormal_count,
                "is_current": version.is_current,
                "rollback_supported": version.rollback_supported,
            } if version else None,
        }
    )


@router.post("/equipment/device-classifications/import/preview", response_model=ApiEnvelope)
async def preview_device_classification_import(
    operator: EquipmentManageAuth,
    request: Request,
    db: DbSession,
    file: UploadFile = File(...),
    source_file_name: str | None = Form(None),
    source_tx_id: str | None = Form(None),
    file_type: str | None = Form(None),
    source_system: str = Form("国家药监局"),
    source_link: str | None = Form(None),
    publish_date: str | None = Form(None),
    effective_date: str | None = Form(None),
    authoritative: str | None = Form(None),
    import_mode: str | None = Form(None),
    batch_name: str | None = Form(None),
    scope: str | None = Form(None),
    authority_level: str | None = Form(None),
    operator_name: str | None = Form(None),
    remark: str | None = Form(None),
) -> ApiEnvelope:
    content = await read_upload_with_limit(file)
    filename = source_file_name or file.filename or "device-classification-catalog.docx"
    batch_id = _device_import_batch_id(filename, source_tx_id)
    try:
        preview = preview_device_classification_file(content, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "IMPORT_FILE_INVALID", "message": str(exc)}) from exc
    preview["source_file_size_bytes"] = len(content)
    preview["sha256"] = file_sha256(content)
    preview["batch_id"] = batch_id
    existing_count = db.scalar(select(func.count()).select_from(RefDeviceClassificationCatalog)) or 0
    preview["existing_catalog_count"] = existing_count
    preview["is_initial_import"] = existing_count == 0
    preview["difference_validation"] = {
        "key": "existing_diff",
        "label": "与现有数据差异核验",
        "status": "通过",
        "message": "当前数据库为空，本次为初始化导入，未发现历史版本差异。"
        if existing_count == 0
        else f"当前正式目录已有 {existing_count} 条，确认入库时将形成新批次差异。",
        "count": existing_count,
    }
    preview["validation_results"] = [*preview.get("validation_results", []), preview["difference_validation"]]
    preview["samples"] = [
        {**row, "staging_id": str(row.get("staging_id") or f"{batch_id}-{index + 1}")}
        for index, row in enumerate(preview.get("samples", []))
    ]
    source_file = save_equipment_source_file(
        batch_id=batch_id,
        filename=filename,
        content=content,
        source_type="DEVICE_CLASSIFICATION_CATALOG",
        source_system=source_system,
        imported_by=operator_name or operator.display_name or operator.name,
        import_reason="解析预览暂存",
        extra_metadata={
            "file_type": file_type,
            "source_link": source_link,
            "publish_date": publish_date,
            "effective_date": effective_date,
            "authoritative": authoritative,
            "import_mode": import_mode,
            "batch_name": batch_name,
            "scope": scope,
            "authority_level": authority_level,
            "remark": remark,
            "pipeline_stage": "PREVIEW_STAGED",
        },
    )
    operator_display = operator.display_name or operator.name
    source_file_id = _record_device_preview_pipeline(
        db,
        batch_id=batch_id,
        source_file=source_file,
        preview=preview,
        file_type=file_type,
        source_system=source_system,
        source_link=source_link,
        publish_date=publish_date,
        effective_date=effective_date,
        authoritative=authoritative,
        operator_name=operator_display,
    )
    _upsert_device_import_batch(
        db,
        batch_id=batch_id,
        source_system=source_system,
        source_file_name=filename,
        source_file_path=str(source_file.get("stored_file_name") or ""),
        source_file_id=source_file_id,
        status="STAGED",
        preview=preview,
        import_mode=import_mode,
        import_reason="解析预览暂存",
        source_url=source_link,
        catalog_version=batch_id,
        operator_user_id=operator.name,
        operator_name=operator_display,
        operator_department=_operator_department(operator_display),
        operator_role=operator.role,
        client_ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        artifact={
            "batch_name": batch_name,
            "import_mode": import_mode,
            "scope": scope,
            "authority_level": authority_level,
            "remark": remark,
            "change_type_counts": preview.get("change_type_counts", {}),
        },
    )
    preview["source_file"] = source_file
    db.commit()
    return ApiEnvelope(data=preview)


@router.post("/equipment/import", response_model=ApiEnvelope)
async def import_equipment_dictionary(
    operator: EquipmentManageAuth,
    request: Request,
    db: DbSession,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    source_system: str = Form("数据维护平台"),
    source_tx_id: str | None = Form(None),
    sheet_name: str | None = Form(None),
    import_reason: str | None = Form(None),
    source_file_name: str | None = Form(None),
    file_type: str | None = Form(None),
    source_link: str | None = Form(None),
    publish_date: str | None = Form(None),
    effective_date: str | None = Form(None),
    authoritative: str | None = Form(None),
    import_mode: str | None = Form(None),
    batch_name: str | None = Form(None),
    scope: str | None = Form(None),
    authority_level: str | None = Form(None),
    operator_name: str | None = Form(None),
    remark: str | None = Form(None),
) -> ApiEnvelope:
    if source_type not in EQUIPMENT_SOURCE_TYPES:
        raise HTTPException(status_code=400, detail={"code": "INVALID_SOURCE_TYPE", "message": source_type})
    if source_type == "DEVICE_CLASSIFICATION_CATALOG":
        source_system = source_system or DEVICE_CLASSIFICATION_STANDARD_SOURCE
    content = await read_upload_with_limit(file)
    filename = source_file_name or file.filename or "equipment-dictionary"
    batch_id = (
        _device_import_batch_id(filename, source_tx_id)
        if source_type == "DEVICE_CLASSIFICATION_CATALOG"
        else source_tx_id or f"{source_type}-{uuid.uuid4().hex[:12]}"
    )
    source_file = save_equipment_source_file(
        batch_id=batch_id,
        filename=filename,
        content=content,
        source_type=source_type,
        source_system=source_system,
        imported_by=operator_name or operator.display_name or operator.name,
        import_reason=import_reason,
        extra_metadata={
            "file_type": file_type,
            "source_link": source_link,
            "publish_date": publish_date,
            "effective_date": effective_date,
            "authoritative": authoritative,
            "import_mode": import_mode,
            "batch_name": batch_name,
            "scope": scope,
            "authority_level": authority_level,
            "remark": remark,
        },
    )
    try:
        if source_type == "EQUIPMENT_CATEGORY":
            report = import_equipment_categories(db, content, filename, sheet_name, batch_id, source_system)
        elif source_type == "EQUIPMENT_STANDARD_NAME":
            report = import_equipment_standard_names(db, content, filename, sheet_name, batch_id, source_system)
        else:
            report = import_device_classification_catalog(
                db,
                content,
                filename,
                batch_id,
                source_system=source_system,
                publish_date=_parse_optional_date(publish_date),
                effective_date=_parse_optional_date(effective_date),
                operator_name=operator_name or operator.display_name or operator.name,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "IMPORT_FILE_INVALID", "message": str(exc)}) from exc
    report["source_file"] = source_file
    if source_type == "DEVICE_CLASSIFICATION_CATALOG":
        operator_display = operator.display_name or operator.name
        source_file_row = db.scalar(
            select(DeviceClassificationSourceFile).where(DeviceClassificationSourceFile.batch_id == batch_id)
        )
        if source_file_row is None:
            source_file_row = DeviceClassificationSourceFile(
                batch_id=batch_id,
                source_file_name=filename,
                stored_file_name=source_file.get("stored_file_name"),
                source_file_size_bytes=source_file.get("source_file_size_bytes"),
                sha256=source_file.get("sha256"),
                file_type=file_type,
                source_system=source_system,
                source_link=source_link,
                publish_date=_parse_optional_date(publish_date),
                effective_date=_parse_optional_date(effective_date),
                authoritative=_truthy_form_value(authoritative),
                metadata_payload=source_file,
            )
            db.add(source_file_row)
            db.flush()
        _upsert_device_import_batch(
            db,
            batch_id=batch_id,
            source_system=source_system,
            source_file_name=filename,
            source_file_path=str(source_file.get("stored_file_name") or ""),
            source_file_id=source_file_row.source_file_id,
            status="COMPLETED",
            preview={
                "source_row_count": report.get("source_row_count", 0),
                "catalog_item_count": report.get("unique_key_count", 0),
                "parse_success_count": report.get("success_count", 0),
                "parse_failed_count": report.get("failed_count", 0),
                "duplicate_count": report.get("duplicate_count", 0),
            },
            import_mode=import_mode,
            import_reason=import_reason,
            source_url=source_link,
            catalog_version=report.get("catalog_version") or batch_id,
            operator_user_id=operator.name,
            operator_name=operator_display,
            operator_department=_operator_department(operator_display),
            operator_role=operator.role,
            client_ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            artifact={
                "batch_name": batch_name,
                "import_mode": import_mode,
                "scope": scope,
                "authority_level": authority_level,
                "remark": remark,
                "catalog_version": report.get("catalog_version") or batch_id,
            },
        )
    db.commit()
    return ApiEnvelope(data=report)


@external_router.get("/equipment/categories", response_model=ApiEnvelope)
def external_list_equipment_categories(
    _: ApiKeyAuth,
    db: DbSession,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_equipment_categories(db, keyword=keyword, status="ACTIVE", page=page, page_size=page_size)
    return ApiEnvelope(
        data=PagedResult(
            items=[category_payload(row) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@external_router.get("/equipment/standard-names", response_model=ApiEnvelope)
def external_list_equipment_standard_names(
    _: ApiKeyAuth,
    db: DbSession,
    keyword: str | None = None,
    category_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_equipment_standard_names(
        db,
        keyword=keyword,
        category_id=category_id,
        status="ACTIVE",
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[standard_name_payload(row) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@external_router.get("/equipment/device-classifications", response_model=ApiEnvelope)
def external_list_device_classifications(
    _: ApiKeyAuth,
    db: DbSession,
    keyword: str | None = None,
    management_class: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_device_classifications(
        db,
        keyword=keyword,
        management_class=management_class,
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[device_classification_payload(row) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )
