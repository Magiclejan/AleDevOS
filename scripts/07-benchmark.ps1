param(
  [int]$Runs = 3,
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [string]$Model = $env:ALEDEVOS_BENCHMARK_MODEL
)
$ErrorActionPreference = "Stop"

$health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 5
if(-not $Model -and $health.model){$Model=[string]$health.model}
if(-not $Model){throw 'Benchmark model is unknown. Set -Model or ALEDEVOS_BENCHMARK_MODEL.'}

Write-Host "Model: $Model | max_context: $($health.max_context)"

$times = @()
for ($i=1; $i -le $Runs; $i++) {
  $body = @{
    model = $Model
    messages = @(@{ role='user'; content='Return a concise 5-item checklist for reviewing a small code change.' })
    max_tokens = 180
    reasoning_effort = 'low'
  } | ConvertTo-Json -Depth 6

  $utf8Body = [System.Text.Encoding]::UTF8.GetBytes($body)

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-RestMethod -Uri "$BaseUrl/v1/chat/completions" -Method Post -ContentType 'application/json; charset=utf-8' -Body $utf8Body -TimeoutSec 180
  $sw.Stop()
  $times += $sw.Elapsed.TotalSeconds
  Write-Host "Run ${i}: $([math]::Round($sw.Elapsed.TotalSeconds,2)) s"
}

$avg = ($times | Measure-Object -Average).Average
Write-Host "Average: $([math]::Round($avg,2)) s" -ForegroundColor Green
Write-Host "For real performance, inspect the active runtime telemetry (tokens/s, RAM, VRAM and I/O)."
