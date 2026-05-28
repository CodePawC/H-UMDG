# H-UDMP Project Handoff

> Document ID: H-UDMP-PROJECT-HANDOFF  
> Version: v1.0  
> Status: Review  
> Date: 2026-05-06  

## 1. Purpose

本文档将本次 Codex 对话整理为 H-UDMP 项目资产，用于后续恢复上下文、项目交接、开发排期和评审沟通。

说明：本文不是逐字聊天记录，而是按项目管理和工程落地需要整理的决策、产物、进展和待办清单。

## 2. Project Context

项目名称：H-UDMP 医院统一数据管理中台。

当前项目定位：

- 总体方案层：形成医院统一数据管理中台 V4 形式逻辑增强版。
- MVP 层：聚焦科室字典、医保耗材 27 位码、映射桥、SPD 样例接入、批量导入、交换日志和幂等写入。
- 非 MVP 层：药品、诊疗项目、DRG/DIP、FHIR、外报网关、冷热分离、完整权限审计等进入后续阶段。

已明确边界：

- 医用设备资产实例生命周期管理不属于本平台 MVP，不开发资产条码、序列号、所在科室、采购日期、设备状态流转等能力。
- 医疗器械分类目录仅作为分类参考，不替代医保耗材分类体系。
- NHSA 转码关系在 MVP 中可导入和查询，但不自动替换主数据或映射桥关系。

## 3. Generated Baseline Documents

项目已形成下列基线文档：

| Area | Document |
|---|---|
| Overall solution | `docs/01-planning/H-UDMP-SOLUTION-v4.0.md` |
| MVP taskbook | `docs/02-requirements/H-UDMP-MVP-TASKBOOK-v1.0.md` |
| Architecture | `docs/03-architecture/H-UDMP-ARCHITECTURE-MVP-v1.0.md` |
| Development process | `docs/00-governance/H-UDMP-DEVELOPMENT-PROCESS-v1.0.md` |
| QA plan | `docs/00-governance/H-UDMP-QA-PLAN-v1.0.md` |
| RTM | `docs/02-requirements/H-UDMP-RTM-v1.0.md` |
| API spec | `docs/04-api/H-UDMP-API-SPEC-v1.0.md` |
| Data model | `docs/05-data/H-UDMP-DATA-MODEL-v1.0.md` |
| Import source mapping | `docs/05-data/H-UDMP-IMPORT-SOURCE-MAPPING-v1.0.md` |
| Test plan | `docs/06-testing/H-UDMP-TEST-PLAN-v1.0.md` |
| UAT checklist | `docs/06-testing/H-UDMP-UAT-CHECKLIST-v1.0.md` |
| Performance baseline | `docs/06-testing/H-UDMP-PERFORMANCE-BASELINE-v1.0.md` |
| Deployment runbook | `docs/07-operations/H-UDMP-DEPLOYMENT-RUNBOOK-v1.0.md` |
| NHSA validation report | `docs/06-testing/H-UDMP-NHSA-FULL-IMPORT-VALIDATION-20260505.md` |

## 4. Implemented Engineering Assets

已建立的工程资产：

- FastAPI 后端工程骨架。
- Docker Compose：PostgreSQL、Redis、backend。
- Alembic 数据库迁移。
- API 路由：
  - `GET /health`
  - `GET /api/v1/departments/search`
  - `POST /api/v1/departments/import`
  - `GET /api/v1/materials/search`
  - `POST /api/v1/materials/import`
- `GET /api/v1/materials/transcode/resolve`
- `POST /api/v1/import-tasks/materials`
- `GET /api/v1/import-tasks`
- `GET /api/v1/import-tasks/{batch_id}`
- `GET /api/v1/import-tasks/{batch_id}/failures`
- `POST /api/v1/mapping/resolve`
  - `GET /api/v1/mapping/review-tasks`
  - `POST /api/v1/mapping/review-tasks/{task_id}/approve`
  - `POST /api/v1/mapping/review-tasks/{task_id}/reject`
  - `GET /api/v1/exchange/logs`
- 数据导入模板与样例：
  - 科室模板。
  - 耗材模板。
  - SPD 映射样例。
  - NHSA C09 全量规格型号小样本。
  - NHSA 停用表小样本。
  - NHSA 转码表小样本。
- 工具脚本：
  - SPD 映射样例导入。
  - NHSA 小样本生成。
  - UAT 演示脚本 `tools/H-UDMP-UAT-DEMO-v1.0.ps1`。
  - 性能基线脚本 `tools/H-UDMP-PERF-BASELINE-v1.0.py`。

## 5. Verified Functions

已经跑通过的功能链路：

- 科室模板导入。
- 科室按别名检索。
- 耗材模板导入。
- 耗材按 27 位医保码检索。
- SPD 样例映射导入。
- SPD 科室/耗材映射解析命中。
- 写入接口幂等重放。
- 写入接口幂等冲突识别。
- NHSA C09 全量规格型号小样本导入。
- NHSA 停用表小样本导入。
- NHSA 转码表小样本导入。
- 停用码命中主数据时将耗材置为 `INACTIVE`。
- 转码表按 `原27位码` 查询，包含 `FOUND` 和 `NOT_FOUND`。

最近一次完整通过的自动化测试结果：

```text
19 passed
```

## 6. Real Source File Validation

已对用户提供的真实源文件做过全量导入验证：

| Source | Result |
|---|---|
| C09 全量规格型号表 | 6,132 源行，5,783 个唯一 `27位码`，0 失败 |
| 停用表 | 13,084 源行，13,083 个唯一停用码，0 失败 |
| 转码表 | 5,408 条转码关系，0 失败 |

验证结论：

