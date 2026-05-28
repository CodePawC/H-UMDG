# H-UDMP Development Process

> Version: v1.0  
> Status: Approved  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team

## 1. Standard Alignment

H-UDMP 开发流程按国际通用软件工程体系对齐：

| Standard or Practice | Application in H-UDMP |
|---|---|
| ISO/IEC/IEEE 12207 | 软件生命周期过程：需求、设计、实现、测试、交付、维护 |
| ISO/IEC/IEEE 29148 | 需求定义、需求评审、需求追踪 |
| ISO/IEC 25010 | 功能性、可靠性、性能、安全性、可维护性等质量属性 |
| ISO/IEC 27001 | 信息安全控制、访问控制、日志和备份要求 |
| OWASP ASVS / API Security Top 10 | API认证、授权、输入校验、安全测试 |
| Semantic Versioning | 版本号管理 |
| Conventional Commits | 提交信息规范 |

## 2. Lifecycle Stages

```text
Initiation
  ↓
Requirements Baseline
  ↓
Architecture and Data Design
  ↓
Sprint Development
  ↓
Code Review and Security Review
  ↓
System Integration Test
  ↓
User Acceptance Test
  ↓
Release and Operations
  ↓
Change Control
```

## 3. Stage Gates

| Gate | Entry Criteria | Exit Criteria |
|---|---|---|
| G0 Project Start | 项目目录、文档标准、角色明确 | 总体方案和 MVP 任务书已归档 |
| G1 Requirements Baseline | 需求文档完成 | 需求追踪矩阵通过评审 |
| G2 Architecture Baseline | 技术栈和数据模型明确 | 架构、API、数据模型通过评审 |
| G3 Development Ready | 任务拆分完成 | Sprint backlog 可执行 |
| G4 Test Ready | 核心功能实现 | 单元和集成测试通过 |
| G5 UAT Ready | 部署环境可用 | 院方验收用例可执行 |
| G6 Release Ready | UAT 通过 | 发布包、回滚方案、运维文档完成 |

## 4. Engineering Workflow

### 4.1 Branching

MVP 阶段建议采用轻量化 trunk-based development：

- `main`：稳定分支，受保护。
- `feature/<ticket-id>-<summary>`：功能分支。
- `fix/<ticket-id>-<summary>`：缺陷修复分支。
- `release/<version>`：发布候选分支，仅在需要时创建。

### 4.2 Commit Convention

提交信息采用 Conventional Commits：

```text
feat: add material import endpoint
fix: handle idempotency conflict
docs: update MVP taskbook
test: add mapping resolve integration tests
chore: update docker compose
```

### 4.3 Pull Request Rule

每个 PR 必须包含：

- 变更摘要。
- 关联需求 ID。
- 测试结果。
- 数据库迁移说明。
- 安全影响说明。

合并条件：

- 至少 1 名开发负责人评审。
- 涉及需求或流程变更时，需要业务代表确认。
- CI 测试通过。
- 无未处理的高风险安全问题。

## 5. Definition of Ready

开发任务进入 Sprint 前必须满足：

- 需求 ID 明确。
- 输入、输出、错误码清楚。
- 数据表或字段影响明确。
- 验收标准明确。
- 测试数据或样例可获得。

## 6. Definition of Done

任务完成必须满足：

- 代码已提交并通过评审。
- 自动化测试通过。
- OpenAPI 文档已更新。
- 数据库迁移可重复执行。
- 错误处理和日志满足要求。
- 需求追踪矩阵状态更新。

## 7. Change Control

任何影响 MVP 范围、接口契约、数据库结构、验收标准的变更必须进入变更控制：

1. 提出变更请求。
2. 评估影响：范围、成本、风险、测试、部署。
3. 项目负责人和院方代表确认。
4. 更新需求文档和追踪矩阵。
5. 进入开发排期。
