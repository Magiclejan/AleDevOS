param(
  [Parameter(Position=0)]
  [ValidateSet('start','init','update','where','help')]
  [string]$Command = 'help',

  [Parameter(Position=1)]
  [string]$ProjectPath,

  [string]$Adapter,

  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$stateRoot = Join-Path $env:LOCALAPPDATA 'AleDevOS'
$configPath = Join-Path $stateRoot 'cli.json'
$allAdapters = @('codex','claude-code','opencode','antigravity')

function Get-Config {
  if (-not (Test-Path $configPath)) {
    throw "ALEDEVOS_CLI_NOT_CONFIGURED: run repo-tools\INSTALL_CLI.ps1 from the canonical AleDevOS checkout."
  }
  return Get-Content $configPath -Raw | ConvertFrom-Json
}

function Resolve-Project([string]$PathArg) {
  if ([string]::IsNullOrWhiteSpace($PathArg)) {
    return (Get-Location).Path
  }
  if (-not (Test-Path $PathArg)) {
    New-Item -ItemType Directory -Force -Path $PathArg | Out-Null
  }
  return (Resolve-Path $PathArg).Path
}

function Normalize-AdapterName([string]$Name) {
  $n = $Name.Trim().ToLowerInvariant()
  if ($n -eq 'gemini') { return 'antigravity' }
  if ($allAdapters -notcontains $n) { throw "ADAPTER_INVALID: $Name" }
  return $n
}

function Parse-Adapters([string]$Raw) {
  if ([string]::IsNullOrWhiteSpace($Raw)) { return @() }
  $v = $Raw.Trim().ToLowerInvariant()
  if ($v -in @('all','todos','a','*')) { return @($allAdapters) }
  $out = @()
  foreach ($part in ($Raw -split '[,; ]+' | Where-Object { $_ })) {
    $name = Normalize-AdapterName $part
    if ($out -notcontains $name) { $out += $name }
  }
  return @($out)
}

function Get-InstalledAdapters([string]$Target) {
  $projectJson = Join-Path $Target '.aledevos\project.json'
  if (-not (Test-Path $projectJson)) { return @() }

  try {
    $cfg = Get-Content $projectJson -Raw | ConvertFrom-Json
    $declared = @()
    if ($cfg.adapters) {
      foreach ($a in @($cfg.adapters)) {
        $name = Normalize-AdapterName ([string]$a)
        if ($declared -notcontains $name) { $declared += $name }
      }
    } elseif ($cfg.adapter) {
      $declared += (Normalize-AdapterName ([string]$cfg.adapter))
    }

    # An adapter is considered installed only after its adapter-specific
    # Skill Registry exists. This recovers cleanly from interrupted installs.
    $healthy = @()
    foreach ($name in $declared) {
      $registry = Join-Path $Target ".aledevos\skills\registries\$name.json"
      if (Test-Path $registry) { $healthy += $name }
    }
    return @($healthy | Sort-Object -Unique)
  } catch {
    throw "ALEDEVOS_PROJECT_CONFIG_INVALID: $projectJson"
  }
}

function Select-Adapters([string]$Requested,[string[]]$Installed) {
  $parsed = Parse-Adapters $Requested
  if ($parsed.Count -gt 0) { return @($parsed) }

  Write-Host ""
  Write-Host "Adapters de IA para este proyecto:"
  Write-Host "  1. Codex"
  Write-Host "  2. Claude Code"
  Write-Host "  3. OpenCode"
  Write-Host "  4. Antigravity"
  Write-Host "  A. Todos"
  Write-Host ""
  if ($Installed.Count -gt 0) {
    Write-Host ("Ya instalados: " + ($Installed -join ', ')) -ForegroundColor DarkGray
    Write-Host "Puedes añadir otros sin quitar los anteriores." -ForegroundColor DarkGray
  }
  Write-Host "Ejemplos: 1   |   1,3   |   A"
  $choice = Read-Host "Selecciona"

  if ([string]::IsNullOrWhiteSpace($choice)) { return @('codex') }
  if ($choice.Trim().ToUpperInvariant() -eq 'A') { return @($allAdapters) }

  $map = @{
    '1' = 'codex'
    '2' = 'claude-code'
    '3' = 'opencode'
    '4' = 'antigravity'
  }
  $out = @()
  foreach ($part in ($choice -split '[,; ]+' | Where-Object { $_ })) {
    $key = $part.Trim()
    if (-not $map.ContainsKey($key)) { throw "ADAPTER_SELECTION_INVALID: $key" }
    $name = $map[$key]
    if ($out -notcontains $name) { $out += $name }
  }
  if ($out.Count -eq 0) { throw "ADAPTER_SELECTION_EMPTY" }
  return @($out)
}

function Invoke-Adapter([string]$Target,[string]$SelectedAdapter) {
  $exe = @{
    'opencode' = 'opencode'
    'codex' = 'codex'
    'claude-code' = 'claude'
    'antigravity' = 'agy'
  }[$SelectedAdapter]
  if (-not $exe) { throw "ADAPTER_LAUNCH_UNSUPPORTED: $SelectedAdapter" }
  $cmd = Get-Command $exe -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "ADAPTER_CLI_NOT_FOUND: $exe. AleDevOS is installed in the project, but the external runtime CLI must be installed/authenticated separately."
  }
  Write-Host ""
  Write-Host "[START] $SelectedAdapter en $Target" -ForegroundColor Cyan
  Push-Location $Target
  try { & $cmd.Source } finally { Pop-Location }
  return $LASTEXITCODE
}

