$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --test tests/uxui-phase3.test.mjs
  if($LASTEXITCODE -ne 0){throw 'UX/UI Phase 3 tests failed.'}
  Write-Host 'UXUI_PHASE3_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
