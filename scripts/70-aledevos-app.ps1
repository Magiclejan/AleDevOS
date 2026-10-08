Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:AppScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = Split-Path -Parent $script:AppScriptPath
$Root = Split-Path -Parent $ScriptDir
$GlobalStateDir = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'AleDevOS\launcher' } else { Join-Path $Root '.aledevos\state\launcher' }
$ProjectRegistryFile = Join-Path $GlobalStateDir 'projects.json'
$LegacyLauncherStateFile = Join-Path (Join-Path $Root '.aledevos\state\launcher') 'active-project.json'
$CampaignRel = '.aledevos\state\release\master\campaigns\FINAL_MASTER_CAMPAIGN.json'
$script:SessionProject = $null
$script:LaunchCwd = if ($env:ALEDEVOS_LAUNCH_CWD) { $env:ALEDEVOS_LAUNCH_CWD } else { (Get-Location).Path }

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
}

function Resolve-FullPathSafe([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
  try { return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path } catch { return $null }
}

function Test-AleDevOSProject([string]$Path) {
  $resolved = Resolve-FullPathSafe $Path
  if (-not $resolved) { return $false }
  return (Test-Path -LiteralPath (Join-Path $resolved '.aledevos\project.json') -PathType Leaf)
}

function Get-ProjectDisplayName([string]$Path) {
  try {
    $pj = Get-Content -LiteralPath (Join-Path $Path '.aledevos\project.json') -Raw | ConvertFrom-Json
    foreach ($prop in @('name','project_name','id')) {
      if ($pj.PSObject.Properties.Name -contains $prop -and -not [string]::IsNullOrWhiteSpace([string]$pj.$prop)) { return [string]$pj.$prop }
    }
  } catch { }
  return (Split-Path -Leaf $Path)
}

function Read-ProjectRegistry {
  if (-not (Test-Path -LiteralPath $ProjectRegistryFile -PathType Leaf)) { return [pscustomobject]@{ schema_version='1.0'; projects=@() } }
  try {
    $r = Get-Content -LiteralPath $ProjectRegistryFile -Raw | ConvertFrom-Json
    if (-not ($r.PSObject.Properties.Name -contains 'projects')) { $r | Add-Member -NotePropertyName projects -NotePropertyValue @() }
    return $r
  } catch {
    Write-Host "[WARN] Registro de proyectos corrupto; se reconstruira: $ProjectRegistryFile" -ForegroundColor Yellow
    return [pscustomobject]@{ schema_version='1.0'; projects=@() }
  }
}

function Write-ProjectRegistry($Registry) {
  Ensure-Dir $GlobalStateDir
  $Registry | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ProjectRegistryFile -Encoding UTF8
}

function Register-Project([string]$Path, [switch]$TouchLastUsed) {
  $resolved = Resolve-FullPathSafe $Path
  if (-not $resolved -or -not (Test-AleDevOSProject $resolved)) { return $null }
  $r = Read-ProjectRegistry
  $items = @($r.projects)
  $now = (Get-Date).ToUniversalTime().ToString('o')
  $existing = $items | Where-Object { $_.path -and ([string]$_.path).Equals($resolved,[StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
  if ($existing) {
    $existing.name = Get-ProjectDisplayName $resolved
    $existing.last_seen_at = $now
    if ($TouchLastUsed) { $existing.last_used_at = $now }
  } else {
    $items += [pscustomobject]@{ path=$resolved; name=(Get-ProjectDisplayName $resolved); added_at=$now; last_seen_at=$now; last_used_at=$(if ($TouchLastUsed) { $now } else { $null }) }
  }
  $r.projects = @($items)
  Write-ProjectRegistry $r
  return $resolved
}

function Remove-KnownProject([string]$Path) {
  $r = Read-ProjectRegistry
  $r.projects = @($r.projects | Where-Object { -not ($_.path -and ([string]$_.path).Equals($Path,[StringComparison]::OrdinalIgnoreCase)) })
  Write-ProjectRegistry $r
  if ($script:SessionProject -and $script:SessionProject.Equals($Path,[StringComparison]::OrdinalIgnoreCase)) { $script:SessionProject = $null }
}

function Get-KnownProjects([switch]$IncludeMissing) {
  $r = Read-ProjectRegistry
  $items = @()
  foreach ($item in @($r.projects)) {
    if (-not $item.path) { continue }
    $resolved = Resolve-FullPathSafe ([string]$item.path)
    $valid = $false
    if ($resolved) { $valid = Test-AleDevOSProject $resolved }
    if ($valid) {
      $items += [pscustomobject]@{ path=$resolved; name=(Get-ProjectDisplayName $resolved); valid=$true; last_used_at=$item.last_used_at }
    } elseif ($IncludeMissing) {
      $items += [pscustomobject]@{ path=[string]$item.path; name=[string]$item.name; valid=$false; last_used_at=$item.last_used_at }
    }
  }
  return @($items | Sort-Object @{Expression={ if ($_.last_used_at) { [datetime]$_.last_used_at } else { [datetime]::MinValue } }; Descending=$true}, name)
}

function Find-ProjectUpwards([string]$StartPath) {
  $current = Resolve-FullPathSafe $StartPath
  if (-not $current) { return $null }
  if (Test-Path -LiteralPath $current -PathType Leaf) { $current = Split-Path -Parent $current }
  while ($current) {
    if (Test-AleDevOSProject $current) { return $current }
    $parent = Split-Path -Parent $current
    if (-not $parent -or $parent -eq $current) { break }
    $current = $parent
  }
  return $null
}

function Find-NearbyProjects {
  $parents = @()
  foreach ($seed in @($Root,$script:LaunchCwd)) {
    $r = Resolve-FullPathSafe $seed
    if (-not $r) { continue }
    $p = Split-Path -Parent $r
    if ($p) { $parents += $p }
    $pp = if ($p) { Split-Path -Parent $p } else { $null }
    if ($pp) { $parents += $pp }
  }
  $found = @()
  foreach ($parent in ($parents | Sort-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) { continue }
    foreach ($d in (Get-ChildItem -LiteralPath $parent -Directory -ErrorAction SilentlyContinue)) {
      if (Test-AleDevOSProject $d.FullName) { $found += $d.FullName }
    }
  }
  return @($found | Sort-Object -Unique)
}

function Show-AdvancedMenu {
  while ($true) {
    Clear-Host
    Write-Host '============================================================'
    Write-Host '             AleDevOS - AVANZADO'
    Write-Host '============================================================'
    Write-Host '  1. Comprobar runtimes reales del equipo'
    Write-Host '  2. Instalar / actualizar manualmente un proyecto'
    Write-Host '  3. Preparar P3-P8 + campana FINAL'
    Write-Host '  4. Ejecutar campana FINAL'
    Write-Host '  5. Gestionar proyectos conocidos'
    Write-Host '  6. Estado interno del paquete'
    Write-Host '  7. Volver'
    Write-Host ''
    $c = Read-Host 'Elige una opcion [1-7]'
    try {
      switch ($c) {
        '1' { Check-Runtimes }
        '2' { Install-OrUpdate }
        '3' { [void](Prepare-FinalCampaign) }
        '4' { Execute-FinalCampaign }
        '5' { Manage-KnownProjects }
        '6' { Show-PackageStatus }
        '7' { return }
        default { Write-Host 'Opcion invalida.' -ForegroundColor Yellow }
      }
    } catch {
      Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    }
    if ($c -ne '7') {
      Write-Host ''
      Read-Host 'Pulsa ENTER para continuar' | Out-Null
    }
  }
}

Sync-ProjectRegistry {
  if (Test-Path -LiteralPath $LegacyLauncherStateFile -PathType Leaf) {
    try {
      $legacy = Get-Content -LiteralPath $LegacyLauncherStateFile -Raw | ConvertFrom-Json
      if ($legacy.project_path -and (Test-AleDevOSProject $legacy.project_path)) { [void](Register-Project $legacy.project_path) }
      $migrated = "$LegacyLauncherStateFile.hotfix12-migrated"
      if (-not (Test-Path -LiteralPath $migrated)) { Move-Item -LiteralPath $LegacyLauncherStateFile -Destination $migrated -Force }
    } catch { }
  }
  $fromLaunch = Find-ProjectUpwards $script:LaunchCwd
  if ($fromLaunch) { [void](Register-Project $fromLaunch); $script:SessionProject = $fromLaunch; return }
  foreach ($p in (Find-NearbyProjects)) { [void](Register-Project $p) }
  $valid = @(Get-KnownProjects)
  if ($valid.Count -eq 1) { $script:SessionProject = $valid[0].path }
}

function Select-ProjectForSession([switch]$ForcePrompt) {
  if (-not $ForcePrompt -and $script:SessionProject -and (Test-AleDevOSProject $script:SessionProject)) { return $script:SessionProject }
  $known = @(Get-KnownProjects)
  if (-not $ForcePrompt -and $known.Count -eq 1) {
    $script:SessionProject = $known[0].path
    [void](Register-Project $script:SessionProject -TouchLastUsed)
    return $script:SessionProject
  }
  Write-Host ''
  if ($known.Count -gt 0) {
    Write-Host 'Proyectos AleDevOS conocidos:' -ForegroundColor Cyan
    for ($i=0; $i -lt $known.Count; $i++) { Write-Host ("  {0}. {1}  [{2}]" -f ($i+1), $known[$i].name, $known[$i].path) }
  } else { Write-Host 'No hay proyectos AleDevOS conocidos todavia.' -ForegroundColor Yellow }
  Write-Host '  N. Registrar/usar otra ruta'
  Write-Host '  C. Cancelar'
  $sel = (Read-Host 'Seleccion').Trim()
  if ($sel -match '^[cC]$') { return $null }
  if ($sel -match '^[nN]$' -or $known.Count -eq 0) {
    $p = Read-Host 'Ruta completa del proyecto AleDevOS'
    if (-not (Test-AleDevOSProject $p)) { throw "La ruta no contiene .aledevos\project.json: $p" }
    $script:SessionProject = Register-Project $p -TouchLastUsed
    return $script:SessionProject
  }
  $n = 0
  if ([int]::TryParse($sel,[ref]$n) -and $n -ge 1 -and $n -le $known.Count) {
    $script:SessionProject = $known[$n-1].path
    [void](Register-Project $script:SessionProject -TouchLastUsed)
    return $script:SessionProject
  }
  throw 'Seleccion invalida.'
}

function Get-ProjectForAction {
  $p = Select-ProjectForSession
  if (-not $p) { throw 'Operacion cancelada: no hay proyecto seleccionado para esta sesion.' }
  return $p
}

function Change-SessionProject {
  $p = Select-ProjectForSession -ForcePrompt
  if ($p) { Write-Host "[OK] Proyecto de esta sesion: $p" -ForegroundColor Green }
}

function Manage-KnownProjects {
  while ($true) {
    $all = @(Get-KnownProjects -IncludeMissing)
    Write-Host ''
    Write-Host '============================================================'
    Write-Host 'AleDevOS - PROYECTOS CONOCIDOS'
    Write-Host '============================================================'
    if ($all.Count -eq 0) { Write-Host 'Ninguno.' }
    for ($i=0; $i -lt $all.Count; $i++) {
      $status = if ($all[$i].valid) { 'OK' } else { 'NO ENCONTRADO' }
      Write-Host ("  {0}. [{1}] {2}  {3}" -f ($i+1),$status,$all[$i].name,$all[$i].path)
    }
    Write-Host ''
    Write-Host '  A. Agregar ruta'
    Write-Host '  R. Quitar del registro (NO borra el proyecto)'
    Write-Host '  S. Reescanear proyectos cercanos'
    Write-Host '  V. Volver'
    $c=(Read-Host 'Opcion').Trim()
    switch -Regex ($c) {
      '^[aA]$' {
        $p=Read-Host 'Ruta completa del proyecto'
        if (-not (Test-AleDevOSProject $p)) { Write-Host '[ERROR] No es una instalacion AleDevOS valida.' -ForegroundColor Red }
        else { [void](Register-Project $p); Write-Host '[OK] Registrado.' -ForegroundColor Green }
      }
      '^[rR]$' {
        if ($all.Count -eq 0) { continue }
        $n=0; $x=Read-Host 'Numero a quitar del registro'
        if ([int]::TryParse($x,[ref]$n) -and $n -ge 1 -and $n -le $all.Count) {
          Remove-KnownProject $all[$n-1].path
          Write-Host '[OK] Quitado del registro. Los archivos del proyecto NO se tocaron.' -ForegroundColor Green
        }
      }
      '^[sS]$' { foreach ($p in (Find-NearbyProjects)) { [void](Register-Project $p) }; Write-Host '[OK] Registro actualizado.' -ForegroundColor Green }
      '^[vV]$' { return }
    }
  }
}

function Find-ScriptByText([string[]]$Patterns) {
  $scripts = Get-ChildItem -LiteralPath $ScriptDir -File -Filter '*.ps1' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $script:AppScriptPath }
  foreach ($s in $scripts) {
    try { $txt = Get-Content -LiteralPath $s.FullName -Raw -ErrorAction Stop } catch { continue }
    $ok = $true
    foreach ($p in $Patterns) { if ($txt -notmatch [regex]::Escape($p)) { $ok = $false; break } }
    if ($ok) { return $s.FullName }
  }
  return $null
}

function Get-ProjectJson([string]$Project) {
  try { return Get-Content -LiteralPath (Join-Path $Project '.aledevos\project.json') -Raw | ConvertFrom-Json }
  catch { return $null }
}

function Invoke-NodeInventory([string]$Project) {
  $gate = Join-Path $Project '.aledevos\release\templates\final-master-gate.mjs'
  if (-not (Test-Path -LiteralPath $gate -PathType Leaf)) { return $false }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $false }

  $attempts = @(
    @('inventory','--root',$Project),
    @('--root',$Project,'inventory'),
    @('inventory',$Project),
    @('inventory')
  )
  foreach ($args in $attempts) {
    Push-Location $Project
    try {
      $out = & $node.Source $gate @args 2>&1 | Out-String
      $code = $LASTEXITCODE
    } finally { Pop-Location }
    if ($code -eq 0 -and ($out -match 'FINAL_MASTER_GATE' -or $out -match 'required_checks' -or $out -match 'V1_RELEASE')) {
      Write-Host $out
      return $true
    }
  }
  return $false
}

function Get-InstalledProjectAdapters($ProjectJson) {
  $out = @()
  if ($ProjectJson) {
    $names = @($ProjectJson.PSObject.Properties.Name)
    if (($names -contains 'adapters') -and $ProjectJson.adapters) {
      foreach ($a in @($ProjectJson.adapters)) {
        if ($a) { $out += [string]$a }
      }
    } elseif ($ProjectJson.adapter) {
      $out += [string]$ProjectJson.adapter
    }
  }
  return @($out | Where-Object { $_ } | Sort-Object -Unique)
}

function Get-AdapterProjectionMarkers([string]$Project,[string]$Adapter) {
  $markers = @()
  switch ($Adapter) {
    'codex' {
      $markers += Join-Path $Project '.codex\config.toml'
      $markers += Join-Path $Project '.codex\agents\orchestrator.toml'
    }
    'opencode' {
      $markers += Join-Path $Project 'opencode.json'
      $markers += Join-Path $Project '.opencode\agents\orchestrator.md'
    }
    'claude-code' {
      $markers += Join-Path $Project '.claude\agents\orchestrator.md'
      $markers += Join-Path $Project 'CLAUDE.md'
    }
    'antigravity' {
      $markers += Join-Path $Project '.agents\agents\orchestrator.md'
    }
  }
  return @($markers)
}

function Test-AdapterRuntimeHealth([string]$Project,[string]$Adapter) {
  $errors = @()

  $markers = @(Get-AdapterProjectionMarkers $Project $Adapter)
  foreach ($marker in $markers) {
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) {
      $errors += ('missing_projection:' + (Relative-ToProject $Project $marker))
    }
  }

  $registryRelative = '.aledevos\skills\registries\' + $Adapter + '.json'
  $registry = Join-Path $Project $registryRelative
  $registryExists = Test-Path -LiteralPath $registry -PathType Leaf
  if (-not $registryExists) {
    $errors += ('missing_registry:' + $registryRelative.Replace('\','/'))
  }

  $skillRuntime = Join-Path $Project '.aledevos\skillsystem\runtime\skillsystem.mjs'
  $runtimeExists = Test-Path -LiteralPath $skillRuntime -PathType Leaf
  if (-not $runtimeExists) {
    $errors += 'skillsystem_runtime_missing'
  }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    $errors += 'node_not_found'
  }

  if ($node -and $runtimeExists -and $registryExists) {
    $code = 1
    $out = ''
    Push-Location $Project
    try {
      $out = & $node.Source $skillRuntime registry verify --project-root $Project --adapter $Adapter 2>&1 | Out-String
      $code = $LASTEXITCODE
    } finally {
      Pop-Location
    }
    if ($code -ne 0) {
      $flat = ($out -replace '[\r\n]+',' ').Trim()
      $errors += ('registry_verify_failed:' + $flat)
    }
  }

  $ok = ($errors.Count -eq 0)
  return [pscustomobject]@{
    adapter = $Adapter
    ok = $ok
    errors = @($errors)
  }
}

function Show-ProjectStatus {
  $p = Get-ProjectForAction
  Write-Host '============================================================'
  Write-Host 'AleDevOS - ESTADO DEL PROYECTO ACTIVO'
  Write-Host '============================================================'
  Write-Host ("Proyecto: " + $p)

  $pj = Get-ProjectJson $p
  $adapters = @(Get-InstalledProjectAdapters $pj)

  if ($pj) {
    if ($null -ne $pj.configured) {
      Write-Host ("configured: " + [string]$pj.configured)
    }
    if ($adapters.Count -gt 0) {
      Write-Host ("adapters: " + ($adapters -join ', '))
    } else {
      Write-Host 'adapters: NINGUNO'
    }
  }

  Write-Host ''
  Write-Host '--- Instalacion multi-runtime ---' -ForegroundColor Cyan

  $commonErrors = @()
  $coreRuntime = Join-Path $p '.aledevos\runtime\aledevos.mjs'
  $skillRuntime = Join-Path $p '.aledevos\skillsystem\runtime\skillsystem.mjs'
  $agentsFile = Join-Path $p 'AGENTS.md'

  if (-not (Test-Path -LiteralPath $coreRuntime -PathType Leaf)) {
    $commonErrors += '.aledevos/runtime/aledevos.mjs'
  }
  if (-not (Test-Path -LiteralPath $skillRuntime -PathType Leaf)) {
    $commonErrors += '.aledevos/skillsystem/runtime/skillsystem.mjs'
  }
  if (-not (Test-Path -LiteralPath $agentsFile -PathType Leaf)) {
    $commonErrors += 'AGENTS.md'
  }

  if ($commonErrors.Count -eq 0) {
    Write-Host '[PASS] Core/proyecto compartido' -ForegroundColor Green
  } else {
    Write-Host ('[BLOCKED] Core/proyecto compartido: faltan ' + ($commonErrors -join ', ')) -ForegroundColor Yellow
  }

  $health = @()
  foreach ($adapter in $adapters) {
    $h = Test-AdapterRuntimeHealth $p $adapter
    $health += $h
    if ($h.ok) {
      Write-Host ('[PASS] Adapter ' + $adapter + ': proyeccion + Skill Registry') -ForegroundColor Green
    } else {
      Write-Host ('[BLOCKED] Adapter ' + $adapter + ': ' + ($h.errors -join '; ')) -ForegroundColor Yellow
    }
  }

  if ($adapters.Count -eq 0) {
    Write-Host '[BLOCKED] No hay adapters registrados.' -ForegroundColor Yellow
  }

  $blockedAdapters = 0
  foreach ($h in $health) {
    if (-not $h.ok) { $blockedAdapters++ }
  }

  $installPass = $true
  if ($commonErrors.Count -ne 0) { $installPass = $false }
  if ($adapters.Count -eq 0) { $installPass = $false }
  if ($blockedAdapters -ne 0) { $installPass = $false }

  Write-Host ''
  if ($installPass) {
    Write-Host 'INSTALACION ALEDEVOS: PASS' -ForegroundColor Green
  } else {
    Write-Host 'INSTALACION ALEDEVOS: BLOCKED' -ForegroundColor Yellow
  }

  Write-Host ''
  Write-Host '--- Release / Master inventory ---' -ForegroundColor Cyan

  if (Invoke-NodeInventory $p) { return }

  $master = Join-Path $p '.aledevos\state\release\master'
  $campaign = Join-Path $p $CampaignRel
  $evidence = @()
  $profiles = @()

  if (Test-Path -LiteralPath $master -PathType Container) {
    $evidence = @(Get-ChildItem -LiteralPath $master -Recurse -File -Filter '*.json' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match '\\evidence\\|\\receipts?\\|receipt\.json$' })
    $profiles = @(Get-ChildItem -LiteralPath $master -Recurse -File -Filter '*.json' -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'profile' -and $_.Name -notmatch '\.schema\.|\.example\.' })
  }

  Write-Host '[INFO] El gate instalado no expuso un modo inventory compatible; se muestra inventario local seguro.' -ForegroundColor Yellow
  Write-Host ("Master state presente : " + [string](Test-Path -LiteralPath $master -PathType Container))
  Write-Host ("Evidencias/receipts   : " + [string]$evidence.Count)
  Write-Host ("Perfiles reales       : " + [string]$profiles.Count)
  Write-Host ("Campana canonica      : " + [string](Test-Path -LiteralPath $campaign -PathType Leaf))
}

