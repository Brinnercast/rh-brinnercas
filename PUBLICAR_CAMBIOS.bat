@echo off
chcp 65001 >nul
title PUBLICAR RH BRINNERCAS -> GITHUB -> FIREBASE
cd /d "%~dp0"
node "%~dp0publicar_cambios.js"
echo.
pause

