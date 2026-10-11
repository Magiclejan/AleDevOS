param(
  [Parameter(Mandatory=$true)][string]$Model,
  [ValidateSet('orchestrator','researcher','architect','auditor','builder','editor-backend','editor-config','editor-database','editor-frontend','editor-tests','judge-quality','judge-regression','judge-requirements','judge-uxui','motion-director','design-system-guardian','repairer','security-reviewer','verifier','visual-capture-runner','visual-regression-runner','visual-runtime-audit-runner','visual-judge','visual-repair-controller','v1-release-validator')]
  [string]$Role='researcher',
  [ValidateSet('correct_role_routing','unauthorized_action_denied','real_task_execution_or_observation','evidence_handoff','negative_case_handled','independent_verification')]
  [string]$Case='correct_role_routing',
  [switch]$FullCampaign,
  [ValidateRange(30,600)][int]$TimeoutSeconds=600,
  [switch]$ConfirmReal
)
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
if(-not $ConfirmReal){throw 'P37_2_EXPLICIT_CONFIRM_REAL_REQUIRED'}
$root=Split-Path -Parent $PSScriptRoot
$engine=Join-Path $root 'certification\pro\engine\p37-agents.mjs'
$node=(Get-Command node -ErrorAction Stop).Source
if(-not(Test-Path -LiteralPath $engine)){throw 'P37_2_ENGINE_MISSING'}
$roles=if($FullCampaign){@('orchestrator','researcher','architect','auditor','builder','editor-backend','editor-config','editor-database','editor-frontend','editor-tests','judge-quality','judge-regression','judge-requirements','judge-uxui','motion-director','design-system-guardian','repairer','security-reviewer','verifier','visual-capture-runner','visual-regression-runner','visual-runtime-audit-runner','visual-judge','visual-repair-controller','v1-release-validator')}else{@($Role)}
$cases=if($FullCampaign){@('correct_role_routing','unauthorized_action_denied','real_task_execution_or_observation','evidence_handoff','negative_case_handled','independent_verification')}else{@($Case)}
foreach($roleId in $roles){foreach($caseId in $cases){
  Write-Host ('P37_2_REAL_CASE_BEGIN codex:'+$roleId+':'+$caseId+' timeout_seconds='+$TimeoutSeconds)
  & $node $engine run --role $roleId --case $caseId --model $Model --timeout-ms ([string]($TimeoutSeconds*1000)) --execute-real
  if($LASTEXITCODE -eq 7){throw ('P37_2_CASE_BLOCKED '+$roleId+':'+$caseId+'; repair only this case, then rerun -FullCampaign to resume')}
  if($LASTEXITCODE -ne 0){throw ('P37_2_RUNNER_FAILED '+$roleId+':'+$caseId)}
}}
Write-Host 'P37_2_CAMPAIGN_COMPLETE'
