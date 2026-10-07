$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Write-Host '===== MASTER VALIDATION P5 SELF-TEST =====' -ForegroundColor Cyan
& node --test (Join-Path $root 'tests\master-validation-phase5.test.mjs')
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& node (Join-Path $root 'release\templates\master-validation-p5-certifier.mjs') certify verify --root $root --certificate (Join-Path $root 'release\certifications\master-validation-p5.json')
exit $LASTEXITCODE
