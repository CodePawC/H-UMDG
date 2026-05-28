"""Dictionary catalog and interface blueprints for the data bus."""

from __future__ import annotations

from typing import Any


def _field(name: str, label: str, required: bool, field_type: str, description: str, example: str = "") -> dict[str, Any]:
    return {
        "name": name,
        "label": label,
        "required": required,
        "type": field_type,
        "description": description,
        "example": example,
    }


COMMON_UNITS: list[dict[str, str]] = [
    {"unit_code": "EA", "unit_name": "个", "unit_group": "数量", "symbol": "个"},
    {"unit_code": "PCS", "unit_name": "件", "unit_group": "数量", "symbol": "件"},
    {"unit_code": "BOX", "unit_name": "盒", "unit_group": "包装", "symbol": "盒"},
    {"unit_code": "BAG", "unit_name": "袋", "unit_group": "包装", "symbol": "袋"},
    {"unit_code": "SET", "unit_name": "套", "unit_group": "数量", "symbol": "套"},
    {"unit_code": "ML", "unit_name": "毫升", "unit_group": "体积", "symbol": "mL"},
    {"unit_code": "L", "unit_name": "升", "unit_group": "体积", "symbol": "L"},
    {"unit_code": "MG", "unit_name": "毫克", "unit_group": "质量", "symbol": "mg"},
    {"unit_code": "G", "unit_name": "克", "unit_group": "质量", "symbol": "g"},
    {"unit_code": "MM", "unit_name": "毫米", "unit_group": "长度", "symbol": "mm"},
]

WARD_REFERENCE_ROWS: list[dict[str, str]] = [
    {"ward_code": "WARD-CARD-01", "ward_name": "心内一病区", "dept_code": "NHC-03.04", "campus_code": "CAMPUS-MAIN"},
    {"ward_code": "WARD-SURG-01", "ward_name": "普外一病区", "dept_code": "NHC-04.01", "campus_code": "CAMPUS-MAIN"},
    {"ward_code": "WARD-ICU", "ward_name": "重症医学科护理单元", "dept_code": "NHC-03.10", "campus_code": "CAMPUS-MAIN"},
    {"ward_code": "WARD-OB-01", "ward_name": "产科病区", "dept_code": "NHC-05.01", "campus_code": "CAMPUS-MAIN"},
    {"ward_code": "WARD-PED-01", "ward_name": "儿科病区", "dept_code": "NHC-06.01", "campus_code": "CAMPUS-MAIN"},
]


