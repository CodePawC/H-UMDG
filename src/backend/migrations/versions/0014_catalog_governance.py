"""catalog correction governance

Revision ID: 0014_catalog_governance
Revises: 0013_staging_change_type
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = "0014_catalog_governance"
down_revision = "0013_staging_change_type"
branch_labels = None
depends_on = None


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    columns = {item["name"] for item in inspect(bind).get_columns(table_name)}
    if column.name not in columns:
        op.add_column(table_name, column)


def _create_index_if_missing(name: str, table_name: str, columns: list[str]) -> None:
    bind = op.get_bind()
    indexes = {item["name"] for item in inspect(bind).get_indexes(table_name)}
    if name not in indexes:
        op.create_index(name, table_name, columns)


def _create_table_if_missing(table_name: str, *columns: sa.Column, indexes: tuple[sa.Index, ...] = ()) -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table(table_name):
        op.create_table(table_name, *columns)
    for index in indexes:
        _create_index_if_missing(index.name, table_name, list(index.expressions))


def upgrade() -> None:
    _add_column_if_missing(
        "ref_device_classification_catalog",
        sa.Column("data_status", sa.String(length=30), nullable=False, server_default=text("'effective'")),
    )
    _add_column_if_missing("ref_device_classification_catalog", sa.Column("status_reason", sa.Text(), nullable=True))
    _add_column_if_missing(
        "ref_device_classification_catalog",
        sa.Column("hidden_in_tree", sa.Boolean(), nullable=False, server_default=text("false")),
    )
    _add_column_if_missing("ref_device_classification_catalog", sa.Column("merged_to_catalog_id", postgresql.UUID(as_uuid=True), nullable=True))
    _add_column_if_missing("ref_device_classification_catalog", sa.Column("corrected_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing(
        "ref_device_classification_catalog",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    _create_index_if_missing("idx_ref_device_catalog_status", "ref_device_classification_catalog", ["data_status", "hidden_in_tree"])

    _create_table_if_missing(
        "catalog_correction_order",
        sa.Column("correction_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
        sa.Column("correction_no", sa.String(length=80), nullable=False, unique=True),
        sa.Column("catalog_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ref_device_classification_catalog.catalog_id"), nullable=False),
        sa.Column("source_batch_id", sa.String(length=100), nullable=True),
        sa.Column("source_file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_file_hash", sa.String(length=128), nullable=True),
        sa.Column("source_position", sa.String(length=200), nullable=True),
        sa.Column("abnormal_type", sa.String(length=60), nullable=False),
        sa.Column("correction_action", sa.String(length=60), nullable=False),
        sa.Column("before_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("after_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("handling_note", sa.Text(), nullable=True),
        sa.Column("impact_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("hide_in_tree", sa.Boolean(), nullable=False, server_default=text("false")),
        sa.Column("need_review", sa.Boolean(), nullable=False, server_default=text("true")),
        sa.Column("attachment_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'[]'::jsonb")),
        sa.Column("applicant_user_id", sa.String(length=100), nullable=True),
        sa.Column("applicant_name", sa.String(length=100), nullable=True),
        sa.Column("reviewer_user_id", sa.String(length=100), nullable=True),
        sa.Column("reviewer_name", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=text("'submitted'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        indexes=(
            sa.Index("idx_catalog_correction_catalog", "catalog_id", "created_at"),
            sa.Index("idx_catalog_correction_status", "status", "created_at"),
            sa.Index("idx_catalog_correction_batch", "source_batch_id"),
        ),
    )
    _create_table_if_missing(
        "catalog_correction_log",
        sa.Column("log_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
        sa.Column("correction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("catalog_correction_order.correction_id"), nullable=False),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("operator_user_id", sa.String(length=100), nullable=True),
        sa.Column("operator_name", sa.String(length=100), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        indexes=(sa.Index("idx_catalog_correction_log_order", "correction_id", "created_at"),),
    )
    _create_table_if_missing(
        "catalog_change_history",
        sa.Column("history_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
        sa.Column("catalog_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ref_device_classification_catalog.catalog_id"), nullable=False),
        sa.Column("correction_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("change_type", sa.String(length=60), nullable=False),
        sa.Column("before_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("after_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("operator_name", sa.String(length=100), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        indexes=(sa.Index("idx_catalog_change_history_catalog", "catalog_id", "created_at"),),
    )
    _create_table_if_missing(
        "catalog_reference_relation",
        sa.Column("relation_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
        sa.Column("catalog_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ref_device_classification_catalog.catalog_id"), nullable=False),
        sa.Column("reference_type", sa.String(length=60), nullable=False),
        sa.Column("reference_table", sa.String(length=120), nullable=True),
        sa.Column("reference_id", sa.String(length=120), nullable=True),
        sa.Column("reference_name", sa.String(length=300), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        indexes=(sa.Index("idx_catalog_reference_relation_catalog", "catalog_id", "reference_type", "status"),),
    )
    _create_table_if_missing(
        "import_validation_rule",
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
        sa.Column("rule_code", sa.String(length=100), nullable=False, unique=True),
        sa.Column("rule_name", sa.String(length=200), nullable=False),
        sa.Column("source_type", sa.String(length=80), nullable=False),
        sa.Column("severity", sa.String(length=30), nullable=False, server_default=text("'warning'")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=text("true")),
        sa.Column("rule_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        indexes=(sa.Index("idx_import_validation_rule_type", "source_type", "enabled"),),
    )
    _create_table_if_missing(
        "import_validation_issue",
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
        sa.Column("batch_id", sa.String(length=100), nullable=False),
        sa.Column("catalog_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rule_code", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.String(length=30), nullable=False),
        sa.Column("issue_type", sa.String(length=80), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source_position", sa.String(length=200), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=text("'open'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        indexes=(
            sa.Index("idx_import_validation_issue_batch", "batch_id", "status"),
            sa.Index("idx_import_validation_issue_catalog", "catalog_id"),
        ),
    )


def downgrade() -> None:
    for table_name in (
        "import_validation_issue",
        "import_validation_rule",
        "catalog_reference_relation",
        "catalog_change_history",
        "catalog_correction_log",
        "catalog_correction_order",
    ):
        if inspect(op.get_bind()).has_table(table_name):
            op.drop_table(table_name)
