$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --test tests/skill-system-phase2.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Skill System Phase 2 tests failed.'}
  Write-Host 'SKILL_SYSTEM_PHASE2_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
