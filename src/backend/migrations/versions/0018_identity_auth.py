"""identity auth tables

Revision ID: 0018
Revises: 0017_business_partner
Create Date: 2026-06-04

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0018"
down_revision = "0017_business_partner"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS "identity"')
    op.create_table(
        "app_user",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(128)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="identity",
    )
    op.create_table(
        "user_role",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("identity.app_user.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_code", sa.String(64), primary_key=True),
        schema="identity",
    )


def downgrade() -> None:
    op.drop_table("user_role", schema="identity")
    op.drop_table("app_user", schema="identity")
