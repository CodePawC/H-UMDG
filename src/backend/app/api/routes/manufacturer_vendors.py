from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.deps import ApiKeyAuth, DbSession, VendorManageAuth
from app.api.schemas import (
    ApiEnvelope,
    BusinessPartnerMatchRequest,
    MdmExternalMappingRequest,
    OrganizationContactRequest,
    OrganizationQualificationRequest,
    PageMeta,
    PagedResult,
    VendorAuditUpdate,
    VendorCandidateBatchRequest,
    VendorCandidateCreateRequest,
    VendorCandidateIgnoreRequest,
    VendorCandidateMapRequest,
    VendorCandidateMergeRequest,
    VendorExternalMappingRequest,
    VendorMasterRequest,
    VendorRelationRequest,
    VendorRoleRequest,
    VendorStatusUpdate,
)
from app.models.tables import ManufacturerVendorCandidate, ManufacturerVendorMaster
from app.services.manufacturer_vendors import (
    add_mdm_external_mapping,
    add_organization_contact,
    add_organization_qualification,
    add_vendor_external_mapping,
    add_vendor_relation,
    add_vendor_role,
    candidate_payload,
    create_vendor_from_candidate,
    create_vendor_master,
    ignore_candidate,
    list_candidates,
    list_mdm_external_mappings,
    list_organization_contacts,
    list_organization_qualifications,
    list_vendor_mappings,
    list_vendor_relations,
    list_vendor_roles,
    map_candidate_to_vendor,
    match_business_partner,
    merge_candidate_into_vendor,
    mapping_payload,
    contact_payload,
    external_mapping_payload,
    qualification_payload,
    relation_payload,
    role_payload,
    search_vendors,
    update_vendor_master,
    vendor_payload,
)

router = APIRouter()
external_router = APIRouter(prefix="/api/external")


def _partner_payload(db: DbSession, row: ManufacturerVendorMaster) -> dict:
    return vendor_payload(
        row,
        roles=list_vendor_roles(db, row.id),
        mappings=list_vendor_mappings(db, row.id),
        external_mappings=list_mdm_external_mappings(db, row.id),
        relations=list_vendor_relations(db, row.id),
        qualifications=list_organization_qualifications(db, row.id),
        contacts=list_organization_contacts(db, row.id),
    )


def _validation_error(exc: ValueError) -> HTTPException:
    message = str(exc)
    code = "VALIDATION_FAILED"
    if message.startswith("DUPLICATE_STANDARD_NAME"):
        code = "DUPLICATE_STANDARD_NAME"
        message = "厂商标准名称已存在"
    elif message.startswith("DUPLICATE_CREDIT_CODE"):
        code = "DUPLICATE_CREDIT_CODE"
        message = "统一社会信用代码已存在"
    elif message.startswith("DUPLICATE_VENDOR"):
        code = "DUPLICATE_VENDOR"
        message = "厂商机构已存在"
    return HTTPException(status_code=400 if code == "VALIDATION_FAILED" else 409, detail={"code": code, "message": message})


def _vendor_or_404(db: DbSession, org_id: UUID) -> ManufacturerVendorMaster:
    row = db.get(ManufacturerVendorMaster, org_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "VENDOR_NOT_FOUND", "message": str(org_id)})
    return row


def _candidate_or_404(db: DbSession, candidate_id: UUID) -> ManufacturerVendorCandidate:
    row = db.get(ManufacturerVendorCandidate, candidate_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "VENDOR_CANDIDATE_NOT_FOUND", "message": str(candidate_id)})
    return row


@router.get("/manufacturer-vendors", response_model=ApiEnvelope)
def list_manufacturer_vendors(
    _: VendorManageAuth,
    db: DbSession,
    keyword: str | None = None,
    role_type: str | None = None,
    business_domain: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_vendors(
        db,
        keyword=keyword,
        role_type=role_type,
        business_domain=business_domain,
        status=status,
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[vendor_payload(row, roles=list_vendor_roles(db, row.id)) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@router.post("/manufacturer-vendors", response_model=ApiEnvelope)
def create_manufacturer_vendor(operator: VendorManageAuth, db: DbSession, payload: VendorMasterRequest) -> ApiEnvelope:
    try:
        row = create_vendor_master(db, payload.model_dump(), operator.name)
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=vendor_payload(row, roles=[]))


@router.get("/manufacturer-vendors/{org_id}", response_model=ApiEnvelope)
def get_manufacturer_vendor(_: VendorManageAuth, db: DbSession, org_id: UUID) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    return ApiEnvelope(
        data=vendor_payload(
            row,
            roles=list_vendor_roles(db, row.id),
            mappings=list_vendor_mappings(db, row.id),
            relations=list_vendor_relations(db, row.id),
        )
    )


@router.patch("/manufacturer-vendors/{org_id}", response_model=ApiEnvelope)
def update_manufacturer_vendor(
    operator: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: VendorMasterRequest,
) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    try:
        update_vendor_master(db, row, payload.model_dump(exclude_unset=True), operator.name)
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=vendor_payload(row, roles=list_vendor_roles(db, row.id)))


@router.patch("/manufacturer-vendors/{org_id}/status", response_model=ApiEnvelope)
def update_manufacturer_vendor_status(
    operator: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: VendorStatusUpdate,
) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    try:
        update_vendor_master(db, row, {"status": payload.status}, operator.name)
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=vendor_payload(row, roles=list_vendor_roles(db, row.id)))


