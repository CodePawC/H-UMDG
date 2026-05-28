"""organization person discipline master data

Revision ID: 0016_org_person_discipline
Revises: 0015_master_data_external_api
Create Date: 2026-05-28 08:00:00.000000
"""

from __future__ import annotations

import hashlib

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = "0016_org_person_discipline"
down_revision = "0015_master_data_external_api"
branch_labels = None
depends_on = None


ORG_SCOPES = [
    "md:organization:read",
    "md:organization:tree",
    "md:person:read",
    "md:discipline:read",
    "md:discipline:tree",
]
DEFAULT_CLIENTS = [
    ("HOSPITAL_DATA_BUS", "医院数据总线", "hudmp-dbus-dev-20260525"),
    ("EQUIPMENT_OS", "医学装备运营平台", "hudmp-equipment-os-dev-20260525"),
    ("HIS", "HIS系统", "hudmp-his-dev-20260525"),
    ("SPD", "SPD系统", "hudmp-spd-dev-20260525"),
    ("MEDICAL_INSURANCE", "医保接口平台", "hudmp-mi-dev-20260525"),
]


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {item["name"] for item in inspect(op.get_bind()).get_columns(table_name)}


def _add_department_column_if_missing(name: str, column_type, **kwargs) -> None:
    if not _has_column("dict_departments", name):
        op.add_column("dict_departments", sa.Column(name, column_type, **kwargs))


def _create_index_if_missing(name: str, table_name: str, columns: list[str]) -> None:
    indexes = {item["name"] for item in inspect(op.get_bind()).get_indexes(table_name)}
    if name not in indexes:
        op.create_index(name, table_name, columns)


