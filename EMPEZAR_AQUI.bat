@echo off
setlocal
set "ALEDEVOS_LAUNCH_CWD=%CD%"
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\70-aledevos-app.ps1"
endlocal
