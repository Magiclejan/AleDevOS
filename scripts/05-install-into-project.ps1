# Compatibility markers retained for cumulative validation: v1.21 UXUI-P6; UXUI-P2 UXUI-P3 UXUI-P4 UXUI-P5; prior release markers: v1.19 UXUI-P4; v1.20 UXUI-P5; v1.22 VisualQA-P1; v1.26 VisualQA-P5
param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [ValidateSet('opencode','codex','claude-code','gemini','antigravity','generic')][string]$Adapter = 'opencode',
  [switch]$Force
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$target=(Resolve-Path $ProjectPath).Path
$RequestedAdapter=$Adapter
$CanonicalAdapter=if($Adapter -eq 'gemini'){'antigravity'}else{$Adapter}
if($Adapter -eq 'gemini'){Write-Host 'Gemini is a compatibility alias; installing canonical Google Antigravity adapter.' -ForegroundColor Yellow}
$adapterRoot=Join-Path $root "adapters\$CanonicalAdapter"
$adapterRuntime=Join-Path $root 'core\adapter-runtime\adapter.mjs'
if(-not (Test-Path $adapterRuntime)){throw 'ADAPTER_RUNTIME_NOT_FOUND'}
$adapterCheck=& node $adapterRuntime install check --root $root --adapter $RequestedAdapter 2>&1
if($LASTEXITCODE -ne 0){
  $msg=($adapterCheck | Out-String).Trim()
  throw "ADAPTER_NOT_INSTALLABLE: $Adapter`n$msg"
}
Write-Host "Adapter ABI preflight PASS: $RequestedAdapter -> $CanonicalAdapter" -ForegroundColor Green

function Copy-SafeFile($src,$dst){
  if((Test-Path $dst) -and -not $Force){Write-Host "SKIP existing: $dst" -ForegroundColor Yellow;return}
  if((Test-Path $dst) -and $Force){$stamp=Get-Date -Format 'yyyyMMdd-HHmmss';Copy-Item $dst "$dst.bak-$stamp" -Force}
  New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
  Copy-Item $src $dst -Force
  Write-Host "Installed: $dst" -ForegroundColor Green
}

function Write-Utf8NoBom([string]$Path,[string]$Text){
  $parent=Split-Path -Parent $Path
  if($parent){New-Item -ItemType Directory -Path $parent -Force | Out-Null}
  $enc=New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path,$Text,$enc)
}

