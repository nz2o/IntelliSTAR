// NodeJS Express Webserver Configuration File for the PiperTTS Server
// Version 1.1 - February 2026

// Load .env if present (PORT, NWS_USER_AGENT). Safe no-op if the file doesn't exist,
// e.g. when running under Docker Compose, which injects these into process.env directly.
try { process.loadEnvFile(); } catch { /* no .env on disk */ }

// Common configuration items are host and port. See below.
// for host 0.0.0.0 listens on all interfaces.
const host = '0.0.0.0';
const port = process.env.PORT || 3000;

// NodeJS Web Services and support functions
import express from 'express';
import {Readable} from 'node:stream';
import os from 'os';

// This is the import of the shared configuration file that controls how the IntelliSTAR
// emulator interacts with available PiperTTS voice servers.
import * as piperTTS from './PiperTTSInterface.js';
import * as rainbowAI from './RainbowAIInterface.js';
import * as nws from './NWSInterface.js';
import * as ipgeo from './IPGeolocationInterface.js';
import * as tomtom from './TomTomInterface.js';
import * as backgroundPhotos from './BackgroundPhotoInterface.js';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Simple function to get all the valid ip4 addresses on the computer
function getIP4Addresses() {
  const nets = os.networkInterfaces();
  const results = []; // Use an array to store all valid addresses
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.address.split(".").length === 4) { // Got 4 octets may be a valid IP
        results.push(net.address);
      }
    }
  }
  return results;
}

// This function reads the common configuration file looking for Server-Side PiperTTS configuration.
// If it is found then the server attempts to communicate with the PiperTTS server.
// Status is reported on the console.

console.log("Checking for PiperTTS Voice Server Availability...");
const {url: INT_TTS_SERVER, order: INT_TTS_ORDER } = await piperTTS.GetVoiceURL();
if(INT_TTS_ORDER === 0) {
    console.log("Server Side Piper TTS Server not enabled.");
} else {
    console.log(`Server Side Piper TTS Server is available. Order#${INT_TTS_ORDER}. Server URL:${INT_TTS_SERVER}`);
}

// See if the Rainbow.AI Radar Provider is selected and if so, enable the API.
// Status is reported on the console.
console.log("Checking for Rainbow.AI Server Availability...");
const RainbowAIStatus = rainbowAI.GetAPIKey();
switch(RainbowAIStatus) {
  case 0:
    // not configured
    console.log("RainbowAI Radar Provider is not Enabled.");
    break;
  case 1:
    // Enabled and configuration has been verified (non-blank API key)
    console.log("RainbowAI Radar Provider is Enabled.");
    break;
  case 2:
    // Enabled but the API key is blank!
    console.log("RainbowAI Radar Provider is selected but the API key is blank. Radar services will be unavailable.");
    break;
  default:
    // invalid return code from function
    console.log("RainbowAI GetAPIKey returned an invalid status code. State is unknown. Code=",RainbowAIStatus);
    break;
}

// See if the TomTom Traffic Flow API is configured (TOMTOM_TRAFFIC_API_KEY in .env)
// and if so, enable the closing traffic-conditions slide.
console.log("Checking for TomTom Traffic API Availability...");
if (tomtom.isConfigured()) {
  console.log("TomTom Traffic slide is Enabled.");
} else {
  console.log("TomTom Traffic slide is not Enabled (no TOMTOM_TRAFFIC_API_KEY set in .env).");
}

// Packages roku-channel/ into a downloadable .zip (see the /roku-channel.zip route
// below) for sideloading onto a Roku -- see roku-channel/README.md. Rebuilt fresh on
// every server start rather than at `docker build` time: docker-compose.yml bind-mounts
// the whole repo over /app at runtime (the "edit .js/.css without a rebuild" pattern
// this project relies on elsewhere), so anything written to /app during the image build
// would just be shadowed by that mount anyway -- this keeps the zip in sync with
// whatever roku-channel/ actually contains right now, no separate build step needed.
console.log("Packaging Roku channel (roku-channel/) into a downloadable .zip...");
try {
  execSync('zip -r localwx-channel.zip manifest source components images', { cwd: './roku-channel', stdio: 'pipe' });
  console.log("Roku channel packaged: available at /roku-channel.zip");
} catch (err) {
  // Non-fatal -- e.g. the `zip` binary is missing on a non-Docker/manual Node install.
  // The rest of the app works fine either way; only the Roku channel download link won't.
  console.log("Could not package the Roku channel (is 'zip' installed?). /roku-channel.zip will be unavailable. Error:", err.message);
}

