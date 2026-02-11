@echo off
rem Basic NodeJS IntelliSTAR Emulator Startup for Linux
rem Assumptions: Batch file is located in installation folder.

rem Change current directory to the batch file's location
CD /D "%~dp0"

rem Spawn a new console with the NodeJS IntelliSTAR Emulator running.
start "IntelliSTAR_Server_Running" node server.js
echo Script completed... NodeJS IntelliSTAR Emulator Server shoudld be running in a separate window.
