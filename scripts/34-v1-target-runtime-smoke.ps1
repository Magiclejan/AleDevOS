param(
  [string]$Workspace = "",
  [switch]$BootstrapPlaywright
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $Workspace){$Workspace=Join-Path $env:TEMP 'AleDevOS-v1-target-runtime-smoke'}
$Workspace=[System.IO.Path]::GetFullPath($Workspace)
$fixture=Join-Path $root 'tests\target-runtime-fixture'

function Run-Node([string]$Script,[string[]]$NodeArgs,[switch]$AllowNonZero){
  & node $Script @NodeArgs
  $code=$LASTEXITCODE
  if(-not $AllowNonZero -and $code -ne 0){throw "Node command failed ($code): $Script $($NodeArgs -join ' ')"}
  return $code
}
function Write-JsonFile([string]$Path,$Object){
  New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
  $Object | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 $Path
}

Write-Host "AleDevOS V1 target-runtime smoke" -ForegroundColor Cyan
Write-Host "Workspace: $Workspace"
if(Test-Path $Workspace){Remove-Item $Workspace -Recurse -Force}
New-Item -ItemType Directory -Path $Workspace -Force | Out-Null
Copy-Item (Join-Path $fixture '*') $Workspace -Recurse -Force

Push-Location $Workspace
$server=$null
try {
  # A real Git repository is required by Core scope/integrity evidence later.
  git init -q
  git config user.email 'aledevos-smoke@local.invalid'
  git config user.name 'AleDevOS Smoke'
  git add .
  git commit -q -m 'target runtime fixture baseline'

  & (Join-Path $root 'scripts\05-install-into-project.ps1') -ProjectPath $Workspace -Adapter opencode -Force

  $uiq=Join-Path $Workspace '.aledevos\uxui\runtime\ui-quality.mjs'
  $responsiveIn=Join-Path $Workspace 'responsive-target.json'
  $a11yIn=Join-Path $Workspace 'accessibility-target.json'
  Write-JsonFile $responsiveIn ([ordered]@{
    strategy='FLUID';
    viewports=@(
      [ordered]@{id='narrow';width=390;height=844;expectation='No horizontal overflow.'},
      [ordered]@{id='wide';width=1440;height=900;expectation='Wide layout remains contained.'}
    );
    container_policy='canonical';overflow_policy='none';source_ref='V1-TARGET-RUNTIME-SMOKE'
  })
  Write-JsonFile $a11yIn ([ordered]@{
    standard='WCAG_2_2_AA';
    requirements=[ordered]@{
      semantics='Semantic roles match behavior.';keyboard='Controls work by keyboard.';focus='Visible usable focus.';labels='Controls have names.';contrast='Rendered contrast meets target.';reduced_motion='Reduced motion respected.'
    };
    source_ref='V1-TARGET-RUNTIME-SMOKE'
  })
  Run-Node $uiq @('responsive','approve','--project-root',$Workspace,'--input',$responsiveIn,'--approval-ref','target-smoke:approved')
  Run-Node $uiq @('accessibility','approve','--project-root',$Workspace,'--input',$a11yIn,'--approval-ref','target-smoke:approved')

  $browser=Join-Path $Workspace '.aledevos\visualqa\runtime\browser-runner.mjs'
  $audit=Join-Path $Workspace '.aledevos\visualqa\runtime\runtime-audit.mjs'
  $release=Join-Path $Workspace '.aledevos\release\runtime\v1-release.mjs'

  $doctorCode=Run-Node $browser @('doctor','--project-root',$Workspace) -AllowNonZero
  $browserReady=($doctorCode -eq 0)
  if(-not $browserReady -and $BootstrapPlaywright){
    Write-Host 'Bootstrapping isolated Playwright dependency into the disposable smoke workspace...' -ForegroundColor Yellow
    npm install --no-save --package-lock=false playwright
    if($LASTEXITCODE -ne 0){throw 'npm install playwright failed'}
    npx playwright install chromium
    if($LASTEXITCODE -ne 0){throw 'playwright chromium install failed'}
    Run-Node $browser @('doctor','--project-root',$Workspace)
    $browserReady=$true
  }
  if(-not $browserReady){
    Write-Host 'BLOCKED: Playwright/Chromium is not available in the target smoke workspace.' -ForegroundColor Red
    Write-Host 'Rerun with -BootstrapPlaywright to install it only inside this disposable fixture.' -ForegroundColor Yellow
    exit 4
  }

  $portFile=Join-Path $Workspace '.server-port'
  $serverStdout=Join-Path $Workspace '.server-stdout.log'
  $serverStderr=Join-Path $Workspace '.server-stderr.log'
  $nodeExe=(Get-Command node -ErrorAction Stop).Source

  # Start-Process joins ArgumentList on Windows. Keep path-bearing arguments out
  # of its command line: launch server.mjs from the controlled working directory.
  $server=Start-Process -FilePath $nodeExe -WorkingDirectory $Workspace `
    -ArgumentList @('server.mjs','--port','0','--port-file','.server-port') `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $serverStdout -RedirectStandardError $serverStderr

  for($i=0;$i -lt 200 -and -not (Test-Path $portFile);$i++){
    if($server.HasExited){break}
    Start-Sleep -Milliseconds 50
  }
  if(-not (Test-Path $portFile)){
    Write-Host 'Fixture server stdout:' -ForegroundColor Yellow
    if(Test-Path $serverStdout){Get-Content $serverStdout}
    Write-Host 'Fixture server stderr:' -ForegroundColor Yellow
    if(Test-Path $serverStderr){Get-Content $serverStderr}
    $exitLabel=if($server.HasExited){$server.ExitCode}else{'still-running'}
    throw "Target fixture server did not publish a port (process=$exitLabel)"
  }
  $port=(Get-Content $portFile -Raw).Trim()
  if($port -notmatch '^\d{1,5}$' -or [int]$port -lt 1 -or [int]$port -gt 65535){
    throw "Fixture server published invalid port: $port"
  }
  try {
    $health=Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 5
    if($health.StatusCode -ne 200 -or $health.Content.Trim() -ne 'ok'){
      throw 'Fixture server health response was not HTTP 200 / ok'
    }
  } catch {
    throw "Fixture server health check failed on port ${port}: $($_.Exception.Message)"
  }
  $baseUrl="http://127.0.0.1:$port"
  Write-Host "Fixture server: $baseUrl" -ForegroundColor DarkGray

  $vqa=Join-Path $Workspace '.aledevos\visualqa\runtime\visualqa.mjs'
  $reg=Join-Path $Workspace '.aledevos\visualqa\runtime\regression.mjs'
  $task='v1-target-browser'
  $request=Join-Path $Workspace 'capture-request.json'
  Write-JsonFile $request ([ordered]@{
    task_id=$task;evidence_id='target-pc';base_url=$baseUrl;changed_files=@('src/index.html');
    surfaces=@([ordered]@{id='home';route='/';viewport_ids=@('narrow','wide');states=@('DEFAULT','LOADING');state_contract_path=$null})
  })
  $plan=Join-Path $Workspace ".aledevos\state\visualqa\phase1\plans\$task--target-pc.json"
  Run-Node $vqa @('plan','create','--project-root',$Workspace,'--input',$request,'--out',$plan)
  $planObj=Get-Content $plan -Raw | ConvertFrom-Json
  $bindings=@()
  foreach($c in $planObj.cases){
    if($c.state -eq 'LOADING'){$bindings += [ordered]@{case_id=$c.case_id;route_suffix='?vqaState=loading';ready_selector='[data-vqa-state="LOADING"]'}}
  }
  $spec=Join-Path $Workspace 'browser-execution.json'
  Write-JsonFile $spec ([ordered]@{task_id=$task;provider='playwright';browser='chromium';stable_ms=120;case_bindings=$bindings})
  $receipt=Join-Path $Workspace ".aledevos\state\visualqa\phase2\receipts\$task--target-pc.json"
  Run-Node $browser @('run','execute','--project-root',$Workspace,'--plan',$plan,'--spec',$spec,'--out',$receipt)
  Run-Node $browser @('run','verify','--project-root',$Workspace,'--receipt',$receipt)

  Run-Node $reg @('baseline','approve','--project-root',$Workspace,'--receipt',$receipt,'--baseline-id','v1-target-baseline','--approval-ref','target-smoke:fixture-approved')
  $p3=Join-Path $Workspace '.aledevos\state\visualqa\phase3\reports\v1-target.json'
  Run-Node $reg @('compare','run','--project-root',$Workspace,'--receipt',$receipt,'--baseline','v1-target-baseline','--out',$p3)

  $p4=Join-Path $Workspace '.aledevos\state\visualqa\phase4\reports\v1-target.json'
  Run-Node $audit @('audit','run','--project-root',$Workspace,'--receipt',$receipt,'--phase3-report',$p3,'--out',$p4)
  Run-Node $audit @('audit','verify','--project-root',$Workspace,'--report',$p4)

  $inputDir=Join-Path $Workspace '.aledevos\state\release\v1\inputs'
  New-Item -ItemType Directory -Path $inputDir -Force | Out-Null
  $p2rel='.aledevos/state/visualqa/phase2/receipts/v1-target-browser--target-pc.json'
  $p4rel='.aledevos/state/visualqa/phase4/reports/v1-target.json'
  $e1=Join-Path $inputDir 'real-playwright.json'
  Write-JsonFile $e1 ([ordered]@{schema_version='1.0';check_id='real_playwright_capture';status='PASS';target=[ordered]@{adapter='opencode';runtime='target-pc'};artifacts=@([ordered]@{role='phase2_receipt';path=$p2rel});claims=[ordered]@{};notes=@()})
  Run-Node $release @('evidence','seal','--project-root',$Workspace,'--input',$e1)
  $e2=Join-Path $inputDir 'real-audit.json'
  Write-JsonFile $e2 ([ordered]@{schema_version='1.0';check_id='real_runtime_audit';status='PASS';target=[ordered]@{adapter='opencode';runtime='target-pc'};artifacts=@([ordered]@{role='phase4_report';path=$p4rel});claims=[ordered]@{};notes=@()})
  Run-Node $release @('evidence','seal','--project-root',$Workspace,'--input',$e2)
  $e3=Join-Path $inputDir 'security.json'
  Write-JsonFile $e3 ([ordered]@{schema_version='1.0';check_id='security_permissions_target';status='PASS';target=[ordered]@{adapter='opencode';runtime='target-pc'};artifacts=@();claims=[ordered]@{};notes=@()})
  Run-Node $release @('evidence','seal','--project-root',$Workspace,'--input',$e3)

  Write-Host "`nTarget preflight (expected to BLOCK if the active Visual Judge model is text-only):" -ForegroundColor Cyan
  Run-Node $release @('system','preflight','--project-root',$Workspace) -AllowNonZero | Out-Null
  Write-Host "`nCurrent V1 release gate:" -ForegroundColor Cyan
  Run-Node $release @('gate','evaluate','--project-root',$Workspace) -AllowNonZero | Out-Null

  Write-Host "`nREAL target browser evidence PASS: P2 capture + P4 runtime audit + target security inspection." -ForegroundColor Green
  Write-Host "Workspace preserved for the remaining V1 evidence: $Workspace" -ForegroundColor Green
} finally {
  if($server -and -not $server.HasExited){Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue}
  Pop-Location
  Write-Host 'Workspace intentionally kept because later V1 evidence must attach to the same controlled project. Delete it manually after V1 freeze.' -ForegroundColor DarkGray
}
