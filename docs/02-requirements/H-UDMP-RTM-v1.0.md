# H-UDMP Requirements Traceability Matrix

> Version: v1.0
> Status: Verified
> Date: 2026-05-06
> Owner: H-UDMP Project Team

## 1. Purpose

本文档用于追踪 H-UDMP MVP 需求、设计、开发任务、测试用例和验收证据之间的关系，符合 ISO/IEC/IEEE 29148 对需求可追溯性的要求。

本版本将 MVP 主链路从需求评审状态推进到实现/验证状态。验证基线为：

- Local automated test suite: `20 passed`.
- API contract tests: `tests/integration/test_app_contract.py`.
- MVP integration tests: `tests/integration/test_mvp_e2e_flow.py`.
- Unit tests: `tests/unit/`.
- Performance evidence: `reports/performance/`.

## 2. MVP Requirements Traceability

| Req ID | Requirement | Priority | Source | Implementation Area | QA Scenario | Test Cases | Verification Evidence | Status |
|---|---|:---:|---|---|---|---|---|---|
| MVP-REQ-001 | 系统必须提供健康检查接口 | P0 | MVP Taskbook | `GET /health` | QA-010 | TC-001 | `test_health_endpoint` | Verified |
| MVP-REQ-002 | 系统必须支持科室字典导入 | P0 | MVP Taskbook | `POST /api/v1/departments/import` | QA-001 | TC-003, TC-004, TC-029 | `test_mvp_department_material_spd_mapping_flow`, `test_import_exception_scenarios` | Verified |
| MVP-REQ-003 | 系统必须支持科室检索 | P0 | MVP Taskbook | `GET /api/v1/departments/search` | QA-001 | TC-005, TC-006 | `test_mvp_department_material_spd_mapping_flow` | Verified |
| MVP-REQ-004 | 系统必须支持耗材字典导入（含 MVP 模板路径） | P0 | MVP Taskbook | `POST /api/v1/materials/import` (`MVP_TEMPLATE`) | QA-002 | TC-007, TC-008, TC-030–TC-033 | `test_mvp_department_material_spd_mapping_flow`, `test_import_exception_scenarios` | Verified |
| MVP-REQ-005 | 系统必须支持耗材检索 | P0 | MVP Taskbook | `GET /api/v1/materials/search` | QA-002 | TC-010, TC-011 | `test_mvp_department_material_spd_mapping_flow`, `test_nhsa_disabled_intersection_sets_material_inactive` | Verified |
| MVP-REQ-006 | 系统必须支持耗材规格值和单位拆分 | P0 | MVP Taskbook | Material import service | QA-003 | TC-009 | `tests/unit/test_spec_parse.py`, MVP material import flow | Verified |
| MVP-REQ-007 | 系统必须支持外部编码映射解析 | P0 | MVP Taskbook | `POST /api/v1/mapping/resolve` | QA-004 | TC-012 | `test_mvp_department_material_spd_mapping_flow` | Verified |
| MVP-REQ-008 | 未匹配编码必须创建待审核任务 | P0 | MVP Taskbook | `sys_mapping_review_task` | QA-005 | TC-013 | `test_mapping_review_approve_reject_flow` | Verified |
| MVP-REQ-009 | 审核通过后必须生成有效映射 | P0 | MVP Taskbook | Review approve API | QA-006 | TC-014, TC-016 | `test_mapping_review_approve_reject_flow` | Verified |
| MVP-REQ-010 | 写入型请求必须支持幂等 | P0 | MVP Taskbook | `sys_exchange_log` | QA-007, QA-008 | TC-017, TC-018 | `test_department_import_idempotency_replay_and_conflict`, hash unit tests | Verified |
| MVP-REQ-011 | 系统必须记录交换日志 | P0 | MVP Taskbook | `sys_exchange_log` | QA-009 | TC-019, TC-020 | `test_mvp_department_material_spd_mapping_flow`, `app/api/routes/exchange.py` | Verified |
| MVP-REQ-012 | 系统必须提供 Swagger/OpenAPI 文档 | P0 | MVP Taskbook | FastAPI OpenAPI | UAT | TC-021 | `test_openapi_contains_mvp_paths` | Verified |
| MVP-REQ-013 | MVP 接口必须使用服务级 API Key | P1 | MVP Taskbook | Auth middleware | QA-010 | TC-002 | `test_protected_api_uses_error_envelope_without_api_key` | Verified |
| MVP-REQ-014 | 系统必须支持 NHSA C09 类全量规格型号源表导入（识别 21 字段、写入暂存并规范化入主数据） | P0 | MVP Taskbook, Import mapping | `materials/import` `NHSA_FULL_SPEC`, `stg_nhsa_material_specs` | QA-002 | TC-022, TC-023 | `test_nhsa_sample_workbooks_import`, NHSA validation/performance reports | Verified |
| MVP-REQ-015 | 系统必须支持 NHSA 停用码源表导入至暂存并在报告中体现与主数据对齐结果 | P0 | MVP Taskbook, Import mapping | `materials/import` `NHSA_DISABLED` | QA-002 | TC-024 | `test_nhsa_sample_workbooks_import`, NHSA validation report | Verified |
| MVP-REQ-016 | 系统必须支持 NHSA 转码源表导入并区分变更类型（含旧码到新码可追溯） | P0 | MVP Taskbook, Import mapping | `materials/import` `NHSA_TRANSCODE`, `GET /api/v1/materials/transcode/resolve` | QA-002 | TC-025, TC-027 | `test_nhsa_sample_workbooks_import` | Verified |
| MVP-REQ-017 | 系统必须支持医疗器械分类目录 DOCX 抽取并写入参考表 | P0 | MVP Taskbook, Import mapping | `materials/import` `DEVICE_CLASSIFICATION_CATALOG`, `ref_device_classification_catalog` | QA-002 | TC-026, TC-038 | `test_device_classification_catalog_import`, async import task coverage | Verified |
| MVP-REQ-018 | 系统必须在导入链路中处理停用码与标准耗材主数据的关系（导入报告或状态字段，符合 MVP 生命周期约定） | P0 | Import mapping | Disabled staging + master reconcile | QA-002 | TC-028 | `test_nhsa_disabled_intersection_sets_material_inactive` | Verified |
| MVP-REQ-019 | 审核拒绝必须将任务置为 `REJECTED` 且不生成新的 ACTIVE 映射 | P0 | MVP Taskbook | Review reject API | QA-006 | TC-015 | `test_mapping_review_approve_reject_flow` | Verified |
| MVP-REQ-020 | MVP 测试环境应满足 QA 计划中的性能效率目标（检索/映射 P99、批量导入完成性、交换日志完整率、C09 批量导入） | P1 | QA Plan | Core APIs, import pipeline | QA-002, QA-004, QA-009 | PT-001–PT-006 | `H-UDMP-PERF-BASELINE-20260506002616`, `H-UDMP-NHSA-REAL-IMPORT-BASELINE-20260506003013` | Verified |
| MVP-REQ-021 | 系统必须支持大文件异步导入任务、进度查询和失败行查询 | P0 | Performance baseline, API spec | `POST /api/v1/import-tasks/materials`, `GET /api/v1/import-tasks*`, `sys_import_batch`, `sys_import_failure` | QA-002 | TC-034–TC-038 | `test_async_material_import_task_and_failures`, full-directory baseline decision | Verified |

