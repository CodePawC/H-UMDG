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
  MinusSquareOutlined,
  PartitionOutlined,
  PlusSquareOutlined,
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
import { EquipmentBrandModelWorkbench } from "./components/EquipmentBrandModelWorkbench";
import { EquipmentRegistrationUdiWorkbench } from "./components/EquipmentRegistrationUdiWorkbench";
import { DeviceClassificationExportWorkbench } from "./components/DeviceClassificationExportWorkbench";
import { DeviceClassificationImportWorkbench } from "./components/DeviceClassificationImportWorkbench";
import { EvidenceWorkbench } from "./components/EvidenceWorkbench";
import { ExchangeLogWorkbench } from "./components/ExchangeLogWorkbench";
import { GlobalFooterBar } from "./components/GlobalFooterBar";
import { ImportTaskMonitor } from "./components/ImportTaskMonitor";
import { ManufacturerVendorWorkbench } from "./components/ManufacturerVendorWorkbench";
import {
  MasterDataPageLayout,
  MasterTable,
  MappingPanel,
  VersionDrawer,
  ImportDialog,
  ExportDialog,
  QualityCheckPanel
} from "./components/MasterDataPageLayout";
import type { MasterDataAction, MasterTableRecord } from "./components/MasterDataPageLayout";
import { MasterDataGovernanceWorkbench } from "./components/MasterDataGovernanceWorkbench";
import { MappingReviewWorkbench } from "./components/MappingReviewWorkbench";
import { OrganizationPeopleMasterWorkbench } from "./components/OrganizationPeopleMasterWorkbench";
import { SpaceLocationMasterWorkbench } from "./components/SpaceLocationMasterWorkbench";
import { clearSession, hasPermission, loadSession, saveSession } from "./lib/auth";
import { HudmpApiClient } from "./lib/api";
import { appBrowserTitle, appMeta } from "./config/appMeta";
import { APP_SHORT_NAME } from "./lib/appIdentity";
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
document.title = appBrowserTitle;

function copyAppVersionInfo(extra = "") {
  const content = `${appMeta.code} ${appMeta.chineseName} ${appMeta.version}${extra}`;
  navigator.clipboard.writeText(content)
    .then(() => message.success("版本号已复制"))
    .catch(() => message.error("复制失败，请手动复制"));
}

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
    id: "data-access-systems",
    label: "接入系统管理",
    description: "配置化登记外部系统及接入方式，系统名称由用户在页面中维护",
    status: "ready"
  },
  {
    id: "data-access-interfaces",
    label: "接口配置管理",
    description: "通过前端配置接口方向、请求方式、鉴权、参数、分页、超时、重试和版本",
    status: "ready"
  },
  {
    id: "data-access-field-mapping",
    label: "字段映射规则",
    description: "将接入系统字段映射为 H-UMDG 标准字段，支持默认值、转换规则和字典映射",
    status: "ready"
  },
  {
    id: "data-access-sync-tasks",
    label: "同步任务管理",
    description: "配置实时、定时、手动、增量、全量、重试、暂停、恢复和回滚任务",
    status: "ready"
  },
  {
    id: "data-access-logs",
    label: "接入日志监控",
    description: "监控接口调用、状态码、耗时、重试次数、失败原因、操作人和 traceId",
    status: "ready"
  },
  {
    id: "data-access-exceptions",
    label: "异常数据处理",
    description: "处理校验失败、映射失败、重复疑似和关联缺失数据，支持修复、重放和入库",
    status: "ready"
  },
  {
    id: "campus-master",
    label: "院区视图",
    description: "在空间位置管理内按院区维度查看主院区、分院区、医共体院区、社区院区、专科院区、行政办公区、后勤保障区等空间顶层信息",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "building-master",
    label: "楼宇视图",
    description: "在空间位置管理内按楼宇维度查看各院区下属楼宇、建筑、机房和保障用房等空间信息",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "floor-master",
    label: "楼层视图",
    description: "在空间位置管理内按楼层维度查看楼宇下属楼层，为房间、区域、设备位置和巡检路线提供基础",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "room-area-master",
    label: "房间视图",
    description: "在空间位置管理内按房间维度查看房间、诊室、病区、机房、设备间、治疗室、检查室等最小空间单元",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "department-space-mapping",
    label: "科室空间映射",
    description: "通过映射关系维护科室组织单元与院区、楼宇、楼层、房间空间单元的对应关系",
    status: "ready",
    permission: "departments.manage"
  },
  {
    id: "space-code-rules",
    label: "空间编码规则",
    description: "配置院区、楼宇、楼层、房间/区域编码和组合空间编码规则",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "organization-master",
    label: "组织机构主数据",
    description: "维护医院集团、医院主体、医共体成员机构、职能部门、临床医技科室、护理单元、病区、委员会和虚拟组织",
    status: "ready",
    permission: "departments.manage"
  },
  {
    id: "departments-master",
    label: "科室主数据",
    description: "作为组织机构主数据中的业务科室视图，统一临床、医技、行政、后勤等科室口径",
    status: "ready",
    permission: "departments.manage"
  },
  {
    id: "nursing-unit-master",
    label: "护理单元主数据",
    description: "维护护理单元与临床科室、病区和空间位置的关系，但不与科室或房间强行等同",
    status: "ready",
    permission: "departments.manage"
  },
  {
    id: "discipline-master",
    label: "学科主数据（可选）",
    description: "维护学科分类、专科方向和院内学科口径",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "staff-master",
    label: "人员主数据",
    description: "维护人员身份、人员编码和在岗状态，人员归属通过任职关系维护",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "staff-roles",
    label: "岗位角色主数据",
    description: "维护岗位角色、业务职责和权限范围，岗位角色通过人员任职或角色关系引用",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "person-employment",
    label: "任职关系管理",
    description: "维护人员与组织机构之间的任职、兼职、轮转、借调、进修、退休等关系",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "staff-licenses",
    label: "资质证照管理",
    description: "维护医护技等人员执业证照、放射工作人员资质和有效期",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "org-relations",
    label: "组织机构关系维护",
    description: "维护行政上下级以外的业务归口、护理服务、成本核算、医共体托管、质控归口等关系",
    status: "ready",
    permission: "departments.manage"
  },
  {
    id: "staff-departments",
    label: "所属科室",
    description: "维护人员与科室、院区、岗位的归属关系",
    status: "ready",
    permission: "departments.manage"
  },
  {
    id: "staff-mapping",
    label: "外部系统映射",
    description: "维护人员在接入系统、排班、统一身份等系统中的编码映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "manufacturer-vendors",
    label: "单位档案",
    description: "统一维护厂家、供应商、维保商、代理商等机构主体与业务角色",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-roles",
    label: "单位角色管理",
    description: "维护生产企业、注册人、供应商、配送企业、维保商等单位角色",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-qualifications",
    label: "单位资质",
    description: "维护往来单位经营许可、生产许可、授权书和服务资质",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-contacts",
    label: "单位联系人",
    description: "维护往来单位联系人、岗位、电话和业务联系范围",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-accounts",
    label: "单位账户",
    description: "维护结算账户、开票信息和财务往来属性",
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
    label: "单位关系",
    description: "维护母子公司、品牌归属、授权代理、授权维保和历史更名关系",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-mapping",
    label: "外部系统映射",
    description: "维护医保、接入系统、财务、供应商门户和装备平台单位编码映射",
    status: "ready",
    permission: "vendors.manage"
  },
  {
    id: "vendor-history",
    label: "变更历史",
    description: "查看往来单位档案、角色、资质、关系和映射变更留痕",
    status: "ready",
    permission: "exchange.view"
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
    label: "耗材品类",
    description: "统一维护耗材通用名称、规格型号、注册证信息、生产企业、配送企业、医保编码和 SPD 编码",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-common-name",
    label: "通用名称",
    description: "维护医用耗材通用名称、别名和标准命名口径",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-specs",
    label: "规格型号库",
    description: "维护耗材规格型号和厂商机构引用",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-registration",
    label: "注册证信息",
    description: "维护医用耗材注册证、备案凭证和有效期",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-manufacturer-link",
    label: "生产企业关联",
    description: "关联耗材生产企业、注册人和备案人往来单位主数据",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-distributor-link",
    label: "配送企业关联",
    description: "关联耗材配送企业、供应商和院内采购来源",
    status: "ready",
    permission: "materials.manage"
  },
  {
    id: "material-mapping",
    label: "医保编码映射",
    description: "维护耗材外部编码到标准主数据的映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "material-external-mapping",
    label: "外部系统映射",
    description: "维护耗材在接入系统、医保和财务系统中的编码映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "medical-equipment-master",
    label: "设备品类",
    description: "统一维护医学装备品类、通用名称、分类编码、品牌型号、注册证信息、生产企业关联及医保/收费/资产映射",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "equipment-category",
    label: "设备分类",
    description: "维护设备分类目录和装备平台引用口径",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "equipment-standard-name",
    label: "设备通用名称",
    description: "维护设备标准名称和常见生产厂家引用",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "equipment-brand-model",
    label: "品牌型号库",
    description: "维护医学装备品牌、型号、规格和通用名称关联",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "equipment-registration",
    label: "医疗器械注册证库",
    description: "维护医学装备注册证、备案凭证和适用范围",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "equipment-manufacturer-link",
    label: "生产企业关联",
    description: "关联医学装备生产企业、注册人和授权代理单位",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "equipment-finance-asset-mapping",
    label: "医保/收费/资产映射",
    description: "维护医学装备与医保、收费项目、资产系统的编码关系",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "equipment-external-mapping",
    label: "外部系统映射",
    description: "维护医学装备在接入系统、资产、维保和计量系统中的编码映射",
    status: "ready",
    permission: "mapping.review"
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
    id: "device-classification-import",
    label: "分类目录导入",
    description: "上传NMPA标准文件导入医疗器械分类目录",
    status: "ready",
    permission: "equipment.manage"
  },
  {
    id: "dictionaries",
    label: "标准字典总览",
    description: "维护医疗器械分类目录、设备状态、风险等级、计量类别、维修类型、采购类型和数据来源等标准字典",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "device-status-dict",
    label: "设备状态字典",
    description: "维护设备启用、停用、维修、待报废等状态字典",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "metrology-type-dict",
    label: "计量类别字典",
    description: "维护强检、非强检、校准、检测等计量类别",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "risk-level-dict",
    label: "风险等级字典",
    description: "维护设备和耗材风险等级、监管类别和使用风险口径",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "repair-type-dict",
    label: "维修类型字典",
    description: "维护保内维修、保外维修、巡检、保养等维修类型",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "data-source-dict",
    label: "数据来源字典",
    description: "维护接入系统、医保接口平台、资产平台等数据来源类型",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "insurance-code-mapping",
    label: "医保编码映射",
    description: "维护医保耗材码、收费项目和院内主数据之间的映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "his-mapping",
    label: "接入系统编码映射",
    description: "维护接入系统中科室、人员、耗材、设备和单位编码映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "hrp-mapping",
    label: "经营管理系统映射",
    description: "维护经营管理类系统中组织、资产、采购、单位和财务编码映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "spd-mapping",
    label: "供应链系统映射",
    description: "维护供应链类系统中耗材、单位和配送编码映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "finance-mapping",
    label: "财务系统映射",
    description: "维护财务会计、付款、开票和成本中心编码映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "asset-mapping",
    label: "资产系统映射",
    description: "维护资产系统设备、科室、地点和责任人编码映射",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "synonym-normalization",
    label: "同义词归一",
    description: "维护单位、耗材、设备、科室等名称同义词和归一规则",
    status: "ready",
    permission: "dictionaries.manage"
  },
  {
    id: "duplicate-detection",
    label: "重复数据识别",
    description: "识别并处理主数据候选重复、近似重复和疑似合并项",
    status: "ready",
    permission: "mapping.review"
  },
  {
    id: "field-mapping",
    label: "外部系统编码映射",
    description: "维护接入系统中的编码、名称和对应关系",
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
    id: "master-data-change-history",
    label: "主数据变更历史",
    description: "记录主数据新增、修改、合并、停用、启用、映射调整、角色变更、资质变更等全过程留痕",
    status: "ready",
    permission: "exchange.view"
  },
  {
    id: "his-ingest",
    label: "诊疗业务接入",
    description: "诊疗业务数据接入配置",
    status: "ready"
  },
  {
    id: "lis-ingest",
    label: "检验业务接入",
    description: "检验申请、结果和字典接入配置",
    status: "ready"
  },
  {
    id: "pacs-ingest",
    label: "影像业务接入",
    description: "检查、影像和报告接入配置",
    status: "ready"
  },
  {
    id: "emr-ingest",
    label: "病历业务接入",
    description: "病历、诊疗过程和质控数据接入配置",
    status: "ready"
  },
  {
    id: "spd-ingest",
    label: "供应链业务接入",
    description: "供应链、耗材库存和消耗数据接入配置",
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
  },
  {
    id: "about-system",
    label: "关于系统",
    description: "查看平台正式名称、版本、环境和服务状态",
    status: "ready"
  }
];

