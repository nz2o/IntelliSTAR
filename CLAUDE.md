# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based emulator of The Weather Channel's "Local on the 8's" IntelliSTAR cable-headend display, forked from `qconrad/intellistar-emulator`. It's a vanilla HTML/CSS/JavaScript single-page app (no build step, no bundler, no framework) that cycles through weather pages (current conditions, radar, forecast, 7-day outlook, alerts) with synchronized background music and optional TTS voice narration, styled to mimic the real hardware unit.

## Running the app

There is no build step — this is served as static files plus a small Node/Express backend used for proxying requests that need to run server-side (PiperTTS voice synthesis, Rainbow.AI radar tiles).

```bash
npm install          # installs express, express-http-proxy
node server.js        # or ./startserver.sh (Linux) / StartServer.bat (Windows)
```

The server listens on `0.0.0.0:PORT` (default `3000`, see `.env`/`.env.example`) and serves the whole repo as static files via `express.static('.')`. Weather data (current conditions, forecast, alerts) is fetched from NWS `api.weather.gov` through server-side proxy routes (`/nws/*`, see `NWSInterface.js`) rather than directly from the browser — see the "Weather data" note under Configuration — so, unlike earlier versions of this app, `node server.js` is required; it can no longer run as pure static HTML with full functionality.

There is no test suite, linter, or type checker configured in this repo (no `package.json` scripts, no eslint/prettier/tsconfig). There isn't a build/compile step to run after edits — changes to `.js`/`.css`/`.html` take effect on page reload.

Companion PiperTTS voice server startup scripts live in `scripts/` (`startpiper.sh` / `startpiper.bat`) — these launch a separate local Python PiperTTS HTTP server that `server.js` and/or the browser client talk to for narration.

## Configuration

`common_configuration.js` (repo root) is the single source of truth for runtime configuration: default greeting/crawl text, radar provider selection (per US vs. non-US/`K`-prefixed airport codes), and the ordered list of PiperTTS voice endpoints (each with `order`, `type: "Server"|"Client"`, and `url`). This file is imported by both the browser (`js/Config.js`) and the Node server (`server.js` via `PiperTTSInterface.js`/`RainbowAIInterface.js`), so it must stay valid as an ES module consumable from both contexts.

Per-user runtime settings entered in the UI dialog (location, units, voice on/off, music on/off, volume, alerts on/off) are persisted to `localStorage`, not to `common_configuration.js` — see the `load()`/`save()` methods on the `CONFIG` object in `js/Config.js`.

URL query parameters allow direct-start without the settings dialog: `?zip=NNNNN`, `?airport=XXXX`, `?units=e|m|h` (handled in `js/MainScript.js` `window.onload`).

