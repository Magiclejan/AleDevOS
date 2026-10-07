param([Parameter(Mandatory=$true)][string]$ProjectPath)
$ErrorActionPreference='Stop'
$target=(Resolve-Path $ProjectPath).Path
$proj=Join-Path $target '.aledevos\project.json'
if(-not (Test-Path $proj)){throw 'Missing .aledevos/project.json'}
Write-Warning 'This command re-baselines canonical gate integrity. Run it only AFTER a human reviewed and approved the configuration diff.'
$cfg=Get-Content $proj -Raw | ConvertFrom-Json
$pkg=Join-Path $target 'package.json'
if(Test-Path $pkg){
  $p=Get-Content $pkg -Raw | ConvertFrom-Json
  $scripts=[ordered]@{}
  foreach($name in @('typecheck','lint','test','build')){if($cfg.gate_integrity.package_scripts.PSObject.Properties.Name -contains $name){if(-not $p.scripts.$name){throw "Expected package script missing: $name"};$scripts[$name]=[string]$p.scripts.$name}}
  $cfg.gate_integrity.package_scripts=[pscustomobject]$scripts
}
$files=[ordered]@{}
foreach($prop in $cfg.gate_integrity.files.PSObject.Properties){$rel=$prop.Name;$fp=Join-Path $target $rel;if(-not(Test-Path $fp)){throw "Integrity file missing: $rel"};$files[$rel]=(Get-FileHash $fp -Algorithm SHA256).Hash.ToLowerInvariant()}
$cfg.gate_integrity.files=[pscustomobject]$files
$cfg | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $proj
Write-Host 'Gate integrity baseline refreshed after explicit human action.' -ForegroundColor Green
