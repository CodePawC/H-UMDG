# H-UDMP MVP Data Model

> Version: v1.0  
> Status: Review  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team  
> Source: `docs/02-requirements/H-UDMP-MVP-TASKBOOK-v1.0.md`

## 1. Purpose

本文档固化 H-UDMP MVP 阶段的数据模型基线，用于数据库迁移、后端模型、接口开发和测试数据准备。

## 2. Entity Overview

```text
NHSA Excel / NMPA DOCX sources
  ↓
stg_nhsa_material_specs
stg_nhsa_material_disabled
stg_nhsa_material_transcode
ref_device_classification_catalog
dict_equipment_categories
dict_equipment_standard_names
  ↓
manufacturer_vendor_candidate
  ↓
manufacturer_vendor_master ← dict_material_specs       dict_departments
        ↑                      ↑
        └── sys_mapping_bridge ┘
                 │
          sys_mapping_review_task

sys_exchange_log records write, import, and resolve operations.
sys_api_registry records MVP API and external system metadata.
sys_import_batch records async import task status and progress.
sys_import_failure records file-level and row-level import failures.
manufacturer_vendor_* records H-MDM manufacturer/vendor institution identity.
dict_equipment_* records H-MDM equipment dictionary standards for external system references.
```

MVP 不实现药品、诊疗项目、FHIR、外报、冷热分离相关业务表；但为真实医保耗材导入增加暂存表和医疗器械分类参考表。

## 3. Common Rules

### 3.1 Common Columns

所有业务表建议包含：

| Column | Type | Required | Description |
|---|---|:---:|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | Yes | 创建时间 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Yes | 更新时间 |
| `created_by` | VARCHAR(100) | No | 创建人或调用方 |
| `updated_by` | VARCHAR(100) | No | 更新人或调用方 |

### 3.2 Enum Values

| Field | Values |
|---|---|
| Master data status | `ACTIVE`, `INACTIVE` |
| Mapping status | `ACTIVE`, `INACTIVE` |
| Review task status | `PENDING`, `APPROVED`, `REJECTED` |
| Mapping category | `department`, `material` |
| Mapping rule | `EXACT`, `MANUAL`, `IMPORT` |
| Exchange status | `SUCCESS`, `FAILED`, `CONFLICT` |
| Data category | `department`, `material`, `mapping`, `import` |
| API status | `Active`, `Inactive` |
| Protocol | `REST`, `File` |
| Import source type | `MVP_TEMPLATE`, `NHSA_FULL_SPEC`, `NHSA_DISABLED`, `NHSA_TRANSCODE`, `DEVICE_CLASSIFICATION_CATALOG`, `EQUIPMENT_CATEGORY`, `EQUIPMENT_STANDARD_NAME` |
| Original code status | `保留`, `停用` |
| NHSA change type | `保留`, `新增`, `变更`, `映射` |

## 4. Tables

### 4.1 `dict_departments`

Purpose: 标准科室字典。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `dept_id` | UUID | Yes | Primary key |
| `dept_code` | VARCHAR(100) | Yes | Unique |
| `dept_name` | VARCHAR(200) | Yes | Not empty |
| `dept_alias` | VARCHAR(500) | No | Semicolon-separated aliases |
| `parent_dept_id` | UUID | No | FK to `dict_departments.dept_id` |
| `dept_type` | VARCHAR(50) | No | 院区/临床/医技/行政/诊疗组 |
| `oid` | VARCHAR(200) | No | 院内 OID |
| `status` | VARCHAR(20) | Yes | `ACTIVE` or `INACTIVE` |
| `source_batch_id` | VARCHAR(100) | No | Import batch ID |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `uq_dict_departments_dept_code` | `dept_code` | Unique |
| `idx_dict_departments_name` | `dept_name` | B-tree or trigram |
| `idx_dict_departments_status` | `status` | B-tree |
| `idx_dict_departments_parent` | `parent_dept_id` | B-tree |

### 4.2 `dict_material_specs`

