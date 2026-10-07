$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --test tests/skill-system-phase5.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Skill System Phase 5 tests failed.'}
  node --check skillsystem/engine/acquisition.mjs
  if($LASTEXITCODE -ne 0){throw 'Acquisition runtime syntax check failed.'}
  Write-Host 'SKILL_SYSTEM_PHASE5_SELF_TEST_PASS' -ForegroundColor Green
} finally {Pop-Location}
