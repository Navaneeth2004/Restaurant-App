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
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found in PATH
    echo  Install from https://nodejs.org ^(LTS^)
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: ── Kill anything on port 4000 ────────────────────────────────────────────
echo  [INFO] Clearing port 4000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: ── Backend node_modules ──────────────────────────────────────────────────
:: Check that the actual server entry point exists, not just the folder
if not exist "%APP_ROOT%\backend\node_modules\express" (
    echo  [SETUP] Installing backend packages...
    cd /d "%APP_ROOT%\backend"
    if exist node_modules rmdir /s /q node_modules >nul 2>&1
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Backend install failed.
        pause
        exit /b 1
    )
    echo  [OK] Backend packages installed
) else (
    echo  [OK] Backend packages ready
)

:: ── Frontend build ────────────────────────────────────────────────────────
:: Check the actual build output file exists, not just the folder
if not exist "%APP_ROOT%\frontend\build\index.html" (
    echo  [SETUP] Building frontend...
    cd /d "%APP_ROOT%\frontend"

    :: Check react-scripts is installed — if not, reinstall everything
    if not exist "node_modules\.bin\react-scripts.cmd" (
        echo  [SETUP] Installing frontend packages...
        if exist node_modules rmdir /s /q node_modules >nul 2>&1
        call npm install --legacy-peer-deps
        if errorlevel 1 (
            echo  [ERROR] Frontend npm install failed.
            echo  Please run BUILD_FOR_RESTAURANT.bat first.
            pause
            exit /b 1
        )
    )

    call npm run build
    if errorlevel 1 (
        echo  [ERROR] Frontend build failed.
        echo  Please run BUILD_FOR_RESTAURANT.bat first.
        pause
        exit /b 1
    )
    echo  [OK] Frontend built
) else (
    echo  [OK] Frontend build ready
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

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:4000"

cd /d "%APP_ROOT%\backend"
node server.js

echo.
echo  Server has stopped. Press any key to close.
pause