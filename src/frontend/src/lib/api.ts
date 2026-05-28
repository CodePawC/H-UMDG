import type {
  AdminConfig,
  ApiResult,
  AuthContext,
  DepartmentRow,
  DictionaryCatalogResult,
  DictionaryImportInput,
  DeviceImportHistoryDetail,
  DeviceImportHistoryRecord,
  DeviceClassification,
  DeviceClassificationExportCreateInput,
  DeviceClassificationExportTask,
  DeviceClassificationExportTemplate,
  DeviceClassificationGovernanceDetail,
  DeviceClassificationImportPreview,
  CatalogCorrectionOrder,
  DeviceImpactAnalysis,
  DeviceClassificationRevision,
  EquipmentCategory,
  EquipmentSourceFileList,
  EquipmentStandardName,
  ExchangeLog,
  ExchangeLogDetail,
  HealthStatus,
  HudmpEnvelope,
  ImportArchiveInspection,
  ImportArchiveItem,
  ImportArchiveSubmitResult,
  ImportFileInspection,
  ImportReport,
  ImportTask,
  ImportTaskFailure,
  MappingApproveInput,
  MappingRejectInput,
  MappingResolveInput,
  MappingResolveResult,
  MappingReviewActionResult,
  MappingReviewTask,
  MaterialRow,
  OperatorDirectory,
  PagedResult,
  PermissionMatrix,
  TranscodeResolveResult,
  TreeDataResult,
  UserSession,
  VendorCandidate,
  VendorContact,
  VendorExternalMapping,
  VendorMaster,
  VendorMasterInput,
  VendorQualification,
  VendorRelation,
  VendorRole
} from "../types";
import { clearSession } from "./auth";
import { normalizeBaseUrl } from "./config";

