$ErrorActionPreference = "Stop"
Write-Host "=== Install OpenCode V2 (native Windows) ===" -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Warning "npm/Node.js is not installed."
  Write-Host "Install Node.js LTS, reopen PowerShell, then rerun this script."
  Write-Host "winget install OpenJS.NodeJS.LTS"
  exit 2
}

Write-Host "Installing/updating the current OpenCode V2 CLI package..."
npm install -g --allow-scripts=@opencode/cli @opencode/cli
if ($LASTEXITCODE -ne 0) {
  throw "OpenCode npm installation failed (exit $LASTEXITCODE)."
}

# Refresh command discovery for the current process when npm global bin is already on PATH.
$cmd = Get-Command opencode -ErrorAction SilentlyContinue
if (-not $cmd) {
  Write-Warning "OpenCode installed but is not visible in this PowerShell process yet."
  Write-Host "Close and reopen PowerShell, then run: opencode --version"
  exit 3
}

Write-Host "OpenCode version:" -ForegroundColor Green
opencode --version

Write-Host ""
Write-Host "OpenCode V2 is installed." -ForegroundColor Green
Write-Host "AleDevOS installs only its OpenCode adapter configuration. Provider/model setup remains external and user-controlled."
Write-Host "No paid OpenCode provider is required for this stack."
