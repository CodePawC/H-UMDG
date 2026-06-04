export type HealthStatus = {
  status?: string;
  service?: string;
  database?: string;
  redis?: string;
  version?: string;
};

export type HudmpEnvelope<T = unknown> = {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
  details?: unknown;
  trace_id?: string;
};

export type ApiResult<T = unknown> = {
  ok: boolean;
  httpStatus: number;
  traceId?: string;
  code?: string;
  message: string;
  data?: T | null;
  raw?: unknown;
  error?: string;
};

export type PageMeta = {
  page: number;
  page_size: number;
  total: number;
};

export type PagedResult<T> = {
  items: T[];
  page: PageMeta;
};

export type DepartmentRow = {
  dept_id: string;
  dept_code: string;
  dept_name: string;
  dept_alias?: string | null;
  parent_dept_id?: string | null;
  dept_type?: string | null;
  oid?: string | null;
  status: string;
  source_batch_id?: string | null;
  standard_source?: string | null;
  standard_version?: string | null;
  standard_scope?: string | null;
  maintenance_mode?: string | null;
};

export type MaterialRow = {
  material_id: string;
  manufacturer_org_id?: string | null;
  registrant_org_id?: string | null;
  filer_org_id?: string | null;
  yb_code_27?: string | null;
  yb_code_20?: string | null;
  goods_id?: string | null;
  udi?: string | null;
  original_yb_code_27?: string | null;
  original_code_status?: string | null;
  code_change_type?: string | null;
  generic_name?: string | null;
  brand_name?: string | null;
  cat_level_1?: string | null;
  cat_level_2?: string | null;
  cat_level_3?: string | null;
  material_attr?: string | null;
  feature?: string | null;
  spec_value?: string | null;
  spec_unit?: string | null;
  model_detail?: string | null;
  reg_number?: string | null;
  insurance_generic_name_code?: string | null;
  insurance_generic_name?: string | null;
  status: string;
  source_batch_id?: string | null;
  updated_at?: string | null;
};

export type MaterialCategoryStatistic = {
  name: string;
  count: number;
};

export type MaterialCategoryTreeNode = {
  key: string;
  level: 1 | 2 | 3;
  name: string;
  title: string;
  count: number;
  cat_level_1?: string | null;
  cat_level_2?: string | null;
  cat_level_3?: string | null;
  children: MaterialCategoryTreeNode[];
};

export type MaterialCategoryTreeResult = {
  items: MaterialCategoryTreeNode[];
  total_count: number;
};

export type MaterialImportBatchSummary = {
  batch_id: string;
  source_type: string;
  source_system?: string | null;
  source_file_name?: string | null;
  sheet_name?: string | null;
  status: string;
  source_row_count: number;
  unique_key_count: number;
  success_count: number;
  failed_count: number;
  skipped_duplicate_count?: number;
  created_at?: string | null;
  finished_at?: string | null;
};

export type MaterialStatistics = {
  total_count: number;
  active_count: number;
  inactive_count: number;
  status_counts: Record<string, number>;
  top_categories: MaterialCategoryStatistic[];
  full_spec_staging_count: number;
  full_spec_master_count?: number;
  disabled_staging_count: number;
  disabled_applied_count: number;
  disabled_unmatched_count: number;
  transcode_staging_count: number;
  transcode_old_deprecated_count: number;
  transcode_new_linked_count: number;
  transcode_applied_count: number;
  transcode_unresolved_count: number;
  latest_batches: MaterialImportBatchSummary[];
};

export type MaterialConsistency = {
  source_type: string;
  batch?: MaterialImportBatchSummary | null;
  batch_id?: string | null;
  status: "CONSISTENT" | "NEEDS_ATTENTION" | string;
  source_row_count?: number | null;
  import_success_count?: number | null;
  staging_row_count?: number;
  staging_unique_key_count?: number;
  master_row_count?: number;
  master_unique_key_count?: number;
  missing_master_count?: number;
  missing_master_samples?: string[];
  applied_to_master_count?: number;
  unapplied_count?: number;
  unresolved_count?: number;
};

