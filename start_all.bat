@echo off
title XAI-CropInsure Launcher
cd /d "%~dp0"

echo =====================================================================
echo    XAI-CropInsure: Explainable AI for Transparent Crop Insurance
echo =====================================================================
echo [1/3] Launching Backend Server in new window...
start "XAI-CropInsure Backend" cmd /c "%~dp0start_backend.bat"

echo [2/3] Waiting 4 seconds for backend initialization...
timeout /t 4 /nobreak > nul

echo [3/3] Launching Frontend Server in new window...
start "XAI-CropInsure Frontend" cmd /c "%~dp0start_frontend.bat"

echo.
echo =====================================================================
echo  Application is running!
echo  - Frontend Dashboard: http://localhost:5173
echo  - Backend API Docs:   http://127.0.0.1:8000/api/docs
echo =====================================================================
echo Opening browser...
start http://localhost:5173

