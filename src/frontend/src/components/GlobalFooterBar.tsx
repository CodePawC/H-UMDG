import React from "react";
import { Button, Modal, Space, Tag, Tooltip } from "antd";
import { APP_NAME_ZH, APP_VERSION_LABEL } from "../lib/appIdentity";

type FooterStatus = "normal" | "error" | "mock";

type FooterStatusItem = {
  label: string;
  value: FooterStatus;
  detail?: string;
};

type GlobalFooterBarProps = {
  appName?: string;
  hospitalName?: string;
  environment?: string;
  version?: string;
  currentUser?: string;
  serviceStatus?: FooterStatus;
  databaseStatus?: FooterStatus;
  redisStatus?: FooterStatus;
  mqStatus?: FooterStatus;
  schedulerStatus?: FooterStatus;
  lastHeartbeatTime?: string;
  supportText?: string;
  onOpenHealth?: () => void;
};

function statusLabel(value: FooterStatus): string {
  return value === "error" ? "异常" : "正常";
}

function statusClass(value: FooterStatus): string {
  return value === "error" ? "global-footer-status-error" : "global-footer-status-normal";
}

function environmentColor(environment: string): "blue" | "success" | "default" {
  if (environment.includes("生产")) {
    return "success";
  }
  if (environment.includes("开发") || environment.includes("测试") || environment.includes("本机")) {
    return "blue";
  }
  return "default";
}

function StatusItem({ item, onClick }: { item: FooterStatusItem; onClick?: () => void }) {
  const content = (
    <button type="button" className="global-footer-status-item" onClick={onClick}>
      <span className={statusClass(item.value)} />
      <span>{item.label}</span>
      <strong>{statusLabel(item.value)}</strong>
    </button>
  );

  return (
    <Tooltip title={item.detail || `${item.label}${statusLabel(item.value)}`}>
      {content}
    </Tooltip>
  );
}

export function GlobalFooterBar({
  appName = APP_NAME_ZH,
  hospitalName = "五莲县人民医院",
  environment = "开发环境",
  version = APP_VERSION_LABEL,
  currentUser = "平台管理员",
  serviceStatus = "mock",
  databaseStatus = "mock",
  redisStatus = "mock",
  mqStatus = "mock",
  schedulerStatus = "mock",
  lastHeartbeatTime,
  supportText = "信息运营中心",
  onOpenHealth
}: GlobalFooterBarProps) {
  const [versionOpen, setVersionOpen] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);
  const statuses: FooterStatusItem[] = [
    {
      label: "API",
      value: serviceStatus,
      detail: serviceStatus === "mock" ? "来自 /health 接口的可达性状态；后续补充详细探针。" : "来自 /health 接口。"
    },
    {
      label: "数据库",
      value: databaseStatus,
      detail: "TODO: 后续接入 /health/ready 的数据库探针。"
    },
    {
      label: "Redis",
      value: redisStatus,
      detail: "TODO: 后续接入 /health/ready 的 Redis 探针。"
    },
    {
      label: "RabbitMQ",
      value: mqStatus,
      detail: "TODO: 后续接入 /health/ready 的队列探针。"
    },
    {
      label: "任务调度",
      value: schedulerStatus,
      detail: "TODO: 后续接入任务调度健康检查。"
    }
  ];

  return (
    <footer className="global-footer-bar">
      <div className="global-footer-left">
        <span>{hospitalName}</span>
        <span>{appName}</span>
        <span className="global-footer-copyright">© 2026</span>
      </div>

      <div className="global-footer-center">
        <Tag color={environmentColor(environment)} className="global-footer-env">{environment}</Tag>
        <div className="global-footer-status-list">
          {statuses.map((item) => (
            <StatusItem key={item.label} item={item} onClick={onOpenHealth} />
          ))}
        </div>
      </div>

      <div className="global-footer-right">
        <Tooltip title="点击查看版本更新记录">
          <Button type="text" size="small" className="global-footer-link" onClick={() => setVersionOpen(true)}>
            {version}
          </Button>
        </Tooltip>
        <span>当前用户：{currentUser}</span>
        <span>心跳 {lastHeartbeatTime || "--:--:--"}</span>
        <Tooltip title="点击查看技术支持信息">
          <Button type="text" size="small" className="global-footer-link global-footer-support" onClick={() => setSupportOpen(true)}>
            技术支持：{supportText}
          </Button>
        </Tooltip>
      </div>

      <Modal title="版本更新记录" open={versionOpen} onCancel={() => setVersionOpen(false)} footer={null}>
        <Space direction="vertical" size={8}>
          <Tag color="blue">{version}</Tag>
          <span>TODO: 后续接入系统版本发布记录或变更日志页面。</span>
        </Space>
      </Modal>

      <Modal title="技术支持" open={supportOpen} onCancel={() => setSupportOpen(false)} footer={null}>
        <Space direction="vertical" size={8}>
          <strong>{supportText}</strong>
          <span>TODO: 后续接入系统说明、帮助文档或联系方式。</span>
        </Space>
      </Modal>
    </footer>
  );
}
