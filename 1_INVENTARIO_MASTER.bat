@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title AleDevOS - Estado Master

echo ============================================================
echo AleDevOS - ESTADO MASTER
echo ============================================================
echo Esto NO ejecuta pruebas target ni congela V1.
echo Solo muestra que evidencias existen y que checks siguen pendientes.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\67-final-master-gate.ps1" -InventoryOnly
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [OK] Inventario completado.
) else (
  echo [AVISO] El inventario termino con codigo %RC%.
)
echo.
pause
exit /b %RC%
