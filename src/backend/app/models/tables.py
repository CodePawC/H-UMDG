import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from datetime import date as date_type

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import sqlalchemy.orm as sa_orm


class Base(DeclarativeBase):
    pass


class ApiClient(Base):
    __tablename__ = "api_client"

    client_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    allowed_scopes: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'active'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_api_client_status", "status"),
        Index("idx_api_client_key_hash", "api_key_hash"),
    )


class ApiCallLog(Base):
    __tablename__ = "api_call_log"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    trace_id: Mapped[str] = mapped_column(String(80), nullable=False)
    client_id: Mapped[str | None] = mapped_column(String(80))
    endpoint: Mapped[str] = mapped_column(String(300), nullable=False)
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    query_params: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    result_count: Mapped[int | None] = mapped_column(Integer)
    client_ip: Mapped[str | None] = mapped_column(String(100))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    called_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text())

    __table_args__ = (
        Index("idx_api_call_log_trace", "trace_id"),
        Index("idx_api_call_log_client", "client_id", "called_at"),
        Index("idx_api_call_log_endpoint", "endpoint", "called_at"),
    )


class DictDepartment(Base):
    __tablename__ = "dict_departments"

    dept_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    dept_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    dept_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dept_alias: Mapped[str | None] = mapped_column(String(500))
    parent_dept_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dict_departments.dept_id"), nullable=True
    )
    campus_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("dict_campuses.campus_id"))
    dept_short_name: Mapped[str | None] = mapped_column(String(100))
    dept_type: Mapped[str | None] = mapped_column(String(50))
    is_clinical: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    is_medtech: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    is_nursing_unit: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    is_logistics: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    ward_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    cost_center_code: Mapped[str | None] = mapped_column(String(100))
    his_department_code: Mapped[str | None] = mapped_column(String(100))
    hris_department_code: Mapped[str | None] = mapped_column(String(100))
    finance_department_code: Mapped[str | None] = mapped_column(String(100))
    oid: Mapped[str | None] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    effective_date: Mapped[date | None] = mapped_column(Date)
    expired_date: Mapped[date | None] = mapped_column(Date)
    remark: Mapped[str | None] = mapped_column(Text())
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    source_batch_id: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[str | None] = mapped_column(String(100))
    updated_by: Mapped[str | None] = mapped_column(String(100))

    __table_args__ = (
        Index("idx_dict_departments_name", "dept_name"),
        Index("idx_dict_departments_status", "status"),
        Index("idx_dict_departments_parent", "parent_dept_id"),
        Index("idx_dict_departments_campus", "campus_id"),
    )


class DictCampus(Base):
    __tablename__ = "dict_campuses"

    campus_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    campus_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    campus_name: Mapped[str] = mapped_column(String(200), nullable=False)
    campus_short_name: Mapped[str | None] = mapped_column(String(100))
    organization_id: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_dict_campuses_name", "campus_name"),
        Index("idx_dict_campuses_status", "status"),
    )


class DictPerson(Base):
    __tablename__ = "dict_persons"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    person_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    employee_no: Mapped[str | None] = mapped_column(String(100))
    person_name: Mapped[str] = mapped_column(String(100), nullable=False)
    gender: Mapped[str | None] = mapped_column(String(20))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("dict_departments.dept_id"))
    campus_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("dict_campuses.campus_id"))
    position: Mapped[str | None] = mapped_column(String(100))
    job_title: Mapped[str | None] = mapped_column(String(100))
    professional_title: Mapped[str | None] = mapped_column(String(100))
    person_type: Mapped[str | None] = mapped_column(String(50))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    login_account: Mapped[str | None] = mapped_column(String(100))
    password_hash: Mapped[str | None] = mapped_column(String(255))  # 统一身份：登录凭据
    employment_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))  # ACTIVE / RESIGNED / RETIRED
    onboard_date: Mapped[date | None] = mapped_column(Date)  # 入职日期
    offboard_date: Mapped[date | None] = mapped_column(Date)  # 离职日期
    external_user_id: Mapped[str | None] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_dict_persons_name", "person_name"),
        Index("idx_dict_persons_employee_no", "employee_no"),
        Index("idx_dict_persons_department", "department_id"),
        Index("idx_dict_persons_campus", "campus_id"),
        Index("idx_dict_persons_status", "status"),
        Index("idx_dict_persons_login_account", "login_account"),
    )