if($CanonicalAdapter -eq 'opencode'){
  Copy-SafeFile (Join-Path $adapterRoot 'opencode.json') (Join-Path $target 'opencode.json')
  $srcOc=Join-Path $adapterRoot '.opencode';$dstOc=Join-Path $target '.opencode'
  Get-ChildItem $srcOc -Recurse -File | ForEach-Object {$rel=$_.FullName.Substring($srcOc.Length).TrimStart('\','/');Copy-SafeFile $_.FullName (Join-Path $dstOc $rel)}
}elseif($CanonicalAdapter -eq 'codex'){
  $srcCx=Join-Path $adapterRoot '.codex';$dstCx=Join-Path $target '.codex'
  Get-ChildItem $srcCx -Recurse -File | ForEach-Object {$rel=$_.FullName.Substring($srcCx.Length).TrimStart('\','/');Copy-SafeFile $_.FullName (Join-Path $dstCx $rel)}
  $srcSkills=Join-Path $adapterRoot '.agents\skills';$dstSkills=Join-Path $target '.agents\skills'
  Get-ChildItem $srcSkills -Recurse -File | ForEach-Object {$rel=$_.FullName.Substring($srcSkills.Length).TrimStart('\','/');Copy-SafeFile $_.FullName (Join-Path $dstSkills $rel)}
}elseif($CanonicalAdapter -eq 'claude-code'){
  $srcCl=Join-Path $adapterRoot '.claude';$dstCl=Join-Path $target '.claude'
  Get-ChildItem $srcCl -Recurse -File | ForEach-Object {$rel=$_.FullName.Substring($srcCl.Length).TrimStart('\','/');Copy-SafeFile $_.FullName (Join-Path $dstCl $rel)}
}elseif($CanonicalAdapter -eq 'antigravity'){
  $srcAg=Join-Path $adapterRoot '.agents';$dstAg=Join-Path $target '.agents'
  Get-ChildItem $srcAg -Recurse -File | ForEach-Object {$rel=$_.FullName.Substring($srcAg.Length).TrimStart('\','/');Copy-SafeFile $_.FullName (Join-Path $dstAg $rel)}
}else{
  throw "ADAPTER_INSTALL_PROJECTION_NOT_IMPLEMENTED: $Adapter"
}

$ale=Join-Path $target '.aledevos'
Copy-SafeFile (Join-Path $root 'core\engine\aledevos.mjs') (Join-Path $ale 'runtime\aledevos.mjs')
Copy-SafeFile (Join-Path $root 'core\engine\telemetry-bridge.mjs') (Join-Path $ale 'runtime\telemetry-bridge.mjs')
Copy-SafeFile (Join-Path $root 'core\agent-runtime\agent-runtime.mjs') (Join-Path $ale 'agent-runtime\runtime\agent-runtime.mjs')
Copy-SafeFile (Join-Path $root 'core\agent-runtime\windows-cli-launcher.ps1') (Join-Path $ale 'agent-runtime\runtime\windows-cli-launcher.ps1')
Copy-SafeFile (Join-Path $adapterRoot 'runtime-profile.json') (Join-Path $ale "agent-runtime\adapters\$CanonicalAdapter.json")
Get-ChildItem (Join-Path $root 'core\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $ale "schemas\$($_.Name)")}

# Quality Engineering: universal QA/regression/reuse policy enforced by the Core runtime.
$qe=Join-Path $ale 'quality-engineering'
Copy-SafeFile (Join-Path $root 'quality-engineering\policies\quality-engineering-policy.json') (Join-Path $qe 'policies\quality-engineering-policy.json')
Get-ChildItem (Join-Path $root 'quality-engineering\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $qe "schemas\$($_.Name)")}

# Portability Phase 1: install the canonical Adapter ABI verifier, catalog/profiles and the selected adapter manifest.
Copy-SafeFile (Join-Path $root 'core\adapter-runtime\adapter.mjs') (Join-Path $ale 'adapters\runtime\adapter.mjs')
Copy-SafeFile (Join-Path $root 'core\adapter-contracts\capability-catalog.json') (Join-Path $ale 'adapters\contracts\capability-catalog.json')
Copy-SafeFile (Join-Path $root 'core\adapter-contracts\compatibility-profiles.json') (Join-Path $ale 'adapters\contracts\compatibility-profiles.json')
Copy-SafeFile (Join-Path $adapterRoot 'adapter-capabilities.json') (Join-Path $ale "adapters\$CanonicalAdapter\adapter-capabilities.json")
if($RequestedAdapter -ne $CanonicalAdapter){Copy-SafeFile (Join-Path $root "adapters\$RequestedAdapter\adapter-capabilities.json") (Join-Path $ale "adapters\$RequestedAdapter\adapter-capabilities.json")}
if($CanonicalAdapter -eq 'opencode'){
  Copy-SafeFile (Join-Path $adapterRoot 'certification\opencode-certifier.mjs') (Join-Path $ale 'adapters\opencode\opencode-certifier.mjs')
}elseif($CanonicalAdapter -eq 'codex'){
  Copy-SafeFile (Join-Path $adapterRoot 'certification\codex-certifier.mjs') (Join-Path $ale 'adapters\codex\codex-certifier.mjs')
}elseif($CanonicalAdapter -eq 'claude-code'){
  Copy-SafeFile (Join-Path $adapterRoot 'certification\claude-code-certifier.mjs') (Join-Path $ale 'adapters\claude-code\claude-code-certifier.mjs')
  Copy-SafeFile (Join-Path $adapterRoot 'hooks\pretool-guard.mjs') (Join-Path $ale 'adapters\claude-code\hooks\pretool-guard.mjs')
}elseif($CanonicalAdapter -eq 'antigravity'){
  Copy-SafeFile (Join-Path $adapterRoot 'certification\antigravity-certifier.mjs') (Join-Path $ale 'adapters\antigravity\antigravity-certifier.mjs')
  Copy-SafeFile (Join-Path $adapterRoot 'hooks\pretool-guard.mjs') (Join-Path $ale 'adapters\antigravity\hooks\pretool-guard.mjs')
  Copy-SafeFile (Join-Path $adapterRoot 'settings\aledevos-permissions.overlay.json') (Join-Path $ale 'adapters\antigravity\aledevos-permissions.overlay.json')
}

# Skill System Phase 5: registry/discovery/routing/composition/governance plus safe skill acquisition.
$skillSys=Join-Path $ale 'skillsystem'
Copy-SafeFile (Join-Path $root 'skillsystem\engine\skillsystem.mjs') (Join-Path $skillSys 'runtime\skillsystem.mjs')
Copy-SafeFile (Join-Path $root 'skillsystem\engine\acquisition.mjs') (Join-Path $skillSys 'runtime\acquisition.mjs')
Copy-SafeFile (Join-Path $root 'skillsystem\policies\skill-policy.json') (Join-Path $skillSys 'policies\skill-policy.json')
# Portability P6: install canonical semantic Skill Pack metadata shared by all adapters.
Copy-SafeFile (Join-Path $root 'skillsystem\portable\portable-skill-pack.json') (Join-Path $skillSys 'portable\portable-skill-pack.json')
Get-ChildItem (Join-Path $root 'skillsystem\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $skillSys "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'skillsystem\catalogs') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $skillSys "catalogs\$($_.Name)")}
Get-ChildItem (Join-Path $root 'core\skill-contracts') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $skillSys "contracts\$($_.Name)")}
Copy-SafeFile (Join-Path $root "skillsystem\bindings\$CanonicalAdapter.json") (Join-Path $skillSys "bindings\$CanonicalAdapter.json")
Copy-SafeFile (Join-Path $root "skillsystem\discovery\$CanonicalAdapter.json") (Join-Path $skillSys "discovery\$CanonicalAdapter.json")
Copy-SafeFile (Join-Path $root 'skillsystem\acquisition\source-catalog.json') (Join-Path $skillSys 'acquisition\source-catalog.json')
Copy-SafeFile (Join-Path $root "skillsystem\acquisition\$CanonicalAdapter.json") (Join-Path $skillSys "acquisition\$CanonicalAdapter.json")
Copy-SafeFile (Join-Path $root "adapters\$CanonicalAdapter\scripts\acquire-skill.ps1") (Join-Path $ale "adapters\$CanonicalAdapter\acquire-skill.ps1")
New-Item -ItemType Directory -Path (Join-Path $ale 'skills') -Force | Out-Null

# Multi-Model P1-P3: Judge evidence, deterministic Model Router, and forward extension projection.
$mm=Join-Path $ale 'multimodel'
Copy-SafeFile (Join-Path $root 'multimodel\engine\multimodel.mjs') (Join-Path $mm 'runtime\multimodel.mjs')
Copy-SafeFile (Join-Path $root 'multimodel\router\model-router.mjs') (Join-Path $mm 'router\model-router.mjs')
# Multi-Model forward extensions (P3+). Preserve relative layout so future extensions do not require installer edits.
$mmExt=Join-Path $root 'multimodel\extensions'
if (Test-Path $mmExt) {
  Get-ChildItem $mmExt -Recurse -File | ForEach-Object {
    $rel=$_.FullName.Substring($mmExt.Length).TrimStart([char[]]"\/")
    Copy-SafeFile $_.FullName (Join-Path $mm "extensions\$rel")
  }
}
Copy-SafeFile (Join-Path $root 'multimodel\registry\model-registry.json') (Join-Path $mm 'registry\model-registry.json')
Get-ChildItem (Join-Path $root 'multimodel\policies') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $mm "policies\$($_.Name)")}
Get-ChildItem (Join-Path $root 'multimodel\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $mm "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'multimodel\templates') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $mm "templates\$($_.Name)")}

# Advanced Execution P1+: forward-project the whole execution surface recursively.
# Future worker/concurrency/dispatcher/multi-machine phases can add files without installer edits.
$execSrc=Join-Path $root 'advanced-execution'
$execDst=Join-Path $ale 'execution'
if (Test-Path $execSrc) {
  Get-ChildItem $execSrc -Recurse -File | ForEach-Object {
    $rel=$_.FullName.Substring($execSrc.Length).TrimStart([char[]]"\/")
    Copy-SafeFile $_.FullName (Join-Path $execDst $rel)
  }
}


# ContextOS Phase 1+2+3+4+5+6: budgets, handoffs, checkpoint/resume, diff-first, de-dup, persistent maps, freshness, research cache and telemetry.
$ctx=Join-Path $ale 'contextos'
Copy-SafeFile (Join-Path $root 'contextos\engine\contextos.mjs') (Join-Path $ctx 'runtime\contextos.mjs')
Copy-SafeFile (Join-Path $root 'contextos\engine\knowledge.mjs') (Join-Path $ctx 'runtime\knowledge.mjs')
Copy-SafeFile (Join-Path $root 'contextos\engine\research-cache.mjs') (Join-Path $ctx 'runtime\research-cache.mjs')
Copy-SafeFile (Join-Path $root 'contextos\engine\telemetry.mjs') (Join-Path $ctx 'runtime\telemetry.mjs')
Copy-SafeFile (Join-Path $root 'contextos\policies\context-policy.json') (Join-Path $ctx 'policies\context-policy.json')
Get-ChildItem (Join-Path $root 'contextos\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $ctx "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'contextos\templates') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $ctx "templates\$($_.Name)")}
Get-ChildItem (Join-Path $root 'core\context-contracts') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $ctx "contracts\$($_.Name)")}

# Global Efficiency P7: transversal execution governor, compact decision contracts and quality-preserving benchmark verifier.
$eff=Join-Path $ale 'efficiency'
Copy-SafeFile (Join-Path $root 'efficiency\engine\efficiency-governor.mjs') (Join-Path $eff 'runtime\efficiency-governor.mjs')
Copy-SafeFile (Join-Path $root 'efficiency\policies\efficiency-policy.json') (Join-Path $eff 'policies\efficiency-policy.json')
Get-ChildItem (Join-Path $root 'efficiency\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $eff "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'efficiency\templates') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $eff "templates\$($_.Name)")}
Get-ChildItem (Join-Path $root 'efficiency\contracts') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $eff "contracts\$($_.Name)")}

# Security & Reliability P8: deterministic scans, read-only Security Reviewer evidence and durable reliability registries.
$sr=Join-Path $ale 'security-reliability'
Copy-SafeFile (Join-Path $root 'security-reliability\engine\security-assurance.mjs') (Join-Path $sr 'runtime\security-assurance.mjs')
Copy-SafeFile (Join-Path $root 'security-reliability\engine\reliability-registry.mjs') (Join-Path $sr 'runtime\reliability-registry.mjs')
Copy-SafeFile (Join-Path $root 'security-reliability\policies\security-reliability-policy.json') (Join-Path $sr 'policies\security-reliability-policy.json')
Get-ChildItem (Join-Path $root 'security-reliability\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $sr "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'security-reliability\templates') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $sr "templates\$($_.Name)")}
Get-ChildItem (Join-Path $root 'security-reliability\contracts') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $sr "contracts\$($_.Name)")}

# UX/UI System Phase 1+2+3+4+5+6: project mode, Design Context, reuse, Genesis/Discovery, Guardian/Judge, Motion and UI standards governance.
$ux=Join-Path $ale 'uxui'
Copy-SafeFile (Join-Path $root 'uxui\engine\uxui.mjs') (Join-Path $ux 'runtime\uxui.mjs')
Copy-SafeFile (Join-Path $root 'uxui\engine\component-registry.mjs') (Join-Path $ux 'runtime\component-registry.mjs')
Copy-SafeFile (Join-Path $root 'uxui\engine\design-bootstrap.mjs') (Join-Path $ux 'runtime\design-bootstrap.mjs')
Copy-SafeFile (Join-Path $root 'uxui\engine\design-review.mjs') (Join-Path $ux 'runtime\design-review.mjs')
Copy-SafeFile (Join-Path $root 'uxui\engine\motion.mjs') (Join-Path $ux 'runtime\motion.mjs')
Copy-SafeFile (Join-Path $root 'uxui\engine\ui-quality.mjs') (Join-Path $ux 'runtime\ui-quality.mjs')
Copy-SafeFile (Join-Path $root 'uxui\policies\uxui-policy.json') (Join-Path $ux 'policies\uxui-policy.json')
Get-ChildItem (Join-Path $root 'uxui\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $ux "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'uxui\templates') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $ux "templates\$($_.Name)")}
Get-ChildItem (Join-Path $root 'core\design\contracts') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $ux "contracts\$($_.Name)")}

# Visual QA Phase 1+2+3+4+5: capture, regression, runtime checks, semantic judge + bounded repair.
$vqa=Join-Path $ale 'visualqa'
Copy-SafeFile (Join-Path $root 'visualqa\engine\visualqa.mjs') (Join-Path $vqa 'runtime\visualqa.mjs')
Copy-SafeFile (Join-Path $root 'visualqa\engine\browser-runner.mjs') (Join-Path $vqa 'runtime\browser-runner.mjs')
Copy-SafeFile (Join-Path $root 'visualqa\engine\regression.mjs') (Join-Path $vqa 'runtime\regression.mjs')
Copy-SafeFile (Join-Path $root 'visualqa\engine\png-codec.mjs') (Join-Path $vqa 'runtime\png-codec.mjs')
Copy-SafeFile (Join-Path $root 'visualqa\engine\runtime-audit.mjs') (Join-Path $vqa 'runtime\runtime-audit.mjs')
Copy-SafeFile (Join-Path $root 'visualqa\engine\visual-judge.mjs') (Join-Path $vqa 'runtime\visual-judge.mjs')
Get-ChildItem (Join-Path $adapterRoot 'visualqa') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $vqa "providers\$($_.Name)")}
Copy-SafeFile (Join-Path $root 'visualqa\policies\visualqa-policy.json') (Join-Path $vqa 'policies\visualqa-policy.json')
Get-ChildItem (Join-Path $root 'visualqa\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $vqa "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'visualqa\templates') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $vqa "templates\$($_.Name)")}
Get-ChildItem (Join-Path $root 'core\design\contracts') -Filter 'VISUAL_QA_*.md' -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $vqa "contracts\$($_.Name)")}

# AleDevOS V1 final target-runtime validation + fail-closed release gate.
$rel=Join-Path $ale 'release'
Copy-SafeFile (Join-Path $root 'release\engine\v1-release.mjs') (Join-Path $rel 'runtime\v1-release.mjs')
Copy-SafeFile (Join-Path $root 'release\policies\v1-release-policy.json') (Join-Path $rel 'policies\v1-release-policy.json')
Get-ChildItem (Join-Path $root 'release\schemas') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $rel "schemas\$($_.Name)")}
Get-ChildItem (Join-Path $root 'release\templates') -File | ForEach-Object {Copy-SafeFile $_.FullName (Join-Path $rel "templates\$($_.Name)")}
Copy-SafeFile (Join-Path $root 'VERSION.txt') (Join-Path $rel 'VERSION.txt')

$proj=Join-Path $ale 'project.json'
if(-not (Test-Path $proj)){
  $cfg=Get-Content (Join-Path $adapterRoot 'project-template.json') -Raw | ConvertFrom-Json
  $cfg.project_name=Split-Path $target -Leaf
  # Adapter registration is transactional. Do not claim installation until
  # every projection and validation step below succeeds.
  $cfg.adapter=$null
  $cfg.adapters=@()
  $cfg.adapter_contract_version='2.0'
  $pkg=Join-Path $target 'package.json'
  if(Test-Path $pkg){
    $p=Get-Content $pkg -Raw | ConvertFrom-Json;$pm='npm'
    if(Test-Path (Join-Path $target 'pnpm-lock.yaml')){$pm='pnpm'}elseif(Test-Path (Join-Path $target 'yarn.lock')){$pm='yarn'}
    $g=@();$scriptIntegrity=[ordered]@{}
    $scriptsObj=$null
    if($p.PSObject.Properties.Name -contains 'scripts'){$scriptsObj=$p.scripts}
    if($scriptsObj){
      $scriptNames=@($scriptsObj.PSObject.Properties.Name)
      if($scriptNames -contains 'typecheck'){
        $cmd=if($pm -eq 'npm'){'npm run typecheck'}else{"$pm run typecheck"}
        $g+=[pscustomobject]@{id='typecheck';command=$cmd;required=$true;timeout_seconds=600}
        $scriptIntegrity.typecheck=[string]$scriptsObj.typecheck
      }
      if($scriptNames -contains 'lint'){
        $cmd=if($pm -eq 'npm'){'npm run lint'}else{"$pm run lint"}
        $g+=[pscustomobject]@{id='lint';command=$cmd;required=$true;timeout_seconds=600}
        $scriptIntegrity.lint=[string]$scriptsObj.lint
      }
      if($scriptNames -contains 'test'){
        $cmd=if($pm -eq 'npm'){'npm test'}else{"$pm test"}
        $g+=[pscustomobject]@{id='tests';command=$cmd;required=$true;timeout_seconds=900}
        $scriptIntegrity.test=[string]$scriptsObj.test
      }
      if($scriptNames -contains 'build'){
        $cmd=if($pm -eq 'npm'){'npm run build'}else{"$pm run build"}
        $g+=[pscustomobject]@{id='build';command=$cmd;required=$true;timeout_seconds=900}
        $scriptIntegrity.build=[string]$scriptsObj.build
      }
    }
    $cfg.gates=$g;$cfg.configured=($g.Count -gt 0);$cfg.gate_integrity.package_scripts=[pscustomobject]$scriptIntegrity
  }

  # Fingerprint gate-affecting configuration. A legitimate change requires human refresh.
  $fileIntegrity=[ordered]@{}
  $patterns=@('tsconfig*.json','vite.config.*','vitest.config.*','jest.config.*','eslint.config.*','.eslintrc*','pytest.ini')
  foreach($pattern in $patterns){Get-ChildItem -Path $target -Filter $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {$rel=$_.FullName.Substring($target.Length).TrimStart('\','/').Replace('\','/');$fileIntegrity[$rel]=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}
  $py=Join-Path $target 'pyproject.toml';if(Test-Path $py){$fileIntegrity['pyproject.toml']=(Get-FileHash $py -Algorithm SHA256).Hash.ToLowerInvariant()}
  $cfg.gate_integrity.files=[pscustomobject]$fileIntegrity

  New-Item -ItemType Directory -Path $ale -Force | Out-Null
  Write-Utf8NoBom $proj ($cfg | ConvertTo-Json -Depth 10)
  Write-Host "Created: $proj (configured=$($cfg.configured))" -ForegroundColor Cyan
}else{
  $cfg=Get-Content $proj -Raw | ConvertFrom-Json
  $existingAdapters=@()
  if($cfg.adapters){$existingAdapters=@($cfg.adapters | ForEach-Object {[string]$_})}
  elseif($cfg.adapter){$existingAdapters=@([string]$cfg.adapter)}
  $existingAdapters=@($existingAdapters | Where-Object {$_} | Sort-Object -Unique)
  $displayAdapters=if($existingAdapters.Count -gt 0){$existingAdapters -join ', '}else{'none'}
  # Normalize legacy Windows PowerShell UTF-8 BOM before any Node runtime reads project.json.
  Write-Utf8NoBom $proj ($cfg | ConvertTo-Json -Depth 10)
  Write-Host "AleDevOS adapters previously registered: $displayAdapters" -ForegroundColor Cyan
}
New-Item -ItemType Directory -Path (Join-Path $ale 'state') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\skills\routes') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\skills\compositions') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\skills\loads') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\skills\execution-handoffs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\skills\governance') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\skills\executions') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\skills\acquisition') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'skills\acquisitions') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\contextos\checkpoints') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\contextos\resume') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\contextos\diffs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\contextos\dedup') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\contextos\packets') -Force | Out-Null
# Mutable runtime knowledge + source-bound research cache.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\knowledge\domains') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\knowledge\research') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\knowledge\.internal') -Force | Out-Null
# Mutable runtime telemetry. Persistent evidence remains durable under the state plane.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\telemetry\contextos\runs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\telemetry\contextos\comparisons') -Force | Out-Null
# P7 Global Efficiency plans, closed decisions and benchmark receipts.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\efficiency\plans') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\efficiency\decisions') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\efficiency\benchmarks') -Force | Out-Null
# P8 Security & Reliability evidence + durable mutable registries.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\security-reliability') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\reliability\bugs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\reliability\vulnerabilities') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\reliability\incidents') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\reliability\test-health') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\reliability\known-issues') -Force | Out-Null
# Skill System Phase 4 privacy-safe execution telemetry.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\telemetry\skills') -Force | Out-Null
# UX/UI transient runtime evidence. Canonical Design Context and Component Registry live outside state.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\reuse-decisions') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\discovery') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase3\plans') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase3\discovery') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase3\evidence') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase4\guardian') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase4\judges') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase5\plans') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase5\contracts') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase5\reviews') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase6\state-contracts') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\uxui\phase6\reviews') -Force | Out-Null
# Visual QA Phase 1+2 transient plans, captures, receipts and result manifests.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase1\plans') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase1\runs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase1\artifacts') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase2\receipts') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase2\results') -Force | Out-Null
# Visual QA Phase 3 transient comparisons/diffs and persistent approved baselines.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase3\reports') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase3\diffs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'visualqa\baselines') -Force | Out-Null
# Visual QA Phase 4 sealed runtime DOM/layout/accessibility evidence.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase4\evidence') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase4\reports') -Force | Out-Null
# Visual QA Phase 5 sealed judge packets/submissions/judgments and bounded repair/acceptance evidence.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase5\packets') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase5\submissions') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase5\judgments') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase5\repairs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase5\cycles') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\visualqa\phase5\acceptance') -Force | Out-Null
# Multi-Model P1 evidence/comparisons, P2 routes, and P3 diversity decisions.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\multimodel\phase1\evidence') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\multimodel\phase1\comparisons') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\multimodel\phase1\bindings') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\multimodel\phase2\requests') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\multimodel\phase2\routes') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\multimodel\phase3\diversity') -Force | Out-Null
# Advanced Execution P1 worktree lifecycle evidence.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\execution\phase1\worktrees') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\execution\phase1\cleanup') -Force | Out-Null
# V1 final release-validation evidence.
New-Item -ItemType Directory -Path (Join-Path $ale 'state\release\v1\preflight') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\release\v1\inputs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\release\v1\evidence') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ale 'state\release\v1\reports') -Force | Out-Null
if($CanonicalAdapter -eq 'claude-code'){
  $instructionFile=Join-Path $target 'CLAUDE.md'
  if(-not (Test-Path $instructionFile)){
    Copy-SafeFile (Join-Path $adapterRoot 'CLAUDE.md.template') $instructionFile
  }
}else{
  $instructionFile=Join-Path $target 'AGENTS.md'
  $sharedTemplate=Join-Path $root 'core\templates\AGENTS.md.template'
  if(-not (Test-Path $instructionFile)){
    Copy-SafeFile $sharedTemplate $instructionFile
  }else{
    $head=(Get-Content $instructionFile -TotalCount 1 -ErrorAction SilentlyContinue)
    if($head -eq '# Project Agent Rules — AleDevOS'){
      $currentHash=(Get-FileHash $instructionFile -Algorithm SHA256).Hash
      $templateHash=(Get-FileHash $sharedTemplate -Algorithm SHA256).Hash
      if($currentHash -ne $templateHash){
        $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
        Copy-Item $instructionFile "$instructionFile.aledevos-migration-$stamp.bak" -Force
        Copy-Item $sharedTemplate $instructionFile -Force
        Write-Host 'Migrated AleDevOS-managed AGENTS.md to adapter-neutral multi-runtime ingress.' -ForegroundColor Cyan
      }
    }else{
      Write-Host 'Existing user-managed AGENTS.md preserved.' -ForegroundColor Yellow
    }
  }
}