// Main IntelliSTAR Web Server
const app = express();

// common_configuration.js is loaded directly by the browser (see index.html), so it
// can't read process.env itself -- .env only exists server-side. Serve it dynamically
// here (registered before express.static below, so this route wins) and substitute
// GREETING_TEXT/CRAWL_TEXT/NARRATION_DWELL_SECONDS from .env when set, otherwise the
// file's own defaults apply.
app.get('/common_configuration.js', (req, res) => {
  let configSource = fs.readFileSync('./common_configuration.js', 'utf-8');
  if (process.env.GREETING_TEXT) {
    configSource = configSource.replace(
      /greetingText:\s*".*?"/,
      `greetingText: ${JSON.stringify(process.env.GREETING_TEXT)}`
    );
  }
  if (process.env.CRAWL_TEXT) {
    configSource = configSource.replace(
      /crawlText:\s*".*?"/,
      `crawlText: ${JSON.stringify(process.env.CRAWL_TEXT)}`
    );
  }
  if (process.env.AMAZING_HASHTAG) {
    configSource = configSource.replace(
      /amazingHashtag:\s*".*?"/,
      `amazingHashtag: ${JSON.stringify(process.env.AMAZING_HASHTAG)}`
    );
  }
  const dwellSeconds = Number(process.env.NARRATION_DWELL_SECONDS);
  if (!Number.isNaN(dwellSeconds)) {
    configSource = configSource.replace(
      /narrationDwellMs:\s*\d+/,
      `narrationDwellMs: ${dwellSeconds * 1000}`
    );
  }
  const musicDuckLevel = Number(process.env.MUSIC_DUCK_LEVEL);
  if (!Number.isNaN(musicDuckLevel)) {
    configSource = configSource.replace(
      /musicDuckLevel:\s*[\d.]+/,
      `musicDuckLevel: ${musicDuckLevel}`
    );
  }
  if (process.env.SHOW_FETCHING_MESSAGE) {
    configSource = configSource.replace(
      /showFetchingMessage:\s*(true|false)/,
      `showFetchingMessage: ${process.env.SHOW_FETCHING_MESSAGE === 'true'}`
    );
  }
  if (process.env.DEFAULT_LOCATION) {
    configSource = configSource.replace(
      /defaultLocation:\s*".*?"/,
      `defaultLocation: ${JSON.stringify(process.env.DEFAULT_LOCATION.toUpperCase())}`
    );
  }
  if (process.env.ALERTS_ENABLED_DEFAULT) {
    configSource = configSource.replace(
      /alertsEnabledDefault:\s*(true|false)/,
      `alertsEnabledDefault: ${process.env.ALERTS_ENABLED_DEFAULT === 'true'}`
    );
  }
  if (process.env.UNITS_DEFAULT) {
    const unitsMap = { US: 'e', METRIC: 'm' };
    const mappedUnits = unitsMap[process.env.UNITS_DEFAULT.toUpperCase()] || 'e';
    configSource = configSource.replace(
      /unitsDefault:\s*".*?"/,
      `unitsDefault: ${JSON.stringify(mappedUnits)}`
    );
  }
  if (process.env.MUSIC_ENABLED_DEFAULT) {
    configSource = configSource.replace(
      /musicEnabledDefault:\s*(true|false)/,
      `musicEnabledDefault: ${process.env.MUSIC_ENABLED_DEFAULT === 'true'}`
    );
  }
  if (process.env.APPLE_WORKAROUND_DEFAULT) {
    configSource = configSource.replace(
      /appleWorkaroundDefault:\s*(true|false)/,
      `appleWorkaroundDefault: ${process.env.APPLE_WORKAROUND_DEFAULT === 'true'}`
    );
  }
  if (process.env.VOICE_ENABLED_DEFAULT) {
    configSource = configSource.replace(
      /voiceEnabledDefault:\s*(true|false)/,
      `voiceEnabledDefault: ${process.env.VOICE_ENABLED_DEFAULT === 'true'}`
    );
  }
  if (process.env.VOICE_SELECT_DEFAULT) {
    configSource = configSource.replace(
      /voiceSelectDefault:\s*".*?"/,
      `voiceSelectDefault: ${JSON.stringify(process.env.VOICE_SELECT_DEFAULT)}`
    );
  }
  if (process.env.VOICE_ALERTS_NARRATION_DEFAULT) {
    configSource = configSource.replace(
      /voiceAlertsNarrationDefault:\s*(true|false)/,
      `voiceAlertsNarrationDefault: ${process.env.VOICE_ALERTS_NARRATION_DEFAULT === 'true'}`
    );
  }
  if (process.env.LOOP_ENABLED_DEFAULT) {
    configSource = configSource.replace(
      /loopEnabledDefault:\s*(true|false)/,
      `loopEnabledDefault: ${process.env.LOOP_ENABLED_DEFAULT === 'true'}`
    );
  }
  if (process.env.AUTO_START) {
    configSource = configSource.replace(
      /autoStart:\s*(true|false)/,
      `autoStart: ${process.env.AUTO_START === 'true'}`
    );
  }
  // traffic.enabled isn't a .env override like the above -- it's derived from whether
  // TOMTOM_TRAFFIC_API_KEY is actually set, so the client only ever tries to build the
  // traffic slide when the server can actually serve it. (The only "enabled:" key in
  // this file -- see the traffic{} section.)
  configSource = configSource.replace(
    /enabled:\s*(true|false)/,
    `enabled: ${tomtom.isConfigured()}`
  );
  if (process.env.TRAFFIC_BLACKOUT_START_HOUR) {
    configSource = configSource.replace(
      /blackoutStartHour:\s*\d+/,
      `blackoutStartHour: ${Number(process.env.TRAFFIC_BLACKOUT_START_HOUR)}`
    );
  }
  if (process.env.TRAFFIC_BLACKOUT_END_HOUR) {
    configSource = configSource.replace(
      /blackoutEndHour:\s*\d+/,
      `blackoutEndHour: ${Number(process.env.TRAFFIC_BLACKOUT_END_HOUR)}`
    );
  }
  res.type('application/javascript').send(configSource);
});

