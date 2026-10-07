$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check .\core\engine\telemetry-bridge.mjs
  if($LASTEXITCODE -ne 0){throw "Telemetry bridge syntax failed"}
  node --check .\core\engine\aledevos.mjs
  if($LASTEXITCODE -ne 0){throw "AleDevOS core syntax failed"}
  node --test .\tests\auto-telemetry-v1.test.mjs
  if($LASTEXITCODE -ne 0){throw "Auto-Telemetry V1 tests failed"}
  Write-Host 'AUTO_TELEMETRY_V1_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
