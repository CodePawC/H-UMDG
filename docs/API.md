# H-MDM API

厂商机构维护 API：

- `GET /api/v1/manufacturer-vendors`
- `POST /api/v1/manufacturer-vendors`
- `PATCH /api/v1/manufacturer-vendors/{id}`
- `PATCH /api/v1/manufacturer-vendors/{id}/status`
- `POST /api/v1/manufacturer-vendors/{id}/submit`
- `POST /api/v1/manufacturer-vendors/{id}/audit`
- `POST /api/v1/manufacturer-vendors/{id}/roles`
- `POST /api/v1/manufacturer-vendor-relations`
- `POST /api/v1/manufacturer-vendors/{id}/external-mappings`
- `GET /api/v1/manufacturer-vendor-candidates`
- `POST /api/v1/manufacturer-vendor-candidates/{id}/map`
- `POST /api/v1/manufacturer-vendor-candidates/{id}/merge`
- `POST /api/v1/manufacturer-vendor-candidates/{id}/create-vendor`
- `POST /api/v1/manufacturer-vendor-candidates/{id}/ignore`
- `POST /api/v1/manufacturer-vendor-candidates/batch`

外部查询 API：

- `GET /api/external/manufacturer-vendors?keyword=&role_type=&business_domain=`
- `GET /api/external/manufacturer-vendors/{id}`
- `GET /api/external/manufacturer-vendors/{id}/relations`

外部 API 支持按标准名称、简称、英文名、别名、统一社会信用代码和原始外部名称检索。医学装备运营管理平台和供应商门户引用返回的 `id` / `organization_code`，不自行维护厂商标准名称权威库。

装备字典维护 API：

- `GET /api/v1/equipment/categories?keyword=&status=&page=&page_size=`
- `GET /api/v1/equipment/standard-names?keyword=&category_id=&status=&page=&page_size=`
- `GET /api/v1/equipment/device-classifications?keyword=&management_class=&page=&page_size=`
- `POST /api/v1/equipment/import`

`POST /api/v1/equipment/import` 使用 multipart 上传真实文件，支持 `source_type`：

- `EQUIPMENT_CATEGORY`：设备分类目录，支持 CSV/XLSX。
- `EQUIPMENT_STANDARD_NAME`：设备标准名称，支持 CSV/XLSX。
- `DEVICE_CLASSIFICATION_CATALOG`：医疗器械分类目录，支持 DOCX。

医疗器械分类目录 DOCX 导入会从正文标题识别大类序号和名称，例如 `01 有源手术器械`；从表格 `序号` 保存一级产品类别序号；从 `二级产品类别` 拆分二级产品类别序号和名称。返回字段包含 `major_category_no`、`major_category_name`、`level_1_category_no`、`level_1_category`、`level_2_category_no`、`level_2_category`。

装备字典外部查询 API：

- `GET /api/external/equipment/categories?keyword=&page=&page_size=`
- `GET /api/external/equipment/standard-names?keyword=&category_id=&page=&page_size=`
- `GET /api/external/equipment/device-classifications?keyword=&management_class=&page=&page_size=`

外部系统只读取 H-MDM 装备字典标准口径，并保存返回的分类或标准名称标识。医学装备运营管理平台负责具体设备资产、品牌、型号、序列号、资产编号、科室、位置、维修和计量等业务字段。
