# H-UDMP MVP Performance Baseline

> Document ID: H-UDMP-PERFORMANCE-BASELINE  
> Version: v1.0  
> Status: Review  
> Date: 2026-05-06  
> Owner: H-UDMP Project Team  
> Source: `docs/06-testing/H-UDMP-TEST-PLAN-v1.0.md`

## 1. Purpose

本文档定义 H-UDMP MVP 性能基线测试方法、指标口径和证据输出方式。性能基线用于判断当前实现是否满足 MVP 验收目标，并为后续大文件导入优化提供量化依据。

## 2. Scope

本阶段覆盖：

- 科室检索。
- 耗材 27 位码精确检索。
- SPD 耗材映射解析。
- 交换日志查询。
- MVP 耗材模板 1,000 行导入。

本阶段暂不覆盖：

- 多节点部署压测。
- 真实生产规模并发。
- 长时间稳定性测试。
- FHIR、外报、药品、DRG/DIP 等非 MVP 能力。

## 3. Metrics

| Metric | Meaning |
|---|---|
| Avg | 平均响应时间 |
| P50 | 中位响应时间 |
| P95 | 95 分位响应时间 |
| P99 | 99 分位响应时间 |
| Max | 最大响应时间 |
| Import elapsed | 导入接口从请求发起到响应返回的总耗时 |

## 4. Targets

| Scenario | Target |
|---|---:|
| 科室检索 P99 | ≤ 500 ms |
| 耗材检索 P99 | ≤ 500 ms |
| 映射解析 P99 | ≤ 500 ms |
| 交换日志查询 P99 | ≤ 500 ms |
| MVP 耗材模板 1,000 行导入 | 可完成并返回导入报告 |

说明：当前目标为 MVP 测试环境基线，不代表生产容量承诺。

## 5. Test Tool

脚本：

```text
tools/H-UDMP-PERF-BASELINE-v1.0.py
```

默认命令：

```powershell
cd <repo-root>
.\src\backend\.venv\Scripts\python.exe .\tools\H-UDMP-PERF-BASELINE-v1.0.py `
  --api-base-url "http://127.0.0.1:8101" `
  --api-key "change-me" `
  --iterations 50 `
  --import-rows 1000 `
  --environment-name "local-dev" `
  --candidate-version "v0.15.0" `
  --commit-sha "<commit-sha>" `
  --evidence-owner "<owner>"
```

输出目录：

```text
reports/performance/
```

脚本会生成：

- JSON 原始结果。
- Markdown 摘要报告。
- 1,000 行耗材导入临时 CSV，位于 `reports/performance/generated/`。

目标 UAT 环境执行记录模板：

```text
docs/06-testing/H-UDMP-UAT-PERFORMANCE-EXECUTION-RECORD-v1.0.md
```

## 6. Preconditions

| Item | Expected |
|---|---|
| API service | `GET /health` 返回 `status=ok` |
| Database | Alembic migration 已执行 |
| API key | 与服务端 `API_KEY` 一致 |
| Sample templates | `data/templates` 文件存在 |
| SPD sample | `data/samples/H-UDMP-SAMPLE-SPD-MAPPINGS-v1.0.csv` 存在 |

## 7. Interpretation

| Result | Meaning |
|---|---|
| PASS | P99 不超过目标值 |
| REVIEW | P99 超过目标值，需要复测或优化 |
| Import completed | 1,000 行导入返回报告，可进入下一步 |
| Import failed | 需先修复导入稳定性，再讨论性能 |

若本机正在运行其他重负载任务，或 Docker Desktop 资源较低，应重复执行至少 3 次，取较稳定结果作为评审材料。

## 8. Optimization Triggers

出现以下情况时，进入大文件导入优化：

- 1,000 行导入在测试环境中明显超过现场可接受耗时。
- 真实 NHSA 文件导入出现超时。
- 导入期间 API 查询明显受阻。
- 导入失败后无法清晰定位失败行或无法重复执行。

候选优化方向：

- 分批写入和周期性 flush。
- 导入任务异步化。
- 导入进度查询 API。
- 失败行落表和失败批次重试。
- 对 `yb_code_27`、分类、注册证号等高频字段补充索引复核。

