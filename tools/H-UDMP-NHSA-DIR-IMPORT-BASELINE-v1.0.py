from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]


def file_order(path: Path) -> tuple[int, str]:
    match = re.match(r"^(\d+)、", path.name)
    return (int(match.group(1)) if match else 9999, path.name)


def classify(path: Path) -> str | None:
    name = path.name
    if name.startswith("30、"):
        return "NHSA_DISABLED"
    if name.startswith("31、"):
        return "NHSA_TRANSCODE"
    if "全量规格型号信息" in name:
        return "NHSA_FULL_SPEC"
    return None


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
                "source_system": "NHSA_DIR_PERF",
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
    try:
        payload = response.json()
    except json.JSONDecodeError:
        payload = {"raw": response.text}
    return {
        "file": evidence_path(path, source_dir, include_local_paths),
        "file_name": path.name,
        "file_size_bytes": path.stat().st_size,
        "source_type": source_type,
        "source_tx_id": source_tx_id,
        "http_status": response.status_code,
        "elapsed_ms": round(elapsed_ms, 2),
        "ok": response.is_success,
        "response": payload,
    }


def summarize(result: dict[str, Any]) -> dict[str, Any]:
    imports = result["imports"]
    completed = [x for x in imports if x.get("ok")]
    failed = [x for x in imports if not x.get("ok")]
    source_rows = 0
    success_count = 0
    failed_count = 0
    skipped_duplicates = 0
    for item in completed:
        data = (item.get("response") or {}).get("data") or {}
        source_rows += int(data.get("source_row_count") or 0)
        success_count += int(data.get("success_count") or 0)
        failed_count += int(data.get("failed_count") or 0)
        skipped_duplicates += int(data.get("skipped_duplicate_count") or 0)
    total_elapsed_ms = sum(float(x.get("elapsed_ms") or 0) for x in imports)
    max_item = max(imports, key=lambda x: float(x.get("elapsed_ms") or 0), default={})
    return {
        "file_count": len(imports),
        "completed_count": len(completed),
        "failed_file_count": len(failed),
        "source_row_count": source_rows,
        "success_count": success_count,
        "failed_row_count": failed_count,
        "skipped_duplicate_count": skipped_duplicates,
        "total_elapsed_ms": round(total_elapsed_ms, 2),
        "max_single_file_elapsed_ms": max_item.get("elapsed_ms", 0),
        "max_single_file": max_item.get("file_name"),
        "immediate_async_required": total_elapsed_ms > 60000 or float(max_item.get("elapsed_ms") or 0) > 30000,
        "progress_api_recommended": total_elapsed_ms > 20000 or float(max_item.get("elapsed_ms") or 0) > 10000,
        "failure_recovery_recommended": True,
    }


def write_reports(result: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    result["summary"] = summarize(result)
    run_id = result["run_id"]
    json_path = output_dir / f"H-UDMP-NHSA-DIR-IMPORT-BASELINE-{run_id}.json"
    md_path = output_dir / f"H-UDMP-NHSA-DIR-IMPORT-BASELINE-{run_id}.md"
    result["report_json"] = json_path.name
    result["report_md"] = md_path.name
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# H-UDMP NHSA Directory Import Baseline",
        "",
        f"> Run ID: `{run_id}`  ",
        f"> Timestamp: `{result['timestamp']}`  ",
        f"> API Base URL: `{result['api_base_url']}`  ",
        f"> Source Directory: `{result['source_dir']}`  ",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "|---|---:|",
    ]
    for key, value in result["summary"].items():
        lines.append(f"| `{key}` | {value} |")
    lines.extend(
        [
            "",
            "## Per File Results",
            "",
            "| # | Source Type | File | Size | Source Rows | Success | Failed | Skipped Duplicates | HTTP | Elapsed ms |",
            "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for idx, item in enumerate(result["imports"], start=1):
        data = (item.get("response") or {}).get("data") or {}
        lines.append(
            f"| {idx} | `{item.get('source_type')}` | `{item.get('file_name')}` | {item.get('file_size_bytes')} | "
            f"{data.get('source_row_count', 0)} | {data.get('success_count', 0)} | "
            f"{data.get('failed_count', 0)} | {data.get('skipped_duplicate_count', 0)} | "
            f"{item.get('http_status')} | {item.get('elapsed_ms')} |"
        )
    lines.extend(
        [
            "",
            "## Decision",
            "",
            f"- Immediate async required: `{result['summary']['immediate_async_required']}`",
            f"- Progress API recommended: `{result['summary']['progress_api_recommended']}`",
            f"- Failure recovery recommended: `{result['summary']['failure_recovery_recommended']}`",
            "",
            "If total elapsed time or any single file exceeds thresholds, prioritize async import, progress query, and resumable failure handling before broad UAT.",
            "",
        ]
    )
    md_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run H-UDMP import baseline for a full NHSA directory.")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:8101")
    parser.add_argument("--api-key", default="change-me")
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--sheet-name", default="Query1")
    parser.add_argument("--output-dir", default="reports/performance")
    parser.add_argument("--timeout", type=float, default=7200.0)
    parser.add_argument("--include-local-paths", action="store_true")
    args = parser.parse_args()

    source_dir = Path(args.source_dir).expanduser()
    if not source_dir.exists():
        raise FileNotFoundError(source_dir)
    files = []
    ignored = []
    for path in sorted(source_dir.glob("*.xlsx"), key=file_order):
        source_type = classify(path)
        if source_type is None:
            ignored.append(evidence_path(path, source_dir, args.include_local_paths))
            continue
        files.append((path, source_type))

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    result: dict[str, Any] = {
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_base_url": args.api_base_url,
        "source_dir": str(source_dir) if args.include_local_paths else "<NHSA_SOURCE_DIR>",
        "sheet_name": args.sheet_name,
        "planned_file_count": len(files),
        "ignored_files": ignored,
        "imports": [],
    }
    output_dir = REPO_ROOT / args.output_dir
    headers = {"X-API-Key": args.api_key}

    with httpx.Client(base_url=args.api_base_url, headers=headers, timeout=args.timeout) as client:
        result["health"] = client.get("/health").json()
        for index, (path, source_type) in enumerate(files, start=1):
            print(f"[{index}/{len(files)}] importing {path.name} as {source_type}", flush=True)
            source_tx_id = f"NHSA-DIR-PERF-{run_id}-{index:02d}"
            try:
                item = timed_import(
                    client,
                    path=path,
                    source_dir=source_dir,
                    source_type=source_type,
                    source_tx_id=source_tx_id,
                    sheet_name=args.sheet_name,
                    include_local_paths=args.include_local_paths,
                )
            except Exception as exc:
                item = {
                    "file": evidence_path(path, source_dir, args.include_local_paths),
                    "file_name": path.name,
                    "file_size_bytes": path.stat().st_size,
                    "source_type": source_type,
                    "source_tx_id": source_tx_id,
                    "ok": False,
                    "error": repr(exc),
                }
            result["imports"].append(item)
            write_reports(result, output_dir)
            print(
                json.dumps(
                    {
                        "file": path.name,
                        "ok": item.get("ok"),
                        "elapsed_ms": item.get("elapsed_ms"),
                        "status": item.get("http_status"),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )

    write_reports(result, output_dir)
    print(json.dumps({"report_json": result["report_json"], "report_md": result["report_md"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
