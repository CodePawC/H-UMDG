# H-UDMP NHSA Full Import Validation Report

> Document ID: H-UDMP-NHSA-FULL-IMPORT-VALIDATION  
> Version: v1.0  
> Status: Review  
> Date: 2026-05-05  

## 1. Scope

本报告记录 H-UDMP MVP 对用户提供的真实医保医用耗材源文件进行全量导入验证的结果。

验证文件：

| Source Type | File | Sheet |
|---|---|---|
| `NHSA_FULL_SPEC` | `16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx` | `Query1` |
| `NHSA_DISABLED` | `30、停用表.xlsx` | `Query1` |
| `NHSA_TRANSCODE` | `31、转码表.xlsx` | `Query1` |

验证环境：

| Item | Value |
|---|---|
| Backend | Docker Compose service `hudmp-backend` |
| Database | Docker Compose service `hudmp-postgres` |
| API Base URL | `http://127.0.0.1:8000` |
| Migration | Alembic `0001` applied |

## 2. Import Batch IDs

| Source Type | Batch ID / `source_tx_id` |
|---|---|
| `NHSA_FULL_SPEC` | `NHSA-FULL-20260505192209` |
| `NHSA_DISABLED` | `NHSA-DISABLED-20260505192209` |
| `NHSA_TRANSCODE` | `NHSA-TRANSCODE-20260505192209` |

## 3. Source File Profiling

| Source | Raw Data Rows | Distinct Business Key | Type Distribution |
|---|---:|---:|---|
| C09 full spec | 6,132 | 5,783 distinct `27位码` | `保留`: 6,131; `新增`: 1 |
| Disabled table | 13,084 | 13,083 distinct `27位码` | N/A |
| Transcode table | 5,408 | N/A | `变更`: 5,366; `映射`: 42 |

说明：当前 MVP 导入逻辑对 C09 全量规格和停用表按 `27位码` 去重后落库，因此成功数以唯一业务码数量为准。

## 4. API Import Results

| Source Type | Source Rows | Unique Keys | Skipped Duplicates | Success Count | Failed Count | Extra Counters | Processing Time |
|---|---:|---:|---:|---:|---:|---|---:|
| `NHSA_FULL_SPEC` | 6,132 | 5,783 | 349 | 5,783 | 0 | `retained_count=5782` | 7,023 ms |
| `NHSA_DISABLED` | 13,084 | 13,083 | 1 | 13,083 | 0 | `disabled_count=13083` | 523 ms |
| `NHSA_TRANSCODE` | 5,408 | 5,408 | 0 | 5,408 | 0 | `changed_count=5366`, `mapped_count=42` | 211 ms |

## 5. Database Verification

| Check | Result |
|---|---:|
| `stg_nhsa_material_specs` rows for full batch | 5,783 |
| Distinct `yb_code_27` in full staging batch | 5,783 |
| `dict_material_specs` rows for full batch | 5,783 |
| `stg_nhsa_material_disabled` rows for disabled batch | 13,083 |
| `stg_nhsa_material_transcode` rows for transcode batch | 5,408 |
| ACTIVE material master rows after validation | 5,783 |
| Disabled code overlap with imported C09 master rows | 0 |
| Exchange logs for NHSA validation batches | 3 |

## 6. Functional Verification

Material search example:

| Query | Result |
|---|---|
| `GET /api/v1/materials/search?keyword=体外&page_size=5` | Returned 5 items, total matched rows 618 |

Returned records include:

| Field | Example |
|---|---|
| `yb_code_27` | `C09010101000000066260000001` |
| `yb_code_20` | `C0901010100000006626` |
| `generic_name` | `一次性使用人工心肺机体外循环管道包-动脉插管(配用部件)` |
| `cat_level_1` | `09-体外循环材料` |
| `cat_level_2` | `01-插管` |
| `cat_level_3` | `01-动脉灌注管` |
| `reg_number` | `国械注准20153100011` |
| `status` | `ACTIVE` |

## 7. Findings

| ID | Finding | Impact | Recommendation |
|---|---|---|---|
| F-001 | C09 源文件 6,132 行，但唯一 `27位码` 为 5,783 个，导入成功数为 5,783。 | 符合当前 MVP 去重逻辑。 | 已落实：导入报告增加 `source_row_count`、`unique_key_count`、`skipped_duplicate_count`。 |
| F-002 | 停用表 13,084 行，唯一 `27位码` 为 13,083 个，导入成功数为 13,083。 | 符合唯一业务码落库逻辑。 | 已落实：导入报告增加重复码统计。 |
| F-003 | 停用表与本次 C09 主数据无交集，未产生 INACTIVE 主数据。 | 本次验证不能证明停用码能命中并停用 C09 主数据，只能证明停用表暂存与更新逻辑可执行。 | 已落实：新增自动化交集样例测试，验证命中主数据后状态变为 `INACTIVE`。 |
| F-004 | 转码表已完整进入暂存层，并已提供只读转码查询接口；MVP 尚未把转码关系自动应用到映射桥或主数据替代关系。 | 符合 MVP 边界，同时可支持联调时按旧码追溯新码。 | 已落实：`GET /api/v1/materials/transcode/resolve` 查询接口与自动化测试；一期增强再评估自动替代策略。 |

## 8. Conclusion

本次真实源文件全量导入验证通过。

H-UDMP MVP 当前能够读取真实 NHSA Excel `Query1` 工作表，完成 C09 全量规格型号、停用表、转码表导入，并将 C09 数据清洗进入耗材主数据表。失败数均为 0，交换日志记录正常，核心检索可返回导入后的主数据，转码关系可通过只读 API 查询追溯。
