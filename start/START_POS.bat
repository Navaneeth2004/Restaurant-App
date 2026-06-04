@echo off
title Restaurant POS
color 0A

echo.
echo  ==========================================
echo    Restaurant POS -- Starting up...
echo  ==========================================
echo.

:: ── Locate project root ───────────────────────────────────────────────────
set "SCRIPT_DIR=%~dp0"
set "APP_ROOT=%SCRIPT_DIR%.."
pushd "%APP_ROOT%"
set "APP_ROOT=%CD%"
popd
echo  [INFO] App root: %APP_ROOT%

:: ── Check Node.js ─────────────────────────────────────────────────────────
echo  [DEBUG] Checking for node...
where node >nul 2>&1
echo  [DEBUG] where node errorlevel: %errorlevel%
if errorlevel 1 (
    echo  [ERROR] Node.js not found in PATH
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: ── Kill anything on port 4000 ────────────────────────────────────────────
echo  [DEBUG] Clearing port 4000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo  [DEBUG] Port cleared

:: ── Backend node_modules ──────────────────────────────────────────────────
echo  [DEBUG] Checking backend node_modules...
if not exist "%APP_ROOT%\backend\node_modules" (
    echo  [SETUP] Installing backend packages...
    cd /d "%APP_ROOT%\backend"
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Backend install failed.
        pause
        exit /b 1
    )
    echo  [OK] Backend packages installed
) else (
    echo  [DEBUG] node_modules exists, skipping install
)

:: ── Frontend build ────────────────────────────────────────────────────────
echo  [DEBUG] Checking frontend build...
if not exist "%APP_ROOT%\frontend\build" (
    echo  [SETUP] Building frontend...
    cd /d "%APP_ROOT%\frontend"
    if not exist "node_modules" (
        call npm install --legacy-peer-deps
        if errorlevel 1 (
            echo  [ERROR] Frontend npm install failed.
            pause
            exit /b 1
        )
    )
    call npm run build
    if errorlevel 1 (
        echo  [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
    echo  [OK] Frontend built
) else (
    echo  [DEBUG] build folder exists, skipping build
)

echo  [OK] All ready
echo.

:: ── Get local IP ─────────────────────────────────────────────────────────
set "LOCAL_IP=unknown"
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /i "IPv4"') do set "LOCAL_IP=%%I"
set "LOCAL_IP=%LOCAL_IP: =%"

echo  ==========================================
echo.
echo   POS is RUNNING!
echo.
echo   This computer:  http://localhost:4000
echo   Phones/tablets: http://%LOCAL_IP%:4000
echo.
echo   Keep this window open.
echo   Close it to shut down.
echo.
echo  ==========================================
echo.

echo  [DEBUG] About to start browser...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:4000"

echo  [DEBUG] About to run node server.js from %APP_ROOT%\backend
cd /d "%APP_ROOT%\backend"
echo  [DEBUG] Current dir: %CD%
node server.js

echo.
echo  Server has stopped. Press any key to close.
pause