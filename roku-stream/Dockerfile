# Optional container: renders the IntelliSTAR app in a headless, kiosk-mode Chromium
# (so the actual page -- music, TTS, animations and all -- plays exactly as a real
# browser would show it) and re-encodes the virtual display + audio into an HLS stream
# via ffmpeg, suitable for a Roku (or any HLS-capable player) to pick up. See
# ../docker-compose.yml (the "stream" profile) and entrypoint.sh/pipeline.sh for
# the pipeline itself.
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    x11-utils \
    unclutter \
    pulseaudio \
    ffmpeg \
    curl \
    fonts-liberation \
    ca-certificates \
    tzdata \
    bash \
    && rm -rf /var/lib/apt/lists/*

# PulseAudio hard-refuses to start as root (no flag overrides it), and its client
# library equally refuses root-to-non-root connections -- so PulseAudio itself, plus
# Chromium (plays audio) and ffmpeg (captures it) all need to run as this unprivileged
# user. See entrypoint.sh (root: display + bind-mount setup) and pipeline.sh (streamer:
# the actual render/capture/encode loop, handed off to via su).
RUN useradd -m -u 1000 -s /bin/bash streamer

WORKDIR /app
COPY entrypoint.sh pipeline.sh /app/
RUN chmod +x /app/entrypoint.sh /app/pipeline.sh

ENTRYPOINT ["/app/entrypoint.sh"]
