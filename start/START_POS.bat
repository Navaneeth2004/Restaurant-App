@echo off
setlocal enabledelayedexpansion
title Restaurant APP — Launcher
color 0A

echo.
echo  ==========================================
echo    Restaurant APP — Starting up...
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
    echo  [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: ── Setup ────────────────────────────────────────────────────────────────
set APP_ROOT=%~dp0..
cd /d "%APP_ROOT%"

if not exist "backend\node_modules" (
    echo  [SETUP] Backend packages...
    cd backend
    call npm install >nul 2>&1
    if !errorlevel! neq 0 (
        echo  [ERROR] Backend install failed
        pause
        exit /b 1
    )
    cd ..
)

if not exist "frontend\build" (
    echo  [SETUP] Frontend build...
    cd frontend
    if not exist "node_modules" call npm install >nul 2>&1
    call npm run build >nul 2>&1
    if !errorlevel! neq 0 (
        echo  [ERROR] Frontend build failed
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

echo  [OK] All ready
echo.

:: ── Get IP ───────────────────────────────────────────────────────────────
set LOCAL_IP=localhost
for /f "tokens=2 delims=:" %%a in ('ipconfig 2^>nul ^| findstr /R "IPv4.*192\."') do set LOCAL_IP=%%a&goto :got_ip
for /f "tokens=2 delims=:" %%a in ('ipconfig 2^>nul ^| findstr /R "IPv4.*10\."') do set LOCAL_IP=%%a&goto :got_ip
:got_ip
set LOCAL_IP=%LOCAL_IP:~1%

:: ── Start server ─────────────────────────────────────────────────────────
echo  [START] Server starting...

REM Create a temp batch file to start the server in the backend folder
set BACKEND_PATH=%APP_ROOT%\backend
(
    echo @echo off
    echo cd /d "%BACKEND_PATH%"
    echo node server.js
) > "%temp%\start_server.bat"

start "POS Server" cmd /k "%temp%\start_server.bat"

timeout /t 2 /nobreak >nul

echo.
echo  ==========================================
echo.
echo   ✓ POS is running!
echo.
echo   Local:   http://localhost:4000
echo   Network: http://%LOCAL_IP%:4000
echo.
echo  ==========================================
echo.

start http://localhost:4000
timeout /t 2 /nobreak >nul
