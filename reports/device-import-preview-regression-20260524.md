# Medical Device Classification Import Preview Regression Record

Date: 2026-05-24

## Scope

This record preserves the verified behavior for the medical device classification catalog import wizard.

## Protected Behaviors

- The import wizard can select an import mode when opening `导入目录`.
- When an existing catalog is present, `初始化导入` is disabled and `增量更新` is selected by default.
- In `建立导入批次`, the primary button is explicit: `进入解析`.
- Starting parsing moves the wizard to `解析与预览` and shows loading/feedback instead of appearing unresponsive.
- The NMPA adjustment-table DOCX format, such as `国家药品监督管理局2022年第30号公告附件.docx`, is parsed into preview rows.
- Successful parsing resets preview filters to `全部记录` and displays a visible summary above the preview table.
- The local frontend should use the current backend API base URL `http://127.0.0.1:8101` when the old `18080` service lacks the preview route.

## Regression Guards

- `tests/unit/test_device_classification_preview.py`
  - Covers DOCX adjustment-table preview parsing.
  - Verifies parsed row count, success count, change-type counts, inherited `无变化` fields, and generated preview rows.

## Verification Commands

```powershell
python -m pytest tests/unit/test_device_classification_preview.py
cd src/frontend
npm run build
```

Latest verification:

- `python -m pytest tests/unit/test_device_classification_preview.py`: passed.
- `npm run build`: passed.

## Manual Acceptance Notes

- Frontend: `http://127.0.0.1:5101/`
- Backend used for this verified flow: `http://127.0.0.1:8101`
- Real uploaded file parsed during validation:
  - `D:/Users/Downloads/国家药品监督管理局2022年第30号公告附件.docx`
  - Expected preview result: 32 total rows, 32 successful rows, 0 failed rows.
