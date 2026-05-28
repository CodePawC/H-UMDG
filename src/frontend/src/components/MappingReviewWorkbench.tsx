import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  GitPullRequestArrow,
  LoaderCircle,
  Search,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import type { HudmpApiClient } from "../lib/api";
import { copyAndSaveEvidence } from "../lib/evidence";
import type {
  ApiResult,
  MappingResolveResult,
  MappingReviewActionResult,
  MappingReviewTask,
  PagedResult
} from "../types";

type MappingReviewWorkbenchProps = {
  client: HudmpApiClient;
  onApiActivity: (label: string, result: ApiResult<unknown>) => void;
};

const categoryOptions = [
  { label: "Material", value: "MATERIAL" },
  { label: "Department", value: "DEPARTMENT" }
];

const statusOptions = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "" }
];

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
  if (status === "APPROVED" || status === "MATCHED") {
    return "ok";
  }
  if (status === "REJECTED") {
    return "error";
  }
  if (status === "PENDING" || status === "PENDING_REVIEW") {
    return "warn";
  }
  return "neutral";
}

function MiniPill({ tone, label }: { tone: "ok" | "warn" | "error" | "neutral"; label: string }) {
  return <span className={`task-status task-status-${tone}`}>{label}</span>;
}

function TextControl({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
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

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function sanitizeTask(task: MappingReviewTask | null | undefined) {
  if (!task) {
    return null;
  }
  return {
    task_id: task.task_id,
    category: task.category,
    source_system: task.source_system,
    source_key: task.source_key,
    source_desc: task.source_desc,
    status: task.status,
    created_at: task.created_at
  };
}

function buildEvidence(title: string, result: ApiResult<unknown>, payload: Record<string, unknown>): string {
  return JSON.stringify(
    {
      evidence_type: "H_UMDG_ADMIN_UI_ALPHA_MAPPING_REVIEW",
      generated_at: new Date().toISOString(),
      title,
      http_status: result.httpStatus,
      api_code: result.code,
      message: result.message,
      trace_id: result.traceId,
      ok: result.ok,
      raw_payload_included: false,
      secrets_included: false,
      ...payload
    },
    null,
    2
  );
}

function ResolveResultPanel({
  result,
  onCopyEvidence
}: {
  result: ApiResult<MappingResolveResult> | null;
  onCopyEvidence: () => void;
}) {
  const data = result?.data;
  if (!result) {
    return <EmptyState label="No mapping resolve request yet." />;
  }
  if (!result.ok || !data) {
    return <EmptyState label={result.error ?? result.message} />;
  }

  return (
    <div className="result-stack">
      <div className="section-toolbar">
        <div className="transcode-heading">
          <MiniPill tone={statusTone(data.status)} label={data.status} />
          <span>{display(data.message)}</span>
        </div>
        <button className="tool-button" type="button" onClick={onCopyEvidence}>
          <Clipboard size={17} />
          Copy Evidence
        </button>
      </div>
      <dl className="task-detail-grid">
        <div>
          <dt>Task</dt>
          <dd>{display(data.task_id)}</dd>
        </div>
        <div>
          <dt>Bridge</dt>
          <dd>{display(data.bridge_id)}</dd>
        </div>
        <div>
          <dt>Target master</dt>
          <dd>{display(data.target_master_id)}</dd>
        </div>
        <div>
          <dt>Target code</dt>
          <dd>{display(data.target_code)}</dd>
        </div>
      </dl>
    </div>
  );
}

function TaskTable({
  result,
  selectedTaskId,
  onSelect
}: {
  result: ApiResult<PagedResult<MappingReviewTask>> | null;
  selectedTaskId: string;
  onSelect: (task: MappingReviewTask) => void;
}) {
  const rows = result?.data?.items ?? [];

  if (!result) {
    return <EmptyState label="No review task query yet." />;
  }
  if (!result.ok) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  if (!rows.length) {
    return <EmptyState label="No review tasks matched." />;
  }

  return (
    <div className="data-table mapping-review-table" role="table" aria-label="Mapping review tasks">
      <div role="row">
        <span role="columnheader">Task</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Category</span>
        <span role="columnheader">Source</span>
        <span role="columnheader">Key</span>
        <span role="columnheader">Created</span>
        <span role="columnheader">Action</span>
      </div>
      {rows.map((task) => (
        <div role="row" key={task.task_id} className={task.task_id === selectedTaskId ? "selected-row" : ""}>
          <span>{task.task_id}</span>
          <span>
            <MiniPill tone={statusTone(task.status)} label={task.status} />
          </span>
          <span>{display(task.category)}</span>
          <span>{display(task.source_system)}</span>
          <span>{display(task.source_key)}</span>
          <span>{formatDate(task.created_at)}</span>
          <span>
            <button className="table-action" type="button" onClick={() => onSelect(task)}>
              Open
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function ActionResultPanel({
  result,
  onCopyEvidence
}: {
  result: ApiResult<MappingReviewActionResult> | null;
  onCopyEvidence: () => void;
}) {
  if (!result) {
    return <EmptyState label="No review action submitted yet." />;
  }
  if (!result.ok || !result.data) {
    return <EmptyState label={result.error ?? result.message} />;
  }
  return (
    <div className="result-stack">
      <div className="section-toolbar">
        <div className="transcode-heading">
          <MiniPill tone={statusTone(result.data.status)} label={result.data.status} />
          <span>{display(result.data.task_id)}</span>
        </div>
        <button className="tool-button" type="button" onClick={onCopyEvidence}>
          <Clipboard size={17} />
          Copy Evidence
        </button>
      </div>
      <dl className="task-detail-grid">
        <div>
          <dt>Bridge</dt>
          <dd>{display(result.data.bridge_id)}</dd>
        </div>
        <div>
          <dt>Reviewer</dt>
          <dd>{display(result.data.reviewer)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function MappingReviewWorkbench({ client, onApiActivity }: MappingReviewWorkbenchProps) {
  const [category, setCategory] = React.useState("MATERIAL");
  const [sourceSystem, setSourceSystem] = React.useState("SPD");
  const [sourceKey, setSourceKey] = React.useState("");
  const [sourceDesc, setSourceDesc] = React.useState("");
  const [sourceTxId, setSourceTxId] = React.useState("");

  const [statusFilter, setStatusFilter] = React.useState("PENDING");
  const [sourceSystemFilter, setSourceSystemFilter] = React.useState("");
  const [selectedTask, setSelectedTask] = React.useState<MappingReviewTask | null>(null);
  const [targetMasterId, setTargetMasterId] = React.useState("");
  const [targetCode, setTargetCode] = React.useState("");
  const [mappingRule, setMappingRule] = React.useState("MANUAL");
  const [confidence, setConfidence] = React.useState("1");
  const [reviewer, setReviewer] = React.useState("data_admin");
  const [reviewComment, setReviewComment] = React.useState("");

  const [notice, setNotice] = React.useState<string | null>(null);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const [listing, setListing] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [resolveResult, setResolveResult] = React.useState<ApiResult<MappingResolveResult> | null>(null);
  const [listResult, setListResult] = React.useState<ApiResult<PagedResult<MappingReviewTask>> | null>(null);
  const [actionResult, setActionResult] = React.useState<ApiResult<MappingReviewActionResult> | null>(null);

  const recordActivity = (label: string, result: ApiResult<unknown>) => {
    onApiActivity(label, result);
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

  const loadTasks = React.useCallback(async () => {
    setListing(true);
    setNotice(null);
    const result = await client.listMappingReviewTasks({
      status: statusFilter,
      sourceSystem: sourceSystemFilter,
      page: 1,
      pageSize: 20
    });
    setListResult(result);
    recordActivity("GET /api/v1/mapping/review-tasks", result);
    setListing(false);
  }, [client, statusFilter, sourceSystemFilter]);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const resolveMapping = async () => {
    if (!sourceKey.trim()) {
      setNotice("Enter a source key before resolving.");
      return;
    }
    setResolving(true);
    setNotice(null);
    const result = await client.resolveMapping({
      category,
      sourceSystem,
      sourceKey,
      sourceDesc,
      sourceTxId
    });
    setResolveResult(result);
    recordActivity("POST /api/v1/mapping/resolve", result);
    if (result.ok && result.data?.task_id) {
      setSelectedTask({
        task_id: result.data.task_id,
        category,
        source_system: sourceSystem,
        source_key: sourceKey,
        source_desc: sourceDesc,
        status: "PENDING",
        created_at: new Date().toISOString()
      });
      void loadTasks();
    }
    setResolving(false);
  };

  const openTask = (task: MappingReviewTask) => {
    setSelectedTask(task);
    setTargetMasterId("");
    setTargetCode("");
    setReviewComment(task.source_desc ? `Reviewed source: ${task.source_desc}` : "");
    setActionResult(null);
  };

  const approveTask = async () => {
    if (!selectedTask) {
      setNotice("Open a review task before approval.");
      return;
    }
    if (!targetMasterId.trim()) {
      setNotice("Enter target master UUID before approval.");
      return;
    }
    setActing(true);
    setNotice(null);
    const result = await client.approveMappingReviewTask({
      taskId: selectedTask.task_id,
      targetMasterId,
      targetCode,
      mappingRule,
      confidence,
      reviewer,
      reviewComment
    });
    setActionResult(result);
    recordActivity("POST /api/v1/mapping/review-tasks/{task_id}/approve", result);
    if (result.ok) {
      void loadTasks();
    }
    setActing(false);
  };

  const rejectTask = async () => {
    if (!selectedTask) {
      setNotice("Open a review task before rejection.");
      return;
    }
    if (!reviewComment.trim()) {
      setNotice("Review comment is required for rejection.");
      return;
    }
    setActing(true);
    setNotice(null);
    const result = await client.rejectMappingReviewTask({
      taskId: selectedTask.task_id,
      reviewer,
      reviewComment
    });
    setActionResult(result);
    recordActivity("POST /api/v1/mapping/review-tasks/{task_id}/reject", result);
    if (result.ok) {
      void loadTasks();
    }
    setActing(false);
  };

  const copyResolveEvidence = () => {
    if (!resolveResult) {
      return;
    }
    void copyEvidence("mapping resolve", resolveResult, {
      operation: "mapping.resolve",
      params: { category, source_system: sourceSystem, source_key: sourceKey },
      result: resolveResult.data
    });
  };

  const copyListEvidence = () => {
    if (!listResult) {
      return;
    }
    void copyEvidence("mapping review task list", listResult, {
      operation: "mapping.review_tasks.list",
      filters: { status: statusFilter, source_system: sourceSystemFilter },
      page: listResult.data?.page,
      items: (listResult.data?.items ?? []).slice(0, 10).map(sanitizeTask)
    });
  };

  const copyActionEvidence = () => {
    if (!actionResult) {
      return;
    }
    void copyEvidence("mapping review action", actionResult, {
      operation: actionResult.data?.status === "APPROVED" ? "mapping.review.approve" : "mapping.review.reject",
      task: sanitizeTask(selectedTask),
      result: actionResult.data
    });
  };

  return (
    <>
      <section className="panel mapping-review-panel" aria-labelledby="mapping-resolve-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Mapping Bridge</p>
            <h2 id="mapping-resolve-heading">Resolve source code</h2>
          </div>
          <GitPullRequestArrow size={20} />
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

        <form
          className="dictionary-form mapping-review-form"
          onSubmit={(event) => {
            event.preventDefault();
            void resolveMapping();
          }}
        >
          <SelectControl label="Category" value={category} onChange={setCategory} options={categoryOptions} />
          <TextControl label="Source system" value={sourceSystem} onChange={setSourceSystem} />
          <TextControl label="Source key" value={sourceKey} onChange={setSourceKey} />
          <TextControl label="Source desc" value={sourceDesc} onChange={setSourceDesc} />
          <TextControl label="Source TX ID" value={sourceTxId} onChange={setSourceTxId} />
          <button className="action-button" type="submit" disabled={resolving}>
            {resolving ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
            Resolve
          </button>
        </form>

        <ResolveResultPanel result={resolveResult} onCopyEvidence={copyResolveEvidence} />
      </section>

      <section className="panel mapping-review-panel" aria-labelledby="mapping-task-list-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Review Queue</p>
            <h2 id="mapping-task-list-heading">Pending decisions</h2>
          </div>
          <MiniPill tone="neutral" label={`${listResult?.data?.page.total ?? 0} total`} />
        </div>
        <form
          className="dictionary-form mapping-review-form"
          onSubmit={(event) => {
            event.preventDefault();
            void loadTasks();
          }}
        >
          <SelectControl label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          <TextControl label="Source system" value={sourceSystemFilter} onChange={setSourceSystemFilter} />
          <button className="action-button" type="submit" disabled={listing}>
            {listing ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
            Search
          </button>
          <button className="tool-button" type="button" disabled={!listResult} onClick={copyListEvidence}>
            <Clipboard size={17} />
            Copy Evidence
          </button>
        </form>
        <TaskTable result={listResult} selectedTaskId={selectedTask?.task_id ?? ""} onSelect={openTask} />
      </section>

      <section className="panel mapping-review-panel" aria-labelledby="mapping-action-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Decision</p>
            <h2 id="mapping-action-heading">Approve or reject</h2>
          </div>
          {selectedTask ? <MiniPill tone={statusTone(selectedTask.status)} label={selectedTask.status} /> : null}
        </div>

        {selectedTask ? (
          <div className="import-meta">
            <span>Task: {selectedTask.task_id}</span>
            <span>Category: {selectedTask.category}</span>
            <span>Source: {selectedTask.source_system}</span>
            <span>Key: {selectedTask.source_key}</span>
          </div>
        ) : (
          <EmptyState label="Open a review task before submitting a decision." />
        )}

        <div className="dictionary-form mapping-review-form">
          <TextControl label="Target master UUID" value={targetMasterId} onChange={setTargetMasterId} />
          <TextControl label="Target code" value={targetCode} onChange={setTargetCode} />
          <TextControl label="Mapping rule" value={mappingRule} onChange={setMappingRule} />
          <TextControl label="Confidence" value={confidence} onChange={setConfidence} type="number" />
          <TextControl label="Reviewer" value={reviewer} onChange={setReviewer} />
        </div>

        <label className="field">
          <span>Review comment</span>
          <textarea
            value={reviewComment}
            placeholder="Required for rejection"
            onChange={(event) => setReviewComment(event.target.value)}
          />
        </label>

        <div className="button-row">
          <button className="action-button" type="button" disabled={acting || !selectedTask} onClick={approveTask}>
            {acting ? <LoaderCircle size={16} className="spin" /> : <ThumbsUp size={16} />}
            Approve
          </button>
          <button className="tool-button" type="button" disabled={acting || !selectedTask} onClick={rejectTask}>
            {acting ? <LoaderCircle size={16} className="spin" /> : <ThumbsDown size={16} />}
            Reject
          </button>
        </div>

        <ActionResultPanel result={actionResult} onCopyEvidence={copyActionEvidence} />
        <div className="config-note">
          <ShieldCheck size={17} />
          <span>Evidence copies include task ids, status, and reviewer fields without raw source payloads.</span>
        </div>
      </section>
    </>
  );
}
