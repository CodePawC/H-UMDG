from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.api.deps import DbSession, ExchangeViewAuth
from app.api.schemas import ApiEnvelope
from app.models.tables import SysExchangeLog

router = APIRouter()

SENSITIVE_KEYWORDS = ("api_key", "apikey", "authorization", "password", "secret", "token", "file", "raw_payload")
PAYLOAD_ALLOWLIST = {
    "batch_id",
    "category",
    "change_type",
    "data_category",
    "error_code",
    "failed_count",
    "mapping_rule",
    "message",
    "original_yb_code_27",
    "page",
    "page_size",
    "reg_number",
    "reviewer",
    "sheet_name",
    "source_desc",
    "source_file_name",
    "source_key",
    "source_row_count",
    "source_system",
    "source_tx_id",
    "source_type",
    "status",
    "success_count",
    "target_code",
    "total",
    "trace_id",
    "transcoded_count",
    "yb_code_27",
}


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(keyword in normalized for keyword in SENSITIVE_KEYWORDS)


def _collect_payload_summary(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {
            "payload_type": type(payload).__name__ if payload is not None else "null",
            "top_level_keys": [],
            "allowlisted_fields": {},
            "sensitive_keys_redacted": [],
        }

    allowlisted_fields: dict[str, Any] = {}
    sensitive_keys: list[str] = []
    nested_keys: list[str] = []

    def visit(value: Any, path: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{path}.{key}" if path else key
                if _is_sensitive_key(key):
                    sensitive_keys.append(child_path)
                    continue
                if key in PAYLOAD_ALLOWLIST and not isinstance(child, (dict, list)):
                    allowlisted_fields[child_path] = child
                elif child_path.count(".") < 3:
                    nested_keys.append(child_path)
                    visit(child, child_path)
        elif isinstance(value, list):
            for index, item in enumerate(value[:3]):
                visit(item, f"{path}[{index}]")

    visit(payload)
    return {
        "payload_type": "object",
        "top_level_keys": sorted(payload.keys()),
        "nested_key_sample": sorted(set(nested_keys))[:30],
        "allowlisted_fields": allowlisted_fields,
        "sensitive_keys_redacted": sorted(set(sensitive_keys)),
        "raw_payload_included": False,
    }


def _log_item(row: SysExchangeLog) -> dict[str, Any]:
    return {
        "log_id": row.log_id,
        "trace_id": row.trace_id,
        "source_system": row.source_system,
        "source_tx_id": row.source_tx_id,
        "data_category": row.data_category,
        "status": row.status,
        "error_code": row.error_code,
        "processing_time_ms": row.processing_time_ms,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/exchange/logs", response_model=ApiEnvelope)
def list_exchange_logs(
    _: ExchangeViewAuth,
    db: DbSession,
    source_system: str | None = None,
    status: str | None = None,
    data_category: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    page: int = 1,
    page_size: int = Query(20, alias="page_size"),
    size: int | None = None,
) -> ApiEnvelope:
    page = max(page, 1)
    effective_page_size = size if size is not None else page_size
    page_size = min(max(effective_page_size, 1), 100)
    stmt = select(SysExchangeLog)
    count_stmt = select(func.count()).select_from(SysExchangeLog)
    if source_system:
        stmt = stmt.where(SysExchangeLog.source_system == source_system)
        count_stmt = count_stmt.where(SysExchangeLog.source_system == source_system)
    if status:
        stmt = stmt.where(SysExchangeLog.status == status)
        count_stmt = count_stmt.where(SysExchangeLog.status == status)
    if data_category:
        stmt = stmt.where(SysExchangeLog.data_category == data_category)
        count_stmt = count_stmt.where(SysExchangeLog.data_category == data_category)
    if start_time:
        stmt = stmt.where(SysExchangeLog.created_at >= start_time)
        count_stmt = count_stmt.where(SysExchangeLog.created_at >= start_time)
    if end_time:
        stmt = stmt.where(SysExchangeLog.created_at <= end_time)
        count_stmt = count_stmt.where(SysExchangeLog.created_at <= end_time)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(SysExchangeLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return ApiEnvelope(
        data={
            "items": [_log_item(r) for r in rows],
            "page": {"page": page, "page_size": page_size, "total": total},
        }
    )


@router.get("/exchange/logs/{log_id}", response_model=ApiEnvelope)
def get_exchange_log_detail(_: ExchangeViewAuth, db: DbSession, log_id: int) -> ApiEnvelope:
    row = db.get(SysExchangeLog, log_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "EXCHANGE_LOG_NOT_FOUND"})
    return ApiEnvelope(
        data={
            **_log_item(row),
            "payload_policy": {
                "raw_request_payload_included": False,
                "raw_response_payload_included": False,
                "allowed_field_strategy": "allowlist_only",
                "sensitive_key_strategy": "keyword_redaction",
                "sensitive_keywords": list(SENSITIVE_KEYWORDS),
            },
            "request_payload_summary": _collect_payload_summary(row.request_payload),
            "response_payload_summary": _collect_payload_summary(row.response_payload),
        }
    )
