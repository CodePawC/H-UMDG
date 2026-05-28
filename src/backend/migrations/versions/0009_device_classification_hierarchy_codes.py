"""split device classification hierarchy codes

Revision ID: 0009_device_hierarchy
Revises: 0008_equipment_dictionary
Create Date: 2026-05-21 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = "0009_device_hierarchy"
down_revision = "0008_equipment_dictionary"
branch_labels = None
depends_on = None


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    bind = op.get_bind()
    columns = {item["name"] for item in inspect(bind).get_columns(table)}
    if column.name not in columns:
        op.add_column(table, column)


def upgrade() -> None:
    _add_column_if_missing("ref_device_classification_catalog", sa.Column("major_category_no", sa.String(length=20), nullable=True))
    _add_column_if_missing("ref_device_classification_catalog", sa.Column("major_category_name", sa.String(length=200), nullable=True))
    _add_column_if_missing("ref_device_classification_catalog", sa.Column("level_1_category_no", sa.String(length=20), nullable=True))
    _add_column_if_missing("ref_device_classification_catalog", sa.Column("level_2_category_no", sa.String(length=20), nullable=True))
    op.get_bind().execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_ref_device_catalog_hierarchy "
            "ON ref_device_classification_catalog "
            "(major_category_no, level_1_category_no, level_2_category_no)"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("DROP INDEX IF EXISTS idx_ref_device_catalog_hierarchy"))
    columns = {item["name"] for item in inspect(bind).get_columns("ref_device_classification_catalog")}
    for column_name in ("level_2_category_no", "level_1_category_no", "major_category_name", "major_category_no"):
        if column_name in columns:
            op.drop_column("ref_device_classification_catalog", column_name)
