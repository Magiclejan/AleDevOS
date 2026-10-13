param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [ValidateSet("opencode","codex","claude-code","antigravity")][string]$Adapter = "opencode"
)
$ErrorActionPreference = "Stop"
$project=(Resolve-Path $ProjectPath).Path
$exe=@{"opencode"="opencode";"codex"="codex";"claude-code"="claude";"antigravity"="agy"}[$Adapter]
if(-not(Get-Command $exe -ErrorAction SilentlyContinue)){throw "Adapter CLI not found: $exe"}
if($Adapter -eq 'codex'){
  # Never open a discretionary Codex root session from the product launcher.
  $cli=Join-Path (Split-Path -Parent $PSScriptRoot) 'cli\aledevos.ps1'
  if(-not(Test-Path -LiteralPath $cli)){throw "Strict AleDevOS CLI missing: $cli"}
  & $cli -Command start -ProjectPath $project -Adapter codex
  exit $LASTEXITCODE
}
Set-Location $project
Write-Host "Launching AleDevOS adapter $Adapter in $project" -ForegroundColor Cyan
& $exe
exit $LASTEXITCODE