Purpose: 耗材规格主数据。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `material_id` | UUID | Yes | Primary key |
| `manufacturer_org_id` | UUID | No | FK to `manufacturer_vendor_master.id`; production manufacturer |
| `registrant_org_id` | UUID | No | FK to `manufacturer_vendor_master.id`; medical device registrant |
| `filer_org_id` | UUID | No | FK to `manufacturer_vendor_master.id`; medical device filer |
| `yb_code_27` | VARCHAR(50) | Yes | Unique; NHSA 27-character codes are stored as strings and may include letters |
| `yb_code_20` | VARCHAR(50) | No | Missing value can be derived from first 20 chars of `yb_code_27` |
| `goods_id` | VARCHAR(100) | No | NHSA source `GOODS_ID` |
| `udi` | VARCHAR(200) | No | UDI from NHSA source |
| `original_yb_code_27` | VARCHAR(50) | No | Original 27-digit code from source |
| `original_code_status` | VARCHAR(20) | No | Example: `保留`, `停用` |
| `code_change_type` | VARCHAR(20) | No | Example: `保留`, `新增`, `变更`, `映射` |
| `generic_name` | VARCHAR(200) | Yes | Not empty |
| `brand_name` | VARCHAR(200) | No | Brand or manufacturer |
| `cat_level_1` | VARCHAR(200) | No | NHSA first-level category for frequent filtering |
| `cat_level_2` | VARCHAR(200) | No | NHSA second-level category for frequent filtering |
| `cat_level_3` | VARCHAR(200) | No | NHSA third-level category for frequent filtering |
| `material_attr` | VARCHAR(100) | No | Material attribute |
| `feature` | VARCHAR(100) | No | NHSA source feature |
| `spec_value` | VARCHAR(50) | No | Specification value without unit |
| `spec_unit` | VARCHAR(20) | No | Specification unit |
| `model_detail` | VARCHAR(100) | No | Model |
| `reg_number` | VARCHAR(100) | No | Registration number |
| `unit_pkg` | VARCHAR(20) | No | Package unit |
| `insurance_generic_name_code` | VARCHAR(100) | No | 医保通用名编号 |
| `insurance_generic_name` | VARCHAR(200) | No | 医保通用名 |
| `status` | VARCHAR(20) | Yes | `ACTIVE` or `INACTIVE` |
| `source_batch_id` | VARCHAR(100) | No | Import batch ID |
| `extra_attrs` | JSONB | No | Extension attributes |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `uq_dict_material_specs_yb_code_27` | `yb_code_27` | Unique |
| `idx_dict_material_specs_yb_code_20` | `yb_code_20` | B-tree |
| `idx_dict_material_specs_generic_name` | `generic_name` | B-tree or trigram |
| `idx_dict_material_specs_category` | `cat_level_1`, `cat_level_2`, `cat_level_3` | B-tree |
| `idx_dict_material_specs_reg_number` | `reg_number` | B-tree |
| `idx_dict_material_specs_status` | `status` | B-tree |
| `idx_dict_material_specs_manufacturer_org` | `manufacturer_org_id` | B-tree |
| `idx_dict_material_specs_registrant_org` | `registrant_org_id` | B-tree |
| `idx_dict_material_specs_filer_org` | `filer_org_id` | B-tree |

Validation:

- `yb_code_27` and `yb_code_20` are stored as `VARCHAR(50)` to preserve source strings safely; MVP NHSA validation still expects the current 27-character and 20-character code conventions.
- Staging tables keep source code fields as `VARCHAR(50)` for the same reason; application validation, not fixed-width SQL types, enforces NHSA length rules.
- `spec_value` and `spec_unit` should be stored separately when a recognizable value-unit pattern exists.
- Raw source `规格` should be preserved in `extra_attrs.raw_spec` when parsing is uncertain.
- `dict_material_specs` is the normalized master table; raw NHSA columns should be stored first in staging tables.
- 医保耗材主数据不得只保存厂家文本；如候选已匹配，应写入 `manufacturer_org_id`、`registrant_org_id`、`filer_org_id`。

### 4.2A `manufacturer_vendor_master`

