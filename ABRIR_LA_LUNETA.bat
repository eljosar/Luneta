@echo off
title La Luneta - Prototipo Web
cd /d "%~dp0"
echo Iniciando La Luneta en http://localhost:8765 ...
start "" http://localhost:8765
py serve.py
pause
