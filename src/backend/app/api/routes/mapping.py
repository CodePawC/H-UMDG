from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select, update

from app.api.deps import DbSession, MappingReviewAuth
from app.api.schemas import ApiEnvelope, MappingApproveRequest, MappingRejectRequest, MappingResolveRequest
from app.models.tables import DictDepartment, DictMaterialSpec, SysMappingBridge, SysMappingReviewTask
from app.services.exchange import finish_exchange, start_exchange
from app.services.mapping_bridge import normalize_category

router = APIRouter()


def _validate_mapping_category(category: str) -> None:
    if category not in {"DEPARTMENT", "MATERIAL"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_CATEGORY", "message": "category must be department or material"},
        )


def _ensure_pending_task(task: SysMappingReviewTask) -> None:
    if task.status != "PENDING":
        raise HTTPException(
            status_code=409,
            detail={"code": "TASK_ALREADY_REVIEWED", "message": f"task status is {task.status}"},
        )


def _resolve_target_master(db: DbSession, category: str, target_master_id):
    if category == "DEPARTMENT":
        target = db.get(DictDepartment, target_master_id)
        return target, target.dept_code if target else None
    if category == "MATERIAL":
        target = db.get(DictMaterialSpec, target_master_id)
        return target, target.yb_code_27 if target else None
    return None, None


@router.post("/mapping/resolve", response_model=ApiEnvelope)
def resolve_mapping(_: MappingReviewAuth, db: DbSession, payload: MappingResolveRequest) -> ApiEnvelope:
    request_summary = payload.model_dump()
    category = normalize_category(payload.category)
    _validate_mapping_category(category)
    exchange_ctx, previous = start_exchange(
        db,
        source_system=payload.source_system,
        source_tx_id=payload.source_tx_id,
        data_category="mapping",
        request_payload=request_summary,
    )
    if previous is not None:
        return ApiEnvelope(data=previous)

    row = db.scalar(
        select(SysMappingBridge).where(
            SysMappingBridge.category == category,
            SysMappingBridge.source_system == payload.source_system,
            SysMappingBridge.source_key == payload.source_key,
            SysMappingBridge.status == "ACTIVE",
        )
    )
    if row:
        result = {
            "status": "MATCHED",
            "bridge_id": str(row.bridge_id),
            "target_master_id": str(row.target_master_id),
            "target_code": row.target_code,
            "mapping_rule": row.mapping_rule,
            "confidence": float(row.confidence) if row.confidence is not None else None,
        }
        finish_exchange(db, exchange_ctx, request_payload=request_summary, response_payload=result)
        db.commit()
        return ApiEnvelope(
            data=result
        )

    task = db.scalar(
        select(SysMappingReviewTask).where(
            SysMappingReviewTask.category == category,
            SysMappingReviewTask.source_system == payload.source_system,
            SysMappingReviewTask.source_key == payload.source_key,
            SysMappingReviewTask.status == "PENDING",
        )
    )
    if task is None:
        task = SysMappingReviewTask(
            category=category,
            source_system=payload.source_system,
            source_key=payload.source_key,
            source_desc=payload.source_desc,
            candidate_json=[],
            status="PENDING",
        )
        db.add(task)
        db.flush()
    result = {
        "status": "PENDING_REVIEW",
        "task_id": str(task.task_id),
        "message": "No active mapping found; review task is available.",
    }
    finish_exchange(db, exchange_ctx, request_payload=request_summary, response_payload=result)
    db.commit()
    return ApiEnvelope(data=result)


@router.get("/mapping/review-tasks", response_model=ApiEnvelope)
def list_review_tasks(
    _: MappingReviewAuth,
    db: DbSession,
    status: str | None = "PENDING",
    source_system: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ApiEnvelope:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(SysMappingReviewTask)
    count_stmt = select(func.count()).select_from(SysMappingReviewTask)
    if status:
        stmt = stmt.where(SysMappingReviewTask.status == status)
        count_stmt = count_stmt.where(SysMappingReviewTask.status == status)
    if source_system:
        stmt = stmt.where(SysMappingReviewTask.source_system == source_system)
        count_stmt = count_stmt.where(SysMappingReviewTask.source_system == source_system)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(SysMappingReviewTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return ApiEnvelope(
        data={
            "items": [
                {
                    "task_id": str(r.task_id),
                    "category": r.category,
                    "source_system": r.source_system,
                    "source_key": r.source_key,
                    "source_desc": r.source_desc,
                    "candidate_json": r.candidate_json,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
            "page": {"page": page, "page_size": page_size, "total": total},
        }
    )


@router.post("/mapping/review-tasks/{task_id}/approve", response_model=ApiEnvelope)
def approve_review_task(
    _: MappingReviewAuth,
    db: DbSession,
    task_id: UUID,
    payload: MappingApproveRequest,
) -> ApiEnvelope:
    task = db.get(SysMappingReviewTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND"})
    _ensure_pending_task(task)
    target, default_target_code = _resolve_target_master(db, task.category, payload.target_master_id)
    if target is None:
        raise HTTPException(status_code=400, detail={"code": "TARGET_NOT_FOUND", "message": "target master not found"})

    db.execute(
        update(SysMappingBridge)
        .where(
            SysMappingBridge.category == task.category,
            SysMappingBridge.source_system == task.source_system,
            SysMappingBridge.source_key == task.source_key,
            SysMappingBridge.status == "ACTIVE",
        )
        .values(status="INACTIVE")
    )
    bridge = SysMappingBridge(
        category=task.category,
        source_system=task.source_system,
        source_key=task.source_key,
        source_desc=task.source_desc,
        target_master_id=payload.target_master_id,
        target_code=payload.target_code or default_target_code,
        mapping_rule=payload.mapping_rule,
        confidence=payload.confidence,
        status="ACTIVE",
        last_verified=datetime.now(timezone.utc),
    )
    db.add(bridge)
    task.status = "APPROVED"
    task.reviewer = payload.reviewer
    task.review_comment = payload.review_comment
    task.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return ApiEnvelope(data={"task_id": str(task.task_id), "bridge_id": str(bridge.bridge_id), "status": "APPROVED"})


@router.post("/mapping/review-tasks/{task_id}/reject", response_model=ApiEnvelope)
def reject_review_task(
    _: MappingReviewAuth,
    db: DbSession,
    task_id: UUID,
    payload: MappingRejectRequest,
) -> ApiEnvelope:
    task = db.get(SysMappingReviewTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND"})
    _ensure_pending_task(task)
    task.status = "REJECTED"
    task.reviewer = payload.reviewer
    task.review_comment = payload.review_comment
    task.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return ApiEnvelope(data={"task_id": str(task.task_id), "status": "REJECTED", "reviewer": payload.reviewer})
