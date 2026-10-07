$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check .\skillsystem\engine\skillsystem.mjs
  if($LASTEXITCODE -ne 0){throw "Skill System engine syntax check failed"}
  node --test .\tests\skill-system-phase1.test.mjs
  if($LASTEXITCODE -ne 0){throw "Skill System Phase 1 tests failed"}
  node --test .\tests\*.test.mjs
  if($LASTEXITCODE -ne 0){throw "Cumulative deterministic suite failed"}
  Write-Host 'SKILL_SYSTEM_PHASE1_SELF_TEST_PASS' -ForegroundColor Green
} finally { Pop-Location }
