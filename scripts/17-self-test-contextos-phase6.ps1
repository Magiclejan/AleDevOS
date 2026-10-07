$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check .\contextos\engine\telemetry.mjs
  node --check .\contextos\engine\contextos.mjs
  node --test .\tests\contextos-phase6.test.mjs
  if($LASTEXITCODE -ne 0){throw "ContextOS Phase 6 tests failed"}
  node --test .\tests\*.test.mjs
  if($LASTEXITCODE -ne 0){throw "Cumulative test suite failed"}
  Write-Host 'CONTEXTOS_PHASE6_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
