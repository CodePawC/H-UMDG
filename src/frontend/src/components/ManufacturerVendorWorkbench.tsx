import React from "react";
import {
  Badge,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Building2, GitBranch, Link2, Plus, RefreshCw, Search } from "lucide-react";
import { HudmpApiClient } from "../lib/api";
import type { ApiResult, PagedResult, VendorCandidate, VendorMaster, VendorMasterInput } from "../types";

type Props = {
  client: HudmpApiClient;
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
};

const roleOptions = [
  { value: "manufacturer", label: "生产厂家" },
  { value: "registrant", label: "注册人" },
  { value: "filer", label: "备案人" },
  { value: "agent", label: "代理商" },
  { value: "dealer", label: "经销商" },
  { value: "distributor", label: "配送企业" },
  { value: "after_sales", label: "售后服务商" },
  { value: "supplier", label: "供应商" },
  { value: "service_provider", label: "服务商" }
];

const domainOptions = [
  { value: "drug", label: "药品" },
  { value: "device", label: "器械" },
  { value: "consumable", label: "耗材" },
  { value: "reagent", label: "试剂" },
  { value: "equipment", label: "装备" },
  { value: "service", label: "服务" },
  { value: "other", label: "其他" }
];

const relationOptions = [
  { value: "parent_company", label: "母公司" },
  { value: "subsidiary", label: "子公司" },
  { value: "group_member", label: "集团成员" },
  { value: "acquired_by", label: "被收购" },
  { value: "renamed_from", label: "曾用名" },
  { value: "merged_into", label: "合并" },
  { value: "authorized_agent", label: "授权代理" },
  { value: "authorized_after_sales", label: "授权售后" },
  { value: "regional_agent", label: "区域代理" },
  { value: "import_general_agent", label: "进口总代" },
  { value: "distribution_relation", label: "配送关系" }
];

function statusTag(status?: string) {
  const color = status === "enabled" || status === "approved" || status === "matched" ? "success" : status === "pending" || status === "need_review" ? "warning" : "default";
  return <Tag color={color}>{status || "-"}</Tag>;
}

function names(value?: string[] | null) {
  return value?.length ? value.join("；") : "-";
}

function DetailDrawer({
  vendor,
  open,
  onClose
}: {
  vendor: VendorMaster | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer title="厂商机构详情" width={720} open={open} onClose={onClose}>
      {vendor ? (
        <Tabs
          items={[
            {
              key: "base",
              label: "基本信息",
              children: (
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="厂商编码">{vendor.organization_code}</Descriptions.Item>
                  <Descriptions.Item label="标准名称">{vendor.standard_name}</Descriptions.Item>
                  <Descriptions.Item label="英文名称">{vendor.english_name || "-"}</Descriptions.Item>
                  <Descriptions.Item label="简称">{vendor.short_name || "-"}</Descriptions.Item>
                  <Descriptions.Item label="统一社会信用代码">{vendor.unified_social_credit_code || "-"}</Descriptions.Item>
                  <Descriptions.Item label="国家/地区">{vendor.country_region || "-"}</Descriptions.Item>
                  <Descriptions.Item label="地址">{vendor.address || "-"}</Descriptions.Item>
                  <Descriptions.Item label="数据来源">{vendor.data_source || "-"}</Descriptions.Item>
                </Descriptions>
              )
            },
            {
              key: "alias",
              label: "别名/历史名称",
              children: <p className="workflow-description">{names(vendor.alias_names)}</p>
            },
            {
              key: "roles",
              label: "角色信息",
              children: (
                <Space wrap>
                  {(vendor.roles || []).map((role) => (
                    <Tag key={role.id} color="blue">{role.role_name} / {role.business_domain}</Tag>
                  ))}
                </Space>
              )
            },
            {
              key: "relations",
              label: "母子公司关系",
              children: (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={vendor.relations || []}
                  columns={[
                    { title: "关系", dataIndex: "relation_name" },
                    { title: "类型", dataIndex: "relation_type" },
                    { title: "生效", dataIndex: "effective_date" },
                    { title: "失效", dataIndex: "expired_date" },
                    { title: "状态", dataIndex: "status", render: statusTag }
                  ]}
                />
              )
            },
            {
              key: "mappings",
              label: "外部编码映射",
              children: (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={vendor.external_mappings || []}
                  columns={[
                    { title: "系统", dataIndex: "system_name" },
                    { title: "外部编码", dataIndex: "external_code" },
                    { title: "外部名称", dataIndex: "external_name" },
                    { title: "置信度", dataIndex: "confidence" },
                    { title: "审核", dataIndex: "audit_status", render: statusTag }
                  ]}
                />
              )
            },
            {
              key: "links",
              label: "关联主数据",
              children: <p className="workflow-description">关联耗材和设备标准名称通过 org_id 引用厂商机构主数据。</p>
            }
          ]}
        />
      ) : null}
    </Drawer>
  );
}