class DictDiscipline(Base):
    __tablename__ = "dict_disciplines"

    discipline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    discipline_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    discipline_name: Mapped[str] = mapped_column(String(200), nullable=False)
    discipline_short_name: Mapped[str | None] = mapped_column(String(100))
    discipline_type: Mapped[str | None] = mapped_column(String(50))
    parent_discipline_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dict_disciplines.discipline_id")
    )
    level: Mapped[int | None] = mapped_column(Integer)
    is_key_discipline: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_dict_disciplines_name", "discipline_name"),
        Index("idx_dict_disciplines_parent", "parent_discipline_id"),
        Index("idx_dict_disciplines_status", "status"),
    )


class DepartmentDisciplineMapping(Base):
    __tablename__ = "department_discipline_mapping"

    mapping_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dict_departments.dept_id"), nullable=False)
    discipline_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dict_disciplines.discipline_id"), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    weight: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    effective_date: Mapped[date | None] = mapped_column(Date)
    expired_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_dept_disc_mapping_department", "department_id"),
        Index("idx_dept_disc_mapping_discipline", "discipline_id"),
        Index("idx_dept_disc_mapping_status", "status"),
    )


class DictMaterialSpec(Base):
    __tablename__ = "dict_material_specs"

    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    manufacturer_org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=True
    )
    registrant_org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=True
    )
    filer_org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=True
    )
    yb_code_27: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    yb_code_20: Mapped[str | None] = mapped_column(String(50))
    goods_id: Mapped[str | None] = mapped_column(String(100))
    udi: Mapped[str | None] = mapped_column(String(200))
    original_yb_code_27: Mapped[str | None] = mapped_column(String(50))
    original_code_status: Mapped[str | None] = mapped_column(String(20))
    code_change_type: Mapped[str | None] = mapped_column(String(20))
    generic_name: Mapped[str] = mapped_column(String(500), nullable=False)
    brand_name: Mapped[str | None] = mapped_column(String(500))
    cat_level_1: Mapped[str | None] = mapped_column(String(200))
    cat_level_2: Mapped[str | None] = mapped_column(String(200))
    cat_level_3: Mapped[str | None] = mapped_column(String(200))
    material_attr: Mapped[str | None] = mapped_column(String(200))
    feature: Mapped[str | None] = mapped_column(String(200))
    spec_value: Mapped[str | None] = mapped_column(Text())
    spec_unit: Mapped[str | None] = mapped_column(String(50))
    model_detail: Mapped[str | None] = mapped_column(Text())
    reg_number: Mapped[str | None] = mapped_column(String(200))
    unit_pkg: Mapped[str | None] = mapped_column(String(20))
    insurance_generic_name_code: Mapped[str | None] = mapped_column(String(100))
    insurance_generic_name: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    source_batch_id: Mapped[str | None] = mapped_column(String(100))
    extra_attrs: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[str | None] = mapped_column(String(100))
    updated_by: Mapped[str | None] = mapped_column(String(100))

    __table_args__ = (
        Index("idx_dict_material_specs_yb_code_20", "yb_code_20"),
        Index("idx_dict_material_specs_generic_name", "generic_name"),
        Index("idx_dict_material_specs_category", "cat_level_1", "cat_level_2", "cat_level_3"),
        Index("idx_dict_material_specs_reg_number", "reg_number"),
        Index("idx_dict_material_specs_status", "status"),
        Index("idx_dict_material_specs_manufacturer_org", "manufacturer_org_id"),
        Index("idx_dict_material_specs_registrant_org", "registrant_org_id"),
        Index("idx_dict_material_specs_filer_org", "filer_org_id"),
    )


