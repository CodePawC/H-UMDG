from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_FULL_SPEC = "16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx"
DEFAULT_DISABLED = "30、停用表.xlsx"
DEFAULT_TRANSCODE = "31、转码表.xlsx"


def evidence_path(path: Path, source_dir: Path, include_local_paths: bool) -> str:
    if include_local_paths:
        return str(path)
    try:
        relative = path.relative_to(source_dir)
    except ValueError:
        relative = Path(path.name)
    return f"<NHSA_SOURCE_DIR>/{relative.as_posix()}"


def timed_import(
    client: httpx.Client,
    *,
    path: Path,
    source_dir: Path,
    source_type: str,
    source_tx_id: str,
    sheet_name: str,
    include_local_paths: bool,
) -> dict[str, Any]:
    started = time.perf_counter()
    with path.open("rb") as fh:
        response = client.post(
            "/api/v1/materials/import",
            data={
                "source_system": "NHSA_REAL_PERF",
                "source_tx_id": source_tx_id,
                "source_type": source_type,
                "sheet_name": sheet_name,
            },
            files={
                "file": (
                    path.name,
                    fh,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    elapsed_ms = (time.perf_counter() - started) * 1000
    payload = response.json()
    response.raise_for_status()
    return {
        "source_type": source_type,
        "file": evidence_path(path, source_dir, include_local_paths),
        "file_size_bytes": path.stat().st_size,
        "source_tx_id": source_tx_id,
        "elapsed_ms": round(elapsed_ms, 2),
        "response": payload,
    }


def evaluate(result: dict[str, Any]) -> dict[str, Any]:
    imports = result["imports"]
    full_ms = imports["nhsa_full_spec"]["elapsed_ms"]
    disabled_ms = imports["nhsa_disabled"]["elapsed_ms"]
    transcode_ms = imports["nhsa_transcode"]["elapsed_ms"]
    max_ms = max(full_ms, disabled_ms, transcode_ms)
    total_ms = full_ms + disabled_ms + transcode_ms

    immediate_async_required = max_ms > 30000 or total_ms > 60000
    progress_api_recommended = max_ms > 10000 or total_ms > 20000
    failure_recovery_recommended = True

    return {
        "max_single_import_ms": round(max_ms, 2),
        "total_import_ms": round(total_ms, 2),
        "immediate_async_required": immediate_async_required,
        "progress_api_recommended": progress_api_recommended,
        "failure_recovery_recommended": failure_recovery_recommended,
        "decision": (
            "Do not block MVP on async import; keep synchronous import for current observed NHSA files."
            if not immediate_async_required
            else "Prioritize async import before UAT because observed import time exceeds MVP threshold."
        ),
        "next_step": (
            "Design failure-row persistence and resumable batch records first; add async progress if larger categories or all-category imports are required."
            if not immediate_async_required
            else "Implement async import task API, progress query, and resumable failure handling."
        ),
    }


def write_report(result: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    run_id = result["run_id"]
    json_path = output_dir / f"H-UDMP-NHSA-REAL-IMPORT-BASELINE-{run_id}.json"
    md_path = output_dir / f"H-UDMP-NHSA-REAL-IMPORT-BASELINE-{run_id}.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# H-UDMP NHSA Real Import Baseline",
        "",
        f"> Run ID: `{run_id}`  ",
        f"> API Base URL: `{result['api_base_url']}`  ",
        f"> Timestamp: `{result['timestamp']}`  ",
        "",
        "## Import Timings",
        "",
        "| Source Type | File Size | Source Rows | Unique Keys | Skipped Duplicates | Success | Failed | Elapsed ms |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for item in result["imports"].values():
        data = item["response"].get("data") or {}
        lines.append(
            f"| `{item['source_type']}` | {item['file_size_bytes']} | "
            f"{data.get('source_row_count', 0)} | {data.get('unique_key_count', 0)} | "
            f"{data.get('skipped_duplicate_count', 0)} | {data.get('success_count', 0)} | "
            f"{data.get('failed_count', 0)} | {item['elapsed_ms']} |"
        )
    lines.extend(
        [
            "",
            "## Decision",
            "",
            f"- Max single import: `{result['evaluation']['max_single_import_ms']} ms`",
            f"- Total import time: `{result['evaluation']['total_import_ms']} ms`",
            f"- Immediate async required: `{result['evaluation']['immediate_async_required']}`",
            f"- Progress API recommended: `{result['evaluation']['progress_api_recommended']}`",
            f"- Failure recovery recommended: `{result['evaluation']['failure_recovery_recommended']}`",
            "",
            result["evaluation"]["decision"],
            "",
            "## Next Step",
            "",
            result["evaluation"]["next_step"],
            "",
            "## Raw JSON",
            "",
            f"See `{json_path.name}`.",
            "",
        ]
    )
    md_path.write_text("\n".join(lines), encoding="utf-8")
    result["report_json"] = json_path.name
    result["report_md"] = md_path.name
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run real NHSA source import baseline via H-UDMP API.")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:8101")
    parser.add_argument("--api-key", default="change-me")
    parser.add_argument("--nhsa-dir", default=os.environ.get("HUDMP_NHSA_DIR"))
    parser.add_argument("--full-spec-file", default=None)
    parser.add_argument("--disabled-file", default=None)
    parser.add_argument("--transcode-file", default=None)
    parser.add_argument("--sheet-name", default="Query1")
    parser.add_argument("--output-dir", default="reports/performance")
    parser.add_argument("--include-local-paths", action="store_true")
    args = parser.parse_args()

    nhsa_dir = Path(args.nhsa_dir).expanduser() if args.nhsa_dir else REPO_ROOT / "data/samples/external/nhsa"
    full_spec = Path(args.full_spec_file).expanduser() if args.full_spec_file else nhsa_dir / DEFAULT_FULL_SPEC
    disabled = Path(args.disabled_file).expanduser() if args.disabled_file else nhsa_dir / DEFAULT_DISABLED
    transcode = Path(args.transcode_file).expanduser() if args.transcode_file else nhsa_dir / DEFAULT_TRANSCODE

    for path in (full_spec, disabled, transcode):
        if not path.exists():
            raise FileNotFoundError(path)

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    result: dict[str, Any] = {
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_base_url": args.api_base_url,
        "sheet_name": args.sheet_name,
        "imports": {},
    }
    headers = {"X-API-Key": args.api_key}
    with httpx.Client(base_url=args.api_base_url, headers=headers, timeout=600.0) as client:
        result["health"] = client.get("/health").json()
        result["imports"]["nhsa_full_spec"] = timed_import(
            client,
            path=full_spec,
            source_dir=nhsa_dir,
            source_type="NHSA_FULL_SPEC",
            source_tx_id=f"NHSA-REAL-PERF-FULL-{run_id}",
            sheet_name=args.sheet_name,
            include_local_paths=args.include_local_paths,
        )
        result["imports"]["nhsa_disabled"] = timed_import(
            client,
            path=disabled,
            source_dir=nhsa_dir,
            source_type="NHSA_DISABLED",
            source_tx_id=f"NHSA-REAL-PERF-DISABLED-{run_id}",
            sheet_name=args.sheet_name,
            include_local_paths=args.include_local_paths,
        )
        result["imports"]["nhsa_transcode"] = timed_import(
            client,
            path=transcode,
            source_dir=nhsa_dir,
            source_type="NHSA_TRANSCODE",
            source_tx_id=f"NHSA-REAL-PERF-TRANSCODE-{run_id}",
            sheet_name=args.sheet_name,
            include_local_paths=args.include_local_paths,
        )

    result["evaluation"] = evaluate(result)
    write_report(result, REPO_ROOT / args.output_dir)
    print(json.dumps({"report_json": result["report_json"], "report_md": result["report_md"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
