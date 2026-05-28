# H-UDMP MVP Deployment Runbook

> Version: v1.0  
> Status: Review  
> Date: 2026-05-05  
> Owner: H-UDMP Project Team  
> Source: `docs/02-requirements/H-UDMP-MVP-TASKBOOK-v1.0.md`

## 1. Purpose

本文档定义 H-UDMP MVP 的本地和测试环境部署运行流程，并与仓库内 [`deploy/docker/docker-compose.yml`](../../deploy/docker/docker-compose.yml)、[`src/backend`](../../src/backend) 工程保持一致。

## 2. Target Environments

| Environment | Purpose | Notes |
|---|---|---|
| Local Dev | 开发人员本地调试 | Docker Compose 或本地 Python 环境 |
| Test | 集成测试和 UAT | 院内测试服务器或隔离虚拟机 |
| Production | MVP 后续生产化 | MVP 文档阶段不覆盖生产发布 |

## 3. Runtime Components

MVP 当前运行至少包含：

| Component | Purpose |
|---|---|
| `hudmp-api` | FastAPI 应用 |
| `hudmp-postgres` | PostgreSQL 数据库 |
| `hudmp-redis` | 预留缓存/队列组件；当前异步导入任务尚未接入 Redis worker |

## 4. Required Environment Variables

| Variable | Required | Example | Description |
|---|:---:|---|---|
| `APP_ENV` | Yes | `test` | `dev`、`test`、`prod` |
| `DATABASE_URL` | Yes | `postgresql://hudmp:hudmp@postgres:5432/hudmp` | 数据库连接串（同步驱动，`psycopg`） |
| `REDIS_URL` | No | `redis://redis:6379/0` | Redis 连接串；当前 MVP 配置预留，异步导入仍由 API 进程内 `BackgroundTasks` 执行 |
| `API_KEY` | Yes | `change-me` | MVP 服务级 API Key |
| `LOG_LEVEL` | No | `INFO` | 日志级别 |
| `HUDMP_NHSA_DIR` | No | `data/samples/external/nhsa` | NHSA 发布 Excel 所在目录，覆盖默认值时使用绝对路径 |
| `HUDMP_DEVICE_CATALOG_DOCX` | No | `data/samples/external/nmpa/医疗器械分类目录.docx` | 医疗器械分类目录 DOCX 路径 |
| `HUDMP_IMPORT_SPOOL_DIR` | No | `./runtime/import-spool` | 异步导入上传文件的服务端暂存目录 |
| `HUDMP_IMPORT_MAX_UPLOAD_BYTES` | No | `1073741824` | 导入上传文件大小上限，超限返回 `UPLOAD_TOO_LARGE` |
| `HUDMP_IMPORT_MAX_ARCHIVE_ENTRIES` | No | `200` | 单个压缩包可预检/拆分的最大文件数 |
| `HUDMP_IMPORT_MAX_ARCHIVE_UNCOMPRESSED_BYTES` | No | `4294967296` | 单个压缩包允许的最大解压后总字节数 |

压缩包导入支持 ZIP、7z、tar、tar.gz/tgz、tar.bz2/tbz2、tar.xz/txz。RAR 需要外部 unrar 运行时，当前不会自动解压，会在预检时返回明确的不支持原因。
| `HUDMP_IMPORT_CLEANUP_SPOOL_ON_FINISH` | No | `true` | 后台导入完成或失败后是否删除本次 spool 文件 |

异步导入暂存目录要求：

- 本地默认在 `src/backend/runtime/import-spool`。
- Docker 默认在 `/tmp/hudmp-import-spool`。
- 目录必须可由 backend 进程写入。
- 不得指向 `data/samples`，样例数据目录可能只读挂载且应保持不可变。
- 后台导入完成或失败后默认清理对应上传文件；私有排障时可临时关闭清理。
- `sys_import_batch.source_file_path` 会保留服务端路径用于追溯，但默认不代表文件仍存在。

异步导入执行边界：

- 当前 MVP 使用 FastAPI `BackgroundTasks` 在 API 进程内执行导入。
- 已提交批次会记录到 PostgreSQL，上传文件写入服务端 spool 目录。
- API 进程或 worker 重启可能中断正在运行的任务；当前未提供独立队列、重试或死信处理。
- 多 API 副本部署前应先引入 Redis/Celery、RQ 或等价队列，并定义 spool TTL、容量上限和清理策略。

## 5. Deployment Procedure

### 5.1 Prepare Environment

1. 准备测试服务器或本地 Docker 环境。
2. 确认 PostgreSQL 和 Redis 端口未冲突。
3. 创建 `.env` 文件并填写环境变量。
4. 确认样例数据文件存在：
   - `data/templates/H-UDMP-TEMPLATE-DEPARTMENTS-v1.0.csv`
   - `data/templates/H-UDMP-TEMPLATE-MATERIALS-v1.0.csv`
   - `data/samples/H-UDMP-SAMPLE-SPD-MAPPINGS-v1.0.csv`
5. 如执行真实医保耗材导入，将源文件放到可移植路径并设置环境变量（详见 [`data/samples/README.md`](../../data/samples/README.md)）。默认相对仓库根目录：
   - `${HUDMP_NHSA_DIR}/16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx`
   - `${HUDMP_NHSA_DIR}/30、停用表.xlsx`
   - `${HUDMP_NHSA_DIR}/31、转码表.xlsx`
   - `${HUDMP_DEVICE_CATALOG_DOCX}`（默认 `data/samples/external/nmpa/医疗器械分类目录.docx`）

