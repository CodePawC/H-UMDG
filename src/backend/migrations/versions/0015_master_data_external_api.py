"""master data external api clients

Revision ID: 0015_master_data_external_api
Revises: 0014_catalog_governance
Create Date: 2026-05-25 09:30:00.000000
"""

from __future__ import annotations

import hashlib

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = "0015_master_data_external_api"
down_revision = "0014_catalog_governance"
branch_labels = None
depends_on = None


DEFAULT_CLIENTS = [
    ("HOSPITAL_DATA_BUS", "医院数据总线", "hudmp-dbus-dev-20260525"),
    ("EQUIPMENT_OS", "医学装备运营平台", "hudmp-equipment-os-dev-20260525"),
    ("HIS", "HIS系统", "hudmp-his-dev-20260525"),
    ("SPD", "SPD系统", "hudmp-spd-dev-20260525"),
    ("MEDICAL_INSURANCE", "医保接口平台", "hudmp-mi-dev-20260525"),
]
DEFAULT_SCOPES = ["md:device-classification:read", "md:device-classification:tree", "md:device-classification:changes"]


def _create_index_if_missing(name: str, table_name: str, columns: list[str]) -> None:
    bind = op.get_bind()
    indexes = {item["name"] for item in inspect(bind).get_indexes(table_name)}
    if name not in indexes:
        op.create_index(name, table_name, columns)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("api_client"):
        op.create_table(
            "api_client",
            sa.Column("client_id", sa.String(length=80), nullable=False),
            sa.Column("client_name", sa.String(length=200), nullable=False),
            sa.Column("api_key_hash", sa.String(length=128), nullable=False),
            sa.Column("allowed_scopes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'[]'::jsonb")),
            sa.Column("status", sa.String(length=30), nullable=False, server_default=text("'active'")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("client_id"),
            sa.UniqueConstraint("api_key_hash"),
        )
    _create_index_if_missing("idx_api_client_status", "api_client", ["status"])
    _create_index_if_missing("idx_api_client_key_hash", "api_client", ["api_key_hash"])

    if not inspector.has_table("api_call_log"):
        op.create_table(
            "api_call_log",
            sa.Column("log_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
            sa.Column("trace_id", sa.String(length=80), nullable=False),
            sa.Column("client_id", sa.String(length=80), nullable=True),
            sa.Column("endpoint", sa.String(length=300), nullable=False),
            sa.Column("method", sa.String(length=20), nullable=False),
            sa.Column("query_params", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=text("'{}'::jsonb")),
            sa.Column("status_code", sa.Integer(), nullable=False),
            sa.Column("success", sa.Boolean(), nullable=False),
            sa.Column("duration_ms", sa.Integer(), nullable=False, server_default=text("0")),
            sa.Column("result_count", sa.Integer(), nullable=True),
            sa.Column("client_ip", sa.String(length=100), nullable=True),
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column("called_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("error_message", sa.Text(), nullable=True),
        )
    _create_index_if_missing("idx_api_call_log_trace", "api_call_log", ["trace_id"])
    _create_index_if_missing("idx_api_call_log_client", "api_call_log", ["client_id", "called_at"])
    _create_index_if_missing("idx_api_call_log_endpoint", "api_call_log", ["endpoint", "called_at"])

    for client_id, client_name, api_key in DEFAULT_CLIENTS:
        api_key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
        bind.execute(
            text(
                """
                INSERT INTO api_client (client_id, client_name, api_key_hash, allowed_scopes, status)
                VALUES (:client_id, :client_name, :api_key_hash, CAST(:allowed_scopes AS jsonb), 'active')
                ON CONFLICT (client_id) DO UPDATE
                SET client_name = EXCLUDED.client_name,
                    api_key_hash = EXCLUDED.api_key_hash,
                    allowed_scopes = EXCLUDED.allowed_scopes,
                    status = 'active'
                """
            ),
            {
                "client_id": client_id,
                "client_name": client_name,
                "api_key_hash": api_key_hash,
                "allowed_scopes": '["md:device-classification:read","md:device-classification:tree","md:device-classification:changes"]',
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table("api_call_log"):
        op.drop_table("api_call_log")
    if inspector.has_table("api_client"):
        op.drop_table("api_client")
