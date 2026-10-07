$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Push-Location $Root
try {
  node --test tests/multimodel-phase3.test.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node multimodel/extensions/diversity/judge-diversity.mjs policy verify
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node multimodel/extensions/diversity/judge-diversity.mjs certify verify --certificate release/certifications/multimodel-p3.json
  exit $LASTEXITCODE
} finally { Pop-Location }
