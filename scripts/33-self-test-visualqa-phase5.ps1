$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check visualqa/engine/visual-judge.mjs
  if($LASTEXITCODE -ne 0){throw 'visual-judge syntax failed'}
  node --check visualqa/engine/visualqa.mjs
  if($LASTEXITCODE -ne 0){throw 'visualqa syntax failed'}
  node --check visualqa/engine/browser-runner.mjs
  if($LASTEXITCODE -ne 0){throw 'browser-runner syntax failed'}

  # Run the 38 integration-heavy semantic tests in bounded groups. A single
  # monolithic Node test process can exceed constrained CI/container limits
  # because every case builds a fresh sealed P1-P4 fixture.
  $patterns=@(
    '^(P1/P2 evidence revisions|evidence revision ID|P5 packet|packet tampering|packet blocks|PASS judgment|FAIL judgment|UNVERIFIED visual dimension)',
    '^(native image observation|judge identity|model reference|observed screenshot hash|all rubric dimensions|dimension score/status|failed dimension|critical visual finding|overall score below|judgment verification succeeds)',
    '^(judgment tampering|submission drift|repair authorization|BLOCKED visual judgment|repair plan binds|repair plans are immutable|repair plan detects|repair cycle refuses)',
    '^(successful repair|historical failed judgment|failed repair 1|repair 2 failure)',
    '^(acceptance PASS works|acceptance after repair|sealed final acceptance|P5 final acceptance|Phase 5 policy)'
  )
  foreach($pattern in $patterns){
    node --test --test-name-pattern=$pattern tests/visualqa-phase5.test.mjs
    if($LASTEXITCODE -ne 0){throw "Visual QA Phase 5 semantic test group failed: $pattern"}
  }
  node --test tests/visualqa-phase5-integration.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Visual QA Phase 5 integration tests failed'}
  Write-Host 'Visual QA Phase 5 self-test PASS (38 semantic + 8 wiring tests).' -ForegroundColor Green
} finally { Pop-Location }
