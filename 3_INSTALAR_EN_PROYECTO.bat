@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title AleDevOS - Instalador guiado

cls
echo ============================================================
echo AleDevOS - INSTALADOR GUIADO
echo ============================================================
echo Recomendacion antes del freeze: usa primero un proyecto SANDBOX.
echo.
set "PROJECT="
set /p "PROJECT=Ruta completa del proyecto: "
set "PROJECT=%PROJECT:"=%"
if not defined PROJECT (
  echo [CANCELADO] No se indico ninguna ruta.
  pause
  exit /b 0
)
if not exist "%PROJECT%\." (
  echo [ERROR] La carpeta no existe: "%PROJECT%"
  pause
  exit /b 2
)

echo.
echo Elige adapter:
echo   1. Codex
echo   2. Claude Code
echo   3. OpenCode
echo   4. Antigravity
echo   5. Gemini ^(alias - instala Antigravity^)
echo   6. Cancelar
choice /C 123456 /N /M "Adapter [1-6]: "
set "SEL=%ERRORLEVEL%"
if "%SEL%"=="6" exit /b 0
if "%SEL%"=="5" set "ADAPTER=gemini"
if "%SEL%"=="4" set "ADAPTER=antigravity"
if "%SEL%"=="3" set "ADAPTER=opencode"
if "%SEL%"=="2" set "ADAPTER=claude-code"
if "%SEL%"=="1" set "ADAPTER=codex"

echo.
echo Proyecto : "%PROJECT%"
echo Adapter  : %ADAPTER%
echo.
choice /C SN /N /M "Si existen archivos AleDevOS, permitir backup y reemplazo con -Force [S/N]? "
set "FORCE="
if "%ERRORLEVEL%"=="1" set "FORCE=-Force"

echo.
echo Instalando...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\05-install-into-project.ps1" -ProjectPath "%PROJECT%" -Adapter "%ADAPTER%" %FORCE%
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [OK] AleDevOS instalado en "%PROJECT%" con adapter %ADAPTER%.
) else (
  echo [ERROR] Instalacion terminada con codigo %RC%.
)
echo.
pause
exit /b %RC%
