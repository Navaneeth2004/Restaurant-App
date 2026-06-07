@echo off
title Restaurant POS

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "APP_ROOT=%%~fI"

start "" http://localhost:4000
cd /d "%APP_ROOT%\backend"
node server.js

pause