@echo off
setlocal enabledelayedexpansion
title Restaurant POS
color 0A
cls

echo.
echo  +==============================================+
echo  .   RESTAURANT POS  --  Starting up...        .
echo  +==============================================+
echo.

:: ── Locate project root (no pushd/popd — avoids creating junction files) ──
set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash from SCRIPT_DIR
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
:: APP_ROOT is one level up from the start\ folder
for %%I in ("%SCRIPT_DIR%\..") do set "APP_ROOT=%%~fI"
echo  [INFO] App root: %APP_ROOT%

:: ── Check Node.js ─────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Node.js not installed. Get it from nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK]  Node.js %NODE_VER%

:: ── Kill anything on port 4000 ────────────────────────────────────────────
echo  [...] Clearing port 4000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo  [OK]  Port cleared

:: ── Backend node_modules ──────────────────────────────────────────────────
echo  [...] Checking backend packages...
if not exist "%APP_ROOT%\backend\node_modules\express" (
    echo  [...] Installing backend packages...
    cd /d "%APP_ROOT%\backend"
    call npm install
    if errorlevel 1 (
        color 0C
        echo  [ERROR] Backend install failed.
        pause
        exit /b 1
    )
)
echo  [OK]  Backend ready

:: ── Frontend build ────────────────────────────────────────────────────────
echo  [...] Checking frontend build...
if not exist "%APP_ROOT%\frontend\build\index.html" (
    echo  [...] Building frontend...
    cd /d "%APP_ROOT%\frontend"
    if not exist "node_modules\.bin\react-scripts.cmd" (
        call npm install --legacy-peer-deps
        if errorlevel 1 (
            color 0C
            echo  [ERROR] Frontend npm install failed.
            pause
            exit /b 1
        )
    )
    call npm run build
    if errorlevel 1 (
        color 0C
        echo  [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
)
echo  [OK]  Frontend ready

:: ── Get local IP ─────────────────────────────────────────────────────────
set "LOCAL_IP=unknown"
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /i "IPv4"') do (
    set "RAW=%%I"
    set "RAW=!RAW: =!"
    if not "!RAW!"=="127.0.0.1" if "!LOCAL_IP!"=="unknown" set "LOCAL_IP=!RAW!"
)

:: ── Banner ────────────────────────────────────────────────────────────────
echo.
echo  +==============================================+
echo  .                                             .
echo  .   >>  POS IS LIVE -- Ready for orders!      .
echo  .                                             .
echo  +----------------------------------------------+
echo  .                                             .
echo  .   This PC   :  http://localhost:4000        .
echo  .   Network   :  http://%LOCAL_IP%:4000
echo  .   Easy URL  :  http://restaurant.local:4000 .
echo  .                                             .
echo  +----------------------------------------------+
echo  .                                             .
echo  .   !! KEEP THIS WINDOW OPEN !!               .
echo  .      Closing it shuts down the POS.         .
echo  .                                             .
echo  +==============================================+
echo.
echo  ----------------  Server Log (safe to ignore)  ----------------
echo.

:: ── Open browser ─────────────────────────────────────────────────────────
start http://localhost:4000

:: ── Start server ─────────────────────────────────────────────────────────
cd /d "%APP_ROOT%\backend"
echo  [...] Starting server...
node server.js
set NODE_EXIT=%errorlevel%

:: ── If we reach here, server has stopped ─────────────────────────────────
echo.
color 0C
echo  +==============================================+
echo  .   SERVER STOPPED  (exit code: %NODE_EXIT%)
echo  .   Check the log above for error details.    .
echo  +==============================================+
echo.
color 07
pause