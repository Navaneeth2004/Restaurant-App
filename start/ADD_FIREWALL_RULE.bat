@echo off
REM Add Windows Firewall exception for port 4000

echo Adding firewall rule for port 4000...

REM Run as admin
if not "%1"=="am_admin" (
    powershell -ex AllSigned -Command "Start-Process -Verb RunAs -FilePath '%0' -ArgumentList am_admin"
    exit /b
)

REM Add inbound rule
netsh advfirewall firewall add rule name="Node.js POS - Port 4000" dir=in action=allow protocol=tcp localport=4000 >nul 2>&1

if %errorlevel% equ 0 (
    echo ✓ Firewall rule added successfully!
    echo.
    echo Your phone should now be able to connect to http://26.21.247.104:4000
    echo (or whatever IP address your server shows)
) else (
    echo ✗ Failed to add rule. Try running as Administrator manually:
    echo.
    echo netsh advfirewall firewall add rule name="Node.js POS" dir=in action=allow protocol=tcp localport=4000
)

pause
