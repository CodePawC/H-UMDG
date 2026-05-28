import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Eye,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  Search,
  UploadCloud
} from "lucide-react";
import type { HudmpApiClient } from "../lib/api";
import { copyAndSaveEvidence } from "../lib/evidence";
import { materialImportGuides } from "../lib/importGuides";
import { ImportGuidePanel } from "./ImportGuidePanel";
import type {
  ApiResult,
  ImportArchiveInspection,
  ImportArchiveItem,
  ImportArchiveSubmitResult,
  ImportFileInspection,
  ImportSourceArtifact,
  ImportTask,
  ImportTaskFailure,
  MaterialRow,
  PagedResult
} from "../types";

type ImportTaskMonitorProps = {
  client: HudmpApiClient;
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
};

const sourceTypeOptions = [
  { label: "MVP Template", value: "MVP_TEMPLATE" },
  { label: "NHSA Full Spec", value: "NHSA_FULL_SPEC" },
  { label: "NHSA Disabled", value: "NHSA_DISABLED" },
  { label: "NHSA Transcode", value: "NHSA_TRANSCODE" },
  { label: "Device Catalog", value: "DEVICE_CLASSIFICATION_CATALOG" }
];

const filterSourceTypeOptions = [{ label: "All", value: "" }, ...sourceTypeOptions];

const statusOptions = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Running", value: "RUNNING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Completed With Errors", value: "COMPLETED_WITH_ERRORS" },
  { label: "Failed", value: "FAILED" }
];

const terminalStatuses = new Set(["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"]);
const previewableSourceTypes = new Set(["MVP_TEMPLATE", "NHSA_FULL_SPEC"]);

const sourceTypeLabels: Record<string, string> = {
  MVP_TEMPLATE: "模板样例",
  NHSA_FULL_SPEC: "医保耗材全量规格型号",
  NHSA_DISABLED: "停用表",
  NHSA_TRANSCODE: "转码表",
  DEVICE_CLASSIFICATION_CATALOG: "器械分类目录"
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function displaySourceType(value: unknown): string {
  const raw = display(value);
  return sourceTypeLabels[raw] ? `${sourceTypeLabels[raw]} (${raw})` : raw;
}

function displaySize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) {
    return "-";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function displayExtension(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return value.startsWith(".") ? value : `.${value}`;
}

function archiveTypeSummary(inspection: ImportArchiveInspection): string {
  const counts = inspection.source_type_counts ?? {};
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "未识别到可导入类型";
  }
  return entries
    .map(([sourceType, count]) => `${sourceTypeLabels[sourceType] ?? sourceType} ${count}`)
    .join(" / ");
}

function artifactForTask(task: ImportTask): ImportSourceArtifact {
  return task.source_artifact ?? {};
}

function artifactValue<T>(
  artifact: ImportSourceArtifact,
  taskValue: T | null | undefined,
  key: keyof ImportSourceArtifact
): T | null | undefined {
  const value = artifact[key] as T | null | undefined;
  return value ?? taskValue;
}