const masterDataGovernanceIds = new Set([
  "discipline-master",
  "staff-departments",
  "staff-mapping",
  "materials-catalog",
  "material-common-name",
  "material-specs",
  "material-registration",
  "material-manufacturer-link",
  "material-distributor-link",
  "material-mapping",
  "material-external-mapping",
  "nhsa-medical-consumable-classification",
  "hospital-material-catalog",
  "material-code-management",
  "material-enterprise-relations",
  "medical-equipment-master",
  "equipment-manufacturer-link",
  "equipment-finance-asset-mapping",
  "equipment-external-mapping",
  "device-status-dict",
  "metrology-type-dict",
  "risk-level-dict",
  "repair-type-dict",
  "data-source-dict",
  "insurance-code-mapping",
  "his-mapping",
  "hrp-mapping",
  "spd-mapping",
  "finance-mapping",
  "asset-mapping",
  "synonym-normalization",
  "duplicate-detection"
]);

const masterDataUsageIds = new Set([
  "space-master-usage",
  "org-people-master-usage",
  "vendor-master-usage",
  "equipment-master-usage",
  "material-master-usage",
  "terminology-master-usage",
  "dictionary-master-usage"
]);

const reservedMasterDataIds = new Set([
  "snomed-ct-reserved",
  "insurance-drug-catalog-reserved"
]);

const medicalTerminologyPageIds = new Set([
  "icd10-disease-codes",
  "icd9-cm3-procedure-codes",
  "drg-group-catalog",
  "dip-disease-catalog",
  "clinical-terminology"
]);

const standardDictionaryPageIds = new Set([
  "unit-dict",
  "risk-level-dict",
  "status-dict",
  "hospital-custom-dict"
]);

const templateMasterDataPageIds = new Set([
  "snomed-ct-reserved",
  "insurance-drug-catalog-reserved",
  "icd10-disease-codes",
  "icd9-cm3-procedure-codes",
  "drg-group-catalog",
  "dip-disease-catalog",
  "clinical-terminology",
  "unit-dict",
  "risk-level-dict",
  "status-dict",
  "hospital-custom-dict"
]);

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`status-pill ${ok ? "status-pill-ok" : "status-pill-warn"}`}>{label}</span>;
}

type NavigationGroup =
  | "workspace"
  | "dataAccess"
  | "space"
  | "orgPeople"
  | "vendors"
  | "equipment"
  | "materials"
  | "standards"
  | "governance"
  | "ingest"
  | "exchange"
  | "api"
  | "ops"
  | "system";

const masterDataMenuOverrides: Record<string, Partial<NavigationItem>> = {
  "space-location-management": {
    label: "空间位置管理",
    description: "单菜单承载院区、楼宇、楼层、房间空间树和多视图管理",
    permission: "dictionaries.manage"
  },
  "space-master-usage": {
    label: "主数据使用管理",
    description: "展示空间位置主数据的使用系统、数据订阅、API调用、同步状态、使用范围、版本状态和影响分析",
    permission: "dictionaries.manage"
  },
  "org-people-master-usage": {
    label: "主数据使用管理",
    description: "展示组织与人员主数据的使用系统、数据订阅、API调用、同步状态、使用范围、版本状态和影响分析",
    permission: "departments.manage"
  },
  "person-employment": {
    label: "任职关系管理",
    description: "维护人员与组织机构之间的任职、兼职、轮转、借调、进修、退休等关系",
    permission: "dictionaries.manage"
  },
  "staff-licenses": {
    label: "资质证照管理",
    description: "维护医护技等人员执业证照、放射工作人员资质和有效期",
    permission: "dictionaries.manage"
  },
  "vendor-master-usage": {
    label: "主数据使用管理",
    description: "展示往来单位主数据的使用系统、数据订阅、API调用、同步状态、使用范围、版本状态和影响分析",
    permission: "vendors.manage"
  },
  "vendor-roles": {
    label: "单位角色管理",
    description: "维护同一单位可同时具备的厂商、供应商、维保服务商、软件服务商等角色标签",
    permission: "vendors.manage"
  },
  "equipment-master-usage": {
    label: "主数据使用管理",
    description: "展示医学装备主数据的使用系统、数据订阅、API调用、同步状态、使用范围、版本状态和影响分析",
    permission: "equipment.manage"
  },
  "material-master-usage": {
    label: "主数据使用管理",
    description: "展示医用耗材主数据的使用系统、数据订阅、API调用、同步状态、使用范围、版本状态和影响分析",
    permission: "materials.manage"
  },
  "terminology-master-usage": {
    label: "主数据使用管理",
    description: "展示医疗标准编码与术语库的使用系统、数据订阅、API调用、同步状态、使用范围、版本状态和影响分析",
    permission: "dictionaries.manage"
  },
  "dictionary-master-usage": {
    label: "主数据使用管理",
    description: "展示标准字典中心的使用系统、数据订阅、API调用、同步状态、使用范围、版本状态和影响分析",
    permission: "dictionaries.manage"
  },
  "device-classification": {
    label: "国家医疗器械分类目录",
    description: "维护国家医疗器械分类目录，支持增量维护、版本管理、院内映射和更新记录"
  },
  "equipment-standard-name": {
    label: "医疗器械通用名称",
    description: "维护医疗器械通用名称、别名和标准命名口径"
  },
  "equipment-brand-model": {
    label: "品牌型号库",
    description: "维护医学装备品牌、型号、规格和通用名称关联",
    permission: "equipment.manage"
  },
  "equipment-registration": {
    label: "医疗器械注册证库",
    description: "维护医学装备注册证、备案凭证、注册人、品牌型号和有效期",
    permission: "equipment.manage"
  },
  "standard-equipment-library": {
    label: "标准设备库",
    description: "维护标准设备定义库，不管理业务实例资产台账",
    permission: "equipment.manage"
  },
  "equipment-udi-reserved": {
    label: "UDI数据库",
    description: "维护医疗器械唯一标识 UDI-DI，并关联注册证、品牌型号和通用名称",
    permission: "equipment.manage"
  },
  "nhsa-medical-consumable-classification": {
    label: "医保医用耗材分类与代码数据库",
    description: "维护医保医用耗材分类与代码数据库，支持增量维护、版本管理、院内映射和更新记录",
    permission: "materials.manage"
  },
  "hospital-material-catalog": {
    label: "医院耗材目录",
    description: "维护院内正式耗材目录并关联医保医用耗材分类与代码",
    permission: "materials.manage"
  },
  "material-specs": {
    label: "规格型号库",
    description: "维护医用耗材规格型号和厂商机构引用",
    permission: "materials.manage"
  },
  "material-code-management": {
    label: "耗材编码管理",
    description: "维护耗材标准编码、院内编码、医保编码和映射关系",
    permission: "materials.manage"
  },
  "material-enterprise-relations": {
    label: "企业关联关系",
    description: "维护耗材生产企业、注册人、备案人、配送企业和往来单位关联关系",
    permission: "materials.manage"
  },
  "icd10-disease-codes": {
    label: "ICD-10疾病分类编码",
    description: "维护 ICD-10 疾病分类编码标准库",
    permission: "dictionaries.manage"
  },
  "icd9-cm3-procedure-codes": {
    label: "ICD-9-CM3手术操作编码",
    description: "维护 ICD-9-CM3 手术操作编码标准库",
    permission: "dictionaries.manage"
  },
  "drg-group-catalog": {
    label: "DRG分组目录",
    description: "维护 DRG 分组目录",
    permission: "dictionaries.manage"
  },
  "dip-disease-catalog": {
    label: "DIP病种目录",
    description: "维护 DIP 病种目录",
    permission: "dictionaries.manage"
  },
  "clinical-terminology": {
    label: "国家临床术语库",
    description: "维护国家临床术语库",
    permission: "dictionaries.manage"
  },
  "snomed-ct-reserved": {
    label: "SNOMED CT术语体系（预留）",
    description: "预留 SNOMED CT 术语体系入口",
    permission: "dictionaries.manage"
  },
  "insurance-drug-catalog-reserved": {
    label: "医保药品目录（预留）",
    description: "预留医保药品目录入口",
    permission: "dictionaries.manage"
  },
  "unit-dict": {
    label: "计量单位字典",
    description: "维护计量单位字典",
    permission: "dictionaries.manage"
  },
  "status-dict": {
    label: "状态字典",
    description: "维护通用状态字典",
    permission: "dictionaries.manage"
  },
  "hospital-custom-dict": {
    label: "医院自定义字典",
    description: "维护医院自定义字典",
    permission: "dictionaries.manage"
  }
};

const masterDataNavItems: NavigationItem[] = Object.entries(masterDataMenuOverrides).map(([id, item]) => ({
  id,
  label: item.label || id,
  description: item.description || item.label || id,
  status: "ready",
  permission: item.permission
}));

