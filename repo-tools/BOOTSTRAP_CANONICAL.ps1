param(
  [string]$Destination = (Join-Path $HOME "source\AleDevOS")
)
$ErrorActionPreference = "Stop"
$repo = "https://github.com/Magiclejan/AleDevOS.git"

if (Test-Path (Join-Path $Destination ".git")) {
  Write-Host "[INFO] Existing clone detected: $Destination"
  git -C $Destination pull --ff-only
} else {
  $parent = Split-Path $Destination -Parent
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  git clone $repo $Destination
}
Write-Host "[OK] Canonical AleDevOS checkout: $Destination"
