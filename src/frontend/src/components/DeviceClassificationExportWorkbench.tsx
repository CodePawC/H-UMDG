import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Descriptions, Empty, Form, Input, Modal, Select, Space, Steps, Table, Tabs, Tag, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeft, ClipboardCopy, Download, FileArchive, FileJson, FileSpreadsheet, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { HudmpApiClient } from "../lib/api";
import type {
  ApiResult,
  DeviceClassificationExportCreateInput,
  DeviceClassificationExportTask,
  DeviceClassificationExportTemplate,
  UserSession
} from "../types";

type Props = {
  client: HudmpApiClient;
  session: UserSession;
  onBack: () => void;
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
};

const scopeOptions = [
  { value: "effective", label: "当前有效目录", description: "只导出当前启用版本中的有效目录，适用于日常使用和系统引用。" },
  { value: "version", label: "指定版本目录", description: "选择某一个目录版本进行导出，适用于历史版本复核和版本留档。" },
  { value: "batch", label: "指定导入批次", description: "只导出某一次导入批次产生或修订的数据，适用于批次复核。" },
  { value: "category", label: "指定分类范围", description: "只导出某个一级分类或二级分类下的数据。" },
  { value: "abnormal", label: "异常/待确认数据", description: "导出解析异常、待确认、纠错中的数据，适用于数据治理。" },
  { value: "historical", label: "已作废/已合并数据", description: "导出历史保留但不再作为有效目录使用的数据，适用于审计追溯。" },
  { value: "version_diff", label: "版本差异数据", description: "选择两个版本，导出新增、修改、废止、调整等差异。" }
];

const formatOptions = [
  { value: "xlsx", label: "Excel .xlsx", icon: <FileSpreadsheet size={18} />, description: "适合日常核对和打印。" },
  { value: "csv", label: "CSV .csv", icon: <FileText size={18} />, description: "适合系统交换和批量处理。" },
  { value: "json", label: "JSON .json", icon: <FileJson size={18} />, description: "适合接口和程序调用。" },
  { value: "pdf", label: "PDF .pdf", icon: <FileArchive size={18} />, description: "固定版式归档和监管备查，待版式服务启用后开放。", disabled: true },
  { value: "zip", label: "ZIP 压缩包", icon: <FileArchive size={18} />, description: "用于同时导出目录数据、导出说明和机器可读清单。" }
];

const templateDescriptions: Record<string, string> = {
  standard: "分类编码、层级、目录条目、产品描述、预期用途、品名举例和管理类别。",
  compact: "仅导出编码、层级、名称和管理类别，适合普通查看人员。",
  governance: "在标准目录基础上增加状态、来源、校验和纠错字段。",
  version_diff: "面向版本复核，导出新增、修改、废止和修订依据。",
  interface: "面向系统接口，包含主键、父级、版本、状态和更新时间。",
  regulatory: "面向监管备查，包含来源公告、文件 Hash、导入时间和审计状态。"
};

function roleAllowedTemplates(role: UserSession["role"]): string[] {
  if (role === "platform_admin") {
    return ["standard", "compact", "governance", "version_diff", "interface", "regulatory"];
  }
  if (role === "auditor") {
    return ["compact", "governance", "regulatory"];
  }
  return ["standard", "compact", "governance", "version_diff", "regulatory"];
}

