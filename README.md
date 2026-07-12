### Local Weather IntelliSTAR Emulator

This is an website HTML/Javascript emulation of the Weather Channel's Local on the 8's IntelliSTAR system, with heavy customization.

Original fork from: [GitHub - qconrad/intellistar-emulator: A web application that displays weather information in the same visual presentation as the cable headend unit Intellistar.](https://github.com/qconrad/intellistar-emulator)

#### New Here? [Quick Start / Install Guide](./INSTALL.md)

Never used Docker before? Start there -- it walks through installing Docker and running this app on Windows or Linux from scratch.

#### Already Running It? [Update Guide](./UPDATE.md)

How to pull down and apply newer versions of this app to your existing Docker deployment.

#### Summary of Enhancements in this Fork:

+ Weather data comes from the free NWS API (api.weather.gov) -- no paid weather data subscription required. US locations only (zip code or ICAO airport code).

+ Docker-based deployment (see [INSTALL.md](./INSTALL.md)), including a self-hosted PiperTTS voice server sidecar -- no external services required to run the whole thing.

+ Extensive `.env`-driven configuration (see `.env.example`): default startup location (including automatic IP-based geolocation), units, alerts, background music, voice narration and selected voice, looping, and a fully unattended "auto-start" kiosk mode that skips the startup dialog entirely.

+ Configurable radar providers
  
  - New leaflet-rainviewer based radar provider works much better on limited hardware such as streaming boxes.

+ Full Voice Narration Support using the PiperTTS Engine
- Full Weather Alert Support
  
  - including separate pages for each alert.

- URL Parameter Direct Start

- Settings Stored in Browser User Persistence

- Updated UI Dialog
  
  - including expanded control over many options

- Myriad of Bug Fixes

- Updates to Page Sequencing to Match Actual Local on the 8's

- Easy to Understand Deployment Instructions (I hope...)

This project was requested by my son Matthew, and is dedicated to him. May his love for all things weather and the Weather Channel never diminish.

#### Release Summary
Fork - PiperTTS should be local now - no point in reaching to external resources.
Version 1.5.x - Sunset of BasicTTS public Piper server. Switched to pythonanywhere based server. Fixed PiperTTS client code
to handle generic Piper TTS server endpoints without explicit listing of URLs.
Version 1.4.x - Added master volume control in UI to control playback volume on a per device basis. Useful when normalizing playback volume with other sources on devices such as Smart TVs. Option is saved into the browser local storage and is persistent.
Version 1.3.x - Added new url options, added dual radar providers based on location.\
Version 1.2.x - Added configurable radar providers.\
Version 1.1.x - Major code refactoring to make deployment and distribution easier.\
Version 1.0.0 - Initial Push to Github.

> [!NOTE]
> A Node.js server (`node server.js`, or the equivalent Docker container) is **required** to run this app. Weather data comes from the free NWS `api.weather.gov` API, which browsers cannot call directly (NWS requires a contact `User-Agent` header that client-side JavaScript is not allowed to set), so `server.js` proxies those requests server-side. A plain static file host (GitHub Pages, a bare Apache/IIS document root, etc.) cannot serve weather data and is no longer a supported deployment option in this fork.

#### Deployment Options

1. **Docker (recommended, easiest)** -- see [INSTALL.md](./INSTALL.md). Runs `server.js` and a self-hosted PiperTTS voice server together with one command; no Node.js install required on your machine.

2. **Manual Node.js install** -- clone the repo, run `npm install` then `node server.js` (or `npm start`) directly. Tested on Windows and Linux; see the [Local Deployment Instructions](./docs/Local_Deployment_Instructions.md) for the detailed, screenshot-by-screenshot walkthrough (including installing Node.js and, optionally, a local PiperTTS server).

#### Configuration (`.env`)

Copy `.env.example` to `.env` and fill in your values -- `.env` is gitignored and never committed. Every variable is documented inline in `.env.example`, including:

- `PORT` and `NWS_USER_AGENT` (required -- NWS asks API callers to self-identify via a contact `User-Agent`)
- `DEFAULT_LOCATION` (a zip/airport code, or `AUTOMATIC` to geolocate the server's own public IP) and `AUTO_START` (skip the startup dialog entirely and begin the presentation unattended)
- Startup defaults for units, alerts, background music, voice narration and voice selection, and looping
- `GREETING_TEXT` / `CRAWL_TEXT` and a few display/timing tweaks

#### Handling the real-time voice narration:

Real-time voice narration requires access to a PiperTTS web based voice server.

1. **Docker deployment (recommended)** -- the included `docker-compose.yml` runs a self-hosted PiperTTS voice server as a sidecar container (`piper/`) automatically, alongside the app. No external service or extra setup needed; see [INSTALL.md](./INSTALL.md).

2. **Manual Node.js deployment** -- you can host a local PiperTTS instance on the same computer (see `scripts/startpiper.sh` / `startpiper.bat`), or point `common_configuration.js`'s `PiperTTS.endpoints` at a remote PiperTTS server.

Note: There are very few publicly accessible PiperTTS web servers and no guarantee that the sponsors will keep them active, open, and free. As of the last update to this section, `basictts.com`'s public server has been discontinued. `pythonanywhere.com` offers a limited free hosting account suitable for hosting your own PiperTTS server with a limited number of voices -- see the cloud deployment section below.

#### Roku Streaming (optional)

Want this running as an actual "channel" on a Roku, on a TV, instead of in a browser? An optional `intellistar-stream` Docker Compose service (`roku-stream/`) renders the app in a headless, kiosk-mode Chromium -- music, TTS narration and all -- and re-encodes it into a live HLS stream via `ffmpeg`, served back out by `server.js` at `/stream/live.m3u8`. A minimal sideloadable Roku channel (`roku-channel/`) plays that stream full-screen.

It's off by default (a headless browser + video encoder is much heavier than the rest of this stack). To enable it:

1. In `.env`, set `COMPOSE_PROFILES=stream` and a `STREAM_LOCATION` (see `.env.example` for all `STREAM_*` options).
2. `docker compose up --build -d` -- the extra profile brings the `intellistar-stream` container up alongside the usual two.
3. Confirm `http://<your-server-ip>:<PORT>/stream/live.m3u8` is producing video (any HLS-capable player, e.g. VLC, can open that URL directly to test).
4. Follow [roku-channel/README.md](./roku-channel/README.md) to sideload the channel onto your Roku via Developer Mode.

You can also enable it for a single run without touching `.env`: `docker compose --profile stream up -d`.

#### Deployment Instructions: [Local Deployment](./docs/Local_Deployment_Instructions.md)

#### General Usage Instructions: [Operation Instructions](./docs/IntelliSTAR_Operation.md)

---

#### Cloud Based PiperTTS Server Configuration using PythonAnywhere

A local PiperTTS server instance is the preferred configuration and is covered in the main Deployment Instructions. However, there may be situations where the desired web server host doesn't allow or support this option.

#### Configure non-local PiperTTS voice server interface: [Instructions](./docs/IntelliSTAR_Configuration_Troubleshooting.md#configuring-the-intellistar-emulator-to-use-a-pythonanywhere-hosted-pipertts-server)