DICTIONARY_CATALOG: list[dict[str, Any]] = [
    {
        "dictionary_key": "DEPARTMENT",
        "name": "科室/诊疗科目",
        "domain": "组织机构",
        "status": "AVAILABLE",
        "purpose": "统一临床、医技、保健等科室口径，支撑交换映射、权限、统计和外部系统对码。",
        "maintenance_modes": ["标准库同步", "界面启停", "模板导入", "映射维护"],
        "key_fields": [
            _field("dept_code", "标准科室编码", True, "string", "全院唯一标准编码。", "NHC-03.04"),
            _field("dept_name", "标准科室名称", True, "string", "标准科室或诊疗科目名称。", "心血管内科专业"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("dept_alias", "常用别名", False, "string", "院内俗称、简称或历史名称，分号分隔。", "心内科;心血管内科"),
            _field("parent_dept_code", "上级科室编码", False, "string", "用于科室层级。", "NHC-03"),
            _field("dept_type", "科室类型", False, "string", "临床、医技、保健、诊疗科目等。", "临床"),
        ],
        "api_endpoints": [
            "GET /api/v1/departments/search",
            "POST /api/v1/departments/standard-library/sync",
            "PATCH /api/v1/departments/{dept_code}/status",
            "POST /api/v1/departments/import",
        ],
        "implementation_note": "已接入：内置标准库、检索、模板导入、启停维护。",
    },
    {
        "dictionary_key": "MATERIAL",
        "name": "医用耗材",
        "domain": "物资与医保",
        "status": "AVAILABLE",
        "purpose": "统一医保 27 位码、院内耗材编码、规格型号和停用/转码关系。",
        "maintenance_modes": ["模板导入", "NHSA 全量导入", "压缩包预检", "转码查询"],
        "key_fields": [
            _field("yb_code_27", "医保 27 位码", True, "string", "国家医保医用耗材唯一编码。", "123456789012345678901234567"),
            _field("generic_name", "医保通用名", True, "string", "耗材通用名称。", "一次性使用导管"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("yb_code_20", "医保 20 位码", False, "string", "医保码前 20 位或源表提供的 20 位码。", "12345678901234567890"),
            _field("reg_number", "注册备案号", False, "string", "医疗器械注册证或备案号。", "国械注准..."),
            _field("spec_value", "规格", False, "text", "规格值或原始规格文本。", "22mm"),
        ],
        "api_endpoints": [
            "GET /api/v1/materials/search",
            "POST /api/v1/materials/import",
            "GET /api/v1/materials/transcode/resolve",
            "POST /api/v1/import-tasks/materials/archive",
        ],
        "implementation_note": "已接入：模板、NHSA 全量/停用/转码表、压缩包拆分任务。",
    },
    {
        "dictionary_key": "CAMPUS",
        "name": "院区",
        "domain": "组织机构",
        "status": "AVAILABLE",
        "purpose": "院区数量通常较少，直接开放手工维护即可，作为科室、病区、位置和交换路由的上级维度。",
        "maintenance_modes": ["手工新增", "界面启停", "接口发布"],
        "key_fields": [
            _field("campus_code", "院区编码", True, "string", "全院唯一院区编码。", "CAMPUS-MAIN"),
            _field("campus_name", "院区名称", True, "string", "院区标准名称。", "本部院区"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("address", "地址", False, "string", "院区地址。", "北京市..."),
            _field("organization_code", "机构代码", False, "string", "医疗机构登记号或组织机构代码。", ""),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/campus"],
        "implementation_note": "建议首期直接开放界面新增、编辑和启停，不强制模板导入。",
        "candidate_source": "用户手工录入",
        "curation_policy": "医院自行维护，通常只需少量院区。",
        "reference_records": [
            {"campus_code": "CAMPUS-MAIN", "campus_name": "本部院区", "status": "ACTIVE"},
            {"campus_code": "CAMPUS-EAST", "campus_name": "东院区", "status": "ACTIVE"},
            {"campus_code": "CAMPUS-INTERNET", "campus_name": "互联网医院", "status": "ACTIVE"},
        ],
    },
    {
        "dictionary_key": "WARD",
        "name": "病区/护理单元",
        "domain": "组织机构",
        "status": "AVAILABLE",
        "purpose": "提供常见病区和护理单元参考，用户可按本院实际启用、停用或补充。",
        "maintenance_modes": ["参考数据启停", "界面维护", "模板导入"],
        "key_fields": [
            _field("ward_code", "病区编码", True, "string", "全院唯一病区编码。", "WARD-01"),
            _field("ward_name", "病区名称", True, "string", "病区或护理单元名称。", "心内一病区"),
            _field("dept_code", "所属科室编码", True, "string", "关联标准科室。", "NHC-03.04"),
        ],
        "optional_fields": [
            _field("campus_code", "所属院区", False, "string", "关联院区。", "CAMPUS-MAIN"),
            _field("bed_count", "床位数", False, "number", "规划或开放床位数。", "48"),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/ward"],
        "implementation_note": "先提供常见病区参考行，正式维护时关联院区和标准科室。",
        "candidate_source": "常见医院病区模板 + 本院手工补充",
        "curation_policy": "参考数据默认关闭，用户选择启用后进入接口发布范围。",
        "reference_records": WARD_REFERENCE_ROWS,
    },
    {
        "dictionary_key": "STAFF",
        "name": "人员/执业身份",
        "domain": "人员与权限",
        "status": "BLUEPRINT",
        "purpose": "统一医生、护士、技师、药师等人员身份，支撑签名、审核、交换责任人和岗位权限。",
        "maintenance_modes": ["模板导入", "接口同步", "界面维护"],
        "key_fields": [
            _field("staff_code", "人员编码", True, "string", "全院唯一人员编码。", "E1001"),
            _field("staff_name", "姓名", True, "string", "人员姓名。", "张三"),
            _field("staff_type", "人员类型", True, "enum", "doctor/nurse/pharmacist/technician/admin。", "doctor"),
        ],
        "optional_fields": [
            _field("dept_code", "主科室", False, "string", "主要执业或任职科室。", "NHC-03.04"),
            _field("license_no", "执业证号", False, "string", "医生、护士等执业证号。", ""),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/staff"],
        "implementation_note": "后续应与统一身份认证/IAM 或 HR 系统同步。",
    },
    {
        "dictionary_key": "DRUG",
        "name": "药品",
        "domain": "药品与医保",
        "status": "BLUEPRINT",
        "purpose": "统一药品通用名、规格、剂型、批准文号、医保编码和院内药品编码。",
        "maintenance_modes": ["模板导入", "接口同步", "界面维护"],
        "key_fields": [
            _field("drug_code", "药品编码", True, "string", "院内或平台标准药品编码。", "DRUG-0001"),
            _field("drug_name", "药品名称", True, "string", "标准药品名称。", "阿莫西林胶囊"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("generic_name", "通用名", False, "string", "药品通用名称。", "阿莫西林"),
            _field("dosage_form", "剂型", False, "string", "片剂、胶囊、注射剂等。", "胶囊剂"),
            _field("insurance_code", "医保编码", False, "string", "医保药品编码。", ""),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/drug"],
        "implementation_note": "字段可先发布接口指南，数据后续由药学或 HIS 源头充实。",
    },
    {
        "dictionary_key": "DIAGNOSIS",
        "name": "诊断",
        "domain": "临床术语",
        "status": "AVAILABLE",
        "purpose": "诊断字典适合以 ICD 标准库作为候选，用户选择启用并维护院内别名和映射。",
        "maintenance_modes": ["标准库候选", "启停维护", "映射维护"],
        "key_fields": [
            _field("diagnosis_code", "诊断编码", True, "string", "ICD 或平台标准编码。", "I10.x00"),
            _field("diagnosis_name", "诊断名称", True, "string", "标准诊断名称。", "高血压病"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("coding_system", "编码体系", False, "string", "ICD-10、ICD-11 或院内体系。", "ICD-10"),
            _field("alias", "别名", False, "string", "院内常用名称。", "原发性高血压"),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/diagnosis"],
        "implementation_note": "建议预置 ICD 常用诊断候选，用户启用后再补充院内别名。",
        "candidate_source": "ICD 标准库 / 病案首页历史诊断",
        "curation_policy": "标准候选启停为主，手工新增需审核。",
        "reference_records": [
            {"diagnosis_code": "I10.x00", "diagnosis_name": "高血压病", "coding_system": "ICD-10"},
            {"diagnosis_code": "E11.900", "diagnosis_name": "2型糖尿病", "coding_system": "ICD-10"},
            {"diagnosis_code": "J18.900", "diagnosis_name": "肺炎", "coding_system": "ICD-10"},
        ],
    },
    {
        "dictionary_key": "PROCEDURE",
        "name": "手术操作/诊疗项目",
        "domain": "临床术语",
        "status": "AVAILABLE",
        "purpose": "手术操作适合以标准操作候选为基础，用户启用后再维护院内项目和收费映射。",
        "maintenance_modes": ["标准库候选", "启停维护", "映射维护"],
        "key_fields": [
            _field("procedure_code", "操作编码", True, "string", "标准手术操作或诊疗项目编码。", "36.0101"),
            _field("procedure_name", "操作名称", True, "string", "标准操作名称。", "冠状动脉造影"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("procedure_type", "项目类型", False, "string", "手术、检查、治疗、护理等。", "手术"),
            _field("charge_item_code", "收费项目编码", False, "string", "关联收费目录。", ""),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/procedure"],
        "implementation_note": "建议预置常用 ICD 手术操作候选，并与收费项目分层维护。",
        "candidate_source": "ICD 手术操作标准库 / 病案首页历史操作",
        "curation_policy": "标准候选启停为主，院内项目通过映射补充。",
        "reference_records": [
            {"procedure_code": "36.0101", "procedure_name": "冠状动脉造影", "procedure_type": "手术/操作"},
            {"procedure_code": "39.9500", "procedure_name": "血液透析", "procedure_type": "治疗"},
            {"procedure_code": "88.7200", "procedure_name": "心脏超声检查", "procedure_type": "检查"},
        ],
    },
    {
        "dictionary_key": "SUPPLIER",
        "name": "供应商",
        "domain": "供应链",
        "status": "AVAILABLE",
        "purpose": "优先从医保耗材全量表中的耗材企业/厂家提取候选，用户选择启用，后续可手工新增供应商。",
        "maintenance_modes": ["导入数据提取", "启停维护", "手工新增"],
        "key_fields": [
            _field("supplier_code", "供应商编码", True, "string", "平台供应商编码。", "SUP-001"),
            _field("supplier_name", "供应商名称", True, "string", "供应商法定或标准名称。", "某某医疗器械有限公司"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("credit_code", "统一社会信用代码", False, "string", "供应商统一社会信用代码。", ""),
            _field("contact", "联系人", False, "string", "业务联系人。", ""),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/supplier"],
        "implementation_note": "候选供应商可由 dict_material_specs.brand_name 或 NHSA staging manufacturer 字段去重生成。",
        "candidate_source": "医保耗材全量规格型号信息中的耗材企业/厂家字段",
        "curation_policy": "导入生成候选，用户启用后成为正式供应商；允许手工新增。",
        "reference_records": [
            {"supplier_code": "SUP-CANDIDATE", "supplier_name": "从医保耗材厂家字段自动提取", "status": "候选"},
        ],
    },
    {
        "dictionary_key": "UNIT",
        "name": "计量单位",
        "domain": "基础代码",
        "status": "AVAILABLE",
        "purpose": "内置常用计量单位，用户只需要选择启用、停用或维护别名，减少接口交换中的单位歧义。",
        "maintenance_modes": ["内置标准库", "界面启停", "别名维护"],
        "key_fields": [
            _field("unit_code", "单位编码", True, "string", "平台单位编码。", "mg"),
            _field("unit_name", "单位名称", True, "string", "单位中文名称。", "毫克"),
            _field("status", "状态", True, "enum", "ACTIVE 或 INACTIVE。", "ACTIVE"),
        ],
        "optional_fields": [
            _field("unit_group", "单位组", False, "string", "质量、体积、数量、包装等。", "质量"),
            _field("symbol", "符号", False, "string", "单位符号。", "mg"),
        ],
        "api_endpoints": ["PLANNED /api/v1/dictionaries/unit"],
        "implementation_note": "首期可直接生成常用单位候选，用户只做启停；后续可从耗材规格单位和包装单位反向补充别名。",
        "candidate_source": "系统内置常用单位 + 耗材 spec_unit/unit_pkg 反向提取",
        "curation_policy": "内置候选默认可选，启用后进入接口发布范围。",
        "reference_records": COMMON_UNITS,
    },
]


def dictionary_catalog() -> dict[str, Any]:
    available_count = sum(1 for item in DICTIONARY_CATALOG if item["status"] == "AVAILABLE")
    return {
        "items": DICTIONARY_CATALOG,
        "summary": {
            "total": len(DICTIONARY_CATALOG),
            "available_count": available_count,
            "blueprint_count": len(DICTIONARY_CATALOG) - available_count,
        },
    }
