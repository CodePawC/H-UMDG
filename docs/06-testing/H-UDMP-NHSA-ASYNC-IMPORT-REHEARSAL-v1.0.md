# H-UDMP NHSA Async Import Rehearsal Record

> Document ID: H-UDMP-NHSA-ASYNC-IMPORT-REHEARSAL
> Version: v1.0
> Status: Template
> Date: 2026-05-06
> Owner: H-UDMP Project Team
> Source: GitHub Issue #3, `H-UDMP-PERFORMANCE-BASELINE-v1.0.md`

## 1. Purpose

本文档用于记录 NHSA 全目录或大文件通过异步导入任务 API 的演练结果。演练目标是验证 `POST /api/v1/import-tasks/materials`、任务状态查询、失败行查询和报告归档可以支撑 UAT 前的大文件导入路径。

## 2. Execution Context

| Item | Value |
|---|---|
| Environment name | TBD |
| API Base URL | TBD |
| Candidate version | `v0.15.0` or later UAT candidate |
| Commit SHA | TBD |
| Source directory | TBD |
| Source file count | TBD |
| Execution start time | TBD |
| Execution end time | TBD |
| Evidence owner | TBD |
| Raw JSON report | TBD |
| Markdown report | TBD |

## 3. Recommended Command

```powershell
.\src\backend\.venv\Scripts\python.exe .\tools\H-UDMP-NHSA-ASYNC-IMPORT-REHEARSAL-v1.0.py `
  --api-base-url "http://127.0.0.1:8101" `
  --api-key "<masked>" `
  --source-dir "D:\20260320发布-医保医用耗材分类与代码数据库更新-14737190条" `
  --sheet-name "Query1" `
  --environment-name "uat-target" `
  --candidate-version "v0.15.0" `
  --commit-sha "<commit-sha>" `
  --evidence-owner "<owner>" `
  --environment-notes "Full NHSA directory async rehearsal"
```

For a low-risk first pass, limit the run:

```powershell
.\src\backend\.venv\Scripts\python.exe .\tools\H-UDMP-NHSA-ASYNC-IMPORT-REHEARSAL-v1.0.py `
  --api-base-url "http://127.0.0.1:8101" `
  --api-key "<masked>" `
  --source-dir "<NHSA_SOURCE_DIR>" `
  --file-limit 1
```

Use `--dry-run` to verify file discovery and source type classification without uploading files.

Generated JSON and Markdown reports use `<NHSA_SOURCE_DIR>` by default instead of local workstation paths. Use `--include-local-paths` only for private local evidence that will not be committed or attached to GitHub.

## 4. Acceptance Criteria

| Criterion | Expected |
|---|---|
| File discovery | Target NHSA `.xlsx` files are classified as `NHSA_FULL_SPEC`, `NHSA_DISABLED`, or `NHSA_TRANSCODE` |
| Task submission | Each selected file receives a batch id and task record |
| Progress query | `GET /api/v1/import-tasks/{batch_id}` returns status and counters |
| Terminal state | Each file reaches `COMPLETED`, `COMPLETED_WITH_ERRORS`, or `FAILED` |
| Failure capture | Failed rows or file-level failures are queryable through `/failures` |
| Report output | JSON and Markdown reports are saved under `reports/performance/` or attached as UAT evidence |

## 5. Result Summary

| Metric | Value |
|---|---:|
| Planned files | TBD |
| Dry-run files | TBD |
| Submitted files | TBD |
| Completed files | TBD |
| Completed with errors | TBD |
| Failed files | TBD |
| Timed-out files | TBD |
| Source rows | TBD |
| Success rows | TBD |
| Failed rows | TBD |
| Skipped duplicates | TBD |
| Duplicate count | TBD |

## 6. Per-File Evidence

| # | Source Type | File | Batch ID | Final Status | Source Rows | Success | Failed | Failure Evidence | Result |
|---:|---|---|---|---|---:|---:|---:|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Result values: `PASS`, `REVIEW`, `FAIL`, `NOT RUN`.

## 7. Decision Rules

- `COMPLETED` with expected counters can be accepted as positive rehearsal evidence.
- `COMPLETED_WITH_ERRORS` requires failure-row review and an accepted remediation or rerun plan.
- `FAILED`, upload errors, timeouts, or missing failure details require a GitHub defect issue before UAT sign-off.
- A near-million-row file should be exercised before broad UAT if real source files are available.

## 8. Deviations and Defects

| ID | File / Batch | Description | Impact | GitHub Issue | Decision |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD |

## 9. Closure Checklist

- [ ] Dry run confirms intended file discovery.
- [ ] At least one large `NHSA_FULL_SPEC` file is processed through async import.
- [ ] Status and progress evidence is captured.
- [ ] Failure rows, if any, are captured and reviewed.
- [ ] JSON and Markdown reports are preserved.
- [ ] Deviations are linked to GitHub Issues.
- [ ] UAT evidence package references the final rehearsal report.
