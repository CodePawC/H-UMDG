# H-UMDG 医院统一主数据治理平台

正式中文名称：医院统一主数据治理平台
英文名称：Hospital Unified Master Data Governance Platform
项目简称：H-UMDG
当前迁移版本：v0.8.5+20260525.003
历史目录/旧项目名：H-UDMP
项目定位：面向全院的统一主数据治理底座，负责设备、科室、人员、供应商、耗材、医保编码等主数据的统一标准、统一编码、统一维护、统一审核和统一服务。

## 项目边界

H-UMDG 独立运行，不强制绑定任何具体业务系统。它提供统一主数据治理、编码、映射、审核、发布和外部查询能力；具体业务闭环由 H-MELC 等业务系统负责。

历史文档、样例文件和部分测试夹具仍可能保留 `H-UDMP` 文档编号或文件名，用于兼容既有测试资产和追溯历史，不再作为正式项目简称。

## 项目结构

```text
H-UMDG/
├─ src/backend/             # FastAPI 后端
├─ src/frontend/            # 管理端前端
├─ docs/                    # 需求、架构、接口、数据、测试、运维文档
├─ tests/                   # 单元、集成、端到端测试
├─ deploy/                  # Docker 与部署脚本
├─ data/                    # 模板与脱敏样例数据
├─ tools/                   # 导入、基线、UAT 辅助脚本
└─ storage/                 # 本地上传、日志、备份目录（仅保留 .gitkeep）
```

## 本地开发

后端：

```powershell
cd src/backend
pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8101
```

前端：

```powershell
cd src/frontend
npm install
npm run dev
```

默认端口：

- H-UMDG 管理端：`http://127.0.0.1:5101`
- H-UMDG 后端 API：`http://127.0.0.1:8101`

## 外部服务

H-UMDG 对外提供主数据查询、映射、审核发布和变更服务。H-MELC 等业务系统应通过标准 API 接入，不应读取 H-UMDG 数据库表或依赖其内部实现。

## 测试与构建

```powershell
cd src/backend
pytest ../../tests -q

cd ..\frontend
npm run build
```

## 配置与开源准备

- 本地私有配置使用 `.env.local`，不要提交 `.env` 或 `.env.local`。
- 仓库提交 `.env.example`，上传、日志、备份默认使用 `./storage/...` 相对目录。
- 开源前检查 API Key、数据库密码、真实患者/医院敏感数据、上传文件、运行日志、License、README 和安装文档。