const navigationItemById = new Map<string, NavigationItem>([
  ...navItems.map((item) => [item.id, item] as const),
  ...masterDataNavItems.map((item) => [item.id, item] as const)
]);

for (const [id, override] of Object.entries(masterDataMenuOverrides)) {
  const item = navigationItemById.get(id);
  if (item) {
    Object.assign(item, override);
  }
}

const allNavigationItems = Array.from(navigationItemById.values());

const dataAccessPageIds = new Set([
  "data-access-systems",
  "data-access-interfaces",
  "data-access-field-mapping",
  "data-access-sync-tasks",
  "data-access-logs",
  "data-access-exceptions"
]);

const spaceLocationPageIds = new Set([
  "space-location-management",
  "campus-master",
  "building-master",
  "floor-master",
  "room-area-master",
  "department-space-mapping"
]);

const organizationPeoplePageIds = new Set([
  "organization-master",
  "departments-master",
  "nursing-unit-master",
  "staff-master",
  "staff-roles",
  "person-employment",
  "staff-licenses",
  "org-relations"
]);

function groupLabel(language: Language, group: NavigationGroup): string {
  if (language === "zh") {
    return {
      workspace: "工作台",
      dataAccess: "数据接入中心",
      space: "空间位置主数据",
      orgPeople: "组织与人员主数据",
      vendors: "往来单位主数据",
      equipment: "医学装备主数据",
      materials: "医用耗材主数据",
      standards: "医疗标准编码与术语库",
      governance: "标准字典中心",
      ingest: "数据接入",
      exchange: "数据交换",
      api: "接口管理",
      ops: "运维监控",
      system: "系统管理"
    }[group];
  }
  return {
    workspace: "Workspace",
    dataAccess: "Data Access Center",
    space: "Space Location Master Data",
    orgPeople: "Organization & Personnel Master Data",
    vendors: "Business Partner Master Data",
    equipment: "Medical Equipment Master Data",
    materials: "Medical Consumables Master Data",
    standards: "Standards & Catalogs",
    governance: "Standard Dictionary Center",
    ingest: "Data Ingestion",
    exchange: "Data Exchange",
    api: "API Management",
    ops: "Operations",
    system: "System"
  }[group];
}

function activeGroup(activeId: string): NavigationGroup {
  if (dataAccessPageIds.has(activeId)) {
    return "dataAccess";
  }
  if (spaceLocationPageIds.has(activeId) || activeId === "space-location-management" || activeId === "space-master-usage") {
    return "space";
  }
  if (organizationPeoplePageIds.has(activeId)) {
    return "orgPeople";
  }
  if (activeId === "org-people-master-usage") {
    return "orgPeople";
  }
  if ([
    "manufacturer-vendors",
    "vendor-roles",
    "vendor-qualifications",
    "vendor-contacts",
    "vendor-accounts",
    "vendor-relations",
    "vendor-mapping",
    "vendor-history",
    "vendor-aliases",
    "vendor-candidates",
    "vendor-master-usage"
  ].includes(activeId)) {
    return "vendors";
  }
  if ([
    "medical-equipment-master",
    "equipment-category",
    "equipment-standard-name",
    "equipment-brand-model",
    "equipment-registration",
    "equipment-manufacturer-link",
    "equipment-finance-asset-mapping",
    "equipment-external-mapping",
    "equipment-udi-reserved",
    "standard-equipment-library",
    "equipment-master-usage"
  ].includes(activeId)) {
    return "equipment";
  }
  if ([
    "materials-catalog",
    "material-common-name",
    "material-specs",
    "material-registration",
    "material-manufacturer-link",
    "material-distributor-link",
    "material-mapping",
    "material-external-mapping",
    "nhsa-medical-consumable-classification",
    "hospital-material-catalog",
    "material-code-management",
    "material-enterprise-relations",
    "material-master-usage"
  ].includes(activeId)) {
    return "materials";
  }
  if ([
    "device-classification",
    "device-classification-export",
    "icd10-disease-codes",
    "icd9-cm3-procedure-codes",
    "drg-group-catalog",
    "dip-disease-catalog",
    "clinical-terminology",
    "snomed-ct-reserved",
    "insurance-drug-catalog-reserved",
    "terminology-master-usage"
  ].includes(activeId)) {
    return "standards";
  }
  if ([
    "dictionaries",
    "unit-dict",
    "risk-level-dict",
    "status-dict",
    "hospital-custom-dict",
    "dictionary-master-usage"
  ].includes(activeId)) {
    return "governance";
  }
  if (["his-ingest", "lis-ingest", "pacs-ingest", "emr-ingest", "spd-ingest", "import-tasks"].includes(activeId)) {
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
  if (["permissions", "role-permissions", "parameter-config", "audit-logs", "evidence-export", "about-system"].includes(activeId)) {
    return "system";
  }
  return "workspace";
}

const navIcons: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  "data-flow-monitor": <ApiOutlined />,
  "data-access-systems": <DatabaseOutlined />,
  "data-access-interfaces": <ApiOutlined />,
  "data-access-field-mapping": <AuditOutlined />,
  "data-access-sync-tasks": <CloudUploadOutlined />,
  "data-access-logs": <FileDoneOutlined />,
  "data-access-exceptions": <WarningOutlined />,
  dictionaries: <DatabaseOutlined />,
  "space-location-management": <DatabaseOutlined />,
  "space-master-usage": <ApiOutlined />,
  "campus-master": <DatabaseOutlined />,
  "building-master": <DatabaseOutlined />,
  "floor-master": <DatabaseOutlined />,
  "room-area-master": <DatabaseOutlined />,
  "department-space-mapping": <AuditOutlined />,
  "space-code-rules": <ToolOutlined />,
  "organization-master": <DatabaseOutlined />,
  "departments-master": <DatabaseOutlined />,
  "nursing-unit-master": <DatabaseOutlined />,
  "discipline-master": <DatabaseOutlined />,
  "staff-master": <UserOutlined />,
  "staff-roles": <UserOutlined />,
  "person-employment": <UserOutlined />,
  "staff-licenses": <SafetyCertificateOutlined />,
  "org-people-master-usage": <ApiOutlined />,
  "org-relations": <PartitionOutlined />,
  "staff-departments": <DatabaseOutlined />,
  "staff-mapping": <ApiOutlined />,
  "manufacturer-vendors": <DatabaseOutlined />,
  "vendor-roles": <UserOutlined />,
  "vendor-qualifications": <SafetyCertificateOutlined />,
  "vendor-contacts": <UserOutlined />,
  "vendor-accounts": <FileDoneOutlined />,
  "vendor-aliases": <FileDoneOutlined />,
  "vendor-relations": <AuditOutlined />,
  "vendor-mapping": <ApiOutlined />,
  "vendor-candidates": <AuditOutlined />,
  "vendor-history": <FileDoneOutlined />,
  "vendor-master-usage": <ApiOutlined />,
  "standard-equipment-library": <MedicineBoxOutlined />,
  "equipment-udi-reserved": <DatabaseOutlined />,
  "equipment-master-usage": <ApiOutlined />,
  "nhsa-medical-consumable-classification": <MedicineBoxOutlined />,
  "hospital-material-catalog": <MedicineBoxOutlined />,
  "material-code-management": <AuditOutlined />,
  "material-enterprise-relations": <DatabaseOutlined />,
  "material-master-usage": <ApiOutlined />,
  "icd10-disease-codes": <DatabaseOutlined />,
  "icd9-cm3-procedure-codes": <DatabaseOutlined />,
  "drg-group-catalog": <DatabaseOutlined />,
  "dip-disease-catalog": <DatabaseOutlined />,
  "clinical-terminology": <DatabaseOutlined />,
  "snomed-ct-reserved": <DatabaseOutlined />,
  "insurance-drug-catalog-reserved": <MedicineBoxOutlined />,
  "terminology-master-usage": <ApiOutlined />,
  "unit-dict": <DatabaseOutlined />,
  "status-dict": <DatabaseOutlined />,
  "hospital-custom-dict": <DatabaseOutlined />,
  "dictionary-master-usage": <ApiOutlined />,
  "materials-catalog": <MedicineBoxOutlined />,
  "material-common-name": <MedicineBoxOutlined />,
  "material-specs": <MedicineBoxOutlined />,
  "material-registration": <SafetyCertificateOutlined />,
  "material-manufacturer-link": <DatabaseOutlined />,
  "material-distributor-link": <DatabaseOutlined />,
  "material-mapping": <AuditOutlined />,
  "material-external-mapping": <ApiOutlined />,
  "medical-equipment-master": <MedicineBoxOutlined />,
  "equipment-category": <DatabaseOutlined />,
  "equipment-standard-name": <MedicineBoxOutlined />,
  "equipment-brand-model": <MedicineBoxOutlined />,
  "equipment-registration": <SafetyCertificateOutlined />,
  "equipment-manufacturer-link": <DatabaseOutlined />,
  "equipment-finance-asset-mapping": <AuditOutlined />,
  "equipment-external-mapping": <ApiOutlined />,
  "device-classification": <DatabaseOutlined />,
  "device-classification-export": <FileDoneOutlined />,
  "field-mapping": <AuditOutlined />,
  "coding-rules": <ToolOutlined />,
  "mapping-review": <AuditOutlined />,
  "master-data-change-history": <FileDoneOutlined />,
  "device-status-dict": <DatabaseOutlined />,
  "metrology-type-dict": <DatabaseOutlined />,
  "risk-level-dict": <WarningOutlined />,
  "repair-type-dict": <ToolOutlined />,
  "data-source-dict": <DatabaseOutlined />,
  "insurance-code-mapping": <AuditOutlined />,
  "his-mapping": <AuditOutlined />,
  "hrp-mapping": <AuditOutlined />,
  "spd-mapping": <AuditOutlined />,
  "finance-mapping": <AuditOutlined />,
  "asset-mapping": <AuditOutlined />,
  "synonym-normalization": <ToolOutlined />,
  "duplicate-detection": <WarningOutlined />,
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
  "audit-logs": <FileDoneOutlined />,
  "about-system": <QuestionCircleOutlined />
};