Purpose: 厂商机构主数据标准身份，覆盖生产厂家、注册人/备案人、代理商、经销商、配送企业、售后服务商和供应商。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `id` | UUID | Yes | Primary key |
| `organization_code` | VARCHAR(100) | Yes | Unique |
| `standard_name` | VARCHAR(300) | Yes | Unique; cannot be empty |
| `english_name` | VARCHAR(300) | No | Participates in search |
| `short_name` | VARCHAR(200) | No | Participates in search |
| `alias_names` | JSONB | Yes | Alias/history names JSON array; participates in search |
| `unified_social_credit_code` | VARCHAR(18) | No | Unique when present |
| `organization_type` | VARCHAR(50) | No | 企业/事业单位/个体工商户/境外企业/其他 |
| `country_region` | VARCHAR(100) | No | 国家或地区 |
| `province` / `city` / `address` | VARCHAR | No | 地址信息 |
| `legal_representative` | VARCHAR(100) | No | 法定代表人 |
| `status` | VARCHAR(30) | Yes | `enabled`, `disabled`, `cancelled`, `merged`, `renamed` |
| `data_source` | VARCHAR(100) | No | 医保目录/医疗器械注册证/供应商门户/人工维护/设备台账/耗材目录 |
| `quality_status` | VARCHAR(50) | Yes | `normal`, `missing_field`, `duplicate_suspected`, `name_not_standard`, `pending_manual_confirm` |
| `audit_status` | VARCHAR(50) | Yes | `not_submitted`, `pending`, `approved`, `rejected`, `returned` |

### 4.2B `manufacturer_vendor_role`

同一厂商可有多个角色，可同时是生产厂家、注册人、售后服务商、供应商。`role_type` 取值：`manufacturer`、`registrant`、`filer`、`agent`、`dealer`、`distributor`、`after_sales`、`supplier`、`service_provider`；`business_domain` 取值：`drug`、`device`、`consumable`、`reagent`、`equipment`、`service`、`other`。

### 4.2C `manufacturer_vendor_relation`

记录母子公司、集团成员、被收购、曾用名、合并、授权代理、授权售后、区域代理、进口总代和配送关系，包含 `effective_date`、`expired_date`、`evidence_file_url`。

### 4.2D `manufacturer_vendor_external_mapping`

记录 NHSA、SPD、HIS、FINANCE、SUPPLIER_PORTAL、EQUIPMENT_OS、MANUAL、OTHER 等外部系统中的厂商编码与名称映射，支持 `confidence` 和 `audit_status`。

### 4.2E `manufacturer_vendor_candidate`

从医保耗材目录、医疗器械分类目录、设备台账、供应商门户等来源抽取候选厂商。`match_status` 取值：`unmatched`、`matched`、`need_review`、`ignored`；`suggested_action` 取值：`create_new`、`map_existing`、`merge`、`ignore`。

### 4.2F `dict_equipment_categories`

Purpose: 保存设备分类目录标准口径，供医学装备运营管理平台和其它系统引用。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `category_id` | UUID | Yes | Primary key |
| `category_code` | VARCHAR(100) | Yes | Unique |
| `category_name` | VARCHAR(300) | Yes | Not empty |
| `parent_category_id` | UUID | No | FK to `dict_equipment_categories.category_id` |
| `level_no` | INTEGER | No | 分类层级 |
| `source_system` | VARCHAR(100) | No | 来源系统 |
| `source_batch_id` | VARCHAR(100) | No | 导入批次 |
| `status` | VARCHAR(20) | Yes | `ACTIVE` or `INACTIVE` |
| `remark` | TEXT | No | 备注 |

### 4.2G `dict_equipment_standard_names`

