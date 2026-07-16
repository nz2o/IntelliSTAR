// Closing traffic-conditions slide ("traffic-page", shown just before the outro) --
// a non-interactive Leaflet map centered on the current location, with TomTom's
// Traffic Flow tiles overlaid on an OpenStreetMap basemap, same look as the CWA
// Local Hazards panel/regional radar page. See js/CWAWarningsMap.js and
// js/RadarLeafletIEM.js for the same non-interactive-Leaflet-map pattern this
// mirrors.
//
// The TomTom API key never reaches this file (or the browser at all) -- the tile
// layer below points at this server's own /traffic/tile/:z/:x/:y proxy route (see
// server.js/TomTomInterface.js), which holds the key server-side and does its own
// caching/budget/schedule management.
import { globalConfig } from '../common_configuration.js';
import { addGPSMarker } from './GPSMarker.js';

let map;

// Local hour-of-day (0-23.999...) at `timeZone` -- same approach as
// TomTomInterface.js's localHourOfDay() server-side (kept independent rather than
// shared, since one runs in the browser and one in Node). Falls back to this
// browser's own local hour if timeZone is missing (e.g. not resolved yet).
function localHourOfDay(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || undefined,
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const hour = Number(parts.find(p => p.type === 'hour').value);
    const minute = Number(parts.find(p => p.type === 'minute').value);
    return hour + minute / 60;
  } catch {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }
}

function isBlackout() {
  const { blackoutStartHour: start, blackoutEndHour: end } = globalConfig.traffic;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return false;
  const hour = localHourOfDay(Weather.timeZone);
  return start < end ? (hour >= start && hour < end) : (hour >= start || hour < end);
}

// Logs an unavailability reason to the browser console (never on-screen -- this is a
// silent diagnostic for whoever opens devtools, not something a viewer should see)
// exactly once per distinct reason, not every single weather-fetch cycle, so a
// persistently missing/broken key doesn't spam the console forever. Resets when the
// slide becomes available again, so a *later* problem still gets logged.
let lastLoggedReason = null;
function logUnavailableOnce(reasonKey, message) {
  if (lastLoggedReason !== reasonKey) {
    console.log('[TrafficMap]', message);
    lastLoggedReason = reasonKey;
  }
}

// Whether the traffic-page should even be in the rotation right now -- checked by
// MainScript.js's scheduleTimeline() each cycle. Two independent gates:
//   - globalConfig.traffic.enabled: set once at page load from whether
//     TOMTOM_TRAFFIC_API_KEY is configured server-side at all (see server.js).
//   - /traffic/status: checked fresh every cycle, since a key can start out fine and
//     later turn out to be invalid/expired/unreachable -- something
//     globalConfig.traffic.enabled (fetched once, at page load) can never reflect.
// Blackout is still checked client-side (no round trip needed -- the client already
// knows the location's own timezone and the configured blackout hours) and is
// deliberately NOT logged: it's an expected, intentional daily state, not a problem.
export async function trafficSlideAvailable() {
  if (!globalConfig.traffic.enabled) {
    logUnavailableOnce('not-configured', 'Traffic slide disabled: no TomTom API key configured on the server (TOMTOM_TRAFFIC_API_KEY in .env).');
    return false;
  }
  if (isBlackout()) {
    return false;
  }
  try {
    const response = await fetch('/traffic/status');
    const status = await response.json();
    if (!status.available) {
      logUnavailableOnce('not-working', 'Traffic slide hidden: the server reports the TomTom API key is invalid, expired, or TomTom is unreachable. Check the server-side console log for details.');
      return false;
    }
  } catch (err) {
    logUnavailableOnce('status-check-failed', `Traffic slide hidden: could not reach this server's own /traffic/status route (${err.message}).`);
    return false;
  }
  lastLoggedReason = null; // available again -- a future problem should log fresh
  return true;
}

// Builds (or rebuilds) the traffic map for the current location. Called once per
// weather-fetch cycle from WeatherFetching.js, same as the radar pages -- cheap to
// rebuild since the actual tile fetching/caching/budget work all lives server-side
// (see TomTomInterface.js), this just re-creates the Leaflet view.
export async function buildTrafficMap(lat, lon) {
  if (map) {
    map.remove();
    map = null;
  }
  if (!(await trafficSlideAvailable())) return;

  map = L.map('traffic-container', {
    attributionControl: false,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    tap: false,
  }).setView([lat, lon], globalConfig.radar.zoomLevelLocal);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const tz = encodeURIComponent(Weather.timeZone || '');
  L.tileLayer(`/traffic/tile/{z}/{x}/{y}?tz=${tz}`, {
    opacity: 0.8,
  }).addTo(map);

  addGPSMarker(map, lat, lon);
}
