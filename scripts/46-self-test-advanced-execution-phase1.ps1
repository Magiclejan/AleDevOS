$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Push-Location $Root
try {
  node --test tests/advanced-execution-phase1.test.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node advanced-execution/worktrees/worktree-manager.mjs policy verify
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node advanced-execution/worktrees/worktree-manager.mjs certify verify --certificate release/certifications/advanced-execution-p1.json
  exit $LASTEXITCODE
} finally { Pop-Location }
