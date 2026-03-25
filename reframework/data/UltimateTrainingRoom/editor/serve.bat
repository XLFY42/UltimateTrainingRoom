@echo off
chcp 65001 >nul 2>nul
echo ========================================
echo   v3.html Local Test Server
echo ========================================
echo.
echo Starting HTTP server...
echo Press Ctrl+C to stop.
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:8000/v3.html
    python -m http.server 8000
    goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:3000/v3.html
    npx serve -l 3000 .
    goto :eof
)

echo ERROR: Python or Node.js not found.
echo Install one of them:
echo   Python:  https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
pause
