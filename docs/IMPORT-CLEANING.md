# H-MDM Import Cleaning

厂商名称清洗规则：

- 去除前后空格。
- 全角半角转换。
- 中英文括号统一。
- 英文大小写归一。
- 保留“有限公司”“股份有限公司”等后缀，不随意删除；仅用于疑似重复匹配的核心名称比较。
- 支持简称、英文名、别名、曾用名和外部原始名称检索。
- 统一社会信用代码格式校验为 18 位数字或大写字母。
- 基于标准名、别名、信用代码和名称相似度识别疑似重复厂商。
- 母子公司、收购、更名、合并、授权代理和授权售后关系必须人工确认。

医保耗材目录导入联动：

1. 从生产企业、注册人、备案人、厂家、耗材企业等字段提取厂商名称。
2. 写入 `manufacturer_vendor_candidate`。
3. 与 `manufacturer_vendor_master` 做确定性/相似匹配。
4. 匹配成功时建立厂商候选映射，并在耗材主数据中写入相应 `org_id`。
5. 无法确定时进入候选审核。
6. 人工审核可创建新厂商、映射已有厂商、合并或忽略。

装备字典导入规则：

- 设备分类目录支持 CSV/XLSX，必填字段为 `category_code` / `设备分类编码` 和 `category_name` / `设备分类名称`。
- 设备标准名称支持 CSV/XLSX，必填字段为 `standard_name` / `设备标准名称`；如未提供 `standard_code`，系统按标准名称生成稳定编码。
- 设备标准名称可通过 `category_id`、`category_code`、`设备分类编码` 或 `设备分类名称` 关联设备分类目录。
- 设备标准名称可通过 `device_classification_id`、`医疗器械分类ID`、`医疗器械分类编码` 或 `器械分类名称` 关联医疗器械分类目录。
- 常见生产厂家使用 `common_manufacturer_org_ids` / `常见生产厂家org_id` 保存 H-MDM 厂商机构主数据 `org_id`，不保存厂家文本作为权威身份。
- 医疗器械分类目录 DOCX 导入继续写入 `ref_device_classification_catalog`。
- 医疗器械分类目录 DOCX 导入会拆分层级序号：正文大类标题写入 `major_category_no` / `major_category_name`；表格 `序号` 写入 `level_1_category_no`；`二级产品类别` 的数字前缀写入 `level_2_category_no`，名称写入 `level_2_category`。