function Invoke-Install([string]$Target,[string]$SelectedAdapter,[bool]$UseForce) {
  $cfg = Get-Config
  $root = [string]$cfg.canonical_root

  if (-not (Test-Path (Join-Path $root '.git'))) {
    throw "ALEDEVOS_CANONICAL_CHECKOUT_NOT_FOUND: $root"
  }

  $installer = Join-Path $root 'scripts\05-install-into-project.ps1'
  if (-not (Test-Path $installer)) {
    throw "ALEDEVOS_INSTALLER_NOT_FOUND: $installer"
  }

  Write-Host ""
  Write-Host "============================================================"
  Write-Host " AleDevOS"
  Write-Host "============================================================"
  Write-Host "Proyecto : $Target"
  Write-Host "Adapter  : $SelectedAdapter"
  Write-Host "Fuente   : $root"
  Write-Host ""

  $psArgs = @(
    '-NoLogo',
    '-NoProfile',
    '-ExecutionPolicy','Bypass',
    '-File', $installer,
    '-ProjectPath', $Target,
    '-Adapter', $SelectedAdapter
  )
  if ($UseForce) { $psArgs += '-Force' }

  & powershell.exe @psArgs
  $rc = $LASTEXITCODE
  if ($rc -ne 0) {
    throw "ALEDEVOS_INSTALL_FAILED: adapter=$SelectedAdapter exit=$rc"
  }
}

function Test-GitRepository([string]$Target) {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { return $false }
  $out = & $git.Source -C $Target rev-parse --is-inside-work-tree 2>$null
  return ($LASTEXITCODE -eq 0 -and (($out | Out-String).Trim() -eq 'true'))
}

function Show-ProjectKind([string]$Target,[string[]]$Installed) {
  $entries = @(Get-ChildItem $Target -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '.aledevos' })
  $git = Test-GitRepository $Target
  if ($Installed.Count -gt 0) {
    Write-Host ("Proyecto AleDevOS existente. Adapters instalados: " + ($Installed -join ', ')) -ForegroundColor Cyan
  } elseif ($entries.Count -eq 0) {
    Write-Host "Proyecto nuevo/vacio detectado." -ForegroundColor Cyan
  } elseif ($git) {
    Write-Host "Proyecto existente con Git detectado. AleDevOS se incorporara sin borrar tu codigo." -ForegroundColor Cyan
  } else {
    Write-Host "Proyecto existente sin Git detectado. Git no es obligatorio para instalar AleDevOS." -ForegroundColor Cyan
  }
}

