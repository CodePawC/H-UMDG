# H-UMDG Backend

后端代码目录。MVP 默认技术栈：

- FastAPI
- SQLAlchemy 2.0
- Alembic
- PostgreSQL
- Redis
- pytest

当前已实现 MVP 后端骨架与首批业务能力：

- `GET /health`
- 科室导入与检索
- 耗材模板、NHSA 全量规格、停用、转码和医疗器械分类目录导入
- 映射桥解析、待审核任务、审核通过/拒绝
- 基础交换日志与写入接口幂等检查
- SPD 样例映射 CSV 导入脚本

## Local Development

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest ../../tests -q
```

启动 API：

```powershell
.\.venv\Scripts\humdg-api.exe
```

本地开发 API 固定监听 `http://127.0.0.1:8101`，避免与 H-MELC 等项目端口冲突。

导入 SPD 样例映射前，应先导入科室模板和耗材模板，使 `target_code` 能找到标准主数据：

```powershell
cd ..\..
$env:DATABASE_URL = "postgresql+psycopg://umdg:umdg@localhost:5432/umdg"
src\backend\.venv\Scripts\python.exe tools\import_spd_sample.py
```

目录结构：

```text
src/backend/
├── app/
│   ├── api/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── main.py
├── migrations/
└── pyproject.toml
```
