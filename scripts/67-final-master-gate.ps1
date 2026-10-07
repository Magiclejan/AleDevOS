param(
  [string]$Campaign,
  [switch]$InventoryOnly,
  [switch]$KeepP2Targets
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
function Get-AleDevRelativePath([string]$BasePath,[string]$TargetPath){
  # Windows PowerShell 5.1 runs on .NET Framework, which does not provide
  # System.IO.Path.GetRelativePath(). All Final Campaign scripts use this
  # descendant-only implementation so the same package works in PS 5.1/7+.
  $baseFull=[IO.Path]::GetFullPath($BasePath)
  $targetFull=[IO.Path]::GetFullPath($TargetPath)
  $sep=[IO.Path]::DirectorySeparatorChar
  if(-not $baseFull.EndsWith([string]$sep)){$baseFull += $sep}
  $cmp=if($env:OS -eq 'Windows_NT'){[System.StringComparison]::OrdinalIgnoreCase}else{[System.StringComparison]::Ordinal}
  if(-not $targetFull.StartsWith($baseFull,$cmp)){throw "ALEDEVOS_PATH_OUTSIDE_ROOT:$TargetPath"}
  return $targetFull.Substring($baseFull.Length).Replace('\','/')
}
$release=Join-Path $root 'release\engine\v1-release.mjs'
$finalizer=Join-Path $root 'release\templates\final-master-gate.mjs'
$psExe=(Get-Process -Id $PID).Path

function Run-Phase([string]$Script,[string[]]$Args,[string]$Name){
  $sp=Join-Path $root $Script
  if(-not(Test-Path $sp)){throw "Missing phase runner: $Script"}
  & $psExe -NoProfile -ExecutionPolicy Bypass -File $sp @Args
  $code=$LASTEXITCODE
  if($code -notin @(0,4)){throw "$Name failed with exit code $code"}
  return $code
}
function Resolve-InRoot([string]$p){
  if([string]::IsNullOrWhiteSpace($p)){return $null}
  $x=if([IO.Path]::IsPathRooted($p)){$p}else{Join-Path $root $p}
  return (Resolve-Path $x).Path
}
function Rel([string]$p){return Get-AleDevRelativePath $root $p}

Push-Location $root
try {
  if($InventoryOnly -or [string]::IsNullOrWhiteSpace($Campaign)){
    Write-Host '===== ALEDEVOS V1 FINAL MASTER GATE INVENTORY =====' -ForegroundColor Cyan
    & node $finalizer inventory --root $root
    Write-Host 'Inventory mode never issues a freeze certificate.' -ForegroundColor Yellow
    exit 0
  }
  $campaignAbs=Resolve-InRoot $Campaign
  $c=Get-Content $campaignAbs -Raw | ConvertFrom-Json
  if([string]$c.schema_version -ne '1.0' -or [string]$c.phase -ne 'ALEDEVOS_V1_FINAL_MASTER_CAMPAIGN'){throw 'Final campaign contract invalid.'}

  # Deterministic regression evidence is an explicit campaign input. The final gate never invents counts.
  $reg=Resolve-InRoot ([string]$c.regression_summary)
  $inputs=Join-Path $root '.aledevos\state\release\master\inputs';New-Item -ItemType Directory -Path $inputs -Force|Out-Null
  $evidence=Join-Path $root '.aledevos\state\release\master\evidence';New-Item -ItemType Directory -Path $evidence -Force|Out-Null
  $regInput=Join-Path $inputs 'deterministic_regression_current.input.json'
  [ordered]@{schema_version='1.0';check_id='deterministic_regression_current';status='PASS';target=[ordered]@{phase='FINAL_MASTER_GATE';source='measured_regression_summary'};artifacts=@([ordered]@{role='regression_summary';path=(Rel $reg)});claims=[ordered]@{measured_not_estimated=$true};notes=@('Sealed by scripts/67-final-master-gate.ps1')}|ConvertTo-Json -Depth 10|Set-Content -Encoding utf8 $regInput
  & node $release master-evidence seal --project-root $root --input $regInput --out (Join-Path $evidence 'deterministic_regression_current.json')
  if($LASTEXITCODE -ne 0){throw 'Deterministic regression evidence failed.'}

  $p2Args=@()
  if($c.p2 -and $c.p2.adapters){$got=@($c.p2.adapters|ForEach-Object{[string]$_});$required=@('opencode','codex','claude-code','antigravity');if(($got.Count -ne 4) -or (@(Compare-Object ($got|Sort-Object) ($required|Sort-Object)).Count -ne 0)){throw 'Final campaign P2 must validate all four canonical adapters.'}}
  if($KeepP2Targets){$p2Args+='-KeepTargets'}
  [void](Run-Phase 'scripts\53-master-validation-p2-target-adapters.ps1' $p2Args 'P2')

  [void](Run-Phase 'scripts\55-master-validation-p3-target-multimodel.ps1' @('-Profile',(Resolve-InRoot ([string]$c.p3.profile))) 'P3')
  [void](Run-Phase 'scripts\57-master-validation-p4-target-visual.ps1' @('-Profile',(Resolve-InRoot ([string]$c.p4.profile))) 'P4')

  $p5=@('-Profile',(Resolve-InRoot ([string]$c.p5.profile)))
  if($c.p5.transport_probe_profile){$p5+=@('-TransportProbeProfile',(Resolve-InRoot ([string]$c.p5.transport_probe_profile)))}
  if($c.p5.crash_group){$p5+=@('-CrashGroup',(Resolve-InRoot ([string]$c.p5.crash_group)))}
  if($c.p5.crash_worker_id){$p5+=@('-CrashWorkerId',[string]$c.p5.crash_worker_id)}
  [void](Run-Phase 'scripts\59-master-validation-p5-target-advanced-execution.ps1' $p5 'P5')

  $p6=@('-Profile',(Resolve-InRoot ([string]$c.p6.profile)))
  if($c.p6.project_path){$p6+=@('-ProjectPath',(Resolve-InRoot ([string]$c.p6.project_path)))}
  if($c.p6.trace_draft){$p6+=@('-TraceDraft',(Resolve-InRoot ([string]$c.p6.trace_draft)))}
  if($c.p6.trace_out){$p6+=@('-TraceOut',(Resolve-InRoot ([string]$c.p6.trace_out)))}
  [void](Run-Phase 'scripts\61-master-validation-p6-target-full-stack.ps1' $p6 'P6')

  [void](Run-Phase 'scripts\63-master-validation-p7-target-efficiency.ps1' @('-ProjectRoot',$root,'-TaskContract',[string]$c.p7.task_contract,'-Signals',[string]$c.p7.signals,'-BenchmarkProfile',[string]$c.p7.benchmark_profile) 'P7')
  [void](Run-Phase 'scripts\65-master-validation-p8-target-security-reliability.ps1' @('-ProjectRoot',$root,'-Profile',[string]$c.p8.profile) 'P8')

  $reports=Join-Path $root '.aledevos\state\release\master\reports';New-Item -ItemType Directory -Path $reports -Force|Out-Null
  $report=Join-Path $reports 'final-v1-master-report.json'
  & node $release master-gate evaluate --project-root $root --out $report
  $gateCode=$LASTEXITCODE
  if($gateCode -eq 7){throw 'Final Master Gate FAILED.'}
  if($gateCode -eq 4){
    Write-Host 'FINAL MASTER GATE BLOCKED — no freeze certificate issued.' -ForegroundColor Yellow
    exit 4
  }
  if($gateCode -ne 0){throw "Unexpected Master Gate exit code: $gateCode"}

  $freeze=Join-Path $root '.aledevos\state\release\final\v1-freeze-certificate.json'
  & node $finalizer freeze issue --root $root --report $report --out $freeze
  if($LASTEXITCODE -ne 0){throw 'Freeze certificate issuance failed.'}
  & node $finalizer freeze verify --root $root --certificate $freeze
  if($LASTEXITCODE -ne 0){throw 'Freeze certificate verification failed.'}
  Write-Host 'ALEDEVOS V1 FROZEN — 33/33 MASTER CHECKS PASS' -ForegroundColor Green
  Write-Host "Freeze certificate: $freeze" -ForegroundColor Green
  exit 0
} finally { Pop-Location }
