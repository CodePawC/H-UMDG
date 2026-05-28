"""Manufacturer/vendor master data services."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy import Text, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.tables import (
    MdmExternalMapping,
    ManufacturerVendorCandidate,
    ManufacturerVendorExternalMapping,
    ManufacturerVendorMaster,
    ManufacturerVendorRelation,
    ManufacturerVendorRole,
    OrganizationContact,
    OrganizationQualification,
)

ROLE_LABELS = {
    "manufacturer": "生产厂家",
    "brand_owner": "品牌方",
    "registrant": "注册人",
    "registration_holder": "注册证持有人",
    "filer": "备案人",
    "agent": "代理商",
    "domestic_general_agent": "国内总代理",
    "authorized_agent": "授权代理商",
    "dealer": "经销商",
    "distributor": "配送企业",
    "after_sales": "售后服务商",
    "maintainer": "维保商",
    "third_party_repair": "第三方维修商",
    "metrology_institute": "计量检定机构",
    "testing_institution": "检测机构",
    "software_service": "软件服务商",
    "logistics_provider": "物流单位",
    "insurance_company": "保险公司",
    "finance_lease_company": "金融租赁公司",
    "supplier": "供应商",
    "service_provider": "服务商",
    "other": "其他",
}

RELATION_LABELS = {
    "parent_company": "母公司",
    "subsidiary": "子公司",
    "group_member": "集团成员",
    "acquired_by": "被收购",
    "renamed_from": "曾用名",
    "merged_into": "合并",
    "authorized_agent": "授权代理",
    "authorized_after_sales": "授权售后",
    "authorized_maintenance": "授权维保",
    "registration_holder": "注册证持有人",
    "regional_agent": "区域代理",
    "import_general_agent": "进口总代",
    "distribution_relation": "配送关系",
    "brand_ownership": "品牌归属",
    "holding_relation": "控股关系",
}

ROLE_TYPES = frozenset(ROLE_LABELS)
BUSINESS_DOMAINS = frozenset({"drug", "device", "consumable", "reagent", "equipment", "service", "other"})
RELATION_TYPES = frozenset(RELATION_LABELS)
SYSTEM_NAMES = frozenset({"NHSA", "SPD", "HIS", "HRP", "FINANCE", "SUPPLIER_PORTAL", "EQUIPMENT_OS", "MEDICAL_OS", "MANUAL", "OTHER"})
MASTER_STATUSES = frozenset({"enabled", "disabled", "cancelled", "merged", "renamed"})
QUALITY_STATUSES = frozenset(
    {"normal", "missing_field", "duplicate_suspected", "name_not_standard", "pending_manual_confirm"}
)
AUDIT_STATUSES = frozenset({"not_submitted", "pending", "approved", "rejected", "returned"})
MATCH_STATUSES = frozenset({"unmatched", "matched", "need_review", "ignored"})
SUGGESTED_ACTIONS = frozenset({"create_new", "map_existing", "merge", "ignore"})
QUALIFICATION_STATUSES = frozenset({"enabled", "disabled", "expired", "expiring", "pending_review"})
CONTACT_STATUSES = frozenset({"enabled", "disabled"})

_FULLWIDTH_OFFSET = ord("Ａ") - ord("A")
_CHINESE_SUFFIXES = ("股份有限公司", "有限责任公司", "有限公司", "集团有限公司", "公司")
_ROLE_ALIASES = {
    "生产厂家": "manufacturer",
    "厂家": "manufacturer",
    "品牌方": "brand_owner",
    "注册人": "registrant",
    "注册证持有人": "registration_holder",
    "备案人": "filer",
    "国内总代理": "domestic_general_agent",
    "代理商": "agent",
    "授权代理商": "authorized_agent",
    "经销商": "dealer",
    "配送商": "distributor",
    "配送企业": "distributor",
    "供应商": "supplier",
    "维保商": "maintainer",
    "售后服务商": "after_sales",
    "第三方维修商": "third_party_repair",
    "计量检定机构": "metrology_institute",
    "校准机构": "metrology_institute",
    "检测机构": "testing_institution",
    "软件服务商": "software_service",
    "物流单位": "logistics_provider",
    "保险公司": "insurance_company",
    "金融租赁公司": "finance_lease_company",
    "服务商": "service_provider",
    "其他": "other",
}


def normalize_vendor_name(value: str | None) -> str:
    if not value:
        return ""
    chars: list[str] = []
    for char in str(value).strip():
        code = ord(char)
        if code == 0x3000:
            chars.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:
            chars.append(chr(code - 0xFEE0))
        else:
            chars.append(char)
    normalized = "".join(chars)
    normalized = normalized.replace("(", "（").replace(")", "）")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if re.search(r"[A-Za-z]", normalized) and not re.search(r"[\u4e00-\u9fff]", normalized):
        normalized = normalized.upper()
    return normalized


def normalize_credit_code(value: str | None) -> str | None:
    cleaned = normalize_vendor_name(value).replace(" ", "").upper()
    if not cleaned:
        return None
    if not re.fullmatch(r"[0-9A-Z]{18}", cleaned):
        raise ValueError("统一社会信用代码须为18位数字或大写字母")
    return cleaned


def organization_core_name(value: str | None) -> str:
    name = normalize_vendor_name(value)
    for suffix in _CHINESE_SUFFIXES:
        if name.endswith(suffix) and len(name) > len(suffix) + 2:
            return name[: -len(suffix)]
    return name


def _same_or_similar(a: str, b: str) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    if organization_core_name(a) == organization_core_name(b):
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.92


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        raw_items = value
    elif isinstance(value, str):
        raw_items = re.split(r"[;；,\n]+", value)
    else:
        raw_items = [str(value)]
    result: list[str] = []
    seen: set[str] = set()
    for item in raw_items:
        normalized = normalize_vendor_name(str(item))
        if normalized and normalized not in seen:
            result.append(normalized)
            seen.add(normalized)
    return result


def vendor_payload(
    row: ManufacturerVendorMaster,
    *,
    roles: list[ManufacturerVendorRole] | None = None,
    mappings: list[ManufacturerVendorExternalMapping] | None = None,
    relations: list[ManufacturerVendorRelation] | None = None,
    qualifications: list[OrganizationQualification] | None = None,
    contacts: list[OrganizationContact] | None = None,
    external_mappings: list[MdmExternalMapping] | None = None,
) -> dict[str, Any]:
    data = {
        "id": str(row.id),
        "org_id": str(row.id),
        "organization_code": row.organization_code,
        "org_code": row.organization_code,
        "standard_name": row.standard_name,
        "org_name": row.standard_name,
        "english_name": row.english_name,
        "short_name": row.short_name,
        "org_short_name": row.short_name,
        "former_name": row.former_name,
        "alias_names": row.alias_names or [],
        "unified_social_credit_code": row.unified_social_credit_code,
        "organization_type": row.organization_type,
        "org_type": row.organization_type,
        "country_region": row.country_region,
        "province": row.province,
        "city": row.city,
        "address": row.address,
        "registered_address": row.registered_address or row.address,
        "office_address": row.office_address,
        "contact_phone": row.contact_phone,
        "website": row.website,
        "legal_representative": row.legal_representative,
        "status": row.status,
        "data_source": row.data_source,
        "source_system": row.source_system or row.data_source,
        "source": "h-mdm",
        "version": row.updated_at.isoformat() if row.updated_at else None,
        "enabled": row.status == "enabled",
        "quality_status": row.quality_status,
        "audit_status": row.audit_status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "created_by": row.created_by,
        "updated_by": row.updated_by,
    }
    if roles is not None:
        data["roles"] = [role_payload(role) for role in roles]
    if mappings is not None:
        data["external_mappings"] = [mapping_payload(mapping) for mapping in mappings]
    if external_mappings is not None:
        data["mdm_external_mappings"] = [external_mapping_payload(mapping) for mapping in external_mappings]
    if relations is not None:
        data["relations"] = [relation_payload(relation) for relation in relations]
    if qualifications is not None:
        data["qualifications"] = [qualification_payload(row) for row in qualifications]
    if contacts is not None:
        data["contacts"] = [contact_payload(row) for row in contacts]
    return data


def role_payload(row: ManufacturerVendorRole) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "role_id": str(row.id),
        "org_id": str(row.org_id),
        "role_type": row.role_type,
        "role_name": row.role_name,
        "business_domain": row.business_domain,
        "status": row.status,
        "role_status": row.status,
        "effective_date": _date_string(row.effective_date),
        "expired_date": _date_string(row.expired_date),
        "qualification_required": row.qualification_required,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def relation_payload(row: ManufacturerVendorRelation) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "parent_org_id": str(row.parent_org_id),
        "child_org_id": str(row.child_org_id),
        "relation_type": row.relation_type,
        "relation_name": row.relation_name,
        "effective_date": row.effective_date.isoformat() if row.effective_date else None,
        "expired_date": row.expired_date.isoformat() if row.expired_date else None,
        "evidence_file_url": row.evidence_file_url,
        "status": row.status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def qualification_payload(row: OrganizationQualification) -> dict[str, Any]:
    return {
        "qualification_id": str(row.qualification_id),
        "id": str(row.qualification_id),
        "org_id": str(row.org_id),
        "qualification_type": row.qualification_type,
        "certificate_no": row.certificate_no,
        "certificate_name": row.certificate_name,
        "issuing_authority": row.issuing_authority,
        "valid_from": _date_string(row.valid_from),
        "valid_to": _date_string(row.valid_to),
        "file_id": row.file_id,
        "status": row.status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def contact_payload(row: OrganizationContact) -> dict[str, Any]:
    return {
        "contact_id": str(row.contact_id),
        "id": str(row.contact_id),
        "org_id": str(row.org_id),
        "contact_name": row.contact_name,
        "department": row.department,
        "position": row.position,
        "phone": row.phone,
        "mobile": row.mobile,
        "email": row.email,
        "contact_type": row.contact_type,
        "is_primary": row.is_primary,
        "status": row.status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def external_mapping_payload(row: MdmExternalMapping) -> dict[str, Any]:
    return {
        "mapping_id": str(row.mapping_id),
        "id": str(row.mapping_id),
        "master_type": row.master_type,
        "master_id": str(row.master_id),
        "source_system": row.source_system,
        "external_code": row.external_code,
        "external_name": row.external_name,
        "mapping_confidence": float(row.mapping_confidence) if row.mapping_confidence is not None else None,
        "status": row.status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def mapping_payload(row: ManufacturerVendorExternalMapping) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "org_id": str(row.org_id),
        "system_name": row.system_name,
        "external_code": row.external_code,
        "external_name": row.external_name,
        "is_current": row.is_current,
        "confidence": float(row.confidence) if row.confidence is not None else None,
        "audit_status": row.audit_status,
        "remark": row.remark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def candidate_payload(row: ManufacturerVendorCandidate) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "source_system": row.source_system,
        "source_table": row.source_table,
        "source_record_id": row.source_record_id,
        "raw_name": row.raw_name,
        "normalized_name": row.normalized_name,
        "matched_org_id": str(row.matched_org_id) if row.matched_org_id else None,
        "match_confidence": float(row.match_confidence) if row.match_confidence is not None else None,
        "match_status": row.match_status,
        "suggested_action": row.suggested_action,
        "reviewed_by": row.reviewed_by,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def generate_org_code(db: Session) -> str:
    prefix = "MV"
    current = db.scalar(select(func.count()).select_from(ManufacturerVendorMaster)) or 0
    for offset in range(1, 1000):
        code = f"{prefix}{current + offset:08d}"
        if db.scalar(select(ManufacturerVendorMaster.id).where(ManufacturerVendorMaster.organization_code == code)) is None:
            return code
    return f"{prefix}{uuid.uuid4().hex[:10].upper()}"


def _ensure_enum(value: str, allowed: frozenset[str], field: str) -> str:
    normalized = normalize_vendor_name(value).lower()
    if normalized not in allowed:
        raise ValueError(f"{field} is invalid: {value}")
    return normalized


def normalize_role_type(value: str | None) -> str:
    raw = normalize_vendor_name(value)
    if raw in _ROLE_ALIASES:
        return _ROLE_ALIASES[raw]
    normalized = raw.lower()
    if normalized not in ROLE_TYPES:
        raise ValueError(f"role_type is invalid: {value}")
    return normalized


def _date_string(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _find_duplicate_master(
    db: Session,
    *,
    standard_name: str,
    credit_code: str | None,
    exclude_id: uuid.UUID | None = None,
) -> tuple[str, ManufacturerVendorMaster] | None:
    filters = [ManufacturerVendorMaster.standard_name == standard_name]
    if credit_code:
        filters.append(ManufacturerVendorMaster.unified_social_credit_code == credit_code)
    stmt = select(ManufacturerVendorMaster).where(or_(*filters))
    if exclude_id is not None:
        stmt = stmt.where(ManufacturerVendorMaster.id != exclude_id)
    rows = db.scalars(stmt).all()
    for row in rows:
        if row.standard_name == standard_name:
            return "DUPLICATE_STANDARD_NAME", row
        if credit_code and row.unified_social_credit_code == credit_code:
            return "DUPLICATE_CREDIT_CODE", row
    return None


def create_vendor_master(db: Session, payload: dict[str, Any], operator_name: str = "system") -> ManufacturerVendorMaster:
    standard_name = normalize_vendor_name(payload.get("standard_name"))
    if not standard_name:
        raise ValueError("厂商标准名称不能为空")
    credit_code = normalize_credit_code(payload.get("unified_social_credit_code"))
    duplicate = _find_duplicate_master(db, standard_name=standard_name, credit_code=credit_code)
    if duplicate:
        code, row = duplicate
        raise ValueError(f"{code}:{row.id}")

    organization_code = normalize_vendor_name(payload.get("organization_code")) or generate_org_code(db)
    row = ManufacturerVendorMaster(
        organization_code=organization_code,
        standard_name=standard_name,
        english_name=normalize_vendor_name(payload.get("english_name")) or None,
        short_name=normalize_vendor_name(payload.get("short_name")) or None,
        former_name=normalize_vendor_name(payload.get("former_name")) or None,
        alias_names=_string_list(payload.get("alias_names")),
        unified_social_credit_code=credit_code,
        organization_type=normalize_vendor_name(payload.get("organization_type")) or None,
        country_region=normalize_vendor_name(payload.get("country_region")) or None,
        province=normalize_vendor_name(payload.get("province")) or None,
        city=normalize_vendor_name(payload.get("city")) or None,
        address=normalize_vendor_name(payload.get("address")) or None,
        registered_address=normalize_vendor_name(payload.get("registered_address")) or None,
        office_address=normalize_vendor_name(payload.get("office_address")) or None,
        contact_phone=normalize_vendor_name(payload.get("contact_phone")) or None,
        website=normalize_vendor_name(payload.get("website")) or None,
        legal_representative=normalize_vendor_name(payload.get("legal_representative")) or None,
        status=_ensure_enum(payload.get("status") or "enabled", MASTER_STATUSES, "status"),
        data_source=normalize_vendor_name(payload.get("data_source")) or "人工维护",
        source_system=normalize_vendor_name(payload.get("source_system")) or normalize_vendor_name(payload.get("data_source")) or "H-MDM",
        quality_status=_ensure_enum(payload.get("quality_status") or "normal", QUALITY_STATUSES, "quality_status"),
        audit_status=_ensure_enum(payload.get("audit_status") or "not_submitted", AUDIT_STATUSES, "audit_status"),
        remark=payload.get("remark") or None,
        created_by=operator_name,
        updated_by=operator_name,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        raise ValueError("DUPLICATE_VENDOR") from exc
    return row


def update_vendor_master(db: Session, row: ManufacturerVendorMaster, payload: dict[str, Any], operator_name: str) -> ManufacturerVendorMaster:
    standard_name = normalize_vendor_name(payload.get("standard_name", row.standard_name))
    if not standard_name:
        raise ValueError("厂商标准名称不能为空")
    credit_code = normalize_credit_code(payload.get("unified_social_credit_code", row.unified_social_credit_code))
    duplicate = _find_duplicate_master(db, standard_name=standard_name, credit_code=credit_code, exclude_id=row.id)
    if duplicate:
        code, existing = duplicate
        raise ValueError(f"{code}:{existing.id}")

    field_map = {
        "organization_code": lambda v: normalize_vendor_name(v) or row.organization_code,
        "standard_name": lambda _v: standard_name,
        "english_name": lambda v: normalize_vendor_name(v) or None,
        "short_name": lambda v: normalize_vendor_name(v) or None,
        "former_name": lambda v: normalize_vendor_name(v) or None,
        "alias_names": _string_list,
        "unified_social_credit_code": lambda _v: credit_code,
        "organization_type": lambda v: normalize_vendor_name(v) or None,
        "country_region": lambda v: normalize_vendor_name(v) or None,
        "province": lambda v: normalize_vendor_name(v) or None,
        "city": lambda v: normalize_vendor_name(v) or None,
        "address": lambda v: normalize_vendor_name(v) or None,
        "registered_address": lambda v: normalize_vendor_name(v) or None,
        "office_address": lambda v: normalize_vendor_name(v) or None,
        "contact_phone": lambda v: normalize_vendor_name(v) or None,
        "website": lambda v: normalize_vendor_name(v) or None,
        "legal_representative": lambda v: normalize_vendor_name(v) or None,
        "status": lambda v: _ensure_enum(v, MASTER_STATUSES, "status"),
        "data_source": lambda v: normalize_vendor_name(v) or None,
        "source_system": lambda v: normalize_vendor_name(v) or None,
        "quality_status": lambda v: _ensure_enum(v, QUALITY_STATUSES, "quality_status"),
        "audit_status": lambda v: _ensure_enum(v, AUDIT_STATUSES, "audit_status"),
        "remark": lambda v: v or None,
    }
    for key, normalizer in field_map.items():
        if key in payload:
            setattr(row, key, normalizer(payload[key]))
    row.updated_by = operator_name
    db.flush()
    return row


def search_vendors(
    db: Session,
    *,
    keyword: str | None = None,
    role_type: str | None = None,
    business_domain: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ManufacturerVendorMaster], int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    normalized_role_type = normalize_role_type(role_type) if role_type else None
    stmt = select(ManufacturerVendorMaster).distinct()
    count_stmt = select(func.count(func.distinct(ManufacturerVendorMaster.id))).select_from(ManufacturerVendorMaster)
    if normalized_role_type or business_domain:
        stmt = stmt.join(ManufacturerVendorRole, ManufacturerVendorRole.org_id == ManufacturerVendorMaster.id)
        count_stmt = count_stmt.join(ManufacturerVendorRole, ManufacturerVendorRole.org_id == ManufacturerVendorMaster.id)
    filters = []
    if keyword:
        q = normalize_vendor_name(keyword)
        like = f"%{q}%"
        filters.append(
            or_(
                ManufacturerVendorMaster.standard_name.ilike(like),
                ManufacturerVendorMaster.english_name.ilike(like),
                ManufacturerVendorMaster.short_name.ilike(like),
                ManufacturerVendorMaster.former_name.ilike(like),
                ManufacturerVendorMaster.unified_social_credit_code.ilike(like),
                ManufacturerVendorMaster.alias_names.cast(Text).ilike(like),
                ManufacturerVendorExternalMapping.external_name.ilike(like),
            )
        )
        stmt = stmt.outerjoin(
            ManufacturerVendorExternalMapping,
            ManufacturerVendorExternalMapping.org_id == ManufacturerVendorMaster.id,
        )
        count_stmt = count_stmt.outerjoin(
            ManufacturerVendorExternalMapping,
            ManufacturerVendorExternalMapping.org_id == ManufacturerVendorMaster.id,
        )
    if normalized_role_type:
        filters.append(ManufacturerVendorRole.role_type == normalized_role_type)
    if business_domain:
        filters.append(ManufacturerVendorRole.business_domain == business_domain)
    if status:
        filters.append(ManufacturerVendorMaster.status == status)
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(ManufacturerVendorMaster.updated_at.desc(), ManufacturerVendorMaster.standard_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return rows, total


def list_vendor_roles(db: Session, org_id: uuid.UUID) -> list[ManufacturerVendorRole]:
    return db.scalars(
        select(ManufacturerVendorRole)
        .where(ManufacturerVendorRole.org_id == org_id)
        .order_by(ManufacturerVendorRole.business_domain, ManufacturerVendorRole.role_type)
    ).all()


def list_vendor_mappings(db: Session, org_id: uuid.UUID) -> list[ManufacturerVendorExternalMapping]:
    return db.scalars(
        select(ManufacturerVendorExternalMapping)
        .where(ManufacturerVendorExternalMapping.org_id == org_id)
        .order_by(ManufacturerVendorExternalMapping.system_name, ManufacturerVendorExternalMapping.external_code)
    ).all()


def list_mdm_external_mappings(db: Session, org_id: uuid.UUID) -> list[MdmExternalMapping]:
    return db.scalars(
        select(MdmExternalMapping)
        .where(MdmExternalMapping.master_type == "business_partner", MdmExternalMapping.master_id == org_id)
        .order_by(MdmExternalMapping.source_system, MdmExternalMapping.external_code)
    ).all()


def list_organization_qualifications(db: Session, org_id: uuid.UUID) -> list[OrganizationQualification]:
    return db.scalars(
        select(OrganizationQualification)
        .where(OrganizationQualification.org_id == org_id)
        .order_by(OrganizationQualification.qualification_type, OrganizationQualification.valid_to)
    ).all()


def list_organization_contacts(db: Session, org_id: uuid.UUID) -> list[OrganizationContact]:
    return db.scalars(
        select(OrganizationContact)
        .where(OrganizationContact.org_id == org_id)
        .order_by(OrganizationContact.is_primary.desc(), OrganizationContact.contact_type, OrganizationContact.contact_name)
    ).all()


def list_vendor_relations(db: Session, org_id: uuid.UUID) -> list[ManufacturerVendorRelation]:
    return db.scalars(
        select(ManufacturerVendorRelation)
        .where(or_(ManufacturerVendorRelation.parent_org_id == org_id, ManufacturerVendorRelation.child_org_id == org_id))
        .order_by(ManufacturerVendorRelation.relation_type, ManufacturerVendorRelation.created_at.desc())
    ).all()


def add_vendor_role(db: Session, org_id: uuid.UUID, payload: dict[str, Any]) -> ManufacturerVendorRole:
    role_type = normalize_role_type(payload.get("role_type"))
    business_domain = _ensure_enum(payload.get("business_domain") or "other", BUSINESS_DOMAINS, "business_domain")
    row = ManufacturerVendorRole(
        org_id=org_id,
        role_type=role_type,
        role_name=normalize_vendor_name(payload.get("role_name")) or ROLE_LABELS[role_type],
        business_domain=business_domain,
        status=_ensure_enum(payload.get("status") or "enabled", frozenset({"enabled", "disabled"}), "status"),
        effective_date=payload.get("effective_date"),
        expired_date=payload.get("expired_date"),
        qualification_required=bool(payload.get("qualification_required", False)),
        remark=payload.get("remark") or None,
    )
    db.add(row)
    db.flush()
    return row


def add_vendor_relation(db: Session, payload: dict[str, Any]) -> ManufacturerVendorRelation:
    relation_type = _ensure_enum(payload.get("relation_type") or "", RELATION_TYPES, "relation_type")
    parent_org_id = uuid.UUID(str(payload["parent_org_id"]))
    child_org_id = uuid.UUID(str(payload["child_org_id"]))
    if parent_org_id == child_org_id:
        raise ValueError("厂商关系不能指向自身")
    row = ManufacturerVendorRelation(
        parent_org_id=parent_org_id,
        child_org_id=child_org_id,
        relation_type=relation_type,
        relation_name=normalize_vendor_name(payload.get("relation_name")) or RELATION_LABELS[relation_type],
        effective_date=payload.get("effective_date"),
        expired_date=payload.get("expired_date"),
        evidence_file_url=payload.get("evidence_file_url") or None,
        status=_ensure_enum(payload.get("status") or "enabled", frozenset({"enabled", "disabled"}), "status"),
        remark=payload.get("remark") or None,
    )
    db.add(row)
    db.flush()
    return row


def add_vendor_external_mapping(
    db: Session,
    org_id: uuid.UUID,
    payload: dict[str, Any],
) -> ManufacturerVendorExternalMapping:
    system_name = normalize_vendor_name(payload.get("system_name")).upper()
    if system_name not in SYSTEM_NAMES:
        raise ValueError(f"system_name is invalid: {system_name}")
    confidence = payload.get("confidence")
    row = ManufacturerVendorExternalMapping(
        org_id=org_id,
        system_name=system_name,
        external_code=normalize_vendor_name(payload.get("external_code")) or None,
        external_name=normalize_vendor_name(payload.get("external_name")) or None,
        is_current=bool(payload.get("is_current", True)),
        confidence=Decimal(str(confidence)) if confidence is not None else None,
        audit_status=_ensure_enum(payload.get("audit_status") or "approved", AUDIT_STATUSES, "audit_status"),
        remark=payload.get("remark") or None,
    )
    db.add(row)
    add_mdm_external_mapping(
        db,
        org_id,
        {
            "source_system": system_name,
            "external_code": row.external_code,
            "external_name": row.external_name,
            "mapping_confidence": confidence,
            "status": "enabled" if row.is_current else "disabled",
            "remark": row.remark,
        },
    )
    db.flush()
    return row


def add_mdm_external_mapping(
    db: Session,
    org_id: uuid.UUID,
    payload: dict[str, Any],
) -> MdmExternalMapping:
    source_system = normalize_vendor_name(payload.get("source_system") or payload.get("system_name")).upper()
    confidence = payload.get("mapping_confidence", payload.get("confidence"))
    row = MdmExternalMapping(
        master_type=normalize_vendor_name(payload.get("master_type")) or "business_partner",
        master_id=org_id,
        source_system=source_system or "OTHER",
        external_code=normalize_vendor_name(payload.get("external_code")) or None,
        external_name=normalize_vendor_name(payload.get("external_name")) or None,
        mapping_confidence=Decimal(str(confidence)) if confidence is not None else None,
        status=_ensure_enum(payload.get("status") or "enabled", frozenset({"enabled", "disabled"}), "status"),
        remark=payload.get("remark") or None,
    )
    db.add(row)
    db.flush()
    return row


def add_organization_qualification(
    db: Session,
    org_id: uuid.UUID,
    payload: dict[str, Any],
) -> OrganizationQualification:
    row = OrganizationQualification(
        org_id=org_id,
        qualification_type=normalize_vendor_name(payload.get("qualification_type")),
        certificate_no=normalize_vendor_name(payload.get("certificate_no")) or None,
        certificate_name=normalize_vendor_name(payload.get("certificate_name")) or None,
        issuing_authority=normalize_vendor_name(payload.get("issuing_authority")) or None,
        valid_from=payload.get("valid_from"),
        valid_to=payload.get("valid_to"),
        file_id=normalize_vendor_name(payload.get("file_id")) or None,
        status=_ensure_enum(payload.get("status") or "enabled", QUALIFICATION_STATUSES, "status"),
        remark=payload.get("remark") or None,
    )
    if not row.qualification_type:
        raise ValueError("资质类型不能为空")
    db.add(row)
    db.flush()
    return row


def add_organization_contact(
    db: Session,
    org_id: uuid.UUID,
    payload: dict[str, Any],
) -> OrganizationContact:
    contact_name = normalize_vendor_name(payload.get("contact_name"))
    if not contact_name:
        raise ValueError("联系人姓名不能为空")
    row = OrganizationContact(
        org_id=org_id,
        contact_name=contact_name,
        department=normalize_vendor_name(payload.get("department")) or None,
        position=normalize_vendor_name(payload.get("position")) or None,
        phone=normalize_vendor_name(payload.get("phone")) or None,
        mobile=normalize_vendor_name(payload.get("mobile")) or None,
        email=normalize_vendor_name(payload.get("email")) or None,
        contact_type=normalize_vendor_name(payload.get("contact_type")) or None,
        is_primary=bool(payload.get("is_primary", False)),
        status=_ensure_enum(payload.get("status") or "enabled", CONTACT_STATUSES, "status"),
        remark=payload.get("remark") or None,
    )
    db.add(row)
    db.flush()
    return row


def match_vendor_candidate(db: Session, normalized_name: str, credit_code: str | None = None) -> tuple[ManufacturerVendorMaster | None, Decimal | None, str, str]:
    if credit_code:
        row = db.scalar(
            select(ManufacturerVendorMaster).where(ManufacturerVendorMaster.unified_social_credit_code == credit_code)
        )
        if row:
            return row, Decimal("1.0000"), "matched", "map_existing"

    rows = db.scalars(select(ManufacturerVendorMaster)).all()
    best: tuple[ManufacturerVendorMaster | None, Decimal | None] = (None, None)
    for row in rows:
        names = [row.standard_name, row.english_name, row.short_name, *(row.alias_names or [])]
        for name in names:
            candidate = normalize_vendor_name(name)
            if not candidate:
                continue
            if candidate == normalized_name:
                return row, Decimal("1.0000"), "matched", "map_existing"
            ratio = Decimal(str(round(SequenceMatcher(None, candidate, normalized_name).ratio(), 4)))
            if best[1] is None or ratio > best[1]:
                best = (row, ratio)
    if best[0] is not None and best[1] is not None and best[1] >= Decimal("0.9200"):
        return best[0], best[1], "need_review", "map_existing"
    for row in rows:
        if _same_or_similar(normalized_name, row.standard_name):
            return row, Decimal("0.9200"), "need_review", "map_existing"
    return None, None, "unmatched", "create_new"


def match_business_partner(
    db: Session,
    *,
    keyword: str | None = None,
    role_type: str | None = None,
    page_size: int = 8,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    rows, _total = search_vendors(
        db,
        keyword=keyword,
        role_type=role_type,
        status="enabled",
        page=1,
        page_size=page_size,
    )
    normalized_keyword = normalize_vendor_name(keyword)
    candidates: list[dict[str, Any]] = []
    for row in rows:
        names = [row.standard_name, row.short_name, row.english_name, row.former_name, *(row.alias_names or [])]
        best_ratio = Decimal("0.7000")
        basis = "关键词模糊匹配"
        for name in names:
            candidate = normalize_vendor_name(name)
            if not candidate:
                continue
            if normalized_keyword and candidate == normalized_keyword:
                best_ratio = Decimal("1.0000")
                basis = f"单位名称“{keyword}”精确匹配"
                break
            if normalized_keyword and (normalized_keyword in candidate or candidate in normalized_keyword):
                best_ratio = max(best_ratio, Decimal("0.9200"))
                basis = f"单位名称“{keyword}”别名/简称匹配"
                continue
            if normalized_keyword:
                ratio = Decimal(str(round(SequenceMatcher(None, candidate, normalized_keyword).ratio(), 4)))
                if ratio > best_ratio:
                    best_ratio = ratio
                    basis = f"单位名称“{keyword}”相似度匹配"
        roles = list_vendor_roles(db, row.id)
        role_code = normalize_role_type(role_type) if role_type else None
        has_required_role = role_code is None or any(role.role_type == role_code and role.status == "enabled" for role in roles)
        qualifications = list_organization_qualifications(db, row.id)
        qualification_status = "valid"
        if any(q.status in {"expired", "disabled"} for q in qualifications):
            qualification_status = "attention"
        payload = vendor_payload(
            row,
            roles=roles,
            qualifications=qualifications,
            external_mappings=list_vendor_mappings(db, row.id),
        )
        payload.update(
            {
                "confidence": int(min(100, max(70, round(float(best_ratio) * 100)))),
                "matchBasis": [basis, "H-MDM 往来单位主数据归一"],
                "matchedRole": role_code,
                "hasRequiredRole": has_required_role,
                "qualificationStatus": qualification_status,
                "source": "h-mdm",
                "degraded": False,
            }
        )
        candidates.append(payload)
    candidates.sort(key=lambda item: (item.get("hasRequiredRole") is True, item.get("confidence") or 0), reverse=True)
    return candidates, candidates[0] if candidates else None


def upsert_vendor_candidate(
    db: Session,
    *,
    source_system: str,
    source_table: str | None,
    source_record_id: str | None,
    raw_name: str,
) -> ManufacturerVendorCandidate | None:
    normalized_name = normalize_vendor_name(raw_name)
    if not normalized_name:
        return None
    existing = db.scalar(
        select(ManufacturerVendorCandidate).where(
            ManufacturerVendorCandidate.source_system == source_system,
            ManufacturerVendorCandidate.source_table == source_table,
            ManufacturerVendorCandidate.source_record_id == source_record_id,
            ManufacturerVendorCandidate.normalized_name == normalized_name,
        )
    )
    matched_org, confidence, match_status, suggested_action = match_vendor_candidate(db, normalized_name)
    if existing:
        existing.matched_org_id = matched_org.id if matched_org else None
        existing.match_confidence = confidence
        if existing.match_status not in {"matched", "ignored"}:
            existing.match_status = match_status
            existing.suggested_action = suggested_action
        return existing
    row = ManufacturerVendorCandidate(
        source_system=source_system,
        source_table=source_table,
        source_record_id=source_record_id,
        raw_name=raw_name,
        normalized_name=normalized_name,
        matched_org_id=matched_org.id if matched_org else None,
        match_confidence=confidence,
        match_status=match_status,
        suggested_action=suggested_action,
    )
    db.add(row)
    db.flush()
    return row


def list_candidates(
    db: Session,
    *,
    match_status: str | None = None,
    source_system: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ManufacturerVendorCandidate], int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(ManufacturerVendorCandidate)
    count_stmt = select(func.count()).select_from(ManufacturerVendorCandidate)
    if match_status:
        stmt = stmt.where(ManufacturerVendorCandidate.match_status == match_status)
        count_stmt = count_stmt.where(ManufacturerVendorCandidate.match_status == match_status)
    if source_system:
        stmt = stmt.where(ManufacturerVendorCandidate.source_system == source_system)
        count_stmt = count_stmt.where(ManufacturerVendorCandidate.source_system == source_system)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(ManufacturerVendorCandidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return rows, total


def map_candidate_to_vendor(
    db: Session,
    candidate: ManufacturerVendorCandidate,
    org_id: uuid.UUID,
    reviewer: str,
) -> ManufacturerVendorCandidate:
    if db.get(ManufacturerVendorMaster, org_id) is None:
        raise ValueError("厂商机构不存在")
    candidate.matched_org_id = org_id
    candidate.match_confidence = Decimal("1.0000")
    candidate.match_status = "matched"
    candidate.suggested_action = "map_existing"
    candidate.reviewed_by = reviewer
    candidate.reviewed_at = datetime.now(timezone.utc)
    db.flush()
    return candidate


def merge_candidate_into_vendor(
    db: Session,
    candidate: ManufacturerVendorCandidate,
    org_id: uuid.UUID,
    reviewer: str,
) -> ManufacturerVendorCandidate:
    vendor = db.get(ManufacturerVendorMaster, org_id)
    if vendor is None:
        raise ValueError("厂商机构不存在")

    candidate_names = _string_list([candidate.raw_name, candidate.normalized_name])
    alias_names = _string_list([*(vendor.alias_names or []), *candidate_names])
    if alias_names != (vendor.alias_names or []):
        vendor.alias_names = alias_names
        vendor.updated_by = reviewer

    exists_mapping = db.scalar(
        select(ManufacturerVendorExternalMapping.id).where(
            ManufacturerVendorExternalMapping.system_name == (
                candidate.source_system if candidate.source_system in SYSTEM_NAMES else "OTHER"
            ),
            ManufacturerVendorExternalMapping.external_code == candidate.source_record_id,
        )
    )
    if exists_mapping is None:
        add_vendor_external_mapping(
            db,
            org_id,
            {
                "system_name": candidate.source_system if candidate.source_system in SYSTEM_NAMES else "OTHER",
                "external_code": candidate.source_record_id,
                "external_name": candidate.raw_name,
                "confidence": 1,
                "audit_status": "approved",
                "remark": "candidate_merge",
            },
        )

    candidate.suggested_action = "merge"
    map_candidate_to_vendor(db, candidate, org_id, reviewer)
    candidate.suggested_action = "merge"
    db.flush()
    return candidate


def create_vendor_from_candidate(
    db: Session,
    candidate: ManufacturerVendorCandidate,
    payload: dict[str, Any],
    reviewer: str,
) -> ManufacturerVendorMaster:
    create_payload = {"standard_name": candidate.normalized_name, "alias_names": [candidate.raw_name], "data_source": candidate.source_system}
    create_payload.update(payload)
    row = create_vendor_master(db, create_payload, reviewer)
    add_vendor_external_mapping(
        db,
        row.id,
        {
            "system_name": candidate.source_system if candidate.source_system in SYSTEM_NAMES else "OTHER",
            "external_code": candidate.source_record_id,
            "external_name": candidate.raw_name,
            "confidence": 1,
            "audit_status": "approved",
        },
    )
    map_candidate_to_vendor(db, candidate, row.id, reviewer)
    return row


def ignore_candidate(db: Session, candidate: ManufacturerVendorCandidate, reviewer: str) -> ManufacturerVendorCandidate:
    candidate.match_status = "ignored"
    candidate.suggested_action = "ignore"
    candidate.reviewed_by = reviewer
    candidate.reviewed_at = datetime.now(timezone.utc)
    db.flush()
    return candidate
