#!/bin/bash
# The actual render/capture/encode pipeline, run as the unprivileged "streamer" user
# (see entrypoint.sh, which does root-only setup then hands off here) -- PulseAudio's
# client library refuses to let root talk to a non-root PulseAudio daemon at all, not
# just as a permission-bits thing, so everything that touches audio (Chromium, pactl,
# ffmpeg) has to run as the same non-root user the daemon itself runs as.
set -u

WIDTH="${STREAM_WIDTH:-1280}"
HEIGHT="${STREAM_HEIGHT:-720}"
FRAMERATE="${STREAM_FRAMERATE:-30}"
BITRATE="${STREAM_BITRATE:-3000k}"
PAGE_URL="$1"
OUTPUT_DIR="/output"

pulseaudio -D --exit-idle-time=-1 --disallow-exit --log-target=stderr
sleep 1
pactl load-module module-null-sink sink_name=stream_sink sink_properties=device.description=StreamSink >/dev/null
pactl set-default-sink stream_sink

# Nothing ever moves the (virtual) mouse here, but Xvfb still renders its default
# cursor sitting in the middle of the screen -- unclutter hides it once idle, which
# with no real input device is immediately, keeping it out of the captured video.
unclutter -idle 0 -root &

cleanup() {
  echo "Shutting down stream pipeline..."
  kill ${CHROME_PID:-} ${FFMPEG_PID:-} 2>/dev/null
  exit 0
}
trap cleanup TERM INT

while true; do
  echo "Launching Chromium..."
  PROFILE_DIR="/tmp/chrome-profile-$$"
  chromium \
    --kiosk \
    --app="${PAGE_URL}" \
    --window-position=0,0 \
    --window-size="${WIDTH},${HEIGHT}" \
    --autoplay-policy=no-user-gesture-required \
    --no-first-run \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=TranslateUI \
    --disable-gpu \
    --no-sandbox \
    --disable-dev-shm-usage \
    --user-data-dir="$PROFILE_DIR" \
    >/tmp/chromium.log 2>&1 &
  CHROME_PID=$!

  # Give the page a moment to paint before ffmpeg starts grabbing frames.
  sleep 5

  echo "Launching ffmpeg encoder..."
  ffmpeg -y \
    -f x11grab -video_size "${WIDTH}x${HEIGHT}" -framerate "${FRAMERATE}" -i :99.0 \
    -f pulse -i stream_sink.monitor \
    -c:v libx264 -preset veryfast -tune zerolatency -b:v "${BITRATE}" -pix_fmt yuv420p -g $((FRAMERATE * 2)) \
    -c:a aac -b:a 128k -ac 2 \
    -f hls -hls_time 4 -hls_list_size 6 -hls_flags delete_segments+append_list \
    -hls_segment_filename "${OUTPUT_DIR}/segment_%05d.ts" \
    "${OUTPUT_DIR}/live.m3u8" \
    >/tmp/ffmpeg.log 2>&1 &
  FFMPEG_PID=$!

  # If either process dies, tear down both and restart -- recovers from transient
  # crashes (a page reload racing Chromium's audio device, ffmpeg losing the X11/Pulse
  # connection) so an unattended TV display self-heals instead of going dark for good.
  wait -n "$CHROME_PID" "$FFMPEG_PID"
  echo "Chromium or ffmpeg exited unexpectedly -- restarting stream pipeline in 3s."
  kill "$CHROME_PID" "$FFMPEG_PID" 2>/dev/null
  wait "$CHROME_PID" "$FFMPEG_PID" 2>/dev/null
  rm -rf "$PROFILE_DIR"
  sleep 3
done
