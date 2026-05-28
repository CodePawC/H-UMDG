from __future__ import annotations

import argparse
import csv
import json
import re
import statistics
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]


def redact_local_paths(value: str) -> str:
    repo_pattern = re.escape(str(REPO_ROOT))
    return re.sub(repo_pattern, "<REPO_ROOT>", value, flags=re.IGNORECASE)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, round((pct / 100) * len(ordered)))
    return ordered[min(rank - 1, len(ordered) - 1)]


def summarize(values: list[float]) -> dict[str, float | int]:
    return {
        "count": len(values),
        "avg_ms": round(statistics.fmean(values), 2) if values else 0.0,
        "p50_ms": round(percentile(values, 50), 2),
        "p95_ms": round(percentile(values, 95), 2),
        "p99_ms": round(percentile(values, 99), 2),
        "max_ms": round(max(values), 2) if values else 0.0,
    }


def timed_call(fn: Callable[[], httpx.Response]) -> tuple[float, dict[str, Any]]:
    start = time.perf_counter()
    response = fn()
    elapsed_ms = (time.perf_counter() - start) * 1000
    try:
        payload = response.json()
    except json.JSONDecodeError:
        payload = {"raw": response.text}
    response.raise_for_status()
    return elapsed_ms, payload


def make_material_csv(path: Path, rows: int, stamp: str) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "yb_code_27",
                "yb_code_20",
                "generic_name",
                "brand_name",
                "material_attr",
                "spec_value",
                "spec_unit",
                "model_detail",
                "reg_number",
                "unit_pkg",
                "status",
            ]
        )
        for i in range(rows):
            suffix = f"{i:020d}"
            yb27 = f"P{stamp[-6:]}{suffix}"[:27]
            yb20 = yb27[:20]
            writer.writerow(
                [
                    yb27,
                    yb20,
                    f"性能测试耗材{i}",
                    "性能测试品牌",
                    "高分子",
                    str(20 + (i % 10)),
                    "mm",
                    f"PERF-{i}",
                    f"国械注准PERF{i:06d}",
                    "支",
                    "ACTIVE",
                ]
            )


def post_file(
    client: httpx.Client,
    path: str,
    file_path: Path,
    data: dict[str, str],
) -> httpx.Response:
    with file_path.open("rb") as fh:
        return client.post(path, data=data, files={"file": (file_path.name, fh, "text/csv")})


