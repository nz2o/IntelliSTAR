// Server-side interface to the EPA's free AirNow API (US only), used by the closing
// air-quality slide (js/AirQuality.js) -- current AQI observations plus a breakdown
// by pollutant (ozone, PM2.5, PM10/dust, etc.), and the day's forecast. The API key
// never reaches the browser -- the client only ever talks to this server's own
// /airquality/* routes (see server.js).
//
// Per lat/lon, preferred, with zip code as a fallback (only relevant for AIRPORT-mode
// locations without a zip, or if lat/lon somehow isn't resolved yet) -- see
// buildQuery() below.
//
// Caching follows AirNow's own published best practices (docs.airnowapi.org/faq):
// "air quality observations are updated once per hour and forecasts are issued once
// per day... we recommend users cache daily or hourly." OBS_CACHE_MS/FORECAST_CACHE_MS
// below do exactly that, keyed per query so different locations don't share a cache
// entry. This -- not a fixed request-per-hour counter -- is what keeps this well
// within AirNow's rate limits: however often the app internally re-checks (once per
// loop cycle), the same location's data is only actually re-fetched from AirNow once
// the cache for that exact query goes stale.

const API_KEY = process.env.AIRNOW_API_KEY || '';
const DISTANCE_MILES = 25; // default search radius for a nearby monitor, same as AirNow's own examples

const OBS_CACHE_MS = 60 * 60 * 1000; // 1 hour -- matches AirNow's own hourly observation cadence
const FORECAST_CACHE_MS = 24 * 60 * 60 * 1000; // 1 day -- forecasts are issued once/day

export function isConfigured() {
  return API_KEY !== '';
}

// Same latch-on-401/403 pattern as TomTomInterface.js's isWorking() -- once AirNow
// itself rejects the key, there's no point retrying it against the same key.
let keyInvalid = false;

const obsCache = new Map(); // "latLong:lat,lon" or "zipCode:zip" -> { data, timestamp }
const forecastCache = new Map();

// Prefers lat/lon (always available by the time this is called, resolved the same
// place the radar/traffic/background-photo lookups are) over zip (only present in
// POSTAL mode) -- see js/AirQuality.js for how it's called. Returns null if neither
// is usable, so callers can short-circuit to "no data" without an empty request.
function buildQuery(lat, lon, zip) {
  if (lat != null && lon != null && lat !== '' && lon !== '') {
    return { endpoint: 'latLong', cacheKey: `latLong:${lat},${lon}`, params: `latitude=${lat}&longitude=${lon}` };
  }
  if (zip) {
    return { endpoint: 'zipCode', cacheKey: `zipCode:${zip}`, params: `zipCode=${zip}` };
  }
  return null;
}

async function fetchAirNow(url) {
  const response = await fetch(url); // network-level failures propagate to the caller -- see cachedFetch()
  if (response.status === 401 || response.status === 403) {
    if (!keyInvalid) {
      keyInvalid = true;
      console.log(
        `AirNowInterface: AirNow rejected the API key (HTTP ${response.status}) -- treating it as invalid.`,
        'The air-quality slides will stay hidden until this is corrected and the server is restarted.'
      );
    }
    throw new Error(`AirNow rejected the API key (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`AirNow request failed with HTTP ${response.status}`);
  }
  const data = await response.json();
  // A location with no nearby monitor legitimately returns an empty array (verified
  // live) -- that's real data, not a failure, and gets cached like any other result.
  return Array.isArray(data) ? data : [];
}

// Cache wrapper deliberately does NOT cache thrown errors (invalid key, network
// blip, non-2xx) -- only successful responses (including legitimate empty-array "no
// data here" results) get a fresh timestamp, so a transient failure doesn't lock in
// "no data" for the full cache window. A failure instead falls back to whatever's
// already cached (possibly stale, better than nothing) or an empty array.
async function cachedFetch(cache, key, ttlMs, producer) {
  const entry = cache.get(key);
  if (entry && (Date.now() - entry.timestamp) < ttlMs) {
    return entry.data;
  }
  try {
    const data = await producer();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.log('AirNowInterface: request failed (non-fatal, serving cache if any):', err.message);
    return entry ? entry.data : [];
  }
}

// Current AQI observations for the location -- one entry per pollutant actually
// monitored nearby (commonly O3 and/or PM2.5, sometimes PM10/CO/SO2/NO2 depending on
// what's instrumented in that area). Empty array means either AirNow isn't
// configured/working, or -- just as likely for a smaller town -- there's simply no
// monitor within DISTANCE_MILES; js/AirQuality.js treats both the same way (hide the
// slide), since there's nothing meaningful to show either way.
export async function GetCurrentObservations(lat, lon, zip) {
  if (!isConfigured() || keyInvalid) return [];
  const query = buildQuery(lat, lon, zip);
  if (!query) return [];
  return cachedFetch(obsCache, `obs:${query.cacheKey}`, OBS_CACHE_MS, () => {
    const url = `https://www.airnowapi.org/aq/observation/${query.endpoint}/current/`
      + `?format=application/json&${query.params}&distance=${DISTANCE_MILES}&API_KEY=${API_KEY}`;
    return fetchAirNow(url);
  });
}

// Today/tomorrow's forecast AQI + category + a short text discussion per pollutant.
export async function GetForecast(lat, lon, zip) {
  if (!isConfigured() || keyInvalid) return [];
  const query = buildQuery(lat, lon, zip);
  if (!query) return [];
  return cachedFetch(forecastCache, `forecast:${query.cacheKey}`, FORECAST_CACHE_MS, () => {
    const url = `https://www.airnowapi.org/aq/forecast/${query.endpoint}/`
      + `?format=application/json&${query.params}&distance=${DISTANCE_MILES}&API_KEY=${API_KEY}`;
    return fetchAirNow(url);
  });
}
