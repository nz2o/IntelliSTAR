#!/usr/bin/env bash
# Wrapper so tools running inside the VS Code Flatpak sandbox (com.visualstudio.code)
# can reach the Docker CLI installed on the host system.
exec flatpak-spawn --host docker "$@"
