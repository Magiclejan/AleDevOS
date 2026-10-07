param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  function Run-Test([string]$File){
    $output=(& node --test $File 2>&1 | Out-String)
    if($LASTEXITCODE -ne 0){Write-Host $output;throw "Test failure: $File"}
    $t=[regex]::Match($output,'(?m)^# tests (\d+)\s*$');$p=[regex]::Match($output,'(?m)^# pass (\d+)\s*$');$f=[regex]::Match($output,'(?m)^# fail (\d+)\s*$')
    if(-not $t.Success -or -not $p.Success -or -not $f.Success){throw "Could not parse TAP: $File"}
    [pscustomobject]@{Tests=[int]$t.Groups[1].Value;Pass=[int]$p.Groups[1].Value;Fail=[int]$f.Groups[1].Value}
  }
  $a=Run-Test 'tests/master-validation-phase1.test.mjs'
  $b=Run-Test 'tests/v1-release-validation.test.mjs'
  if($a.Fail -ne 0 -or $a.Pass -ne 47){throw "Master P1 expected 47/47, got $($a.Pass)/$($a.Tests)"}
  if($b.Fail -ne 0){throw 'Legacy V1 gate compatibility regression'}
  & node release/engine/v1-release.mjs master policy --project-root . *> $null
  if($LASTEXITCODE -ne 0){throw 'Master policy invalid'}
  & node release/engine/v1-release.mjs master package --project-root . *> $null
  if($LASTEXITCODE -ne 0){throw 'Master package baseline invalid'}
  & node release/engine/v1-release.mjs master verify-certificate --project-root . --certificate release/certifications/master-validation-p1.json *> $null
  if($LASTEXITCODE -ne 0){throw 'Master P1 certificate invalid'}
  Write-Host "Master Validation P1: $($a.Pass)/$($a.Tests) PASS; legacy gate: $($b.Pass)/$($b.Tests) PASS" -ForegroundColor Green
} finally { Pop-Location }
