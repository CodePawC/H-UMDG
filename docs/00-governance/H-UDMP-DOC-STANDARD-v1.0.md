# H-UDMP Document Standard

> Version: v1.0  
> Status: Approved  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team

## 1. Purpose

本文档定义 H-UDMP 项目的文档命名、版本、状态、目录和评审规则，确保方案、需求、架构、接口、测试和运维文档可追溯、可评审、可交付。

## 2. Naming Convention

项目文档统一使用英文、短横线和语义化版本号：

```text
H-UDMP-<DOC-TYPE>-<SUBJECT>-v<MAJOR.MINOR>.md
```

示例：

```text
H-UDMP-SOLUTION-v4.0.md
H-UDMP-MVP-TASKBOOK-v1.0.md
H-UDMP-API-SPEC-v1.0.md
H-UDMP-DATA-MODEL-v1.0.md
H-UDMP-TEST-PLAN-v1.0.md
```

规则：

- 文件名使用 ASCII 字符，不使用空格。
- 文档内容可使用中文。
- 项目前缀固定为 `H-UDMP`。
- 版本号使用 `vMAJOR.MINOR`，例如 `v1.0`、`v1.1`、`v2.0`。
- 草稿、评审稿、正式稿不写入文件名，通过文档头部 `Status` 标识。
- 同一文档主题只保留最新正式基线，历史版本进入归档目录时再保留。

## 3. Document Types

| Type | Meaning | Example |
|---|---|---|
| `SOLUTION` | 总体方案 | `H-UDMP-SOLUTION-v4.0.md` |
| `TASKBOOK` | 开发任务书 | `H-UDMP-MVP-TASKBOOK-v1.0.md` |
| `DEV-PROCESS` | 开发流程 | `H-UDMP-DEVELOPMENT-PROCESS-v1.0.md` |
| `DOC-STANDARD` | 文档标准 | `H-UDMP-DOC-STANDARD-v1.0.md` |
| `QA-PLAN` | 质量保证计划 | `H-UDMP-QA-PLAN-v1.0.md` |
| `RTM` | 需求追踪矩阵 | `H-UDMP-RTM-v1.0.md` |
| `API-SPEC` | API规范 | `H-UDMP-API-SPEC-v1.0.md` |
| `DATA-MODEL` | 数据模型 | `H-UDMP-DATA-MODEL-v1.0.md` |
| `TEST-PLAN` | 测试计划 | `H-UDMP-TEST-PLAN-v1.0.md` |
| `OPS-RUNBOOK` | 运维手册 | `H-UDMP-OPS-RUNBOOK-v1.0.md` |

## 4. Document Status

| Status | Meaning |
|---|---|
| Draft | 正在编写，不能作为开发基线 |
| Review | 已提交评审，允许提出修改意见 |
| Approved | 已审批，可作为开发或验收基线 |
| Superseded | 已被新版本替代 |
| Archived | 已归档，仅供追溯 |

## 5. Required Header

每份正式文档必须包含：

```text
Title
Version
Status
Date
Owner
Source or Reference
```

## 6. Review Rule

所有会影响开发、测试、部署或验收的文档变更，必须满足：

- 说明变更原因。
- 更新版本记录。
- 更新需求追踪矩阵或相关引用。
- 经项目负责人、技术负责人和业务代表确认后进入 Approved 状态。