class ManufacturerVendorMaster(Base):
    __tablename__ = "manufacturer_vendor_master"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    organization_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    standard_name: Mapped[str] = mapped_column(String(300), nullable=False, unique=True)
    english_name: Mapped[str | None] = mapped_column(String(300))
    short_name: Mapped[str | None] = mapped_column(String(200))
    former_name: Mapped[str | None] = mapped_column(String(300))
    alias_names: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"), nullable=False)
    unified_social_credit_code: Mapped[str | None] = mapped_column(String(18))
    organization_type: Mapped[str | None] = mapped_column(String(50))
    country_region: Mapped[str | None] = mapped_column(String(100))
    province: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(500))
    registered_address: Mapped[str | None] = mapped_column(String(500))
    office_address: Mapped[str | None] = mapped_column(String(500))
    contact_phone: Mapped[str | None] = mapped_column(String(80))
    website: Mapped[str | None] = mapped_column(String(300))
    legal_representative: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'enabled'"))
    data_source: Mapped[str | None] = mapped_column(String(100))
    source_system: Mapped[str | None] = mapped_column(String(100))
    quality_status: Mapped[str] = mapped_column(String(50), nullable=False, server_default=text("'normal'"))
    audit_status: Mapped[str] = mapped_column(String(50), nullable=False, server_default=text("'not_submitted'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[str | None] = mapped_column(String(100))
    updated_by: Mapped[str | None] = mapped_column(String(100))

    __table_args__ = (
        Index(
            "uq_manufacturer_vendor_credit_code",
            "unified_social_credit_code",
            unique=True,
            postgresql_where=text("unified_social_credit_code IS NOT NULL"),
        ),
        Index("idx_manufacturer_vendor_name", "standard_name"),
        Index("idx_manufacturer_vendor_short_name", "short_name"),
        Index("idx_manufacturer_vendor_status", "status"),
        Index("idx_manufacturer_vendor_quality_status", "quality_status"),
        Index("idx_manufacturer_vendor_audit_status", "audit_status"),
    )


class ManufacturerVendorRole(Base):
    __tablename__ = "manufacturer_vendor_role"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=False
    )
    role_type: Mapped[str] = mapped_column(String(50), nullable=False)
    role_name: Mapped[str] = mapped_column(String(100), nullable=False)
    business_domain: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'enabled'"))
    effective_date: Mapped[date | None] = mapped_column(Date())
    expired_date: Mapped[date | None] = mapped_column(Date())
    qualification_required: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default=text("false"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_manufacturer_vendor_role",
            "org_id",
            "role_type",
            "business_domain",
            unique=True,
            postgresql_where=text("status = 'enabled'"),
        ),
        Index("idx_manufacturer_vendor_role_type", "role_type"),
        Index("idx_manufacturer_vendor_role_domain", "business_domain"),
    )


class OrganizationQualification(Base):
    __tablename__ = "mdm_organization_qualification"

    qualification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=False
    )
    qualification_type: Mapped[str] = mapped_column(String(100), nullable=False)
    certificate_no: Mapped[str | None] = mapped_column(String(200))
    certificate_name: Mapped[str | None] = mapped_column(String(300))
    issuing_authority: Mapped[str | None] = mapped_column(String(200))
    valid_from: Mapped[date | None] = mapped_column(Date())
    valid_to: Mapped[date | None] = mapped_column(Date())
    file_id: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'enabled'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_mdm_org_qualification_org", "org_id"),
        Index("idx_mdm_org_qualification_type", "qualification_type"),
        Index("idx_mdm_org_qualification_valid_to", "valid_to"),
        Index("idx_mdm_org_qualification_status", "status"),
    )


class OrganizationContact(Base):
    __tablename__ = "mdm_organization_contact"

    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=False
    )
    contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[str | None] = mapped_column(String(100))
    position: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(80))
    mobile: Mapped[str | None] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(200))
    contact_type: Mapped[str | None] = mapped_column(String(80))
    is_primary: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default=text("false"))
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'enabled'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_mdm_org_contact_org", "org_id"),
        Index("idx_mdm_org_contact_type", "contact_type"),
        Index("idx_mdm_org_contact_status", "status"),
    )


class MdmExternalMapping(Base):
    __tablename__ = "mdm_external_mapping"

    mapping_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    master_type: Mapped[str] = mapped_column(String(80), nullable=False)
    master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    source_system: Mapped[str] = mapped_column(String(80), nullable=False)
    external_code: Mapped[str | None] = mapped_column(String(200))
    external_name: Mapped[str | None] = mapped_column(String(300))
    mapping_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'enabled'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_mdm_external_mapping_current",
            "master_type",
            "source_system",
            "external_code",
            unique=True,
            postgresql_where=text("status = 'enabled' AND external_code IS NOT NULL"),
        ),
        Index("idx_mdm_external_mapping_master", "master_type", "master_id"),
        Index("idx_mdm_external_mapping_name", "external_name"),
    )


class ManufacturerVendorRelation(Base):
    __tablename__ = "manufacturer_vendor_relation"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    parent_org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=False
    )
    child_org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    relation_name: Mapped[str] = mapped_column(String(100), nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date())
    expired_date: Mapped[date | None] = mapped_column(Date())
    evidence_file_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'enabled'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_manufacturer_vendor_relation_parent", "parent_org_id"),
        Index("idx_manufacturer_vendor_relation_child", "child_org_id"),
        Index("idx_manufacturer_vendor_relation_type", "relation_type"),
    )


