from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src/backend"))

from app.db.session import get_session_factory
from app.services.mapping_bridge import import_spd_mapping_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Import H-UDMP SPD mapping sample CSV.")
    parser.add_argument(
        "--file",
        default="data/samples/H-UDMP-SAMPLE-SPD-MAPPINGS-v1.0.csv",
        help="Path to SPD mapping sample CSV relative to repository root.",
    )
    parser.add_argument("--batch-id", default="SPD-SAMPLE-001")
    args = parser.parse_args()

    path = (REPO_ROOT / args.file).resolve()
    content = path.read_bytes()

    SessionLocal = get_session_factory()
    with SessionLocal() as db:
        report = import_spd_mapping_csv(db, content, path.name, args.batch_id)
        db.commit()
    print(report)


if __name__ == "__main__":
    main()
