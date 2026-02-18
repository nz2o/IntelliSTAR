#!/usr/bin/env bash
# Basic Python PiperTTS Startup for Linux
# Assumptions: Batch file is located in installation folder.
# Python virtual environment is called "venv"
PiperDefVoice="en_US-lessac-medium"
TerminalRun="gnome-terminal --title=PiperTTS_Server_Running -- "

# Change the current directory to be where this script is located.
cd "$(dirname "${BASH_SOURCE[0]}")" || exit

# Verify that the virtual environment is valid.
if [ ! -f "./venv/bin/activate" ]; then 
  # Could not verify if the python venv exists. Write message to console and exit.
  echo "Unable to verify that a Python virtual environment exists! Exiting..."
  echo "Virtual environment tested: $PWD/venv"
  exit 1
fi

# Determine proper python executable to call.
if [ -f "venv/bin/python3" ]; then 
  PythonEXE="./venv/bin/python3"
elif [ -f "venv/bin/python" ]; then 
  PythonEXE="./venv/bin/python3"
else
  # Could not find a python executable in the virtual environment.
  echo "Unable to locate a python executable in the virtual environment. Exiting..."
  echo "Virtual environment tested: $PWD/venv/bin"
  exit 1
fi

# Verify that the default voice exists in the installation directory.
if [ ! -f  "$PiperDefVoice.onnx" ]; then
  # Could not find the default PiperTTS voice file.
  echo "Unable to locate the default PiperTTS voice file! Exiting..."
  echo "Expecting to find: $PWD/$PiperDefVoice.onnx"
  exit 1
fi

# All checks pass, ready to spawn a new console with the PiperrTTS running.
$TerminalRun $PythonEXE -m piper.http_server -m $PiperDefVoice &

