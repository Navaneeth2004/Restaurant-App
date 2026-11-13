@echo off
setlocal enabledelayedexpansion
REM Add Windows Firewall exception for port 4000 (private and domain networks only, NOT public Wi-Fi)

echo Adding firewall rule for port 4000...

REM Run as admin
if not "%1"=="am_admin" (
    powershell -ex AllSigned -Command "Start-Process -Verb RunAs -FilePath '%0' -ArgumentList am_admin"
    exit /b
)

REM Add inbound rule (profile limited so the POS is not reachable from public networks)
netsh advfirewall firewall add rule name="Node.js POS - Port 4000" dir=in action=allow protocol=tcp localport=4000 profile=private,domain >nul 2>&1

if %errorlevel% equ 0 (
    echo Firewall rule added successfully!
    echo.
    set "LANIP="
    for /f "usebackq tokens=* delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*') -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LANIP=%%i"
    if not defined LANIP (
        echo Your phone should now be able to connect using this PC's
        echo network address on port 4000 — check the POS server window
        echo for the exact address ^(it prints "Network: http://...:4000"^).
    ) else (
        echo Your phone should now be able to connect to http://!LANIP!:4000
    )
    echo.
    echo NOTE: Windows must classify your Wi-Fi/LAN as "Private" for this rule to apply.
) else (
    echo Failed to add rule. Try running as Administrator manually:
    echo.
    echo netsh advfirewall firewall add rule name="Node.js POS" dir=in action=allow protocol=tcp localport=4000 profile=private,domain
)

pause
