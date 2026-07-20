@echo off
title JapAI - Japanese Grammar Practice

echo.
echo   ==============================
echo     JapAI - Grammar Practice
echo   ==============================
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Python not found.
    echo   Please install Python 3.9+ from https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo   Python: %%i
echo.

REM Install dependencies
echo   [1/2] Installing dependencies...
pip install -r requirements.txt -q 2>nul
echo   Done.
echo.

REM Start server and open browser
echo   [2/2] Starting server...
echo   URL: http://127.0.0.1:5000
echo   Press Ctrl+C to stop
echo   ==============================
echo.

REM Open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:5000"

python app.py
pause
