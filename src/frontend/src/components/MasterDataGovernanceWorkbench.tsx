import React from "react";
import {
  Badge,
  Button,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Popover,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tree,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DataNode } from "antd/es/tree";
import { ChevronDown, Database, FileUp, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { HudmpApiClient } from "../lib/api";
import type { ApiResult, DepartmentRow, MaterialRow, PagedResult, UserSession } from "../types";
import { DictionaryWorkbench } from "./DictionaryWorkbench";
import type { DictionaryKind } from "./DictionaryWorkbench";

type MasterDataView = "departments" | "disciplines" | "staff" | "materials";
type QualityStatus = "pass" | "warning" | "error";
type MappingStatus = "mapped" | "pending" | "conflict";
type RecordStatus = "active" | "inactive" | "draft";

type GovernanceTreeGroup = {
  key: string;
  title: string;
  children: Array<{ key: string; title: string }>;
};

type GovernanceRecord = {
  id: string;
  code: string;
  name: string;
  alias?: string;
  groupKey: string;
  treeKey: string;
  classPath: string;
  standardRef: string;
  nmpaRef: string;
  owner: string;
  source: string;
  status: RecordStatus;
  qualityStatus: QualityStatus;
  mappingStatus: MappingStatus;
  relatedSystems: string[];
  issues: string[];
  updatedAt: string;
};

type DomainConfig = {
  view: MasterDataView;
  title: string;
  lead: string;
  sourceName: string;
  sourceDetail: string;
  nmpaUsage: string;
  treeTitle: string;
  searchPlaceholder: string;
  tree: GovernanceTreeGroup[];
  records: GovernanceRecord[];
  schema: Array<{ field: string; label: string; required: boolean; rule: string }>;
};

type Props = {
  activeId: string;
  client: HudmpApiClient;
  session: UserSession | null;
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
};

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
  { value: "draft", label: "待确认" }
];

const nmpaReference = {
  source: "国家药监局《医疗器械分类目录》",
  announcement: "2017年第104号",
  effectiveDate: "2018-08-01",
  governanceUse: "用于校准设备、耗材、科室、人员和学科之间的管理类别、使用场景和责任边界。"
};

function viewForActiveId(activeId: string): MasterDataView {
  if (activeId === "discipline-master") return "disciplines";
  if (activeId === "staff-master") return "staff";
  if (activeId === "materials-catalog" || activeId === "material-specs") return "materials";
  return "departments";
}

function qualityTag(status: QualityStatus) {
  if (status === "pass") return <Tag color="success">通过</Tag>;
  if (status === "error") return <Tag color="error">异常</Tag>;
  return <Tag color="warning">待治理</Tag>;
}

function mappingTag(status: MappingStatus) {
  if (status === "mapped") return <Tag color="processing">已映射</Tag>;
  if (status === "conflict") return <Tag color="error">冲突</Tag>;
  return <Tag color="warning">待映射</Tag>;
}

function recordStatusTag(status: RecordStatus) {
  const color = status === "active" ? "success" : status === "inactive" ? "default" : "warning";
  const label = status === "active" ? "启用" : status === "inactive" ? "停用" : "待确认";
  return <Tag color={color}>{label}</Tag>;
}