type RequestOptions = {
  method?: string;
  body?: BodyInit | Record<string, unknown>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

type SearchParamsValue = number | string | null | undefined;

type DepartmentSearchParams = {
  keyword?: string;
  sourceBatchId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

type MaterialSearchParams = DepartmentSearchParams & {
  ybCode27?: string;
  regNumber?: string;
};

type EquipmentSearchParams = {
  keyword?: string;
  status?: string;
  includeHidden?: boolean;
  categoryId?: string;
  managementClass?: string;
  page?: number;
  pageSize?: number;
};

type TranscodeSearchParams = {
  originalYbCode27: string;
  batchId?: string;
  changeType?: string;
  page?: number;
  pageSize?: number;
};

type ImportTaskListParams = {
  status?: string;
  sourceType?: string;
  page?: number;
  pageSize?: number;
};

type MappingReviewListParams = {
  status?: string;
  sourceSystem?: string;
  page?: number;
  pageSize?: number;
};

type ExchangeLogListParams = {
  sourceSystem?: string;
  status?: string;
  dataCategory?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
};

type VendorListParams = {
  keyword?: string;
  roleType?: string;
  businessDomain?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

type VendorCandidateListParams = {
  matchStatus?: string;
  sourceSystem?: string;
  page?: number;
  pageSize?: number;
};

function isEnvelope(value: unknown): value is HudmpEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    "code" in value &&
    "message" in value
  );
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildQuery(params: Record<string, SearchParamsValue>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value).trim());
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function appendOptional(formData: FormData, key: string, value?: string): void {
  const normalized = value?.trim();
  if (normalized) {
    formData.set(key, normalized);
  }
}

function buildImportForm(input: DictionaryImportInput): FormData {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("source_system", input.sourceSystem.trim() || "MVP");
  appendOptional(formData, "source_tx_id", input.sourceTxId);
  appendOptional(formData, "sheet_name", input.sheetName);
  appendOptional(formData, "source_type", input.sourceType);
  appendOptional(formData, "import_reason", input.importReason);
  appendOptional(formData, "source_file_name", input.sourceFileName);
  appendOptional(formData, "file_type", input.fileType);
  appendOptional(formData, "source_link", input.sourceLink);
  appendOptional(formData, "publish_date", input.publishDate);
  appendOptional(formData, "effective_date", input.effectiveDate);
  appendOptional(formData, "authoritative", input.authoritative);
  appendOptional(formData, "import_mode", input.importMode);
  appendOptional(formData, "batch_name", input.batchName);
  appendOptional(formData, "scope", input.scope);
  appendOptional(formData, "authority_level", input.authorityLevel);
  appendOptional(formData, "operator_name", input.operatorName);
  appendOptional(formData, "remark", input.remark);
  return formData;
}

function shouldResetSession(result: ApiResult<unknown>): boolean {
  return result.httpStatus === 401 && (result.code === "SESSION_EXPIRED" || result.code === "SESSION_INVALID");
}

function notifySessionReset(message: string): void {
  clearSession();
  window.dispatchEvent(new CustomEvent("hudmp:session-reset", { detail: { message } }));
}

function buildArchiveInspectForm(file: File): FormData {
  const formData = new FormData();
  formData.set("file", file);
  return formData;
}

function buildArchiveSubmitForm(input: {
  archiveId: string;
  archiveFileName: string;
  sourceSystem: string;
  sourceTxId?: string;
  items: ImportArchiveItem[];
}): FormData {
  const formData = new FormData();
  formData.set("archive_id", input.archiveId);
  formData.set("archive_file_name", input.archiveFileName);
  formData.set("source_system", input.sourceSystem.trim() || "MVP");
  appendOptional(formData, "source_tx_id", input.sourceTxId);
  formData.set(
    "items",
    JSON.stringify(
      input.items.map((item) => ({
        entry_path: item.entry_path,
        source_type: item.source_type,
        sheet_name: item.sheet_name
      }))
    )
  );
  return formData;
}

export class HudmpApiClient {
  constructor(private readonly config: AdminConfig, private readonly session: UserSession | null = null) {}

  async health(signal?: AbortSignal): Promise<ApiResult<HealthStatus>> {
    return this.request<HealthStatus>("/health", { signal }, { publicEndpoint: true });
  }

  async login(username: string, password: string): Promise<ApiResult<AuthContext>> {
    return this.request<AuthContext>(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: {
          username,
          password
        }
      },
      { publicEndpoint: true }
    );
  }

  async currentOperator(): Promise<ApiResult<AuthContext>> {
    return this.request<AuthContext>("/api/v1/auth/me");
  }

  async permissionMatrix(): Promise<ApiResult<PermissionMatrix>> {
    return this.request<PermissionMatrix>("/api/v1/auth/permissions");
  }

  async operatorDirectory(): Promise<ApiResult<OperatorDirectory>> {
    return this.request<OperatorDirectory>("/api/v1/auth/operators");
  }

  async dictionaryCatalog(): Promise<ApiResult<DictionaryCatalogResult>> {
    return this.request<DictionaryCatalogResult>("/api/v1/dictionaries/catalog");
  }

  async searchDepartments(params: DepartmentSearchParams = {}): Promise<ApiResult<PagedResult<DepartmentRow>>> {
    const query = buildQuery({
      keyword: params.keyword,
      source_batch_id: params.sourceBatchId,
      status: params.status,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<DepartmentRow>>(`/api/v1/departments/search${query}`);
  }

  async importDepartments(input: DictionaryImportInput): Promise<ApiResult<ImportReport>> {
    return this.request<ImportReport>("/api/v1/departments/import", {
      method: "POST",
      body: buildImportForm(input)
    });
  }

  async syncStandardDepartments(): Promise<ApiResult<ImportReport>> {
    return this.request<ImportReport>("/api/v1/departments/standard-library/sync", {
      method: "POST",
      body: {}
    });
  }

  async updateDepartmentStatus(deptCode: string, status: "ACTIVE" | "INACTIVE"): Promise<ApiResult<DepartmentRow>> {
    return this.request<DepartmentRow>(`/api/v1/departments/${encodeURIComponent(deptCode)}/status`, {
      method: "PATCH",
      body: { status }
    });
  }

  async inspectDepartmentImportFile(input: DictionaryImportInput): Promise<ApiResult<ImportFileInspection>> {
    return this.request<ImportFileInspection>("/api/v1/departments/import/inspect", {
      method: "POST",
      body: buildImportForm(input)
    });
  }

  async searchMaterials(params: MaterialSearchParams = {}): Promise<ApiResult<PagedResult<MaterialRow>>> {
    const query = buildQuery({
      keyword: params.keyword,
      yb_code_27: params.ybCode27,
      reg_number: params.regNumber,
      source_batch_id: params.sourceBatchId,
      status: params.status,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<MaterialRow>>(`/api/v1/materials/search${query}`);
  }

  async importMaterials(input: DictionaryImportInput): Promise<ApiResult<ImportReport>> {
    return this.request<ImportReport>("/api/v1/materials/import", {
      method: "POST",
      body: buildImportForm(input)
    });
  }

  async inspectMaterialImportFile(input: DictionaryImportInput): Promise<ApiResult<ImportFileInspection>> {
    return this.request<ImportFileInspection>("/api/v1/materials/import/inspect", {
      method: "POST",
      body: buildImportForm(input)
    });
  }

  async resolveMaterialTranscode(params: TranscodeSearchParams): Promise<ApiResult<TranscodeResolveResult>> {
    const query = buildQuery({
      original_yb_code_27: params.originalYbCode27,
      batch_id: params.batchId,
      change_type: params.changeType,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<TranscodeResolveResult>(`/api/v1/materials/transcode/resolve${query}`);
  }

  async listEquipmentCategories(params: EquipmentSearchParams = {}): Promise<ApiResult<PagedResult<EquipmentCategory>>> {
    const query = buildQuery({
      keyword: params.keyword,
      status: params.status,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<EquipmentCategory>>(`/api/v1/equipment/categories${query}`);
  }

  async listEquipmentCategoryTreeData(params: EquipmentSearchParams = {}): Promise<ApiResult<TreeDataResult<EquipmentCategory>>> {
    const query = buildQuery({
      keyword: params.keyword,
      status: params.status,
      limit: 5000
    });
    return this.request<TreeDataResult<EquipmentCategory>>(`/api/v1/equipment/categories/tree-data${query}`);
  }

  async listEquipmentStandardNames(
    params: EquipmentSearchParams = {}
  ): Promise<ApiResult<PagedResult<EquipmentStandardName>>> {
    const query = buildQuery({
      keyword: params.keyword,
      category_id: params.categoryId,
      status: params.status,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<EquipmentStandardName>>(`/api/v1/equipment/standard-names${query}`);
  }

  async listDeviceClassifications(
    params: EquipmentSearchParams = {}
  ): Promise<ApiResult<PagedResult<DeviceClassification>>> {
    const query = buildQuery({
      keyword: params.keyword,
      management_class: params.managementClass,
      data_status: params.status,
      include_hidden: params.includeHidden ? "true" : undefined,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<DeviceClassification>>(`/api/v1/equipment/device-classifications${query}`);
  }

  async listDeviceClassificationTreeData(
    params: EquipmentSearchParams = {}
  ): Promise<ApiResult<TreeDataResult<DeviceClassification>>> {
    const query = buildQuery({
      keyword: params.keyword,
      management_class: params.managementClass,
      data_status: params.status,
      include_hidden: params.includeHidden ? "true" : undefined,
      limit: 5000
    });
    return this.request<TreeDataResult<DeviceClassification>>(`/api/v1/equipment/device-classifications/tree-data${query}`);
  }

  async listDeviceClassificationRevisions(params: { catalogId?: string; batchId?: string; limit?: number } = {}): Promise<ApiResult<TreeDataResult<DeviceClassificationRevision>>> {
    const query = buildQuery({
      catalog_id: params.catalogId,
      batch_id: params.batchId,
      limit: params.limit ?? 200
    });
    return this.request<TreeDataResult<DeviceClassificationRevision>>(`/api/v1/equipment/device-classifications/revisions${query}`);
  }

  async listInvalidDeviceClassificationCandidates(limit = 500): Promise<ApiResult<{ items: DeviceClassification[]; total: number }>> {
    const query = buildQuery({ limit });
    return this.request<{ items: DeviceClassification[]; total: number }>(`/api/v1/equipment/device-classifications/invalid-candidates${query}`);
  }

  async purgeInvalidDeviceClassificationCandidates(): Promise<ApiResult<{ marked_count: number }>> {
    return this.request<{ marked_count: number }>(
      "/api/v1/equipment/device-classifications/invalid-candidates",
      { method: "DELETE" }
    );
  }

  async getDeviceClassificationGovernance(catalogId: string): Promise<ApiResult<DeviceClassificationGovernanceDetail>> {
    return this.request<DeviceClassificationGovernanceDetail>(`/api/v1/equipment/device-classifications/${encodeURIComponent(catalogId)}/governance`);
  }

  async getDeviceClassificationImpact(catalogId: string): Promise<ApiResult<DeviceImpactAnalysis>> {
    return this.request<DeviceImpactAnalysis>(`/api/v1/equipment/device-classifications/${encodeURIComponent(catalogId)}/impact-analysis`);
  }

  async createDeviceClassificationCorrection(catalogId: string, payload: Record<string, unknown>): Promise<ApiResult<CatalogCorrectionOrder>> {
    return this.request<CatalogCorrectionOrder>(`/api/v1/equipment/device-classifications/${encodeURIComponent(catalogId)}/corrections`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async listDeviceClassificationCorrections(params: Record<string, SearchParamsValue> = {}): Promise<ApiResult<{ items: CatalogCorrectionOrder[]; total: number }>> {
    const query = buildQuery(params);
    return this.request<{ items: CatalogCorrectionOrder[]; total: number }>(`/api/v1/equipment/device-classifications/corrections${query}`);
  }

  async listDeviceClassificationExportTemplates(): Promise<ApiResult<{ items: DeviceClassificationExportTemplate[] }>> {
    return this.request<{ items: DeviceClassificationExportTemplate[] }>("/api/v1/equipment/device-classifications/export/templates");
  }

  async estimateDeviceClassificationExport(input: Partial<DeviceClassificationExportCreateInput>): Promise<ApiResult<{ estimated_count: number }>> {
    return this.request<{ estimated_count: number }>("/api/v1/equipment/device-classifications/export/estimate", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async listDeviceClassificationExportTasks(): Promise<ApiResult<{ items: DeviceClassificationExportTask[]; total: number }>> {
    return this.request<{ items: DeviceClassificationExportTask[]; total: number }>("/api/v1/equipment/device-classifications/export/tasks");
  }

  async createDeviceClassificationExportTask(input: DeviceClassificationExportCreateInput): Promise<ApiResult<DeviceClassificationExportTask>> {
    return this.request<DeviceClassificationExportTask>("/api/v1/equipment/device-classifications/export/tasks", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async downloadDeviceClassificationExportTask(taskNo: string): Promise<ApiResult<Blob>> {
    const baseUrl = normalizeBaseUrl(this.config.apiBaseUrl);
    const headers = new Headers();
    if (this.session?.sessionToken) {
      headers.set("X-Session-Token", this.session.sessionToken);
    } else if (this.config.apiKey) {
      headers.set("X-API-Key", this.config.apiKey);
    }
    if (this.session && !this.session.sessionToken) {
      headers.set("X-Operator-Name", this.session.username);
      headers.set("X-Operator-Role", this.session.role);
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/equipment/device-classifications/export/tasks/${encodeURIComponent(taskNo)}/download`, {
        headers
      });
      if (!response.ok) {
        return {
          ok: false,
          httpStatus: response.status,
          message: `HTTP ${response.status}`,
          error: response.statusText
        };
      }
      return {
        ok: true,
        httpStatus: response.status,
        message: "OK",
        data: await response.blob()
      };
    } catch (error) {
      return {
        ok: false,
        httpStatus: 0,
        message: error instanceof Error ? error.message : "Network error",
        error: String(error)
      };
    }
  }

  async executeDeviceClassificationCorrection(correctionId: string): Promise<ApiResult<CatalogCorrectionOrder>> {
    return this.request<CatalogCorrectionOrder>(`/api/v1/equipment/device-classifications/corrections/${encodeURIComponent(correctionId)}/execute`, {
      method: "POST"
    });
  }

  async approveDeviceClassificationCorrection(correctionId: string): Promise<ApiResult<CatalogCorrectionOrder>> {
    return this.request<CatalogCorrectionOrder>(`/api/v1/equipment/device-classifications/corrections/${encodeURIComponent(correctionId)}/approve`, {
      method: "POST"
    });
  }

  async rejectDeviceClassificationCorrection(correctionId: string): Promise<ApiResult<CatalogCorrectionOrder>> {
    return this.request<CatalogCorrectionOrder>(`/api/v1/equipment/device-classifications/corrections/${encodeURIComponent(correctionId)}/reject`, {
      method: "POST"
    });
  }

  async importEquipmentDictionary(input: DictionaryImportInput): Promise<ApiResult<ImportReport>> {
    return this.request<ImportReport>("/api/v1/equipment/import", {
      method: "POST",
      body: buildImportForm(input)
    });
  }

  async previewDeviceClassificationImport(input: DictionaryImportInput): Promise<ApiResult<DeviceClassificationImportPreview>> {
    return this.request<DeviceClassificationImportPreview>("/api/v1/equipment/device-classifications/import/preview", {
      method: "POST",
      body: buildImportForm({ ...input, sourceType: "DEVICE_CLASSIFICATION_CATALOG" })
    });
  }

  async listDeviceClassificationImportHistory(): Promise<ApiResult<{ items: DeviceImportHistoryRecord[] }>> {
    return this.request<{ items: DeviceImportHistoryRecord[] }>("/api/v1/equipment/device-classifications/import/history");
  }

  async getDeviceClassificationImportHistory(batchId: string): Promise<ApiResult<DeviceImportHistoryDetail>> {
    return this.request<DeviceImportHistoryDetail>(`/api/v1/equipment/device-classifications/import/history/${encodeURIComponent(batchId)}`);
  }

  async listEquipmentSourceFiles(): Promise<ApiResult<EquipmentSourceFileList>> {
    return this.request<EquipmentSourceFileList>("/api/v1/equipment/source-files");
  }

  async downloadEquipmentSourceFile(batchId: string): Promise<ApiResult<Blob>> {
    const baseUrl = normalizeBaseUrl(this.config.apiBaseUrl);
    const headers = new Headers();
    if (this.session?.sessionToken) {
      headers.set("X-Session-Token", this.session.sessionToken);
    } else if (this.config.apiKey) {
      headers.set("X-API-Key", this.config.apiKey);
    }
    if (this.session && !this.session.sessionToken) {
      headers.set("X-Operator-Name", this.session.username);
      headers.set("X-Operator-Role", this.session.role);
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/equipment/source-files/${encodeURIComponent(batchId)}/download`, {
        headers
      });
      if (!response.ok) {
        return {
          ok: false,
          httpStatus: response.status,
          message: `HTTP ${response.status}`,
          error: response.statusText
        };
      }
      return {
        ok: true,
        httpStatus: response.status,
        message: "OK",
        data: await response.blob()
      };
    } catch (error) {
      return {
        ok: false,
        httpStatus: 0,
        message: error instanceof Error ? error.message : "Network error",
        error: String(error)
      };
    }
  }

  async downloadDeviceClassificationSourceFile(catalogId: string): Promise<ApiResult<Blob>> {
    const baseUrl = normalizeBaseUrl(this.config.apiBaseUrl);
    const headers = new Headers();
    if (this.session?.sessionToken) {
      headers.set("X-Session-Token", this.session.sessionToken);
    } else if (this.config.apiKey) {
      headers.set("X-API-Key", this.config.apiKey);
    }
    if (this.session && !this.session.sessionToken) {
      headers.set("X-Operator-Name", this.session.username);
      headers.set("X-Operator-Role", this.session.role);
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/equipment/device-classifications/${encodeURIComponent(catalogId)}/source-file/download`, {
        headers
      });
      if (!response.ok) {
        return {
          ok: false,
          httpStatus: response.status,
          message: `HTTP ${response.status}`,
          error: response.statusText
        };
      }
      return {
        ok: true,
        httpStatus: response.status,
        message: "OK",
        data: await response.blob()
      };
    } catch (error) {
      return {
        ok: false,
        httpStatus: 0,
        message: error instanceof Error ? error.message : "Network error",
        error: String(error)
      };
    }
  }

  async createMaterialImportTask(input: DictionaryImportInput): Promise<ApiResult<ImportTask>> {
    return this.request<ImportTask>("/api/v1/import-tasks/materials", {
      method: "POST",
      body: buildImportForm(input)
    });
  }

  async inspectMaterialImportArchive(file: File): Promise<ApiResult<ImportArchiveInspection>> {
    return this.request<ImportArchiveInspection>("/api/v1/import-tasks/materials/archive/inspect", {
      method: "POST",
      body: buildArchiveInspectForm(file)
    });
  }

  async createMaterialImportArchiveTasks(input: {
    archiveId: string;
    archiveFileName: string;
    sourceSystem: string;
    sourceTxId?: string;
    items: ImportArchiveItem[];
  }): Promise<ApiResult<ImportArchiveSubmitResult>> {
    return this.request<ImportArchiveSubmitResult>("/api/v1/import-tasks/materials/archive", {
      method: "POST",
      body: buildArchiveSubmitForm(input)
    });
  }

  async listImportTasks(params: ImportTaskListParams = {}): Promise<ApiResult<PagedResult<ImportTask>>> {
    const query = buildQuery({
      status: params.status,
      source_type: params.sourceType,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<ImportTask>>(`/api/v1/import-tasks${query}`);
  }

  async getImportTask(batchId: string): Promise<ApiResult<ImportTask>> {
    return this.request<ImportTask>(`/api/v1/import-tasks/${encodeURIComponent(batchId)}`);
  }

  async listImportTaskFailures(
    batchId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<ApiResult<PagedResult<ImportTaskFailure>>> {
    const query = buildQuery({
      page: params.page ?? 1,
      page_size: params.pageSize ?? 50
    });
    return this.request<PagedResult<ImportTaskFailure>>(
      `/api/v1/import-tasks/${encodeURIComponent(batchId)}/failures${query}`
    );
  }

  async resolveMapping(input: MappingResolveInput): Promise<ApiResult<MappingResolveResult>> {
    return this.request<MappingResolveResult>("/api/v1/mapping/resolve", {
      method: "POST",
      body: {
        category: input.category,
        source_system: input.sourceSystem,
        source_key: input.sourceKey,
        source_desc: input.sourceDesc?.trim() || null,
        source_tx_id: input.sourceTxId?.trim() || null
      }
    });
  }

  async listMappingReviewTasks(
    params: MappingReviewListParams = {}
  ): Promise<ApiResult<PagedResult<MappingReviewTask>>> {
    const query = buildQuery({
      status: params.status,
      source_system: params.sourceSystem,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<MappingReviewTask>>(`/api/v1/mapping/review-tasks${query}`);
  }

  async approveMappingReviewTask(input: MappingApproveInput): Promise<ApiResult<MappingReviewActionResult>> {
    const confidence = input.confidence?.trim();
    return this.request<MappingReviewActionResult>(
      `/api/v1/mapping/review-tasks/${encodeURIComponent(input.taskId)}/approve`,
      {
        method: "POST",
        body: {
          target_master_id: input.targetMasterId,
          target_code: input.targetCode?.trim() || null,
          mapping_rule: input.mappingRule?.trim() || "MANUAL",
          confidence: confidence ? Number(confidence) : null,
          reviewer: input.reviewer,
          review_comment: input.reviewComment?.trim() || null
        }
      }
    );
  }

  async rejectMappingReviewTask(input: MappingRejectInput): Promise<ApiResult<MappingReviewActionResult>> {
    return this.request<MappingReviewActionResult>(
      `/api/v1/mapping/review-tasks/${encodeURIComponent(input.taskId)}/reject`,
      {
        method: "POST",
        body: {
          reviewer: input.reviewer,
          review_comment: input.reviewComment
        }
      }
    );
  }

  async listExchangeLogs(params: ExchangeLogListParams = {}): Promise<ApiResult<PagedResult<ExchangeLog>>> {
    const query = buildQuery({
      source_system: params.sourceSystem,
      status: params.status,
      data_category: params.dataCategory,
      start_time: params.startTime,
      end_time: params.endTime,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<ExchangeLog>>(`/api/v1/exchange/logs${query}`);
  }

  async getExchangeLog(logId: number): Promise<ApiResult<ExchangeLogDetail>> {
    return this.request<ExchangeLogDetail>(`/api/v1/exchange/logs/${encodeURIComponent(logId)}`);
  }

  async listManufacturerVendors(params: VendorListParams = {}): Promise<ApiResult<PagedResult<VendorMaster>>> {
    const query = buildQuery({
      keyword: params.keyword,
      role_type: params.roleType,
      business_domain: params.businessDomain,
      status: params.status,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<VendorMaster>>(`/api/v1/manufacturer-vendors${query}`);
  }

  async createManufacturerVendor(input: VendorMasterInput): Promise<ApiResult<VendorMaster>> {
    return this.request<VendorMaster>("/api/v1/manufacturer-vendors", {
      method: "POST",
      body: input
    });
  }

  async updateManufacturerVendor(id: string, input: VendorMasterInput): Promise<ApiResult<VendorMaster>> {
    return this.request<VendorMaster>(`/api/v1/manufacturer-vendors/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input
    });
  }

  async getManufacturerVendor(id: string): Promise<ApiResult<VendorMaster>> {
    return this.request<VendorMaster>(`/api/v1/manufacturer-vendors/${encodeURIComponent(id)}`);
  }

  async updateManufacturerVendorStatus(id: string, status: string): Promise<ApiResult<VendorMaster>> {
    return this.request<VendorMaster>(`/api/v1/manufacturer-vendors/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status }
    });
  }

  async submitManufacturerVendor(id: string): Promise<ApiResult<VendorMaster>> {
    return this.request<VendorMaster>(`/api/v1/manufacturer-vendors/${encodeURIComponent(id)}/submit`, {
      method: "POST",
      body: {}
    });
  }

  async auditManufacturerVendor(id: string, auditStatus: string): Promise<ApiResult<VendorMaster>> {
    return this.request<VendorMaster>(`/api/v1/manufacturer-vendors/${encodeURIComponent(id)}/audit`, {
      method: "POST",
      body: { audit_status: auditStatus }
    });
  }

  async addManufacturerVendorRole(
    id: string,
    input: { role_type: string; role_name?: string; business_domain: string; status?: string; qualification_required?: boolean; remark?: string }
  ): Promise<ApiResult<VendorRole>> {
    return this.request<VendorRole>(`/api/v1/manufacturer-vendors/${encodeURIComponent(id)}/roles`, {
      method: "POST",
      body: input
    });
  }

  async addBusinessPartnerQualification(
    id: string,
    input: {
      qualification_type: string;
      certificate_no?: string;
      certificate_name?: string;
      issuing_authority?: string;
      valid_from?: string;
      valid_to?: string;
      status?: string;
      remark?: string;
    }
  ): Promise<ApiResult<VendorQualification>> {
    return this.request<VendorQualification>(`/api/v1/business-partners/${encodeURIComponent(id)}/qualifications`, {
      method: "POST",
      body: input
    });
  }

  async addBusinessPartnerContact(
    id: string,
    input: {
      contact_name: string;
      department?: string;
      position?: string;
      phone?: string;
      mobile?: string;
      email?: string;
      contact_type?: string;
      is_primary?: boolean;
      status?: string;
      remark?: string;
    }
  ): Promise<ApiResult<VendorContact>> {
    return this.request<VendorContact>(`/api/v1/business-partners/${encodeURIComponent(id)}/contacts`, {
      method: "POST",
      body: input
    });
  }

  async addManufacturerVendorMapping(
    id: string,
    input: { system_name: string; external_code?: string; external_name?: string; confidence?: number; audit_status?: string }
  ): Promise<ApiResult<VendorExternalMapping>> {
    return this.request<VendorExternalMapping>(`/api/v1/manufacturer-vendors/${encodeURIComponent(id)}/external-mappings`, {
      method: "POST",
      body: input
    });
  }

  async addManufacturerVendorRelation(input: {
    parent_org_id: string;
    child_org_id: string;
    relation_type: string;
    relation_name?: string;
    effective_date?: string;
    expired_date?: string;
  }): Promise<ApiResult<VendorRelation>> {
    return this.request<VendorRelation>("/api/v1/manufacturer-vendor-relations", {
      method: "POST",
      body: input
    });
  }

  async listManufacturerVendorCandidates(
    params: VendorCandidateListParams = {}
  ): Promise<ApiResult<PagedResult<VendorCandidate>>> {
    const query = buildQuery({
      match_status: params.matchStatus,
      source_system: params.sourceSystem,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20
    });
    return this.request<PagedResult<VendorCandidate>>(`/api/v1/manufacturer-vendor-candidates${query}`);
  }

  async mapManufacturerVendorCandidate(candidateId: string, orgId: string): Promise<ApiResult<VendorCandidate>> {
    return this.request<VendorCandidate>(`/api/v1/manufacturer-vendor-candidates/${encodeURIComponent(candidateId)}/map`, {
      method: "POST",
      body: { org_id: orgId, reviewer: "data_admin" }
    });
  }

  async mergeManufacturerVendorCandidate(candidateId: string, orgId: string): Promise<ApiResult<VendorCandidate>> {
    return this.request<VendorCandidate>(`/api/v1/manufacturer-vendor-candidates/${encodeURIComponent(candidateId)}/merge`, {
      method: "POST",
      body: { org_id: orgId, reviewer: "data_admin" }
    });
  }

  async batchReviewManufacturerVendorCandidates(
    actions: Array<{ candidate_id: string; action: "map_existing" | "merge" | "ignore"; org_id?: string }>
  ): Promise<ApiResult<{ items: Array<{ candidate_id: string; action: string; status: string }> }>> {
    return this.request<{ items: Array<{ candidate_id: string; action: string; status: string }> }>(
      "/api/v1/manufacturer-vendor-candidates/batch",
      {
        method: "POST",
        body: { actions: actions.map((item) => ({ reviewer: "data_admin", ...item })) }
      }
    );
  }

  async createManufacturerVendorFromCandidate(
    candidateId: string,
    input: { vendor?: VendorMasterInput; roles?: Array<{ role_type: string; business_domain: string }> }
  ): Promise<ApiResult<{ vendor: VendorMaster; candidate: VendorCandidate }>> {
    return this.request<{ vendor: VendorMaster; candidate: VendorCandidate }>(
      `/api/v1/manufacturer-vendor-candidates/${encodeURIComponent(candidateId)}/create-vendor`,
      {
        method: "POST",
        body: { reviewer: "data_admin", ...input }
      }
    );
  }

  async ignoreManufacturerVendorCandidate(candidateId: string): Promise<ApiResult<VendorCandidate>> {
    return this.request<VendorCandidate>(
      `/api/v1/manufacturer-vendor-candidates/${encodeURIComponent(candidateId)}/ignore`,
      {
        method: "POST",
        body: { reviewer: "data_admin" }
      }
    );
  }

  async request<T>(
    path: string,
    options: RequestOptions = {},
    settings: { publicEndpoint?: boolean } = {}
  ): Promise<ApiResult<T>> {
    const baseUrl = normalizeBaseUrl(this.config.apiBaseUrl);
    const headers = new Headers(options.headers);

    if (!settings.publicEndpoint && this.session?.sessionToken) {
      headers.set("X-Session-Token", this.session.sessionToken);
    } else if (!settings.publicEndpoint && this.config.apiKey) {
      headers.set("X-API-Key", this.config.apiKey);
    }
    if (!settings.publicEndpoint && this.session && !this.session.sessionToken) {
      headers.set("X-Operator-Name", this.session.username);
      headers.set("X-Operator-Role", this.session.role);
    }
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const body =
      options.body && !(options.body instanceof FormData) && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body;

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body,
        signal: options.signal
      });
      const payload = await parseJson(response);

      if (isEnvelope(payload)) {
        const result = {
          ok: response.ok && payload.success,
          httpStatus: response.status,
          traceId: payload.trace_id,
          code: payload.code,
          message: payload.message,
          data: payload.data as T | null,
          raw: payload
        };
        if (shouldResetSession(result)) {
          notifySessionReset(result.message);
        }
        return result;
      }

      return {
        ok: response.ok,
        httpStatus: response.status,
        message: response.ok ? "OK" : response.statusText,
        data: payload as T,
        raw: payload
      };
    } catch (error) {
      return {
        ok: false,
        httpStatus: 0,
        message: "Request failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
