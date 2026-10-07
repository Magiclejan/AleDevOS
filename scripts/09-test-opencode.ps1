$ErrorActionPreference="Stop"
Write-Host "=== OpenCode adapter smoke test ===" -ForegroundColor Cyan
if(-not(Get-Command opencode -ErrorAction SilentlyContinue)){throw "OpenCode CLI is not installed"}
$root=Split-Path -Parent $PSScriptRoot
if(-not(Test-Path (Join-Path $root "adapters\opencode\opencode.json"))){throw "AleDevOS OpenCode adapter config missing"}
Write-Host "OpenCode CLI present and AleDevOS adapter config available." -ForegroundColor Green
Write-Host "Provider/model connectivity is validated only by explicit runtime E2E tests." -ForegroundColor Cyan