export function ManufacturerVendorWorkbench({ client, onApiActivity }: Props) {
  const [form] = Form.useForm<VendorMasterInput>();
  const [roleForm] = Form.useForm();
  const [relationForm] = Form.useForm();
  const [mappingForm] = Form.useForm();
  const [candidateForm] = Form.useForm();
  const [keyword, setKeyword] = React.useState("");
  const [vendors, setVendors] = React.useState<ApiResult<PagedResult<VendorMaster>> | null>(null);
  const [candidates, setCandidates] = React.useState<ApiResult<PagedResult<VendorCandidate>> | null>(null);
  const [selected, setSelected] = React.useState<VendorMaster | null>(null);
  const [selectedCandidateRowKeys, setSelectedCandidateRowKeys] = React.useState<React.Key[]>([]);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const loadVendors = React.useCallback(async () => {
    setLoading(true);
    const result = await client.listManufacturerVendors({ keyword, status: "" });
    setVendors(result);
    onApiActivity("GET /api/v1/manufacturer-vendors", result);
    setLoading(false);
  }, [client, keyword, onApiActivity]);

  const loadCandidates = React.useCallback(async () => {
    const result = await client.listManufacturerVendorCandidates({ pageSize: 20 });
    setCandidates(result);
    onApiActivity("GET /api/v1/manufacturer-vendor-candidates", result);
  }, [client, onApiActivity]);

  React.useEffect(() => {
    void loadVendors();
    void loadCandidates();
  }, [loadVendors, loadCandidates]);

  const openDetail = async (row: VendorMaster) => {
    const detail = await client.getManufacturerVendor(row.id);
    onApiActivity("GET /api/v1/manufacturer-vendors/{id}", detail);
    if (detail.ok && detail.data) {
      setSelected(detail.data);
      setDrawerOpen(true);
    }
  };

  const createVendor = async (values: VendorMasterInput) => {
    const payload = { ...values, alias_names: typeof values.alias_names === "string" ? String(values.alias_names).split(/[;；,]/) : values.alias_names };
    const result = await client.createManufacturerVendor(payload);
    onApiActivity("POST /api/v1/manufacturer-vendors", result);
    if (result.ok) {
      message.success("厂商机构已创建");
      form.resetFields();
      void loadVendors();
    } else {
      message.error(result.message || result.code || "创建失败");
    }
  };

  const candidateTargetOrgId = () => String(candidateForm.getFieldValue("targetOrgId") || "").trim();

  const mapCandidate = async (row: VendorCandidate) => {
    const targetOrgId = candidateTargetOrgId();
    if (!targetOrgId) {
      message.warning("请输入目标厂商 org_id");
      return;
    }
    const result = await client.mapManufacturerVendorCandidate(row.id, targetOrgId);
    onApiActivity("POST /api/v1/manufacturer-vendor-candidates/{id}/map", result);
    if (result.ok) {
      message.success("候选已映射");
      void loadCandidates();
    } else {
      message.error(result.message || "映射失败");
    }
  };

  const mergeCandidate = async (row: VendorCandidate) => {
    const targetOrgId = candidateTargetOrgId();
    if (!targetOrgId) {
      message.warning("请输入目标厂商 org_id");
      return;
    }
    const result = await client.mergeManufacturerVendorCandidate(row.id, targetOrgId);
    onApiActivity("POST /api/v1/manufacturer-vendor-candidates/{id}/merge", result);
    if (result.ok) {
      message.success("候选已合并到厂商别名和外部映射");
      void loadCandidates();
      void loadVendors();
    } else {
      message.error(result.message || "合并失败");
    }
  };

  const batchReviewCandidates = async (action: "map_existing" | "merge" | "ignore") => {
    if (!selectedCandidateRowKeys.length) {
      message.warning("请选择候选厂商");
      return;
    }
    const targetOrgId = candidateTargetOrgId();
    if ((action === "map_existing" || action === "merge") && !targetOrgId) {
      message.warning("请输入目标厂商 org_id");
      return;
    }
    const result = await client.batchReviewManufacturerVendorCandidates(
      selectedCandidateRowKeys.map((candidateId) => ({
        candidate_id: String(candidateId),
        action,
        org_id: action === "ignore" ? undefined : targetOrgId
      }))
    );
    onApiActivity("POST /api/v1/manufacturer-vendor-candidates/batch", result);
    if (result.ok) {
      message.success("候选批量处理完成");
      setSelectedCandidateRowKeys([]);
      void loadCandidates();
      void loadVendors();
    } else {
      message.error(result.message || "批量处理失败");
    }
  };

  const selectedId = selected?.id || "";

  const addRole = async (values: { role_type: string; business_domain: string }) => {
    if (!selectedId) return;
    const roleLabel = roleOptions.find((item) => item.value === values.role_type)?.label;
    const result = await client.addManufacturerVendorRole(selectedId, { ...values, role_name: roleLabel, status: "enabled" });
    onApiActivity("POST /api/v1/manufacturer-vendors/{id}/roles", result);
    if (result.ok) {
      message.success("角色已维护");
      roleForm.resetFields();
      void openDetail(selected as VendorMaster);
    } else {
      message.error(result.message || "角色维护失败");
    }
  };

  const addMapping = async (values: { system_name: string; external_code?: string; external_name?: string }) => {
    if (!selectedId) return;
    const result = await client.addManufacturerVendorMapping(selectedId, { ...values, confidence: 1, audit_status: "approved" });
    onApiActivity("POST /api/v1/manufacturer-vendors/{id}/external-mappings", result);
    if (result.ok) {
      message.success("外部编码已维护");
      mappingForm.resetFields();
      void openDetail(selected as VendorMaster);
    } else {
      message.error(result.message || "编码维护失败");
    }
  };

  const addRelation = async (values: { child_org_id: string; relation_type: string; effective_date?: string; expired_date?: string }) => {
    if (!selectedId) return;
    const relationLabel = relationOptions.find((item) => item.value === values.relation_type)?.label;
    const result = await client.addManufacturerVendorRelation({
      parent_org_id: selectedId,
      child_org_id: values.child_org_id,
      relation_type: values.relation_type,
      relation_name: relationLabel,
      effective_date: values.effective_date,
      expired_date: values.expired_date
    });
    onApiActivity("POST /api/v1/manufacturer-vendor-relations", result);
    if (result.ok) {
      message.success("厂商关系已维护");
      relationForm.resetFields();
      void openDetail(selected as VendorMaster);
    } else {
      message.error(result.message || "关系维护失败");
    }
  };

  const columns: ColumnsType<VendorMaster> = [
    { title: "厂商编码", dataIndex: "organization_code", width: 140 },
    {
      title: "标准名称",
      dataIndex: "standard_name",
      width: 240,
      render: (value, row) => (
        <Button type="link" onClick={() => void openDetail(row)}>{value}</Button>
      )
    },
    { title: "简称", dataIndex: "short_name", width: 140 },
    { title: "英文名称", dataIndex: "english_name", width: 180 },
    { title: "统一社会信用代码", dataIndex: "unified_social_credit_code", width: 190 },
    { title: "国家/地区", dataIndex: "country_region", width: 120 },
    {
      title: "角色",
      dataIndex: "roles",
      width: 220,
      render: (roles: VendorMaster["roles"]) => (
        <Space wrap size={4}>
          {(roles || []).slice(0, 3).map((role) => <Tag key={role.id}>{role.role_name}</Tag>)}
        </Space>
      )
    },
    { title: "状态", dataIndex: "status", width: 100, render: statusTag },
    { title: "质量状态", dataIndex: "quality_status", width: 140, render: statusTag },
    { title: "审核状态", dataIndex: "audit_status", width: 120, render: statusTag },
    { title: "更新时间", dataIndex: "updated_at", width: 170 },
    {
      title: "操作",
      fixed: "right",
      width: 220,
      render: (_value, row) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => void openDetail(row)}>详情</Button>
          <Button type="link" size="small" onClick={() => { setSelected(row); setDrawerOpen(true); }}>维护</Button>
          <Popconfirm title="确认切换启停状态？" onConfirm={() => void client.updateManufacturerVendorStatus(row.id, row.status === "enabled" ? "disabled" : "enabled").then(loadVendors)}>
            <Button type="link" size="small">{row.status === "enabled" ? "停用" : "启用"}</Button>
          </Popconfirm>
          <Button type="link" size="small" onClick={() => void client.submitManufacturerVendor(row.id).then(loadVendors)}>提交</Button>
          <Button type="link" size="small" onClick={() => void client.auditManufacturerVendor(row.id, "approved").then(loadVendors)}>发布</Button>
        </Space>
      )
    }
  ];

  return (
    <section className="vendor-workbench">
      <Tabs
        items={[
          {
            key: "archive",
            label: "厂商机构档案",
            children: (
              <Space direction="vertical" size={14} className="vendor-tab">
                <div className="section-toolbar">
                  <Space>
                    <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="名称、简称、英文名、别名、信用代码" prefix={<Search size={16} />} />
                    <Button icon={<RefreshCw size={16} />} onClick={() => void loadVendors()} loading={loading}>查询</Button>
                  </Space>
                  <Badge count={vendors?.data?.page.total ?? 0} showZero>
                    <Tag color="blue">厂商机构</Tag>
                  </Badge>
                </div>
                <Form form={form} layout="inline" onFinish={createVendor} className="vendor-create-form">
                  <Form.Item name="standard_name" rules={[{ required: true, message: "请输入标准名称" }]}>
                    <Input placeholder="标准中文名称" />
                  </Form.Item>
                  <Form.Item name="short_name">
                    <Input placeholder="简称" />
                  </Form.Item>
                  <Form.Item name="english_name">
                    <Input placeholder="英文名称" />
                  </Form.Item>
                  <Form.Item name="unified_social_credit_code">
                    <Input placeholder="统一社会信用代码" />
                  </Form.Item>
                  <Form.Item name="alias_names">
                    <Input placeholder="别名/历史名称，分号分隔" />
                  </Form.Item>
                  <Form.Item>
                    <Button htmlType="submit" type="primary" icon={<Plus size={16} />}>新增厂商</Button>
                  </Form.Item>
                </Form>
                <Table rowKey="id" size="middle" columns={columns} dataSource={vendors?.data?.items || []} scroll={{ x: 1850 }} pagination={{ pageSize: 10 }} />
              </Space>
            )
          },
          {
            key: "alias",
            label: "厂商别名库",
            children: <p className="workflow-description">英文名、简称、曾用名、医保目录原始名称、供应商门户名称和设备台账历史名称统一存入厂商档案的别名字段，并参与检索。</p>
          },
          {
            key: "relation",
            label: "厂商关系图谱",
            children: (
              <Space direction="vertical" className="vendor-tab">
                <p className="workflow-description">选择一个厂商档案后，可维护母子公司、收购、更名、合并、授权代理、授权售后等关系。</p>
                <Form form={relationForm} layout="inline" onFinish={addRelation}>
                  <Form.Item name="child_org_id" rules={[{ required: true }]}>
                    <Input placeholder="子厂商/关联厂商 org_id" />
                  </Form.Item>
                  <Form.Item name="relation_type" rules={[{ required: true }]}>
                    <Select options={relationOptions} placeholder="关系类型" style={{ width: 180 }} />
                  </Form.Item>
                  <Form.Item name="effective_date">
                    <Input placeholder="生效日期 YYYY-MM-DD" />
                  </Form.Item>
                  <Form.Item>
                    <Button htmlType="submit" icon={<GitBranch size={16} />} disabled={!selectedId}>新增关系</Button>
                  </Form.Item>
                </Form>
              </Space>
            )
          },
          {
            key: "mapping",
            label: "厂商编码映射",
            children: (
              <Form form={mappingForm} layout="inline" onFinish={addMapping}>
                <Form.Item name="system_name" rules={[{ required: true }]}>
                  <Select
                    placeholder="外部系统"
                    style={{ width: 180 }}
                    options={["NHSA", "SPD", "HIS", "FINANCE", "SUPPLIER_PORTAL", "EQUIPMENT_OS", "MANUAL", "OTHER"].map((value) => ({ value, label: value }))}
                  />
                </Form.Item>
                <Form.Item name="external_code">
                  <Input placeholder="外部编码" />
                </Form.Item>
                <Form.Item name="external_name">
                  <Input placeholder="外部名称" />
                </Form.Item>
                <Form.Item>
                  <Button htmlType="submit" icon={<Link2 size={16} />} disabled={!selectedId}>新增映射</Button>
                </Form.Item>
              </Form>
            )
          },
          {
            key: "candidate",
            label: "厂商候选审核",
            children: (
              <Space direction="vertical" size={12} className="vendor-tab">
                <Form form={candidateForm} layout="inline">
                  <Form.Item name="targetOrgId">
                    <Input placeholder="映射到已有厂商 org_id" />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button onClick={() => void batchReviewCandidates("map_existing")}>批量映射</Button>
                      <Button onClick={() => void batchReviewCandidates("merge")}>批量合并</Button>
                      <Button onClick={() => void batchReviewCandidates("ignore")}>批量忽略</Button>
                    </Space>
                  </Form.Item>
                </Form>
                <Table
                  rowKey="id"
                  size="middle"
                  rowSelection={{ selectedRowKeys: selectedCandidateRowKeys, onChange: setSelectedCandidateRowKeys }}
                  dataSource={candidates?.data?.items || []}
                  pagination={{ pageSize: 8 }}
                  columns={[
                    { title: "来源", dataIndex: "source_system", width: 110 },
                    { title: "原始名称", dataIndex: "raw_name", width: 220 },
                    { title: "清洗名称", dataIndex: "normalized_name", width: 220 },
                    { title: "匹配状态", dataIndex: "match_status", width: 120, render: statusTag },
                    { title: "建议", dataIndex: "suggested_action", width: 130 },
                    { title: "匹配 org_id", dataIndex: "matched_org_id", width: 260 },
                    {
                      title: "操作",
                      fixed: "right",
                      width: 260,
                      render: (_value, row) => (
                        <Space size={4}>
                          <Button type="link" size="small" onClick={() => void client.createManufacturerVendorFromCandidate(row.id, { roles: [{ role_type: "manufacturer", business_domain: "consumable" }] }).then(loadCandidates)}>创建新厂商</Button>
                          <Button type="link" size="small" onClick={() => void mapCandidate(row)}>映射已有</Button>
                          <Button type="link" size="small" onClick={() => void mergeCandidate(row)}>合并</Button>
                          <Button type="link" size="small" onClick={() => void client.ignoreManufacturerVendorCandidate(row.id).then(loadCandidates)}>忽略</Button>
                        </Space>
                      )
                    }
                  ]}
                  scroll={{ x: 1400 }}
                />
              </Space>
            )
          }
        ]}
      />
      <DetailDrawer vendor={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="config-note">
        <Building2 size={17} />
        <span>厂商机构主数据只维护机构标准身份；报价、合同、发票、付款、资质上传等流程由供应商门户或医学装备运营管理平台负责。</span>
      </div>
    </section>
  );
}
