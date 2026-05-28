"""compatibility marker for H-MDM equipment dictionary baseline

Revision ID: 0007_hmdm_equipment_dictionary
Revises: 0006_widen_spec_text
Create Date: 2026-05-19 00:00:00.000000

This repository snapshot did not include the original equipment dictionary
migration file, but some local databases are already stamped with the revision.
Keeping this no-op marker lets Alembic continue from that baseline.
"""

from __future__ import annotations


revision = "0007_hmdm_equipment_dictionary"
down_revision = "0006_widen_spec_text"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
