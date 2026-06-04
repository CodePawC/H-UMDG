# H-UMDG 前端架构设计

> **版本**：v1.0
> **日期**：2026-06-04
> **适用范围**：H-UMDG 管理端前端（`src/frontend`）
> **参考**：`docs/10-代码风格与命名约定.md`、`docs/03-architecture/H-UDMP-ADMIN-UI-SCOPE-v1.0.md`

---

## 1. 技术栈

| 层 | 选型 | 版本 | 说明 |
|---|------|------|------|
| 框架 | React | 19 | 当前最新稳定版 |
| 构建工具 | Vite | 7 | 快速 HMR，原生 ESM |
| 语言 | TypeScript | 5.8 | 严格模式 |
| UI 组件库 | Ant Design | 6 | 企业级组件库，最新架构 |
| 图标 | lucide-react | 0.468 | 轻量，按需加载 |
| 路由 | 内置路由（URL hash → activeId） | — | 无 react-router，适合单页应用 |
| HTTP 客户端 | fetch | 原生 | 通过 HudmpApiClient 封装 |
| 状态管理 | React hooks + localStorage | — | 无 Redux/Zustand |
| CSS | 全局 CSS + Ant Design 主题令牌 | — | `styles.css` + Ant Design ConfigProvider |

### 与 H-MELC 技术栈对比

| 维度 | H-UMDG | H-MELC |
|------|--------|--------|
| UI 组件库 | Ant Design 6 | Ant Design 5 + Pro Components |
| 构建 | Vite 7 | Vite 8 |
| 状态管理 | React hooks | Zustand |
| 图表 | — | ECharts + three.js |
| 动画 | — | framer-motion |
| 路由 | 内置 SPA 路由 | react-router-dom 7 |
| HTTP | 自定义 fetch 封装 | axios |

> **原则**：两个项目独立部署、独立技术选型，不强制统一 UI 库版本。H-UMDG 轻量化，H-MELC 功能丰富。统一身份方案完成后，H-UMDG 将作为 SSO 门户承载更多导航功能。

---

## 2. 目录结构与模块边界

```
src/frontend/
├── index.html                 # HTML 入口
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
├── package.json               # 依赖
│
├── public/                    # 静态资源（下载模板、样例数据）
│   └── downloads/
│       ├── samples/           # 用户可下载的样例文件
│       └── templates/         # 导入模板
│
└── src/
    ├── main.tsx               # React 入口 + SPA 路由 + 全局状态
    │                          # 职责：App shell、登录态、导航、布局
    │                          # ~3600 行，包含全部路由逻辑
    ├── styles.css             # 全局样式 + CSS 变量
    ├── types.ts               # 全局 TypeScript 类型定义
    ├── vite-env.d.ts          # Vite 类型声明
    │
    ├── config/                # 环境配置
    │   ├── appMeta.ts         #   应用元数据（版本、名称、模式）
    │   └── —                  #   无独立配置文件，配置在 localStorage
    │
    ├── lib/                   # 工具库（无 React 依赖）
    │   ├── api.ts             #   HudmpApiClient（HTTP 请求封装）
    │   ├── auth.ts            #   Session 持久化（localStorage）
    │   ├── config.ts          #   AdminConfig 管理
    │   ├── appIdentity.ts     #   应用标识计算
    │   ├── i18n.ts            #   国际化（中英文）
    │   ├── evidence.ts        #   证据包工具
    │   └── importGuides.ts    #   导入指引数据
    │
    └── components/            # 业务组件（工作台）
        ├── *Workbench.tsx     #   每个业务域一个工作台组件
        ├── MasterDataPageLayout.tsx  # 通用页面骨架
        ├── GlobalFooterBar.tsx       # 全局底栏
        ├── ImportGuidePanel.tsx      # 导入指引面板
        └── EvidenceWorkbench.tsx     # 证据包导出
```

### 模块边界规则

| 目录 | 可以 | 不可以 |
|------|------|--------|
| `config/` | 读取环境变量、导出常量 | 导入组件、访问 localStorage |
| `lib/` | 导入 `types.ts`、纯函数 | 导入 React、操作 DOM |
| `components/` | 导入 `lib/`、`types.ts`、Ant Design | 直接修改全局状态 |
| `main.tsx` | 组合组件、管理全局状态 | 业务逻辑 |
| `types.ts` | 纯类型定义 | 运行时值 |