const navigationSections: Array<{ key: NavigationGroup; icon: React.ReactNode; itemIds: string[] }> = [
  { key: "workspace", icon: <DashboardOutlined />, itemIds: ["dashboard", "data-flow-monitor"] },
  {
    key: "dataAccess",
    icon: <CloudUploadOutlined />,
    itemIds: ["data-access-systems", "data-access-interfaces", "data-access-field-mapping", "data-access-sync-tasks", "data-access-logs", "data-access-exceptions"]
  },
  {
    key: "space",
    icon: <DatabaseOutlined />,
    itemIds: ["space-location-management", "department-space-mapping", "space-master-usage"]
  },
  {
    key: "orgPeople",
    icon: <UserOutlined />,
    itemIds: ["organization-master", "staff-master", "staff-roles", "person-employment", "staff-licenses", "org-people-master-usage"]
  },
  {
    key: "vendors",
    icon: <DatabaseOutlined />,
    itemIds: ["manufacturer-vendors", "vendor-roles", "vendor-master-usage"]
  },
  {
    key: "equipment",
    icon: <MedicineBoxOutlined />,
    itemIds: ["device-classification", "equipment-standard-name", "equipment-brand-model", "equipment-registration", "equipment-udi-reserved", "standard-equipment-library", "equipment-master-usage"]
  },
  {
    key: "materials",
    icon: <MedicineBoxOutlined />,
    itemIds: ["nhsa-medical-consumable-classification", "hospital-material-catalog", "material-specs", "material-code-management", "material-enterprise-relations", "material-master-usage"]
  },
  {
    key: "standards",
    icon: <DatabaseOutlined />,
    itemIds: ["icd10-disease-codes", "icd9-cm3-procedure-codes", "drg-group-catalog", "dip-disease-catalog", "clinical-terminology", "snomed-ct-reserved", "insurance-drug-catalog-reserved", "terminology-master-usage"]
  },
  {
    key: "governance",
    icon: <AuditOutlined />,
    itemIds: ["unit-dict", "risk-level-dict", "status-dict", "hospital-custom-dict", "dictionary-master-usage"]
  },
  { key: "ingest", icon: <CloudUploadOutlined />, itemIds: ["import-tasks"] },
  { key: "exchange", icon: <ApiOutlined />, itemIds: ["exchange-tasks", "data-routing", "queue-monitor", "retry-queue"] },
  { key: "api", icon: <ApiOutlined />, itemIds: ["api-services", "api-auth", "interface-logs", "call-stats"] },
  { key: "ops", icon: <WarningOutlined />, itemIds: ["service-health", "node-monitor", "error-logs", "alert-center"] },
  { key: "system", icon: <SettingOutlined />, itemIds: ["permissions", "role-permissions", "parameter-config", "audit-logs", "evidence-export", "about-system"] }
];

