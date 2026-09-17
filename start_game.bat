@echo off
chcp 65001 > nul
title Event Studio - Pasākumu Dzinējs
color 0A

echo ===================================================
echo       EVENT STUDIO TIEK PALAISTS...
echo ===================================================
echo.

:: 1. Atbrīvojam portus
echo [1/3] Pārbaudām un atbrīvojam tīkla portus...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":3000 .*LISTENING"') do if not "%%a"=="0" taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":5173 .*LISTENING"') do if not "%%a"=="0" taskkill /f /pid %%a >nul 2>&1

:: 2. Atrodam pareizo Backend mapi
set "API_DIR=%~dp0apps\api"
if not exist "%API_DIR%" set "API_DIR=%~dp0api"

:: 3. Atrodam pareizo Frontend mapi
set "CLIENT_DIR=%~dp0apps\client"
if not exist "%CLIENT_DIR%" set "CLIENT_DIR=%~dp0apps\web"
if not exist "%CLIENT_DIR%" set "CLIENT_DIR=%~dp0client"
if not exist "%CLIENT_DIR%" set "CLIENT_DIR=%~dp0web"

echo [2/3] Palaižam API no: %API_DIR%
start "Event_Studio_Backend" cmd /k "cd /d "%API_DIR%" && npm run dev"

echo [3/3] Palaižam Frontend no: %CLIENT_DIR%
start "Event_Studio_Frontend" cmd /k "cd /d "%CLIENT_DIR%" && npm run dev"

echo.
echo Gaidām 5 sekundes serveru startam...
timeout /t 5 /nobreak > nul

start http://localhost:5173/host

cls
echo ===================================================
echo             SPĒLE IR VEIKSMĪGI PALAISTA!
echo ===================================================
echo.
echo   Vadītāja panelis:        http://localhost:5173/host
echo   Dalībnieku pieslēgšanās: http://localhost:5173
echo.
echo ===================================================
echo  Lai APSTĀDINĀTU visus serverus un aizvērtu spēli:
echo  Nospied JEBKURU taustiņu šajā logā...
echo ===================================================
echo.

pause > nul

echo.
echo [i] Izslēdzam serverus...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":3000 .*LISTENING"') do if not "%%a"=="0" taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":5173 .*LISTENING"') do if not "%%a"=="0" taskkill /f /pid %%a >nul 2>&1
taskkill /fi "WINDOWTITLE eq Event_Studio_Backend*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Event_Studio_Frontend*" /f >nul 2>&1

echo [OK] Viss ir veiksmīgi aizvērts!
timeout /t 1 /nobreak > nul
exit