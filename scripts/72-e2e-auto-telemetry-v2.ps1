param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [ValidateSet('opencode','codex','claude-code','antigravity')][string]$RequestedAdapter,
  [ValidateRange(10,900)][int]$CallTimeoutSeconds = 120
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$target=(Resolve-Path $ProjectPath).Path
$projectJson=Join-Path $target '.aledevos\project.json'
if(-not(Test-Path $projectJson)){throw "ALEDEVOS_PROJECT_NOT_FOUND: $projectJson"}

$cfg=Get-Content $projectJson -Raw | ConvertFrom-Json
$declared=@()
if($cfg.adapters){$declared=@($cfg.adapters|ForEach-Object{[string]$_})}
elseif($cfg.adapter){$declared=@([string]$cfg.adapter)}
$declared=@($declared|ForEach-Object{if($_ -eq 'gemini'){'antigravity'}else{$_}}|Sort-Object -Unique)
$exe=@{'opencode'='opencode';'codex'='codex';'claude-code'='claude';'antigravity'='agy'}

$adapter=$null
if($RequestedAdapter){
  $adapter=[string]$RequestedAdapter
  if(-not(Get-Command $exe[$adapter] -ErrorAction SilentlyContinue)){
    throw "REQUESTED_ADAPTER_CLI_NOT_AVAILABLE: adapter=$adapter cli=$($exe[$adapter])"
  }
}else{
  foreach($a in @('opencode','codex','claude-code','antigravity')){
    if($declared -contains $a -and (Get-Command $exe[$a] -ErrorAction SilentlyContinue)){
      $adapter=$a
      break
    }
  }
}
if(-not $adapter){throw "NO_INSTALLED_RUNTIME_AVAILABLE: declared=$($declared -join ',')"}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' ALEDEVOS AUTO-TELEMETRY V2 - REAL AGENT CALL E2E' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "Source : $root"
Write-Host "Target : $target"
Write-Host "Adapter: $adapter"
Write-Host "CLI    : $($exe[$adapter])"
Write-Host "Timeout: $CallTimeoutSeconds s"

Write-Host ''
Write-Host '[1/7] Installing V2 runtime into consumer project...' -ForegroundColor Yellow
& (Join-Path $root 'scripts\05-install-into-project.ps1') -ProjectPath $target -Adapter $adapter -Force
if($LASTEXITCODE -ne 0){throw 'ALEDEVOS_INSTALL_FAILED'}

Write-Host ''
Write-Host '[2/7] Adapter runtime preflight: native CLI/auth path' -ForegroundColor Yellow
$cli=Get-Command $exe[$adapter] -ErrorAction SilentlyContinue
if(-not $cli){throw "ADAPTER_CLI_NOT_AVAILABLE: adapter=$adapter"}
Write-Host "Adapter CLI ready: $adapter" -ForegroundColor Green

$runtime=Join-Path $target '.aledevos\runtime\aledevos.mjs'
$agentRuntime=Join-Path $target '.aledevos\agent-runtime\runtime\agent-runtime.mjs'
& node --check $runtime
if($LASTEXITCODE -ne 0){throw 'INSTALLED_CORE_SYNTAX_FAILED'}
& node --check $agentRuntime
if($LASTEXITCODE -ne 0){throw 'INSTALLED_AGENT_RUNTIME_SYNTAX_FAILED'}

$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$taskId="auto-telemetry-v2-$stamp"
$stateRel=".aledevos/state/e2e/auto-telemetry-v2-$stamp.json"
$stateAbs=Join-Path $target $stateRel
$callExit=$null

