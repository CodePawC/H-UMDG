# H-UDMP MVP UAT Checklist

> Document ID: H-UDMP-UAT-CHECKLIST  
> Version: v1.0  
> Status: Review  
> Date: 2026-05-06  
> Owner: H-UDMP Project Team  
> Source: `docs/02-requirements/H-UDMP-MVP-TASKBOOK-v1.0.md`, `docs/06-testing/H-UDMP-TEST-PLAN-v1.0.md`

## 1. Purpose

本文档定义 H-UDMP MVP 的用户验收测试（UAT）清单、演示步骤、证据要求和签署记录模板，用于院方、实施方和开发团队共同确认首期能力是否达到可验收状态。

## 2. UAT Scope

### 2.1 In Scope

- FastAPI 服务健康检查。
- API Key 认证。
- 科室字典导入与检索。
- 医保耗材 MVP 模板导入与检索。
- NHSA C09 全量规格型号样例导入。
- NHSA 停用表样例导入。
- NHSA 转码表样例导入与转码查询。
- SPD 样例映射导入。
- 映射解析命中。
- 未命中映射进入待审核任务。
- 待审核任务查询、审核通过、审核拒绝。
- 写入接口幂等重放与冲突。
- 交换日志查询。
- 导入异常场景：缺字段、非法 `source_type`、错误工作表、重复业务键、非法医保码长度。
- H-MDM 厂商机构主数据：档案、别名、角色、关系、外部编码映射、候选审核和外部查询 API。
- 医保耗材导入时厂商候选自动提取和耗材 `org_id` 引用。

### 2.2 Out of Scope

- 药品字典。
- 诊疗项目字典。
- DRG/DIP。
- FHIR API。
- 外报网关。
- 完整前端管理系统。
- 医用设备资产实例生命周期管理。
- 供应商门户、报价、合同、发票、付款、资质上传。
- 完整 RBAC、JWT、不可篡改审计。

## 3. Preconditions

| Item | Expected |
|---|---|
| Code branch | UAT 候选版本已冻结 |
| Database | Alembic migration 已执行到 head |
| API service | `GET /health` 返回 `status=ok` |
| API key | UAT 调用方持有有效 `X-API-Key` |
| Sample data | 仓库内 `data/templates` 和 `data/samples` 文件可读 |
| NHSA samples | `data/samples/external/nhsa` 下 3 个小样本文件存在 |
| SPD sample | `data/samples/H-UDMP-SAMPLE-SPD-MAPPINGS-v1.0.csv` 存在 |
| Evidence folder | 已创建 UAT 证据保存目录 |

建议演示脚本：

```powershell
.\tools\H-UDMP-UAT-DEMO-v1.0.ps1 -ApiBaseUrl "http://127.0.0.1:8101" -ApiKey "change-me"
```

## 4. Acceptance Matrix

