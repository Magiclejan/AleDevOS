@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title AleDevOS - Comprobar runtimes

echo ============================================================
echo AleDevOS - COMPROBAR RUNTIMES REALES
echo ============================================================
echo Esto crea targets desechables dentro de .aledevos\state y prueba:
echo   - OpenCode
 echo   - Codex
 echo   - Claude Code
 echo   - Antigravity
 echo.
echo No instala AleDevOS en tus proyectos reales.
echo Un runtime no instalado/no autenticado quedara BLOCKED; eso es normal.
echo.
choice /C SN /N /M "Continuar [S/N]? "
if errorlevel 2 exit /b 0

echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\53-master-validation-p2-target-adapters.ps1"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [OK] P2 de runtimes completo.
) else if "%RC%"=="4" (
  echo [PENDIENTE] Uno o mas runtimes quedaron BLOCKED. No es un error del launcher.
) else (
  echo [ERROR] La comprobacion termino con codigo %RC%.
)
echo.
pause
exit /b %RC%