def seed_baseline_data(client: httpx.Client, stamp: str) -> dict[str, Any]:
    evidence: dict[str, Any] = {}
    dept_file = REPO_ROOT / "data/templates/H-UDMP-TEMPLATE-DEPARTMENTS-v1.0.csv"
    mat_file = REPO_ROOT / "data/templates/H-UDMP-TEMPLATE-MATERIALS-v1.0.csv"

    evidence["department_import"] = post_file(
        client,
        "/api/v1/departments/import",
        dept_file,
        {"source_system": "PERF", "source_tx_id": f"PERF-DEPT-{stamp}"},
    ).json()
    evidence["material_import"] = post_file(
        client,
        "/api/v1/materials/import",
        mat_file,
        {"source_system": "PERF", "source_tx_id": f"PERF-MAT-{stamp}", "source_type": "MVP_TEMPLATE"},
    ).json()

    try:
        subprocess.run(
            [sys.executable, str(REPO_ROOT / "tools/import_spd_sample.py"), "--batch-id", f"PERF-SPD-{stamp}"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        evidence["spd_seed"] = {"success": True}
    except subprocess.CalledProcessError as exc:
        evidence["spd_seed"] = {
            "success": False,
            "stderr": redact_local_paths(exc.stderr),
            "stdout": redact_local_paths(exc.stdout),
        }
    return evidence


def run_repeated(
    name: str,
    iterations: int,
    call: Callable[[int], httpx.Response],
) -> dict[str, Any]:
    timings: list[float] = []
    samples: list[dict[str, Any]] = []
    for i in range(iterations):
        elapsed, payload = timed_call(lambda i=i: call(i))
        timings.append(elapsed)
        if i in {0, iterations - 1}:
            samples.append(payload)
    return {"name": name, "summary": summarize(timings), "samples": samples}


def write_reports(result: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = result["run_id"]
    json_path = output_dir / f"H-UDMP-PERF-BASELINE-{stamp}.json"
    md_path = output_dir / f"H-UDMP-PERF-BASELINE-{stamp}.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# H-UDMP Performance Baseline Run",
        "",
        f"> Run ID: {stamp}  ",
        f"> Environment: `{result['environment_name']}`  ",
        f"> API Base URL: `{result['api_base_url']}`  ",
        f"> Timestamp: `{result['timestamp']}`  ",
        f"> Evidence Owner: `{result['evidence_owner'] or 'TBD'}`  ",
        "",
        "## Environment",
        "",
        "| Field | Value |",
        "|---|---|",
        f"| Environment name | `{result['environment_name']}` |",
        f"| Candidate version | `{result['candidate_version'] or 'TBD'}` |",
        f"| Commit SHA | `{result['commit_sha'] or 'TBD'}` |",
        f"| Notes | {result['environment_notes'] or 'TBD'} |",
        "",
        "## Summary",
        "",
        "| Scenario | Count | Avg ms | P50 ms | P95 ms | P99 ms | Max ms | Target | Result |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    for item in result["scenarios"]:
        summary = item["summary"]
        target = item.get("target_ms")
        passed = "PASS" if target is None or summary["p99_ms"] <= target else "REVIEW"
        lines.append(
            f"| {item['name']} | {summary['count']} | {summary['avg_ms']} | {summary['p50_ms']} | "
            f"{summary['p95_ms']} | {summary['p99_ms']} | {summary['max_ms']} | "
            f"{target or 'N/A'} | {passed} |"
        )
    lines.extend(
        [
            "",
            "## Import Result",
            "",
            "```json",
            json.dumps(result.get("material_1000_import"), ensure_ascii=False, indent=2),
            "```",
            "",
            "## Raw JSON",
            "",
            f"See `{json_path.name}`.",
            "",
        ]
    )
    md_path.write_text("\n".join(lines), encoding="utf-8")
    result["report_json"] = str(json_path)
    result["report_md"] = str(md_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run H-UDMP MVP performance baseline checks.")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:8101")
    parser.add_argument("--api-key", default="change-me")
    parser.add_argument("--iterations", type=int, default=50)
    parser.add_argument("--import-rows", type=int, default=1000)
    parser.add_argument("--output-dir", default="reports/performance")
    parser.add_argument("--skip-seed", action="store_true")
    parser.add_argument("--environment-name", default="local")
    parser.add_argument("--candidate-version", default="")
    parser.add_argument("--commit-sha", default="")
    parser.add_argument("--evidence-owner", default="")
    parser.add_argument("--environment-notes", default="")
    args = parser.parse_args()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    headers = {"X-API-Key": args.api_key}
    result: dict[str, Any] = {
        "run_id": stamp,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_base_url": args.api_base_url,
        "environment_name": args.environment_name,
        "candidate_version": args.candidate_version,
        "commit_sha": args.commit_sha,
        "evidence_owner": args.evidence_owner,
        "environment_notes": args.environment_notes,
        "iterations": args.iterations,
        "import_rows": args.import_rows,
        "scenarios": [],
    }

    with httpx.Client(base_url=args.api_base_url, headers=headers, timeout=60.0) as client:
        health_elapsed, health = timed_call(lambda: client.get("/health"))
        result["health"] = {"elapsed_ms": round(health_elapsed, 2), "response": health}

        if not args.skip_seed:
            result["seed"] = seed_baseline_data(client, stamp)

        result["scenarios"].append(
            run_repeated(
                "department_search_keyword",
                args.iterations,
                lambda _: client.get("/api/v1/departments/search", params={"keyword": "心外", "page_size": 20}),
            )
            | {"target_ms": 500}
        )
        result["scenarios"].append(
            run_repeated(
                "material_search_yb_code_27",
                args.iterations,
                lambda _: client.get(
                    "/api/v1/materials/search",
                    params={"yb_code_27": "123456789012345678901234567", "page_size": 20},
                ),
            )
            | {"target_ms": 500}
        )
        result["scenarios"].append(
            run_repeated(
                "mapping_resolve_spd_material",
                args.iterations,
                lambda i: client.post(
                    "/api/v1/mapping/resolve",
                    json={
                        "category": "material",
                        "source_system": "SPD",
                        "source_key": "SPD-MAT-001",
                        "source_desc": "一次性使用无菌导管 22mm",
                        "source_tx_id": f"PERF-MAP-{stamp}-{i}",
                    },
                ),
            )
            | {"target_ms": 500}
        )
        result["scenarios"].append(
            run_repeated(
                "exchange_log_query",
                max(10, args.iterations // 2),
                lambda _: client.get("/api/v1/exchange/logs", params={"source_system": "SPD", "page_size": 20}),
            )
            | {"target_ms": 500}
        )

        generated_dir = REPO_ROOT / "reports/performance/generated"
        generated_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            "w", delete=False, suffix=".csv", dir=generated_dir, encoding="utf-8", newline=""
        ) as tmp:
            import_file = Path(tmp.name)
        make_material_csv(import_file, args.import_rows, stamp)
        import_elapsed, import_payload = timed_call(
            lambda: post_file(
                client,
                "/api/v1/materials/import",
                import_file,
                {
                    "source_system": "PERF",
                    "source_tx_id": f"PERF-MAT-1000-{stamp}",
                    "source_type": "MVP_TEMPLATE",
                },
            )
        )
        result["material_1000_import"] = {
            "elapsed_ms": round(import_elapsed, 2),
            "response": import_payload,
        }

    write_reports(result, REPO_ROOT / args.output_dir)
    print(json.dumps({"report_json": result["report_json"], "report_md": result["report_md"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
