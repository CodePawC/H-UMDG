# 医疗器械分类目录治理稳定点记录

日期：2026-05-25

## 已固化能力

- 分类树默认仅展示 `effective` 状态，异常、作废、合并、回滚数据不进入默认业务树。
- “发起纠错”生成纠错单，不进行主数据物理删除。
- 纠错单保留来源批次、源文件 Hash、原始位置、影响分析、申请人和状态。
- 目录详情“来源追溯”支持按当前目录条目下载原始源文件，用于对比当前条目。
- 调整导入不再删除旧目录项，而是将旧项标记为 `deprecated` 并隐藏。
- `-子目录`、字段表头误入字段值、异常连接符开头等解析噪声在导入预览阶段进入待人工确认，不进入有效树。

## 新增回归保护

- `tests/unit/test_device_classification_preview.py`
  - 覆盖国家药监局目录调整 DOCX 解析。
  - 覆盖 `-子目录` 异常行必须被识别为 `parse_abnormal`、`hidden_in_tree=true`。
- `tests/integration/test_app_contract.py::test_openapi_contains_mvp_paths`
  - 锁定纠错、治理详情、影响分析、按目录条目下载源文件等接口。
- `tests/integration/test_mvp_e2e_flow.py::test_device_classification_source_trace_download_and_correction`
  - 覆盖真实导入后来源追溯、源文件下载、纠错单提交。
- `tests/integration/test_mvp_e2e_flow.py::test_device_classification_catalog_import`
  - 覆盖调整导入后旧项作废隐藏，而非物理删除。

## 当前验证命令

```powershell
python -m pytest tests/unit/test_device_classification_preview.py tests/integration/test_app_contract.py::test_openapi_contains_mvp_paths tests/integration/test_mvp_e2e_flow.py::test_device_classification_source_trace_download_and_correction tests/integration/test_mvp_e2e_flow.py::test_device_classification_catalog_import
cd src/frontend
npm run build
```

验证结果：以上命令均通过。

## 后续增强原则

- 先补测试，再改解析规则。
- 仅允许高置信度目录行进入 `effective`。
- 存在任一结构化异常时，进入 `pending_confirm` 或 `parse_abnormal`。
- 纠错台账中的人工确认模式应反哺 `import_validation_rule`，作为后续导入核验规则。
