# Security Policy

## 1. Scope

This policy applies to the H-UDMP repository, including backend code, deployment assets, tests, documentation, templates, and committed sample data.

## 2. Sensitive Data Rules

Do not commit:

- API keys, passwords, private keys, tokens, certificates, or database URLs with real credentials.
- Patient data, staff private information, production hospital records, or vendor confidential exports.
- Raw NHSA/NMPA source bundles unless they are explicitly approved, minimized, and non-sensitive.
- Local runtime files, import spool files, logs, database dumps, or performance scratch outputs.

Use `.env.example` for configuration examples and keep real `.env` files local.

## 3. Authentication Baseline

The MVP uses service-level API key authentication. Treat API keys as secrets. Rotate keys immediately if they are exposed in logs, screenshots, commits, issue comments, or chat messages.

The placeholder value `change-me` is allowed only in local examples, CI fixtures, and documentation snippets. Any shared UAT or demo environment must use a non-default API key and record it only as a masked value in evidence.

## 4. Reporting a Vulnerability

For now, report vulnerabilities privately to the project owner or repository maintainer. Include:

- Affected component or endpoint.
- Reproduction steps.
- Impact assessment.
- Suggested mitigation if known.

Do not open a public issue for exploitable vulnerabilities or exposed secrets.

## 5. Secret Exposure Response

If a secret is committed or shared:

1. Revoke or rotate it immediately.
2. Remove it from the working tree.
3. Identify affected logs, artifacts, and environments.
4. Record the incident and mitigation in the project security notes.

History rewriting may be required before publishing the repository. Coordinate with maintainers before force-pushing any shared branch.

## 6. Dependency and Supply Chain Hygiene

- Prefer pinned or bounded dependency ranges in project metadata.
- Review dependency changes in pull requests.
- Keep generated lockfiles only when the project intentionally adopts them.
- Do not vendor third-party packages into this repository unless explicitly approved.

## 7. Large Source File Handling

Use approved external storage for large raw data sources. Keep only templates and minimal regression samples in Git. The repository `.gitignore` intentionally excludes common raw source file locations while allowing `H-UDMP-SAMPLE-*` fixtures.

## 8. UAT Evidence Sharing

- Store raw NHSA/NMPA source files, unsanitized reports, screenshots with secrets, and local-only logs outside Git.
- Redact developer workstation paths and source directories as `<REPO_ROOT>` or `<NHSA_SOURCE_DIR>` before committing evidence.
- Use `--include-local-paths` only for private local reports that will not be committed or attached to GitHub.
- Do not paste `.env` contents, API keys, database URLs with real credentials, or hospital-sensitive data into GitHub issues or pull requests.
- Before making the repository public or sharing it externally, record an explicit maintainer decision for any residual metadata risk in Git history.