Purpose: 保存设备标准名称，可关联设备分类目录、医疗器械分类目录和常见生产厂家 `org_id`。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `standard_id` | UUID | Yes | Primary key |
| `standard_code` | VARCHAR(100) | Yes | Unique |
| `standard_name` | VARCHAR(300) | Yes | Unique; not empty |
| `alias_names` | JSONB | Yes | 设备别名、历史名称 JSON array |
| `category_id` | UUID | No | FK to `dict_equipment_categories.category_id` |
| `device_classification_id` | UUID | No | FK to `ref_device_classification_catalog.catalog_id` |
| `common_manufacturer_org_ids` | JSONB | Yes | 常见生产厂家 `manufacturer_vendor_master.id` 列表 |
| `management_class` | VARCHAR(20) | No | 医疗器械管理类别 |
| `status` | VARCHAR(20) | Yes | `ACTIVE` or `INACTIVE` |
| `source_system` | VARCHAR(100) | No | 来源系统 |
| `source_batch_id` | VARCHAR(100) | No | 导入批次 |
| `remark` | TEXT | No | 备注 |

Rules:

- 装备字典不管理具体设备资产实例。
- 常见生产厂家必须引用 H-MDM 厂商机构主数据 `org_id`，不得将厂家文本作为权威身份。
- 外部系统保存设备分类或设备标准名称标识，业务字段由业务系统维护。

### 4.3 `sys_mapping_bridge`

Purpose: 外部系统编码到标准主数据的映射桥。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `bridge_id` | UUID | Yes | Primary key |
| `category` | VARCHAR(50) | Yes | `department` or `material` |
| `source_system` | VARCHAR(50) | Yes | Example: `SPD` |
| `source_key` | VARCHAR(200) | Yes | External source code |
| `source_desc` | VARCHAR(500) | No | External description |
| `target_master_id` | UUID | Yes | References target master record |
| `target_code` | VARCHAR(100) | No | Target code snapshot |
| `mapping_rule` | VARCHAR(20) | Yes | `EXACT`, `MANUAL`, `IMPORT` |
| `confidence` | DECIMAL(5,4) | No | 0 to 1 |
| `status` | VARCHAR(20) | Yes | `ACTIVE` or `INACTIVE` |
| `last_verified` | TIMESTAMP WITH TIME ZONE | No | Last verification time |

Indexes and constraints:

| Name | Columns | Type |
|---|---|---|
| `uq_sys_mapping_bridge_active_source` | `category`, `source_system`, `source_key` where `status='ACTIVE'` | PostgreSQL partial unique index |
| `idx_sys_mapping_bridge_target` | `target_master_id` | B-tree |
| `idx_sys_mapping_bridge_category_status` | `category`, `status` | B-tree |

Rules:

- MVP active mappings must not contain two targets for the same `category + source_system + source_key`.
- Approval must run in one transaction: mark existing ACTIVE mappings INACTIVE first, then insert the new ACTIVE mapping.
- Target table is determined by `category`.
- Complex fuzzy auto-mapping is out of MVP; uncertain matches become review tasks.

### 4.4 `sys_mapping_review_task`

Purpose: 未匹配或需人工确认的映射审核任务。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `task_id` | UUID | Yes | Primary key |
| `category` | VARCHAR(50) | Yes | `department` or `material` |
| `source_system` | VARCHAR(50) | Yes | Source system |
| `source_key` | VARCHAR(200) | Yes | Source code |
| `source_desc` | VARCHAR(500) | No | Source description |
| `candidate_json` | JSONB | No | Candidate records |
| `status` | VARCHAR(20) | Yes | `PENDING`, `APPROVED`, `REJECTED` |
| `reviewer` | VARCHAR(100) | No | Reviewer |
| `review_comment` | TEXT | No | Review comment |
| `reviewed_at` | TIMESTAMP WITH TIME ZONE | No | Review time |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `idx_sys_mapping_review_task_status` | `status` | B-tree |
| `idx_sys_mapping_review_task_source` | `category`, `source_system`, `source_key` | B-tree |

Rules:

- PENDING tasks for the same `category + source_system + source_key` should not be duplicated.
- APPROVED tasks must create one ACTIVE mapping.

### 4.5 `sys_exchange_log`

