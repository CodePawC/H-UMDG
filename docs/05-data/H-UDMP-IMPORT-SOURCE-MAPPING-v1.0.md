# H-UDMP Import Source Mapping

> Version: v1.0  
> Status: Review  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team  
> Source Files: NHSA material Excel files and NMPA medical device classification catalog supplied by user

## 1. Purpose

本文档记录 H-UDMP MVP 阶段真实导入源文件的结构、字段含义、目标暂存表、主数据映射规则和建议导入顺序。它用于修订数据模型、导入 API、测试计划和部署运行手册。

## 2. Source File Inventory

| Source ID | File | Type | Sheet or Structure | Observed Rows | Observed Columns | Purpose |
|---|---|---|---|---:|---:|---|
| SRC-NHSA-DISABLED | `30、停用表.xlsx` | Excel | `Query1` | 13,084 | 2 | 医保耗材停用码 |
| SRC-NHSA-TRANSCODE | `31、转码表.xlsx` | Excel | `Query1` | 5,408 | 4 | 医保耗材旧码到新码关系 |
| SRC-NHSA-C09-SPECS | `16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx` | Excel | `Query1` | 6,132 | 21 | C09 体外循环材料全量规格型号 |
| SRC-NMPA-DEVICE-CATALOG | `医疗器械分类目录.docx` | DOCX | 111 tables, about 53 classification detail tables | About 1,018 classification rows | 7 core fields | 医疗器械分类参考目录 |

Notes:

- Excel files use worksheet name `Query1`; importer should also support configurable or first-sheet fallback.
- NHSA material codes contain alphabetic prefixes, such as `C09100100000000211790000049`; all code fields must be stored as strings.
- The medical device classification catalog is a reference classification source and must not be treated as equivalent to NHSA material category levels.
- NHSA staging tables preserve the full source row in `raw_payload` in addition to typed columns. Typed columns support search, validation, and normalization; `raw_payload` prevents source-field loss when a release contains additional columns.

## 3. Source Structures

### 3.1 Disabled Material Codes

Source: `30、停用表.xlsx`

| Source Column | Target Column | Target Table | Rule |
|---|---|---|---|
| `27位码` | `yb_code_27` | `stg_nhsa_material_disabled` | Required string |
| `原码状态` | `original_code_status` | `stg_nhsa_material_disabled` | Observed value: `停用` |
| Full source row | `raw_payload` | `stg_nhsa_material_disabled` | Preserve every source column/value as JSON |

Business rule:

- Disabled codes should not be deleted from history.
- If the code already exists in `dict_material_specs`, mark the corresponding normalized record as inactive or deprecated according to later production lifecycle rules.
- MVP records the disabled status and exposes it to import reports; full lifecycle state machine is deferred.

### 3.2 Transcode Table

Source: `31、转码表.xlsx`

| Source Column | Target Column | Target Table | Rule |
|---|---|---|---|
| `原27位码` | `original_yb_code_27` | `stg_nhsa_material_transcode` | Required string |
| `原码状态` | `original_code_status` | `stg_nhsa_material_transcode` | Observed value: `停用` |
| `27位码` | `yb_code_27` | `stg_nhsa_material_transcode` | Required string |
| `类型` | `change_type` | `stg_nhsa_material_transcode` | Observed values: `变更`, `映射` |
| Full source row | `raw_payload` | `stg_nhsa_material_transcode` | Preserve every source column/value as JSON |

Business rule:

- `原27位码 → 27位码` forms a traceable replacement relation.
- `change_type=变更` and `change_type=映射` must remain distinguishable.
- MVP does not automatically rewrite historical business records; it records replacement relation for later mapping and lifecycle processing.

### 3.3 C09 Full Specification Table

Source: `16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx`

| Source Column | Target Column | Target Table | Rule |
|---|---|---|---|
| `GOODS_ID` | `goods_id` | `stg_nhsa_material_specs` | Source unique product/spec ID |
| `UDI` | `udi` | `stg_nhsa_material_specs` | May be empty |
| `原27位码` | `original_yb_code_27` | `stg_nhsa_material_specs` | May be empty |
| `原码状态` | `original_code_status` | `stg_nhsa_material_specs` | Observed mostly `保留` |
| `27位码` | `yb_code_27` | `stg_nhsa_material_specs` | Required string |
| `类型` | `change_type` | `stg_nhsa_material_specs` | Observed `保留`, `新增` |
| `20位码` | `yb_code_20` | `stg_nhsa_material_specs` | Required for category aggregation |
| `一级分类` | `cat_level_1` | `stg_nhsa_material_specs` | Example: `09-体外循环材料` |
| `二级分类` | `cat_level_2` | `stg_nhsa_material_specs` | Example: `10-其他体外循环材料` |
| `三级分类` | `cat_level_3` | `stg_nhsa_material_specs` | Example: `01-其他体外循环材料` |
| `医保通用名分类` | `insurance_generic_category` | `stg_nhsa_material_specs` | Example: `010-管路类` |
| `材质` | `material_attr` | `stg_nhsa_material_specs` | Example: `00-不区分` |
| `特征` | `feature` | `stg_nhsa_material_specs` | Example: `000-常规` |
| `注册备案号` | `registration_number` | `stg_nhsa_material_specs` | Registration or filing number |
| `单件产品名称` | `single_product_name` | `stg_nhsa_material_specs` | Product name |
| `耗材企业` | `manufacturer` | `stg_nhsa_material_specs` | Manufacturer |
| `规格型号数` | `spec_model_count` | `stg_nhsa_material_specs` | Numeric when parseable |
| `规格` | `spec` | `stg_nhsa_material_specs` | Raw specification |
| `型号` | `model` | `stg_nhsa_material_specs` | Raw model |
| `医保通用名编号` | `insurance_generic_name_code` | `stg_nhsa_material_specs` | May be empty |
| `医保通用名` | `insurance_generic_name` | `stg_nhsa_material_specs` | May be empty |
| Full source row | `raw_payload` | `stg_nhsa_material_specs` | Preserve every source column/value as JSON |