function Get-RealProfileCandidates([string]$Project, [string[]]$Regexes) {
  # Hotfix13: target profiles may be emitted by phase runtimes outside release/master.
  # Search the whole installed AleDevOS state/config surface while excluding schemas/templates/examples.
  $roots = @(
    (Join-Path $Project '.aledevos\state'),
    (Join-Path $Project '.aledevos\multimodel'),
    (Join-Path $Project '.aledevos\visualqa'),
    (Join-Path $Project '.aledevos\execution'),
    (Join-Path $Project '.aledevos\efficiency'),
    (Join-Path $Project '.aledevos\security-reliability')
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }
  $files = @()
  foreach ($base in $roots) {
    $files += @(Get-ChildItem -LiteralPath $base -Recurse -File -Filter '*.json' -ErrorAction SilentlyContinue |
      Where-Object {
        $_.Name -notmatch '\.schema\.|\.example\.' -and
        $_.FullName -notmatch '\\templates\\|\\schemas\\|\\release\\certifications\\' -and
        $_.Name -match 'profile|target|binding|benchmark|assurance'
      })
  }
  $out = foreach ($f in ($files | Sort-Object FullName -Unique)) {
    foreach ($rx in $Regexes) {
      if ($f.Name -match $rx -or $f.FullName -match $rx) { $f.FullName; break }
    }
  }
  return @($out | Sort-Object -Unique)
}

