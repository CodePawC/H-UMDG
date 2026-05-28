# H-MDM UAT Checklist

| UAT ID | Requirement | Scenario | Expected Result | Result |
|---|---|---|---|---|
| UAT-VENDOR-001 | HMDM-VENDOR-001 | 创建厂商机构 | 返回厂商 `id` 和 `organization_code` | TBD |
| UAT-VENDOR-002 | HMDM-VENDOR-001 | 标准名称重复 | 返回 `DUPLICATE_STANDARD_NAME` | TBD |
| UAT-VENDOR-003 | HMDM-VENDOR-001 | 统一社会信用代码重复 | 返回 `DUPLICATE_CREDIT_CODE` | TBD |
| UAT-VENDOR-004 | HMDM-VENDOR-003 | 维护多个角色 | 同一厂商返回多个角色 | TBD |
| UAT-VENDOR-005 | HMDM-VENDOR-002 | 按别名检索 | 返回目标厂商 | TBD |
| UAT-VENDOR-006 | HMDM-VENDOR-004/005 | 建立母子/更名/收购关系 | 关系详情可查询 | TBD |
| UAT-VENDOR-007 | HMDM-VENDOR-006 | 维护外部编码映射 | 外部原始名称可检索 | TBD |
| UAT-VENDOR-008 | HMDM-VENDOR-007 | 医保耗材导入提取候选 | `vendor_candidate_count > 0` | TBD |
| UAT-VENDOR-009 | HMDM-VENDOR-008 | 候选映射已有厂商 | 候选状态变为 `matched` | TBD |
| UAT-VENDOR-010 | HMDM-VENDOR-008 | 候选创建新厂商 | 新厂商创建并关联候选 | TBD |
| UAT-VENDOR-011 | HMDM-VENDOR-008 | 候选合并与批量处理 | 候选可合并到已有厂商别名/外部映射，并可批量映射、合并或忽略 | TBD |
| UAT-VENDOR-011 | HMDM-VENDOR-009 | 外部 API 按信用代码检索 | 返回目标厂商 | TBD |
| UAT-VENDOR-012 | HMDM-VENDOR-010 | 装备平台引用厂商 `org_id` | 详情 API 返回可引用厂商身份 | TBD |
| UAT-EQUIP-001 | HMDM-EQUIP-001 | 导入设备分类目录真实文件 | `dict_equipment_categories` 写入真实导入记录 | TBD |
| UAT-EQUIP-002 | HMDM-EQUIP-002 | 导入设备标准名称真实文件 | `dict_equipment_standard_names` 写入真实导入记录，并可关联设备分类和厂家 `org_id` | TBD |
| UAT-EQUIP-003 | HMDM-EQUIP-003 | 导入医疗器械分类目录 DOCX | `ref_device_classification_catalog` 写入真实分类目录记录 | TBD |
| UAT-EQUIP-004 | HMDM-EQUIP-004 | 外部系统查询装备字典 | `/api/external/equipment/*` 返回可引用标准口径 | TBD |

UAT 说明：H-MDM 厂商机构主数据只验收标准身份、角色、关系、映射、候选审核和外部查询能力；供应商门户、报价、合同、发票、付款等业务流程不纳入本清单。
