"""widen material master text fields

Revision ID: 0002_widen_material_text_fields
Revises: 0001
Create Date: 2026-05-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_widen_material_text_fields"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("dict_material_specs", "generic_name", type_=sa.String(length=500))
    op.alter_column("dict_material_specs", "brand_name", type_=sa.String(length=500))
    op.alter_column("dict_material_specs", "material_attr", type_=sa.String(length=200))
    op.alter_column("dict_material_specs", "feature", type_=sa.String(length=200))
    op.alter_column("dict_material_specs", "spec_value", type_=sa.String(length=500))
    op.alter_column("dict_material_specs", "spec_unit", type_=sa.String(length=50))
    op.alter_column("dict_material_specs", "model_detail", type_=sa.String(length=500))
    op.alter_column("dict_material_specs", "reg_number", type_=sa.String(length=200))
    op.alter_column("dict_material_specs", "insurance_generic_name", type_=sa.String(length=500))


def downgrade() -> None:
    op.alter_column("dict_material_specs", "insurance_generic_name", type_=sa.String(length=200))
    op.alter_column("dict_material_specs", "reg_number", type_=sa.String(length=100))
    op.alter_column("dict_material_specs", "model_detail", type_=sa.String(length=100))
    op.alter_column("dict_material_specs", "spec_unit", type_=sa.String(length=20))
    op.alter_column("dict_material_specs", "spec_value", type_=sa.String(length=50))
    op.alter_column("dict_material_specs", "feature", type_=sa.String(length=100))
    op.alter_column("dict_material_specs", "material_attr", type_=sa.String(length=100))
    op.alter_column("dict_material_specs", "brand_name", type_=sa.String(length=200))
    op.alter_column("dict_material_specs", "generic_name", type_=sa.String(length=200))
