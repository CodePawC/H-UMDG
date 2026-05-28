# H-MDM Data Model

厂商机构主数据新增表：

- `manufacturer_vendor_master`
- `manufacturer_vendor_role`
- `manufacturer_vendor_relation`
- `manufacturer_vendor_external_mapping`
- `manufacturer_vendor_candidate`

耗材主数据 `dict_material_specs` 新增引用字段：

- `manufacturer_org_id`
- `registrant_org_id`
- `filer_org_id`

这些字段引用 `manufacturer_vendor_master.id`。医保耗材主数据不应只保存厂家文本；导入时先抽取候选，候选匹配或人工审核后写入厂商主数据引用。

装备字典新增表：

- `dict_equipment_categories`
- `dict_equipment_standard_names`

设备分类目录保存可被医学装备运营管理平台引用的分类编码、分类名称、父级分类、层级、来源系统和状态。设备标准名称保存标准名称、别名、所属设备分类、关联医疗器械分类目录、常见生产厂家 `org_id` 列表、管理类别、来源系统和状态。

医疗器械分类目录继续使用 `ref_device_classification_catalog` 作为参考表。设备标准名称可关联该参考表，但 H-MDM 不维护具体设备资产实例。

详表见 [H-UDMP-DATA-MODEL-v1.0.md](05-data/H-UDMP-DATA-MODEL-v1.0.md)。