@router.post("/manufacturer-vendors/{org_id}/submit", response_model=ApiEnvelope)
def submit_manufacturer_vendor(operator: VendorManageAuth, db: DbSession, org_id: UUID) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    row.audit_status = "pending"
    row.updated_by = operator.name
    db.commit()
    return ApiEnvelope(data=vendor_payload(row, roles=list_vendor_roles(db, row.id)))


@router.post("/manufacturer-vendors/{org_id}/audit", response_model=ApiEnvelope)
def audit_manufacturer_vendor(
    operator: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: VendorAuditUpdate,
) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    try:
        update_vendor_master(db, row, {"audit_status": payload.audit_status, "remark": payload.remark or row.remark}, operator.name)
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=vendor_payload(row, roles=list_vendor_roles(db, row.id)))


@router.post("/manufacturer-vendors/{org_id}/roles", response_model=ApiEnvelope)
def create_manufacturer_vendor_role(
    _: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: VendorRoleRequest,
) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    try:
        row = add_vendor_role(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=role_payload(row))


@router.post("/manufacturer-vendors/{org_id}/external-mappings", response_model=ApiEnvelope)
def create_manufacturer_vendor_mapping(
    _: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: VendorExternalMappingRequest,
) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    try:
        row = add_vendor_external_mapping(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=mapping_payload(row))


@router.post("/manufacturer-vendor-relations", response_model=ApiEnvelope)
def create_manufacturer_vendor_relation(
    _: VendorManageAuth,
    db: DbSession,
    payload: VendorRelationRequest,
) -> ApiEnvelope:
    _vendor_or_404(db, payload.parent_org_id)
    _vendor_or_404(db, payload.child_org_id)
    try:
        row = add_vendor_relation(db, payload.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=relation_payload(row))


@router.get("/manufacturer-vendors/{org_id}/relations", response_model=ApiEnvelope)
def list_manufacturer_vendor_relations(_: VendorManageAuth, db: DbSession, org_id: UUID) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    return ApiEnvelope(data={"items": [relation_payload(row) for row in list_vendor_relations(db, org_id)]})


