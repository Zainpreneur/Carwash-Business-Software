@echo off
cd /d "%~dp0"
echo ============================================
echo  Car Wash Business Software - One-Command Run
echo ============================================
echo.
call npm.cmd run start
if errorlevel 1 (
  echo.
  echo Something went wrong. Scroll up to see the error details.
  pause
)