class ManufacturerVendorExternalMapping(Base):
    __tablename__ = "manufacturer_vendor_external_mapping"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=False
    )
    system_name: Mapped[str] = mapped_column(String(50), nullable=False)
    external_code: Mapped[str | None] = mapped_column(String(200))
    external_name: Mapped[str | None] = mapped_column(String(300))
    is_current: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default=text("true"))
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    audit_status: Mapped[str] = mapped_column(String(50), nullable=False, server_default=text("'approved'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_manufacturer_vendor_external_mapping_current",
            "system_name",
            "external_code",
            unique=True,
            postgresql_where=text("is_current = true AND external_code IS NOT NULL"),
        ),
        Index("idx_manufacturer_vendor_external_org", "org_id"),
        Index("idx_manufacturer_vendor_external_name", "external_name"),
    )


class ManufacturerVendorCandidate(Base):
    __tablename__ = "manufacturer_vendor_candidate"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    source_system: Mapped[str] = mapped_column(String(50), nullable=False)
    source_table: Mapped[str | None] = mapped_column(String(100))
    source_record_id: Mapped[str | None] = mapped_column(String(200))
    raw_name: Mapped[str] = mapped_column(String(300), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(300), nullable=False)
    matched_org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manufacturer_vendor_master.id"), nullable=True
    )
    match_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    match_status: Mapped[str] = mapped_column(String(30), nullable=False)
    suggested_action: Mapped[str] = mapped_column(String(30), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(100))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_manufacturer_vendor_candidate_source",
            "source_system",
            "source_table",
            "source_record_id",
            "normalized_name",
            unique=True,
        ),
        Index("idx_manufacturer_vendor_candidate_status", "match_status", "created_at"),
        Index("idx_manufacturer_vendor_candidate_name", "normalized_name"),
        Index("idx_manufacturer_vendor_candidate_matched_org", "matched_org_id"),
    )


class SysMappingBridge(Base):
    __tablename__ = "sys_mapping_bridge"

    bridge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    source_system: Mapped[str] = mapped_column(String(50), nullable=False)
    source_key: Mapped[str] = mapped_column(String(200), nullable=False)
    source_desc: Mapped[str | None] = mapped_column(String(500))
    target_master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    target_code: Mapped[str | None] = mapped_column(String(100))
    mapping_rule: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    last_verified: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_sys_mapping_bridge_active_source",
            "category",
            "source_system",
            "source_key",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'"),
        ),
        Index("idx_sys_mapping_bridge_target", "target_master_id"),
        Index("idx_sys_mapping_bridge_category_status", "category", "status"),
    )


class SysMappingReviewTask(Base):
    __tablename__ = "sys_mapping_review_task"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    source_system: Mapped[str] = mapped_column(String(50), nullable=False)
    source_key: Mapped[str] = mapped_column(String(200), nullable=False)
    source_desc: Mapped[str | None] = mapped_column(String(500))
    candidate_json: Mapped[list | dict] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    reviewer: Mapped[str | None] = mapped_column(String(100))
    review_comment: Mapped[str | None] = mapped_column(Text())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_sys_mapping_review_task_status", "status"),
        Index("idx_sys_mapping_review_task_source", "category", "source_system", "source_key"),
    )


class SysExchangeLog(Base):
    __tablename__ = "sys_exchange_log"

    log_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    trace_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_system: Mapped[str] = mapped_column(String(50), nullable=False)
    source_tx_id: Mapped[str] = mapped_column(String(200), nullable=False)
    target_system: Mapped[str | None] = mapped_column(String(50))
    data_category: Mapped[str] = mapped_column(String(50), nullable=False)
    request_payload: Mapped[dict | None] = mapped_column(JSONB)
    response_payload: Mapped[dict | None] = mapped_column(JSONB)
    payload_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(100))
    processing_time_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("source_system", "source_tx_id", name="uq_sys_exchange_log_idempotency"),
        Index("idx_sys_exchange_log_status_time", "status", "created_at"),
        Index("idx_sys_exchange_log_source_time", "source_system", "created_at"),
    )


