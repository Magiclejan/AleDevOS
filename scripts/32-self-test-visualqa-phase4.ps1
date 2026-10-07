$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check visualqa/engine/runtime-audit.mjs
  if($LASTEXITCODE -ne 0){throw 'runtime-audit syntax failed'}
  node --check adapters/opencode/visualqa/playwright-driver.mjs
  if($LASTEXITCODE -ne 0){throw 'Playwright provider syntax failed'}
  node --test tests/visualqa-phase4.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Visual QA Phase 4 tests failed'}
  Write-Host 'Visual QA Phase 4 self-test PASS.' -ForegroundColor Green
} finally { Pop-Location }
