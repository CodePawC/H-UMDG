"""add import batch tracking

Revision ID: 0003_import_batches
Revises: 0002_widen_material_text_fields
Create Date: 2026-05-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_import_batches"
down_revision = "0002_widen_material_text_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sys_import_batch",
        sa.Column("batch_id", sa.String(length=100), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_system", sa.String(length=50), nullable=False),
        sa.Column("source_file_name", sa.String(length=500), nullable=False),
        sa.Column("source_file_path", sa.String(length=1000), nullable=True),
        sa.Column("sheet_name", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("source_row_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("unique_key_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("success_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("failed_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("skipped_duplicate_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("duplicate_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("progress_percent", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("batch_id"),
    )
    op.create_index("idx_sys_import_batch_status", "sys_import_batch", ["status", "created_at"], unique=False)
    op.create_index("idx_sys_import_batch_source_type", "sys_import_batch", ["source_type", "created_at"], unique=False)

    op.create_table(
        "sys_import_failure",
        sa.Column("failure_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("batch_id", sa.String(length=100), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=True),
        sa.Column("field_name", sa.String(length=100), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["sys_import_batch.batch_id"]),
        sa.PrimaryKeyConstraint("failure_id"),
    )
    op.create_index("idx_sys_import_failure_batch", "sys_import_failure", ["batch_id"], unique=False)
    op.create_index("idx_sys_import_failure_field", "sys_import_failure", ["field_name"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_sys_import_failure_field", table_name="sys_import_failure")
    op.drop_index("idx_sys_import_failure_batch", table_name="sys_import_failure")
    op.drop_table("sys_import_failure")
    op.drop_index("idx_sys_import_batch_source_type", table_name="sys_import_batch")
    op.drop_index("idx_sys_import_batch_status", table_name="sys_import_batch")
    op.drop_table("sys_import_batch")