$gi=Join-Path $target '.gitignore';$line='.aledevos/state/'
if(Test-Path $gi){$raw=Get-Content $gi -Raw;if($raw -notmatch [regex]::Escape($line)){Add-Content $gi "`n# AleDevOS runtime state`n$line"}}
else{Set-Content -Encoding utf8 $gi "# AleDevOS runtime state`n$line"}


# Discover runtime skill sources, then build and verify the metadata-only registry.
$skillRuntime=Join-Path $skillSys 'runtime\skillsystem.mjs'
& node $skillRuntime discovery scan --project-root $target --adapter $CanonicalAdapter
if($LASTEXITCODE -ne 0){throw 'Skill discovery scan failed.'}
& node $skillRuntime registry build --project-root $target --adapter $CanonicalAdapter
if($LASTEXITCODE -ne 0){throw 'Skill registry build failed.'}
& node $skillRuntime registry verify --project-root $target --adapter $CanonicalAdapter
if($LASTEXITCODE -ne 0){throw 'Skill registry verification failed.'}

# Initialize truthful UX/UI project mode + Design Context if absent.
# Existing contexts are verified only after managed UX/UI sub-systems have had
# a chance to synchronize their own derived artifacts.
$uxRuntime=Join-Path $ux 'runtime\uxui.mjs'
$designManifest=Join-Path $target '.aledevos\design\design-context.json'
if(-not (Test-Path $designManifest)){
  & node $uxRuntime context init --project-root $target
  if($LASTEXITCODE -ne 0){throw 'UX/UI Design Context initialization failed.'}
}else{
  Write-Host 'Existing UX/UI Design Context detected; final verification deferred until managed artifact sync.' -ForegroundColor Cyan
}

