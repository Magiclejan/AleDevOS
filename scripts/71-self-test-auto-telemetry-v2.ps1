$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check .\core\agent-runtime\agent-runtime.mjs
  if($LASTEXITCODE -ne 0){throw 'Agent runtime syntax failed'}
  node --check .\core\engine\telemetry-bridge.mjs
  if($LASTEXITCODE -ne 0){throw 'Telemetry bridge syntax failed'}
  node --test .\tests\auto-telemetry-v2.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Auto-Telemetry V2 tests failed'}
  Write-Host 'AUTO_TELEMETRY_V2_SELF_TEST_PASS' -ForegroundColor Green
} finally {
  Pop-Location
}
