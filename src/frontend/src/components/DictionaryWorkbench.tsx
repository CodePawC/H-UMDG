import React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Database,
  Eye,
  LoaderCircle,
  Search,
  UploadCloud
} from "lucide-react";
import type { HudmpApiClient } from "../lib/api";
import { copyAndSaveEvidence } from "../lib/evidence";
import { departmentImportGuide, materialImportGuides } from "../lib/importGuides";
import { ImportGuidePanel } from "./ImportGuidePanel";
import type {
  ApiResult,
  DictionaryCatalogItem,
  DictionaryCatalogResult,
  DepartmentRow,
  ImportFileInspection,
  ImportFailure,
  ImportReport,
  MaterialRow,
  PagedResult,
  TranscodeResolveResult
} from "../types";

export type DictionaryKind = "departments" | "materials";

type DictionaryWorkbenchProps = {
  client: HudmpApiClient;
  activeKind: DictionaryKind;
  onActiveKindChange: (kind: DictionaryKind) => void;
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
};

type CandidateDictionaryRow = {
  id: string;
  enabled: boolean;
  values: Record<string, unknown>;
};

const statusOptions = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "All", value: "" }
];

const materialSourceTypes = [
  { label: "MVP Template", value: "MVP_TEMPLATE" },
  { label: "NHSA Full Spec", value: "NHSA_FULL_SPEC" },
  { label: "NHSA Disabled", value: "NHSA_DISABLED" },
  { label: "NHSA Transcode", value: "NHSA_TRANSCODE" },
  { label: "Device Catalog", value: "DEVICE_CLASSIFICATION_CATALOG" }
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function failureField(failure: ImportFailure): string {
  return display(failure.field_name ?? failure.field);
}

function failureRow(failure: ImportFailure): string {
  return display(failure.row_number ?? failure.row);
}

function sanitizeFailures(failures: ImportFailure[] = []) {
  return failures.slice(0, 10).map((failure) => ({
    row: failure.row_number ?? failure.row ?? null,
    field: failure.field_name ?? failure.field ?? null,
    message: failure.message ?? null
  }));
}

function importCounterValue(report: ImportReport | null | undefined, key: keyof ImportReport): number {
  const value = report?.[key];
  return typeof value === "number" ? value : 0;
}

function buildEvidence(
  title: string,
  result: ApiResult<unknown>,
  payload: Record<string, unknown>
): string {
  return JSON.stringify(
    {
      evidence_type: "H_UMDG_ADMIN_UI_ALPHA_DICTIONARY",
      generated_at: new Date().toISOString(),
      title,
      http_status: result.httpStatus,
      api_code: result.code,
      message: result.message,
      trace_id: result.traceId,
      ok: result.ok,
      raw_files_included: false,
      secrets_included: false,
      ...payload
    },
    null,
    2
  );
}

function MiniPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`mini-pill ${ok ? "mini-pill-ok" : "mini-pill-warn"}`}>{label}</span>;
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
  label,
  accept,
  onChange
}: {
  label: string;
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

function ResultStatus({ result }: { result: ApiResult<unknown> | null }) {
  if (!result) {
    return <MiniPill ok={false} label="Not run" />;
  }
  return <MiniPill ok={result.ok} label={result.ok ? "OK" : `HTTP ${result.httpStatus}`} />;
}

function kindForCatalogItem(item: DictionaryCatalogItem): DictionaryKind | null {
  if (item.dictionary_key === "DEPARTMENT") {
    return "departments";
  }
  if (item.dictionary_key === "MATERIAL") {
    return "materials";
  }
  return null;
}

function seedCandidateRows(item: DictionaryCatalogItem): CandidateDictionaryRow[] {
  const records = item.reference_records?.length ? item.reference_records : [{}];
  return records.map((record, index) => ({
    id: `${item.dictionary_key}-${index + 1}`,
    enabled: index === 0 && item.dictionary_key === "CAMPUS",
    values: {
      status: index === 0 && item.dictionary_key === "CAMPUS" ? "ACTIVE" : "INACTIVE",
      ...record
    }
  }));
}

function DictionaryCatalogPanel({
  result,
  loading,
  activeKind,
  onSelect,
  onRefresh
}: {
  result: ApiResult<DictionaryCatalogResult> | null;
  loading: boolean;
  activeKind: DictionaryKind;
  onSelect: (item: DictionaryCatalogItem) => void;
  onRefresh: () => void;
}) {
  if (loading && !result) {
    return (
      <div className="dictionary-catalog-empty">
        <LoaderCircle size={16} className="spin" />
        <span>正在读取字典目录...</span>
      </div>
    );
  }
  if (!result) {
    return <EmptyState label="尚未读取字典目录。" />;
  }
  if (!result.ok || !result.data) {
    return <EmptyState label={result.error ?? result.message} />;
  }

  const items = result.data.items;

  return (
    <div className="dictionary-catalog" aria-label="Dictionary catalog">
      <div className="dictionary-catalog-header">
        <div>
          <strong>字典目录</strong>
          <span>已接入 {result.data.summary.available_count} 类，待接入 {result.data.summary.blueprint_count} 类。</span>
        </div>
        <button className="tool-button" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? <LoaderCircle size={16} className="spin" /> : <Database size={16} />}
          刷新目录
        </button>
      </div>
      <div className="dictionary-catalog-table" role="table" aria-label="字典目录">
        <div className="dictionary-catalog-row dictionary-catalog-row-head" role="row">
          <span role="columnheader">字典</span>
          <span role="columnheader">领域</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">来源与维护方式</span>
          <span role="columnheader">参考数据</span>
          <span role="columnheader">操作</span>
        </div>
        {items.map((item) => {
          const targetKind = kindForCatalogItem(item);
          const selected = targetKind === activeKind;
          return (
            <div
              className={selected ? "dictionary-catalog-row dictionary-catalog-row-active" : "dictionary-catalog-row"}
              key={item.dictionary_key}
              role="row"
            >
              <span role="cell">
                <strong>{item.name}</strong>
                <small>{item.purpose}</small>
              </span>
              <span role="cell">{item.domain}</span>
              <span role="cell">
                <MiniPill ok={item.status === "AVAILABLE"} label={item.status === "AVAILABLE" ? "已接入" : "待接入"} />
              </span>
              <span role="cell">
                <strong>{item.candidate_source ?? "本院维护"}</strong>
                <small>{item.curation_policy ?? item.maintenance_modes.join(" / ")}</small>
              </span>
              <span role="cell" className="field-chip-list">
                {item.reference_records?.length ? (
                  <span className="field-chip">{item.reference_records.length} 条候选</span>
                ) : null}
                {item.key_fields.slice(0, item.reference_records?.length ? 2 : 3).map((field) => (
                  <span className="field-chip" key={field.name}>
                    {field.label}
                  </span>
                ))}
              </span>
              <span role="cell">
                <button
                  className="table-action"
                  type="button"
                  onClick={() => onSelect(item)}
                >
                  {targetKind ? "维护" : item.status === "AVAILABLE" ? "启停配置" : "待接入"}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function CandidateDictionaryMaintenance({
  item,
  rows,
  notice,
  onBack,
  onToggle,
  onAdd
}: {
  item: DictionaryCatalogItem;
  rows: CandidateDictionaryRow[];
  notice: React.ReactNode;
  onBack: () => void;
  onToggle: (rowId: string) => void;
  onAdd: () => void;
}) {
  const displayFields = item.key_fields.slice(0, 4);
  const enabledCount = rows.filter((row) => row.enabled).length;

  return (
    <>
      <section className="panel dictionary-command dictionary-maintenance-header" aria-labelledby="candidate-maintenance-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Dictionary Maintenance</p>
            <h2 id="candidate-maintenance-heading">{item.name}维护</h2>
          </div>
          <button className="tool-button" type="button" onClick={onBack}>
            <ArrowLeft size={17} />
            返回字典目录
          </button>
        </div>
        <div className="candidate-summary-grid">
          <div>
            <span>候选来源</span>
            <strong>{item.candidate_source ?? "本院维护"}</strong>
          </div>
          <div>
            <span>维护方式</span>
            <strong>{item.curation_policy ?? item.maintenance_modes.join(" / ")}</strong>
          </div>
          <div>
            <span>启用数量</span>
            <strong>{enabledCount} / {rows.length}</strong>
          </div>
        </div>
        {notice}
      </section>

      <section className="panel dictionary-panel dictionary-panel-wide" aria-labelledby="candidate-list-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Candidates</p>
            <h2 id="candidate-list-heading">候选数据启停</h2>
          </div>
          <button className="action-button" type="button" onClick={onAdd}>
            <Database size={16} />
            手动新增
          </button>
        </div>
        <div className="data-table candidate-dictionary-table" role="table" aria-label={`${item.name}候选数据`}>
          <div role="row">
            {displayFields.map((field) => (
              <span role="columnheader" key={field.name}>{field.label}</span>
            ))}
            <span role="columnheader">状态</span>
            <span role="columnheader">操作</span>
          </div>
          {rows.map((row) => (
            <div role="row" key={row.id}>
              {displayFields.map((field) => (
                <span key={field.name}>{display(row.values[field.name])}</span>
              ))}
              <span>{row.enabled ? "ACTIVE" : "INACTIVE"}</span>
              <span>
                <button className="table-action" type="button" onClick={() => onToggle(row.id)}>
                  {row.enabled ? "停用" : "启用"}
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel dictionary-panel dictionary-panel-wide" aria-labelledby="candidate-schema-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Schema</p>
            <h2 id="candidate-schema-heading">字段要求</h2>
          </div>
          <MiniPill ok={item.status === "AVAILABLE"} label={item.status === "AVAILABLE" ? "可启停" : "待接入"} />
        </div>
        <div className="data-table candidate-field-table" role="table" aria-label={`${item.name}字段要求`}>
          <div role="row">
            <span role="columnheader">字段</span>
            <span role="columnheader">名称</span>
            <span role="columnheader">必填</span>
            <span role="columnheader">示例</span>
          </div>
          {[...item.key_fields, ...item.optional_fields].map((field) => (
            <div role="row" key={field.name}>
              <span>{field.name}</span>
              <span>{field.label}</span>
              <span>{field.required ? "是" : "否"}</span>
              <span>{display(field.example)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function replaceDepartmentRow(
  current: ApiResult<PagedResult<DepartmentRow>> | null,
  row: DepartmentRow
): ApiResult<PagedResult<DepartmentRow>> | null {
  if (!current?.data) {
    return current;
  }
  return {
    ...current,
    data: {
      ...current.data,
      items: current.data.items.map((item) => (item.dept_code === row.dept_code ? row : item))
    }
  };
}

function DepartmentTable({
  result,
  updatingCode,
  onStatusChange
}: {
  result: ApiResult<PagedResult<DepartmentRow>> | null;
  updatingCode?: string | null;
  onStatusChange?: (row: DepartmentRow) => void;
}) {
  const rows = result?.data?.items ?? [];
  if (!result) {
    return <EmptyState label="No department query yet." />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  if (rows.length === 0) {
    return <EmptyState label="No departments matched." />;
  }

  return (
    <div className="data-table department-table" role="table" aria-label="Department results">
      <div role="row">
        <span role="columnheader">编码</span>
        <span role="columnheader">科室名称</span>
        <span role="columnheader">功能定位</span>
        <span role="columnheader">类型</span>
        <span role="columnheader">状态</span>
        <span role="columnheader">启停</span>
      </div>
      {rows.map((row) => {
        const isActive = row.status === "ACTIVE";
        return (
          <div role="row" key={row.dept_id}>
            <span>{display(row.dept_code)}</span>
            <span>
              <strong>{display(row.dept_name)}</strong>
              <small>{display(row.dept_alias)}</small>
            </span>
            <span>{display(row.standard_scope)}</span>
            <span>{display(row.dept_type)}</span>
            <span>{isActive ? "启用" : "停用"}</span>
            <span>
              <button
                className="table-action"
                type="button"
                disabled={!onStatusChange || updatingCode === row.dept_code}
                onClick={() => onStatusChange?.(row)}
              >
                {updatingCode === row.dept_code ? "更新中" : isActive ? "停用" : "启用"}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MaterialTable({ result }: { result: ApiResult<PagedResult<MaterialRow>> | null }) {
  const rows = result?.data?.items ?? [];
  if (!result) {
    return <EmptyState label="No material query yet." />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  if (rows.length === 0) {
    return <EmptyState label="No materials matched." />;
  }

  return (
    <div className="data-table data-table-wide" role="table" aria-label="Material results">
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

function ImportReportPanel({
  result,
  onCopyEvidence,
  onPreview,
  previewing
}: {
  result: ApiResult<ImportReport> | null;
  onCopyEvidence: () => void;
  onPreview: (report: ImportReport) => void;
  previewing: boolean;
}) {
  const report = result?.data;
  const failures = report?.failures ?? [];

  if (!result) {
    return <EmptyState label="No import result yet." />;
  }
  if (!result.ok || !report) {
    return <EmptyState label={result.error ?? result.message} />;
  }

  return (
    <div className="result-stack">
      <div className="counter-grid">
        <div>
          <span>Rows</span>
          <strong>{importCounterValue(report, "source_row_count")}</strong>
        </div>
        <div>
          <span>Success</span>
          <strong>{importCounterValue(report, "success_count")}</strong>
        </div>
        <div>
          <span>Failed</span>
          <strong>{importCounterValue(report, "failed_count")}</strong>
        </div>
        <div>
          <span>Duplicate</span>
          <strong>{importCounterValue(report, "duplicate_count")}</strong>
        </div>
        <div>
          <span>Disabled</span>
          <strong>{importCounterValue(report, "disabled_count")}</strong>
        </div>
        <div>
          <span>Transcoded</span>
          <strong>{importCounterValue(report, "transcoded_count")}</strong>
        </div>
      </div>

      <div className="import-meta">
        <span>Batch: {display(report.batch_id)}</span>
        <span>Source: {display(report.source_type ?? report.source_system)}</span>
        <span>File: {display(report.source_file_name)}</span>
      </div>

      <div className="section-toolbar">
        <strong>Validation failures</strong>
        <div className="button-row">
          <button className="tool-button" type="button" title="Preview imported rows" onClick={() => onPreview(report)} disabled={previewing}>
            {previewing ? <LoaderCircle size={17} className="spin" /> : <Eye size={17} />}
            Preview Import
          </button>
          <button className="tool-button" type="button" title="Copy sanitized evidence" onClick={onCopyEvidence}>
            <Clipboard size={17} />
            Copy Evidence
          </button>
        </div>
      </div>

      {failures.length ? (
        <div className="data-table failure-table" role="table" aria-label="Import validation failures">
          <div role="row">
            <span role="columnheader">Row</span>
            <span role="columnheader">Field</span>
            <span role="columnheader">Message</span>
          </div>
          {failures.slice(0, 10).map((failure, index) => (
            <div role="row" key={`${failureRow(failure)}-${failureField(failure)}-${index}`}>
              <span>{failureRow(failure)}</span>
              <span>{failureField(failure)}</span>
              <span>{display(failure.message)}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No validation failures returned." />
      )}
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
          <span>Select the worksheet to import before pressing Import.</span>
        </div>
      ) : null}
    </div>
  );
}

function ImportPreviewPanel({
  kind,
  result
}: {
  kind: DictionaryKind;
  result: ApiResult<PagedResult<DepartmentRow>> | ApiResult<PagedResult<MaterialRow>> | null;
}) {
  if (!result) {
    return null;
  }

  const total = result.data?.page.total ?? 0;
  const returned = result.data?.items.length ?? 0;

  return (
    <section className="import-preview" aria-label="Imported rows preview">
      <div className="section-toolbar">
        <div>
          <strong>Imported rows preview</strong>
          <span>
            Total: {total} / Returned: {returned}
          </span>
        </div>
      </div>
      {kind === "departments" ? (
        <DepartmentTable result={result as ApiResult<PagedResult<DepartmentRow>>} />
      ) : (
        <MaterialTable result={result as ApiResult<PagedResult<MaterialRow>>} />
      )}
    </section>
  );
}

function TranscodePanel({
  result,
  onCopyEvidence
}: {
  result: ApiResult<TranscodeResolveResult> | null;
  onCopyEvidence: () => void;
}) {
  const rows = result?.data?.items ?? [];

  if (!result) {
    return <EmptyState label="No transcode lookup yet." />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }

  return (
    <div className="result-stack">
      <div className="section-toolbar">
        <div className="transcode-heading">
          <MiniPill ok={result.data?.status === "FOUND"} label={result.data?.status ?? "NOT_FOUND"} />
          <span>Total: {result.data?.page.total ?? 0}</span>
        </div>
        <button className="tool-button" type="button" title="Copy sanitized evidence" onClick={onCopyEvidence}>
          <Clipboard size={17} />
          Copy Evidence
        </button>
      </div>

      {rows.length ? (
        <div className="data-table transcode-table" role="table" aria-label="NHSA transcode results">
          <div role="row">
            <span role="columnheader">Original</span>
            <span role="columnheader">Resolved</span>
            <span role="columnheader">Change</span>
            <span role="columnheader">Batch</span>
            <span role="columnheader">Row</span>
          </div>
          {rows.map((row) => (
            <div role="row" key={row.stg_id}>
              <span>{display(row.original_yb_code_27)}</span>
              <span>{display(row.yb_code_27)}</span>
              <span>{display(row.change_type)}</span>
              <span>{display(row.batch_id)}</span>
              <span>{display(row.row_number)}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No transcode rows matched." />
      )}
    </div>
  );
}

export function DictionaryWorkbench({
  client,
  activeKind,
  onActiveKindChange,
  onApiActivity
}: DictionaryWorkbenchProps) {
  const [kind, setKind] = React.useState<DictionaryKind>(activeKind);
  const [page, setPage] = React.useState<"catalog" | "maintenance" | "candidate">("maintenance");
  const [catalog, setCatalog] = React.useState<ApiResult<DictionaryCatalogResult> | null>(null);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [candidateItem, setCandidateItem] = React.useState<DictionaryCatalogItem | null>(null);
  const [candidateRows, setCandidateRows] = React.useState<Record<string, CandidateDictionaryRow[]>>({});
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [localNotice, setLocalNotice] = React.useState<string | null>(null);

  const [deptKeyword, setDeptKeyword] = React.useState("");
  const [deptStatus, setDeptStatus] = React.useState("ACTIVE");
  const [deptSearch, setDeptSearch] = React.useState<ApiResult<PagedResult<DepartmentRow>> | null>(null);
  const [deptSearching, setDeptSearching] = React.useState(false);
  const [deptFile, setDeptFile] = React.useState<File | null>(null);
  const [deptImport, setDeptImport] = React.useState<ApiResult<ImportReport> | null>(null);
  const [deptImportPreview, setDeptImportPreview] = React.useState<ApiResult<PagedResult<DepartmentRow>> | null>(null);
  const [deptImporting, setDeptImporting] = React.useState(false);
  const [deptInspection, setDeptInspection] = React.useState<ApiResult<ImportFileInspection> | null>(null);
  const [deptInspecting, setDeptInspecting] = React.useState(false);
  const [deptStandardSyncing, setDeptStandardSyncing] = React.useState(false);
  const [deptStatusUpdating, setDeptStatusUpdating] = React.useState<string | null>(null);

  const [materialKeyword, setMaterialKeyword] = React.useState("");
  const [materialYbCode, setMaterialYbCode] = React.useState("");
  const [materialRegNumber, setMaterialRegNumber] = React.useState("");
  const [materialStatus, setMaterialStatus] = React.useState("ACTIVE");
  const [materialSearch, setMaterialSearch] = React.useState<ApiResult<PagedResult<MaterialRow>> | null>(null);
  const [materialSearching, setMaterialSearching] = React.useState(false);
  const [materialFile, setMaterialFile] = React.useState<File | null>(null);
  const [materialSourceType, setMaterialSourceType] = React.useState("MVP_TEMPLATE");
  const [materialImport, setMaterialImport] = React.useState<ApiResult<ImportReport> | null>(null);
  const [materialImportPreview, setMaterialImportPreview] = React.useState<ApiResult<PagedResult<MaterialRow>> | null>(null);
  const [materialImporting, setMaterialImporting] = React.useState(false);
  const [materialInspection, setMaterialInspection] = React.useState<ApiResult<ImportFileInspection> | null>(null);
  const [materialInspecting, setMaterialInspecting] = React.useState(false);
  const [importPreviewing, setImportPreviewing] = React.useState(false);

  const [sourceSystem, setSourceSystem] = React.useState("MVP");
  const [sourceTxId, setSourceTxId] = React.useState("");
  const [sheetName, setSheetName] = React.useState("");

  const [originalYbCode, setOriginalYbCode] = React.useState("");
  const [transcodeBatchId, setTranscodeBatchId] = React.useState("");
  const [transcodeChangeType, setTranscodeChangeType] = React.useState("");
  const [transcodeResult, setTranscodeResult] = React.useState<ApiResult<TranscodeResolveResult> | null>(null);
  const [transcodeSearching, setTranscodeSearching] = React.useState(false);

  React.useEffect(() => {
    setKind(activeKind);
    setPage("maintenance");
  }, [activeKind]);

  const selectKind = (nextKind: DictionaryKind) => {
    setKind(nextKind);
    onActiveKindChange(nextKind);
  };

  const openMaintenance = (nextKind: DictionaryKind) => {
    selectKind(nextKind);
    setPage("maintenance");
  };

  const openCatalogItem = (item: DictionaryCatalogItem) => {
    const targetKind = kindForCatalogItem(item);
    if (targetKind) {
      openMaintenance(targetKind);
      return;
    }
    setCandidateItem(item);
    setCandidateRows((current) => ({
      ...current,
      [item.dictionary_key]: current[item.dictionary_key] ?? seedCandidateRows(item)
    }));
    setLocalNotice(null);
    setPage("candidate");
  };

  const toggleCandidateRow = (rowId: string) => {
    if (!candidateItem) {
      return;
    }
    setCandidateRows((current) => {
      const rows = current[candidateItem.dictionary_key] ?? seedCandidateRows(candidateItem);
      return {
        ...current,
        [candidateItem.dictionary_key]: rows.map((row) =>
          row.id === rowId
            ? {
                ...row,
                enabled: !row.enabled,
                values: { ...row.values, status: !row.enabled ? "ACTIVE" : "INACTIVE" }
              }
            : row
        )
      };
    });
    setLocalNotice("启停状态已更新。当前为前端候选维护，后续会接入后端保存。");
  };

  const addCandidateRow = () => {
    if (!candidateItem) {
      return;
    }
    const nextIndex = (candidateRows[candidateItem.dictionary_key]?.length ?? 0) + 1;
    const values = Object.fromEntries(
      candidateItem.key_fields.map((field) => [
        field.name,
        field.name === "status"
          ? "ACTIVE"
          : field.name.endsWith("_code")
            ? `${candidateItem.dictionary_key}-${String(nextIndex).padStart(3, "0")}`
            : field.name.endsWith("_name")
              ? `新增${candidateItem.name}${nextIndex}`
              : ""
      ])
    );
    setCandidateRows((current) => ({
      ...current,
      [candidateItem.dictionary_key]: [
        ...(current[candidateItem.dictionary_key] ?? seedCandidateRows(candidateItem)),
        {
          id: `${candidateItem.dictionary_key}-manual-${Date.now()}`,
          enabled: true,
          values
        }
      ]
    }));
    setLocalNotice("已新增一条候选数据。当前为前端临时维护，后续接入保存接口后可持久化。");
  };

  const changeMaterialSourceType = (value: string) => {
    setMaterialSourceType(value);
    setMaterialFile(null);
    setMaterialImport(null);
    setMaterialImportPreview(null);
    setMaterialInspection(null);
    setSheetName("");
    setLocalNotice("Source type changed. Choose the matching template or sample before uploading.");
  };

  const applyInspection = (result: ApiResult<ImportFileInspection>) => {
    const inspection = result.data;
    if (!result.ok || !inspection) {
      return;
    }
    if (inspection.default_sheet_name) {
      setSheetName(inspection.default_sheet_name);
    } else {
      setSheetName("");
    }
    if (inspection.sheets.length > 1) {
      setLocalNotice("This workbook has multiple worksheets. Select the worksheet to import, then press Import.");
    } else {
      setLocalNotice(null);
    }
  };

  const chooseDepartmentFile = async (file: File | null) => {
    setDeptFile(file);
    setDeptImport(null);
    setDeptImportPreview(null);
    setDeptInspection(null);
    setSheetName("");
    if (!file) {
      return;
    }
    setDeptInspecting(true);
    const result = await client.inspectDepartmentImportFile({ file, sourceSystem, sourceTxId });
    setDeptInspection(result);
    notifyActivity("POST /api/v1/departments/import/inspect", result);
    applyInspection(result);
    setDeptInspecting(false);
  };

  const chooseMaterialFile = async (file: File | null) => {
    setMaterialFile(file);
    setMaterialImport(null);
    setMaterialImportPreview(null);
    setMaterialInspection(null);
    setSheetName("");
    if (!file) {
      return;
    }
    setMaterialInspecting(true);
    const result = await client.inspectMaterialImportFile({ file, sourceSystem, sourceTxId, sourceType: materialSourceType });
    setMaterialInspection(result);
    notifyActivity("POST /api/v1/materials/import/inspect", result);
    applyInspection(result);
    setMaterialInspecting(false);
  };

  const copyEvidence = async (title: string, result: ApiResult<unknown>, payload: Record<string, unknown>) => {
    const evidence = buildEvidence(title, result, payload);
    try {
      const message = await copyAndSaveEvidence(evidence, title);
      setCopyStatus(message);
    } catch (error) {
      setCopyStatus(error instanceof Error ? error.message : "Clipboard unavailable");
    }
  };

  const notifyActivity = (label: string, result: ApiResult<unknown>) => {
    onApiActivity(label, result);
  };

  const loadDictionaryCatalog = React.useCallback(async () => {
    setCatalogLoading(true);
    const result = await client.dictionaryCatalog();
    setCatalog(result);
    notifyActivity("GET /api/v1/dictionaries/catalog", result);
    setCatalogLoading(false);
  }, [client]);

  React.useEffect(() => {
    void loadDictionaryCatalog();
  }, [loadDictionaryCatalog]);

  const loadImportPreview = async (targetKind: DictionaryKind, batchId: string) => {
    setImportPreviewing(true);
    setLocalNotice(null);
    if (targetKind === "departments") {
      const result = await client.searchDepartments({
        sourceBatchId: batchId,
        status: "",
        page: 1,
        pageSize: 20
      });
      setDeptImportPreview(result);
      notifyActivity("GET /api/v1/departments/search?source_batch_id", result);
    } else {
      const result = await client.searchMaterials({
        sourceBatchId: batchId,
        status: "",
        page: 1,
        pageSize: 20
      });
      setMaterialImportPreview(result);
      notifyActivity("GET /api/v1/materials/search?source_batch_id", result);
    }
    setImportPreviewing(false);
  };

  const searchDepartments = async () => {
    setDeptSearching(true);
    setLocalNotice(null);
    const result = await client.searchDepartments({
      keyword: deptKeyword,
      status: deptStatus,
      page: 1,
      pageSize: 20
    });
    setDeptSearch(result);
    notifyActivity("GET /api/v1/departments/search", result);
    setDeptSearching(false);
  };

  const syncDepartmentStandardLibrary = async () => {
    setDeptStandardSyncing(true);
    setLocalNotice(null);
    const result = await client.syncStandardDepartments();
    setDeptImport(result);
    notifyActivity("POST /api/v1/departments/standard-library/sync", result);
    if (result.ok && result.data) {
      setDeptStatus("");
      setLocalNotice(
        `标准科室库已同步：共 ${result.data.success_count} 条，新增 ${result.data.retained_count ?? 0} 条，更新 ${result.data.changed_count ?? 0} 条。`
      );
      const searchResult = await client.searchDepartments({ status: "", page: 1, pageSize: 20 });
      setDeptSearch(searchResult);
      notifyActivity("GET /api/v1/departments/search", searchResult);
    }
    setDeptStandardSyncing(false);
  };

  const changeDepartmentStatus = async (row: DepartmentRow) => {
    const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setDeptStatusUpdating(row.dept_code);
    setLocalNotice(null);
    const result = await client.updateDepartmentStatus(row.dept_code, nextStatus);
    notifyActivity("PATCH /api/v1/departments/{dept_code}/status", result);
    if (result.ok && result.data) {
      setDeptSearch((current) => replaceDepartmentRow(current, result.data as DepartmentRow));
      setDeptImportPreview((current) => replaceDepartmentRow(current, result.data as DepartmentRow));
      setLocalNotice(`${result.data.dept_name} 已${nextStatus === "ACTIVE" ? "启用" : "停用"}。`);
    } else {
      setLocalNotice(result.error ?? result.message);
    }
    setDeptStatusUpdating(null);
  };

  const searchMaterials = async () => {
    setMaterialSearching(true);
    setLocalNotice(null);
    const result = await client.searchMaterials({
      keyword: materialKeyword,
      ybCode27: materialYbCode,
      regNumber: materialRegNumber,
      status: materialStatus,
      page: 1,
      pageSize: 20
    });
    setMaterialSearch(result);
    notifyActivity("GET /api/v1/materials/search", result);
    setMaterialSearching(false);
  };

  const importDepartments = async () => {
    if (!deptFile) {
      setLocalNotice("Choose a department file before import.");
      return;
    }
    setDeptImporting(true);
    setLocalNotice(null);
    setDeptImportPreview(null);
    const result = await client.importDepartments({
      file: deptFile,
      sourceSystem,
      sourceTxId,
      sheetName
    });
    setDeptImport(result);
    notifyActivity("POST /api/v1/departments/import", result);
    if (result.ok && result.data?.batch_id) {
      void loadImportPreview("departments", result.data.batch_id);
    }
    setDeptImporting(false);
  };

  const importMaterials = async () => {
    if (!materialFile) {
      setLocalNotice("Choose a material file before import.");
      return;
    }
    setMaterialImporting(true);
    setLocalNotice(null);
    setMaterialImportPreview(null);
    const result = await client.importMaterials({
      file: materialFile,
      sourceSystem,
      sourceTxId,
      sheetName,
      sourceType: materialSourceType
    });
    setMaterialImport(result);
    notifyActivity("POST /api/v1/materials/import", result);
    if (result.ok && result.data?.batch_id) {
      void loadImportPreview("materials", result.data.batch_id);
    }
    setMaterialImporting(false);
  };

  const resolveTranscode = async () => {
    if (!originalYbCode.trim()) {
      setLocalNotice("Enter an original 27-bit NHSA code.");
      return;
    }
    setTranscodeSearching(true);
    setLocalNotice(null);
    const result = await client.resolveMaterialTranscode({
      originalYbCode27: originalYbCode,
      batchId: transcodeBatchId,
      changeType: transcodeChangeType,
      page: 1,
      pageSize: 20
    });
    setTranscodeResult(result);
    notifyActivity("GET /api/v1/materials/transcode/resolve", result);
    setTranscodeSearching(false);
  };

  const activeSearchResult = kind === "departments" ? deptSearch : materialSearch;
  const activeImportResult = kind === "departments" ? deptImport : materialImport;
  const activeSearching = kind === "departments" ? deptSearching : materialSearching;
  const activeImporting = kind === "departments" ? deptImporting : materialImporting;
  const activeInspecting = kind === "departments" ? deptInspecting : materialInspecting;
  const activeImportGuide = kind === "departments" ? departmentImportGuide : materialImportGuides[materialSourceType];
  const activeImportPreview = kind === "departments" ? deptImportPreview : materialImportPreview;
  const activeInspection = kind === "departments" ? deptInspection : materialInspection;

  const copySearchEvidence = () => {
    if (!activeSearchResult) {
      return;
    }
    const page = activeSearchResult.data?.page;
    void copyEvidence(`${kind} search`, activeSearchResult, {
      operation: `${kind}.search`,
      params:
        kind === "departments"
          ? { keyword: deptKeyword, status: deptStatus }
          : {
              keyword: materialKeyword,
              yb_code_27: materialYbCode,
              reg_number: materialRegNumber,
              status: materialStatus
            },
      result: {
        total: page?.total ?? 0,
        returned: activeSearchResult.data?.items.length ?? 0,
        page: page?.page ?? 1,
        page_size: page?.page_size ?? 20
      }
    });
  };

  const copyImportEvidence = () => {
    if (!activeImportResult) {
      return;
    }
    const report = activeImportResult.data;
    void copyEvidence(`${kind} import`, activeImportResult, {
      operation: `${kind}.import`,
      result: report
        ? {
            batch_id: report.batch_id,
            source_type: report.source_type,
            source_system: report.source_system,
            source_file_name: report.source_file_name,
            sheet_name: report.sheet_name,
            source_row_count: report.source_row_count ?? 0,
            success_count: report.success_count,
            failed_count: report.failed_count,
            duplicate_count: report.duplicate_count ?? 0,
            disabled_count: report.disabled_count ?? 0,
            transcoded_count: report.transcoded_count ?? 0,
            failures: sanitizeFailures(report.failures)
          }
        : null
    });
  };

  const copyTranscodeEvidence = () => {
    if (!transcodeResult) {
      return;
    }
    void copyEvidence("NHSA transcode lookup", transcodeResult, {
      operation: "materials.transcode.resolve",
      params: {
        original_yb_code_27: originalYbCode,
        batch_id: transcodeBatchId,
        change_type: transcodeChangeType
      },
      result: {
        status: transcodeResult.data?.status,
        total: transcodeResult.data?.page.total ?? 0,
        items: (transcodeResult.data?.items ?? []).slice(0, 10).map((item) => ({
          original_yb_code_27: item.original_yb_code_27,
          yb_code_27: item.yb_code_27,
          change_type: item.change_type,
          batch_id: item.batch_id,
          row_number: item.row_number
        }))
      }
    });
  };

  const maintenanceTitle = kind === "departments" ? "科室字典维护" : "耗材字典维护";
  const notices = (
    <>
      {localNotice ? (
        <div className="notice-line">
          <AlertTriangle size={16} />
          <span>{localNotice}</span>
        </div>
      ) : null}
      {copyStatus ? (
        <div className="notice-line notice-line-ok">
          <CheckCircle2 size={16} />
          <span>{copyStatus}</span>
        </div>
      ) : null}
    </>
  );

  if (page === "catalog") {
    return (
      <section className="panel dictionary-command dictionary-catalog-page" aria-labelledby="dictionary-workbench-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Dictionary Workbench</p>
            <h2 id="dictionary-workbench-heading">选择要维护的字典</h2>
          </div>
          <Database size={20} />
        </div>
        <DictionaryCatalogPanel
          result={catalog}
          loading={catalogLoading}
          activeKind={kind}
          onSelect={openCatalogItem}
          onRefresh={() => void loadDictionaryCatalog()}
        />
        {notices}
      </section>
    );
  }

  if (page === "candidate" && candidateItem) {
    return (
      <CandidateDictionaryMaintenance
        item={candidateItem}
        rows={candidateRows[candidateItem.dictionary_key] ?? seedCandidateRows(candidateItem)}
        notice={notices}
        onBack={() => setPage("catalog")}
        onToggle={toggleCandidateRow}
        onAdd={addCandidateRow}
      />
    );
  }

  return (
    <>
      <section className="panel dictionary-command dictionary-maintenance-header" aria-labelledby="dictionary-maintenance-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Dictionary Maintenance</p>
            <h2 id="dictionary-maintenance-heading">{maintenanceTitle}</h2>
          </div>
          <button className="tool-button" type="button" onClick={() => setPage("catalog")}>
            <ArrowLeft size={17} />
            返回字典目录
          </button>
        </div>
        <div className="maintenance-switch-row">
          <div className="segmented-control" role="tablist" aria-label="Dictionary type">
            <button
              type="button"
              role="tab"
              aria-selected={kind === "departments"}
              className={kind === "departments" ? "segment-active" : ""}
              onClick={() => selectKind("departments")}
            >
              Departments
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === "materials"}
              className={kind === "materials" ? "segment-active" : ""}
              onClick={() => selectKind("materials")}
            >
              Materials
            </button>
          </div>
          <span className="dictionary-maintenance-note">当前页只显示一个字典的查询、导入和核对内容，减少滚动遗漏。</span>
        </div>
        {notices}
      </section>

      <div className="dictionary-maintenance-grid">
        <section className="panel dictionary-panel" aria-labelledby="dictionary-search-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="dictionary-search-heading">{kind === "departments" ? "Departments" : "Materials"}</h2>
            </div>
            <ResultStatus result={activeSearchResult} />
          </div>

          {kind === "departments" ? (
            <div className="standard-library-panel">
              <div>
                <strong>标准科室库</strong>
                <span>内置国家卫健委诊疗科目框架，包含科室名称、常用别名和功能定位。同步后按本院实际情况启用或停用。</span>
              </div>
              <button className="action-button" type="button" onClick={syncDepartmentStandardLibrary} disabled={deptStandardSyncing}>
                {deptStandardSyncing ? <LoaderCircle size={16} className="spin" /> : <Database size={16} />}
                同步标准库
              </button>
            </div>
          ) : null}

          {kind === "departments" ? (
            <form
              className="dictionary-form"
              onSubmit={(event) => {
                event.preventDefault();
                void searchDepartments();
              }}
            >
              <TextControl label="Keyword" value={deptKeyword} onChange={setDeptKeyword} placeholder="Code, name, alias" />
              <SelectControl label="Status" value={deptStatus} onChange={setDeptStatus} options={statusOptions} />
              <button className="action-button" type="submit" disabled={deptSearching}>
                {deptSearching ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
                Search
              </button>
            </form>
          ) : (
            <form
              className="dictionary-form dictionary-form-wide"
              onSubmit={(event) => {
                event.preventDefault();
                void searchMaterials();
              }}
            >
              <TextControl
                label="Keyword"
                value={materialKeyword}
                onChange={setMaterialKeyword}
                placeholder="Generic name"
              />
              <TextControl label="27-bit code" value={materialYbCode} onChange={setMaterialYbCode} />
              <TextControl label="Registration" value={materialRegNumber} onChange={setMaterialRegNumber} />
              <SelectControl label="Status" value={materialStatus} onChange={setMaterialStatus} options={statusOptions} />
              <button className="action-button" type="submit" disabled={materialSearching}>
                {materialSearching ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
                Search
              </button>
            </form>
          )}

          <div className="section-toolbar">
            <span>
              Total: {activeSearchResult?.data?.page.total ?? 0} / Returned:{" "}
              {activeSearchResult?.data?.items.length ?? 0}
            </span>
            <button className="tool-button" type="button" disabled={!activeSearchResult} onClick={copySearchEvidence}>
              <Clipboard size={17} />
              Copy Evidence
            </button>
          </div>

          {kind === "departments" ? (
            <DepartmentTable result={deptSearch} updatingCode={deptStatusUpdating} onStatusChange={changeDepartmentStatus} />
          ) : (
            <MaterialTable result={materialSearch} />
          )}
        </section>

        <section className="panel dictionary-panel" aria-labelledby="dictionary-import-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Import</p>
              <h2 id="dictionary-import-heading">{kind === "departments" ? "Department file" : "Material file"}</h2>
            </div>
            <ResultStatus result={activeImportResult} />
          </div>

          <ImportGuidePanel guide={activeImportGuide} />

          <div className="dictionary-form dictionary-form-wide">
            {kind === "materials" ? (
              <SelectControl
                label="Source type"
                value={materialSourceType}
                onChange={changeMaterialSourceType}
                options={materialSourceTypes}
              />
            ) : null}
            <TextControl label="Source system" value={sourceSystem} onChange={setSourceSystem} />
            <TextControl label="Source TX ID" value={sourceTxId} onChange={setSourceTxId} />
            <FileControl
              label="File"
              accept={activeImportGuide.accept}
              onChange={kind === "departments" ? chooseDepartmentFile : chooseMaterialFile}
            />
            {activeInspecting ? (
              <div className="import-file-inspector">
                <LoaderCircle size={16} className="spin" />
                <span>Checking file worksheets...</span>
              </div>
            ) : (
              <SheetInspector result={activeInspection} value={sheetName} onChange={setSheetName} />
            )}
            <button
              className="action-button"
              type="button"
              disabled={activeImporting || activeInspecting}
              onClick={kind === "departments" ? importDepartments : importMaterials}
            >
              {activeImporting ? <LoaderCircle size={16} className="spin" /> : <UploadCloud size={16} />}
              Import
            </button>
          </div>

          <ImportReportPanel
            result={activeImportResult}
            onCopyEvidence={copyImportEvidence}
            onPreview={(report) => void loadImportPreview(kind, report.batch_id)}
            previewing={importPreviewing}
          />
          <ImportPreviewPanel kind={kind} result={activeImportPreview} />
        </section>

        {kind === "materials" ? (
          <section className="panel dictionary-panel dictionary-panel-wide" aria-labelledby="transcode-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">NHSA</p>
                <h2 id="transcode-heading">Transcode lookup</h2>
              </div>
              <ResultStatus result={transcodeResult} />
            </div>
            <form
              className="dictionary-form dictionary-form-wide"
              onSubmit={(event) => {
                event.preventDefault();
                void resolveTranscode();
              }}
            >
              <TextControl label="Original 27-bit code" value={originalYbCode} onChange={setOriginalYbCode} />
              <TextControl label="Batch ID" value={transcodeBatchId} onChange={setTranscodeBatchId} />
              <TextControl label="Change type" value={transcodeChangeType} onChange={setTranscodeChangeType} />
              <button className="action-button" type="submit" disabled={transcodeSearching}>
                {transcodeSearching ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
                Resolve
              </button>
            </form>
            <TranscodePanel result={transcodeResult} onCopyEvidence={copyTranscodeEvidence} />
          </section>
        ) : null}
      </div>
    </>
  );
}
