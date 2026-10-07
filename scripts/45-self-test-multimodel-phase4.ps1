$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Push-Location $Root
try {
  node --test tests/multimodel-phase4.test.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node multimodel/extensions/fallback/model-fallback.mjs policy verify
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node multimodel/extensions/fallback/model-fallback.mjs certify verify --certificate release/certifications/multimodel-p4.json
  exit $LASTEXITCODE
} finally { Pop-Location }
