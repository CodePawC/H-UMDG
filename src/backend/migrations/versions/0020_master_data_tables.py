"""master data postgres migration — space_locations / registration_certificates / udis / equipment_brand_models / standard_equipment

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-04

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS "mdm"')

    op.create_table(
        "space_location",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mdm.space_location.id", ondelete="SET NULL"), nullable=True),
        sa.Column("short_name", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("attributes", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="mdm",
    )
    op.create_index("idx_space_location_code", "space_location", ["code"], schema="mdm")
    op.create_index("idx_space_location_type_status", "space_location", ["type", "status"], schema="mdm")

    op.create_table(
        "registration_certificate",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("registration_no", sa.String(100), nullable=False),
        sa.Column("product_name", sa.String(300), nullable=False),
        sa.Column("generic_name", sa.String(200), nullable=True),
        sa.Column("brand", sa.String(200), nullable=True),
        sa.Column("model", sa.String(200), nullable=True),
        sa.Column("holder_name", sa.String(200), nullable=True),
        sa.Column("valid_to", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("attributes", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="mdm",
    )
    op.create_index("idx_reg_cert_no", "registration_certificate", ["registration_no"], schema="mdm")

    op.create_table(
        "udi",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("di", sa.String(100), nullable=False),
        sa.Column("product_name", sa.String(300), nullable=False),
        sa.Column("generic_name", sa.String(200), nullable=True),
        sa.Column("brand", sa.String(200), nullable=True),
        sa.Column("model", sa.String(200), nullable=True),
        sa.Column("registration_no", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("attributes", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="mdm",
    )
    op.create_index("idx_udi_di", "udi", ["di"], schema="mdm")

    op.create_table(
        "equipment_brand_model",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(100), nullable=True),
        sa.Column("brand", sa.String(200), nullable=False),
        sa.Column("model", sa.String(200), nullable=False),
        sa.Column("generic_name", sa.String(200), nullable=False),
        sa.Column("standard_name", sa.String(200), nullable=True),
        sa.Column("manufacturer_name", sa.String(200), nullable=True),
        sa.Column("registration_no", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("attributes", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="mdm",
    )
    op.create_index("idx_brand_model_code", "equipment_brand_model", ["code"], schema="mdm")

    op.create_table(
        "standard_equipment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("generic_name", sa.String(200), nullable=False),
        sa.Column("category_code", sa.String(100), nullable=True),
        sa.Column("category_name", sa.String(200), nullable=True),
        sa.Column("management_class", sa.String(20), nullable=True),
        sa.Column("brand", sa.String(200), nullable=True),
        sa.Column("model", sa.String(200), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("attributes", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="mdm",
    )
    op.create_index("idx_std_equip_code", "standard_equipment", ["code"], schema="mdm")


def downgrade() -> None:
    op.drop_table("standard_equipment", schema="mdm")
    op.drop_table("equipment_brand_model", schema="mdm")
    op.drop_table("udi", schema="mdm")
    op.drop_table("registration_certificate", schema="mdm")
    op.drop_table("space_location", schema="mdm")
