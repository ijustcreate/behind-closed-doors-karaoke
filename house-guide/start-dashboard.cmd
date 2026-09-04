@echo off
setlocal
cd /d "%~dp0"
start "BCD Bot Dashboard" http://127.0.0.1:3434
"C:\Program Files\nodejs\node.exe" dashboard.mjs