function buildNavigationItems(language: Language, session: UserSession | null): MenuProps["items"] {
  const item = (id: string, keyPrefix?: string) => {
    const navItem = navigationItemById.get(id);
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

  return [
    ...navigationSections.map((section) => ({
      key: section.key,
      icon: section.icon,
      label: groupLabel(language, section.key),
      children: section.itemIds.map((id) => item(id, section.key)).filter(Boolean)
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

function AboutSystemPanel({
  health,
  config
}: {
  health: ApiResult<HealthStatus> | null;
  config: AdminConfig;
}) {
  const apiOnline = health?.ok && health.data?.status === "ok";

  return (
    <section className="panel about-system-panel" aria-labelledby="about-system-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">About</p>
          <h2 id="about-system-heading">关于系统</h2>
        </div>
        <QuestionCircleOutlined />
      </div>
      <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
        <Descriptions.Item label="中文正式名称">{appMeta.chineseName}</Descriptions.Item>
        <Descriptions.Item label="英文名称">{appMeta.englishName}</Descriptions.Item>
        <Descriptions.Item label="系统简称">{appMeta.shortName}</Descriptions.Item>
        <Descriptions.Item label="当前版本">
          <Tooltip title="点击复制完整版本信息">
            <button type="button" className="version-copy-tag" onClick={() => copyAppVersionInfo()}>
              {appMeta.version}
            </button>
          </Tooltip>
        </Descriptions.Item>
        <Descriptions.Item label="显示版本">{appMeta.displayVersion}</Descriptions.Item>
        <Descriptions.Item label="部署环境">{displayFooterEnvironment(config.environmentName)}</Descriptions.Item>
        <Descriptions.Item label="API 状态">{apiOnline ? "API Online" : "API Unchecked"}</Descriptions.Item>
        <Descriptions.Item label="服务地址">{config.apiBaseUrl}</Descriptions.Item>
        <Descriptions.Item label="版权说明">内部开发版</Descriptions.Item>
        <Descriptions.Item label="历史名称说明">
          历史目录/旧项目名：H-UDMP，仅作为历史备注，不作为正式前端名称。
        </Descriptions.Item>
      </Descriptions>
      <Alert
        type="info"
        showIcon
        style={{ marginTop: 12 }}
        message="平台定位"
        description="H-UMDG 是全院统一主数据治理底座，可服务 H-MELC，也可服务其他业务系统。"
      />
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
  const allOpenKeys = React.useMemo(() => navigationSections.map((section) => section.key), []);
  const [openKeys, setOpenKeys] = React.useState<string[]>(allOpenKeys);
  const handleMenuClick: MenuProps["onClick"] = ({ key }) => onSelect(String(key).split(":").pop() || String(key));
  const selectedMenuKey = `${activeGroup(activeId)}:${activeId}`;

  return (
    <Sider className="app-sider" width={268} theme="light" collapsible={false}>
      <div className="sider-brand" title={appMeta.chineseName}>
        <strong className="sider-brand-title">{appMeta.chineseName}</strong>
        <span className="sider-brand-english">{appMeta.englishName}</span>
        <div className="sider-brand-meta">
          <span className="sider-brand-code">{appMeta.code}</span>
          <span className="sider-brand-version">{appMeta.version}</span>
        </div>
        <div className="sider-menu-tools" aria-label="菜单展开收起">
          <button type="button" onClick={() => setOpenKeys(allOpenKeys)} title="全部展开">
            <PlusSquareOutlined />
            <span>全部展开</span>
          </button>
          <button type="button" onClick={() => setOpenKeys([])} title="全部收起">
            <MinusSquareOutlined />
            <span>全部收起</span>
          </button>
        </div>
      </div>
      <Menu
        className="sider-menu"
        mode="inline"
        theme="light"
        selectedKeys={[selectedMenuKey]}
        openKeys={openKeys}
        onOpenChange={(keys) => setOpenKeys(keys)}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  );
}

function WorkflowPanel({ activeId, language }: { activeId: string; language: Language }) {
  const active = navigationItemById.get(activeId) ?? allNavigationItems[0];

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

type DataAccessRow = {
  key: string;
  name: string;
  system: string;
  object: string;
  method: string;
  status: PlatformStatus;
  metric: string;
  updatedAt: string;
};

type DataAccessConfig = {
  title: string;
  summary: string;
  primaryAction: string;
  objectName: string;
  metrics: Array<{ label: string; value: string | number; suffix?: string; tone?: "normal" | "warn" | "error" }>;
  configItems: Array<{ label: string; value: string }>;
  rows: DataAccessRow[];
  testItems: string[];
  logItems: Array<{ time: string; action: string; result: string; traceId: string; status: PlatformStatus }>;
  versionItems: Array<{ version: string; owner: string; note: string; active?: boolean }>;
};

const dataAccessConfigs: Record<string, DataAccessConfig> = {
  "data-access-systems": {
    title: "接入系统管理",
    summary: "登记外部系统基础信息、接入方式、鉴权方式、安全级别和启用状态，为后续接口、映射、校验与同步任务提供统一配置源。",
    primaryAction: "新增接入系统",
    objectName: "接入系统",
    metrics: [
      { label: "已登记系统", value: 9, suffix: "个" },
      { label: "启用中", value: 7, suffix: "个", tone: "normal" },
      { label: "待联调", value: 2, suffix: "个", tone: "warn" },
      { label: "配置版本", value: "v2026.05.30.001" }
    ],
    configItems: [
      { label: "系统名称", value: "由前端配置登记，如医院 HIS、HRP、SPD、OA、财务平台" },
      { label: "接入方式", value: "API / 数据库视图 / Excel / CSV / 文件夹监听 / 消息队列 / Webhook" },
      { label: "网络地址", value: "存入接入系统配置，不在业务代码中写死" },
      { label: "鉴权方式", value: "API Key / Token / Basic Auth / 签名密钥" },
      { label: "安全级别", value: "按院内网络分区、数据敏感级别和审计要求配置" },
      { label: "启用状态", value: "启用 / 停用，关键变更写入审计日志" }
    ],
    rows: [
      { key: "SYS-HIS", name: "医院 HIS 系统", system: "HIS", object: "科室、人员、就诊", method: "API", status: "normal", metric: "负责人已确认", updatedAt: "2026-05-30 09:20" },
      { key: "SYS-HRP", name: "医院 HRP 系统", system: "HRP", object: "供应商、资产、财务", method: "数据库视图", status: "syncing", metric: "等待字段核对", updatedAt: "2026-05-30 09:48" },
      { key: "SYS-SPD", name: "SPD 供应链平台", system: "SPD", object: "耗材目录、库存", method: "消息队列", status: "normal", metric: "安全级别 II", updatedAt: "2026-05-30 10:02" },
      { key: "SYS-OA", name: "OA 协同办公", system: "OA", object: "人员、组织", method: "API", status: "delayed", metric: "待确认鉴权", updatedAt: "2026-05-30 10:12" }
    ],
    testItems: ["连通性检测", "鉴权验证", "样例数据读取", "网络分区与安全级别检查"],
    logItems: [
      { time: "10:18:21", action: "保存 HIS 接入系统配置", result: "成功", traceId: "TRACE-SYS-2401", status: "normal" },
      { time: "10:10:34", action: "测试 OA Token 鉴权", result: "失败：Token 未配置", traceId: "TRACE-SYS-2398", status: "delayed" }
    ],
    versionItems: [
      { version: "v2026.05.30.001", owner: "信息科", note: "建立首批外部系统登记模型", active: true },
      { version: "v2026.05.29.003", owner: "实施顾问", note: "初始化 HIS/HRP/SPD 系统分类" }
    ]
  },
  "data-access-interfaces": {
    title: "接口配置管理",
    summary: "配置接口方向、请求方式、接口地址、鉴权、请求头、参数、响应格式、分页、超时、重试、同步频率和版本号。",
    primaryAction: "新增接口配置",
    objectName: "接口配置",
    metrics: [
      { label: "接口配置", value: 18, suffix: "个" },
      { label: "已启用", value: 12, suffix: "个", tone: "normal" },
      { label: "待测试", value: 4, suffix: "个", tone: "warn" },
      { label: "失败重试策略", value: "可配置" }
    ],
    configItems: [
      { label: "接口方向", value: "外部系统到 H-UMDG / H-UMDG 到外部系统 / H-UMDG 到 H-MELC" },
      { label: "请求配置", value: "GET / POST / PUT / DELETE，请求头、参数、响应格式均由配置表维护" },
      { label: "分页与超时", value: "按接口配置分页方式、超时时间、失败重试次数" },
      { label: "启用条件", value: "必须通过沙箱测试后才能正式启用" },
      { label: "版本号", value: "接口配置、字段映射、转换规则、校验规则绑定版本" }
    ],
    rows: [
      { key: "IF-HUMDG-MELC-DEPT", name: "H-UMDG 标准科室服务", system: "H-UMDG → H-MELC", object: "科室主数据", method: "GET / JSON", status: "normal", metric: appMeta.version, updatedAt: "2026-05-30 10:30" },
      { key: "IF-HUMDG-MELC-PERSON", name: "H-UMDG 标准人员服务", system: "H-UMDG → H-MELC", object: "人员主数据", method: "GET / JSON", status: "syncing", metric: "沙箱通过", updatedAt: "2026-05-30 10:24" },
      { key: "IF-HIS-DEPT", name: "HIS 科室接入接口", system: "HIS → H-UMDG", object: "科室主数据", method: "GET / JSON", status: "delayed", metric: "待补充分页", updatedAt: "2026-05-30 10:08" }
    ],
    testItems: ["模拟请求", "查看原始响应", "查看字段映射结果", "查看将要入库的数据"],
    logItems: [
      { time: "10:30:00", action: "H-UMDG → H-MELC 科室接口测试", result: "通过", traceId: "TRACE-IF-5201", status: "normal" },
      { time: "10:07:44", action: "HIS 科室接口分页检测", result: "失败：分页字段缺失", traceId: "TRACE-IF-5188", status: "delayed" }
    ],
    versionItems: [
      { version: "v2026.05.30.002", owner: "接口管理员", note: "新增 H-UMDG 到 H-MELC 主数据接口方向", active: true },
      { version: "v2026.05.29.006", owner: "信息科", note: "调整接口响应格式配置" }
    ]
  },
  "data-access-field-mapping": {
    title: "字段映射规则",
    summary: "将外部字段映射为 H-UMDG 标准字段，支持字段类型、必填、默认值、转换规则、字典映射、示例值和启用状态。",
    primaryAction: "新增字段映射",
    objectName: "字段映射",
    metrics: [
      { label: "映射规则", value: 64, suffix: "条" },
      { label: "已启用", value: 56, suffix: "条", tone: "normal" },
      { label: "待审核", value: 8, suffix: "条", tone: "warn" },
      { label: "标准对象", value: 6, suffix: "类" }
    ],
    configItems: [
      { label: "示例映射", value: "dept_id → sourceDeptCode，dept_name → departmentName，parent_id → parentSourceCode" },
      { label: "字段属性", value: "外部字段名、外部字段中文名、标准字段名、标准字段中文名、字段类型、是否必填" },
      { label: "转换关联", value: "可绑定数据转换规则和字典映射，不在代码中写转换逻辑" },
      { label: "启用状态", value: "每条映射可单独启用/停用，变更需记录版本" }
    ],
    rows: [
      { key: "MAP-HIS-DEPT-ID", name: "dept_id → sourceDeptCode", system: "HIS", object: "科室主数据", method: "字段映射", status: "normal", metric: "必填 / 字符串", updatedAt: "2026-05-30 10:26" },
      { key: "MAP-HIS-DEPT-NAME", name: "dept_name → departmentName", system: "HIS", object: "科室主数据", method: "字段映射", status: "normal", metric: "必填 / 名称标准化", updatedAt: "2026-05-30 10:26" },
      { key: "MAP-OA-USER", name: "user_code → staffCode", system: "OA", object: "人员主数据", method: "字段映射", status: "syncing", metric: "待绑定资质字段", updatedAt: "2026-05-30 10:18" }
    ],
    testItems: ["上传样例数据", "预览标准字段", "运行字典映射", "输出校验结果"],
    logItems: [
      { time: "10:26:19", action: "保存 HIS 科室字段映射版本", result: "成功", traceId: "TRACE-MAP-7301", status: "normal" },
      { time: "10:17:02", action: "测试 OA 人员字段映射", result: "提醒：缺少人员角色关系字段", traceId: "TRACE-MAP-7294", status: "syncing" }
    ],
    versionItems: [
      { version: "v2026.05.30.004", owner: "数据治理员", note: "明确 HIS 科室字段标准映射", active: true },
      { version: "v2026.05.28.009", owner: "实施顾问", note: "初始化人员字段映射草稿" }
    ]
  },
  "data-access-sync-tasks": {
    title: "同步任务管理",
    summary: "配置实时、定时、手动、增量、全量、失败自动重试、暂停、恢复、重新执行和回滚任务。",
    primaryAction: "新增同步任务",
    objectName: "同步任务",
    metrics: [
      { label: "同步任务", value: 11, suffix: "个" },
      { label: "正常", value: 8, suffix: "个", tone: "normal" },
      { label: "异常数据", value: 17, suffix: "条", tone: "warn" },
      { label: "最近同步", value: "2026-05-30 10:30" }
    ],
    configItems: [
      { label: "任务类型", value: "实时同步 / 定时同步 / 手动同步 / 增量同步 / 全量同步" },
      { label: "任务动作", value: "失败自动重试、暂停任务、恢复任务、重新执行、回滚任务" },
      { label: "任务指标", value: "最近执行时间、成功数量、失败数量、异常数量、当前状态、下次执行时间" },
      { label: "配置存储", value: "同步频率、目标对象、重试策略均应存入数据库配置表" }
    ],
    rows: [
      { key: "TASK-MELC-CAMPUS", name: "院区主数据同步到 H-MELC", system: "H-UMDG → H-MELC", object: "院区", method: "增量同步", status: "normal", metric: "成功 12 / 失败 0", updatedAt: "2026-05-30 10:30" },
      { key: "TASK-MELC-DEPT", name: "科室主数据同步到 H-MELC", system: "H-UMDG → H-MELC", object: "科室", method: "增量同步", status: "normal", metric: "成功 286 / 失败 0", updatedAt: "2026-05-30 10:30" },
      { key: "TASK-MELC-PERSON", name: "人员主数据同步到 H-MELC", system: "H-UMDG → H-MELC", object: "人员", method: "定时同步", status: "syncing", metric: "成功 1,842 / 异常 3", updatedAt: "2026-05-30 10:29" },
      { key: "TASK-HRP-BP", name: "HRP 供应商接入 H-UMDG", system: "HRP → H-UMDG", object: "往来单位", method: "全量同步", status: "delayed", metric: "异常 14", updatedAt: "2026-05-30 10:11" }
    ],
    testItems: ["任务预检", "模拟增量窗口", "试跑 10 条样例", "确认异常处理路由"],
    logItems: [
      { time: "10:30:00", action: "科室主数据同步到 H-MELC", result: "成功 286 条", traceId: "TRACE-TASK-8301", status: "normal" },
      { time: "10:11:52", action: "HRP 供应商全量同步", result: "异常 14 条进入处理池", traceId: "TRACE-TASK-8266", status: "delayed" }
    ],
    versionItems: [
      { version: "v2026.05.30.003", owner: "接口管理员", note: "新增 H-UMDG → H-MELC 首批主数据同步任务", active: true },
      { version: "v2026.05.29.010", owner: "数据治理员", note: "调整异常数据入池策略" }
    ]
  },
  "data-access-logs": {
    title: "接入日志监控",
    summary: "记录每次接口调用的调用时间、来源系统、接口名称、请求方向、参数、响应、状态码、耗时、失败原因、重试次数、操作人和 traceId。",
    primaryAction: "导出日志",
    objectName: "接入日志",
    metrics: [
      { label: "今日调用", value: "12,840", suffix: "次" },
      { label: "成功率", value: "99.82", suffix: "%", tone: "normal" },
      { label: "失败", value: 23, suffix: "次", tone: "warn" },
      { label: "平均耗时", value: 126, suffix: "ms" }
    ],
    configItems: [
      { label: "日志字段", value: "调用时间、来源系统、接口名称、方向、参数摘要、响应摘要、状态码、耗时、结果、traceId" },
      { label: "审计要求", value: "关键配置变更、启用/停用、重试、人工修复均记录操作人" },
      { label: "追溯能力", value: "日志可关联同步任务、异常数据池、接口版本和映射版本" }
    ],
    rows: [
      { key: "LOG-001", name: "GET 标准科室服务", system: "H-UMDG → H-MELC", object: "科室主数据", method: "200 / 86ms", status: "normal", metric: "TRACE-HM-9001", updatedAt: "2026-05-30 10:30" },
      { key: "LOG-002", name: "GET 标准人员服务", system: "H-UMDG → H-MELC", object: "人员主数据", method: "200 / 142ms", status: "normal", metric: "TRACE-HM-9002", updatedAt: "2026-05-30 10:29" },
      { key: "LOG-003", name: "HRP 供应商同步", system: "HRP → H-UMDG", object: "往来单位", method: "422 / 410ms", status: "delayed", metric: "资质类型未映射", updatedAt: "2026-05-30 10:11" }
    ],
    testItems: ["按 traceId 查询", "查看请求参数摘要", "查看响应结果摘要", "关联异常处理池"],
    logItems: [
      { time: "10:30:02", action: "H-MELC 拉取科室主数据", result: "200 OK", traceId: "TRACE-HM-9001", status: "normal" },
      { time: "10:11:53", action: "HRP 供应商同步", result: "422 字典映射失败", traceId: "TRACE-HRP-8831", status: "delayed" }
    ],
    versionItems: [
      { version: "v2026.05.30.001", owner: "运维值班", note: "启用 traceId 串联接口、任务和异常", active: true }
    ]
  },
  "data-access-exceptions": {
    title: "异常数据处理",
    summary: "校验失败、映射失败、重复疑似、关联缺失的数据进入处理池，支持查看原始数据、修复、合并、创建映射、忽略、重新校验和重新入库。",
    primaryAction: "批量处理",
    objectName: "异常数据",
    metrics: [
      { label: "待处理", value: 31, suffix: "条", tone: "warn" },
      { label: "可自动修复", value: 12, suffix: "条", tone: "normal" },
      { label: "需人工确认", value: 19, suffix: "条", tone: "warn" },
      { label: "今日重放成功", value: 46, suffix: "条" }
    ],
    configItems: [
      { label: "异常来源", value: "校验失败、映射失败、重复疑似、关联缺失、外部响应异常" },
      { label: "处理动作", value: "手动修复、合并重复、创建映射、忽略本条、重新校验、重新入库、批量处理" },
      { label: "推荐方案", value: "系统根据失败原因推荐字段修复、字典映射或关联主数据补全" },
      { label: "重放机制", value: "修复后可重新校验并重放入库，全程保留审计轨迹" }
    ],
    rows: [
      { key: "EX-HRP-BP-001", name: "供应商资质类型未映射", system: "HRP", object: "往来单位", method: "字典映射失败", status: "delayed", metric: "建议创建资质类型映射", updatedAt: "2026-05-30 10:11" },
      { key: "EX-OA-PER-002", name: "人员主科室缺失", system: "OA", object: "人员主数据", method: "关联缺失", status: "syncing", metric: "建议关联组织机构", updatedAt: "2026-05-30 10:07" },
      { key: "EX-HIS-DEPT-003", name: "疑似重复科室", system: "HIS", object: "科室主数据", method: "重复疑似", status: "delayed", metric: "建议合并重复数据", updatedAt: "2026-05-30 09:58" }
    ],
    testItems: ["查看原始数据", "查看标准化后数据", "查看失败原因", "重新校验并重放"],
    logItems: [
      { time: "10:12:20", action: "供应商资质异常进入处理池", result: "等待人工映射", traceId: "TRACE-EX-6101", status: "delayed" },
      { time: "09:59:14", action: "重复科室重新校验", result: "仍需人工确认", traceId: "TRACE-EX-6088", status: "syncing" }
    ],
    versionItems: [
      { version: "v2026.05.30.005", owner: "数据治理员", note: "新增异常处理池和重放闭环", active: true },
      { version: "v2026.05.29.002", owner: "实施顾问", note: "初始化异常分类" }
    ]
  }
};

function DataAccessCenterPage({ activeId }: { activeId: string }) {
  const config = dataAccessConfigs[activeId] ?? dataAccessConfigs["data-access-systems"];
  const [selectedRow, setSelectedRow] = React.useState<DataAccessRow | null>(null);
  const normalCount = config.rows.filter((row) => row.status === "normal").length;
  const attentionCount = config.rows.length - normalCount;

  return (
    <section className="data-access-page">
      <Card className="data-access-hero" variant="outlined">
        <div>
          <Tag color="blue">数据接入中心</Tag>
          <h2>{config.title}</h2>
          <p>{config.summary}</p>
        </div>
        <Space wrap>
          <Button onClick={() => void message.info("进入配置草稿，保存后生成新版本")}>保存草稿</Button>
          <Button icon={<ToolOutlined />} onClick={() => void message.success("沙箱测试已加入执行队列")}>沙箱测试</Button>
          <Button type="primary" onClick={() => void message.success("新增配置入口已打开")}>{config.primaryAction}</Button>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        className="data-access-principle"
        message="产品化接入原则"
        description="接口地址、字段映射、校验规则、转换规则、同步频率和重试策略均应保存为数据库配置。业务代码只读取配置并执行，不写死具体外部系统规则。"
      />

      <Row gutter={[16, 16]}>
        {config.metrics.map((item) => (
          <Col key={item.label} xs={24} sm={12} xl={6}>
            <Card className="module-stat-card" variant="outlined">
              <Statistic
                title={item.label}
                value={item.value}
                suffix={item.suffix}
                valueStyle={{ color: item.tone === "warn" ? "#faad14" : item.tone === "error" ? "#ff4d4f" : undefined }}
              />
              <span>{item.label === "最近同步" ? "用于 H-MELC 侧展示同步状态" : "来自配置中心与任务运行记录"}</span>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={14}>
          <Card title={`${config.objectName}列表`} extra={<Space><Button size="small">导出</Button><Button size="small">列设置</Button><Button size="small">刷新</Button></Space>} variant="outlined">
            <Form layout="inline" className="module-query-form data-access-query">
              <Form.Item label="关键字">
                <Input allowClear placeholder={`${config.objectName}名称 / 来源系统 / 数据对象`} prefix={<SearchOutlined />} />
              </Form.Item>
              <Form.Item label="启用状态">
                <Select
                  allowClear
                  placeholder="全部状态"
                  options={[
                    { value: "enabled", label: "启用" },
                    { value: "disabled", label: "停用" },
                    { value: "draft", label: "草稿" }
                  ]}
                  style={{ minWidth: 140 }}
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SearchOutlined />} onClick={() => void message.success("查询条件已应用")}>查询</Button>
              </Form.Item>
            </Form>
            <Table
              size="middle"
              rowKey="key"
              dataSource={config.rows}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: "名称", dataIndex: "name", width: 220, fixed: "left" },
                { title: "来源/方向", dataIndex: "system", width: 170 },
                { title: "数据对象", dataIndex: "object", width: 150 },
                { title: "接入方式", dataIndex: "method", width: 150, render: (value) => <Tag>{value}</Tag> },
                { title: "状态", dataIndex: "status", width: 120, render: (value: PlatformStatus) => renderStatusTag(value) },
                { title: "指标/说明", dataIndex: "metric", width: 210 },
                { title: "更新时间", dataIndex: "updatedAt", width: 170 },
                {
                  title: "操作",
                  fixed: "right",
                  width: 190,
                  render: (_value, row) => (
                    <Space size={4}>
                      <Button type="link" size="small" onClick={() => setSelectedRow(row)}>详情</Button>
                      <Button type="link" size="small" onClick={() => void message.success("已复制为新版本草稿")}>复制</Button>
                      <Popconfirm title="停用后不会继续执行自动同步，确认停用？" onConfirm={() => void message.success("停用操作已写入审计日志")}>
                        <Button type="link" size="small" danger>停用</Button>
                      </Popconfirm>
                    </Space>
                  )
                }
              ]}
              scroll={{ x: 1280 }}
              locale={{ emptyText: <Empty description="暂无配置，请新增配置后再启用" /> }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Tabs
            className="data-access-side-tabs"
            items={[
              {
                key: "config",
                label: "配置区",
                children: (
                  <Card variant="outlined">
                    <Descriptions column={1} size="small" bordered>
                      {config.configItems.map((item) => (
                        <Descriptions.Item key={item.label} label={item.label}>{item.value}</Descriptions.Item>
                      ))}
                    </Descriptions>
                  </Card>
                )
              },
              {
                key: "test",
                label: "测试区",
                children: (
                  <Card variant="outlined">
                    <Timeline items={config.testItems.map((item, index) => ({ color: index < 2 ? "green" : "blue", children: item }))} />
                    <Button block type="primary" onClick={() => void message.success("沙箱测试完成，待人工确认启用")}>运行沙箱测试</Button>
                  </Card>
                )
              },
              {
                key: "logs",
                label: "日志区",
                children: (
                  <Card variant="outlined">
                    <div className="data-access-log-list">
                      {config.logItems.map((item) => (
                        <div key={`${item.time}-${item.traceId}`}>
                          <span>{item.time}</span>
                          <strong>{item.action}</strong>
                          <em>{item.result}</em>
                          <Tag color={statusMeta[item.status].color}>{item.traceId}</Tag>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              },
              {
                key: "versions",
                label: "版本区",
                children: (
                  <Card variant="outlined">
                    <div className="data-access-version-list">
                      {config.versionItems.map((item) => (
                        <div key={item.version}>
                          <span>{item.version}</span>
                          <strong>{item.note}</strong>
                          <em>{item.owner}</em>
                          {item.active ? <Tag color="green">当前启用</Tag> : <Button size="small">回滚</Button>}
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              }
            ]}
          />
        </Col>
      </Row>

      <Card className="data-access-footer-card" variant="outlined">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <strong>运行摘要</strong>
            <span>正常 {normalCount} 项，需关注 {attentionCount} 项。失败数据进入异常池，不直接入库。</span>
          </Col>
          <Col xs={24} md={8}>
            <strong>审计要求</strong>
            <span>新增、启用、停用、重试、回滚、人工修复均记录操作人与 traceId。</span>
          </Col>
          <Col xs={24} md={8}>
            <strong>后续扩展</strong>
            <span>第二阶段将优先打通 H-UMDG → H-MELC 院区、科室、人员、供应商、厂家、设备分类。</span>
          </Col>
        </Row>
      </Card>

      <Drawer
        title={selectedRow?.name ?? "配置详情"}
        open={Boolean(selectedRow)}
        width={780}
        onClose={() => setSelectedRow(null)}
        extra={<Button type="primary" onClick={() => void message.success("配置变更已保存为新版本草稿")}>保存为新版本</Button>}
      >
        {selectedRow ? (
          <Tabs
            items={[
              {
                key: "basic",
                label: "基础信息",
                children: (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="名称">{selectedRow.name}</Descriptions.Item>
                    <Descriptions.Item label="来源/方向">{selectedRow.system}</Descriptions.Item>
                    <Descriptions.Item label="目标数据对象">{selectedRow.object}</Descriptions.Item>
                    <Descriptions.Item label="接入方式">{selectedRow.method}</Descriptions.Item>
                    <Descriptions.Item label="启用状态">{renderStatusTag(selectedRow.status)}</Descriptions.Item>
                    <Descriptions.Item label="关键指标">{selectedRow.metric}</Descriptions.Item>
                    <Descriptions.Item label="更新时间">{selectedRow.updatedAt}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: "sandbox",
                label: "测试结果",
                children: (
                  <Timeline
                    items={[
                      { color: "green", children: "模拟请求完成，已捕获原始响应摘要" },
                      { color: "green", children: "字段映射预览完成，未发现必填字段缺失" },
                      { color: selectedRow.status === "normal" ? "green" : "orange", children: selectedRow.status === "normal" ? "校验通过，可进入启用审批" : "发现需人工确认项，建议进入异常处理池" }
                    ]}
                  />
                )
              },
              {
                key: "audit",
                label: "审计与重放",
                children: (
                  <Alert
                    type={selectedRow.status === "normal" ? "success" : "warning"}
                    showIcon
                    message={selectedRow.status === "normal" ? "当前配置运行正常" : "当前配置存在待处理项"}
                    description="所有修复、重试、回滚和重新入库动作均应写入审计日志，并可通过 traceId 追溯。"
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
  const active = navigationItemById.get(activeId) ?? allNavigationItems[0];
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
  const active = navigationItemById.get(activeId) ?? allNavigationItems[0];
  const rows = platformPageRows[activeId] ?? [];
  const isDictionaryPage = activeId === "dictionaries";
  const isEmbeddedWorkbench =
    ["equipment-category", "equipment-standard-name", "device-classification"].includes(activeId) ||
    masterDataGovernanceIds.has(activeId) ||
    masterDataUsageIds.has(activeId) ||
    templateMasterDataPageIds.has(activeId) ||
    spaceLocationPageIds.has(activeId) ||
    organizationPeoplePageIds.has(activeId);
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

      {session?.systems && Object.keys(session.systems).length > 0 ? (
        <Card className="dashboard-summary-card" variant="outlined" style={{ marginBottom: 16 }}>
          <div className="dashboard-summary-heading" style={{ marginBottom: 12 }}>
            <div>
              <Tag color="blue">{APP_SHORT_NAME}</Tag>
              <h2 id="overview-heading" style={{ display: "inline", marginLeft: 8 }}>统一工作台</h2>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.entries(session.systems).map(([sysCode, sysInfo]) => {
              const sysDisplay: Record<string, { name: string; icon: string; color: string; desc: string }> = {
                "H-UMDG": { name: "主数据治理平台", icon: "🗄️", color: "#1677ff", desc: "主数据标准、编码、映射、治理" },
                "H-MELC": { name: "医学装备管理平台", icon: "🔧", color: "#52c41a", desc: "设备全生命周期闭环管理" },
              };
              const info = sysDisplay[sysCode] || { name: sysCode, icon: "🔗", color: "#8c8c8c", desc: "" };
              return (
                <Card key={sysCode} size="small" hoverable style={{ flex: "1 1 240px", borderLeft: `4px solid ${info.color}` }}
                  onClick={() => {
                    if (sysCode === "H-MELC") {
                      const melcUrl = localStorage.getItem("melc_portal_url") || "http://127.0.0.1:5102";
                      const w = window.open(melcUrl, "_blank");
                      if (w) {
                        setTimeout(() => w.postMessage({ type: "h-umdg-auth", token: session.accessToken || session.sessionToken }, "*"), 500);
                      }
                    }
                  }}>
                  <Card.Meta
                    avatar={<span style={{ fontSize: 28 }}>{info.icon}</span>}
                    title={<span style={{ fontSize: 16, fontWeight: 600 }}>{info.name}</span>}
                    description={<span style={{ fontSize: 12, color: "#666" }}>{info.desc}<br />角色：{sysInfo.roles.join("、")}</span>}
                  />
                </Card>
              );
            })}
          </div>
        </Card>
      ) : null}

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
  const strictRouteMap: Record<string, string> = {
    "/master-data/space/locations": "space-location-management",
    "/master-data/space/department-mapping": "department-space-mapping",
    "/master-data/space/usage": "space-master-usage",
    "/master-data/organization/organizations": "organization-master",
    "/master-data/organization/persons": "staff-master",
    "/master-data/organization/roles": "staff-roles",
    "/master-data/organization/employments": "person-employment",
    "/master-data/organization/licenses": "staff-licenses",
    "/master-data/organization/usage": "org-people-master-usage",
    "/master-data/business-partners/archives": "manufacturer-vendors",
    "/master-data/business-partners/roles": "vendor-roles",
    "/master-data/business-partners/usage": "vendor-master-usage",
    "/master-data/equipment/device-classifications": "device-classification",
    "/master-data/equipment/common-names": "equipment-standard-name",
    "/master-data/equipment/brand-models": "equipment-brand-model",
    "/master-data/equipment/registration-certificates": "equipment-registration",
    "/master-data/equipment/udi-reserved": "equipment-udi-reserved",
    "/master-data/equipment/standard-library": "standard-equipment-library",
    "/master-data/equipment/usage": "equipment-master-usage",
    "/master-data/materials/nhsa-classification-codes": "nhsa-medical-consumable-classification",
    "/master-data/materials/hospital-catalog": "hospital-material-catalog",
    "/master-data/materials/spec-models": "material-specs",
    "/master-data/materials/code-management": "material-code-management",
    "/master-data/materials/enterprise-relations": "material-enterprise-relations",
    "/master-data/materials/usage": "material-master-usage",
    "/master-data/terminology/icd-10": "icd10-disease-codes",
    "/master-data/terminology/icd-9-cm3": "icd9-cm3-procedure-codes",
    "/master-data/terminology/drg": "drg-group-catalog",
    "/master-data/terminology/dip": "dip-disease-catalog",
    "/master-data/terminology/national-clinical": "clinical-terminology",
    "/master-data/terminology/snomed-ct-reserved": "snomed-ct-reserved",
    "/master-data/terminology/insurance-drug-reserved": "insurance-drug-catalog-reserved",
    "/master-data/terminology/usage": "terminology-master-usage",
    "/master-data/dictionaries/units": "unit-dict",
    "/master-data/dictionaries/risk-levels": "risk-level-dict",
    "/master-data/dictionaries/statuses": "status-dict",
    "/master-data/dictionaries/hospital-custom": "hospital-custom-dict",
    "/master-data/dictionaries/usage": "dictionary-master-usage"
  };
  if (strictRouteMap[pathname]) {
    return strictRouteMap[pathname];
  }
  if (pathname === "/master-data/space/code-rules") {
    return "campus-master";
  }
  const legacyOrganizationPathMap: Record<string, string> = {
    "/master-data/organization": "organization-master",
    "/master-data/organization/departments": "departments-master",
    "/master-data/organization/nursing-units": "nursing-unit-master",
    "/master-data/personnel": "staff-master",
    "/master-data/personnel/roles": "staff-roles",
    "/master-data/personnel/employment": "person-employment",
    "/master-data/personnel/licenses": "staff-licenses",
    "/master-data/organization/relations": "org-relations"
  };
  if (legacyOrganizationPathMap[pathname]) {
    return legacyOrganizationPathMap[pathname];
  }
  return "dashboard";
}

const governanceActionLabels = [
  "映射",
  "数据校验",
  "重复识别",
  "版本历史",
  "异常候选",
  "来源分析",
  "修订管理",
  "同步状态",
  "影响分析"
];

function MoreGovernanceActions() {
  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: governanceActionLabels.map((label) => ({ key: label, label })),
        onClick: ({ key }) => message.info(`${key}请在当前主数据详情、映射、校验或版本治理中继续处理`)
      }}
    >
      <Button>更多操作</Button>
    </Dropdown>
  );
}

function buildTemplateRows(activeId: string): MasterTableRecord[] {
  const item = navigationItemById.get(activeId);
  const label = item?.label || "主数据对象";
  return [
    {
      key: `${activeId}-001`,
      code: `${activeId.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-001`,
      name: `${label}样例一`,
      category: groupLabel("zh", activeGroup(activeId)),
      source: activeId.includes("reserved") ? "预留标准源" : "标准库",
      status: activeId.includes("reserved") ? "预留" : "启用",
      version: appMeta.version,
      updatedAt: "2026-06-01 09:00"
    },
    {
      key: `${activeId}-002`,
      code: `${activeId.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-002`,
      name: `${label}样例二`,
      category: groupLabel("zh", activeGroup(activeId)),
      source: "院内映射",
      status: "启用",
      version: appMeta.version,
      updatedAt: "2026-06-01 09:12"
    }
  ];
}

function TemplateMasterDataPage({ activeId }: { activeId: string }) {
  const item = navigationItemById.get(activeId);
  const domain = groupLabel("zh", activeGroup(activeId));
  const [keyword, setKeyword] = React.useState("");
  const [selectedTreeKey, setSelectedTreeKey] = React.useState<React.Key | null>("all");
  const [selected, setSelected] = React.useState<MasterTableRecord | null>(null);
  const [drawerMode, setDrawerMode] = React.useState<MasterDataAction | "detail">("detail");
  const rows = React.useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return buildTemplateRows(activeId).filter((row) => {
      const treeMatched = selectedTreeKey === "all" || row.status === selectedTreeKey || row.source === selectedTreeKey;
      const textMatched = !needle || `${row.code} ${row.name} ${row.category} ${row.source}`.toLowerCase().includes(needle);
      return treeMatched && textMatched;
    });
  }, [activeId, keyword, selectedTreeKey]);
  const openDrawer = (mode: MasterDataAction | "detail", row?: MasterTableRecord) => {
    setDrawerMode(mode);
    setSelected(row || rows[0] || null);
  };
  const actionTitle: Record<MasterDataAction | "detail", string> = {
    detail: "主数据详情",
    mapping: "映射",
    quality: "数据校验",
    duplicate: "重复识别",
    version: "版本历史",
    exception: "异常候选",
    source: "来源分析",
    revision: "修订管理",
    sync: "同步状态",
    impact: "影响分析"
  };
  const objectName = item?.label || "主数据对象";
  const detailContent =
    drawerMode === "mapping" ? <MappingPanel objectName={objectName} /> :
    drawerMode === "version" ? <VersionDrawer objectName={objectName} /> :
    drawerMode === "quality" || drawerMode === "duplicate" || drawerMode === "exception" ? <QualityCheckPanel objectName={objectName} /> :
    drawerMode === "source" || drawerMode === "sync" || drawerMode === "impact" || drawerMode === "revision" ? <VersionDrawer objectName={objectName} /> :
    selected ? (
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="编码">{selected.code}</Descriptions.Item>
        <Descriptions.Item label="名称">{selected.name}</Descriptions.Item>
        <Descriptions.Item label="分类">{selected.category}</Descriptions.Item>
        <Descriptions.Item label="来源">{selected.source}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag>{selected.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="版本">{selected.version}</Descriptions.Item>
      </Descriptions>
    ) : null;
  return (
    <MasterDataPageLayout
      title={objectName}
      description={item?.description || "主数据对象页面"}
      domain={domain}
      treeTitle="对象分类"
      treeData={[
        { key: "all", title: "全部数据" },
        { key: "启用", title: "启用数据" },
        { key: "标准库", title: "标准库来源" },
        { key: "院内映射", title: "院内映射" }
      ]}
      selectedTreeKey={selectedTreeKey}
      onSelectTree={setSelectedTreeKey}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onAdd={() => message.success(`${objectName}新增草稿已创建`)}
      onImport={() => openDrawer("revision")}
      onExport={() => message.success(`${objectName}导出任务已创建`)}
      onRefresh={() => message.success(`${objectName}已刷新`)}
      onAction={(action) => openDrawer(action)}
      detailTitle={`${objectName} - ${actionTitle[drawerMode]}`}
      detailOpen={Boolean(selected)}
      onCloseDetail={() => setSelected(null)}
      detailContent={detailContent}
      statusBar={(
        <Space wrap>
          <Tag color="blue">看见数据</Tag>
          <Tag color="cyan">理解数据</Tag>
          <Tag color="green">治理数据</Tag>
          <span>当前记录数：{rows.length}</span>
          <span>当前版本：{appMeta.version}</span>
        </Space>
      )}
    >
      <MasterTable rows={rows} selectedKey={selected?.key} onSelect={(row) => openDrawer("detail", row)} />
    </MasterDataPageLayout>
  );
}

function MasterDataUsageManagementPage({ activeId }: { activeId: string }) {
  const item = navigationItemById.get(activeId);
  const domain = groupLabel("zh", activeGroup(activeId));
  const [keyword, setKeyword] = React.useState("");
  const [selectedTreeKey, setSelectedTreeKey] = React.useState<React.Key | null>("all");
  const [selected, setSelected] = React.useState<MasterTableRecord | null>(null);
  const rows = [
    { key: "usage-1", system: "接入系统A", subscription: "主数据订阅", api: "API实时", scope: `${domain}读接口`, sync: "正常", version: "当前版本", impact: "低" },
    { key: "usage-2", system: "接入系统B", subscription: "批量同步", api: "定时同步", scope: `${domain}全量快照`, sync: "同步中", version: "待升级", impact: "中" },
    { key: "usage-3", system: "接入系统C", subscription: "事件通知", api: "Webhook", scope: `${domain}变更事件`, sync: "正常", version: "当前版本", impact: "低" }
  ];
  const filteredRows = rows.filter((row) => {
    const treeMatched = selectedTreeKey === "all" || row.sync === selectedTreeKey || row.impact === selectedTreeKey;
    const textMatched = !keyword.trim() || `${row.system} ${row.subscription} ${row.scope}`.toLowerCase().includes(keyword.trim().toLowerCase());
    return treeMatched && textMatched;
  });
  return (
    <MasterDataPageLayout
      title={item?.label || "主数据使用管理"}
      description="系统名称由接入系统管理动态配置；此处只展示主数据被哪些配置化接入方消费、订阅、同步和影响。"
      domain={domain}
      treeTitle="使用状态"
      treeData={[
        { key: "all", title: "全部使用方" },
        { key: "正常", title: "同步正常" },
        { key: "同步中", title: "同步中" },
        { key: "中", title: "中影响" }
      ]}
      selectedTreeKey={selectedTreeKey}
      onSelectTree={setSelectedTreeKey}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onAdd={() => message.success("使用方订阅草稿已创建")}
      onImport={() => message.success("使用关系导入入口已打开")}
      onExport={() => message.success("使用关系导出任务已创建")}
      onRefresh={() => message.success("主数据使用状态已刷新")}
      onAction={(action) => message.info(`${action}请在主数据使用详情、同步状态或影响分析中继续处理`)}
      detailTitle={selected?.name || "使用详情"}
      detailOpen={Boolean(selected)}
      onCloseDetail={() => setSelected(null)}
      detailContent={selected ? (
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="使用系统">{selected.name}</Descriptions.Item>
          <Descriptions.Item label="使用范围">{selected.category}</Descriptions.Item>
          <Descriptions.Item label="同步状态"><Tag>{selected.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="版本状态">{selected.version}</Descriptions.Item>
        </Descriptions>
      ) : null}
      statusBar={<Space wrap><Tag color="blue">使用系统</Tag><Tag color="green">API调用</Tag><Tag color="cyan">影响分析</Tag><span>当前记录数：{filteredRows.length}</span></Space>}
    >
      <Table
        size="small"
        sticky
        rowKey="key"
        dataSource={filteredRows}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100, 200, 500, 1000, 2000],
          showQuickJumper: true,
          position: ["bottomLeft"],
          align: "end",
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`
        }}
        scroll={{ x: 1120, y: 520 }}
        columns={[
          { title: "使用系统", dataIndex: "system", render: (value: string) => <strong>{value}</strong> },
          { title: "数据订阅", dataIndex: "subscription" },
          { title: "API调用", dataIndex: "api" },
          { title: "同步状态", dataIndex: "sync", render: (value: string) => <Tag color={value === "正常" ? "success" : "processing"}>{value}</Tag> },
          { title: "使用范围", dataIndex: "scope" },
          { title: "版本状态", dataIndex: "version" },
          { title: "影响分析", dataIndex: "impact", render: (value: string) => <Tag color={value === "低" ? "green" : "orange"}>{value}</Tag> },
          { title: "操作", key: "action", render: (_value, row) => <Button type="link" size="small" onClick={() => setSelected({ key: row.key, code: row.key, name: row.system, category: row.scope, source: row.subscription, status: row.sync, version: row.version, updatedAt: "2026-06-01" })}>详情</Button> }
        ]}
      />
    </MasterDataPageLayout>
  );
}

function ReservedMasterDataPage({ activeId }: { activeId: string }) {
  return <TemplateMasterDataPage activeId={activeId} />;
}

function TerminologyStandardPage({ activeId }: { activeId: string }) {
  return <TemplateMasterDataPage activeId={activeId} />;
}

function StandardDictionaryPage({ activeId }: { activeId: string }) {
  return <TemplateMasterDataPage activeId={activeId} />;
}

function pathForActiveId(activeId: string): string {
  if (activeId === "device-classification-export") {
    return "/master-data/device-classification/export";
  }
  const strictPathMap: Record<string, string> = {
    "space-location-management": "/master-data/space/locations",
    "department-space-mapping": "/master-data/space/department-mapping",
    "space-master-usage": "/master-data/space/usage",
    "organization-master": "/master-data/organization/organizations",
    "staff-master": "/master-data/organization/persons",
    "staff-roles": "/master-data/organization/roles",
    "person-employment": "/master-data/organization/employments",
    "staff-licenses": "/master-data/organization/licenses",
    "org-people-master-usage": "/master-data/organization/usage",
    "manufacturer-vendors": "/master-data/business-partners/archives",
    "vendor-roles": "/master-data/business-partners/roles",
    "vendor-master-usage": "/master-data/business-partners/usage",
    "device-classification": "/master-data/equipment/device-classifications",
    "equipment-standard-name": "/master-data/equipment/common-names",
    "equipment-brand-model": "/master-data/equipment/brand-models",
    "equipment-registration": "/master-data/equipment/registration-certificates",
    "equipment-udi-reserved": "/master-data/equipment/udi-reserved",
    "standard-equipment-library": "/master-data/equipment/standard-library",
    "equipment-master-usage": "/master-data/equipment/usage",
    "nhsa-medical-consumable-classification": "/master-data/materials/nhsa-classification-codes",
    "hospital-material-catalog": "/master-data/materials/hospital-catalog",
    "material-specs": "/master-data/materials/spec-models",
    "material-code-management": "/master-data/materials/code-management",
    "material-enterprise-relations": "/master-data/materials/enterprise-relations",
    "material-master-usage": "/master-data/materials/usage",
    "icd10-disease-codes": "/master-data/terminology/icd-10",
    "icd9-cm3-procedure-codes": "/master-data/terminology/icd-9-cm3",
    "drg-group-catalog": "/master-data/terminology/drg",
    "dip-disease-catalog": "/master-data/terminology/dip",
    "clinical-terminology": "/master-data/terminology/national-clinical",
    "snomed-ct-reserved": "/master-data/terminology/snomed-ct-reserved",
    "insurance-drug-catalog-reserved": "/master-data/terminology/insurance-drug-reserved",
    "terminology-master-usage": "/master-data/terminology/usage",
    "unit-dict": "/master-data/dictionaries/units",
    "risk-level-dict": "/master-data/dictionaries/risk-levels",
    "status-dict": "/master-data/dictionaries/statuses",
    "hospital-custom-dict": "/master-data/dictionaries/hospital-custom",
    "dictionary-master-usage": "/master-data/dictionaries/usage"
  };
  if (strictPathMap[activeId]) {
    return strictPathMap[activeId];
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
      authModel: authResult.data.auth_model,
      personId: authResult.data.person_id,
      personName: authResult.data.person_name,
      departmentName: authResult.data.department_name,
      position: authResult.data.position,
      systems: authResult.data.systems,
      accessToken: authResult.data.access_token,
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
    const item = navigationItemById.get(id);
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

  const showMasterDataGovernance = masterDataGovernanceIds.has(activeId) && activeId !== "nhsa-medical-consumable-classification";
  const showMasterDataUsage = masterDataUsageIds.has(activeId);
  const showTemplateMasterData = templateMasterDataPageIds.has(activeId);
  const showDictionaryWorkbench = activeId === "dictionaries";
  const showProtectedMaterialWorkbench = activeId === "nhsa-medical-consumable-classification";
  const showImportTaskMonitor = activeId === "import-tasks";
  const showMappingReview = activeId === "mapping-review";
  const showExchangeLogs = activeId === "interface-logs";
  const showEvidenceExport = activeId === "evidence-export";
  const showAboutSystem = activeId === "about-system";
  const showDataAccessCenter = dataAccessPageIds.has(activeId);
  const showSpaceLocationMaster = spaceLocationPageIds.has(activeId);
  const showOrganizationPeopleMaster = organizationPeoplePageIds.has(activeId);
  const showManufacturerVendors = [
    "manufacturer-vendors",
    "vendor-roles",
    "vendor-qualifications",
    "vendor-contacts",
    "vendor-accounts",
    "vendor-relations",
    "vendor-mapping",
    "vendor-history",
    "vendor-aliases",
    "vendor-candidates"
  ].includes(activeId);
  const showEquipmentRegistrationUdi = ["equipment-registration", "equipment-udi-reserved"].includes(activeId);
  const showEquipmentBrandModel = ["equipment-brand-model", "standard-equipment-library"].includes(activeId);
  const showEquipmentDictionary = ["equipment-category", "equipment-standard-name", "device-classification"].includes(activeId);
  const showDeviceClassificationExport = activeId === "device-classification-export";
  const showDeviceClassificationImport = activeId === "device-classification-import";
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
  const activeNavItem = navigationItemById.get(activeId) ?? allNavigationItems[0];
  const pageTitle = text(language, activeNavItem.label);
  const breadcrumbGroup = groupLabel(language, activeGroup(activeId));
  const userMenu: MenuProps = {
    items: [
      {
        key: "role",
        icon: <UserOutlined />,
        label: session ? `${session.displayName} / ${roleLabels[language][session.role]}` : text(language, "notReturned"),
        disabled: true
      },
      ...(session?.departmentName ? [{
        key: "dept",
        icon: <DatabaseOutlined />,
        label: `${session.departmentName}${session.position ? " · " + session.position : ""}`,
        disabled: true
      }] : []),
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
            ) : showSpaceLocationMaster ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <SpaceLocationMasterWorkbench activeId={activeId} client={client} />
              </ExistingModulePage>
            ) : showOrganizationPeopleMaster ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <OrganizationPeopleMasterWorkbench activeId={activeId} client={client} />
              </ExistingModulePage>
            ) : showMasterDataGovernance ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <MasterDataGovernanceWorkbench
                  activeId={activeId}
                  client={client}
                  session={session}
                  onApiActivity={recordApiActivity}
                />
              </ExistingModulePage>
            ) : showProtectedMaterialWorkbench ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <DictionaryWorkbench
                  client={client}
                  activeKind="materials"
                  onActiveKindChange={setDictionaryKind}
                  onApiActivity={recordApiActivity}
                />
              </ExistingModulePage>
            ) : showMasterDataUsage ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <MasterDataUsageManagementPage activeId={activeId} />
              </ExistingModulePage>
            ) : showTemplateMasterData ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <TemplateMasterDataPage activeId={activeId} />
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
            ) : showDeviceClassificationImport ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <DeviceClassificationImportWorkbench client={client} />
              </ExistingModulePage>
            ) : showEquipmentRegistrationUdi ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <EquipmentRegistrationUdiWorkbench
                  client={client}
                  activeView={activeId === "equipment-udi-reserved" ? "udi" : "registration"}
                  onApiActivity={recordApiActivity}
                  session={session}
                />
              </ExistingModulePage>
            ) : showEquipmentBrandModel ? (
              <ExistingModulePage activeId={activeId} fullHeight>
                <EquipmentBrandModelWorkbench
                  client={client}
                  activeView={activeId === "standard-equipment-library" ? "standard-equipment" : "brand-model"}
                  onApiActivity={recordApiActivity}
                  session={session}
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
            ) : showAboutSystem ? (
              <AboutSystemPanel health={health} config={config} />
            ) : showDataAccessCenter ? (
              <DataAccessCenterPage activeId={activeId} />
            ) : showPlatformModule ? (
              <PlatformModulePage activeId={activeId} onSelect={selectNavigation} />
            ) : (
              <WorkflowPanel activeId={activeId} language={language} />
            )}
          </div>
          </ContentErrorBoundary>
        </Content>
        <GlobalFooterBar
          environment={displayFooterEnvironment(config.environmentName)}
          serviceStatus={health?.ok ? "normal" : "mock"}
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
            siderBg: "#f8fafc",
            triggerBg: "#f8fafc"
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