function compactDate(): string {
  return new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function makeRecord(input: Omit<GovernanceRecord, "updatedAt"> & { updatedAt?: string }): GovernanceRecord {
  return {
    updatedAt: input.updatedAt ?? `2026-${compactDate()}`,
    ...input
  };
}

function baseDepartmentRecords(): GovernanceRecord[] {
  return [
    makeRecord({
      id: "dept-er",
      code: "DEPT-ER",
      name: "急诊医学科",
      alias: "急诊中心",
      groupKey: "clinical",
      treeKey: "clinical-emergency",
      classPath: "临床科室 / 急诊急救",
      standardRef: "国家卫健委诊疗科目",
      nmpaRef: "生命支持、急救与监护类器械使用科室",
      owner: "医务部",
      source: "HIS / 院内组织架构",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["HIS", "EMR", "设备平台", "耗材平台"],
      issues: ["急救设备责任科室已绑定"]
    }),
    makeRecord({
      id: "dept-or",
      code: "DEPT-OR",
      name: "手术室",
      alias: "麻醉手术中心",
      groupKey: "clinical",
      treeKey: "clinical-surgery",
      classPath: "临床科室 / 手术治疗",
      standardRef: "国家卫健委诊疗科目",
      nmpaRef: "02 无源手术器械 / 03 神经和心血管手术器械",
      owner: "护理部",
      source: "HIS / 手麻系统",
      status: "active",
      qualityStatus: "warning",
      mappingStatus: "mapped",
      relatedSystems: ["HIS", "手麻系统", "SPD", "设备平台"],
      issues: ["部分高值耗材领用科室需复核"]
    }),
    makeRecord({
      id: "dept-cssd",
      code: "DEPT-CSSD",
      name: "消毒供应中心",
      groupKey: "medical-tech",
      treeKey: "tech-supply",
      classPath: "医技科室 / 消毒供应",
      standardRef: "院内组织标准",
      nmpaRef: "重复使用器械清洗、灭菌和追溯责任科室",
      owner: "护理部",
      source: "院内组织架构",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["SPD", "设备平台", "院感系统"],
      issues: ["灭菌包追溯接口已纳入"]
    }),
    makeRecord({
      id: "dept-me",
      code: "DEPT-ME",
      name: "医学工程处",
      alias: "设备科",
      groupKey: "admin",
      treeKey: "admin-engineering",
      classPath: "行政管理 / 医学装备",
      standardRef: "院内管理科室标准",
      nmpaRef: "医疗器械全生命周期归口管理",
      owner: "信息运营中心",
      source: "院内组织架构",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["设备平台", "采购系统", "资产系统"],
      issues: ["设备验收、巡检、维修责任已绑定"]
    })
  ];
}

function baseDisciplineRecords(): GovernanceRecord[] {
  return [
    makeRecord({
      id: "disc-cardio",
      code: "DISC-CARDIO",
      name: "心血管内科学",
      groupKey: "clinical-disc",
      treeKey: "disc-internal",
      classPath: "临床医学 / 内科学 / 心血管",
      standardRef: "国家临床专科能力口径",
      nmpaRef: "03 神经和心血管手术器械 / 07 医用诊察和监护器械",
      owner: "医务部",
      source: "学科建设台账",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["EMR", "设备平台", "科研平台"],
      issues: ["专科设备能力标签已同步"]
    }),
    makeRecord({
      id: "disc-image",
      code: "DISC-RAD",
      name: "医学影像学",
      groupKey: "tech-disc",
      treeKey: "disc-diagnostic",
      classPath: "医技学科 / 影像诊断",
      standardRef: "诊疗科目与学科目录",
      nmpaRef: "06 医用成像器械",
      owner: "医务部",
      source: "PACS / 学科目录",
      status: "active",
      qualityStatus: "warning",
      mappingStatus: "mapped",
      relatedSystems: ["PACS", "EMR", "设备平台"],
      issues: ["部分影像设备二级分类待确认"]
    }),
    makeRecord({
      id: "disc-rehab",
      code: "DISC-REHAB",
      name: "康复医学",
      groupKey: "clinical-disc",
      treeKey: "disc-rehab",
      classPath: "临床医学 / 康复医学",
      standardRef: "医院专科建设目录",
      nmpaRef: "19 医用康复器械",
      owner: "康复医学科",
      source: "专科建设台账",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["EMR", "设备平台", "绩效平台"],
      issues: ["康复设备与治疗项目已关联"]
    }),
    makeRecord({
      id: "disc-engineering",
      code: "DISC-ME",
      name: "医学工程技术",
      groupKey: "support-disc",
      treeKey: "disc-engineering",
      classPath: "支撑学科 / 医学工程",
      standardRef: "院内学科口径",
      nmpaRef: "器械风险等级、巡检周期和计量要求参照",
      owner: "医学工程处",
      source: "设备平台",
      status: "draft",
      qualityStatus: "warning",
      mappingStatus: "pending",
      relatedSystems: ["设备平台", "资产系统"],
      issues: ["需补充人员资质与设备类别绑定规则"]
    })
  ];
}

function baseStaffRecords(): GovernanceRecord[] {
  return [
    makeRecord({
      id: "staff-doctor",
      code: "ROLE-DOCTOR",
      name: "执业医师",
      groupKey: "clinical-role",
      treeKey: "staff-clinical",
      classPath: "临床人员 / 诊疗操作",
      standardRef: "执业资格与岗位授权",
      nmpaRef: "按器械管理类别限定操作授权和培训记录",
      owner: "人事科 / 医务部",
      source: "HRP / HIS",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["HIS", "EMR", "设备平台"],
      issues: ["高风险设备操作授权已纳入"]
    }),
    makeRecord({
      id: "staff-nurse",
      code: "ROLE-NURSE",
      name: "护理人员",
      groupKey: "clinical-role",
      treeKey: "staff-nursing",
      classPath: "护理人员 / 领用与处置",
      standardRef: "护理岗位目录",
      nmpaRef: "14 注输、护理和防护器械使用与领用",
      owner: "护理部",
      source: "HRP / 护理系统",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["HIS", "SPD", "院感系统"],
      issues: ["耗材领用权限已关联岗位"]
    }),
    makeRecord({
      id: "staff-engineer",
      code: "ROLE-ME",
      name: "医学工程师",
      groupKey: "engineering-role",
      treeKey: "staff-engineering",
      classPath: "医学工程 / 维护维修",
      standardRef: "岗位能力模型",
      nmpaRef: "按医疗器械分类目录维护设备风险与巡检范围",
      owner: "医学工程处",
      source: "设备平台 / HRP",
      status: "active",
      qualityStatus: "warning",
      mappingStatus: "mapped",
      relatedSystems: ["设备平台", "资产系统", "维修系统"],
      issues: ["三类设备维保授权需补全证据"]
    }),
    makeRecord({
      id: "staff-material",
      code: "ROLE-SPD",
      name: "耗材管理员",
      groupKey: "supply-role",
      treeKey: "staff-material",
      classPath: "供应链 / 耗材目录维护",
      standardRef: "SPD岗位目录",
      nmpaRef: "耗材管理类别、注册证和医保编码映射",
      owner: "物资供应科",
      source: "SPD",
      status: "draft",
      qualityStatus: "warning",
      mappingStatus: "pending",
      relatedSystems: ["SPD", "医保平台", "HIS"],
      issues: ["部分授权范围未绑定管理类别"]
    })
  ];
}

function baseMaterialRecords(): GovernanceRecord[] {
  return [
    makeRecord({
      id: "mat-syringe",
      code: "MAT-6815-001",
      name: "一次性使用无菌注射器",
      alias: "注射器",
      groupKey: "consumable-basic",
      treeKey: "mat-infusion",
      classPath: "基础耗材 / 注输护理",
      standardRef: "医保医用耗材代码库",
      nmpaRef: "14 注输、护理和防护器械",
      owner: "物资供应科",
      source: "SPD / 医保",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["SPD", "HIS", "医保平台"],
      issues: ["医保27位码与注册证已绑定"]
    }),
    makeRecord({
      id: "mat-balloon",
      code: "MAT-C09-2201",
      name: "球囊扩张导管",
      groupKey: "consumable-high",
      treeKey: "mat-intervention",
      classPath: "高值耗材 / 介入耗材",
      standardRef: "医保C09全量规格",
      nmpaRef: "03 神经和心血管手术器械",
      owner: "物资供应科",
      source: "医保 / SPD",
      status: "active",
      qualityStatus: "warning",
      mappingStatus: "mapped",
      relatedSystems: ["SPD", "HIS", "医保平台", "设备平台"],
      issues: ["规格型号和院内别名待复核"]
    }),
    makeRecord({
      id: "mat-mask",
      code: "MAT-6864-009",
      name: "医用外科口罩",
      groupKey: "consumable-basic",
      treeKey: "mat-protection",
      classPath: "基础耗材 / 防护耗材",
      standardRef: "院内耗材标准目录",
      nmpaRef: "14 注输、护理和防护器械",
      owner: "物资供应科",
      source: "SPD",
      status: "active",
      qualityStatus: "pass",
      mappingStatus: "mapped",
      relatedSystems: ["SPD", "院感系统"],
      issues: ["防护类别已同步院感规则"]
    }),
    makeRecord({
      id: "mat-implant",
      code: "MAT-C11-5100",
      name: "骨科植入钉",
      groupKey: "consumable-high",
      treeKey: "mat-implant",
      classPath: "高值耗材 / 植入材料",
      standardRef: "医保C11全量规格",
      nmpaRef: "13 无源植入器械",
      owner: "物资供应科",
      source: "医保 / SPD",
      status: "draft",
      qualityStatus: "error",
      mappingStatus: "conflict",
      relatedSystems: ["SPD", "HIS", "医保平台"],
      issues: ["注册证名称与医保通用名冲突"]
    })
  ];
}

function treeFor(view: MasterDataView): GovernanceTreeGroup[] {
  if (view === "departments") {
    return [
      { key: "clinical", title: "临床科室", children: [{ key: "clinical-emergency", title: "急诊急救" }, { key: "clinical-surgery", title: "手术治疗" }] },
      { key: "medical-tech", title: "医技科室", children: [{ key: "tech-supply", title: "消毒供应" }, { key: "tech-diagnostic", title: "检查检验" }] },
      { key: "admin", title: "行政管理", children: [{ key: "admin-engineering", title: "医学装备" }, { key: "admin-supply", title: "物资供应" }] }
    ];
  }
  if (view === "disciplines") {
    return [
      { key: "clinical-disc", title: "临床学科", children: [{ key: "disc-internal", title: "内科学" }, { key: "disc-rehab", title: "康复医学" }] },
      { key: "tech-disc", title: "医技学科", children: [{ key: "disc-diagnostic", title: "影像诊断" }, { key: "disc-lab", title: "检验医学" }] },
      { key: "support-disc", title: "支撑学科", children: [{ key: "disc-engineering", title: "医学工程" }, { key: "disc-nursing", title: "护理学" }] }
    ];
  }
  if (view === "staff") {
    return [
      { key: "clinical-role", title: "临床岗位", children: [{ key: "staff-clinical", title: "诊疗操作" }, { key: "staff-nursing", title: "护理处置" }] },
      { key: "engineering-role", title: "工程岗位", children: [{ key: "staff-engineering", title: "维护维修" }, { key: "staff-metering", title: "计量质控" }] },
      { key: "supply-role", title: "供应岗位", children: [{ key: "staff-material", title: "耗材管理" }, { key: "staff-warehouse", title: "库房管理" }] }
    ];
  }
  return [
    { key: "consumable-basic", title: "基础耗材", children: [{ key: "mat-infusion", title: "注输护理" }, { key: "mat-protection", title: "防护耗材" }] },
    { key: "consumable-high", title: "高值耗材", children: [{ key: "mat-intervention", title: "介入耗材" }, { key: "mat-implant", title: "植入材料" }] },
    { key: "consumable-diagnostic", title: "诊断试剂", children: [{ key: "mat-ivd", title: "体外诊断" }, { key: "mat-test", title: "检测耗材" }] }
  ];
}

function schemaFor(view: MasterDataView): DomainConfig["schema"] {
  if (view === "departments") {
    return [
      { field: "dept_code", label: "科室编码", required: true, rule: "全院唯一，作为接口交换主键" },
      { field: "dept_name", label: "标准科室名称", required: true, rule: "与诊疗科目或院内组织名称保持一致" },
      { field: "nmpa_scope", label: "分类目录参照", required: true, rule: "绑定设备/耗材使用、领用或管理责任边界" }
    ];
  }
  if (view === "disciplines") {
    return [
      { field: "discipline_code", label: "学科编码", required: true, rule: "院内学科能力主键" },
      { field: "discipline_name", label: "学科名称", required: true, rule: "与专科建设、诊疗科目、科研口径对齐" },
      { field: "device_scope", label: "器械能力范围", required: true, rule: "引用医疗器械分类目录定义学科设备与耗材范围" }
    ];
  }
  if (view === "staff") {
    return [
      { field: "role_code", label: "岗位/角色编码", required: true, rule: "用于授权、审计和接口交换" },
      { field: "credential_scope", label: "资质范围", required: true, rule: "与器械管理类别、培训记录和操作授权绑定" },
      { field: "dept_scope", label: "科室范围", required: true, rule: "限定可操作或可维护的主数据范围" }
    ];
  }
  return [
    { field: "material_code", label: "耗材编码", required: true, rule: "医保码、院内码或SPD码唯一映射" },
    { field: "generic_name", label: "通用名称", required: true, rule: "与注册证、医保目录和院内名称对齐" },
    { field: "device_category", label: "器械分类目录", required: true, rule: "引用医疗器械分类目录进行类别和风险管理" }
  ];
}

function configFor(activeId: string): DomainConfig {
  const view = viewForActiveId(activeId);
  if (view === "departments") {
    return {
      view,
      title: "科室主数据治理",
      lead: "按诊疗科目、院内组织和器械使用责任统一科室编码、启停状态和接口映射",
      sourceName: "诊疗科目 / 院内组织",
      sourceDetail: "国家卫健委诊疗科目、本院组织架构、HIS科室编码",
      nmpaUsage: "将器械分类目录中的使用场景、管理责任和耗材领用范围映射到责任科室",
      treeTitle: "科室体系树",
      searchPlaceholder: "搜索科室编码、名称、别名或责任范围",
      tree: treeFor(view),
      records: baseDepartmentRecords(),
      schema: schemaFor(view)
    };
  }
  if (view === "disciplines") {
    return {
      view,
      title: "学科主数据治理",
      lead: "以学科建设、专科能力和器械能力范围为核心统一学科主数据",
      sourceName: "学科目录 / 专科能力",
      sourceDetail: "诊疗科目、重点专科、科研学科和设备能力标签",
      nmpaUsage: "按医疗器械分类目录校准学科涉及的设备、耗材、风险等级和服务能力",
      treeTitle: "学科体系树",
      searchPlaceholder: "搜索学科编码、名称、专科方向或器械范围",
      tree: treeFor(view),
      records: baseDisciplineRecords(),
      schema: schemaFor(view)
    };
  }
  if (view === "staff") {
    return {
      view,
      title: "人员主数据治理",
      lead: "统一人员身份、岗位角色、授权范围和器械操作资质",
      sourceName: "HRP / 岗位权限",
      sourceDetail: "人员身份、执业资质、岗位授权、设备培训与操作记录",
      nmpaUsage: "按器械管理类别限定操作授权、维护责任、领用权限和审计范围",
      treeTitle: "人员角色树",
      searchPlaceholder: "搜索岗位编码、角色名称、资质或授权范围",
      tree: treeFor(view),
      records: baseStaffRecords(),
      schema: schemaFor(view)
    };
  }
  return {
    view,
    title: activeId === "material-specs" ? "耗材规格型号主数据治理" : "耗材主数据治理",
    lead: "按医保耗材目录、注册证、院内SPD编码和医疗器械分类目录统一耗材主数据",
    sourceName: "医保耗材目录 / SPD",
    sourceDetail: "医保C09/C11全量规格、院内耗材目录、注册证和SPD库存编码",
    nmpaUsage: "用医疗器械分类目录校准耗材管理类别、适用场景、注册证和风险等级",
    treeTitle: "耗材分类树",
    searchPlaceholder: "搜索耗材编码、通用名、注册证、医保码或器械分类",
    tree: treeFor(view),
    records: baseMaterialRecords(),
    schema: schemaFor(view)
  };
}

function treeDataFor(config: DomainConfig, counts: Map<string, number>): DataNode[] {
  return config.tree.map((group) => ({
    key: group.key,
    title: `${group.title} (${counts.get(group.key) ?? 0})`,
    children: group.children.map((child) => ({
      key: child.key,
      title: `${child.title} (${counts.get(child.key) ?? 0})`
    }))
  }));
}

function inferDepartmentGroup(row: DepartmentRow): { groupKey: string; treeKey: string; nmpaRef: string } {
  const text = `${row.dept_name || ""}${row.dept_type || ""}${row.standard_scope || ""}`;
  if (/手术|急诊|门诊|临床|内科|外科/.test(text)) {
    return { groupKey: "clinical", treeKey: /手术/.test(text) ? "clinical-surgery" : "clinical-emergency", nmpaRef: "器械使用、耗材领用和临床责任科室" };
  }
  if (/检验|影像|供应|药|病理|医技/.test(text)) {
    return { groupKey: "medical-tech", treeKey: /供应|消毒/.test(text) ? "tech-supply" : "tech-diagnostic", nmpaRef: "医技设备、试剂耗材和质量追溯责任科室" };
  }
  return { groupKey: "admin", treeKey: /设备|工程|装备/.test(text) ? "admin-engineering" : "admin-supply", nmpaRef: "医疗器械全生命周期管理责任科室" };
}

function recordFromDepartment(row: DepartmentRow): GovernanceRecord {
  const inferred = inferDepartmentGroup(row);
  return makeRecord({
    id: row.dept_id || row.dept_code,
    code: row.dept_code,
    name: row.dept_name,
    alias: row.dept_alias || undefined,
    groupKey: inferred.groupKey,
    treeKey: inferred.treeKey,
    classPath: `${row.dept_type || "科室"} / ${row.standard_scope || "院内科室"}`,
    standardRef: row.standard_version || row.standard_source || "国家卫健委诊疗科目",
    nmpaRef: inferred.nmpaRef,
    owner: row.maintenance_mode || "医务部 / 信息科",
    source: row.standard_source || row.source_batch_id || "HIS / 院内组织架构",
    status: row.status === "ACTIVE" ? "active" : "inactive",
    qualityStatus: row.standard_scope || row.dept_alias ? "pass" : "warning",
    mappingStatus: row.standard_source || row.standard_scope ? "mapped" : "pending",
    relatedSystems: ["HIS", "EMR", "设备平台", "耗材平台"],
    issues: row.standard_scope ? ["已归入标准科室口径"] : ["待补充标准科室口径"]
  });
}

function recordFromMaterial(row: MaterialRow): GovernanceRecord {
  const category = [row.cat_level_1, row.cat_level_2, row.cat_level_3].filter(Boolean).join(" / ");
  const text = `${row.generic_name || ""}${category}${row.reg_number || ""}`;
  const isHighValue = /植入|介入|导管|支架|球囊|骨科/.test(text);
  const isProtective = /口罩|防护|敷料|护理/.test(text);
  const treeKey = isHighValue ? (/植入|骨科/.test(text) ? "mat-implant" : "mat-intervention") : isProtective ? "mat-protection" : "mat-infusion";
  const groupKey = isHighValue ? "consumable-high" : "consumable-basic";
  return makeRecord({
    id: row.material_id,
    code: row.yb_code_27 || row.yb_code_20 || row.material_id,
    name: row.generic_name || "未命名耗材",
    groupKey,
    treeKey,
    classPath: category || (isHighValue ? "高值耗材" : "基础耗材"),
    standardRef: row.yb_code_27 ? "医保医用耗材代码库" : "院内耗材目录",
    nmpaRef: row.reg_number ? `注册证 ${row.reg_number}` : "待补充医疗器械分类目录引用",
    owner: "物资供应科 / SPD",
    source: row.source_batch_id || "SPD / 医保",
    status: row.status === "ACTIVE" ? "active" : "inactive",
    qualityStatus: row.reg_number || row.yb_code_27 ? "pass" : "warning",
    mappingStatus: row.yb_code_27 && row.reg_number ? "mapped" : "pending",
    relatedSystems: ["SPD", "HIS", "医保平台", "设备平台"],
    issues: row.reg_number ? ["注册证已关联"] : ["待补充注册证或分类目录引用"]
  });
}

function SchemaPanel({ config }: { config: DomainConfig }) {
  return (
    <Tabs
      items={[
        {
          key: "schema",
          label: "字段规范",
          children: (
            <Table
              size="small"
              rowKey="field"
              pagination={false}
              dataSource={config.schema}
              columns={[
                { title: "字段", dataIndex: "field" },
                { title: "名称", dataIndex: "label" },
                { title: "必填", dataIndex: "required", render: (value: boolean) => value ? <Tag color="error">必填</Tag> : <Tag>可选</Tag> },
                { title: "治理规则", dataIndex: "rule" }
              ]}
            />
          )
        },
        {
          key: "flow",
          label: "治理流程",
          children: (
            <Timeline
              items={[
                { color: "blue", children: "采集来源数据并建立批次号" },
                { color: "blue", children: "按医疗器械分类目录补充分类、风险和责任范围" },
                { color: "orange", children: "对编码、名称、授权和外部映射进行质检" },
                { color: "green", children: "审核后同步到HIS、SPD、设备平台和医保接口" }
              ]}
            />
          )
        }
      ]}
    />
  );
}

export function MasterDataGovernanceWorkbench({ activeId, client, session, onApiActivity }: Props) {
  const config = React.useMemo(() => configFor(activeId), [activeId]);
  const [keyword, setKeyword] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [selectedTreeKey, setSelectedTreeKey] = React.useState<React.Key | null>(config.tree[0]?.key ?? null);
  const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>(() => config.tree.map((item) => item.key));
  const [remoteRecords, setRemoteRecords] = React.useState<GovernanceRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<GovernanceRecord | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = React.useState(false);
  const [maintenanceKind, setMaintenanceKind] = React.useState<DictionaryKind>(config.view === "departments" ? "departments" : "materials");
  const canUseDictionaryWorkbench = config.view === "departments" || config.view === "materials";

  React.useEffect(() => {
    setKeyword("");
    setStatus("all");
    setSelectedTreeKey(config.tree[0]?.key ?? null);
    setExpandedKeys(config.tree.map((item) => item.key));
    setMaintenanceKind(config.view === "departments" ? "departments" : "materials");
    setSelected(null);
    setDetailOpen(false);
    setRemoteRecords([]);
  }, [config]);

  const loadRemoteRecords = React.useCallback(async () => {
    if (!canUseDictionaryWorkbench) {
      message.success("已刷新当前治理台账");
      return;
    }
    setLoading(true);
    if (config.view === "departments") {
      const result = await client.searchDepartments({ status: "", page: 1, pageSize: 50 });
      onApiActivity("GET /api/v1/departments/search", result);
      if (result.ok && result.data?.items.length) {
        setRemoteRecords(result.data.items.map(recordFromDepartment));
      }
    } else {
      const result = await client.searchMaterials({ status: "", page: 1, pageSize: 50 });
      onApiActivity("GET /api/v1/materials/search", result);
      if (result.ok && result.data?.items.length) {
        setRemoteRecords(result.data.items.map(recordFromMaterial));
      }
    }
    setLoading(false);
  }, [canUseDictionaryWorkbench, client, config.view, onApiActivity]);

  React.useEffect(() => {
    void loadRemoteRecords();
  }, [loadRemoteRecords]);

  const records = remoteRecords.length ? remoteRecords : config.records;
  const counts = React.useMemo(() => {
    const next = new Map<string, number>();
    records.forEach((row) => {
      next.set(row.groupKey, (next.get(row.groupKey) ?? 0) + 1);
      next.set(row.treeKey, (next.get(row.treeKey) ?? 0) + 1);
    });
    return next;
  }, [records]);
  const treeData = React.useMemo(() => treeDataFor(config, counts), [config, counts]);
  const selectedTreeTitle = React.useMemo(() => {
    for (const group of config.tree) {
      if (group.key === selectedTreeKey) return group.title;
      const child = group.children.find((item) => item.key === selectedTreeKey);
      if (child) return `${group.title} / ${child.title}`;
    }
    return "全部";
  }, [config.tree, selectedTreeKey]);

  const visibleRows = React.useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return records.filter((row) => {
      const matchesTree = !selectedTreeKey || row.groupKey === selectedTreeKey || row.treeKey === selectedTreeKey;
      const matchesStatus = status === "all" || row.status === status;
      const haystack = `${row.code} ${row.name} ${row.alias || ""} ${row.classPath} ${row.standardRef} ${row.nmpaRef} ${row.owner}`.toLowerCase();
      return matchesTree && matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [keyword, records, selectedTreeKey, status]);

  const metrics = React.useMemo(() => ({
    total: records.length,
    active: records.filter((row) => row.status === "active").length,
    mapped: records.filter((row) => row.mappingStatus === "mapped").length,
    warning: records.filter((row) => row.qualityStatus !== "pass" || row.mappingStatus !== "mapped").length
  }), [records]);

  const openDetail = (row: GovernanceRecord) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const handleMenuAction = (key: string) => {
    if (key === "refresh") {
      void loadRemoteRecords();
      return;
    }
    if (key === "maintain") {
      setMaintenanceOpen(true);
      return;
    }
    if (key === "quality") {
      message.success("已按医疗器械分类目录参照规则完成质检预演");
      return;
    }
    if (key === "export") {
      const blob = new Blob([JSON.stringify({ domain: config.title, generated_at: new Date().toISOString(), rows: visibleRows }, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${config.view}-master-governance-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      message.success("已导出当前治理清单");
    }
  };

  const columns: ColumnsType<GovernanceRecord> = [
    { title: "编码", dataIndex: "code", width: 150, render: (value: string) => <span className="master-code">{value}</span> },
    {
      title: "主数据名称",
      dataIndex: "name",
      width: 220,
      render: (_value: string, row) => (
        <div className="master-name-cell">
          <strong>{row.name}</strong>
          <span>{row.alias || row.owner}</span>
        </div>
      )
    },
    { title: "治理分类", dataIndex: "classPath", width: 220 },
    { title: "分类目录参照", dataIndex: "nmpaRef", width: 260, render: (value: string) => <span className="master-muted-text">{value}</span> },
    { title: "状态", dataIndex: "status", width: 86, render: recordStatusTag },
    { title: "质量", dataIndex: "qualityStatus", width: 92, render: qualityTag },
    { title: "映射", dataIndex: "mappingStatus", width: 96, render: mappingTag },
    { title: "影响系统", dataIndex: "relatedSystems", width: 180, render: (items: string[]) => items.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>) },
    { title: "更新", dataIndex: "updatedAt", width: 116 },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 130,
      render: (_value: unknown, row) => (
        <Space size={2}>
          <Button type="link" size="small" onClick={() => openDetail(row)}>详情</Button>
          <Button type="link" size="small" onClick={() => message.success(`${row.name} 已加入治理审核队列`)}>治理</Button>
        </Space>
      )
    }
  ];

  return (
    <section className="master-governance-workbench">
      <div className="master-governance-header">
        <div>
          <h2>{config.title}</h2>
          <p>{config.lead}</p>
        </div>
        <Space size={6} wrap>
          <Select size="small" value={status} options={statusOptions} style={{ width: 112 }} onChange={setStatus} />
          <Popover
            title="来源详情"
            content={(
              <div className="master-popover-grid">
                <div><span>主数据来源</span><strong>{config.sourceName}</strong></div>
                <div><span>来源说明</span><strong>{config.sourceDetail}</strong></div>
                <div><span>分类目录</span><strong>{nmpaReference.source}</strong></div>
                <div><span>施行日期</span><strong>{nmpaReference.effectiveDate}</strong></div>
              </div>
            )}
          >
            <Button size="small">来源详情</Button>
          </Popover>
          <Popover
            title="治理概况"
            content={(
              <div className="master-popover-grid">
                <div><span>总量</span><strong>{metrics.total}</strong></div>
                <div><span>启用</span><strong>{metrics.active}</strong></div>
                <div><span>已映射</span><strong>{metrics.mapped}</strong></div>
                <div><span>待治理</span><strong>{metrics.warning}</strong></div>
              </div>
            )}
          >
            <Button size="small">数据概况</Button>
          </Popover>
          <Button size="small" icon={<FileUp size={14} />} onClick={() => setMaintenanceOpen(true)}>
            {canUseDictionaryWorkbench ? "导入维护" : "字段维护"}
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "refresh", label: "刷新台账" },
                { key: "quality", label: "按分类目录质检" },
                { key: "maintain", label: canUseDictionaryWorkbench ? "打开查询/导入维护" : "打开字段规范" },
                { type: "divider" },
                { key: "export", label: "导出治理清单" }
              ],
              onClick: ({ key }) => handleMenuAction(String(key))
            }}
          >
            <Button size="small">更多操作 <ChevronDown size={14} /></Button>
          </Dropdown>
        </Space>
      </div>

      <div className="master-metric-bar">
        <div><span>主数据总量</span><strong>{metrics.total}</strong></div>
        <div><span>启用数据</span><strong>{metrics.active}</strong></div>
        <div><span>分类映射</span><strong>{metrics.mapped}</strong></div>
        <div><span>待治理项</span><strong>{metrics.warning}</strong></div>
      </div>

      <div className="master-governance-layout">
        <aside className="master-tree-column">
          <div className="master-tree-column-head">
            <strong>{config.treeTitle}</strong>
            <Tag>{records.length}</Tag>
          </div>
          <Input
            allowClear
            size="small"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={config.searchPlaceholder}
            prefix={<Search size={14} />}
          />
          <div className="master-tree-body">
            <Tree.DirectoryTree
              blockNode
              expandAction="click"
              treeData={treeData}
              selectedKeys={selectedTreeKey ? [selectedTreeKey] : []}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
              onSelect={(keys) => setSelectedTreeKey(keys[0] ?? null)}
            />
          </div>
        </aside>

        <section className="master-list-column">
          <div className="master-list-topbar">
            <span>{selectedTreeTitle}</span>
            <Space size={10} wrap>
              <span>当前记录数：{visibleRows.length}</span>
              <span>分类目录参照：{metrics.mapped}</span>
              <span>当前用户：{session?.displayName || "-"}</span>
            </Space>
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={visibleRows}
            loading={loading}
            size="small"
            sticky
            pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
            scroll={{ x: 1560, y: 520 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配主数据" /> }}
            rowClassName={(row) => row.id === selected?.id ? "selected-row" : ""}
            onRow={(row) => ({
              onClick: () => setSelected(row),
              onDoubleClick: () => openDetail(row)
            })}
          />
        </section>
      </div>

      <Drawer title={selected?.name || "主数据详情"} open={detailOpen} onClose={() => setDetailOpen(false)} width={760}>
        {selected ? (
          <Tabs
            items={[
              {
                key: "base",
                label: "基础信息",
                children: (
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="编码">{selected.code}</Descriptions.Item>
                    <Descriptions.Item label="名称">{selected.name}</Descriptions.Item>
                    <Descriptions.Item label="治理分类">{selected.classPath}</Descriptions.Item>
                    <Descriptions.Item label="权威来源">{selected.standardRef}</Descriptions.Item>
                    <Descriptions.Item label="责任部门">{selected.owner}</Descriptions.Item>
                    <Descriptions.Item label="数据状态">{recordStatusTag(selected.status)}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: "mapping",
                label: "分类映射",
                children: (
                  <div className="master-detail-stack">
                    <Tag color="blue">{nmpaReference.source}</Tag>
                    <strong>{selected.nmpaRef}</strong>
                    <p>{config.nmpaUsage}</p>
                    <Space wrap>{selected.relatedSystems.map((item) => <Tag key={item}>{item}</Tag>)}</Space>
                  </div>
                )
              },
              {
                key: "quality",
                label: "质量规则",
                children: (
                  <div className="master-detail-stack">
                    <Space>
                      {qualityTag(selected.qualityStatus)}
                      {mappingTag(selected.mappingStatus)}
                      <Badge status={selected.qualityStatus === "pass" ? "success" : "warning"} text="分类目录一致性" />
                    </Space>
                    {selected.issues.map((issue) => <div className="master-quality-row" key={issue}><ShieldCheck size={15} />{issue}</div>)}
                  </div>
                )
              },
              {
                key: "impact",
                label: "影响分析",
                children: (
                  <Timeline
                    items={selected.relatedSystems.map((system) => ({
                      color: "blue",
                      children: `${system} 将使用 ${selected.code} 作为交换、授权或统计口径`
                    }))}
                  />
                )
              }
            ]}
          />
        ) : null}
      </Drawer>

      <Drawer
        title={canUseDictionaryWorkbench ? "查询与导入维护" : `${config.title}字段规范`}
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        width={canUseDictionaryWorkbench ? "88vw" : 760}
      >
        {canUseDictionaryWorkbench ? (
          <DictionaryWorkbench
            client={client}
            activeKind={maintenanceKind}
            onActiveKindChange={setMaintenanceKind}
            onApiActivity={onApiActivity}
          />
        ) : (
          <SchemaPanel config={config} />
        )}
      </Drawer>
    </section>
  );
}
