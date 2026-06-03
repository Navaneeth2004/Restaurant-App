@echo off
setlocal enabledelayedexpansion
title Restaurant POS
color 0A

echo.
echo  ==========================================
echo    Restaurant POS — Starting up...
echo  ==========================================
echo.

:: ── Kill any process on port 4000 ─────────────────────────────────────────
echo  [CLEANUP] Clearing port 4000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :4000') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: ── Check Node.js ────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is not installed!
    echo.
    echo  Please install Node.js from:
    echo    https://nodejs.org
    echo.
    echo  Choose the LTS version ^(e.g. v20^).
    echo  After installing, restart this file.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: ── Setup ────────────────────────────────────────────────────────────────
set APP_ROOT=%~dp0..
cd /d "%APP_ROOT%"

:: Backend: install only if node_modules missing
if not exist "backend\node_modules" (
    echo  [SETUP] Installing backend packages (first run only)...
    cd backend
    call npm install >nul 2>&1
    if !errorlevel! neq 0 (
        echo  [ERROR] Backend install failed. Check internet connection.
        pause & exit /b 1
    )
    cd ..
    echo  [OK] Backend packages installed
)

:: Frontend: build only if no build folder
if not exist "frontend\build" (
    echo  [SETUP] Building frontend (first run — takes 1-2 minutes)...
    cd frontend
    if not exist "node_modules" (
        call npm install --legacy-peer-deps >nul 2>&1
    )
    call npm run build >nul 2>&1
    if !errorlevel! neq 0 (
        echo  [ERROR] Frontend build failed.
        cd ..
        pause & exit /b 1
    )
    cd ..
    echo  [OK] Frontend built
)

echo  [OK] All ready
echo.

:: ── Get local IP ─────────────────────────────────────────────────────────
set LOCAL_IP=localhost
for /f "tokens=2 delims=:" %%a in ('ipconfig 2^>nul ^| findstr /R "IPv4.*192\."') do (set LOCAL_IP=%%a & goto :got_ip)
for /f "tokens=2 delims=:" %%a in ('ipconfig 2^>nul ^| findstr /R "IPv4.*10\."')  do (set LOCAL_IP=%%a & goto :got_ip)
for /f "tokens=2 delims=:" %%a in ('ipconfig 2^>nul ^| findstr /R "IPv4.*172\."') do (set LOCAL_IP=%%a & goto :got_ip)
:got_ip
set LOCAL_IP=%LOCAL_IP:~1%

:: ── Print info ───────────────────────────────────────────────────────────
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

:: Open browser
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:4000"

:: Start server (foreground — window stays open)
cd /d "%APP_ROOT%\backend"
node server.js
