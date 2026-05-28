# H-UDMP MVP Test Plan

> Version: v1.0  
> Status: Review  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team  
> Source: `docs/00-governance/H-UDMP-QA-PLAN-v1.0.md`, `docs/02-requirements/H-UDMP-RTM-v1.0.md`

## 1. Purpose

本文档将 QA 计划落细为 MVP 可执行测试计划，覆盖科室导入、耗材导入、检索、映射、审核、幂等、交换日志、API Key 和基础性能。

## 2. Test Scope

### 2.1 In Scope

- `GET /health`
- 科室导入与检索
- 耗材导入、规格拆分与检索
- NHSA C09 全量规格型号表导入
- NHSA 停用表导入
- NHSA 转码表导入
- 医疗器械分类目录抽取
- 映射解析
- 待审核任务创建、查询、审核通过、审核拒绝
- 幂等写入与冲突检测
- 交换日志查询
- API Key 认证
- MVP 性能基线

### 2.2 Out of Scope

- FHIR API
- 外报网关
- 药品字典
- 诊疗项目字典
- DRG/DIP
- 完整 RBAC
- 前端 UI 自动化

## 3. Test Data

路径默认相对于仓库根目录；医保与药监局原始制品可通过环境变量覆盖，便于 CI 与异地评审复现（见 [`data/samples/README.md`](../../data/samples/README.md)）。

| Dataset | Path / Resolution | Minimum Size |
|---|---|---:|
| Departments template | `data/templates/H-UDMP-TEMPLATE-DEPARTMENTS-v1.0.csv` | 100 rows for UAT |
| Materials template | `data/templates/H-UDMP-TEMPLATE-MATERIALS-v1.0.csv` | 1,000 rows for UAT |
| SPD mapping sample | `data/samples/H-UDMP-SAMPLE-SPD-MAPPINGS-v1.0.csv` | 200 rows for UAT |
| NHSA disabled source | `${HUDMP_NHSA_DIR}/30、停用表.xlsx` | Observed 13,084 rows |
| NHSA transcode source | `${HUDMP_NHSA_DIR}/31、转码表.xlsx` | Observed 5,408 rows |
| NHSA C09 full spec source | `${HUDMP_NHSA_DIR}/16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx` | Observed 6,132 rows |
| Device classification catalog | `${HUDMP_DEVICE_CATALOG_DOCX}`（默认 `data/samples/external/nmpa/医疗器械分类目录.docx`） | About 1,018 classification rows |

环境变量说明：`HUDMP_NHSA_DIR` 指向包含上述 NHSA Excel 的目录；未设置时在文档与脚本中默认 `data/samples/external/nhsa`。原始文件名保持院方或发布包原名即可。

样例文件中的演示数据可用于冒烟测试；正式 UAT 应由院方提供脱敏或非隐私样例数据。

## 4. Test Cases