### 5.2 Start Services

当工程文件创建后，预期启动方式为：

```powershell
docker compose -f deploy/docker/docker-compose.yml up -d
```

Compose 文件位于 `deploy/docker/`；首次构建可能需要数分钟以下载镜像与依赖。

### 5.3 Run Database Migrations

预期迁移方式：

```powershell
cd src/backend
alembic upgrade head
```

迁移必须创建以下 MVP 表：

- `dict_departments`
- `dict_material_specs`
- `sys_mapping_bridge`
- `sys_mapping_review_task`
- `sys_exchange_log`
- `sys_api_registry`
- `stg_nhsa_material_specs`
- `stg_nhsa_material_disabled`
- `stg_nhsa_material_transcode`
- `ref_device_classification_catalog`

### 5.4 Health Check

启动后执行：

```powershell
Invoke-RestMethod -Uri "http://localhost:8101/health"
```

Expected:

```json
{
  "status": "ok",
  "service": "h-udmp-backend",
  "version": "mvp-v1"
}
```

### 5.5 Load Sample Data

使用 Swagger 或 API 客户端导入：

1. `POST /api/v1/departments/import`
2. `POST /api/v1/materials/import`
3. 使用 SPD 样例调用 `POST /api/v1/mapping/resolve`

导入成功后应保存导入报告作为验收证据。

### 5.6 Load Real NHSA Source Files

真实医保耗材源文件建议导入顺序：

1. `source_type=NHSA_FULL_SPEC`：导入 C09 全量规格型号信息。
2. `source_type=NHSA_DISABLED`：导入停用表。
3. `source_type=NHSA_TRANSCODE`：导入转码表。
4. 导入或抽取医疗器械分类目录到 `ref_device_classification_catalog`。

导入前检查：

| Check | Expected |
|---|---|
| 文件路径 | 文件存在且可读 |
| 文件大小 | 与基线记录无异常差异 |
| Excel 工作表 | 默认 `Query1` 或使用首个工作表 |
| C09 表头 | 21 个字段 |
| 停用表表头 | 2 个字段 |
| 转码表表头 | 4 个字段 |
| 批次号 | 每次导入唯一 |
| 代码字段类型 | 字符串，不按数字解析 |

## 6. Operational Checks

| Check | Command or API | Expected |
|---|---|---|
| API health | `GET /health` | `status=ok` |
| Department search | `GET /api/v1/departments/search?q=心外科` | 返回科室 |
| Material search | `GET /api/v1/materials/search?yb_code_27=...` | 返回耗材 |
| Mapping resolve | `POST /api/v1/mapping/resolve` | `MATCHED` 或 `PENDING_REVIEW` |
| Exchange logs | `GET /api/v1/exchange/logs` | 返回日志 |
| NHSA full spec import | `POST /api/v1/materials/import` with `source_type=NHSA_FULL_SPEC` | 返回 21 字段导入报告 |
| NHSA disabled import | `POST /api/v1/materials/import` with `source_type=NHSA_DISABLED` | 返回停用码导入报告 |
| NHSA transcode import | `POST /api/v1/materials/import` with `source_type=NHSA_TRANSCODE` | 返回转码导入报告 |
| Async import task | `POST /api/v1/import-tasks/materials` | 返回 `PENDING` 批次 |
| Import task progress | `GET /api/v1/import-tasks/{batch_id}` | 返回任务状态和统计 |
| Import failures | `GET /api/v1/import-tasks/{batch_id}/failures` | 返回行级或文件级失败 |

## 7. Log and Troubleshooting

| Symptom | Likely Cause | Action |
|---|---|---|
| `/health` database failed | 数据库连接串错误或数据库未启动 | 检查 `DATABASE_URL` 和数据库服务 |
| `/health` redis failed | Redis 地址错误或 Redis 未启动 | 检查 `REDIS_URL` 和 Redis 服务 |
| API returns `UNAUTHORIZED` | API Key 缺失或错误 | 检查 `X-API-Key` 和 `API_KEY` |
| Import returns validation failures | 模板字段缺失或格式错误 | 对照导入模板修正 |
| NHSA import column mismatch | 源文件版本变化或表头不一致 | 对照 `H-UDMP-IMPORT-SOURCE-MAPPING-v1.0.md` 更新映射 |
| Mapping remains pending | 未审核或目标主数据不存在 | 查询审核任务并处理 |
| Idempotency conflict | 同一事务号提交了不同报文 | 更换 `source_tx_id` 或核查调用方重试逻辑 |

## 8. Backup and Recovery Baseline

MVP 测试环境最低要求：

- 每次 UAT 前导出数据库快照。
- 导入大批量样例前创建备份点。
- 记录迁移版本和样例数据批次。

生产化阶段再补充完整 RTO、RPO、WAL 归档、恢复演练和异地备份。

## 9. Release Readiness Checklist

- Environment variables are configured.
- Database migrations pass.
- `GET /health` passes.
- Swagger/OpenAPI is accessible.
- Department and material samples import successfully.
- NHSA source import pre-check passes when real source import is in scope.
- SPD mapping sample can resolve.
- Exchange logs are queryable.
- Test report and UAT evidence are attached.
