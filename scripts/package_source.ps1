# Build DataSense-AI-Source.zip with dependencies, caches, raw downloads and
# stored uploads removed. The archive keeps source, processed Parquet, the demo
# database, trained models, reports and screenshots.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$zip = Join-Path $root "DataSense-AI-Source.zip"
$staging = Join-Path $env:TEMP ("datasense_package_" + [Guid]::NewGuid().ToString("N"))

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }

Write-Host "Staging source tree in $staging"
$rcArgs = @(
  $root, $staging, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1",
  "/XD", "node_modules", ".venv", ".next", ".git", "__pycache__",
  ".pytest_cache", ".mypy_cache", ".ruff_cache", ".turbo", "dist", "build",
  ".idea", ".vscode",
  (Join-Path $root "data\raw"), (Join-Path $root "data\uploads"),
  "/XF", "*.pyc", "*.pyo", "*.log", "*.tsbuildinfo", ".DS_Store", "Thumbs.db"
)
& robocopy @rcArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

# never package a previous archive
Remove-Item (Join-Path $staging "DataSense-AI-Source.zip") -Force -ErrorAction SilentlyContinue

Write-Host "Compressing..."
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zip -CompressionLevel Optimal -Force
Remove-Item $staging -Recurse -Force

$size = (Get-Item $zip).Length
Write-Host ("Created {0} ({1:N1} MB)" -f $zip, ($size / 1MB))
