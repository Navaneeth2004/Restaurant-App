@echo off
setlocal enabledelayedexpansion
title Restaurant POS

REM ── Resolve paths ───────────────────────────────────────────────────────
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "APP_ROOT=%%~fI"

REM ── Pre-flight checks ───────────────────────────────────────────────────
if not exist "%APP_ROOT%\backend\node_modules\express" (
    echo.
    echo  [ERROR] Backend packages not found.
    echo  Run BUILD_FOR_RESTAURANT.bat on the developer computer first,
    echo  then copy the whole project folder here.
    echo.
    pause
    exit /b 1
)
if not exist "%APP_ROOT%\frontend\build\index.html" (
    echo.
    echo  [ERROR] Frontend has not been built.
    echo  Run BUILD_FOR_RESTAURANT.bat on the developer computer first,
    echo  then copy the whole project folder here.
    echo.
    pause
    exit /b 1
)

REM ── Clear a stale server from a previous crash/close ───────────────────
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo  [CLEANUP] Stopping a previous POS server still using port 4000...
    taskkill /PID %%p /F >nul 2>&1
)

echo.
echo  ==========================================
echo    Restaurant POS — Starting up...
echo  ==========================================
echo.

REM ── Launch background browser trigger once port 4000 responds ────────────
start /b powershell -NoProfile -Command "$w=0; while($w -lt 30){ if(Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue -InformationLevel Quiet){ Start-Process 'http://localhost:4000'; break }; Start-Sleep -Seconds 1; $w++ }"

REM ── Run sleep prevention + Node server in THIS same window ────────────────
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\keep_awake.ps1" -BackendDir "%APP_ROOT%\backend"