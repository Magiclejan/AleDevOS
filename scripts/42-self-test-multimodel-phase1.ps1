$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host '=== Multi-Model P1 — Second Judge Model ===' -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '41-self-test-portability-phase6.ps1')
  if($LASTEXITCODE -ne 0){throw 'Frozen stack regression failed.'}
  & node --test tests/multimodel-phase1.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Multi-Model P1 tests failed.'}
  & node multimodel/engine/multimodel.mjs registry verify
  if($LASTEXITCODE -ne 0){throw 'Model registry verification failed.'}
  & node multimodel/engine/multimodel.mjs certify run --out release/certifications/multimodel-p1.json
  if($LASTEXITCODE -ne 0){throw 'Multi-Model P1 certification failed.'}
  & node multimodel/engine/multimodel.mjs certify verify --certificate release/certifications/multimodel-p1.json
  if($LASTEXITCODE -ne 0){throw 'Multi-Model P1 certificate verification failed.'}
  $mjs=@(Get-ChildItem $root -Recurse -File -Filter '*.mjs'); foreach($f in $mjs){& node --check $f.FullName *> $null;if($LASTEXITCODE -ne 0){throw "MJS syntax failed: $($f.FullName)"}}
  $json=@(Get-ChildItem $root -Recurse -File -Filter '*.json'); foreach($f in $json){$null=Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop}
  Write-Host 'Multi-Model P1 PASS. Cumulative deterministic floor: 941/941.' -ForegroundColor Green
} finally {Pop-Location}
