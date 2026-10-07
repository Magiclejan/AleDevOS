$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --test tests/security-reliability-phase8.test.mjs
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  node release/templates/master-validation-p8-certifier.mjs certify run --root $root --out release/certifications/master-validation-p8.json
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  node release/templates/master-validation-p8-certifier.mjs certify verify --root $root --certificate release/certifications/master-validation-p8.json
  exit $LASTEXITCODE
} finally { Pop-Location }