function Invoke-NodeProbeCaptured([string]$Project,[string]$Script,[string[]]$Args,[string]$LogFile) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return [pscustomobject]@{ invoked=$false; exit_code=$null; output='node_not_found' } }
  Push-Location $Project
  try {
    $output = & $node.Source $Script @Args 2>&1 | Out-String
    $code = $LASTEXITCODE
  } catch {
    $output = $_ | Out-String
    $code = 1
  } finally { Pop-Location }
  try {
    Ensure-Dir (Split-Path -Parent $LogFile)
    @(
      ('COMMAND: node "{0}" {1}' -f $Script, (($Args | ForEach-Object { '"' + $_ + '"' }) -join ' ')),
      ('EXIT_CODE: {0}' -f $code),
      '',
      $output
    ) | Set-Content -LiteralPath $LogFile -Encoding UTF8
  } catch { }
  return [pscustomobject]@{ invoked=$true; exit_code=$code; output=$output }
}

function Get-PhaseDefinitions {
  return [ordered]@{
    p3_multimodel = [pscustomobject]@{
      phase='P3'; certifier='master-validation-p3-certifier.mjs'; validator='master-validator-multimodel.mjs'
      regexes=@('multimodel.*target.*profile','p3.*profile')
      keywords=@('inventory','prepare','generate','profile','binding','certify')
    }
    p4_visual = [pscustomobject]@{
      phase='P4'; certifier='master-validation-p4-certifier.mjs'; validator='master-validator-visual-runtime.mjs'
      regexes=@('visual.*target.*profile','p4.*profile')
      keywords=@('inventory','prepare','generate','profile','probe','certify')
    }
    p5_advanced_execution = [pscustomobject]@{
      phase='P5'; certifier='master-validation-p5-certifier.mjs'; validator='master-validator-advanced-execution.mjs'
      regexes=@('advanced.*execution.*target.*profile','p5.*profile')
      keywords=@('inventory','prepare','generate','profile','probe','certify')
    }
    p6_end_to_end = [pscustomobject]@{
      phase='P6'; certifier='master-validation-p6-certifier.mjs'; validator='master-validator-end-to-end.mjs'
      regexes=@('end[-_ ]?to[-_ ]?end.*target.*profile','p6.*profile')
      keywords=@('inventory','prepare','generate','profile','probe','certify')
    }
    p7_efficiency = [pscustomobject]@{
      phase='P7'; certifier='master-validation-p7-certifier.mjs'; validator='master-validator-efficiency.mjs'
      regexes=@('efficiency.*(target|benchmark).*profile','p7.*profile')
      keywords=@('inventory','prepare','generate','profile','benchmark','certify')
    }
    p8_security_reliability = [pscustomobject]@{
      phase='P8'; certifier='master-validation-p8-certifier.mjs'; validator='master-validator-security-reliability.mjs'
      regexes=@('security.*reliability.*target.*profile','security.*assurance.*profile','p8.*profile')
      keywords=@('inventory','prepare','generate','profile','assurance','scan','certify')
    }
  }
}

