param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $out=(& node --test tests/final-master-gate.test.mjs 2>&1 | Out-String)
  if($LASTEXITCODE -ne 0){Write-Host $out;throw 'Final Master Gate tests failed.'}
  $t=[regex]::Match($out,'(?m)^# tests (\d+)\s*$');$p=[regex]::Match($out,'(?m)^# pass (\d+)\s*$');$f=[regex]::Match($out,'(?m)^# fail (\d+)\s*$')
  if(-not $t.Success -or -not $p.Success -or -not $f.Success){throw 'Could not parse Final Master Gate TAP output.'}
  if([int]$f.Groups[1].Value -ne 0){throw 'Final Master Gate suite has failures.'}
  & node release/templates/final-master-gate-certifier.mjs certify verify --root . --certificate release/certifications/final-master-gate.json *> $null
  if($LASTEXITCODE -ne 0){throw 'Final Master Gate package certificate invalid.'}
  & node release/engine/v1-release.mjs master policy --project-root . *> $null
  if($LASTEXITCODE -ne 0){throw 'Master policy invalid.'}
  & node release/engine/v1-release.mjs master package --project-root . *> $null
  if($LASTEXITCODE -ne 0){throw 'Master package baseline invalid.'}
  & node release/templates/final-master-gate.mjs inventory --root . *> $null
  if($LASTEXITCODE -ne 0){throw 'Final Master Gate inventory failed.'}
  Write-Host "Final Master Gate: $($p.Groups[1].Value)/$($t.Groups[1].Value) PASS" -ForegroundColor Green
} finally { Pop-Location }
