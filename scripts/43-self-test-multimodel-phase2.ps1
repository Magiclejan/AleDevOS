$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Push-Location $Root
try {
  node --test tests/multimodel-phase2.test.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node multimodel/router/model-router.mjs policy verify
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node multimodel/router/model-router.mjs certify verify --certificate release/certifications/multimodel-p2.json
  exit $LASTEXITCODE
} finally { Pop-Location }
