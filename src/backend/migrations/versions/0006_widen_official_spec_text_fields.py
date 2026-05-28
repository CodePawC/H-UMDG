"""widen official spec text fields

Revision ID: 0006_widen_spec_text
Revises: 0005_preserve_nhsa_raw_payloads
Create Date: 2026-05-09 19:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0006_widen_spec_text"
down_revision = "0005_preserve_nhsa_raw_payloads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("dict_material_specs", "spec_value", type_=sa.Text())
    op.alter_column("dict_material_specs", "model_detail", type_=sa.Text())
    op.alter_column("stg_nhsa_material_specs", "spec", type_=sa.Text())
    op.alter_column("stg_nhsa_material_specs", "model", type_=sa.Text())


def downgrade() -> None:
    op.alter_column("stg_nhsa_material_specs", "model", type_=sa.String(length=200))
    op.alter_column("stg_nhsa_material_specs", "spec", type_=sa.String(length=500))
    op.alter_column("dict_material_specs", "model_detail", type_=sa.String(length=500))
    op.alter_column("dict_material_specs", "spec_value", type_=sa.String(length=500))