export type MaterialSourceRuleApplyResult = {
  status: string;
  disabled_batch_id?: string | null;
  transcode_batch_id?: string | null;
  disabled: Record<string, number>;
  transcode: Record<string, number>;
  summary?: Partial<MaterialStatistics>;
};

export type DictionaryCatalogField = {
  name: string;
  label: string;
  required: boolean;
  type: string;
  description: string;
  example?: string;
};

export type DictionaryCatalogItem = {
  dictionary_key: string;
  name: string;
  domain: string;
  status: "AVAILABLE" | "BLUEPRINT";
  purpose: string;
  maintenance_modes: string[];
  key_fields: DictionaryCatalogField[];
  optional_fields: DictionaryCatalogField[];
  api_endpoints: string[];
  implementation_note?: string;
  candidate_source?: string;
  curation_policy?: string;
  reference_records?: Array<Record<string, unknown>>;
};

export type DictionaryCatalogResult = {
  items: DictionaryCatalogItem[];
  summary: {
    total: number;
    available_count: number;
    blueprint_count: number;
  };
};

export type ImportFailure = {
  row?: number | null;
  row_number?: number | null;
  field?: string | null;
  field_name?: string | null;
  message?: string | null;
  raw_payload?: unknown;
};

export type ImportReport = {
  batch_id: string;
  source_type?: string | null;
  source_system?: string | null;
  source_file_name?: string | null;
  sheet_name?: string | null;
  source_row_count?: number;
  unique_key_count?: number;
  skipped_duplicate_count?: number;
  success_count: number;
  failed_count: number;
  duplicate_count?: number;
  disabled_count?: number;
  disabled_master_target_count?: number;
  disabled_master_applied_count?: number;
  disabled_master_unmatched_count?: number;
  transcoded_count?: number;
  changed_count?: number;
  mapped_count?: number;
  old_code_deprecated_count?: number;
  new_code_linked_count?: number;
  transcode_master_target_count?: number;
  transcode_master_applied_count?: number;
  transcode_master_unresolved_count?: number;
  old_code_not_found_count?: number;
  new_code_not_found_count?: number;
  retained_count?: number;
  failures?: ImportFailure[];
  source_file?: EquipmentSourceFile | null;
  catalog_version?: string;
  validation_report_status?: string;
  audit_log_status?: string;
  rollback_supported?: boolean;
};

export type TreeDataResult<T> = {
  items: T[];
  total: number;
  revision_summary?: DeviceRevisionSummary | null;
};

export type DeviceRevisionSummary = {
  revision_count: number;
  revised_item_count: number;
  added_count: number;
  modified_count: number;
  deleted_count: number;
  last_updated_at?: string | null;
};

export type DeviceClassificationPayload = {
  major_category_no?: string | null;
  major_category_name?: string | null;
  level_1_category_no?: string | null;
  level_1_category?: string | null;
  level_2_category_no?: string | null;
  level_2_category?: string | null;
  product_description?: string | null;
  intended_use?: string | null;
  product_examples?: string | null;
  management_class?: string | null;
};

export type DeviceClassificationPreviewRow = DeviceClassificationPayload & {
  staging_id?: string | null;
  row_number?: number | null;
  catalog_code?: string | null;
  change_type?: string | null;
  parse_status?: string | null;
  issue_message?: string | null;
  data_status?: string | null;
  abnormal_type?: string | null;
  hidden_in_tree?: boolean;
  status_reason?: string | null;
  validation_issue_codes?: string[];
  confidence_score?: number | null;
};

export type DeviceImportValidationResult = {
  key: string;
  label: string;
  status: "通过" | "警告" | "错误" | "待人工确认" | string;
  message: string;
  count?: number | null;
};

