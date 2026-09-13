@echo off
setlocal enabledelayedexpansion
title Update Restaurant POS
color 0B

echo.
echo  ==========================================
echo    Restaurant POS — Update from GitHub
echo  ==========================================
echo.
echo  This will download the latest version of
echo  the app from GitHub and rebuild it.
echo.
echo  Your data (menu, orders, staff) is stored
echo  in backend\data\ and will NOT be touched.
echo.
set /p CONFIRM="Continue? (Y/N): "
if /i "%CONFIRM%" neq "Y" (
    echo  Update cancelled.
    pause
    exit /b 0
)

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..\..") do set "APP_ROOT=%%~fI"

echo.
echo  [1/6] Stopping any running POS server...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)
echo  [OK] Port 4000 is clear

echo  [2/6] Checking for git...
where git >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Git not found. Install from https://git-scm.com
    pause
    exit /b 1
)
echo  [OK] Git found

echo  [3/6] Backing up your data...
if not exist "%APP_ROOT%\backend\data" (
    echo  [INFO] No data folder found yet — nothing to backup
) else (
    if not exist "%APP_ROOT%\backups" mkdir "%APP_ROOT%\backups"
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set TODAY=%%c-%%a-%%b
    xcopy "%APP_ROOT%\backend\data" "%APP_ROOT%\backups\data_%TODAY%" /E /I /Q >nul 2>&1
    echo  [OK] Data backed up to backups\data_%TODAY%
)

echo  [4/6] Pulling latest code from GitHub...
cd /d "%APP_ROOT%"
git pull origin main
if errorlevel 1 (
    echo.
    echo  [ERROR] Git pull failed. Possible reasons:
    echo    - No internet connection
    echo    - You have local changes conflicting with the update
    echo    - The remote branch name is different (try: git pull origin master)
    echo.
    pause
    exit /b 1
)
echo  [OK] Code updated

echo  [5/6] Installing backend packages...
cd /d "%APP_ROOT%\backend"
call npm install
if errorlevel 1 (
    echo  [ERROR] Backend install failed.
    pause
    exit /b 1
)
echo  [OK] Backend packages ready

echo  [6/6] Building frontend...
cd /d "%APP_ROOT%\frontend"
if exist build rmdir /s /q build >nul 2>&1
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo  [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo  [ERROR] Frontend build failed.
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo.
echo   UPDATE COMPLETE!
echo.
echo   Run start\START_POS.bat to launch the
echo   updated app.
echo.
echo   Your data is safe in backend\data\
echo   Backup saved to backups\ (if any existed)
echo.
echo  ==========================================
echo.
pause