// Section 5 (see below): serves the optional Roku-streaming container's HLS output.
// Registered before the catch-all static() below so its no-cache headers apply --
// express.static('.') would otherwise serve stream_output/ too, just without them.
app.use('/stream', express.static('./stream_output', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Cache-Control', 'public, max-age=30');
    }
  }
}));

// The Roku channel package (see roku-channel/README.md) -- built fresh at server
// startup, above. A friendly, stable download link regardless of where the underlying
// .zip physically lives; 404s with a clear message if packaging failed at startup
// (e.g. 'zip' not installed) instead of a generic express.static 404.
app.get('/roku-channel.zip', (req, res) => {
  res.download('./roku-channel/localwx-channel.zip', 'localwx-channel.zip', (err) => {
    if (err && !res.headersSent) {
      res.status(404).send("Roku channel package not available -- check server startup logs for a packaging error.");
    }
  });
});

app.use(express.static('.'));

// Parse incoming requests with JSON payloads
app.use(express.json());

// Web Server, server-side functions that proxy requests from the clients.

// Section 1: Endpoints for server-side PiperTTS
// Define an API endpoint (a route) that calls the Piper TTS function to get installed voices.
app.get('/pipertts/voices', async (req, res) => {
    console.log("SS Endpoint pipertts/voices. Reqpath="+req.path);
    const result = await piperTTS.GetTTSVoices(INT_TTS_SERVER);
    res.status(200).json(result); // Send the result back as JSON
});

// Define an API endpoint (a route) that calls the Piper TTS function to return Speech data.
app.post('/pipertts/speech', async (req, res) => {
    console.log("SS Endpoint pipertts/speech. Reqpath="+req.path);
    const spStr = req.body.text;
    const voiceSel = req.body.voice;
    console.log("Speaking. Voice=",voiceSel," Text=",spStr);
    const result = await piperTTS.GetSpeech(INT_TTS_SERVER,spStr,voiceSel);

    // result should be a blob containing voice speech in audio/wav format.
    // return this encoded data back to the caller.
    const src = Readable.fromWeb(result.stream());
    res.header('Content-Type','audio/wav');
    res.header('Content-Length',result.size);
    src.pipe(res);
});

