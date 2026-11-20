@echo off
title RH BRINNERCAS — Servidor Web Glassmorphism (Puerto 3005)
cd /d "%~dp0"
echo ===============================================================
echo   INICIANDO RH BRINNERCAS - GRUPO GASTRONOMICO AURORA S.A.C.
echo   Portal Web: http://localhost:3005
echo ===============================================================
start "" "http://localhost:3005"
node server.js
pause