Purpose: 写入型请求、映射解析和导入操作的交换日志与幂等记录。

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `log_id` | BIGSERIAL | Yes | Primary key |
| `trace_id` | VARCHAR(100) | Yes | Trace ID |
| `source_system` | VARCHAR(50) | Yes | Source system |
| `source_tx_id` | VARCHAR(200) | Yes | Source transaction ID |
| `target_system` | VARCHAR(50) | No | Default `H-UDMP` |
| `data_category` | VARCHAR(50) | Yes | `department`, `material`, `mapping`, `import` |
| `request_payload` | JSONB | No | Request payload or summary |
| `response_payload` | JSONB | No | Response payload or summary |
| `payload_hash` | VARCHAR(128) | Yes | Hash of request payload |
| `status` | VARCHAR(20) | Yes | `SUCCESS`, `FAILED`, `CONFLICT` |
| `error_code` | VARCHAR(100) | No | Error code |
| `processing_time_ms` | INTEGER | No | Processing time |

Indexes and constraints:

| Name | Columns | Type |
|---|---|---|
| `uq_sys_exchange_log_idempotency` | `source_system`, `source_tx_id` | Unique |
| `idx_sys_exchange_log_status_time` | `status`, `created_at` | B-tree |
| `idx_sys_exchange_log_source_time` | `source_system`, `created_at` | B-tree |

### 4.6 `sys_api_registry`

Purpose: MVP API and external system metadata registry.

| Column | Type | Required | Rule |
|---|---|:---:|---|
| `api_id` | UUID | Yes | Primary key |
| `api_name` | VARCHAR(200) | Yes | API name |
| `source_system` | VARCHAR(50) | No | Source system |
| `target_system` | VARCHAR(50) | No | Target system |
| `protocol` | VARCHAR(20) | Yes | `REST` or `File` |
| `endpoint_url` | VARCHAR(500) | No | Endpoint URL |
| `version` | VARCHAR(20) | Yes | API version |
| `status` | VARCHAR(20) | Yes | `Active` or `Inactive` |
| `owner` | VARCHAR(100) | No | Owner |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `idx_sys_api_registry_status` | `status` | B-tree |
| `idx_sys_api_registry_systems` | `source_system`, `target_system` | B-tree |

### 4.7 `sys_import_batch`

Purpose: 记录异步导入任务、批次状态、进度和汇总统计。

