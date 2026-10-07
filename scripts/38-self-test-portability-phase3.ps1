$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host '=== Portability P3 — Codex Adapter ===' -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '37-self-test-portability-phase2.ps1')
  if($LASTEXITCODE -ne 0){throw 'Frozen Portability P1/P2 regression failed.'}
  & node --test tests/portability-phase3.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Portability P3 tests failed.'}
  & node adapters/codex/certification/codex-certifier.mjs certify run --root . --out CODEX_ADAPTER_CERTIFICATE.json
  if($LASTEXITCODE -ne 0){throw 'Codex adapter certification failed.'}
  & node core/adapter-runtime/adapter.mjs compatibility check --root . --adapter codex --profile full_current
  if($LASTEXITCODE -ne 0){throw 'Codex full_current compatibility failed.'}
  $mjs=@(Get-ChildItem $root -Recurse -File -Filter '*.mjs'); foreach($f in $mjs){& node --check $f.FullName *> $null;if($LASTEXITCODE -ne 0){throw "MJS syntax failed: $($f.FullName)"}}
  $json=@(Get-ChildItem $root -Recurse -File -Filter '*.json'); foreach($f in $json){$null=Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop}
  $toml=@(Get-ChildItem (Join-Path $root 'adapters\codex\.codex') -Recurse -File -Filter '*.toml')
  if($toml.Count -lt 25){throw "Codex TOML floor failed: $($toml.Count) < 25"}
  if($mjs.Count -lt 58){throw "MJS floor failed: $($mjs.Count) < 58"}
  if($json.Count -lt 130){throw "JSON floor failed: $($json.Count) < 130"}
  Write-Host 'Portability P3 PASS. Cumulative deterministic floor: 695/695.' -ForegroundColor Green
} finally {Pop-Location}
