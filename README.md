# H-UMDG 医院统一主数据治理平台

## 项目名称

- 正式中文名称：医院统一主数据治理平台
- 英文名称：Hospital Unified Master Data Governance Platform
- 项目简称：H-UMDG
- 当前迁移版本：v0.8.5+20260601.013
- 历史目录/旧项目名：H-UDMP

## 项目定位

H-UMDG 是面向全院的统一主数据治理底座，负责设备、科室、人员、往来单位及角色、耗材、医保编码等主数据的统一标准、统一编码、统一维护、统一审核和统一服务。

H-UMDG 独立运行，不强制绑定任何具体业务系统。它可服务 H-MELC 医院医学装备全生命周期闭环管理平台，也可服务 HRP、SPD、HIS、EMR、数据平台、运营管理平台等其他业务系统。

历史文档、样例文件和部分测试夹具仍可能保留 `H-UDMP` 文档编号或文件名，用于兼容既有测试资产和追溯历史，不再作为正式项目简称。

入口文档展示版本以 `VERSION.md`、前端 `src/frontend/package.json` 和 `CHANGELOG.md` 为准；`src/backend/pyproject.toml` 中的 Python 包版本仅作为包元数据。

## 功能概览

- 组织机构、科室、人员、往来单位及角色等主数据维护
- 医学装备主数据、耗材字典、医保编码、UDI 和注册证治理
- 主数据标准、编码规则、字典项、状态和版本管理
- 主数据新增、变更、停用、候选映射/合并、纠错审核和版本追溯
- 导入模板、批量导入、数据清洗、重复识别和质量校验
- 跨系统编码映射、外部系统交换日志和幂等处理
- 对外主数据查询、匹配、详情回查、增量变更和标准 API 服务
- UAT、性能基线、导入验证和治理证据归档

## 项目结构

```text
H-UMDG/
├─ src/backend/             # FastAPI 后端
├─ src/frontend/            # 管理端前端
├─ docs/                    # 需求、架构、接口、数据、测试、运维文档
├─ tests/                   # 单元、集成、端到端测试
├─ deploy/                  # Docker 部署资产
├─ data/                    # 模板与脱敏样例数据
├─ tools/                   # 导入、基线、UAT 辅助脚本
└─ storage/                 # 本地上传、日志、备份、数据库目录
```

## 运行环境

- Python：3.11 或更高版本
- Node.js：CI 使用 Node.js 22；本地建议使用与 CI 兼容的当前稳定版本
- npm：随 Node.js 安装
- 前端栈：React 19、Vite 7、TypeScript 5.8、Ant Design 6、lucide-react
- 数据库：**PostgreSQL 是硬性要求**。本地开发必须配置自己的 PG 实例
- Redis：可选预留组件，当前异步导入仍由 API 进程内 `BackgroundTasks` 执行
- Excel/Word 处理依赖：后端依赖中包含 `openpyxl`、`python-docx` 等

## 安装步骤

后端：

```powershell
cd src\backend
python -m pip install -e ".[dev]"
```

前端：

```powershell
cd src\frontend
npm install
```

首次运行前，请根据对应服务目录的 `.env.example` 创建本地配置。标准命令下，后端固定读取 `src/backend/.env`，前端读取 `src/frontend/.env` / `.env.local`。根目录 `.env.example` 是统一参考，不会被这些命令自动加载。真实配置不要提交到 Git。

## 环境变量说明

根目录 `.env.example` 提供统一参考；实际运行配置应放在后端或前端目录的本地 env 文件中。

