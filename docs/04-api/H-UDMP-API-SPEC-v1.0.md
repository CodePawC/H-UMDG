# H-UDMP API Specification

> Version: v1.0  
> Status: Review  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team  
> Source: `docs/02-requirements/H-UDMP-MVP-TASKBOOK-v1.0.md`

## 1. Purpose

本文档固化 H-UDMP MVP 阶段的 API 契约，用于后端开发、接口联调、自动化测试和验收评审。MVP API 仅覆盖科室字典、耗材字典、映射桥、审核任务、交换日志和健康检查。

## 2. Common Rules

### 2.1 Base URL

```text
/api/v1
```

健康检查接口不使用版本前缀：

```text
/health
```

### 2.2 Authentication And Operator Context

MVP 脚本和服务间调用仍兼容服务级 API Key。Admin UI Alpha 使用管理员预先配置的操作员账号登录：用户输入用户名/工号和密码，后端返回会话令牌、角色、权限和会话过期时间；后续受保护请求提交 `X-Session-Token`。权限管理接口仅 `permissions.manage` 角色可访问。

| Header | Required | Description |
|---|:---:|---|
| `X-Session-Token` | Admin UI Yes | `POST /api/v1/auth/login` 返回的操作员会话令牌 |
| `X-API-Key` | Script/API Key mode Yes | 内网服务级 API Key；用于脚本和服务间兼容路径 |
| `X-Operator-Name` | API Key mode No | 脚本兼容路径中的操作员标识 |
| `X-Operator-Role` | API Key mode No | 脚本兼容路径中的 `platform_admin`、`data_steward`、`auditor` |
| `X-Request-ID` | No | 调用方请求 ID；缺失时由服务端生成 |

认证失败返回：

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "API Key invalid or missing",
  "data": null,
  "trace_id": "trace-20260505-000001"
}
```

权限失败返回：

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "operator role auditor does not have permission materials.manage",
  "data": null,
  "trace_id": "trace-20260505-000002"
}
```

角色权限矩阵：

| Permission | `platform_admin` | `data_steward` | `auditor` |
|---|:---:|:---:|:---:|
| `dashboard.view` | Yes | Yes | Yes |
| `departments.manage` | Yes | Yes | No |
| `materials.manage` | Yes | Yes | No |
| `equipment.manage` | Yes | Yes | No |
| `vendors.manage` | Yes | Yes | No |
| `imports.manage` | Yes | Yes | No |
| `mapping.review` | Yes | Yes | No |
| `exchange.view` | Yes | No | Yes |
| `permissions.manage` | Yes | No | No |
| `raw_payload.view` | Yes | No | No |

### 2.3 Response Envelope

成功响应：

```json
{
  "success": true,
  "code": "OK",
  "message": "OK",
  "data": {},
  "trace_id": "trace-20260505-000001"
}
```

失败响应：

```json
{
  "success": false,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "data": null,
  "details": [],
  "trace_id": "trace-20260505-000001"
}
```

说明：业务错误和校验错误统一使用顶层 `code`、`message`、`data`、`trace_id` 字段。`details` 仅在字段校验失败等需要返回明细时出现。

### 2.4 Pagination

分页接口统一使用：

| Query | Required | Default | Rule |
|---|:---:|---:|---|
| `page` | No | 1 | 最小值 1 |
| `size` | No | 20 | 最小值 1，最大值 100 |

