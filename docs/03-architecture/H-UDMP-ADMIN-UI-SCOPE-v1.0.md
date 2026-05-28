# H-UDMP Admin UI Scope and Navigation Model

> Document ID: H-UDMP-ADMIN-UI-SCOPE
> Version: v1.0
> Status: Post-MVP scope baseline
> Date: 2026-05-07
> Owner: H-UDMP Project Team
> Source: GitHub Issue #7

## 1. Decision

The admin frontend remains outside the MVP UAT acceptance gate. It enters the next delivery milestone as an **Admin UI Alpha** candidate after MVP UAT evidence is accepted and API behavior is frozen.

The alpha goal is not to replace Swagger for every technical operation. It should provide a focused, low-friction workbench for hospital IT, data owners, and implementation engineers to run repeated data-governance workflows with fewer manual API calls.

## 2. Target Users

| User | Primary need | UI priority |
|---|---|---|
| Hospital data owner | Confirm dictionary quality, mapping decisions, and UAT evidence | Review, approve, inspect |
| Hospital IT owner | Monitor import status, failures, and service exchange logs | Observe, troubleshoot |
| Implementation engineer | Import source files, rerun failed batches, and verify outputs | Execute, compare |
| Development lead | Reproduce defects and inspect API responses | Diagnose, link to issues |

## 3. First-Screen Workflow

The first screen should open directly into an operational workbench, not a marketing or landing page.

| Region | Content | Behavior |
|---|---|---|
| Header | Environment name, API base URL, candidate version, API health | Shows current target and health state before the user runs imports |
| Left navigation | Departments, Materials, Import Tasks, Mapping Review, Exchange Logs | Keeps repeated workflows one click away |
| Main workspace | Import task queue and review backlog summary | Surfaces work needing action first |
| Right detail pane | Selected task, failure rows, or mapping review detail | Avoids losing list context |
| Footer/status line | Last refresh time, trace id from latest call, error state | Helps support and defect capture |

Default first-screen order:

1. Check `/health`.
2. Show latest import tasks and mapping review backlog.
3. Allow the user to open a task detail, inspect failure rows, or jump to a dictionary search.
4. Preserve API response snippets for UAT evidence and defect reports.

## 4. Navigation Model

| View | Purpose | Primary actions | MVP API coverage |
|---|---|---|---|
| Dashboard | Operational snapshot for UAT/demo support | Refresh health, open latest task, open pending review | Full for health and task list |
| Dictionaries | Unified dictionary catalog and maintenance | Browse dictionary blueprints, maintain departments/materials, prepare future campus/drug/staff guides | Full for catalog, departments, materials |
| Import Tasks | Monitor asynchronous large-file imports | Create import task, list, open detail, inspect failures | Full |
| Mapping Review | Resolve pending mappings | Query review tasks, approve, reject, verify resolve result | Full |
| Exchange Logs | Inspect service exchange trail | Filter by source, category, status, trace id | Full |
| Evidence Export | Collect sanitized UAT snippets | Copy JSON, save trace ids, link reports | Partial; can start client-side |

## 5. API Endpoint Map

| UI capability | Endpoint |
|---|---|
| Health banner | `GET /health` |
| Operator login | `POST /api/v1/auth/login` |
| Current operator context | `GET /api/v1/auth/me` |
| Permission matrix | `GET /api/v1/auth/permissions` |
| Provisioned operator list | `GET /api/v1/auth/operators` |
| Dictionary catalog | `GET /api/v1/dictionaries/catalog` |
| Department search | `GET /api/v1/departments/search` |
| Department standard library sync | `POST /api/v1/departments/standard-library/sync` |
| Department status toggle | `PATCH /api/v1/departments/{dept_code}/status` |
| Department import | `POST /api/v1/departments/import` |
| Material search | `GET /api/v1/materials/search` |
| Material import | `POST /api/v1/materials/import` |
| NHSA transcode lookup | `GET /api/v1/materials/transcode/resolve` |
| Async material import submission | `POST /api/v1/import-tasks/materials` |
| Import task list | `GET /api/v1/import-tasks` |
| Import task detail | `GET /api/v1/import-tasks/{batch_id}` |
| Import failure rows | `GET /api/v1/import-tasks/{batch_id}/failures` |
| Mapping resolve | `POST /api/v1/mapping/resolve` |
| Mapping review task list | `GET /api/v1/mapping/review-tasks` |
| Mapping approve | `POST /api/v1/mapping/review-tasks/{task_id}/approve` |
| Mapping reject | `POST /api/v1/mapping/review-tasks/{task_id}/reject` |
| Exchange log query | `GET /api/v1/exchange/logs` |
| Exchange log detail | `GET /api/v1/exchange/logs/{log_id}` |

## 6. Alpha Scope

### 6.1 In Scope

- Vite or equivalent single-page admin app under `src/frontend`.
- API base URL configured locally without committing secrets.
- Username/employee ID password login backed by server-issued session token.
- Role-aware navigation using backend permissions.
- Health check banner.
- Department and material search pages.
- Department/material/NHSA upload forms using existing import APIs.
- Async import task list, detail, and failure-row viewer.
- Mapping review list, approve, and reject flows.
- Exchange log filters and result table.
- Sanitized evidence copy helpers for response JSON and trace ids.

### 6.2 Out of Scope

- Public internet exposure.
- Patient data views.
- Enterprise IAM/SSO, immutable audit logging, or production-grade permission administration.
- Custom report designer.
- FHIR, external reporting, DRG/DIP, drug dictionary, diagnosis/procedure modules.
- Replacing backend validation, UAT scripts, or signed evidence records.

## 7. API and Backend Gaps

The current MVP APIs are enough for an Admin UI Alpha. The following gaps can be deferred unless alpha users explicitly request them:

| Gap | Impact | Proposed handling |
|---|---|---|
| Failure-row export endpoint | Users may want CSV download from import failures | Defer; table view can use `/failures` first |
| Import task retry endpoint | Failed large imports still need manual rerun | Defer; create issue if real UAT produces frequent retry needs |
| Dashboard aggregate endpoint | Dashboard would otherwise call several list APIs | Defer; client-side aggregation is acceptable for alpha |
| Permission administration writes | Operators are configured by environment, not created from UI | Defer; read-only directory is enough for Alpha governance |

## 8. Implementation Slices

| Slice | Outcome | Follow-up issue |
|---|---|---|
| UI-001 | Frontend shell, API client, environment banner, health check | GitHub Issue #13 |
| UI-002 | Department/material search and import forms | GitHub Issue #14 |
| UI-003 | Async import task list, detail, and failure viewer | GitHub Issue #15 |
| UI-004 | Mapping review queue with approve/reject | GitHub Issue #16 |
| UI-005 | Exchange log query and evidence copy helpers | GitHub Issue #17 |

## 9. Acceptance Criteria Status

| Issue #7 criterion | Status | Decision |
|---|---|---|
| Decide whether frontend remains post-MVP or enters next delivery milestone | Done | Post-MVP; Admin UI Alpha candidate after MVP UAT acceptance |
| Capture first-screen workflow and target users | Done | Sections 2 and 3 |
| Confirm API endpoints needed by each view | Done | Sections 4 and 5 |
| Create follow-up implementation issues if UI enters scope | Done | GitHub Issues #13 through #17 |
