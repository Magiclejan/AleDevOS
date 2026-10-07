@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title AleDevOS - Campana Final

cls
echo ============================================================
echo AleDevOS - CAMPANA FINAL 33/33
echo ============================================================
echo Usa esta opcion SOLO cuando los perfiles target P3-P8 ya existan.
echo Si aun estamos preparando la campana, usa primero las opciones 1 y 2.
echo.
set "CAMPAIGN="
set /p "CAMPAIGN=Ruta del JSON de campana final: "
set "CAMPAIGN=%CAMPAIGN:"=%"
if not defined CAMPAIGN (
  echo [CANCELADO] No se indico campana.
  pause
  exit /b 0
)
if not exist "%CAMPAIGN%" (
  echo [ERROR] No existe: "%CAMPAIGN%"
  echo Plantilla de referencia:
  echo   release\templates\FINAL_MASTER_CAMPAIGN.example.json
  pause
  exit /b 2
)

echo.
choice /C SN /N /M "Ejecutar la campana completa y permitir FREEZE solo si llega a 33/33 [S/N]? "
if errorlevel 2 exit /b 0

echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\67-final-master-gate.ps1" -Campaign "%CAMPAIGN%"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [OK] Campana final completada. Revisa el Freeze Certificate mostrado arriba.
) else if "%RC%"=="4" (
  echo [PENDIENTE] Master Gate BLOCKED. No se emitio Freeze Certificate.
) else (
  echo [ERROR] Campana final terminada con codigo %RC%.
)
echo.
pause
exit /b %RC%
