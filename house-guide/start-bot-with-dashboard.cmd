@echo off
setlocal
cd /d "%~dp0"
start "BCD Bot Dashboard" /min "C:\Program Files\nodejs\node.exe" dashboard.mjs
"C:\Program Files\nodejs\node.exe" bot.mjs
