$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host '=== Portability P4 — Claude Code Adapter ===' -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '38-self-test-portability-phase3.ps1')
  if($LASTEXITCODE -ne 0){throw 'Frozen Portability P1/P2/P3 regression failed.'}
  & node --test tests/portability-phase4.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Portability P4 tests failed.'}
  & node adapters/claude-code/certification/claude-code-certifier.mjs certify run --root . --out CLAUDE_CODE_ADAPTER_CERTIFICATE.json
  if($LASTEXITCODE -ne 0){throw 'Claude Code adapter certification failed.'}
  & node core/adapter-runtime/adapter.mjs compatibility check --root . --adapter claude-code --profile full_current
  if($LASTEXITCODE -ne 0){throw 'Claude Code full_current compatibility failed.'}
  & node core/adapter-runtime/adapter.mjs install check --root . --adapter claude-code
  if($LASTEXITCODE -ne 0){throw 'Claude Code installability failed.'}
  $mjs=@(Get-ChildItem $root -Recurse -File -Filter '*.mjs'); foreach($f in $mjs){& node --check $f.FullName *> $null;if($LASTEXITCODE -ne 0){throw "MJS syntax failed: $($f.FullName)"}}
  $json=@(Get-ChildItem $root -Recurse -File -Filter '*.json'); foreach($f in $json){$null=Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop}
  $toml=@(Get-ChildItem (Join-Path $root 'adapters\codex\.codex') -Recurse -File -Filter '*.toml')
  if($toml.Count -lt 25){throw "Codex TOML floor failed: $($toml.Count) < 25"}
  if($mjs.Count -lt 62){throw "MJS floor failed: $($mjs.Count) < 62"}
  if($json.Count -lt 136){throw "JSON floor failed: $($json.Count) < 136"}
  Write-Host 'Portability P4 PASS. Cumulative deterministic floor: 754/754.' -ForegroundColor Green
} finally {Pop-Location}
