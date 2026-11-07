# stop.ps1 -- Stop the DataSense AI backend and frontend dev/production servers.
# Run from the DataSense-AI directory (or call it from anywhere).

$ErrorActionPreference = "Continue"

$stopped = 0

Write-Host "Stopping DataSense AI..." -ForegroundColor Cyan

# 1. Anything listening on the API port (8000)
$apiConns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $apiConns) {
    if ($conn.OwningProcess -gt 0) {
        Write-Host "Stopping API process $($conn.OwningProcess)" -ForegroundColor Yellow
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        $stopped++
    }
}
if (-not $apiConns) { Write-Host "No API listener on port 8000." -ForegroundColor Yellow }

# 2. Anything listening on the UI port (3000), but only this project's Next.js process
$uiConns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $uiConns) {
    if ($conn.OwningProcess -gt 0) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
        if ($proc -and ($proc.CommandLine -match 'DataSense|next start|next dev|next[\\/]dist')) {
            Write-Host "Stopping UI process $($conn.OwningProcess)" -ForegroundColor Yellow
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            $stopped++
        }
        else {
            Write-Host "Port 3000 is held by PID $($conn.OwningProcess); not a DataSense process, leaving it alone." -ForegroundColor Yellow
        }
    }
}
if (-not $uiConns) { Write-Host "No UI listener on port 3000." -ForegroundColor Yellow }

# 2b. Fallback: some Windows builds hide the Next.js listener from
# Get-NetTCPConnection, so also match node processes launched from this project.
$projectRoot = Split-Path -Parent $PSScriptRoot
$nextProcs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
        $_.CommandLine -and
        $_.CommandLine -match [regex]::Escape($projectRoot) -and
        $_.CommandLine -match 'next'
    }
foreach ($p in $nextProcs) {
    if (-not (Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue)) { continue }
    Write-Host "Stopping UI process $($p.ProcessId) (matched by command line)" -ForegroundColor Yellow
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    $stopped++
}

# 3. Any leftover uvicorn processes that belong to this project
$uvicorn = Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'uvicorn app\.main:app' }
foreach ($p in $uvicorn) {
    Write-Host "Stopping leftover uvicorn PID $($p.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    $stopped++
}

Write-Host "Done. $stopped process(es) stopped." -ForegroundColor Green