---

## 3. 视觉风格与设计系统

### 3.1 主题色彩

Ant Design 6 ConfigProvider 全局主题 + CSS 变量：

```css
:root {
  /* 基础色板 */
  --color-primary: #1677ff;        /* Ant Design 主色 */
  --color-bg: #f0f2f5;            /* 页面背景 */
  --color-surface: #ffffff;        /* 卡片/面板背景 */
  --color-text: #1f2937;          /* 正文 */
  --color-text-secondary: #6b7280; /* 辅助文字 */
  --color-border: #e5e7eb;        /* 边框 */
  --color-success: #22c55e;       /* 成功 */
  --color-warning: #f59e0b;       /* 警告 */
  --color-error: #ef4444;         /* 错误 */
  
  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

### 3.2 字体

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, 
             BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### 3.3 布局层级

```
┌─────────────────────────────────────────┐
│ 顶部操作栏（搜索/用户菜单/健康检查）        │
├─────────────────────────────────────────┤
│                                         │
│  工作台内容区                              │
│  ┌───────────────────────────────────┐  │
│  │ 面包屑 / 标题                       │  │
│  ├───────────────────────────────────┤  │
│  │ 业务操作区                          │  │
│  │ (Ant Design 表格/表单/抽屉/弹窗)    │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│ 全局底栏（系统名称/版本/环境/API 状态）     │
└─────────────────────────────────────────┘
```

### 3.4 组件使用规范

| 场景 | 推荐组件 | 说明 |
|------|---------|------|
| 数据表格 | `<Table>` | Ant Design 6 Table，分页 |
| 数据录入 | `<Form>` + `<Input>` `<Select>` | 标准表单 |
| 详情查看 | `<Descriptions>` | 键值对展示 |
| 弹窗/抽屉 | `<Drawer>` / `<Modal>` | Ant Design |
| 状态标签 | `<Tag>` | 枚举状态展示 |
| 消息提示 | `<message>` / `<App.useApp>` | 操作反馈 |
| 空状态 | `<Empty>` | 无数据占位 |
| 卡片容器 | `<Card>` | 区块容器 |
| 树形数据 | `<Tree>` / `<TreeSelect>` | 分类树/下拉树 |
| 图标 | lucide-react + `@ant-design/icons` | 装饰图标 + 功能图标 |

**图标选择原则**：
- 功能型图标（菜单、按钮）→ `@ant-design/icons`
- 装饰/通用图标 → `lucide-react`（更轻量、更现代的设计）

---

## 4. 样式系统

### 4.1 方案：全局 CSS + Ant Design 令牌

H-UMDG 使用**最简样式方案**，不引入 CSS Modules、styled-components 或 Tailwind：

| 样式需求 | 方案 | 示例 |
|---------|------|------|
| 全局样式 | `styles.css` CSS 变量 | `background: var(--color-bg)` |
| 组件级样式 | inline styles（React style prop） | `<div style={{ gap: 8 }}>` |
| Ant Design 定制 | ConfigProvider theme token | `<ConfigProvider theme={...}>` |
| 响应式 | Ant Design responsive props | `<Col xs={24} xl={14}>` |

### 4.2 何时使用 inline styles vs CSS class

| 情况 | 方式 | 示例 |
|------|------|------|
| 动态值 | inline style | `style={{ flex: "1 1 " + width }}` |
| 布局（flex/grid/gap） | inline style | `style={{ display: "flex", gap: 12 }}` |
| 主题色 | inline style + var | `style={{ color: "var(--color-primary)" }}` |
| 复杂静态样式 | CSS class | `className="dashboard-pro"` |

### 4.3 与 H-MELC 样式系统对比

| 维度 | H-UMDG | H-MELC |
|------|--------|--------|
| 方案 | 全局 CSS | CSS + Ant Design Pro 样式 |
| CSS-in-JS | 无 | 无 |
| CSS Modules | 无 | 无 |
| 主题定制 | CSS 变量 | enterpriseTheme.ts |

---

## 5. 目录与文件命名规范

```
src/
├── components/
│   ├── 每个业务域一个文件: {业务域}Workbench.tsx
│   └── 通用组件: {组件名}.tsx
├── lib/
│   ├── 纯工具函数: {功能}.ts
│   └── 首字母小写 camelCase
├── config/
│   └── 配置项: {模块}Config.ts
└── pages/ (未来拆分方向)
    └── {页面名}/index.tsx
