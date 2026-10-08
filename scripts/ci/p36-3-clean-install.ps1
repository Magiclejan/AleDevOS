param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$spaceRoot = Join-Path $env:RUNNER_TEMP 'AleDevOS P36 3 Clean Install'
$target = Join-Path $spaceRoot 'Controlled Project With Spaces'
try {
    if (Test-Path -LiteralPath $spaceRoot) { throw "P36_3_TEST_DIR_ALREADY_EXISTS: $spaceRoot" }
    New-Item -ItemType Directory -Force -Path $spaceRoot | Out-Null
    $installer = Join-Path $root 'scripts\05-install-into-project.ps1'
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $installer -ProjectPath $target -Adapter opencode
    if ($LASTEXITCODE -ne 0) { throw "P36_3_INSTALL_FAILED exit=$LASTEXITCODE" }
    $manifest = Join-Path $target '.aledevos\project.json'
    if (-not (Test-Path -LiteralPath $manifest)) { throw "P36_3_PROJECT_MANIFEST_MISSING" }
    $bindingPath = Join-Path $target '.aledevos\skillsystem\bindings\opencode.json'
    if (-not (Test-Path -LiteralPath $bindingPath)) { throw "P36_3_SKILL_BINDING_MISSING" }
    $bindings = (Get-Content -LiteralPath $bindingPath -Raw | ConvertFrom-Json).bindings
    if (@($bindings).Count -ne 13) { throw "P36_3_SKILL_COUNT_MISMATCH" }
    $checked = 0
    foreach ($item in $bindings) {
        $relative = $item.path.Replace('/','\')
        $skillFile = Join-Path $target $relative
        if (-not (Test-Path -LiteralPath $skillFile)) { throw "P36_3_SKILL_MISSING: $($item.skill_id)" }
        $digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $skillFile).Hash.ToLowerInvariant()
        if ($digest -ne $item.expected_sha256) { throw "P36_3_SKILL_INTEGRITY_FAILED: $($item.skill_id)" }
        $checked++
    }
    if ($checked -ne 13) { throw 'P36_3_SKILL_VERIFICATION_INCOMPLETE' }
    if (-not (Test-Path (Join-Path $target '.opencode\agents\orchestrator.md'))) { throw 'P36_3_ORCHESTRATOR_NOT_INSTALLED' }
    if (-not (Test-Path (Join-Path $target '.opencode\agents\judge-requirements.md'))) { throw 'P36_3_JUDGE_NOT_INSTALLED' }
    if (-not (Test-Path (Join-Path $target '.aledevos\runtime\aledevos.mjs'))) { throw 'P36_3_RUNTIME_NOT_INSTALLED' }
    $project = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
    Write-Host "P36_3_CLEAN_INSTALL_PASS adapter=opencode verified_skills=$checked path_contains_spaces=true"
}
finally {
    if (Test-Path -LiteralPath $spaceRoot) {
        Remove-Item -LiteralPath $spaceRoot -Recurse -Force
    }
}
