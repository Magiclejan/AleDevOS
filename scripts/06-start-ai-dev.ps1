param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [ValidateSet("opencode","codex","claude-code","antigravity")][string]$Adapter = "opencode"
)
$ErrorActionPreference = "Stop"
$project=(Resolve-Path $ProjectPath).Path
$exe=@{"opencode"="opencode";"codex"="codex";"claude-code"="claude";"antigravity"="agy"}[$Adapter]
if(-not(Get-Command $exe -ErrorAction SilentlyContinue)){throw "Adapter CLI not found: $exe"}
Set-Location $project
Write-Host "Launching AleDevOS adapter $Adapter in $project" -ForegroundColor Cyan
& $exe
exit $LASTEXITCODE
