# setup.ps1 -- Set up the DataSense AI environment
# Run from the DataSense-AI directory (or call it from anywhere).

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$venvDir = Join-Path $projectRoot ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

Write-Host "=== DataSense AI Setup ===" -ForegroundColor Cyan

# 1. Create Python venv if it doesn't exist
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv $venvDir
    Write-Host "Virtual environment created." -ForegroundColor Green
}
else {
    Write-Host "Virtual environment already exists." -ForegroundColor Yellow
}

# 2. Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
& $venvPython -m pip install -r (Join-Path $backendDir "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: backend dependency install failed." -ForegroundColor Red
    exit 1
}
Write-Host "Backend dependencies installed." -ForegroundColor Green

# 3. Import datasets. The importer posts files to the API, so the backend has to
#    be listening. start.ps1 is idempotent and waits for /api/health.
Write-Host "Starting backend for dataset import..." -ForegroundColor Cyan
& (Join-Path $scriptDir "start.ps1")

Write-Host "Importing datasets into backend..." -ForegroundColor Cyan
& $venvPython (Join-Path $scriptDir "import_datasets.py")
$importExit = $LASTEXITCODE
if ($importExit -ne 0) {
    Write-Host "WARNING: dataset import exited with code $importExit. Check that" -ForegroundColor Red
    Write-Host "         data/metadata/dataset_manifest.json exists (prepare_datasets.py)." -ForegroundColor Red
}
else {
    Write-Host "Datasets imported." -ForegroundColor Green
}

# Stop the temporary backend so the next start is clean.
$connections = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $connections) {
    if ($conn.OwningProcess -gt 0) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# 4. Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
Push-Location $frontendDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed." -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}
Write-Host "Frontend dependencies installed." -ForegroundColor Green

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. .\scripts\start.ps1                        # start backend"
Write-Host "  2. cd frontend; npm run build; npm run start  # start frontend (production)"
Write-Host "  3. Open http://localhost:3000 in your browser"
