"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-05

"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.models.tables import Base

    bind = op.get_bind()
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    Base.metadata.create_all(
        bind=bind,
        tables=[
            table
            for table in Base.metadata.sorted_tables
            if table.name not in {"sys_import_batch", "sys_import_failure"}
        ],
    )


def downgrade() -> None:
    from app.models.tables import Base

    bind = op.get_bind()
    Base.metadata.drop_all(
        bind=bind,
        tables=[
            table
            for table in reversed(Base.metadata.sorted_tables)
            if table.name not in {"sys_import_batch", "sys_import_failure"}
        ],
    )
