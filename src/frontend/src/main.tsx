import React from "react";
import ReactDOM from "react-dom/client";
import "antd/dist/reset.css";
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Descriptions,
  Dropdown,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  Menu,
  Popconfirm,
  Progress,
  Result,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Table,
  Tag,
  Timeline,
  Tooltip,
  message,
  theme
} from "antd";
import type { MenuProps } from "antd";
import {
  ApiOutlined,
  AuditOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ToolOutlined,
  UserOutlined,
  WarningOutlined
} from "@ant-design/icons";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  ShieldCheck
} from "lucide-react";
import { AuthWorkbench } from "./components/AuthWorkbench";
import { DictionaryWorkbench } from "./components/DictionaryWorkbench";
import type { DictionaryKind } from "./components/DictionaryWorkbench";
import { EquipmentDictionaryWorkbench } from "./components/EquipmentDictionaryWorkbench";
import { DeviceClassificationExportWorkbench } from "./components/DeviceClassificationExportWorkbench";
import { EvidenceWorkbench } from "./components/EvidenceWorkbench";
import { ExchangeLogWorkbench } from "./components/ExchangeLogWorkbench";
import { GlobalFooterBar } from "./components/GlobalFooterBar";
import { ImportTaskMonitor } from "./components/ImportTaskMonitor";
import { ManufacturerVendorWorkbench } from "./components/ManufacturerVendorWorkbench";
import { MasterDataGovernanceWorkbench } from "./components/MasterDataGovernanceWorkbench";
import { MappingReviewWorkbench } from "./components/MappingReviewWorkbench";
import { clearSession, hasPermission, loadSession, saveSession } from "./lib/auth";
import { HudmpApiClient } from "./lib/api";
import { APP_CHANGE_SERIAL, APP_NAME_ZH, APP_SHORT_NAME, APP_VERSION, APP_VERSION_LABEL } from "./lib/appIdentity";
import { loadConfig, normalizeBaseUrl, saveConfig } from "./lib/config";
import { applyStaticTranslations, roleLabels, text } from "./lib/i18n";
import type {
  AdminConfig,
  ApiResult,
  HealthStatus,
  Language,
  NavigationItem,
  OperatorDirectory,
  PermissionMatrix,
  UserSession
} from "./types";
import "./styles.css";

const { Header, Sider, Content } = Layout;
const appEnv = import.meta.env as Record<string, string | undefined>;
document.title = APP_NAME_ZH;

const navItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "运行总览",
    description: "医院数据总线运行监控驾驶舱",
    status: "ready"
  },
  {
    id: "data-flow-monitor",
    label: "数据流监控",
    description: "查看跨系统数据流、队列积压和链路延迟",
    status: "ready"
  },
  {
    id: "departments-master",
    label: "科室主数据",
    description: "维护组织科室主数据、标准库同步和状态启停",
    status: "ready",
    permission: "departments.manage"
  },
  {
    id: "discipline-master",
    label: "学科主数据",
    description: "维护学科分类、专科方向和院内学科口径",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "staff-master",
    label: "人员主数据",
    description: "维护人员身份、执业角色和岗位归属",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "manufacturer-vendors",
    label: "往来单位主数据",
    description: "统一维护厂家、供应商、维保商、代理商等机构主体与业务角色",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-aliases",
    label: "单位别名库",
    description: "维护单位简称、英文名、曾用名和外部原始名称",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-relations",
    label: "单位关系图谱",
    description: "维护母子公司、品牌归属、授权代理、授权维保和历史更名关系",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-mapping",
    label: "单位编码映射",
    description: "维护医保、SPD、HIS、财务、供应商门户和装备平台单位编码映射",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-candidates",
    label: "单位候选审核",
    description: "审核从铭牌、发票、合同、设备台账和供应商门户提取的候选单位",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "materials-catalog",
    label: "医保耗材目录",
    description: "维护医保耗材目录、停用码和转码关系",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-specs",
    label: "耗材规格型号",
    description: "维护耗材规格型号和厂商机构引用",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-mapping",
    label: "耗材编码映射",
    description: "维护耗材外部编码到标准主数据的映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "equipment-category",
    label: "设备分类目录",
    description: "维护设备分类目录和装备平台引用口径",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "equipment-standard-name",
    label: "设备标准名称",
    description: "维护设备标准名称和常见生产厂家引用",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "device-classification",
    label: "医疗器械分类目录",
    description: "维护国家医疗器械法定分类标准字典",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "device-classification-export",
    label: "医疗器械分类目录导出",
    description: "按主数据导出任务生成目录文件、导出记录和审计日志",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "dictionaries",
    label: "字典总览",
    description: "统一查看院内字典、标准字典和接口字段口径",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "field-mapping",
    label: "字段映射",
    description: "维护本地编码、标准编码和跨系统字段映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "coding-rules",
    label: "编码规则",
    description: "维护编码生成、校验和转换规则",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "mapping-review",
    label: "映射审核",
    description: "审核待确认映射和主数据归并结果",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "his-ingest",
    label: "HIS 接入",
    description: "HIS 患者、费用、医嘱等数据接入配置",
    status: "ready"
  },
  {
    id: "lis-ingest",
    label: "LIS 接入",
    description: "LIS 检验申请、结果和字典接入配置",
    status: "ready"
  },
  {
    id: "pacs-ingest",
    label: "PACS 接入",
    description: "PACS 检查、影像和报告接入配置",
    status: "ready"
  },
  {
    id: "emr-ingest",
    label: "EMR 接入",
    description: "EMR 病历、诊疗过程和质控数据接入配置",
    status: "ready"
  },
  {
    id: "spd-ingest",
    label: "SPD 接入",
    description: "SPD 供应链、耗材库存和消耗数据接入配置",
    status: "ready"
  },
  {
    id: "import-tasks",
    label: "批量导入任务",
    description: "监控医保耗材、字典包和压缩包批量导入",
    status: "ready",
    permission: "imports.manage"
  },
  {
    id: "exchange-tasks",
    label: "交换任务",
    description: "维护定时交换、事件交换和人工补偿任务",
    status: "ready"
  },
  {
    id: "data-routing",
    label: "数据路由",
    description: "维护来源系统、目标系统、过滤条件和路由策略",
    status: "ready"
  },
  {
    id: "queue-monitor",
    label: "消息队列",
    description: "查看队列积压、消费速率和重试状态",
    status: "ready"
  },
  {
    id: "retry-queue",
    label: "重试队列",
    description: "处理失败消息、重试任务和死信队列",
    status: "ready"
  },
  {
    id: "api-services",
    label: "API 服务",
    description: "维护对外接口、协议、授权和调用策略",
    status: "ready"
  },
  {
    id: "api-auth",
    label: "接口授权",
    description: "配置第三方系统访问凭证、授权范围和限流策略",
    status: "ready"
  },
  {
    id: "interface-logs",
    label: "接口日志",
    description: "查询接口调用轨迹、耗时、错误和脱敏载荷",
    status: "ready",
    permission: "exchange.view"
  },
  {
    id: "call-stats",
    label: "调用统计",
    description: "统计接口调用量、成功率、错误率和响应时间",
    status: "ready",
    permission: "exchange.view"
  },
  {
    id: "service-health",
    label: "服务状态",
    description: "查看后端服务、数据库、Redis 和消息队列状态",
    status: "ready",
    permission: "exchange.view"
  },
  {
    id: "node-monitor",
    label: "节点监控",
    description: "查看服务节点 CPU、内存、连接数和心跳",
    status: "ready"
  },
  {
    id: "error-logs",
    label: "错误日志",
    description: "查看异常消息、接口错误、导入失败和重试结果",
    status: "ready",
    permission: "exchange.view"
  },
  {
    id: "alert-center",
    label: "告警中心",
    description: "维护告警规则、通知状态和处理闭环",
    status: "ready"
  },
  {
    id: "evidence-export",
    label: "交付材料",
    description: "整理验收、联调和第三方交付所需脱敏证据",
    status: "ready"
  },
  {
    id: "permissions",
    label: "用户管理",
    description: "维护平台账号、角色、权限和操作范围",
    status: "ready",
    permission: "permissions.manage"
  },
  {
    id: "role-permissions",
    label: "角色权限",
    description: "维护角色权限、菜单权限和数据权限",
    status: "ready",
    permission: "permissions.manage"
  },
  {
    id: "parameter-config",
    label: "参数配置",
    description: "维护平台运行参数、接口限流和同步窗口",
    status: "ready",
    permission: "permissions.manage"
  },
  {
    id: "audit-logs",
    label: "审计日志",
    description: "追踪配置变更、审核动作和敏感操作",
    status: "ready",
    permission: "permissions.manage"
  }
];

const masterDataGovernanceIds = new Set(["departments-master", "discipline-master", "staff-master", "materials-catalog", "material-specs"]);

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`status-pill ${ok ? "status-pill-ok" : "status-pill-warn"}`}>{label}</span>;
}

type NavigationGroup = "workspace" | "quick" | "master" | "ingest" | "exchange" | "api" | "ops" | "system";

function groupLabel(language: Language, group: NavigationGroup): string {
  if (language === "zh") {
    return {
      workspace: "工作台",
      quick: "常用入口",
      master: "主数据治理",
      ingest: "数据接入",
      exchange: "数据交换",
      api: "接口管理",
      ops: "运维监控",
      system: "系统管理"
    }[group];
  }
  return {
    workspace: "Workspace",
    quick: "Common",
    master: "Master Data",
    ingest: "Data Ingestion",
    exchange: "Data Exchange",
    api: "API Management",
    ops: "Operations",
    system: "System"
  }[group];
}

