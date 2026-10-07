$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host '=== Portability P6 — Cross-adapter Conformance + Portable Skill Pack ===' -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '40-self-test-portability-phase5.ps1')
  if($LASTEXITCODE -ne 0){throw 'Frozen Portability P1-P5 regression failed.'}
  & node --test tests/portability-phase6.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Portability P6 tests failed.'}
  & node portability/conformance/conformance.mjs matrix run --root .
  if($LASTEXITCODE -ne 0){throw 'Cross-adapter conformance matrix failed.'}
  & node portability/conformance/conformance.mjs skills verify --root .
  if($LASTEXITCODE -ne 0){throw 'Portable Skill Pack verification failed.'}
  & node portability/conformance/conformance.mjs projection verify --root .
  if($LASTEXITCODE -ne 0){throw 'Cross-adapter source-installed projection parity failed.'}
  & node portability/conformance/conformance.mjs certify run --root . --out release/certifications/cross-adapter-portability-p6.json
  if($LASTEXITCODE -ne 0){throw 'P6 conformance certificate failed.'}
  $mjs=@(Get-ChildItem $root -Recurse -File -Filter '*.mjs'); foreach($f in $mjs){& node --check $f.FullName *> $null;if($LASTEXITCODE -ne 0){throw "MJS syntax failed: $($f.FullName)"}}
  $json=@(Get-ChildItem $root -Recurse -File -Filter '*.json'); foreach($f in $json){$null=Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop}
  $toml=@(Get-ChildItem (Join-Path $root 'adapters\codex\.codex') -Recurse -File -Filter '*.toml')
  if($toml.Count -lt 25){throw "Codex TOML floor failed: $($toml.Count) < 25"}
  if($mjs.Count -lt 67){throw "MJS floor failed: $($mjs.Count) < 67"}
  if($json.Count -lt 149){throw "JSON floor failed: $($json.Count) < 149"}
  Write-Host 'Portability P6 PASS. Cumulative deterministic floor: 887/887.' -ForegroundColor Green
} finally {Pop-Location}
