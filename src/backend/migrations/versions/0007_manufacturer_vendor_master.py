"""add manufacturer vendor master data

Revision ID: 0007_vendor_master
Revises: 0007_hmdm_equipment_dictionary
Create Date: 2026-05-20 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "0007_vendor_master"
down_revision = "0007_hmdm_equipment_dictionary"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())

    if "manufacturer_vendor_master" not in existing_tables:
        op.create_table(
            "manufacturer_vendor_master",
            sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("organization_code", sa.String(length=100), nullable=False),
            sa.Column("standard_name", sa.String(length=300), nullable=False),
            sa.Column("english_name", sa.String(length=300), nullable=True),
            sa.Column("short_name", sa.String(length=200), nullable=True),
            sa.Column("alias_names", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("unified_social_credit_code", sa.String(length=18), nullable=True),
            sa.Column("organization_type", sa.String(length=50), nullable=True),
            sa.Column("country_region", sa.String(length=100), nullable=True),
            sa.Column("province", sa.String(length=100), nullable=True),
            sa.Column("city", sa.String(length=100), nullable=True),
            sa.Column("address", sa.String(length=500), nullable=True),
            sa.Column("legal_representative", sa.String(length=100), nullable=True),
            sa.Column("status", sa.String(length=30), server_default=sa.text("'enabled'"), nullable=False),
            sa.Column("data_source", sa.String(length=100), nullable=True),
            sa.Column("quality_status", sa.String(length=50), server_default=sa.text("'normal'"), nullable=False),
            sa.Column("audit_status", sa.String(length=50), server_default=sa.text("'not_submitted'"), nullable=False),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organization_code"),
            sa.UniqueConstraint("standard_name"),
        )
        op.create_index(
            "uq_manufacturer_vendor_credit_code",
            "manufacturer_vendor_master",
            ["unified_social_credit_code"],
            unique=True,
            postgresql_where=sa.text("unified_social_credit_code IS NOT NULL"),
        )
        op.create_index("idx_manufacturer_vendor_name", "manufacturer_vendor_master", ["standard_name"], unique=False)
        op.create_index("idx_manufacturer_vendor_short_name", "manufacturer_vendor_master", ["short_name"], unique=False)
        op.create_index("idx_manufacturer_vendor_status", "manufacturer_vendor_master", ["status"], unique=False)
        op.create_index("idx_manufacturer_vendor_quality_status", "manufacturer_vendor_master", ["quality_status"], unique=False)
        op.create_index("idx_manufacturer_vendor_audit_status", "manufacturer_vendor_master", ["audit_status"], unique=False)

    if "manufacturer_vendor_role" not in existing_tables:
        op.create_table(
        "manufacturer_vendor_role",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_type", sa.String(length=50), nullable=False),
        sa.Column("role_name", sa.String(length=100), nullable=False),
        sa.Column("business_domain", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'enabled'"), nullable=False),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["manufacturer_vendor_master.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_manufacturer_vendor_role",
            "manufacturer_vendor_role",
            ["org_id", "role_type", "business_domain"],
            unique=True,
            postgresql_where=sa.text("status = 'enabled'"),
        )
        op.create_index("idx_manufacturer_vendor_role_type", "manufacturer_vendor_role", ["role_type"], unique=False)
        op.create_index("idx_manufacturer_vendor_role_domain", "manufacturer_vendor_role", ["business_domain"], unique=False)

    if "manufacturer_vendor_relation" not in existing_tables:
        op.create_table(
        "manufacturer_vendor_relation",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("parent_org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("child_org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relation_type", sa.String(length=50), nullable=False),
        sa.Column("relation_name", sa.String(length=100), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("expired_date", sa.Date(), nullable=True),
        sa.Column("evidence_file_url", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'enabled'"), nullable=False),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["child_org_id"], ["manufacturer_vendor_master.id"]),
        sa.ForeignKeyConstraint(["parent_org_id"], ["manufacturer_vendor_master.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("idx_manufacturer_vendor_relation_parent", "manufacturer_vendor_relation", ["parent_org_id"], unique=False)
        op.create_index("idx_manufacturer_vendor_relation_child", "manufacturer_vendor_relation", ["child_org_id"], unique=False)
        op.create_index("idx_manufacturer_vendor_relation_type", "manufacturer_vendor_relation", ["relation_type"], unique=False)

    if "manufacturer_vendor_external_mapping" not in existing_tables:
        op.create_table(
        "manufacturer_vendor_external_mapping",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("system_name", sa.String(length=50), nullable=False),
        sa.Column("external_code", sa.String(length=200), nullable=True),
        sa.Column("external_name", sa.String(length=300), nullable=True),
        sa.Column("is_current", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("audit_status", sa.String(length=50), server_default=sa.text("'approved'"), nullable=False),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["manufacturer_vendor_master.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_manufacturer_vendor_external_mapping_current",
            "manufacturer_vendor_external_mapping",
            ["system_name", "external_code"],
            unique=True,
            postgresql_where=sa.text("is_current = true AND external_code IS NOT NULL"),
        )
        op.create_index("idx_manufacturer_vendor_external_org", "manufacturer_vendor_external_mapping", ["org_id"], unique=False)
        op.create_index("idx_manufacturer_vendor_external_name", "manufacturer_vendor_external_mapping", ["external_name"], unique=False)

    if "manufacturer_vendor_candidate" not in existing_tables:
        op.create_table(
        "manufacturer_vendor_candidate",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_system", sa.String(length=50), nullable=False),
        sa.Column("source_table", sa.String(length=100), nullable=True),
        sa.Column("source_record_id", sa.String(length=200), nullable=True),
        sa.Column("raw_name", sa.String(length=300), nullable=False),
        sa.Column("normalized_name", sa.String(length=300), nullable=False),
        sa.Column("matched_org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("match_confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("match_status", sa.String(length=30), nullable=False),
        sa.Column("suggested_action", sa.String(length=30), nullable=False),
        sa.Column("reviewed_by", sa.String(length=100), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["matched_org_id"], ["manufacturer_vendor_master.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_manufacturer_vendor_candidate_source",
            "manufacturer_vendor_candidate",
            ["source_system", "source_table", "source_record_id", "normalized_name"],
            unique=True,
        )
        op.create_index("idx_manufacturer_vendor_candidate_status", "manufacturer_vendor_candidate", ["match_status", "created_at"], unique=False)
        op.create_index("idx_manufacturer_vendor_candidate_name", "manufacturer_vendor_candidate", ["normalized_name"], unique=False)
        op.create_index("idx_manufacturer_vendor_candidate_matched_org", "manufacturer_vendor_candidate", ["matched_org_id"], unique=False)

    material_columns = {column["name"] for column in inspector.get_columns("dict_material_specs")}
    if "manufacturer_org_id" not in material_columns:
        op.add_column("dict_material_specs", sa.Column("manufacturer_org_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            "fk_dict_material_specs_manufacturer_org",
            "dict_material_specs",
            "manufacturer_vendor_master",
            ["manufacturer_org_id"],
            ["id"],
        )
        op.create_index("idx_dict_material_specs_manufacturer_org", "dict_material_specs", ["manufacturer_org_id"], unique=False)
    if "registrant_org_id" not in material_columns:
        op.add_column("dict_material_specs", sa.Column("registrant_org_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            "fk_dict_material_specs_registrant_org",
            "dict_material_specs",
            "manufacturer_vendor_master",
            ["registrant_org_id"],
            ["id"],
        )
        op.create_index("idx_dict_material_specs_registrant_org", "dict_material_specs", ["registrant_org_id"], unique=False)
    if "filer_org_id" not in material_columns:
        op.add_column("dict_material_specs", sa.Column("filer_org_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            "fk_dict_material_specs_filer_org",
            "dict_material_specs",
            "manufacturer_vendor_master",
            ["filer_org_id"],
            ["id"],
        )
        op.create_index("idx_dict_material_specs_filer_org", "dict_material_specs", ["filer_org_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_dict_material_specs_filer_org", table_name="dict_material_specs")
    op.drop_index("idx_dict_material_specs_registrant_org", table_name="dict_material_specs")
    op.drop_index("idx_dict_material_specs_manufacturer_org", table_name="dict_material_specs")
    op.drop_constraint("fk_dict_material_specs_filer_org", "dict_material_specs", type_="foreignkey")
    op.drop_constraint("fk_dict_material_specs_registrant_org", "dict_material_specs", type_="foreignkey")
    op.drop_constraint("fk_dict_material_specs_manufacturer_org", "dict_material_specs", type_="foreignkey")
    op.drop_column("dict_material_specs", "filer_org_id")
    op.drop_column("dict_material_specs", "registrant_org_id")
    op.drop_column("dict_material_specs", "manufacturer_org_id")

    op.drop_index("idx_manufacturer_vendor_candidate_matched_org", table_name="manufacturer_vendor_candidate")
    op.drop_index("idx_manufacturer_vendor_candidate_name", table_name="manufacturer_vendor_candidate")
    op.drop_index("idx_manufacturer_vendor_candidate_status", table_name="manufacturer_vendor_candidate")
    op.drop_index("uq_manufacturer_vendor_candidate_source", table_name="manufacturer_vendor_candidate")
    op.drop_table("manufacturer_vendor_candidate")

    op.drop_index("idx_manufacturer_vendor_external_name", table_name="manufacturer_vendor_external_mapping")
    op.drop_index("idx_manufacturer_vendor_external_org", table_name="manufacturer_vendor_external_mapping")
    op.drop_index("uq_manufacturer_vendor_external_mapping_current", table_name="manufacturer_vendor_external_mapping")
    op.drop_table("manufacturer_vendor_external_mapping")

    op.drop_index("idx_manufacturer_vendor_relation_type", table_name="manufacturer_vendor_relation")
    op.drop_index("idx_manufacturer_vendor_relation_child", table_name="manufacturer_vendor_relation")
    op.drop_index("idx_manufacturer_vendor_relation_parent", table_name="manufacturer_vendor_relation")
    op.drop_table("manufacturer_vendor_relation")

    op.drop_index("idx_manufacturer_vendor_role_domain", table_name="manufacturer_vendor_role")
    op.drop_index("idx_manufacturer_vendor_role_type", table_name="manufacturer_vendor_role")
    op.drop_index("uq_manufacturer_vendor_role", table_name="manufacturer_vendor_role")
    op.drop_table("manufacturer_vendor_role")

    op.drop_index("idx_manufacturer_vendor_audit_status", table_name="manufacturer_vendor_master")
    op.drop_index("idx_manufacturer_vendor_quality_status", table_name="manufacturer_vendor_master")
    op.drop_index("idx_manufacturer_vendor_status", table_name="manufacturer_vendor_master")
    op.drop_index("idx_manufacturer_vendor_short_name", table_name="manufacturer_vendor_master")
    op.drop_index("idx_manufacturer_vendor_name", table_name="manufacturer_vendor_master")
    op.drop_index("uq_manufacturer_vendor_credit_code", table_name="manufacturer_vendor_master")
    op.drop_table("manufacturer_vendor_master")
