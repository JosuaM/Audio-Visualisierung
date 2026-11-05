#!/bin/bash
cd "$(dirname "$0")"
PORT=8781
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else
  echo "Python wurde nicht gefunden. Bitte von https://www.python.org/downloads/ installieren."
  read -n 1 -s -r -p "Taste druecken zum Beenden"; exit 1
fi
echo "Server laeuft auf http://localhost:$PORT - dieses Fenster zum Beenden schliessen (oder Strg+C)."
(sleep 1; open "http://localhost:$PORT/index.html") &
$PY -m http.server $PORT
