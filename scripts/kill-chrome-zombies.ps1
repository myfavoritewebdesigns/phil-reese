# Kill stale Chrome processes launched by chrome-devtools-mcp.
#
# Why this exists:
# The Chrome DevTools MCP server sometimes leaves orphan Chrome.exe processes
# behind after a session ends. If you spawn it repeatedly during a debug loop,
# zombies stack up (we've seen 9+ in one session). The MCP eventually refuses
# to start with "browser already running" until they're cleaned up.
#
# How to run:
#   powershell -ExecutionPolicy Bypass -File scripts/kill-chrome-zombies.ps1
# Or paste the body directly into a PowerShell window.

$procs = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match 'chrome-devtools-mcp'
}

if (-not $procs) {
    Write-Host "No chrome-devtools-mcp processes found. Nothing to kill." -ForegroundColor Green
    exit 0
}

Write-Host "Found $($procs.Count) chrome-devtools-mcp process(es). Killing..." -ForegroundColor Yellow
$procs | ForEach-Object {
    # SilentlyContinue suppresses harmless "process already gone" errors that
    # happen when a parent Chrome kills its children before we get to them.
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 300
$remaining = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match 'chrome-devtools-mcp'
}
if ($remaining) {
    Write-Host "$($remaining.Count) still running. May need a second pass." -ForegroundColor Red
    exit 1
} else {
    Write-Host "All chrome-devtools-mcp processes terminated." -ForegroundColor Green
}
