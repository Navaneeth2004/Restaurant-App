@echo off
setlocal enabledelayedexpansion
title Build Restaurant POS
color 0B

echo.
echo  ==========================================
echo    Restaurant APP POS — Build for Deployment
echo  ==========================================
echo.
echo  Run this on YOUR computer (not the
echo  restaurant computer) after cloning from
echo  GitHub or whenever you update the code.
echo.

set APP_ROOT=%~dp0..\..\
cd /d "%APP_ROOT%"

:: ── Check Node ────────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Install from https://nodejs.org ^(LTS^)
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: ── Check / install Windows build tools (needed for better-sqlite3) ───────
echo  [CHECK] Looking for Windows C++ build tools...

:: Simpler check: try to find cl.exe (MSVC compiler)
where cl.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] C++ build tools found
    goto :build_tools_ok
)

:: Check for VS Build Tools via registry
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio" >nul 2>&1
if %errorlevel% equ 0 goto :build_tools_ok
reg query "HKLM\SOFTWARE\Microsoft\VSWin" >nul 2>&1
if %errorlevel% equ 0 goto :build_tools_ok
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio" >nul 2>&1
if %errorlevel% equ 0 goto :build_tools_ok

:: Not found — install them
echo.
echo  [SETUP] Windows C++ build tools not found.
echo          These are required to compile better-sqlite3.
echo          Installing now via npm (this takes 2-5 minutes)...
echo.
echo          NOTE: If prompted by UAC, click Yes.
echo.

:: Check if we're running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Requesting administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

call npm install --global windows-build-tools 2>&1
if !errorlevel! neq 0 (
    echo.
    echo  [WARN] windows-build-tools install may have had issues.
    echo         If the build fails below, please install manually:
    echo         1. Go to https://visualstudio.microsoft.com/downloads/
    echo         2. Download "Visual Studio Community" (free^)
    echo         3. During install check "Desktop development with C++"
    echo         4. Re-run this script
    echo.
    timeout /t 3 /nobreak >nul
)
echo  [OK] Build tools setup complete

:build_tools_ok

:: ── Backend deps ──────────────────────────────────────────────────────────
echo  [1/3] Installing backend packages...
cd backend
call npm install
if !errorlevel! neq 0 (
    echo.
    echo  [ERROR] Backend install failed.
    echo.
    echo  Most likely cause: C++ build tools missing for better-sqlite3.
    echo  Fix:
    echo    1. Open PowerShell as Administrator
    echo    2. Run: npm install --global windows-build-tools
    echo    3. Wait for it to finish (2-5 minutes^)
    echo    4. Re-run this script
    echo.
    pause & exit /b 1
)
cd ..
echo  [OK] Backend packages ready

:: ── Frontend deps + build ─────────────────────────────────────────────────
echo  [2/3] Installing frontend packages...
cd frontend
call npm install --legacy-peer-deps
if !errorlevel! neq 0 (
    echo  [ERROR] Frontend npm install failed.
    pause & cd .. & exit /b 1
)

echo  [3/3] Building frontend ^(1-2 minutes^)...
if exist build rmdir /s /q build >nul 2>&1
call npm run build
if !errorlevel! neq 0 (
    echo  [ERROR] Frontend build failed.
    pause & cd .. & exit /b 1
)
cd ..
echo  [OK] Frontend built

echo.
echo  ==========================================
echo.
echo   DONE! The folder is ready to deploy.
echo.
echo   Copy the whole project folder to the
echo   restaurant PC ^(USB or Google Drive^),
echo   then run:  start\START_POS.bat
echo.
echo   The restaurant PC only needs Node.js.
echo   No npm, no build step needed there.
echo.
echo  ==========================================
echo.
pause