export type ImportGuide = {
  title: string;
  purpose: string;
  acceptedFiles: string;
  accept: string;
  samplePath: string;
  downloadUrl?: string;
  sampleDownloadUrl?: string;
  sampleLabel?: string;
  requiredFields: string[];
  optionalFields: string[];
  notes: string[];
};

export const departmentImportGuide: ImportGuide = {
  title: "Department dictionary template",
  purpose: "Use this import only for hospital department master data, not arbitrary spreadsheets.",
  acceptedFiles: "CSV / XLSX / XLSM",
  accept: ".csv,.xlsx,.xlsm",
  samplePath: "data/templates/H-UDMP-TEMPLATE-DEPARTMENTS-v1.0.csv",
  downloadUrl: "/downloads/templates/H-UDMP-TEMPLATE-DEPARTMENTS-v1.0.csv",
  requiredFields: ["dept_code", "dept_name"],
  optionalFields: ["parent_dept_code", "dept_alias", "dept_type", "oid", "status"],
  notes: [
    "Keep department codes as text so leading zeros are not lost.",
    "Use parent_dept_code only when the parent department exists or is included in the same file.",
    "Use a unique Source TX ID for each rehearsal so the import can be traced."
  ]
};

export const materialImportGuides: Record<string, ImportGuide> = {
  MVP_TEMPLATE: {
    title: "MVP material template",
    purpose: "Use this for hospital material master data rehearsals and small UAT batches.",
    acceptedFiles: "CSV / XLSX / XLSM",
    accept: ".csv,.xlsx,.xlsm",
    samplePath: "data/templates/H-UDMP-TEMPLATE-MATERIALS-v1.0.csv",
    downloadUrl: "/downloads/templates/H-UDMP-TEMPLATE-MATERIALS-v1.0.csv",
    requiredFields: ["yb_code_27", "generic_name"],
    optionalFields: [
      "yb_code_20",
      "brand_name",
      "material_attr",
      "spec_value",
      "spec_unit",
      "model_detail",
      "reg_number",
      "unit_pkg",
      "status"
    ],
    notes: [
      "yb_code_27 must be stored as text and should keep the full 27-character NHSA code.",
      "yb_code_20 can be derived from the first 20 characters when it is empty.",
      "Duplicate yb_code_27 values in the same file are reported in the import counters."
    ]
  },
  NHSA_FULL_SPEC: {
    title: "NHSA full specification workbook",
    purpose: "Use this for official NHSA full specification Excel files, such as C09 full spec sources.",
    acceptedFiles: "CSV / XLSX / XLSM",
    accept: ".csv,.xlsx,.xlsm",
    samplePath: "data/templates/H-UDMP-TEMPLATE-NHSA-FULL-SPEC-v1.0.csv",
    downloadUrl: "/downloads/templates/H-UDMP-TEMPLATE-NHSA-FULL-SPEC-v1.0.csv",
    sampleDownloadUrl: "/downloads/samples/nhsa/H-UDMP-SAMPLE-NHSA-C09-FULL-SPEC-v1.0.xlsx",
    sampleLabel: "Download C09 sample workbook",
    requiredFields: ["27位码", "20位码", "一级分类", "二级分类", "三级分类", "单件产品名称"],
    optionalFields: ["GOODS_ID", "UDI", "原27位码", "医保通用名", "耗材企业", "注册备案号", "规格", "型号"],
    notes: [
      "Select Source type = NHSA Full Spec before uploading full specification files.",
      "NHSA workbooks normally use sheet Query1; leave Sheet name blank to use the first-sheet fallback.",
      "Do not convert NHSA codes to numbers because letter prefixes and long digits must be preserved.",
      "Large official files should be submitted through Async material import."
    ]
  },
  NHSA_DISABLED: {
    title: "NHSA disabled-code workbook",
    purpose: "Use this only for official NHSA disabled-code lists that mark standard codes as stopped.",
    acceptedFiles: "CSV / XLSX / XLSM",
    accept: ".csv,.xlsx,.xlsm",
    samplePath: "data/templates/H-UDMP-TEMPLATE-NHSA-DISABLED-v1.0.csv",
    downloadUrl: "/downloads/templates/H-UDMP-TEMPLATE-NHSA-DISABLED-v1.0.csv",
    sampleDownloadUrl: "/downloads/samples/nhsa/H-UDMP-SAMPLE-NHSA-DISABLED-v1.0.xlsx",
    sampleLabel: "Download disabled-code sample workbook",
    requiredFields: ["27位码", "原码状态"],
    optionalFields: [],
    notes: [
      "Select Source type = NHSA Disabled before uploading 30、停用表.xlsx.",
      "This import records disabled status and does not delete historical master data.",
      "Codes must remain text values, including any alphabetic prefixes.",
      "Use Source system to record the NHSA release or source folder name."
    ]
  },
  NHSA_TRANSCODE: {
    title: "NHSA transcode workbook",
    purpose: "Use this for official NHSA replacement mappings from an original 27-bit code to a new 27-bit code.",
    acceptedFiles: "CSV / XLSX / XLSM",
    accept: ".csv,.xlsx,.xlsm",
    samplePath: "data/templates/H-UDMP-TEMPLATE-NHSA-TRANSCODE-v1.0.csv",
    downloadUrl: "/downloads/templates/H-UDMP-TEMPLATE-NHSA-TRANSCODE-v1.0.csv",
    sampleDownloadUrl: "/downloads/samples/nhsa/H-UDMP-SAMPLE-NHSA-TRANSCODE-v1.0.xlsx",
    sampleLabel: "Download transcode sample workbook",
    requiredFields: ["原27位码", "原码状态", "27位码", "类型"],
    optionalFields: [],
    notes: [
      "Select Source type = NHSA Transcode before uploading 31、转码表.xlsx.",
      "原27位码 to 27位码 is stored as a traceable replacement relationship.",
      "The 类型 column must remain distinguishable, for example 变更 or 映射.",
      "This import does not rewrite historical business records automatically."
    ]
  },
  DEVICE_CLASSIFICATION_CATALOG: {
    title: "Device classification catalog",
    purpose: "Use this for the medical device classification catalog reference, not for NHSA material codes.",
    acceptedFiles: "DOCX",
    accept: ".docx",
    samplePath: "医疗器械分类目录.docx",
    requiredFields: ["序号", "一级产品类别", "二级产品类别", "产品描述", "预期用途", "品名举例", "管理类别"],
    optionalFields: [],
    notes: [
      "This is a reference classification source and must not overwrite NHSA category levels.",
      "The importer reads classification detail tables from the document.",
      "Use it when comparing device category governance, not when importing material master rows."
    ]
  }
};
