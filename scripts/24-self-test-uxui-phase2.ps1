$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host 'Running AleDevOS cumulative deterministic suite through UX/UI Phase 2...' -ForegroundColor Cyan
  node --test tests/*.test.mjs
  if($LASTEXITCODE -ne 0){throw 'UX/UI Phase 2 test suite failed.'}
  Write-Host 'UXUI_PHASE2_SELF_TEST_PASS (259/259)' -ForegroundColor Green
} finally { Pop-Location }
