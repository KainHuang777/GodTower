<#
.SYNOPSIS
    Bridge script for fusion-gemini panel via Antigravity CLI (agy).
.DESCRIPTION
    Runs agy -p in a clean temp directory to avoid AGENTS.md interference.
    Usage: powershell -File scripts/fusion-gemini-bridge.ps1 -Question "your prompt"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Question
)

$tempDir = Join-Path $env:TEMP "fusion-gemini-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    $result = & agy -p $Question --model gemini-3.5-flash --effort medium --print-timeout 3m 2>&1
    $result | Out-String | Write-Host
} finally {
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
