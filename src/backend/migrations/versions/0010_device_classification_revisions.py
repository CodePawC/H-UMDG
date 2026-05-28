"""record device classification catalog revisions

Revision ID: 0010_device_revisions
Revises: 0009_device_hierarchy
Create Date: 2026-05-22 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = "0010_device_revisions"
down_revision = "0009_device_hierarchy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "ref_device_classification_revisions" not in inspect(bind).get_table_names():
        op.create_table(
            "ref_device_classification_revisions",
            sa.Column("revision_id", postgresql.UUID(as_uuid=True), server_default=text("gen_random_uuid()"), nullable=False),
            sa.Column("batch_id", sa.String(length=100), nullable=False),
            sa.Column("source_file_name", sa.String(length=500), nullable=False),
            sa.Column("source_table_index", sa.Integer(), nullable=False),
            sa.Column("row_number", sa.Integer(), nullable=False),
            sa.Column("change_type", sa.String(length=30), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("old_catalog_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("new_catalog_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("old_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("new_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("revision_id"),
        )
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_ref_device_revision_batch ON ref_device_classification_revisions (batch_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_ref_device_revision_new_catalog ON ref_device_classification_revisions (new_catalog_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_ref_device_revision_old_catalog ON ref_device_classification_revisions (old_catalog_id)"))
    bind.execute(text("CREATE INDEX IF NOT EXISTS idx_ref_device_revision_change_type ON ref_device_classification_revisions (change_type)"))


def downgrade() -> None:
    op.drop_table("ref_device_classification_revisions")
