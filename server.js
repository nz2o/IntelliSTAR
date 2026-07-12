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
import fs from 'node:fs';

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
  const dwellSeconds = Number(process.env.NARRATION_DWELL_SECONDS);
  if (!Number.isNaN(dwellSeconds)) {
    configSource = configSource.replace(
      /narrationDwellMs:\s*\d+/,
      `narrationDwellMs: ${dwellSeconds * 1000}`
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
  res.type('application/javascript').send(configSource);
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

// General web server listen function (listen on ports for requests)
app.listen(port, host, () => {
    console.log("------------------------------------------");
    const aIPList = getIP4Addresses();
    for (let i = 0; i < aIPList.length; i++) {
        console.log(`Local on the 8's Server running on http://${aIPList[i]}:${port}`);
    }
});
