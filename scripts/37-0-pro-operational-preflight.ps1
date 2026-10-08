param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$engine = Join-Path $root 'certification\pro\engine\p37-operational.mjs'
if (-not (Test-Path -LiteralPath $engine)) { throw 'P37_0_ENGINE_MISSING' }
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$gitExe = (Get-Command git -ErrorAction Stop).Source
$revision = (& $gitExe -C $root rev-parse --verify HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[a-f0-9]{40}$') { throw 'P37_0_GIT_HEAD_UNVERIFIED' }

# This stage verifies source-bound planned targets, not AI calls or model output.
$raw = @(& $nodeExe $engine plan --root $root)
if ($LASTEXITCODE -ne 0) { throw "P37_0_MATRIX_BLOCKED exit=$LASTEXITCODE" }
$plan = (($raw -join [Environment]::NewLine) | ConvertFrom-Json)
if ($plan.required_total -ne 156 -or $plan.pro_certified -ne 0 -or $plan.git_sha -ne $revision) {
  throw 'P37_0_MATRIX_OR_COMMIT_MISMATCH'
}
$targets = @($plan.targets)
if ($targets.Count -ne 156 -or @($targets | Where-Object { $_.status -ne 'BLOCKED' }).Count -ne 0) {
  throw 'P37_0_FALSE_RUNTIME_EVIDENCE'
}
$stateRoot = Join-Path $root '.aledevos\state\certification\p37'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$summary = [ordered]@{
  schema_version = '1.0'
  phase = 'P37.0'
  status = 'STRUCTURAL_PREFLIGHT_ONLY'
  git_sha = $revision
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
  targets_planned = 156
  skills = 52
  agents = 100
  workflows = 4
  operational_executions_observed = 0
  pro_certified = 0
  next = 'P37.1_REAL_ADAPTER_EXECUTION_REQUIRED'
}
$out = Join-Path $stateRoot 'preflight.json'
[System.IO.File]::WriteAllText($out, (($summary | ConvertTo-Json -Depth 5) + [Environment]::NewLine), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "P37_0_PREFLIGHT_PASS source_plan=156 skills=52 agents=100 workflows=4"
Write-Host "P37_0_PRO_CERTIFIED=0 real_executions=0"
Write-Host "P37_0_EVIDENCE_PATH=$out"
Write-Host "P37_0_NEXT=P37.1_REAL_ADAPTER_EXECUTION_REQUIRED"