switch ($Command) {
  'start' {
    $target = Resolve-Project $ProjectPath
    $installed = @(Get-InstalledAdapters $target)
    Show-ProjectKind -Target $target -Installed $installed

    if ($Adapter) {
      $selected = @(Parse-Adapters $Adapter)
      if ($selected.Count -ne 1) { throw 'START_REQUIRES_ONE_ADAPTER' }
      $chosen = $selected[0]
    } elseif ($installed.Count -eq 1) {
      $chosen = $installed[0]
    } else {
      $selected = @(Select-Adapters -Requested $null -Installed $installed)
      if ($selected.Count -ne 1) { throw 'START_REQUIRES_ONE_ADAPTER' }
      $chosen = $selected[0]
    }

    if ($installed -notcontains $chosen) {
      Write-Host "AleDevOS no estaba instalado para '$chosen'. Instalando ahora..." -ForegroundColor Yellow
      Invoke-Install -Target $target -SelectedAdapter $chosen -UseForce:$false
    } else {
      Write-Host "[OK] AleDevOS ya esta instalado para '$chosen'." -ForegroundColor Green
    }

    $rc = Invoke-Adapter -Target $target -SelectedAdapter $chosen
    exit $rc
  }

  'init' {
    $target = Resolve-Project $ProjectPath
    $installed = @(Get-InstalledAdapters $target)
    Show-ProjectKind -Target $target -Installed $installed

    $selected = @(Select-Adapters -Requested $Adapter -Installed $installed)
    $pending = @($selected | Where-Object { $installed -notcontains $_ })

    if ($pending.Count -eq 0) {
      Write-Host ""
      Write-Host "[OK] Los adapters seleccionados ya estan instalados." -ForegroundColor Green
      Write-Host ("Adapters del proyecto: " + ($installed -join ', '))
      exit 0
    }

    foreach ($a in $pending) {
      Invoke-Install -Target $target -SelectedAdapter $a -UseForce:$false
    }

    $final = @(Get-InstalledAdapters $target)
    Write-Host ""
    Write-Host "[OK] AleDevOS listo." -ForegroundColor Green
    Write-Host ("Adapters del proyecto: " + ($final -join ', ')) -ForegroundColor Green
    exit 0
  }

  'update' {
    $target = Resolve-Project $ProjectPath
    $installed = @(Get-InstalledAdapters $target)

    if ($installed.Count -eq 0) {
      Write-Host "AleDevOS aun no esta inicializado en este proyecto. Ejecutando onboarding..." -ForegroundColor Yellow
      $selected = @(Select-Adapters -Requested $Adapter -Installed @())
    } elseif ($Adapter) {
      $selected = @(Parse-Adapters $Adapter)
    } else {
      $selected = @($installed)
    }

    foreach ($a in $selected) {
      Invoke-Install -Target $target -SelectedAdapter $a -UseForce:$true
    }

    Write-Host ""
    Write-Host "[OK] AleDevOS actualizado." -ForegroundColor Green
    Write-Host ("Adapters actualizados: " + ($selected -join ', ')) -ForegroundColor Green
    exit 0
  }

  'where' {
    $cfg = Get-Config
    Write-Output $cfg.canonical_root
    exit 0
  }

  default {
    Write-Host "AleDevOS CLI"
    Write-Host ""
    Write-Host "Iniciar (instala en primer uso y abre el runtime):"
    Write-Host "  aledevos start"
    Write-Host "  aledevos start C:\ruta\Proyecto -Adapter codex"
    Write-Host ""
    Write-Host "Solo instalar/incorporar (sin abrir runtime):"
    Write-Host "  aledevos init"
    Write-Host "  aledevos init C:\ruta\Proyecto"
    Write-Host "  aledevos init -Adapter codex,opencode"
    Write-Host "  aledevos init -Adapter all"
    Write-Host ""
    Write-Host "Git es opcional para instalar AleDevOS. Las funciones que dependen de Git se habilitan solo cuando el proyecto dispone de Git."
    Write-Host ""
    Write-Host "Actualizar todos los adapters ya instalados:"
    Write-Host "  aledevos update"
    Write-Host ""
    Write-Host "Fuente canonica configurada:"
    Write-Host "  aledevos where"
  }
}
