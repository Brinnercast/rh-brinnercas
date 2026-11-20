@echo off
title RH BRINNERCAS — Sincronizacion Google Drive y Sheets
cd /d "%~dp0"
echo ===============================================================
echo   SINCRONIZANDO CON GOOGLE DRIVE Y GOOGLE SHEETS...
echo ===============================================================
node scripts/sync_drive_rh_brinnercas.js
echo.
pause
