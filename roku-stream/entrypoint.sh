#!/bin/bash
# Root-only setup: fix bind-mount ownership, start the (audio-agnostic) virtual
# display, then hand off to pipeline.sh -- which runs as the unprivileged "streamer"
# user, since PulseAudio and everything talking to it (Chromium, ffmpeg) can't be root.
# See pipeline.sh for the actual render/capture/encode loop.
set -u

WIDTH="${STREAM_WIDTH:-1280}"
HEIGHT="${STREAM_HEIGHT:-720}"
APP_URL="${STREAM_URL_BASE:-http://intellistar:3000}"
LOCATION="${STREAM_LOCATION:-AUTOMATIC}"
UNITS="${STREAM_UNITS:-e}"
OUTPUT_DIR="/output"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR"/*.ts "$OUTPUT_DIR"/*.m3u8 2>/dev/null
# Docker creates ./stream_output on the host owned by root:root the first time this
# bind mount is used (since it doesn't exist yet) -- chown it to streamer so pipeline.sh
# (running as that user, see below) can actually write segments into it.
chown streamer:streamer "$OUTPUT_DIR"

# A real zip/airport code auto-starts the presentation directly via the app's own
# ?zip=/?airport= URL handling (see MainScript.js window.onload) -- this works
# regardless of the global AUTO_START .env setting, so enabling this stream never
# changes behavior for anyone visiting the app in a real browser. AUTOMATIC/unset has
# no equivalent URL param (it's resolved from .env server-side via /geoip/lookup only
# when AUTO_START is on) -- falls through to the bare URL, which requires AUTO_START=true
# and DEFAULT_LOCATION set in .env or this stream will just sit on the dialog forever.
case "$LOCATION" in
  AUTOMATIC|"")
    PAGE_URL="${APP_URL}/?units=${UNITS}"
    ;;
  [0-9][0-9][0-9][0-9][0-9])
    PAGE_URL="${APP_URL}/?zip=${LOCATION}&units=${UNITS}"
    ;;
  *)
    PAGE_URL="${APP_URL}/?airport=${LOCATION}&units=${UNITS}"
    ;;
esac

echo "Waiting for IntelliSTAR app at ${APP_URL} ..."
until curl -fs "${APP_URL}/common_configuration.js" > /dev/null 2>&1; do
  sleep 2
done
echo "App is reachable. Streaming page: ${PAGE_URL}"

Xvfb :99 -screen 0 "${WIDTH}x${HEIGHT}x24" -nolisten tcp &
XVFB_PID=$!
export DISPLAY=:99

for i in $(seq 1 30); do
  xdpyinfo -display :99 >/dev/null 2>&1 && break
  sleep 0.5
done

export XDG_RUNTIME_DIR=/tmp/runtime-streamer
mkdir -p "$XDG_RUNTIME_DIR"
chown streamer:streamer "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
# su -p below preserves whatever HOME already is instead of switching to streamer's --
# set it explicitly so PulseAudio (run as streamer, see pipeline.sh) doesn't try to read
# its config from root's home (permission denied -- non-fatal, but noisy and pointless).
export HOME=/home/streamer

trap 'kill $XVFB_PID 2>/dev/null; exit 0' TERM INT

# -p preserves the environment (STREAM_*, DISPLAY, XDG_RUNTIME_DIR set above) across
# the switch to streamer's uid. If pipeline.sh's own restart loop ever gives up (it
# doesn't, by design, but just in case), fall through and keep Xvfb from orphaning.
su -p -s /bin/bash streamer -c "/app/pipeline.sh '${PAGE_URL}'"
wait $XVFB_PID