function Try-NativePhasePreparation([string]$Project,[string]$PhaseName,$Definition) {
  $existing = @(Get-RealProfileCandidates $Project $Definition.regexes)
  if ($existing.Count -gt 0) {
    return [pscustomobject]@{ phase=$Definition.phase; name=$PhaseName; status='FOUND'; profile=$existing[0]; attempts=@(); blocker=$null }
  }

  $templatesDir = Join-Path $Project '.aledevos\release\templates'
  $certifier = Join-Path $templatesDir $Definition.certifier
  $validator = Join-Path $templatesDir $Definition.validator
  if (-not (Test-Path -LiteralPath $certifier -PathType Leaf)) {
    return [pscustomobject]@{ phase=$Definition.phase; name=$PhaseName; status='BLOCKED'; profile=$null; attempts=@(); blocker=('missing_certifier:' + $Definition.certifier) }
  }

  $src = ''
  try { $src = Get-Content -LiteralPath $certifier -Raw } catch { }
  $attempts = @()
  $logDir = Join-Path $Project ('.aledevos\state\release\master\preparation\' + $PhaseName)
  Ensure-Dir $logDir

  # First request usage/help. These are discovery-only and must not create false evidence.
  foreach ($args in @(@('--help'),@('help'))) {
    $log = Join-Path $logDir ('help-' + (($args -join '-') -replace '[^A-Za-z0-9_-]','_') + '.log')
    $r = Invoke-NodeProbeCaptured $Project $certifier $args $log
    $attempts += [pscustomobject]@{ argv=$args; exit_code=$r.exit_code; log=(Relative-ToProject $Project $log) }
  }

  # Only try verbs that the certifier source actually declares. This prevents guessing destructive commands.
  $verbs = @()
  foreach ($k in $Definition.keywords) {
    if ($src -match ('\b' + [regex]::Escape($k) + '\b')) { $verbs += $k }
  }
  $verbs = @($verbs | Sort-Object -Unique)

  $safeCommandSets = @()
  if ($verbs -contains 'inventory') {
    $safeCommandSets += ,@('inventory','--root',$Project)
    $safeCommandSets += ,@('inventory',$Project)
  }
  if ($verbs -contains 'prepare') {
    $safeCommandSets += ,@('prepare','--root',$Project)
  }
  if ($verbs -contains 'generate') {
    $safeCommandSets += ,@('generate','--root',$Project)
  }
  if (($verbs -contains 'profile') -and $src -match '\bcreate\b') {
    $safeCommandSets += ,@('profile','create','--root',$Project)
  }
  if (($verbs -contains 'binding') -and $src -match '\binventory\b') {
    $safeCommandSets += ,@('binding','inventory','--root',$Project)
  }

  $i = 0
  foreach ($args in $safeCommandSets) {
    $i++
    $log = Join-Path $logDir (('attempt-{0:00}-{1}.log' -f $i,$args[0]))
    $r = Invoke-NodeProbeCaptured $Project $certifier $args $log
    $attempts += [pscustomobject]@{ argv=$args; exit_code=$r.exit_code; log=(Relative-ToProject $Project $log) }
    $after = @(Get-RealProfileCandidates $Project $Definition.regexes)
    if ($after.Count -gt 0) {
      return [pscustomobject]@{ phase=$Definition.phase; name=$PhaseName; status='PREPARED'; profile=$after[0]; attempts=$attempts; blocker=$null }
    }
  }

  # Validator inventory is also allowed when explicitly declared by source.
  if (Test-Path -LiteralPath $validator -PathType Leaf) {
    $vsrc=''; try { $vsrc=Get-Content -LiteralPath $validator -Raw } catch { }
    if ($vsrc -match '\binventory\b') {
      $log = Join-Path $logDir 'validator-inventory.log'
      $r = Invoke-NodeProbeCaptured $Project $validator @('inventory','--root',$Project) $log
      $attempts += [pscustomobject]@{ argv=@('inventory','--root',$Project); exit_code=$r.exit_code; log=(Relative-ToProject $Project $log) }
      $after = @(Get-RealProfileCandidates $Project $Definition.regexes)
      if ($after.Count -gt 0) {
        return [pscustomobject]@{ phase=$Definition.phase; name=$PhaseName; status='PREPARED'; profile=$after[0]; attempts=$attempts; blocker=$null }
      }
    }
  }

  $hint = switch ($PhaseName) {
    'p3_multimodel' { 'native_preparation_did_not_emit_profile; real primary/secondary model binding or runtime model inventory may still be missing' }
    'p4_visual' { 'native_preparation_did_not_emit_profile; real browser/render target or Playwright/Chromium target definition may still be missing' }
    'p5_advanced_execution' { 'native_preparation_did_not_emit_profile; real Git/worktree/worker target definition may still be missing' }
    'p6_end_to_end' { 'native_preparation_did_not_emit_profile; real full-stack project execution target may still be missing' }
    'p7_efficiency' { 'native_preparation_did_not_emit_profile; real benchmark target/budget profile may still be missing' }
    'p8_security_reliability' { 'native_preparation_did_not_emit_profile; real security/reliability target scope may still be missing' }
    default { 'native_preparation_did_not_emit_profile' }
  }
  return [pscustomobject]@{ phase=$Definition.phase; name=$PhaseName; status='BLOCKED'; profile=$null; attempts=$attempts; blocker=$hint }
}

function Invoke-AutomaticProfilePreparation([string]$Project) {
  $defs = Get-PhaseDefinitions
  $results = @()
  Write-Host '============================================================'
  Write-Host 'AleDevOS - PREPARACION AUTOMATICA P3-P8'
  Write-Host '============================================================'
  Write-Host "Proyecto: $Project"
  Write-Host 'AleDevOS ejecutara solo probes/preparadores nativos declarados por sus propios scripts.'
  Write-Host 'No se copiaran examples como evidencia ni se inventaran identidades/modelos.'
  Write-Host ''
  foreach ($name in $defs.Keys) {
    Write-Host ("[AUTO] {0} {1}..." -f $defs[$name].phase,$name) -ForegroundColor Cyan
    $r = Try-NativePhasePreparation $Project $name $defs[$name]
    $results += $r
    if ($r.status -eq 'FOUND' -or $r.status -eq 'PREPARED') {
      Write-Host ("  [OK] {0}" -f (Relative-ToProject $Project $r.profile)) -ForegroundColor Green
    } else {
      Write-Host ("  [BLOCKED] {0}" -f $r.blocker) -ForegroundColor Yellow
    }
  }
  $reportDir = Join-Path $Project '.aledevos\state\release\master\preparation'
  Ensure-Dir $reportDir
  $report = Join-Path $reportDir 'target-profile-preparation-report.json'
  [pscustomobject]@{
    schema_version='1.0'; phase='ALEDEVOS_FINAL_TARGET_PROFILE_PREPARATION'; project_root=$Project
    observed_at=(Get-Date).ToUniversalTime().ToString('o')
    summary=[pscustomobject]@{
      total=$results.Count
      ready=@($results | Where-Object { $_.status -in @('FOUND','PREPARED') }).Count
      blocked=@($results | Where-Object { $_.status -eq 'BLOCKED' }).Count
    }
    phases=$results
    claims=[pscustomobject]@{ examples_promoted_as_evidence=$false; fabricated_profiles=$false }
  } | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $report -Encoding UTF8
  Write-Host ''
  Write-Host "Informe: $report"
  return @($results)
}

function Relative-ToProject([string]$Project,[string]$Path) {
  $proj = [IO.Path]::GetFullPath($Project).TrimEnd('\\') + '\\'
  $full = [IO.Path]::GetFullPath($Path)
  if ($full.StartsWith($proj,[StringComparison]::OrdinalIgnoreCase)) {
    return $full.Substring($proj.Length).Replace('\\','/')
  }
  return $full
}

function Replace-JsonStrings($Value, [hashtable]$Map, [string]$Project, [string]$KeyHint='') {
  if ($null -eq $Value) { return $null }
  if ($Value -is [string]) {
    $s = $Value
    $s = $s.Replace('{{PROJECT_ROOT}}',$Project).Replace('${PROJECT_ROOT}',$Project).Replace('<PROJECT_ROOT>',$Project).Replace('__PROJECT_ROOT__',$Project)
    foreach ($k in $Map.Keys) {
      $v = $Map[$k]
      if (-not $v) { continue }
      if ($s -match $k -or $KeyHint -match $k) {
        if ($s -match '\.json$' -or $KeyHint -match 'profile|path|file') { return (Relative-ToProject $Project $v) }
      }
    }
    return $s
  }
  if ($Value -is [System.Collections.IDictionary]) {
    $h = [ordered]@{}
    foreach ($k in $Value.Keys) { $h[$k] = Replace-JsonStrings $Value[$k] $Map $Project ([string]$k) }
    return $h
  }
  if ($Value -is [pscustomobject]) {
    $h = [ordered]@{}
    foreach ($prop in $Value.PSObject.Properties) { $h[$prop.Name] = Replace-JsonStrings $prop.Value $Map $Project $prop.Name }
    return [pscustomobject]$h
  }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $arr = @(); foreach ($x in $Value) { $arr += ,(Replace-JsonStrings $x $Map $Project $KeyHint) }; return $arr
  }
  return $Value
}

