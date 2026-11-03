@echo off
title XAI-CropInsure Backend Server
cd /d "%~dp0\.."

echo =====================================================================
echo  Starting XAI-CropInsure Backend Server (FastAPI + ML + SHAP)
echo =====================================================================

if not exist "backend\.venv\Scripts\python.exe" (
    echo [INFO] Virtual environment not found in backend\.venv. Creating...
    python -m venv backend\.venv
    backend\.venv\Scripts\pip install -r backend\requirements.txt
)

if not exist "data\xai_cropinsure.db" (
    echo [INFO] Initialising database and training baseline model...
    backend\.venv\Scripts\python.exe scripts\initialise_database.py
)

echo [INFO] Starting FastAPI server on http://127.0.0.1:8000 ...
echo [INFO] API Documentation: http://127.0.0.1:8000/docs and http://127.0.0.1:8000/api/docs
backend\.venv\Scripts\uvicorn.exe backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause

