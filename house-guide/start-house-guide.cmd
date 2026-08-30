@echo off
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
set "OLLAMA_MODELS=C:\Users\17148\.ollama\models"
set "OLLAMA_HOST=127.0.0.1:11434"
"C:\Users\17148\AppData\Local\Programs\Ollama\ollama.exe" serve 1>>"%~dp0logs\ollama.log" 2>>&1
