@echo off
chcp 65001 > nul
title Viktorīnas Vadības Panelis
color 0A

echo ===================================================
echo       VIKTORĪNA "IZSKATIES DZIRDĒTS" TIEK PALAISTA...
echo ===================================================
echo.

:: 1. Atbrīvojam portus 3000 un 5173, ja tie iepriekš palikuši aizņemti
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /f /pid %%a >nul 2>&1

:: 2. Palaižam API / Backend (ports 3000)
echo [1/3] Palaižam API serveri...
start "Backend_API" /min cmd /c "cd /d C:\Users\prata\Desktop\Izskaties-Dzirdets\apps\api && npm run dev"

:: 3. Palaižam Web / Frontend (ports 5173)
echo [2/3] Palaižam Web interfeisu...
start "Frontend_WEB" /min cmd /c "cd /d C:\Users\prata\Desktop\Izskaties-Dzirdets\apps\web && npm run dev"

:: 4. Nogaidām 3 sekundes, kamēr serveri sāk darboties
echo [3/3] Inicializējam vidi...
timeout /t 3 /nobreak > nul

:: 5. Automātiski atveram vadītāja paneli pārlūkā
start http://localhost:5173/host

cls
echo ===================================================
echo             SPĒLE IR VEIKSMĪGI PALAISTA!
echo ===================================================
echo.
echo   Vadītāja panelis:       http://localhost:5173/host
echo   Dalībnieku pieslēgšanās: http://localhost:5173
echo.
echo ===================================================
echo  Lai APSTĀDINĀTU visus serverus un aizvērtu spēli:
echo  Nospied JEBKURU taustiņu šajā logā...
echo ===================================================
echo.

pause > nul

echo.
echo [i] Izslēdzam serverus un atbrīvojam atmiņu...

:: Apturam fonā palaistos procesus un atbrīvojam portus
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /f /pid %%a >nul 2>&1
taskkill /fi "WINDOWTITLE eq Backend_API*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Frontend_WEB*" /f >nul 2>&1

echo [OK] Viss ir veiksmīgi un tīri aizvērts!
timeout /t 1 /nobreak > nul
exit