$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check visualqa/engine/png-codec.mjs
  node --check visualqa/engine/regression.mjs
  node --test tests/visualqa-phase3.test.mjs
} finally { Pop-Location }
