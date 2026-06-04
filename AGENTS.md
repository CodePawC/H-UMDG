# 代理说明（医院统一主数据治理平台）

本仓库协作时请以 **`docs/`** 为优先级最高的需求与设计来源，其次是 `docs/00-governance/` ~ `docs/07-operations/` 子目录。

## 关键文档索引

- **项目概述**：`docs/README.md`、`docs/PROJECT-OVERVIEW.md`
- **需求与范围**：`docs/SCOPE.md`、`docs/02-requirements/H-UDMP-RTM-v1.0.md`
- **架构设计**：`docs/03-architecture/H-UDMP-ARCHITECTURE-MVP-v1.0.md`
- **API 规格**：`docs/04-api/H-UDMP-API-SPEC-v1.0.md`、`docs/API.md`
- **数据模型**：`docs/05-data/H-UDMP-DATA-MODEL-v1.0.md`、`docs/DATA-MODEL.md`
- **测试与验收**：`docs/06-testing/`、`tests/README.md`、`docs/UAT-CHECKLIST.md`
- **部署运维**：`docs/07-operations/H-UDMP-DEPLOYMENT-RUNBOOK-v1.0.md`
- **外部对接**：`docs/master-data-api-integration.md`（H-MELC 等消费方集成指引）
- **统一身份方案（迭代目标）**：`docs/08-architecture/主数据驱动统一身份与权限管理方案.md`
- **工作区集成**：`D:/wlxph/README.md`、`D:/wlxph/docs/05-系统边界与集成关系说明.md`

## 项目状态

| 属性 | 值 |
|------|-----|
| 当前版本 | `v0.8.5+20260601.013`（详见 `VERSION.md`） |
| 阶段 | UAT 已完成，准备试生产 |
| 构建后端 | hatchling（`src/backend/pyproject.toml`） |
| 前端技术栈 | React 19 + Ant Design 6 + Vite 7 + TypeScript 5.8 |
| 数据库 | PostgreSQL 15+（Alembic 迁移在 `src/backend/migrations/`） |
| 缓存 | Redis（扩展预留，当前非必选） |

## 架构概览

### 后端分层（传统按层组织）

```
src/backend/app/
├── api/                  # HTTP 层
│   ├── router.py         # 统一路由注册
│   ├── routes/           # 按资源分组的路由模块
│   │   ├── auth.py       #   认证
│   │   ├── departments.py#   科室
│   │   ├── dictionaries.py#  标准字典
│   │   ├── equipment.py  #   设备分类/导入
│   │   ├── import_tasks.py#  导入任务
│   │   ├── master_data.py#   标准主数据对外接口
│   │   ├── materials.py  #   医保耗材
│   │   ├── organization.py#  组织机构
│   │   └── ...
│   └── schemas.py        # 共享 Pydantic schema
├── core/                 # 基础设施
│   ├── config.py         #   Pydantic Settings
│   └── security.py       #   API Key / 认证工具
├── db/
│   └── session.py        #   引擎与会话
├── models/               # ORM 模型（集中管理）
│   └── tables.py         #   所有表定义
├── services/             # 业务逻辑层
│   ├── import_pipeline.py#   数据导入流水线
│   ├── mapping_bridge.py #   编码映射
│   ├── organization_master.py# 组织主数据
│   └── ...
└── main.py               # FastAPI 入口
```

### 前端（单页应用）

```
src/frontend/
├── src/
│   ├── components/       # 工作台组件（按业务域）
│   ├── lib/              # API、认证、I18n、配置
│   ├── config/           # appMeta 等
│   ├── main.tsx          # 入口
│   └── styles.css
├── dist/                 # 构建产物（已生成）
├── package.json
└── vite.config.ts
```

### 数据模型

所有 ORM 模型集中在 `src/backend/app/models/tables.py`，使用 SQLAlchemy 2.0 `DeclarativeBase`。数据库 schema 范围：

| Schema | 内容 |
|--------|------|
| `public` | ApiClient、ApiCallLog、各类字典表 |
| 无独立 schema | DictDepartment、DictPerson、ManufacturerVendorMaster 等 |
| 迁移目录 | `src/backend/migrations/versions/` |

## 本地开发

### 后端

```powershell
cd src/backend
# 首次：复制 .env.example 为 .env 并按需修改
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# 启动
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8101
```

### 前端

```powershell
cd src/frontend
npm install
npm run dev     # 默认监听 http://127.0.0.1:5101
npm run build   # 执行 npm run lint && vite build
```

### 测试

```powershell
cd src/backend
python -m pytest ../../tests -q
```

## 数据导入与治理

H-UMDG 的核心能力围绕从外部来源（NHSA 国家医保局、NMPA 医疗器械注册数据库、院内 SPD 系统）导入规范数据并治理。

### 导入流程

1. **上传**：`/api/v1/import-tasks/upload` → Excel/CSV/7z 文件上传
2. **校验**：自动解析、校验格式和字段完整性
3. **暂存**：导入到 staging 表，人工审核
4. **发布**：确认后写入正式主数据表

### 核心服务

| 服务 | 职责 |
|------|------|
| `import_pipeline.py` | 导入流水线编排 |
| `import_tasks.py` | 导入任务持久化 |
| `mapping_bridge.py` | 院内 ↔ 标准编码映射 |
| `dictionary_catalog.py` | 标准字典目录管理 |
| `equipment_dictionary.py` | 设备分类字典管理 |
| `organization_master.py` | 组织机构主数据 |
| `manufacturer_vendors.py` | 往来单位主数据 |

## 标准主数据 API（对外服务面）

H-MELC 及其他消费方通过以下接口对接：

| 接口 | 说明 |
|------|------|
| `GET /health` | 存活探针 |
| `GET /health/ready` | 就绪探针（检查 DB + Alembic 版本） |
| `GET /api/v1/master-data/health` | 受 API Key 保护的主数据服务健康检查 |
| `GET /api/v1/master-data/departments` | 科室列表（支持分页、关键词、院区） |
| `GET /api/v1/master-data/persons` | 人员档案摘要 |
| `GET /api/v1/master-data/business-partners` | 往来单位（可按角色过滤） |
| `GET /api/v1/master-data/device-classification/tree` | 医疗器械分类树 |

认证方式：`X-API-Key` 或 `Authorization: Bearer <key>`

## 注意事项

- **H-UDMP 历史名称**：文档、模板、测试资产中可能保留 `H-UDMP` 前缀，用于追溯兼容。新文档使用 `H-UMDG`。
- **运行时文件存储**：`storage/runtime/*.json` 存储空间位置、注册证、UDI、品牌型号和标准设备库，非独立 PostgreSQL 表。
- **Redis**：当前为扩展预留，`/health/ready` 不检查 Redis。异步导入由 API 进程内 `BackgroundTasks` 执行。
- **Docker**：`deploy/docker/docker-compose.yml` 包含 `backend` + `postgres` + `redis`。容器不会自动执行 Alembic 迁移，需手动 `alembic upgrade head`。
- **主数据接口**：对外标准前缀为 `/api/v1/master-data/*`，历史 `/api/external/*` 仅作轻量查询兼容。