function submenuLabel(language: Language, key: string): string {
  if (language === "zh") {
    return {
      org: "组织主数据",
      vendors: "往来单位主数据",
      materials: "耗材主数据",
      equipment: "装备字典"
    }[key] ?? key;
  }
  return {
    org: "Organization",
    vendors: "Business Partners",
    materials: "Materials",
    equipment: "Equipment Dictionaries"
  }[key] ?? key;
}

function activeGroup(activeId: string): NavigationGroup {
  if (["materials-catalog", "material-specs", "import-tasks"].includes(activeId)) {
    return "quick";
  }
  if ([
    "departments-master",
    "discipline-master",
    "staff-master",
    "manufacturer-vendors",
    "vendor-aliases",
    "vendor-relations",
    "vendor-mapping",
    "vendor-candidates",
    "material-mapping",
    "equipment-category",
    "equipment-standard-name",
    "device-classification",
    "device-classification-export",
    "dictionaries",
    "field-mapping",
    "coding-rules",
    "mapping-review"
  ].includes(activeId)) {
    return "master";
  }
  if (["his-ingest", "lis-ingest", "pacs-ingest", "emr-ingest", "spd-ingest"].includes(activeId)) {
    return "ingest";
  }
  if (["exchange-tasks", "data-routing", "queue-monitor", "retry-queue"].includes(activeId)) {
    return "exchange";
  }
  if (["api-services", "api-auth", "interface-logs", "call-stats"].includes(activeId)) {
    return "api";
  }
  if (["service-health", "node-monitor", "error-logs", "alert-center"].includes(activeId)) {
    return "ops";
  }
  if (["permissions", "role-permissions", "parameter-config", "audit-logs", "evidence-export"].includes(activeId)) {
    return "system";
  }
  return "workspace";
}

const navIcons: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  "data-flow-monitor": <ApiOutlined />,
  dictionaries: <DatabaseOutlined />,
  "departments-master": <DatabaseOutlined />,
  "discipline-master": <DatabaseOutlined />,
  "staff-master": <UserOutlined />,
  "manufacturer-vendors": <DatabaseOutlined />,
  "vendor-aliases": <FileDoneOutlined />,
  "vendor-relations": <AuditOutlined />,
  "vendor-mapping": <ApiOutlined />,
  "vendor-candidates": <AuditOutlined />,
  "materials-catalog": <MedicineBoxOutlined />,
  "material-specs": <MedicineBoxOutlined />,
  "material-mapping": <AuditOutlined />,
  "equipment-category": <DatabaseOutlined />,
  "equipment-standard-name": <MedicineBoxOutlined />,
  "device-classification": <DatabaseOutlined />,
  "device-classification-export": <FileDoneOutlined />,
  "field-mapping": <AuditOutlined />,
  "coding-rules": <ToolOutlined />,
  "mapping-review": <AuditOutlined />,
  "his-ingest": <MedicineBoxOutlined />,
  "lis-ingest": <MedicineBoxOutlined />,
  "pacs-ingest": <MedicineBoxOutlined />,
  "emr-ingest": <MedicineBoxOutlined />,
  "spd-ingest": <MedicineBoxOutlined />,
  "import-tasks": <CloudUploadOutlined />,
  "exchange-tasks": <ApiOutlined />,
  "data-routing": <ToolOutlined />,
  "queue-monitor": <CloudUploadOutlined />,
  "retry-queue": <WarningOutlined />,
  "api-services": <ApiOutlined />,
  "api-auth": <SafetyCertificateOutlined />,
  "interface-logs": <FileDoneOutlined />,
  "call-stats": <DashboardOutlined />,
  "service-health": <CheckCircleOutlined />,
  "node-monitor": <DatabaseOutlined />,
  "error-logs": <WarningOutlined />,
  "alert-center": <BellOutlined />,
  "evidence-export": <FileDoneOutlined />,
  permissions: <UserOutlined />,
  "role-permissions": <SafetyCertificateOutlined />,
  "parameter-config": <SettingOutlined />,
  "audit-logs": <FileDoneOutlined />
};

const navigationSections: Array<{ key: NavigationGroup; icon: React.ReactNode; itemIds: string[] }> = [
  { key: "workspace", icon: <DashboardOutlined />, itemIds: ["dashboard", "data-flow-monitor"] },
  { key: "quick", icon: <CloudUploadOutlined />, itemIds: ["materials-catalog", "import-tasks", "material-specs", "equipment-category", "equipment-standard-name", "device-classification", "device-classification-export"] },
  {
    key: "master",
    icon: <DatabaseOutlined />,
    itemIds: [
      "departments-master",
      "discipline-master",
      "staff-master",
      "manufacturer-vendors",
      "vendor-aliases",
      "vendor-relations",
      "vendor-mapping",
      "vendor-candidates",
      "material-mapping",
      "dictionaries",
      "field-mapping",
      "coding-rules",
      "mapping-review"
    ]
  },
  { key: "ingest", icon: <CloudUploadOutlined />, itemIds: ["his-ingest", "lis-ingest", "pacs-ingest", "emr-ingest", "spd-ingest"] },
  { key: "exchange", icon: <ApiOutlined />, itemIds: ["exchange-tasks", "data-routing", "queue-monitor", "retry-queue"] },
  { key: "api", icon: <ApiOutlined />, itemIds: ["api-services", "api-auth", "interface-logs", "call-stats"] },
  { key: "ops", icon: <WarningOutlined />, itemIds: ["service-health", "node-monitor", "error-logs", "alert-center"] },
  { key: "system", icon: <SettingOutlined />, itemIds: ["permissions", "role-permissions", "parameter-config", "audit-logs", "evidence-export"] }
];

function buildNavigationItems(language: Language, session: UserSession | null): MenuProps["items"] {
  const item = (id: string, keyPrefix?: string) => {
    const navItem = navItems.find((candidate) => candidate.id === id);
    if (!navItem) {
      return null;
    }
    return {
      key: keyPrefix ? `${keyPrefix}:${navItem.id}` : navItem.id,
      icon: navIcons[navItem.id],
      label: text(language, navItem.label),
      disabled: !hasPermission(session, navItem.permission)
    };
  };

  const masterChildren = [
    {
      key: "master-org-group",
      label: submenuLabel(language, "org"),
      children: ["departments-master", "discipline-master", "staff-master"].map((id) => item(id, "master")).filter(Boolean)
    },
    {
      key: "master-vendor-group",
      label: submenuLabel(language, "vendors"),
      children: ["manufacturer-vendors", "vendor-aliases", "vendor-relations", "vendor-mapping", "vendor-candidates"].map((id) => item(id, "master")).filter(Boolean)
    },
    {
      key: "master-material-group",
      label: submenuLabel(language, "materials"),
      children: ["materials-catalog", "material-specs", "material-mapping"].map((id) => item(id, "master")).filter(Boolean)
    },
    {
      key: "master-equipment-group",
      label: submenuLabel(language, "equipment"),
      children: ["equipment-category", "equipment-standard-name", "device-classification", "device-classification-export"].map((id) => item(id, "master")).filter(Boolean)
    },
    item("dictionaries"),
    item("field-mapping"),
    item("coding-rules"),
    item("mapping-review")
  ].filter(Boolean);

  return [
    ...navigationSections.map((section) => ({
      key: section.key,
      icon: section.icon,
      label: groupLabel(language, section.key),
      children: section.key === "master" ? masterChildren : section.itemIds.map((id) => item(id, section.key)).filter(Boolean)
    }))
  ].filter(Boolean);
}

function displayEnvironmentName(value: string): string {
  return value === "local" ? "本机服务" : value;
}

function displayVersionLabel(value: string): string {
  return value === "dev" ? "试运行版" : value;
}

function displayFooterEnvironment(value: string): string {
  const normalized = (appEnv.VITE_APP_ENV || appEnv.MODE || value || "").toLowerCase();
  if (normalized.includes("prod") || value.includes("生产")) {
    return "生产环境";
  }
  if (normalized.includes("test") || value.includes("测试")) {
    return "测试环境";
  }
  return "开发环境";
}

