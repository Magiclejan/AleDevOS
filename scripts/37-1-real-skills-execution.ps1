param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('opencode','codex','claude-code','antigravity')]
  [string]$Adapter,
  [Parameter(Mandatory=$true)][string]$Provider,
  [Parameter(Mandatory=$true)][string]$Model,
  [ValidateSet('backend-change','database-change','diff-review','frontend-change','implementation-plan','regression-analysis','repair-loop','repo-map','requirements-check','safe-edit','security-check','task-contract','test-strategy')]
  [string]$Skill='safe-edit',
  [ValidateSet('activated_on_correct_request','rejected_out_of_scope_request','executed_real_task','scoped_permissions_enforced','failure_and_recovery','independent_verification')]
  [string]$Case='executed_real_task',
  [string]$ReviewerId,
  [switch]$FullCampaign,
  [switch]$CodexWorkspaceWrite,
  [ValidateRange(30,600)][int]$TimeoutSeconds=120,
  [switch]$ConfirmReal
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if (-not $ConfirmReal) { throw 'P37_1_EXPLICIT_CONFIRM_REAL_REQUIRED' }
if ($CodexWorkspaceWrite -and $Adapter -ne 'codex') { throw 'P37_1_CODEX_WRITE_ONLY_CODEX_ADAPTER' }
if ($CodexWorkspaceWrite -and -not $FullCampaign -and
    $Case -in @('rejected_out_of_scope_request','scoped_permissions_enforced','independent_verification')) {
  throw 'P37_1_NEGATIVE_READONLY_CASE_FORBIDS_WRITE_OPT_IN'
}
$root=Split-Path -Parent $PSScriptRoot
$engine=Join-Path $root 'certification\pro\engine\p37-skills.mjs'
$node=(Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $engine)) { throw 'P37_1_ENGINE_MISSING' }
$cases=@(
 'activated_on_correct_request','rejected_out_of_scope_request','executed_real_task',
 'scoped_permissions_enforced','failure_and_recovery','independent_verification'
)
$skills=@(
 'backend-change','database-change','diff-review','frontend-change','implementation-plan',
 'regression-analysis','repair-loop','repo-map','requirements-check','safe-edit',
 'security-check','task-contract','test-strategy'
)
$preparedRaw= & $node $engine prepare --adapter $Adapter --confirm-disposable-install
if ($LASTEXITCODE -ne 0) { throw 'P37_1_PREPARE_FAILED' }
$prepared=($preparedRaw -join [Environment]::NewLine | ConvertFrom-Json)
if ($prepared.status -ne 'PREPARED_NOT_EXECUTED' -or $prepared.skills_verified -ne 13) { throw 'P37_1_FIXTURE_NOT_VERIFIED' }
Write-Host ('P37_1_PREPARED adapter='+$Adapter+' source='+$prepared.git_sha)
Write-Host ('P37_1_FIXTURE '+$prepared.fixture)
$selectedSkills=if($FullCampaign){$skills}else{@($Skill)}
$selectedCases=if($FullCampaign){$cases}else{@($Case)}
$attempts=0
foreach($id in $selectedSkills){
 foreach($caseId in $selectedCases){
  if ($caseId -eq 'independent_verification' -and [string]::IsNullOrWhiteSpace($ReviewerId)) {
   Write-Warning ('P37_1_INDEPENDENT_REVIEW_BLOCKED '+$id+': separate -ReviewerId required')
   continue
  }
  $arguments=@($engine,'run','--adapter',$Adapter,'--project',$prepared.fixture,
               '--skill',$id,'--case',$caseId,'--provider',$Provider,'--model',$Model,'--execute-real')
  $arguments+=@('--timeout-ms',[string]($TimeoutSeconds * 1000))
  if($caseId -eq 'independent_verification') { $arguments+=@('--reviewer',$ReviewerId) }
  if($CodexWorkspaceWrite -and $caseId -ne 'rejected_out_of_scope_request' -and
     $caseId -ne 'independent_verification' -and
     $caseId -ne 'scoped_permissions_enforced') { $arguments+=@('--codex-workspace-write') }
  Write-Host ('P37_1_REAL_CASE_BEGIN '+$Adapter+':'+$id+':'+$caseId+' timeout_seconds='+$TimeoutSeconds)
  & $node @arguments
  $status=$LASTEXITCODE
  $attempts++
  Write-Host ('P37_1_CASE_EXIT code='+$status+' skill='+$id+' case='+$caseId)
  if ($status -eq 7) { throw 'P37_1_RUNNER_BLOCKED_EARLY_STOP' }
 }
}
Write-Host ('P37_1_ATTEMPTS '+$attempts)
& $node $engine summary
if ($LASTEXITCODE -ne 0) { throw 'P37_1_SUMMARY_FAILED' }
Write-Warning 'P37.1 only collected execution observations. No case is PRO_CERTIFIED; P37.3 independent review remains required.'