分页响应 `data` 必须包含：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "size": 20
}
```

### 2.5 Idempotency

写入型接口必须接收 `source_system` 和 `source_tx_id`，并按以下规则处理：

- 同一 `source_system + source_tx_id` 首次提交时正常处理并写入 `sys_exchange_log`。
- 同键同 `payload_hash` 再次提交时返回首次处理结果。
- 同键不同 `payload_hash` 再次提交时返回 `IDEMPOTENCY_CONFLICT`。
- 文件上传接口的 `payload_hash` 按文件字节 SHA-256 与规范化元数据（如 `source_type`、`sheet_name`）共同计算，不对 multipart boundary 等传输包装做哈希。

### 2.6 Upload Limits And Spool Cleanup

导入类 `multipart/form-data` 接口统一受 `HUDMP_IMPORT_MAX_UPLOAD_BYTES` 限制，默认 `1073741824` 字节。超过限制时返回 HTTP 413 与 `UPLOAD_TOO_LARGE` 错误信封。压缩包导入支持 ZIP、7z、tar、tar.gz/tgz、tar.bz2/tbz2、tar.xz/txz，并会校验 `HUDMP_IMPORT_MAX_ARCHIVE_ENTRIES` 与 `HUDMP_IMPORT_MAX_ARCHIVE_UNCOMPRESSED_BYTES`。RAR 需要外部 unrar 运行时，当前会明确返回不支持。

异步导入会先将上传文件写入 `HUDMP_IMPORT_SPOOL_DIR`。后台批次完成或失败后，服务端默认删除对应暂存文件，并尝试删除空批次目录；可通过 `HUDMP_IMPORT_CLEANUP_SPOOL_ON_FINISH=false` 保留文件用于私有排障。

### 2.7 Error Codes

| Code | HTTP Status | Meaning |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | 字段校验失败 |
| `UNAUTHORIZED` | 401 | 登录凭据、会话令牌或 API Key 无效 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `MAPPING_NOT_FOUND` | 200 | 未匹配，已创建审核任务 |
| `MAPPING_CONFLICT` | 409 | 映射冲突 |
| `IDEMPOTENCY_CONFLICT` | 409 | 幂等键冲突 |
| `DUPLICATE_RECORD` | 409 | 唯一约束冲突 |
| `DUPLICATE_STANDARD_NAME` | 409 | 厂商机构标准名称重复 |
| `DUPLICATE_CREDIT_CODE` | 409 | 厂商机构统一社会信用代码重复 |
| `UPLOAD_TOO_LARGE` | 413 | 上传文件超过 `HUDMP_IMPORT_MAX_UPLOAD_BYTES` 限制 |
| `INTERNAL_ERROR` | 500 | 未预期异常 |

### 2.8 HTTP 200 与 `MAPPING_NOT_FOUND`

映射解析未命中并已生成审核任务时，对外仍返回 **HTTP 200** 与 `success: true`，通过 `data.status=PENDING_REVIEW` 表达业务状态（便于客户端统一解析信封层）。监控与告警应依赖 `data.status` 或交换日志中的 `data_category=mapping`，而非仅靠 HTTP 状态码。

## 3. Endpoint Summary

| Method | Path | Requirement | Purpose |
|---|---|---|---|
| GET | `/health` | MVP-REQ-001 | 健康检查 |
| POST | `/api/v1/auth/login` | MVP-REQ-013 | 操作员用户名/工号密码登录 |
| GET | `/api/v1/auth/me` | MVP-REQ-013 | 当前操作员权限上下文 |
| GET | `/api/v1/auth/permissions` | MVP-REQ-013 | 后端角色权限矩阵，仅 `permissions.manage` |
| GET | `/api/v1/auth/operators` | MVP-REQ-013 | 预置操作员账号清单，仅 `permissions.manage` |
| GET | `/api/v1/dictionaries/catalog` | MVP-REQ-002/004 | 统一字典目录、字段蓝图和接口指南 |
| GET | `/api/v1/departments/search` | MVP-REQ-003 | 科室检索 |
| POST | `/api/v1/departments/import` | MVP-REQ-002 | 科室导入 |
| GET | `/api/v1/materials/search` | MVP-REQ-005 | 耗材检索 |
| POST | `/api/v1/materials/import` | MVP-REQ-004 | 耗材导入 |
| GET | `/api/v1/materials/transcode/resolve` | MVP-REQ-016 | 医保耗材旧码转码关系查询 |
| GET | `/api/v1/equipment/categories` | HMDM-EQUIP-001 | 设备分类目录查询 |
| GET | `/api/v1/equipment/standard-names` | HMDM-EQUIP-002 | 设备标准名称查询 |
| GET | `/api/v1/equipment/device-classifications` | HMDM-EQUIP-003 | 医疗器械分类目录查询 |
| POST | `/api/v1/equipment/import` | HMDM-EQUIP-001/002/003 | 装备字典真实文件导入 |
| GET | `/api/external/equipment/categories` | HMDM-EQUIP-004 | 外部系统查询设备分类目录 |
| GET | `/api/external/equipment/standard-names` | HMDM-EQUIP-004 | 外部系统查询设备标准名称 |
| GET | `/api/external/equipment/device-classifications` | HMDM-EQUIP-004 | 外部系统查询医疗器械分类目录 |
| GET | `/api/v1/manufacturer-vendors` | HMDM-VENDOR-001 | 厂商机构档案查询 |
| POST | `/api/v1/manufacturer-vendors` | HMDM-VENDOR-001 | 新增厂商机构主数据 |
| PATCH | `/api/v1/manufacturer-vendors/{id}` | HMDM-VENDOR-001/002 | 编辑厂商基本信息和别名 |
| POST | `/api/v1/manufacturer-vendors/{id}/roles` | HMDM-VENDOR-003 | 维护厂商角色 |
| POST | `/api/v1/manufacturer-vendor-relations` | HMDM-VENDOR-004/005 | 维护厂商关系 |
| POST | `/api/v1/manufacturer-vendors/{id}/external-mappings` | HMDM-VENDOR-006 | 维护厂商外部编码映射 |
| GET | `/api/v1/manufacturer-vendor-candidates` | HMDM-VENDOR-007/008 | 厂商候选审核列表 |
| POST | `/api/v1/manufacturer-vendor-candidates/{id}/map` | HMDM-VENDOR-008 | 候选映射已有厂商 |
| POST | `/api/v1/manufacturer-vendor-candidates/{id}/merge` | HMDM-VENDOR-008 | 候选合并到已有厂商别名和外部映射 |
| POST | `/api/v1/manufacturer-vendor-candidates/{id}/create-vendor` | HMDM-VENDOR-008 | 候选创建新厂商 |
| POST | `/api/v1/manufacturer-vendor-candidates/batch` | HMDM-VENDOR-008 | 候选批量映射、合并、忽略 |
| GET | `/api/external/manufacturer-vendors` | HMDM-VENDOR-009/010 | 外部系统查询厂商机构 |
| GET | `/api/external/manufacturer-vendors/{id}` | HMDM-VENDOR-009/010 | 外部系统查询厂商详情 |
| GET | `/api/external/manufacturer-vendors/{id}/relations` | HMDM-VENDOR-009/010 | 外部系统查询厂商关系 |
| POST | `/api/v1/import-tasks/materials` | MVP-REQ-021 | 创建异步耗材导入任务 |
| GET | `/api/v1/import-tasks` | MVP-REQ-021 | 导入任务列表 |
| GET | `/api/v1/import-tasks/{batch_id}` | MVP-REQ-021 | 导入任务进度查询 |
| GET | `/api/v1/import-tasks/{batch_id}/failures` | MVP-REQ-021 | 导入失败行查询 |
| POST | `/api/v1/mapping/resolve` | MVP-REQ-007/008 | 映射解析 |
| GET | `/api/v1/mapping/review-tasks` | MVP-REQ-008 | 审核任务查询 |
| POST | `/api/v1/mapping/review-tasks/{task_id}/approve` | MVP-REQ-009 | 审核通过 |
| POST | `/api/v1/mapping/review-tasks/{task_id}/reject` | MVP-REQ-009 | 审核拒绝 |
| GET | `/api/v1/exchange/logs` | MVP-REQ-011 | 交换日志查询 |
| GET | `/api/v1/exchange/logs/{log_id}` | MVP-REQ-011 | 交换日志脱敏详情 |

## 4. Health Check

### 4.1 `GET /health`

返回服务、数据库、Redis 状态。

Response:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "mvp-v1"
}
```

