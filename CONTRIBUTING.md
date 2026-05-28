# Contributing Guide

> Project: H-UDMP Hospital Unified Data Management Platform

## 1. Development Workflow

1. Create a branch from the current stable baseline.
2. Keep changes scoped to one feature, fix, or documentation update.
3. Update tests and documentation when behavior, API contracts, data models, or operations steps change.
4. Run the backend test suite before opening a pull request.

Recommended branch names:

```text
feature/<short-topic>
fix/<short-topic>
docs/<short-topic>
test/<short-topic>
chore/<short-topic>
```

## 2. Local Checks

From the repository root:

```powershell
cd src/backend
.\.venv\Scripts\python.exe -m pytest ..\..\tests -q
```

Database-backed integration tests require PostgreSQL. When PostgreSQL is not available, those tests skip quickly by design.

## 3. Commit Messages

Use Conventional Commits:

```text
feat: add async material import task
fix: handle invalid device catalog docx
test: cover device classification catalog import
docs: update MVP test plan
chore: update repository governance files
```

Allowed common types:

```text
feat, fix, test, docs, refactor, perf, chore, ci, build
```

## 4. Pull Request Expectations

Each pull request should include:

- Summary of the change.
- Linked requirement, issue, or document section when applicable.
- Test evidence, including skipped tests if any.
- API, database, migration, deployment, and security impact notes.
- Screenshots or sample reports when changing user-facing outputs.

## 5. Documentation Rules

Update authoritative documents when implementation changes affect them:

- API changes: `docs/04-api/H-UDMP-API-SPEC-v1.0.md`
- Data model changes: `docs/05-data/H-UDMP-DATA-MODEL-v1.0.md`
- Test scope changes: `docs/06-testing/H-UDMP-TEST-PLAN-v1.0.md`
- Operations changes: `docs/07-operations/H-UDMP-DEPLOYMENT-RUNBOOK-v1.0.md`
- Release notes: `CHANGELOG.md`

## 6. Data Handling

Do not commit hospital-sensitive data, credentials, real production exports, or raw large source files. Commit only approved templates, synthetic samples, and deliberately minimized regression fixtures.

## 7. Review Checklist

Before requesting review:

- The code follows existing project patterns.
- New behavior has tests.
- Migrations are included for schema changes.
- Error responses follow the project envelope.
- `.gitignore` excludes local-only outputs.
- No secrets or sensitive source files are staged.
