from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tables import SysExchangeLog
from app.services.hashing import file_sha256, payload_hash


@dataclass(frozen=True)
class ExchangeContext:
    trace_id: str
    source_system: str
    source_tx_id: str
    data_category: str
    payload_hash: str
    started_at: float


def build_file_payload_hash(content: bytes, metadata: dict[str, Any]) -> str:
    return payload_hash({"file_sha256": file_sha256(content), "metadata": metadata})


def start_exchange(
    db: Session,
    *,
    source_system: str,
    source_tx_id: str | None,
    data_category: str,
    request_payload: dict[str, Any],
) -> tuple[ExchangeContext | None, dict[str, Any] | None]:
    if not source_tx_id:
        return None, None

    digest = payload_hash(request_payload)
    existing = db.scalar(
        select(SysExchangeLog).where(
            SysExchangeLog.source_system == source_system,
            SysExchangeLog.source_tx_id == source_tx_id,
        )
    )
    if existing:
        if existing.payload_hash == digest:
            return None, existing.response_payload
        raise HTTPException(
            status_code=409,
            detail={
                "code": "IDEMPOTENCY_CONFLICT",
                "message": "source_system + source_tx_id already exists with different payload_hash",
                "trace_id": existing.trace_id,
            },
        )

    return (
        ExchangeContext(
            trace_id=str(uuid.uuid4()),
            source_system=source_system,
            source_tx_id=source_tx_id,
            data_category=data_category,
            payload_hash=digest,
            started_at=time.perf_counter(),
        ),
        None,
    )


def finish_exchange(
    db: Session,
    ctx: ExchangeContext | None,
    *,
    request_payload: dict[str, Any] | None,
    response_payload: dict[str, Any],
    status: str = "SUCCESS",
    error_code: str | None = None,
) -> None:
    if ctx is None:
        return
    elapsed_ms = int((time.perf_counter() - ctx.started_at) * 1000)
    db.add(
        SysExchangeLog(
            trace_id=ctx.trace_id,
            source_system=ctx.source_system,
            source_tx_id=ctx.source_tx_id,
            target_system="H-UMDG",
            data_category=ctx.data_category,
            request_payload=request_payload,
            response_payload=response_payload,
            payload_hash=ctx.payload_hash,
            status=status,
            error_code=error_code,
            processing_time_ms=elapsed_ms,
        )
    )