```

**文件命名**：
- 组件文件：`PascalCase.tsx`（`AuthWorkbench.tsx`）
- 工具文件：`camelCase.ts`（`auth.ts`）
- 类型文件：`types.ts`（单一类型文件）
- 样式文件：`camelCase.css`（`styles.css`）

---

## 6. 数据流

```
用户操作
    ↓
HudmpApiClient.request()     ← lib/api.ts
    ↓
fetch(baseUrl + path, { headers, body })
    ↓
后端 API
    ↓
JSON Response → HudmpEnvelope
    ↓
isEnvelope() → 解析 → 返回 ApiResult<T>
    ↓
组件渲染
    ↓
401/SESSION_EXPIRED → dispatchEvent('hudmp:session-reset') → 跳登录页
```

### 认证令牌传递

```
优先级:
1. Authorization: Bearer <JWT>          (H-MELC 兼容)
2. X-Session-Token <session_token>       (H-UMDG 传统)
3. X-API-Key <api_key> + X-Operator-*   (服务间调用)
```

### 统一身份模式（v0.9+）

```
H-UMDG 登录 → 返回 JWT (systems.H-MELC.roles)
    ↓
前端保存 accessToken + sessionToken
    ↓
用户点击 H-MELC 入口 → postMessage 传 JWT
    ↓
H-MELC 前端接收 → setAccessToken → 自动登录
```

---

## 7. 组件拆分的复用规则

| 组件粒度 | 适用场景 | 示例 | 复用范围 |
|---------|---------|------|---------|
| 原子 | 单一 UI 元素 | Button、Tag、Icon | Ant Design 原生 |
| 分子 | 组合多个原子 | SearchForm、FilterBar | H-UMDG 内部 |
| 工作台 | 完整业务页面 | AuthWorkbench、DictWorkbench | 独立业务域 |
| 布局 | 页面结构 | MasterDataPageLayout、GlobalFooterBar | 全局 |

### 复用优先级

1. **Ant Design 内置组件** → 优先使用
2. **H-UMDG 内部提取** → 同一组件在 3+ 个地方出现时提取
3. **不跨项目复用** → H-UMDG 和 H-MELC 独立部署，不共享组件代码

---

## 8. 国际化

当前支持中英文，通过 `lib/i18n.ts` 管理：

```typescript
type Language = "en" | "zh";
const translations: Record<string, Record<Language, string>> = {
  "appName": { zh: "医院统一主数据治理平台", en: "H-UMDG" },
  // ...
};
```

新增翻译键的规则：
- key 使用 camelCase
- 按功能域分组（`auth.**`、`department.**`、`material.**`）
- 不需要 100% 覆盖，先覆盖导航、表单标签和操作反馈

---

## 9. 性能与构建

### 当前瓶颈

| 问题 | 说明 |
|------|------|
| 单文件过大 | `main.tsx` ~3600 行，包含全部路由和全局状态 |
| 无代码分割 | 所有组件一次加载，无 lazy loading |
| 无缓存策略 | Vite 构建已自动 hash，但无 Service Worker |

### 优化方向（后续迭代）

1. `main.tsx` 拆分 → 路由配置 + 全局状态 + 应用 shell 分离
2. `React.lazy()` 按工作台分割代码
3. 大型工作台（DictionaryWorkbench ~2800 行）进一步拆分子组件

### 构建命令

```powershell
npm run build    # tsc --noEmit + vite build
npm run dev      # vite dev server → http://127.0.0.1:5101
```

---

## 10. 实施计划

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| 当前状态 | 单体 main.tsx + 工作台组件，功能完整 | — |
| 近期优化 | main.tsx 拆分路由配置 + 全局 hooks | 中 |
| 近期优化 | Ant Design 6 主题统一 ConfigProvider | 中 |
| 中期 | 按路由 React.lazy 代码分割 | 低 |
| 中期 | 大型工作台子组件拆分 | 低 |
| 远期 | 统一身份 SSO 门户功能增强 | 高 |
| 远期 | 统一工作台管理系统入口卡片 | 高 |

---

> 本文档与 `docs/10-代码风格与命名约定.md` 互为补充。
> 代码风格约定覆盖命名和基础结构，本文档覆盖技术选型、视觉风格和架构决策。