## 2A. H-MDM Manufacturer Vendor Requirements

| 需求编号 | 需求名称 | 需求描述 | 后端实现文件 | 前端实现文件 | 测试用例 | 当前状态 | 是否纳入 UAT | 备注 |
|---|---|---|---|---|---|---|---|---|
| HMDM-VENDOR-001 | 厂商机构档案 | 新增、查询、编辑、启用/停用、提交审核、审核发布厂商机构主数据 | `src/backend/app/api/routes/manufacturer_vendors.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | H-MDM 基础主数据 |
| HMDM-VENDOR-002 | 厂商别名库 | 维护英文名、简称、曾用名、医保目录原始名称、门户名称、设备台账历史名称 | `src/backend/app/services/manufacturer_vendors.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | 别名参与检索 |
| HMDM-VENDOR-003 | 厂商角色管理 | 同一厂商可维护生产厂家、注册人、备案人、代理商、供应商、服务商等多个角色 | `src/backend/app/api/routes/manufacturer_vendors.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | 支持多业务域 |
| HMDM-VENDOR-004 | 厂商母子公司关系 | 维护母公司、子公司、集团成员关系 | `src/backend/app/models/tables.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | 支持关系查询 API |
| HMDM-VENDOR-005 | 厂商收购/更名/合并关系 | 维护被收购、曾用名、合并、授权代理、授权售后等关系 | `src/backend/app/api/routes/manufacturer_vendors.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | 人工确认 |
| HMDM-VENDOR-006 | 厂商外部编码映射 | 维护 NHSA/SPD/HIS/FINANCE/SUPPLIER_PORTAL/EQUIPMENT_OS 等外部编码 | `src/backend/app/api/routes/manufacturer_vendors.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | 支持外部原始名称检索 |
| HMDM-VENDOR-007 | 医保耗材厂商自动提取 | 医保耗材导入时自动提取生产企业、注册人、备案人、厂家等候选 | `src/backend/app/services/import_pipeline.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | 写入候选表 |
| HMDM-VENDOR-008 | 厂商候选审核 | 候选可创建新厂商、映射已有厂商、合并到已有厂商别名/外部映射、忽略，并支持批量处理 | `src/backend/app/api/routes/manufacturer_vendors.py` | `src/frontend/src/components/ManufacturerVendorWorkbench.tsx` | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | 合并不创建供应商业务流程 |
| HMDM-VENDOR-009 | 厂商主数据外部查询 API | 外部系统按关键字、角色、业务域查询厂商、详情和关系 | `src/backend/app/api/routes/manufacturer_vendors.py` | N/A | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | `/api/external/manufacturer-vendors*` |
| HMDM-VENDOR-010 | 医学装备运营平台厂商引用 | 医学装备运营平台引用生产厂家、供应商、售后服务商 `org_id` | `src/backend/app/api/routes/manufacturer_vendors.py` | N/A | `test_manufacturer_vendor_master_data_flow` | Verified | Yes | H-MDM 不管理设备资产实例 |

## 3. Performance Tests ↔ Requirements

| Test ID | Requirement | Scenario | Evidence | Status |
|---|---|---|---|---|
| PT-001 | MVP-REQ-020 | 科室检索 P99 ≤ 500ms | `department_search_keyword` P99 7.97ms | Verified |
| PT-002 | MVP-REQ-020 | 耗材检索 P99 ≤ 500ms | `material_search_yb_code_27` P99 4.71ms | Verified |
| PT-003 | MVP-REQ-020 | 映射解析 P99 ≤ 500ms | `mapping_resolve_spd_material` P99 11.19ms | Verified |
| PT-004 | MVP-REQ-020 | 导入 1,000 行耗材可完成并返回明细 | 1,000 rows, 0 failures, 452.55ms | Verified |
| PT-005 | MVP-REQ-020 | 交换日志完整率 ≥ 99% | `exchange_log_query` P99 6.41ms and integration log query coverage | Verified |
| PT-006 | MVP-REQ-020 | C09 6,132 行源文件导入可完成并返回明细 | Real C09: 6,132 rows, 5,783 unique keys, 0 failures | Verified |
| PT-007 | MVP-REQ-021 | 全目录或近百万行文件必须走异步导入任务 | Full-directory baseline marks immediate async required | Verified |

## 4. Status Definition

| Status | Meaning |
|---|---|
| Draft | 需求已记录，尚未评审 |
| Review | 需求已进入评审，可用于开发准入检查 |
| Approved | 需求已评审，可进入开发 |
| Implemented | 代码已实现，尚未完成自动化或验收证据闭环 |
| Verified | 代码、测试和可追溯证据已形成闭环 |
| Deferred | 延期到后续阶段 |
| Rejected | 已拒绝，不再实施 |

## 5. Residual Notes

- RTM 的 `Verified` 表示 MVP 工程基线和自动化/报告证据已闭环，不代表院方 UAT 已签署。
- 性能结论基于 2026-05-06 本地/Docker 测试环境；正式环境验收应重新执行性能基线脚本并归档报告。
- 大文件全目录同步导入已被性能证据判定为不适合 UAT 主路径，因此 MVP 以异步导入任务作为后续全量导入入口。
