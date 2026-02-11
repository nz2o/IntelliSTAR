@echo off
rem * Basic Python PiperTTS Startup for Windows
rem Assumptions: Batch file is located in installation folder.
rem Python virtual environment is called "venv"
set PiperDefVoice=en_US-lessac-medium

rem Change current directory to the batch file's location
CD /D "%~dp0"

rem Verify that the virtual environment is valid.
IF NOT EXIST "venv\Scripts\activate.bat" (
  rem Could not verify if the python venv exists. Write message to console and exit.
  echo Unable to verify that a Python virtual environment exists! Exiting...
  echo Virtual environment tested: %CD%\venv
  EXIT /B 1
)

rem Determine proper python executable to call.
IF EXIST "venv\Scripts\python3.exe" ( set PythonEXE=venv\Scripts\python3.exe
) ELSE IF EXIST "venv\Scripts\python.exe" ( set PythonEXE=venv\Scripts\python.exe
) ELSE (
  rem Could not find a python executable in the virtual environment.
  echo Unable to locate a python executable in the virtual environment. Exiting...
  echo Virtual environment tested: %CD%\venv\Scripts\
  EXIT /B 1
)

rem Verify that the default voice exists in the installation directory.
IF NOT EXIST %PiperDefVoice%.onnx (
  rem Could not find the default PiperTTS voice file.
  echo Unable to locate the default PiperTTS voice file! Exiting...
  echo Expecting to find: %CD%\%PiperDefVoice%.onnx
  EXIT /B 1
)

rem All checks pass, ready to spawn a new console with the PiperrTTS running.
start "PiperTTS Server Running" %PythonEXE% -m piper.http_server -m %PiperDefVoice%
echo Script completed... PiperTTS Server shoudld be running in a separate window.

