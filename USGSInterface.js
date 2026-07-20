// Server-side interface to the USGS Earthquake Hazards Program's free, keyless
// fdsnws-event API, used by the closing seismic-activity slide (js/SeismicActivity.js)
// -- recent earthquakes within a radius of the current location. No API key needed
// (unlike TomTom/AirNow), so this is gated on a plain on/off toggle (SEISMIC_ENABLED
// in .env -> common_configuration.js's seismic.enabled, see server.js) rather than
// key presence.
//
// USGS doesn't publish an explicit "cache for N minutes" recommendation the way
// AirNow does, but their own feeds are only regenerated every ~1-5 minutes -- CACHE_MS
// below caches a given query (radius/magnitude are fixed per deployment, so the cache
// key is effectively just lat/lon) comfortably past that, which is what keeps this
// from re-hitting USGS on every client poll.
//
// "Forecast" earthquake activity isn't a thing USGS (or anyone) actually offers --
// see the conversation that led to this file -- so this only ever shows what's
// already happened, same as the rest of this app's "current conditions" framing.

import { recordFetch } from './DataFreshness.js';

const RADIUS_KM = 500; // wide enough to catch regional activity even away from a plate boundary
const MIN_MAGNITUDE = 2.5; // roughly USGS's own "commonly felt" threshold
const LOOKBACK_DAYS = 7;
const RESULT_LIMIT = 10; // plenty for a scrollable slide list without an unbounded response

const CACHE_MS = 15 * 60 * 1000; // 15 minutes -- comfortably past USGS's own feed regeneration cadence

const cache = new Map(); // "lat,lon" -> { data, timestamp }

function buildQuery(lat, lon) {
  if (lat == null || lon == null || lat === '' || lon === '') return null;
  return { cacheKey: `${lat},${lon}` };
}

async function fetchUSGS(lat, lon) {
  const startTime = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
    + `?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=${RADIUS_KM}`
    + `&minmagnitude=${MIN_MAGNITUDE}&starttime=${startTime}&orderby=time&limit=${RESULT_LIMIT}`;
  const response = await fetch(url); // network-level failures propagate to the caller -- see cachedFetch()
  if (!response.ok) {
    throw new Error(`USGS request failed with HTTP ${response.status}`);
  }
  const data = await response.json();
  recordFetch('seismic'); // freshness signal for the client's #api-last-updated panel -- see DataFreshness.js

  // Reshape to just what js/SeismicActivity.js actually uses -- USGS's own GeoJSON
  // Feature wrapper (id/geometry/properties nesting) has no reason to leak to the
  // client as-is. properties.sig ("significance," USGS's own combined score of
  // magnitude + felt reports + estimated impact -- not just raw magnitude) is what
  // picks the "most significant" event to headline, same idea as AirQuality.js
  // picking the worst pollutant reading rather than just the first one back.
  return (data.features || []).map((f) => ({
    magnitude: f.properties.mag,
    place: f.properties.place,
    time: f.properties.time,
    significance: f.properties.sig,
    tsunami: f.properties.tsunami === 1,
    url: f.properties.url,
    depthKm: f.geometry?.coordinates?.[2] ?? null,
  }));
}

// Cache wrapper deliberately does NOT cache thrown errors -- only a successful
// response (including a legitimate empty "nothing nearby recently" result) gets a
// fresh timestamp, so a transient USGS outage doesn't lock in "no activity" for the
// full cache window. A failure instead falls back to whatever's already cached
// (possibly stale, better than nothing) or an empty array.
async function cachedFetch(key, producer) {
  const entry = cache.get(key);
  if (entry && (Date.now() - entry.timestamp) < CACHE_MS) {
    return entry.data;
  }
  try {
    const data = await producer();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.log('USGSInterface: request failed (non-fatal, serving cache if any):', err.message);
    return entry ? entry.data : [];
  }
}

// Recent earthquakes (within RADIUS_KM/MIN_MAGNITUDE/LOOKBACK_DAYS above) for the
// location, most recent first. Empty array means either the feature is disabled (see
// server.js) or -- just as likely for most of the US away from a plate boundary --
// there simply hasn't been any qualifying activity nearby; js/SeismicActivity.js
// treats both the same way (hide the slide), since there's nothing to show either way.
export async function GetRecentEarthquakes(lat, lon) {
  const query = buildQuery(lat, lon);
  if (!query) return [];
  return cachedFetch(query.cacheKey, () => fetchUSGS(lat, lon));
}