| UAT ID | Requirement | Scenario | Procedure | Expected Result | Evidence | Result |
|---|---|---|---|---|---|---|
| UAT-001 | MVP-REQ-001 | 健康检查 | 调用 `GET /health` | 返回 `status=ok` 和版本号 | 截图或响应 JSON | TBD |
| UAT-002 | MVP-REQ-013 | API Key 认证 | 不带 `X-API-Key` 调受保护 API | 返回 `UNAUTHORIZED` | 响应 JSON | TBD |
| UAT-003 | MVP-REQ-002 | 科室导入 | 上传科室模板 | 返回 `success_count > 0`、`failed_count=0` | 导入报告 | TBD |
| UAT-004 | MVP-REQ-003 | 科室检索 | 按 `心外` 检索 | 返回目标科室 | 响应 JSON | TBD |
| UAT-005 | MVP-REQ-004 | 耗材导入 | 上传耗材 MVP 模板 | 返回导入批次和成功数 | 导入报告 | TBD |
| UAT-006 | MVP-REQ-005 | 耗材检索 | 按 27 位医保码检索 | 返回唯一耗材 | 响应 JSON | TBD |
| UAT-007 | MVP-REQ-014 | NHSA 全量规格导入 | 上传 C09 样例，`source_type=NHSA_FULL_SPEC` | 识别 `Query1`，返回导入报告 | 导入报告 | TBD |
| UAT-008 | MVP-REQ-015 | NHSA 停用表导入 | 上传停用样例，`source_type=NHSA_DISABLED` | 返回停用码统计 | 导入报告 | TBD |
| UAT-009 | MVP-REQ-016 | NHSA 转码表导入 | 上传转码样例，`source_type=NHSA_TRANSCODE` | 返回 `transcoded_count`、`changed_count`、`mapped_count` | 导入报告 | TBD |
| UAT-010 | MVP-REQ-016 | 转码查询 | 按 `原27位码` 查询 | 返回 `FOUND` 和新 `27位码` | 响应 JSON | TBD |
| UAT-011 | MVP-REQ-007 | SPD 映射命中 | 导入 SPD 样例后解析 `SPD-MAT-001` | 返回 `MATCHED` | 响应 JSON | TBD |
| UAT-012 | MVP-REQ-008 | 未知映射待审核 | 解析未知 SPD 编码 | 返回 `PENDING_REVIEW` 和 `task_id` | 响应 JSON | TBD |
| UAT-013 | MVP-REQ-009 | 审核通过 | 将待审核任务指向标准主数据 | 返回 `APPROVED`，再次解析返回 `MATCHED` | 响应 JSON | TBD |
| UAT-014 | MVP-REQ-019 | 审核拒绝 | 拒绝另一个待审核任务 | 返回 `REJECTED` | 响应 JSON | TBD |
| UAT-015 | MVP-REQ-010 | 幂等重放 | 同一事务号同文件重复导入 | 返回首次导入报告 | 两次响应 JSON | TBD |
| UAT-016 | MVP-REQ-010 | 幂等冲突 | 同一事务号不同文件导入 | 返回 `IDEMPOTENCY_CONFLICT` | 响应 JSON | TBD |
| UAT-017 | MVP-REQ-011 | 交换日志查询 | 按 `source_system` 查询日志 | 返回导入和映射解析日志 | 响应 JSON | TBD |
| UAT-018 | MVP-REQ-004 | 导入异常 | 非法 `source_type` | 返回 `INVALID_SOURCE_TYPE` | 响应 JSON | TBD |
| UAT-019 | MVP-REQ-004 | 导入异常 | 不存在的 Excel `sheet_name` | 返回 `IMPORT_FILE_INVALID` | 响应 JSON | TBD |
| UAT-020 | MVP-REQ-004 | 导入异常 | 重复 `yb_code_27` | 返回重复统计，不产生数据库唯一约束错误 | 导入报告 | TBD |
| UAT-VENDOR-001 | HMDM-VENDOR-001 | 创建厂商机构 | 提交标准名称、简称、英文名、信用代码 | 返回厂商 `id` 和 `organization_code` | 响应 JSON | TBD |
| UAT-VENDOR-002 | HMDM-VENDOR-001 | 标准名称重复 | 重复提交相同标准名称 | 返回 `DUPLICATE_STANDARD_NAME` | 响应 JSON | TBD |
| UAT-VENDOR-003 | HMDM-VENDOR-001 | 信用代码重复 | 重复提交相同统一社会信用代码 | 返回 `DUPLICATE_CREDIT_CODE` | 响应 JSON | TBD |
| UAT-VENDOR-004 | HMDM-VENDOR-003 | 多角色维护 | 为同一厂商维护生产厂家、注册人、售后、供应商角色 | 详情返回多个角色 | 响应 JSON | TBD |
| UAT-VENDOR-005 | HMDM-VENDOR-004/005 | 厂商关系 | 建立母子公司、更名/收购关系 | 关系 API 可查询 | 响应 JSON | TBD |
| UAT-VENDOR-006 | HMDM-VENDOR-006 | 外部编码映射 | 维护 NHSA/SPD 等外部编码名称 | 外部名称可检索 | 响应 JSON | TBD |
| UAT-VENDOR-007 | HMDM-VENDOR-007 | 医保耗材候选提取 | 导入含厂家字段的医保耗材样例 | 返回 `vendor_candidate_count > 0` | 导入报告 | TBD |
| UAT-VENDOR-008 | HMDM-VENDOR-008 | 候选映射已有厂商 | 将候选厂商映射到已有厂商 | 候选状态变为 `matched` | 响应 JSON | TBD |
| UAT-VENDOR-009 | HMDM-VENDOR-008 | 候选创建新厂商 | 从候选创建新厂商 | 新厂商创建且候选已匹配 | 响应 JSON | TBD |
| UAT-VENDOR-010 | HMDM-VENDOR-008 | 候选合并与批量处理 | 将候选合并到已有厂商，并批量处理候选 | 候选可批量映射、合并或忽略 | 响应 JSON | TBD |
| UAT-VENDOR-010 | HMDM-VENDOR-009/010 | 外部厂商查询 | 按别名和信用代码查询 | 返回厂商、角色、状态和关系 | 响应 JSON | TBD |

## 5. Demo Flow

推荐现场演示顺序：

1. 展示 Swagger/OpenAPI。
2. 调用 `/health`。
3. 导入科室模板。
4. 导入耗材 MVP 模板。
5. 导入 SPD 样例映射。
6. 解析 SPD 科室和耗材编码，确认 `MATCHED`。
7. 导入 NHSA C09、停用、转码样例。
8. 查询耗材主数据和转码关系。
9. 解析未知 SPD 编码，生成待审核任务。
10. 查询待审核任务。
11. 审核通过后再次解析，确认命中。
12. 演示拒绝任务。
13. 演示幂等重放和幂等冲突。
14. 演示异常导入返回。
15. 查询交换日志作为过程证据。

## 6. Evidence Requirements

每次 UAT 至少保存：

- 环境信息：代码版本、数据库迁移版本、API Base URL、测试时间。
- `/health` 响应。
- 每个导入接口的导入报告。
- 映射解析、审核通过、审核拒绝响应。
- 转码查询响应。
- 交换日志查询响应。
- 自动化测试结果。
- 未通过项和缺陷记录。

## 7. Defect Recording

| Defect ID | UAT ID | Severity | Description | Owner | Status | Resolution |
|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | Open | TBD |

Severity:

| Severity | Meaning |
|---|---|
| Blocker | 核心服务不可用或数据损坏 |
| Critical | MVP 核心验收项失败且无绕行 |
| Major | 功能受影响但有临时绕行 |
| Minor | 文案、提示或低影响问题 |

## 8. Sign-Off

| Role | Name | Organization | Result | Signature / Date |
|---|---|---|---|---|
| Hospital data owner | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Hospital IT owner | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Implementation lead | TBD | TBD | Pass / Fail / Conditional Pass | TBD |
| Development lead | TBD | TBD | Pass / Fail / Conditional Pass | TBD |

## 9. Exit Criteria

UAT 可通过条件：

- UAT-001 至 UAT-017 全部通过。
- UAT-018 至 UAT-020 异常场景返回符合预期。
- 无 Blocker 或 Critical 缺陷未关闭。
- Major 缺陷已有院方认可的整改计划。
- UAT 证据已归档。
