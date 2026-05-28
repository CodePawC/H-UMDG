param(
    [string]$ApiBaseUrl = "http://127.0.0.1:8101",
    [string]$ApiKey = "change-me",
    [string]$Python = ".\src\backend\.venv\Scripts\python.exe",
    [string]$EvidenceDir = ".\uat-evidence"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$EvidencePath = Join-Path $RepoRoot $EvidenceDir
New-Item -ItemType Directory -Path $EvidencePath -Force | Out-Null

$Headers = @{ "X-API-Key" = $ApiKey }
$Stamp = Get-Date -Format "yyyyMMddHHmmss"

function Save-JsonEvidence {
    param(
        [string]$Name,
        [object]$Value
    )
    $Path = Join-Path $EvidencePath "$Stamp-$Name.json"
    $Value | ConvertTo-Json -Depth 20 | Out-File -FilePath $Path -Encoding utf8
    Write-Host "saved evidence: $Path"
}

function Invoke-FormPost {
    param(
        [string]$Path,
        [hashtable]$Form
    )
    $Url = "$ApiBaseUrl$Path"
    Invoke-RestMethod -Method Post -Uri $Url -Headers $Headers -Form $Form
}

Write-Host "H-UDMP UAT demo started. API: $ApiBaseUrl"

$Health = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/health"
Save-JsonEvidence -Name "001-health" -Value $Health

$Unauthorized = $null
try {
    Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/materials/search"
} catch {
    $Unauthorized = $_.ErrorDetails.Message | ConvertFrom-Json
}
Save-JsonEvidence -Name "002-unauthorized" -Value $Unauthorized

$DeptFile = Join-Path $RepoRoot "data\templates\H-UDMP-TEMPLATE-DEPARTMENTS-v1.0.csv"
$DeptImport = Invoke-FormPost -Path "/api/v1/departments/import" -Form @{
    file = Get-Item $DeptFile
    source_system = "UAT"
    source_tx_id = "UAT-DEPT-$Stamp"
}
Save-JsonEvidence -Name "003-department-import" -Value $DeptImport

$DeptSearch = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/departments/search?keyword=心外" -Headers $Headers
Save-JsonEvidence -Name "004-department-search" -Value $DeptSearch

$MaterialFile = Join-Path $RepoRoot "data\templates\H-UDMP-TEMPLATE-MATERIALS-v1.0.csv"
$MaterialImport = Invoke-FormPost -Path "/api/v1/materials/import" -Form @{
    file = Get-Item $MaterialFile
    source_system = "UAT"
    source_tx_id = "UAT-MAT-$Stamp"
    source_type = "MVP_TEMPLATE"
}
Save-JsonEvidence -Name "005-material-import" -Value $MaterialImport

$MaterialSearch = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/materials/search?yb_code_27=123456789012345678901234567" -Headers $Headers
Save-JsonEvidence -Name "006-material-search" -Value $MaterialSearch

Push-Location $RepoRoot
try {
    & $Python ".\tools\import_spd_sample.py" --batch-id "UAT-SPD-$Stamp"
} finally {
    Pop-Location
}

$Matched = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/v1/mapping/resolve" -Headers $Headers -ContentType "application/json" -Body (@{
    category = "material"
    source_system = "SPD"
    source_key = "SPD-MAT-001"
    source_desc = "一次性使用无菌导管 22mm"
    source_tx_id = "UAT-MAP-MAT-$Stamp"
} | ConvertTo-Json)
Save-JsonEvidence -Name "007-spd-material-resolve" -Value $Matched

$NhsaDir = Join-Path $RepoRoot "data\samples\external\nhsa"
$FullSpecFile = Join-Path $NhsaDir "H-UDMP-SAMPLE-NHSA-C09-FULL-SPEC-v1.0.xlsx"
$DisabledFile = Join-Path $NhsaDir "H-UDMP-SAMPLE-NHSA-DISABLED-v1.0.xlsx"
$TranscodeFile = Join-Path $NhsaDir "H-UDMP-SAMPLE-NHSA-TRANSCODE-v1.0.xlsx"

$FullSpecImport = Invoke-FormPost -Path "/api/v1/materials/import" -Form @{
    file = Get-Item $FullSpecFile
    source_system = "UAT"
    source_tx_id = "UAT-NHSA-FULL-$Stamp"
    source_type = "NHSA_FULL_SPEC"
    sheet_name = "Query1"
}
Save-JsonEvidence -Name "008-nhsa-full-import" -Value $FullSpecImport

$DisabledImport = Invoke-FormPost -Path "/api/v1/materials/import" -Form @{
    file = Get-Item $DisabledFile
    source_system = "UAT"
    source_tx_id = "UAT-NHSA-DISABLED-$Stamp"
    source_type = "NHSA_DISABLED"
    sheet_name = "Query1"
}
Save-JsonEvidence -Name "009-nhsa-disabled-import" -Value $DisabledImport

$TranscodeImport = Invoke-FormPost -Path "/api/v1/materials/import" -Form @{
    file = Get-Item $TranscodeFile
    source_system = "UAT"
    source_tx_id = "UAT-NHSA-TRANSCODE-$Stamp"
    source_type = "NHSA_TRANSCODE"
    sheet_name = "Query1"
}
Save-JsonEvidence -Name "010-nhsa-transcode-import" -Value $TranscodeImport

$TranscodeQuery = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/materials/transcode/resolve?original_yb_code_27=C07020813700004165590000001" -Headers $Headers
Save-JsonEvidence -Name "011-transcode-query" -Value $TranscodeQuery

$Pending = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/v1/mapping/resolve" -Headers $Headers -ContentType "application/json" -Body (@{
    category = "material"
    source_system = "SPD"
    source_key = "SPD-MAT-UAT-UNKNOWN-$Stamp"
    source_desc = "UAT unknown material"
    source_tx_id = "UAT-MAP-PENDING-$Stamp"
} | ConvertTo-Json)
Save-JsonEvidence -Name "012-pending-review" -Value $Pending

$ReviewTasks = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/mapping/review-tasks?source_system=SPD&status=PENDING&page_size=20" -Headers $Headers
Save-JsonEvidence -Name "013-review-tasks" -Value $ReviewTasks

$Logs = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/exchange/logs?source_system=SPD&page_size=20" -Headers $Headers
Save-JsonEvidence -Name "014-exchange-logs" -Value $Logs

$InvalidSource = $null
try {
    Invoke-FormPost -Path "/api/v1/materials/import" -Form @{
        file = Get-Item $MaterialFile
        source_system = "UAT"
        source_tx_id = "UAT-INVALID-SOURCE-$Stamp"
        source_type = "UNKNOWN"
    }
} catch {
    $InvalidSource = $_.ErrorDetails.Message | ConvertFrom-Json
}
Save-JsonEvidence -Name "015-invalid-source-type" -Value $InvalidSource

Write-Host "H-UDMP UAT demo finished. Evidence directory: $EvidencePath"