function Prepare-FinalCampaign([switch]$Quiet) {
  $p = Get-ProjectForAction
  # Hotfix13: preparation is an orchestrated action, not a passive file search.
  $prepResults = @(Invoke-AutomaticProfilePreparation $p)
  $template = Join-Path $p '.aledevos\release\templates\FINAL_MASTER_CAMPAIGN.example.json'
  $schema = Join-Path $p '.aledevos\release\schemas\final-master-campaign.schema.json'
  if (-not (Test-Path -LiteralPath $template -PathType Leaf)) { throw "Falta template: $template" }
  if (-not (Test-Path -LiteralPath $schema -PathType Leaf)) { throw "Falta schema: $schema" }

  $defs = [ordered]@{
    p3_multimodel = @('multimodel.*target.*profile','p3.*profile')
    p4_visual = @('visual.*target.*profile','p4.*profile')
    p5_advanced_execution = @('advanced.*execution.*target.*profile','p5.*profile')
    p6_end_to_end = @('end[-_ ]?to[-_ ]?end.*target.*profile','p6.*profile')
    p7_efficiency = @('efficiency.*(target|benchmark).*profile','p7.*profile')
    p8_security_reliability = @('security.*reliability.*target.*profile','security.*assurance.*profile','p8.*profile')
  }

  $resolved = [ordered]@{}
  $missing = @()
  foreach ($name in $defs.Keys) {
    $c = @(Get-RealProfileCandidates $p $defs[$name])
    if ($c.Count -eq 0) { $missing += $name; continue }
    $resolved[$name] = ($c | ForEach-Object { Get-Item -LiteralPath $_ } | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
  }

  if ($missing.Count -gt 0) {
    if (-not $Quiet) {
      Write-Host '============================================================'
      Write-Host 'PREPARACION FINAL: BLOCKED' -ForegroundColor Yellow
      Write-Host '============================================================'
      Write-Host 'No se fabricara evidencia ni perfiles falsos.'
      Write-Host 'Faltan perfiles reales:'
      foreach ($m in $missing) { Write-Host "  - $m" }
      Write-Host ''
      Write-Host 'La app ya resolvio automaticamente proyecto, rutas y busqueda de artefactos.'
      Write-Host 'AleDevOS ya intento los preparadores/probes nativos. Revisa el informe de preparacion mostrado arriba.'
    }
    return $null
  }

  $raw = Get-Content -LiteralPath $template -Raw
  $obj = $raw | ConvertFrom-Json
  $map = @{}
  $map['multimodel|p3'] = $resolved.p3_multimodel
  $map['visual|p4'] = $resolved.p4_visual
  $map['advanced.*execution|p5'] = $resolved.p5_advanced_execution
  $map['end[-_ ]?to[-_ ]?end|p6'] = $resolved.p6_end_to_end
  $map['efficiency|p7'] = $resolved.p7_efficiency
  $map['security.*reliability|security.*assurance|p8'] = $resolved.p8_security_reliability
  $outObj = Replace-JsonStrings $obj $map $p

  # Fill common metadata only when those properties already exist.
  if ($outObj.PSObject.Properties.Name -contains 'project_root') { $outObj.project_root = $p }
  if ($outObj.PSObject.Properties.Name -contains 'project_path') { $outObj.project_path = $p }
  if ($outObj.PSObject.Properties.Name -contains 'generated_at') { $outObj.generated_at = (Get-Date).ToUniversalTime().ToString('o') }
  if ($outObj.PSObject.Properties.Name -contains 'created_at') { $outObj.created_at = (Get-Date).ToUniversalTime().ToString('o') }

  $dest = Join-Path $p $CampaignRel
  Ensure-Dir (Split-Path -Parent $dest)
  $outObj | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $dest -Encoding UTF8

  # Parse validation: at minimum ensure produced file is valid JSON and not the example path.
  $null = Get-Content -LiteralPath $dest -Raw | ConvertFrom-Json
  if (-not $Quiet) {
    Write-Host "[OK] Campana final preparada automaticamente:" -ForegroundColor Green
    Write-Host "     $dest"
    Write-Host '[OK] No tendras que escribir esta ruta en la ejecucion final.' -ForegroundColor Green
  }
  return $dest
}

function Patch-FinalGateForAutomation {
  $gate = Join-Path $ScriptDir '67-final-master-gate.ps1'
  if (-not (Test-Path -LiteralPath $gate -PathType Leaf)) {
    $gate = Find-ScriptByText @('Ruta del JSON de campana final')
  }
  if (-not $gate) { throw 'No se encontro el script de campana final.' }

  $txt = Get-Content -LiteralPath $gate -Raw
  if ($txt -match 'ALEDEVOS_FINAL_CAMPAIGN') { return $gate }

  $backup = "$gate.hotfix12.bak"
  if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $gate -Destination $backup -Force }

  $rx = '(?m)^(?<indent>\s*)\$(?<var>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*Read-Host\s+["'']Ruta del JSON de campana final[^\r\n]*["'']\s*$'
  $m = [regex]::Match($txt,$rx)
  if (-not $m.Success) {
    # Accept scripts whose prompt is built slightly differently.
    $rx = '(?m)^(?<indent>\s*)\$(?<var>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*Read-Host[^\r\n]*campana final[^\r\n]*$'
    $m = [regex]::Match($txt,$rx,[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  }
  if (-not $m.Success) { throw 'No se pudo localizar de forma segura el Read-Host de la ruta de campana. No se modifico el gate.' }

  $indent = $m.Groups['indent'].Value
  $var = $m.Groups['var'].Value
  $replacement = @"
${indent}if (`$env:ALEDEVOS_FINAL_CAMPAIGN -and (Test-Path -LiteralPath `$env:ALEDEVOS_FINAL_CAMPAIGN -PathType Leaf)) {
${indent}  `$$var = (Resolve-Path -LiteralPath `$env:ALEDEVOS_FINAL_CAMPAIGN).Path
${indent}} else {
${indent}  `$$var = Read-Host "Ruta del JSON de campana final"
${indent}}
"@.TrimEnd()
  $txt = $txt.Remove($m.Index,$m.Length).Insert($m.Index,$replacement)
  Set-Content -LiteralPath $gate -Value $txt -Encoding UTF8
  return $gate
}

function Execute-FinalCampaign {
  $p = Get-ProjectForAction
  $campaign = Join-Path $p $CampaignRel
  if (-not (Test-Path -LiteralPath $campaign -PathType Leaf)) {
    Write-Host '[AUTO] No existe campana canonica. Preparandola...' -ForegroundColor Cyan
    $campaign = Prepare-FinalCampaign -Quiet
  }
  if (-not $campaign -or -not (Test-Path -LiteralPath $campaign -PathType Leaf)) {
    Write-Host '[BLOCKED] La campana final no puede ejecutarse hasta que existan los perfiles reales P3-P8.' -ForegroundColor Yellow
    return
  }
  $gate = Patch-FinalGateForAutomation
  $old = $env:ALEDEVOS_FINAL_CAMPAIGN
  try {
    $env:ALEDEVOS_FINAL_CAMPAIGN = $campaign
    Write-Host "[AUTO] Proyecto : $p"
    Write-Host "[AUTO] Campana  : $campaign"
    Write-Host '[AUTO] La ruta ya fue inyectada; el gate no volvera a pedirtela.' -ForegroundColor Green
    & $gate
  } finally {
    $env:ALEDEVOS_FINAL_CAMPAIGN = $old
  }
}

function Check-Runtimes {
  $script = Join-Path $ScriptDir '53-master-validation-p2-target-adapters.ps1'
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    throw "No se encontro el comprobador canonico de runtimes P2: $script"
  }
  & $script
}

function Resolve-OrCreateProjectPath([string]$PathValue) {
  $raw = ([string]$PathValue).Trim().Trim('"')
  if ([string]::IsNullOrWhiteSpace($raw)) { throw 'No se indico una ruta de proyecto.' }
  $full = [IO.Path]::GetFullPath($raw)
  if (-not (Test-Path -LiteralPath $full)) {
    New-Item -ItemType Directory -Force -Path $full | Out-Null
    Write-Host "[OK] Proyecto nuevo creado: $full" -ForegroundColor Green
  } elseif (-not (Test-Path -LiteralPath $full -PathType Container)) {
    throw "La ruta no es una carpeta: $full"
  }
  return (Resolve-Path -LiteralPath $full).Path
}

function Select-ProjectAdapter {
  Write-Host 'Adapter: 1 Codex | 2 Claude Code | 3 OpenCode | 4 Antigravity | 5 Gemini(alias Antigravity)'
  $a = Read-Host 'Adapter [1-5]'
  switch ($a) {
    '1' {'codex'}
    '2' {'claude-code'}
    '3' {'opencode'}
    '4' {'antigravity'}
    '5' {'gemini'}
    default { throw 'Adapter invalido.' }
  }
}

function Install-OrUpdate {
  $installer = Join-Path $ScriptDir '05-install-into-project.ps1'
  if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw "Falta instalador: $installer" }
  $p = Resolve-OrCreateProjectPath (Read-Host 'Ruta completa del proyecto')
  $adapter = Select-ProjectAdapter
  $force = (Read-Host 'Permitir backup/reemplazo si ya existe [S/N]') -match '^[sS]$'
  if ($force) { & $installer -ProjectPath $p -Adapter $adapter -Force }
  else { & $installer -ProjectPath $p -Adapter $adapter }
  if (Test-AleDevOSProject $p) {
    $saved = Register-Project $p -TouchLastUsed
    $script:SessionProject = $saved
    Write-Host "[OK] Proyecto registrado y seleccionado para ESTA sesion: $saved" -ForegroundColor Green
  }
}

function Start-AleDevOSProject {
  $installer = Join-Path $ScriptDir '05-install-into-project.ps1'
  $launcher = Join-Path $ScriptDir '06-start-ai-dev.ps1'
  if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw "Falta instalador: $installer" }
  if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw "Falta launcher: $launcher" }

  $defaultProject = $null
  if ($script:SessionProject -and (Test-AleDevOSProject $script:SessionProject)) {
    $defaultProject = $script:SessionProject
  } elseif ($script:LaunchCwd -and -not $script:LaunchCwd.Equals($Root,[StringComparison]::OrdinalIgnoreCase)) {
    $defaultProject = $script:LaunchCwd
  }

  $prompt = if ($defaultProject) { "Ruta del proyecto [ENTER = $defaultProject]" } else { 'Ruta completa del proyecto' }
  $entered = Read-Host $prompt
  if ([string]::IsNullOrWhiteSpace($entered)) {
    if (-not $defaultProject) { throw 'No se indico una ruta de proyecto.' }
    $entered = $defaultProject
  }
  $p = Resolve-OrCreateProjectPath $entered
  $adapter = Select-ProjectAdapter
  $canonicalAdapter = if ($adapter -eq 'gemini') { 'antigravity' } else { $adapter }

  $pj = Get-ProjectJson $p
  $installed = @(Get-InstalledProjectAdapters $pj)
  if ($installed -notcontains $canonicalAdapter) {
    Write-Host "[AUTO] AleDevOS no estaba instalado para $canonicalAdapter. Instalando..." -ForegroundColor Cyan
    & $installer -ProjectPath $p -Adapter $adapter
    if ($LASTEXITCODE -ne 0) { throw "Instalacion AleDevOS fallida: exit=$LASTEXITCODE" }
  } else {
    Write-Host "[OK] AleDevOS ya esta instalado para $canonicalAdapter." -ForegroundColor Green
  }

  if (-not (Test-AleDevOSProject $p)) { throw 'La instalacion no produjo .aledevos\project.json.' }
  $saved = Register-Project $p -TouchLastUsed
  $script:SessionProject = $saved

  Write-Host "[START] Abriendo $canonicalAdapter..." -ForegroundColor Cyan
  & $launcher -ProjectPath $p -Adapter $canonicalAdapter
}

function Show-PackageStatus {
  $script = Find-ScriptByText @('ESTADO MASTER','Inventory mode never issues a freeze certificate')
  if (-not $script) { $script = Find-ScriptByText @('ESTADO MASTER') }
  if (-not $script) { throw 'No se encontro el inventario Master del paquete.' }
  & $script
}

Sync-ProjectRegistry

while ($true) {
  Clear-Host
  $known = @(Get-KnownProjects)
  Write-Host '============================================================'
  Write-Host '                    AleDevOS'
  Write-Host '============================================================'
  if ($script:SessionProject -and (Test-AleDevOSProject $script:SessionProject)) {
    Write-Host "Proyecto: $script:SessionProject" -ForegroundColor Green
  } else {
    Write-Host "Proyecto: NO SELECCIONADO  ($($known.Count) conocidos)" -ForegroundColor Yellow
  }
  Write-Host ''
  Write-Host '  1. INICIAR ALEDEVOS'
  Write-Host '     Instala en primer uso y abre el runtime elegido.'
  Write-Host '  2. Estado del proyecto'
  Write-Host '  3. Elegir / cambiar proyecto'
  Write-Host '  4. Avanzado'
  Write-Host '  5. Salir'
  Write-Host ''
  $choice = Read-Host 'Elige una opcion [1-5]'
  try {
    switch ($choice) {
      '1' { Start-AleDevOSProject }
      '2' { Show-ProjectStatus }
      '3' { Change-SessionProject }
      '4' { Show-AdvancedMenu }
      '5' { break }
      default { Write-Host 'Opcion invalida.' -ForegroundColor Yellow }
    }
  } catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  }
  if ($choice -eq '5') { break }
  Write-Host ''
  Read-Host 'Pulsa ENTER para continuar' | Out-Null
}
