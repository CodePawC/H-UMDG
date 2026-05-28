"""Equipment dictionary import and query services."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import Text, func, or_, select
from sqlalchemy.orm import Session

from app.models.tables import (
    CatalogChangeHistory,
    CatalogCorrectionLog,
    CatalogCorrectionOrder,
    CatalogReferenceRelation,
    DeviceClassificationImportAuditLog,
    DeviceClassificationSourceFile,
    DictEquipmentCategory,
    DictEquipmentStandardName,
    ImportValidationIssue,
    RefDeviceClassificationCatalog,
    RefDeviceClassificationRevision,
    SysImportBatch,
)
from app.services.import_pipeline import import_device_classification_docx
from app.services.tabular_io import load_tabular_rows


def normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def parse_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = str(value).replace("；", ";").replace(",", ";").split(";")
    result: list[str] = []
    seen: set[str] = set()
    for item in raw_items:
        normalized = normalize_text(item)
        if normalized and normalized not in seen:
            result.append(normalized)
            seen.add(normalized)
    return result


def category_payload(row: DictEquipmentCategory) -> dict[str, Any]:
    return {
        "category_id": str(row.category_id),
        "category_code": row.category_code,
        "category_name": row.category_name,
        "parent_category_id": str(row.parent_category_id) if row.parent_category_id else None,
        "level_no": row.level_no,
        "source_system": row.source_system,
        "source_batch_id": row.source_batch_id,
        "status": row.status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def standard_name_payload(row: DictEquipmentStandardName) -> dict[str, Any]:
    return {
        "standard_id": str(row.standard_id),
        "standard_code": row.standard_code,
        "standard_name": row.standard_name,
        "alias_names": row.alias_names or [],
        "category_id": str(row.category_id) if row.category_id else None,
        "device_classification_id": str(row.device_classification_id) if row.device_classification_id else None,
        "common_manufacturer_org_ids": row.common_manufacturer_org_ids or [],
        "management_class": row.management_class,
        "source_system": row.source_system,
        "source_batch_id": row.source_batch_id,
        "status": row.status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


DEVICE_DATA_STATUS_LABELS = {
    "effective": "有效",
    "pending_confirm": "待确认",
    "parse_abnormal": "解析异常",
    "corrected": "已纠错",
    "deprecated": "已作废",
    "merged": "已合并",
    "rollbacked": "已回滚",
}
DEVICE_CORRECTION_STATUS_LABELS = {
    "draft": "草稿",
    "submitted": "待审核",
    "approved": "审核通过",
    "rejected": "已驳回",
    "executed": "已执行",
    "cancelled": "已取消",
}


def device_revision_payload(row: RefDeviceClassificationRevision) -> dict[str, Any]:
    return {
        "revision_id": str(row.revision_id),
        "batch_id": row.batch_id,
        "source_file_name": row.source_file_name,
        "source_table_index": row.source_table_index,
        "row_number": row.row_number,
        "change_type": row.change_type,
        "reason": row.reason,
        "old_catalog_id": str(row.old_catalog_id) if row.old_catalog_id else None,
        "new_catalog_id": str(row.new_catalog_id) if row.new_catalog_id else None,
        "old_payload": row.old_payload or {},
        "new_payload": row.new_payload or {},
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def device_classification_payload(
    row: RefDeviceClassificationCatalog,
    latest_revision: RefDeviceClassificationRevision | None = None,
) -> dict[str, Any]:
    payload = {
        "catalog_id": str(row.catalog_id),
        "batch_id": row.batch_id,
        "source_file_name": row.source_file_name,
        "source_table_index": row.source_table_index,
        "row_number": row.row_number,
        "category_no": row.category_no,
        "major_category_no": row.major_category_no,
        "major_category_name": row.major_category_name,
        "level_1_category_no": row.level_1_category_no,
        "level_1_category": row.level_1_category,
        "level_2_category_no": row.level_2_category_no,
        "level_2_category": row.level_2_category,
        "product_description": row.product_description,
        "intended_use": row.intended_use,
        "product_examples": row.product_examples,
        "management_class": row.management_class,
        "data_status": row.data_status,
        "data_status_label": DEVICE_DATA_STATUS_LABELS.get(row.data_status, row.data_status),
        "status_reason": row.status_reason,
        "hidden_in_tree": row.hidden_in_tree,
        "merged_to_catalog_id": str(row.merged_to_catalog_id) if row.merged_to_catalog_id else None,
        "corrected_at": row.corrected_at.isoformat() if row.corrected_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
    if latest_revision is not None:
        payload["latest_revision"] = device_revision_payload(latest_revision)
    return payload


def _first(raw: dict[str, Any], names: tuple[str, ...]) -> str:
    for name in names:
        value = normalize_text(raw.get(name))
        if value:
            return value
    return ""


def _int_or_none(value: str) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _resolve_category_id(db: Session, value: str | None) -> uuid.UUID | None:
    normalized = normalize_text(value)
    if not normalized:
        return None
    try:
        return uuid.UUID(normalized)
    except ValueError:
        pass
    return db.scalar(
        select(DictEquipmentCategory.category_id).where(
            or_(
                DictEquipmentCategory.category_code == normalized,
                DictEquipmentCategory.category_name == normalized,
            )
        )
    )


def _resolve_device_classification_id(db: Session, value: str | None) -> uuid.UUID | None:
    normalized = normalize_text(value)
    if not normalized:
        return None
    try:
        return uuid.UUID(normalized)
    except ValueError:
        pass
    return db.scalar(
        select(RefDeviceClassificationCatalog.catalog_id).where(
            or_(
                RefDeviceClassificationCatalog.category_no == normalized,
                RefDeviceClassificationCatalog.major_category_no == normalized,
                RefDeviceClassificationCatalog.level_1_category_no == normalized,
                RefDeviceClassificationCatalog.level_2_category_no == normalized,
                RefDeviceClassificationCatalog.major_category_name == normalized,
                RefDeviceClassificationCatalog.level_2_category == normalized,
                RefDeviceClassificationCatalog.product_examples.ilike(f"%{normalized}%"),
            )
        )
    )


def import_equipment_categories(
    db: Session,
    file_content: bytes,
    filename: str,
    sheet_name: str | None,
    batch_id: str,
    source_system: str,
) -> dict[str, Any]:
    sheet_used, rows = load_tabular_rows(file_content, filename, sheet_name)
    failures: list[dict[str, Any]] = []
    success_count = 0
    duplicate_count = 0
    seen: set[str] = set()
    pending_parent_codes: list[tuple[DictEquipmentCategory, str]] = []

    for row_no, raw in enumerate(rows, start=2):
        category_code = _first(raw, ("category_code", "设备分类编码", "分类编码", "编码"))
        category_name = _first(raw, ("category_name", "设备分类名称", "分类名称", "名称"))
        parent_code = _first(raw, ("parent_category_code", "父级分类编码", "上级分类编码"))
        status = _first(raw, ("status", "状态")) or "ACTIVE"
        if not category_code:
            failures.append({"row": row_no, "field": "category_code", "message": "设备分类编码不能为空"})
            continue
        if not category_name:
            failures.append({"row": row_no, "field": "category_name", "message": "设备分类名称不能为空"})
            continue
        if category_code in seen:
            duplicate_count += 1
            continue
        seen.add(category_code)

        existing = db.scalar(select(DictEquipmentCategory).where(DictEquipmentCategory.category_code == category_code))
        payload = {
            "category_name": category_name,
            "level_no": _int_or_none(_first(raw, ("level_no", "层级", "级次"))),
            "source_system": source_system,
            "source_batch_id": batch_id,
            "status": status,
            "remark": _first(raw, ("remark", "备注")) or None,
        }
        if existing:
            duplicate_count += 1
            for key, value in payload.items():
                setattr(existing, key, value)
            row = existing
        else:
            row = DictEquipmentCategory(category_code=category_code, **payload)
            db.add(row)
        db.flush()
        if parent_code:
            pending_parent_codes.append((row, parent_code))
        success_count += 1

    for row, parent_code in pending_parent_codes:
        parent_id = db.scalar(
            select(DictEquipmentCategory.category_id).where(DictEquipmentCategory.category_code == parent_code)
        )
        if parent_id and parent_id != row.category_id:
            row.parent_category_id = parent_id

    return {
        "batch_id": batch_id,
        "source_type": "EQUIPMENT_CATEGORY",
        "source_file_name": Path(filename).name,
        "sheet_name": sheet_used or None,
        "source_row_count": len(rows),
        "unique_key_count": len(seen),
        "skipped_duplicate_count": duplicate_count,
        "success_count": success_count,
        "failed_count": len(failures),
        "duplicate_count": duplicate_count,
        "failures": failures,
    }


def import_equipment_standard_names(
    db: Session,
    file_content: bytes,
    filename: str,
    sheet_name: str | None,
    batch_id: str,
    source_system: str,
) -> dict[str, Any]:
    sheet_used, rows = load_tabular_rows(file_content, filename, sheet_name)
    failures: list[dict[str, Any]] = []
    success_count = 0
    duplicate_count = 0
    seen: set[str] = set()

    for row_no, raw in enumerate(rows, start=2):
        standard_code = _first(raw, ("standard_code", "设备标准编码", "标准编码", "编码"))
        standard_name = _first(raw, ("standard_name", "设备标准名称", "标准名称", "名称"))
        if not standard_name:
            failures.append({"row": row_no, "field": "standard_name", "message": "设备标准名称不能为空"})
            continue
        if not standard_code:
            standard_code = f"EQ-{uuid.uuid5(uuid.NAMESPACE_DNS, standard_name).hex[:12].upper()}"
        if standard_code in seen:
            duplicate_count += 1
            continue
        seen.add(standard_code)
        category_id = _resolve_category_id(db, _first(raw, ("category_id", "category_code", "设备分类编码", "设备分类名称")))
        device_classification_id = _resolve_device_classification_id(
            db,
            _first(raw, ("device_classification_id", "医疗器械分类ID", "医疗器械分类编码", "器械分类名称")),
        )
        payload = {
            "standard_name": standard_name,
            "alias_names": parse_list(_first(raw, ("alias_names", "别名", "曾用名"))),
            "category_id": category_id,
            "device_classification_id": device_classification_id,
            "common_manufacturer_org_ids": parse_list(_first(raw, ("common_manufacturer_org_ids", "常见生产厂家org_id", "厂家org_id"))),
            "management_class": _first(raw, ("management_class", "管理类别")) or None,
            "source_system": source_system,
            "source_batch_id": batch_id,
            "status": _first(raw, ("status", "状态")) or "ACTIVE",
            "remark": _first(raw, ("remark", "备注")) or None,
        }
        existing = db.scalar(
            select(DictEquipmentStandardName).where(
                or_(
                    DictEquipmentStandardName.standard_code == standard_code,
                    DictEquipmentStandardName.standard_name == standard_name,
                )
            )
        )
        if existing:
            duplicate_count += 1
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(DictEquipmentStandardName(standard_code=standard_code, **payload))
        success_count += 1

    return {
        "batch_id": batch_id,
        "source_type": "EQUIPMENT_STANDARD_NAME",
        "source_file_name": Path(filename).name,
        "sheet_name": sheet_used or None,
        "source_row_count": len(rows),
        "unique_key_count": len(seen),
        "skipped_duplicate_count": duplicate_count,
        "success_count": success_count,
        "failed_count": len(failures),
        "duplicate_count": duplicate_count,
        "failures": failures,
    }


def import_device_classification_catalog(
    db: Session,
    file_content: bytes,
    filename: str,
    batch_id: str,
    source_system: str | None = None,
    publish_date: Any = None,
    effective_date: Any = None,
    operator_name: str | None = None,
) -> dict[str, Any]:
    return import_device_classification_docx(
        db,
        file_content,
        filename,
        batch_id,
        source_system=source_system,
        publish_date=publish_date,
        effective_date=effective_date,
        operator_name=operator_name,
    )


def search_equipment_categories(
    db: Session,
    *,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[DictEquipmentCategory], int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(DictEquipmentCategory)
    count_stmt = select(func.count()).select_from(DictEquipmentCategory)
    filters = []
    if keyword:
        like = f"%{keyword}%"
        filters.append(or_(DictEquipmentCategory.category_code.ilike(like), DictEquipmentCategory.category_name.ilike(like)))
    if status:
        filters.append(DictEquipmentCategory.status == status)
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(DictEquipmentCategory.category_code).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return rows, total


def list_equipment_categories_for_tree(
    db: Session,
    *,
    keyword: str | None = None,
    status: str | None = "ACTIVE",
    limit: int = 5000,
) -> list[DictEquipmentCategory]:
    stmt = select(DictEquipmentCategory)
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(or_(DictEquipmentCategory.category_code.ilike(like), DictEquipmentCategory.category_name.ilike(like)))
    if status:
        stmt = stmt.where(DictEquipmentCategory.status == status)
    return db.scalars(stmt.order_by(DictEquipmentCategory.category_code).limit(min(max(limit, 1), 10000))).all()


def search_equipment_standard_names(
    db: Session,
    *,
    keyword: str | None = None,
    category_id: uuid.UUID | None = None,
    status: str | None = "ACTIVE",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[DictEquipmentStandardName], int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(DictEquipmentStandardName)
    count_stmt = select(func.count()).select_from(DictEquipmentStandardName)
    filters = []
    if keyword:
        like = f"%{keyword}%"
        filters.append(
            or_(
                DictEquipmentStandardName.standard_code.ilike(like),
                DictEquipmentStandardName.standard_name.ilike(like),
                DictEquipmentStandardName.alias_names.cast(Text).ilike(like),
            )
        )
    if category_id:
        filters.append(DictEquipmentStandardName.category_id == category_id)
    if status:
        filters.append(DictEquipmentStandardName.status == status)
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(DictEquipmentStandardName.standard_code).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return rows, total


def search_device_classifications(
    db: Session,
    *,
    keyword: str | None = None,
    management_class: str | None = None,
    data_status: str | None = "effective",
    include_hidden: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[RefDeviceClassificationCatalog], int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(RefDeviceClassificationCatalog)
    count_stmt = select(func.count()).select_from(RefDeviceClassificationCatalog)
    filters = []
    if keyword:
        like = f"%{keyword}%"
        filters.append(
            or_(
                RefDeviceClassificationCatalog.category_no.ilike(like),
                RefDeviceClassificationCatalog.major_category_no.ilike(like),
                RefDeviceClassificationCatalog.major_category_name.ilike(like),
                RefDeviceClassificationCatalog.level_1_category_no.ilike(like),
                RefDeviceClassificationCatalog.level_1_category.ilike(like),
                RefDeviceClassificationCatalog.level_2_category_no.ilike(like),
                RefDeviceClassificationCatalog.level_2_category.ilike(like),
                RefDeviceClassificationCatalog.product_description.ilike(like),
                RefDeviceClassificationCatalog.intended_use.ilike(like),
                RefDeviceClassificationCatalog.product_examples.ilike(like),
            )
        )
    if management_class:
        filters.append(RefDeviceClassificationCatalog.management_class == management_class)
    if data_status and data_status != "all":
        filters.append(RefDeviceClassificationCatalog.data_status == data_status)
    if not include_hidden:
        filters.append(RefDeviceClassificationCatalog.hidden_in_tree.is_(False))
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(
            RefDeviceClassificationCatalog.major_category_no,
            RefDeviceClassificationCatalog.level_1_category_no,
            RefDeviceClassificationCatalog.level_2_category_no,
            RefDeviceClassificationCatalog.row_number,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return rows, total


def list_device_classifications_for_tree(
    db: Session,
    *,
    keyword: str | None = None,
    management_class: str | None = None,
    data_status: str | None = "effective",
    include_hidden: bool = False,
    limit: int = 5000,
) -> list[RefDeviceClassificationCatalog]:
    stmt = select(RefDeviceClassificationCatalog)
    filters = []
    if keyword:
        like = f"%{keyword}%"
        filters.append(
            or_(
                RefDeviceClassificationCatalog.category_no.ilike(like),
                RefDeviceClassificationCatalog.major_category_no.ilike(like),
                RefDeviceClassificationCatalog.major_category_name.ilike(like),
                RefDeviceClassificationCatalog.level_1_category_no.ilike(like),
                RefDeviceClassificationCatalog.level_1_category.ilike(like),
                RefDeviceClassificationCatalog.level_2_category_no.ilike(like),
                RefDeviceClassificationCatalog.level_2_category.ilike(like),
                RefDeviceClassificationCatalog.product_description.ilike(like),
                RefDeviceClassificationCatalog.intended_use.ilike(like),
                RefDeviceClassificationCatalog.product_examples.ilike(like),
            )
        )
    if management_class:
        filters.append(RefDeviceClassificationCatalog.management_class == management_class)
    if data_status and data_status != "all":
        filters.append(RefDeviceClassificationCatalog.data_status == data_status)
    if not include_hidden:
        filters.append(RefDeviceClassificationCatalog.hidden_in_tree.is_(False))
    for condition in filters:
        stmt = stmt.where(condition)
    return db.scalars(
        stmt.order_by(
            RefDeviceClassificationCatalog.major_category_no,
            RefDeviceClassificationCatalog.level_1_category_no,
            RefDeviceClassificationCatalog.level_2_category_no,
            RefDeviceClassificationCatalog.row_number,
        ).limit(min(max(limit, 1), 10000))
    ).all()


def latest_device_revisions_for_catalogs(
    db: Session,
    catalog_ids: list[uuid.UUID],
) -> dict[uuid.UUID, RefDeviceClassificationRevision]:
    if not catalog_ids:
        return {}
    revisions = db.scalars(
        select(RefDeviceClassificationRevision)
        .where(RefDeviceClassificationRevision.new_catalog_id.in_(catalog_ids))
        .order_by(RefDeviceClassificationRevision.created_at.desc())
    ).all()
    result: dict[uuid.UUID, RefDeviceClassificationRevision] = {}
    for revision in revisions:
        if revision.new_catalog_id and revision.new_catalog_id not in result:
            result[revision.new_catalog_id] = revision
    return result


def device_revision_summary(db: Session) -> dict[str, Any]:
    row = db.execute(
        select(
            func.count(RefDeviceClassificationRevision.revision_id),
            func.count(func.distinct(RefDeviceClassificationRevision.new_catalog_id)),
            func.max(RefDeviceClassificationRevision.created_at),
        )
    ).one()
    by_type_rows = db.execute(
        select(RefDeviceClassificationRevision.change_type, func.count())
        .group_by(RefDeviceClassificationRevision.change_type)
    ).all()
    by_type = {str(change_type): int(count) for change_type, count in by_type_rows}
    last_updated = row[2]
    return {
        "revision_count": int(row[0] or 0),
        "revised_item_count": int(row[1] or 0),
        "added_count": by_type.get("ADDED", 0),
        "modified_count": by_type.get("MODIFIED", 0),
        "deleted_count": by_type.get("DELETED", 0),
        "last_updated_at": last_updated.isoformat() if last_updated else None,
    }


def list_device_revisions(
    db: Session,
    *,
    catalog_id: uuid.UUID | None = None,
    batch_id: str | None = None,
    limit: int = 200,
) -> list[RefDeviceClassificationRevision]:
    stmt = select(RefDeviceClassificationRevision)
    if catalog_id:
        stmt = stmt.where(
            or_(
                RefDeviceClassificationRevision.new_catalog_id == catalog_id,
                RefDeviceClassificationRevision.old_catalog_id == catalog_id,
            )
        )
    if batch_id:
        stmt = stmt.where(RefDeviceClassificationRevision.batch_id == batch_id)
    return db.scalars(
        stmt.order_by(RefDeviceClassificationRevision.created_at.desc(), RefDeviceClassificationRevision.row_number)
        .limit(min(max(limit, 1), 1000))
    ).all()


DEVICE_ALLOWED_MANAGEMENT_CLASSES = {"Ⅰ", "Ⅱ", "Ⅲ", "I", "II", "III"}
DEVICE_HEADER_VALUES = {"产品描述", "预期用途", "管理类别", "品名举例", "序号", "一级产品类别", "二级产品类别", "子目录"}
DEVICE_REVISION_NOTE_MARKERS = {"目录调整", "修订", "原产品描述", "原预期用途", "原管理类别"}


def is_invalid_device_row(row: RefDeviceClassificationCatalog) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    name = normalize_text(row.level_2_category)
    text_fields = [
        normalize_text(row.level_2_category),
        normalize_text(row.product_description),
        normalize_text(row.intended_use),
        normalize_text(row.product_examples),
    ]
    if row.data_status in {"pending_confirm", "parse_abnormal"}:
        reasons.append(DEVICE_DATA_STATUS_LABELS.get(row.data_status, row.data_status))
    if not name:
        reasons.append("目录名称为空")
    if name.startswith(("-", "－", "—")):
        reasons.append("目录名称以异常连接符开头")
    if name in DEVICE_HEADER_VALUES:
        reasons.append("目录名称疑似字段表头")
    for value, label in (
        (row.product_description, "产品描述"),
        (row.intended_use, "预期用途"),
        (row.product_examples, "品名举例"),
    ):
        if normalize_text(value) == label:
            reasons.append(f"{label}字段疑似表头")
    if normalize_text(row.management_class) and normalize_text(row.management_class) not in DEVICE_ALLOWED_MANAGEMENT_CLASSES:
        reasons.append("管理类别异常")
    code_parts = [normalize_text(row.major_category_no), normalize_text(row.level_1_category_no), normalize_text(row.level_2_category_no)]
    if not all(part.isdigit() for part in code_parts):
        reasons.append("分类编码不完整或格式异常")
    if any(marker in " ".join(text_fields) for marker in DEVICE_REVISION_NOTE_MARKERS):
        reasons.append("疑似修订说明行被误解析")
    return (len(reasons) > 0, reasons)


def list_invalid_device_classifications(
    db: Session,
    *,
    limit: int = 500,
) -> list[dict[str, Any]]:
    rows = list_device_classifications_for_tree(db, data_status="all", include_hidden=True, limit=10000)
    result: list[dict[str, Any]] = []
    for row in rows:
        invalid, reasons = is_invalid_device_row(row)
        if not invalid:
            continue
        payload = device_classification_payload(row)
        payload["invalid_reasons"] = reasons
        result.append(payload)
        if len(result) >= limit:
            break
    return result


def mark_invalid_device_classifications_for_governance(
    db: Session,
    *,
    operator_name: str | None = None,
) -> dict[str, int]:
    rows = list_device_classifications_for_tree(db, data_status="all", include_hidden=True, limit=10000)
    target_ids: list[uuid.UUID] = []
    for row in rows:
        invalid, _ = is_invalid_device_row(row)
        if invalid:
            target_ids.append(row.catalog_id)
    if not target_ids:
        return {"marked_count": 0}

    now = datetime.now(timezone.utc)
    for row in rows:
        if row.catalog_id not in target_ids:
            continue
        before = device_classification_payload(row)
        row.data_status = "parse_abnormal"
        row.hidden_in_tree = True
        row.status_reason = "历史异常候选已纳入数据纠错闭环，不进行物理删除"
        row.corrected_at = now
        db.add(
            CatalogChangeHistory(
                catalog_id=row.catalog_id,
                change_type="MARK_PARSE_ABNORMAL",
                before_data=before,
                after_data=device_classification_payload(row),
                operator_name=operator_name,
                reason=row.status_reason,
            )
        )
    return {
        "marked_count": len(target_ids),
    }


def _catalog_source_position(row: RefDeviceClassificationCatalog) -> str:
    return f"表 {row.source_table_index + 1} 第 {row.row_number} 行"


def analyze_device_classification_impact(db: Session, catalog_id: uuid.UUID) -> dict[str, Any]:
    row = db.get(RefDeviceClassificationCatalog, catalog_id)
    if row is None:
        raise ValueError("CATALOG_NOT_FOUND")
    children = 0
    if row.major_category_no and row.level_1_category_no and not row.level_2_category_no:
        children = db.scalar(
            select(func.count()).select_from(RefDeviceClassificationCatalog).where(
                RefDeviceClassificationCatalog.major_category_no == row.major_category_no,
                RefDeviceClassificationCatalog.level_1_category_no == row.level_1_category_no,
                RefDeviceClassificationCatalog.catalog_id != catalog_id,
            )
        ) or 0
    equipment_refs = db.scalar(
        select(func.count()).select_from(DictEquipmentStandardName).where(
            DictEquipmentStandardName.device_classification_id == catalog_id
        )
    ) or 0
    reference_rows = db.execute(
        select(CatalogReferenceRelation.reference_type, func.count()).where(
            CatalogReferenceRelation.catalog_id == catalog_id,
            CatalogReferenceRelation.status == "active",
        ).group_by(CatalogReferenceRelation.reference_type)
    ).all()
    reference_counts = {str(item[0]): int(item[1]) for item in reference_rows}
    impact = {
        "child_catalog_count": int(children),
        "material_master_ref_count": int(reference_counts.get("material_master", 0)),
        "equipment_master_ref_count": int(equipment_refs + reference_counts.get("equipment_master", 0)),
        "insurance_mapping_ref_count": int(reference_counts.get("insurance_mapping", 0)),
        "internal_mapping_ref_count": int(reference_counts.get("internal_mapping", 0)),
        "historical_business_ref_count": int(reference_counts.get("business_history", 0)),
    }
    impact["total_ref_count"] = sum(int(value) for value in impact.values())
    impact["can_deprecate_without_migration"] = impact["total_ref_count"] == 0
    impact["requires_target_mapping"] = impact["total_ref_count"] > 0
    return impact


def catalog_correction_payload(row: CatalogCorrectionOrder) -> dict[str, Any]:
    return {
        "correction_id": str(row.correction_id),
        "correction_no": row.correction_no,
        "catalog_id": str(row.catalog_id),
        "source_batch_id": row.source_batch_id,
        "source_file_id": str(row.source_file_id) if row.source_file_id else None,
        "source_file_hash": row.source_file_hash,
        "source_position": row.source_position,
        "abnormal_type": row.abnormal_type,
        "correction_action": row.correction_action,
        "before_data": row.before_data or {},
        "after_data": row.after_data or {},
        "reason": row.reason,
        "handling_note": row.handling_note,
        "impact_summary": row.impact_summary or {},
        "hide_in_tree": row.hide_in_tree,
        "need_review": row.need_review,
        "attachment_payload": row.attachment_payload or [],
        "applicant_user_id": row.applicant_user_id,
        "applicant_name": row.applicant_name,
        "reviewer_user_id": row.reviewer_user_id,
        "reviewer_name": row.reviewer_name,
        "status": row.status,
        "status_label": DEVICE_CORRECTION_STATUS_LABELS.get(row.status, row.status),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "executed_at": row.executed_at.isoformat() if row.executed_at else None,
    }


def list_catalog_correction_orders(
    db: Session,
    *,
    status: str | None = None,
    abnormal_type: str | None = None,
    correction_action: str | None = None,
    source_batch_id: str | None = None,
    applicant_name: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    stmt = select(CatalogCorrectionOrder)
    if status and status != "all":
        stmt = stmt.where(CatalogCorrectionOrder.status == status)
    if abnormal_type:
        stmt = stmt.where(CatalogCorrectionOrder.abnormal_type == abnormal_type)
    if correction_action:
        stmt = stmt.where(CatalogCorrectionOrder.correction_action == correction_action)
    if source_batch_id:
        stmt = stmt.where(CatalogCorrectionOrder.source_batch_id == source_batch_id)
    if applicant_name:
        stmt = stmt.where(CatalogCorrectionOrder.applicant_name.ilike(f"%{applicant_name}%"))
    rows = db.scalars(stmt.order_by(CatalogCorrectionOrder.created_at.desc()).limit(min(max(limit, 1), 1000))).all()
    return [catalog_correction_payload(row) for row in rows]


def get_device_classification_governance_detail(db: Session, catalog_id: uuid.UUID) -> dict[str, Any]:
    row = db.get(RefDeviceClassificationCatalog, catalog_id)
    if row is None:
        raise ValueError("CATALOG_NOT_FOUND")
    source_file = db.scalar(select(DeviceClassificationSourceFile).where(DeviceClassificationSourceFile.batch_id == row.batch_id))
    batch = db.get(SysImportBatch, row.batch_id)
    changes = db.scalars(
        select(CatalogChangeHistory)
        .where(CatalogChangeHistory.catalog_id == catalog_id)
        .order_by(CatalogChangeHistory.created_at.desc())
        .limit(100)
    ).all()
    corrections = db.scalars(
        select(CatalogCorrectionOrder)
        .where(CatalogCorrectionOrder.catalog_id == catalog_id)
        .order_by(CatalogCorrectionOrder.created_at.desc())
        .limit(100)
    ).all()
    correction_ids = [item.correction_id for item in corrections]
    logs = db.scalars(
        select(CatalogCorrectionLog)
        .where(CatalogCorrectionLog.correction_id.in_(correction_ids))
        .order_by(CatalogCorrectionLog.created_at.desc())
    ).all() if correction_ids else []
    return {
        "catalog": device_classification_payload(row),
        "source_trace": {
            "source_batch_id": row.batch_id,
            "source_file_id": str(source_file.source_file_id) if source_file else None,
            "source_file_name": row.source_file_name,
            "source_file_hash": source_file.sha256 if source_file else None,
            "source_position": _catalog_source_position(row),
            "imported_at": row.created_at.isoformat() if row.created_at else None,
            "import_mode": batch.import_mode if batch else None,
            "source_announcement": batch.catalog_version or batch.source_system if batch else None,
            "operator_name": batch.operator_name if batch else None,
            "batch_status": batch.status if batch else None,
        },
        "change_history": [
            {
                "history_id": str(item.history_id),
                "change_type": item.change_type,
                "before_data": item.before_data or {},
                "after_data": item.after_data or {},
                "operator_name": item.operator_name,
                "reason": item.reason,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in changes
        ],
        "correction_orders": [catalog_correction_payload(item) for item in corrections],
        "correction_logs": [
            {
                "log_id": str(item.log_id),
                "correction_id": str(item.correction_id),
                "action": item.action,
                "operator_name": item.operator_name,
                "message": item.message,
                "payload": item.payload or {},
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in logs
        ],
        "impact_analysis": analyze_device_classification_impact(db, catalog_id),
    }


def list_same_batch_abnormalities(db: Session, catalog_id: uuid.UUID, limit: int = 200) -> list[dict[str, Any]]:
    row = db.get(RefDeviceClassificationCatalog, catalog_id)
    if row is None:
        raise ValueError("CATALOG_NOT_FOUND")
    candidates = db.scalars(
        select(RefDeviceClassificationCatalog)
        .where(RefDeviceClassificationCatalog.batch_id == row.batch_id)
        .order_by(RefDeviceClassificationCatalog.row_number)
        .limit(min(max(limit, 1), 1000))
    ).all()
    result: list[dict[str, Any]] = []
    for item in candidates:
        invalid, reasons = is_invalid_device_row(item)
        if invalid or item.data_status in {"pending_confirm", "parse_abnormal"}:
            payload = device_classification_payload(item)
            payload["invalid_reasons"] = reasons or [item.status_reason or "状态需人工确认"]
            result.append(payload)
    return result


def create_catalog_correction_order(
    db: Session,
    catalog_id: uuid.UUID,
    payload: dict[str, Any],
    *,
    applicant_user_id: str | None = None,
    applicant_name: str | None = None,
) -> dict[str, Any]:
    row = db.get(RefDeviceClassificationCatalog, catalog_id)
    if row is None:
        raise ValueError("CATALOG_NOT_FOUND")
    impact = analyze_device_classification_impact(db, catalog_id)
    action = normalize_text(payload.get("correction_action") or payload.get("action") or "标记作废")
    if action in {"标记作废", "合并到已有目录"} and impact["requires_target_mapping"] and not payload.get("target_catalog_id"):
        raise ValueError("TARGET_CATALOG_REQUIRED")
    source_file = db.scalar(select(DeviceClassificationSourceFile).where(DeviceClassificationSourceFile.batch_id == row.batch_id))
    before = device_classification_payload(row)
    after = dict(before)
    if action == "标记作废":
        after.update({"data_status": "deprecated", "hidden_in_tree": True})
    elif action == "合并到已有目录":
        after.update({"data_status": "merged", "hidden_in_tree": True, "merged_to_catalog_id": payload.get("target_catalog_id")})
    elif action == "保持不变":
        after.update({"data_status": "corrected", "status_reason": payload.get("reason") or "人工确认保持不变"})
    correction = CatalogCorrectionOrder(
        correction_no=f"CORR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}",
        catalog_id=catalog_id,
        source_batch_id=row.batch_id,
        source_file_id=source_file.source_file_id if source_file else None,
        source_file_hash=source_file.sha256 if source_file else None,
        source_position=_catalog_source_position(row),
        abnormal_type=normalize_text(payload.get("abnormal_type")) or "目录名称异常",
        correction_action=action,
        before_data=before,
        after_data=after,
        reason=normalize_text(payload.get("reason")) or "发起目录数据纠错",
        handling_note=normalize_text(payload.get("handling_note")) or None,
        impact_summary=impact,
        hide_in_tree=bool(payload.get("hide_in_tree", action in {"标记作废", "合并到已有目录"})),
        need_review=bool(payload.get("need_review", True)),
        attachment_payload=payload.get("attachments") or [],
        applicant_user_id=applicant_user_id,
        applicant_name=applicant_name,
        status="submitted",
    )
    db.add(correction)
    db.flush()
    db.add(
        CatalogCorrectionLog(
            correction_id=correction.correction_id,
            action="SUBMIT",
            operator_user_id=applicant_user_id,
            operator_name=applicant_name,
            message="已发起目录数据纠错",
            payload={"impact_summary": impact},
        )
    )
    db.add(
        DeviceClassificationImportAuditLog(
            batch_id=row.batch_id,
            action="CATALOG_CORRECTION_SUBMITTED",
            operator_name=applicant_name,
            message=f"目录 {before.get('level_2_category') or before.get('level_1_category') or before.get('major_category_name')} 已发起纠错",
            payload=catalog_correction_payload(correction),
        )
    )
    return catalog_correction_payload(correction)


def execute_catalog_correction_order(
    db: Session,
    correction_id: uuid.UUID,
    *,
    reviewer_user_id: str | None = None,
    reviewer_name: str | None = None,
) -> dict[str, Any]:
    correction = db.get(CatalogCorrectionOrder, correction_id)
    if correction is None:
        raise ValueError("CORRECTION_NOT_FOUND")
    row = db.get(RefDeviceClassificationCatalog, correction.catalog_id)
    if row is None:
        raise ValueError("CATALOG_NOT_FOUND")
    before = device_classification_payload(row)
    now = datetime.now(timezone.utc)
    action = correction.correction_action
    if action == "标记作废":
        row.data_status = "deprecated"
        row.hidden_in_tree = True
    elif action == "合并到已有目录":
        row.data_status = "merged"
        row.hidden_in_tree = True
        target = correction.after_data.get("merged_to_catalog_id") if isinstance(correction.after_data, dict) else None
        row.merged_to_catalog_id = uuid.UUID(target) if target else None
    elif action == "保持不变":
        row.data_status = "corrected"
    elif action == "退回批次":
        row.data_status = "rollbacked"
        row.hidden_in_tree = True
    else:
        row.data_status = "corrected"
    row.status_reason = correction.reason
    row.corrected_at = now
    correction.status = "executed"
    correction.reviewer_user_id = reviewer_user_id
    correction.reviewer_name = reviewer_name
    correction.reviewed_at = correction.reviewed_at or now
    correction.executed_at = now
    after = device_classification_payload(row)
    correction.after_data = after
    db.add(CatalogChangeHistory(
        catalog_id=row.catalog_id,
        correction_id=correction.correction_id,
        change_type=action,
        before_data=before,
        after_data=after,
        operator_name=reviewer_name,
        reason=correction.reason,
    ))
    db.add(CatalogCorrectionLog(
        correction_id=correction.correction_id,
        action="EXECUTE",
        operator_user_id=reviewer_user_id,
        operator_name=reviewer_name,
        message="纠错动作已执行并写入历史",
        payload={"before": before, "after": after},
    ))
    db.add(DeviceClassificationImportAuditLog(
        batch_id=row.batch_id,
        action="CATALOG_CORRECTION_EXECUTED",
        operator_name=reviewer_name,
        message=f"目录纠错单 {correction.correction_no} 已执行",
        payload=catalog_correction_payload(correction),
    ))
    return catalog_correction_payload(correction)


def review_catalog_correction_order(
    db: Session,
    correction_id: uuid.UUID,
    *,
    approved: bool,
    reviewer_user_id: str | None = None,
    reviewer_name: str | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    correction = db.get(CatalogCorrectionOrder, correction_id)
    if correction is None:
        raise ValueError("CORRECTION_NOT_FOUND")
    now = datetime.now(timezone.utc)
    correction.status = "approved" if approved else "rejected"
    correction.reviewer_user_id = reviewer_user_id
    correction.reviewer_name = reviewer_name
    correction.reviewed_at = now
    db.add(
        CatalogCorrectionLog(
            correction_id=correction.correction_id,
            action="APPROVE" if approved else "REJECT",
            operator_user_id=reviewer_user_id,
            operator_name=reviewer_name,
            message=message or ("审核通过" if approved else "审核驳回"),
            payload={"status": correction.status},
        )
    )
    if correction.source_batch_id:
        db.add(
            DeviceClassificationImportAuditLog(
                batch_id=correction.source_batch_id,
                action="CATALOG_CORRECTION_APPROVED" if approved else "CATALOG_CORRECTION_REJECTED",
                operator_name=reviewer_name,
                message=f"目录纠错单 {correction.correction_no} {'审核通过' if approved else '审核驳回'}",
                payload=catalog_correction_payload(correction),
            )
        )
    return catalog_correction_payload(correction)
