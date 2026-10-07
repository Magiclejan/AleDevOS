$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host '=== Portability P5 — Google Antigravity + Gemini Compatibility ===' -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '39-self-test-portability-phase4.ps1')
  if($LASTEXITCODE -ne 0){throw 'Frozen Portability P1-P4 regression failed.'}
  & node --test tests/portability-phase5.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Portability P5 tests failed.'}
  & node adapters/antigravity/certification/antigravity-certifier.mjs certify run --root . --out ANTIGRAVITY_ADAPTER_CERTIFICATE.json
  if($LASTEXITCODE -ne 0){throw 'Antigravity adapter certification failed.'}
  foreach($adapter in @('opencode','codex','claude-code','antigravity','gemini')){
    & node core/adapter-runtime/adapter.mjs compatibility check --root . --adapter $adapter --profile full_current
    if($LASTEXITCODE -ne 0){throw "$adapter full_current compatibility failed."}
  }
  & node core/adapter-runtime/adapter.mjs install check --root . --adapter antigravity
  if($LASTEXITCODE -ne 0){throw 'Antigravity installability failed.'}
  & node core/adapter-runtime/adapter.mjs install check --root . --adapter gemini
  if($LASTEXITCODE -ne 0){throw 'Gemini compatibility alias installability failed.'}
  $mjs=@(Get-ChildItem $root -Recurse -File -Filter '*.mjs'); foreach($f in $mjs){& node --check $f.FullName *> $null;if($LASTEXITCODE -ne 0){throw "MJS syntax failed: $($f.FullName)"}}
  $json=@(Get-ChildItem $root -Recurse -File -Filter '*.json'); foreach($f in $json){$null=Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop}
  $toml=@(Get-ChildItem (Join-Path $root 'adapters\codex\.codex') -Recurse -File -Filter '*.toml')
  if($toml.Count -lt 25){throw "Codex TOML floor failed: $($toml.Count) < 25"}
  if($mjs.Count -lt 66){throw "MJS floor failed: $($mjs.Count) < 66"}
  if($json.Count -lt 146){throw "JSON floor failed: $($json.Count) < 146"}
  Write-Host 'Portability P5 PASS. Cumulative deterministic floor: 818/818.' -ForegroundColor Green
} finally {Pop-Location}
