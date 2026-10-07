$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  function Run-Test([string]$File,[string]$Pattern=''){
    $a=@('--test')
    if($Pattern){$a += "--test-name-pattern=$Pattern"}
    $a += $File
    $output=(& node @a 2>&1 | Out-String)
    $code=$LASTEXITCODE
    if($code -ne 0){Write-Host $output;throw "Test failure: $File $Pattern"}
    $m=[regex]::Match($output,'(?m)^# tests (\d+)\s*$')
    $p=[regex]::Match($output,'(?m)^# pass (\d+)\s*$')
    $f=[regex]::Match($output,'(?m)^# fail (\d+)\s*$')
    if(-not $m.Success -or -not $p.Success -or -not $f.Success){throw "Could not parse TAP summary: $File"}
    return [pscustomobject]@{Tests=[int]$m.Groups[1].Value;Pass=[int]$p.Groups[1].Value;Fail=[int]$f.Groups[1].Value}
  }

  $files=@(
    'tests/core-engine.test.mjs',
    'tests/contextos-phase1.test.mjs','tests/contextos-phase2.test.mjs','tests/contextos-phase3.test.mjs','tests/contextos-phase4.test.mjs','tests/contextos-phase5.test.mjs','tests/contextos-phase6.test.mjs',
    'tests/skill-system-phase1.test.mjs','tests/skill-system-phase2.test.mjs','tests/skill-system-phase3.test.mjs','tests/skill-system-phase4.test.mjs','tests/skill-system-phase5.test.mjs',
    'tests/uxui-phase1.test.mjs','tests/uxui-phase2.test.mjs','tests/uxui-phase3.test.mjs','tests/uxui-phase4.test.mjs','tests/uxui-phase5.test.mjs','tests/uxui-phase6.test.mjs',
    'tests/visualqa-phase1.test.mjs','tests/visualqa-phase2.test.mjs','tests/visualqa-phase3.test.mjs','tests/visualqa-phase4.test.mjs','tests/visualqa-phase5-integration.test.mjs',
    'tests/v1-release-validation.test.mjs','tests/portability-phase1.test.mjs'
  )
  $tests=0;$pass=0;$fail=0
  foreach($file in $files){$r=Run-Test $file;$tests+=$r.Tests;$pass+=$r.Pass;$fail+=$r.Fail;Write-Host "$file  $($r.Pass)/$($r.Tests) PASS"}

  # Visual QA P5 is split to keep heavyweight fixture groups bounded on the target PC.
  $p5Groups=@(
    @('P1/P2 evidence revisions preserve revision-specific artifact paths','evidence revision ID rejects path-like unsafe values','P5 packet prepares only from P2 + PASS P3 + PASS P4','P5 packet verifies and is sealed','packet tampering is detected'),
    @('packet blocks a genuine Phase 3 regression FAIL','packet blocks a genuine Phase 4 deterministic FAIL','PASS judgment computes final score instead of trusting a claimed overall','FAIL judgment is sealed and returns nonzero without becoming BLOCKED','UNVERIFIED visual dimension produces BLOCKED rather than guessed FAIL/PASS'),
    @('native image observation is mandatory','judge identity is pinned to dedicated visual-judge role','model reference is mandatory for semantic judgment provenance','observed screenshot hash must match the packet evidence','all rubric dimensions are mandatory exactly once'),
    @('dimension score/status inconsistency is rejected','failed dimension requires a concrete finding','critical visual finding must be blocking','overall score below 90 fails even if every dimension individually passes','judgment verification succeeds for semantic FAIL reports'),
    @('judgment tampering is detected','submission drift invalidates a sealed judgment','repair authorization requires global repair-start first','BLOCKED visual judgment is not eligible for automatic repair','PASS judgment cannot open a repair plan'),
    @('repair plan binds attempt, approved scope, findings, and no-baseline-promotion rules','repair plans are immutable per repair attempt','repair plan detects global scope-version drift','repair cycle refuses stale P2/P3/P4 evidence','successful repair requires fresh P2 -> P3 -> P4 -> Visual Judge evidence'),
    @('historical failed judgment remains usable after source changes because repair authorization sealed it first','failed repair 1 allows one more bounded retry','repair 2 failure exhausts the visual repair loop; there is no third visual repair','acceptance PASS works directly when no repair was needed','acceptance after repair requires the latest successful repair cycle'),
    @('sealed final acceptance verifies','P5 final acceptance explicitly does not claim motion quality or full WCAG','Phase 5 policy pins holistic thresholds and two-repair cap')
  )
  foreach($group in $p5Groups){
    $escaped=@($group | ForEach-Object {[regex]::Escape($_)})
    $pattern='^(?:'+($escaped -join '|')+')$'
    $r=Run-Test 'tests/visualqa-phase5.test.mjs' $pattern;$tests+=$r.Tests;$pass+=$r.Pass;$fail+=$r.Fail;Write-Host "P5 group  $($r.Pass)/$($r.Tests) PASS"
  }

  $mjs=Get-ChildItem $root -Recurse -File -Filter '*.mjs'
  $mjsPass=0
  foreach($f in $mjs){& node --check $f.FullName *> $null;if($LASTEXITCODE -ne 0){throw "MJS syntax failed: $($f.FullName)"};$mjsPass++}

  $json=Get-ChildItem $root -Recurse -File -Filter '*.json'
  $jsonPass=0
  foreach($f in $json){try{$null=Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop;$jsonPass++}catch{throw "JSON parse failed: $($f.FullName): $($_.Exception.Message)"}}

  if($fail -ne 0 -or $pass -ne $tests){throw "Deterministic suite not clean: pass=$pass tests=$tests fail=$fail"}
  if($tests -lt 600){throw "Deterministic suite below Portability P1 floor: $tests < 600"}
  if($mjsPass -lt 53){throw "MJS syntax coverage below Portability P1 floor: $mjsPass < 53"}
  if($jsonPass -lt 124){throw "JSON parse coverage below Portability P1 floor: $jsonPass < 124"}

  $summary=[ordered]@{
    schema_version='1.0';
    release='1.28.0-portability-p1';
    tests_passed=$pass;tests_total=$tests;failures=$fail;
    mjs_syntax_passed=$mjsPass;json_parse_passed=$jsonPass;
    generated_at=(Get-Date).ToUniversalTime().ToString('o')
  }
  $summaryPath=Join-Path $root 'PORTABILITY_P1_REGRESSION_SUMMARY.json'
  $summary | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $summaryPath
  Write-Host "`nPortability P1 cumulative suite: $pass/$tests PASS; MJS $mjsPass; JSON $jsonPass" -ForegroundColor Green
} finally {Pop-Location}
