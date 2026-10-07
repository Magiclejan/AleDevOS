$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host '=== Portability P2 — OpenCode Adapter Certification ===' -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '36-self-test-portability-phase1.ps1')
  if($LASTEXITCODE -ne 0){throw 'Portability P1 regression failed.'}
  & node --test tests/portability-phase2.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Portability P2 tests failed.'}
  & node adapters/opencode/certification/opencode-certifier.mjs certify run --root . --out OPENCODE_ADAPTER_CERTIFICATE.json
  if($LASTEXITCODE -ne 0){throw 'OpenCode adapter certification failed.'}
  $mjs=@(Get-ChildItem $root -Recurse -File -Filter '*.mjs'); foreach($f in $mjs){& node --check $f.FullName *> $null;if($LASTEXITCODE -ne 0){throw "MJS syntax failed: $($f.FullName)"}}
  $json=@(Get-ChildItem $root -Recurse -File -Filter '*.json'); foreach($f in $json){$null=Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop}
  if($mjs.Count -lt 55){throw "MJS floor failed: $($mjs.Count) < 55"}
  if($json.Count -lt 125){throw "JSON floor failed: $($json.Count) < 125"}
  Write-Host 'Portability P2 PASS. Cumulative deterministic floor: 641/641.' -ForegroundColor Green
} finally {Pop-Location}
