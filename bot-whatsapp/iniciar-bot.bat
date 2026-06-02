@echo off
chcp 65001 >nul
title Bot WhatsApp - FiestaCobra
cd /d "%~dp0"

echo.
echo  ========================================
echo   Bot WhatsApp - FiestaCobra
echo  ========================================
echo.

REM Cargar PATH de Node (instalaciones comunes en Windows)
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro npm en el PATH.
    echo Instala Node.js o abri el bot desde una terminal donde npm funcione.
    echo.
    pause
    exit /b 1
)

REM Evitar dos bots a la vez (causa "no se pueden vincular nuevos dispositivos")
powershell -NoProfile -Command ^
  "$bots = Get-CimInstance Win32_Process -Filter \"name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*bot-whatsapp*index.js*' }; if ($bots) { Write-Host ''; Write-Host ' [AVISO] El bot YA esta corriendo.' -ForegroundColor Yellow; Write-Host ' Cerra la otra ventana (Cursor u otra CMD) antes de iniciar otro.' -ForegroundColor Yellow; Write-Host ''; $bots | ForEach-Object { Write-Host ('  PID: ' + $_.ProcessId) }; Write-Host ''; exit 1 }"

if errorlevel 1 (
    pause
    exit /b 1
)

REM Cerrar Chrome/Chromium huérfano de Puppeteer que bloquea la sesion
powershell -NoProfile -Command ^
  "$killed = 0; Get-CimInstance Win32_Process -Filter \"name='chrome.exe' OR name='chromium.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*wwebjs_auth*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $killed++ }; if ($killed -gt 0) { Write-Host (' Limpieza: ' + $killed + ' proceso(s) Chrome de sesion anterior cerrados.') -ForegroundColor Cyan }"

echo  Iniciando bot...
echo  (Si ya estaba vinculado, deberia reconectar sin QR nuevo)
echo.

call npm start

echo.
echo  El bot se detuvo.
pause