// Section 2: Endpoints for server-side Rainbow.AI Radar Provider
// Define an API endpoint (a route) that calls the RainbowAI current Tiles snapshot timestamp
app.get('/rainbowai/gettimestamp', async (req, res) => {
    console.log("SS Endpoint /rainbowai/gettimestamp. Reqpath="+req.path);
    const result = await rainbowAI.GetTimestamp();
    res.status(200).json(result); // Send the result back as JSON
});

// Define an API endpoint (a route) that calls the RainbowAI get tile function.
app.get('/rainbowai/gettile/:timestamp/:timeOffset/:zoom/:x/:y/:color', async (req, res) => {
    //console.log("SS Endpoint /rainbowai/gettile. Reqpath="+req.path);
    const result = await rainbowAI.GetTile(req.params.timestamp,req.params.timeOffset,req.params.zoom,
      req.params.x,req.params.y,req.params.color);

    // result should be a blob containing an image in image/wav format.
    // return this encoded data back to the caller.
    const src = Readable.fromWeb(result.stream());
    res.header('Content-Type','image/png');
    res.header('Content-Length',result.size);
    src.pipe(res);
});

// Proxies TomTom's Traffic Flow tile API for the closing traffic-conditions slide
// (js/TrafficMap.js) -- the API key never reaches the browser, only this route does.
// tz is the resolved location's own IANA timezone (e.g. "America/Chicago"), passed by
// the client since only it knows which location is configured; TomTomInterface.js
// uses it purely to decide the peak/off-peak/blackout refresh policy, not to select
// which tile to serve (z/x/y alone determines that). See TomTomInterface.js for the
// caching/budget logic that keeps this within TomTom's free daily tile quota.
app.get('/traffic/tile/:z/:x/:y', async (req, res) => {
    const buffer = await tomtom.GetTrafficTile(req.params.z, req.params.x, req.params.y, req.query.tz);
    if (!buffer) {
      res.status(204).end(); // not configured, blacked out, or no data available -- caller (Leaflet) just skips this tile
      return;
    }
    res.header('Content-Type', 'image/png');
    // Freshness is entirely server-managed (see TomTomInterface.js's own cache) --
    // don't let the browser layer its own caching on top and potentially show a tile
    // even staler than what the server would have served on the next request.
    res.header('Cache-Control', 'no-store');
    res.send(buffer);
});

// Lets the client (js/TrafficMap.js) check, once per weather-fetch cycle, whether the
// traffic slide should actually be shown -- catches "key present but not working"
// (invalid/expired key, TomTom unreachable), which common_configuration.js's one-time
// traffic.enabled (set at page load, from isConfigured() alone) can't reflect since it
// never gets re-fetched for the life of the page. See TomTomInterface.js's isWorking().
app.get('/traffic/status', (req, res) => {
    res.json({ available: tomtom.isWorking() });
});

// Lists whatever local background photos exist for a CWA (see
// assets/background/README.md and BackgroundPhotoInterface.js) -- js/MainScript.js's
// setMainBackground() picks a random one from the result, or falls back to the
// picsum.photos random-image source if the array comes back empty (no folder for
// this CWA, or nothing recognized as an image in it).
app.get('/background-photos/:cwa', async (req, res) => {
    const photos = await backgroundPhotos.GetBackgroundPhotos(req.params.cwa);
    res.json(photos);
});

// Section 3: Endpoints for server-side NWS Weather Data
// These proxy calls to api.weather.gov (and the free api.zippopotam.us zip geocoder) so a
// proper contact User-Agent can be sent — browsers won't let client-side JS set that header.
app.get('/nws/geocode/:zip', async (req, res) => {
    console.log("SS Endpoint /nws/geocode. Reqpath="+req.path);
    const result = await nws.GetZipLocation(req.params.zip);
    res.status(200).json(result);
});

app.get('/nws/station/:icao', async (req, res) => {
    console.log("SS Endpoint /nws/station. Reqpath="+req.path);
    const result = await nws.GetStation(req.params.icao);
    res.status(200).json(result);
});

app.get('/nws/points/:lat/:lon', async (req, res) => {
    console.log("SS Endpoint /nws/points. Reqpath="+req.path);
    const result = await nws.GetPoints(req.params.lat, req.params.lon);
    res.status(200).json(result);
});

