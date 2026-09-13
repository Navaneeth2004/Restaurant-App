@echo off
REM Remove Windows Firewall exception for port 4000

echo Removing firewall rule for port 4000...

REM Run as admin
if not "%1"=="am_admin" (
    powershell -ex AllSigned -Command "Start-Process -Verb RunAs -FilePath '%0' -ArgumentList am_admin"
    exit /b
)

REM Delete inbound rule
netsh advfirewall firewall delete rule name="Node.js POS - Port 4000" >nul 2>&1

if %errorlevel% equ 0 (
    echo ✓ Firewall rule removed successfully!
) else (
    echo ✗ Failed to remove rule or rule does not exist.
)

pause