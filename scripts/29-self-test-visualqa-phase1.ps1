$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --test tests/visualqa-phase1.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Visual QA Phase 1 self-test failed.'}
  Write-Host 'VISUALQA_PHASE1_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