Normalization to `dict_material_specs`:

| Staging Field | Standard Field | Rule |
|---|---|---|
| `goods_id` | `goods_id` | Preserve selected source identity |
| `udi` | `udi` | Preserve if present |
| `original_yb_code_27` | `original_yb_code_27` | Preserve for traceability |
| `original_code_status` | `original_code_status` | Preserve for import traceability |
| `yb_code_27` | `yb_code_27` | Standard code |
| `change_type` | `code_change_type` | Preserve source type |
| `yb_code_20` | `yb_code_20` | Standard classification prefix |
| `cat_level_1/2/3` | `cat_level_1/2/3` | Preserve NHSA category levels |
| `single_product_name` | `generic_name` | MVP default when `insurance_generic_name` is empty |
| `insurance_generic_name_code` | `insurance_generic_name_code` | Preserve |
| `insurance_generic_name` | `insurance_generic_name` | Preserve |
| `manufacturer` | `brand_name` | MVP maps manufacturer to brand/manufacturer field |
| `material_attr` | `material_attr` | Preserve |
| `feature` | `feature` | Preserve |
| `registration_number` | `reg_number` | Preserve |
| `spec` | `spec_value/spec_unit` and `extra_attrs.raw_spec` | Parse when possible; keep raw value |
| `model` | `model_detail` | Preserve |

### 3.4 Medical Device Classification Catalog

Source: `医疗器械分类目录.docx`

Detected classification detail tables contain seven core fields:

| Source Column | Target Column | Target Table | Rule |
|---|---|---|---|
| DOCX section heading, e.g. `01 有源手术器械` | `major_category_no`, `major_category_name` | `ref_device_classification_catalog` | Major category code/name |
| `序号` | `level_1_category_no`, `category_no` | `ref_device_classification_catalog` | First-level category sequence number; `category_no` remains a compatibility alias |
| `一级产品类别` | `level_1_category` | `ref_device_classification_catalog` | Product level 1 |
| `二级产品类别` | `level_2_category_no`, `level_2_category` | `ref_device_classification_catalog` | Split numeric prefix and product level 2 name |
| `产品描述` | `product_description` | `ref_device_classification_catalog` | Description |
| `预期用途` | `intended_use` | `ref_device_classification_catalog` | Intended use |
| `品名举例` | `product_examples` | `ref_device_classification_catalog` | Examples |
| `管理类别` | `management_class` | `ref_device_classification_catalog` | I/II/III class |

Additional field:

| Target Column | Rule |
|---|---|
| `source_table_index` | DOCX table index, used for traceability |

Business rule:

- This catalog is a device/classification reference.
- Major, first-level, and second-level sequence numbers must be stored in separate columns instead of being concatenated into category names.
- It should help future device and material classification comparison, but must not overwrite NHSA material category levels.

## 4. Import Order

Recommended order:

1. Import C09 full specification table into `stg_nhsa_material_specs`.
2. Normalize C09 rows into `dict_material_specs`.
3. Import disabled code table into `stg_nhsa_material_disabled`.
4. Apply disabled status to import report and matching standard records.
5. Import transcode table into `stg_nhsa_material_transcode`.
6. Build old-code to new-code replacement relation for query and later lifecycle processing.
7. Extract device classification catalog into `ref_device_classification_catalog`.

## 5. Import Report Requirements

Import reports should include:

| Metric | Meaning |
|---|---|
| `batch_id` | Import batch identifier |
| `source_type` | `NHSA_FULL_SPEC`, `NHSA_DISABLED`, `NHSA_TRANSCODE`, `DEVICE_CLASSIFICATION_CATALOG`, or `MVP_TEMPLATE` |
| `source_file_name` | Original file name |
| `sheet_name` | Excel sheet name or DOCX table scope |
| `success_count` | Successfully processed rows |
| `failed_count` | Failed rows |
| `duplicate_count` | Duplicate rows |
| `disabled_count` | Disabled rows |
| `transcoded_count` | Transcode rows |
| `changed_count` | Rows where type is `变更` |
| `mapped_count` | Rows where type is `映射` |
| `retained_count` | Rows where status/type is `保留` |
| `failure_details` | Row-level failure details |

## 6. Assumptions

- Source files are official or院方确认的导入文件.
- The C09 file is one category sample; other NHSA category files should reuse the same full-spec import contract when columns match.
- Staging tables are required because source files contain more fields than the MVP standard master table.
- Data import must be streaming or chunked in implementation; production files may be much larger than the C09 sample.
