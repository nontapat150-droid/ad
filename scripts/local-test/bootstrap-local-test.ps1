#Requires -Version 5.1
<#
.SYNOPSIS
  One-shot: clone + setup (does not auto-start servers).
#>
param(
  [string]$TargetDir = (Join-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) "ad-local-test")
)

$ErrorActionPreference = "Stop"

& "$PSScriptRoot\clone-local.ps1" -TargetDir $TargetDir
Push-Location $TargetDir
& "$PSScriptRoot\setup-clone.ps1" -ProjectRoot $TargetDir
Pop-Location

Write-Host ""
Write-Host "=== All done ===" -ForegroundColor Green
Write-Host "Test clone at: $TargetDir"
Write-Host "Start with: cd `"$TargetDir`"; .\scripts\local-test\start-local-test.ps1"
