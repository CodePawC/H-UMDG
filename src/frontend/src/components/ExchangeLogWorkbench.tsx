import React from "react";
import { Activity, Clipboard, FileSearch, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import type { HudmpApiClient } from "../lib/api";
import { copyAndSaveEvidence } from "../lib/evidence";
import type { ApiResult, ExchangeLog, ExchangeLogDetail, ExchangePayloadSummary, Language, PagedResult } from "../types";

type ExchangeLogWorkbenchProps = {
  client: HudmpApiClient;
  language: Language;
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
};

const statusOptions = [
  { label: "All", value: "" },
  { label: "SUCCESS", value: "SUCCESS" },
  { label: "FAILED", value: "FAILED" },
  { label: "IDEMPOTENT_REPLAY", value: "IDEMPOTENT_REPLAY" },
  { label: "IDEMPOTENCY_CONFLICT", value: "IDEMPOTENCY_CONFLICT" }
];

const categoryOptions = [
  { label: "All", value: "" },
  { label: "department", value: "department" },
  { label: "material", value: "material" },
  { label: "mapping", value: "mapping" },
  { label: "import", value: "import" }
];

const copy = {
  en: {
    eyebrow: "Exchange Evidence",
    title: "Trace and idempotency logs",
    sourceSystem: "Source system",
    status: "Status",
    dataCategory: "Data category",
    startTime: "Start time",
    endTime: "End time",
    search: "Search",
    copyEvidence: "Copy Evidence",
    total: "Total",
    returned: "Returned",
    noQuery: "No exchange log query yet.",
    noRows: "No exchange logs matched.",
    logId: "Log ID",
    traceId: "Trace ID",
    sourceTxId: "Source TX ID",
    category: "Category",
    error: "Error",
    duration: "Duration",
    created: "Created",
    action: "Action",
    open: "Open",
    detail: "Detail",
    payloadPolicy: "Payload policy",
    requestSummary: "Request summary",
    responseSummary: "Response summary",
    allowlistedFields: "Allowlisted fields",
    redactedKeys: "Redacted keys",
    topLevelKeys: "Top-level keys",
    rawIncluded: "Raw included",
    noDetail: "Open a log row to inspect redacted detail.",
    evidenceCopied: "Evidence copied",
    evidenceNote:
      "Evidence payloads include trace ids, status, source system, source transaction id, timing, and error code only. Request and response payloads are intentionally excluded.",
    placeholderStart: "2026-05-08T00:00:00+08:00",
    placeholderEnd: "2026-05-08T23:59:59+08:00"
  },
  zh: {
    eyebrow: "交换证据",
    title: "轨迹与幂等日志",
    sourceSystem: "来源系统",
    status: "状态",
    dataCategory: "数据类别",
    startTime: "开始时间",
    endTime: "结束时间",
    search: "查询",
    copyEvidence: "复制证据",
    total: "总数",
    returned: "返回",
    noQuery: "尚未查询交换日志。",
    noRows: "没有匹配的交换日志。",
    logId: "日志 ID",
    traceId: "Trace ID",
    sourceTxId: "来源事务 ID",
    category: "类别",
    error: "错误",
    duration: "耗时",
    created: "创建时间",
    action: "操作",
    open: "打开",
    detail: "详情",
    payloadPolicy: "Payload 策略",
    requestSummary: "请求摘要",
    responseSummary: "响应摘要",
    allowlistedFields: "允许字段",
    redactedKeys: "已脱敏键",
    topLevelKeys: "顶层字段",
    rawIncluded: "包含原文",
    noDetail: "打开一条日志查看脱敏详情。",
    evidenceCopied: "证据已复制",
    evidenceNote: "证据只包含 trace、状态、来源系统、来源事务 ID、耗时和错误码；刻意排除请求和响应原文。",
    placeholderStart: "2026-05-08T00:00:00+08:00",
    placeholderEnd: "2026-05-08T23:59:59+08:00"
  }
};

function c(language: Language, key: keyof typeof copy.en): string {
  return copy[language][key];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function statusTone(status: string): "ok" | "warn" | "error" | "neutral" {
  if (status === "SUCCESS" || status === "IDEMPOTENT_REPLAY") {
    return "ok";
  }
  if (status === "FAILED" || status === "IDEMPOTENCY_CONFLICT") {
    return "error";
  }
  return "neutral";
}

function MiniPill({ tone, label }: { tone: "ok" | "warn" | "error" | "neutral"; label: string }) {
  return <span className={`task-status task-status-${tone}`}>{label}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function sanitizeLog(log: ExchangeLog) {
  return {
    log_id: log.log_id,
    trace_id: log.trace_id,
    source_system: log.source_system,
    source_tx_id: log.source_tx_id,
    data_category: log.data_category,
    status: log.status,
    error_code: log.error_code ?? null,
    processing_time_ms: log.processing_time_ms ?? null,
    created_at: log.created_at ?? null
  };
}

function buildEvidence(
  language: Language,
  result: ApiResult<PagedResult<ExchangeLog>>,
  filters: Record<string, string>
): string {
  return JSON.stringify(
    {
      evidence_type: "H_UMDG_ADMIN_UI_ALPHA_EXCHANGE_LOG",
      generated_at: new Date().toISOString(),
      title: c(language, "title"),
      http_status: result.httpStatus,
      api_code: result.code,
      message: result.message,
      trace_id: result.traceId,
      ok: result.ok,
      request_payload_included: false,
      response_payload_included: false,
      secrets_included: false,
      filters,
      page: result.data?.page,
      items: (result.data?.items ?? []).slice(0, 20).map(sanitizeLog)
    },
    null,
    2
  );
}

function buildDetailEvidence(language: Language, result: ApiResult<ExchangeLogDetail>): string {
  const detail = result.data;
  return JSON.stringify(
    {
      evidence_type: "H_UMDG_ADMIN_UI_ALPHA_EXCHANGE_LOG_DETAIL",
      generated_at: new Date().toISOString(),
      title: c(language, "detail"),
      http_status: result.httpStatus,
      api_code: result.code,
      message: result.message,
      trace_id: result.traceId,
      ok: result.ok,
      raw_request_payload_included: false,
      raw_response_payload_included: false,
      detail
    },
    null,
    2
  );
}

function SummaryPanel({
  title,
  summary,
  language
}: {
  title: string;
  summary: ExchangePayloadSummary;
  language: Language;
}) {
  return (
    <div className="payload-summary-card">
      <strong>{title}</strong>
      <dl>
        <div>
          <dt>{c(language, "topLevelKeys")}</dt>
          <dd>{summary.top_level_keys.length ? summary.top_level_keys.join(", ") : "-"}</dd>
        </div>
        <div>
          <dt>{c(language, "allowlistedFields")}</dt>
          <dd>
            <pre>{JSON.stringify(summary.allowlisted_fields ?? {}, null, 2)}</pre>
          </dd>
        </div>
        <div>
          <dt>{c(language, "redactedKeys")}</dt>
          <dd>{summary.sensitive_keys_redacted.length ? summary.sensitive_keys_redacted.join(", ") : "-"}</dd>
        </div>
        <div>
          <dt>{c(language, "rawIncluded")}</dt>
          <dd>{summary.raw_payload_included ? "true" : "false"}</dd>
        </div>
      </dl>
    </div>
  );
}

function ExchangeLogTable({
  result,
  language,
  selectedLogId,
  onOpen
}: {
  result: ApiResult<PagedResult<ExchangeLog>> | null;
  language: Language;
  selectedLogId: number | null;
  onOpen: (logId: number) => void;
}) {
  const rows = result?.data?.items ?? [];
  if (!result) {
    return <EmptyState label={c(language, "noQuery")} />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  if (!rows.length) {
    return <EmptyState label={c(language, "noRows")} />;
  }

  return (
    <div className="data-table exchange-log-table" role="table" aria-label="Exchange logs">
      <div role="row">
        <span role="columnheader">{c(language, "logId")}</span>
        <span role="columnheader">{c(language, "status")}</span>
        <span role="columnheader">{c(language, "traceId")}</span>
        <span role="columnheader">{c(language, "sourceSystem")}</span>
        <span role="columnheader">{c(language, "sourceTxId")}</span>
        <span role="columnheader">{c(language, "category")}</span>
        <span role="columnheader">{c(language, "duration")}</span>
        <span role="columnheader">{c(language, "error")}</span>
        <span role="columnheader">{c(language, "created")}</span>
        <span role="columnheader">{c(language, "action")}</span>
      </div>
      {rows.map((row) => (
        <div role="row" key={row.log_id} className={row.log_id === selectedLogId ? "selected-row" : ""}>
          <span>{row.log_id}</span>
          <span>
            <MiniPill tone={statusTone(row.status)} label={row.status} />
          </span>
          <span>{display(row.trace_id)}</span>
          <span>{display(row.source_system)}</span>
          <span>{display(row.source_tx_id)}</span>
          <span>{display(row.data_category)}</span>
          <span>{display(row.processing_time_ms)}</span>
          <span>{display(row.error_code)}</span>
          <span>{formatDate(row.created_at)}</span>
          <span>
            <button className="table-action" type="button" onClick={() => onOpen(row.log_id)}>
              {c(language, "open")}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({
  result,
  language,
  onCopyEvidence
}: {
  result: ApiResult<ExchangeLogDetail> | null;
  language: Language;
  onCopyEvidence: () => void;
}) {
  const detail = result?.data;
  if (!result) {
    return <EmptyState label={c(language, "noDetail")} />;
  }
  if (!result.ok || !detail) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  return (
    <div className="result-stack">
      <div className="section-toolbar">
        <div className="transcode-heading">
          <MiniPill tone={statusTone(detail.status)} label={detail.status} />
          <span>{detail.trace_id}</span>
        </div>
        <button className="tool-button" type="button" onClick={onCopyEvidence}>
          <Clipboard size={17} />
          {c(language, "copyEvidence")}
        </button>
      </div>
      <dl className="task-detail-grid">
        <div>
          <dt>{c(language, "payloadPolicy")}</dt>
          <dd>{detail.payload_policy.allowed_field_strategy}</dd>
        </div>
        <div>
          <dt>{c(language, "rawIncluded")}</dt>
          <dd>
            request={String(detail.payload_policy.raw_request_payload_included)} / response=
            {String(detail.payload_policy.raw_response_payload_included)}
          </dd>
        </div>
        <div>
          <dt>{c(language, "sourceTxId")}</dt>
          <dd>{detail.source_tx_id}</dd>
        </div>
        <div>
          <dt>{c(language, "duration")}</dt>
          <dd>{display(detail.processing_time_ms)}</dd>
        </div>
      </dl>
      <div className="payload-summary-grid">
        <SummaryPanel title={c(language, "requestSummary")} summary={detail.request_payload_summary} language={language} />
        <SummaryPanel title={c(language, "responseSummary")} summary={detail.response_payload_summary} language={language} />
      </div>
    </div>
  );
}

export function ExchangeLogWorkbench({ client, language, onApiActivity }: ExchangeLogWorkbenchProps) {
  const [sourceSystem, setSourceSystem] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [dataCategory, setDataCategory] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [querying, setQuerying] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ApiResult<PagedResult<ExchangeLog>> | null>(null);
  const [selectedLogId, setSelectedLogId] = React.useState<number | null>(null);
  const [detailResult, setDetailResult] = React.useState<ApiResult<ExchangeLogDetail> | null>(null);

  const loadLogs = React.useCallback(async () => {
    setQuerying(true);
    const next = await client.listExchangeLogs({
      sourceSystem,
      status,
      dataCategory,
      startTime,
      endTime,
      page: 1,
      pageSize: 20
    });
    setResult(next);
    onApiActivity("GET /api/v1/exchange/logs", next);
    setQuerying(false);
  }, [client, dataCategory, endTime, onApiActivity, sourceSystem, startTime, status]);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const copyEvidence = async () => {
    if (!result) {
      return;
    }
    const evidence = buildEvidence(language, result, {
        source_system: sourceSystem,
        status,
        data_category: dataCategory,
        start_time: startTime,
        end_time: endTime
    });
    const message = await copyAndSaveEvidence(evidence, c(language, "title"));
    setCopyStatus(message);
  };

  const openDetail = async (logId: number) => {
    setLoadingDetail(true);
    setSelectedLogId(logId);
    const next = await client.getExchangeLog(logId);
    setDetailResult(next);
    onApiActivity("GET /api/v1/exchange/logs/{log_id}", next);
    setLoadingDetail(false);
  };

  const copyDetailEvidence = async () => {
    if (!detailResult) {
      return;
    }
    const message = await copyAndSaveEvidence(buildDetailEvidence(language, detailResult), c(language, "detail"));
    setCopyStatus(message);
  };

  return (
    <section className="panel exchange-log-panel" aria-labelledby="exchange-log-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{c(language, "eyebrow")}</p>
          <h2 id="exchange-log-heading">{c(language, "title")}</h2>
        </div>
        <Activity size={20} />
      </div>

      {copyStatus ? <div className="notice-line notice-line-ok">{copyStatus}</div> : null}

      <form
        className="dictionary-form exchange-log-form"
        onSubmit={(event) => {
          event.preventDefault();
          void loadLogs();
        }}
      >
        <label className="field">
          <span>{c(language, "sourceSystem")}</span>
          <input value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)} />
        </label>
        <label className="field">
          <span>{c(language, "status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option value={option.value} key={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{c(language, "dataCategory")}</span>
          <select value={dataCategory} onChange={(event) => setDataCategory(event.target.value)}>
            {categoryOptions.map((option) => (
              <option value={option.value} key={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{c(language, "startTime")}</span>
          <input value={startTime} placeholder={c(language, "placeholderStart")} onChange={(event) => setStartTime(event.target.value)} />
        </label>
        <label className="field">
          <span>{c(language, "endTime")}</span>
          <input value={endTime} placeholder={c(language, "placeholderEnd")} onChange={(event) => setEndTime(event.target.value)} />
        </label>
        <button className="action-button" type="submit" disabled={querying}>
          {querying ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
          {c(language, "search")}
        </button>
        <button className="tool-button" type="button" disabled={!result} onClick={copyEvidence}>
          <Clipboard size={17} />
          {c(language, "copyEvidence")}
        </button>
      </form>

      <div className="section-toolbar">
        <span>
          {c(language, "total")}: {result?.data?.page.total ?? 0} / {c(language, "returned")}:{" "}
          {result?.data?.items.length ?? 0}
        </span>
      </div>

      <ExchangeLogTable result={result} language={language} selectedLogId={selectedLogId} onOpen={openDetail} />

      <section className="exchange-detail-section" aria-label={c(language, "detail")}>
        <div className="section-toolbar">
          <div className="transcode-heading">
            <FileSearch size={17} />
            <strong>{c(language, "detail")}</strong>
          </div>
          {loadingDetail ? <LoaderCircle size={17} className="spin" /> : null}
        </div>
        <DetailPanel result={detailResult} language={language} onCopyEvidence={copyDetailEvidence} />
      </section>

      <div className="config-note">
        <ShieldCheck size={17} />
        <span>{c(language, "evidenceNote")}</span>
      </div>
    </section>
  );
}