function roleAllowedFormats(role: UserSession["role"]): string[] {
  if (role === "platform_admin") {
    return ["xlsx", "csv", "json", "zip"];
  }
  if (role === "auditor") {
    return ["xlsx", "pdf"];
  }
  return ["xlsx", "csv", "zip"];
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function DeviceClassificationExportWorkbench({ client, session, onBack, onApiActivity }: Props) {
  const [activeTab, setActiveTab] = useState("new");
  const [step, setStep] = useState(0);
  const [scopeType, setScopeType] = useState("effective");
  const [batchId, setBatchId] = useState("");
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [versionLabel, setVersionLabel] = useState("当前启用版本");
  const [templateId, setTemplateId] = useState("standard");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [format, setFormat] = useState("xlsx");
  const [taskName, setTaskName] = useState("医疗器械分类目录标准导出");
  const [purpose, setPurpose] = useState("目录复核");
  const [estimatedCount, setEstimatedCount] = useState(0);
  const [templates, setTemplates] = useState<DeviceClassificationExportTemplate[]>([]);
  const [tasks, setTasks] = useState<DeviceClassificationExportTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<DeviceClassificationExportTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const allowedTemplates = useMemo(() => roleAllowedTemplates(session.role), [session.role]);
  const allowedFormats = useMemo(() => roleAllowedFormats(session.role), [session.role]);
  const currentTemplate = templates.find((item) => item.template_id === templateId);
  const effectiveFields = selectedFields.length ? selectedFields : currentTemplate?.fields.map((field) => field.field) ?? [];
  const currentScope = scopeOptions.find((item) => item.value === scopeType) ?? scopeOptions[0];

  const criteria = useMemo(() => {
    const next: Record<string, unknown> = { scope_type: scopeType, version_label: versionLabel };
    if (scopeType === "batch" && batchId.trim()) {
      next.batch_id = batchId.trim();
    }
    if (scopeType === "category" && categoryKeyword.trim()) {
      next.category_keyword = categoryKeyword.trim();
    }
    return next;
  }, [batchId, categoryKeyword, scopeType, versionLabel]);

  const loadTemplates = async () => {
    const result = await client.listDeviceClassificationExportTemplates();
    onApiActivity("GET /api/v1/equipment/device-classifications/export/templates", result);
    if (result.ok && result.data) {
      setTemplates(result.data.items);
      const firstAllowed = result.data.items.find((item) => allowedTemplates.includes(item.template_id));
      if (firstAllowed && !allowedTemplates.includes(templateId)) {
        setTemplateId(firstAllowed.template_id);
        setSelectedFields(firstAllowed.fields.map((field) => field.field));
      } else if (!selectedFields.length) {
        const current = result.data.items.find((item) => item.template_id === templateId) ?? firstAllowed;
        setSelectedFields(current?.fields.map((field) => field.field) ?? []);
      }
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    const result = await client.listDeviceClassificationExportTasks();
    onApiActivity("GET /api/v1/equipment/device-classifications/export/tasks", result);
    setLoading(false);
    if (result.ok && result.data) {
      setTasks(result.data.items);
    }
  };

  const estimate = async () => {
    const result = await client.estimateDeviceClassificationExport({ scope_type: scopeType, criteria, template_id: templateId });
    onApiActivity("POST /api/v1/equipment/device-classifications/export/estimate", result);
    if (result.ok && result.data) {
      setEstimatedCount(result.data.estimated_count);
    }
  };

  useEffect(() => {
    void loadTemplates();
    void loadTasks();
  }, []);

  useEffect(() => {
    void estimate();
  }, [criteria, templateId]);

  useEffect(() => {
    const nextTemplate = templates.find((item) => item.template_id === templateId);
    setSelectedFields(nextTemplate?.fields.map((field) => field.field) ?? []);
  }, [templateId]);

  const createInput = (): DeviceClassificationExportCreateInput => ({
    task_name: taskName,
    purpose,
    scope_type: scopeType,
    criteria,
    template_id: templateId,
    fields: effectiveFields,
    format,
    version_label: versionLabel
  });

  const generateExport = async () => {
    if (!allowedTemplates.includes(templateId)) {
      message.warning("当前角色无权使用该导出模板");
      return;
    }
    if (!allowedFormats.includes(format)) {
      message.warning("当前角色无权使用该导出格式");
      return;
    }
    setGenerating(true);
    const result = await client.createDeviceClassificationExportTask(createInput());
    onApiActivity("POST /api/v1/equipment/device-classifications/export/tasks", result);
    setGenerating(false);
    if (result.ok && result.data) {
      message.success("导出文件已生成并写入导出记录");
      setSelectedTask(result.data);
      setActiveTab("records");
      await loadTasks();
    } else {
      message.error(result.message || "导出失败");
    }
  };

  const downloadTask = async (task: DeviceClassificationExportTask) => {
    const result = await client.downloadDeviceClassificationExportTask(task.task_no);
    onApiActivity("GET /api/v1/equipment/device-classifications/export/tasks/{task_no}/download", result);
    if (result.ok && result.data) {
      downloadBlob(result.data, task.file_name);
      message.success("导出文件下载已记录审计日志");
      await loadTasks();
    } else {
      message.error(result.message || "下载失败");
    }
  };

  const copyTask = (task: DeviceClassificationExportTask) => {
    setTaskName(`${task.task_name} 副本`);
    setPurpose(task.purpose || "目录复核");
    setScopeType(task.scope_type || "effective");
    setTemplateId(task.template_id || "standard");
    setFormat(task.format || "xlsx");
    setSelectedFields(task.fields || []);
    setVersionLabel(task.version_label || "当前启用版本");
    setActiveTab("new");
    setStep(0);
    message.success("已复制导出方案");
  };

  const recordColumns: ColumnsType<DeviceClassificationExportTask> = [
    {
      title: "导出任务号",
      dataIndex: "task_no",
      width: 170,
      render: (value, row) => <Button type="link" size="small" onClick={() => setSelectedTask(row)}>{value}</Button>
    },
    { title: "导出任务名称", dataIndex: "task_name", ellipsis: true },
    { title: "导出范围", dataIndex: "scope_label", width: 130 },
    { title: "导出版本", dataIndex: "version_label", width: 150, ellipsis: true },
    { title: "导出模板", dataIndex: "template_name", width: 130 },
    { title: "格式", dataIndex: "format", width: 80, render: (value) => <Tag>{String(value).toUpperCase()}</Tag> },
    { title: "条目数", dataIndex: "row_count", width: 90 },
    { title: "导出人", dataIndex: "operator_name", width: 110 },
    { title: "导出时间", dataIndex: "created_at", width: 170, render: formatTime },
    { title: "文件状态", dataIndex: "file_status", width: 100, render: (value) => <Tag color="success">{value}</Tag> },
    { title: "下载次数", dataIndex: "download_count", width: 90 },
    { title: "最近下载", dataIndex: "last_downloaded_at", width: 170, render: formatTime },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 230,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" icon={<Download size={14} />} onClick={() => void downloadTask(row)}>下载</Button>
          <Button size="small" onClick={() => setSelectedTask(row)}>详情</Button>
          <Button size="small" icon={<ClipboardCopy size={14} />} onClick={() => copyTask(row)}>复制方案</Button>
        </Space>
      )
    }
  ];

  const taskSummary = [
    { label: "导出任务名称", value: taskName },
    { label: "导出范围", value: currentScope.label },
    { label: "目录版本", value: versionLabel },
    { label: "导出模板", value: currentTemplate?.template_name || templateId },
    { label: "导出格式", value: format.toUpperCase() },
    { label: "预计导出条目数", value: estimatedCount },
    { label: "是否包含来源追溯", value: ["governance", "regulatory"].includes(templateId) ? "是" : "否" },
    { label: "是否包含审计字段", value: ["regulatory", "interface"].includes(templateId) ? "是" : "否" },
    { label: "是否生成导出说明", value: format === "xlsx" ? "是" : "JSON 内嵌/CSV 不单独生成" },
    { label: "操作人", value: session.displayName },
    { label: "导出时间", value: new Date().toLocaleString("zh-CN", { hour12: false }) }
  ];

  return (
    <section className="device-export-workbench">
      <div className="device-export-header">
        <Space size={12}>
          <Button icon={<ArrowLeft size={16} />} onClick={onBack}>返回目录</Button>
          <div>
            <h2>医疗器械分类目录导出</h2>
            <p>以标准化导出任务方式生成目录文件，并保留导出记录、下载记录和审计日志。</p>
          </div>
        </Space>
        <Space>
          <Tag color="blue">/master-data/device-classification/export</Tag>
          <Button icon={<RefreshCw size={16} />} onClick={() => void loadTasks()}>刷新记录</Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "new",
            label: "新建导出任务",
            children: (
              <div className="device-export-task">
                <Steps
                  current={step}
                  items={[
                    { title: "选择导出范围" },
                    { title: "选择导出内容" },
                    { title: "选择导出格式" },
                    { title: "确认并生成" }
                  ]}
                />

                {step === 0 ? (
                  <div className="device-export-grid">
                    {scopeOptions.map((item) => (
                      <Card
                        key={item.value}
                        className={scopeType === item.value ? "device-export-option selected" : "device-export-option"}
                        onClick={() => setScopeType(item.value)}
                      >
                        <h3>{item.label}</h3>
                        <p>{item.description}</p>
                      </Card>
                    ))}
                    {scopeType === "batch" ? (
                      <Input value={batchId} onChange={(event) => setBatchId(event.target.value)} placeholder="请输入导入批次号" />
                    ) : null}
                    {scopeType === "category" ? (
                      <Input value={categoryKeyword} onChange={(event) => setCategoryKeyword(event.target.value)} placeholder="请输入一级/二级分类名称或编码" />
                    ) : null}
                    {scopeType === "version" || scopeType === "version_diff" ? (
                      <Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="请输入目录版本或版本对比说明" />
                    ) : null}
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="device-export-content-grid">
                    <div className="device-export-template-list">
                      {templates.map((template) => {
                        const disabled = !allowedTemplates.includes(template.template_id);
                        return (
                          <Card
                            key={template.template_id}
                            className={templateId === template.template_id ? "device-export-option selected" : "device-export-option"}
                            onClick={() => !disabled && setTemplateId(template.template_id)}
                          >
                            <Space align="start">
                              <ShieldCheck size={18} />
                              <div>
                                <h3>{template.template_name}</h3>
                                <p>{templateDescriptions[template.template_id] || "标准导出模板。"}</p>
                                {disabled ? <Tag color="default">当前角色不可用</Tag> : <Tag color="processing">可用</Tag>}
                              </div>
                            </Space>
                          </Card>
                        );
                      })}
                    </div>
                    <Card title="字段微调" className="device-export-fields">
                      {currentTemplate ? (
                        <Checkbox.Group value={effectiveFields} onChange={(values) => setSelectedFields(values.map(String))}>
                          <Space direction="vertical">
                            {currentTemplate.fields.map((field) => (
                              <Checkbox key={field.field} value={field.field}>
                                <Tooltip title={field.description}>
                                  <span>{field.label}</span>
                                </Tooltip>
                                {currentTemplate.sensitive_fields?.includes(field.field) ? <Tag color="orange">敏感</Tag> : null}
                              </Checkbox>
                            ))}
                          </Space>
                        </Checkbox.Group>
                      ) : (
                        <Empty description="暂无模板" />
                      )}
                    </Card>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="device-export-grid">
                    {formatOptions.map((item) => {
                      const disabled = item.disabled || !allowedFormats.includes(item.value);
                      return (
                        <Card
                          key={item.value}
                          className={format === item.value ? "device-export-option selected" : "device-export-option"}
                          onClick={() => !disabled && setFormat(item.value)}
                        >
                          <Space>
                            {item.icon}
                            <h3>{item.label}</h3>
                          </Space>
                          <p>{item.description}</p>
                          {disabled ? <Tag color="default">暂不可用或无权限</Tag> : <Tag color="success">可生成</Tag>}
                        </Card>
                      );
                    })}
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="device-export-confirm">
                    <Card title="导出任务信息">
                      <Form layout="vertical">
                        <Form.Item label="导出任务名称">
                          <Input value={taskName} onChange={(event) => setTaskName(event.target.value)} />
                        </Form.Item>
                        <Form.Item label="导出用途">
                          <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
                        </Form.Item>
                      </Form>
                    </Card>
                    <Card title="确认摘要">
                      <Descriptions column={2} size="small">
                        {taskSummary.map((item) => (
                          <Descriptions.Item key={item.label} label={item.label}>{item.value}</Descriptions.Item>
                        ))}
                      </Descriptions>
                    </Card>
                    <Alert type="info" showIcon message="导出生成和后续下载都会写入审计日志。Excel 默认包含导出说明、目录数据、字段说明、来源与版本等 Sheet。" />
                  </div>
                ) : null}

                <div className="device-export-footer">
                  <Button disabled={step === 0} onClick={() => setStep((value) => Math.max(value - 1, 0))}>上一步</Button>
                  <Button onClick={() => message.success("导出方案已保留在当前页面，可继续生成或复制记录复用")}>保存导出方案</Button>
                  {step < 3 ? (
                    <Button type="primary" onClick={() => setStep((value) => Math.min(value + 1, 3))}>下一步</Button>
                  ) : (
                    <Button type="primary" loading={generating} onClick={() => void generateExport()}>生成导出文件</Button>
                  )}
                  <Button onClick={onBack}>取消</Button>
                </div>
              </div>
            )
          },
          {
            key: "records",
            label: "导出记录",
            children: (
              <Table
                rowKey="task_no"
                loading={loading}
                columns={recordColumns}
                dataSource={tasks}
                scroll={{ x: 1500 }}
                pagination={{ pageSize: 10 }}
                size="small"
              />
            )
          },
          {
            key: "templates",
            label: "导出模板管理",
            children: (
              <div className="device-export-grid">
                {templates.map((template) => (
                  <Card key={template.template_id} title={template.template_name}>
                    <p>{templateDescriptions[template.template_id] || "标准导出模板。"}</p>
                    <Space size={4} wrap>
                      {template.fields.map((field) => (
                        <Tag key={field.field}>{field.label}</Tag>
                      ))}
                    </Space>
                  </Card>
                ))}
              </div>
            )
          }
        ]}
      />

      <Modal
        width={980}
        title={selectedTask ? `导出详情：${selectedTask.task_no}` : "导出详情"}
        open={Boolean(selectedTask)}
        onCancel={() => setSelectedTask(null)}
        footer={selectedTask ? [
          <Button key="download" type="primary" icon={<Download size={14} />} onClick={() => void downloadTask(selectedTask)}>下载文件</Button>,
          <Button key="close" onClick={() => setSelectedTask(null)}>关闭</Button>
        ] : null}
      >
        {selectedTask ? (
          <Tabs
            items={[
              {
                key: "overview",
                label: "导出任务概览",
                children: (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="任务名称">{selectedTask.task_name}</Descriptions.Item>
                    <Descriptions.Item label="文件状态"><Tag color="success">{selectedTask.file_status}</Tag></Descriptions.Item>
                    <Descriptions.Item label="导出范围">{selectedTask.scope_label}</Descriptions.Item>
                    <Descriptions.Item label="目录版本">{selectedTask.version_label}</Descriptions.Item>
                    <Descriptions.Item label="导出模板">{selectedTask.template_name}</Descriptions.Item>
                    <Descriptions.Item label="导出格式">{selectedTask.format.toUpperCase()}</Descriptions.Item>
                    <Descriptions.Item label="导出条目数">{selectedTask.row_count}</Descriptions.Item>
                    <Descriptions.Item label="导出人">{selectedTask.operator_name}</Descriptions.Item>
                    <Descriptions.Item label="导出时间">{formatTime(selectedTask.created_at)}</Descriptions.Item>
                    <Descriptions.Item label="导出用途">{selectedTask.purpose || "-"}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: "conditions",
                label: "导出条件",
                children: <pre className="device-export-json">{JSON.stringify(selectedTask.criteria || {}, null, 2)}</pre>
              },
              {
                key: "fields",
                label: "导出字段",
                children: <Space size={4} wrap>{(selectedTask.fields || []).map((field) => <Tag key={field}>{field}</Tag>)}</Space>
              },
              {
                key: "file",
                label: "生成文件",
                children: (
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="文件名">
                      <Tooltip title={selectedTask.file_name}>
                        <span className="device-export-filename">{selectedTask.file_name}</span>
                      </Tooltip>
                    </Descriptions.Item>
                    <Descriptions.Item label="文件 Hash">{selectedTask.file_hash}</Descriptions.Item>
                    <Descriptions.Item label="下载次数">{selectedTask.download_count}</Descriptions.Item>
                    <Descriptions.Item label="最近下载时间">{formatTime(selectedTask.last_downloaded_at)}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: "download",
                label: "下载记录",
                children: <pre className="device-export-json">{JSON.stringify(selectedTask.download_logs || [], null, 2)}</pre>
              },
              {
                key: "audit",
                label: "审计日志",
                children: <pre className="device-export-json">{JSON.stringify(selectedTask.audit_logs || [], null, 2)}</pre>
              }
            ]}
          />
        ) : null}
      </Modal>
    </section>
  );
}
