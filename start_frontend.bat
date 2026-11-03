@echo off
title XAI-CropInsure Frontend Dev Server
cd /d "%~dp0\frontend"

echo =====================================================================
echo  Starting XAI-CropInsure Frontend (React + Vite + Tailwind CSS)
echo =====================================================================

if not exist "node_modules" (
    echo [INFO] node_modules not found. Running npm install...
    call npm install
)

echo [INFO] Launching Vite development server on http://localhost:5173 ...
call npm run dev
pause

