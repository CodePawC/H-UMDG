# H-UDMP MVP 开发任务书

> 项目：H-UDMP 医院统一数据管理中台  
> 文档版本：v1.0  
> 状态：开发输入稿  
> 日期：2026-05-04  
> 来源：基于 `H-UDMP_医院统一数据管理中台_V4_形式逻辑增强版.md` 抽取 MVP 范围

---

## 目录

- [1. 文档目的](#1-文档目的)
- [2. MVP 目标与边界](#2-mvp-目标与边界)
- [3. 角色与业务流程](#3-角色与业务流程)
- [4. 功能清单与优先级](#4-功能清单与优先级)
- [5. 数据表与字段契约](#5-数据表与字段契约)
- [6. API 契约](#6-api-契约)
- [7. 导入模板与样例数据要求](#7-导入模板与样例数据要求)
- [8. 开发任务拆分](#8-开发任务拆分)
- [9. 测试与验收标准](#9-测试与验收标准)
- [10. 部署、运行与交付物](#10-部署运行与交付物)
- [11. 待院方确认事项](#11-待院方确认事项)
- [12. 非 MVP 范围与后续预留](#12-非-mvp-范围与后续预留)

---

## 1. 文档目的

本文档用于 H-UDMP 首期 MVP 的开发排期、需求澄清、接口联调和验收测试。它不是完整平台方案，而是从 V4 总体方案中抽取出来的最小可交付开发任务书。

MVP 的核心目标是验证两个命题：

1. 全院共享字典可以先从“科室字典 + 耗材 27 位码字典”落地。
2. 外部系统编码可以通过“映射桥”转换为中台标准编码，从而降低系统耦合。

本文档中的字段、接口、流程和验收标准是首期开发的默认输入。若后续院方提供真实 SPD/HIS/LIS 字段样本，应以本文档的数据契约为骨架进行字段映射补充，而不是重新定义平台机制。

---

## 2. MVP 目标与边界

### 2.1 MVP 建设目标

| 目标 | 说明 | 验收证据 |
|---|---|---|
| 建立基础工程 | FastAPI、PostgreSQL、Redis、Docker Compose 可运行 | 本地/内网环境可启动，`GET /health` 正常 |
| 建立科室标准字典 | 支持科室导入、检索、状态维护 | 科室样例导入报告与检索结果 |
| 建立耗材标准字典 | 支持耗材 27 位码导入、检索、基础清洗 | 耗材样例导入报告与检索结果 |
| 跑通映射桥 | 外部系统编码可解析为标准主数据 ID | SPD 样例编码解析结果 |
| 建立待审核机制 | 未匹配编码自动进入审核任务 | 待审核任务列表与审核结果 |
| 建立交换日志 | 记录接入、解析、错误、幂等冲突 | 日志查询结果 |
| 验证幂等写入 | 重复提交不产生重复记录 | 幂等测试用例结果 |

### 2.2 MVP 范围内

MVP 仅包含以下内容：

- FastAPI 后端基础工程。
- PostgreSQL 数据库模型与迁移。
- Redis 基础接入，用于幂等短缓存和后续任务扩展预留。
- 科室字典 `dict_departments`。
- 耗材规格字典 `dict_material_specs`。
- 映射桥 `sys_mapping_bridge`。
- 映射审核任务 `sys_mapping_review_task`。
- 交换日志 `sys_exchange_log`。
- 接口注册表 `sys_api_registry`。
- 科室与耗材批量导入。
- 主数据检索。
- 映射解析。
- 映射审核通过/拒绝。
- SPD 样例系统接入。
- Swagger/OpenAPI 文档。
- 最小测试集与验收材料。

### 2.3 MVP 范围外

以下内容不进入 MVP 开发，只做表结构、模块边界或扩展口预留：

- FHIR R4 API。
- 外报网关。
- 药品字典。
- 诊疗项目字典。
- DRG/DIP 分组器。
- 医保代码自动订阅。
- 字典 Blueprint 发布。
- 完整前端管理系统。
- 完整 RBAC 权限体系。
- 审计日志不可篡改。
- 冷热分离和长期归档。
- Prometheus/Grafana 生产级监控。

### 2.4 默认技术约束

| 类别 | 默认选型 |
|---|---|
| 后端 | FastAPI，Python 3.11+ |
| ORM | SQLAlchemy 2.0 |
| 数据库 | PostgreSQL 16，开发环境可兼容 PostgreSQL 15 |
| 缓存 | Redis 7 |
| 迁移 | Alembic |
| 接口文档 | FastAPI OpenAPI/Swagger |
| 部署 | Docker Compose |
| 测试 | pytest + httpx/TestClient |
| 认证 | MVP 采用内网服务级 API Key |

---

## 3. 角色与业务流程

### 3.1 角色定义

| 角色 | MVP 职责 |
|---|---|
| 平台管理员 | 部署服务、维护系统配置、查看交换日志 |
| 数据治理员 | 导入字典、审核未匹配映射、处理冲突数据 |
| SPD 系统/厂商 | 提供耗材与科室样例数据，调用映射解析接口 |
| 开发人员 | 实现后端、数据库、接口、导入、测试和部署脚本 |
| 测试人员 | 执行单元、集成、验收、性能基础测试 |
| 院方信息部门 | 确认样例数据、接口访问方式、验收结果 |

### 3.2 科室字典导入流程

```text
数据治理员准备科室 CSV/Excel
  ↓
调用 POST /api/v1/departments/import
  ↓
系统校验编码、名称、层级、状态
  ↓
合法记录写入 dict_departments
  ↓
返回导入批次报告
  ↓
通过 GET /api/v1/departments/search 验证检索
```

### 3.3 耗材字典导入流程

```text
数据治理员准备耗材 CSV/Excel
  ↓
调用 POST /api/v1/materials/import
  ↓
系统校验 27 位码、通用名、注册证号、规格字段
  ↓
拆分规格值和规格单位
  ↓
合法记录写入 dict_material_specs
  ↓
返回导入批次报告
  ↓
通过 GET /api/v1/materials/search 验证检索
```

### 3.4 SPD 编码解析流程

```text
SPD 推送来源编码
  ↓
调用 POST /api/v1/mapping/resolve
  ↓
系统按 category + source_system + source_key 检索映射桥
  ├─ 命中 ACTIVE 映射：返回标准 master_id
  └─ 未命中：创建 sys_mapping_review_task
          ↓
     数据治理员审核
          ↓
     审核通过后生成 sys_mapping_bridge
          ↓
     SPD 再次调用即可命中
```

### 3.5 幂等处理流程

```text
写入请求携带 source_system + source_tx_id
  ↓
系统计算 payload_hash
  ↓
查询 sys_exchange_log
  ├─ 不存在：正常处理并记录日志
  ├─ 存在且 payload_hash 一致：返回首次处理结果
  └─ 存在但 payload_hash 不一致：返回 IDEMPOTENCY_CONFLICT
```

---

## 4. 功能清单与优先级

### 4.1 优先级定义

| 优先级 | 含义 |
|---|---|
| P0 | MVP 必须交付，缺失则不能验收 |
| P1 | MVP 应交付，特殊情况下可延期但需记录风险 |
| P2 | 预留或增强，默认不进入 MVP |

### 4.2 功能清单

| 模块 | 功能 | 优先级 | 说明 |
|---|---|:---:|---|
| 工程基础 | FastAPI 工程骨架 | P0 | 包含路由、配置、数据库连接、异常处理 |
| 工程基础 | Docker Compose | P0 | 后端、PostgreSQL、Redis |
| 工程基础 | Alembic 迁移 | P0 | 可初始化数据库结构 |
| 工程基础 | API Key 认证 | P1 | MVP 可先服务级鉴权 |
| 科室字典 | 科室导入 | P0 | CSV/Excel，返回导入报告 |
| 科室字典 | 科室检索 | P0 | 支持编码、名称、别名查询 |
| 科室字典 | 科室层级 | P1 | 院区、科室、诊疗组 |
| 耗材字典 | 耗材导入 | P0 | 支持 27 位码、通用名、规格、注册证号 |
| 耗材字典 | 耗材检索 | P0 | 支持 27 位码、通用名、注册证号 |
| 耗材字典 | 规格拆分 | P0 | `22mm` 拆为 `22` + `mm` |
| 映射桥 | 映射解析 | P0 | 命中返回标准 ID |
| 映射桥 | 未命中创建待审核 | P0 | 自动生成审核任务 |
| 映射桥 | 审核通过/拒绝 | P0 | 审核通过生成映射 |
| 映射桥 | 映射冲突检测 | P0 | 同来源编码不能指向多个有效目标 |
| 交换日志 | 写入日志 | P0 | 记录请求、响应、状态、耗时 |
| 交换日志 | 日志查询 | P0 | 按系统、状态、时间查询 |
| 幂等 | 重复提交处理 | P0 | 同键同报文返回首次结果 |
| 幂等 | 幂等冲突处理 | P0 | 同键不同报文返回冲突 |
| SPD 样例 | SPD 编码解析样例 | P0 | 用样例数据跑通 |
| 文档 | OpenAPI 文档 | P0 | Swagger 可查看和调试 |
| 测试 | 单元和集成测试 | P0 | 覆盖核心流程 |
| 监控 | 基础健康检查 | P0 | `GET /health` |
| 监控 | Prometheus 指标 | P2 | 一期增强 |
| 前端 | 管理端页面 | P2 | MVP 默认不用完整前端 |

---

## 5. 数据表与字段契约

### 5.1 通用字段规则

所有 MVP 核心业务表默认包含：

| 字段 | 类型 | 规则 |
|---|---|---|
| `created_at` | TIMESTAMP | 创建时间，系统自动写入 |
| `updated_at` | TIMESTAMP | 更新时间，系统自动更新 |
| `created_by` | VARCHAR(100) | 可为空，接口调用方或操作人 |
| `updated_by` | VARCHAR(100) | 可为空，接口调用方或操作人 |

状态字段默认使用字符串枚举，不在 MVP 中引入复杂状态机引擎。

### 5.2 `dict_departments`

用途：保存 MVP 范围内的标准科室字典。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `dept_id` | UUID | 是 | 主键 |
| `dept_code` | VARCHAR(100) | 是 | 中台标准科室编码，唯一 |
| `dept_name` | VARCHAR(200) | 是 | 标准科室名称 |
| `dept_alias` | VARCHAR(500) | 否 | 常见别名，多个别名可用分号分隔 |
| `parent_dept_id` | UUID | 否 | 上级科室 |
| `dept_type` | VARCHAR(50) | 否 | 院区/临床/医技/行政/诊疗组 |
| `oid` | VARCHAR(200) | 否 | 院内 OID |
| `status` | VARCHAR(20) | 是 | ACTIVE/INACTIVE |
| `source_batch_id` | VARCHAR(100) | 否 | 导入批次 |

约束：

- `dept_code` 唯一。
- `dept_name` 不为空。
- `parent_dept_id` 若存在，必须指向已有科室。

### 5.3 `dict_material_specs`

用途：保存 MVP 范围内的耗材规格主数据。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `material_id` | UUID | 是 | 主键 |
| `yb_code_27` | VARCHAR(50) | 是 | 医保 27 位码，唯一，按字符串保存 |
| `yb_code_20` | VARCHAR(50) | 否 | 医保 20 位分类码，按字符串保存 |
| `generic_name` | VARCHAR(200) | 是 | 医保通用名或院内标准名 |
| `brand_name` | VARCHAR(200) | 否 | 品牌或生产企业 |
| `cat_level_1` | VARCHAR(200) | 否 | 医保一级分类 |
| `cat_level_2` | VARCHAR(200) | 否 | 医保二级分类 |
| `cat_level_3` | VARCHAR(200) | 否 | 医保三级分类 |
| `material_attr` | VARCHAR(100) | 否 | 材质 |
| `spec_value` | VARCHAR(50) | 否 | 规格值，不含单位 |
| `spec_unit` | VARCHAR(20) | 否 | 规格单位 |
| `model_detail` | VARCHAR(100) | 否 | 型号 |
| `reg_number` | VARCHAR(100) | 否 | 注册证号 |
| `unit_pkg` | VARCHAR(20) | 否 | 包装单位 |
| `status` | VARCHAR(20) | 是 | ACTIVE/INACTIVE |
| `source_batch_id` | VARCHAR(100) | 否 | 导入批次 |
| `extra_attrs` | JSONB | 否 | 扩展属性 |

约束：

- `yb_code_27` 唯一，当前医保标准码校验长度为 27；数据库不用定长 CHAR，避免字母前缀、导入空格填充和后续扩展造成截断或比较异常。
- `yb_code_20` 若为空，系统可从 `yb_code_27` 前 20 位自动生成。
- 不允许只在 `model_detail` 或 `extra_attrs` 中保存完整规格而不拆分 `spec_value`、`spec_unit`。

### 5.4 `sys_mapping_bridge`

用途：保存外部系统编码到中台标准主数据的映射。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `bridge_id` | UUID | 是 | 主键 |
| `category` | VARCHAR(50) | 是 | department/material |
| `source_system` | VARCHAR(50) | 是 | 来源系统，如 SPD |
| `source_key` | VARCHAR(200) | 是 | 来源系统原始编码 |
| `source_desc` | VARCHAR(500) | 否 | 来源系统描述 |
| `target_master_id` | UUID | 是 | 标准主数据 ID |
| `target_code` | VARCHAR(100) | 否 | 标准主数据编码 |
| `mapping_rule` | VARCHAR(20) | 是 | EXACT/MANUAL/IMPORT |
| `confidence` | DECIMAL(5,4) | 否 | 置信度，人工映射可为 1 |
| `status` | VARCHAR(20) | 是 | ACTIVE/INACTIVE |
| `last_verified` | TIMESTAMP | 否 | 最后核验时间 |

约束：

- `UNIQUE(category, source_system, source_key, status)`。
- ACTIVE 映射中，同一个 `category + source_system + source_key` 只能有一条。
- MVP 不做复杂模糊匹配自动生效，模糊候选只进入审核任务。

### 5.5 `sys_mapping_review_task`

用途：保存未匹配或需人工确认的映射任务。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `task_id` | UUID | 是 | 主键 |
| `category` | VARCHAR(50) | 是 | department/material |
| `source_system` | VARCHAR(50) | 是 | 来源系统 |
| `source_key` | VARCHAR(200) | 是 | 来源编码 |
| `source_desc` | VARCHAR(500) | 否 | 来源描述 |
| `candidate_json` | JSONB | 否 | 候选标准项 |
| `status` | VARCHAR(20) | 是 | PENDING/APPROVED/REJECTED |
| `reviewer` | VARCHAR(100) | 否 | 审核人 |
| `review_comment` | TEXT | 否 | 审核意见 |
| `reviewed_at` | TIMESTAMP | 否 | 审核时间 |

约束：

- PENDING 状态下，同一 `category + source_system + source_key` 不重复创建任务。
- APPROVED 后必须生成或关联一条 ACTIVE 映射。

### 5.6 `sys_exchange_log`

用途：记录写入型请求、映射解析请求和错误处理过程。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `log_id` | BIGSERIAL | 是 | 主键 |
| `trace_id` | VARCHAR(100) | 是 | 链路 ID |
| `source_system` | VARCHAR(50) | 是 | 来源系统 |
| `source_tx_id` | VARCHAR(200) | 是 | 来源事务号 |
| `target_system` | VARCHAR(50) | 否 | 目标系统，默认 H-UDMP |
| `data_category` | VARCHAR(50) | 是 | department/material/mapping/import |
| `request_payload` | JSONB | 否 | 请求摘要或完整请求 |
| `response_payload` | JSONB | 否 | 响应摘要 |
| `payload_hash` | VARCHAR(128) | 是 | 请求报文哈希 |
| `status` | VARCHAR(20) | 是 | SUCCESS/FAILED/CONFLICT |
| `error_code` | VARCHAR(100) | 否 | 错误码 |
| `processing_time_ms` | INTEGER | 否 | 处理耗时 |

约束：

- `UNIQUE(source_system, source_tx_id)`。
- 若同键再次提交且 `payload_hash` 一致，返回首次响应。
- 若同键再次提交但 `payload_hash` 不一致，返回 `IDEMPOTENCY_CONFLICT`。

### 5.7 `sys_api_registry`

用途：记录 MVP 接口和外部样例系统信息。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `api_id` | UUID | 是 | 主键 |
| `api_name` | VARCHAR(200) | 是 | 接口名称 |
| `source_system` | VARCHAR(50) | 否 | 来源系统 |
| `target_system` | VARCHAR(50) | 否 | 目标系统 |
| `protocol` | VARCHAR(20) | 是 | REST/File |
| `endpoint_url` | VARCHAR(500) | 否 | 地址 |
| `version` | VARCHAR(20) | 是 | 版本 |
| `status` | VARCHAR(20) | 是 | Active/Inactive |
| `owner` | VARCHAR(100) | 否 | 责任人 |

---

## 6. API 契约

### 6.1 通用规则

基础路径：`/api/v1`

请求头：

| Header | 必填 | 说明 |
|---|:---:|---|
| `X-API-Key` | 是 | MVP 服务级 API Key |
| `X-Request-ID` | 否 | 调用方请求 ID，若无则服务端生成 |

响应通用结构：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "trace_id": "trace-20260504-000001"
}
```

错误响应：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "字段校验失败",
    "details": []
  },
  "trace_id": "trace-20260504-000001"
}
```

### 6.2 `GET /health`

用途：服务健康检查。

成功响应：

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "mvp-v1"
}
```

### 6.3 `GET /api/v1/departments/search`

用途：检索科室字典。

查询参数：

| 参数 | 必填 | 说明 |
|---|:---:|---|
| `q` | 否 | 名称、别名、编码关键字 |
| `dept_code` | 否 | 精确编码 |
| `status` | 否 | ACTIVE/INACTIVE |
| `page` | 否 | 默认 1 |
| `size` | 否 | 默认 20，最大 100 |

响应 `data`：

```json
{
  "items": [
    {
      "dept_id": "uuid",
      "dept_code": "DEPT001",
      "dept_name": "心脏外科",
      "dept_alias": "心外科;胸心外科",
      "status": "ACTIVE"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 6.4 `POST /api/v1/departments/import`

用途：批量导入科室。

请求类型：`multipart/form-data`

字段：

| 字段 | 必填 | 说明 |
|---|:---:|---|
| `file` | 是 | CSV 或 Excel |
| `source_system` | 是 | 默认 `MANUAL` |
| `source_tx_id` | 是 | 导入事务号，用于幂等 |

响应 `data`：

```json
{
  "batch_id": "dept-import-20260504-001",
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

### 6.5 `GET /api/v1/materials/search`

用途：检索耗材字典。

查询参数：

| 参数 | 必填 | 说明 |
|---|:---:|---|
| `q` | 否 | 通用名、品牌、型号关键字 |
| `yb_code_27` | 否 | 医保 27 位码精确查询 |
| `reg_number` | 否 | 注册证号 |
| `status` | 否 | ACTIVE/INACTIVE |
| `page` | 否 | 默认 1 |
| `size` | 否 | 默认 20，最大 100 |

响应 `data`：

```json
{
  "items": [
    {
      "material_id": "uuid",
      "yb_code_27": "123456789012345678901234567",
      "generic_name": "一次性使用无菌导管",
      "spec_value": "22",
      "spec_unit": "mm",
      "reg_number": "国械注准2026xxxx"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 6.6 `POST /api/v1/materials/import`

用途：批量导入耗材。

请求类型：`multipart/form-data`

字段：

| 字段 | 必填 | 说明 |
|---|:---:|---|
| `file` | 是 | CSV 或 Excel |
| `source_system` | 是 | 默认 `MANUAL` |
| `source_tx_id` | 是 | 导入事务号，用于幂等 |

导入要求：

- 支持 UTF-8、UTF-8 BOM、GBK。
- 支持 CSV 和 Excel。
- 每行失败不影响其他行导入。
- 返回失败明细。

### 6.7 `POST /api/v1/mapping/resolve`

用途：将外部系统编码解析为中台标准主数据。

请求：

```json
{
  "source_system": "SPD",
  "source_tx_id": "SPD-20260504-000001",
  "category": "material",
  "source_key": "SPD-MAT-001",
  "source_desc": "一次性使用无菌导管 22mm"
}
```

匹配成功响应 `data`：

```json
{
  "status": "MATCHED",
  "target_master_id": "uuid",
  "target_code": "123456789012345678901234567",
  "mapping_rule": "MANUAL",
  "confidence": 1.0
}
```

未匹配响应 `data`：

```json
{
  "status": "PENDING_REVIEW",
  "review_task_id": "uuid",
  "candidate_count": 0
}
```

### 6.8 `GET /api/v1/mapping/review-tasks`

用途：查询待审核映射任务。

查询参数：

| 参数 | 必填 | 说明 |
|---|:---:|---|
| `status` | 否 | PENDING/APPROVED/REJECTED |
| `category` | 否 | department/material |
| `source_system` | 否 | SPD/HIS 等 |
| `page` | 否 | 默认 1 |
| `size` | 否 | 默认 20 |

### 6.9 `POST /api/v1/mapping/review-tasks/{task_id}/approve`

用途：审核通过映射任务并生成映射。

请求：

```json
{
  "target_master_id": "uuid",
  "target_code": "DEPT001",
  "reviewer": "data_admin",
  "review_comment": "确认为心脏外科"
}
```

成功响应：

```json
{
  "success": true,
  "data": {
    "task_id": "uuid",
    "bridge_id": "uuid",
    "status": "APPROVED"
  },
  "error": null,
  "trace_id": "trace-20260504-000002"
}
```

### 6.10 `POST /api/v1/mapping/review-tasks/{task_id}/reject`

用途：拒绝映射任务。

请求：

```json
{
  "reviewer": "data_admin",
  "review_comment": "来源编码无效，需 SPD 重新提供"
}
```

### 6.11 `GET /api/v1/exchange/logs`

用途：查询交换日志。

查询参数：

| 参数 | 必填 | 说明 |
|---|:---:|---|
| `source_system` | 否 | 来源系统 |
| `status` | 否 | SUCCESS/FAILED/CONFLICT |
| `data_category` | 否 | department/material/mapping/import |
| `start_time` | 否 | 起始时间 |
| `end_time` | 否 | 截止时间 |
| `page` | 否 | 默认 1 |
| `size` | 否 | 默认 20 |

### 6.12 MVP 错误码

| 错误码 | HTTP 状态 | 说明 |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | 字段校验失败 |
| `UNAUTHORIZED` | 401 | API Key 无效 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `MAPPING_NOT_FOUND` | 200 | 未匹配，已创建审核任务 |
| `MAPPING_CONFLICT` | 409 | 映射冲突 |
| `IDEMPOTENCY_CONFLICT` | 409 | 幂等键冲突 |
| `DUPLICATE_RECORD` | 409 | 唯一约束冲突 |
| `INTERNAL_ERROR` | 500 | 未预期异常 |

---

## 7. 导入模板与样例数据要求

### 7.1 科室导入模板

文件名建议：`departments_template.csv`

| 字段 | 必填 | 示例 | 说明 |
|---|:---:|---|---|
| `dept_code` | 是 | `DEPT001` | 标准科室编码 |
| `dept_name` | 是 | `心脏外科` | 标准科室名称 |
| `dept_alias` | 否 | `心外科;胸心外科` | 别名 |
| `parent_dept_code` | 否 | `HOSP001` | 上级科室编码 |
| `dept_type` | 否 | `临床` | 院区/临床/医技/行政/诊疗组 |
| `oid` | 否 | `1.2.156.xxxxx.1.2.001` | 院内 OID |
| `status` | 是 | `ACTIVE` | ACTIVE/INACTIVE |

最小样例：

```csv
dept_code,dept_name,dept_alias,parent_dept_code,dept_type,oid,status
DEPT001,心脏外科,心外科;胸心外科,,临床,1.2.156.xxxxx.1.2.001,ACTIVE
DEPT002,检验科,LIS检验科,,医技,1.2.156.xxxxx.1.2.002,ACTIVE
```

### 7.2 耗材导入模板

文件名建议：`materials_template.csv`

| 字段 | 必填 | 示例 | 说明 |
|---|:---:|---|---|
| `yb_code_27` | 是 | `123456789012345678901234567` | 医保 27 位码 |
| `yb_code_20` | 否 | `12345678901234567890` | 可由 27 位码前 20 位生成 |
| `generic_name` | 是 | `一次性使用无菌导管` | 标准通用名 |
| `brand_name` | 否 | `示例品牌` | 品牌或厂家 |
| `material_attr` | 否 | `高分子` | 材质 |
| `spec_value` | 否 | `22` | 规格值 |
| `spec_unit` | 否 | `mm` | 规格单位 |
| `model_detail` | 否 | `A-22` | 型号 |
| `reg_number` | 否 | `国械注准2026xxxx` | 注册证号 |
| `unit_pkg` | 否 | `支` | 包装单位 |
| `status` | 是 | `ACTIVE` | ACTIVE/INACTIVE |

最小样例：

```csv
yb_code_27,yb_code_20,generic_name,brand_name,material_attr,spec_value,spec_unit,model_detail,reg_number,unit_pkg,status
123456789012345678901234567,12345678901234567890,一次性使用无菌导管,示例品牌,高分子,22,mm,A-22,国械注准2026xxxx,支,ACTIVE
123456789012345678901234568,12345678901234567890,一次性使用输液器,示例品牌,高分子,50,ml,B-50,国械注准2026yyyy,套,ACTIVE
```

### 7.3 SPD 映射样例

文件名建议：`spd_mapping_samples.csv`

| 字段 | 必填 | 示例 | 说明 |
|---|:---:|---|---|
| `source_system` | 是 | `SPD` | 来源系统 |
| `category` | 是 | `material` | department/material |
| `source_key` | 是 | `SPD-MAT-001` | SPD 原始编码 |
| `source_desc` | 否 | `一次性使用无菌导管 22mm` | SPD 原始描述 |
| `target_code` | 否 | `123456789012345678901234567` | 已知标准编码 |

---

## 8. 开发任务拆分

### 8.1 交付节奏

| 周期 | 目标 | 主要产出 |
|---|---|---|
| 第 1-2 周 | 工程骨架、数据库、认证框架、基础字典模型 | 可启动服务、迁移脚本、基础表 |
| 第 3-4 周 | 科室/耗材导入与检索 | 导入接口、检索接口、导入报告 |
| 第 5-6 周 | 映射桥与待审核任务 | 映射解析、审核 API、冲突处理 |
| 第 7-8 周 | SPD 样例接入、交换日志、幂等 | SPD 样例跑通、日志查询、幂等测试 |
| 第 9-10 周 | 测试、修复、部署脚本、验收材料 | 测试报告、部署文档、验收清单 |
| 第 11-12 周 | 缓冲、联调和培训 | 联调问题修复、培训材料 |

### 8.2 后端任务

| 编号 | 任务 | 优先级 | 完成标准 |
|---|---|:---:|---|
| BE-01 | 初始化 FastAPI 工程 | P0 | 服务可启动，Swagger 可打开 |
| BE-02 | 配置管理与环境变量 | P0 | 支持 dev/test/prod 配置 |
| BE-03 | 数据库连接与 Alembic | P0 | 可执行迁移创建 MVP 表 |
| BE-04 | API Key 鉴权中间件 | P1 | 无 Key 返回 401 |
| BE-05 | 统一异常和响应结构 | P0 | API 响应格式一致 |
| BE-06 | 科室模型与检索 API | P0 | 可按编码/名称检索 |
| BE-07 | 科室导入 API | P0 | 返回导入报告 |
| BE-08 | 耗材模型与检索 API | P0 | 可按 27 位码/名称/注册证查询 |
| BE-09 | 耗材导入与规格拆分 | P0 | 可拆分常见规格 |
| BE-10 | 映射桥解析 API | P0 | 命中/未命中流程正确 |
| BE-11 | 待审核任务 API | P0 | 可查询、通过、拒绝 |
| BE-12 | 交换日志服务 | P0 | 写入和查询日志 |
| BE-13 | 幂等处理服务 | P0 | 同键同报文不重复写入 |
| BE-14 | SPD 样例适配器 | P0 | 样例编码可解析 |
| BE-15 | OpenAPI 描述优化 | P1 | Swagger 可用于联调 |

### 8.3 数据库任务

| 编号 | 任务 | 优先级 | 完成标准 |
|---|---|:---:|---|
| DB-01 | 设计 MVP 表迁移 | P0 | 六张核心表可创建 |
| DB-02 | 创建唯一约束和索引 | P0 | 唯一键和查询索引生效 |
| DB-03 | 初始化枚举或约束值 | P1 | 状态、类别字段受控 |
| DB-04 | 准备样例数据脚本 | P0 | 可一键导入测试样例 |

### 8.4 测试任务

| 编号 | 任务 | 优先级 | 完成标准 |
|---|---|:---:|---|
| QA-01 | 单元测试框架 | P0 | pytest 可运行 |
| QA-02 | 导入测试 | P0 | 成功、失败、重复记录覆盖 |
| QA-03 | 搜索测试 | P0 | 科室和耗材检索覆盖 |
| QA-04 | 映射解析测试 | P0 | 命中、未命中、冲突覆盖 |
| QA-05 | 审核流程测试 | P0 | 审核通过后映射可命中 |
| QA-06 | 幂等测试 | P0 | 同键同报文/不同报文覆盖 |
| QA-07 | 基础性能测试 | P1 | 查询与映射 P99 ≤ 500ms |

### 8.5 文档与交付任务

| 编号 | 任务 | 优先级 | 完成标准 |
|---|---|:---:|---|
| DOC-01 | README | P0 | 能说明启动、配置、测试 |
| DOC-02 | API 联调说明 | P0 | 包含请求示例和错误码 |
| DOC-03 | 导入模板 | P0 | 科室、耗材、SPD 样例模板 |
| DOC-04 | 验收报告模板 | P1 | 可记录验收用例和结果 |
| DOC-05 | 部署说明 | P0 | Docker Compose 可按说明启动 |

---

## 9. 测试与验收标准

### 9.1 单元测试

| 测试项 | 输入 | 预期 |
|---|---|---|
| 科室必填校验 | 缺少 `dept_code` | 返回 `VALIDATION_FAILED` |
| 耗材 27 位码长度 | 长度不是 27 | 返回失败明细 |
| 耗材规格拆分 | `22mm` | `spec_value=22`，`spec_unit=mm` |
| 映射命中 | 已有 ACTIVE 映射 | 返回 `MATCHED` |
| 映射未命中 | 无映射 | 创建 PENDING 审核任务 |
| 映射冲突 | 同来源编码多目标 | 返回 `MAPPING_CONFLICT` |
| 幂等重复提交 | 同键同报文 | 返回首次结果 |
| 幂等冲突 | 同键不同报文 | 返回 `IDEMPOTENCY_CONFLICT` |

### 9.2 集成测试

| 流程 | 步骤 | 验收点 |
|---|---|---|
| 科室导入检索 | 导入科室样例，按名称检索 | 返回标准科室 |
| 耗材导入检索 | 导入耗材样例，按 27 位码检索 | 返回标准耗材 |
| SPD 编码命中 | 预置 SPD 映射后调用 resolve | 返回标准 ID |
| SPD 编码未命中 | 调用未知 SPD 编码 | 创建待审核任务 |
| 审核后再解析 | 审核通过，再次 resolve | 返回 MATCHED |
| 日志查询 | 完成多次接口调用后查日志 | 可按系统/状态/时间过滤 |

### 9.3 验收测试

MVP 验收必须满足：

- 耗材字典可导入、检索、分发。
- 科室字典可导入、检索，并映射到至少 1 个外部系统。
- SPD 样例编码可通过映射桥解析为标准主数据 ID。
- 未匹配项可进入待审核任务。
- 审核通过后再次解析可命中映射。
- 重复提交不产生重复记录。
- 同一幂等键不同报文返回冲突。
- 交换日志可按来源系统、状态、时间查询。
- Swagger/OpenAPI 可用于联调。

### 9.4 性能目标

MVP 环境目标：

| 指标 | 目标 |
|---|---:|
| 科室检索 P99 | ≤ 500ms |
| 耗材检索 P99 | ≤ 500ms |
| 映射解析 P99 | ≤ 500ms |
| 单次导入 1,000 行耗材 | 可完成并返回明细 |
| 交换日志完整率 | ≥ 99% |

性能测试数据规模：

- 科室：不少于 100 条。
- 耗材：不少于 1,000 条。
- SPD 映射：不少于 200 条。

### 9.5 验收交付物

- 源代码仓库。
- Docker Compose 部署文件。
- 数据库迁移脚本。
- 科室导入模板。
- 耗材导入模板。
- SPD 样例映射模板。
- API 联调说明。
- 自动化测试报告。
- MVP 验收报告。

---

## 10. 部署、运行与交付物

### 10.1 Docker Compose 服务

MVP 至少包含：

| 服务 | 说明 |
|---|---|
| `hudmp-api` | FastAPI 应用 |
| `hudmp-postgres` | PostgreSQL 数据库 |
| `hudmp-redis` | Redis 缓存 |

### 10.2 环境变量

| 变量 | 说明 |
|---|---|
| `APP_ENV` | dev/test/prod |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `API_KEY` | MVP 服务级 API Key |
| `LOG_LEVEL` | 日志级别 |

### 10.3 启动验收

启动后必须完成：

1. `GET /health` 返回 `ok`。
2. Swagger 页面可打开。
3. 数据库迁移已执行。
4. 样例科室可导入。
5. 样例耗材可导入。
6. SPD 样例映射可解析。

---

## 11. 待院方确认事项

开发启动前建议院方确认以下事项：

| 编号 | 待确认事项 | 默认处理 |
|---|---|---|
| C-01 | 首个外部系统是否确定为 SPD | 默认 SPD |
| C-02 | SPD 是否提供 API、数据库视图或文件 | 默认文件/样例 API 二选一 |
| C-03 | 科室标准编码来源 | 默认院内现行科室表 |
| C-04 | 耗材 27 位码数据来源 | 默认院方提供官方导出或现有 SPD 字典 |
| C-05 | API Key 由谁生成和保管 | 默认信息部门 |
| C-06 | 映射审核人 | 默认数据治理员 |
| C-07 | 重复数据裁决规则 | 默认标准编码唯一，来源编码进入审核 |
| C-08 | MVP 部署环境 | 默认院内测试服务器 |
| C-09 | 是否需要简单管理页面 | 默认不做完整前端，用 Swagger + API |
| C-10 | 验收数据规模 | 默认科室 100 条、耗材 1,000 条、映射 200 条 |

---

## 12. 非 MVP 范围与后续预留

### 12.1 一期生产化增强

MVP 完成后，建议进入一期增强：

- 完整 RBAC 权限。
- 字典状态机和 Blueprint 发布。
- 管理端页面。
- Celery 异步清洗队列。
- Prometheus/Grafana 监控。
- 映射快照和回滚。
- 更多业务系统接入。

### 12.2 二期能力

- 药品字典。
- 诊疗项目字典。
- 医保代码订阅。
- 业财对账。
- 外报网关。

### 12.3 三期能力

- FHIR R4 API。
- DRG/DIP 支撑。
- 冷热分离。
- 长期审计归档。
- 等保整改闭环。

---

## 版本记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0 | 2026-05-04 | 基于 H-UDMP V4 方案抽取 MVP 开发任务书 |
