import React from "react";
import { Alert, Badge, Button, Checkbox, Descriptions, Drawer, Dropdown, Empty, Form, Input, Modal, Popover, Select, Space, Steps, Table, Tabs, Tag, Tooltip, Tree, Upload, message } from "antd";
import type { DataNode } from "antd/es/tree";
import type { ColumnsType } from "antd/es/table";
import { ChevronDown, Download, FileUp, RefreshCw, Search } from "lucide-react";
import { HudmpApiClient } from "../lib/api";
import type {
  ApiResult,
  DeviceClassification,
  DeviceClassificationGovernanceDetail,
  DeviceClassificationImportPreview,
  CatalogCorrectionOrder,
  EquipmentCategory,
  EquipmentSourceFile,
  EquipmentSourceFileList,
  EquipmentStandardName,
  DeviceImportHistoryDetail,
  DeviceImportHistoryRecord,
  DeviceClassificationPayload,
  ImportReport,
  PagedResult,
  TreeDataResult,
  UserSession
} from "../types";

type Props = {
  client: HudmpApiClient;
  activeView?: "categories" | "standard-names" | "device-classifications";
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
  session?: UserSession | null;
  onOpenDeviceExport?: () => void;
};

type SourceArchiveVolume = {
  volume_id: string;
  volume_name: string;
  category: string;
  domain: string;
  source_unit: string;
  status: string;
  files: EquipmentSourceFile[];
  batches: DeviceImportHistoryRecord[];
  supported_count: number;
  abnormal_count: number;
  updated_at?: string | null;
};

function revisionLabel(changeType?: string | null): string {
  if (changeType === "ADDED") {
    return "新增";
  }
  if (changeType === "MODIFIED") {
    return "修订";
  }
  if (changeType === "DELETED") {
    return "删除";
  }
  return "变更";
}

function revisionColor(changeType?: string | null): string {
  if (changeType === "ADDED") {
    return "success";
  }
  if (changeType === "MODIFIED") {
    return "warning";
  }
  if (changeType === "DELETED") {
    return "error";
  }
  return "processing";
}

function governanceTag(label: string, color: "green" | "yellow" | "orange" | "red" | "gray" | "blue") {
  const colorMap = {
    green: "success",
    yellow: "warning",
    orange: "orange",
    red: "error",
    gray: "default",
    blue: "processing"
  } as const;
  return <Tag color={colorMap[color]}>{label}</Tag>;
}

const DEVICE_STATUS_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "effective", label: "有效" },
  { value: "pending_confirm", label: "待确认" },
  { value: "parse_abnormal", label: "解析异常" },
  { value: "corrected", label: "已纠错" },
  { value: "deprecated", label: "已作废" },
  { value: "merged", label: "已合并" },
  { value: "rollbacked", label: "已回滚" }
];

function deviceStatusTag(row?: Pick<DeviceClassification, "data_status" | "data_status_label"> | null) {
  const status = row?.data_status || "effective";
  const label = row?.data_status_label || DEVICE_STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
  if (status === "parse_abnormal") return governanceTag(label, "orange");
  if (status === "deprecated" || status === "rollbacked") return governanceTag(label, "gray");
  if (status === "merged") return governanceTag(label, "blue");
  if (status === "pending_confirm") return governanceTag(label, "yellow");
  if (status === "corrected") return governanceTag(label, "green");
  return governanceTag(label, "green");
}

function archiveCategoryForSource(sourceType?: string | null): { category: string; domain: string; treeKey: string } {
  if (sourceType === "DEVICE_CLASSIFICATION_CATALOG") {
    return { category: "国家标准目录类", domain: "医疗器械分类目录", treeKey: "standard-device" };
  }
  if (sourceType === "NHSA_FULL_SPEC" || sourceType === "NHSA_DISABLED" || sourceType === "NHSA_TRANSCODE") {
    return { category: "国家标准目录类", domain: "医保耗材目录", treeKey: "standard-nhsa" };
  }
  if (sourceType === "EQUIPMENT_CATEGORY") {
    return { category: "院内主数据类", domain: "设备主数据", treeKey: "hospital-equipment" };
  }
  if (sourceType === "EQUIPMENT_STANDARD_NAME") {
    return { category: "院内主数据类", domain: "设备主数据", treeKey: "hospital-equipment" };
  }
  if (sourceType === "MVP_TEMPLATE") {
    return { category: "院内主数据类", domain: "耗材主数据", treeKey: "hospital-material" };
  }
  return { category: "其他佐证材料", domain: "其他", treeKey: "other" };
}

function archiveStatusTag(status?: string | null) {
  const value = status || "已归档";
  const color = value === "归档异常" ? "error" : value === "已作废" || value === "已替换" ? "default" : value === "已复核" || value === "已引用" ? "processing" : "success";
  return <Tag color={color}>{value}</Tag>;
}

function deviceCode(row: DeviceClassification): string {
  const parts = [row.major_category_no, row.level_1_category_no, row.level_2_category_no].filter(Boolean);
  return parts.length ? parts.join("-") : row.category_no || "-";
}

