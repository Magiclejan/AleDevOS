$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Write-Host '=== AleDevOS v1.4 adapter config check ===' -ForegroundColor Cyan
$config=Get-Content (Join-Path $root 'adapters\opencode\opencode.json') -Raw | ConvertFrom-Json
if($config.PSObject.Properties.Name -contains "providers"){throw "AleDevOS OpenCode template must not bundle provider configuration"}
if($config.PSObject.Properties.Name -contains "model"){throw "AleDevOS OpenCode template must not choose a default model"}
if($config.default_agent -ne 'orchestrator'){throw 'default_agent must be orchestrator'}
if($config.compaction.keep.tokens -ne 8000 -or $config.compaction.buffer -ne 20000){throw 'compaction mismatch'}
if(-not ($config.permissions | Where-Object {$_.action -eq 'execute' -and $_.effect -eq 'deny'})){throw 'Code Mode execute must be denied'}
Write-Host 'Adapter config PASS' -ForegroundColor Green
