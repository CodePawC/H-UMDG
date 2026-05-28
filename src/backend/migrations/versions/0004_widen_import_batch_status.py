"""widen import batch status

Revision ID: 0004_widen_import_batch_status
Revises: 0003_import_batches
Create Date: 2026-05-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0004_widen_import_batch_status"
down_revision = "0003_import_batches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("sys_import_batch", "status", type_=sa.String(length=30))


def downgrade() -> None:
    op.alter_column("sys_import_batch", "status", type_=sa.String(length=20))
