@echo off
setlocal
cd /d "%~dp0"

echo Stopping SS360 ERP app services...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-ss360.ps1"

echo.
pause
