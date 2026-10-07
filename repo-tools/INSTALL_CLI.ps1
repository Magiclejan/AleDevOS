param()

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$CliSource = Join-Path $RepoRoot 'cli\aledevos.ps1'

if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
  throw "Run this script from the canonical Magiclejan/AleDevOS checkout."
}
if (-not (Test-Path $CliSource)) {
  throw "ALEDEVOS_CLI_SOURCE_NOT_FOUND: $CliSource"
}

$stateRoot = Join-Path $env:LOCALAPPDATA 'AleDevOS'
$binRoot = Join-Path $stateRoot 'bin'
New-Item -ItemType Directory -Force -Path $binRoot | Out-Null

$cliDest = Join-Path $binRoot 'aledevos.ps1'
Copy-Item -LiteralPath $CliSource -Destination $cliDest -Force

$config = [ordered]@{
  schema_version = '1.0'
  canonical_root = $RepoRoot
}
$config | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $stateRoot 'cli.json')

$cmd = '@echo off' + [Environment]::NewLine +
       'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\AleDevOS\bin\aledevos.ps1" %*'
Set-Content -Encoding ASCII -Path (Join-Path $binRoot 'aledevos.cmd') -Value $cmd

$currentUserPath = [Environment]::GetEnvironmentVariable('Path','User')
$parts = @()
if ($currentUserPath) {
  $parts = $currentUserPath -split ';' | Where-Object { $_ }
}

if ($parts -notcontains $binRoot) {
  $newPath = if ($currentUserPath) { "$currentUserPath;$binRoot" } else { $binRoot }
  [Environment]::SetEnvironmentVariable('Path',$newPath,'User')
  Write-Host "[OK] Added to User PATH: $binRoot" -ForegroundColor Green
} else {
  Write-Host "[OK] PATH already configured." -ForegroundColor Green
}

if (($env:Path -split ';') -notcontains $binRoot) {
  $env:Path = "$env:Path;$binRoot"
}

Write-Host ""
Write-Host "AleDevOS CLI installed." -ForegroundColor Green
Write-Host "Canonical source: $RepoRoot"
Write-Host ""
Write-Host "Open a NEW terminal and, inside any project folder, run:"
Write-Host ""
Write-Host "  aledevos init" -ForegroundColor Cyan