**Weather data**: `PORT` and `NWS_USER_AGENT` (a contact string sent as the User-Agent header on NWS requests, per NWS's request that API callers self-identify) live in `.env` (server-side only, gitignored — copy from `.env.example`), not in `common_configuration.js`. This app is US-only: it uses the free `api.weather.gov` NWS API, proxied through `server.js`/`NWSInterface.js` since browsers forbid client-side JS from setting the `User-Agent` header. Zip-code geocoding uses the free `api.zippopotam.us` (also proxied server-side); airport-mode locations use their (normalized-to-ICAO) code directly as the NWS observation station ID.

## Architecture

### Module loading and the global-namespace pattern

Scripts are loaded in a specific order in `index.html` and mix ES modules (`type="module"`) with a couple of plain classic scripts. Because ES modules each get their own scope, several pieces of shared mutable state are deliberately hung off `window`/`globalThis` instead of being passed via `import`/`export`, so that both module and non-module scripts can reach them:

- `window.Weather` — the fetched weather data object (current conditions, forecast, outlook, alerts, radar image handles). Defined in `js/Conditions.js`, which is loaded as a **classic script** (not a module) specifically so `Weather` is available as a true global before the module scripts run.
- `window.CONFIG` — user/session configuration and the `run()`/`load()`/`save()`/`isLocationValid()` methods driving the settings dialog. Defined in `js/Config.js`.
- `window.zipCode`, `window.airportCode`, `window.cityName`, `window.isDay`, `window.WEEKDAY` — set in `js/Config.js`'s IIFE.
- `window.getElement` — a `document.getElementById` shorthand used everywhere, defined near the bottom of `js/MainScript.js`.
- `window.GetVoiceURL`, `window.GetTTSVoices`, `window.ttsGetSpeech` — client-side PiperTTS functions defined in `js/PiperTTSClient.js` (the one actually loaded by `index.html`; `js/PiperTTS.js` is an older, unloaded/unused variant — don't confuse the two).
- `MsgBox`/`openSettingsDialog`/`closeSettingsDialog`/`fn_voiceURLCheck` — defined inline in a `<script>` block at the bottom of `index.html`, not in a `js/` file.

When editing any of these, keep in mind load order matters (`index.html` script tags) since later files assume earlier ones have already attached their globals.

### Playback pipeline (the core flow)

1. `js/MainScript.js` `window.onload` calls `CONFIG.load()` (restore settings from `localStorage`), then either auto-starts via URL params or calls `openSettingsDialog()`.
2. User confirms the dialog → `CONFIG.run()` (`js/Config.js`) validates the location, applies dialog values to `CONFIG`, and calls `fetchCurrentWeather()`.
3. `js/WeatherFetching.js` chains a sequence of `fetch()` calls against the `/nws/*` server-side proxy routes (which in turn call NWS `api.weather.gov`, plus `api.zippopotam.us` for zip-code geocoding) — location resolution → gridpoint/station lookup → conditions → alerts → forecast → radar — each fetch's `.then()`/`await` triggers the next. Icon codes are mapped from NWS's icon-URL vocabulary to this repo's icon assets via `js/NWSIconMap.js`. Radar is fetched last via a router (`fetchRadarImages()`) that dispatches to one of four provider-specific modules (`RadarLeafletIEM.js`, `RadarLeafletRV.js`, `RadarLeafletXW.js`, `RadarLeafletRBAI.js`) based on `CONFIG.radarSource`, which is chosen in `js/Config.js` `run()` from `globalConfig.radar.ProviderUS`/`ProviderWW` depending on whether the location is a zip code or a non-`K` airport.
4. Once radar is fetched, `scheduleTimeline()` (exported from `MainScript.js`) picks one of four hardcoded page sequences — `MORNING`, `NIGHT`, `ALERTS_MORNING`, `ALERTS_NIGHT` — based on `isDay` and `Weather.alertsActive`, then calls `setInformation()`, which populates the DOM via `js/InformationSetting.js` (`setGreetingPage`, `setForecast`, `setOutlook`, `setCurrentConditions`, `setAlertPage`, `setTimelineEvents`, etc.) before `startAnimation()` kicks off the actual timed page-by-page playback (`schedulePages()`/`executePage()`/`clearPage()` in `MainScript.js`), synchronized with background music (`assets/music/`) and, if enabled, TTS narration fetched via `ttsGetSpeech()`.
5. Page sequence durations (`MORNING_DURATION` etc.) are computed from the hardcoded per-subpage `duration` values and are expected to match the length of the corresponding background music track (`assets/music/<n>-<duration>.wav`) — changing page timings requires either picking matching music files or accepting music will loop/cut off.

### Radar providers

Four interchangeable radar backends, each exposing a `getRadarLeaflet*(lat, lon[, apiKey])` fetch entry point and a `setRadarAnimation` export (aliased on import in `MainScript.js`/`WeatherFetching.js` since all four modules use the same export names):

- `leaflet-iowastate` (`RadarLeafletIEM.js`) — US NEXRAD mosaic from Iowa State Mesonet, no API key, default for US.
- `leaflet-rainviewer` (`RadarLeafletRV.js`) — RainViewer.com, no API key, works internationally, default for non-US.
- `leaflet-xweather` (`RadarLeafletXW.js`) — needs an Aeris/XWeather API key.
- `leaflet-rainbowai` (`RadarLeafletRBAI.js`) — needs a Rainbow.AI API key with billing on file; tile requests are proxied through `server.js`/`RainbowAIInterface.js` rather than called directly from the browser.
- `direct-nws` (handled inline in `WeatherFetching.js`, no separate module) — legacy iframe embed of `radar.weather.gov`, kept for compatibility but noted as slow/unreliable on low-power devices.

Each radar module stores its Leaflet map/animation state on `Weather.radarImage`/`Weather.zoomedRadarImage` (see top of `RadarLeafletIEM.js` for the shape).

### Server-side proxying (`server.js`)

The Express server does three things a browser can't do cleanly (or at all) on its own:

- **NWS weather data**: `/nws/*` routes (`geocode`, `station`, `points`, `nearest-station`, `observations`, `forecast`, `alerts`) proxy to `api.weather.gov`/`api.zippopotam.us` via `NWSInterface.js`, which sets a `User-Agent` header (`NWS_USER_AGENT` from `.env`) that browsers won't let client-side JS set directly. This one is always active — there's no static-files-only mode for weather data.
- **PiperTTS**: `/pipertts/voices` and `/pipertts/speech` proxy to whichever `common_configuration.js` PiperTTS endpoint has `type: "Server"` and the lowest positive `order`, resolved once at server startup via `PiperTTSInterface.js` `GetVoiceURL()`. The browser talks to the local `/pipertts/*` path; `server.js` forwards to the real (possibly remote) PiperTTS server.
- **Rainbow.AI radar**: `/rainbowai/gettimestamp` and `/rainbowai/gettile/:timestamp/:timeOffset/:zoom/:x/:y/:color` proxy to the Rainbow.AI tile API via `RainbowAIInterface.js`, keeping the API key server-side rather than exposed to the browser.

If neither PiperTTS `type: "Server"` nor `leaflet-rainbowai` is configured, those two routes are unused, but the `/nws/*` routes are always required — see the note under "Running the app" about `node server.js` now being mandatory.

### CSS

Plain CSS split by page/component (`css/currentconditions.css`, `css/forecast.css`, `css/radar.css`, `css/alert.css`, `css/crawl.css`, `css/timeline.css`, etc.), no preprocessor. `css/node_modules/open-props/` is a vendored copy of the Open Props CSS custom-properties library referenced directly by `<link>`/`@import`, not run through any build tool.