export type DeviceClassificationImportPreview = {
  batch_id?: string;
  source_file_name: string;
  source_file_size_bytes?: number | null;
  sha256?: string | null;
  source_row_count: number;
  major_count: number;
  level_1_count: number;
  level_2_count: number;
  catalog_item_count?: number;
  parse_success_count?: number;
  parse_failed_count?: number;
  pending_confirm_count?: number;
  existing_catalog_count?: number;
  is_initial_import?: boolean;
  management_class_counts: Record<string, number>;
  invalid_count: number;
  duplicate_count: number;
  low_confidence_count?: number;
  batch_risk_level?: "low" | "medium" | "high" | string;
  batch_risk_summary?: string | null;
  change_type_counts?: Record<string, number>;
  validation_results?: DeviceImportValidationResult[];
  difference_validation?: DeviceImportValidationResult;
  source_file?: EquipmentSourceFile | null;
  warnings: ImportFailure[];
  samples: DeviceClassificationPreviewRow[];
};

export type DeviceClassificationRevision = {
  revision_id: string;
  batch_id: string;
  source_file_name: string;
  source_table_index: number;
  row_number: number;
  change_type: "ADDED" | "MODIFIED" | "DELETED" | string;
  reason?: string | null;
  old_catalog_id?: string | null;
  new_catalog_id?: string | null;
  old_payload: DeviceClassificationPayload;
  new_payload: DeviceClassificationPayload;
  created_at?: string | null;
};

export type EquipmentSourceFile = {
  batch_id: string;
  source_type: string;
  source_system?: string | null;
  source_file_name: string;
  stored_file_name?: string | null;
  source_file_size_bytes?: number | null;
  sha256?: string | null;
  file_type?: string | null;
  source_link?: string | null;
  publish_date?: string | null;
  effective_date?: string | null;
  authoritative?: boolean | string | null;
  import_mode?: string | null;
  batch_name?: string | null;
  scope?: string | null;
  authority_level?: string | null;
  remark?: string | null;
  imported_by?: string | null;
  import_reason?: string | null;
  saved_at?: string | null;
};

export type EquipmentSourceFileList = {
  items: EquipmentSourceFile[];
};

export type DeviceImportHistoryRecord = {
  import_batch_id: string;
  source_file_id?: string | null;
  import_mode?: string | null;
  source_file_name?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  catalog_version?: string | null;
  import_reason?: string | null;
  operator_user_id?: string | null;
  operator_name?: string | null;
  operator_department?: string | null;
  operator_role?: string | null;
  client_ip?: string | null;
  user_agent?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  parsed_count?: number | null;
  imported_count?: number | null;
  inserted_count?: number | null;
  updated_count?: number | null;
  deprecated_count?: number | null;
  error_count?: number | null;
  rollback_status?: string | null;
  status?: string | null;
  raw_status?: string | null;
  change_type_counts?: Record<string, number>;
};

export type DeviceImportTimelineStep = {
  step: string;
  action?: string | null;
  operator_name?: string | null;
  occurred_at?: string | null;
  result?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
};

export type DeviceImportHistoryDetail = {
  batch: DeviceImportHistoryRecord;
  source_file?: EquipmentSourceFile | null;
  timeline: DeviceImportTimelineStep[];
  validation_results: DeviceImportValidationResult[];
  staging_total?: number | null;
  catalog_version?: Record<string, unknown> | null;
};

export type DeviceClassificationExportTemplateField = {
  field: string;
  label: string;
  description?: string | null;
};

export type DeviceClassificationExportTemplate = {
  template_id: string;
  template_name: string;
  fields: DeviceClassificationExportTemplateField[];
  sensitive_fields?: string[];
};