- 当前 MVP 可以读取真实 NHSA Excel `Query1` 工作表。
- C09 全量规格数据可进入暂存表并清洗进入耗材主数据。
- 停用表可进入暂存表，并已通过自动化小样本验证命中停用逻辑。
- 转码表可进入暂存表，并可通过只读 API 查询追溯。

## 7. Current Progress Estimate

整体 H-UDMP 平台进度：约 30%。

原因：完整平台还包括药品、诊疗项目、DRG/DIP、FHIR、外报网关、生产化权限审计、冷热分离、运维监控等后续能力。

MVP 开发进度：约 60% 至 65%。

已经完成：

- 文档基线。
- 后端工程骨架。
- 数据库迁移。
- Docker Compose 环境。
- 科室、耗材、NHSA 源表、SPD 映射、交换日志、幂等主链路。
- 映射审核闭环、导入异常场景、异步导入任务和失败行查询。
- 自动化测试与性能基线脚本。

仍需完成：

- 大文件服务端暂存、分块导入和失败批次重试。
- 全量 NHSA 目录正式导入验证。
- CI 流水线在远端 Git 环境中的实际执行验证。
- 部署脚本打磨。
- UAT 验收材料。

## 8. Work In Progress

已完成映射审核流程加固：

- `approve` 接口增加目标主数据存在性校验。
- `approve` 和 `reject` 增加仅允许处理 `PENDING` 任务的约束。
- 增加映射审核闭环集成测试：
  - 未知 SPD 编码生成待审核任务。
  - 查询待审核任务。
  - 审核通过后创建 ACTIVE 映射。
  - 再次解析返回 `MATCHED`。
  - 重复审核返回 `TASK_ALREADY_REVIEWED`。
  - 拒绝任务返回 `REJECTED`。

2026-05-06 更新：

- 已增加 PostgreSQL 连接超时，Docker 未启动时数据库集成测试可快速跳过。
- 已增加 HTTP 与字段校验错误的统一错误信封。
- 已新增未授权和请求校验失败契约测试。
- 已新增 GitHub Actions CI 基线，使用 PostgreSQL 16 service、Alembic 迁移和完整 pytest。
- 当前最新完整测试结果为 `19 passed`，审核流程加固、导入异常场景和异步导入任务均已通过自动化验证。
- 已新增 UAT 验收清单和可执行演示脚本。
- 已新增性能基线文档、脚本和首份基线报告。

首份性能基线结果（`reports/performance/H-UDMP-PERF-BASELINE-20260506002616.md`）：

| Scenario | P99 | Target | Result |
|---|---:|---:|---|
| 科室检索 | 7.97 ms | 500 ms | PASS |
| 耗材 27 位码检索 | 4.71 ms | 500 ms | PASS |
| SPD 耗材映射解析 | 11.19 ms | 500 ms | PASS |
| 交换日志查询 | 6.41 ms | 500 ms | PASS |
| 1,000 行耗材模板导入 | 452.55 ms | 完成并返回报告 | PASS |

真实 NHSA 文件导入基线（`reports/performance/H-UDMP-NHSA-REAL-IMPORT-BASELINE-20260506003013.md`）：

| Source Type | Source Rows | Success | Failed | Elapsed |
|---|---:|---:|---:|---:|
| `NHSA_FULL_SPEC` | 6,132 | 5,783 | 0 | 6,459.12 ms |
| `NHSA_DISABLED` | 13,084 | 13,083 | 0 | 1,716.8 ms |
| `NHSA_TRANSCODE` | 5,408 | 5,408 | 0 | 752.45 ms |

说明：C09、停用表、转码表三文件小范围验证可同步完成；但该结论不适用于完整 NHSA 发布目录。

全目录 NHSA 导入验证更新：

- 已对约 300MB 的 NHSA 发布目录启动全目录导入基线，目录包含 28 个全量规格型号文件、停用表、转码表，共 30 个目标 Excel 文件。
- 同步 HTTP 导入在单个接近 100 万源行文件上耗时约 20 分钟；全目录导入不适合继续依赖同步请求。
- 部分证据文件：`reports/performance/H-UDMP-NHSA-DIR-IMPORT-BASELINE-20260506020149.md`。
- 工程响应：已新增异步导入任务 API、`sys_import_batch`、`sys_import_failure`、导入失败查询接口，并完成自动化测试覆盖。
- 工程响应更新：上传文件已改为先写入服务端运行时暂存目录，并在 `sys_import_batch.source_file_path` 中保留路径。
- 工程响应更新：`NHSA_FULL_SPEC` 已改为从暂存路径流式读取，并按批次刷新任务进度和统计。
- 注意：当前异步实现仍是 MVP 基线，后台任务运行在 FastAPI 进程内；后续全量生产化导入应升级为队列/Worker、失败批次重试和暂存文件清理。

建议恢复命令：

```powershell
cd <repo-root>\src\backend
.\.venv\Scripts\python.exe -m pytest ../../tests -q
```

## 9. Recommended Next Steps

优先级从高到低：

1. 使用 `tools/H-UDMP-UAT-DEMO-v1.0.ps1` 在目标测试环境执行一轮 UAT 冒烟，并归档证据。
2. 增加失败批次重试和按文件续跑机制。
3. 用新的流式异步路径重新执行完整 NHSA 目录导入。

## 10. Continuation Prompt

后续在新对话或新任务中，可以用以下提示恢复项目上下文：

```text
继续 H-UDMP 项目开发。请先阅读 docs/00-governance/H-UDMP-PROJECT-HANDOFF-v1.0.md、README.md、CHANGELOG.md，然后从当前异步导入基线继续：运行 pytest，确认 Docker API 可用，下一步实现服务端文件暂存、分块导入、进度刷新和失败批次重试，再执行完整 NHSA 目录导入验证。
```
