#Requires -Version 5.1
<#
.SYNOPSIS
  Prepare env files, install deps, and create local test database in a clone (or same repo).
#>
param(
  [string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
  [string]$DbName = "BOU_LOCAL_TEST",
  [string]$MysqlBin = "C:\xampp\mysql\bin\mysql.exe"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host "=== Setup local test environment ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host ""

function Copy-EnvExample {
  param([string]$Example, [string]$Target)
  if (-not (Test-Path $Example)) { throw "Missing $Example" }
  if (-not (Test-Path $Target)) {
    Copy-Item $Example $Target
    Write-Host "Created $Target" -ForegroundColor Green
  } else {
    Write-Host "Keep existing $Target" -ForegroundColor DarkYellow
  }
}

Copy-EnvExample "backend\.env.localtest.example" "backend\.env.localtest"
Copy-EnvExample "frontend\.env.localtest.example" "frontend\.env.localtest"

Write-Host ""
Write-Host "Installing npm packages..." -ForegroundColor Cyan
Push-Location backend
if (-not (Test-Path "node_modules")) { npm install }
else { Write-Host "backend node_modules exists - skip" }
Pop-Location
Push-Location frontend
if (-not (Test-Path "node_modules")) {
  npm install --legacy-peer-deps
  if ($LASTEXITCODE -ne 0) {
    Write-Host "frontend npm install failed - run manually: npm install --legacy-peer-deps" -ForegroundColor Yellow
  }
} else {
  Write-Host "frontend node_modules exists - skip" }
Pop-Location

Write-Host ""
Write-Host "Creating database '$DbName'..." -ForegroundColor Cyan
if (-not (Test-Path $MysqlBin)) {
  Write-Host "MySQL CLI not found at $MysqlBin - skip DB init. Import database/bou_schema.sql manually with DB name $DbName" -ForegroundColor Yellow
} else {
  $schemaPath = Join-Path $ProjectRoot "database\bou_schema.sql"
  if (-not (Test-Path $schemaPath)) { throw "Missing $schemaPath" }

  $sql = Get-Content $schemaPath -Raw -Encoding UTF8
  $quotedDb = [char]96 + $DbName + [char]96
  $sql = $sql.Replace([char]96 + 'BOU' + [char]96, $quotedDb)

  try {
    $sql | & $MysqlBin -u root 2>&1 | ForEach-Object { Write-Host $_ }
    Write-Host "Database '$DbName' ready." -ForegroundColor Green
  } catch {
    Write-Host "Could not init database - start XAMPP MySQL first, then re-run setup-clone.ps1" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Run: .\scripts\local-test\start-local-test.ps1"
Write-Host "Open: http://localhost:5174"
Write-Host "API : http://localhost:3002/api"