class SysApiRegistry(Base):
    __tablename__ = "sys_api_registry"

    api_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    api_name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_system: Mapped[str | None] = mapped_column(String(50))
    target_system: Mapped[str | None] = mapped_column(String(50))
    protocol: Mapped[str] = mapped_column(String(20), nullable=False)
    endpoint_url: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    owner: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_sys_api_registry_status", "status"),
        Index("idx_sys_api_registry_systems", "source_system", "target_system"),
    )


class SysImportBatch(Base):
    __tablename__ = "sys_import_batch"

    batch_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_system: Mapped[str] = mapped_column(String(50), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    source_file_path: Mapped[str | None] = mapped_column(String(1000))
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    sheet_name: Mapped[str | None] = mapped_column(String(100))
    import_mode: Mapped[str | None] = mapped_column(String(50))
    import_reason: Mapped[str | None] = mapped_column(Text())
    source_url: Mapped[str | None] = mapped_column(String(1000))
    catalog_version: Mapped[str | None] = mapped_column(String(100))
    operator_user_id: Mapped[str | None] = mapped_column(String(100))
    operator_name: Mapped[str | None] = mapped_column(String(100))
    operator_department: Mapped[str | None] = mapped_column(String(100))
    operator_role: Mapped[str | None] = mapped_column(String(100))
    client_ip: Mapped[str | None] = mapped_column(String(100))
    user_agent: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    source_row_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    unique_key_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    success_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    skipped_duplicate_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    duplicate_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    inserted_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    updated_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    deprecated_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    rollback_status: Mapped[str] = mapped_column(String(30), server_default=text("'NOT_REQUESTED'"), nullable=False)
    progress_percent: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text())
    result_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_sys_import_batch_status", "status", "created_at"),
        Index("idx_sys_import_batch_source_type", "source_type", "created_at"),
        Index("idx_sys_import_batch_source_file", "source_file_id"),
        Index("idx_sys_import_batch_operator", "operator_user_id", "created_at"),
    )


class SysImportFailure(Base):
    __tablename__ = "sys_import_failure"

    failure_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("sys_import_batch.batch_id"), nullable=False
    )
    row_number: Mapped[int | None] = mapped_column(Integer)
    field_name: Mapped[str | None] = mapped_column(String(100))
    message: Mapped[str] = mapped_column(Text(), nullable=False)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_sys_import_failure_batch", "batch_id"),
        Index("idx_sys_import_failure_field", "field_name"),
    )


class StgNhsaMaterialSpec(Base):
    __tablename__ = "stg_nhsa_material_specs"

    stg_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    sheet_name: Mapped[str] = mapped_column(String(100), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    goods_id: Mapped[str | None] = mapped_column(String(100))
    udi: Mapped[str | None] = mapped_column(String(200))
    original_yb_code_27: Mapped[str | None] = mapped_column(String(50))
    original_code_status: Mapped[str | None] = mapped_column(String(20))
    yb_code_27: Mapped[str] = mapped_column(String(50), nullable=False)
    change_type: Mapped[str | None] = mapped_column(String(20))
    yb_code_20: Mapped[str | None] = mapped_column(String(50))
    cat_level_1: Mapped[str | None] = mapped_column(String(200))
    cat_level_2: Mapped[str | None] = mapped_column(String(200))
    cat_level_3: Mapped[str | None] = mapped_column(String(200))
    insurance_generic_category: Mapped[str | None] = mapped_column(String(200))
    material_attr: Mapped[str | None] = mapped_column(String(100))
    feature: Mapped[str | None] = mapped_column(String(100))
    registration_number: Mapped[str | None] = mapped_column(String(100))
    single_product_name: Mapped[str | None] = mapped_column(String(200))
    manufacturer: Mapped[str | None] = mapped_column(String(200))
    spec_model_count: Mapped[int | None] = mapped_column(Integer)
    spec: Mapped[str | None] = mapped_column(Text())
    model: Mapped[str | None] = mapped_column(Text())
    insurance_generic_name_code: Mapped[str | None] = mapped_column(String(100))
    insurance_generic_name: Mapped[str | None] = mapped_column(String(200))
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_stg_nhsa_material_specs_batch", "batch_id"),
        Index("idx_stg_nhsa_material_specs_yb_code_27", "yb_code_27"),
        Index("idx_stg_nhsa_material_specs_yb_code_20", "yb_code_20"),
    )