| 变量 | 默认/示例 | 说明 |
| --- | --- | --- |
| `APP_NAME` | `H-UMDG` | 应用简称 |
| `APP_DISPLAY_NAME` | `医院统一主数据治理平台` | 中文显示名称 |
| `APP_ENV` | `development` | 运行环境 |
| `SERVER_PORT` | `8101` | 后端服务端口 |
| `FRONTEND_PORT` | `5101` | 前端开发端口 |
| `DATABASE_URL` | 未设置或 PostgreSQL URL | 数据库连接字符串；不设置时使用代码默认 `postgresql+psycopg://umdg:umdg@localhost:5432/umdg`，不要保留空值 |
| `UPLOAD_DIR` | `./storage/uploads` | 上传文件目录 |
| `LOG_DIR` | `./storage/logs` | 日志目录 |
| `BACKUP_DIR` | `./storage/backups` | 备份目录 |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis 地址；当前为缓存/队列扩展预留，`/health/ready` 不检查 Redis |
| `API_KEY` | `change-me` | 本地开发 API Key 示例，生产必须替换 |
| `OPERATOR_SESSION_TTL_MINUTES` | `480` | 管理端操作员会话有效期，单位分钟 |
| `OPERATOR_USERS` | 预置 3 个开发账号 | 本地开发/演示操作员清单，格式为 `用户名|密码|角色|显示名`，多账号以分号分隔 |
| `LOG_LEVEL` | `INFO` | 后端日志级别 |
| `CORS_ORIGINS` | `http://127.0.0.1:5101,http://localhost:5101` | 允许跨域的前端地址 |
| `API_VERSION_LABEL` | `mvp-v1` | `/health` 与 OpenAPI 显示的 API 版本标签；发布版本仍以 `VERSION.md` 等入口为准 |
| `UMDG_REPO_ROOT` | `./` 或 `../../` | 后端解析样例数据与导入源文件的仓库根路径；`src/backend/.env.example` 中相对后端目录写为 `../../` |
| `UMDG_NHSA_DIR` / `UMDG_DEVICE_CATALOG_DOCX` | 样例数据路径 | NHSA Excel 目录与医疗器械分类目录 DOCX 路径 |
| `UMDG_IMPORT_SPOOL_DIR` | `./runtime/import-spool` | 异步导入上传文件暂存目录；根 `.env.example` 为参考文件，路径按仓库根写作 `./src/backend/runtime/import-spool` |
| `UMDG_EQUIPMENT_SOURCE_DIR` | `./runtime/equipment-source-files` | 医疗器械分类目录等来源文件追溯存储目录；根 `.env.example` 为参考文件，路径按仓库根写作 `./src/backend/runtime/equipment-source-files` |
| `UMDG_IMPORT_MAX_UPLOAD_BYTES` | `1073741824` | 单文件上传上限，单位字节 |
| `UMDG_IMPORT_MAX_ARCHIVE_ENTRIES` / `UMDG_IMPORT_MAX_ARCHIVE_UNCOMPRESSED_BYTES` | `200` / `4294967296` | 压缩包最大条目数和解压后总字节上限 |
| `UMDG_IMPORT_CLEANUP_SPOOL_ON_FINISH` | `true` | 导入完成或失败后是否清理暂存文件 |
| `HUDMP_*` | 旧值 | 历史 `H-UDMP` 环境变量名兼容入口，新部署优先使用 `UMDG_*` |
| `VITE_UMDG_API_BASE_URL` | `http://127.0.0.1:8101` | 前端访问后端 API 地址 |
| `VITE_UMDG_ENVIRONMENT_NAME` | `local` | 前端环境标识 |
| `VITE_UMDG_CANDIDATE_VERSION` | `v0.8.5+20260601.013` | 前端展示版本 |
| `VITE_UMDG_APP_VERSION` | `v0.8.5+20260601.013` | 前端应用版本覆盖值 |

## 启动命令

后端：

```powershell
cd src\backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8101
```

前端：

```powershell
cd src\frontend
npm run dev
```

构建与测试：

```powershell
cd src\frontend
npm run build

cd ..\backend
python -m pytest ../../tests -q
```

前端 `npm run build` 实际执行 `npm run lint && vite build`；其中 `lint` 包含 `tsc --noEmit -p tsconfig.json` 与 `tsc --noEmit -p tsconfig.node.json`。

## 默认端口

- H-UMDG 管理端：`http://127.0.0.1:5101`
- H-UMDG 后端 API：`http://127.0.0.1:8101`
- H-UMDG 前端预览：`http://127.0.0.1:5103`

## 独立部署说明

H-UMDG 是独立主数据治理平台，可以单独部署、单独运行、单独维护数据库和发布流程。

独立部署时：

- 不需要部署 H-MELC。
- H-UMDG 自行维护统一主数据、编码、字典、映射、审核和发布。
- 其他业务系统可按需通过标准 API 接入。
- H-UMDG 不保存 H-MELC 的采购、维修、保养、计量、报废等业务过程状态。

## 集成部署说明

H-UMDG 对外提供主数据服务，可同时服务多个业务系统。H-MELC 接入时，应通过 H-MELC 的 Master Data Adapter / `masterDataService` 调用 H-UMDG 标准 API。

集成原则：

- H-UMDG 提供权威主数据、编码、版本和映射。
- H-MELC 等业务系统保存主数据引用和业务时点快照。
- 业务系统不得直接连接 H-UMDG 数据库读取内部表。
- H-UMDG 不参与业务系统的业务流程审批和状态流转。
- H-UMDG 可服务 H-MELC，也可服务 HRP、SPD、HIS、EMR、数据平台等其他系统。

本地联调端口约定：

- H-UMDG 前端：`5101`
- H-UMDG 后端：`8101`
- H-MELC 前端：`5102`
- H-MELC 后端：`8102`

## 常见问题

**H-UMDG 是否必须和 H-MELC 一起部署？**

不需要。H-UMDG 是全院统一主数据治理底座，可独立部署，也可服务多个业务系统。

**H-UMDG 会不会管理 H-MELC 的业务单据？**

不会。H-UMDG 管主数据和标准数据，H-MELC 管医学装备业务过程。

**业务系统可以直接读取 H-UMDG 数据库吗？**

不建议，也不允许作为正式集成方式。业务系统应通过标准 API 查询、匹配、详情回查、增量变更接口或同步主数据；订阅回调属于后续扩展能力。

**`.env`、`.env.local` 能提交吗？**

不能。真实数据库密码、API Key、对象存储密钥等只放在本地配置或部署平台密钥中。

**测试失败提示数据库字段不存在怎么办？**

通常表示本地 PostgreSQL schema 未升级到当前版本。请先备份数据库，再执行 Alembic 迁移。

## 版本记录

- 当前版本：`v0.8.5+20260601.013`
- 版本文件：`VERSION.md`
- 变更记录：`CHANGELOG.md`
- 初始 Git tag：`v0.8.5+20260601.013`

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。Copyright (c) 2026 CodePawC。