## 4A. Auth Context API

### 4A.1 `POST /api/v1/auth/login`

用于 Admin UI Alpha 登录。账号、角色和权限由管理员通过后端配置预置；前端不允许用户选择角色。

Request:

```json
{
  "username": "E1001",
  "password": "demo123"
}
```

Response `data`:

```json
{
  "operator_name": "E1001",
  "operator_display_name": "数据治理员",
  "operator_role": "data_steward",
  "permissions": ["dashboard.view", "departments.manage", "equipment.manage", "imports.manage", "mapping.review", "materials.manage"],
  "auth_model": "operator_password_session",
  "session_token": "<opaque-session-token>",
  "session_expires_at": "2026-05-09T18:30:00Z"
}
```

### 4A.2 `GET /api/v1/auth/me`

用于 Admin UI Alpha 登录后验证会话令牌并返回当前后端权限上下文。该接口不返回密码。

Response `data`:

```json
{
  "operator_name": "E1001",
  "operator_display_name": "数据治理员",
  "operator_role": "data_steward",
  "permissions": ["dashboard.view", "departments.manage", "equipment.manage", "imports.manage", "mapping.review", "materials.manage"],
  "auth_model": "operator_password_session",
  "session_expires_at": "2026-05-09T18:30:00Z"
}
```

### 4A.3 `GET /api/v1/auth/permissions`

返回后端当前角色权限矩阵，仅 `permissions.manage` 角色可访问。Admin UI Alpha 在平台管理员登录后使用该接口展示后端权威矩阵，避免前端本地矩阵与后端实现漂移。

Response `data`:

```json
{
  "source": "backend",
  "roles": [
    {
      "role": "platform_admin",
      "permissions": ["dashboard.view", "departments.manage", "equipment.manage", "exchange.view", "imports.manage", "mapping.review", "materials.manage", "permissions.manage", "raw_payload.view"]
    }
  ]
}
```

### 4A.4 `GET /api/v1/auth/operators`

返回管理员预先配置的操作员账号清单，仅 `permissions.manage` 角色可访问。该接口不返回密码明文或哈希值。

Response `data`:

```json
{
  "source": "backend",
  "accounts": [
    {
      "username": "admin",
      "display_name": "平台管理员",
      "role": "platform_admin",
      "permissions": ["dashboard.view", "departments.manage", "equipment.manage", "exchange.view", "imports.manage", "mapping.review", "materials.manage", "permissions.manage", "raw_payload.view"],
      "password_type": "configured"
    }
  ]
}
```

## 5. Dictionary Catalog APIs

### 5.1 `GET /api/v1/dictionaries/catalog`

返回统一字典目录。目录既包含已接入的科室、耗材，也包含院区、病区、人员、药品、诊断、手术操作、供应商、计量单位等字段蓝图。字段蓝图用于提前发布接口指南，允许数据后续再充实。

Response `data`:

```json
{
  "summary": {
    "total": 10,
    "available_count": 2,
    "blueprint_count": 8
  },
  "items": [
    {
      "dictionary_key": "CAMPUS",
      "name": "院区",
      "domain": "组织机构",
      "status": "BLUEPRINT",
      "key_fields": [
        {"name": "campus_code", "label": "院区编码", "required": true, "type": "string"},
        {"name": "campus_name", "label": "院区名称", "required": true, "type": "string"}
      ],
      "api_endpoints": ["PLANNED /api/v1/dictionaries/campus"]
    }
  ]
}
```

## 6. Department APIs

### 6.1 `GET /api/v1/departments/search`

Query:

| Name | Required | Description |
|---|:---:|---|
| `q` | No | 名称、别名、编码关键字 |
| `dept_code` | No | 标准科室编码，精确查询 |
| `status` | No | `ACTIVE` 或 `INACTIVE` |
| `page` | No | 页码 |
| `size` | No | 页大小 |

Response `data`:

```json
{
  "items": [
    {
      "dept_id": "a0f9cc52-5e37-47a8-bb7a-001000000001",
      "dept_code": "DEPT001",
      "dept_name": "心脏外科",
      "dept_alias": "心外科;胸心外科",
      "parent_dept_id": null,
      "dept_type": "临床",
      "oid": "1.2.156.xxxxx.1.2.001",
      "status": "ACTIVE",
      "standard_source": "国家卫生健康委《医疗机构诊疗科目名录》",
      "standard_scope": "承担心脏大血管外科专业相关疾病的诊断、治疗、随访、会诊和质量管理。",
      "maintenance_mode": "STANDARD_LIBRARY_TOGGLE"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 6.2 `POST /api/v1/departments/standard-library/sync`

初始化或更新内置标准科室库。用于“系统预置标准科室 + 本院启停维护”的维护模式。

Response `data`:

```json
{
  "batch_id": "STANDARD-DEPARTMENTS-2026.05",
  "source_type": "STANDARD_DEPARTMENT_LIBRARY",
  "source_row_count": 155,
  "success_count": 155,
  "failed_count": 0,
  "standard_source": "国家卫生健康委《医疗机构诊疗科目名录》"
}
```

### 6.3 `PATCH /api/v1/departments/{dept_code}/status`

启用或停用本院实际使用的标准科室。

Request:

```json
{
  "status": "INACTIVE"
}
```

Response `data`: same item shape as `GET /api/v1/departments/search`.

### 6.4 `POST /api/v1/departments/import`

Request type: `multipart/form-data`

| Field | Required | Description |
|---|:---:|---|
| `file` | Yes | CSV 或 Excel 文件 |
| `source_system` | Yes | 默认 `MVP`；SPD 联调时使用 `SPD` |
| `source_tx_id` | Yes | 导入事务号 |

Response `data`:

```json
{
  "batch_id": "dept-import-20260505-001",
  "success_count": 100,
  "failed_count": 2,
  "duplicate_count": 3,
  "failures": [
    {
      "row": 12,
      "field": "dept_code",
      "message": "科室编码为空"
    }
  ]
}
```

## 7. Material APIs

### 7.1 `GET /api/v1/materials/search`

Query:

| Name | Required | Description |
|---|:---:|---|
| `q` | No | 通用名、品牌、型号关键字 |
| `yb_code_27` | No | 医保 27 位码，精确查询 |
| `reg_number` | No | 注册证号 |
| `status` | No | `ACTIVE` 或 `INACTIVE` |
| `page` | No | 页码 |
| `size` | No | 页大小 |

Response `data`:

```json
{
  "items": [
    {
      "material_id": "b5d8ef20-08e3-4bb0-90ad-001000000001",
      "yb_code_27": "123456789012345678901234567",
      "yb_code_20": "12345678901234567890",
      "generic_name": "一次性使用无菌导管",
      "brand_name": "示例品牌",
      "spec_value": "22",
      "spec_unit": "mm",
      "model_detail": "A-22",
      "reg_number": "国械注准2026xxxx",
      "unit_pkg": "支",
      "status": "ACTIVE"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 7.2 `POST /api/v1/materials/import`

Request type: `multipart/form-data`

| Field | Required | Description |
|---|:---:|---|
| `file` | Yes | CSV 或 Excel 文件 |
| `source_system` | Yes | 默认 `MANUAL` |
| `source_tx_id` | Yes | 导入事务号 |
| `source_type` | Yes | `MVP_TEMPLATE`, `NHSA_FULL_SPEC`, `NHSA_DISABLED`, `NHSA_TRANSCODE`, `DEVICE_CLASSIFICATION_CATALOG` |
| `sheet_name` | No | Excel 工作表名；缺省时使用首个工作表或 `Query1` |

Import rules:

- 支持 UTF-8、UTF-8 BOM、GBK。
- 每行失败不影响其他行导入。
- `yb_code_27` 使用字符串保存，允许包含字母前缀。
- `source_type=MVP_TEMPLATE` 时，按 MVP 简化模板导入。
- `source_type=NHSA_FULL_SPEC` 时，按 21 字段全量规格型号表导入暂存表，再清洗入 `dict_material_specs`。
- `source_type=NHSA_DISABLED` 时，按 2 字段停用表导入 `stg_nhsa_material_disabled`。
- `source_type=NHSA_TRANSCODE` 时，按 4 字段转码表导入 `stg_nhsa_material_transcode`。
- `yb_code_20` 缺失时可由 `yb_code_27` 前 20 位生成。
- 常见规格如 `22mm` 应拆分为 `spec_value=22`、`spec_unit=mm`。

Response `data`:

```json
{
  "batch_id": "material-import-20260505-001",
  "source_type": "NHSA_FULL_SPEC",
  "source_file_name": "16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx",
  "sheet_name": "Query1",
  "source_row_count": 6132,
  "unique_key_count": 5783,
  "skipped_duplicate_count": 349,
  "success_count": 5783,
  "failed_count": 0,
  "duplicate_count": 0,
  "disabled_count": 0,
  "transcoded_count": 0,
  "changed_count": 0,
  "mapped_count": 0,
  "retained_count": 6131,
  "failures": []
}
```

Import count semantics:

- `source_row_count`: source data rows after header, excluding empty rows.
- `unique_key_count`: distinct business keys accepted for processing, such as distinct `27位码` or distinct transcode pair.
- `skipped_duplicate_count`: duplicate source rows skipped because the business key already appeared in the same file.
- `success_count`: rows or unique keys successfully persisted or applied by the current importer.

NHSA source type structures:

| Source Type | Expected Columns | Target |
|---|---|---|
| `NHSA_FULL_SPEC` | 21 | `stg_nhsa_material_specs` then `dict_material_specs` |
| `NHSA_DISABLED` | 2 | `stg_nhsa_material_disabled` |
| `NHSA_TRANSCODE` | 4 | `stg_nhsa_material_transcode` |
| `MVP_TEMPLATE` | 11 | `dict_material_specs` |

### 7.3 `GET /api/v1/materials/transcode/resolve`

按医保耗材转码表查询 `原27位码 -> 27位码` 关系。该接口为只读追溯接口，不自动修改 `dict_material_specs`，也不自动创建 `sys_mapping_bridge` 映射。

Query:

| Name | Required | Description |
|---|:---:|---|
| `original_yb_code_27` | Yes | 转码表中的 `原27位码` |
| `batch_id` | No | 限定导入批次 |
| `change_type` | No | `变更` 或 `映射` |
| `page` | No | 页码，默认 1 |
| `page_size` | No | 页大小，默认 20，最大 100 |

Found response `data`:

```json
{
  "status": "FOUND",
  "original_yb_code_27": "C09010101000000066260000001",
  "items": [
    {
      "stg_id": 1001,
      "batch_id": "NHSA-TRANSCODE-20260505192209",
      "source_file_name": "31、转码表.xlsx",
      "sheet_name": "Query1",
      "row_number": 2,
      "original_yb_code_27": "C09010101000000066260000001",
      "original_code_status": "停用",
      "yb_code_27": "C09010101000000066260000099",
      "change_type": "变更",
      "created_at": "2026-05-05T19:23:01+08:00"
    }
  ],
  "page": {
    "page": 1,
    "page_size": 20,
    "total": 1
  }
}
```

Not found response `data`:

```json
{
  "status": "NOT_FOUND",
  "original_yb_code_27": "Z99999999999999999999999999",
  "items": [],
  "page": {
    "page": 1,
    "page_size": 20,
    "total": 0
  }
}
```

## 7A. Manufacturer Vendor APIs

厂商机构主数据属于 H-MDM 基础主数据能力，只维护机构标准身份。供应商门户、报价、合同、发票、付款、资质上传等业务协作不在 H-MDM 中实现。

### 7A.1 `GET /api/v1/manufacturer-vendors`

按标准名称、简称、英文名称、别名、统一社会信用代码或外部原始名称检索厂商机构档案。支持 `role_type`、`business_domain`、`status` 过滤。

### 7A.2 `POST /api/v1/manufacturer-vendors`

新增厂商机构主数据。`standard_name` 必填；`standard_name` 不允许重复；`unified_social_credit_code` 如存在必须唯一且为 18 位数字/大写字母。

Request `data`:

```json
{
  "organization_code": "MV00000001",
  "standard_name": "示例医疗器械有限公司",
  "english_name": "EXAMPLE MEDICAL DEVICE CO., LTD.",
  "short_name": "示例医疗",
  "alias_names": ["示例器械", "Example Medical"],
  "unified_social_credit_code": "91310000MA1K000001",
  "organization_type": "企业",
  "country_region": "中国",
  "status": "enabled"
}
```

### 7A.3 `POST /api/v1/manufacturer-vendors/{id}/roles`

为同一厂商维护多角色。允许同一机构同时具备 `manufacturer`、`registrant`、`filer`、`agent`、`dealer`、`distributor`、`after_sales`、`supplier`、`service_provider` 等角色。

### 7A.4 `POST /api/v1/manufacturer-vendor-relations`

维护母子公司、集团成员、被收购、曾用名、合并、授权代理、授权售后、区域代理、进口总代、配送关系等厂商关系。支持生效日期和失效日期。

### 7A.5 `POST /api/v1/manufacturer-vendors/{id}/external-mappings`

维护 NHSA、SPD、HIS、FINANCE、SUPPLIER_PORTAL、EQUIPMENT_OS、MANUAL、OTHER 等外部系统中的厂商编码和名称映射。

### 7A.6 Candidate Review APIs

医保耗材目录导入时，如源表包含生产企业、注册人、备案人、厂家等字段，系统会自动写入 `manufacturer_vendor_candidate` 并与 `manufacturer_vendor_master` 做确定性/相似匹配。

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/manufacturer-vendor-candidates` | 查询候选厂商 |
| POST | `/api/v1/manufacturer-vendor-candidates/{id}/map` | 候选映射到已有厂商 |
| POST | `/api/v1/manufacturer-vendor-candidates/{id}/merge` | 将候选原始名合并到已有厂商别名库，并补充外部编码映射 |
| POST | `/api/v1/manufacturer-vendor-candidates/{id}/create-vendor` | 候选创建新厂商 |
| POST | `/api/v1/manufacturer-vendor-candidates/{id}/ignore` | 忽略候选 |
| POST | `/api/v1/manufacturer-vendor-candidates/batch` | 批量执行 `map_existing`、`merge`、`ignore` |

### 7A.7 External Query APIs

医学装备运营管理平台、供应商门户和其他外部系统只引用 H-MDM 厂商机构主数据，不自行维护厂商标准名称权威库。

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/external/manufacturer-vendors?keyword=&role_type=&business_domain=` | 查询厂商 |
| GET | `/api/external/manufacturer-vendors/{id}` | 查询厂商详情 |
| GET | `/api/external/manufacturer-vendors/{id}/relations` | 查询厂商关系 |

返回字段包含 `organization_code`、`standard_name`、`english_name`、`short_name`、`alias_names`、`unified_social_credit_code`、`roles`、`status`；详情接口额外返回关系和外部编码映射。

## 7B. Equipment Dictionary APIs

装备字典属于 H-MDM 基础主数据能力。H-MDM 维护设备分类目录、设备标准名称和医疗器械分类目录参考数据，供医学装备运营管理平台、供应商门户和其它业务系统引用；H-MDM 不管理具体设备资产、维修、计量、折旧和位置流转。

### 7B.1 `GET /api/v1/equipment/categories`

按 `keyword`、`status`、`page`、`page_size` 查询设备分类目录。`keyword` 匹配分类编码或分类名称。

### 7B.2 `GET /api/v1/equipment/standard-names`

按 `keyword`、`category_id`、`status`、`page`、`page_size` 查询设备标准名称。`keyword` 匹配标准编码、标准名称或别名。响应包含 `category_id`、`device_classification_id`、`common_manufacturer_org_ids` 和 `management_class`。

### 7B.3 `GET /api/v1/equipment/device-classifications`

按 `keyword`、`management_class`、`page`、`page_size` 查询医疗器械分类目录参考表。`keyword` 匹配大类序号、大类名称、一级/二级产品类别序号、一级/二级产品类别、产品描述、预期用途或品名举例。

### 7B.4 `POST /api/v1/equipment/import`

使用 multipart 上传真实文件，必填 `source_type`，可选 `source_system`、`source_tx_id`、`sheet_name`。

| `source_type` | File | Required fields |
|---|---|---|
| `EQUIPMENT_CATEGORY` | CSV/XLSX | `category_code` / `设备分类编码`，`category_name` / `设备分类名称` |
| `EQUIPMENT_STANDARD_NAME` | CSV/XLSX | `standard_name` / `设备标准名称` |
| `DEVICE_CLASSIFICATION_CATALOG` | DOCX | 医疗器械分类目录表格 |

医疗器械分类目录 DOCX 导入会从正文标题识别大类序号和名称，例如 `01 有源手术器械`；从表格 `序号` 保存一级产品类别序号；从 `二级产品类别` 拆分二级产品类别序号和名称。设备标准名称可通过 `category_id`、`category_code`、`设备分类编码` 或 `设备分类名称` 关联设备分类；可通过 `device_classification_id`、`医疗器械分类ID`、`医疗器械分类编码` 或 `器械分类名称` 关联医疗器械分类目录；常见生产厂家必须保存 H-MDM 厂商机构主数据 `org_id`。

### 7B.5 External Query APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/external/equipment/categories?keyword=&page=&page_size=` | 查询设备分类目录 |
| GET | `/api/external/equipment/standard-names?keyword=&category_id=&page=&page_size=` | 查询设备标准名称 |
| GET | `/api/external/equipment/device-classifications?keyword=&management_class=&page=&page_size=` | 查询医疗器械分类目录 |

外部系统只读取 H-MDM 装备字典标准口径，并保存返回的分类或标准名称标识。医学装备运营管理平台仍负责保存具体品牌、型号、序列号、资产编号、科室、位置、档案、维修和计量等业务字段。

## 8. Import Task APIs

### 8.1 `POST /api/v1/import-tasks/materials`

创建异步耗材导入任务。该接口用于大文件或全目录导入场景，调用后立即返回导入批次，后台继续执行导入。

MVP 实现要求：

- 服务端必须先将上传文件写入运行时暂存目录，再创建后台任务。
- `sys_import_batch.source_file_path` 保存服务端文件路径，用于失败追溯和后续重试设计。
- `NHSA_FULL_SPEC` 后台导入必须从服务端文件路径流式读取 Excel，并按批次刷新任务进度，避免一次性读入完整大文件。
- 当前后台任务仍运行在 FastAPI 进程内；生产化增强应升级为队列/Worker 和更细粒度的失败重试。

Request type: `multipart/form-data`

| Field | Required | Description |
|---|:---:|---|
| `file` | Yes | CSV、Excel 或 DOCX 文件 |
| `source_system` | No | 默认 `MVP` |
| `source_tx_id` | No | 批次号；不传时由系统生成 |
| `source_type` | Yes | `MVP_TEMPLATE`, `NHSA_FULL_SPEC`, `NHSA_DISABLED`, `NHSA_TRANSCODE`, `DEVICE_CLASSIFICATION_CATALOG` |
| `sheet_name` | No | Excel 工作表名 |

Response `data`:

```json
{
  "batch_id": "IMPORT-NHSA_FULL_SPEC-20260506-abcdef12",
  "source_type": "NHSA_FULL_SPEC",
  "source_system": "NHSA_DIR_PERF",
  "source_file_name": "医保医用耗材代码_C03_骨科材料_全量规格型号信息_01.xlsx",
  "sheet_name": "Query1",
  "status": "PENDING",
  "progress_percent": 0,
  "source_row_count": 0,
  "success_count": 0,
  "failed_count": 0
}
```

Status values:

| Status | Meaning |
|---|---|
| `PENDING` | 任务已创建，等待后台执行 |
| `RUNNING` | 正在导入 |
| `COMPLETED` | 导入完成且无失败行 |
| `COMPLETED_WITH_ERRORS` | 导入完成但存在行级失败 |
| `FAILED` | 文件级异常或任务异常 |

### 8.2 `GET /api/v1/import-tasks/{batch_id}`

查询导入批次状态、进度和统计。

### 8.3 `GET /api/v1/import-tasks`

Query:

| Name | Required | Description |
|---|:---:|---|
| `status` | No | 按任务状态过滤 |
| `source_type` | No | 按导入源类型过滤 |
| `page` | No | 页码 |
| `page_size` | No | 页大小 |

### 8.4 `GET /api/v1/import-tasks/{batch_id}/failures`

查询导入失败行。文件级失败会记录一条无行号的失败记录；行级失败默认只返回行号、字段和错误消息，不返回原始 `raw_payload`。如需私有排障，可显式传入 `include_raw_payload=true`，但不得直接用于公开 UAT evidence。

Query:

| Name | Required | Description |
|---|:---:|---|
| `page` | No | 页码 |
| `page_size` | No | 页大小 |
| `include_raw_payload` | No | 默认 `false`；为 `true` 时返回原始失败载荷，仅 `raw_payload.view` 权限可用 |

Response item:

```json
{
  "failure_id": 1,
  "batch_id": "PY-E2E-ASYNC-MAT-FAIL-001",
  "row_number": 2,
  "field_name": "yb_code_27",
  "message": "医保码必须为27位",
  "raw_payload_included": false,
  "created_at": "2026-05-08T10:00:00+08:00"
}
```

## 9. Mapping APIs

### 9.1 `POST /api/v1/mapping/resolve`

Request:

```json
{
  "source_system": "SPD",
  "source_tx_id": "SPD-20260505-000001",
  "category": "material",
  "source_key": "SPD-MAT-001",
  "source_desc": "一次性使用无菌导管 22mm"
}
```

Matched response `data`:

```json
{
  "status": "MATCHED",
  "target_master_id": "b5d8ef20-08e3-4bb0-90ad-001000000001",
  "target_code": "123456789012345678901234567",
  "mapping_rule": "MANUAL",
  "confidence": 1.0
}
```

Pending response `data`:

```json
{
  "status": "PENDING_REVIEW",
  "review_task_id": "d88ad6b2-16f5-4c75-bd86-001000000001",
  "candidate_count": 0
}
```

Rules:

- `category` MVP 仅支持 `department`、`material`。
- 命中 ACTIVE 映射返回 `MATCHED`。
- 未命中时创建 PENDING 审核任务；若同一任务已存在，不重复创建。
- 映射冲突返回 `MAPPING_CONFLICT`。

### 9.2 `GET /api/v1/mapping/review-tasks`

Query:

| Name | Required | Description |
|---|:---:|---|
| `status` | No | `PENDING`、`APPROVED`、`REJECTED` |
| `category` | No | `department`、`material` |
| `source_system` | No | 来源系统 |
| `page` | No | 页码 |
| `size` | No | 页大小 |

Response `data`:

```json
{
  "items": [
    {
      "task_id": "d88ad6b2-16f5-4c75-bd86-001000000001",
      "category": "material",
      "source_system": "SPD",
      "source_key": "SPD-MAT-999",
      "source_desc": "未知耗材",
      "status": "PENDING",
      "candidate_json": []
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 9.3 `POST /api/v1/mapping/review-tasks/{task_id}/approve`

Request:

```json
{
  "source_system": "H-UDMP",
  "source_tx_id": "review-approve-20260505-0001",
  "target_master_id": "b5d8ef20-08e3-4bb0-90ad-001000000001",
  "target_code": "123456789012345678901234567",
  "reviewer": "data_admin",
  "review_comment": "确认为标准耗材"
}
```

`source_system` 与 `source_tx_id` 参与写入幂等键（见「2.5 Idempotency」），由调用方生成唯一事务号。

Response `data`:

```json
{
  "task_id": "d88ad6b2-16f5-4c75-bd86-001000000001",
  "bridge_id": "19e439bb-c572-4cd1-9ae3-001000000001",
  "status": "APPROVED"
}
```

Rules:

- `target_master_id` 必须存在于对应主数据表。
- 审核通过后创建 ACTIVE 映射。
- 已处理任务重复审核返回 `DUPLICATE_RECORD` 或业务校验错误。

### 9.4 `POST /api/v1/mapping/review-tasks/{task_id}/reject`

Request:

```json
{
  "source_system": "H-UDMP",
  "source_tx_id": "review-reject-20260505-0001",
  "reviewer": "data_admin",
  "review_comment": "来源编码无效，需 SPD 重新提供"
}
```

Response `data`:

```json
{
  "task_id": "d88ad6b2-16f5-4c75-bd86-001000000001",
  "status": "REJECTED"
}
```

## 10. Exchange Log API

### 10.1 `GET /api/v1/exchange/logs`

Query:

| Name | Required | Description |
|---|:---:|---|
| `source_system` | No | 来源系统 |
| `status` | No | `SUCCESS`、`FAILED`、`CONFLICT` |
| `data_category` | No | `department`、`material`、`mapping`、`import` |
| `start_time` | No | 起始时间 |
| `end_time` | No | 截止时间 |
| `page` | No | 页码 |
| `page_size` / `size` | No | 页大小，最大 100 |

Response `data`:

```json
{
  "items": [
    {
      "log_id": 1,
      "trace_id": "trace-20260505-000001",
      "source_system": "SPD",
      "source_tx_id": "SPD-20260505-000001",
      "data_category": "mapping",
      "status": "SUCCESS",
      "error_code": null,
      "processing_time_ms": 35,
      "created_at": "2026-05-05T09:00:00+08:00"
    }
  ],
  "page": {
    "page": 1,
    "page_size": 20,
    "total": 1
  }
}
```

### 10.2 `GET /api/v1/exchange/logs/{log_id}`

返回单条交换日志详情。该接口仅提供脱敏摘要，不返回原始 `request_payload` 或 `response_payload`，用于 UAT 证据、问题定位和审计复核。

Response `data`:

```json
{
  "log_id": 1,
  "trace_id": "trace-20260505-000001",
  "source_system": "SPD",
  "source_tx_id": "SPD-20260505-000001",
  "data_category": "mapping",
  "status": "SUCCESS",
  "error_code": null,
  "processing_time_ms": 35,
  "created_at": "2026-05-05T09:00:00+08:00",
  "payload_policy": {
    "raw_request_payload_included": false,
    "raw_response_payload_included": false,
    "allowed_field_strategy": "allowlist_only",
    "sensitive_key_strategy": "keyword_redaction",
    "sensitive_keywords": ["api_key", "apikey", "authorization", "password", "secret", "token", "file", "raw_payload"]
  },
  "request_payload_summary": {
    "payload_type": "object",
    "top_level_keys": ["category", "source_system", "source_key", "source_tx_id"],
    "allowlisted_fields": {
      "category": "material",
      "source_system": "SPD",
      "source_key": "SPD-MAT-001",
      "source_tx_id": "SPD-20260505-000001"
    },
    "sensitive_keys_redacted": [],
    "raw_payload_included": false
  },
  "response_payload_summary": {
    "payload_type": "object",
    "top_level_keys": ["status", "target_code"],
    "allowlisted_fields": {
      "status": "MATCHED",
      "target_code": "123456789012345678901234567"
    },
    "sensitive_keys_redacted": [],
    "raw_payload_included": false
  }
}
```

## 11. Acceptance Checklist

- All endpoints are visible in Swagger/OpenAPI.
- All write endpoints record `sys_exchange_log`.
- All write endpoints enforce idempotency.
- `POST /api/v1/materials/import` supports `source_type` and NHSA source structures.
- All paginated endpoints use the common pagination envelope.
- All errors use the common error envelope and MVP error codes.
