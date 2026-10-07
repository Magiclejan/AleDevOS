$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $patterns=@(
    'P5 policy|policy requires|policy caps|policy does not claim|policy claims|network transport|machine identity|invalid machine id|identity cannot|tampered identity|private key',
    'coordinator initializes|coordinator cannot|enrollment starts|pending node heartbeat|approved node|heartbeat replay|tampered heartbeat|identity conflict|revoked node',
    'task payload|duplicate task|assignment requires|lease below|assignment bundle|untrusted coordinator|wrong target|tampered assignment|tampered payload|valid assignment|same fence',
    'ack roundtrip|result cannot|valid result|same accepted result|different second|tampered result|reassignment before|expired lease|late result|new fence|reassignment limit',
    'tasks registry|rehashing outer|live coordinator lock|stale dead coordinator lock|P1 certificate|P2 certificate|P3 certificate|P4 certificate|recursive installer|installed execution layout|P5 package certificate|P5 certificate claims|P5 certificate tamper|rehashing forged P5'
  )
  foreach($p in $patterns){ node --test --test-name-pattern=$p tests/advanced-execution-phase5.test.mjs; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE} }
  node advanced-execution/multimachine/multimachine-manager.mjs certify verify --certificate release/certifications/advanced-execution-p5.json
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
} finally { Pop-Location }
