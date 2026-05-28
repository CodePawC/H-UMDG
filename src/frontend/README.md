# H-UMDG Frontend

前端代码目录。MVP UAT 默认不强制开发完整管理端，优先通过 Swagger/OpenAPI 和脚本完成联调。

Post-MVP Admin UI Alpha 范围见：

```text
docs/03-architecture/H-UDMP-ADMIN-UI-SCOPE-v1.0.md
```

一期增强可在此目录建设：

- 健康状态和目标环境提示
- 科室、耗材检索与导入页面
- 异步导入任务列表、详情和失败行查看
- 映射审核页面
- 交换日志查询页面
- UAT 证据复制辅助
- 脱敏 UAT 证据包汇总和整包复制

## Admin UI Alpha Shell

当前目录已包含 #13 的前端壳：

- Vite + React + TypeScript
- 未登录时只显示登录卡片；导航、仪表盘、接口地图、环境配置和工作台内容在后端校验通过前不会渲染
- 每次新打开页面都会先进入登录页，不使用浏览器里残留的旧操作员会话直接放行
- 本地环境配置，以及用户名/工号 + 密码登录
- 中英界面切换
- 后端 `auth/login` 校验账号密码并返回会话令牌、角色、权限和会话过期时间
- 平台管理员登录后，权限页显示后端 `auth/permissions` 权威矩阵和 `auth/operators` 预置操作员清单
- 非 `permissions.manage` 角色不能打开权限管理页，登录后也不会请求管理员权限接口
- 导航可访问判断优先使用登录返回的后端权限，未登录时不渲染任何工作台内容
- 默认进入中文仪表盘概览，直接说明页面用途、推荐起步路径、当前 Alpha 范围和各模块作用
- 仪表盘会按当前角色展示操作员摘要、会话过期时间和建议下一步入口
- `/health` 健康检查横幅
- H-UMDG 响应信封解析
- 证据导出工作台会汇总各页面保存的脱敏 evidence，并支持复制整包
- 初始导航、端点映射和后续实施切片提示

## Dictionary Workbench

#14 已补齐首批可操作字典工作台：

- 科室字典查询和同步导入
- 耗材字典查询和同步导入
- NHSA 27 位码转码查询
- 导入计数、校验失败行展示和脱敏 evidence 复制

页面侧重 API 契约联调，不会复制 API Key 或原始上传文件内容到 evidence payload。导入样例可从仓库模板和样例目录选择：

```text
data/templates/H-UDMP-TEMPLATE-DEPARTMENTS-v1.0.csv
data/templates/H-UDMP-TEMPLATE-MATERIALS-v1.0.csv
data/samples/external/nhsa/
```

## Async Import Task Monitor

#15 已补齐异步导入任务工作台：

- 提交耗材异步导入任务
- 按状态和来源类型筛选任务列表
- 查看批次详情、进度、计数和终态
- 查看失败行摘要
- 失败行默认显示 raw payload redacted 状态，证据复制不包含 `raw_payload`
- 显式查看 raw payload 需要后端 `raw_payload.view` 权限，默认仅平台管理员具备
- 复制脱敏 evidence JSON

Evidence payload 只包含批次号、状态、计数、时间戳、错误摘要和失败行摘要，不包含 API Key、原始上传文件内容或失败行 `raw_payload`。当前 MVP 执行模型为 FastAPI `BackgroundTasks` 加服务端 spool 目录，独立队列/Redis worker 属于后续生产化演进范围。

## Exchange Log Workbench

#17 已补齐交换日志证据工作台：

- 按来源系统、状态、起止时间筛选交换日志
- 查看 trace id、来源事务、数据类别、状态、耗时和错误码
- 打开单条日志详情，查看脱敏策略、请求摘要和响应摘要
- 复制脱敏 UAT evidence JSON，不包含请求或响应 payload 原文

本地运行：

```powershell
npm install
npm run dev
```

本地开发前端固定监听 `http://127.0.0.1:5101`，预览服务固定监听 `http://127.0.0.1:5103`。端口被占用时 Vite 会直接报错，避免自动切到临时端口造成前后端联调地址漂移。

构建检查：

```powershell
npm run build
```

不要把真实密码写入 `.env` 或提交到 Git。共享 UAT 环境的账号、角色和初始密码应由管理员在后端配置，并通过安全渠道分发。
