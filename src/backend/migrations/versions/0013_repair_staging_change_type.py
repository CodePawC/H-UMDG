"""repair device import staging change type

Revision ID: 0013_staging_change_type
Revises: 0012_import_batch_repair
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0013_staging_change_type"
down_revision = "0012_import_batch_repair"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {item["name"] for item in inspect(bind).get_columns("device_classification_import_staging")}
    if "change_type" not in columns:
        op.add_column("device_classification_import_staging", sa.Column("change_type", sa.String(length=30), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = {item["name"] for item in inspect(bind).get_columns("device_classification_import_staging")}
    if "change_type" in columns:
        op.drop_column("device_classification_import_staging", "change_type")
