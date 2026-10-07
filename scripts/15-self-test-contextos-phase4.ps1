$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Write-Host '=== ContextOS Phase 4 self-test ===' -ForegroundColor Cyan
node (Join-Path $root 'contextos\engine\contextos.mjs') self-test
if($LASTEXITCODE -ne 0){throw 'ContextOS runtime self-test failed.'}
node --test `
  (Join-Path $root 'tests\core-engine.test.mjs') `
  (Join-Path $root 'tests\contextos-phase1.test.mjs') `
  (Join-Path $root 'tests\contextos-phase2.test.mjs') `
  (Join-Path $root 'tests\contextos-phase3.test.mjs') `
  (Join-Path $root 'tests\contextos-phase4.test.mjs')
if($LASTEXITCODE -ne 0){throw 'AleDevOS Core + ContextOS Phase 1+2+3+4 tests failed.'}
Write-Host 'ContextOS Phase 4 PASS (63/63)' -ForegroundColor Green
