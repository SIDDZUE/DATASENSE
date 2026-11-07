# start.ps1 -- Start the DataSense AI backend server
# Run from the DataSense-AI directory (or call it from anywhere).

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$backendDir = Join-Path $projectRoot "backend"
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

Write-Host "Starting DataSense AI backend..." -ForegroundColor Cyan

if (-not (Test-Path $venvPython)) {
    Write-Host "ERROR: Python venv not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Already healthy? Then there is nothing to do.
try {
    $health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 3
    if ($health.status -eq "ok") {
        Write-Host "Backend is already running on http://127.0.0.1:8000" -ForegroundColor Yellow
        exit 0
    }
}
catch {
    # not running yet, that is expected
}

# A listener with a real owning process means another app owns the port.
$existing = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -gt 0 }
if ($existing) {
    $pidOnPort = ($existing | Select-Object -First 1).OwningProcess
    Write-Host "ERROR: port 8000 is already in use by PID $pidOnPort." -ForegroundColor Red
    Write-Host "       Run .\scripts\stop.ps1 or .\scripts\stop_backend_port.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "Starting uvicorn on http://127.0.0.1:8000" -ForegroundColor Green
Start-Process -FilePath $venvPython `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $backendDir -WindowStyle Hidden

Write-Host "Waiting for backend to become ready..." -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 2
        if ($health.status -eq "ok") {
            Write-Host "Backend is running on http://127.0.0.1:8000" -ForegroundColor Green
            Write-Host "API docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        # keep waiting
    }
}

Write-Host "WARNING: backend did not become ready within 30 seconds." -ForegroundColor Red
Write-Host "         Check that port 8000 is free and the venv is complete." -ForegroundColor Red
exit 1
