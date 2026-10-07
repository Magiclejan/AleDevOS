$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $patterns=@(
    'P4 policy|P4 phase|dispatcher and queue|P3 remains|P2 remains|P1 remains|multi-machine|network remains|target runtime|queue capacity|priority bounded|dispatch starts|dispatch retries|fairness|work conserving|never bypasses|never spawns|contains no adapter|imports no network|queue init|empty queue|queue hash|invalid priority|invalid P3 plan|valid P3 plan|duplicate plan|snapshots plan|changing original|tampering plan snapshot|submission receipt|submission sequence',
    'queue pause|queue resume|item pause|item resume|cancel queued|queued item cannot|drain empty',
    'dispatch tick starts|running item status|cancel running|complete running|max-starts one|higher priority|epoch aging|work-conserving tick|temporary P3 admission|blocked item is rechecked|drain with running',
    'live control lock|dead stale control lock|queue survives|P1 certificate|P2 certificate|P3 certificate|P3 policy still|recursive installer|installed execution layout|P4 package certificate|P4 certificate claims|P4 certificate tamper|rehashing forged P4'
  )
  foreach($p in $patterns){ node --test --test-name-pattern=$p tests/advanced-execution-phase4.test.mjs; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE} }
  node --test --test-name-pattern='stale dead global lock' tests/advanced-execution-phase3.test.mjs
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  node advanced-execution/dispatcher/dispatcher-manager.mjs certify verify --certificate release/certifications/advanced-execution-p4.json
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
} finally { Pop-Location }
