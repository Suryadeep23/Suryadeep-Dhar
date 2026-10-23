@echo off
setlocal enabledelayedexpansion

echo =========================================================
echo    The Helping Squad - Document Vault Standalone Installer
echo =========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js (version 18 or newer) from:
    echo https://nodejs.org/
    echo.
    echo After installing Node.js, run this installer again.
    pause
    exit /b 1
)

echo [1/4] Checking Node.js environment...
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo Detected Node.js: %NODE_VER%
echo.

echo [2/4] Installing application dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [WARNING] npm install reported warnings or errors. Trying to proceed...
)
echo Dependencies ready!
echo.

echo [3/4] Creating Desktop Shortcut...
set DESKTOP_DIR=%USERPROFILE%\Desktop
set SHORTCUT_FILE=%DESKTOP_DIR%\The Helping Squad Vault.url

(
echo [InternetShortcut]
echo URL=http://localhost:3000
echo IconIndex=0
echo IconFile=%~dp0public\favicon.ico
) > "%SHORTCUT_FILE%"

echo Shortcut created on your Desktop:
echo "%SHORTCUT_FILE%"
echo.

echo [4/4] Starting The Helping Squad Vault Server...
echo The Vault is opening in your default web browser at http://localhost:3000
echo You can also install it as a standalone app using the "Install App" button inside the UI!
echo.

start http://localhost:3000
call npm start

pause