class StgNhsaMaterialDisabled(Base):
    __tablename__ = "stg_nhsa_material_disabled"

    stg_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    sheet_name: Mapped[str] = mapped_column(String(100), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    yb_code_27: Mapped[str] = mapped_column(String(50), nullable=False)
    original_code_status: Mapped[str] = mapped_column(String(20), nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_stg_nhsa_material_disabled_batch", "batch_id"),
        Index("idx_stg_nhsa_material_disabled_code", "yb_code_27"),
    )


class StgNhsaMaterialTranscode(Base):
    __tablename__ = "stg_nhsa_material_transcode"

    stg_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    sheet_name: Mapped[str] = mapped_column(String(100), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    original_yb_code_27: Mapped[str] = mapped_column(String(50), nullable=False)
    original_code_status: Mapped[str] = mapped_column(String(20), nullable=False)
    yb_code_27: Mapped[str] = mapped_column(String(50), nullable=False)
    change_type: Mapped[str] = mapped_column(String(20), nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_stg_nhsa_material_transcode_batch", "batch_id"),
        Index("idx_stg_nhsa_material_transcode_original", "original_yb_code_27"),
        Index("idx_stg_nhsa_material_transcode_new", "yb_code_27"),
    )


class DeviceClassificationSourceFile(Base):
    __tablename__ = "device_classification_source_files"

    source_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_file_name: Mapped[str | None] = mapped_column(String(500))
    source_file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    sha256: Mapped[str | None] = mapped_column(String(128))
    file_type: Mapped[str | None] = mapped_column(String(50))
    source_system: Mapped[str | None] = mapped_column(String(100))
    source_link: Mapped[str | None] = mapped_column(String(1000))
    publish_date: Mapped[date | None] = mapped_column(Date())
    effective_date: Mapped[date | None] = mapped_column(Date())
    authoritative: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    metadata_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_device_source_file_batch", "batch_id"),
        Index("idx_device_source_file_sha256", "sha256"),
    )


class DeviceClassificationImportStaging(Base):
    __tablename__ = "device_classification_import_staging"

    staging_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    catalog_code: Mapped[str | None] = mapped_column(String(50))
    major_category_no: Mapped[str | None] = mapped_column(String(20))
    major_category_name: Mapped[str | None] = mapped_column(String(200))
    level_1_category_no: Mapped[str | None] = mapped_column(String(20))
    level_1_category: Mapped[str | None] = mapped_column(String(200))
    level_2_category_no: Mapped[str | None] = mapped_column(String(20))
    level_2_category: Mapped[str | None] = mapped_column(String(200))
    product_description: Mapped[str | None] = mapped_column(Text())
    intended_use: Mapped[str | None] = mapped_column(Text())
    product_examples: Mapped[str | None] = mapped_column(Text())
    management_class: Mapped[str | None] = mapped_column(String(20))
    change_type: Mapped[str | None] = mapped_column(String(30))
    parse_status: Mapped[str] = mapped_column(String(30), nullable=False)
    issue_message: Mapped[str | None] = mapped_column(Text())
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_device_import_staging_batch", "batch_id"),
        Index("idx_device_import_staging_status", "batch_id", "parse_status"),
        Index("idx_device_import_staging_code", "catalog_code"),
    )


class DeviceClassificationImportValidationResult(Base):
    __tablename__ = "device_classification_import_validation_results"

    validation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    validation_key: Mapped[str] = mapped_column(String(100), nullable=False)
    validation_label: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    message: Mapped[str | None] = mapped_column(Text())
    issue_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    result_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_device_validation_batch", "batch_id"),
        Index("idx_device_validation_status", "batch_id", "status"),
    )


class DeviceClassificationCatalogVersion(Base):
    __tablename__ = "device_classification_catalog_versions"

    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    version_no: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    source_system: Mapped[str | None] = mapped_column(String(100))
    publish_date: Mapped[date | None] = mapped_column(Date())
    effective_date: Mapped[date | None] = mapped_column(Date())
    item_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    abnormal_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    rollback_supported: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_device_catalog_version_batch", "batch_id"),
        Index("idx_device_catalog_version_current", "is_current"),
    )


class DeviceClassificationImportAuditLog(Base):
    __tablename__ = "device_classification_import_audit_logs"

    audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    operator_name: Mapped[str | None] = mapped_column(String(100))
    message: Mapped[str | None] = mapped_column(Text())
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_device_import_audit_batch", "batch_id"),
        Index("idx_device_import_audit_action", "action", "created_at"),
    )


