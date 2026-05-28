# H-UDMP UAT Performance Execution Record

> Document ID: H-UDMP-UAT-PERFORMANCE-EXECUTION-RECORD  
> Version: v1.0  
> Status: Template  
> Date: 2026-05-06  
> Owner: H-UDMP Project Team  
> Source: `H-UDMP-PERFORMANCE-BASELINE-v1.0.md`, GitHub Issue #4

## 1. Purpose

本文档用于记录 H-UDMP MVP 在目标 UAT 环境中的性能基线执行结果。它承接 `tools/H-UDMP-PERF-BASELINE-v1.0.py` 的 JSON/Markdown 输出，用于判断 UAT 环境是否满足 MVP 性能验收目标。

## 2. Execution Context

| Item | Value |
|---|---|
| Environment name | TBD |
| API Base URL | TBD |
| Candidate version | `v0.15.0` or later UAT candidate |
| Commit SHA | TBD |
| Execution date/time | TBD |
| Evidence owner | TBD |
| Host / VM | TBD |
| CPU / memory | TBD |
| Database location | Local container / Remote service / Other |
| Redis location | Local container / Remote service / Other |
| Concurrent load assumption | No other load / Shared environment / Other |
| Raw JSON report | TBD |
| Markdown report | TBD |

## 3. Recommended Command

```powershell
.\src\backend\.venv\Scripts\python.exe .\tools\H-UDMP-PERF-BASELINE-v1.0.py `
  --api-base-url "http://127.0.0.1:8101" `
  --api-key "<masked>" `
  --iterations 50 `
  --import-rows 1000 `
  --environment-name "uat-target" `
  --candidate-version "v0.15.0" `
  --commit-sha "<commit-sha>" `
  --evidence-owner "<owner>" `
  --environment-notes "UAT target environment baseline"
```

Do not store the real API key in this document or in committed reports.

## 4. Performance Targets

| Scenario | Target | Source |
|---|---:|---|
| Department search P99 | <= 500 ms | QA Plan / Performance baseline |
| Material search P99 | <= 500 ms | QA Plan / Performance baseline |
| Mapping resolve P99 | <= 500 ms | QA Plan / Performance baseline |
| Exchange log query P99 | <= 500 ms | Performance baseline |
| MVP material template 1,000-row import | Completes and returns import report | Performance baseline |

## 5. Result Summary

| Scenario | Count | P99 ms | Target | Result | Notes |
|---|---:|---:|---:|---|---|
| Department search | TBD | TBD | 500 | TBD | TBD |
| Material search | TBD | TBD | 500 | TBD | TBD |
| Mapping resolve | TBD | TBD | 500 | TBD | TBD |
| Exchange log query | TBD | TBD | 500 | TBD | TBD |
| 1,000-row material import | 1 | TBD | Complete | TBD | TBD |

Result values: `PASS`, `REVIEW`, `FAIL`, `NOT RUN`.

## 6. Evidence Checklist

- [ ] API service was healthy before the run.
- [ ] Database migrations were at head before the run.
- [ ] Baseline seed data completed or `--skip-seed` rationale is documented.
- [ ] JSON report is preserved.
- [ ] Markdown report is preserved.
- [ ] Generated temporary CSV is excluded from Git.
- [ ] Target misses have a GitHub Issue or accepted deviation.
- [ ] Final result is referenced from the UAT evidence package.

## 7. Deviations

| ID | Scenario | Description | Impact | Decision |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

## 8. Sign-Off

| Role | Name | Organization | Result | Signature / Date |
|---|---|---|---|---|
| Test owner | TBD | TBD | Pass / Fail / Review | TBD |
| Environment owner | TBD | TBD | Pass / Fail / Review | TBD |
| Development lead | TBD | TBD | Pass / Fail / Review | TBD |
