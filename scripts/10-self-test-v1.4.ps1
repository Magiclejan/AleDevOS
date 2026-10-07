$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Write-Host '=== AleDevOS v1.4 self-test ===' -ForegroundColor Cyan
node --test (Join-Path $root 'tests\core-engine.test.mjs')
if($LASTEXITCODE -ne 0){throw 'Core engine tests failed.'}
$config=Get-Content (Join-Path $root 'adapters\opencode\opencode.json') -Raw | ConvertFrom-Json
if($config.PSObject.Properties.Name -contains "providers"){throw "AleDevOS OpenCode template must not bundle provider configuration"}
if($config.PSObject.Properties.Name -contains "model"){throw "AleDevOS OpenCode template must not choose a default model"}
if($config.compaction.keep.tokens -ne 8000 -or $config.compaction.buffer -ne 20000){throw 'Compaction profile mismatch.'}
$agents=Join-Path $root 'adapters\opencode\.opencode\agents'
$write=@('builder','repairer','editor-frontend','editor-backend','editor-database','editor-tests')
foreach($a in $write){
  $txt=Get-Content (Join-Path $agents "$a.md") -Raw
  foreach($needle in @('resource: ".opencode/**"','resource: ".aledevos/**"','resource: "package.json"','resource: "tsconfig*.json"')){if($txt -notmatch [regex]::Escape($needle)){throw "$a missing $needle"}}
  if($txt -match 'npm run \*' -or $txt -match 'npx vitest \*' -or $txt -match 'pytest \*'){throw "$a still has broad runner allowlist"}
}
$configEditor=Get-Content (Join-Path $agents 'editor-config.md') -Raw
if($configEditor -notmatch 'resource: "package.json"' -or $configEditor -notmatch 'effect: allow'){throw 'editor-config missing config write allowance'}
if($configEditor -match 'git status \*'){throw 'editor-config must not have shell access'}
$ver=Get-Content (Join-Path $agents 'verifier.md') -Raw
if($ver -match 'npm run \*' -or $ver -match 'npx vitest \*' -or $ver -match 'pytest \*'){throw 'Verifier still has broad runner allowlist.'}
if($ver -notmatch 'aledevos\.mjs gate run'){throw 'Verifier missing canonical gate runtime.'}
if(-not (Test-Path (Join-Path $root 'scripts\11-refresh-gate-integrity.ps1'))){throw 'Missing human gate-integrity refresh script.'}
Write-Host 'AleDevOS v1.4 self-test PASS' -ForegroundColor Green
