$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --test tests/uxui-phase6.test.mjs
  if($LASTEXITCODE -ne 0){throw 'UX/UI Phase 6 self-test failed.'}
  Write-Host 'UXUI_PHASE6_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
