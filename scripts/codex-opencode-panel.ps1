[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$Panel,

  [Parameter(Mandatory)]
  [ValidateLength(1, 24000)]
  [string]$Prompt,

  [string]$WorkingDirectory = (Get-Location).Path,

  [ValidateRange(10, 300)]
  [int]$TimeoutSeconds = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-BridgeResult {
  param(
    [bool]$Ok,
    [string]$PanelId,
    [string]$Agent,
    [string]$Model,
    [string]$Output,
    [string]$ErrorCode,
    [int]$ExitCode,
    [long]$ElapsedMs,
    [bool]$Truncated = $false
  )

  [pscustomobject]@{
    ok        = $Ok
    panel     = $PanelId
    agent     = $Agent
    model     = $Model
    output    = $Output
    error     = $ErrorCode
    exitCode  = $ExitCode
    elapsedMs = $ElapsedMs
    truncated = $Truncated
  } | ConvertTo-Json -Compress
}

function Get-PropertyPath {
  param(
    [object]$Value,
    [string[]]$Path
  )

  $current = $Value
  foreach ($segment in $Path) {
    if ($null -eq $current) { return $null }
    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) { return $null }
    $current = $property.Value
  }
  return $current
}

function Get-EventText {
  param([object]$Event)

  $candidates = @(
    (Get-PropertyPath $Event @('text')),
    (Get-PropertyPath $Event @('delta')),
    (Get-PropertyPath $Event @('part', 'text')),
    (Get-PropertyPath $Event @('properties', 'text')),
    (Get-PropertyPath $Event @('properties', 'part', 'text'))
  )

  foreach ($candidate in $candidates) {
    if ($candidate -is [string] -and -not [string]::IsNullOrWhiteSpace($candidate)) {
      return $candidate
    }
  }

  return $null
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$powerShell7OrLater = $PSVersionTable.PSVersion.Major -ge 7
if (-not $powerShell7OrLater) {
  $stopwatch.Stop()
  Write-BridgeResult $false $Panel '' '' '' 'POWERSHELL_7_REQUIRED' -1 $stopwatch.ElapsedMilliseconds
  exit 1
}

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifestPath = Join-Path $PSScriptRoot 'codex-opencode-panels.json'
$panelConfig = $null
$errorCode = 'BRIDGE_SETUP_FAILED'

try {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $matches = @($manifest.panels | Where-Object { $_.id -eq $Panel })
  if ($matches.Count -eq 0) {
    $errorCode = 'PANEL_NOT_ALLOWED'
    throw [System.InvalidOperationException]::new($errorCode)
  }
  $panelConfig = $matches[0]

  $resolvedDirectory = [System.IO.Path]::GetFullPath($WorkingDirectory)
  $rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolvedDirectory.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and $resolvedDirectory -ne $root) {
    $errorCode = 'WORKING_DIRECTORY_NOT_ALLOWED'
    throw [System.InvalidOperationException]::new($errorCode)
  }
  if (-not (Test-Path -LiteralPath $resolvedDirectory -PathType Container)) {
    $errorCode = 'WORKING_DIRECTORY_NOT_FOUND'
    throw [System.InvalidOperationException]::new($errorCode)
  }

  $opencode = Get-Command opencode.cmd -CommandType Application -ErrorAction Stop
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $opencode.Source
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true

  foreach ($argument in @(
    '--pure', 'run', '--agent', [string]$panelConfig.agent,
    '--format', 'json', '--dir', $resolvedDirectory,
    $Prompt
  )) {
    [void]$startInfo.ArgumentList.Add($argument)
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()

  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    $process.Kill($true)
    $process.WaitForExit()
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'TIMEOUT' -1 $stopwatch.ElapsedMilliseconds
    exit 1
  }

  [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))
  $stdout = $stdoutTask.Result
  $exitCode = $process.ExitCode
  if ($exitCode -ne 0) {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'OPENCODE_FAILED' $exitCode $stopwatch.ElapsedMilliseconds
    exit 1
  }

  $textParts = [System.Collections.Generic.List[string]]::new()
  foreach ($line in ($stdout -split "`r?`n")) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try {
      $event = $line | ConvertFrom-Json -ErrorAction Stop
      $text = Get-EventText $event
      if ($null -ne $text) { $textParts.Add($text) }
    } catch {
      # OpenCode JSON event schemas may evolve. Unknown events are deliberately ignored.
    }
  }

  $output = ($textParts -join '')
  if ([string]::IsNullOrWhiteSpace($output)) {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'NO_FINAL_TEXT' $exitCode $stopwatch.ElapsedMilliseconds
    exit 1
  }

  $truncated = $false
  if ($output.Length -gt 12000) {
    $output = $output.Substring(0, 12000)
    $truncated = $true
  }

  $stopwatch.Stop()
  Write-BridgeResult $true $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) $output '' $exitCode $stopwatch.ElapsedMilliseconds $truncated
} catch {
  $agent = if ($null -ne $panelConfig) { [string]$panelConfig.agent } else { '' }
  $model = if ($null -ne $panelConfig) { [string]$panelConfig.model } else { '' }
  $stopwatch.Stop()
  Write-BridgeResult $false $Panel $agent $model '' $errorCode -1 $stopwatch.ElapsedMilliseconds
  exit 1
}
