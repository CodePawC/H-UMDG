# H-UDMP UAT Environment Execution Record

> Document ID: H-UDMP-UAT-ENV-EXECUTION-RECORD  
> Version: v1.0  
> Status: Template  
> Date: 2026-05-06  
> Owner: H-UDMP Project Team  
> Source: `H-UDMP-DEPLOYMENT-RUNBOOK-v1.0.md`

## 1. Purpose

本文档用于记录 H-UDMP MVP UAT 环境的实际部署执行过程。它不是部署说明的替代品，而是对 `H-UDMP-DEPLOYMENT-RUNBOOK-v1.0.md` 的一次执行证据归档。

## 2. Environment Summary

| Item | Value |
|---|---|
| Environment name | TBD |
| Environment owner | TBD |
| Host / VM | TBD |
| Operating system | TBD |
| Deployment mode | Docker Compose / Native Python / Other |
| Candidate version | `v0.15.0` or later UAT candidate |
| Commit SHA | TBD |
| Deployment date | TBD |
| API Base URL | TBD |
| Database host | TBD |
| Redis host | TBD |
| Evidence location | TBD |

## 3. Configuration Record

Do not record real secrets in this table. Use masked values for credentials and API keys.

| Variable | Required | Value / Evidence | Result |
|---|:---:|---|---|
| `APP_ENV` | Yes | TBD | TBD |
| `DATABASE_URL` | Yes | `postgresql+psycopg://***` | TBD |
| `REDIS_URL` | Yes | `redis://***` | TBD |
| `API_KEY` | Yes | Masked, not `change-me` in shared UAT | TBD |
| `LOG_LEVEL` | No | TBD | TBD |
| `HUDMP_NHSA_DIR` | Conditional | TBD | TBD |
| `HUDMP_DEVICE_CATALOG_DOCX` | Conditional | TBD | TBD |
| `HUDMP_IMPORT_SPOOL_DIR` | Yes | TBD | TBD |

## 4. Pre-Deployment Checks

| Check | Expected | Evidence | Result |
|---|---|---|---|
| Repository branch/tag available | UAT candidate can be checked out | TBD | TBD |
| Python runtime available | Python 3.11+ | TBD | TBD |
| PostgreSQL available | PostgreSQL 16 preferred | TBD | TBD |
| Redis available | Redis 7 preferred | TBD | TBD |
| Backend dependencies install | `pip install ".[dev]"` or production equivalent succeeds | TBD | TBD |
| Import spool directory writable | Backend process can write files | TBD | TBD |
| Sample data available | `data/templates` and `data/samples` readable | TBD | TBD |
| Raw source files controlled | Sensitive or large sources stored outside Git | TBD | TBD |

## 5. Deployment Steps

| Step | Command / Action | Evidence | Result |
|---|---|---|---|
| 1 | Checkout UAT candidate | TBD | TBD |
| 2 | Configure environment variables | TBD | TBD |
| 3 | Start PostgreSQL and Redis | TBD | TBD |
| 4 | Start backend API service | TBD | TBD |
| 5 | Run Alembic migrations | TBD | TBD |
| 6 | Verify `/health` | TBD | TBD |
| 7 | Verify Swagger/OpenAPI | TBD | TBD |
| 8 | Run automated tests or smoke tests | TBD | TBD |
| 9 | Create database backup/snapshot point | TBD | TBD |

## 6. Migration Record

| Item | Value |
|---|---|
| Command | `alembic upgrade head` |
| Working directory | `src/backend` |
| Result | TBD |
| Alembic head revision | TBD |
| Evidence file | TBD |

Known UAT baseline requirement:

- `DATABASE_URL` must use the project-supported SQLAlchemy driver form, for example `postgresql+psycopg://...`.
- A fresh database migration must create `sys_import_batch` and `sys_import_failure` via the `0003_import_batches` revision, not through the initial revision.

## 7. Health Check Record

| Check | Endpoint / Command | Expected | Actual | Result |
|---|---|---|---|---|
| API health | `GET /health` | `status=ok` | TBD | TBD |
| Database health | `GET /health` | `database=ok` | TBD | TBD |
| Redis health | `GET /health` | `redis=ok` | TBD | TBD |
| OpenAPI | `GET /openapi.json` | MVP paths present | TBD | TBD |

## 8. Operational Smoke Test

| Check | API / Command | Expected | Evidence | Result |
|---|---|---|---|---|
| Department import | `POST /api/v1/departments/import` | Success report | TBD | TBD |
| Material import | `POST /api/v1/materials/import` | Success report | TBD | TBD |
| Material search | `GET /api/v1/materials/search` | Matching material | TBD | TBD |
| Mapping resolve | `POST /api/v1/mapping/resolve` | `MATCHED` or `PENDING_REVIEW` | TBD | TBD |
| Async import task | `POST /api/v1/import-tasks/materials` | Task accepted | TBD | TBD |
| Exchange logs | `GET /api/v1/exchange/logs` | Log rows returned | TBD | TBD |

## 9. Backup and Recovery Evidence

| Item | Expected | Evidence | Result |
|---|---|---|---|
| Pre-UAT database backup | Backup or snapshot created before UAT | TBD | TBD |
| Backup location recorded | Approved storage path | TBD | TBD |
| Restore owner identified | Named owner/team | TBD | TBD |
| Rollback plan available | Migration/service rollback notes | TBD | TBD |

## 10. Risks and Deviations

| ID | Description | Impact | Owner | Decision |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

## 11. Execution Sign-Off

| Role | Name | Organization | Result | Signature / Date |
|---|---|---|---|---|
| Environment owner | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Database owner | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Implementation lead | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Development lead | TBD | TBD | Pass / Fail / Conditional Pass | TBD |

## 12. Closure Checklist

- [ ] UAT candidate version and commit SHA are recorded.
- [ ] Environment variables are documented with secrets masked.
- [ ] Migrations completed successfully.
- [ ] Health check passed.
- [ ] OpenAPI is accessible.
- [ ] Import spool directory is writable.
- [ ] Smoke tests passed.
- [ ] Backup/snapshot point is recorded.
- [ ] Risks and deviations are recorded.
- [ ] Execution sign-off is complete.
