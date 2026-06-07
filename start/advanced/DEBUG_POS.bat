@echo off
setlocal enabledelayedexpansion
title POS DEBUG
cls

echo =============================================
echo  POS DEBUG - will pause at each step
echo =============================================
echo.
pause

echo STEP 1: Finding app root...
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..\..") do set "APP_ROOT=%%~fI"
echo App root = [%APP_ROOT%]
pause

echo STEP 2: Checking Node.js...
where node
echo errorlevel = %errorlevel%
node -v
pause

echo STEP 3: Checking backend folder...
echo Looking for: %APP_ROOT%\backend\node_modules\express
if exist "%APP_ROOT%\backend\node_modules\express" (
    echo FOUND - backend ready
) else (
    echo NOT FOUND - would need npm install
)
pause

echo STEP 4: Checking frontend build...
echo Looking for: %APP_ROOT%\frontend\build\index.html
if exist "%APP_ROOT%\frontend\build\index.html" (
    echo FOUND - frontend ready
) else (
    echo NOT FOUND - would need to build
)
pause

echo STEP 5: Starting server...
cd /d "%APP_ROOT%\backend"
echo Current dir: %CD%
echo Running: node server.js
echo.
node server.js
echo.
echo Server exited with code: %errorlevel%
pause