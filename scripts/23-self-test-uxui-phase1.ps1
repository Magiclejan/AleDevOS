$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check .\uxui\engine\uxui.mjs
  if($LASTEXITCODE -ne 0){throw 'UX/UI runtime syntax check failed.'}
  node --test .\tests\uxui-phase1.test.mjs
  if($LASTEXITCODE -ne 0){throw 'UX/UI Phase 1 tests failed.'}
  node --test .\tests\*.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Cumulative test suite failed.'}
  Write-Host 'UXUI_PHASE1_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