# Phase 5: initialize/verify machine-readable Motion Language without inventing project values.
$motionRuntime=Join-Path $ux 'runtime\motion.mjs'
& node $motionRuntime language init --project-root $target
if($LASTEXITCODE -ne 0){throw 'UX/UI Motion Language initialization failed.'}
& node $motionRuntime language verify --project-root $target
if($LASTEXITCODE -ne 0){throw 'UX/UI Motion Language verification failed.'}

# Phase 6: initialize/verify accessibility, responsive, UI states and UI ADR structures without inventing project values.
$uiQualityRuntime=Join-Path $ux 'runtime\ui-quality.mjs'
& node $uiQualityRuntime standards init --project-root $target
if($LASTEXITCODE -ne 0){throw 'UX/UI Phase 6 standards initialization failed.'}
& node $uiQualityRuntime standards verify --project-root $target
if($LASTEXITCODE -ne 0){throw 'UX/UI Phase 6 standards verification failed.'}

# Phase 2: establish/verify the managed canonical Component Registry.
$componentRuntime=Join-Path $ux 'runtime\component-registry.mjs'
& node $componentRuntime registry init --project-root $target
if($LASTEXITCODE -ne 0){throw 'UX/UI Component Registry initialization failed.'}
& node $componentRuntime registry verify --project-root $target
if($LASTEXITCODE -ne 0){throw 'UX/UI Component Registry verification failed.'}