Push-Location $target
try {
  Write-Host ''
  Write-Host '[3/7] Starting isolated AleDevOS task...' -ForegroundColor Yellow
  & node $runtime state init --task-id $taskId --adapter $adapter --benchmark-key auto-telemetry-v2 --state $stateRel
  if($LASTEXITCODE -ne 0){throw 'V2_STATE_INIT_FAILED'}

  Write-Host ''
  Write-Host '[4/7] Executing one REAL agent/model call...' -ForegroundColor Yellow
  $probe='Reply exactly: ALEDEVOS TELEMETRY V2 OK. Do not use tools. Do not modify files.'
  $timeoutMs=$CallTimeoutSeconds*1000
  & node $agentRuntime call --adapter $adapter --agent orchestrator --prompt $probe --state $stateRel --timeout-ms $timeoutMs --quiet
  $callExit=$LASTEXITCODE

  Write-Host ''
  Write-Host '[5/7] Finalizing isolated task...' -ForegroundColor Yellow
  & node $runtime state block --reason auto-telemetry-v2-e2e --state $stateRel
  if($LASTEXITCODE -ne 0){throw 'V2_BLOCK_FAILED'}
  & node $runtime state finalize --state $stateRel
  if($LASTEXITCODE -ne 6){throw "V2_FINALIZE_EXPECTED_BLOCKED_EXIT_6_GOT_$LASTEXITCODE"}

  Write-Host ''
  Write-Host '[6/7] Verifying AGENT_CALL metrics and integrity...' -ForegroundColor Yellow
  $state=Get-Content $stateAbs -Raw | ConvertFrom-Json
  if($state.telemetry_status -ne 'VERIFIED'){throw "TELEMETRY_NOT_VERIFIED: $($state.telemetry_status)"}
  $summaryPath=Join-Path $target ([string]$state.telemetry_summary_path)
  if(-not(Test-Path $summaryPath)){throw "SUMMARY_NOT_FOUND: $summaryPath"}
  $summary=Get-Content $summaryPath -Raw | ConvertFrom-Json
  $agent=$summary.agents.orchestrator
  if(-not $agent){throw 'AGENT_SUMMARY_MISSING'}
  if([int]$agent.calls -ne 1){throw "AGENT_CALL_COUNT_UNEXPECTED: $($agent.calls)"}
  if($null -eq $agent.duration_ms -or [double]$agent.duration_ms -le 0){throw 'AGENT_DURATION_MISSING'}

  if($callExit -eq 0 -and $adapter -in @('opencode','codex','claude-code')){
    if($null -eq $agent.input_tokens -or $null -eq $agent.output_tokens){
      throw "STRUCTURED_RUNTIME_TOKEN_USAGE_MISSING: adapter=$adapter"
    }
  }

  $ctx=Join-Path $target '.aledevos\contextos\runtime\contextos.mjs'
  & node $ctx telemetry verify --run-id $state.telemetry_run_id
  if($LASTEXITCODE -ne 0){throw 'V2_TELEMETRY_VERIFY_FAILED'}

  Write-Host ''
  Write-Host '[7/7] Result' -ForegroundColor Yellow
  Write-Host "Task         : $taskId"
  Write-Host "Run          : $($state.telemetry_run_id)"
  Write-Host "Adapter      : $adapter"
  Write-Host "Agent calls  : $($agent.calls)"
  Write-Host "Input tokens : $($agent.input_tokens)"
  Write-Host "Output tokens: $($agent.output_tokens)"
  Write-Host "Duration ms  : $($agent.duration_ms)"
  Write-Host "Tool calls   : $($agent.tool_calls)"
  Write-Host "Files read   : $($agent.files_read)"
  Write-Host "Telemetry    : $($state.telemetry_status)"
  Write-Host "Call exit    : $callExit"
  Write-Host ''

  if($callExit -eq 0){
    Write-Host 'AUTO_TELEMETRY_V2_REAL_AGENT_E2E_PASS' -ForegroundColor Green
  }else{
    Write-Host 'AUTO_TELEMETRY_V2_PROVIDER_FAILURE_PATH_PASS' -ForegroundColor Yellow
    throw "REAL_AGENT_PROVIDER_CALL_UNAVAILABLE: adapter=$adapter exit=$callExit telemetry=VERIFIED"
  }
} finally {
  Pop-Location
}