function Field({
  label,
  value,
  type = "text",
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  type?: "text" | "password";
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} type={type} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ConnectionPanel({
  health,
  checking,
  onRefresh,
  draft,
  saved,
  onDraftChange,
  onSave,
  language
}: {
  health: ApiResult<HealthStatus> | null;
  checking: boolean;
  onRefresh: () => void;
  draft: AdminConfig;
  saved: AdminConfig;
  onDraftChange: (config: AdminConfig) => void;
  onSave: () => void;
  language: Language;
}) {
  const healthData = health?.data;
  const isOk = Boolean(health?.ok && healthData?.status === "ok");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const updated = health ? new Date().toLocaleTimeString() : text(language, "awaitingCheck");

  return (
    <section className="panel system-panel" aria-labelledby="system-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text(language, "systemReadiness")}</p>
          <h2 id="system-heading">{text(language, "serviceConnection")}</h2>
        </div>
        <button className="icon-button" type="button" title={text(language, "refreshHealth")} onClick={onRefresh} disabled={checking}>
          <RefreshCw size={18} className={checking ? "spin" : ""} />
        </button>
      </div>

      <div className="connection-row">
        <div className="health-status">
          {isOk ? <CheckCircle2 size={34} /> : <AlertTriangle size={34} />}
          <div>
            <strong>{health ? (isOk ? text(language, "serviceReady") : text(language, "serviceNeedsCheck")) : text(language, "awaitingCheck")}</strong>
            <span>{health?.message ?? text(language, "serviceCheckHint")}</span>
          </div>
        </div>
        <div className="connection-summary">
          <div>
            <span>{text(language, "serviceName")}</span>
            <strong>{displayEnvironmentName(saved.environmentName)}</strong>
          </div>
          <div>
            <span>{text(language, "releaseLabel")}</span>
            <strong>{displayVersionLabel(saved.candidateVersion)}</strong>
          </div>
          <div>
            <span>{text(language, "lastCheck")}</span>
            <strong>{updated}</strong>
          </div>
        </div>
      </div>

      <details className="advanced-settings">
        <summary>{text(language, "adminConnectionSettings")}</summary>
        <div className="form-grid">
          <Field
            label={text(language, "apiBaseUrl")}
            value={draft.apiBaseUrl}
            onChange={(apiBaseUrl) => onDraftChange({ ...draft, apiBaseUrl })}
            placeholder="http://127.0.0.1:8101"
          />
          <Field
            label={text(language, "serviceName")}
            value={draft.environmentName}
            onChange={(environmentName) => onDraftChange({ ...draft, environmentName })}
          />
          <Field
            label={text(language, "releaseLabel")}
            value={draft.candidateVersion}
            onChange={(candidateVersion) => onDraftChange({ ...draft, candidateVersion })}
          />
          <button className="action-button" type="button" onClick={onSave} disabled={!dirty}>
            <Save size={16} />
            {text(language, "save")}
          </button>
        </div>
        <div className="config-note">
          <ShieldCheck size={17} />
          <span>{text(language, "connectionSettingsNote")}</span>
        </div>
      </details>
    </section>
  );
}

function NavigationRail({
  activeId,
  onSelect,
  language,
  session,
  onToggle
}: {
  activeId: string;
  onSelect: (id: string) => void;
  language: Language;
  session: UserSession | null;
  onToggle: () => void;
}) {
  const menuItems = React.useMemo(() => buildNavigationItems(language, session), [language, session]);
  const handleMenuClick: MenuProps["onClick"] = ({ key }) => onSelect(String(key).split(":").pop() || String(key));
  const selectedMenuKey = `${activeGroup(activeId)}:${activeId}`;

  return (
    <Sider className="app-sider" width={248} theme="dark" collapsible={false}>
      <div className="sider-brand">
        <MedicineBoxOutlined />
        <div>
          <strong>{APP_SHORT_NAME}</strong>
          <span>{text(language, "appSubtitle")}</span>
          <span className="sider-version">
            <Tag color="blue">{APP_VERSION}</Tag>
            <Tag className="version-serial-tag">{APP_CHANGE_SERIAL}</Tag>
          </span>
        </div>
      </div>
      <Menu
        className="sider-menu"
        mode="inline"
        theme="dark"
        selectedKeys={[selectedMenuKey, `quick:${activeId}`, `master:${activeId}`]}
        defaultOpenKeys={navigationSections.map((section) => section.key)}
        items={menuItems}
        onClick={handleMenuClick}
      />
      <div className="sider-footer">
        <Button block ghost icon={<MenuFoldOutlined />} onClick={onToggle}>
          {text(language, "hideMenu")}
        </Button>
      </div>
    </Sider>
  );
}

function WorkflowPanel({ activeId, language }: { activeId: string; language: Language }) {
  const active = navItems.find((item) => item.id === activeId) ?? navItems[0];

  return (
    <section className="panel workflow-panel" aria-labelledby="workflow-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text(language, "workbench")}</p>
          <h2 id="workflow-heading">{text(language, active.label)}</h2>
        </div>
        <StatusPill ok={active.status === "ready"} label={active.status === "ready" ? text(language, "available") : text(language, "planned")} />
      </div>
      <p className="workflow-description">{text(language, active.description)}</p>

      <div className="placeholder-table" role="table" aria-label="Alpha workflow readiness">
        <div role="row">
          <span role="columnheader">{text(language, "capability")}</span>
          <span role="columnheader">{text(language, "state")}</span>
          <span role="columnheader">{text(language, "issue")}</span>
        </div>
        <div role="row">
          <span>Frontend shell and API client</span>
          <span>Ready</span>
          <span>#13</span>
        </div>
        <div role="row">
          <span>Dictionary workbench</span>
          <span>Ready</span>
          <span>#14</span>
        </div>
        <div role="row">
          <span>Import task monitor</span>
          <span>Ready</span>
          <span>#15</span>
        </div>
      </div>
    </section>
  );
}

class ContentErrorBoundary extends React.Component<
  { resetKey: string; children: React.ReactNode },
  { error: Error | null; componentStack: string }
> {
  state: { error: Error | null; componentStack: string } = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${APP_SHORT_NAME} module error]`, error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? "" });
  }

  componentDidUpdate(previousProps: { resetKey: string }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, componentStack: "" });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="module-error-card" variant="outlined">
          <Result
            status="error"
            title="当前模块加载失败"
            subTitle={this.state.error.message || "页面渲染时发生异常，请刷新或切换菜单后重试。"}
          />
          <pre className="module-error-detail">
            {this.state.error.name}: {this.state.error.message}
            {this.state.componentStack ? `\n${this.state.componentStack}` : ""}
          </pre>
        </Card>
      );
    }
    return this.props.children;
  }
}

type PlatformStatus = "normal" | "syncing" | "delayed" | "error" | "offline";

const statusMeta: Record<PlatformStatus, { label: string; color: string; badge: "success" | "processing" | "warning" | "error" | "default" }> = {
  normal: { label: "正常", color: "success", badge: "success" },
  syncing: { label: "同步中", color: "processing", badge: "processing" },
  delayed: { label: "延迟", color: "warning", badge: "warning" },
  error: { label: "异常", color: "error", badge: "error" },
  offline: { label: "离线", color: "default", badge: "default" }
};

const systemConnections: Array<{ name: string; status: PlatformStatus; latency: number; detail: string }> = [
  { name: "HIS", status: "normal", latency: 82, detail: "门诊、住院、费用数据链路正常" },
  { name: "LIS", status: "normal", latency: 95, detail: "检验申请与结果回传正常" },
  { name: "PACS", status: "normal", latency: 118, detail: "检查报告与影像索引正常" },
  { name: "EMR", status: "delayed", latency: 384, detail: "病历变更消息延迟，建议关注队列积压" },
  { name: "SPD", status: "normal", latency: 76, detail: "耗材库存和消耗同步正常" },
  { name: "医保", status: "offline", latency: 0, detail: "医保平台夜间维护窗口，接口暂不可用" },
  { name: "RabbitMQ", status: "normal", latency: 12, detail: "消息代理连接正常" },
  { name: "Redis", status: "normal", latency: 5, detail: "缓存与任务锁状态正常" },
  { name: "PostgreSQL", status: "normal", latency: 18, detail: "主数据库连接正常" }
];

const topologySources = [
  { name: "HIS", status: "normal" as PlatformStatus, count: "48,392", latency: 82 },
  { name: "LIS", status: "normal" as PlatformStatus, count: "21,804", latency: 95 },
  { name: "PACS", status: "normal" as PlatformStatus, count: "8,477", latency: 118 },
  { name: "EMR", status: "delayed" as PlatformStatus, count: "32,116", latency: 384 },
  { name: "SPD", status: "normal" as PlatformStatus, count: "17,853", latency: 76 }
];

const topologyTargets = [
  { name: "主数据平台", status: "normal" as PlatformStatus, count: "63,914", latency: 96 },
  { name: "设备平台", status: "normal" as PlatformStatus, count: "13,208", latency: 102 },
  { name: "医保平台", status: "offline" as PlatformStatus, count: "0", latency: 0 },
  { name: "运营分析平台", status: "normal" as PlatformStatus, count: "41,027", latency: 141 },
  { name: "BI 平台", status: "normal" as PlatformStatus, count: "10,493", latency: 133 }
];

const exceptionRows = [
  { id: "ERR-240510-019", source: "EMR.EncounterChanged", target: "主数据平台", type: "字段缺失", retry: 2, status: "待人工确认", time: "14:32:08" },
  { id: "ERR-240510-018", source: "医保.CodeSync", target: APP_SHORT_NAME, type: "目标离线", retry: 5, status: "已进入重试队列", time: "14:27:41" },
  { id: "ERR-240510-017", source: "SPD.MaterialStock", target: "运营分析平台", type: "编码未映射", retry: 1, status: "等待映射审核", time: "14:22:16" },
  { id: "ERR-240510-016", source: "PACS.ReportReady", target: "EMR", type: "超时", retry: 3, status: "自动重试中", time: "14:18:03" }
];

const reviewRows = [
  { key: "MAP-3318", item: "SPD 耗材编码映射", owner: "数据治理员", status: "待审核", count: 28 },
  { key: "DICT-0921", item: "科室字典新增确认", owner: "平台管理员", status: "待确认", count: 12 },
  { key: "API-1207", item: "第三方接口发布", owner: "接口管理员", status: "待发布", count: 3 },
  { key: "ERR-8172", item: "失败消息人工处理", owner: "运维值班", status: "待处理", count: 17 }
];

function renderStatusTag(status: PlatformStatus, label?: string) {
  const meta = statusMeta[status];
  return (
    <Tag color={meta.color}>
      <Badge status={meta.badge} text={label ?? meta.label} />
    </Tag>
  );
}

function SystemStatusBar({ lastRefresh }: { lastRefresh: Date }) {
  return (
    <Card className="system-status-bar" variant="outlined">
      <div className="system-status-title">
        <strong>系统连接状态</strong>
        <span>每 30 秒自动刷新 · 最近刷新 {lastRefresh.toLocaleTimeString()}</span>
      </div>
      <div className="system-status-list">
        {systemConnections.map((item) => (
          <Tooltip key={item.name} title={`${item.detail}${item.latency ? ` · ${item.latency} ms` : ""}`}>
            <span className="system-status-item">
              {renderStatusTag(item.status, item.name)}
            </span>
          </Tooltip>
        ))}
      </div>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  suffix,
  status,
  trend,
  hint,
  icon
}: {
  title: string;
  value: string | number;
  suffix?: string;
  status: PlatformStatus;
  trend: string;
  hint: string;
  icon: React.ReactNode;
}) {
  const meta = statusMeta[status];
  return (
    <Card className="bus-metric-card" variant="outlined">
      <div className="metric-card-head">
        <span className="metric-icon">{icon}</span>
        <Tag color={meta.color}>{meta.label}</Tag>
      </div>
      <Statistic title={title} value={value} suffix={suffix} />
      <div className="metric-foot">
        <span className={status === "error" || status === "delayed" ? "trend-warn" : "trend-ok"}>{trend}</span>
        <small>{hint}</small>
      </div>
      <div className="metric-sparkline" aria-hidden="true">
        {[18, 28, 24, 36, 31, 44, 39, 52].map((height, index) => <i key={index} style={{ height }} />)}
      </div>
    </Card>
  );
}

function FlowNode({ node }: { node: { name: string; status: PlatformStatus; count: string; latency: number } }) {
  return (
    <div className={`flow-node flow-node-${node.status}`}>
      <div>
        <strong>{node.name}</strong>
        {renderStatusTag(node.status)}
      </div>
      <span>今日 {node.count} 条</span>
      <small>{node.latency ? `${node.latency} ms` : "无连接"}</small>
    </div>
  );
}

function DataFlowTopology() {
  return (
    <Card title="数据流拓扑" extra={<Tag color="processing">{`HIS → ${APP_SHORT_NAME} → 多系统`}</Tag>} variant="outlined">
      <div className="data-flow-topology">
        <div className="flow-column">
          <span className="flow-column-title">来源系统</span>
          {topologySources.map((node) => <FlowNode key={node.name} node={node} />)}
        </div>
        <div className="flow-bus">
          <div className="flow-line flow-line-left" />
          <div className="bus-core">
            <MedicineBoxOutlined />
            <strong>{APP_SHORT_NAME} 数据总线</strong>
            <span>标准化 · 路由 · 映射 · 追踪 · 重试</span>
            <Tag color="blue">128,642 条 / 今日</Tag>
          </div>
          <div className="flow-pulse" />
          <div className="flow-line flow-line-right" />
        </div>
        <div className="flow-column">
          <span className="flow-column-title">目标平台</span>
          {topologyTargets.map((node) => <FlowNode key={node.name} node={node} />)}
        </div>
      </div>
    </Card>
  );
}

function ExchangeTrendChart() {
  return (
    <Card title="实时交换趋势" extra={<Tag>最近 24 小时</Tag>} variant="outlined">
      <div className="trend-chart">
        <svg viewBox="0 0 640 220" role="img" aria-label="最近 24 小时交换趋势">
          <defs>
            <linearGradient id="successArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1677ff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1677ff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d="M20 180 L20 128 L90 118 L160 132 L230 92 L300 102 L370 76 L440 88 L510 56 L620 68 L620 180 Z" fill="url(#successArea)" />
          <polyline points="20,128 90,118 160,132 230,92 300,102 370,76 440,88 510,56 620,68" fill="none" stroke="#1677ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="20,164 90,158 160,166 230,151 300,155 370,144 440,150 510,138 620,146" fill="none" stroke="#ff4d4f" strokeWidth="3" strokeDasharray="7 7" strokeLinecap="round" />
          {[20, 90, 160, 230, 300, 370, 440, 510, 620].map((x) => <line key={x} x1={x} y1="32" x2={x} y2="180" stroke="#f0f0f0" />)}
        </svg>
        <div className="trend-legend">
          <span><Badge color="#1677ff" />交换量</span>
          <span><Badge color="#52c41a" />成功量</span>
          <span><Badge color="#ff4d4f" />失败量</span>
        </div>
      </div>
    </Card>
  );
}

function ExceptionRetryTable() {
  return (
    <Card title="异常与重试队列" extra={<Button size="small">查看全部</Button>} variant="outlined">
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={exceptionRows}
        columns={[
          { title: "消息 ID", dataIndex: "id" },
          { title: "来源接口", dataIndex: "source" },
          { title: "目标", dataIndex: "target" },
          { title: "错误类型", dataIndex: "type", render: (value) => <Tag color="error">{value}</Tag> },
          { title: "重试", dataIndex: "retry", render: (value) => `${value} 次` },
          { title: "状态", dataIndex: "status", render: (value) => <Tag color="warning">{value}</Tag> },
          { title: "时间", dataIndex: "time" },
          {
            title: "操作",
            render: () => (
              <Popconfirm title="确认重新投递该消息？" onConfirm={() => void message.success("已提交重试")}>
                <Button type="link" size="small">重试</Button>
              </Popconfirm>
            )
          }
        ]}
      />
    </Card>
  );
}

function TodoAuditTable() {
  return (
    <Card title="待办与审核" extra={<Tag color="blue">需人工处理</Tag>} variant="outlined">
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        dataSource={reviewRows}
        columns={[
          { title: "事项", dataIndex: "item" },
          { title: "负责人", dataIndex: "owner" },
          { title: "数量", dataIndex: "count", render: (value) => <Badge count={value} showZero color="#1677ff" /> },
          { title: "状态", dataIndex: "status", render: (value) => <Tag color="processing">{value}</Tag> },
          { title: "操作", render: () => <Button type="link" size="small">处理</Button> }
        ]}
      />
    </Card>
  );
}

function OpsMonitorPanel() {
  const nodes = [
    { name: "api-node-01", cpu: 42, memory: 61, connections: 128 },
    { name: "worker-node-02", cpu: 58, memory: 73, connections: 342 },
    { name: "scheduler-01", cpu: 23, memory: 44, connections: 52 }
  ];
  return (
    <Card title="运维监控" extra={<Tag color="success">RabbitMQ / Redis / PostgreSQL 正常</Tag>} variant="outlined">
      <div className="ops-node-grid">
        {nodes.map((node) => (
          <div className="ops-node-card" key={node.name}>
            <strong>{node.name}</strong>
            <span>连接数 {node.connections}</span>
            <Progress percent={node.cpu} size="small" status={node.cpu > 80 ? "exception" : "active"} format={(value) => `CPU ${value}%`} />
            <Progress percent={node.memory} size="small" status={node.memory > 80 ? "exception" : "normal"} format={(value) => `内存 ${value}%`} />
          </div>
        ))}
      </div>
      <div className="ops-mini-metrics">
        <span>最近 5 分钟交换量 <strong>18,420</strong></span>
        <span>最近 1 小时失败率 <strong>0.18%</strong></span>
        <span>队列积压趋势 <strong>下降 9.4%</strong></span>
        <span>错误类型分布 <strong>编码未映射 42%</strong></span>
      </div>
    </Card>
  );
}

type PlatformRow = {
  key: string;
  name: string;
  source: string;
  target: string;
  type: string;
  status: PlatformStatus;
  metric: string;
  updatedAt: string;
};

const platformPageRows: Record<string, PlatformRow[]> = {
  dictionaries: [
    { key: "DICT-DEPT", name: "科室字典", source: "国家卫健委诊疗科目 / HIS", target: `${APP_SHORT_NAME} 主数据`, type: "基础字典", status: "normal", metric: "支持启停维护", updatedAt: "14:35:10" },
    { key: "DICT-MAT", name: "医保耗材字典", source: "医保医用耗材代码库 / SPD", target: `${APP_SHORT_NAME} 主数据`, type: "耗材字典", status: "syncing", metric: "支持全量、停用、转码导入", updatedAt: "14:22:16" },
    { key: "DICT-ORG", name: "院区与组织字典", source: "医院组织架构", target: "接口授权与路由", type: "字段蓝图", status: "normal", metric: "待接入维护界面", updatedAt: "13:58:44" }
  ],
  "field-mapping": [
    { key: "MAP-HIS-DEPT", name: "HIS 科室编码映射", source: "HIS", target: "主数据平台", type: "科室字典", status: "syncing", metric: "待审核 28", updatedAt: "14:35:10" },
    { key: "MAP-SPD-MAT", name: "SPD 耗材编码映射", source: "SPD", target: "医保标准码", type: "耗材字典", status: "delayed", metric: "未映射 17", updatedAt: "14:22:16" },
    { key: "MAP-LIS-ITEM", name: "LIS 检验项目映射", source: "LIS", target: "EMR", type: "检验项目", status: "normal", metric: "成功率 99.6%", updatedAt: "13:58:44" }
  ],
  "coding-rules": [
    { key: "RULE-DEPT", name: "院内科室编码规则", source: "平台配置", target: "HIS/EMR", type: "编码校验", status: "normal", metric: "启用 12 条", updatedAt: "13:40:00" },
    { key: "RULE-MAT", name: "医保耗材 27 位码校验", source: "医保码表", target: "SPD/收费", type: "编码转换", status: "normal", metric: "覆盖 100%", updatedAt: "12:20:31" }
  ],
  "his-ingest": [
    { key: "HIS-ADT", name: "患者就诊信息接入", source: "HIS", target: APP_SHORT_NAME, type: "HL7/REST", status: "normal", metric: "48,392 条", updatedAt: "14:36:02" },
    { key: "HIS-FEE", name: "费用明细接入", source: "HIS", target: "运营分析", type: "Batch", status: "normal", metric: "21,744 条", updatedAt: "14:30:18" }
  ],
  "lis-ingest": [
    { key: "LIS-RESULT", name: "检验结果接入", source: "LIS", target: "EMR", type: "HL7 ORU", status: "normal", metric: "21,804 条", updatedAt: "14:35:55" }
  ],
  "pacs-ingest": [
    { key: "PACS-REPORT", name: "检查报告接入", source: "PACS", target: "EMR", type: "REST", status: "normal", metric: "8,477 条", updatedAt: "14:33:08" }
  ],
  "emr-ingest": [
    { key: "EMR-DOC", name: "病历变更接入", source: "EMR", target: APP_SHORT_NAME, type: "MQ", status: "delayed", metric: "延迟 384 ms", updatedAt: "14:28:47" }
  ],
  "spd-ingest": [
    { key: "SPD-STOCK", name: "耗材库存接入", source: "SPD", target: "主数据平台", type: "Batch/MQ", status: "normal", metric: "17,853 条", updatedAt: "14:31:19" }
  ],
  "import-tasks": [
    { key: "IMP-ARCHIVE", name: "压缩包批量导入", source: "医保发布包", target: "导入任务队列", type: "Archive", status: "syncing", metric: "支持 zip/7z/rar 预检", updatedAt: "14:35:10" },
    { key: "IMP-MAT", name: "医保耗材全量规格导入", source: "医保 Excel", target: "耗材主数据", type: "XLSX", status: "normal", metric: "支持大文件异步处理", updatedAt: "14:22:16" },
    { key: "IMP-DISABLED", name: "停用表与转码表导入", source: "医保停用/转码表", target: "码表状态与替换关系", type: "XLSX", status: "normal", metric: "支持导入后预览", updatedAt: "13:58:44" }
  ],
  "exchange-tasks": [
    { key: "TASK-MD-DEPT", name: "科室主数据同步", source: APP_SHORT_NAME, target: "HIS/EMR/SPD", type: "定时任务", status: "normal", metric: "成功 642", updatedAt: "14:30:00" },
    { key: "TASK-YB-MAT", name: "医保耗材码表同步", source: "医保", target: APP_SHORT_NAME, type: "批处理", status: "offline", metric: "维护窗口", updatedAt: "02:00:00" }
  ],
  "data-routing": [
    { key: "ROUTE-ADT", name: "患者就诊路由", source: "HIS", target: "EMR/BI", type: "条件路由", status: "normal", metric: "命中 99.9%", updatedAt: "14:36:16" },
    { key: "ROUTE-MAT", name: "耗材消耗路由", source: "SPD", target: "运营分析/医保", type: "主题路由", status: "delayed", metric: "积压 21", updatedAt: "14:25:20" }
  ],
  "queue-monitor": [
    { key: "Q-EMR", name: "emr.encounter.changed", source: "EMR", target: "worker-node-02", type: "RabbitMQ", status: "delayed", metric: "积压 21", updatedAt: "14:36:11" },
    { key: "Q-SPD", name: "spd.material.stock", source: "SPD", target: "mapping-worker", type: "RabbitMQ", status: "normal", metric: "积压 8", updatedAt: "14:36:06" }
  ],
  "retry-queue": exceptionRows.map((row) => ({
    key: row.id,
    name: row.source,
    source: row.source.split(".")[0],
    target: row.target,
    type: row.type,
    status: row.status.includes("重试") ? "syncing" : "delayed",
    metric: `重试 ${row.retry} 次`,
    updatedAt: row.time
  })),
  "mapping-review": [
    { key: "REV-SPD-MAT", name: "SPD 耗材映射审核", source: "SPD", target: "医保标准码", type: "映射审核", status: "delayed", metric: "待审核 28", updatedAt: "14:35:10" },
    { key: "REV-HIS-DEPT", name: "HIS 科室映射审核", source: "HIS", target: "标准科室", type: "映射审核", status: "syncing", metric: "待确认 12", updatedAt: "14:22:16" },
    { key: "REV-LIS-ITEM", name: "LIS 检验项目映射审核", source: "LIS", target: "EMR 标准项目", type: "映射审核", status: "normal", metric: "今日通过 64", updatedAt: "13:58:44" }
  ],
  "api-services": [
    { key: "API-DEPT", name: "标准科室字典服务", source: APP_SHORT_NAME, target: "第三方系统", type: "REST", status: "normal", metric: "今日 12,840", updatedAt: "14:35:28" },
    { key: "API-MAT", name: "医保耗材查询服务", source: APP_SHORT_NAME, target: "SPD/收费", type: "REST", status: "normal", metric: "成功率 99.92%", updatedAt: "14:33:49" },
    { key: "API-MAP", name: "字典映射解析服务", source: APP_SHORT_NAME, target: "HIS/LIS/EMR", type: "REST", status: "delayed", metric: "P95 420 ms", updatedAt: "14:29:17" }
  ],
  "api-auth": [
    { key: "AUTH-SPD", name: "SPD 供应链系统授权", source: "SPD", target: `${APP_SHORT_NAME} API`, type: "Token", status: "normal", metric: "45 天后过期", updatedAt: "10:12:00" },
    { key: "AUTH-BI", name: "BI 平台只读授权", source: "BI", target: `${APP_SHORT_NAME} API`, type: "API Key", status: "normal", metric: "限流 300/min", updatedAt: "09:42:31" }
  ],
  "call-stats": [
    { key: "STAT-DEPT", name: "科室服务调用统计", source: "第三方系统", target: "字典服务", type: "统计", status: "normal", metric: "今日 12,840", updatedAt: "14:35:00" },
    { key: "STAT-MAP", name: "映射服务调用统计", source: "业务系统", target: "映射服务", type: "统计", status: "delayed", metric: "失败率 0.34%", updatedAt: "14:30:00" }
  ],
  "node-monitor": [
    { key: "NODE-API", name: "api-node-01", source: "K8s", target: `${APP_SHORT_NAME} API`, type: "服务节点", status: "normal", metric: "CPU 42% / Mem 61%", updatedAt: "14:36:20" },
    { key: "NODE-WORKER", name: "worker-node-02", source: "K8s", target: "异步任务", type: "工作节点", status: "normal", metric: "CPU 58% / Mem 73%", updatedAt: "14:36:20" }
  ],
  "error-logs": exceptionRows.map((row) => ({
    key: row.id,
    name: row.type,
    source: row.source,
    target: row.target,
    type: "错误日志",
    status: row.status.includes("重试") ? "syncing" : "delayed",
    metric: row.status,
    updatedAt: row.time
  })),
  "alert-center": [
    { key: "ALERT-EMR", name: "EMR 队列延迟告警", source: "监控规则", target: "运维值班", type: "告警", status: "delayed", metric: "持续 11 分钟", updatedAt: "14:31:00" },
    { key: "ALERT-YB", name: "医保平台离线告警", source: "健康检查", target: "平台管理员", type: "告警", status: "offline", metric: "维护窗口", updatedAt: "02:00:00" }
  ],
  "role-permissions": [
    { key: "ROLE-ADMIN", name: "平台管理员", source: "系统管理", target: "全平台", type: "角色", status: "normal", metric: "9 项权限", updatedAt: "10:00:00" },
    { key: "ROLE-STEWARD", name: "数据治理员", source: "系统管理", target: "主数据治理", type: "角色", status: "normal", metric: "6 项权限", updatedAt: "10:00:00" }
  ],
  "parameter-config": [
    { key: "PARAM-RETRY", name: "失败消息最大重试次数", source: "系统参数", target: "重试队列", type: "参数", status: "normal", metric: "5 次", updatedAt: "09:30:00" },
    { key: "PARAM-SYNC", name: "医保码表同步窗口", source: "系统参数", target: "同步任务", type: "参数", status: "normal", metric: "02:00-05:00", updatedAt: "09:30:00" }
  ],
  "audit-logs": [
    { key: "AUD-001", name: "启用科室字典", source: "数据治理员", target: "字典管理", type: "审计", status: "normal", metric: "PATCH", updatedAt: "14:12:10" },
    { key: "AUD-002", name: "提交医保耗材导入", source: "平台管理员", target: "批量导入", type: "审计", status: "normal", metric: "POST", updatedAt: "13:58:02" }
  ]
};

function modulePrimaryAction(activeId: string): string {
  if (activeId.includes("ingest")) return "新增接入";
  if (activeId.includes("api")) return "新增接口";
  if (activeId.includes("queue")) return "刷新队列";
  if (activeId.includes("alert")) return "新增告警";
  if (activeId.includes("role")) return "新增角色";
  if (activeId.includes("parameter")) return "新增参数";
  if (activeId.includes("audit")) return "导出审计";
  if (activeId.includes("routing")) return "新增路由";
  if (activeId.includes("task")) return "新增任务";
  if (activeId.includes("rule")) return "新增规则";
  return "新增配置";
}

function moduleFilterLabel(activeId: string): string {
  if (activeId.includes("api")) return "接口名称 / 编码";
  if (activeId.includes("queue")) return "队列名称 / 主题";
  if (activeId.includes("alert")) return "告警名称 / 规则";
  if (activeId.includes("node")) return "节点名称 / 服务";
  if (activeId.includes("mapping")) return "本地名称 / 标准编码";
  if (activeId.includes("ingest")) return "接入名称 / 来源系统";
  return "名称 / 编码 / 关键字";
}

function PlatformModulePage({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  const active = navItems.find((item) => item.id === activeId) ?? navItems[0];
  const rows = platformPageRows[activeId] ?? [];
  const [selectedRow, setSelectedRow] = React.useState<PlatformRow | null>(null);
  const isFlowPage = activeId === "data-flow-monitor";
  const isOpsLike = ["node-monitor", "queue-monitor", "alert-center"].includes(activeId);
  const normalCount = rows.filter((row) => row.status === "normal").length;
  const pendingCount = rows.filter((row) => row.status !== "normal").length;
  const sourceCount = new Set(rows.map((row) => row.source)).size;
  const latestUpdatedAt = rows[0]?.updatedAt ?? "-";

  if (isFlowPage) {
    return (
      <section className="platform-page">
        <SystemStatusBar lastRefresh={new Date()} />
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}><DataFlowTopology /></Col>
          <Col xs={24} xl={10}><ExchangeTrendChart /></Col>
        </Row>
        <ExceptionRetryTable />
      </section>
    );
  }

  return (
    <section className="platform-page">
      <Card className="platform-page-head" variant="outlined">
        <div>
          <Tag color="blue">{groupLabel("zh", activeGroup(activeId))}</Tag>
          <h2>{active.label}</h2>
          <p>{active.description}</p>
        </div>
        <Space wrap>
          <Button icon={<SearchOutlined />} onClick={() => void message.info("已按当前条件刷新列表")}>查询</Button>
          <Button>重置</Button>
          <Button type="primary">{modulePrimaryAction(activeId)}</Button>
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card className="module-stat-card" variant="outlined">
            <Statistic title="模块对象" value={rows.length} suffix="项" />
            <span>当前页面纳入管理的配置、任务或服务数量</span>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="module-stat-card" variant="outlined">
            <Statistic title="正常运行" value={normalCount} suffix="项" valueStyle={{ color: "#52c41a" }} />
            <span>无需人工处理，可继续保持自动交换</span>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="module-stat-card" variant="outlined">
            <Statistic title="需关注" value={pendingCount} suffix="项" valueStyle={{ color: pendingCount ? "#faad14" : "#52c41a" }} />
            <span>包含延迟、同步中、离线或待重试对象</span>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="module-stat-card" variant="outlined">
            <Statistic title="来源系统" value={sourceCount} suffix="个" />
            <span>最近更新 {latestUpdatedAt}</span>
          </Card>
        </Col>
      </Row>
      <Card className="module-query-card" variant="outlined">
        <Form layout="inline" className="module-query-form">
          <Form.Item label="关键字">
            <Input allowClear placeholder={moduleFilterLabel(activeId)} prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item label="来源系统">
            <Select
              allowClear
              placeholder="全部来源"
              options={[...new Set(rows.map((row) => row.source))].map((value) => ({ value, label: value }))}
              style={{ minWidth: 160 }}
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={[
                { value: "normal", label: "正常" },
                { value: "syncing", label: "同步中" },
                { value: "delayed", label: "延迟" },
                { value: "offline", label: "离线" }
              ]}
              style={{ minWidth: 140 }}
            />
          </Form.Item>
          <Form.Item label="更新时间">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => void message.success("查询条件已应用")}>查询</Button>
              <Button>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      {isOpsLike ? <OpsMonitorPanel /> : null}
      <Card title={`${active.label}列表`} extra={<Space><Button size="small">导出</Button><Button size="small">列设置</Button><Button size="small">刷新</Button></Space>} variant="outlined">
        <Table
          size="middle"
          rowKey="key"
          dataSource={rows}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="暂无数据，请调整查询条件或新增配置" /> }}
          columns={[
            { title: "名称", dataIndex: "name", fixed: "left", width: 220 },
            { title: "来源系统", dataIndex: "source", width: 180 },
            { title: "目标系统", dataIndex: "target", width: 180 },
            { title: "类型", dataIndex: "type", width: 140, render: (value) => <Tag>{value}</Tag> },
            { title: "状态", dataIndex: "status", width: 120, render: (value: PlatformStatus) => renderStatusTag(value) },
            { title: "关键指标", dataIndex: "metric", width: 180 },
            { title: "更新时间", dataIndex: "updatedAt", width: 150 },
            {
              title: "操作",
              fixed: "right",
              width: 180,
              render: (_value, row) => (
                <Space size={4}>
                  <Button type="link" size="small" onClick={() => setSelectedRow(row)}>详情</Button>
                  <Button type="link" size="small" onClick={() => activeId === "field-mapping" && onSelect("mapping-review")}>审核</Button>
                  <Popconfirm title={`确认${row.status === "normal" ? "停用" : "重试"}该项？`} onConfirm={() => void message.success("操作已提交")}>
                    <Button type="link" size="small" danger={row.status === "normal"}>{row.status === "normal" ? "停用" : "重试"}</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
          scroll={{ x: 960 }}
        />
      </Card>
      <Drawer
        title={selectedRow?.name ?? "详情"}
        width={760}
        open={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        extra={<Button type="primary" onClick={() => void message.success("已提交处理动作")}>提交处理</Button>}
      >
        {selectedRow ? (
          <Tabs
            items={[
              {
                key: "basic",
                label: "基础信息",
                children: (
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="名称">{selectedRow.name}</Descriptions.Item>
                    <Descriptions.Item label="来源系统">{selectedRow.source}</Descriptions.Item>
                    <Descriptions.Item label="目标系统">{selectedRow.target}</Descriptions.Item>
                    <Descriptions.Item label="类型">{selectedRow.type}</Descriptions.Item>
                    <Descriptions.Item label="状态">{renderStatusTag(selectedRow.status)}</Descriptions.Item>
                    <Descriptions.Item label="关键指标">{selectedRow.metric}</Descriptions.Item>
                    <Descriptions.Item label="更新时间">{selectedRow.updatedAt}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: "runtime",
                label: "运行记录",
                children: (
                  <Timeline
                    items={[
                      { color: "green", children: `${selectedRow.updatedAt} 完成最近一次状态刷新` },
                      { color: selectedRow.status === "normal" ? "green" : "orange", children: `当前状态：${selectedRow.metric}` },
                      { color: "blue", children: "系统已保留最近 24 小时调用、同步与审计轨迹" }
                    ]}
                  />
                )
              },
              {
                key: "audit",
                label: "处理建议",
                children: (
                  <Alert
                    type={selectedRow.status === "normal" ? "success" : "warning"}
                    showIcon
                    message={selectedRow.status === "normal" ? "当前对象运行正常" : "建议进入详情确认异常原因"}
                    description={selectedRow.status === "normal" ? "如需调整配置，请先确认第三方系统调用窗口，避免影响正在进行的数据交换。" : "可先查看来源系统、目标系统与最近错误记录，再决定重试、停用或提交人工审核。"}
                  />
                )
              }
            ]}
          />
        ) : null}
      </Drawer>
    </section>
  );
}

function ExistingModulePage({
  activeId,
  children,
  fullHeight = false
}: {
  activeId: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  const active = navItems.find((item) => item.id === activeId) ?? navItems[0];
  const rows = platformPageRows[activeId] ?? [];
  const isDictionaryPage = activeId === "dictionaries";
  const isEmbeddedWorkbench = ["equipment-category", "equipment-standard-name", "device-classification"].includes(activeId) || masterDataGovernanceIds.has(activeId);
  const moduleActions: Record<string, Array<{ label: string; target?: string }>> = {
    "import-tasks": [
      { label: "上传压缩包" },
      { label: "查看导入记录" },
      { label: "预览导入结果" }
    ],
    "mapping-review": [
      { label: "查看待审核映射" },
      { label: "处理编码未映射" },
      { label: "查看审核记录" }
    ],
    "interface-logs": [
      { label: "查询接口日志" },
      { label: "查看调用详情" },
      { label: "复制脱敏证据" }
    ]
  };
  const actions = moduleActions[activeId] ?? [];
  const legacyTitle: Record<string, string> = {
    dictionaries: "字典维护工作区",
    "import-tasks": "批量导入工作区",
    "mapping-review": "映射审核工作区",
    "interface-logs": "接口日志工作区",
    "evidence-export": "证据导出工作区"
  };

  return (
    <section className={`existing-module-page ${fullHeight ? "existing-module-page-fullheight" : ""}`}>
      {!isEmbeddedWorkbench ? (
      <Card className="platform-page-head" variant="outlined">
        <div>
          <Tag color="blue">{groupLabel("zh", activeGroup(activeId))}</Tag>
          <h2>{active.label}</h2>
          <p>{active.description}</p>
        </div>
        <Space wrap>
          {isDictionaryPage ? (
            <Tag color="processing">维护工作区</Tag>
          ) : (
            <>
              <Tag color="success">已接入后端能力</Tag>
              <Tag>{APP_SHORT_NAME}</Tag>
            </>
          )}
        </Space>
      </Card>
      ) : null}
      {!isDictionaryPage && actions.length ? (
        <Row gutter={[16, 16]}>
          {actions.map((action) => (
            <Col xs={24} md={8} key={action.label}>
              <Card className="module-action-card" variant="outlined">
                <strong>{action.label}</strong>
                <span>{active.description}</span>
              </Card>
            </Col>
          ))}
        </Row>
      ) : null}
      {!isDictionaryPage && rows.length ? (
        <Card
          title={`${active.label}模块清单`}
          extra={
            <Space size={8} wrap>
              <Button size="small" icon={<SearchOutlined />}>查询</Button>
              <Button size="small" icon={<RefreshCw size={14} />}>刷新</Button>
            </Space>
          }
          variant="outlined"
        >
          <Table
            size="middle"
            rowKey="key"
            pagination={{ pageSize: 5, showSizeChanger: false }}
            dataSource={rows}
            columns={[
              { title: "名称", dataIndex: "name", fixed: "left", width: 220 },
              { title: "来源系统", dataIndex: "source", width: 180 },
              { title: "目标系统", dataIndex: "target", width: 180 },
              { title: "类型", dataIndex: "type", width: 140 },
              { title: "状态", dataIndex: "status", width: 120, render: (value: PlatformStatus) => renderStatusTag(value) },
              { title: "关键指标", dataIndex: "metric", width: 180 },
              { title: "更新时间", dataIndex: "updatedAt", width: 150 },
              {
                title: "操作",
                fixed: "right",
                width: 170,
                render: (_value, row) => (
                  <Space size={4}>
                    <Button type="link" size="small">详情</Button>
                    <Button type="link" size="small">维护</Button>
                    <Popconfirm title={`确认${row.status === "normal" ? "停用" : "重试"}该项？`} onConfirm={() => void message.success("操作已提交")}>
                      <Button type="link" size="small" danger={row.status === "normal"}>{row.status === "normal" ? "停用" : "重试"}</Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
            scroll={{ x: 1160 }}
          />
        </Card>
      ) : null}
      <section className={`legacy-workbench-shell${isEmbeddedWorkbench ? " legacy-workbench-shell-compact" : ""}`} aria-label={legacyTitle[activeId] ?? active.label}>
        {!isEmbeddedWorkbench ? (
        <div className="legacy-workbench-heading">
          <div>
            <strong>{legacyTitle[activeId] ?? "模块工作区"}</strong>
            <span>这里承载已接入的业务操作；如果内部组件异常，页面主体仍会保留。</span>
          </div>
          <Tag color="processing">业务操作区</Tag>
        </div>
        ) : null}
        <ContentErrorBoundary resetKey={`${activeId}-legacy`}>
          {children}
        </ContentErrorBoundary>
      </section>
    </section>
  );
}

function DashboardOverview({
  language,
  session,
  onSelect,
  health
}: {
  language: Language;
  session: UserSession | null;
  onSelect: (id: string) => void;
  health: ApiResult<HealthStatus> | null;
}) {
  const serviceOk = Boolean(health?.ok);
  const [lastRefresh, setLastRefresh] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setLastRefresh(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="dashboard-pro" aria-labelledby="overview-heading">
      <Card className="dashboard-summary-card" variant="outlined">
        <div className="dashboard-summary-heading">
          <div>
            <Tag color="blue">{APP_SHORT_NAME}</Tag>
            <h2 id="overview-heading">医院数据总线运行指挥台</h2>
            <p>集中监控 HIS、LIS、PACS、EMR、SPD、医保、设备平台之间的数据接入、字典映射、交换任务、接口调用和异常重试。</p>
          </div>
          <Space size={8} wrap>
            <Tag color={serviceOk ? "success" : "warning"} icon={serviceOk ? <CheckCircleOutlined /> : <WarningOutlined />}>
              {serviceOk ? text(language, "apiReachable") : text(language, "apiUnchecked")}
            </Tag>
            <Tag color="processing">{session ? roleLabels[language][session.role] : "-"}</Tag>
            <Tag color="default">最近刷新 {lastRefresh.toLocaleTimeString()}</Tag>
          </Space>
        </div>
      </Card>

      <SystemStatusBar lastRefresh={lastRefresh} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="今日交换量" value="128,642" suffix="条" status="normal" trend="较昨日 +8.7%" hint="最近 5 分钟 18,420 条" icon={<ApiOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="交换成功率" value="99.82" suffix="%" status="normal" trend="稳定" hint="最近 1 小时失败率 0.18%" icon={<CheckCircleOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="异常消息" value={17} suffix="条" status="delayed" trend="较昨日 +3" hint="编码未映射占 42%" icon={<WarningOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="队列积压" value={36} suffix="条" status="syncing" trend="下降 9.4%" hint="EMR 链路积压 21 条" icon={<CloudUploadOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="在线接口" value="42 / 45" status="delayed" trend="医保离线" hint="3 个接口处于维护窗口" icon={<DatabaseOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="平均延迟" value={126} suffix="ms" status="normal" trend="P95 384 ms" hint="EMR 延迟偏高" icon={<ToolOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="字典同步" value="成功" status="normal" trend="最近同步 13:58" hint="科室、耗材、医保码表已完成" icon={<SafetyCertificateOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard title="待审核映射" value={28} suffix="条" status="syncing" trend="新增 6 条" hint="SPD 耗材映射待确认" icon={<AuditOutlined />} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <DataFlowTopology />
        </Col>
        <Col xs={24} xl={10}>
          <ExchangeTrendChart />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <ExceptionRetryTable />
        </Col>
        <Col xs={24} xl={10}>
          <TodoAuditTable />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <OpsMonitorPanel />
        </Col>
        <Col xs={24} xl={10}>
          <Card title="快捷处理入口" extra={<Tag color="blue">不超过 3 次点击</Tag>} variant="outlined">
            <div className="bus-shortcuts">
              <Button block type="primary" icon={<MedicineBoxOutlined />} onClick={() => onSelect("materials-catalog")}>查看医保耗材数据</Button>
              <Button block icon={<CloudUploadOutlined />} onClick={() => onSelect("import-tasks")}>大文件上传</Button>
              <Button block onClick={() => onSelect("data-flow-monitor")}>查看数据流监控</Button>
              <Button block onClick={() => onSelect("queue-monitor")}>处理队列积压</Button>
              <Button block onClick={() => onSelect("mapping-review")}>审核待确认映射</Button>
              <Button block onClick={() => onSelect("interface-logs")}>追踪接口日志</Button>
            </div>
          </Card>
        </Col>
      </Row>
    </section>
  );
}

function activeIdFromPath(pathname: string): string {
  if (pathname === "/master-data/device-classification/export") {
    return "device-classification-export";
  }
  return "dashboard";
}

function pathForActiveId(activeId: string): string {
  if (activeId === "device-classification-export") {
    return "/master-data/device-classification/export";
  }
  return "/";
}

function App() {
  const [config, setConfig] = React.useState<AdminConfig>(() => loadConfig());
  const [draftConfig, setDraftConfig] = React.useState<AdminConfig>(config);
  const [session, setSession] = React.useState<UserSession | null>(() => loadSession());
  const [permissionMatrix, setPermissionMatrix] = React.useState<PermissionMatrix | null>(null);
  const [operatorDirectory, setOperatorDirectory] = React.useState<OperatorDirectory | null>(null);
  const [health, setHealth] = React.useState<ApiResult<HealthStatus> | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [heartbeatTime, setHeartbeatTime] = React.useState(() => new Date());
  const [activeId, setActiveId] = React.useState(() => activeIdFromPath(window.location.pathname));
  const [dictionaryKind, setDictionaryKind] = React.useState<DictionaryKind>("departments");
  const [navCollapsed, setNavCollapsed] = React.useState(false);

  const client = React.useMemo(
    () => new HudmpApiClient({ ...config, apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl) }, session),
    [config, session]
  );

  const recordApiActivity = React.useCallback((_label: string, _result: ApiResult<unknown>) => {}, []);

  React.useEffect(() => {
    const handleSessionReset = (event: Event) => {
      const message =
        event instanceof CustomEvent && typeof event.detail?.message === "string"
          ? event.detail.message
          : "登录已过期，请重新登录";
      clearSession();
      setSession(null);
      setPermissionMatrix(null);
      setOperatorDirectory(null);
      setActiveId("dashboard");
      window.history.replaceState(null, "", "/");
      setHealth({
        ok: false,
        httpStatus: 401,
        code: "SESSION_EXPIRED",
        message
      });
    };

    window.addEventListener("hudmp:session-reset", handleSessionReset);
    return () => window.removeEventListener("hudmp:session-reset", handleSessionReset);
  }, []);

  React.useEffect(() => {
    const handlePopState = () => {
      setActiveId(activeIdFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const checkHealth = React.useCallback(async () => {
    setChecking(true);
    const result = await client.health();
    setHealth(result);
    recordApiActivity("GET /health", result);
    setChecking(false);
  }, [client, recordApiActivity]);

  React.useEffect(() => {
    if (!session) {
      setHealth(null);
      return;
    }
    void checkHealth();
  }, [checkHealth, session]);

  React.useEffect(() => {
    const observer = applyStaticTranslations(document.body, config.language);
    return () => observer?.disconnect();
  }, [config.language, activeId, health]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setHeartbeatTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const persistConfig = () => {
    const normalized = { ...draftConfig, apiBaseUrl: normalizeBaseUrl(draftConfig.apiBaseUrl) };
    saveConfig(normalized);
    setConfig(normalized);
    setDraftConfig(normalized);
  };

  const language: Language = "zh";

  const handleLogin = async (usernameOrEmployeeId: string, password: string): Promise<string | null> => {
    const loginClient = new HudmpApiClient(config);
    const authResult = await loginClient.login(usernameOrEmployeeId, password);
    recordApiActivity("POST /api/v1/auth/login", authResult);
    if (!authResult.ok || !authResult.data) {
      return authResult.error ?? authResult.message;
    }
    const verifiedSession: UserSession = {
      username: authResult.data.operator_name,
      displayName: authResult.data.operator_display_name || authResult.data.operator_name,
      role: authResult.data.operator_role,
      signedInAt: new Date().toISOString(),
      sessionToken: authResult.data.session_token,
      sessionExpiresAt: authResult.data.session_expires_at,
      backendPermissions: authResult.data.permissions,
      authModel: authResult.data.auth_model
    };
    const candidateClient = new HudmpApiClient(config, verifiedSession);
    setPermissionMatrix(null);
    setOperatorDirectory(null);
    if (authResult.data.permissions.includes("permissions.manage")) {
      const [matrixResult, directoryResult] = await Promise.all([
        candidateClient.permissionMatrix(),
        candidateClient.operatorDirectory()
      ]);
      recordApiActivity("GET /api/v1/auth/permissions", matrixResult);
      recordApiActivity("GET /api/v1/auth/operators", directoryResult);
      if (matrixResult.ok && matrixResult.data) {
        setPermissionMatrix(matrixResult.data);
      }
      if (directoryResult.ok && directoryResult.data) {
        setOperatorDirectory(directoryResult.data);
      }
    }
    saveSession(verifiedSession);
    setSession(verifiedSession);
    setDictionaryKind("materials");
    const pathActiveId = activeIdFromPath(window.location.pathname);
    setActiveId(pathActiveId === "dashboard" ? "materials-catalog" : pathActiveId);
    return null;
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setPermissionMatrix(null);
    setOperatorDirectory(null);
    setActiveId("dashboard");
    window.history.replaceState(null, "", "/");
  };

  const selectNavigation = (id: string) => {
    const item = navItems.find((candidate) => candidate.id === id);
    if (!hasPermission(session, item?.permission)) {
      return;
    }
    if (id === "departments-master") {
      setDictionaryKind("departments");
    }
    if (id === "materials-catalog" || id === "material-specs") {
      setDictionaryKind("materials");
    }
    setActiveId(id);
    const nextPath = pathForActiveId(id);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  };

  const showMasterDataGovernance = masterDataGovernanceIds.has(activeId);
  const showDictionaryWorkbench = activeId === "dictionaries";
  const showImportTaskMonitor = activeId === "import-tasks";
  const showMappingReview = activeId === "mapping-review";
  const showExchangeLogs = activeId === "interface-logs";
  const showEvidenceExport = activeId === "evidence-export";
  const showManufacturerVendors = ["manufacturer-vendors", "vendor-aliases", "vendor-relations", "vendor-mapping", "vendor-candidates"].includes(activeId);
  const showEquipmentDictionary = ["equipment-category", "equipment-standard-name", "device-classification"].includes(activeId);
  const showDeviceClassificationExport = activeId === "device-classification-export";
  const equipmentView =
    activeId === "equipment-standard-name"
      ? "standard-names"
      : activeId === "device-classification"
        ? "device-classifications"
        : "categories";
  const showPermissions = activeId === "permissions";
  const showDashboard = activeId === "dashboard";
  const showServiceHealth = activeId === "service-health";
  const showPlatformModule = Boolean(platformPageRows[activeId]) || activeId === "data-flow-monitor";
  const activeNavItem = navItems.find((candidate) => candidate.id === activeId) ?? navItems[0];
  const pageTitle = text(language, activeNavItem.label);
  const breadcrumbGroup = groupLabel(language, activeGroup(activeId));
  const footerVersion = appEnv.VITE_UMDG_APP_VERSION || appEnv.VITE_HUDMP_APP_VERSION || APP_VERSION_LABEL;
  const footerServiceStatus = health?.ok && health.data?.status === "ok" ? "normal" : "error";
  const heartbeatLabel = heartbeatTime.toLocaleTimeString("zh-CN", { hour12: false });
  const userMenu: MenuProps = {
    items: [
      {
        key: "role",
        icon: <UserOutlined />,
        label: session ? `${session.displayName} / ${roleLabels[language][session.role]}` : text(language, "notReturned"),
        disabled: true
      },
      { type: "divider" },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: text(language, "signOut")
      }
    ],
    onClick: ({ key }) => {
      if (key === "logout") {
        handleLogout();
      }
    }
  };

  if (!session) {
    return (
      <main className="app-shell app-shell-login">
        <section className="login-shell" aria-labelledby="auth-login-heading">
          <AuthWorkbench
            config={config}
            language={language}
            session={session}
            backendMatrix={permissionMatrix}
            operatorDirectory={operatorDirectory}
            onLogin={handleLogin}
            onLogout={handleLogout}
            loginOnly
          />
        </section>
      </main>
    );
  }

  return (
    <Layout className={navCollapsed ? "app-shell app-shell-nav-hidden" : "app-shell"}>
      {navCollapsed ? null : (
        <NavigationRail
          activeId={activeId}
          onSelect={selectNavigation}
          language={language}
          session={session}
          onToggle={() => setNavCollapsed(true)}
        />
      )}
      <Layout className="app-main-layout">
        <Header className="app-header">
          <Space className="header-left" size={12}>
            <Button
              type="text"
              className="header-menu-button"
              icon={navCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              title={navCollapsed ? text(language, "showMenu") : text(language, "hideMenu")}
              onClick={() => setNavCollapsed((current) => !current)}
            />
            <div className="page-title-block">
              <Breadcrumb
                items={[
                  { title: text(language, "appTitle") },
                  { title: breadcrumbGroup },
                  { title: pageTitle }
                ]}
              />
              <h1>{pageTitle}</h1>
            </div>
          </Space>

          <Space className="header-actions" size={8} wrap>
            <Button type="text" icon={<SearchOutlined />} title="搜索" />
            <Badge dot>
              <Button type="text" icon={<BellOutlined />} title="通知" />
            </Badge>
            <Button type="text" icon={<QuestionCircleOutlined />} title="帮助" />
            <Tag color={health?.ok ? "success" : "warning"}>{health?.ok ? text(language, "apiReachable") : text(language, "apiUnchecked")}</Tag>
            <Tag color="blue">{APP_VERSION}</Tag>
            <Tag className="version-serial-tag">{APP_CHANGE_SERIAL}</Tag>
            <Dropdown menu={userMenu} trigger={["click"]}>
              <Button type="text" className="user-menu-button">
                <Space size={8}>
                  <Avatar size={28} icon={<UserOutlined />} />
                  <span>{session.displayName}</span>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-content">
          <ContentErrorBoundary resetKey={activeId}>
          <div className="workspace" key={activeId}>
            {showDashboard ? (
              <DashboardOverview language={language} session={session} onSelect={selectNavigation} health={health} />
            ) : showPermissions ? (
              <AuthWorkbench
                config={config}
                language={language}
                session={session}
                backendMatrix={permissionMatrix}
                operatorDirectory={operatorDirectory}
                onLogin={handleLogin}
                onLogout={handleLogout}
              />
            ) : showServiceHealth ? (
              <ConnectionPanel
                health={health}
                checking={checking}
                onRefresh={checkHealth}
                draft={draftConfig}
                saved={config}
                onDraftChange={setDraftConfig}
                onSave={persistConfig}
                language={language}
              />
            ) : !session ? (
              <section className="panel workflow-panel">
                <div className="notice-line">{text(language, "loginRequired")}</div>
              </section>
            ) : showMasterDataGovernance ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <MasterDataGovernanceWorkbench
                  activeId={activeId}
                  client={client}
                  session={session}
                  onApiActivity={recordApiActivity}
                />
              </ExistingModulePage>
            ) : showDictionaryWorkbench ? (
              <ExistingModulePage activeId={activeId}>
                <DictionaryWorkbench
                  client={client}
                  activeKind={dictionaryKind}
                  onActiveKindChange={setDictionaryKind}
                  onApiActivity={recordApiActivity}
                />
              </ExistingModulePage>
            ) : showManufacturerVendors ? (
              <ExistingModulePage activeId={activeId}>
                <ManufacturerVendorWorkbench client={client} onApiActivity={recordApiActivity} />
              </ExistingModulePage>
            ) : showDeviceClassificationExport ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <DeviceClassificationExportWorkbench
                  client={client}
                  session={session}
                  onBack={() => selectNavigation("device-classification")}
                  onApiActivity={recordApiActivity}
                />
              </ExistingModulePage>
            ) : showEquipmentDictionary ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <EquipmentDictionaryWorkbench
                  client={client}
                  activeView={equipmentView}
                  onApiActivity={recordApiActivity}
                  session={session}
                  onOpenDeviceExport={() => selectNavigation("device-classification-export")}
                />
              </ExistingModulePage>
            ) : showImportTaskMonitor ? (
              <ExistingModulePage activeId={activeId}>
                <ImportTaskMonitor client={client} onApiActivity={recordApiActivity} />
              </ExistingModulePage>
            ) : showMappingReview ? (
              <ExistingModulePage activeId={activeId}>
                <MappingReviewWorkbench client={client} onApiActivity={recordApiActivity} />
              </ExistingModulePage>
            ) : showExchangeLogs ? (
              <ExistingModulePage activeId={activeId}>
                <ExchangeLogWorkbench client={client} language={language} onApiActivity={recordApiActivity} />
              </ExistingModulePage>
            ) : showEvidenceExport ? (
              <ExistingModulePage activeId={activeId}>
                <EvidenceWorkbench config={config} language={language} session={session} />
              </ExistingModulePage>
            ) : showPlatformModule ? (
              <PlatformModulePage activeId={activeId} onSelect={selectNavigation} />
            ) : (
              <WorkflowPanel activeId={activeId} language={language} />
            )}
          </div>
          </ContentErrorBoundary>
        </Content>
        <GlobalFooterBar
          appName={APP_NAME_ZH}
          environment={displayFooterEnvironment(config.environmentName)}
          version={footerVersion}
          currentUser={session.displayName || session.username}
          serviceStatus={footerServiceStatus}
          databaseStatus="mock"
          redisStatus="mock"
          mqStatus="mock"
          schedulerStatus="mock"
          lastHeartbeatTime={heartbeatLabel}
          onOpenHealth={() => selectNavigation("service-health")}
        />
      </Layout>
    </Layout>
  );
}

const rootElement = document.getElementById("root") as HTMLElement;
const rootWindow = window as Window & { __hudmpRoot?: ReturnType<typeof ReactDOM.createRoot> };
const root = rootWindow.__hudmpRoot ?? ReactDOM.createRoot(rootElement);
rootWindow.__hudmpRoot = root;

root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          colorSuccess: "#52c41a",
          colorWarning: "#faad14",
          colorError: "#ff4d4f",
          colorInfo: "#1677ff",
          colorText: "#1f2937",
          colorTextSecondary: "#6b7280",
          colorBorder: "#e5e7eb",
          colorBgLayout: "#f0f2f5",
          borderRadius: 8
        },
        components: {
          Layout: {
            headerBg: "#ffffff",
            siderBg: "#001529",
            triggerBg: "#001529"
          },
          Card: {
            headerBg: "#ffffff"
          }
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