class RefDeviceClassificationCatalog(Base):
    __tablename__ = "ref_device_classification_catalog"

    catalog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    source_table_index: Mapped[int] = mapped_column(Integer, nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    category_no: Mapped[str | None] = mapped_column(String(20))
    major_category_no: Mapped[str | None] = mapped_column(String(20))
    major_category_name: Mapped[str | None] = mapped_column(String(200))
    level_1_category_no: Mapped[str | None] = mapped_column(String(20))
    level_1_category: Mapped[str | None] = mapped_column(String(200))
    level_2_category_no: Mapped[str | None] = mapped_column(String(20))
    level_2_category: Mapped[str | None] = mapped_column(String(200))
    product_description: Mapped[str | None] = mapped_column(Text())
    intended_use: Mapped[str | None] = mapped_column(Text())
    product_examples: Mapped[str | None] = mapped_column(Text())
    management_class: Mapped[str | None] = mapped_column(String(20))
    data_status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'effective'"))
    status_reason: Mapped[str | None] = mapped_column(Text())
    hidden_in_tree: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    merged_to_catalog_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_ref_device_catalog_batch", "batch_id"),
        Index("idx_ref_device_catalog_status", "data_status", "hidden_in_tree"),
        Index(
            "idx_ref_device_catalog_category",
            "category_no",
            "major_category_no",
            "level_1_category_no",
            "level_2_category_no",
            "level_1_category",
            "level_2_category",
        ),
    )


class RefDeviceClassificationRevision(Base):
    __tablename__ = "ref_device_classification_revisions"

    revision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    source_table_index: Mapped[int] = mapped_column(Integer, nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    change_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text())
    old_catalog_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    new_catalog_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    old_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    new_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_ref_device_revision_batch", "batch_id"),
        Index("idx_ref_device_revision_new_catalog", "new_catalog_id"),
        Index("idx_ref_device_revision_old_catalog", "old_catalog_id"),
        Index("idx_ref_device_revision_change_type", "change_type"),
    )


class CatalogCorrectionOrder(Base):
    __tablename__ = "catalog_correction_order"

    correction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    correction_no: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    catalog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ref_device_classification_catalog.catalog_id"), nullable=False
    )
    source_batch_id: Mapped[str | None] = mapped_column(String(100))
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    source_file_hash: Mapped[str | None] = mapped_column(String(128))
    source_position: Mapped[str | None] = mapped_column(String(200))
    abnormal_type: Mapped[str] = mapped_column(String(60), nullable=False)
    correction_action: Mapped[str] = mapped_column(String(60), nullable=False)
    before_data: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    after_data: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    reason: Mapped[str] = mapped_column(Text(), nullable=False)
    handling_note: Mapped[str | None] = mapped_column(Text())
    impact_summary: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    hide_in_tree: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    need_review: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    attachment_payload: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"), nullable=False)
    applicant_user_id: Mapped[str | None] = mapped_column(String(100))
    applicant_name: Mapped[str | None] = mapped_column(String(100))
    reviewer_user_id: Mapped[str | None] = mapped_column(String(100))
    reviewer_name: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'submitted'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_catalog_correction_catalog", "catalog_id", "created_at"),
        Index("idx_catalog_correction_status", "status", "created_at"),
        Index("idx_catalog_correction_batch", "source_batch_id"),
    )


class CatalogCorrectionLog(Base):
    __tablename__ = "catalog_correction_log"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    correction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_correction_order.correction_id"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    operator_user_id: Mapped[str | None] = mapped_column(String(100))
    operator_name: Mapped[str | None] = mapped_column(String(100))
    message: Mapped[str | None] = mapped_column(Text())
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("idx_catalog_correction_log_order", "correction_id", "created_at"),)


class CatalogChangeHistory(Base):
    __tablename__ = "catalog_change_history"

    history_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    catalog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ref_device_classification_catalog.catalog_id"), nullable=False
    )
    correction_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    change_type: Mapped[str] = mapped_column(String(60), nullable=False)
    before_data: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    after_data: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    operator_name: Mapped[str | None] = mapped_column(String(100))
    reason: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("idx_catalog_change_history_catalog", "catalog_id", "created_at"),)


class CatalogReferenceRelation(Base):
    __tablename__ = "catalog_reference_relation"

    relation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    catalog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ref_device_classification_catalog.catalog_id"), nullable=False
    )
    reference_type: Mapped[str] = mapped_column(String(60), nullable=False)
    reference_table: Mapped[str | None] = mapped_column(String(120))
    reference_id: Mapped[str | None] = mapped_column(String(120))
    reference_name: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'active'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("idx_catalog_reference_relation_catalog", "catalog_id", "reference_type", "status"),)