// Physical lat/lon of a WSR-88D radar site (id is the radarStation field returned by
// /nws/points/:lat/:lon above, e.g. "KTWX") -- used to mark where the regional radar
// map's imagery is actually sourced from. See NWSInterface.js's GetRadarStation().
app.get('/nws/radar-station/:id', async (req, res) => {
    console.log("SS Endpoint /nws/radar-station. Reqpath="+req.path);
    const result = await nws.GetRadarStation(req.params.id);
    res.status(200).json(result);
});

app.get('/nws/nearest-station/:gridId/:gridX/:gridY', async (req, res) => {
    console.log("SS Endpoint /nws/nearest-station. Reqpath="+req.path);
    const stationId = await nws.GetNearestStation(req.params.gridId, req.params.gridX, req.params.gridY);
    res.status(200).json({ stationId });
});

app.get('/nws/observations/:stationId/:limit', async (req, res) => {
    console.log("SS Endpoint /nws/observations. Reqpath="+req.path);
    const result = await nws.GetObservations(req.params.stationId, req.params.limit);
    res.status(200).json(result);
});

app.get('/nws/forecast/:gridId/:gridX/:gridY/:units', async (req, res) => {
    console.log("SS Endpoint /nws/forecast. Reqpath="+req.path);
    const result = await nws.GetGridForecast(req.params.gridId, req.params.gridX, req.params.gridY, req.params.units);
    res.status(200).json(result);
});

app.get('/nws/alerts/:lat/:lon', async (req, res) => {
    console.log("SS Endpoint /nws/alerts. Reqpath="+req.path);
    const result = await nws.GetAlerts(req.params.lat, req.params.lon);
    res.status(200).json(result);
});

// Nationwide active Tornado/Severe Thunderstorm/Flash Flood Warnings (with polygon
// geometry) for the 2-Hour Regional Radar page's warning overlay -- see
// NWSInterface.js's GetActiveWarnings() for why this isn't lat/lon-scoped like
// /nws/alerts above.
app.get('/nws/warnings/active', async (req, res) => {
    console.log("SS Endpoint /nws/warnings/active. Reqpath="+req.path);
    const result = await nws.GetActiveWarnings();
    res.status(200).json(result);
});

// County/forecast-zone boundary geometry for a CWA (Weather Forecast Office area of
// responsibility) and the active alerts affecting it -- see NWSInterface.js's
// GetCWABoundary()/GetCWAWarnings() -- used by the persistent CWA warnings map panel
// (js/CWAWarningsMap.js). officeId is the same identifier already returned as gridId
// by /nws/points/:lat/:lon above, e.g. "BMX".
app.get('/nws/cwa-boundary/:officeId', async (req, res) => {
    console.log("SS Endpoint /nws/cwa-boundary. Reqpath="+req.path);
    const result = await nws.GetCWABoundary(req.params.officeId);
    res.status(200).json(result);
});

app.get('/nws/cwa-warnings/:officeId', async (req, res) => {
    console.log("SS Endpoint /nws/cwa-warnings. Reqpath="+req.path);
    const result = await nws.GetCWAWarnings(req.params.officeId);
    res.status(200).json(result);
});

app.get('/nws/hourly-forecast/:gridId/:gridX/:gridY/:units', async (req, res) => {
    console.log("SS Endpoint /nws/hourly-forecast. Reqpath="+req.path);
    const result = await nws.GetHourlyForecast(req.params.gridId, req.params.gridX, req.params.gridY, req.params.units);
    res.status(200).json(result);
});

// Section 4: Endpoint for server-side IP geolocation, used when DEFAULT_LOCATION=AUTOMATIC
// in .env resolves a starting zip code from the server's own public IP.
app.get('/geoip/lookup', async (req, res) => {
    console.log("SS Endpoint /geoip/lookup. Reqpath="+req.path);
    const result = await ipgeo.GetIPLocation();
    res.status(200).json(result);
});

// Section 5: /stream/* (the optional intellistar-stream container's HLS output) is
// registered above, near express.static('.'), since it's just a static file route --
// see the comment there. Nothing dynamic needed here; the route only serves what
// actually exists in ./stream_output, so it's harmlessly absent/404 if that container
// isn't running.

// General web server listen function (listen on ports for requests)
app.listen(port, host, () => {
    console.log("------------------------------------------");
    const aIPList = getIP4Addresses();
    for (let i = 0; i < aIPList.length; i++) {
        console.log(`Local on the 8's Server running on http://${aIPList[i]}:${port}`);
    }
});