function truncateText(value?: string | null, max = 74): string {
  const text = value || "-";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function diffBounds(beforeRaw?: string | null, afterRaw?: string | null): { prefix: number; beforeEnd: number; afterEnd: number } | null {
  const before = beforeRaw || "";
  const after = afterRaw || "";
  if (!before || !after || before === after) {
    return null;
  }
  let prefix = 0;
  const minLength = Math.min(before.length, after.length);
  while (prefix < minLength && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let beforeTail = before.length - 1;
  let afterTail = after.length - 1;
  while (beforeTail >= prefix && afterTail >= prefix && before[beforeTail] === after[afterTail]) {
    beforeTail -= 1;
    afterTail -= 1;
  }
  return { prefix, beforeEnd: beforeTail + 1, afterEnd: afterTail + 1 };
}

function renderDiffText(beforeRaw?: string | null, afterRaw?: string | null, mode: "before" | "after" = "after") {
  const before = beforeRaw || "-";
  const after = afterRaw || "-";
  const bounds = diffBounds(beforeRaw, afterRaw);
  const current = mode === "before" ? before : after;
  if (!bounds) {
    return <span>{truncateText(current, 140)}</span>;
  }
  const start = bounds.prefix;
  const end = mode === "before" ? bounds.beforeEnd : bounds.afterEnd;
  const head = current.slice(0, start);
  const changed = current.slice(start, end);
  const tail = current.slice(end);
  return (
    <span>
      {head}
      {changed ? <mark className={`device-diff-mark ${mode === "before" ? "is-before" : "is-after"}`}>{changed}</mark> : null}
      {tail}
    </span>
  );
}

function renderLatestWithChangeMark(beforeRaw?: string | null, afterRaw?: string | null, enabled = false) {
  const after = afterRaw || "-";
  if (!enabled) {
    return <span>{truncateText(after, 140)}</span>;
  }
  const bounds = diffBounds(beforeRaw, afterRaw);
  if (!bounds) {
    return <span>{truncateText(after, 140)}</span>;
  }
  const head = after.slice(0, bounds.prefix);
  const changed = after.slice(bounds.prefix, bounds.afterEnd);
  const tail = after.slice(bounds.afterEnd);
  return (
    <span>
      {head}
      {changed ? <mark className="device-diff-mark is-after">{changed}</mark> : null}
      {tail}
    </span>
  );
}

function payloadValue(payload: DeviceClassificationPayload | undefined, key: keyof DeviceClassificationPayload): string {
  const value = payload?.[key];
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function latestFieldValue(row: DeviceClassification, key: keyof DeviceClassificationPayload): string {
  const direct = row[key] as unknown as string | null | undefined;
  return (direct || "") as string;
}

function DeviceHistoryRow({ row }: { row: DeviceClassification }) {
  const revision = row.latest_revision;
  if (!revision) {
    return null;
  }
  const oldPayload = revision.old_payload || {};
  return (
    <div className="device-tree-history-row">
      <div className="device-tree-history-head">
        <Tag color={revisionColor(revision.change_type)}>{revisionLabel(revision.change_type)}</Tag>
        <span>{revision.batch_id}</span>
        <span>{revision.reason || revision.source_file_name}</span>
      </div>
      <dl>
        <div><dt>原产品描述</dt><dd>{payloadValue(oldPayload, "product_description")}</dd></div>
        <div><dt>原预期用途</dt><dd>{payloadValue(oldPayload, "intended_use")}</dd></div>
        <div><dt>原品名举例</dt><dd>{payloadValue(oldPayload, "product_examples")}</dd></div>
        <div><dt>原管理类别</dt><dd>{payloadValue(oldPayload, "management_class")}</dd></div>
      </dl>
    </div>
  );
}

const sourceTypeOptions = [
  { value: "EQUIPMENT_CATEGORY", label: "设备分类目录" },
  { value: "EQUIPMENT_STANDARD_NAME", label: "设备标准名称" },
  { value: "DEVICE_CLASSIFICATION_CATALOG", label: "医疗器械分类目录" }
];

const nmpaStandard = {
  source: "国家药监局《医疗器械分类目录》",
  fullSource: "国家药监局《医疗器械分类目录》（2017年第104号）",
  announcement: "2017年第104号",
  indexNo: "GGTG-2017-11286",
  publishDate: "2017-09-04",
  effectiveDate: "2018-08-01",
  status: "现行有效",
  url: "https://www.nmpa.gov.cn/xxgk/ggtg/qtggtg/20170904150301406.html"
};

const DEVICE_TREE_WIDTH_DEFAULT = 240;
const DEVICE_TREE_WIDTH_MIN = 230;
const DEVICE_TREE_WIDTH_MAX = 620;
const DEVICE_SEARCH_DEBOUNCE_MS = 300;

const deviceSearchPresets = [
  "超声手术设备",
  "有源手术器械",
  "Ⅲ类",
  "待确认",
  "冲突",
  "软组织超声手术系统"
];
const DEVICE_SEARCH_HISTORY_KEY = "hmdm_device_search_history";
const DEVICE_HEADER_VALUES = ["产品描述", "预期用途", "管理类别", "品名举例", "序号", "一级产品类别", "二级产品类别", "子目录"];
const DEVICE_REVISION_NOTE_MARKERS = ["目录调整", "修订", "原产品描述", "原预期用途", "原管理类别"];
const deviceImportFileTypeOptions = ["国家目录", "院内映射表", "历史字典", "医保目录", "SPD字典", "其他"].map((value) => ({ value, label: value }));
const deviceImportSourceOptions = ["国家药监局", "医保平台", "院内整理", "SPD系统", "HIS系统", "其他"].map((value) => ({ value, label: value }));
const deviceAuthorityLevelOptions = ["国家级", "行业级", "院内正式", "临时参考"].map((value) => ({ value, label: value }));
const deviceImportModes = [
  {
    value: "初始化导入",
    scene: "首次建立国家分类目录基准库",
    risk: "仅建议系统首次使用；已有数据时默认禁用"
  },
  {
    value: "增量更新",
    scene: "国家后续发布新增、修改、废止、类别调整",
    risk: "不删除原库，生成变更记录和新版本"
  },
  {
    value: "版本重建",
    scene: "国家发布完整新版目录或重建独立版本",
    risk: "历史版本保留，可追溯、可对比、可回滚"
  },
  {
    value: "覆盖修正",
    scene: "修正同一版本内解析或录入错误",
    risk: "需高级管理员；保留修正前记录和审计日志"
  },
  {
    value: "仅解析不入库",
    scene: "测试文件、验证解析规则或人工预审",
    risk: "不写入正式目录库，仅生成预览和核验报告"
  }
];
const deviceImportModeHelpRows = [
  ["第一次建立分类目录", "初始化导入"],
  ["国家发布条目新增", "增量更新"],
  ["国家发布描述修改", "增量更新"],
  ["国家发布预期用途调整", "增量更新"],
  ["国家发布管理类别调整", "增量更新"],
  ["国家发布完整新版目录", "版本重建"],
  ["修正上次解析错误", "覆盖修正"],
  ["只是测试文件", "仅解析不入库"]
];
const deviceImportRiskTips: Record<string, string> = {
  "初始化导入": "本次导入将建立医疗器械分类目录基准库，后续耗材、设备、医保编码映射将基于该版本进行。",
  "增量更新": "本次导入将根据国家后续发布内容对现有目录进行增量更新，不会删除原目录库。系统将生成变更记录和新版本。",
  "版本重建": "本次操作将基于完整文件生成新的目录版本，历史版本将保留。请确认该文件为完整目录文件。",
  "覆盖修正": "本次操作将修正当前版本内已有数据，系统将保留修正前记录并写入审计日志。请谨慎操作。",
  "仅解析不入库": "本次操作不会写入正式库，仅生成解析预览和核验报告。"
};


function normalizeSearch(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function deviceSearchCorpus(row: DeviceClassification): string {
  return [
    row.catalog_id,
    row.category_no,
    deviceCode(row),
    row.major_category_no,
    row.major_category_name,
    row.level_1_category_no,
    row.level_1_category,
    row.level_2_category_no,
    row.level_2_category,
    row.product_description,
    row.intended_use,
    row.product_examples,
    row.management_class,
    row.source_file_name
  ].filter(Boolean).join(" ").toLowerCase();
}

function detectInvalidReasons(row: DeviceClassification): string[] {
  const reasons: string[] = [];
  const name = (row.level_2_category || "").trim();
  const values = [
    name,
    row.product_description || "",
    row.intended_use || "",
    row.product_examples || "",
  ];
  if (row.data_status === "pending_confirm" || row.data_status === "parse_abnormal") {
    reasons.push(row.data_status_label || "状态需人工确认");
  }
  if (!name) {
    reasons.push("目录名称为空");
  }
  if (name.startsWith("-") || name.startsWith("－") || name.startsWith("—")) {
    reasons.push("目录名称以异常连接符开头");
  }
  if (DEVICE_HEADER_VALUES.includes(name)) {
    reasons.push("目录名称疑似字段表头");
  }
  [
    [row.product_description, "产品描述"],
    [row.intended_use, "预期用途"],
    [row.product_examples, "品名举例"]
  ].forEach(([value, label]) => {
    if ((value || "").trim() === label) {
      reasons.push(`${label}字段疑似表头`);
    }
  });
  const managementClass = (row.management_class || "").trim();
  if (managementClass && !["Ⅰ", "Ⅱ", "Ⅲ", "I", "II", "III"].includes(managementClass)) {
    reasons.push("管理类别异常");
  }
  if (![row.major_category_no, row.level_1_category_no, row.level_2_category_no].every((value) => /^\d+$/.test((value || "").trim()))) {
    reasons.push("分类编码不完整或格式异常");
  }
  if (DEVICE_REVISION_NOTE_MARKERS.some((marker) => values.some((value) => value.includes(marker)))) {
    reasons.push("疑似修订说明行被误解析");
  }
  return reasons;
}


const defaultPage = { page: 1, pageSize: 20 };
function viewForSourceType(sourceType: string): NonNullable<Props["activeView"]> {
  if (sourceType === "EQUIPMENT_STANDARD_NAME") {
    return "standard-names";
  }
  if (sourceType === "DEVICE_CLASSIFICATION_CATALOG") {
    return "device-classifications";
  }
  return "categories";
}

function statusTag(value?: string | null) {
  return <Tag color={value === "ACTIVE" ? "success" : "default"}>{value || "-"}</Tag>;
}

function totalBadge<T>(result: ApiResult<PagedResult<T>> | null) {
  return (
    <Badge count={result?.data?.page.total ?? 0} showZero>
      <Tag color="blue">真实库记录</Tag>
    </Badge>
  );
}

function countUnique<T>(rows: T[], selector: (row: T) => string | null | undefined): number {
  const values = new Set<string>();
  rows.forEach((row) => {
    const value = selector(row);
    if (value) {
      values.add(value);
    }
  });
  return values.size;
}

function ImportResult({ result }: { result: ApiResult<ImportReport> | null }) {
  if (!result) {
    return null;
  }
  if (!result.ok) {
    return <Alert type="error" showIcon message={result.message || result.code || "导入失败"} />;
  }
  return (
    <Alert
      type="success"
      showIcon
      message={`导入完成：${result.data?.success_count ?? 0} 成功 / ${result.data?.failed_count ?? 0} 失败`}
      description={`导入批次：${result.data?.batch_id || "-"}；标准来源：${nmpaStandard.fullSource}；原件：${result.data?.source_file?.source_file_name || "已留存"}`}
    />
  );
}

function displaySize(value?: number | null): string {
  if (!value && value !== 0) {
    return "-";
  }
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
}

function displayDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function middleEllipsis(value?: string | null, head = 24, tail = 10): string {
  const text = value || "-";
  if (text.length <= head + tail + 3) {
    return text;
  }
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function categoryLabel(row: EquipmentCategory): string {
  return `${row.category_code || "-"} ${row.category_name || "-"}`;
}

function buildCategoryTree(rows: EquipmentCategory[]): DataNode[] {
  const childrenByParent = new Map<string, EquipmentCategory[]>();
  const roots: EquipmentCategory[] = [];
  rows.forEach((row) => {
    if (row.parent_category_id) {
      const siblings = childrenByParent.get(row.parent_category_id) || [];
      siblings.push(row);
      childrenByParent.set(row.parent_category_id, siblings);
    } else {
      roots.push(row);
    }
  });

  const toNode = (row: EquipmentCategory): DataNode => ({
    key: row.category_id,
    title: categoryLabel(row),
    children: (childrenByParent.get(row.category_id) || []).sort(sortCategory).map(toNode)
  });

  return roots.sort(sortCategory).map(toNode);
}

function sortCategory(a: EquipmentCategory, b: EquipmentCategory): number {
  return `${a.category_code || ""}`.localeCompare(`${b.category_code || ""}`, "zh-Hans-CN");
}

function uniqueKey(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => part || "-").join("|");
}

function deviceTreeKeysFor(row: DeviceClassification): { majorKey: string; level1Key: string; level2Key: string } {
  const majorKey = `major:${uniqueKey(row.major_category_no, row.major_category_name)}`;
  const level1Key = `${majorKey}/level1:${uniqueKey(row.level_1_category_no, row.level_1_category)}`;
  const level2Key = `${level1Key}/level2:${uniqueKey(row.level_2_category_no, row.level_2_category)}`;
  return { majorKey, level1Key, level2Key };
}

function buildDeviceNavigationTree(rows: DeviceClassification[], showChangeMarks: boolean): DataNode[] {
  const majorMap = new Map<string, { row: DeviceClassification; children: Map<string, { row: DeviceClassification; children: Map<string, DeviceClassification[]> }> }>();
  rows.forEach((row) => {
    const { majorKey, level1Key, level2Key } = deviceTreeKeysFor(row);
    if (!majorMap.has(majorKey)) {
      majorMap.set(majorKey, { row, children: new Map() });
    }
    const major = majorMap.get(majorKey)!;
    if (!major.children.has(level1Key)) {
      major.children.set(level1Key, { row, children: new Map() });
    }
    const level1 = major.children.get(level1Key)!;
    const leaves = level1.children.get(level2Key) || [];
    leaves.push(row);
    level1.children.set(level2Key, leaves);
  });

  return [...majorMap.entries()]
    .sort(([, a], [, b]) => `${a.row.major_category_no || ""}`.localeCompare(`${b.row.major_category_no || ""}`))
    .map(([majorKey, major]) => {
      const majorCount = [...major.children.values()].reduce((sum, level1) => sum + [...level1.children.values()].reduce((childSum, leaves) => childSum + leaves.length, 0), 0);
      return {
        key: majorKey,
        title: (
          <span className="device-nav-node">
            <span className="device-nav-text device-nav-text-major">{major.row.major_category_no || "-"} {major.row.major_category_name || "未命名大类"}</span>
            <Tag>{majorCount}</Tag>
          </span>
        ),
        children: [...major.children.entries()]
          .sort(([, a], [, b]) => `${a.row.level_1_category_no || ""}`.localeCompare(`${b.row.level_1_category_no || ""}`))
          .map(([level1Key, level1]) => {
            const level1Count = [...level1.children.values()].reduce((sum, leaves) => sum + leaves.length, 0);
            return {
              key: level1Key,
              title: (
                <span className="device-nav-node">
                  <span className="device-nav-text device-nav-text-level1">{level1.row.level_1_category_no || "-"} {level1.row.level_1_category || "未命名一级类别"}</span>
                  <Tag>{level1Count}</Tag>
                </span>
              ),
              children: [...level1.children.entries()]
                .sort(([, a], [, b]) => `${a[0].level_2_category_no || ""}`.localeCompare(`${b[0].level_2_category_no || ""}`))
                .map(([level2Key, leaves]) => {
                  const first = leaves[0];
                  const changed = leaves.some((row) => row.latest_revision);
                  return {
                    key: level2Key,
                    title: (
                      <span className={`device-nav-node ${showChangeMarks && changed ? "device-nav-node-changed" : ""}`}>
                        <span className="device-nav-text device-nav-text-level2">{first.level_2_category_no || "-"} {first.level_2_category || "未命名二级类别"}</span>
                        <Space size={4}>
                          {showChangeMarks && changed ? governanceTag("修订", "orange") : null}
                          <Tag>{leaves.length}</Tag>
                        </Space>
                      </span>
                    )
                  };
                })
            };
          })
      };
    });
}

function matchesDeviceTreeKey(row: DeviceClassification, key: React.Key | null): boolean {
  if (!key) {
    return true;
  }
  const keys = deviceTreeKeysFor(row);
  const value = String(key);
  return keys.majorKey === value || keys.level1Key === value || keys.level2Key === value;
}

function labelFromDeviceTreeKey(key: React.Key | null): string | null {
  if (!key) {
    return null;
  }
  const value = String(key);
  const parts = value.split("/");
  const labels = parts.map((part) => {
    const [, raw = ""] = part.split(":");
    const [no, name] = raw.split("|");
    return `${no || "-"} ${name || "-"}`;
  });
  if (value.includes("/level2:")) {
    return labels.join(" / ");
  }
  if (value.includes("/level1:")) {
    return labels.slice(0, 2).join(" / ");
  }
  return labels[0] || null;
}

function estimateTreeWidth(rows: DeviceClassification[]): number {
  if (!rows.length) {
    return DEVICE_TREE_WIDTH_DEFAULT;
  }
  const longest = rows.reduce((max, row) => {
    const candidates = [
      `${row.major_category_no || "-"} ${row.major_category_name || "未命名大类"}`,
      `${row.level_1_category_no || "-"} ${row.level_1_category || "未命名一级类别"}`,
      `${row.level_2_category_no || "-"} ${row.level_2_category || "未命名二级类别"}`
    ];
    const rowLongest = candidates.reduce((current, text) => Math.max(current, text.length), 0);
    return Math.max(max, rowLongest);
  }, 0);
  const estimated = 70 + longest * 14;
  return Math.max(DEVICE_TREE_WIDTH_MIN, Math.min(DEVICE_TREE_WIDTH_MAX, estimated));
}

export function EquipmentDictionaryWorkbench({ client, activeView = "categories", onApiActivity, session, onOpenDeviceExport }: Props) {
  const [keyword, setKeyword] = React.useState("");
  const [managementClass, setManagementClass] = React.useState("");
  const [categories, setCategories] = React.useState<ApiResult<PagedResult<EquipmentCategory>> | null>(null);
  const [categoryTreeSource, setCategoryTreeSource] = React.useState<ApiResult<TreeDataResult<EquipmentCategory>> | null>(null);
  const [linkedStandards, setLinkedStandards] = React.useState<ApiResult<PagedResult<EquipmentStandardName>> | null>(null);
  const [standards, setStandards] = React.useState<ApiResult<PagedResult<EquipmentStandardName>> | null>(null);
  const [deviceTreeSource, setDeviceTreeSource] = React.useState<ApiResult<TreeDataResult<DeviceClassification>> | null>(null);
  const [sourceFiles, setSourceFiles] = React.useState<ApiResult<EquipmentSourceFileList> | null>(null);
  const [activeKey, setActiveKey] = React.useState<NonNullable<Props["activeView"]>>(activeView);
  const [categoryPage, setCategoryPage] = React.useState(defaultPage);
  const [standardPage, setStandardPage] = React.useState(defaultPage);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [sourceType, setSourceType] = React.useState("EQUIPMENT_CATEGORY");
  const [sourceSystem, setSourceSystem] = React.useState("数据维护平台");
  const [sourceTxId, setSourceTxId] = React.useState("");
  const [sheetName, setSheetName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ApiResult<ImportReport> | null>(null);
  const [sourceDrawerOpen, setSourceDrawerOpen] = React.useState(false);
  const [sourceArchiveTab, setSourceArchiveTab] = React.useState("volumes");
  const [sourceArchiveTreeKey, setSourceArchiveTreeKey] = React.useState<React.Key>("standard-device");
  const [selectedArchiveVolumeId, setSelectedArchiveVolumeId] = React.useState<string | null>(null);
  const [sourceArchiveSearch, setSourceArchiveSearch] = React.useState({
    keyword: "",
    source_unit: "",
    batch_id: "",
    sha256: "",
    status: "all",
    authority_level: "all",
    referenced: "all"
  });
  const [showChangeMarks, setShowChangeMarks] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [deviceExpandedKeys, setDeviceExpandedKeys] = React.useState<React.Key[]>([]);
  const [deviceAutoExpandParent, setDeviceAutoExpandParent] = React.useState(true);
  const [changedNodesExpanded, setChangedNodesExpanded] = React.useState(false);
  const [selectedDeviceTreeKey, setSelectedDeviceTreeKey] = React.useState<React.Key | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
  const [onlyChangedDevices, setOnlyChangedDevices] = React.useState(false);
  const [deviceDataStatus, setDeviceDataStatus] = React.useState("effective");
  const [deviceDetailDrawerOpen, setDeviceDetailDrawerOpen] = React.useState(false);
  const [deviceGovernance, setDeviceGovernance] = React.useState<ApiResult<DeviceClassificationGovernanceDetail> | null>(null);
  const [correctionDrawerOpen, setCorrectionDrawerOpen] = React.useState(false);
  const [correctionLedgerOpen, setCorrectionLedgerOpen] = React.useState(false);
  const [correctionOrders, setCorrectionOrders] = React.useState<ApiResult<{ items: CatalogCorrectionOrder[]; total: number }> | null>(null);
  const [correctionFilters, setCorrectionFilters] = React.useState({
    status: "all",
    abnormal_type: "",
    correction_action: "",
    source_batch_id: "",
    applicant_name: ""
  });
  const [correctionSubmitting, setCorrectionSubmitting] = React.useState(false);
  const [correctionForm] = Form.useForm();
  const [deviceTreeWidth, setDeviceTreeWidth] = React.useState(DEVICE_TREE_WIDTH_DEFAULT);
  const [treeWidthCustomized, setTreeWidthCustomized] = React.useState(false);
  const [deviceSearchInput, setDeviceSearchInput] = React.useState("");
  const [devicePageSize, setDevicePageSize] = React.useState(100);
  const [deviceShellHeight, setDeviceShellHeight] = React.useState<number>(0);
  const [deviceTableScrollY, setDeviceTableScrollY] = React.useState<number>(420);
  const [deviceTreeSearchInput, setDeviceTreeSearchInput] = React.useState("");
  const [debouncedDeviceKeyword, setDebouncedDeviceKeyword] = React.useState("");
  const [deviceSearchPending, setDeviceSearchPending] = React.useState(false);
  const deviceShellRef = React.useRef<HTMLDivElement | null>(null);
  const deviceListColumnRef = React.useRef<HTMLElement | null>(null);
  const [deviceSearchHistory, setDeviceSearchHistory] = React.useState<string[]>([]);
  const [invalidCandidatesDrawerOpen, setInvalidCandidatesDrawerOpen] = React.useState(false);
  const [invalidCandidates, setInvalidCandidates] = React.useState<DeviceClassification[]>([]);
  const [loadingInvalidCandidates, setLoadingInvalidCandidates] = React.useState(false);
  const [deviceImportWizardOpen, setDeviceImportWizardOpen] = React.useState(false);
  const [deviceImportFullscreen, setDeviceImportFullscreen] = React.useState(false);
  const [deviceImportStep, setDeviceImportStep] = React.useState(0);
  const [deviceImportFile, setDeviceImportFile] = React.useState<File | null>(null);
  const [deviceImportFileName, setDeviceImportFileName] = React.useState("");
  const [deviceImportFileType, setDeviceImportFileType] = React.useState("国家目录");
  const [deviceImportSource, setDeviceImportSource] = React.useState("国家药监局");
  const [deviceImportSourceLink, setDeviceImportSourceLink] = React.useState("");
  const [deviceImportPublishDate, setDeviceImportPublishDate] = React.useState("");
  const [deviceImportEffectiveDate, setDeviceImportEffectiveDate] = React.useState("");
  const [deviceImportAuthoritative, setDeviceImportAuthoritative] = React.useState("是");
  const [deviceImportMode, setDeviceImportMode] = React.useState("初始化导入");
  const [deviceImportBatchId, setDeviceImportBatchId] = React.useState("");
  const [deviceImportBatchName, setDeviceImportBatchName] = React.useState("");
  const [deviceImportReason, setDeviceImportReason] = React.useState("初始化国家医疗器械分类目录");
  const [deviceImportScope, setDeviceImportScope] = React.useState("医疗器械分类目录主数据");
  const [deviceImportAuthorityLevel, setDeviceImportAuthorityLevel] = React.useState("国家级");
  const [deviceImportRemark, setDeviceImportRemark] = React.useState("");
  const [deviceImportPreviewKeyword, setDeviceImportPreviewKeyword] = React.useState("");
  const [deviceImportPreviewFilter, setDeviceImportPreviewFilter] = React.useState("all");
  const [deviceImportCompletedReport, setDeviceImportCompletedReport] = React.useState<ImportReport | null>(null);
  const [deviceImportPreview, setDeviceImportPreview] = React.useState<ApiResult<DeviceClassificationImportPreview> | null>(null);
  const [previewingDeviceImport, setPreviewingDeviceImport] = React.useState(false);
  const [deviceImportFileUploadedAt, setDeviceImportFileUploadedAt] = React.useState("");
  const [deviceImportHistory, setDeviceImportHistory] = React.useState<ApiResult<{ items: DeviceImportHistoryRecord[] }> | null>(null);
  const [deviceImportHistoryDetail, setDeviceImportHistoryDetail] = React.useState<ApiResult<DeviceImportHistoryDetail> | null>(null);
  const [deviceImportHistoryDrawerOpen, setDeviceImportHistoryDrawerOpen] = React.useState(false);

  React.useEffect(() => setActiveKey(activeView), [activeView]);

  const categoryTreeRows = categoryTreeSource?.data?.items || [];
  const selectedCategory = React.useMemo(
    () => categoryTreeRows.find((row) => row.category_id === selectedCategoryId) || null,
    [categoryTreeRows, selectedCategoryId]
  );
  const categoryChildren = React.useMemo(
    () => categoryTreeRows.filter((row) => row.parent_category_id === selectedCategoryId).sort(sortCategory),
    [categoryTreeRows, selectedCategoryId]
  );
  const categoryTree = React.useMemo(() => buildCategoryTree(categoryTreeRows), [categoryTreeRows]);
  const deviceRows = deviceTreeSource?.data?.items || [];
  const deviceNavigationTree = React.useMemo(() => buildDeviceNavigationTree(deviceRows, showChangeMarks), [deviceRows, showChangeMarks]);
  const filteredDeviceNavigationTree = React.useMemo(() => {
    const q = deviceTreeSearchInput.trim().toLowerCase();
    if (!q) {
      return deviceNavigationTree;
    }
    const walk = (nodes: DataNode[]): DataNode[] =>
      nodes
        .map((node) => {
          const titleText = typeof node.title === "string" ? node.title : String((node as { key?: string }).key || "");
          const children = node.children ? walk(node.children as DataNode[]) : [];
          if (titleText.toLowerCase().includes(q) || children.length > 0) {
            return { ...node, children };
          }
          return null;
        })
        .filter(Boolean) as DataNode[];
    return walk(deviceNavigationTree);
  }, [deviceNavigationTree, deviceTreeSearchInput]);
  const changedDeviceCount = React.useMemo(() => deviceRows.filter((row) => row.latest_revision).length, [deviceRows]);
  const deviceFilterActive = Boolean(debouncedDeviceKeyword);
  const visibleDeviceRows = React.useMemo(
    () => deviceRows
      .filter((row) => !debouncedDeviceKeyword || deviceSearchCorpus(row).includes(normalizeSearch(debouncedDeviceKeyword)))
      .filter((row) => row.latest_revision?.change_type !== "DELETED")
      .filter((row) => (debouncedDeviceKeyword ? true : matchesDeviceTreeKey(row, selectedDeviceTreeKey)))
      .filter((row) => !onlyChangedDevices || row.latest_revision),
    [
      debouncedDeviceKeyword,
      deviceRows,
      onlyChangedDevices,
      selectedDeviceTreeKey
    ]
  );
  const selectedDevice = React.useMemo(
    () => visibleDeviceRows.find((row) => row.catalog_id === selectedDeviceId) || visibleDeviceRows[0] || null,
    [selectedDeviceId, visibleDeviceRows]
  );
  const selectedTreeSummary = React.useMemo(() => {
    const label = labelFromDeviceTreeKey(selectedDeviceTreeKey);
    return `当前分类：${label || "全部"}`;
  }, [selectedDeviceTreeKey]);
  const deviceMetrics = React.useMemo(
    () => ({
      total: deviceTreeSource?.data?.total ?? 0,
      major: countUnique(deviceRows, (row) => row.major_category_no),
      level1: countUnique(deviceRows, (row) => uniqueKey(row.major_category_no, row.level_1_category_no, row.level_1_category)),
      level2: countUnique(deviceRows, (row) => uniqueKey(row.major_category_no, row.level_1_category_no, row.level_2_category_no, row.level_2_category)),
      mapped: 0,
      pending: deviceTreeSource?.data?.total ?? 0,
      revised: deviceTreeSource?.data?.revision_summary?.revised_item_count ?? changedDeviceCount,
      lastUpdatedAt: deviceTreeSource?.data?.revision_summary?.last_updated_at ?? null
    }),
    [changedDeviceCount, deviceRows, deviceTreeSource?.data?.revision_summary, deviceTreeSource?.data?.total]
  );
  const deviceSourceFiles = React.useMemo(
    () => (sourceFiles?.data?.items || []).filter((item) => item.source_type === "DEVICE_CLASSIFICATION_CATALOG"),
    [sourceFiles]
  );
  const sourceArchiveTreeData = React.useMemo<DataNode[]>(() => [
    { key: "standard", title: "国家标准目录类", children: [
      { key: "standard-device", title: "医疗器械分类目录" },
      { key: "standard-nhsa", title: "医保耗材目录" },
    ] },
    { key: "policy", title: "政策公告类" },
    { key: "hospital", title: "院内主数据类", children: [
      { key: "hospital-equipment", title: "设备主数据" },
      { key: "hospital-material", title: "耗材主数据" },
      { key: "hospital-vendor", title: "供应商主数据" },
      { key: "hospital-department", title: "科室主数据" },
    ] },
    { key: "external", title: "外部系统导入类", children: [
      { key: "external-his", title: "HIS" },
      { key: "external-spd", title: "SPD" },
      { key: "external-nhsa", title: "医保平台" },
      { key: "external-lis", title: "LIS" },
      { key: "external-pacs", title: "PACS" },
    ] },
    { key: "governance", title: "数据治理过程类", children: [
      { key: "governance-parse", title: "解析报告" },
      { key: "governance-validation", title: "核验报告" },
      { key: "governance-diff", title: "差异报告" },
      { key: "governance-correction", title: "纠错记录" },
      { key: "governance-rollback", title: "回滚记录" },
    ] },
    { key: "other", title: "其他佐证材料" },
  ], []);
  const sourceHistoryByBatch = React.useMemo(() => {
    const map = new Map<string, DeviceImportHistoryRecord>();
    (deviceImportHistory?.data?.items || []).forEach((record) => map.set(record.import_batch_id, record));
    return map;
  }, [deviceImportHistory]);
  const sourceArchiveVolumes = React.useMemo<SourceArchiveVolume[]>(() => {
    const volumes = new Map<string, SourceArchiveVolume>();
    (sourceFiles?.data?.items || []).forEach((file) => {
      const history = sourceHistoryByBatch.get(file.batch_id);
      const archiveInfo = archiveCategoryForSource(file.source_type);
      const volumeName = file.batch_name || history?.catalog_version || history?.import_reason || `${archiveInfo.domain} ${file.source_file_name || file.batch_id}归档卷`;
      const volumeId = `${file.source_type}-${file.batch_id}`;
      const existing = volumes.get(volumeId) || {
        volume_id: volumeId,
        volume_name: volumeName,
        category: archiveInfo.category,
        domain: archiveInfo.domain,
        source_unit: file.source_system || history?.source_name || "-",
        status: "已归档",
        files: [],
        batches: [],
        supported_count: 0,
        abnormal_count: 0,
        updated_at: file.saved_at || history?.completed_at || history?.started_at || null,
      };
      existing.files.push(file);
      if (history && !existing.batches.some((item) => item.import_batch_id === history.import_batch_id)) {
        existing.batches.push(history);
      }
      existing.supported_count += Number(history?.imported_count || history?.parsed_count || 0);
      existing.abnormal_count += Number(history?.error_count || 0);
      existing.updated_at = [existing.updated_at, file.saved_at, history?.completed_at, history?.started_at].filter(Boolean).sort().reverse()[0] || null;
      volumes.set(volumeId, existing);
    });
    return Array.from(volumes.values()).sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }, [sourceFiles?.data?.items, sourceHistoryByBatch]);
  const visibleSourceArchiveVolumes = React.useMemo(() => {
    const key = String(sourceArchiveTreeKey);
    return sourceArchiveVolumes.filter((volume) => {
      const treeKey = archiveCategoryForSource(volume.files[0]?.source_type).treeKey;
      return key === treeKey || key === "standard" && volume.category === "国家标准目录类" || key === "hospital" && volume.category === "院内主数据类" || key === "other" && volume.category === "其他佐证材料";
    });
  }, [sourceArchiveTreeKey, sourceArchiveVolumes]);
  const selectedArchiveVolume = React.useMemo(
    () => sourceArchiveVolumes.find((volume) => volume.volume_id === selectedArchiveVolumeId) || visibleSourceArchiveVolumes[0] || null,
    [selectedArchiveVolumeId, sourceArchiveVolumes, visibleSourceArchiveVolumes]
  );
  const filteredArchiveFiles = React.useMemo(() => {
    const keywordValue = normalizeSearch(sourceArchiveSearch.keyword);
    return (sourceFiles?.data?.items || []).filter((file) => {
      const history = sourceHistoryByBatch.get(file.batch_id);
      const archiveInfo = archiveCategoryForSource(file.source_type);
      const haystack = [
        file.source_file_name,
        file.batch_name,
        file.source_system,
        file.batch_id,
        file.sha256,
        history?.catalog_version,
        history?.source_name,
        history?.source_url,
        archiveInfo.category,
        archiveInfo.domain,
      ].filter(Boolean).join(" ").toLowerCase();
      if (keywordValue && !haystack.includes(keywordValue)) return false;
      if (sourceArchiveSearch.source_unit && !(file.source_system || history?.source_name || "").includes(sourceArchiveSearch.source_unit)) return false;
      if (sourceArchiveSearch.batch_id && !file.batch_id.includes(sourceArchiveSearch.batch_id)) return false;
      if (sourceArchiveSearch.sha256 && !(file.sha256 || "").includes(sourceArchiveSearch.sha256)) return false;
      if (sourceArchiveSearch.authority_level !== "all" && (file.authority_level || "") !== sourceArchiveSearch.authority_level) return false;
      return true;
    });
  }, [sourceArchiveSearch, sourceFiles?.data?.items, sourceHistoryByBatch]);
  const filteredDeviceImportPreviewRows = React.useMemo(() => {
    const rows = deviceImportPreview?.data?.samples || [];
    const keywordValue = deviceImportPreviewKeyword.trim().toLowerCase();
    return rows.filter((row) => {
      const status = row.parse_status || "通过";
      if (deviceImportPreviewFilter === "abnormal" && status === "通过") {
        return false;
      }
      if (deviceImportPreviewFilter === "pending" && status !== "待人工确认") {
        return false;
      }
      if (!keywordValue) {
        return true;
      }
      return [
        row.catalog_code,
        row.level_1_category,
        row.level_2_category,
        row.product_description,
        row.intended_use,
        row.product_examples,
        row.management_class,
        row.change_type,
        row.issue_message,
      ].filter(Boolean).join(" ").toLowerCase().includes(keywordValue);
    });
  }, [deviceImportPreview?.data?.samples, deviceImportPreviewFilter, deviceImportPreviewKeyword]);
  const deviceImportHasBlockingErrors = React.useMemo(
    () => (deviceImportPreview?.data?.validation_results || []).some((item) => item.status === "错误"),
    [deviceImportPreview?.data?.validation_results]
  );
  const isDeviceCatalogEmpty = deviceRows.length === 0;
  const currentOperatorName = session?.displayName || session?.username || "";
  const currentOperatorRole = session?.role || "";
  const currentOperatorDepartment = currentOperatorName ? "数据治理中心" : "";
  const operatorContextValid = Boolean(session?.username && currentOperatorName && currentOperatorRole);
  const importModeHelpContent = (
    <div className="device-import-help-table">
      {deviceImportModeHelpRows.map(([scene, mode]) => (
        <div key={scene}>
          <span>{scene}</span>
          <strong>{mode}</strong>
        </div>
      ))}
    </div>
  );
  const changeTypeCounts = deviceImportPreview?.data?.change_type_counts || {};

  React.useEffect(() => {
    if (!isDeviceCatalogEmpty && deviceImportMode === "初始化导入") {
      setDeviceImportMode("增量更新");
    }
  }, [deviceImportMode, isDeviceCatalogEmpty]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DEVICE_SEARCH_HISTORY_KEY);
      if (!saved) {
        return;
      }
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setDeviceSearchHistory(parsed.filter((item) => typeof item === "string").slice(0, 8));
      }
    } catch {
      // ignore invalid local storage content
    }
  }, []);

  React.useEffect(() => {
    if (treeWidthCustomized) {
      return;
    }
    setDeviceTreeWidth(estimateTreeWidth(deviceRows));
  }, [deviceRows, treeWidthCustomized]);

  React.useEffect(() => {
    if (selectedDevice && selectedDevice.catalog_id !== selectedDeviceId) {
      setSelectedDeviceId(selectedDevice.catalog_id);
    }
  }, [selectedDevice, selectedDeviceId]);

  React.useEffect(() => {
    if (!deviceDetailDrawerOpen || !selectedDevice?.catalog_id) {
      return;
    }
    void (async () => {
      const result = await client.getDeviceClassificationGovernance(selectedDevice.catalog_id);
      setDeviceGovernance(result);
      onApiActivity("GET /api/v1/equipment/device-classifications/{catalog_id}/governance", result);
    })();
  }, [client, deviceDetailDrawerOpen, onApiActivity, selectedDevice?.catalog_id]);

  React.useEffect(() => {
    if (activeKey === "device-classifications") {
      setSourceType("DEVICE_CLASSIFICATION_CATALOG");
      setSourceSystem(nmpaStandard.fullSource);
    }
  }, [activeKey]);

  React.useEffect(() => {
    if (activeKey !== "device-classifications") {
      return undefined;
    }
    setDeviceSearchPending(true);
    const timer = window.setTimeout(() => {
      setDebouncedDeviceKeyword(deviceSearchInput.trim());
      setDeviceSearchPending(false);
    }, DEVICE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeKey, deviceSearchInput]);

  const startDeviceTreeResize = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = deviceTreeWidth;
    setTreeWidthCustomized(true);
    document.body.classList.add("is-resizing-device-tree");

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        DEVICE_TREE_WIDTH_MAX,
        Math.max(DEVICE_TREE_WIDTH_MIN, startWidth + moveEvent.clientX - startX)
      );
      setDeviceTreeWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.body.classList.remove("is-resizing-device-tree");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [deviceTreeWidth]);

  const changeSourceType = (nextSourceType: string) => {
    setSourceType(nextSourceType);
    setActiveKey(viewForSourceType(nextSourceType));
  };

  const loadCategoryTree = React.useCallback(async () => {
    const result = await client.listEquipmentCategoryTreeData({ keyword, status: "" });
    setCategoryTreeSource(result);
    onApiActivity("GET /api/v1/equipment/categories/tree-data", result);
  }, [client, keyword, onApiActivity]);

  const loadCategories = React.useCallback(async () => {
    const result = await client.listEquipmentCategories({ keyword, status: "", page: categoryPage.page, pageSize: categoryPage.pageSize });
    setCategories(result);
    onApiActivity("GET /api/v1/equipment/categories", result);
  }, [categoryPage.page, categoryPage.pageSize, client, keyword, onApiActivity]);

  const loadStandards = React.useCallback(async () => {
    const result = await client.listEquipmentStandardNames({ keyword, status: "", page: standardPage.page, pageSize: standardPage.pageSize });
    setStandards(result);
    onApiActivity("GET /api/v1/equipment/standard-names", result);
  }, [client, keyword, onApiActivity, standardPage.page, standardPage.pageSize]);

  const loadLinkedStandards = React.useCallback(async () => {
    if (!selectedCategoryId) {
      setLinkedStandards(null);
      return;
    }
    const result = await client.listEquipmentStandardNames({ categoryId: selectedCategoryId, status: "", page: 1, pageSize: 10 });
    setLinkedStandards(result);
    onApiActivity("GET /api/v1/equipment/standard-names", result);
  }, [client, onApiActivity, selectedCategoryId]);

  const loadDeviceTree = React.useCallback(async () => {
    const result = await client.listDeviceClassificationTreeData({
      keyword: "",
      managementClass: "",
      status: deviceDataStatus,
      includeHidden: deviceDataStatus === "all"
    });
    setDeviceTreeSource(result);
    onApiActivity("GET /api/v1/equipment/device-classifications/tree-data", result);
  }, [client, deviceDataStatus, onApiActivity]);

  const loadCorrectionOrders = React.useCallback(async () => {
    const result = await client.listDeviceClassificationCorrections({
      ...correctionFilters,
      status: correctionFilters.status === "all" ? undefined : correctionFilters.status,
      limit: 500
    });
    setCorrectionOrders(result);
    onApiActivity("GET /api/v1/equipment/device-classifications/corrections", result);
  }, [client, correctionFilters, onApiActivity]);

  const loadSourceFiles = React.useCallback(async () => {
    const result = await client.listEquipmentSourceFiles();
    setSourceFiles(result);
    onApiActivity("GET /api/v1/equipment/source-files", result);
  }, [client, onApiActivity]);

  const loadDeviceImportHistory = React.useCallback(async () => {
    const result = await client.listDeviceClassificationImportHistory();
    setDeviceImportHistory(result);
    onApiActivity("GET /api/v1/equipment/device-classifications/import/history", result);
  }, [client, onApiActivity]);

  const refreshActive = React.useCallback(async () => {
    if (activeKey === "standard-names") {
      await loadStandards();
    } else if (activeKey === "device-classifications") {
      await loadDeviceTree();
    } else {
      await Promise.all([loadCategories(), loadCategoryTree()]);
    }
  }, [activeKey, loadCategories, loadCategoryTree, loadDeviceTree, loadStandards]);

  React.useEffect(() => {
    void refreshActive();
  }, [refreshActive]);

  React.useEffect(() => {
    void loadSourceFiles();
    void loadDeviceImportHistory();
  }, [loadDeviceImportHistory, loadSourceFiles]);

  React.useEffect(() => {
    void loadLinkedStandards();
  }, [loadLinkedStandards]);

  React.useEffect(() => {
    if (!selectedCategoryId && categoryTreeRows.length > 0) {
      setSelectedCategoryId(categoryTreeRows[0].category_id);
    }
  }, [categoryTreeRows, selectedCategoryId]);

  const resetPagesAndRefresh = () => {
    const alreadyDefault =
      categoryPage.page === defaultPage.page &&
      categoryPage.pageSize === defaultPage.pageSize &&
      standardPage.page === defaultPage.page &&
      standardPage.pageSize === defaultPage.pageSize;
    setCategoryPage(defaultPage);
    setStandardPage(defaultPage);
    setSelectedCategoryId(null);
    if (alreadyDefault) {
      void refreshActive();
    }
  };

  const applyDeviceSearch = React.useCallback((raw: string) => {
    const keywordValue = raw.trim();
    setDeviceSearchInput(keywordValue);
    setDebouncedDeviceKeyword(keywordValue);
    setDeviceSearchPending(false);
    setSelectedDeviceTreeKey(null);
    if (!keywordValue) {
      return;
    }
    setDeviceSearchHistory((current) => {
      const next = [keywordValue, ...current.filter((item) => item !== keywordValue)].slice(0, 8);
      try {
        window.localStorage.setItem(DEVICE_SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  const deviceWorkspaceStyle = React.useMemo(() => ({
    gridTemplateColumns: `${deviceTreeWidth}px minmax(0, 1fr)`,
    ["--device-tree-width" as string]: `${deviceTreeWidth}px`
  }) as React.CSSProperties, [deviceTreeWidth]);

  const syncDeviceLayout = React.useCallback(() => {
    if (activeKey !== "device-classifications") {
      return;
    }
    const listColumnElement = deviceListColumnRef.current;
    if (listColumnElement) {
      const nextListHeight = Math.floor(listColumnElement.clientHeight);
      if (nextListHeight > 280) {
        const topbarHeight = listColumnElement.querySelector(".device-list-topbar")?.getBoundingClientRect().height ?? 38;
        const headerHeight = listColumnElement.querySelector(".ant-table-thead")?.getBoundingClientRect().height ?? 42;
        const paginationHeight = listColumnElement.querySelector(".ant-pagination")?.getBoundingClientRect().height ?? 44;
        const safetyGap = 8;
        setDeviceTableScrollY(Math.max(280, Math.floor(nextListHeight - topbarHeight - headerHeight - paginationHeight - safetyGap)));
      }
    }
    const shellElement = deviceShellRef.current;
    if (shellElement) {
      const shellParent = shellElement.parentElement as HTMLElement | null;
      const nextShellHeight = Math.floor(shellParent?.clientHeight ?? 0);
      if (nextShellHeight > 280) {
        setDeviceShellHeight(nextShellHeight);
      }
    }
  }, [activeKey]);

  React.useLayoutEffect(() => {
    if (activeKey !== "device-classifications") {
      return;
    }
    const run = () => window.requestAnimationFrame(syncDeviceLayout);
    run();
    const timer = window.setTimeout(run, 80);
    window.addEventListener("resize", run);
    const observer = new ResizeObserver(() => run());
    if (deviceShellRef.current) {
      observer.observe(deviceShellRef.current);
    }
    const shellParent = deviceShellRef.current?.parentElement as HTMLElement | null;
    if (shellParent) {
      observer.observe(shellParent);
    }
    if (deviceListColumnRef.current) {
      observer.observe(deviceListColumnRef.current);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", run);
      observer.disconnect();
    };
  }, [activeKey, syncDeviceLayout]);

  const expandChangedDeviceNodes = async () => {
    if (changedNodesExpanded) {
      setDeviceExpandedKeys([]);
      setShowHistory(false);
      setDeviceAutoExpandParent(false);
      setChangedNodesExpanded(false);
      return;
    }
    const result = await client.listDeviceClassificationTreeData({ keyword: "", managementClass: "" });
    setDeviceTreeSource(result);
    onApiActivity("GET /api/v1/equipment/device-classifications/tree-data", result);
    if (!result.ok) {
      message.error(result.message || "新增和修订条目加载失败");
      return;
    }
    const keys = new Set<string>();
    (result.data?.items || []).forEach((row) => {
      if (!row.latest_revision) {
        return;
      }
      const rowKeys = deviceTreeKeysFor(row);
      keys.add(rowKeys.majorKey);
      keys.add(rowKeys.level1Key);
      keys.add(rowKeys.level2Key);
    });
    if (keys.size === 0) {
      message.info("当前目录中暂无新增或修订条目");
      return;
    }
    setKeyword("");
    setManagementClass("");
    setShowChangeMarks(true);
    setShowHistory(true);
    setDeviceExpandedKeys([...keys]);
    setDeviceAutoExpandParent(true);
    setChangedNodesExpanded(true);
    setOnlyChangedDevices(true);
    message.success(`已展开 ${keys.size} 个新增/修订相关节点`);
  };

  const submitImport = async (selectedFile = file) => {
    if (!selectedFile) {
      message.warning("请选择真实导入文件");
      return;
    }
    const nextSourceType = activeKey === "device-classifications" ? "DEVICE_CLASSIFICATION_CATALOG" : sourceType;
    const nextSourceSystem = nextSourceType === "DEVICE_CLASSIFICATION_CATALOG" ? nmpaStandard.fullSource : sourceSystem;
    setImporting(true);
    const result = await client.importEquipmentDictionary({
      file: selectedFile,
      sourceSystem: nextSourceSystem,
      sourceTxId,
      sheetName,
      sourceType: nextSourceType,
      importReason: nextSourceType === "DEVICE_CLASSIFICATION_CATALOG" ? "国家标准目录导入复核" : undefined
    });
    setImportResult(result);
    onApiActivity("POST /api/v1/equipment/import", result);
    setImporting(false);
    if (result.ok) {
      setActiveKey(viewForSourceType(nextSourceType));
      message.success(nextSourceType === "DEVICE_CLASSIFICATION_CATALOG" ? "国家医疗器械分类目录导入完成" : "装备字典导入完成");
      void loadCategories();
      void loadCategoryTree();
      void loadStandards();
      void loadDeviceTree();
      void loadSourceFiles();
    } else {
      message.error(result.message || "导入失败");
    }
  };

  const resetDeviceImportWizard = () => {
    setDeviceImportStep(0);
    setDeviceImportFile(null);
    setDeviceImportFileName("");
    setDeviceImportFileType("国家目录");
    setDeviceImportSource("国家药监局");
    setDeviceImportSourceLink("");
    setDeviceImportPublishDate("");
    setDeviceImportEffectiveDate("");
    setDeviceImportAuthoritative("是");
    setDeviceImportMode("初始化导入");
    setDeviceImportBatchId("");
    setDeviceImportBatchName("");
    setDeviceImportReason("初始化国家医疗器械分类目录");
    setDeviceImportScope("医疗器械分类目录主数据");
    setDeviceImportAuthorityLevel("国家级");
    setDeviceImportRemark("");
    setDeviceImportPreviewKeyword("");
    setDeviceImportPreviewFilter("all");
    setDeviceImportCompletedReport(null);
    setDeviceImportPreview(null);
    setPreviewingDeviceImport(false);
    setDeviceImportFileUploadedAt("");
  };

  const previewDeviceImport = async (override?: { importMode?: string }) => {
    if (!deviceImportFile) {
      message.warning("请先选择医疗器械分类目录 DOCX 文件");
      return false;
    }
    setPreviewingDeviceImport(true);
    try {
      const result = await client.previewDeviceClassificationImport({
        file: deviceImportFile,
        sourceSystem: deviceImportSource,
        sourceTxId: deviceImportBatchId,
        sourceFileName: deviceImportFileName || deviceImportFile.name,
        sourceType: "DEVICE_CLASSIFICATION_CATALOG",
        fileType: deviceImportFileType,
        sourceLink: deviceImportSourceLink,
        publishDate: deviceImportPublishDate,
        effectiveDate: deviceImportEffectiveDate,
        authoritative: deviceImportAuthoritative,
        importMode: override?.importMode || deviceImportMode,
        batchName: deviceImportBatchName,
        scope: deviceImportScope,
        authorityLevel: deviceImportAuthorityLevel,
        operatorName: currentOperatorName,
        remark: deviceImportRemark,
      });
      setDeviceImportPreview(result);
      onApiActivity("POST /api/v1/equipment/device-classifications/import/preview", result);
      if (!result.ok) {
        message.error(result.message || "目录解析预览失败");
        return false;
      }
      setDeviceImportPreviewKeyword("");
      setDeviceImportPreviewFilter("all");
      setDeviceImportBatchId(result.data?.batch_id || deviceImportBatchId);
      setDeviceImportStep(2);
      message.success(`解析完成：${result.data?.source_row_count ?? 0} 条，成功 ${result.data?.parse_success_count ?? 0} 条`);
      void loadDeviceImportHistory();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "目录解析预览失败";
      message.error(errorMessage);
      return false;
    } finally {
      setPreviewingDeviceImport(false);
    }
  };

  const goNextDeviceImportStep = () => {
    if (deviceImportStep === 0 && !deviceImportFile) {
      message.warning("请先选择医疗器械分类目录 DOCX 文件");
      return;
    }
    if (deviceImportStep === 1) {
      setDeviceImportStep(2);
      if (!deviceImportPreview?.ok) {
        void previewDeviceImport();
      }
      return;
    }
    if (deviceImportStep === 2 && !deviceImportPreview?.ok) {
      void previewDeviceImport();
      return;
    }
    setDeviceImportStep((step) => Math.min(4, step + 1));
  };

  const commitDeviceImport = async () => {
    if (!deviceImportFile) {
      message.warning("请先选择医疗器械分类目录 DOCX 文件");
      return;
    }
    if (deviceImportHasBlockingErrors) {
      message.error("存在错误级核验结果，处理后才可确认入库");
      return;
    }
    if (!operatorContextValid) {
      message.error("当前登录用户信息异常，禁止执行入库操作");
      return;
    }
    Modal.confirm({
      title: "确认入库",
      content: "本次导入将写入医疗器械分类目录主数据，并可能影响后续耗材映射、设备分类、医保编码映射等业务。是否确认入库？",
      okText: "确认入库",
      cancelText: "取消",
      onOk: async () => {
        setImporting(true);
        const result = await client.importEquipmentDictionary({
          file: deviceImportFile,
          sourceType: "DEVICE_CLASSIFICATION_CATALOG",
          sourceSystem: deviceImportSource,
          sourceTxId: deviceImportPreview?.data?.batch_id || deviceImportBatchId,
          sourceFileName: deviceImportFileName || deviceImportFile.name,
          importReason: deviceImportReason || "国家医疗器械分类目录导入",
          fileType: deviceImportFileType,
          sourceLink: deviceImportSourceLink,
          publishDate: deviceImportPublishDate,
          effectiveDate: deviceImportEffectiveDate,
          authoritative: deviceImportAuthoritative,
          importMode: deviceImportMode,
          batchName: deviceImportBatchName,
          scope: deviceImportScope,
          authorityLevel: deviceImportAuthorityLevel,
          operatorName: currentOperatorName,
          remark: deviceImportRemark,
        });
        setImportResult(result);
        onApiActivity("POST /api/v1/equipment/import", result);
        setImporting(false);
        if (!result.ok) {
          message.error(result.message || "目录导入失败");
          return;
        }
        setDeviceImportCompletedReport(result.data || null);
        setDeviceImportStep(4);
        message.success("国家医疗器械分类目录导入完成");
        await Promise.all([loadDeviceTree(), loadSourceFiles(), loadDeviceImportHistory()]);
      }
    });
  };

  const loadInvalidCandidates = React.useCallback(async () => {
    setLoadingInvalidCandidates(true);
    const result = await client.listInvalidDeviceClassificationCandidates(500);
    onApiActivity("GET /api/v1/equipment/device-classifications/invalid-candidates", result);
    let items: DeviceClassification[] = [];
    if (result.ok && result.data?.items) {
      items = result.data.items;
    } else {
      items = (deviceRows || [])
        .map((row) => ({ ...row, invalid_reasons: detectInvalidReasons(row) }))
        .filter((row) => (row.invalid_reasons || []).length > 0)
        .slice(0, 500);
      message.info("当前后端不支持智能筛查接口，已切换为前端本地筛查模式。");
    }
    setLoadingInvalidCandidates(false);
    setInvalidCandidates(items);
    setInvalidCandidatesDrawerOpen(true);
  }, [client, deviceRows, onApiActivity]);

  const purgeInvalidCandidates = React.useCallback(async () => {
    const result = await client.purgeInvalidDeviceClassificationCandidates();
    onApiActivity("DELETE /api/v1/equipment/device-classifications/invalid-candidates", result);
    if (!result.ok || !result.data) {
      message.error(result.message || "异常候选纳入治理失败");
      return;
    }
    message.success(`已将 ${result.data.marked_count} 条候选标记为解析异常并隐藏，历史数据已保留`);
    setInvalidCandidates([]);
    setInvalidCandidatesDrawerOpen(false);
    void loadDeviceTree();
  }, [client, loadDeviceTree, onApiActivity]);

  const openCorrectionDrawer = React.useCallback((row?: DeviceClassification | null) => {
    const target = row || selectedDevice;
    if (!target) {
      message.info("请先选择目录条目");
      return;
    }
    setSelectedDeviceId(target.catalog_id);
    correctionForm.setFieldsValue({
      catalog_code: deviceCode(target),
      catalog_name: target.level_2_category || target.level_1_category || target.major_category_name,
      current_status: target.data_status_label || "有效",
      source_batch: target.batch_id,
      source_file: target.source_file_name,
      source_position: `第 ${target.row_number} 行`,
      abnormal_type: (target.level_2_category || "").startsWith("-") ? "解析噪声" : "目录名称异常",
      correction_action: (target.level_2_category || "").startsWith("-") ? "标记作废" : "修正字段",
      reason: (target.level_2_category || "").startsWith("-") ? "目录名称以异常连接符开头，疑似解析噪声" : "",
      handling_note: "",
      hide_in_tree: true,
      need_review: true
    });
    setCorrectionDrawerOpen(true);
  }, [correctionForm, selectedDevice]);

  const submitCorrection = React.useCallback(async () => {
    if (!selectedDevice?.catalog_id) return;
    const values = await correctionForm.validateFields();
    setCorrectionSubmitting(true);
    const result = await client.createDeviceClassificationCorrection(selectedDevice.catalog_id, {
      abnormal_type: values.abnormal_type,
      correction_action: values.correction_action,
      reason: values.reason,
      handling_note: values.handling_note,
      hide_in_tree: values.hide_in_tree,
      need_review: values.need_review
    });
    setCorrectionSubmitting(false);
    onApiActivity("POST /api/v1/equipment/device-classifications/{catalog_id}/corrections", result);
    if (!result.ok) {
      message.error(result.message || "纠错提交失败");
      return;
    }
    message.success("纠错单已提交，等待审核确认");
    setCorrectionDrawerOpen(false);
    void loadCorrectionOrders();
    void loadDeviceTree();
  }, [client, correctionForm, loadCorrectionOrders, loadDeviceTree, onApiActivity, selectedDevice?.catalog_id]);

  const downloadSourceFile = async (item: EquipmentSourceFile) => {
    const result = await client.downloadEquipmentSourceFile(item.batch_id);
    if (!result.ok || !result.data) {
      message.error(result.message || "原文件下载失败");
      return;
    }
    const url = URL.createObjectURL(result.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.source_file_name || `${item.batch_id}.bin`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSourceFileByBatch = async (batchId: string, fileName?: string | null) => {
    const result = await client.downloadEquipmentSourceFile(batchId);
    if (!result.ok || !result.data) {
      message.error(result.message || "原文件下载失败");
      return;
    }
    const url = URL.createObjectURL(result.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || `${batchId}.bin`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSourceFileForDevice = async (item: DeviceClassification) => {
    const result = await client.downloadDeviceClassificationSourceFile(item.catalog_id);
    if (!result.ok || !result.data) {
      message.error(result.message || "源文件下载失败");
      return;
    }
    const url = URL.createObjectURL(result.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.source_file_name || `${item.batch_id}.bin`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };


  const sourceFileColumns: ColumnsType<EquipmentSourceFile> = [
    { title: "文件题名", dataIndex: "source_file_name", width: 220, ellipsis: true },
    { title: "档案门类", width: 130, render: (_v, item) => archiveCategoryForSource(item.source_type).category },
    { title: "数据域", width: 130, render: (_v, item) => archiveCategoryForSource(item.source_type).domain },
    { title: "来源单位", dataIndex: "source_system", width: 130, render: (value: string | null) => value || "-" },
    { title: "导入时间", dataIndex: "saved_at", width: 180, render: (value: string | null) => value ? new Date(value).toLocaleString() : "-" },
    { title: "导入人", dataIndex: "imported_by", width: 120, render: (value: string | null) => value || "-" },
    { title: "权威级别", dataIndex: "authority_level", width: 110, render: (value: string | null) => value || "未标注" },
    { title: "归档状态", width: 100, render: () => archiveStatusTag("已归档") },
    { title: "哈希值", dataIndex: "sha256", width: 260, ellipsis: true, render: (value: string | null) => value || "-" },
    { title: "大小", dataIndex: "source_file_size_bytes", width: 100, render: displaySize },
    { title: "批次", dataIndex: "batch_id", width: 210, ellipsis: true },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 90,
      render: (_: unknown, item: EquipmentSourceFile) => (
        <Button size="small" icon={<Download size={14} />} onClick={() => void downloadSourceFile(item)}>下载</Button>
      )
    }
  ];

  const archiveVolumeColumns: ColumnsType<SourceArchiveVolume> = [
    { title: "档案卷名称", dataIndex: "volume_name", width: 260, ellipsis: true },
    { title: "档案门类", dataIndex: "category", width: 120 },
    { title: "数据域", dataIndex: "domain", width: 130 },
    { title: "来源单位", dataIndex: "source_unit", width: 120 },
    { title: "关联批次数", width: 90, render: (_v, row) => row.batches.length || row.files.length },
    { title: "文件数量", width: 80, render: (_v, row) => row.files.length },
    { title: "支撑数据量", dataIndex: "supported_count", width: 90 },
    { title: "异常数据量", dataIndex: "abnormal_count", width: 90 },
    { title: "归档状态", dataIndex: "status", width: 90, render: archiveStatusTag },
    { title: "最近更新时间", dataIndex: "updated_at", width: 160, render: displayDateTime },
  ];

  const categoryColumns: ColumnsType<EquipmentCategory> = [
    { title: "分类编码", dataIndex: "category_code", width: 150 },
    { title: "分类名称", dataIndex: "category_name", width: 220 },
    { title: "父级分类", dataIndex: "parent_category_id", width: 230 },
    { title: "层级", dataIndex: "level_no", width: 80 },
    { title: "状态", dataIndex: "status", width: 90, render: statusTag },
    { title: "来源批次", dataIndex: "source_batch_id", width: 180 },
    { title: "更新时间", dataIndex: "updated_at", width: 170 }
  ];

  const categoryChildColumns: ColumnsType<EquipmentCategory> = [
    { title: "子分类编码", dataIndex: "category_code", width: 150 },
    { title: "子分类名称", dataIndex: "category_name", width: 220 },
    { title: "层级", dataIndex: "level_no", width: 80 },
    { title: "状态", dataIndex: "status", width: 90, render: statusTag }
  ];

  const standardColumns: ColumnsType<EquipmentStandardName> = [
    { title: "标准编码", dataIndex: "standard_code", width: 160 },
    { title: "设备标准名称", dataIndex: "standard_name", width: 220 },
    { title: "别名", dataIndex: "alias_names", width: 220, render: (value: string[]) => value?.join("；") || "-" },
    { title: "分类ID", dataIndex: "category_id", width: 260 },
    { title: "器械分类ID", dataIndex: "device_classification_id", width: 260 },
    { title: "常见厂家org_id", dataIndex: "common_manufacturer_org_ids", width: 240, render: (value: string[]) => value?.join("；") || "-" },
    { title: "管理类别", dataIndex: "management_class", width: 100 },
    { title: "状态", dataIndex: "status", width: 100, render: statusTag }
  ];

  const linkedStandardColumns: ColumnsType<EquipmentStandardName> = [
    { title: "标准编码", dataIndex: "standard_code", width: 150 },
    { title: "设备标准名称", dataIndex: "standard_name", width: 220 },
    { title: "管理类别", dataIndex: "management_class", width: 100 },
    { title: "状态", dataIndex: "status", width: 90, render: statusTag }
  ];

  const renderDiffByMode = React.useCallback(
    (before: string, after: string) => renderLatestWithChangeMark(before, after, showChangeMarks && devicePageSize < 500),
    [devicePageSize, showChangeMarks]
  );

  const deviceListColumns: ColumnsType<DeviceClassification> = [
    {
      title: "序号",
      key: "row_index",
      width: 48,
      render: (_: unknown, row) => (
        <span className="device-row-index">
          {visibleDeviceRows.findIndex((item) => item.catalog_id === row.catalog_id) + 1}
        </span>
      )
    },
    {
      title: "分类编码",
      dataIndex: "catalog_id",
      width: 76,
      render: (_: unknown, row) => <span className="device-code-muted">{deviceCode(row)}</span>
    },
    {
      title: "目录条目",
      dataIndex: "level_2_category",
      width: 180,
      render: (_: unknown, row) => (
        <div className="device-list-name">
          <strong>{row.level_2_category || "-"}</strong>
          <span>{row.level_1_category || "-"}</span>
        </div>
      )
    },
    {
      title: "产品描述",
      dataIndex: "product_description",
      width: 360,
      render: (_: string | null, row) => {
        const before = row.latest_revision?.old_payload?.product_description || "";
        const after = latestFieldValue(row, "product_description");
        return <span className="device-list-muted device-list-fulltext">{renderDiffByMode(before, after)}</span>;
      }
    },
    {
      title: "预期用途",
      dataIndex: "intended_use",
      width: 300,
      render: (_: string | null, row) => (
        <span className="device-list-muted device-list-fulltext">
          {renderDiffByMode(row.latest_revision?.old_payload?.intended_use || "", latestFieldValue(row, "intended_use"))}
        </span>
      )
    },
    {
      title: "品名举例",
      dataIndex: "product_examples",
      width: 300,
      render: (_: string | null, row) => (
        <span className="device-list-muted device-list-fulltext">
          {renderDiffByMode(row.latest_revision?.old_payload?.product_examples || "", latestFieldValue(row, "product_examples"))}
        </span>
      )
    },
    {
      title: "管理类别",
      dataIndex: "management_class",
      width: 80,
      render: (value: string | null) => value ? governanceTag(value, value.includes("Ⅲ") || value.includes("III") ? "red" : "green") : "-"
    },
    {
      title: "数据状态",
      dataIndex: "data_status",
      width: 92,
      render: (_value: string | null, row) => deviceStatusTag(row)
    },
    {
      title: "操作",
      key: "actions",
      width: 136,
      fixed: "right",
      render: (_: unknown, row) => (
        <Space size={2}>
          <Button
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedDeviceId(row.catalog_id);
              setDeviceDetailDrawerOpen(true);
            }}
          >
            详情
          </Button>
          <Button size="small" type="text" onClick={(event) => { event.stopPropagation(); openCorrectionDrawer(row); }}>发起纠错</Button>
        </Space>
      )
    },
  ];

  const paginationProps = (
    result: ApiResult<PagedResult<unknown>> | null,
    current: { page: number; pageSize: number },
    onChange: (next: { page: number; pageSize: number }) => void
  ) => ({
    current: current.page,
    pageSize: current.pageSize,
    total: result?.data?.page.total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [20, 50, 100],
    showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
    onChange: (page: number, pageSize: number) => onChange({ page, pageSize })
  });

  const validationStatusTag = (status?: string | null) => {
    if (status === "通过") {
      return <Tag color="success">通过</Tag>;
    }
    if (status === "错误") {
      return <Tag color="error">错误</Tag>;
    }
    if (status === "待人工确认") {
      return <Tag color="processing">待人工确认</Tag>;
    }
    return <Tag color="warning">{status || "警告"}</Tag>;
  };

  const saveDeviceImportDraft = () => {
    window.localStorage.setItem("hmdm-device-import-draft", JSON.stringify({
      deviceImportFileName,
      deviceImportFileType,
      deviceImportSource,
      deviceImportSourceLink,
      deviceImportPublishDate,
      deviceImportEffectiveDate,
      deviceImportAuthoritative,
      deviceImportMode,
      deviceImportBatchName,
      deviceImportReason,
      deviceImportScope,
      deviceImportAuthorityLevel,
      deviceImportRemark,
      savedAt: new Date().toISOString(),
    }));
    message.success("导入草稿已保存到本机");
  };

  const downloadDeviceValidationReport = () => {
    const payload = {
      generated_at: new Date().toISOString(),
      batch_name: deviceImportBatchName,
      source_file_name: deviceImportFileName,
      import_mode: deviceImportMode,
      preview: deviceImportPreview?.data || null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${deviceImportBatchName || "device-classification-import"}-validation-report.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const parseOnlyDeviceImport = async () => {
    setDeviceImportMode("仅解析不入库");
    const parsed = await previewDeviceImport({ importMode: "仅解析不入库" });
    if (!parsed) {
      return;
    }
    setDeviceImportMode("仅解析不入库");
    message.success("已完成解析预览，未写入正式目录表");
  };

  const openDeviceImportHistory = async (batchId: string) => {
    const result = await client.getDeviceClassificationImportHistory(batchId);
    setDeviceImportHistoryDetail(result);
    setDeviceImportHistoryDrawerOpen(true);
    onApiActivity("GET /api/v1/equipment/device-classifications/import/history/{batch_id}", result);
  };

  const copyHistoryAsImport = (record: DeviceImportHistoryRecord) => {
    setDeviceImportMode(record.import_mode || "增量更新");
    setDeviceImportBatchName(`${record.source_file_name || "历史批次"} 复制导入`);
    setDeviceImportFileName(record.source_file_name || "");
    setDeviceImportSource(record.source_name || "国家药监局");
    setDeviceImportSourceLink(record.source_url || "");
    setDeviceImportReason(record.import_reason || "基于历史导入记录复制新批次");
    setDeviceImportStep(0);
    message.info("已复制历史记录元数据，请重新上传原始文件");
  };

  return (
    <section className={`equipment-workbench ${activeKey === "device-classifications" ? "equipment-workbench-device" : ""}`}>
      <Space direction="vertical" size={14} className="vendor-tab">
        {activeKey !== "device-classifications" ? (
        <div className="section-toolbar">
          <Space wrap>
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="编码、名称、品名举例" prefix={<Search size={16} />} />
            <Input value={managementClass} onChange={(event) => setManagementClass(event.target.value)} placeholder="管理类别 I/II/III" />
            <Button icon={<RefreshCw size={16} />} onClick={resetPagesAndRefresh}>查询真实库</Button>
          </Space>
          {activeKey === "standard-names" ? totalBadge(standards) : totalBadge(categories)}
        </div>
        ) : null}

        {activeKey === "device-classifications" ? (
          <div
            className="device-governance-shell"
            ref={deviceShellRef}
            style={deviceShellHeight > 0 ? { height: deviceShellHeight } : undefined}
          >
            <div className="device-compact-header">
              <div>
                <h2>国家医疗器械分类目录与院内映射治理</h2>
                <p>基于国家医疗器械分类目录，维护院内设备、耗材、编码及管理类别映射关系</p>
              </div>
              <Space size={6}>
                <Select
                  size="small"
                  value={deviceDataStatus}
                  options={DEVICE_STATUS_OPTIONS}
                  style={{ width: 104 }}
                  onChange={(value) => setDeviceDataStatus(value)}
                />
                <Popover
                  title="来源详情"
                  content={(
                    <div className="device-source-popover">
                      <p>标准来源：{nmpaStandard.fullSource}</p>
                      <p>公告编号：{nmpaStandard.announcement}</p>
                      <p>索引号：{nmpaStandard.indexNo}</p>
                      <p>发布日期：{nmpaStandard.publishDate}</p>
                      <p>施行日期：{nmpaStandard.effectiveDate}</p>
                    </div>
                  )}
                >
                  <Button size="small">来源详情</Button>
                </Popover>
              <Popover
                title="数据概况"
                content={(
                  <div className="device-overview-popover">
                    <div><span>标准来源</span><strong>NMPA</strong></div>
                    <div><span>公告编号</span><strong>{nmpaStandard.announcement}</strong></div>
                    <div><span>标准状态</span><strong>{nmpaStandard.status}</strong></div>
                    <div><span>目录条目总数</span><strong>{deviceMetrics.total}</strong></div>
                    <div><span>大类数量</span><strong>{deviceMetrics.major}</strong></div>
                    <div><span>一级类别数量</span><strong>{deviceMetrics.level1}</strong></div>
                    <div><span>二级类别数量</span><strong>{deviceMetrics.level2}</strong></div>
                    <div><span>已修订条目数</span><strong>{deviceMetrics.revised}</strong></div>
                    <div><span>已映射条目数</span><strong>{deviceMetrics.mapped}</strong></div>
                    <div><span>待映射条目数</span><strong>{deviceMetrics.pending}</strong></div>
                    <div><span>待确认数</span><strong>65</strong></div>
                    <div><span>管理类别冲突数</span><strong>7</strong></div>
                    <div><span>最近同步</span><strong>{displayDateTime(deviceMetrics.lastUpdatedAt)}</strong></div>
                    <div><span>影响系统数</span><strong>4</strong></div>
                  </div>
                )}
              >
                <Button size="small">数据概况</Button>
              </Popover>
              <Popover
                trigger="click"
                placement="bottomRight"
                title="目录搜索"
                content={(
                  <div className="device-search-popover">
                    <Input
                      allowClear
                      className="device-smart-search"
                      value={deviceSearchInput}
                      onChange={(event) => setDeviceSearchInput(event.target.value)}
                      onPressEnter={() => applyDeviceSearch(deviceSearchInput)}
                      placeholder="搜索分类编码、目录条目、品名举例、注册证名称、院内设备/耗材、医保编码、供应商"
                      prefix={<Search size={16} />}
                    />
                    <div className="device-search-presets">
                      <span>预搜索：</span>
                      <Space size={6} wrap>
                        {deviceSearchPresets.map((word) => (
                          <Tag
                            key={word}
                            className="device-search-preset-tag"
                            onClick={() => applyDeviceSearch(word)}
                          >
                            {word}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                    {deviceSearchHistory.length ? (
                      <div className="device-search-presets">
                        <span>历史搜索：</span>
                        <Space size={6} wrap>
                          {deviceSearchHistory.map((word) => (
                            <Tag key={`history-${word}`} className="device-search-history-tag" onClick={() => applyDeviceSearch(word)}>
                              {word}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    ) : null}
                  </div>
                )}
              >
                <Button size="small">搜索 <ChevronDown size={14} /></Button>
              </Popover>
              <Button
                size="small"
                icon={<FileUp size={14} />}
                disabled={importing}
                onClick={() => {
                  resetDeviceImportWizard();
                  setDeviceImportWizardOpen(true);
                }}
              >
                导入目录
              </Button>
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: "refresh-catalog", label: "刷新目录" },
                    { key: "import-catalog", label: importing ? "导入目录（进行中）" : "导入目录" },
                    { key: "mapping-maintain", label: "映射" },
                    { key: "quality-check", label: "质检" },
                    { key: "impact-analysis", label: "分析" },
                    { type: "divider" },
                    { key: "export-catalog", label: "导出目录", onClick: () => onOpenDeviceExport?.() },
                    { key: "export-mapping", label: "导出映射表" },
                    { key: "export-quality", label: "导出质检报告" },
                    { type: "divider" },
                    { key: "source-files", label: "来源文件归档", icon: <Download size={14} />, onClick: () => setSourceDrawerOpen(true) },
                    { key: "invalid-scan", label: "智能筛查异常数据", onClick: () => void loadInvalidCandidates() },
                    { key: "invalid-purge", label: "异常候选纳入纠错闭环", onClick: () => void purgeInvalidCandidates() },
                    { key: "correction-ledger", label: "数据纠错台账", onClick: () => { setCorrectionLedgerOpen(true); void loadCorrectionOrders(); } },
                    { key: "history", label: showHistory ? "隐藏历史条目" : "显示历史条目", onClick: () => setShowHistory((value) => !value) },
                    { key: "marks", label: showChangeMarks ? "隐藏变更标注" : "显示变更标注", onClick: () => setShowChangeMarks((value) => !value) },
                    { key: "expand", label: changedNodesExpanded ? "收起新增和修订" : "展开新增和修订", onClick: () => void expandChangedDeviceNodes() }
                  ],
                  onClick: ({ key }) => {
                    if (key === "refresh-catalog") {
                      void loadDeviceTree();
                      message.success("已刷新目录数据");
                    }
                    if (key === "import-catalog") {
                      if (importing) {
                        return;
                      }
                      resetDeviceImportWizard();
                      setDeviceImportWizardOpen(true);
                    }
                    if (key === "export-catalog") {
                      onOpenDeviceExport?.();
                    }
                  }
                }}
              >
                <Button size="small">更多操作 <ChevronDown size={14} /></Button>
              </Dropdown>
              </Space>
            </div>

          </div>
        ) : (
        <div className="equipment-import-panel">
          <Form layout="inline">
            <Form.Item label="导入对象">
              <Select value={sourceType} onChange={changeSourceType} options={sourceTypeOptions} style={{ width: 190 }} />
            </Form.Item>
            <Form.Item label="数据维护来源">
              <Input value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)} />
            </Form.Item>
            <Form.Item label="批次号">
              <Input value={sourceTxId} onChange={(event) => setSourceTxId(event.target.value)} placeholder="可选" />
            </Form.Item>
            <Form.Item label="Sheet">
              <Input value={sheetName} onChange={(event) => setSheetName(event.target.value)} placeholder="可选" />
            </Form.Item>
            <Form.Item>
              <Upload beforeUpload={(nextFile) => { setFile(nextFile); return false; }} maxCount={1}>
                <Button icon={<FileUp size={16} />}>选择真实文件</Button>
              </Upload>
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={() => void submitImport()} loading={importing}>导入装备字典</Button>
            </Form.Item>
          </Form>
          <ImportResult result={importResult} />
          <div className="equipment-source-strip">
            <strong>来源文件归档</strong>
            {(sourceFiles?.data?.items || []).slice(0, 4).map((item) => (
              <Button key={item.batch_id} size="small" icon={<Download size={14} />} onClick={() => void downloadSourceFile(item)}>
                {item.source_file_name} · {displaySize(item.source_file_size_bytes)}
              </Button>
            ))}
            {(sourceFiles?.data?.items || []).length === 0 ? <span>暂无归档源文件</span> : null}
          </div>
        </div>
        )}

        <Tabs
          className="equipment-module-tabs equipment-module-tabs-hidden"
          activeKey={activeKey}
          items={[
            {
              key: "categories",
              label: <span className="equipment-module-tab-label">设备分类目录</span>,
              children: (
                <div className="equipment-tree-layout">
                  <aside className="equipment-tree-pane">
                    <div className="equipment-pane-title">
                      <strong>分类树</strong>
                      <Tag>{categoryTreeRows.length} 个节点</Tag>
                    </div>
                    {categoryTree.length > 0 ? (
                      <Tree
                        blockNode
                        showLine
                        treeData={categoryTree}
                        selectedKeys={selectedCategoryId ? [selectedCategoryId] : []}
                        defaultExpandAll={categoryTreeRows.length <= 40}
                        onSelect={(keys) => setSelectedCategoryId(keys[0] ? String(keys[0]) : null)}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类节点" />
                    )}
                  </aside>
                  <div className="equipment-tree-detail">
                    <div className="equipment-detail-header">
                      <div>
                        <span>当前分类</span>
                        <strong>{selectedCategory ? categoryLabel(selectedCategory) : "未选择"}</strong>
                      </div>
                      {selectedCategory ? statusTag(selectedCategory.status) : null}
                    </div>
                    {selectedCategory ? (
                      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                        <Descriptions.Item label="分类ID">{selectedCategory.category_id}</Descriptions.Item>
                        <Descriptions.Item label="父级ID">{selectedCategory.parent_category_id || "-"}</Descriptions.Item>
                        <Descriptions.Item label="层级">{selectedCategory.level_no ?? "-"}</Descriptions.Item>
                        <Descriptions.Item label="数据维护来源">{selectedCategory.source_system || "-"}</Descriptions.Item>
                        <Descriptions.Item label="来源批次">{selectedCategory.source_batch_id || "-"}</Descriptions.Item>
                        <Descriptions.Item label="更新时间">{selectedCategory.updated_at || "-"}</Descriptions.Item>
                        <Descriptions.Item label="备注" span={3}>{selectedCategory.remark || "-"}</Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择左侧分类查看详情" />
                    )}

                    <div className="equipment-split-tables">
                      <section>
                        <div className="equipment-pane-title">
                          <strong>下级分类</strong>
                          <Tag>{categoryChildren.length}</Tag>
                        </div>
                        <Table
                          rowKey="category_id"
                          columns={categoryChildColumns}
                          dataSource={categoryChildren}
                          pagination={false}
                          size="small"
                          scroll={{ x: 560 }}
                        />
                      </section>
                      <section>
                        <div className="equipment-pane-title">
                          <strong>关联设备标准名称</strong>
                          <Tag>{linkedStandards?.data?.page.total ?? 0}</Tag>
                        </div>
                        <Table
                          rowKey="standard_id"
                          columns={linkedStandardColumns}
                          dataSource={linkedStandards?.data?.items || []}
                          pagination={false}
                          size="small"
                          scroll={{ x: 620 }}
                        />
                      </section>
                    </div>

                    <div className="equipment-pane-title">
                      <strong>分类目录列表</strong>
                      <Tag>{categories?.data?.page.total ?? 0}</Tag>
                    </div>
                    <Table
                      rowKey="category_id"
                      columns={categoryColumns}
                      dataSource={categories?.data?.items || []}
                      pagination={paginationProps(categories, categoryPage, setCategoryPage)}
                      scroll={{ x: 1220 }}
                    />
                  </div>
                </div>
              )
            },
            {
              key: "standard-names",
              label: <span className="equipment-module-tab-label">设备标准名称</span>,
              children: (
                <Table
                  rowKey="standard_id"
                  columns={standardColumns}
                  dataSource={standards?.data?.items || []}
                  pagination={paginationProps(standards, standardPage, setStandardPage)}
                  scroll={{ x: 1560 }}
                />
              )
            },
            {
              key: "device-classifications",
              label: <span className="equipment-module-tab-label">医疗器械分类目录</span>,
              children: (
                <div
                  className="device-governance-workspace"
                  style={deviceWorkspaceStyle}
                >
                  <aside className="device-governance-card device-tree-column">
                    <div className="device-tree-column-head">分类树</div>
                    <div className="device-tree-toolbar">
                    <Input
                        allowClear
                        size="small"
                        value={deviceTreeSearchInput}
                        onChange={(event) => setDeviceTreeSearchInput(event.target.value)}
                        placeholder="搜索分类编码/名称"
                        prefix={<Search size={14} />}
                      />
                      <Space size={6}>
                        <Button
                          size="small"
                          onClick={() => {
                            const hasExpanded = deviceExpandedKeys.length > 0;
                            if (hasExpanded) {
                              setDeviceExpandedKeys([]);
                              setDeviceAutoExpandParent(false);
                            } else {
                              setDeviceExpandedKeys(deviceNavigationTree.map((n) => n.key as React.Key));
                              setDeviceAutoExpandParent(false);
                            }
                          }}
                        >
                          {deviceExpandedKeys.length > 0 ? "收起" : "展开"}
                        </Button>
                      </Space>
                    </div>
                    <div className="device-tree-scroll-shell">
                      {filteredDeviceNavigationTree.length > 0 ? (
                        <Tree.DirectoryTree
                          blockNode
                          showLine={false}
                          showIcon={false}
                          expandAction="click"
                          treeData={filteredDeviceNavigationTree}
                          selectedKeys={selectedDeviceTreeKey ? [selectedDeviceTreeKey] : []}
                          expandedKeys={deviceExpandedKeys}
                          autoExpandParent={deviceAutoExpandParent}
                          onSelect={(keys) => {
                            const nextKey = keys[0];
                            if (!nextKey) {
                              return;
                            }
                            if (String(nextKey) === String(selectedDeviceTreeKey || "")) {
                              return;
                            }
                            setDeviceSearchInput("");
                            setDebouncedDeviceKeyword("");
                            setDeviceSearchPending(false);
                            setSelectedDeviceTreeKey(nextKey);
                            setSelectedDeviceId(null);
                          }}
                          onExpand={(keys) => {
                            setDeviceExpandedKeys(keys);
                            setDeviceAutoExpandParent(false);
                            setChangedNodesExpanded(false);
                          }}
                          onRightClick={({ node }) => {
                            const row = deviceRows.find((item) => matchesDeviceTreeKey(item, node.key));
                            if (row) {
                              openCorrectionDrawer(row);
                            }
                          }}
                        />
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无器械分类" />
                      )}
                    </div>
                    <button
                      type="button"
                      className="device-tree-resizer"
                      aria-label="拖动调整分类树宽度"
                      title="拖动调整分类树宽度，双击恢复默认宽度"
                      onMouseDown={startDeviceTreeResize}
                      onDoubleClick={() => {
                        setTreeWidthCustomized(false);
                        setDeviceTreeWidth(estimateTreeWidth(deviceRows));
                      }}
                    />
                  </aside>

                  <section className="device-governance-card device-list-column" ref={deviceListColumnRef}>
                    <div className="device-list-topbar">
                      <span>{selectedTreeSummary}</span>
                      <Space size={10}>
                        <span>当前记录数：{visibleDeviceRows.length}</span>
                        <span>已映射：{deviceMetrics.mapped}</span>
                        <span>待治理：{Math.max(0, visibleDeviceRows.length - deviceMetrics.mapped)}</span>
                      </Space>
                    </div>
                    <Table
                      rowKey="catalog_id"
                      columns={deviceListColumns}
                      dataSource={visibleDeviceRows}
                      size="small"
                      sticky
                      pagination={{
                        pageSize: devicePageSize,
                        showSizeChanger: true,
                        pageSizeOptions: [20, 30, 50, 100, 200, 500, 1000, 2000],
                        showQuickJumper: true,
                        position: ["bottomLeft"],
                        align: "end",
                        onShowSizeChange: (_page, size) => setDevicePageSize(size)
                      }}
                      scroll={{ x: 1706, y: deviceTableScrollY }}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="未找到匹配目录条目，可尝试更换关键词或清除筛选条件。"
                          />
                        )
                      }}
                      rowClassName={(row) => row.catalog_id === selectedDevice?.catalog_id ? "selected-row" : ""}
                      onRow={(row) => ({
                        onClick: () => {
                          setSelectedDeviceId(row.catalog_id);
                        },
                        onDoubleClick: () => {
                          setSelectedDeviceId(row.catalog_id);
                          setDeviceDetailDrawerOpen(true);
                        }
                      })}
                    />
                  </section>
                </div>
              )
            }
          ]}
        />
      </Space>
      <Drawer
        title="医疗器械分类目录导入流水线"
        open={deviceImportWizardOpen}
        onClose={() => setDeviceImportWizardOpen(false)}
        width={deviceImportFullscreen ? "100vw" : 880}
        maskClosable={false}
        className={deviceImportFullscreen ? "device-import-drawer is-fullscreen" : "device-import-drawer"}
        extra={(
          <Space>
            <Button size="small" onClick={() => setDeviceImportFullscreen((value) => !value)}>
              {deviceImportFullscreen ? "退出全屏" : "全屏展开"}
            </Button>
          </Space>
        )}
      >
        <div className="device-import-wizard">
          <Steps
            size="small"
            current={deviceImportStep}
            onChange={setDeviceImportStep}
            items={[
              { title: "选择来源文件" },
              { title: "建立导入批次" },
              { title: "解析与预览" },
              { title: "数据核验" },
              { title: "确认入库" }
            ]}
          />
          {deviceImportStep === 0 ? (
            <section className="device-import-panel">
              <h3>选择来源文件</h3>
              <div className="device-import-grid">
                <div className="device-import-upload">
                  <Upload
                    accept=".docx,.pdf,.xlsx"
                    maxCount={1}
                    beforeUpload={(nextFile) => {
                      setDeviceImportFile(nextFile);
                      setDeviceImportFileName(nextFile.name);
                      setDeviceImportBatchName(`${nextFile.name.replace(/\.[^.]+$/, "")} 导入批次`);
                      setDeviceImportFileUploadedAt(new Date().toISOString());
                      setDeviceImportPreview(null);
                      return false;
                    }}
                    onRemove={() => {
                      setDeviceImportFile(null);
                      setDeviceImportPreview(null);
                      setDeviceImportFileUploadedAt("");
                    }}
                    showUploadList={false}
                  >
                    <Button icon={<FileUp size={16} />}>原始文件上传</Button>
                  </Upload>
                  {deviceImportFile ? (
                    <div className="device-import-file-card">
                      <div className="device-import-file-main">
                        <Tooltip title={deviceImportFile.name}>
                          <strong className="device-import-file-name">{middleEllipsis(deviceImportFile.name, 28, 12)}</strong>
                        </Tooltip>
                        <span>{displaySize(deviceImportFile.size)} · {deviceImportFile.name.split(".").pop()?.toUpperCase() || "FILE"} · 已上传</span>
                      </div>
                      <Space size={4}>
                        <Button size="small" type="link" onClick={() => window.open(URL.createObjectURL(deviceImportFile), "_blank")}>查看原件</Button>
                        <Button size="small" type="link" onClick={() => {
                          const url = URL.createObjectURL(deviceImportFile);
                          const anchor = document.createElement("a");
                          anchor.href = url;
                          anchor.download = deviceImportFile.name;
                          anchor.click();
                          URL.revokeObjectURL(url);
                        }}>下载</Button>
                        <Button size="small" type="link" danger onClick={() => {
                          setDeviceImportFile(null);
                          setDeviceImportPreview(null);
                          setDeviceImportFileUploadedAt("");
                        }}>移除</Button>
                      </Space>
                      <Descriptions size="small" column={1} bordered>
                        <Descriptions.Item label="完整文件名">{deviceImportFile.name}</Descriptions.Item>
                        <Descriptions.Item label="文件大小">{displaySize(deviceImportFile.size)}</Descriptions.Item>
                        <Descriptions.Item label="文件类型">{deviceImportFile.name.split(".").pop()?.toUpperCase() || "-"}</Descriptions.Item>
                        <Descriptions.Item label="上传时间">{displayDateTime(deviceImportFileUploadedAt)}</Descriptions.Item>
                        <Descriptions.Item label="文件状态">已上传，待解析</Descriptions.Item>
                      </Descriptions>
                    </div>
                  ) : null}
                </div>
                <Form layout="vertical" className="device-import-form-grid">
                  <Form.Item label="文件类型">
                    <Select value={deviceImportFileType} onChange={setDeviceImportFileType} options={deviceImportFileTypeOptions} />
                  </Form.Item>
                  <Form.Item label="文件来源">
                    <Select value={deviceImportSource} onChange={setDeviceImportSource} options={deviceImportSourceOptions} />
                  </Form.Item>
                  <Form.Item label="来源链接">
                    <Input value={deviceImportSourceLink} onChange={(event) => setDeviceImportSourceLink(event.target.value)} placeholder="可填写来源网页、公告或内网地址" />
                  </Form.Item>
                  <Form.Item label="文件发布日期">
                    <Input type="date" value={deviceImportPublishDate} onChange={(event) => setDeviceImportPublishDate(event.target.value)} />
                  </Form.Item>
                  <Form.Item label="文件生效日期">
                    <Input type="date" value={deviceImportEffectiveDate} onChange={(event) => setDeviceImportEffectiveDate(event.target.value)} />
                  </Form.Item>
                  <Form.Item label="是否作为权威源">
                    <Select value={deviceImportAuthoritative} onChange={setDeviceImportAuthoritative} options={[{ value: "是", label: "是" }, { value: "否", label: "否" }]} />
                  </Form.Item>
                </Form>
              </div>
              <div className="device-import-mode-section">
                <div className="device-import-panel-head">
                  <h3>导入模式</h3>
                  <Popover title="我该选哪个？" content={importModeHelpContent} trigger="click" placement="leftTop">
                    <Button size="small" type="link">我该选哪个？</Button>
                  </Popover>
                </div>
                <div className="device-import-mode-grid">
                  {deviceImportModes.map((mode) => {
                    const disabled = mode.value === "初始化导入" && !isDeviceCatalogEmpty;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        className={`device-import-mode-card${deviceImportMode === mode.value ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                        disabled={disabled}
                        aria-pressed={deviceImportMode === mode.value}
                        title={disabled ? "当前已有正式目录，请选择增量更新、版本重建或覆盖修正" : mode.scene}
                        onClick={() => {
                          if (!disabled) {
                            setDeviceImportMode(mode.value);
                          }
                        }}
                      >
                        <strong>{mode.value}</strong>
                        <span>{mode.scene}</span>
                        <em>{mode.risk}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}
          {deviceImportStep === 1 ? (
            <section className="device-import-panel">
              <h3>建立导入批次</h3>
              {deviceImportPreview?.data?.is_initial_import || deviceRows.length === 0 ? (
                <Alert showIcon type="info" message="当前医疗器械分类目录为空，本次导入将作为初始化基准版本。" />
              ) : null}
              <Form layout="vertical" className="device-import-form-grid">
                <Form.Item label="导入批次名称">
                  <Input value={deviceImportBatchName} onChange={(event) => setDeviceImportBatchName(event.target.value)} placeholder="例如：国家医疗器械分类目录初始化批次" />
                </Form.Item>
                <Form.Item label="导入批次号">
                  <Input value={deviceImportBatchId || deviceImportPreview?.data?.batch_id || "解析后自动生成"} disabled />
                </Form.Item>
                <Form.Item label="原始文件名称">
                  <Input value={deviceImportFileName} onChange={(event) => setDeviceImportFileName(event.target.value)} />
                </Form.Item>
                <Form.Item label="导入理由">
                  <Input.TextArea rows={3} value={deviceImportReason} onChange={(event) => setDeviceImportReason(event.target.value)} />
                </Form.Item>
                <Form.Item label="适用范围">
                  <Input value={deviceImportScope} onChange={(event) => setDeviceImportScope(event.target.value)} />
                </Form.Item>
                <Form.Item label="数据权威级别">
                  <Select value={deviceImportAuthorityLevel} onChange={setDeviceImportAuthorityLevel} options={deviceAuthorityLevelOptions} />
                </Form.Item>
                <Form.Item label="备注">
                  <Input.TextArea rows={3} value={deviceImportRemark} onChange={(event) => setDeviceImportRemark(event.target.value)} />
                </Form.Item>
              </Form>
              <div className="device-operator-readonly">
                {!operatorContextValid ? (
                  <Alert showIcon type="error" message="当前登录用户信息异常，禁止执行入库操作" />
                ) : null}
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="操作人">{currentOperatorName || "-"}</Descriptions.Item>
                  <Descriptions.Item label="所属科室">{currentOperatorDepartment || "-"}</Descriptions.Item>
                  <Descriptions.Item label="操作角色">{currentOperatorRole || "-"}</Descriptions.Item>
                  <Descriptions.Item label="操作时间">{new Date().toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="登录IP">由后端自动记录</Descriptions.Item>
                  <Descriptions.Item label="终端信息">由后端自动记录</Descriptions.Item>
                </Descriptions>
              </div>
            </section>
          ) : null}
          {deviceImportStep === 2 ? (
            <section className="device-import-panel">
              <div className="device-import-panel-head">
                <h3>解析与预览</h3>
                <Button onClick={() => void previewDeviceImport()} loading={previewingDeviceImport} disabled={!deviceImportFile}>开始解析</Button>
              </div>
              {deviceImportPreview?.ok && deviceImportPreview.data ? (
              <>
                <Alert
                  showIcon
                  type={deviceImportPreview.data.parse_failed_count ? "warning" : "success"}
                  message={`解析完成，当前显示 ${filteredDeviceImportPreviewRows.length} 条预览记录`}
                  description={`共解析 ${deviceImportPreview.data.source_row_count} 条，成功 ${deviceImportPreview.data.parse_success_count ?? deviceImportPreview.data.source_row_count} 条，失败 ${deviceImportPreview.data.parse_failed_count ?? 0} 条，待人工确认 ${deviceImportPreview.data.pending_confirm_count ?? 0} 条。`}
                />
                {deviceImportPreview.data.batch_risk_summary ? (
                  <Alert
                    showIcon
                    type={deviceImportPreview.data.batch_risk_level === "high" ? "warning" : deviceImportPreview.data.batch_risk_level === "medium" ? "info" : "success"}
                    message={`批次风险：${deviceImportPreview.data.batch_risk_level === "high" ? "高" : deviceImportPreview.data.batch_risk_level === "medium" ? "中" : "低"}`}
                    description={deviceImportPreview.data.batch_risk_summary}
                  />
                ) : null}
                <div className="device-import-metrics">
                  <div><span>解析总条目数</span><strong>{deviceImportPreview.data.source_row_count}</strong></div>
                  <div><span>一级分类数量</span><strong>{deviceImportPreview.data.major_count}</strong></div>
                  <div><span>二级分类数量</span><strong>{deviceImportPreview.data.level_1_count}</strong></div>
                  <div><span>三级目录条目数量</span><strong>{deviceImportPreview.data.level_2_count}</strong></div>
                  <div><span>解析成功数量</span><strong>{deviceImportPreview.data.parse_success_count ?? deviceImportPreview.data.source_row_count}</strong></div>
                  <div><span>解析失败数量</span><strong>{deviceImportPreview.data.parse_failed_count ?? 0}</strong></div>
                  <div><span>待人工确认数量</span><strong>{deviceImportPreview.data.pending_confirm_count ?? 0}</strong></div>
                  <div><span>低置信度数量</span><strong>{deviceImportPreview.data.low_confidence_count ?? 0}</strong></div>
                </div>
                {deviceImportMode === "增量更新" ? (
                  <div className="device-change-metrics">
                    {["新增", "修改", "废止", "调整", "无变化", "待确认"].map((label) => (
                      <div key={label}><span>{label}条目数</span><strong>{changeTypeCounts[label] ?? 0}</strong></div>
                    ))}
                  </div>
                ) : null}
                <div className="device-import-filterbar">
                  <Input value={deviceImportPreviewKeyword} onChange={(event) => setDeviceImportPreviewKeyword(event.target.value)} placeholder="搜索分类、描述、品名举例或问题说明" prefix={<Search size={14} />} />
                  <Select
                    value={deviceImportPreviewFilter}
                    onChange={setDeviceImportPreviewFilter}
                    options={[
                      { value: "all", label: "全部记录" },
                      { value: "abnormal", label: "只看异常" },
                      { value: "pending", label: "只看待确认" }
                    ]}
                    style={{ width: 140 }}
                  />
                </div>
                <Table
                  rowKey={(row, index) => row.staging_id || `preview-${index}`}
                  size="small"
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  dataSource={filteredDeviceImportPreviewRows}
                  locale={{ emptyText: deviceImportPreview.data.samples.length === 0 ? "本次文件未解析到可预览记录" : "当前筛选条件下无记录，请切换为全部记录" }}
                  columns={[
                    { title: "分类编码", dataIndex: "catalog_code", width: 110 },
                    { title: "一级分类", dataIndex: "major_category_name", width: 140 },
                    { title: "二级分类", dataIndex: "level_1_category", width: 160 },
                    { title: "目录条目", dataIndex: "level_2_category", width: 180 },
                    { title: "产品描述", dataIndex: "product_description", width: 260 },
                    { title: "预期用途", dataIndex: "intended_use", width: 220 },
                    { title: "品名举例", dataIndex: "product_examples", width: 220 },
                    { title: "管理类别", dataIndex: "management_class", width: 90 },
                    { title: "变更类型", dataIndex: "change_type", width: 100, render: (value) => <Tag>{value || "待确认"}</Tag> },
                    { title: "解析状态", dataIndex: "parse_status", width: 110, render: validationStatusTag },
                    { title: "置信度", dataIndex: "confidence_score", width: 90, render: (value) => value == null ? "-" : <Tag color={Number(value) < 60 ? "orange" : "success"}>{value}</Tag> },
                    { title: "问题说明", dataIndex: "issue_message", width: 180, render: (value) => value || "-" }
                  ]}
                  scroll={{ x: 1860 }}
                />
              </>
            ) : deviceImportPreview && !deviceImportPreview.ok ? (
              <Alert type="error" showIcon message={deviceImportPreview.message || "解析失败"} />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择文件并点击开始解析后显示预览结果" />
            )}
          </section>
          ) : null}
          {deviceImportStep === 3 ? (
            <section className="device-import-panel">
              <h3>数据核验</h3>
              {deviceImportPreview?.data?.is_initial_import ? (
                <Alert showIcon type="info" message="当前数据库为空，本次为初始化导入，未发现历史版本差异。" />
              ) : null}
              <div className="device-validation-grid">
                {(deviceImportPreview?.data?.validation_results || []).map((item) => (
                  <div key={item.key} className={`device-validation-card status-${item.status}`}>
                    <div>
                      <strong>{item.label}</strong>
                      {validationStatusTag(item.status)}
                    </div>
                    <p>{item.message}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {deviceImportStep === 4 ? (
            <section className="device-import-panel">
              <h3>{deviceImportCompletedReport ? "导入完成" : "确认入库"}</h3>
              {deviceImportCompletedReport ? (
                <>
                  <Alert type="success" showIcon message="导入成功" />
                  <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="导入批次号">{deviceImportCompletedReport.batch_id}</Descriptions.Item>
                    <Descriptions.Item label="入库条目数">{deviceImportCompletedReport.success_count}</Descriptions.Item>
                    <Descriptions.Item label="当前目录版本">{deviceImportCompletedReport.catalog_version || deviceImportCompletedReport.batch_id}</Descriptions.Item>
                    <Descriptions.Item label="原始文件归档状态">{deviceImportCompletedReport.source_file ? "已归档" : "未归档"}</Descriptions.Item>
                    <Descriptions.Item label="核验报告生成状态">{deviceImportCompletedReport.validation_report_status || "已生成"}</Descriptions.Item>
                    <Descriptions.Item label="审计日志状态">{deviceImportCompletedReport.audit_log_status || "已记录导入操作"}</Descriptions.Item>
                    <Descriptions.Item label="可回滚状态">{deviceImportCompletedReport.rollback_supported === false ? "未启用" : "保留批次与原件，可按批次追溯"}</Descriptions.Item>
                  </Descriptions>
                  <Space wrap>
                    <Button onClick={downloadDeviceValidationReport}>查看导入报告</Button>
                    <Button onClick={() => setSourceDrawerOpen(true)}>查看本批次数据</Button>
                    <Button>进入字段映射</Button>
                    <Button>进入院内映射治理</Button>
                    <Button type="primary" onClick={() => setDeviceImportWizardOpen(false)}>返回分类目录</Button>
                  </Space>
                </>
              ) : (
                <>
                  <Alert showIcon type={deviceImportMode === "覆盖修正" ? "warning" : "info"} message={deviceImportRiskTips[deviceImportMode] || deviceImportRiskTips["增量更新"]} />
                  {deviceImportMode === "增量更新" ? (
                    <div className="device-change-metrics">
                      {["新增", "修改", "废止", "调整", "无变化", "待确认"].map((label) => (
                        <div key={label}><span>{label}条目数</span><strong>{changeTypeCounts[label] ?? 0}</strong></div>
                      ))}
                    </div>
                  ) : null}
                  <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="导入批次号">{deviceImportPreview?.data?.batch_id || deviceImportBatchId || "解析后生成"}</Descriptions.Item>
                    <Descriptions.Item label="原始文件名称">{deviceImportFileName || "-"}</Descriptions.Item>
                    <Descriptions.Item label="数据来源">{deviceImportSource}</Descriptions.Item>
                    <Descriptions.Item label="目录版本">{deviceImportPublishDate || deviceImportEffectiveDate || "待确认"}</Descriptions.Item>
                    <Descriptions.Item label="本次拟入库条目数">{deviceImportPreview?.data?.source_row_count ?? 0}</Descriptions.Item>
                    <Descriptions.Item label="异常条目数">{deviceImportPreview?.data?.invalid_count ?? 0}</Descriptions.Item>
                    <Descriptions.Item label="批次风险等级">{deviceImportPreview?.data?.batch_risk_level === "high" ? "高" : deviceImportPreview?.data?.batch_risk_level === "medium" ? "中" : "低"}</Descriptions.Item>
                    <Descriptions.Item label="是否创建新版本">是</Descriptions.Item>
                    <Descriptions.Item label="是否启用为当前版本">是</Descriptions.Item>
                    <Descriptions.Item label="是否保留原始文件">是</Descriptions.Item>
                    <Descriptions.Item label="是否生成核验报告">是</Descriptions.Item>
                    <Descriptions.Item label="是否支持回滚">支持按批次追溯</Descriptions.Item>
                  </Descriptions>
                </>
              )}
            </section>
          ) : null}
          <div className="device-import-footer">
            <Button disabled={deviceImportStep === 0} onClick={() => setDeviceImportStep((step) => Math.max(0, step - 1))}>上一步</Button>
            <Button onClick={saveDeviceImportDraft}>保存草稿</Button>
            <Button onClick={() => void parseOnlyDeviceImport()} disabled={!deviceImportFile} loading={previewingDeviceImport}>仅解析不入库</Button>
            <Button onClick={downloadDeviceValidationReport} disabled={!deviceImportPreview?.ok}>下载核验报告</Button>
            {deviceImportStep < 4 ? (
              <Button
                type="primary"
                onClick={goNextDeviceImportStep}
                loading={previewingDeviceImport && (deviceImportStep === 1 || deviceImportStep === 2)}
                disabled={(deviceImportStep === 0 && !deviceImportFile) || previewingDeviceImport}
              >
                {deviceImportStep === 1 && !deviceImportPreview?.ok ? "进入解析" : deviceImportStep === 2 && !deviceImportPreview?.ok ? "开始解析" : "下一步"}
              </Button>
            ) : (
              <Button type="primary" onClick={() => void commitDeviceImport()} loading={importing} disabled={!deviceImportPreview?.ok || deviceImportMode === "仅解析不入库" || !operatorContextValid}>
                确认入库
              </Button>
            )}
          </div>
          <section className="device-import-panel device-import-history-panel">
            <div className="device-import-panel-head">
              <h3>历史导入记录</h3>
              <Button size="small" onClick={() => void loadDeviceImportHistory()}>刷新</Button>
            </div>
            <Table
              rowKey="import_batch_id"
              size="small"
              dataSource={deviceImportHistory?.data?.items || []}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              scroll={{ x: 1500 }}
              columns={[
                { title: "导入批次号", dataIndex: "import_batch_id", width: 220, render: (value) => <span className="mono-cell">{value}</span> },
                { title: "导入模式", dataIndex: "import_mode", width: 110 },
                { title: "原始文件名称", dataIndex: "source_file_name", width: 220, render: (value) => <Tooltip title={value}>{middleEllipsis(value, 18, 10)}</Tooltip> },
                { title: "数据来源", dataIndex: "source_name", width: 130 },
                { title: "导入理由", dataIndex: "import_reason", width: 180, render: (value) => truncateText(value, 38) },
                { title: "操作人", dataIndex: "operator_name", width: 110 },
                { title: "开始时间", dataIndex: "started_at", width: 160, render: displayDateTime },
                { title: "完成时间", dataIndex: "completed_at", width: 160, render: displayDateTime },
                { title: "解析条目数", dataIndex: "parsed_count", width: 100 },
                { title: "入库条目数", dataIndex: "imported_count", width: 100 },
                { title: "异常条目数", dataIndex: "error_count", width: 100 },
                { title: "当前状态", dataIndex: "status", width: 100, render: (value) => <Tag color={value === "已入库" ? "success" : value === "入库失败" ? "error" : "processing"}>{value || "草稿"}</Tag> },
                {
                  title: "操作",
                  width: 340,
                  fixed: "right",
                  render: (_value, record) => (
                    <Space size={4} wrap>
                      <Button size="small" type="link" onClick={() => void openDeviceImportHistory(record.import_batch_id)}>查看过程</Button>
                      <Button size="small" type="link" onClick={() => void openDeviceImportHistory(record.import_batch_id)}>查看解析结果</Button>
                      <Button size="small" type="link" onClick={() => void openDeviceImportHistory(record.import_batch_id)}>查看核验报告</Button>
                      <Button size="small" type="link" onClick={() => setSourceDrawerOpen(true)}>查看入库数据</Button>
                      <Button size="small" type="link" onClick={() => void downloadSourceFileByBatch(record.import_batch_id, record.source_file_name)}>下载原始文件</Button>
                      <Button size="small" type="link" onClick={() => copyHistoryAsImport(record)}>复制为新导入</Button>
                      <Button size="small" type="link" danger disabled={record.status !== "已入库"}>回滚本批次</Button>
                    </Space>
                  )
                }
              ]}
            />
          </section>
        </div>
      </Drawer>
      <Drawer
        title="导入过程记录"
        open={deviceImportHistoryDrawerOpen}
        onClose={() => setDeviceImportHistoryDrawerOpen(false)}
        width={760}
      >
        {deviceImportHistoryDetail?.ok && deviceImportHistoryDetail.data ? (
          <div className="device-import-history-detail">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="导入批次号">{deviceImportHistoryDetail.data.batch.import_batch_id}</Descriptions.Item>
              <Descriptions.Item label="导入模式">{deviceImportHistoryDetail.data.batch.import_mode || "-"}</Descriptions.Item>
              <Descriptions.Item label="原始文件">{deviceImportHistoryDetail.data.batch.source_file_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="当前状态">{deviceImportHistoryDetail.data.batch.status || "-"}</Descriptions.Item>
              <Descriptions.Item label="操作人">{deviceImportHistoryDetail.data.batch.operator_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="操作角色">{deviceImportHistoryDetail.data.batch.operator_role || "-"}</Descriptions.Item>
              <Descriptions.Item label="登录IP">{deviceImportHistoryDetail.data.batch.client_ip || "-"}</Descriptions.Item>
              <Descriptions.Item label="终端信息">{truncateText(deviceImportHistoryDetail.data.batch.user_agent, 60)}</Descriptions.Item>
            </Descriptions>
            <div className="device-import-timeline">
              {deviceImportHistoryDetail.data.timeline.map((item, index) => (
                <div key={`${item.action || item.step}-${index}`} className="device-import-timeline-step">
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.step}</strong>
                    <p>{displayDateTime(item.occurred_at)} · {item.operator_name || "-"} · {item.result || "完成"}</p>
                    <em>{item.message || "无补充说明"}</em>
                  </div>
                </div>
              ))}
            </div>
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={deviceImportHistoryDetail.data.validation_results}
              columns={[
                { title: "核验项", dataIndex: "label" },
                { title: "结果", dataIndex: "status", width: 110, render: validationStatusTag },
                { title: "说明", dataIndex: "message" },
              ]}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={deviceImportHistoryDetail?.message || "选择历史批次后查看过程"} />
        )}
      </Drawer>
      <Drawer
        title="来源文件归档"
        open={sourceDrawerOpen}
        onClose={() => setSourceDrawerOpen(false)}
        width={1320}
      >
        <Tabs
          activeKey={sourceArchiveTab}
          onChange={setSourceArchiveTab}
          items={[
            {
              key: "volumes",
              label: "档案卷管理",
              children: (
                <div className="source-archive-layout">
                  <aside className="source-archive-tree">
                    <div className="equipment-pane-title">
                      <strong>档案分类</strong>
                      <Tag>{sourceArchiveVolumes.length} 卷</Tag>
                    </div>
                    <Tree
                      blockNode
                      defaultExpandAll
                      selectedKeys={[sourceArchiveTreeKey]}
                      treeData={sourceArchiveTreeData}
                      onSelect={(keys) => {
                        if (keys[0]) {
                          setSourceArchiveTreeKey(keys[0]);
                          setSelectedArchiveVolumeId(null);
                        }
                      }}
                    />
                  </aside>
                  <section className="source-archive-volumes">
                    <div className="equipment-pane-title">
                      <strong>档案卷列表</strong>
                      <Tag>{visibleSourceArchiveVolumes.length} 卷</Tag>
                    </div>
                    <Table
                      rowKey="volume_id"
                      columns={archiveVolumeColumns}
                      dataSource={visibleSourceArchiveVolumes}
                      size="small"
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      scroll={{ x: 1240, y: 520 }}
                      locale={{ emptyText: "当前分类下暂无档案卷" }}
                      rowClassName={(row) => row.volume_id === selectedArchiveVolume?.volume_id ? "selected-row" : ""}
                      onRow={(row) => ({
                        onClick: () => setSelectedArchiveVolumeId(row.volume_id)
                      })}
                    />
                  </section>
                  <aside className="source-archive-detail">
                    {selectedArchiveVolume ? (
                      <Tabs
                        size="small"
                        items={[
                          {
                            key: "overview",
                            label: "档案卷概览",
                            children: (
                              <Descriptions bordered size="small" column={1}>
                                <Descriptions.Item label="档案卷名称">{selectedArchiveVolume.volume_name}</Descriptions.Item>
                                <Descriptions.Item label="档案门类">{selectedArchiveVolume.category}</Descriptions.Item>
                                <Descriptions.Item label="数据域">{selectedArchiveVolume.domain}</Descriptions.Item>
                                <Descriptions.Item label="来源单位">{selectedArchiveVolume.source_unit}</Descriptions.Item>
                                <Descriptions.Item label="归档状态">{archiveStatusTag(selectedArchiveVolume.status)}</Descriptions.Item>
                                <Descriptions.Item label="文件数量">{selectedArchiveVolume.files.length}</Descriptions.Item>
                                <Descriptions.Item label="关联批次数">{selectedArchiveVolume.batches.length || selectedArchiveVolume.files.length}</Descriptions.Item>
                                <Descriptions.Item label="支撑数据量">{selectedArchiveVolume.supported_count}</Descriptions.Item>
                                <Descriptions.Item label="异常数据量">{selectedArchiveVolume.abnormal_count}</Descriptions.Item>
                                <Descriptions.Item label="最近更新时间">{displayDateTime(selectedArchiveVolume.updated_at)}</Descriptions.Item>
                              </Descriptions>
                            )
                          },
                          {
                            key: "evidence",
                            label: "来源依据",
                            children: (
                              <div className="source-archive-chain">
                                <span>来源文件</span>
                                <span>导入批次</span>
                                <span>解析暂存数据</span>
                                <span>正式入库数据</span>
                                <span>异常数据</span>
                                <span>纠错记录</span>
                                <span>当前版本</span>
                                <p>
                                  {selectedArchiveVolume.files[0]?.source_file_name || "-"} → {selectedArchiveVolume.files[0]?.batch_id || "-"} → 解析 {selectedArchiveVolume.batches[0]?.parsed_count ?? "-"} 条 → 入库 {selectedArchiveVolume.batches[0]?.imported_count ?? selectedArchiveVolume.supported_count} 条 → 异常 {selectedArchiveVolume.batches[0]?.error_count ?? selectedArchiveVolume.abnormal_count} 条
                                </p>
                              </div>
                            )
                          },
                          {
                            key: "files",
                            label: "包含文件",
                            children: (
                              <Table
                                rowKey={(row) => `${row.batch_id}-${row.source_file_name}`}
                                size="small"
                                pagination={false}
                                columns={[
                                  { title: "文件题名", dataIndex: "source_file_name", width: 180 },
                                  { title: "原始文件名", dataIndex: "source_file_name", width: 180 },
                                  { title: "文件类别", dataIndex: "file_type", width: 100, render: (value) => value || "源文件" },
                                  { title: "文件大小", dataIndex: "source_file_size_bytes", width: 90, render: displaySize },
                                  { title: "文件 Hash", dataIndex: "sha256", width: 220, ellipsis: true },
                                  { title: "上传人", dataIndex: "imported_by", width: 100, render: (value) => value || "-" },
                                  { title: "上传时间", dataIndex: "saved_at", width: 150, render: displayDateTime },
                                  { title: "操作", width: 90, render: (_v, item) => <Button size="small" icon={<Download size={14} />} onClick={() => void downloadSourceFile(item)}>下载</Button> },
                                ]}
                                dataSource={selectedArchiveVolume.files}
                                scroll={{ x: 1200 }}
                              />
                            )
                          },
                          {
                            key: "batches",
                            label: "关联导入批次",
                            children: (
                              <Table
                                rowKey="import_batch_id"
                                size="small"
                                pagination={false}
                                columns={[
                                  { title: "批次号", dataIndex: "import_batch_id", width: 210 },
                                  { title: "导入模式", dataIndex: "import_mode", width: 100 },
                                  { title: "解析数量", dataIndex: "parsed_count", width: 90 },
                                  { title: "入库数量", dataIndex: "imported_count", width: 90 },
                                  { title: "异常数量", dataIndex: "error_count", width: 90 },
                                  { title: "状态", dataIndex: "status", width: 100 },
                                  { title: "完成时间", dataIndex: "completed_at", width: 150, render: displayDateTime },
                                ]}
                                dataSource={selectedArchiveVolume.batches}
                                scroll={{ x: 900 }}
                              />
                            )
                          },
                          {
                            key: "usage",
                            label: "文件利用记录",
                            children: (
                              <div className="device-import-timeline">
                                {(selectedArchiveVolume.batches.length ? selectedArchiveVolume.batches : [{ import_batch_id: selectedArchiveVolume.files[0]?.batch_id } as DeviceImportHistoryRecord]).map((batch, index) => (
                                  <div key={`${batch.import_batch_id}-${index}`} className="device-import-timeline-step">
                                    <span>{index + 1}</span>
                                    <div>
                                      <strong>用于导入</strong>
                                      <p>{displayDateTime(batch.completed_at || batch.started_at || selectedArchiveVolume.updated_at)} · {batch.operator_name || selectedArchiveVolume.files[0]?.imported_by || "-"}</p>
                                      <em>关联业务对象：{batch.import_batch_id || selectedArchiveVolume.files[0]?.batch_id}；结果状态：{batch.status || selectedArchiveVolume.status}</em>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          },
                        ]}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择档案卷" />
                    )}
                  </aside>
                </div>
              )
            },
            {
              key: "search",
              label: "来源文件检索",
              children: (
                <Space direction="vertical" size={12} className="source-archive-search">
                  <div className="device-import-filterbar">
                    <Input placeholder="文件名称 / 档案卷名称 / 公告编号" value={sourceArchiveSearch.keyword} onChange={(event) => setSourceArchiveSearch((current) => ({ ...current, keyword: event.target.value }))} />
                    <Input placeholder="来源单位" value={sourceArchiveSearch.source_unit} onChange={(event) => setSourceArchiveSearch((current) => ({ ...current, source_unit: event.target.value }))} />
                    <Input placeholder="导入批次号" value={sourceArchiveSearch.batch_id} onChange={(event) => setSourceArchiveSearch((current) => ({ ...current, batch_id: event.target.value }))} />
                    <Input placeholder="文件 Hash" value={sourceArchiveSearch.sha256} onChange={(event) => setSourceArchiveSearch((current) => ({ ...current, sha256: event.target.value }))} />
                    <Select value={sourceArchiveSearch.status} style={{ width: 120 }} onChange={(status) => setSourceArchiveSearch((current) => ({ ...current, status }))} options={["all", "待归档", "已归档", "已复核", "已引用", "已替换", "已作废", "已锁定", "归档异常"].map((value) => ({ value, label: value === "all" ? "全部状态" : value }))} />
                    <Select value={sourceArchiveSearch.referenced} style={{ width: 120 }} onChange={(referenced) => setSourceArchiveSearch((current) => ({ ...current, referenced }))} options={[{ value: "all", label: "引用不限" }, { value: "yes", label: "已引用" }, { value: "no", label: "未引用" }]} />
                  </div>
                  <Table
                    rowKey={(row) => `${row.batch_id}-${row.source_file_name}`}
                    columns={sourceFileColumns}
                    dataSource={filteredArchiveFiles}
                    size="small"
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    scroll={{ x: 1680 }}
                    locale={{ emptyText: "暂无匹配的归档源文件" }}
                  />
                </Space>
              )
            }
          ]}
        />
      </Drawer>
      <Drawer
        title="异常数据候选"
        open={invalidCandidatesDrawerOpen}
        onClose={() => setInvalidCandidatesDrawerOpen(false)}
        width={1180}
      >
        <Table
          rowKey="catalog_id"
          size="small"
          loading={loadingInvalidCandidates}
          dataSource={invalidCandidates}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1120 }}
          columns={[
            { title: "编码", width: 100, render: (_v, row) => deviceCode(row) },
            { title: "目录条目", dataIndex: "level_2_category", width: 180 },
            { title: "产品描述", dataIndex: "product_description", width: 260 },
            { title: "预期用途", dataIndex: "intended_use", width: 180 },
            { title: "品名举例", dataIndex: "product_examples", width: 180 },
            { title: "管理类别", dataIndex: "management_class", width: 90 },
            { title: "来源文件", dataIndex: "source_file_name", width: 190 },
            { title: "数据状态", width: 100, render: (_v, row) => deviceStatusTag(row) },
            { title: "识别原因", dataIndex: "invalid_reasons", width: 240, render: (v: string[] | undefined) => (v || []).join("；") || "-" }
          ]}
        />
      </Drawer>
      <Drawer
        title="条目详情与治理状态"
        open={deviceDetailDrawerOpen}
        onClose={() => setDeviceDetailDrawerOpen(false)}
        width={980}
        extra={<Button size="small" type="primary" onClick={() => openCorrectionDrawer(selectedDevice)}>发起纠错</Button>}
      >
        {selectedDevice ? (
          <Tabs
            size="small"
            className="device-detail-tabs"
            items={[
              {
                key: "basic",
                label: "基本信息",
                children: (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="目录编码">{deviceCode(selectedDevice)}</Descriptions.Item>
                    <Descriptions.Item label="数据状态">{deviceStatusTag(selectedDevice)}</Descriptions.Item>
                    <Descriptions.Item label="目录名称">{selectedDevice.level_2_category || "-"}</Descriptions.Item>
                    <Descriptions.Item label="管理类别">{selectedDevice.management_class || "-"}</Descriptions.Item>
                    <Descriptions.Item label="一级类别">{selectedDevice.level_1_category || "-"}</Descriptions.Item>
                    <Descriptions.Item label="二级编码">{selectedDevice.level_2_category_no || "-"}</Descriptions.Item>
                    <Descriptions.Item label="产品描述" span={2}>{selectedDevice.product_description || "-"}</Descriptions.Item>
                    <Descriptions.Item label="预期用途" span={2}>{selectedDevice.intended_use || "-"}</Descriptions.Item>
                    <Descriptions.Item label="品名举例" span={2}>{selectedDevice.product_examples || "-"}</Descriptions.Item>
                    <Descriptions.Item label="状态说明" span={2}>{selectedDevice.status_reason || "-"}</Descriptions.Item>
                    <Descriptions.Item label="合并目标" span={2}>{selectedDevice.merged_to_catalog_id || "-"}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: "source",
                label: "来源追溯",
                children: (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="来源批次号">{deviceGovernance?.data?.source_trace?.source_batch_id || selectedDevice.batch_id}</Descriptions.Item>
                    <Descriptions.Item label="导入批次状态">{deviceGovernance?.data?.source_trace?.batch_status || "-"}</Descriptions.Item>
                    <Descriptions.Item label="原始文件名称">{deviceGovernance?.data?.source_trace?.source_file_name || selectedDevice.source_file_name}</Descriptions.Item>
                    <Descriptions.Item label="原始文件 Hash">{deviceGovernance?.data?.source_trace?.source_file_hash || "-"}</Descriptions.Item>
                    <Descriptions.Item label="原始文件位置">{deviceGovernance?.data?.source_trace?.source_position || `第 ${selectedDevice.row_number} 行`}</Descriptions.Item>
                    <Descriptions.Item label="导入时间">{displayDateTime(deviceGovernance?.data?.source_trace?.imported_at || selectedDevice.created_at)}</Descriptions.Item>
                    <Descriptions.Item label="导入模式">{deviceGovernance?.data?.source_trace?.import_mode || "-"}</Descriptions.Item>
                    <Descriptions.Item label="数据来源公告">{deviceGovernance?.data?.source_trace?.source_announcement || "-"}</Descriptions.Item>
                    <Descriptions.Item label="操作人">{deviceGovernance?.data?.source_trace?.operator_name || "-"}</Descriptions.Item>
                    <Descriptions.Item label="源文件对比">
                      <Space size={6} wrap>
                        <Button
                          size="small"
                          icon={<Download size={14} />}
                          onClick={() => void downloadSourceFileForDevice(selectedDevice)}
                        >
                          下载源文件
                        </Button>
                        <Button size="small" onClick={() => { setDeviceDataStatus("all"); void loadDeviceTree(); }}>查看同批次异常</Button>
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: "change",
                label: "变更记录",
                children: (
                  <div className="device-detail-tabpane">
                    <Table
                      size="small"
                      rowKey={(row) => String(row.history_id || row.created_at)}
                      dataSource={(deviceGovernance?.data?.change_history || []) as Array<Record<string, unknown>>}
                      pagination={false}
                      columns={[
                        { title: "变更类型", dataIndex: "change_type" },
                        { title: "原因", dataIndex: "reason" },
                        { title: "操作人", dataIndex: "operator_name" },
                        { title: "时间", dataIndex: "created_at", render: (value) => displayDateTime(String(value || "")) }
                      ]}
                    />
                  </div>
                )
              },
              {
                key: "corrections",
                label: "纠错记录",
                children: (
                  <div className="device-detail-tabpane">
                    <Table
                      size="small"
                      rowKey="correction_id"
                      dataSource={deviceGovernance?.data?.correction_orders || []}
                      pagination={false}
                      columns={[
                        { title: "纠错单号", dataIndex: "correction_no", width: 180 },
                        { title: "异常类型", dataIndex: "abnormal_type" },
                        { title: "修订方式", dataIndex: "correction_action" },
                        { title: "状态", dataIndex: "status_label" },
                        { title: "发起时间", dataIndex: "created_at", render: (value) => displayDateTime(String(value || "")) }
                      ]}
                    />
                  </div>
                )
              },
              {
                key: "impact",
                label: "影响分析",
                children: (
                  <div className="device-detail-tabpane">
                    <div className="device-impact-list">
                      <div><span>子目录</span>{governanceTag(`${deviceGovernance?.data?.impact_analysis?.child_catalog_count ?? 0} 个`, "blue")}</div>
                      <div><span>耗材主数据引用</span>{governanceTag(`${deviceGovernance?.data?.impact_analysis?.material_master_ref_count ?? 0} 个`, "blue")}</div>
                      <div><span>设备主数据引用</span>{governanceTag(`${deviceGovernance?.data?.impact_analysis?.equipment_master_ref_count ?? 0} 个`, "blue")}</div>
                      <div><span>医保编码映射引用</span>{governanceTag(`${deviceGovernance?.data?.impact_analysis?.insurance_mapping_ref_count ?? 0} 个`, "blue")}</div>
                      <div><span>院内字典映射引用</span>{governanceTag(`${deviceGovernance?.data?.impact_analysis?.internal_mapping_ref_count ?? 0} 个`, "blue")}</div>
                      <div><span>历史业务记录</span>{governanceTag(`${deviceGovernance?.data?.impact_analysis?.historical_business_ref_count ?? 0} 条`, "blue")}</div>
                    </div>
                    {deviceGovernance?.data?.impact_analysis?.requires_target_mapping ? (
                      <Alert type="warning" showIcon message="存在引用关系，作废或合并前必须先选择目标目录迁移或重映射。" />
                    ) : (
                      <Alert type="success" showIcon message="未发现引用关系，可进入标记作废并隐藏流程。" />
                    )}
                  </div>
                )
              }
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择目录条目" />
        )}
      </Drawer>
      <Drawer
        title="目录数据纠错"
        open={correctionDrawerOpen}
        onClose={() => setCorrectionDrawerOpen(false)}
        width={560}
        extra={<Button type="primary" size="small" loading={correctionSubmitting} onClick={() => void submitCorrection()}>提交纠错单</Button>}
      >
        <Alert
          showIcon
          type={deviceGovernance?.data?.impact_analysis?.requires_target_mapping ? "warning" : "info"}
          message={deviceGovernance?.data?.impact_analysis?.requires_target_mapping ? "存在引用关系，作废或合并前需先迁移/重映射。" : "提交前已自动执行影响分析。"}
          style={{ marginBottom: 12 }}
        />
        <Form form={correctionForm} layout="vertical">
          <Form.Item label="目录编码" name="catalog_code"><Input disabled /></Form.Item>
          <Form.Item label="目录名称" name="catalog_name"><Input disabled /></Form.Item>
          <Form.Item label="当前状态" name="current_status"><Input disabled /></Form.Item>
          <Form.Item label="来源批次" name="source_batch"><Input disabled /></Form.Item>
          <Form.Item label="原始文件" name="source_file"><Input disabled /></Form.Item>
          <Form.Item label="原始位置" name="source_position"><Input disabled /></Form.Item>
          <Form.Item label="异常类型" name="abnormal_type" rules={[{ required: true }]}>
            <Select options={["解析噪声", "目录名称异常", "分类层级错误", "编码异常", "字段错位", "重复条目", "版本冲突", "人工确认异常", "其他"].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item label="修订方式" name="correction_action" rules={[{ required: true }]}>
            <Select options={["修正字段", "调整父级", "标记作废", "合并到已有目录", "拆分目录", "退回批次", "保持不变"].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item label="纠错原因" name="reason" rules={[{ required: true, message: "请填写纠错原因" }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item label="处理说明" name="handling_note"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item label="是否隐藏于分类树" name="hide_in_tree" valuePropName="checked"><Checkbox>隐藏</Checkbox></Form.Item>
          <Form.Item label="是否需要审核" name="need_review" valuePropName="checked"><Checkbox>需要审核</Checkbox></Form.Item>
          <Form.Item label="附件或截图"><Upload beforeUpload={() => false} maxCount={3}><Button>选择附件</Button></Upload></Form.Item>
        </Form>
      </Drawer>
      <Drawer
        title="数据纠错台账"
        open={correctionLedgerOpen}
        onClose={() => setCorrectionLedgerOpen(false)}
        width={1280}
      >
        <div className="device-import-filterbar">
          <Select
            value={correctionFilters.status}
            style={{ width: 130 }}
            onChange={(status) => setCorrectionFilters((current) => ({ ...current, status }))}
            options={[
              { value: "all", label: "全部状态" },
              { value: "draft", label: "草稿" },
              { value: "submitted", label: "待审核" },
              { value: "approved", label: "审核通过" },
              { value: "rejected", label: "已驳回" },
              { value: "executed", label: "已执行" },
              { value: "cancelled", label: "已取消" }
            ]}
          />
          <Select
            allowClear
            placeholder="异常类型"
            style={{ width: 150 }}
            value={correctionFilters.abnormal_type || undefined}
            onChange={(abnormal_type) => setCorrectionFilters((current) => ({ ...current, abnormal_type: abnormal_type || "" }))}
            options={["解析噪声", "目录名称异常", "分类层级错误", "编码异常", "字段错位", "重复条目", "版本冲突", "人工确认异常", "其他"].map((value) => ({ value, label: value }))}
          />
          <Select
            allowClear
            placeholder="修订方式"
            style={{ width: 150 }}
            value={correctionFilters.correction_action || undefined}
            onChange={(correction_action) => setCorrectionFilters((current) => ({ ...current, correction_action: correction_action || "" }))}
            options={["修正字段", "调整父级", "标记作废", "合并到已有目录", "拆分目录", "退回批次", "保持不变"].map((value) => ({ value, label: value }))}
          />
          <Input
            placeholder="来源批次"
            value={correctionFilters.source_batch_id}
            onChange={(event) => setCorrectionFilters((current) => ({ ...current, source_batch_id: event.target.value }))}
          />
          <Input
            placeholder="发起人"
            value={correctionFilters.applicant_name}
            onChange={(event) => setCorrectionFilters((current) => ({ ...current, applicant_name: event.target.value }))}
          />
          <Button onClick={() => void loadCorrectionOrders()}>筛选</Button>
          <Button onClick={() => {
            setCorrectionFilters({ status: "all", abnormal_type: "", correction_action: "", source_batch_id: "", applicant_name: "" });
            setTimeout(() => void loadCorrectionOrders(), 0);
          }}>重置</Button>
        </div>
        <Table
          rowKey="correction_id"
          size="small"
          dataSource={correctionOrders?.data?.items || []}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1460 }}
          columns={[
            { title: "纠错单号", dataIndex: "correction_no", width: 190 },
            { title: "目录编码", render: (_v, row) => String(row.before_data?.catalog_id || row.catalog_id || "-"), width: 160 },
            { title: "目录名称", render: (_v, row) => String(row.before_data?.level_2_category || "-"), width: 160 },
            { title: "异常类型", dataIndex: "abnormal_type", width: 120 },
            { title: "修订方式", dataIndex: "correction_action", width: 120 },
            { title: "来源批次", dataIndex: "source_batch_id", width: 200 },
            { title: "原始文件", render: (_v, row) => String(row.before_data?.source_file_name || "-"), width: 180 },
            { title: "原始位置", dataIndex: "source_position", width: 120 },
            { title: "影响数量", render: (_v, row) => String((row.impact_summary as { total_ref_count?: number })?.total_ref_count ?? 0), width: 90 },
            { title: "发起人", dataIndex: "applicant_name", width: 100 },
            { title: "发起时间", dataIndex: "created_at", render: (value) => displayDateTime(String(value || "")), width: 160 },
            { title: "审核人", dataIndex: "reviewer_name", width: 100 },
            { title: "审核时间", dataIndex: "reviewed_at", render: (value) => displayDateTime(String(value || "")), width: 160 },
            { title: "当前状态", dataIndex: "status_label", width: 100 },
            {
              title: "操作",
              fixed: "right",
              width: 190,
              render: (_v, row) => (
                <Space size={4}>
                  <Button
                    size="small"
                    disabled={row.status !== "submitted"}
                    onClick={async () => {
                      const result = await client.approveDeviceClassificationCorrection(row.correction_id);
                      onApiActivity("POST /api/v1/equipment/device-classifications/corrections/{id}/approve", result);
                      if (result.ok) {
                        message.success("纠错单已审核通过");
                        void loadCorrectionOrders();
                      }
                    }}
                  >
                    审核
                  </Button>
                  <Button
                    size="small"
                    disabled={!["submitted", "approved"].includes(row.status)}
                    onClick={async () => {
                      const result = await client.executeDeviceClassificationCorrection(row.correction_id);
                      onApiActivity("POST /api/v1/equipment/device-classifications/corrections/{id}/execute", result);
                      if (result.ok) {
                        message.success("纠错单已执行");
                        void loadCorrectionOrders();
                        void loadDeviceTree();
                      }
                    }}
                  >
                    执行
                  </Button>
                  <Button
                    size="small"
                    danger
                    disabled={row.status !== "submitted"}
                    onClick={async () => {
                      const result = await client.rejectDeviceClassificationCorrection(row.correction_id);
                      onApiActivity("POST /api/v1/equipment/device-classifications/corrections/{id}/reject", result);
                      if (result.ok) {
                        message.success("纠错单已驳回");
                        void loadCorrectionOrders();
                      }
                    }}
                  >
                    驳回
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Drawer>
    </section>
  );
}
