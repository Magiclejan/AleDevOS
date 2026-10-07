param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [Parameter(Mandatory=$true)][string]$SkillId,
  [string]$Source,
  [switch]$ApproveUntrustedSource,
  [switch]$Force
)
$ErrorActionPreference='Stop'
$project=(Resolve-Path $ProjectPath).Path
$ale=Join-Path $project '.aledevos'
$acqRuntime=Join-Path $ale 'skillsystem\runtime\acquisition.mjs'
$skillRuntime=Join-Path $ale 'skillsystem\runtime\skillsystem.mjs'
$sourceCatalog=Join-Path $ale 'skillsystem\acquisition\source-catalog.json'
$targetRoot=Join-Path $project '.claude\skills'
$target=Join-Path $targetRoot $SkillId
if(-not (Test-Path $acqRuntime)){throw "Acquisition runtime missing: $acqRuntime"}
if(-not (Test-Path $skillRuntime)){throw "Skill runtime missing: $skillRuntime"}
if(-not (Test-Path $sourceCatalog)){throw "Source catalog missing: $sourceCatalog"}

# Plan first. Exit 42 means approval required; 41 means source resolution required.
& node $acqRuntime acquire plan --project-root $project --adapter codex --skill-id $SkillId
$planExit=$LASTEXITCODE
if($planExit -eq 0){
  $reg=Get-Content (Join-Path $ale 'skills\registries\claude-code.json') -Raw | ConvertFrom-Json
  $existing=$reg.skills | Where-Object {$_.id -eq $SkillId}
  if($existing.runtime.usable){Write-Host "Skill already available: $SkillId" -ForegroundColor Green;exit 0}
}elseif($planExit -notin @(41,42)){throw "Acquisition planning failed with exit code $planExit"}

$catalog=Get-Content $sourceCatalog -Raw | ConvertFrom-Json
$entry=$catalog.entries | Where-Object {$_.skill_id -eq $SkillId} | Select-Object -First 1
$sourceClass=$null
$sourceSkill=$SkillId
if($Source){
  $resolvedSource=$Source
  $sourceClass='manual-approved'
}elseif($entry){
  $resolvedSource=[string]$entry.source
  $sourceSkill=if($entry.source_skill){[string]$entry.source_skill}else{$SkillId}
  $sourceClass=[string]$entry.source_class
}else{
  # Exact-name source discovery through the public skills ecosystem.
  $encoded=[uri]::EscapeDataString($SkillId)
  $url="https://skills.sh/api/search?q=$encoded&limit=10"
  try{$resp=Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 20}catch{throw "No catalog source for '$SkillId' and skills.sh resolution failed: $($_.Exception.Message)"}
  $items=@()
  if($resp.skills){$items=@($resp.skills)}elseif($resp.data){$items=@($resp.data)}
  $match=$items | Where-Object { $_.name -eq $SkillId -or $_.slug -eq $SkillId -or $_.id -match "/$([regex]::Escape($SkillId))$" } | Sort-Object {[int]($_.installs)} -Descending | Select-Object -First 1
  if(-not $match){throw "No exact source found for skill '$SkillId'."}
  $resolvedSource=if($match.source){[string]$match.source}elseif($match.installUrl){[string]$match.installUrl}else{throw 'Resolved skill has no install source.'}
  $sourceSkill=if($match.slug){[string]$match.slug}else{$SkillId}
  $owner=($resolvedSource -replace '^https://github.com/','').Split('/')[0]
  $sourceClass=if($catalog.trusted_owners -contains $owner){'official'}else{'community'}
}

$trusted=@('official','allowlisted')
if(($sourceClass -notin $trusted) -and -not $ApproveUntrustedSource){
  Write-Host "Skill source requires approval before download." -ForegroundColor Yellow
  Write-Host "Skill:  $SkillId"
  Write-Host "Source: $resolvedSource"
  Write-Host "Class:  $sourceClass"
  Write-Host "Re-run with -ApproveUntrustedSource after reviewing the source." -ForegroundColor Yellow
  exit 42
}