| Test ID | Requirement | QA ID | Scenario | Expected Result |
|---|---|---|---|---|
| TC-001 | MVP-REQ-001 | QA-010 | 调用 `GET /health` | 返回服务、数据库、Redis 状态 |
| TC-002 | MVP-REQ-013 | QA-010 | 无 `X-API-Key` 调用受保护 API | 返回 `UNAUTHORIZED` |
| TC-003 | MVP-REQ-002 | QA-001 | 导入有效科室 CSV | 返回导入批次和成功数 |
| TC-004 | MVP-REQ-002 | QA-001 | 导入缺少 `dept_code` 的科室行 | 返回失败明细，不影响其他行 |
| TC-005 | MVP-REQ-003 | QA-001 | 按 `dept_code` 检索科室 | 返回唯一科室 |
| TC-006 | MVP-REQ-003 | QA-001 | 按别名关键字检索科室 | 返回匹配科室 |
| TC-007 | MVP-REQ-004 | QA-002 | 导入有效耗材 CSV | 返回导入批次和成功数 |
| TC-008 | MVP-REQ-004 | QA-002 | 导入非 27 位医保码 | 返回失败明细 |
| TC-009 | MVP-REQ-006 | QA-003 | 导入规格 `22mm` | 拆分为 `spec_value=22`、`spec_unit=mm` |
| TC-010 | MVP-REQ-005 | QA-002 | 按 `yb_code_27` 检索耗材 | 返回唯一耗材 |
| TC-011 | MVP-REQ-005 | QA-002 | 按 `reg_number` 检索耗材 | 返回匹配耗材 |
| TC-012 | MVP-REQ-007 | QA-004 | 解析已存在 SPD 映射 | 返回 `MATCHED` |
| TC-013 | MVP-REQ-008 | QA-005 | 解析未知 SPD 编码 | 返回 `PENDING_REVIEW` 并创建任务 |
| TC-014 | MVP-REQ-009 | QA-006 | 审核通过待审核任务 | 创建 ACTIVE 映射 |
| TC-015 | MVP-REQ-019 | QA-006 | 审核拒绝待审核任务 | 任务状态变为 `REJECTED` |
| TC-016 | MVP-REQ-009 | QA-006 | 审核通过后再次解析 | 返回 `MATCHED` |
| TC-017 | MVP-REQ-010 | QA-007 | 同一幂等键同报文重复提交 | 返回首次处理结果 |
| TC-018 | MVP-REQ-010 | QA-008 | 同一幂等键不同报文提交 | 返回 `IDEMPOTENCY_CONFLICT` |
| TC-019 | MVP-REQ-011 | QA-009 | 按来源系统查询交换日志 | 返回匹配日志 |
| TC-020 | MVP-REQ-011 | QA-009 | 按状态和时间查询交换日志 | 返回分页结果 |
| TC-021 | MVP-REQ-012 | UAT | 打开 Swagger/OpenAPI | 可查看并调试 MVP API |
| TC-022 | MVP-REQ-014 | QA-002 | 读取 C09 全量规格型号表 `Query1` | 识别 21 个字段 |
| TC-023 | MVP-REQ-014 | QA-002 | 导入 C09 全量规格型号表 | 写入 `stg_nhsa_material_specs` 并生成报告 |
| TC-024 | MVP-REQ-015 | QA-002 | 导入停用表 | 写入 13,084 条停用码或给出差异报告 |
| TC-025 | MVP-REQ-016 | QA-002 | 导入转码表 | 写入 5,408 条转码关系并识别 `变更`、`映射` |
| TC-026 | MVP-REQ-017 | QA-002 | 抽取医疗器械分类目录 | 至少识别 7 个核心字段 |
| TC-027 | MVP-REQ-016 | QA-002 | 调用 `GET /api/v1/materials/transcode/resolve` 查询旧码到新码关系 | `原27位码 → 27位码` 可追溯，未命中返回 `NOT_FOUND` |
| TC-028 | MVP-REQ-018 | QA-002 | 停用码与标准耗材主数据匹配 | 停用状态进入导入报告或标准记录状态处理 |
| TC-029 | MVP-REQ-002 | QA-001 | 导入缺少 `dept_code` 的科室模板 | 返回导入报告，失败明细定位到 `dept_code` |
| TC-030 | MVP-REQ-004 | QA-002 | 使用非法 `source_type` 导入耗材 | 返回 `INVALID_SOURCE_TYPE` |
| TC-031 | MVP-REQ-004 | QA-002 | 指定不存在的 Excel `sheet_name` | 返回 `IMPORT_FILE_INVALID`，不回退到其他工作表 |
| TC-032 | MVP-REQ-004 | QA-002 | MVP 耗材模板同文件出现重复 `yb_code_27` | 只处理唯一业务键，重复行进入重复统计 |
| TC-033 | MVP-REQ-004 | QA-002 | MVP 耗材模板导入非 27 位医保码 | 返回导入报告，失败明细定位到 `yb_code_27` |
| TC-034 | MVP-REQ-021 | QA-002 | 创建异步耗材导入任务 | 返回 `batch_id` 和 `PENDING` 状态 |
| TC-035 | MVP-REQ-021 | QA-002 | 查询异步导入任务进度 | 返回 `COMPLETED`/`COMPLETED_WITH_ERRORS` 和统计 |
| TC-036 | MVP-REQ-021 | QA-002 | 查询异步导入失败行 | 返回行号、字段名和失败原因 |
| TC-037 | MVP-REQ-021 | QA-002 | 异步导入 `NHSA_FULL_SPEC` | 服务端暂存文件存在，后台按路径流式读取并返回源行、成功、失败统计 |
| TC-038 | MVP-REQ-017 | QA-002 | 异步导入医疗器械分类目录 | 写入 `ref_device_classification_catalog` 并返回分类行统计 |

## 5. Performance Tests

下列场景映射 **MVP-REQ-020**（性能效率基线）；详细定义见 [H-UDMP-QA-PLAN-v1.0.md](../00-governance/H-UDMP-QA-PLAN-v1.0.md)。

| Test ID | Scenario | Target |
|---|---|---:|
| PT-001 | 科室检索 P99 | ≤ 500ms |
| PT-002 | 耗材检索 P99 | ≤ 500ms |
| PT-003 | 映射解析 P99 | ≤ 500ms |
| PT-004 | 导入 1,000 行耗材 | 可完成并返回明细 |
| PT-005 | 交换日志完整率 | ≥ 99% |
| PT-006 | C09 6,132 行源文件导入 | 可完成并返回明细 |

## 6. Entry Criteria

- API specification is in Review status.
- Data model document is in Review status.
- Test database can be initialized.
- Sample data files are available.
- Real source files are available or their representative samples are provided.
- `GET /health` works in the target test environment.

## 7. Exit Criteria

- All P0 test cases pass.
- No Blocker or Critical defect remains open.
- Performance targets pass in MVP test environment or deviation is approved.
- Test report and UAT record are attached to release evidence.
- NHSA source import deviations are documented if observed row counts differ from baseline.

## 8. Defect Management

| Severity | Definition |
|---|---|
| Blocker | 服务不可用、核心流程无法执行、数据损坏 |
| Critical | MVP 验收项失败且无可接受绕行方案 |
| Major | 功能受影响但存在临时绕行方案 |
| Minor | 低影响问题或文档/提示问题 |

## 9. Acceptance Evidence

- Automated test report.
- Import report samples.
- API test collection or request records.
- Performance test summary.
- Defect list and closure record.
- UAT confirmation.
