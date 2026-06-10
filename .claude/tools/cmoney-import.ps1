<#
.SYNOPSIS
    在新電腦上還原 /cmoney-board skill 與長期記憶。
.DESCRIPTION
    解開 cmoney-board-bundle.zip，把內容放回正確位置：
      1. skill  -> <RepoPath>\.claude\skills\cmoney-board\
      2. memory -> ~\.claude\projects\<依 RepoPath 自動編碼>\memory\
    memory 的資料夾名稱依專案路徑編碼，故 -RepoPath 必須是新電腦上 repo 的實際位置。
.PARAMETER ZipPath
    cmoney-board-bundle.zip 的路徑。預設找桌面。
.PARAMETER RepoPath
    新電腦上專案根目錄。預設 C:\TA_rpa。
.EXAMPLE
    pwsh -File .\cmoney-import.ps1
.EXAMPLE
    pwsh -File .\cmoney-import.ps1 -RepoPath 'D:\work\TA_rpa' -ZipPath 'D:\dl\cmoney-board-bundle.zip'
#>

param(
    [string]$ZipPath  = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'cmoney-board-bundle.zip'),
    [string]$RepoPath = 'C:\TA_rpa'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ZipPath)) { throw "找不到 zip: $ZipPath" }

# --- 依 RepoPath 計算 memory 專案編碼（非英數字元 -> '-'）---
$encoded   = ($RepoPath -replace '[^A-Za-z0-9]', '-')
$SkillDest = Join-Path $RepoPath '.claude\skills\cmoney-board'
$MemDest   = Join-Path $env:USERPROFILE (".claude\projects\$encoded\memory")

Write-Host "RepoPath      :" $RepoPath
Write-Host "skill  還原到 :" $SkillDest
Write-Host "memory 還原到 :" $MemDest -ForegroundColor Yellow
Write-Host "(memory 資料夾名稱 '$encoded' 由 RepoPath 推導；若 Claude Code 實際用的編碼不同，請改 -RepoPath)"
Write-Host ""

# --- 解壓到暫存 ---
$Stage = Join-Path $env:TEMP ('cmoney-restore-' + (Get-Random))
$null  = New-Item -ItemType Directory -Path $Stage -Force
Expand-Archive -Path $ZipPath -DestinationPath $Stage -Force

# --- 還原 skill ---
$srcSkill = Join-Path $Stage 'skill'
if (Test-Path $srcSkill) {
    $null = New-Item -ItemType Directory -Path $SkillDest -Force
    Copy-Item (Join-Path $srcSkill '*') $SkillDest -Recurse -Force
    Write-Host "[OK] skill 已還原" -ForegroundColor Green
}

# --- 還原 memory（合併，不覆蓋既有同名以外的檔）---
$srcMem = Join-Path $Stage 'memory'
if ((Test-Path $srcMem) -and (Get-ChildItem $srcMem -ErrorAction SilentlyContinue)) {
    $null = New-Item -ItemType Directory -Path $MemDest -Force
    Copy-Item (Join-Path $srcMem '*') $MemDest -Recurse -Force
    Write-Host "[OK] memory 已還原" -ForegroundColor Green
} else {
    Write-Host "[--] bundle 內沒有 memory 內容，略過" -ForegroundColor DarkGray
}

Remove-Item $Stage -Recurse -Force
Write-Host ""
Write-Host "完成。在" $RepoPath "啟動 Claude Code，輸入 /cmoney-board 即可。" -ForegroundColor Cyan