# Final Design Context verification happens after all installer-managed UX/UI
# artifacts have initialized/synchronized their canonical hashes.
& node $uxRuntime context verify --project-root $target
if($LASTEXITCODE -ne 0){throw 'UX/UI Design Context final verification failed.'}

# Visual QA Phase 1 does not render during install; report readiness without inventing viewports.
$visualQaRuntime=Join-Path $vqa 'runtime\visualqa.mjs'
& node $visualQaRuntime system status --project-root $target
if($LASTEXITCODE -ne 0){throw 'Visual QA Phase 1 readiness check failed.'}

# Commit adapter registration only after every installation/validation step passed.
$cfg=Get-Content $proj -Raw | ConvertFrom-Json
$installedAdapters=@()
if($cfg.adapters){$installedAdapters=@($cfg.adapters | ForEach-Object {[string]$_})}
elseif($cfg.adapter){$installedAdapters=@([string]$cfg.adapter)}
if($installedAdapters -notcontains $CanonicalAdapter){$installedAdapters += $CanonicalAdapter}
$installedAdapters=@($installedAdapters | Where-Object {$_} | Sort-Object -Unique)
$cfg | Add-Member -NotePropertyName adapters -NotePropertyValue $installedAdapters -Force
if(-not $cfg.adapter -and $installedAdapters.Count -gt 0){
  $cfg | Add-Member -NotePropertyName adapter -NotePropertyValue $installedAdapters[0] -Force
}
$cfg.adapter_contract_version='2.0'
$adapterTemplate=Get-Content (Join-Path $adapterRoot 'project-template.json') -Raw | ConvertFrom-Json
$cfg.protected_paths=@((@($cfg.protected_paths)+@($adapterTemplate.protected_paths)) | Sort-Object -Unique)
Write-Utf8NoBom $proj ($cfg | ConvertTo-Json -Depth 10)

