$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --test tests/skill-system-phase4.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Skill System Phase 4 tests failed.'}
  Write-Host 'SKILL_SYSTEM_PHASE4_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
