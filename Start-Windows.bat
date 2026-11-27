@echo off
cd /d "%~dp0"
title Audio-Visualisierung Server
set PORT=8781
where py >nul 2>nul && (set PY=py) || (where python >nul 2>nul && (set PY=python) || (
  echo Python wurde nicht gefunden. Bitte von https://www.python.org/downloads/ installieren
  echo und dabei "Add Python to PATH" anhaken.
  pause
  exit /b 1
))
echo Server laeuft auf http://localhost:%PORT%  - dieses Fenster zum Beenden schliessen.
start "" "http://localhost:%PORT%/index.html"
%PY% -m http.server %PORT%
pause