export type DeviceClassificationExportTask = {
  task_no: string;
  task_name: string;
  scope_type: string;
  scope_label: string;
  version_label?: string | null;
  template_id: string;
  template_name: string;
  format: string;
  format_label?: string | null;
  row_count: number;
  operator_name?: string | null;
  operator_role?: string | null;
  created_at?: string | null;
  purpose?: string | null;
  file_status: string;
  file_name: string;
  file_size_bytes?: number | null;
  file_hash?: string | null;
  download_count: number;
  last_downloaded_at?: string | null;
  criteria?: Record<string, unknown>;
  fields?: string[];
  summary?: Record<string, unknown>;
  download_logs?: Array<Record<string, unknown>>;
  audit_logs?: Array<Record<string, unknown>>;
};

export type DeviceClassificationExportCreateInput = {
  task_name?: string;
  purpose?: string;
  scope_type: string;
  criteria?: Record<string, unknown>;
  template_id: string;
  fields?: string[];
  format: string;
  version_label?: string;
};

export type ImportSheetSummary = {
  name: string;
  row_count?: number | null;
  column_count?: number | null;
  headers?: string[];
  selected_by_default?: boolean;
};

export type ImportFileInspection = {
  file_type: string;
  source_type?: string | null;
  source_file_name?: string | null;
  sheet_required: boolean;
  default_sheet_name?: string | null;
  sheets: ImportSheetSummary[];
  row_count?: number | null;
  headers?: string[];
};

export type ImportArchiveItem = {
  entry_path: string;
  file_name: string;
  extension?: string | null;
  size: number;
  source_type?: string | null;
  supported: boolean;
  reason?: string | null;
  sheet_name?: string | null;
  row_count?: number | null;
  sheet_count?: number | null;
  headers?: string[];
  inspection?: ImportFileInspection | null;
};

export type ImportArchiveInspection = {
  archive_id: string;
  archive_file_name: string;
  archive_file_extension?: string | null;
  archive_file_size_bytes?: number | null;
  archive_format?: string | null;
  total_entries: number;
  total_uncompressed_size_bytes?: number | null;
  importable_size_bytes?: number | null;
  importable_count: number;
  unsupported_count: number;
  source_type_counts?: Record<string, number>;
  items: ImportArchiveItem[];
};

export type ImportArchiveSubmitResult = {
  archive_id: string;
  archive_file_name: string;
  task_count: number;
  tasks: ImportTask[];
};

export type ImportSourceArtifact = {
  upload_mode?: "single_file" | "archive_entry" | string;
  source_file_name?: string | null;
  source_file_extension?: string | null;
  source_file_size_bytes?: number | null;
  archive_id?: string | null;
  archive_file_name?: string | null;
  archive_file_extension?: string | null;
  archive_file_size_bytes?: number | null;
  archive_format?: string | null;
  archive_total_entries?: number | null;
  archive_importable_count?: number | null;
  archive_uncompressed_size_bytes?: number | null;
  archive_entry_path?: string | null;
  archive_entry_size_bytes?: number | null;
  detected_source_type?: string | null;
  detected_sheet_name?: string | null;
  detected_row_count?: number | null;
  detected_sheet_count?: number | null;
  detected_headers?: string[];
};

