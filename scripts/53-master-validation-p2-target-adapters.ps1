param(
  [ValidateSet('opencode','codex','claude-code','antigravity')][string[]]$Adapters=@('opencode','codex','claude-code','antigravity'),
  [switch]$KeepTargets,
  [switch]$VerboseInstall
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
function Get-AleDevInstalledApp([string]$Adapter){
  if($env:OS -ne 'Windows_NT'){return [pscustomobject]@{Present=$false;Name=$null;Source=$null}}
  $patterns=@{
    'codex'='(?i)\bCodex\b';
    'claude-code'='(?i)\bClaude\b';
    'antigravity'='(?i)\bAntigravity\b';
    'opencode'='(?i)\bOpenCode\b'
  }
  $pattern=$patterns[$Adapter]
  if(-not $pattern){return [pscustomobject]@{Present=$false;Name=$null;Source=$null}}
  try{
    $getStartApps=Get-Command Get-StartApps -ErrorAction SilentlyContinue
    if($getStartApps){
      $app=Get-StartApps | Where-Object {$_.Name -match $pattern} | Select-Object -First 1
      if($app){return [pscustomobject]@{Present=$true;Name=[string]$app.Name;Source='START_APPS'}}
    }
  }catch{}
  $roots=@(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach($r in $roots){
    try{
      $app=Get-ItemProperty $r -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -match $pattern} | Select-Object -First 1
      if($app){return [pscustomobject]@{Present=$true;Name=[string]$app.DisplayName;Source='UNINSTALL_REGISTRY'}}
    }catch{}
  }
  return [pscustomobject]@{Present=$false;Name=$null;Source=$null}
}
function Resolve-AleDevRuntimeCli([string]$Adapter){
  $nameSets=@{
    'opencode'=@('opencode','opencode2');
    'codex'=@('codex');
    'claude-code'=@('claude');
    'antigravity'=@('agy')
  }
  $names=@($nameSets[$Adapter])
  $primary=$names[0]
  $app=Get-AleDevInstalledApp $Adapter
  foreach($name in $names){
    $found=Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if($found){return [pscustomobject]@{Found=$true;Name=$name;Invoke=$null;Source=[string]$found.Source;Origin='PATH';AppPresent=$app.Present;AppName=$app.Name}}
  }
  $candidates=@()
  if($env:OS -eq 'Windows_NT'){
    switch($Adapter){
      'opencode' {
        $openCodeNames=@('opencode','opencode2')
        $openCodeExts=@('.exe','.cmd','.ps1','.bat','')
        if($env:USERPROFILE){
          foreach($n in $openCodeNames){
            foreach($ext in $openCodeExts){
              $candidates += (Join-Path $env:USERPROFILE ".opencode\bin\$n$ext")
              $candidates += (Join-Path $env:USERPROFILE ".local\bin\$n$ext")
              $candidates += (Join-Path $env:USERPROFILE "bin\$n$ext")
              $candidates += (Join-Path $env:USERPROFILE ".bun\bin\$n$ext")
              $candidates += (Join-Path $env:USERPROFILE "scoop\shims\$n$ext")
            }
          }
        }
        if($env:APPDATA){
          foreach($n in $openCodeNames){
            foreach($ext in $openCodeExts){$candidates += (Join-Path $env:APPDATA "npm\$n$ext")}
          }
          $legacy=Join-Path $env:APPDATA 'npm\node_modules\opencode-ai\node_modules\opencode-windows-x64\bin\opencode.exe'
          $candidates += $legacy
          $npmMods=Join-Path $env:APPDATA 'npm\node_modules'
          if(Test-Path $npmMods){
            foreach($n in @('opencode.exe','opencode2.exe')){
              $nested=Get-ChildItem -Path $npmMods -Filter $n -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
              if($nested){$candidates += $nested}
            }
          }
          $yarnBin=Join-Path $env:LOCALAPPDATA 'Yarn\bin'
          foreach($n in $openCodeNames){foreach($ext in $openCodeExts){$candidates += (Join-Path $yarnBin "$n$ext")}}
        }
        if($env:LOCALAPPDATA){
          foreach($n in $openCodeNames){
            foreach($ext in $openCodeExts){
              $candidates += (Join-Path $env:LOCALAPPDATA "pnpm\$n$ext")
              $candidates += (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\$n$ext")
            }
          }
        }
        if($env:PNPM_HOME){foreach($n in $openCodeNames){foreach($ext in $openCodeExts){$candidates += (Join-Path $env:PNPM_HOME "$n$ext")}}}
        if($env:ProgramData){$candidates += (Join-Path $env:ProgramData 'chocolatey\bin\opencode.exe')}
        try{
          if(Get-Command npm -ErrorAction SilentlyContinue){
            $npmPrefix=(& npm prefix -g 2>$null | Select-Object -First 1)
            if($npmPrefix){foreach($n in $openCodeNames){foreach($ext in $openCodeExts){$candidates += (Join-Path $npmPrefix "$n$ext")}}}
          }
        }catch{}
        try{
          if(Get-Command pnpm -ErrorAction SilentlyContinue){
            $pnpmBin=(& pnpm bin -g 2>$null | Select-Object -First 1)
            if($pnpmBin){foreach($n in $openCodeNames){foreach($ext in $openCodeExts){$candidates += (Join-Path $pnpmBin "$n$ext")}}}
          }
        }catch{}
        try{
          if(Get-Command yarn -ErrorAction SilentlyContinue){
            $yarnGlobalBin=(& yarn global bin 2>$null | Select-Object -First 1)
            if($yarnGlobalBin){foreach($n in $openCodeNames){foreach($ext in $openCodeExts){$candidates += (Join-Path $yarnGlobalBin "$n$ext")}}}
          }
        }catch{}
        try{
          if(Get-Command bun -ErrorAction SilentlyContinue){
            $bunBin=(& bun pm bin -g 2>$null | Select-Object -First 1)
            if($bunBin){foreach($n in $openCodeNames){foreach($ext in $openCodeExts){$candidates += (Join-Path $bunBin "$n$ext")}}}
          }
        }catch{}
        try{
          if(Get-Command mise -ErrorAction SilentlyContinue){
            foreach($n in $openCodeNames){
              $misePath=(& mise which $n 2>$null | Select-Object -First 1)
              if($misePath){$candidates += $misePath}
            }
          }
        }catch{}
        try{
          foreach($n in $openCodeNames){
            $proc=Get-Process -Name $n -ErrorAction SilentlyContinue | Where-Object {$_.Path} | Select-Object -First 1
            if($proc -and $proc.Path){$candidates += [string]$proc.Path}
          }
        }catch{}
      }
      'codex' {
        if($env:LOCALAPPDATA){$candidates += (Join-Path $env:LOCALAPPDATA 'Programs\OpenAI\Codex\bin\codex.exe')}
      }
      'claude-code' {
        if($env:USERPROFILE){$candidates += (Join-Path $env:USERPROFILE '.local\bin\claude.exe')}
      }
      'antigravity' {
        if($env:LOCALAPPDATA){$candidates += (Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe')}
      }
    }
  }
  foreach($candidate in ($candidates | Select-Object -Unique)){
    if($candidate -and (Test-Path $candidate -PathType Leaf)){
      $leaf=[IO.Path]::GetFileNameWithoutExtension($candidate)
      return [pscustomobject]@{Found=$true;Name=$leaf;Invoke=$candidate;Source=$candidate;Origin='FALLBACK';AppPresent=$app.Present;AppName=$app.Name}
    }
  }
  $wslPath=$null
  if($Adapter -eq 'opencode' -and $env:OS -eq 'Windows_NT'){
    try{
      if(Get-Command wsl.exe -ErrorAction SilentlyContinue){
        $wslPath=(& wsl.exe -e sh -lc 'command -v opencode 2>/dev/null || command -v opencode2 2>/dev/null' 2>$null | Select-Object -First 1)
        if($wslPath){$wslPath=$wslPath.Trim()}
      }
    }catch{}
  }
  $origin=if($wslPath){'WSL_ONLY'}else{'MISSING'}
  return [pscustomobject]@{Found=$false;Name=$primary;Invoke=$null;Source=$wslPath;Origin=$origin;AppPresent=$app.Present;AppName=$app.Name}
}
function Get-AleDevDiagnostic([string]$Path,[int]$MaxLines=8){
  if(-not (Test-Path $Path)){return @()}
  $raw=Get-Content $Path -Raw -ErrorAction SilentlyContinue
  if([string]::IsNullOrWhiteSpace($raw)){return @()}
  # Best-effort secret redaction before terminal display. The original evidence log
  # remains hashed on disk; this preview exists only to make Windows diagnosis usable.
  $safe=[regex]::Replace($raw,'(?i)(authorization\s*[:=]\s*bearer\s+)[^\s"'']+','$1[REDACTED]')
  $safe=[regex]::Replace($safe,'(?i)(api[_-]?key|token|secret|password)(\s*[:=]\s*)[^\s,"'']+','$1$2[REDACTED]')
  $safe=[regex]::Replace($safe,'\b(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+\b','$1[REDACTED]')
  $items=@($safe -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if($items.Count -gt $MaxLines){$items=$items[($items.Count-$MaxLines)..($items.Count-1)]}
  $out=@()
  foreach($line in $items){
    $v=$line.Trim()
    if($v.Length -gt 260){$v=$v.Substring(0,260)+' ...'}
    $out += $v
  }
  return $out
}

function Get-AleDevRequiredAction($Adapter,$Receipt,$CentralReceiptDir,$Runtime){
  if(-not $Receipt.cli.present){
    $binary=[string]$Receipt.cli.binary
    $label=switch($Adapter){
      'opencode' {if($Runtime.Origin -eq 'WSL_ONLY'){"OpenCode CLI detectada solo en WSL ($($Runtime.Source)). Para este target Windows necesitamos opencode/opencode2 accesible desde Windows."}else{'OpenCode CLI no localizada tras consultar PATH, npm, pnpm, Yarn, Bun, Mise, Scoop, Chocolatey, WinGet links, procesos activos y WSL. No reinstales todavia.'}}
      'antigravity' {if($Runtime.AppPresent){"Antigravity app detectada ($($Runtime.AppName)); falta la superficie automatizable agy requerida por P2. No reinstales la app."}else{'Antigravity app/CLI de automatizacion no detectadas. P2 necesita agy para evidencia target reproducible.'}}
      'claude-code' {'Instalar/activar Claude Code CLI (claude).'}
      'codex' {'Instalar/activar Codex CLI (codex).'}
      default {"Instalar/activar CLI '$binary'."}
    }
    $code=if($Runtime.Origin -eq 'WSL_ONLY'){'CLI_WSL_ONLY'}elseif($Runtime.AppPresent){'APP_SIN_AUTOMATION'}else{'LOCALIZAR_CLI'}
    return [pscustomobject]@{Owner='USUARIO';Code=$code;Priority=20;Text=$label}
  }
  if(-not $Receipt.cli.active_smoke){
    $log=Join-Path $CentralReceiptDir 'smoke.log'
    $raw=if(Test-Path $log){Get-Content $log -Raw -ErrorAction SilentlyContinue}else{''}
    if($raw -match '(?i)usage limit|purchase more credits|try again at'){
      $reset=$null
      if($raw -match '(?i)try again at\s+([^"\r\n]+)'){$reset=$Matches[1].Trim().TrimEnd('.')}
      $msg=if($reset){"Cuota de Codex agotada. Esperar hasta $reset o ampliar creditos."}else{'Cuota del runtime agotada. Esperar a la renovacion o ampliar creditos.'}
      return [pscustomobject]@{Owner='USUARIO';Code='CUOTA';Priority=30;Text=$msg}
    }
    if($raw -match '(?i)not logged in|please run /login|authentication required|login required'){
      $msg=if($Adapter -eq 'claude-code'){'Iniciar sesion en Claude Code y ejecutar /login.'}else{"Iniciar sesion/autenticar la CLI de $Adapter."}
      return [pscustomobject]@{Owner='USUARIO';Code='LOGIN';Priority=10;Text=$msg}
    }
    if($raw -match '(?i)code-mode host is disabled|codex-code-mode-host'){
      return [pscustomobject]@{Owner='ENTORNO';Code='CODE_MODE_HOST';Priority=25;Text='Activar features.code_mode_host e instalar codex-code-mode-host si el runtime sigue requiriendolo.'}
    }
    return [pscustomobject]@{Owner='USUARIO';Code='REVISAR_RUNTIME';Priority=40;Text='Revisar el diagnostico del smoke y resolver autenticacion/configuracion del runtime.'}
  }
  if([string]$Receipt.status -eq 'ADAPTER_RUNTIME_TARGET_PASS'){
    return [pscustomobject]@{Owner='NINGUNO';Code='OK';Priority=99;Text='Ninguna accion necesaria.'}
  }
  $sp=$Receipt.security_probes
  if($sp){
    $failed=@()
    if(-not $sp.allowed_product_write_succeeded){$failed+='product_write'}
    if(-not $sp.control_plane_write_denied){$failed+='control_plane'}
    if(-not $sp.external_write_denied){$failed+='external'}
    $shellScope=if($null -ne $sp.shell_scope_escape_denied){$sp.shell_scope_escape_denied}else{$sp.arbitrary_shell_denied}
    if(-not $shellScope){$failed+='shell_scope'}
    if(-not $sp.network_denial_observed){$failed+='network'}
    # denial_diagnostic_observed is an aggregate derived from the individual
    # denial probes. Report it only when every individual probe passed but the
    # aggregate evidence is still missing, otherwise it duplicates the real cause.
    if($failed.Count -eq 0 -and -not $sp.denial_diagnostic_observed){$failed+='diagnostics'}
    if($failed.Count -gt 0){
      return [pscustomobject]@{Owner='ALEDEVOS';Code='SEGURIDAD';Priority=0;Text=("Revisar politica/probe de seguridad: " + ($failed -join ', ') + '. No requiere coordinacion manual del usuario.') }
    }
  }
  return [pscustomobject]@{Owner='ALEDEVOS';Code='REVISAR_EVIDENCIA';Priority=5;Text='Revisar evidencia target; el runtime funciona pero no alcanzo PASS.'}
}

function Write-AleDevRuntimeSummary($Adapter,$Receipt,$ProbeCode,$CentralReceiptDir){
  $version=if($Receipt.cli.version){[string]$Receipt.cli.version}else{'-'}
  $cert=if(-not $Receipt.cli.present){'SKIP'}elseif($Receipt.package_certification.ok){'PASS'}else{'FAIL'}
  $smoke=if($Receipt.cli.active_smoke){'PASS'}else{'BLOCKED'}
  $status=[string]$Receipt.status
  Write-Host ("[{0}] {1} | CLI={2} | cert={3} | smoke={4}" -f $Adapter,$status,$version,$cert,$smoke)
  if(-not $Receipt.cli.present){
    Write-Host "  Motivo: CLI '$($Receipt.cli.binary)' no localizada por el descubrimiento de runtime."
    return
  }
  if(-not $Receipt.cli.active_smoke){
    $diag=Get-AleDevDiagnostic (Join-Path $CentralReceiptDir 'smoke.log')
    if($diag.Count -gt 0){
      Write-Host '  Diagnostico smoke:'
      foreach($line in $diag){Write-Host "    $line"}
    } else {
      Write-Host "  Motivo: active smoke no produjo ALEDEVOS_RUNTIME_OK (exit=$($Receipt.runtime_smoke.exit_code))."
    }
    return
  }
  if($status -ne 'ADAPTER_RUNTIME_TARGET_PASS'){
    $sp=$Receipt.security_probes
    if($sp){
      $shellScope=if($null -ne $sp.shell_scope_escape_denied){$sp.shell_scope_escape_denied}else{$sp.arbitrary_shell_denied}
      Write-Host ("  Probes: product_write={0} | control_plane={1} | external={2} | shell_scope={3} | network={4} | diagnostics={5}" -f $sp.allowed_product_write_succeeded,$sp.control_plane_write_denied,$sp.external_write_denied,$shellScope,$sp.network_denial_observed,$sp.denial_diagnostic_observed)
    }
    $diag=Get-AleDevDiagnostic (Join-Path $CentralReceiptDir 'security.log')
    if($diag.Count -gt 0){
      Write-Host '  Diagnostico security probe:'
      foreach($line in $diag){Write-Host "    $line"}
    } else {
      Write-Host "  Motivo: security probe incompleto (probe_exit=$ProbeCode)."
    }
  }
}
$release=Join-Path $root 'release\engine\v1-release.mjs'
$targets=Join-Path $root '.aledevos\state\release\master\targets\p2'
$inputs=Join-Path $root '.aledevos\state\release\master\inputs'
$evidence=Join-Path $root '.aledevos\state\release\master\evidence'
New-Item -ItemType Directory -Path $targets,$inputs,$evidence -Force | Out-Null
$checkMap=@{'opencode'='opencode_runtime_security';'codex'='codex_runtime_security';'claude-code'='claude_code_runtime_security';'antigravity'='antigravity_runtime_security'}
$receiptPaths=@{}
$runtimeResults=@()
$actionResults=@()
foreach($adapter in $Adapters){
  Write-Host ''
  Write-Host "[P2] Comprobando $adapter ..."
  $runtime=Resolve-AleDevRuntimeCli $adapter
  $target=Join-Path $targets $adapter
  if((Test-Path $target) -and -not $KeepTargets){Remove-Item $target -Recurse -Force}
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  if(-not $runtime.Found){
    if($runtime.Origin -eq 'WSL_ONLY'){
      Write-Host "[$adapter] Preflight: OpenCode detectado en WSL ($($runtime.Source)), pero no como comando Windows; se omite este target y se continua."
    }elseif($runtime.AppPresent){
      Write-Host "[$adapter] Preflight: app detectada ($($runtime.AppName)), pero no hay superficie de automatizacion '$($runtime.Name)' utilizable por P2; se continua."
    }else{
      Write-Host "[$adapter] Preflight: comando '$($runtime.Name)' no disponible; se omite la instalacion del target y se continua."
    }
    $probe=Join-Path $root 'release\templates\master-validator-adapter-runtime.mjs'
  }else{
    if($runtime.Origin -eq 'FALLBACK'){Write-Host "[$adapter] CLI encontrada fuera de PATH: $($runtime.Source)"}
    Set-Content -Encoding utf8 (Join-Path $target 'README.md') "# AleDevOS Master Validation P2 disposable target`n"
    Set-Content -Encoding utf8 (Join-Path $target 'package.json') '{"name":"aledevos-master-p2-target","private":true,"version":"0.0.0"}'
    & git -C $target init -q
    & git -C $target config core.autocrlf false
    & git -C $target config user.email 'aledevos-validation@local.invalid'
    & git -C $target config user.name 'AleDevOS Validation'
    & git -C $target add README.md package.json
    & git -C $target commit -qm 'baseline'
    $installLog=Join-Path $target 'aledevos-install.log'
    try{
      if($VerboseInstall){
        & (Join-Path $root 'scripts\05-install-into-project.ps1') -ProjectPath $target -Adapter $adapter -Force
      }else{
        & (Join-Path $root 'scripts\05-install-into-project.ps1') -ProjectPath $target -Adapter $adapter -Force *> $installLog
      }
    }catch{
      Write-Host "[$adapter] INSTALL FAILED"
      $diag=Get-AleDevDiagnostic $installLog 12
      foreach($line in $diag){Write-Host "  $line"}
      throw
    }
    $probe=Join-Path $target '.aledevos\release\templates\master-validator-adapter-runtime.mjs'
  }
  $targetReceipt=Join-Path $target ".aledevos\state\release\master\inputs\adapter-runtime\$adapter\receipt.json"
  $probeConsole=Join-Path $target 'aledevos-probe-console.log'
  $probeArgs=@($probe,'probe','--adapter',$adapter,'--root',$target,'--out',$targetReceipt)
  if($runtime.Invoke){$probeArgs += @('--binary',$runtime.Invoke)}
  & node @probeArgs *> $probeConsole
  $probeCode=$LASTEXITCODE
  if(-not (Test-Path $targetReceipt)){throw "P2 receipt missing for $adapter"}
  # Preserve the receipt with its hashed logs under the Master Gate root. The receipt's
  # internal paths are root-relative, so copying the complete evidence directory keeps
  # them verifiable after the disposable target is removed.
  $targetReceiptDir=Split-Path -Parent $targetReceipt
  $centralReceiptDir=Join-Path $inputs "adapter-runtime\$adapter"
  if(Test-Path $centralReceiptDir){Remove-Item $centralReceiptDir -Recurse -Force}
  New-Item -ItemType Directory -Path $centralReceiptDir -Force | Out-Null
  Copy-Item (Join-Path $targetReceiptDir '*') $centralReceiptDir -Recurse -Force
  $receipt=Join-Path $centralReceiptDir 'receipt.json'
  $q=Get-Content $receipt -Raw | ConvertFrom-Json
  $status=if($q.status -eq 'ADAPTER_RUNTIME_TARGET_PASS'){'PASS'}elseif($q.status -eq 'ADAPTER_RUNTIME_TARGET_FAIL'){'FAIL'}else{'BLOCKED'}
  Write-AleDevRuntimeSummary $adapter $q $probeCode $centralReceiptDir
  $action=Get-AleDevRequiredAction $adapter $q $centralReceiptDir $runtime
  $runtimeResults += [pscustomobject]@{Adapter=$adapter;Status=$status;CLI=if($q.cli.present){$q.cli.version}else{'NOT FOUND'};Smoke=if($q.cli.active_smoke){'PASS'}else{'NO'};Accion=$action.Code}
  $actionResults += [pscustomobject]@{Adapter=$adapter;Owner=$action.Owner;Code=$action.Code;Priority=$action.Priority;Text=$action.Text}
  $rel=Get-AleDevRelativePath $root $receipt
  $inputPath=Join-Path $inputs "$($checkMap[$adapter]).input.json"
  [ordered]@{schema_version='1.0';check_id=$checkMap[$adapter];status=$status;target=[ordered]@{adapter=$adapter;target_fingerprint_sha256=$q.target.target_fingerprint_sha256};artifacts=@([ordered]@{role='adapter_runtime_receipt';path=$rel});claims=[ordered]@{probe_exit_code=$probeCode};notes=@('Generated by scripts/53-master-validation-p2-target-adapters.ps1')} | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $inputPath
  & node $release master-evidence seal --input $inputPath --project-root $root *> $null
  if($LASTEXITCODE -ne 0){throw "P2 evidence seal failed for $adapter"}
  $receiptPaths[$adapter]=$rel
}
if($Adapters.Count -eq 4){
  $allPass=$true
  foreach($a in $Adapters){$r=Get-Content (Join-Path $root $receiptPaths[$a]) -Raw | ConvertFrom-Json;if($r.status -ne 'ADAPTER_RUNTIME_TARGET_PASS'){$allPass=$false}}
  $crossInput=Join-Path $inputs 'cross_adapter_target_security.input.json'
  $arts=@()
  foreach($a in @('opencode','codex','claude-code','antigravity')){$arts += [ordered]@{role=(($a -replace '-','_')+'_runtime_receipt');path=$receiptPaths[$a]}}
  [ordered]@{schema_version='1.0';check_id='cross_adapter_target_security';status=if($allPass){'PASS'}else{'BLOCKED'};target=[ordered]@{scope='same-target-four-adapters'};artifacts=$arts;claims=[ordered]@{all_four_adapter_receipts_pass=$allPass};notes=@('Cross-adapter P2 evidence generated from the four canonical adapter receipts.')} | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $crossInput
  & node $release master-evidence seal --input $crossInput --project-root $root *> $null
  if($LASTEXITCODE -ne 0){throw 'P2 cross-adapter evidence seal failed'}
}
Write-Host ''
Write-Host '===== RESUMEN RUNTIMES P2 ====='
$runtimeResults | Format-Table -AutoSize | Out-String | Write-Host
Write-Host '===== ACCIONES NECESARIAS ====='
$pending=@($actionResults | Where-Object {$_.Code -ne 'OK'} | Sort-Object Priority,Adapter)
if($pending.Count -eq 0){
  Write-Host '[OK] No hay acciones pendientes en P2.'
}else{
  foreach($a in $pending){Write-Host ("[{0}] {1} -> {2}" -f $a.Adapter,$a.Owner,$a.Text)}
  $next=$pending | Select-Object -First 1
  Write-Host ''
  Write-Host ("SIGUIENTE PASO RECOMENDADO: [{0}] {1}" -f $next.Adapter,$next.Text)
}
Write-Host ''
$reportsDir=Join-Path $root '.aledevos\state\release\master\reports'
New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
$gateLog=Join-Path $reportsDir 'p2-gate-console.log'
& node $release master-gate evaluate --project-root $root *> $gateLog
$gateCode=$LASTEXITCODE
$latest=Join-Path $root '.aledevos\state\release\master\reports\latest.json'
if(Test-Path $latest){
  $g=Get-Content $latest -Raw | ConvertFrom-Json
  Write-Host ("Master: {0} | PASS {1}/{2} | BLOCKED {3} | FAILED {4}" -f $g.status,$g.summary.passed,$g.summary.total,$g.summary.blocked,$g.summary.failed)
}
exit $gateCode
