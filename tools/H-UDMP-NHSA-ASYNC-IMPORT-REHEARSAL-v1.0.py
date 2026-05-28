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
TERMINAL_STATUSES = {"COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"}


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


def load_json(response: httpx.Response) -> dict[str, Any]:
    try:
        return response.json()
    except json.JSONDecodeError:
        return {"success": False, "code": "NON_JSON_RESPONSE", "message": response.text}


def submit_import_task(
    client: httpx.Client,
    *,
    path: Path,
    source_type: str,
    batch_id: str,
    source_system: str,
    sheet_name: str,
) -> dict[str, Any]:
    started = time.perf_counter()
    with path.open("rb") as fh:
        response = client.post(
            "/api/v1/import-tasks/materials",
            data={
                "source_system": source_system,
                "source_tx_id": batch_id,
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
    return {
        "http_status": response.status_code,
        "elapsed_ms": round(elapsed_ms, 2),
        "ok": response.is_success,
        "response": load_json(response),
    }


def poll_import_task(
    client: httpx.Client,
    *,
    batch_id: str,
    poll_interval: float,
    task_timeout: float,
) -> dict[str, Any]:
    started = time.perf_counter()
    snapshots: list[dict[str, Any]] = []
    latest: dict[str, Any] | None = None

    while True:
        response = client.get(f"/api/v1/import-tasks/{batch_id}")
        payload = load_json(response)
        data = payload.get("data") or {}
        latest = {
            "http_status": response.status_code,
            "ok": response.is_success,
            "elapsed_since_submit_ms": round((time.perf_counter() - started) * 1000, 2),
            "payload": payload,
        }
        snapshots.append(
            {
                "elapsed_ms": latest["elapsed_since_submit_ms"],
                "status": data.get("status"),
                "progress_percent": data.get("progress_percent"),
                "source_row_count": data.get("source_row_count"),
                "success_count": data.get("success_count"),
                "failed_count": data.get("failed_count"),
                "skipped_duplicate_count": data.get("skipped_duplicate_count"),
            }
        )
        if data.get("status") in TERMINAL_STATUSES:
            break
        if (time.perf_counter() - started) > task_timeout:
            latest["timeout"] = True
            break
        time.sleep(poll_interval)

    return {"latest": latest, "snapshots": snapshots}


def fetch_failures(client: httpx.Client, batch_id: str, page_size: int = 200) -> dict[str, Any]:
    response = client.get(f"/api/v1/import-tasks/{batch_id}/failures", params={"page": 1, "page_size": page_size})
    return {"http_status": response.status_code, "ok": response.is_success, "response": load_json(response)}


def summarize(result: dict[str, Any]) -> dict[str, Any]:
    items = result["imports"]
    dry_run_items = [item for item in items if item.get("terminal_status") == "DRY_RUN"]
    submitted = [item for item in items if item.get("submit", {}).get("ok")]
    terminal_items = [item for item in items if item.get("terminal_status") in TERMINAL_STATUSES]
    completed = [item for item in items if item.get("terminal_status") == "COMPLETED"]
    completed_with_errors = [item for item in items if item.get("terminal_status") == "COMPLETED_WITH_ERRORS"]
    failed_statuses = {"FAILED", "SUBMIT_FAILED", "SCRIPT_ERROR"}
    failed = [
        item
        for item in items
        if item.get("terminal_status") in failed_statuses
        or ((item.get("poll") or {}).get("latest") or {}).get("timeout")
        or (item.get("submit") is not None and not item.get("submit", {}).get("ok"))
    ]

    source_rows = 0
    success_count = 0
    failed_count = 0
    skipped_duplicates = 0
    duplicate_count = 0
    for item in terminal_items:
        data = item.get("final_task") or {}
        source_rows += int(data.get("source_row_count") or 0)
        success_count += int(data.get("success_count") or 0)
        failed_count += int(data.get("failed_count") or 0)
        skipped_duplicates += int(data.get("skipped_duplicate_count") or 0)
        duplicate_count += int(data.get("duplicate_count") or 0)

    return {
        "planned_file_count": result["planned_file_count"],
        "dry_run_count": len(dry_run_items),
        "submitted_count": len(submitted),
        "terminal_count": len(terminal_items),
        "completed_count": len(completed),
        "completed_with_errors_count": len(completed_with_errors),
        "failed_file_count": len(failed),
        "timeout_file_count": len(
            [item for item in items if ((item.get("poll") or {}).get("latest") or {}).get("timeout")]
        ),
        "source_row_count": source_rows,
        "success_count": success_count,
        "failed_row_count": failed_count,
        "skipped_duplicate_count": skipped_duplicates,
        "duplicate_count": duplicate_count,
    }


def write_reports(result: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    result["summary"] = summarize(result)
    run_id = result["run_id"]
    json_path = output_dir / f"H-UDMP-NHSA-ASYNC-IMPORT-REHEARSAL-{run_id}.json"
    md_path = output_dir / f"H-UDMP-NHSA-ASYNC-IMPORT-REHEARSAL-{run_id}.md"
    result["report_json"] = json_path.name
    result["report_md"] = md_path.name
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# H-UDMP NHSA Async Import Rehearsal",
        "",
        f"> Run ID: `{run_id}`  ",
        f"> Timestamp: `{result['timestamp']}`  ",
        f"> Environment: `{result['environment_name']}`  ",
        f"> API Base URL: `{result['api_base_url']}`  ",
        f"> Source Directory: `{result['source_dir']}`  ",
        f"> Candidate Version: `{result['candidate_version'] or 'TBD'}`  ",
        f"> Commit SHA: `{result['commit_sha'] or 'TBD'}`  ",
        f"> Evidence Owner: `{result['evidence_owner'] or 'TBD'}`  ",
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
            "| # | Source Type | File | Size | Batch ID | Status | Progress | Source Rows | Success | Failed | Duplicates | Skipped Duplicates | Failures Captured |",
            "|---:|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for idx, item in enumerate(result["imports"], start=1):
        data = item.get("final_task") or {}
        failure_page = ((item.get("failures") or {}).get("response") or {}).get("data") or {}
        failure_total = (failure_page.get("page") or {}).get("total", 0)
        lines.append(
            f"| {idx} | `{item.get('source_type')}` | `{item.get('file_name')}` | {item.get('file_size_bytes')} | "
            f"`{item.get('batch_id')}` | `{item.get('terminal_status') or 'UNKNOWN'}` | "
            f"{data.get('progress_percent', 0)} | {data.get('source_row_count', 0)} | "
            f"{data.get('success_count', 0)} | {data.get('failed_count', 0)} | "
            f"{data.get('duplicate_count', 0)} | {data.get('skipped_duplicate_count', 0)} | {failure_total} |"
        )

    lines.extend(
        [
            "",
            "## Decision",
            "",
            "- `COMPLETED` files can be accepted as rehearsal evidence when counts match expectations.",
            "- `COMPLETED_WITH_ERRORS` files require failure-row review before UAT sign-off.",
            "- `FAILED` or timed-out files require a defect issue and rerun plan.",
            "",
            "## Raw JSON",
            "",
            f"See `{json_path.name}`.",
            "",
        ]
    )
    md_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Rehearse NHSA directory import through async import-task APIs.")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:8101")
    parser.add_argument("--api-key", default="change-me")
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--sheet-name", default="Query1")
    parser.add_argument("--output-dir", default="reports/performance")
    parser.add_argument("--source-system", default="NHSA_ASYNC_REHEARSAL")
    parser.add_argument("--poll-interval", type=float, default=5.0)
    parser.add_argument("--task-timeout", type=float, default=7200.0)
    parser.add_argument("--file-limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--environment-name", default="uat-target")
    parser.add_argument("--candidate-version", default="")
    parser.add_argument("--commit-sha", default="")
    parser.add_argument("--evidence-owner", default="")
    parser.add_argument("--environment-notes", default="")
    parser.add_argument("--include-local-paths", action="store_true")
    args = parser.parse_args()

    source_dir = Path(args.source_dir).expanduser()
    if not source_dir.exists():
        raise FileNotFoundError(source_dir)

    files: list[tuple[Path, str]] = []
    ignored: list[str] = []
    for path in sorted(source_dir.glob("*.xlsx"), key=file_order):
        source_type = classify(path)
        if source_type is None:
            ignored.append(evidence_path(path, source_dir, args.include_local_paths))
            continue
        files.append((path, source_type))
    if args.file_limit > 0:
        files = files[: args.file_limit]

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    result: dict[str, Any] = {
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_base_url": args.api_base_url,
        "environment_name": args.environment_name,
        "candidate_version": args.candidate_version,
        "commit_sha": args.commit_sha,
        "evidence_owner": args.evidence_owner,
        "environment_notes": args.environment_notes,
        "source_dir": str(source_dir) if args.include_local_paths else "<NHSA_SOURCE_DIR>",
        "sheet_name": args.sheet_name,
        "source_system": args.source_system,
        "planned_file_count": len(files),
        "ignored_files": ignored,
        "dry_run": args.dry_run,
        "imports": [],
    }
    output_dir = REPO_ROOT / args.output_dir

    if args.dry_run:
        result["imports"] = [
            {
                "file": evidence_path(path, source_dir, args.include_local_paths),
                "file_name": path.name,
                "file_size_bytes": path.stat().st_size,
                "source_type": source_type,
                "batch_id": f"NHSA-ASYNC-{run_id}-{index:02d}",
                "terminal_status": "DRY_RUN",
            }
            for index, (path, source_type) in enumerate(files, start=1)
        ]
        write_reports(result, output_dir)
        print(json.dumps({"report_json": result["report_json"], "report_md": result["report_md"]}, ensure_ascii=False))
        return

    headers = {"X-API-Key": args.api_key}
    with httpx.Client(base_url=args.api_base_url, headers=headers, timeout=args.task_timeout) as client:
        try:
            result["health"] = load_json(client.get("/health"))
        except Exception as exc:
            result["health"] = {"success": False, "code": "HEALTH_CHECK_FAILED", "message": repr(exc)}
        for index, (path, source_type) in enumerate(files, start=1):
            batch_id = f"NHSA-ASYNC-{run_id}-{index:02d}"
            print(f"[{index}/{len(files)}] submitting {path.name} as {source_type} ({batch_id})", flush=True)
            item: dict[str, Any] = {
                "file": evidence_path(path, source_dir, args.include_local_paths),
                "file_name": path.name,
                "file_size_bytes": path.stat().st_size,
                "source_type": source_type,
                "batch_id": batch_id,
            }
            try:
                item["submit"] = submit_import_task(
                    client,
                    path=path,
                    source_type=source_type,
                    batch_id=batch_id,
                    source_system=args.source_system,
                    sheet_name=args.sheet_name,
                )
                if item["submit"]["ok"]:
                    poll = poll_import_task(
                        client,
                        batch_id=batch_id,
                        poll_interval=args.poll_interval,
                        task_timeout=args.task_timeout,
                    )
                    item["poll"] = poll
                    latest_payload = ((poll.get("latest") or {}).get("payload") or {}).get("data") or {}
                    item["final_task"] = latest_payload
                    item["terminal_status"] = latest_payload.get("status")
                    if latest_payload.get("failed_count") or latest_payload.get("status") != "COMPLETED":
                        item["failures"] = fetch_failures(client, batch_id)
                else:
                    item["terminal_status"] = "SUBMIT_FAILED"
            except Exception as exc:
                item["terminal_status"] = "SCRIPT_ERROR"
                item["error"] = repr(exc)
            result["imports"].append(item)
            write_reports(result, output_dir)
            print(
                json.dumps(
                    {
                        "file": path.name,
                        "batch_id": batch_id,
                        "status": item.get("terminal_status"),
                        "source_row_count": (item.get("final_task") or {}).get("source_row_count"),
                        "success_count": (item.get("final_task") or {}).get("success_count"),
                        "failed_count": (item.get("final_task") or {}).get("failed_count"),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )

    write_reports(result, output_dir)
    print(json.dumps({"report_json": result["report_json"], "report_md": result["report_md"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