Write-Host "`nAleDevOS adapter '$RequestedAdapter' (canonical '$CanonicalAdapter') installed into: $target" -ForegroundColor Green
Write-Host ("AleDevOS adapters installed: " + ($installedAdapters -join ', ')) -ForegroundColor Green
$runtimeHint=if($CanonicalAdapter -eq 'codex'){'Restart Codex before runtime validation.'}elseif($CanonicalAdapter -eq 'claude-code'){'Restart Claude Code before runtime validation. On native Windows, target validation must report OS sandbox unavailable; use WSL2 for OS-level sandboxing.'}elseif($CanonicalAdapter -eq 'antigravity'){'Restart Google Antigravity before runtime validation. Target validation must actively probe workspace hooks and effective permissions for this OS/auth/version.'}else{'Restart OpenCode before runtime validation.'}
Write-Host "Review .aledevos\project.json. Runtime-generated knowledge, telemetry and reliability evidence live under .aledevos\state\**. Bootstrap maps with: node .aledevos\contextos\runtime\contextos.mjs knowledge build`nCheck freshness with: node .aledevos\contextos\runtime\contextos.mjs knowledge freshness`nRefresh incrementally with: node .aledevos\contextos\runtime\contextos.mjs knowledge refresh`nTelemetry: node .aledevos\contextos\runtime\contextos.mjs telemetry start --run-id <id> --task-id <task>`nEfficiency P7: node .aledevos\efficiency\runtime\efficiency-governor.mjs inventory --root .`nSecurity P8: node .aledevos\security-reliability\runtime\security-assurance.mjs inventory --root .`n$runtimeHint"
Write-Host 'If a reviewed task legitimately changes gate scripts/config, refresh integrity manually with scripts\11-refresh-gate-integrity.ps1.' -ForegroundColor Yellow
