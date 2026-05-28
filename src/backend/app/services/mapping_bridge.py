from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.tables import DictDepartment, DictMaterialSpec, SysMappingBridge
from app.services.tabular_io import load_tabular_rows


def normalize_category(raw: str) -> str:
    return raw.strip().upper()


def resolve_target_by_code(db: Session, category: str, target_code: str):
    if category == "DEPARTMENT":
        return db.scalar(select(DictDepartment).where(DictDepartment.dept_code == target_code))
    if category == "MATERIAL":
        return db.scalar(select(DictMaterialSpec).where(DictMaterialSpec.yb_code_27 == target_code))
    return None


def upsert_active_mapping(
    db: Session,
    *,
    category: str,
    source_system: str,
    source_key: str,
    source_desc: str | None,
    target_master_id,
    target_code: str | None,
    mapping_rule: str = "IMPORT",
    confidence: Decimal | None = Decimal("1.0000"),
) -> SysMappingBridge:
    normalized_category = normalize_category(category)
    db.execute(
        update(SysMappingBridge)
        .where(
            SysMappingBridge.category == normalized_category,
            SysMappingBridge.source_system == source_system,
            SysMappingBridge.source_key == source_key,
            SysMappingBridge.status == "ACTIVE",
        )
        .values(status="INACTIVE")
    )
    row = SysMappingBridge(
        category=normalized_category,
        source_system=source_system,
        source_key=source_key,
        source_desc=source_desc,
        target_master_id=target_master_id,
        target_code=target_code,
        mapping_rule=mapping_rule,
        confidence=confidence,
        status="ACTIVE",
        last_verified=datetime.now(timezone.utc),
    )
    db.add(row)
    return row


def import_spd_mapping_csv(
    db: Session,
    file_content: bytes,
    filename: str,
    batch_id: str,
) -> dict[str, Any]:
    _, rows = load_tabular_rows(file_content, filename, None)
    failures: list[dict[str, Any]] = []
    success_count = 0
    duplicate_count = 0
    seen: set[tuple[str, str, str]] = set()

    for line_no, raw in enumerate(rows, start=2):
        source_system = (raw.get("source_system") or "SPD").strip()
        category = normalize_category(raw.get("category") or "")
        source_key = (raw.get("source_key") or "").strip()
        source_desc = (raw.get("source_desc") or "").strip() or None
        target_code = (raw.get("target_code") or "").strip()
        if category not in {"DEPARTMENT", "MATERIAL"}:
            failures.append({"row": line_no, "field": "category", "message": "category must be department or material"})
            continue
        if not source_key:
            failures.append({"row": line_no, "field": "source_key", "message": "source_key is required"})
            continue
        if not target_code:
            failures.append({"row": line_no, "field": "target_code", "message": "target_code is required"})
            continue

        key = (source_system, category, source_key)
        if key in seen:
            duplicate_count += 1
            continue
        seen.add(key)

        target = resolve_target_by_code(db, category, target_code)
        if target is None:
            failures.append({"row": line_no, "field": "target_code", "message": "target master record not found"})
            continue
        target_id = target.dept_id if category == "DEPARTMENT" else target.material_id
        upsert_active_mapping(
            db,
            category=category,
            source_system=source_system,
            source_key=source_key,
            source_desc=source_desc,
            target_master_id=target_id,
            target_code=target_code,
        )
        success_count += 1

    return {
        "batch_id": batch_id,
        "source_type": "SPD_MAPPING_SAMPLE",
        "source_file_name": Path(filename).name,
        "success_count": success_count,
        "failed_count": len(failures),
        "duplicate_count": duplicate_count,
        "failures": failures,
    }
