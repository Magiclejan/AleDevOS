@echo off
setlocal
rem AleDevOS runtime/tooling inventory. CLI availability is diagnostic, not release PASS.
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\00-check-pc.ps1"
set "ALEDEVOS_CHECK_EXIT=%ERRORLEVEL%"
endlocal & exit /b %ALEDEVOS_CHECK_EXIT%
