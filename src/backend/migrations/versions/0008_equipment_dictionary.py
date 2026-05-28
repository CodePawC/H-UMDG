"""add equipment dictionary tables

Revision ID: 0008_equipment_dictionary
Revises: 0007_vendor_master
Create Date: 2026-05-21 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = "0008_equipment_dictionary"
down_revision = "0007_vendor_master"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "dict_equipment_categories" not in existing_tables:
        op.create_table(
            "dict_equipment_categories",
            sa.Column("category_id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("category_code", sa.String(length=100), nullable=False),
            sa.Column("category_name", sa.String(length=200), nullable=False),
            sa.Column("parent_category_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("level_no", sa.Integer(), nullable=True),
            sa.Column("source_system", sa.String(length=100), nullable=True),
            sa.Column("source_batch_id", sa.String(length=100), nullable=True),
            sa.Column("status", sa.String(length=20), server_default=sa.text("'ACTIVE'"), nullable=False),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["parent_category_id"], ["dict_equipment_categories.category_id"]),
            sa.PrimaryKeyConstraint("category_id"),
            sa.UniqueConstraint("category_code"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_category_name ON dict_equipment_categories (category_name)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_category_parent ON dict_equipment_categories (parent_category_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_category_status ON dict_equipment_categories (status)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_category_batch ON dict_equipment_categories (source_batch_id)"))

    if "dict_equipment_standard_names" not in existing_tables:
        op.create_table(
            "dict_equipment_standard_names",
            sa.Column("standard_id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("standard_code", sa.String(length=100), nullable=False),
            sa.Column("standard_name", sa.String(length=300), nullable=False),
            sa.Column("alias_names", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("device_classification_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("common_manufacturer_org_ids", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("management_class", sa.String(length=20), nullable=True),
            sa.Column("status", sa.String(length=20), server_default=sa.text("'ACTIVE'"), nullable=False),
            sa.Column("source_system", sa.String(length=100), nullable=True),
            sa.Column("source_batch_id", sa.String(length=100), nullable=True),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["category_id"], ["dict_equipment_categories.category_id"]),
            sa.ForeignKeyConstraint(["device_classification_id"], ["ref_device_classification_catalog.catalog_id"]),
            sa.PrimaryKeyConstraint("standard_id"),
            sa.UniqueConstraint("standard_code"),
            sa.UniqueConstraint("standard_name"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_standard_name ON dict_equipment_standard_names (standard_name)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_standard_category ON dict_equipment_standard_names (category_id)"))
    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_equipment_standard_device_classification "
            "ON dict_equipment_standard_names (device_classification_id)"
        )
    )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_standard_status ON dict_equipment_standard_names (status)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_standard_batch ON dict_equipment_standard_names (source_batch_id)"))


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())
    if "dict_equipment_standard_names" in existing_tables:
        op.drop_table("dict_equipment_standard_names")
    if "dict_equipment_categories" in existing_tables:
        op.drop_table("dict_equipment_categories")