if((Test-Path $target) -and -not $Force){throw "Target already exists: $target. Use -Force only after review."}

$temp=Join-Path ([IO.Path]::GetTempPath()) ("aledevos-skill-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp -Force | Out-Null
try{
  $env:DISABLE_TELEMETRY='1'
  Push-Location $temp
  try{
    # Install only into staging. Nothing from the third-party installer is written directly into the project.
    & npx --yes skills add $resolvedSource --skill $sourceSkill -a codex -y --copy
    if($LASTEXITCODE -ne 0){throw "skills CLI failed with exit code $LASTEXITCODE"}
  } finally {Pop-Location}

  $candidates=@(
    (Join-Path $temp ".claude\skills\$sourceSkill"),
    (Join-Path $temp ".codex\skills\$sourceSkill"),
    (Join-Path $temp ".claude\skills\$SkillId"),
    (Join-Path $temp ".codex\skills\$SkillId")
  ) | Select-Object -Unique
  $staged=$candidates | Where-Object {Test-Path (Join-Path $_ 'SKILL.md')} | Select-Object -First 1
  if(-not $staged){throw "Staged installation did not produce a SKILL.md for '$SkillId'."}

  $files=Get-ChildItem $staged -Recurse -File -Force
  if($files.Count -gt 256){throw "Skill exceeds max file count: $($files.Count)"}
  $total=($files | Measure-Object Length -Sum).Sum
  if($total -gt 2097152){throw "Skill exceeds max total bytes: $total"}
  if(($files | Where-Object {$_.Length -gt 524288}).Count -gt 0){throw 'Skill contains an oversized file.'}
  if((Get-ChildItem $staged -Recurse -Force | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count -gt 0){throw 'Skill contains symlinks/reparse points; acquisition blocked.'}

  New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
  $pending="$target.pending-$([guid]::NewGuid().ToString('N'))"
  Copy-Item $staged $pending -Recurse -Force
  $backup=$null
  if(Test-Path $target){$backup="$target.backup-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))";Move-Item $target $backup -Force}
  try{Move-Item $pending $target -Force}catch{if($backup -and (Test-Path $backup)){Move-Item $backup $target -Force};throw}
  if($backup -and (Test-Path $backup)){Remove-Item $backup -Recurse -Force}

  # Re-discover and rebuild before the skill can become usable.
  & node $skillRuntime discovery scan --project-root $project --adapter codex
  if($LASTEXITCODE -ne 0){throw 'Post-acquisition discovery failed.'}
  & node $skillRuntime registry build --project-root $project --adapter codex
  if($LASTEXITCODE -ne 0){throw 'Post-acquisition registry build failed.'}
  & node $skillRuntime registry verify --project-root $project --adapter claude-code
  if($LASTEXITCODE -ne 0){throw 'Post-acquisition registry verification failed.'}

  $skillFile=Join-Path $target 'SKILL.md'
  $req=[ordered]@{
    skill_id=$SkillId;adapter='codex';status='INSTALLED';source=[ordered]@{source=$resolvedSource;source_skill=$sourceSkill;source_class=$sourceClass};approved=($sourceClass -in $trusted -or $ApproveUntrustedSource.IsPresent);instruction_path=(Resolve-Path $skillFile).Path.Substring($project.Length).TrimStart('\','/').Replace('\','/')
  }
  $reqFile=Join-Path $temp 'acquisition-receipt-request.json';$req | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $reqFile
  & node $acqRuntime acquire record --project-root $project --adapter codex --request $reqFile
  if($LASTEXITCODE -ne 0){throw 'Acquisition receipt rejected.'}
  & node $acqRuntime acquire verify --project-root $project --adapter codex --skill-id $SkillId
  if($LASTEXITCODE -ne 0){throw 'Acquisition verification failed.'}
  Write-Host "Skill acquired and verified: $SkillId" -ForegroundColor Green
} finally {
  if(Test-Path $temp){Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue}
  Remove-Item Env:DISABLE_TELEMETRY -ErrorAction SilentlyContinue
}
