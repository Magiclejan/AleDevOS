$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Write-Host '=== ContextOS Phase 1 self-test ===' -ForegroundColor Cyan
node (Join-Path $root 'contextos\engine\contextos.mjs') self-test
if($LASTEXITCODE -ne 0){throw 'ContextOS runtime self-test failed.'}
node --test (Join-Path $root 'tests\contextos-phase1.test.mjs')
if($LASTEXITCODE -ne 0){throw 'ContextOS Phase 1 tests failed.'}
Write-Host 'ContextOS Phase 1 PASS' -ForegroundColor Green