## 9. Evidence

每次性能基线应归档：

- 脚本命令。
- API 服务版本。
- 数据库迁移版本。
- JSON 原始结果。
- Markdown 摘要报告。
- 是否存在环境异常说明。

## 10. Real NHSA Import Baseline

已使用用户提供的真实 NHSA 文件执行一次导入耗时基线：

| Source Type | Source Rows | Unique Keys | Skipped Duplicates | Success | Failed | Elapsed |
|---|---:|---:|---:|---:|---:|---:|
| `NHSA_FULL_SPEC` | 6,132 | 5,783 | 349 | 5,783 | 0 | 6,459.12 ms |
| `NHSA_DISABLED` | 13,084 | 13,083 | 1 | 13,083 | 0 | 1,716.8 ms |
| `NHSA_TRANSCODE` | 5,408 | 5,408 | 0 | 5,408 | 0 | 752.45 ms |

报告文件：

```text
reports/performance/H-UDMP-NHSA-REAL-IMPORT-BASELINE-20260506003013.md
reports/performance/H-UDMP-NHSA-REAL-IMPORT-BASELINE-20260506003013.json
```

结论：

- 当前三份真实源文件总导入耗时约 8.93 秒。
- 单个最大导入为 C09 全量规格型号表，约 6.46 秒。
- 该结论仅适用于 C09、停用表、转码表三文件小范围验证；不代表完整 NHSA 发布目录可继续使用同步 HTTP 导入。
- 完整目录验证见第 11 节，已决定新增异步导入任务、进度查询和失败行持久化。

若后续导入全部医保耗材类别或更大源文件，应重新运行真实导入基线，再决定是否启用异步导入。

## 11. Full Directory Import Finding

已对 `D:\20260320发布-医保医用耗材分类与代码数据库更新-14737190条` 启动全目录导入基线。该目录包含 28 个全量规格型号文件、停用表和转码表，共 30 个目标 Excel 文件。

部分结果：

| File | Status | Elapsed |
|---|---|---:|
| C01 非血管介入治疗类材料 | HTTP 500 | 253.83 s |
| C02 血管介入治疗类材料 | Success | 397.28 s |
| C03 骨科材料 01 | Success | 1,174.75 s |
| C03 骨科材料 02 | Success | 1,166.90 s |

截至中止同步导入时，已成功处理：

- 源行数：2,333,736。
- 成功处理数：2,273,759。
- 跳过重复数：59,977。

结论：

- 全目录导入不应继续依赖同步 HTTP 请求。
- 单个大文件可接近 100 万源行，单文件导入耗时约 20 分钟。
- 大文件导入需要异步任务、进度查询和失败行持久化。
- C01 的失败暴露出真实源字段长度和复杂规格文本问题；已修正复杂规格误拆分和主数据字段长度，并新增迁移。

已落地的工程响应：

- 新增 `sys_import_batch` 记录导入任务状态、统计、进度和最终报告。
- 新增 `sys_import_failure` 记录行级失败和文件级失败。
- 新增异步导入任务 API，可先返回 `PENDING` 批次，再通过查询接口观察结果。
- 当前进度粒度为任务级状态和最终统计；后续如继续全量导入，应升级为服务端文件暂存、分块提交、周期性进度刷新和失败批次重试。

全目录异步演练脚本：

```text
tools/H-UDMP-NHSA-ASYNC-IMPORT-REHEARSAL-v1.0.py
```

执行记录模板：

```text
docs/06-testing/H-UDMP-NHSA-ASYNC-IMPORT-REHEARSAL-v1.0.md
```

## 9. Evidence Safety Notes

- Do not commit unsanitized generated performance reports or run logs.
- Use `<NHSA_SOURCE_DIR>` for local NHSA source directories and `<REPO_ROOT>` for developer workspace paths in shared evidence.
- Record API keys, database URLs, and other credentials only as masked values.
- NHSA import scripts omit local source paths by default; use `--include-local-paths` only for private local evidence that will not be committed.
