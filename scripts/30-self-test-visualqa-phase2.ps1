$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check visualqa/engine/browser-runner.mjs
  node --check adapters/opencode/visualqa/playwright-driver.mjs
  node --test tests/visualqa-phase2.test.mjs
} finally { Pop-Location }
