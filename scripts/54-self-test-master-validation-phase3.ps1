$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  & node --test tests/master-validation-phase3.test.mjs
  if($LASTEXITCODE -ne 0){throw 'MASTER_VALIDATION_P3_TESTS_FAILED'}
  & node release/templates/master-validation-p3-certifier.mjs certify verify --root $root --certificate (Join-Path $root 'release/certifications/master-validation-p3.json')
  if($LASTEXITCODE -ne 0){throw 'MASTER_VALIDATION_P3_CERTIFICATE_INVALID'}
} finally { Pop-Location }
