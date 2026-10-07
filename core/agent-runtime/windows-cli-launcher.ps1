param(
  [Parameter(Mandatory=$true,Position=0)]
  [string]$ExecutableBase64,

  [Parameter(Position=1,ValueFromRemainingArguments=$true)]
  [string[]]$EncodedArgs=@()
)
$ErrorActionPreference='Stop'

function Decode-Utf8Base64([string]$Value) {
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

$exeName=Decode-Utf8Base64 $ExecutableBase64
$decodedArgs=New-Object System.Collections.Generic.List[string]
foreach($encoded in $EncodedArgs){
  [void]$decodedArgs.Add((Decode-Utf8Base64 ([string]$encoded)))
}

$resolved=Get-Command -Name $exeName -ErrorAction Stop | Select-Object -First 1
$target=[string]$resolved.Source
if([string]::IsNullOrWhiteSpace($target)){
  $target=[string]$resolved.Definition
}
if([string]::IsNullOrWhiteSpace($target)){
  throw "ALEDEVOS_WINDOWS_COMMAND_RESOLUTION_FAILED: $exeName"
}

$invokeArgs=[string[]]$decodedArgs.ToArray()
& $target @invokeArgs
if($null -ne $LASTEXITCODE){
  exit $LASTEXITCODE
}