export type ImportTask = {
  batch_id: string;
  source_type: string;
  source_system: string;
  source_file_name: string;
  source_file_extension?: string | null;
  source_file_size_bytes?: number | null;
  archive_id?: string | null;
  archive_file_name?: string | null;
  archive_file_extension?: string | null;
  archive_file_size_bytes?: number | null;
  archive_format?: string | null;
  archive_total_entries?: number | null;
  archive_importable_count?: number | null;
  archive_uncompressed_size_bytes?: number | null;
  archive_entry_path?: string | null;
  archive_entry_size_bytes?: number | null;
  detected_row_count?: number | null;
  detected_sheet_count?: number | null;
  detected_headers?: string[];
  source_artifact?: ImportSourceArtifact | null;
  sheet_name?: string | null;
  status: string;
  progress_percent: number;
  source_row_count: number;
  unique_key_count: number;
  success_count: number;
  failed_count: number;
  skipped_duplicate_count: number;
  duplicate_count: number;
  error_code?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type ImportTaskFailure = {
  failure_id: number;
  batch_id: string;
  row_number?: number | null;
  field_name?: string | null;
  message: string;
  raw_payload_included?: boolean;
  raw_payload?: unknown;
  created_at?: string | null;
};

export type TranscodeItem = {
  stg_id: number;
  batch_id: string;
  source_file_name?: string | null;
  sheet_name?: string | null;
  row_number?: number | null;
  original_yb_code_27: string;
  original_code_status?: string | null;
  yb_code_27?: string | null;
  change_type?: string | null;
  created_at?: string | null;
};

export type TranscodeResolveResult = {
  status: string;
  original_yb_code_27: string;
  items: TranscodeItem[];
  page: PageMeta;
};

export type EquipmentCategory = {
  category_id: string;
  category_code: string;
  category_name: string;
  parent_category_id?: string | null;
  level_no?: number | null;
  source_system?: string | null;
  source_batch_id?: string | null;
  status: string;
  remark?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EquipmentStandardName = {
  standard_id: string;
  standard_code: string;
  standard_name: string;
  alias_names: string[];
  category_id?: string | null;
  device_classification_id?: string | null;
  common_manufacturer_org_ids: string[];
  management_class?: string | null;
  source_system?: string | null;
  source_batch_id?: string | null;
  status: string;
  remark?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EquipmentStandardNameInput = {
  standard_code?: string | null;
  standard_name: string;
  alias_names?: string[];
  category_id?: string | null;
  device_classification_id?: string | null;
  common_manufacturer_org_ids?: string[];
  management_class?: string | null;
  source_system?: string | null;
  source_batch_id?: string | null;
  status?: string;
  remark?: string | null;
};

export type DeviceClassification = {
  catalog_id: string;
  batch_id: string;
  source_file_name: string;
  source_table_index: number;
  row_number: number;
  category_no?: string | null;
  major_category_no?: string | null;
  major_category_name?: string | null;
  level_1_category_no?: string | null;
  level_1_category?: string | null;
  level_2_category_no?: string | null;
  level_2_category?: string | null;
  product_description?: string | null;
  intended_use?: string | null;
  product_examples?: string | null;
  management_class?: string | null;
  data_status?: string | null;
  data_status_label?: string | null;
  status_reason?: string | null;
  hidden_in_tree?: boolean;
  merged_to_catalog_id?: string | null;
  corrected_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  latest_revision?: DeviceClassificationRevision | null;
  invalid_reasons?: string[];
};

export type DeviceImpactAnalysis = {
  child_catalog_count: number;
  material_master_ref_count: number;
  equipment_master_ref_count: number;
  insurance_mapping_ref_count: number;
  internal_mapping_ref_count: number;
  historical_business_ref_count: number;
  total_ref_count: number;
  can_deprecate_without_migration: boolean;
  requires_target_mapping: boolean;
};

export type CatalogCorrectionOrder = {
  correction_id: string;
  correction_no: string;
  catalog_id: string;
  source_batch_id?: string | null;
  source_file_hash?: string | null;
  source_position?: string | null;
  abnormal_type: string;
  correction_action: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  reason: string;
  handling_note?: string | null;
  impact_summary: DeviceImpactAnalysis | Record<string, unknown>;
  hide_in_tree: boolean;
  need_review: boolean;
  applicant_name?: string | null;
  reviewer_name?: string | null;
  status: string;
  status_label?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  executed_at?: string | null;
};

export type DeviceClassificationGovernanceDetail = {
  catalog: DeviceClassification;
  source_trace: {
    source_batch_id?: string | null;
    source_file_id?: string | null;
    source_file_name?: string | null;
    source_file_hash?: string | null;
    source_position?: string | null;
    imported_at?: string | null;
    import_mode?: string | null;
    source_announcement?: string | null;
    operator_name?: string | null;
    batch_status?: string | null;
  };
  change_history: Array<Record<string, unknown>>;
  correction_orders: CatalogCorrectionOrder[];
  correction_logs: Array<Record<string, unknown>>;
  impact_analysis: DeviceImpactAnalysis;
};

export type MappingResolveInput = {
  category: string;
  sourceSystem: string;
  sourceKey: string;
  sourceDesc?: string;
  sourceTxId?: string;
};

export type MappingResolveResult = {
  status: string;
  bridge_id?: string | null;
  target_master_id?: string | null;
  target_code?: string | null;
  mapping_rule?: string | null;
  confidence?: number | null;
  task_id?: string | null;
  message?: string | null;
};

export type MappingReviewTask = {
  task_id: string;
  category: string;
  source_system: string;
  source_key: string;
  source_desc?: string | null;
  candidate_json?: unknown;
  status: string;
  created_at?: string | null;
};

export type MappingReviewActionResult = {
  task_id: string;
  bridge_id?: string | null;
  status: string;
  reviewer?: string | null;
};

export type MappingApproveInput = {
  taskId: string;
  targetMasterId: string;
  targetCode?: string;
  mappingRule?: string;
  confidence?: string;
  reviewer: string;
  reviewComment?: string;
};

export type MappingRejectInput = {
  taskId: string;
  reviewer: string;
  reviewComment: string;
};

export type ExchangeLog = {
  log_id: number;
  trace_id: string;
  source_system: string;
  source_tx_id: string;
  data_category: string;
  status: string;
  error_code?: string | null;
  processing_time_ms?: number | null;
  created_at?: string | null;
};

export type ExchangePayloadSummary = {
  payload_type: string;
  top_level_keys: string[];
  nested_key_sample?: string[];
  allowlisted_fields: Record<string, unknown>;
  sensitive_keys_redacted: string[];
  raw_payload_included?: boolean;
};

export type ExchangeLogDetail = ExchangeLog & {
  payload_policy: {
    raw_request_payload_included: boolean;
    raw_response_payload_included: boolean;
    allowed_field_strategy: string;
    sensitive_key_strategy: string;
    sensitive_keywords: string[];
  };
  request_payload_summary: ExchangePayloadSummary;
  response_payload_summary: ExchangePayloadSummary;
};

export type VendorRole = {
  id: string;
  org_id: string;
  role_type: string;
  role_name: string;
  business_domain: string;
  status: string;
  effective_date?: string | null;
  expired_date?: string | null;
  qualification_required?: boolean;
  remark?: string | null;
};

export type VendorRelation = {
  id: string;
  parent_org_id: string;
  child_org_id: string;
  relation_type: string;
  relation_name: string;
  effective_date?: string | null;
  expired_date?: string | null;
  evidence_file_url?: string | null;
  status: string;
  remark?: string | null;
};

export type VendorExternalMapping = {
  id: string;
  org_id: string;
  system_name: string;
  external_code?: string | null;
  external_name?: string | null;
  is_current: boolean;
  confidence?: number | null;
  audit_status: string;
  remark?: string | null;
};

export type VendorQualification = {
  id: string;
  qualification_id?: string;
  org_id: string;
  qualification_type: string;
  certificate_no?: string | null;
  certificate_name?: string | null;
  issuing_authority?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  file_id?: string | null;
  status: string;
  remark?: string | null;
};

export type VendorContact = {
  id: string;
  contact_id?: string;
  org_id: string;
  contact_name: string;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  contact_type?: string | null;
  is_primary: boolean;
  status: string;
  remark?: string | null;
};

export type VendorMaster = {
  id: string;
  org_id?: string;
  organization_code: string;
  org_code?: string;
  standard_name: string;
  org_name?: string;
  english_name?: string | null;
  short_name?: string | null;
  org_short_name?: string | null;
  former_name?: string | null;
  alias_names?: string[];
  unified_social_credit_code?: string | null;
  organization_type?: string | null;
  org_type?: string | null;
  country_region?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  registered_address?: string | null;
  office_address?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  legal_representative?: string | null;
  status: string;
  data_source?: string | null;
  source_system?: string | null;
  quality_status: string;
  audit_status: string;
  remark?: string | null;
  roles?: VendorRole[];
  relations?: VendorRelation[];
  external_mappings?: VendorExternalMapping[];
  qualifications?: VendorQualification[];
  contacts?: VendorContact[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type VendorCandidate = {
  id: string;
  source_system: string;
  source_table?: string | null;
  source_record_id?: string | null;
  raw_name: string;
  normalized_name: string;
  matched_org_id?: string | null;
  match_confidence?: number | null;
  match_status: string;
  suggested_action: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
};

export type VendorMasterInput = {
  organization_code?: string;
  standard_name: string;
  english_name?: string;
  short_name?: string;
  former_name?: string;
  alias_names?: string[];
  unified_social_credit_code?: string;
  organization_type?: string;
  country_region?: string;
  province?: string;
  city?: string;
  address?: string;
  registered_address?: string;
  office_address?: string;
  contact_phone?: string;
  website?: string;
  legal_representative?: string;
  status?: string;
  data_source?: string;
  source_system?: string;
  quality_status?: string;
  audit_status?: string;
  remark?: string;
};

export type EvidenceItem = {
  id: string;
  title: string;
  evidence_type: string;
  generated_at: string;
  trace_id?: string;
  http_status?: number;
  ok?: boolean;
  payload: Record<string, unknown>;
};

export type DictionaryImportInput = {
  file: File;
  sourceSystem: string;
  sourceTxId?: string;
  sheetName?: string;
  sourceType?: string;
  importReason?: string;
  sourceFileName?: string;
  fileType?: string;
  sourceLink?: string;
  publishDate?: string;
  effectiveDate?: string;
  authoritative?: string;
  importMode?: string;
  batchName?: string;
  scope?: string;
  authorityLevel?: string;
  operatorName?: string;
  remark?: string;
};

export type AdminConfig = {
  apiBaseUrl: string;
  apiKey: string;
  environmentName: string;
  candidateVersion: string;
  language: Language;
};

export type Language = "en" | "zh";

export type UserRole = "platform_admin" | "data_steward" | "auditor";

export type UserSession = {
  username: string;
  displayName: string;
  role: UserRole;
  signedInAt: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
  backendPermissions?: PermissionKey[];
  authModel?: string;
  // 统一身份扩展字段
  personId?: string;
  personName?: string;
  departmentName?: string;
  position?: string;
  systems?: Record<string, { roles: string[] }>;
  accessToken?: string;
};

export type AuthContext = {
  operator_name: string;
  operator_display_name?: string;
  operator_role: UserRole;
  permissions: PermissionKey[];
  auth_model: string;
  session_token?: string;
  session_expires_at?: string;
  // 统一身份扩展字段
  person_id?: string;
  person_name?: string;
  department_name?: string;
  position?: string;
  systems?: Record<string, { roles: string[] }>;
  access_token?: string;
  token_type?: string;
};

export type PermissionMatrix = {
  roles: Array<{
    role: UserRole;
    permissions: PermissionKey[];
  }>;
  source: string;
};

export type OperatorAccountSummary = {
  username: string;
  display_name: string;
  role: UserRole;
  permissions: PermissionKey[];
  password_type: string;
};

export type OperatorDirectory = {
  accounts: OperatorAccountSummary[];
  source: string;
};

export type NavigationItem = {
  id: string;
  label: string;
  description: string;
  status: "ready" | "next";
  permission?: PermissionKey;
};

export type PermissionKey =
  | "dashboard.view"
  | "dictionaries.manage"
  | "departments.manage"
  | "equipment.manage"
  | "materials.manage"
  | "vendors.manage"
  | "imports.manage"
  | "mapping.review"
  | "exchange.view"
  | "permissions.manage"
  | "raw_payload.view";
