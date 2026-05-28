"""business partner master data

Revision ID: 0017_business_partner
Revises: 0016_org_person_discipline
Create Date: 2026-05-28 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "0017_business_partner"
down_revision = "0016_org_person_discipline"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    inspector = inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in _columns(table_name):
        op.add_column(table_name, column)


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str], **kwargs) -> None:
    inspector = inspect(op.get_bind())
    existing = {idx["name"] for idx in inspector.get_indexes(table_name)}
    if index_name not in existing:
        op.create_index(index_name, table_name, columns, **kwargs)


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())

    _add_column_if_missing("manufacturer_vendor_master", sa.Column("former_name", sa.String(length=300), nullable=True))
    _add_column_if_missing("manufacturer_vendor_master", sa.Column("registered_address", sa.String(length=500), nullable=True))
    _add_column_if_missing("manufacturer_vendor_master", sa.Column("office_address", sa.String(length=500), nullable=True))
    _add_column_if_missing("manufacturer_vendor_master", sa.Column("contact_phone", sa.String(length=80), nullable=True))
    _add_column_if_missing("manufacturer_vendor_master", sa.Column("website", sa.String(length=300), nullable=True))
    _add_column_if_missing("manufacturer_vendor_master", sa.Column("source_system", sa.String(length=100), nullable=True))
    _create_index_if_missing("idx_manufacturer_vendor_source_system", "manufacturer_vendor_master", ["source_system"])

    _add_column_if_missing("manufacturer_vendor_role", sa.Column("effective_date", sa.Date(), nullable=True))
    _add_column_if_missing("manufacturer_vendor_role", sa.Column("expired_date", sa.Date(), nullable=True))
    _add_column_if_missing(
        "manufacturer_vendor_role",
        sa.Column("qualification_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    if "mdm_organization_qualification" not in existing_tables:
        op.create_table(
            "mdm_organization_qualification",
            sa.Column("qualification_id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("qualification_type", sa.String(length=100), nullable=False),
            sa.Column("certificate_no", sa.String(length=200), nullable=True),
            sa.Column("certificate_name", sa.String(length=300), nullable=True),
            sa.Column("issuing_authority", sa.String(length=200), nullable=True),
            sa.Column("valid_from", sa.Date(), nullable=True),
            sa.Column("valid_to", sa.Date(), nullable=True),
            sa.Column("file_id", sa.String(length=200), nullable=True),
            sa.Column("status", sa.String(length=30), server_default=sa.text("'enabled'"), nullable=False),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["manufacturer_vendor_master.id"]),
            sa.PrimaryKeyConstraint("qualification_id"),
        )
        op.create_index("idx_mdm_org_qualification_org", "mdm_organization_qualification", ["org_id"])
        op.create_index("idx_mdm_org_qualification_type", "mdm_organization_qualification", ["qualification_type"])
        op.create_index("idx_mdm_org_qualification_valid_to", "mdm_organization_qualification", ["valid_to"])
        op.create_index("idx_mdm_org_qualification_status", "mdm_organization_qualification", ["status"])

    if "mdm_organization_contact" not in existing_tables:
        op.create_table(
            "mdm_organization_contact",
            sa.Column("contact_id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("contact_name", sa.String(length=100), nullable=False),
            sa.Column("department", sa.String(length=100), nullable=True),
            sa.Column("position", sa.String(length=100), nullable=True),
            sa.Column("phone", sa.String(length=80), nullable=True),
            sa.Column("mobile", sa.String(length=80), nullable=True),
            sa.Column("email", sa.String(length=200), nullable=True),
            sa.Column("contact_type", sa.String(length=80), nullable=True),
            sa.Column("is_primary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("status", sa.String(length=30), server_default=sa.text("'enabled'"), nullable=False),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["manufacturer_vendor_master.id"]),
            sa.PrimaryKeyConstraint("contact_id"),
        )
        op.create_index("idx_mdm_org_contact_org", "mdm_organization_contact", ["org_id"])
        op.create_index("idx_mdm_org_contact_type", "mdm_organization_contact", ["contact_type"])
        op.create_index("idx_mdm_org_contact_status", "mdm_organization_contact", ["status"])

    if "mdm_external_mapping" not in existing_tables:
        op.create_table(
            "mdm_external_mapping",
            sa.Column("mapping_id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("master_type", sa.String(length=80), nullable=False),
            sa.Column("master_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("source_system", sa.String(length=80), nullable=False),
            sa.Column("external_code", sa.String(length=200), nullable=True),
            sa.Column("external_name", sa.String(length=300), nullable=True),
            sa.Column("mapping_confidence", sa.Numeric(5, 4), nullable=True),
            sa.Column("status", sa.String(length=30), server_default=sa.text("'enabled'"), nullable=False),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("mapping_id"),
        )
        op.create_index(
            "uq_mdm_external_mapping_current",
            "mdm_external_mapping",
            ["master_type", "source_system", "external_code"],
            unique=True,
            postgresql_where=sa.text("status = 'enabled' AND external_code IS NOT NULL"),
        )
        op.create_index("idx_mdm_external_mapping_master", "mdm_external_mapping", ["master_type", "master_id"])
        op.create_index("idx_mdm_external_mapping_name", "mdm_external_mapping", ["external_name"])

    op.execute(
        sa.text(
            """
            CREATE OR REPLACE VIEW mdm_business_partner AS
            SELECT
                id AS org_id,
                organization_code AS org_code,
                unified_social_credit_code,
                standard_name AS org_name,
                short_name AS org_short_name,
                former_name,
                english_name,
                organization_type AS org_type,
                legal_representative,
                COALESCE(registered_address, address) AS registered_address,
                office_address,
                contact_phone,
                website,
                status,
                COALESCE(source_system, data_source) AS source_system,
                remark,
                created_at,
                updated_at
            FROM manufacturer_vendor_master
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE OR REPLACE VIEW mdm_organization_role AS
            SELECT
                id AS role_id,
                org_id,
                role_type,
                status AS role_status,
                effective_date,
                expired_date,
                qualification_required,
                remark,
                created_at,
                updated_at
            FROM manufacturer_vendor_role
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE OR REPLACE VIEW mdm_organization_relation AS
            SELECT
                id AS relation_id,
                parent_org_id,
                child_org_id,
                relation_type,
                effective_date,
                expired_date,
                status,
                remark
            FROM manufacturer_vendor_relation
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO mdm_external_mapping (
                mapping_id,
                master_type,
                master_id,
                source_system,
                external_code,
                external_name,
                mapping_confidence,
                status,
                remark,
                created_at,
                updated_at
            )
            SELECT
                id,
                'business_partner',
                org_id,
                system_name,
                external_code,
                external_name,
                confidence,
                CASE WHEN is_current THEN 'enabled' ELSE 'disabled' END,
                remark,
                created_at,
                updated_at
            FROM manufacturer_vendor_external_mapping old
            WHERE NOT EXISTS (
                SELECT 1 FROM mdm_external_mapping m
                WHERE m.master_type = 'business_partner'
                  AND m.source_system = old.system_name
                  AND COALESCE(m.external_code, '') = COALESCE(old.external_code, '')
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE api_client
            SET allowed_scopes = (
                SELECT jsonb_agg(DISTINCT scope)
                FROM jsonb_array_elements_text(
                    COALESCE(allowed_scopes, '[]'::jsonb)
                    || '["md:business-partner:read","md:business-partner:match"]'::jsonb
                ) AS scope
            )
            WHERE client_id IN ('EQUIPMENT_OS', 'HOSPITAL_DATA_BUS', 'SPD', 'HIS', 'MEDICAL_INSURANCE')
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP VIEW IF EXISTS mdm_organization_relation"))
    op.execute(sa.text("DROP VIEW IF EXISTS mdm_organization_role"))
    op.execute(sa.text("DROP VIEW IF EXISTS mdm_business_partner"))
    op.drop_index("idx_mdm_external_mapping_name", table_name="mdm_external_mapping")
    op.drop_index("idx_mdm_external_mapping_master", table_name="mdm_external_mapping")
    op.drop_index("uq_mdm_external_mapping_current", table_name="mdm_external_mapping")
    op.drop_table("mdm_external_mapping")
    op.drop_index("idx_mdm_org_contact_status", table_name="mdm_organization_contact")
    op.drop_index("idx_mdm_org_contact_type", table_name="mdm_organization_contact")
    op.drop_index("idx_mdm_org_contact_org", table_name="mdm_organization_contact")
    op.drop_table("mdm_organization_contact")
    op.drop_index("idx_mdm_org_qualification_status", table_name="mdm_organization_qualification")
    op.drop_index("idx_mdm_org_qualification_valid_to", table_name="mdm_organization_qualification")
    op.drop_index("idx_mdm_org_qualification_type", table_name="mdm_organization_qualification")
    op.drop_index("idx_mdm_org_qualification_org", table_name="mdm_organization_qualification")
    op.drop_table("mdm_organization_qualification")
    op.drop_column("manufacturer_vendor_role", "qualification_required")
    op.drop_column("manufacturer_vendor_role", "expired_date")
    op.drop_column("manufacturer_vendor_role", "effective_date")
    op.drop_index("idx_manufacturer_vendor_source_system", table_name="manufacturer_vendor_master")
    op.drop_column("manufacturer_vendor_master", "source_system")
    op.drop_column("manufacturer_vendor_master", "website")
    op.drop_column("manufacturer_vendor_master", "contact_phone")
    op.drop_column("manufacturer_vendor_master", "office_address")
    op.drop_column("manufacturer_vendor_master", "registered_address")
    op.drop_column("manufacturer_vendor_master", "former_name")
