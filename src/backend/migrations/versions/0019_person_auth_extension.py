"""person auth extension — DictPerson unified identity fields

Revision ID: 0019
Revises: 0018_identity_auth
Create Date: 2026-06-04

"""

from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dict_persons",
        sa.Column("password_hash", sa.String(255), nullable=True),
    )
    op.add_column(
        "dict_persons",
        sa.Column("employment_status", sa.String(20), nullable=False, server_default="ACTIVE"),
    )
    op.add_column(
        "dict_persons",
        sa.Column("onboard_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "dict_persons",
        sa.Column("offboard_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dict_persons", "password_hash")
    op.drop_column("dict_persons", "employment_status")
    op.drop_column("dict_persons", "onboard_date")
    op.drop_column("dict_persons", "offboard_date")
