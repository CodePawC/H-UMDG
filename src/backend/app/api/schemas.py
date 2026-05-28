from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ApiEnvelope(BaseModel):
    success: bool = True
    code: str = "OK"
    message: str = "OK"
    data: Any = None
    trace_id: str | None = None


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int


class PagedResult(BaseModel):
    items: list[dict[str, Any]]
    page: PageMeta


class TranscodeResolveResult(BaseModel):
    status: str
    original_yb_code_27: str
    items: list[dict[str, Any]]
    page: PageMeta


class MappingResolveRequest(BaseModel):
    category: str = Field(..., examples=["MATERIAL"])
    source_system: str = Field(..., examples=["SPD"])
    source_key: str = Field(..., examples=["SPD-MAT-001"])
    source_desc: str | None = None
    source_tx_id: str | None = None


class MappingApproveRequest(BaseModel):
    target_master_id: UUID
    target_code: str | None = None
    mapping_rule: str = "MANUAL"
    confidence: float | None = None
    reviewer: str
    review_comment: str | None = None


class MappingRejectRequest(BaseModel):
    reviewer: str
    review_comment: str


class DepartmentStatusUpdate(BaseModel):
    status: str = Field(..., examples=["ACTIVE"])


class CampusRequest(BaseModel):
    campus_code: str
    campus_name: str
    campus_short_name: str | None = None
    organization_id: str | None = None
    address: str | None = None
    status: str = "ACTIVE"
    sort_order: int = 0
    remark: str | None = None


class CampusStatusUpdate(BaseModel):
    status: str = Field(..., examples=["ACTIVE"])


class PersonRequest(BaseModel):
    person_code: str
    employee_no: str | None = None
    person_name: str
    gender: str | None = None
    department_id: UUID | None = None
    campus_id: UUID | None = None
    position: str | None = None
    job_title: str | None = None
    professional_title: str | None = None
    person_type: str | None = None
    phone: str | None = None
    email: str | None = None
    status: str = "ACTIVE"
    login_account: str | None = None
    external_user_id: str | None = None
    sort_order: int = 0
    remark: str | None = None


class PersonStatusUpdate(BaseModel):
    status: str = Field(..., examples=["ACTIVE"])


class DisciplineRequest(BaseModel):
    discipline_code: str
    discipline_name: str
    discipline_short_name: str | None = None
    discipline_type: str | None = None
    parent_discipline_id: UUID | None = None
    level: int | None = None
    is_key_discipline: bool = False
    status: str = "ACTIVE"
    sort_order: int = 0
    remark: str | None = None


class DisciplineStatusUpdate(BaseModel):
    status: str = Field(..., examples=["ACTIVE"])


class DepartmentDisciplineMappingRequest(BaseModel):
    department_id: UUID
    discipline_id: UUID
    relation_type: str
    is_primary: bool = False
    weight: float | None = None
    effective_date: date | None = None
    expired_date: date | None = None
    status: str = "ACTIVE"
    remark: str | None = None


class VendorMasterRequest(BaseModel):
    organization_code: str | None = None
    standard_name: str
    english_name: str | None = None
    short_name: str | None = None
    former_name: str | None = None
    alias_names: list[str] | str | None = None
    unified_social_credit_code: str | None = None
    organization_type: str | None = None
    country_region: str | None = None
    province: str | None = None
    city: str | None = None
    address: str | None = None
    registered_address: str | None = None
    office_address: str | None = None
    contact_phone: str | None = None
    website: str | None = None
    legal_representative: str | None = None
    status: str = "enabled"
    data_source: str | None = "人工维护"
    source_system: str | None = "H-MDM"
    quality_status: str = "normal"
    audit_status: str = "not_submitted"
    remark: str | None = None


class VendorStatusUpdate(BaseModel):
    status: str = Field(..., examples=["enabled"])


class VendorAuditUpdate(BaseModel):
    audit_status: str = Field(..., examples=["pending"])
    remark: str | None = None


class VendorRoleRequest(BaseModel):
    role_type: str
    role_name: str | None = None
    business_domain: str = "other"
    status: str = "enabled"
    effective_date: date | None = None
    expired_date: date | None = None
    qualification_required: bool = False
    remark: str | None = None


class VendorRelationRequest(BaseModel):
    parent_org_id: UUID
    child_org_id: UUID
    relation_type: str
    relation_name: str | None = None
    effective_date: date | None = None
    expired_date: date | None = None
    evidence_file_url: str | None = None
    status: str = "enabled"
    remark: str | None = None


class VendorExternalMappingRequest(BaseModel):
    system_name: str
    external_code: str | None = None
    external_name: str | None = None
    is_current: bool = True
    confidence: float | None = None
    audit_status: str = "approved"
    remark: str | None = None


class OrganizationQualificationRequest(BaseModel):
    qualification_type: str
    certificate_no: str | None = None
    certificate_name: str | None = None
    issuing_authority: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    file_id: str | None = None
    status: str = "enabled"
    remark: str | None = None


class OrganizationContactRequest(BaseModel):
    contact_name: str
    department: str | None = None
    position: str | None = None
    phone: str | None = None
    mobile: str | None = None
    email: str | None = None
    contact_type: str | None = None
    is_primary: bool = False
    status: str = "enabled"
    remark: str | None = None


class MdmExternalMappingRequest(BaseModel):
    master_type: str = "business_partner"
    source_system: str
    external_code: str | None = None
    external_name: str | None = None
    mapping_confidence: float | None = None
    status: str = "enabled"
    remark: str | None = None


class BusinessPartnerMatchRequest(BaseModel):
    keyword: str | None = None
    role_type: str | None = None
    page_size: int = 8


class VendorCandidateMapRequest(BaseModel):
    org_id: UUID
    reviewer: str = "data_admin"


class VendorCandidateMergeRequest(BaseModel):
    org_id: UUID
    reviewer: str = "data_admin"


class VendorCandidateCreateRequest(BaseModel):
    reviewer: str = "data_admin"
    vendor: VendorMasterRequest | None = None
    roles: list[VendorRoleRequest] = []


class VendorCandidateIgnoreRequest(BaseModel):
    reviewer: str = "data_admin"


class VendorCandidateBatchAction(BaseModel):
    candidate_id: UUID
    action: str = Field(..., examples=["map_existing"])
    org_id: UUID | None = None
    reviewer: str = "data_admin"


class VendorCandidateBatchRequest(BaseModel):
    actions: list[VendorCandidateBatchAction]


class ImportReport(BaseModel):
    batch_id: str
    source_type: str | None = None
    source_file_name: str | None = None
    sheet_name: str | None = None
    source_row_count: int = 0
    unique_key_count: int = 0
    skipped_duplicate_count: int = 0
    success_count: int
    failed_count: int
    duplicate_count: int = 0
    disabled_count: int = 0
    transcoded_count: int = 0
    changed_count: int = 0
    mapped_count: int = 0
    retained_count: int = 0
    vendor_candidate_count: int = 0
    failures: list[dict[str, Any]] = []


class ExchangeLogItem(BaseModel):
    log_id: int
    trace_id: str
    source_system: str
    source_tx_id: str
    data_category: str
    status: str
    error_code: str | None = None
    processing_time_ms: int | None = None
    created_at: datetime