@router.get("/business-partners", response_model=ApiEnvelope)
def list_business_partners(
    _: VendorManageAuth,
    db: DbSession,
    keyword: str | None = None,
    role_type: str | None = None,
    business_domain: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_vendors(
        db,
        keyword=keyword,
        role_type=role_type,
        business_domain=business_domain,
        status=status,
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[vendor_payload(row, roles=list_vendor_roles(db, row.id), qualifications=list_organization_qualifications(db, row.id), external_mappings=list_mdm_external_mappings(db, row.id)) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@router.post("/business-partners", response_model=ApiEnvelope)
def create_business_partner(operator: VendorManageAuth, db: DbSession, payload: VendorMasterRequest) -> ApiEnvelope:
    try:
        row = create_vendor_master(db, payload.model_dump(), operator.name)
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    db.refresh(row)
    return ApiEnvelope(data=_partner_payload(db, row))


@router.get("/business-partners/{org_id}", response_model=ApiEnvelope)
def get_business_partner(_: VendorManageAuth, db: DbSession, org_id: UUID) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    return ApiEnvelope(data=_partner_payload(db, row))


@router.post("/business-partners/{org_id}/roles", response_model=ApiEnvelope)
def create_business_partner_role(
    _: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: VendorRoleRequest,
) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    try:
        row = add_vendor_role(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=role_payload(row))


@router.post("/business-partners/{org_id}/qualifications", response_model=ApiEnvelope)
def create_business_partner_qualification(
    _: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: OrganizationQualificationRequest,
) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    try:
        row = add_organization_qualification(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=qualification_payload(row))


@router.post("/business-partners/{org_id}/contacts", response_model=ApiEnvelope)
def create_business_partner_contact(
    _: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: OrganizationContactRequest,
) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    try:
        row = add_organization_contact(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=contact_payload(row))


@router.post("/business-partners/{org_id}/external-mappings", response_model=ApiEnvelope)
def create_business_partner_external_mapping(
    _: VendorManageAuth,
    db: DbSession,
    org_id: UUID,
    payload: MdmExternalMappingRequest,
) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    try:
        row = add_mdm_external_mapping(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=external_mapping_payload(row))


@router.post("/business-partners/match", response_model=ApiEnvelope)
def match_business_partner_endpoint(
    _: VendorManageAuth,
    db: DbSession,
    payload: BusinessPartnerMatchRequest,
) -> ApiEnvelope:
    candidates, recommendation = match_business_partner(
        db,
        keyword=payload.keyword,
        role_type=payload.role_type,
        page_size=payload.page_size,
    )
    return ApiEnvelope(
        data={
            "connected": True,
            "source": "h-mdm",
            "degraded": False,
            "recommendation": recommendation,
            "candidates": candidates,
            "message": None if candidates else "未找到匹配的往来单位主数据，请检查关键词或提交主数据补充申请。",
        }
    )


@router.get("/manufacturer-vendor-candidates", response_model=ApiEnvelope)
def list_manufacturer_vendor_candidates(
    _: VendorManageAuth,
    db: DbSession,
    match_status: str | None = None,
    source_system: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = list_candidates(
        db,
        match_status=match_status,
        source_system=source_system,
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[candidate_payload(row) for row in rows],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@router.post("/manufacturer-vendor-candidates/{candidate_id}/map", response_model=ApiEnvelope)
def map_manufacturer_vendor_candidate(
    _: VendorManageAuth,
    db: DbSession,
    candidate_id: UUID,
    payload: VendorCandidateMapRequest,
) -> ApiEnvelope:
    candidate = _candidate_or_404(db, candidate_id)
    try:
        map_candidate_to_vendor(db, candidate, payload.org_id, payload.reviewer)
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=candidate_payload(candidate))


@router.post("/manufacturer-vendor-candidates/{candidate_id}/merge", response_model=ApiEnvelope)
def merge_manufacturer_vendor_candidate(
    _: VendorManageAuth,
    db: DbSession,
    candidate_id: UUID,
    payload: VendorCandidateMergeRequest,
) -> ApiEnvelope:
    candidate = _candidate_or_404(db, candidate_id)
    try:
        merge_candidate_into_vendor(db, candidate, payload.org_id, payload.reviewer)
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data=candidate_payload(candidate))


@router.post("/manufacturer-vendor-candidates/{candidate_id}/create-vendor", response_model=ApiEnvelope)
def create_vendor_from_manufacturer_candidate(
    _: VendorManageAuth,
    db: DbSession,
    candidate_id: UUID,
    payload: VendorCandidateCreateRequest,
) -> ApiEnvelope:
    candidate = _candidate_or_404(db, candidate_id)
    try:
        vendor_data = payload.vendor.model_dump(exclude_unset=True) if payload.vendor else {}
        row = create_vendor_from_candidate(db, candidate, vendor_data, payload.reviewer)
        for role in payload.roles:
            add_vendor_role(db, row.id, role.model_dump())
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data={"vendor": vendor_payload(row, roles=list_vendor_roles(db, row.id)), "candidate": candidate_payload(candidate)})


@router.post("/manufacturer-vendor-candidates/{candidate_id}/ignore", response_model=ApiEnvelope)
def ignore_manufacturer_vendor_candidate(
    _: VendorManageAuth,
    db: DbSession,
    candidate_id: UUID,
    payload: VendorCandidateIgnoreRequest,
) -> ApiEnvelope:
    candidate = _candidate_or_404(db, candidate_id)
    ignore_candidate(db, candidate, payload.reviewer)
    db.commit()
    return ApiEnvelope(data=candidate_payload(candidate))


@router.post("/manufacturer-vendor-candidates/batch", response_model=ApiEnvelope)
def batch_review_manufacturer_vendor_candidates(
    _: VendorManageAuth,
    db: DbSession,
    payload: VendorCandidateBatchRequest,
) -> ApiEnvelope:
    results: list[dict[str, str]] = []
    try:
        for action in payload.actions:
            candidate = _candidate_or_404(db, action.candidate_id)
            if action.action == "map_existing":
                if action.org_id is None:
                    raise ValueError("批量映射需要 org_id")
                map_candidate_to_vendor(db, candidate, action.org_id, action.reviewer)
            elif action.action == "merge":
                if action.org_id is None:
                    raise ValueError("批量合并需要 org_id")
                merge_candidate_into_vendor(db, candidate, action.org_id, action.reviewer)
            elif action.action == "ignore":
                ignore_candidate(db, candidate, action.reviewer)
            else:
                raise ValueError(f"不支持的候选处理动作: {action.action}")
            results.append({"candidate_id": str(action.candidate_id), "action": action.action, "status": "ok"})
    except ValueError as exc:
        raise _validation_error(exc) from exc
    db.commit()
    return ApiEnvelope(data={"items": results})


@external_router.get("/manufacturer-vendors", response_model=ApiEnvelope)
def external_list_manufacturer_vendors(
    _: ApiKeyAuth,
    db: DbSession,
    keyword: str | None = None,
    role_type: str | None = None,
    business_domain: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_vendors(
        db,
        keyword=keyword,
        role_type=role_type,
        business_domain=business_domain,
        status="enabled",
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[
                {
                    "id": str(row.id),
                    "organization_code": row.organization_code,
                    "standard_name": row.standard_name,
                    "english_name": row.english_name,
                    "short_name": row.short_name,
                    "alias_names": row.alias_names or [],
                    "unified_social_credit_code": row.unified_social_credit_code,
                    "roles": [role_payload(role) for role in list_vendor_roles(db, row.id)],
                    "status": row.status,
                }
                for row in rows
            ],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@external_router.get("/manufacturer-vendors/{org_id}", response_model=ApiEnvelope)
def external_get_manufacturer_vendor(_: ApiKeyAuth, db: DbSession, org_id: UUID) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    return ApiEnvelope(
        data=vendor_payload(
            row,
            roles=list_vendor_roles(db, row.id),
            mappings=list_vendor_mappings(db, row.id),
            relations=list_vendor_relations(db, row.id),
        )
    )


@external_router.get("/manufacturer-vendors/{org_id}/relations", response_model=ApiEnvelope)
def external_list_manufacturer_vendor_relations(_: ApiKeyAuth, db: DbSession, org_id: UUID) -> ApiEnvelope:
    _vendor_or_404(db, org_id)
    rows = list_vendor_relations(db, org_id)
    return ApiEnvelope(
        data={
            "parent_company": [relation_payload(row) for row in rows if row.child_org_id == org_id and row.relation_type in {"parent_company", "acquired_by", "merged_into"}],
            "subsidiaries": [relation_payload(row) for row in rows if row.parent_org_id == org_id and row.relation_type in {"subsidiary", "group_member"}],
            "authorized_relations": [relation_payload(row) for row in rows if row.relation_type in {"authorized_agent", "authorized_after_sales", "regional_agent", "import_general_agent", "distribution_relation"}],
            "all": [relation_payload(row) for row in rows],
        }
    )


@external_router.get("/business-partners", response_model=ApiEnvelope)
def external_list_business_partners(
    _: ApiKeyAuth,
    db: DbSession,
    keyword: str | None = None,
    role_type: str | None = None,
    business_domain: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    rows, total = search_vendors(
        db,
        keyword=keyword,
        role_type=role_type,
        business_domain=business_domain,
        status="enabled",
        page=page,
        page_size=page_size,
    )
    return ApiEnvelope(
        data=PagedResult(
            items=[
                vendor_payload(
                    row,
                    roles=list_vendor_roles(db, row.id),
                    qualifications=list_organization_qualifications(db, row.id),
                    external_mappings=list_mdm_external_mappings(db, row.id),
                )
                for row in rows
            ],
            page=PageMeta(page=max(page, 1), page_size=min(max(page_size, 1), 100), total=total),
        )
    )


@external_router.get("/business-partners/{org_id}", response_model=ApiEnvelope)
def external_get_business_partner(_: ApiKeyAuth, db: DbSession, org_id: UUID) -> ApiEnvelope:
    row = _vendor_or_404(db, org_id)
    return ApiEnvelope(data=_partner_payload(db, row))


@external_router.post("/business-partners/match", response_model=ApiEnvelope)
def external_match_business_partner(
    _: ApiKeyAuth,
    db: DbSession,
    payload: BusinessPartnerMatchRequest,
) -> ApiEnvelope:
    candidates, recommendation = match_business_partner(
        db,
        keyword=payload.keyword,
        role_type=payload.role_type,
        page_size=payload.page_size,
    )
    return ApiEnvelope(
        data={
            "connected": True,
            "source": "h-mdm",
            "degraded": False,
            "recommendation": recommendation,
            "candidates": candidates,
            "message": None if candidates else "未找到匹配的往来单位主数据，请检查关键词或提交主数据补充申请。",
        }
    )
