@echo off
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
"C:\Program Files\nodejs\node.exe" bot.mjs 1>>"%~dp0logs\house-guide.log" 2>>&1
