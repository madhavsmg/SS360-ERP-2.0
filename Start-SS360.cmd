@echo off
setlocal
cd /d "%~dp0"

echo Starting SS360 ERP full-stack system...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-ss360.ps1"

echo.
pause
