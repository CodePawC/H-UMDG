from __future__ import annotations

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.services.import_tasks import safe_spool_segment


def _source_root() -> Path:
    root = get_settings().resolved_equipment_source_dir()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _metadata_path(batch_id: str) -> Path:
    return _source_root() / safe_spool_segment(batch_id) / "metadata.json"


def save_equipment_source_file(
    *,
    batch_id: str,
    filename: str,
    content: bytes,
    source_type: str,
    source_system: str,
    imported_by: str | None = None,
    import_reason: str | None = None,
    extra_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    batch_dir = _source_root() / safe_spool_segment(batch_id)
    batch_dir.mkdir(parents=True, exist_ok=True)
    stored_name = safe_spool_segment(Path(filename).name or "equipment-source")
    file_path = batch_dir / stored_name
    file_path.write_bytes(content)
    metadata = {
        "batch_id": batch_id,
        "source_type": source_type,
        "source_system": source_system,
        "source_file_name": Path(filename).name or "equipment-source",
        "stored_file_name": stored_name,
        "source_file_size_bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "imported_by": imported_by,
        "import_reason": import_reason,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    if extra_metadata:
        metadata.update({key: value for key, value in extra_metadata.items() if value is not None})
    _metadata_path(batch_id).write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def list_equipment_source_files() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for metadata_file in _source_root().glob("*/metadata.json"):
        try:
            metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(metadata, dict):
            items.append(metadata)
    return sorted(items, key=lambda item: str(item.get("saved_at") or ""), reverse=True)


def equipment_source_file_path(batch_id: str) -> tuple[Path, dict[str, Any]]:
    metadata_file = _metadata_path(batch_id)
    if not metadata_file.exists():
        raise FileNotFoundError(batch_id)
    metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    if not isinstance(metadata, dict):
        raise FileNotFoundError(batch_id)
    file_path = metadata_file.parent / safe_spool_segment(str(metadata.get("stored_file_name") or ""))
    root = _source_root()
    resolved = file_path.resolve()
    resolved.relative_to(root)
    if not resolved.exists():
        raise FileNotFoundError(batch_id)
    return resolved, metadata


def equipment_source_file_path_from_record(
    *,
    batch_id: str,
    source_file_name: str | None,
    stored_file_name: str | None,
    metadata_payload: dict[str, Any] | None = None,
) -> tuple[Path, dict[str, Any]]:
    metadata = dict(metadata_payload or {})
    metadata.setdefault("batch_id", batch_id)
    metadata.setdefault("source_file_name", source_file_name)
    stored_name = safe_spool_segment(stored_file_name or str(metadata.get("stored_file_name") or ""))
    if not stored_name:
        raise FileNotFoundError(batch_id)
    file_path = (_source_root() / safe_spool_segment(batch_id) / stored_name).resolve()
    file_path.relative_to(_source_root())
    if not file_path.exists():
        raise FileNotFoundError(batch_id)
    metadata["stored_file_name"] = stored_name
    return file_path, metadata
