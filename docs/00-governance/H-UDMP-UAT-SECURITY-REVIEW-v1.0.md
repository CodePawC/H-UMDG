# H-UDMP UAT Security Review

> Document ID: H-UDMP-UAT-SECURITY-REVIEW
> Version: v1.0
> Status: UAT readiness review
> Date: 2026-05-06
> Owner: H-UDMP Project Team
> Source: GitHub Issue #6

## 1. Purpose

This record documents the MVP security review required before UAT evidence is shared. The review focuses on repository secrets, API key handling, raw source data, logs, performance reports, and public-repository exposure risk.

## 2. Review Scope

| Area | Review target | Result |
|---|---|---|
| Secrets in Git | Tracked files, examples, CI config, scripts, reports | PASS with UAT condition |
| `.env` handling | `.gitignore`, `.env.example`, runtime config | PASS |
| API key handling | MVP service API key and UAT guidance | PASS with required rotation |
| Raw source data | NHSA/NMPA source files and committed samples | PASS |
| Logs and reports | Performance reports, generated output, stack traces | MITIGATED |
| Evidence sharing | UAT package, issue comments, screenshots, report snippets | PASS with private-storage rule |
| Public repository risk | History, reports, and external sharing readiness | REVIEW |

## 3. Findings

| ID | Finding | Evidence | Decision |
|---|---|---|---|
| SEC-001 | No real credential pattern was identified in tracked repository content. | Search covered API keys, tokens, passwords, private-key markers, database URLs, and committed reports. | Accept. |
| SEC-002 | `change-me` appears in examples, tests, CI, and local Docker defaults. | `src/backend/.env.example`, CI, runbooks, and test fixtures use the placeholder value. | Accept for local/CI only; shared UAT must use a rotated non-default API key. |
| SEC-003 | Real `.env` files, private keys, local runtime files, logs, and raw large source files are ignored. | `.gitignore` excludes `.env*`, private key formats, runtime/spool directories, logs, raw NHSA `.xlsx`, and raw NMPA `.docx` while allowing approved `H-UDMP-SAMPLE-*` fixtures. | Accept. |
| SEC-004 | Previously committed performance reports included local absolute paths and raw NHSA source-directory names. | Reports under `reports/performance/` referenced local drive paths and a developer workspace path in a stack trace. | Mitigated in the current tree by replacing local paths with `<NHSA_SOURCE_DIR>` and `<REPO_ROOT>`. |
| SEC-005 | Future generated performance reports could be accidentally staged. | Performance scripts write JSON/Markdown evidence files. | Mitigated by ignoring generated `reports/performance/H-UDMP-*.json`, `reports/performance/H-UDMP-*.md`, and run logs. |
| SEC-006 | Git history may still contain prior local path metadata. | Current-tree redaction does not rewrite already pushed history. | Keep repository private until maintainers either accept this residual metadata risk or approve a history rewrite before external publication. |

## 4. Acceptance Criteria Mapping

| Issue #6 criterion | Status | Notes |
|---|---|---|
| No secrets are committed to Git. | PASS | No real secrets found; placeholder values remain documented. |
| UAT API key is rotated away from `change-me` in shared environments. | REQUIRED BEFORE UAT | Must be recorded in `H-UDMP-UAT-ENV-EXECUTION-RECORD-v1.0.md` with masked value only. |
| Sensitive source files are excluded or externally stored. | PASS | Raw NHSA/NMPA patterns are ignored; only minimized samples are committed. |
| Public-repo risk is documented and accepted or mitigated before sharing externally. | REVIEW | Current tree is mitigated; history exposure needs explicit maintainer decision before public sharing. |

## 5. Required UAT Actions

1. Set `API_KEY` to a non-default value in any shared UAT environment.
2. Record API keys and database URLs only as masked values in UAT evidence.
3. Store raw NHSA/NMPA files and unsanitized reports in approved private storage, not in GitHub issues or repository commits.
4. Share only sanitized summaries in GitHub issues, pull requests, README files, and UAT evidence package records.
5. Keep the repository private until the residual Git history metadata risk is accepted or remediated.

## 6. Evidence Handling Rules

- Use `<NHSA_SOURCE_DIR>` instead of local source directories in committed evidence.
- Use `<REPO_ROOT>` instead of developer machine workspace paths in committed logs or traces.
- Do not paste API keys, database passwords, raw `.env` content, production exports, or hospital-sensitive data into GitHub issues.
- Use `--include-local-paths` only for private local evidence that will not be committed or shared externally.
- Generated reports under `reports/performance/` are ignored by default; commit only deliberately sanitized evidence.

## 7. Closure Checklist

- [x] Repository secret scan performed.
- [x] Current committed reports sanitized for local paths.
- [x] Future generated report patterns ignored.
- [x] UAT security review record created.
- [ ] Shared UAT API key rotated from `change-me`.
- [ ] UAT environment record updated with masked secrets.
- [ ] Maintainer decision recorded for Git history metadata risk before external publication.
