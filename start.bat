@echo off
echo ======================================
echo   Weather Pulse - Starting Server
echo ======================================
echo.

cd backend

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    echo.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate

REM Check if .env file exists
if not exist ".env" (
    echo WARNING: .env file not found!
    echo Please copy .env.example to .env and add your API key.
    echo.
    pause
    exit /b 1
)

REM Install/update dependencies
echo Installing dependencies...
pip install -q -r requirements.txt

echo.
echo ======================================
echo   Server starting on http://localhost:5000
echo   Press Ctrl+C to stop the server
echo ======================================
echo.

REM Start Flask application
python app.py
