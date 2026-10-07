param(
  [string]$SourcePath,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Test-AleDevOSSource([string]$Path) {
  if (-not (Test-Path $Path)) { return $false }
  $markers = @(
    "scripts",
    ".aledevos",
    "core",
    "adapters",
    "README.md"
  )
  $count = 0
  foreach ($m in $markers) {
    if (Test-Path (Join-Path $Path $m)) { $count++ }
  }
  return ($count -ge 2)
}

function Resolve-AleDevOSSource {
  param([string]$Explicit)

  if ($Explicit) {
    $resolved = (Resolve-Path $Explicit).Path
    if (-not (Test-AleDevOSSource $resolved)) {
      throw "Explicit source does not look like an AleDevOS tree: $resolved"
    }
    return $resolved
  }

  $roots = @(
    (Join-Path $HOME "Downloads"),
    (Join-Path $HOME "Desktop"),
    (Join-Path $HOME "Documents"),
    (Join-Path $HOME "source"),
    (Join-Path $HOME "AI")
  ) | Where-Object { Test-Path $_ }

  $candidates = New-Object System.Collections.Generic.List[object]

  foreach ($root in $roots) {
    Get-ChildItem $root -Directory -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^AleDevOS(_Local.*)?$' } |
      ForEach-Object {
        if (Test-AleDevOSSource $_.FullName) {
          $candidates.Add([pscustomobject]@{
            Path = $_.FullName
            LastWriteTime = $_.LastWriteTime
          })
        }

        # Handle accidental wrapper folders such as ...\AleDevOS_Local_\0
        Get-ChildItem $_.FullName -Directory -Force -ErrorAction SilentlyContinue |
          ForEach-Object {
            if (Test-AleDevOSSource $_.FullName) {
              $candidates.Add([pscustomobject]@{
                Path = $_.FullName
                LastWriteTime = $_.LastWriteTime
              })
            }
          }
      }
  }

  $unique = $candidates |
    Sort-Object Path -Unique |
    Sort-Object LastWriteTime -Descending

  if (-not $unique) {
    throw "No local AleDevOS source tree was detected automatically. Re-run with -SourcePath <path>."
  }

  Write-Host ""
  Write-Host "Detected AleDevOS source candidates:"
  $i = 1
  foreach ($c in $unique) {
    Write-Host ("  {0}. {1}  [{2}]" -f $i, $c.Path, $c.LastWriteTime)
    $i++
  }

  $selected = $unique | Select-Object -First 1
  Write-Host ""
  Write-Host ("Auto-selected newest valid candidate: {0}" -f $selected.Path)

  if (-not $Yes -and $unique.Count -gt 1) {
    $answer = Read-Host "Use this source? [S/N]"
    if ($answer -notmatch '^(S|SI|Sí|Y|YES)$') {
      $choice = Read-Host "Enter candidate number"
      $n = 0
      if (-not [int]::TryParse($choice, [ref]$n) -or $n -lt 1 -or $n -gt $unique.Count) {
        throw "Invalid candidate selection."
      }
      $selected = $unique[$n-1]
    }
  }

  return $selected.Path
}

$Source = Resolve-AleDevOSSource -Explicit $SourcePath

if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
  throw "Run this script from a clone of Magiclejan/AleDevOS."
}

$origin = (& git -C $RepoRoot remote get-url origin 2>$null)
if ($origin -notmatch "Magiclejan/AleDevOS(\.git)?$") {
  throw "Unexpected origin: $origin"
}

$excludeDirNames = @(
  ".git","node_modules","__pycache__",".pytest_cache",".cache","dist","build",
  "logs","tmp","temp"
)

function Is-LocalOnly([string]$relative) {
  if ($relative -match "(?i)(^|[\\/])\.aledevos[\\/]state([\\/]|$)") { return $true }
  if ($relative -match "(?i)(^|[\\/])(\.env(\..*)?|credentials\.json|auth\.json)$") { return $true }
  return $false
}

Write-Host "============================================================"
Write-Host " AleDevOS canonical import"
Write-Host "============================================================"
Write-Host "Source : $Source"
Write-Host "Repo   : $RepoRoot"
Write-Host ""

$sourceFiles = Get-ChildItem $Source -Recurse -File -Force | Where-Object {
  $rel = $_.FullName.Substring($Source.Length).TrimStart('\','/')
  $segments = $rel -split '[\\/]'
  -not ($segments | Where-Object { $excludeDirNames -contains $_ }) -and
  -not (Is-LocalOnly $rel)
}

if (-not $sourceFiles) { throw "No importable AleDevOS files found." }

$excluded = Get-ChildItem $Source -Recurse -Force | Where-Object {
  $rel = $_.FullName.Substring($Source.Length).TrimStart('\','/')
  Is-LocalOnly $rel
}

Write-Host ("Importable files : {0}" -f $sourceFiles.Count)
Write-Host ("Excluded local/generated : {0}" -f @($excluded).Count)
Write-Host ""
Write-Host "Top-level source entries:"
Get-ChildItem $Source -Force | Select-Object Name,Mode | Format-Table -AutoSize

if (-not $Yes) {
  $answer = Read-Host "Continue with canonical import into this checkout? [S/N]"
  if ($answer -notmatch '^(S|SI|Sí|Y|YES)$') { Write-Host "Cancelled."; exit 2 }
}

$preserve = @(".git",".github","repo-tools","README.md",".gitignore","docs","CONTRIBUTING.md")
Get-ChildItem $RepoRoot -Force | Where-Object {
  $preserve -notcontains $_.Name
} | Remove-Item -Recurse -Force

foreach ($file in $sourceFiles) {
  $rel = $file.FullName.Substring($Source.Length).TrimStart('\','/')
  $dest = Join-Path $RepoRoot $rel
  $parent = Split-Path $dest -Parent
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
}

$localOnlyLeaks = Get-ChildItem $RepoRoot -Recurse -Force | Where-Object {
  $rel = $_.FullName.Substring($RepoRoot.Length).TrimStart('\','/')
  Is-LocalOnly $rel
}
if ($localOnlyLeaks) {
  $localOnlyLeaks | ForEach-Object { Write-Host "[LOCAL-ONLY] $($_.FullName)" }
  throw "Generated/local-only files were copied into the source checkout."
}

$markers = @("scripts",".aledevos","core","adapters","README.md")
$present = $markers | Where-Object { Test-Path (Join-Path $RepoRoot $_) }
if ($present.Count -lt 2) {
  throw "Source does not look like an AleDevOS distribution/source tree."
}

& git -C $RepoRoot add -A
$status = & git -C $RepoRoot status --porcelain
if (-not $status) {
  Write-Host "No changes to import."
  exit 0
}

Write-Host ""
Write-Host "Git changes:"
& git -C $RepoRoot status --short

if (-not $Yes) {
  $answer = Read-Host "Commit and push this baseline to origin/main? [S/N]"
  if ($answer -notmatch '^(S|SI|Sí|Y|YES)$') {
    Write-Host "Files copied but not committed/pushed."
    exit 3
  }
}

& git -C $RepoRoot commit -m "chore: import canonical AleDevOS baseline"
& git -C $RepoRoot push origin HEAD:main

Write-Host ""
Write-Host "[OK] AleDevOS baseline imported and pushed to Magiclejan/AleDevOS."
Write-Host "From now on GitHub main is the canonical source of truth."
