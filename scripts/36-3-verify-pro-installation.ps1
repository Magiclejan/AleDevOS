param(
  [switch]$KeepEvidence
)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$root=Join-Path $env:TEMP ('AleDevOS P36.3 controlled installation ' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root -Force | Out-Null
$sentinel=Join-Path $root '.p36-3-owned-fixture'
Set-Content -LiteralPath $sentinel -Value 'disposable P36.3 fixture' -Encoding ascii

$matrix=@(
  @{id='opencode'; skill='.opencode\skills'; agents='.opencode\agents'},
  @{id='codex'; skill='.agents\skills'; agents='.codex\agents'},
  @{id='claude-code'; skill='.claude\skills'; agents='.claude\agents'},
  @{id='antigravity'; skill='.agents\skills'; agents='.agents\agents'}
)
$catalog=Get-Content -LiteralPath (Join-Path $repo 'skillsystem\catalogs\core-skills.json') -Raw | ConvertFrom-Json
if(@($catalog.skills).Count -ne 13){throw 'P36_3_SOURCE_CORE_SKILL_COUNT_INVALID'}

try {
  $results=@()
  foreach($item in $matrix){
    $id=$item.id
    $project=Join-Path $root ("project " + $id)
    Write-Host ("P36.3 INSTALL " + $id)
    & (Join-Path $repo 'scripts\05-install-into-project.ps1') -ProjectPath $project -Adapter $id 2>&1 |
      ForEach-Object { $line=([string]$_); if($line -match 'Adapter ABI|discovery|registry|installed|AVAILABLE|BLOCKED|ERROR'){ Write-Host $line } }
    if(-not (Test-Path -LiteralPath (Join-Path $project '.aledevos\project.json'))){throw "P36_3_INSTALL_PROJECT_MISSING:$id"}
    $config=Get-Content -LiteralPath (Join-Path $project '.aledevos\project.json') -Raw | ConvertFrom-Json
    if(@($config.adapters) -notcontains $id){throw "P36_3_ADAPTER_NOT_REGISTERED:$id"}

    $bindingRel="skillsystem\bindings\$id.json"
    $binding=Get-Content -LiteralPath (Join-Path $repo $bindingRel) -Raw | ConvertFrom-Json
    if(@($binding.bindings).Count -ne 13){throw "P36_3_BINDING_COUNT_INVALID:$id"}
    foreach($itemSkill in $catalog.skills){
      $key=$itemSkill.id
      $src=Join-Path $repo ("adapters\$id\" + $item.skill + "\$key\SKILL.md")
      $dst=Join-Path $project ($item.skill + "\$key\SKILL.md")
      if(-not (Test-Path -LiteralPath $src)){throw "P36_3_SOURCE_SKILL_MISSING:$id/$key"}
      if(-not (Test-Path -LiteralPath $dst)){throw "P36_3_INSTALLED_SKILL_MISSING:$id/$key"}
      $expected=@($binding.bindings | Where-Object { $_.skill_id -eq $key })
      if($expected.Count -ne 1){throw "P36_3_UNIQUE_BINDING_MISSING:$id/$key"}
      $srcHash=(Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash.ToLowerInvariant()
      $dstHash=(Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash.ToLowerInvariant()
      if($srcHash -ne $dstHash -or $dstHash -ne $expected[0].expected_sha256){
        throw "P36_3_SKILL_HASH_MISMATCH:$id/$key"
      }
      if(-not ((Get-Content -LiteralPath $dst -Raw) -match '## Procedure')){
        throw "P36_3_SKILL_PROCEDURE_MISSING:$id/$key"
      }
    }
    $agentRoot=Join-Path $project $item.agents
    if(-not (Test-Path -LiteralPath $agentRoot)){throw "P36_3_AGENTS_MISSING:$id"}
    $ext=if($id -eq 'codex'){'.toml'}else{'.md'}
    $agents=@(Get-ChildItem -LiteralPath $agentRoot -File | Where-Object { $_.Extension -eq $ext })
    if($agents.Count -ne 25){throw "P36_3_AGENT_COUNT_INVALID:$id/$($agents.Count)"}
    foreach($name in @('orchestrator','builder','judge-requirements','repairer','security-reviewer','visual-judge')){
      $agentFile=Join-Path $agentRoot ($name+$ext)
      if(-not (Test-Path -LiteralPath $agentFile)){throw "P36_3_CRITICAL_ROLE_MISSING:$id/$name"}
    }
    $regFile=Join-Path $project '.aledevos\skills\registry.json'
    if(-not (Test-Path -LiteralPath $regFile)){throw "P36_3_REGISTRY_MISSING:$id"}
    $registry=Get-Content -LiteralPath $regFile -Raw | ConvertFrom-Json
    $usable=@($registry.skills | Where-Object {$_.runtime.usable -eq $true})
    if($usable.Count -ne 13){throw "P36_3_USABLE_SKILL_COUNT_INVALID:$id/$($usable.Count)"}
    $engine=Join-Path $project '.aledevos\skillsystem\runtime\skillsystem.mjs'
    & node $engine registry verify --project-root $project --adapter $id | Out-Null
    if($LASTEXITCODE -ne 0){throw "P36_3_INSTALLED_REGISTRY_VERIFY_FAILED:$id"}
    $results+= [pscustomobject]@{adapter=$id;installed_skills=13;agent_roles=25;installed_hashes='13/13';registry='PASS';pro_certified=0}
    Write-Host ("P36_3_ADAPTER_PASS "+$id)
  }
  $payload=[ordered]@{
    phase='P36.3'
    status='INSTALLATION_PROJECTION_PASS'
    provenance='Windows native installer into four independent temporary projects'
    results=$results
    scope='4 adapters, 52 skill file SHA checks, 100 agent role projections'
    certification='NOT_PRO_CERTIFIED'
    workspace=$root
  }
  $payload | ConvertTo-Json -Depth 12
}
finally {
  if($KeepEvidence){
    Write-Host ("P36_3_WORKSPACE_PRESERVED "+$root)
  }elseif(Test-Path -LiteralPath $sentinel){
    Remove-Item -LiteralPath $root -Recurse -Force
  }
}
