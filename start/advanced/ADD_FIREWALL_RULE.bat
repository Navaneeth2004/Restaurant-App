@echo off
setlocal enabledelayedexpansion
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
    echo Firewall rule added successfully!
    echo.
    REM FIX: previously printed a hardcoded example IP (26.21.247.104) —
    REM that's a leftover from one developer's own network (26.x is a
    REM typical Hamachi/Radmin VPN address, not a real LAN IP), which was
    REM actively misleading for anyone else running this script. Now
    REM detects the PC's real local network IP instead.
    set "LANIP="
    for /f "usebackq tokens=* delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*') -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LANIP=%%i"
    if not defined LANIP (
        echo Your phone should now be able to connect using this PC's
        echo network address on port 4000 — check the POS server window
        echo for the exact address ^(it prints "Network: http://...:4000"^).
    ) else (
        echo Your phone should now be able to connect to http://!LANIP!:4000
    )
) else (
    echo Failed to add rule. Try running as Administrator manually:
    echo.
    echo netsh advfirewall firewall add rule name="Node.js POS" dir=in action=allow protocol=tcp localport=4000
)

pause