class ImportValidationRule(Base):
    __tablename__ = "import_validation_rule"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    rule_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    rule_name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(80), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'warning'"))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    rule_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("idx_import_validation_rule_type", "source_type", "enabled"),)


class ImportValidationIssue(Base):
    __tablename__ = "import_validation_issue"

    issue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    catalog_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    rule_code: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    issue_type: Mapped[str] = mapped_column(String(80), nullable=False)
    message: Mapped[str] = mapped_column(Text(), nullable=False)
    source_position: Mapped[str | None] = mapped_column(String(200))
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'open'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_import_validation_issue_batch", "batch_id", "status"),
        Index("idx_import_validation_issue_catalog", "catalog_id"),
    )


class DictEquipmentCategory(Base):
    __tablename__ = "dict_equipment_categories"

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    category_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    category_name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dict_equipment_categories.category_id"), nullable=True
    )
    level_no: Mapped[int | None] = mapped_column(Integer)
    source_system: Mapped[str | None] = mapped_column(String(100))
    source_batch_id: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_equipment_category_name", "category_name"),
        Index("idx_equipment_category_parent", "parent_category_id"),
        Index("idx_equipment_category_status", "status"),
        Index("idx_equipment_category_batch", "source_batch_id"),
    )


class DictEquipmentStandardName(Base):
    __tablename__ = "dict_equipment_standard_names"

    standard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    standard_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    standard_name: Mapped[str] = mapped_column(String(300), nullable=False, unique=True)
    alias_names: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dict_equipment_categories.category_id"), nullable=True
    )
    device_classification_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ref_device_classification_catalog.catalog_id"), nullable=True
    )
    common_manufacturer_org_ids: Mapped[list[str]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=False
    )
    management_class: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    source_system: Mapped[str | None] = mapped_column(String(100))
    source_batch_id: Mapped[str | None] = mapped_column(String(100))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_equipment_standard_name", "standard_name"),
        Index("idx_equipment_standard_category", "category_id"),
        Index("idx_equipment_standard_device_classification", "device_classification_id"),
        Index("idx_equipment_standard_status", "status"),
        Index("idx_equipment_standard_batch", "source_batch_id"),
    )


class AppUser(Base):
    __tablename__ = "app_user"
    __table_args__ = {"schema": "identity"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(128))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    roles: Mapped[list["UserRole"]] = sa_orm.relationship(
        "UserRole",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserRole(Base):
    __tablename__ = "user_role"
    __table_args__ = {"schema": "identity"}

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.app_user.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_code: Mapped[str] = mapped_column(String(64), primary_key=True)

    user: Mapped["AppUser"] = sa_orm.relationship("AppUser", back_populates="roles")


class MdmSpaceLocation(Base):
    __tablename__ = "space_location"
    __table_args__ = {"schema": "mdm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mdm.space_location.id", ondelete="SET NULL"))
    short_name: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class MdmRegistrationCertificate(Base):
    __tablename__ = "registration_certificate"
    __table_args__ = {"schema": "mdm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    registration_no: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(200))
    brand: Mapped[str | None] = mapped_column(String(200))
    model: Mapped[str | None] = mapped_column(String(200))
    holder_name: Mapped[str | None] = mapped_column(String(200))
    valid_to: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class MdmUdi(Base):
    __tablename__ = "udi"
    __table_args__ = {"schema": "mdm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    di: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(200))
    brand: Mapped[str | None] = mapped_column(String(200))
    model: Mapped[str | None] = mapped_column(String(200))
    registration_no: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class MdmEquipmentBrandModel(Base):
    __tablename__ = "equipment_brand_model"
    __table_args__ = {"schema": "mdm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str | None] = mapped_column(String(100))
    brand: Mapped[str] = mapped_column(String(200), nullable=False)
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    generic_name: Mapped[str] = mapped_column(String(200), nullable=False)
    standard_name: Mapped[str | None] = mapped_column(String(200))
    manufacturer_name: Mapped[str | None] = mapped_column(String(200))
    registration_no: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class MdmStandardEquipment(Base):
    __tablename__ = "standard_equipment"
    __table_args__ = {"schema": "mdm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    generic_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_code: Mapped[str | None] = mapped_column(String(100))
    category_name: Mapped[str | None] = mapped_column(String(200))
    management_class: Mapped[str | None] = mapped_column(String(20))
    brand: Mapped[str | None] = mapped_column(String(200))
    model: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
