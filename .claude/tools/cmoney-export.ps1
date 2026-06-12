<#
.SYNOPSIS
    打包 /cmoney-board skill 與長期記憶，方便搬到另一台電腦。
.DESCRIPTION
    把以下兩份內容壓成一個 zip：
      1. cmoney-board skill  (.claude\skills\cmoney-board\)
      2. 長期記憶資料夾        (~\.claude\projects\<專案編碼>\memory\)
    產出檔放在桌面，檔名 cmoney-board-bundle.zip。
.EXAMPLE
    pwsh -File .\.claude\tools\cmoney-export.ps1
#>

$ErrorActionPreference = 'Stop'

# --- 來源路徑（本機）---
$RepoRoot   = 'C:\TA_rpa'
$SkillDir   = Join-Path $RepoRoot '.claude\skills\cmoney-board'
$MemoryDir  = Join-Path $env:USERPROFILE '.claude\projects\C--TA-rpa\memory'

# --- 暫存打包區 ---
$Stage = Join-Path $env:TEMP ('cmoney-bundle-' + (Get-Random))
$null  = New-Item -ItemType Directory -Path $Stage -Force
$null  = New-Item -ItemType Directory -Path (Join-Path $Stage 'skill')  -Force
$null  = New-Item -ItemType Directory -Path (Join-Path $Stage 'memory') -Force

# --- 複製 skill ---
if (Test-Path $SkillDir) {
    Copy-Item (Join-Path $SkillDir '*') (Join-Path $Stage 'skill') -Recurse -Force
    Write-Host "[OK] skill   ->" $SkillDir -ForegroundColor Green
} else {
    Write-Warning "找不到 skill 資料夾: $SkillDir"
}

# --- 複製 memory ---
if (Test-Path $MemoryDir) {
    Copy-Item (Join-Path $MemoryDir '*') (Join-Path $Stage 'memory') -Recurse -Force
    Write-Host "[OK] memory  ->" $MemoryDir -ForegroundColor Green
} else {
    Write-Warning "找不到 memory 資料夾: $MemoryDir （可能尚未建立任何記憶）"
}

# --- 壓縮到桌面 ---
$OutZip = Join-Path ([Environment]::GetFolderPath('Desktop')) 'cmoney-board-bundle.zip'
if (Test-Path $OutZip) { Remove-Item $OutZip -Force }
Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $OutZip -Force

Remove-Item $Stage -Recurse -Force
Write-Host ""
Write-Host "打包完成 ->" $OutZip -ForegroundColor Cyan
Write-Host "把這個 zip 連同 cmoney-import.ps1 一起搬到新電腦，再執行 import 即可。"
