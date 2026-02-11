#!/usr/bin/env bash
# Basic NodeJS IntelliSTAR Emulator Startup for Linux
# Assumptions: Batch file is located in installation folder.

# Edit the Terminal Run line if your terminal is not gnome-terminal

TerminalRun="gnome-terminal --title=IntelliSTAR_Server_Running -- "
# Change the current directory to be where this script is located.
cd "$(dirname "${BASH_SOURCE[0]}")" || exit
$TerminalRun node server.js &


