# Stops only the process listening on the DataSense backend port (8000).
$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  $p = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
  Write-Output "Port 8000 held by PID $($conn.OwningProcess) ($($p.ProcessName))"
  if ($p.ProcessName -match 'python|uvicorn') {
    Stop-Process -Id $conn.OwningProcess -Force
    Write-Output "Stopped."
  } else {
    Write-Output "Not a python process - leaving it alone."
  }
} else {
  Write-Output "Port 8000 free."
}
