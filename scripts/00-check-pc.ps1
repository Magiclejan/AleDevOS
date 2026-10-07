$ErrorActionPreference = "Continue"
Write-Host "=== AleDevOS PC Check ===" -ForegroundColor Cyan

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Write-Host "OS:  $($os.Caption) $($os.Version)"
Write-Host "CPU: $($cpu.Name)"
Write-Host "RAM: $ramGB GB"

Write-Host "`n--- Disks ---"
Get-PSDrive -PSProvider FileSystem | ForEach-Object { if ($_.Free -ne $null) { Write-Host ("{0}: free {1:N1} GB / used {2:N1} GB" -f $_.Name, ($_.Free/1GB), ($_.Used/1GB)) } }

Write-Host "`n--- Optional GPU tooling ---"
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { nvidia-smi --query-gpu=index,name,memory.total,driver_version --format=csv } else { Write-Host "nvidia-smi not found (optional)." -ForegroundColor Yellow }

Write-Host "`n--- Tooling ---"
foreach ($cmd in @("git","node","npm","opencode","codex","claude","agy")) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($found) { try { $ver = & $cmd --version 2>$null | Select-Object -First 1 } catch { $ver = "installed" }; Write-Host ("{0,-10} OK  {1}" -f $cmd,$ver) -ForegroundColor Green }
  else { Write-Host ("{0,-10} MISSING/OPTIONAL" -f $cmd) -ForegroundColor Yellow }
}

Write-Host "`nAleDevOS does not install or require a model backend. Runtime/provider selection belongs to the selected adapter/user environment." -ForegroundColor Cyan
