#Requires -Version 5.1
<#
.SYNOPSIS
  Clone BO/ad project to a separate folder for full local testing (isolated from production).

.EXAMPLE
  .\clone-local.ps1
  .\clone-local.ps1 -TargetDir "C:\xampp\htdocs\BO\ad-local-test"
#>
param(
  [string]$SourceDir = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
  [string]$TargetDir = (Join-Path (Split-Path $SourceDir -Parent) "ad-local-test")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourceDir)) {
  throw "Source not found: $SourceDir"
}

if ((Resolve-Path $SourceDir).Path -eq (Resolve-Path $TargetDir -ErrorAction SilentlyContinue).Path) {
  throw "Target must differ from source."
}

Write-Host "=== BOU Local Test Clone ===" -ForegroundColor Cyan
Write-Host "Source : $SourceDir"
Write-Host "Target : $TargetDir"
Write-Host ""

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

$excludeDirs = @(
  "node_modules",
  ".git",
  "frontend\node_modules",
  "backend\node_modules",
  "frontend\dist",
  "backend\uploads",
  "backend\uploads-localtest"
)

$excludeFiles = @(
  "backend\.env",
  "backend\.env.localtest",
  "frontend\.env.localtest",
  "backend\startup_debug.log"
)

$robocopyArgs = @(
  $SourceDir,
  $TargetDir,
  "/E",
  "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP",
  "/XD"
) + $excludeDirs + @("/XF") + $excludeFiles

& robocopy @robocopyArgs | Out-Null
# robocopy exit 0-7 = success
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

Write-Host "Copy complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  cd `"$TargetDir`""
Write-Host "  .\scripts\local-test\setup-clone.ps1"
Write-Host "  .\scripts\local-test\start-local-test.ps1"
