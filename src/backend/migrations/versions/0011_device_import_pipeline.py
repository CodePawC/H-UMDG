"""add device classification import pipeline tables

Revision ID: 0011_device_import_pipeline
Revises: 0010_device_revisions
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = "0011_device_import_pipeline"
down_revision = "0010_device_revisions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = set(inspect(bind).get_table_names())
    import_batch_columns = {item["name"] for item in inspect(bind).get_columns("sys_import_batch")}
    import_batch_additions = [
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
    for column in import_batch_additions:
        if column.name not in import_batch_columns:
            op.add_column("sys_import_batch", column)
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_sys_import_batch_source_file ON sys_import_batch (source_file_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_sys_import_batch_operator ON sys_import_batch (operator_user_id, created_at)"))

    if "device_classification_source_files" not in existing_tables:
        op.create_table(
            "device_classification_source_files",
            sa.Column("source_file_id", postgresql.UUID(as_uuid=True), server_default=text("gen_random_uuid()"), nullable=False),
            sa.Column("batch_id", sa.String(length=100), nullable=False),
            sa.Column("source_file_name", sa.String(length=500), nullable=False),
            sa.Column("stored_file_name", sa.String(length=500), nullable=True),
            sa.Column("source_file_size_bytes", sa.BigInteger(), nullable=True),
            sa.Column("sha256", sa.String(length=128), nullable=True),
            sa.Column("file_type", sa.String(length=50), nullable=True),
            sa.Column("source_system", sa.String(length=100), nullable=True),
            sa.Column("source_link", sa.String(length=1000), nullable=True),
            sa.Column("publish_date", sa.Date(), nullable=True),
            sa.Column("effective_date", sa.Date(), nullable=True),
            sa.Column("authoritative", sa.Boolean(), server_default=text("false"), nullable=False),
            sa.Column("metadata_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("source_file_id"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_source_file_batch ON device_classification_source_files (batch_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_source_file_sha256 ON device_classification_source_files (sha256)"))

    if "device_classification_import_staging" not in existing_tables:
        op.create_table(
            "device_classification_import_staging",
            sa.Column("staging_id", postgresql.UUID(as_uuid=True), server_default=text("gen_random_uuid()"), nullable=False),
            sa.Column("batch_id", sa.String(length=100), nullable=False),
            sa.Column("source_file_name", sa.String(length=500), nullable=False),
            sa.Column("row_number", sa.Integer(), nullable=False),
            sa.Column("catalog_code", sa.String(length=50), nullable=True),
            sa.Column("major_category_no", sa.String(length=20), nullable=True),
            sa.Column("major_category_name", sa.String(length=200), nullable=True),
            sa.Column("level_1_category_no", sa.String(length=20), nullable=True),
            sa.Column("level_1_category", sa.String(length=200), nullable=True),
            sa.Column("level_2_category_no", sa.String(length=20), nullable=True),
            sa.Column("level_2_category", sa.String(length=200), nullable=True),
            sa.Column("product_description", sa.Text(), nullable=True),
            sa.Column("intended_use", sa.Text(), nullable=True),
            sa.Column("product_examples", sa.Text(), nullable=True),
            sa.Column("management_class", sa.String(length=20), nullable=True),
            sa.Column("change_type", sa.String(length=30), nullable=True),
            sa.Column("parse_status", sa.String(length=30), nullable=False),
            sa.Column("issue_message", sa.Text(), nullable=True),
            sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("staging_id"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_import_staging_batch ON device_classification_import_staging (batch_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_import_staging_status ON device_classification_import_staging (batch_id, parse_status)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_import_staging_code ON device_classification_import_staging (catalog_code)"))
    if "device_classification_import_staging" in existing_tables:
        staging_columns = {item["name"] for item in inspect(bind).get_columns("device_classification_import_staging")}
        if "change_type" not in staging_columns:
            op.add_column("device_classification_import_staging", sa.Column("change_type", sa.String(length=30), nullable=True))

    if "device_classification_import_validation_results" not in existing_tables:
        op.create_table(
            "device_classification_import_validation_results",
            sa.Column("validation_id", postgresql.UUID(as_uuid=True), server_default=text("gen_random_uuid()"), nullable=False),
            sa.Column("batch_id", sa.String(length=100), nullable=False),
            sa.Column("validation_key", sa.String(length=100), nullable=False),
            sa.Column("validation_label", sa.String(length=200), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("issue_count", sa.Integer(), server_default=text("0"), nullable=False),
            sa.Column("result_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("validation_id"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_validation_batch ON device_classification_import_validation_results (batch_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_validation_status ON device_classification_import_validation_results (batch_id, status)"))

    if "device_classification_catalog_versions" not in existing_tables:
        op.create_table(
            "device_classification_catalog_versions",
            sa.Column("version_id", postgresql.UUID(as_uuid=True), server_default=text("gen_random_uuid()"), nullable=False),
            sa.Column("batch_id", sa.String(length=100), nullable=False),
            sa.Column("version_no", sa.String(length=100), nullable=False),
            sa.Column("source_file_name", sa.String(length=500), nullable=False),
            sa.Column("source_system", sa.String(length=100), nullable=True),
            sa.Column("publish_date", sa.Date(), nullable=True),
            sa.Column("effective_date", sa.Date(), nullable=True),
            sa.Column("item_count", sa.Integer(), server_default=text("0"), nullable=False),
            sa.Column("abnormal_count", sa.Integer(), server_default=text("0"), nullable=False),
            sa.Column("is_current", sa.Boolean(), server_default=text("false"), nullable=False),
            sa.Column("rollback_supported", sa.Boolean(), server_default=text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("version_id"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_catalog_version_batch ON device_classification_catalog_versions (batch_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_catalog_version_current ON device_classification_catalog_versions (is_current)"))

    if "device_classification_import_audit_logs" not in existing_tables:
        op.create_table(
            "device_classification_import_audit_logs",
            sa.Column("audit_id", postgresql.UUID(as_uuid=True), server_default=text("gen_random_uuid()"), nullable=False),
            sa.Column("batch_id", sa.String(length=100), nullable=False),
            sa.Column("action", sa.String(length=50), nullable=False),
            sa.Column("operator_name", sa.String(length=100), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("audit_id"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_import_audit_batch ON device_classification_import_audit_logs (batch_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_device_import_audit_action ON device_classification_import_audit_logs (action, created_at)"))


def downgrade() -> None:
    op.drop_table("device_classification_import_audit_logs")
    op.drop_table("device_classification_catalog_versions")
    op.drop_table("device_classification_import_validation_results")
    op.drop_table("device_classification_import_staging")
    op.drop_table("device_classification_source_files")
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
        op.drop_column("sys_import_batch", column_name)