function clampProgress(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function isTerminalTask(task: ImportTask | null | undefined): boolean {
  return Boolean(task?.status && terminalStatuses.has(task.status));
}

function canPreviewTask(task: ImportTask | null | undefined): boolean {
  return Boolean(task && task.status !== "FAILED" && previewableSourceTypes.has(task.source_type));
}

function statusTone(status: string): "ok" | "warn" | "error" | "neutral" {
  if (status === "COMPLETED") {
    return "ok";
  }
  if (status === "FAILED") {
    return "error";
  }
  if (status === "COMPLETED_WITH_ERRORS") {
    return "warn";
  }
  return "neutral";
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

function sanitizeTask(task: ImportTask | null | undefined) {
  if (!task) {
    return null;
  }
  return {
    batch_id: task.batch_id,
    source_type: task.source_type,
    source_system: task.source_system,
    source_file_name: task.source_file_name,
    source_file_extension: task.source_file_extension ?? null,
    source_file_size_bytes: task.source_file_size_bytes ?? null,
    archive_id: task.archive_id ?? null,
    archive_file_name: task.archive_file_name ?? null,
    archive_file_extension: task.archive_file_extension ?? null,
    archive_file_size_bytes: task.archive_file_size_bytes ?? null,
    archive_format: task.archive_format ?? null,
    archive_entry_path: task.archive_entry_path ?? null,
    archive_entry_size_bytes: task.archive_entry_size_bytes ?? null,
    archive_total_entries: task.archive_total_entries ?? null,
    archive_importable_count: task.archive_importable_count ?? null,
    sheet_name: task.sheet_name,
    status: task.status,
    progress_percent: task.progress_percent,
    source_row_count: task.source_row_count,
    unique_key_count: task.unique_key_count,
    success_count: task.success_count,
    failed_count: task.failed_count,
    skipped_duplicate_count: task.skipped_duplicate_count,
    duplicate_count: task.duplicate_count,
    error_code: task.error_code,
    error_message: task.error_message,
    created_at: task.created_at,
    started_at: task.started_at,
    finished_at: task.finished_at
  };
}

function sanitizeFailure(failure: ImportTaskFailure) {
  return {
    failure_id: failure.failure_id,
    batch_id: failure.batch_id,
    row_number: failure.row_number ?? null,
    field_name: failure.field_name ?? null,
    message: failure.message,
    raw_payload_included: failure.raw_payload_included ?? false,
    created_at: failure.created_at ?? null
  };
}

function buildEvidence(title: string, result: ApiResult<unknown>, payload: Record<string, unknown>): string {
  return JSON.stringify(
    {
      evidence_type: "H_UMDG_ADMIN_UI_ALPHA_IMPORT_TASK",
      generated_at: new Date().toISOString(),
      title,
      http_status: result.httpStatus,
      api_code: result.code,
      message: result.message,
      trace_id: result.traceId,
      ok: result.ok,
      execution_model: "fastapi_background_tasks_server_spool_mvp",
      raw_files_included: false,
      raw_payload_included: false,
      secrets_included: false,
      ...payload
    },
    null,
    2
  );
}

function MiniPill({ tone, label }: { tone: "ok" | "warn" | "error" | "neutral"; label: string }) {
  return <span className={`task-status task-status-${tone}`}>{label}</span>;
}

function TextControl({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FileControl({
  label = "File",
  accept,
  onChange
}: {
  label?: string;
  accept: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.currentTarget.files?.item(0) ?? null)}
      />
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = clampProgress(value);
  return (
    <div className="progress-stack">
      <div className="progress-track" aria-label={`Progress ${safeValue}%`}>
        <span style={{ width: `${safeValue}%` }} />
      </div>
      <strong>{safeValue}%</strong>
    </div>
  );
}

function CounterGrid({ task }: { task: ImportTask }) {
  return (
    <div className="counter-grid">
      <div>
        <span>Rows</span>
        <strong>{task.source_row_count}</strong>
      </div>
      <div>
        <span>Unique</span>
        <strong>{task.unique_key_count}</strong>
      </div>
      <div>
        <span>Success</span>
        <strong>{task.success_count}</strong>
      </div>
      <div>
        <span>Failed</span>
        <strong>{task.failed_count}</strong>
      </div>
      <div>
        <span>Skipped</span>
        <strong>{task.skipped_duplicate_count}</strong>
      </div>
      <div>
        <span>Duplicate</span>
        <strong>{task.duplicate_count}</strong>
      </div>
    </div>
  );
}

function archiveNotice(inspection: ImportArchiveInspection): string {
  const unsupportedPart =
    inspection.unsupported_count > 0 ? `另有 ${inspection.unsupported_count} 个文件暂不支持，系统不会提交它们。` : "";
  if (inspection.importable_count === 0) {
    return `预检完成：压缩包内暂未识别到可导入文件。请确认里面包含医保全量规格型号、停用表、转码表或模板样例文件。${unsupportedPart}`;
  }
  return `预检完成：压缩包内识别到 ${inspection.importable_count} 个可导入文件，已默认勾选。请在下方核对文件类型和工作表，取消不需要导入的文件后点击“提交压缩包”。${unsupportedPart}`;
}

function MaterialPreviewTable({ result }: { result: ApiResult<PagedResult<MaterialRow>> | null }) {
  const rows = result?.data?.items ?? [];

  if (!result) {
    return <EmptyState label="Open a completed material task, then preview imported rows." />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  if (rows.length === 0) {
    return <EmptyState label="No imported material rows matched this batch." />;
  }

  return (
    <div className="data-table data-table-wide" role="table" aria-label="Imported material rows">
      <div role="row">
        <span role="columnheader">27-bit code</span>
        <span role="columnheader">20-bit code</span>
        <span role="columnheader">Generic name</span>
        <span role="columnheader">Category</span>
        <span role="columnheader">Registration</span>
        <span role="columnheader">Status</span>
      </div>
      {rows.map((row) => (
        <div role="row" key={row.material_id}>
          <span>{display(row.yb_code_27)}</span>
          <span>{display(row.yb_code_20)}</span>
          <span>{display(row.generic_name)}</span>
          <span>{display(row.cat_level_3 ?? row.cat_level_2 ?? row.cat_level_1)}</span>
          <span>{display(row.reg_number)}</span>
          <span>{display(row.status)}</span>
        </div>
      ))}
    </div>
  );
}

function SheetInspector({
  result,
  value,
  onChange
}: {
  result: ApiResult<ImportFileInspection> | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const inspection = result?.data;
  if (!result) {
    return <div className="import-file-inspector">Choose a file first. CSV imports do not need a worksheet; Excel files will be checked automatically.</div>;
  }
  if (!result.ok || !inspection) {
    return <div className="import-file-inspector import-file-inspector-warn">{result.error ?? result.message}</div>;
  }
  if (inspection.sheets.length === 0) {
    return (
      <div className="import-file-inspector">
        <strong>{inspection.file_type}</strong>
        <span>{inspection.row_count ?? 0} data rows detected. No worksheet selection is needed.</span>
      </div>
    );
  }

  const options = inspection.sheets.map((sheet) => ({
    value: sheet.name,
    label: `${sheet.name} (${sheet.row_count ?? 0} rows, ${sheet.column_count ?? 0} columns)`
  }));
  const selectedSheet = inspection.sheets.find((sheet) => sheet.name === value) ?? inspection.sheets[0];

  return (
    <div className="import-file-inspector">
      {inspection.sheets.length > 1 ? (
        <SelectControl label="Excel worksheet" value={value} onChange={onChange} options={options} />
      ) : (
        <div className="inspector-summary">
          <strong>{selectedSheet.name}</strong>
          <span>Only one worksheet was found, so it will be imported automatically.</span>
        </div>
      )}
      <div className="inspector-summary">
        <span>
          {inspection.sheets.length} sheet{inspection.sheets.length > 1 ? "s" : ""} detected. Selected sheet has{" "}
          {selectedSheet.row_count ?? 0} data rows.
        </span>
        {selectedSheet.headers?.length ? <small>Columns: {selectedSheet.headers.slice(0, 8).join(", ")}</small> : null}
      </div>
      {inspection.sheets.length > 1 ? (
        <div className="notice-line">
          <AlertTriangle size={16} />
          <span>Select the worksheet to import before pressing Submit.</span>
        </div>
      ) : null}
    </div>
  );
}

function ArchiveInspector({
  result,
  selections,
  onToggle,
  onSheetChange
}: {
  result: ApiResult<ImportArchiveInspection> | null;
  selections: Record<string, boolean>;
  onToggle: (entryPath: string, checked: boolean) => void;
  onSheetChange: (entryPath: string, sheetName: string) => void;
}) {
  const inspection = result?.data;
  if (!result) {
    return <div className="import-file-inspector">请选择压缩包，系统会先识别里面有哪些表格可以导入。</div>;
  }
  if (!result.ok || !inspection) {
    return <div className="import-file-inspector import-file-inspector-warn">{result.error ?? result.message}</div>;
  }
  if (inspection.items.length === 0) {
    return <EmptyState label="这个压缩包里没有检测到文件。" />;
  }

  const selectedCount = inspection.items.filter((item) => item.supported && selections[item.entry_path]).length;

  return (
    <div className="archive-inspector">
      <div className="source-evidence-card">
        <div>
          <span>原始压缩包</span>
          <strong>{inspection.archive_file_name}</strong>
          <small>
            {display(inspection.archive_format)} / {displayExtension(inspection.archive_file_extension)} /{" "}
            {displaySize(inspection.archive_file_size_bytes)}
          </small>
        </div>
        <div>
          <span>解析结果</span>
          <strong>
            {inspection.importable_count} / {inspection.total_entries} 可导入
          </strong>
          <small>
            解压后约 {displaySize(inspection.total_uncompressed_size_bytes)}，可导入文件约{" "}
            {displaySize(inspection.importable_size_bytes)}
          </small>
        </div>
        <div>
          <span>识别类型</span>
          <strong>{archiveTypeSummary(inspection)}</strong>
          <small>{inspection.unsupported_count} 个文件暂不导入</small>
        </div>
      </div>
      <div className="section-toolbar">
        <span>
          已勾选：{selectedCount} / 可导入：{inspection.importable_count} / 总文件：{inspection.total_entries}
        </span>
      </div>
      <div className="notice-line notice-line-ok">
        <CheckCircle2 size={16} />
        <span>系统已按文件名和表头识别全量规格型号、停用表、转码表等类型；提交前请核对工作表是否正确。</span>
      </div>
      <div className="data-table archive-file-table" role="table" aria-label="Archive files">
        <div role="row">
          <span role="columnheader">导入</span>
          <span role="columnheader">文件</span>
          <span role="columnheader">数据类型</span>
          <span role="columnheader">行数</span>
          <span role="columnheader">工作表</span>
          <span role="columnheader">状态</span>
        </div>
        {inspection.items.map((item) => {
          const sheets = item.inspection?.sheets ?? [];
          return (
            <div role="row" key={item.entry_path}>
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(selections[item.entry_path])}
                  disabled={!item.supported}
                  onChange={(event) => onToggle(item.entry_path, event.currentTarget.checked)}
                />
              </span>
              <span>
                <strong>{item.file_name}</strong>
                <small>
                  {displayExtension(item.extension)} / {displaySize(item.size)}
                </small>
                <small>{item.entry_path}</small>
              </span>
              <span>{displaySourceType(item.source_type)}</span>
              <span>{display(item.row_count ?? item.inspection?.row_count)}</span>
              <span>
                {sheets.length > 1 ? (
                  <select
                    value={item.sheet_name ?? item.inspection?.default_sheet_name ?? ""}
                    disabled={!item.supported}
                    onChange={(event) => onSheetChange(item.entry_path, event.currentTarget.value)}
                  >
                    {sheets.map((sheet) => (
                      <option value={sheet.name} key={sheet.name}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  display(item.sheet_name ?? item.inspection?.default_sheet_name)
                )}
              </span>
              <span>{item.supported ? "可导入" : item.reason}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskFileCell({ task }: { task: ImportTask }) {
  const artifact = artifactForTask(task);
  const archiveFileName = artifactValue<string>(artifact, task.archive_file_name, "archive_file_name");
  const archiveSize = artifactValue<number>(artifact, task.archive_file_size_bytes, "archive_file_size_bytes");
  const archiveExtension = artifactValue<string>(artifact, task.archive_file_extension, "archive_file_extension");
  const archiveFormat = artifactValue<string>(artifact, task.archive_format, "archive_format");
  const sourceSize = artifactValue<number>(artifact, task.source_file_size_bytes, "source_file_size_bytes");
  const sourceExtension = artifactValue<string>(artifact, task.source_file_extension, "source_file_extension");
  const entryPath = artifactValue<string>(artifact, task.archive_entry_path, "archive_entry_path");

  if (archiveFileName) {
    return (
      <span>
        <strong>{archiveFileName}</strong>
        <small>
          原包 {display(archiveFormat)} / {displayExtension(archiveExtension)} / {displaySize(archiveSize)}
        </small>
        <small>
          包内 {task.source_file_name} / {displayExtension(sourceExtension)} / {displaySize(sourceSize)}
        </small>
        {entryPath ? <small>{entryPath}</small> : null}
      </span>
    );
  }

  return (
    <span>
      <strong>{task.source_file_name}</strong>
      <small>
        {displayExtension(sourceExtension)} / {displaySize(sourceSize)}
      </small>
    </span>
  );
}

function TaskParseCell({ task }: { task: ImportTask }) {
  const artifact = artifactForTask(task);
  const rowCount = artifactValue<number>(artifact, task.detected_row_count, "detected_row_count");
  const sheetCount = artifactValue<number>(artifact, task.detected_sheet_count, "detected_sheet_count");
  const headers = task.detected_headers?.length ? task.detected_headers : artifact.detected_headers ?? [];

  return (
    <span>
      <strong>{displaySourceType(task.source_type)}</strong>
      <small>工作表：{display(task.sheet_name ?? artifact.detected_sheet_name)}</small>
      <small>
        预检：{rowCount ?? task.source_row_count} 行{sheetCount ? ` / ${sheetCount} 个工作表` : ""}
      </small>
      {headers.length ? <small>字段：{headers.slice(0, 5).join("、")}</small> : null}
    </span>
  );
}

function SourceEvidencePanel({ task }: { task: ImportTask }) {
  const artifact = artifactForTask(task);
  const archiveFileName = artifactValue<string>(artifact, task.archive_file_name, "archive_file_name");
  const archiveSize = artifactValue<number>(artifact, task.archive_file_size_bytes, "archive_file_size_bytes");
  const archiveExtension = artifactValue<string>(artifact, task.archive_file_extension, "archive_file_extension");
  const archiveFormat = artifactValue<string>(artifact, task.archive_format, "archive_format");
  const entryPath = artifactValue<string>(artifact, task.archive_entry_path, "archive_entry_path");
  const entrySize = artifactValue<number>(artifact, task.archive_entry_size_bytes, "archive_entry_size_bytes");
  const sourceSize = artifactValue<number>(artifact, task.source_file_size_bytes, "source_file_size_bytes");
  const sourceExtension = artifactValue<string>(artifact, task.source_file_extension, "source_file_extension");
  const rowCount = artifactValue<number>(artifact, task.detected_row_count, "detected_row_count");
  const sheetCount = artifactValue<number>(artifact, task.detected_sheet_count, "detected_sheet_count");
  const headers = task.detected_headers?.length ? task.detected_headers : artifact.detected_headers ?? [];

  return (
    <div className="source-evidence-card">
      <div>
        <span>{archiveFileName ? "原始压缩包" : "原始文件"}</span>
        <strong>{archiveFileName ?? task.source_file_name}</strong>
        <small>
          {archiveFileName
            ? `${display(archiveFormat)} / ${displayExtension(archiveExtension)} / ${displaySize(archiveSize)}`
            : `${displayExtension(sourceExtension)} / ${displaySize(sourceSize)}`}
        </small>
      </div>
      {archiveFileName ? (
        <div>
          <span>包内文件</span>
          <strong>{task.source_file_name}</strong>
          <small>
            {displayExtension(sourceExtension)} / {displaySize(entrySize ?? sourceSize)}
          </small>
          {entryPath ? <small>{entryPath}</small> : null}
        </div>
      ) : null}
      <div>
        <span>系统识别</span>
        <strong>{displaySourceType(task.source_type)}</strong>
        <small>
          工作表：{display(task.sheet_name ?? artifact.detected_sheet_name)} / 预检行数：
          {display(rowCount ?? task.source_row_count)}
        </small>
        {sheetCount ? <small>工作表数量：{sheetCount}</small> : null}
      </div>
      <div>
        <span>字段预览</span>
        <strong>{headers.length ? headers.slice(0, 4).join("、") : "-"}</strong>
        {headers.length > 4 ? <small>另有 {headers.length - 4} 个字段</small> : null}
      </div>
    </div>
  );
}

function TaskTable({
  result,
  selectedBatchId,
  onSelect
}: {
  result: ApiResult<PagedResult<ImportTask>> | null;
  selectedBatchId: string;
  onSelect: (batchId: string) => void;
}) {
  const rows = result?.data?.items ?? [];

  if (!result) {
    return <EmptyState label="No import task query yet." />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  if (rows.length === 0) {
    return <EmptyState label="No import tasks matched." />;
  }

  return (
    <div className="data-table import-task-table" role="table" aria-label="Import tasks">
      <div role="row">
        <span role="columnheader">上传文件</span>
        <span role="columnheader">系统识别</span>
        <span role="columnheader">状态与进度</span>
        <span role="columnheader">导入结果</span>
        <span role="columnheader">操作</span>
      </div>
      {rows.map((task) => (
        <div role="row" key={task.batch_id} className={task.batch_id === selectedBatchId ? "selected-row" : ""}>
          <TaskFileCell task={task} />
          <TaskParseCell task={task} />
          <span>
            <MiniPill tone={statusTone(task.status)} label={task.status} />
            <ProgressBar value={task.progress_percent} />
            <small>{task.batch_id}</small>
          </span>
          <span>
            <strong>
              {task.success_count} 成功 / {task.failed_count} 失败
            </strong>
            <small>源行数：{task.source_row_count}</small>
            <small>重复：{task.duplicate_count} / 跳过：{task.skipped_duplicate_count}</small>
          </span>
          <span>
            <button className="table-action" type="button" onClick={() => onSelect(task.batch_id)}>
              Open
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function TaskDetail({
  result,
  onRefresh,
  onLoadFailures,
  onPreviewRows,
  onCopyEvidence,
  refreshing,
  previewing
}: {
  result: ApiResult<ImportTask> | null;
  onRefresh: () => void;
  onLoadFailures: () => void;
  onPreviewRows: () => void;
  onCopyEvidence: () => void;
  refreshing: boolean;
  previewing: boolean;
}) {
  const task = result?.data;

  if (!result) {
    return <EmptyState label="Open an import task to see detail." />;
  }
  if (!result.ok || !task) {
    return <EmptyState label={result.error ?? result.message} />;
  }

  return (
    <div className="result-stack">
      <div className="section-toolbar">
        <div className="transcode-heading">
          <MiniPill tone={statusTone(task.status)} label={task.status} />
          <span>{task.batch_id}</span>
        </div>
        <div className="button-row">
          <button className="tool-button" type="button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />}
            Refresh
          </button>
          <button className="tool-button" type="button" onClick={onLoadFailures}>
            <FileSearch size={17} />
            Failures
          </button>
          <button className="tool-button" type="button" onClick={onPreviewRows} disabled={!canPreviewTask(task) || previewing}>
            {previewing ? <LoaderCircle size={17} className="spin" /> : <Eye size={17} />}
            Preview Rows
          </button>
          <button className="tool-button" type="button" onClick={onCopyEvidence}>
            <Clipboard size={17} />
            Copy Evidence
          </button>
        </div>
      </div>

      <SourceEvidencePanel task={task} />
      <ProgressBar value={task.progress_percent} />
      <CounterGrid task={task} />

      <dl className="task-detail-grid">
        <div>
          <dt>Source type</dt>
          <dd>{display(task.source_type)}</dd>
        </div>
        <div>
          <dt>Source system</dt>
          <dd>{display(task.source_system)}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd>{display(task.source_file_name)}</dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{displaySize(task.source_file_size_bytes)}</dd>
        </div>
        <div>
          <dt>Sheet</dt>
          <dd>{display(task.sheet_name)}</dd>
        </div>
        <div>
          <dt>Archive</dt>
          <dd>{display(task.archive_file_name)}</dd>
        </div>
        <div>
          <dt>Archive size</dt>
          <dd>{displaySize(task.archive_file_size_bytes)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDate(task.created_at)}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{formatDate(task.started_at)}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{formatDate(task.finished_at)}</dd>
        </div>
        <div>
          <dt>Error</dt>
          <dd>{display(task.error_code ?? task.error_message)}</dd>
        </div>
      </dl>

      {!isTerminalTask(task) ? (
        <div className="notice-line">
          <RefreshCw size={16} />
          <span>BackgroundTasks runner is active for this MVP import.</span>
        </div>
      ) : null}
      {isTerminalTask(task) && !canPreviewTask(task) ? (
        <div className="notice-line">
          <AlertTriangle size={16} />
          <span>This source type does not create a direct material master-row preview; use failures, counters, or transcode lookup instead.</span>
        </div>
      ) : null}
    </div>
  );
}

function FailureTable({
  result,
  onCopyEvidence
}: {
  result: ApiResult<PagedResult<ImportTaskFailure>> | null;
  onCopyEvidence: () => void;
}) {
  const rows = result?.data?.items ?? [];

  if (!result) {
    return <EmptyState label="No failure query yet." />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  if (rows.length === 0) {
    return <EmptyState label="No failures returned." />;
  }

  return (
    <div className="result-stack">
      <div className="section-toolbar">
        <span>
          Total: {result.data?.page.total ?? 0} / Returned: {rows.length}
        </span>
        <button className="tool-button" type="button" onClick={onCopyEvidence}>
          <Clipboard size={17} />
          Copy Evidence
        </button>
      </div>
      <div className="data-table async-failure-table" role="table" aria-label="Import task failures">
        <div role="row">
          <span role="columnheader">Row</span>
          <span role="columnheader">Field</span>
          <span role="columnheader">Message</span>
          <span role="columnheader">Raw</span>
          <span role="columnheader">Created</span>
        </div>
        {rows.map((failure) => (
          <div role="row" key={failure.failure_id}>
            <span>{display(failure.row_number)}</span>
            <span>{display(failure.field_name)}</span>
            <span>{display(failure.message)}</span>
            <span>{failure.raw_payload_included ? "included" : "redacted"}</span>
            <span>{formatDate(failure.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImportTaskMonitor({ client, onApiActivity }: ImportTaskMonitorProps) {
  const [importMode, setImportMode] = React.useState<"single" | "archive">("single");
  const [sourceType, setSourceType] = React.useState("MVP_TEMPLATE");
  const [sourceSystem, setSourceSystem] = React.useState("MVP");
  const [sourceTxId, setSourceTxId] = React.useState("");
  const [sheetName, setSheetName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [inspection, setInspection] = React.useState<ApiResult<ImportFileInspection> | null>(null);
  const [archiveFile, setArchiveFile] = React.useState<File | null>(null);
  const [archiveInspection, setArchiveInspection] = React.useState<ApiResult<ImportArchiveInspection> | null>(null);
  const [archiveSelections, setArchiveSelections] = React.useState<Record<string, boolean>>({});

  const [statusFilter, setStatusFilter] = React.useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = React.useState("");
  const [selectedBatchId, setSelectedBatchId] = React.useState("");
  const [trackingBatchIds, setTrackingBatchIds] = React.useState<string[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [inspecting, setInspecting] = React.useState(false);
  const [archiveInspecting, setArchiveInspecting] = React.useState(false);
  const [archiveSubmitting, setArchiveSubmitting] = React.useState(false);
  const [listing, setListing] = React.useState(false);
  const [refreshingDetail, setRefreshingDetail] = React.useState(false);
  const [loadingFailures, setLoadingFailures] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  const [submitResult, setSubmitResult] = React.useState<ApiResult<ImportTask> | null>(null);
  const [archiveSubmitResult, setArchiveSubmitResult] = React.useState<ApiResult<ImportArchiveSubmitResult> | null>(null);
  const [listResult, setListResult] = React.useState<ApiResult<PagedResult<ImportTask>> | null>(null);
  const [detailResult, setDetailResult] = React.useState<ApiResult<ImportTask> | null>(null);
  const [failureResult, setFailureResult] = React.useState<ApiResult<PagedResult<ImportTaskFailure>> | null>(null);
  const [previewResult, setPreviewResult] = React.useState<ApiResult<PagedResult<MaterialRow>> | null>(null);

  const copyEvidence = async (title: string, result: ApiResult<unknown>, payload: Record<string, unknown>) => {
    const evidence = buildEvidence(title, result, payload);
    try {
      const message = await copyAndSaveEvidence(evidence, title);
      setCopyStatus(message);
    } catch (error) {
      setCopyStatus(error instanceof Error ? error.message : "Clipboard unavailable");
    }
  };

  const recordActivity = (label: string, result: ApiResult<unknown>) => {
    onApiActivity(label, result);
  };

  const changeSourceType = (value: string) => {
    setSourceType(value);
    setFile(null);
    setInspection(null);
    setSheetName("");
    setSubmitResult(null);
    setNotice("Source type changed. Choose the matching template or sample before submitting.");
  };

  const applyInspection = (result: ApiResult<ImportFileInspection>) => {
    const inspected = result.data;
    if (!result.ok || !inspected) {
      return;
    }
    setSheetName(inspected.default_sheet_name ?? "");
    if (inspected.sheets.length > 1) {
      setNotice("This workbook has multiple worksheets. Select the worksheet to import, then press Submit.");
    } else {
      setNotice(null);
    }
  };

  const chooseFile = async (nextFile: File | null) => {
    setFile(nextFile);
    setInspection(null);
    setSheetName("");
    setSubmitResult(null);
    if (!nextFile) {
      return;
    }
    setInspecting(true);
    const result = await client.inspectMaterialImportFile({
      file: nextFile,
      sourceType,
      sourceSystem,
      sourceTxId
    });
    setInspection(result);
    recordActivity("POST /api/v1/materials/import/inspect", result);
    applyInspection(result);
    setInspecting(false);
  };

  const chooseArchiveFile = async (nextFile: File | null) => {
    setArchiveFile(nextFile);
    setArchiveInspection(null);
    setArchiveSubmitResult(null);
    setArchiveSelections({});
    if (!nextFile) {
      return;
    }
    setArchiveInspecting(true);
    setNotice(null);
    const result = await client.inspectMaterialImportArchive(nextFile);
    setArchiveInspection(result);
    recordActivity("POST /api/v1/import-tasks/materials/archive/inspect", result);
    if (result.ok && result.data) {
      const nextSelections = Object.fromEntries(
        result.data.items.map((item) => [item.entry_path, item.supported])
      );
      setArchiveSelections(nextSelections);
      setNotice(archiveNotice(result.data));
    }
    setArchiveInspecting(false);
  };

  const toggleArchiveItem = (entryPath: string, checked: boolean) => {
    setArchiveSelections((current) => ({ ...current, [entryPath]: checked }));
  };

  const updateArchiveItemSheet = (entryPath: string, sheetName: string) => {
    setArchiveInspection((current) => {
      if (!current?.data) {
        return current;
      }
      return {
        ...current,
        data: {
          ...current.data,
          items: current.data.items.map((item) =>
            item.entry_path === entryPath ? { ...item, sheet_name: sheetName } : item
          )
        }
      };
    });
  };

  const loadTasks = React.useCallback(async () => {
    setListing(true);
    setNotice(null);
    const result = await client.listImportTasks({
      status: statusFilter,
      sourceType: sourceTypeFilter,
      page: 1,
      pageSize: 20
    });
    setListResult(result);
    recordActivity("GET /api/v1/import-tasks", result);
    setListing(false);
  }, [client, statusFilter, sourceTypeFilter]);

  const loadDetail = React.useCallback(
    async (batchId: string) => {
      if (!batchId.trim()) {
        return;
      }
      setRefreshingDetail(true);
      setNotice(null);
      const result = await client.getImportTask(batchId.trim());
      setDetailResult(result);
      setSelectedBatchId(batchId.trim());
      recordActivity("GET /api/v1/import-tasks/{batch_id}", result);
      setRefreshingDetail(false);
    },
    [client]
  );

  const loadFailures = React.useCallback(
    async (batchId: string) => {
      if (!batchId.trim()) {
        setNotice("Open a task before loading failures.");
        return;
      }
      setLoadingFailures(true);
      setNotice(null);
      const result = await client.listImportTaskFailures(batchId.trim(), { page: 1, pageSize: 50 });
      setFailureResult(result);
      recordActivity("GET /api/v1/import-tasks/{batch_id}/failures", result);
      setLoadingFailures(false);
    },
    [client]
  );

  const loadPreviewRows = React.useCallback(
    async (task: ImportTask | null | undefined) => {
      if (!task?.batch_id) {
        setNotice("Open a completed material task before previewing rows.");
        return;
      }
      if (!canPreviewTask(task)) {
        setNotice("This source type does not create a direct material master-row preview.");
        return;
      }
      setLoadingPreview(true);
      setNotice(null);
      const result = await client.searchMaterials({
        sourceBatchId: task.batch_id,
        status: "",
        page: 1,
        pageSize: 20
      });
      setPreviewResult(result);
      recordActivity("GET /api/v1/materials/search?source_batch_id", result);
      setLoadingPreview(false);
    },
    [client]
  );

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  React.useEffect(() => {
    if (trackingBatchIds.length === 0) {
      return undefined;
    }
    const timer = window.setInterval(async () => {
      const results = await Promise.all(trackingBatchIds.map((batchId) => client.getImportTask(batchId)));
      const focused = results.find((result) => result.data?.batch_id === selectedBatchId) ?? results[0];
      if (focused) {
        setDetailResult(focused);
        recordActivity("GET /api/v1/import-tasks/{batch_id}", focused);
      }
      const remaining = results
        .map((result) => result.data)
        .filter((task): task is ImportTask => Boolean(task && !isTerminalTask(task)))
        .map((task) => task.batch_id);
      setTrackingBatchIds(remaining);
      void loadTasks();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [client, loadTasks, selectedBatchId, trackingBatchIds]);

  const submitTask = async () => {
    if (!file) {
      setNotice("Choose a material import file before submitting a task.");
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const result = await client.createMaterialImportTask({
      file,
      sourceType,
      sourceSystem,
      sourceTxId,
      sheetName
    });
    setSubmitResult(result);
    recordActivity("POST /api/v1/import-tasks/materials", result);
    if (result.ok && result.data) {
      setSelectedBatchId(result.data.batch_id);
      setDetailResult(result);
      setTrackingBatchIds([result.data.batch_id]);
      setFailureResult(null);
      setPreviewResult(null);
      void loadDetail(result.data.batch_id);
      void loadTasks();
    }
    setSubmitting(false);
  };

  const submitArchive = async () => {
    const archive = archiveInspection?.data;
    if (!archiveFile || !archive) {
      setNotice("请先选择压缩包并完成预检，再提交拆分任务。");
      return;
    }
    const selectedItems = archive.items.filter((item) => item.supported && archiveSelections[item.entry_path]);
    if (selectedItems.length === 0) {
      setNotice("请至少勾选一个可导入文件。");
      return;
    }
    setArchiveSubmitting(true);
    setNotice(null);
    const result = await client.createMaterialImportArchiveTasks({
      archiveId: archive.archive_id,
      archiveFileName: archive.archive_file_name,
      sourceSystem,
      sourceTxId,
      items: selectedItems
    });
    setArchiveSubmitResult(result);
    recordActivity("POST /api/v1/import-tasks/materials/archive", result);
    if (result.ok && result.data?.tasks.length) {
      const tasks = result.data.tasks;
      const firstTask = tasks[0];
      setSelectedBatchId(firstTask.batch_id);
      setDetailResult({ ...result, data: firstTask });
      setTrackingBatchIds(tasks.map((task) => task.batch_id));
      setFailureResult(null);
      setPreviewResult(null);
      void loadTasks();
    }
    setArchiveSubmitting(false);
  };

  const copySubmitEvidence = () => {
    if (!submitResult) {
      return;
    }
    void copyEvidence("async import task submission", submitResult, {
      operation: "import_tasks.materials.create",
      result: sanitizeTask(submitResult.data)
    });
  };

  const copyArchiveSubmitEvidence = () => {
    if (!archiveSubmitResult) {
      return;
    }
    void copyEvidence("archive import task submission", archiveSubmitResult, {
      operation: "import_tasks.materials.archive.create",
      archive_id: archiveSubmitResult.data?.archive_id,
      task_count: archiveSubmitResult.data?.task_count ?? 0,
      tasks: (archiveSubmitResult.data?.tasks ?? []).map(sanitizeTask)
    });
  };

  const copyListEvidence = () => {
    if (!listResult) {
      return;
    }
    void copyEvidence("async import task list", listResult, {
      operation: "import_tasks.list",
      filters: { status: statusFilter, source_type: sourceTypeFilter },
      page: listResult.data?.page,
      items: (listResult.data?.items ?? []).slice(0, 10).map(sanitizeTask)
    });
  };

  const copyDetailEvidence = () => {
    if (!detailResult) {
      return;
    }
    void copyEvidence("async import task detail", detailResult, {
      operation: "import_tasks.detail",
      result: sanitizeTask(detailResult.data)
    });
  };

  const copyFailureEvidence = () => {
    if (!failureResult) {
      return;
    }
    void copyEvidence("async import task failures", failureResult, {
      operation: "import_tasks.failures",
      batch_id: selectedBatchId,
      page: failureResult.data?.page,
      failures: (failureResult.data?.items ?? []).slice(0, 20).map(sanitizeFailure)
    });
  };

  const selectedTask = detailResult?.data ?? submitResult?.data ?? null;

  return (
    <>
      <section className="panel import-monitor-command" aria-labelledby="import-monitor-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Import Tasks</p>
            <h2 id="import-monitor-heading">Async material import</h2>
          </div>
          <UploadCloud size={20} />
        </div>

        {notice ? (
          <div className="notice-line">
            <AlertTriangle size={16} />
            <span>{notice}</span>
          </div>
        ) : null}
        {copyStatus ? (
          <div className="notice-line notice-line-ok">
            <CheckCircle2 size={16} />
            <span>{copyStatus}</span>
          </div>
        ) : null}

        <div className="segmented-control" role="tablist" aria-label="Import mode">
          <button
            type="button"
            role="tab"
            aria-selected={importMode === "single"}
            className={importMode === "single" ? "segment-active" : ""}
            onClick={() => setImportMode("single")}
          >
            Single file
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={importMode === "archive"}
            className={importMode === "archive" ? "segment-active" : ""}
            onClick={() => setImportMode("archive")}
          >
            Archive package
          </button>
        </div>

        {importMode === "single" ? <ImportGuidePanel guide={materialImportGuides[sourceType]} /> : null}

        {importMode === "single" ? (
          <>
            <div className="dictionary-form dictionary-form-wide">
              <SelectControl label="Source type" value={sourceType} onChange={changeSourceType} options={sourceTypeOptions} />
              <TextControl label="Source system" value={sourceSystem} onChange={setSourceSystem} />
              <TextControl label="Source TX ID" value={sourceTxId} onChange={setSourceTxId} />
              <FileControl accept={materialImportGuides[sourceType].accept} onChange={chooseFile} />
              {inspecting ? (
                <div className="import-file-inspector">
                  <LoaderCircle size={16} className="spin" />
                  <span>Checking file worksheets...</span>
                </div>
              ) : (
                <SheetInspector result={inspection} value={sheetName} onChange={setSheetName} />
              )}
              <button className="action-button" type="button" onClick={submitTask} disabled={submitting || inspecting}>
                {submitting || inspecting ? <LoaderCircle size={16} className="spin" /> : <UploadCloud size={16} />}
                Submit
              </button>
            </div>
            <div className="section-toolbar">
              <span>{submitResult?.data ? `Accepted batch: ${submitResult.data.batch_id}` : "No submitted task yet"}</span>
              <button className="tool-button" type="button" disabled={!submitResult} onClick={copySubmitEvidence}>
                <Clipboard size={17} />
                Copy Evidence
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="dictionary-form dictionary-form-wide">
              <TextControl label="来源系统" value={sourceSystem} onChange={setSourceSystem} />
              <TextControl label="来源事务 ID" value={sourceTxId} onChange={setSourceTxId} />
              <FileControl
                label="压缩包文件"
                accept=".zip,.7z,.tar,.tar.gz,.tgz,.tar.bz2,.tbz2,.tar.xz,.txz,application/zip,application/x-7z-compressed,application/x-tar,application/gzip"
                onChange={chooseArchiveFile}
              />
              <button
                className="action-button"
                type="button"
                onClick={submitArchive}
                disabled={archiveSubmitting || archiveInspecting || !archiveInspection?.data?.importable_count}
              >
                {archiveSubmitting || archiveInspecting ? <LoaderCircle size={16} className="spin" /> : <UploadCloud size={16} />}
                提交压缩包
              </button>
            </div>
            {archiveInspecting ? (
              <div className="import-file-inspector">
                <LoaderCircle size={16} className="spin" />
                <span>正在检测压缩包内文件...</span>
              </div>
            ) : (
              <ArchiveInspector
                result={archiveInspection}
                selections={archiveSelections}
                onToggle={toggleArchiveItem}
                onSheetChange={updateArchiveItemSheet}
              />
            )}
            <div className="section-toolbar">
              <span>
                {archiveSubmitResult?.data
                  ? `已创建任务：${archiveSubmitResult.data.task_count} 个 / 来源包：${archiveSubmitResult.data.archive_file_name}`
                  : "尚未提交压缩包任务"}
              </span>
              <button className="tool-button" type="button" disabled={!archiveSubmitResult} onClick={copyArchiveSubmitEvidence}>
                <Clipboard size={17} />
                Copy Evidence
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel import-monitor-panel" aria-labelledby="import-task-list-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Queue</p>
            <h2 id="import-task-list-heading">Task list</h2>
          </div>
          <MiniPill tone="neutral" label={`${listResult?.data?.page.total ?? 0} total`} />
        </div>

        <form
          className="dictionary-form dictionary-form-wide"
          onSubmit={(event) => {
            event.preventDefault();
            void loadTasks();
          }}
        >
          <SelectControl label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          <SelectControl
            label="Source type"
            value={sourceTypeFilter}
            onChange={setSourceTypeFilter}
            options={filterSourceTypeOptions}
          />
          <TextControl label="Batch ID" value={selectedBatchId} onChange={setSelectedBatchId} />
          <button className="action-button" type="submit" disabled={listing}>
            {listing ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
            Search
          </button>
          <button className="tool-button" type="button" disabled={!listResult} onClick={copyListEvidence}>
            <Clipboard size={17} />
            Copy Evidence
          </button>
        </form>

        <TaskTable result={listResult} selectedBatchId={selectedBatchId} onSelect={(batchId) => void loadDetail(batchId)} />
      </section>

      <section className="panel import-monitor-panel" aria-labelledby="import-task-detail-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Detail</p>
            <h2 id="import-task-detail-heading">Progress and counters</h2>
          </div>
          {selectedTask ? <MiniPill tone={statusTone(selectedTask.status)} label={selectedTask.status} /> : null}
        </div>

        <TaskDetail
          result={detailResult}
          refreshing={refreshingDetail}
          previewing={loadingPreview}
          onRefresh={() => void loadDetail(selectedBatchId)}
          onLoadFailures={() => void loadFailures(selectedBatchId)}
          onPreviewRows={() => void loadPreviewRows(selectedTask)}
          onCopyEvidence={copyDetailEvidence}
        />
      </section>

      <section className="panel import-monitor-panel" aria-labelledby="import-task-preview-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Preview</p>
            <h2 id="import-task-preview-heading">Imported material rows</h2>
          </div>
          <button className="icon-button" type="button" title="Preview rows" onClick={() => void loadPreviewRows(selectedTask)} disabled={!canPreviewTask(selectedTask) || loadingPreview}>
            {loadingPreview ? <LoaderCircle size={18} className="spin" /> : <Eye size={18} />}
          </button>
        </div>
        <div className="section-toolbar">
          <span>
            Total: {previewResult?.data?.page.total ?? 0} / Returned: {previewResult?.data?.items.length ?? 0}
          </span>
        </div>
        <MaterialPreviewTable result={previewResult} />
      </section>

      <section className="panel import-monitor-panel" aria-labelledby="import-task-failures-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Failures</p>
            <h2 id="import-task-failures-heading">Validation rows</h2>
          </div>
          <button className="icon-button" type="button" title="Refresh failures" onClick={() => void loadFailures(selectedBatchId)} disabled={loadingFailures}>
            {loadingFailures ? <LoaderCircle size={18} className="spin" /> : <RefreshCw size={18} />}
          </button>
        </div>

        <FailureTable result={failureResult} onCopyEvidence={copyFailureEvidence} />
      </section>
    </>
  );
}