| Column | Type | Required | Notes |
|---|---|:---:|---|
| `batch_id` | VARCHAR(100) | Yes | Primary key; idempotent task id |
| `source_type` | VARCHAR(50) | Yes | `MVP_TEMPLATE`, `NHSA_FULL_SPEC`, `NHSA_DISABLED`, `NHSA_TRANSCODE` |
| `source_system` | VARCHAR(50) | Yes | Caller or import source |
| `source_file_name` | VARCHAR(500) | Yes | Uploaded file name |
| `source_file_path` | VARCHAR(1000) | No | Server-side spool file path for async import and retry design |
| `sheet_name` | VARCHAR(100) | No | Excel sheet |
| `status` | VARCHAR(30) | Yes | `PENDING`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED` |
| `source_row_count` | INTEGER | Yes | Source rows processed |
| `unique_key_count` | INTEGER | Yes | Unique business keys processed |
| `success_count` | INTEGER | Yes | Successful rows or keys |
| `failed_count` | INTEGER | Yes | Row-level failures |
| `skipped_duplicate_count` | INTEGER | Yes | Duplicate rows skipped |
| `duplicate_count` | INTEGER | Yes | Duplicate records |
| `progress_percent` | INTEGER | Yes | 0-100 |
| `error_code` | VARCHAR(100) | No | File-level error code |
| `error_message` | TEXT | No | File-level error message |
| `result_payload` | JSONB | No | Final import report |

Indexes:

| Index | Columns | Type |
|---|---|---|
| `idx_sys_import_batch_status` | `status`, `created_at` | B-tree |
| `idx_sys_import_batch_source_type` | `source_type`, `created_at` | B-tree |

Rules:

- 异步导入任务必须先将上传文件写入运行时暂存目录，再开始后台导入。
- `source_file_path` 不对外返回给调用方，仅用于服务端处理、失败追溯和后续重试。
- 暂存目录由 `HUDMP_IMPORT_SPOOL_DIR` 配置；不得放入只读样例数据目录。
- `NHSA_FULL_SPEC` 使用路径流式读取，后台任务应周期性刷新 `source_row_count`、`success_count`、`failed_count` 和 `progress_percent`。
- MVP 当前进度为行数估算进度；生产化增强应增加失败批次重试和超期文件清理。

### 4.8 `sys_import_failure`

Purpose: 记录导入失败行或文件级失败，用于 UAT 追溯和后续失败重试。

| Column | Type | Required | Notes |
|---|---|:---:|---|
| `failure_id` | BIGINT | Yes | Primary key |
| `batch_id` | VARCHAR(100) | Yes | FK to `sys_import_batch.batch_id` |
| `row_number` | INTEGER | No | Source row number; null for file-level error |
| `field_name` | VARCHAR(100) | No | Failed field |
| `message` | TEXT | Yes | Failure message |
| `raw_payload` | JSONB | No | Failure details |

### 4.9 `stg_nhsa_material_specs`

Purpose: 按 NHSA 全量规格型号源表原样暂存，例如 C09 体外循环材料文件。

| Column | Type | Required | Source Column |
|---|---|:---:|---|
| `stg_id` | UUID | Yes | Generated |
| `batch_id` | VARCHAR(100) | Yes | Import batch |
| `source_file_name` | VARCHAR(500) | Yes | File name |
| `sheet_name` | VARCHAR(100) | Yes | Usually `Query1` |
| `row_number` | INTEGER | Yes | Source row number |
| `goods_id` | VARCHAR(100) | No | `GOODS_ID` |
| `udi` | VARCHAR(200) | No | `UDI` |
| `original_yb_code_27` | VARCHAR(50) | No | `原27位码` |
| `original_code_status` | VARCHAR(20) | No | `原码状态` |
| `yb_code_27` | VARCHAR(50) | Yes | `27位码` |
| `change_type` | VARCHAR(20) | No | `类型` |
| `yb_code_20` | VARCHAR(50) | No | `20位码` |
| `cat_level_1` | VARCHAR(200) | No | `一级分类` |
| `cat_level_2` | VARCHAR(200) | No | `二级分类` |
| `cat_level_3` | VARCHAR(200) | No | `三级分类` |
| `insurance_generic_category` | VARCHAR(200) | No | `医保通用名分类` |
| `material_attr` | VARCHAR(100) | No | `材质` |
| `feature` | VARCHAR(100) | No | `特征` |
| `registration_number` | VARCHAR(100) | No | `注册备案号` |
| `single_product_name` | VARCHAR(200) | No | `单件产品名称` |
| `manufacturer` | VARCHAR(200) | No | `耗材企业` |
| `spec_model_count` | INTEGER | No | `规格型号数` |
| `spec` | VARCHAR(500) | No | `规格` |
| `model` | VARCHAR(200) | No | `型号` |
| `insurance_generic_name_code` | VARCHAR(100) | No | `医保通用名编号` |
| `insurance_generic_name` | VARCHAR(200) | No | `医保通用名` |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `idx_stg_nhsa_material_specs_batch` | `batch_id` | B-tree |
| `idx_stg_nhsa_material_specs_yb_code_27` | `yb_code_27` | B-tree |
| `idx_stg_nhsa_material_specs_yb_code_20` | `yb_code_20` | B-tree |

### 4.10 `stg_nhsa_material_disabled`

Purpose: 暂存 NHSA 停用码表。

| Column | Type | Required | Source Column |
|---|---|:---:|---|
| `stg_id` | UUID | Yes | Generated |
| `batch_id` | VARCHAR(100) | Yes | Import batch |
| `source_file_name` | VARCHAR(500) | Yes | File name |
| `sheet_name` | VARCHAR(100) | Yes | Usually `Query1` |
| `row_number` | INTEGER | Yes | Source row number |
| `yb_code_27` | VARCHAR(50) | Yes | `27位码` |
| `original_code_status` | VARCHAR(20) | Yes | `原码状态` |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `idx_stg_nhsa_material_disabled_batch` | `batch_id` | B-tree |
| `idx_stg_nhsa_material_disabled_code` | `yb_code_27` | B-tree |

### 4.11 `stg_nhsa_material_transcode`

Purpose: 暂存 NHSA 原码到新码的转码关系。

| Column | Type | Required | Source Column |
|---|---|:---:|---|
| `stg_id` | UUID | Yes | Generated |
| `batch_id` | VARCHAR(100) | Yes | Import batch |
| `source_file_name` | VARCHAR(500) | Yes | File name |
| `sheet_name` | VARCHAR(100) | Yes | Usually `Query1` |
| `row_number` | INTEGER | Yes | Source row number |
| `original_yb_code_27` | VARCHAR(50) | Yes | `原27位码` |
| `original_code_status` | VARCHAR(20) | Yes | `原码状态` |
| `yb_code_27` | VARCHAR(50) | Yes | `27位码` |
| `change_type` | VARCHAR(20) | Yes | `类型` |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `idx_stg_nhsa_material_transcode_batch` | `batch_id` | B-tree |
| `idx_stg_nhsa_material_transcode_original` | `original_yb_code_27` | B-tree |
| `idx_stg_nhsa_material_transcode_new` | `yb_code_27` | B-tree |

### 4.12 `ref_device_classification_catalog`

Purpose: 保存医疗器械分类目录的参考分类明细。

| Column | Type | Required | Source Column |
|---|---|:---:|---|
| `catalog_id` | UUID | Yes | Generated |
| `batch_id` | VARCHAR(100) | Yes | Import batch |
| `source_file_name` | VARCHAR(500) | Yes | File name |
| `source_table_index` | INTEGER | Yes | DOCX table index |
| `row_number` | INTEGER | Yes | Table row number |
| `category_no` | VARCHAR(20) | No | 兼容字段，等同 `level_1_category_no` |
| `major_category_no` | VARCHAR(20) | No | 大类序号，如 `01` |
| `major_category_name` | VARCHAR(200) | No | 大类名称，如 `有源手术器械` |
| `level_1_category_no` | VARCHAR(20) | No | `序号`，一级产品类别序号 |
| `level_1_category` | VARCHAR(200) | No | `一级产品类别` |
| `level_2_category_no` | VARCHAR(20) | No | 从 `二级产品类别` 前缀拆出的二级产品类别序号 |
| `level_2_category` | VARCHAR(200) | No | 从 `二级产品类别` 拆出的名称，不带序号前缀 |
| `product_description` | TEXT | No | `产品描述` |
| `intended_use` | TEXT | No | `预期用途` |
| `product_examples` | TEXT | No | `品名举例` |
| `management_class` | VARCHAR(20) | No | `管理类别` |

Indexes:

| Name | Columns | Type |
|---|---|---|
| `idx_ref_device_catalog_batch` | `batch_id` | B-tree |
| `idx_ref_device_catalog_category` | `category_no`, `major_category_no`, `level_1_category_no`, `level_2_category_no`, `level_1_category`, `level_2_category` | B-tree |
| `idx_ref_device_catalog_hierarchy` | `major_category_no`, `level_1_category_no`, `level_2_category_no` | B-tree |

## 5. Migration Notes

- Use Alembic migrations.
- Create extensions for UUID generation if needed.
- JSONB fields should default to `{}` or `[]` only when the application expects non-null values.
- Prefer application-level enum validation in MVP; database check constraints may be added if they do not slow iteration.
- Migrations must be repeatable in clean development and test databases.
- Staging tables should be created before implementing NHSA source imports.
- All code fields from NHSA source files must use string types, not numeric types.

## 6. Acceptance Checklist

- Six MVP tables can be created by migration.
- Four import/reference support tables can be created by migration.
- All unique constraints and required indexes are present.
- Sample department, material, and SPD mapping data can be loaded.
- NHSA C09, disabled, transcode, and device classification source structures can be staged without losing source columns.
- Equipment category and equipment standard name dictionaries can be created, imported from real files, and queried by external systems.
- Idempotency unique key rejects conflicting duplicate writes.
- Table definitions align with `H-UDMP-MVP-TASKBOOK-v1.0.md`.
