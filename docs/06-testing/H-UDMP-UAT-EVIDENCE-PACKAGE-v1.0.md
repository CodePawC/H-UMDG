# H-UDMP MVP UAT Evidence Package

> Document ID: H-UDMP-UAT-EVIDENCE-PACKAGE  
> Version: v1.0  
> Status: Template  
> Date: 2026-05-06  
> Owner: H-UDMP Project Team  
> Source: `H-UDMP-UAT-CHECKLIST-v1.0.md`, `H-UDMP-RTM-v1.0.md`

## 1. Purpose

本文档用于归档 H-UDMP MVP 用户验收测试证据。它是 UAT 执行记录模板，只有在填入目标环境、测试时间、响应样例、导入报告、缺陷和签署信息后，才可作为正式验收材料。

## 2. Candidate Baseline

| Item | Value |
|---|---|
| Candidate version | `v0.15.0` or later UAT candidate |
| Commit SHA | TBD |
| API Base URL | TBD |
| Database migration version | TBD |
| Test start time | TBD |
| Test end time | TBD |
| Evidence owner | TBD |
| Evidence location | TBD |

## 3. Evidence Folder Layout

Recommended local or shared folder layout:

```text
uat-evidence/
├── 00-environment/
├── 01-health-and-auth/
├── 02-department/
├── 03-material/
├── 04-nhsa/
├── 05-mapping-review/
├── 06-idempotency/
├── 07-exchange-log/
├── 08-exceptions/
├── 09-performance/
└── 10-signoff/
```

Do not store secrets, production patient data, or raw large source files in this repository. If evidence contains sensitive hospital data, store it in an approved private location and reference only sanitized summaries here.

## 4. Execution Summary

| Metric | Result |
|---|---|
| Total UAT cases | 20 |
| Passed | TBD |
| Failed | TBD |
| Conditional pass | TBD |
| Blocker defects | TBD |
| Critical defects | TBD |
| Major defects | TBD |
| Minor defects | TBD |
| Overall result | TBD |

Allowed overall results:

| Result | Meaning |
|---|---|
| Pass | All UAT cases passed, no Blocker/Critical defects remain open |
| Conditional Pass | Major/Minor defects remain but are accepted with a remediation plan |
| Fail | One or more Blocker/Critical defects remain open |

## 5. UAT Evidence Matrix

| UAT ID | Requirement | Scenario | Evidence File / Link | Actual Result | Defect Link | Status |
|---|---|---|---|---|---|---|
| UAT-001 | MVP-REQ-001 | 健康检查 | TBD | TBD | TBD | TBD |
| UAT-002 | MVP-REQ-013 | API Key 认证 | TBD | TBD | TBD | TBD |
| UAT-003 | MVP-REQ-002 | 科室导入 | TBD | TBD | TBD | TBD |
| UAT-004 | MVP-REQ-003 | 科室检索 | TBD | TBD | TBD | TBD |
| UAT-005 | MVP-REQ-004 | 耗材导入 | TBD | TBD | TBD | TBD |
| UAT-006 | MVP-REQ-005 | 耗材检索 | TBD | TBD | TBD | TBD |
| UAT-007 | MVP-REQ-014 | NHSA 全量规格导入 | TBD | TBD | TBD | TBD |
| UAT-008 | MVP-REQ-015 | NHSA 停用表导入 | TBD | TBD | TBD | TBD |
| UAT-009 | MVP-REQ-016 | NHSA 转码表导入 | TBD | TBD | TBD | TBD |
| UAT-010 | MVP-REQ-016 | 转码查询 | TBD | TBD | TBD | TBD |
| UAT-011 | MVP-REQ-007 | SPD 映射命中 | TBD | TBD | TBD | TBD |
| UAT-012 | MVP-REQ-008 | 未知映射待审核 | TBD | TBD | TBD | TBD |
| UAT-013 | MVP-REQ-009 | 审核通过 | TBD | TBD | TBD | TBD |
| UAT-014 | MVP-REQ-019 | 审核拒绝 | TBD | TBD | TBD | TBD |
| UAT-015 | MVP-REQ-010 | 幂等重放 | TBD | TBD | TBD | TBD |
| UAT-016 | MVP-REQ-010 | 幂等冲突 | TBD | TBD | TBD | TBD |
| UAT-017 | MVP-REQ-011 | 交换日志查询 | TBD | TBD | TBD | TBD |
| UAT-018 | MVP-REQ-004 | 非法 `source_type` | TBD | TBD | TBD | TBD |
| UAT-019 | MVP-REQ-004 | 不存在的 Excel `sheet_name` | TBD | TBD | TBD | TBD |
| UAT-020 | MVP-REQ-004 | 重复 `yb_code_27` | TBD | TBD | TBD | TBD |

Status values: `Pass`, `Fail`, `Conditional Pass`, `Blocked`, `Not Run`.

## 6. Required Attachments

| Evidence | Required | Notes |
|---|:---:|---|
| Environment execution record | Yes | Use `docs/07-operations/H-UDMP-UAT-ENV-EXECUTION-RECORD-v1.0.md` |
| `/health` response | Yes | Capture JSON response |
| OpenAPI/Swagger screenshot or JSON path proof | Yes | Sanitized screenshot or response |
| Department import report | Yes | Include batch id and counters |
| Material import report | Yes | Include batch id and counters |
| NHSA import reports | Yes | Full spec, disabled, transcode |
| Device classification import report | Conditional | Required when NMPA DOCX source is in scope |
| Mapping resolve responses | Yes | Matched and pending review cases |
| Review approve/reject responses | Yes | Include task ids |
| Idempotency evidence | Yes | Replay and conflict |
| Exchange log query evidence | Yes | Include source filters |
| Automated test result | Yes | Local or CI output |
| Performance report | Yes | Target-environment report for UAT |
| Defect list | Yes | Empty list is acceptable only if no defects were found |
| Sign-off record | Yes | Required for final UAT completion |

## 7. Defect Register

| Defect ID | UAT ID | Severity | GitHub Issue | Owner | Status | Resolution Plan |
|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Severity follows `H-UDMP-UAT-CHECKLIST-v1.0.md`:

| Severity | Meaning |
|---|---|
| Blocker | 核心服务不可用或数据损坏 |
| Critical | MVP 核心验收项失败且无绕行 |
| Major | 功能受影响但有临时绕行 |
| Minor | 文案、提示或低影响问题 |

## 8. Sign-Off

| Role | Name | Organization | Result | Signature / Date |
|---|---|---|---|---|
| Hospital data owner | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Hospital IT owner | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Implementation lead | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Development lead | TBD | TBD | Pass / Fail / Conditional Pass | TBD |

## 9. Closure Checklist

- [ ] UAT candidate version is frozen.
- [ ] Environment execution record is complete.
- [ ] UAT-001 through UAT-020 have evidence.
- [ ] Automated test result is attached.
- [ ] Target-environment performance report is attached.
- [ ] Defects are recorded and linked to GitHub Issues.
- [ ] No Blocker or Critical defect remains open.
- [ ] Conditional pass deviations, if any, are accepted by stakeholders.
- [ ] Sign-off table is complete.
