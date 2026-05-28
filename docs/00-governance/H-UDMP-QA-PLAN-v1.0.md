# H-UDMP Quality Assurance Plan

> Version: v1.0  
> Status: Approved  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team

## 1. Purpose

本文档定义 H-UDMP MVP 的质量目标、测试层级、验收门槛和质量证据。质量模型参考 ISO/IEC 25010，并结合医院数据平台的可靠性、安全性和可追溯要求。

## 2. Quality Attributes

| Attribute | MVP Target |
|---|---|
| Functional suitability | 科室、耗材、映射桥、导入、日志、幂等功能符合任务书 |
| Performance efficiency | 核心检索和映射解析 P99 ≤ 500ms |
| Reliability | 重复提交不产生重复记录，交换日志完整率 ≥ 99% |
| Security | MVP 服务级 API Key；输入校验；错误不泄露敏感信息 |
| Maintainability | 模块边界清晰，数据库迁移可重复执行 |
| Portability | Docker Compose 可部署到测试环境 |

## 3. Test Levels

| Level | Scope | Owner |
|---|---|---|
| Unit Test | 字段校验、规格拆分、幂等服务、映射逻辑 | Developer |
| Integration Test | API + DB + Redis + 导入流程 | Developer / QA |
| System Test | MVP 端到端流程 | QA |
| User Acceptance Test | 院方样例数据验收 | Hospital IT / Business |
| Security Check | API Key、输入校验、错误处理 | Developer / Security Reviewer |

## 4. Required Test Scenarios

| ID | Scenario | Result |
|---|---|---|
| QA-001 | 导入科室样例并检索 | 必须通过 |
| QA-002 | 导入耗材样例并按 27 位码检索 | 必须通过 |
| QA-003 | 耗材规格 `22mm` 拆分为值和单位 | 必须通过 |
| QA-004 | SPD 编码命中映射 | 必须通过 |
| QA-005 | SPD 编码未命中后创建审核任务 | 必须通过 |
| QA-006 | 审核通过后再次解析命中 | 必须通过 |
| QA-007 | 同一幂等键同报文重复提交 | 必须通过 |
| QA-008 | 同一幂等键不同报文返回冲突 | 必须通过 |
| QA-009 | 交换日志按来源、状态、时间查询 | 必须通过 |
| QA-010 | 无 API Key 请求被拒绝 | 必须通过 |

## 5. Quality Gates

| Gate | Pass Criteria |
|---|---|
| Development Complete | 单元测试通过，核心 API 可用 |
| Integration Complete | API、数据库、Redis、导入、映射端到端通过 |
| UAT Ready | 验收数据导入成功，测试报告完成 |
| Release Ready | 阻断缺陷为 0，高风险缺陷为 0 |

## 6. Defect Severity

| Severity | Definition | SLA |
|---|---|---|
| Blocker | 核心流程无法执行，数据损坏，服务不可用 | 立即处理 |
| Critical | MVP 验收项失败，无可接受绕行方案 | 1 个工作日内 |
| Major | 影响部分功能，有临时绕行方案 | 3 个工作日内 |
| Minor | 文案、低影响体验或非核心问题 | 排期处理 |

## 7. Evidence

验收前必须提交：

- 自动化测试报告。
- 导入报告样例。
- API 联调记录。
- 性能测试记录。
- 缺陷清单及关闭记录。
- UAT 签字或确认记录。