def _seed_api_client_scopes() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("api_client"):
        return
    scope_sql = """
        UPDATE api_client
        SET allowed_scopes = (
            SELECT jsonb_agg(DISTINCT scope.value)
            FROM jsonb_array_elements_text(api_client.allowed_scopes || CAST(:extra_scopes AS jsonb)) AS scope(value)
        )
        WHERE client_id = :client_id
    """
    for client_id, _client_name, api_key in DEFAULT_CLIENTS:
        bind.execute(
            text(
                """
                INSERT INTO api_client (client_id, client_name, api_key_hash, allowed_scopes, status)
                VALUES (:client_id, :client_name, :api_key_hash, CAST(:allowed_scopes AS jsonb), 'active')
                ON CONFLICT (client_id) DO NOTHING
                """
            ),
            {
                "client_id": client_id,
                "client_name": _client_name,
                "api_key_hash": hashlib.sha256(api_key.encode("utf-8")).hexdigest(),
                "allowed_scopes": '["md:device-classification:read","md:device-classification:tree","md:device-classification:changes"]',
            },
        )
        bind.execute(text(scope_sql), {"client_id": client_id, "extra_scopes": str(ORG_SCOPES).replace("'", '"')})


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("dict_campuses"):
        op.create_table(
            "dict_campuses",
            sa.Column("campus_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
            sa.Column("campus_code", sa.String(length=100), nullable=False, unique=True),
            sa.Column("campus_name", sa.String(length=200), nullable=False),
            sa.Column("campus_short_name", sa.String(length=100), nullable=True),
            sa.Column("organization_id", sa.String(length=100), nullable=True),
            sa.Column("address", sa.String(length=500), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default=text("'ACTIVE'")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=text("0")),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("idx_dict_campuses_name", "dict_campuses", ["campus_name"])
    _create_index_if_missing("idx_dict_campuses_status", "dict_campuses", ["status"])

    if inspector.has_table("dict_departments"):
        _add_department_column_if_missing("campus_id", postgresql.UUID(as_uuid=True), nullable=True)
        _add_department_column_if_missing("dept_short_name", sa.String(length=100), nullable=True)
        _add_department_column_if_missing("is_clinical", sa.Boolean(), nullable=False, server_default=text("false"))
        _add_department_column_if_missing("is_medtech", sa.Boolean(), nullable=False, server_default=text("false"))
        _add_department_column_if_missing("is_nursing_unit", sa.Boolean(), nullable=False, server_default=text("false"))
        _add_department_column_if_missing("is_admin", sa.Boolean(), nullable=False, server_default=text("false"))
        _add_department_column_if_missing("is_logistics", sa.Boolean(), nullable=False, server_default=text("false"))
        _add_department_column_if_missing("ward_flag", sa.Boolean(), nullable=False, server_default=text("false"))
        _add_department_column_if_missing("cost_center_code", sa.String(length=100), nullable=True)
        _add_department_column_if_missing("his_department_code", sa.String(length=100), nullable=True)
        _add_department_column_if_missing("hris_department_code", sa.String(length=100), nullable=True)
        _add_department_column_if_missing("finance_department_code", sa.String(length=100), nullable=True)
        _add_department_column_if_missing("sort_order", sa.Integer(), nullable=False, server_default=text("0"))
        _add_department_column_if_missing("effective_date", sa.Date(), nullable=True)
        _add_department_column_if_missing("expired_date", sa.Date(), nullable=True)
        _add_department_column_if_missing("remark", sa.Text(), nullable=True)
        bind = op.get_bind()
        existing_fk = {fk["name"] for fk in inspector.get_foreign_keys("dict_departments")}
        if "fk_dict_departments_campus_id" not in existing_fk:
            op.create_foreign_key(
                "fk_dict_departments_campus_id",
                "dict_departments",
                "dict_campuses",
                ["campus_id"],
                ["campus_id"],
            )
        _create_index_if_missing("idx_dict_departments_campus", "dict_departments", ["campus_id"])
        bind.execute(
            text(
                """
                INSERT INTO dict_campuses (campus_code, campus_name, campus_short_name, organization_id, status, sort_order, remark)
                VALUES ('MAIN', '主院区', '主院区', 'ORG-HOSPITAL', 'ACTIVE', 1, '系统默认院区，多院区治理预留')
                ON CONFLICT (campus_code) DO NOTHING
                """
            )
        )
        bind.execute(
            text(
                """
                UPDATE dict_departments
                SET campus_id = (SELECT campus_id FROM dict_campuses WHERE campus_code = 'MAIN')
                WHERE campus_id IS NULL
                """
            )
        )

    if not inspector.has_table("dict_persons"):
        op.create_table(
            "dict_persons",
            sa.Column("person_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
            sa.Column("person_code", sa.String(length=100), nullable=False, unique=True),
            sa.Column("employee_no", sa.String(length=100), nullable=True),
            sa.Column("person_name", sa.String(length=100), nullable=False),
            sa.Column("gender", sa.String(length=20), nullable=True),
            sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dict_departments.dept_id"), nullable=True),
            sa.Column("campus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dict_campuses.campus_id"), nullable=True),
            sa.Column("position", sa.String(length=100), nullable=True),
            sa.Column("job_title", sa.String(length=100), nullable=True),
            sa.Column("professional_title", sa.String(length=100), nullable=True),
            sa.Column("person_type", sa.String(length=50), nullable=True),
            sa.Column("phone", sa.String(length=50), nullable=True),
            sa.Column("email", sa.String(length=200), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default=text("'ACTIVE'")),
            sa.Column("login_account", sa.String(length=100), nullable=True),
            sa.Column("external_user_id", sa.String(length=100), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=text("0")),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("idx_dict_persons_name", "dict_persons", ["person_name"])
    _create_index_if_missing("idx_dict_persons_employee_no", "dict_persons", ["employee_no"])
    _create_index_if_missing("idx_dict_persons_department", "dict_persons", ["department_id"])
    _create_index_if_missing("idx_dict_persons_campus", "dict_persons", ["campus_id"])
    _create_index_if_missing("idx_dict_persons_status", "dict_persons", ["status"])

    if not inspector.has_table("dict_disciplines"):
        op.create_table(
            "dict_disciplines",
            sa.Column("discipline_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
            sa.Column("discipline_code", sa.String(length=100), nullable=False, unique=True),
            sa.Column("discipline_name", sa.String(length=200), nullable=False),
            sa.Column("discipline_short_name", sa.String(length=100), nullable=True),
            sa.Column("discipline_type", sa.String(length=50), nullable=True),
            sa.Column("parent_discipline_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dict_disciplines.discipline_id"), nullable=True),
            sa.Column("level", sa.Integer(), nullable=True),
            sa.Column("is_key_discipline", sa.Boolean(), nullable=False, server_default=text("false")),
            sa.Column("status", sa.String(length=20), nullable=False, server_default=text("'ACTIVE'")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=text("0")),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("idx_dict_disciplines_name", "dict_disciplines", ["discipline_name"])
    _create_index_if_missing("idx_dict_disciplines_parent", "dict_disciplines", ["parent_discipline_id"])
    _create_index_if_missing("idx_dict_disciplines_status", "dict_disciplines", ["status"])

    if not inspector.has_table("department_discipline_mapping"):
        op.create_table(
            "department_discipline_mapping",
            sa.Column("mapping_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
            sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dict_departments.dept_id"), nullable=False),
            sa.Column("discipline_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dict_disciplines.discipline_id"), nullable=False),
            sa.Column("relation_type", sa.String(length=50), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=text("false")),
            sa.Column("weight", sa.Numeric(5, 2), nullable=True),
            sa.Column("effective_date", sa.Date(), nullable=True),
            sa.Column("expired_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default=text("'ACTIVE'")),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("idx_dept_disc_mapping_department", "department_discipline_mapping", ["department_id"])
    _create_index_if_missing("idx_dept_disc_mapping_discipline", "department_discipline_mapping", ["discipline_id"])
    _create_index_if_missing("idx_dept_disc_mapping_status", "department_discipline_mapping", ["status"])

    _seed_api_client_scopes()


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("department_discipline_mapping"):
        op.drop_table("department_discipline_mapping")
    if inspector.has_table("dict_disciplines"):
        op.drop_table("dict_disciplines")
    if inspector.has_table("dict_persons"):
        op.drop_table("dict_persons")
    if inspector.has_table("dict_departments") and _has_column("dict_departments", "campus_id"):
        for name in [
            "fk_dict_departments_campus_id",
        ]:
            try:
                op.drop_constraint(name, "dict_departments", type_="foreignkey")
            except Exception:
                pass
    if inspector.has_table("dict_campuses"):
        op.drop_table("dict_campuses")
