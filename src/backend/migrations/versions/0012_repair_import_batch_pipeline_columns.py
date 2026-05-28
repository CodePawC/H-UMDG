"""repair import batch pipeline columns

Revision ID: 0012_import_batch_repair
Revises: 0011_device_import_pipeline
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = "0012_import_batch_repair"
down_revision = "0011_device_import_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {item["name"] for item in inspect(bind).get_columns("sys_import_batch")}
    additions = [
        sa.Column("source_file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("import_mode", sa.String(length=50), nullable=True),
        sa.Column("import_reason", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("catalog_version", sa.String(length=100), nullable=True),
        sa.Column("operator_user_id", sa.String(length=100), nullable=True),
        sa.Column("operator_name", sa.String(length=100), nullable=True),
        sa.Column("operator_department", sa.String(length=100), nullable=True),
        sa.Column("operator_role", sa.String(length=100), nullable=True),
        sa.Column("client_ip", sa.String(length=100), nullable=True),
        sa.Column("user_agent", sa.String(length=1000), nullable=True),
        sa.Column("inserted_count", sa.Integer(), server_default=text("0"), nullable=False),
        sa.Column("updated_count", sa.Integer(), server_default=text("0"), nullable=False),
        sa.Column("deprecated_count", sa.Integer(), server_default=text("0"), nullable=False),
        sa.Column("rollback_status", sa.String(length=30), server_default=text("'NOT_REQUESTED'"), nullable=False),
    ]
    for column in additions:
        if column.name not in columns:
            op.add_column("sys_import_batch", column)

    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_sys_import_batch_source_file ON sys_import_batch (source_file_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_sys_import_batch_operator ON sys_import_batch (operator_user_id, created_at)"))


def downgrade() -> None:
    bind = op.get_bind()
    columns = {item["name"] for item in inspect(bind).get_columns("sys_import_batch")}
    bind.execute(text("DROP INDEX IF EXISTS idx_sys_import_batch_operator"))
    bind.execute(text("DROP INDEX IF EXISTS idx_sys_import_batch_source_file"))
    for column_name in (
        "rollback_status",
        "deprecated_count",
        "updated_count",
        "inserted_count",
        "user_agent",
        "client_ip",
        "operator_role",
        "operator_department",
        "operator_name",
        "operator_user_id",
        "catalog_version",
        "source_url",
        "import_reason",
        "import_mode",
        "source_file_id",
    ):
        if column_name in columns:
            op.drop_column("sys_import_batch", column_name)
