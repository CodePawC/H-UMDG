# H-UDMP Tests

测试目录按层级组织：

| Folder | Purpose |
|---|---|
| `unit` | 单元测试 |
| `integration` | 集成测试 |
| `e2e` | 端到端测试 |

MVP 必须覆盖科室导入、耗材导入、映射解析、审核流程、幂等写入和交换日志查询。

## Running Tests

单元测试和 OpenAPI 契约测试不依赖数据库。MVP 主链路集成测试会在 PostgreSQL 可连接时执行；如果未启动测试数据库，会自动跳过数据库链路用例。

```powershell
cd src/backend
.\.venv\Scripts\python.exe -m pytest ../../tests -q
```

运行完整 MVP 链路测试前：

```powershell
docker compose -f deploy/docker/docker-compose.yml up -d --build
docker compose -f deploy/docker/docker-compose.yml exec -T backend alembic upgrade head
cd src/backend
.\.venv\Scripts\python.exe -m pytest ../../tests/integration/test_mvp_e2e_flow.py -q
```

`test_mvp_e2e_flow.py` 覆盖：

- 科室模板导入与别名检索。
- 耗材模板导入与 27 位码检索。
- SPD 样例映射导入。
- SPD 科室/耗材编码解析命中。
- 写入接口同事务重复提交返回首次结果。
- 写入接口同事务不同文件返回 `IDEMPOTENCY_CONFLICT`。

`test_nhsa_sample_workbooks_import` 覆盖：

- C09 全量规格型号样例 `NHSA_FULL_SPEC` 导入。
- 停用表样例 `NHSA_DISABLED` 导入。
- 转码表样例 `NHSA_TRANSCODE` 导入。
- `Query1` 工作表识别。
- 21 字段、2 字段、4 字段结构进入对应暂存表。
- C09 样例清洗进入 `dict_material_specs`。
- 转码样例可通过 `GET /api/v1/materials/transcode/resolve` 按 `原27位码` 查询到新 `27位码`。
- 不存在的 `原27位码` 返回 `NOT_FOUND`。
- 导入报告返回 `source_row_count`、`unique_key_count`、`skipped_duplicate_count`。
- 停用码命中主数据时将耗材状态置为 `INACTIVE`。

`test_import_exception_scenarios` 覆盖：

- 科室模板缺少 `dept_code` 时返回行级失败明细。
- 耗材导入非法 `source_type` 返回 `INVALID_SOURCE_TYPE`。
- 指定不存在的 Excel 工作表返回 `IMPORT_FILE_INVALID`。
- MVP 耗材模板同文件重复 `yb_code_27` 时只处理唯一业务键并返回重复统计。
- 非 27 位医保码返回行级失败明细。
