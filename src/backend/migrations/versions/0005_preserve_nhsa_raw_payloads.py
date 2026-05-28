"""preserve nhsa raw payloads

Revision ID: 0005_preserve_nhsa_raw_payloads
Revises: 0004_widen_import_batch_status
Create Date: 2026-05-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "0005_preserve_nhsa_raw_payloads"
down_revision = "0004_widen_import_batch_status"
branch_labels = None
depends_on = None


TABLES = (
    "stg_nhsa_material_specs",
    "stg_nhsa_material_disabled",
    "stg_nhsa_material_transcode",
)


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    for table in TABLES:
        existing_columns = {column["name"] for column in inspector.get_columns(table)}
        if "raw_payload" in existing_columns:
            continue
        op.add_column(
            table,
            sa.Column(
                "raw_payload",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_column(table, "raw_payload")
