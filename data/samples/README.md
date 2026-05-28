# External import artifacts (NHSA / NMPA)

本目录用于存放**不宜提交到 Git** 的官方发布包或院方提供的导入原件（体积大、版权或分发限制）。测试与 UAT 可通过环境变量指向任意可读路径。

## 目录约定（可选）

将文件放入下列相对路径时，可与文档默认值对齐而无需设置环境变量：

| 用途 | 建议相对路径（仓库根目录） |
|---|---|
| NHSA 医用耗材代码 Excel 发布包中的若干工作表 | `data/samples/external/nhsa/` |
| 国家药监局医疗器械分类目录 DOCX | `data/samples/external/nmpa/医疗器械分类目录.docx` |

NHSA 示例文件名（保持发布包原名即可）：

- `16、医保医用耗材代码_C09_体外循环材料_全量规格型号信息.xlsx`
- `30、停用表.xlsx`
- `31、转码表.xlsx`

## 已提交的小样本工作簿

以下文件从用户提供的真实医保耗材发布包中截取 `Query1` 工作表表头和 12 条记录生成，用于自动化测试，不替代全量 UAT 数据：

| 文件 | 来源结构 | 行数 | 用途 |
|---|---|---:|---|
| `data/samples/external/nhsa/H-UDMP-SAMPLE-NHSA-C09-FULL-SPEC-v1.0.xlsx` | C09 全量规格型号信息，21 字段 | 12 | 验证 `NHSA_FULL_SPEC` 导入、暂存表和主数据清洗 |
| `data/samples/external/nhsa/H-UDMP-SAMPLE-NHSA-DISABLED-v1.0.xlsx` | 停用表，2 字段 | 12 | 验证 `NHSA_DISABLED` 导入 |
| `data/samples/external/nhsa/H-UDMP-SAMPLE-NHSA-TRANSCODE-v1.0.xlsx` | 转码表，4 字段 | 12 | 验证 `NHSA_TRANSCODE` 导入 |

可重新生成样例：

```powershell
cd src/backend
.\.venv\Scripts\python.exe ..\..\tools\create_nhsa_sample_workbooks.py
```

## 环境变量

| Variable | 说明 |
|---|---|
| `HUDMP_NHSA_DIR` | 包含上述 NHSA `.xlsx` 文件的目录。未设置时默认为仓库根下的 `data/samples/external/nhsa`。 |
| `HUDMP_DEVICE_CATALOG_DOCX` | `医疗器械分类目录.docx` 的绝对或相对路径。未设置时默认为 `data/samples/external/nmpa/医疗器械分类目录.docx`。 |

PowerShell 示例：

```powershell
$env:HUDMP_NHSA_DIR = "C:\artifacts\nhsa-bundle"
$env:HUDMP_DEVICE_CATALOG_DOCX = "C:\artifacts\nmpa\医疗器械分类目录.docx"
```

## CI / 自动化

流水线中可使用仓库内已提交的小样本工作簿进行快速回归；全量发布包仍应放入专用制品库或院内文件目录，并在作业里设置 `HUDMP_NHSA_DIR` 指向下载目录；不要在仓库中硬编码开发者本机盘符路径。

## 隐私与合规

原始导入文件不得包含真实患者隐私数据；须使用官方公开目录或院方脱敏样例。
