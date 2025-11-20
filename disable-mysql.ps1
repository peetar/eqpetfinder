# Stop and disable MySQL service
# Run this script as Administrator

Write-Host "Stopping MySQL service..."
Stop-Service -Name MySQL95 -Force -ErrorAction SilentlyContinue

Write-Host "Disabling MySQL service from auto-start..."
Set-Service -Name MySQL95 -StartupType Disabled

Write-Host "MySQL service stopped and disabled from startup."
Get-Service -Name MySQL95 | Format-Table Name, Status, StartType
