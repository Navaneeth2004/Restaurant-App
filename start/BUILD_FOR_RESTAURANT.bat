@echo off
setlocal enabledelayedexpansion
title Build Restaurant POS
color 0B

echo.
echo  ==========================================
echo    Restaurant POS — Build for Deployment
echo  ==========================================
echo.
echo  Run this on YOUR computer (not the
echo  restaurant computer) after cloning from
echo  GitHub or whenever you update the code.
echo.

set APP_ROOT=%~dp0..
cd /d "%APP_ROOT%"

:: Check Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Install from https://nodejs.org ^(LTS^)
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: Backend deps
echo  [1/3] Installing backend packages...
cd backend
call npm install >nul 2>&1
if !errorlevel! neq 0 ( echo  [ERROR] Backend install failed & pause & exit /b 1 )
cd ..
echo  [OK] Backend packages ready

:: Frontend deps
echo  [2/3] Installing frontend packages...
cd frontend
call npm install --legacy-peer-deps >nul 2>&1
if !errorlevel! neq 0 ( echo  [ERROR] Frontend install failed & pause & cd .. & exit /b 1 )

:: Frontend build — always rebuild to pick up any code changes
echo  [3/3] Building frontend ^(1-2 minutes^)...
if exist build rmdir /s /q build >nul 2>&1
call npm run build >nul 2>&1
if !errorlevel! neq 0 ( echo  [ERROR] Frontend build failed & pause & cd .. & exit /b 1 )
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
