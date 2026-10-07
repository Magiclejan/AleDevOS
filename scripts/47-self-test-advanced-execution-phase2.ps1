$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Push-Location $Root
try {
  node --test tests/advanced-execution-phase2.test.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node advanced-execution/workers/worker-manager.mjs policy verify
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node advanced-execution/worktrees/worktree-manager.mjs certify verify --certificate release/certifications/advanced-execution-p1.json
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node advanced-execution/workers/worker-manager.mjs certify verify --certificate release/certifications/advanced-execution-p2.json
  exit $LASTEXITCODE
} finally { Pop-Location }
