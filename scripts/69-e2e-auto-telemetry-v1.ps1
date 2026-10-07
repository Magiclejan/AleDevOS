param(
  [Parameter(Mandatory=$true)][string]$ProjectPath
)

$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$target=(Resolve-Path $ProjectPath).Path
$projectJson=Join-Path $target '.aledevos\project.json'

if(-not (Test-Path $projectJson)){
  throw "ALEDEVOS_PROJECT_NOT_FOUND: $projectJson"
}

$cfg=Get-Content $projectJson -Raw | ConvertFrom-Json
$adapter=$null
if($cfg.adapter){
  $adapter=[string]$cfg.adapter
}elseif($cfg.adapters -and @($cfg.adapters).Count -gt 0){
  $adapter=[string]@($cfg.adapters)[0]
}

if(-not $adapter){
  throw 'ALEDEVOS_ADAPTER_NOT_FOUND_IN_PROJECT_JSON'
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' ALEDEVOS AUTO-TELEMETRY V1 - CONSUMER E2E' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "Source : $root"
Write-Host "Target : $target"
Write-Host "Adapter: $adapter"

Write-Host ''
Write-Host '[1/6] Reinstalling canonical branch into consumer project...' -ForegroundColor Yellow
& (Join-Path $root 'scripts\05-install-into-project.ps1') -ProjectPath $target -Adapter $adapter -Force
if($LASTEXITCODE -ne 0){throw 'ALEDEVOS_INSTALL_FAILED'}

$runtime=Join-Path $target '.aledevos\runtime\aledevos.mjs'
$bridge=Join-Path $target '.aledevos\runtime\telemetry-bridge.mjs'

Write-Host ''
Write-Host '[2/6] Checking installed runtime syntax...' -ForegroundColor Yellow
& node --check $runtime
if($LASTEXITCODE -ne 0){throw 'INSTALLED_ALEDEVOS_RUNTIME_SYNTAX_FAILED'}
& node --check $bridge
if($LASTEXITCODE -ne 0){throw 'INSTALLED_TELEMETRY_BRIDGE_SYNTAX_FAILED'}

$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$taskId="auto-telemetry-e2e-$stamp"
$stateRel=".aledevos/state/e2e/auto-telemetry-$stamp.json"
$stateAbs=Join-Path $target $stateRel

Push-Location $target
try {
  Write-Host ''
  Write-Host '[3/6] Starting normal AleDevOS task lifecycle...' -ForegroundColor Yellow
  & node $runtime state init --task-id $taskId --adapter $adapter --benchmark-key auto-telemetry-v1 --state $stateRel
  if($LASTEXITCODE -ne 0){throw 'E2E_STATE_INIT_FAILED'}

  $state=Get-Content $stateAbs -Raw | ConvertFrom-Json
  if($state.telemetry_status -ne 'ACTIVE'){throw "TELEMETRY_NOT_ACTIVE: $($state.telemetry_status)"}
  if(-not $state.telemetry_run_id){throw 'TELEMETRY_RUN_ID_MISSING'}
  $runId=[string]$state.telemetry_run_id

  Write-Host ''
  Write-Host '[4/6] Emitting lifecycle events without telemetry CLI...' -ForegroundColor Yellow
  & node $runtime state judge --judge requirements --score 95 --blockers 0 --unverified 0 --state $stateRel
  if($LASTEXITCODE -ne 0){throw 'E2E_JUDGE_FAILED'}

  & node $runtime state repair-start --state $stateRel
  if($LASTEXITCODE -ne 0){throw 'E2E_REPAIR_FAILED'}

  & node $runtime state block --reason auto-telemetry-e2e --state $stateRel
  if($LASTEXITCODE -ne 0){throw 'E2E_BLOCK_FAILED'}

  & node $runtime state finalize --state $stateRel
  $finalExit=$LASTEXITCODE
  if($finalExit -ne 6){throw "E2E_FINALIZE_EXPECTED_BLOCKED_EXIT_6_GOT_$finalExit"}

  Write-Host ''
  Write-Host '[5/6] Verifying automatic summary and integrity...' -ForegroundColor Yellow
  $state=Get-Content $stateAbs -Raw | ConvertFrom-Json
  if($state.final_state -ne 'BLOCKED'){throw "E2E_FINAL_STATE_UNEXPECTED: $($state.final_state)"}
  if($state.telemetry_status -ne 'VERIFIED'){throw "TELEMETRY_NOT_VERIFIED: $($state.telemetry_status)"}
  if(-not $state.telemetry_summary_path){throw 'TELEMETRY_SUMMARY_PATH_MISSING'}

  $summaryPath=Join-Path $target ([string]$state.telemetry_summary_path)
  if(-not (Test-Path $summaryPath)){throw "TELEMETRY_SUMMARY_NOT_FOUND: $summaryPath"}
  $summary=Get-Content $summaryPath -Raw | ConvertFrom-Json

  if($summary.final_state -ne 'BLOCKED'){throw "SUMMARY_FINAL_STATE_UNEXPECTED: $($summary.final_state)"}
  if($summary.judges.count -ne 1){throw "SUMMARY_JUDGE_COUNT_UNEXPECTED: $($summary.judges.count)"}
  if($summary.totals.repairs -ne 1){throw "SUMMARY_REPAIR_COUNT_UNEXPECTED: $($summary.totals.repairs)"}

  $requiredKinds=@('RUN_START','JUDGE','REPAIR','FINAL_STATE')
  foreach($kind in $requiredKinds){
    if(@($summary.coverage.event_kinds) -notcontains $kind){
      throw "SUMMARY_EVENT_KIND_MISSING: $kind"
    }
  }

  $ctxRuntime=Join-Path $target '.aledevos\contextos\runtime\contextos.mjs'
  & node $ctxRuntime telemetry verify --run-id $runId
  if($LASTEXITCODE -ne 0){throw 'TELEMETRY_VERIFY_FAILED'}

  Write-Host ''
  Write-Host '[6/6] Result' -ForegroundColor Yellow
  Write-Host "Task       : $taskId"
  Write-Host "Run        : $runId"
  Write-Host "State      : $($state.final_state)"
  Write-Host "Telemetry  : $($state.telemetry_status)"
  Write-Host "Events     : $($summary.event_count)"
  Write-Host "Summary    : $($state.telemetry_summary_path)"
  Write-Host ''
  Write-Host 'AUTO_TELEMETRY_V1_CONSUMER_E2E_PASS' -ForegroundColor Green
} finally {
  Pop-Location
}
