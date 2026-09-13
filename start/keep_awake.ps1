# keep_awake.ps1
# Prevents Windows from sleeping while the Restaurant POS server is running.

param(
    [string]$BackendDir = (Join-Path -Path $PSScriptRoot -ChildPath '..\backend')
)

$Source = @"
using System;
using System.Runtime.InteropServices;
public static class PowerState {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
"@

Add-Type -TypeDefinition $Source

# Parse hex values safely without 32-bit signed integer overflow
$ES_CONTINUOUS       = [uint32]::Parse('80000000', [System.Globalization.NumberStyles]::HexNumber)
$ES_SYSTEM_REQUIRED  = [uint32]0x00000001
$ES_DISPLAY_REQUIRED = [uint32]0x00000002

# Keep system + display awake
[PowerState]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_DISPLAY_REQUIRED) | Out-Null
Write-Host ' [OK] Sleep prevention active — PC will not sleep while POS is running.' -ForegroundColor Green

try {
    $ResolvedPath = (Resolve-Path $BackendDir -ErrorAction Stop).Path
    Set-Location $ResolvedPath
    Write-Host " [INFO] Working directory: $ResolvedPath" -ForegroundColor Cyan

    if (-not (Test-Path 'server.js')) {
        Write-Host ' [ERROR] Could not find server.js in target directory.' -ForegroundColor Red
    } else {
        & node server.js
        if ($LASTEXITCODE -ne 0) {
            Write-Host " [ERROR] Node.js process exited with code $LASTEXITCODE." -ForegroundColor Red
        }
    }
} catch {
    Write-Host " [ERROR] Exception caught: $_" -ForegroundColor Red
} finally {
    # Release keep-awake state
    [PowerState]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
    
    Write-Host '----------------------------------------' -ForegroundColor Gray
    Read-Host -Prompt 'Press Enter to exit'
}