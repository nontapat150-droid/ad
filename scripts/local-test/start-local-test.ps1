#Requires -Version 5.1
<#
.SYNOPSIS
  Start backend (3002) + frontend (5174) for local test clone.
#>
param(
  [string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

$backendEnv = Join-Path $ProjectRoot "backend\.env.localtest"
$frontendEnv = Join-Path $ProjectRoot "frontend\.env.localtest"

if (-not (Test-Path $backendEnv) -or -not (Test-Path $frontendEnv)) {
  Write-Host "Missing .env.localtest — run setup-clone.ps1 first" -ForegroundColor Red
  exit 1
}

Write-Host "=== Starting BOU local test ===" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5174"
Write-Host "Backend : http://localhost:3002/api"
Write-Host "Press Ctrl+C in each terminal to stop."
Write-Host ""

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$ProjectRoot\backend'; npm run dev:localtest"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$ProjectRoot\frontend'; npm run dev:localtest"
)

Write-Host "Started 2 terminals (backend + frontend)." -ForegroundColor Green
