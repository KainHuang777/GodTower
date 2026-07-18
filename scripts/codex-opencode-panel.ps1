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
    [bool]$Truncated = $false,
    [string]$ActualAgent = '',
    [string]$ActualModel = '',
    [string]$SessionId = '',
    [bool]$Verified = $false
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
    actualAgent = $ActualAgent
    actualModel = $ActualModel
    sessionId = $SessionId
    verified = $Verified
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

function Test-PanelOutputPolicy {
  param([string]$Text)

  # The panel is explicitly tool-less. These self-reports are not evidence and
  # must not reach the Codex judge as if they were verified observations.
  $patterns = @(
    '(?i)\b(?:i|we)\s+(?:have\s+)?(?:inspected|read|opened|accessed|executed|ran|contacted|dispatched|spawned)\b',
    '(?i)\b(?:i am|i''m)\s+(?:an?\s+)?(?:claude|glm|kimi|qwen)\b',
    '(?:我|本模型|本面板).{0,12}(?:已|曾|正在).{0,16}(?:讀取|檢查|開啟|存取|執行|運行|呼叫|派發|分派).{0,20}(?:工作區|檔案|工具|命令|網路|代理|面板)',
    '(?:我是|本模型是|本面板是).{0,24}(?:Claude|GLM|Kimi|Qwen)'
  )

  foreach ($pattern in $patterns) {
    if ($Text -match $pattern) { return $true }
  }

  return $false
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
    '--model', [string]$panelConfig.model,
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
  $stderr = $stderrTask.Result
  $exitCode = $process.ExitCode
  if ($exitCode -ne 0) {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'OPENCODE_FAILED' $exitCode $stopwatch.ElapsedMilliseconds
    exit 1
  }

  if ($stderr -match '(?i)falling back to default agent') {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'AGENT_FALLBACK' $exitCode $stopwatch.ElapsedMilliseconds
    exit 1
  }

  $textParts = [System.Collections.Generic.List[string]]::new()
  $sessionId = ''
  foreach ($line in ($stdout -split "`r?`n")) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try {
      $event = $line | ConvertFrom-Json -ErrorAction Stop
      if ([string]::IsNullOrWhiteSpace($sessionId)) {
        $sessionCandidates = @(
          (Get-PropertyPath $event @('sessionID')),
          (Get-PropertyPath $event @('sessionId')),
          (Get-PropertyPath $event @('part', 'sessionID')),
          (Get-PropertyPath $event @('properties', 'sessionID')),
          (Get-PropertyPath $event @('properties', 'part', 'sessionID'))
        )
        foreach ($candidate in $sessionCandidates) {
          if ($candidate -is [string] -and $candidate -match '^ses_[A-Za-z0-9]+$') {
            $sessionId = $candidate
            break
          }
        }
      }
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

  if (Test-PanelOutputPolicy $output) {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'PANEL_OUTPUT_POLICY_VIOLATION' $exitCode $stopwatch.ElapsedMilliseconds
    exit 1
  }

  if ([string]::IsNullOrWhiteSpace($sessionId)) {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'SESSION_VERIFICATION_FAILED' $exitCode $stopwatch.ElapsedMilliseconds
    exit 1
  }

  $exportStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $exportStartInfo.FileName = $opencode.Source
  $exportStartInfo.UseShellExecute = $false
  $exportStartInfo.RedirectStandardOutput = $true
  $exportStartInfo.RedirectStandardError = $true
  $exportStartInfo.CreateNoWindow = $true
  foreach ($argument in @('export', $sessionId, '--sanitize')) {
    [void]$exportStartInfo.ArgumentList.Add($argument)
  }

  $exportProcess = [System.Diagnostics.Process]::new()
  $exportProcess.StartInfo = $exportStartInfo
  [void]$exportProcess.Start()
  $exportStdoutTask = $exportProcess.StandardOutput.ReadToEndAsync()
  $exportStderrTask = $exportProcess.StandardError.ReadToEndAsync()
  if (-not $exportProcess.WaitForExit(20000)) {
    $exportProcess.Kill($true)
    $exportProcess.WaitForExit()
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'SESSION_VERIFICATION_FAILED' $exitCode $stopwatch.ElapsedMilliseconds $false '' '' $sessionId
    exit 1
  }
  [System.Threading.Tasks.Task]::WaitAll(@($exportStdoutTask, $exportStderrTask))
  if ($exportProcess.ExitCode -ne 0) {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'SESSION_VERIFICATION_FAILED' $exitCode $stopwatch.ElapsedMilliseconds $false '' '' $sessionId
    exit 1
  }

  try {
    $sessionExport = $exportStdoutTask.Result | ConvertFrom-Json -ErrorAction Stop
    $assistantMessages = @($sessionExport.messages | Where-Object { (Get-PropertyPath $_ @('info', 'role')) -eq 'assistant' })
    $userMessages = @($sessionExport.messages | Where-Object { (Get-PropertyPath $_ @('info', 'role')) -eq 'user' })
    if ($assistantMessages.Count -eq 0 -or $userMessages.Count -eq 0) {
      throw [System.InvalidOperationException]::new('Session messages missing')
    }

    $assistantInfo = $assistantMessages[-1].info
    $userInfo = $userMessages[0].info
    $actualAgent = [string](Get-PropertyPath $assistantInfo @('agent'))
    if ([string]::IsNullOrWhiteSpace($actualAgent)) {
      $actualAgent = [string](Get-PropertyPath $userInfo @('agent'))
    }
    $actualProvider = [string](Get-PropertyPath $assistantInfo @('providerID'))
    $actualModelId = [string](Get-PropertyPath $assistantInfo @('modelID'))
    if ([string]::IsNullOrWhiteSpace($actualProvider) -or [string]::IsNullOrWhiteSpace($actualModelId)) {
      $actualProvider = [string](Get-PropertyPath $userInfo @('model', 'providerID'))
      $actualModelId = [string](Get-PropertyPath $userInfo @('model', 'modelID'))
    }
    $actualModel = if ($actualProvider -and $actualModelId) { "$actualProvider/$actualModelId" } else { '' }
  } catch {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'SESSION_VERIFICATION_FAILED' $exitCode $stopwatch.ElapsedMilliseconds $false '' '' $sessionId
    exit 1
  }

  $agentMatches = $actualAgent.Equals([string]$panelConfig.agent, [System.StringComparison]::OrdinalIgnoreCase)
  $modelMatches = $actualModel.Equals([string]$panelConfig.model, [System.StringComparison]::OrdinalIgnoreCase)
  if (-not $agentMatches -or -not $modelMatches) {
    $stopwatch.Stop()
    Write-BridgeResult $false $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) '' 'MODEL_VERIFICATION_FAILED' $exitCode $stopwatch.ElapsedMilliseconds $false $actualAgent $actualModel $sessionId
    exit 1
  }

  $truncated = $false
  if ($output.Length -gt 12000) {
    $output = $output.Substring(0, 12000)
    $truncated = $true
  }

  $stopwatch.Stop()
  Write-BridgeResult $true $Panel ([string]$panelConfig.agent) ([string]$panelConfig.model) $output '' $exitCode $stopwatch.ElapsedMilliseconds $truncated $actualAgent $actualModel $sessionId $true
} catch {
  $agent = if ($null -ne $panelConfig) { [string]$panelConfig.agent } else { '' }
  $model = if ($null -ne $panelConfig) { [string]$panelConfig.model } else { '' }
  $stopwatch.Stop()
  Write-BridgeResult $false $Panel $agent $model '' $errorCode -1 $stopwatch.ElapsedMilliseconds
  exit 1
}
