// Server-side interface to the free NWS api.weather.gov API (US only), plus the free
// api.zippopotam.us zip geocoder. Calls are made here (not from the browser) because
// browsers forbid client-side JS from setting the User-Agent header, and NWS asks API
// callers to self-identify via that header.

import turfUnion from '@turf/union';
import { featureCollection as turfFeatureCollection } from '@turf/helpers';

const USER_AGENT = process.env.NWS_USER_AGENT || 'IntelliSTAR-Weather-Emulator (no-contact-set)';
const NWS_HEADERS = { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' };

// Retry policy for transient failures (network blips, NWS/zippopotam having a bad
// moment, rate limiting) -- a handful of attempts with growing delays between them,
// not a tight loop, so a flaky moment doesn't hammer either free public API. A 4xx
// response (bad zip, unknown station, etc.) is not retried -- trying the same bad
// request again won't produce a different result, so those fail immediately instead.
const RETRY_DELAYS_MS = [500, 2000, 5000];

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response; // success, or a client error that a retry can't fix
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err; // network-level failure (DNS, connection reset, TLS, etc.)
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      const jitterMs = Math.random() * 250;
      console.log(`NWSInterface: retrying ${url} after ${lastError.message} (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt] + jitterMs));
    }
  }
  throw lastError;
}

// Rate limiter for outbound NWS/zippopotam calls, keyed per distinct request (e.g.
// per zip code, per gridpoint). This is a hard limit, not a performance cache: no
// matter how often the client asks for the same thing -- every loop cycle, multiple
// viewers/devices pointed at this server, several requests landing at once -- this
// module will not make more than one outbound call per NWS_MIN_INTERVAL_MS for that
// exact request. Everything in between is served the last successful result. NWS's
// own API docs recommend caching grid data specifically to "reduce the additional
// lookup request", and separately note that proxies (which is exactly what this
// server is, on behalf of every viewer) are more likely to hit rate limits than
// direct client calls -- this is what keeps that true regardless of how demanding
// the client side (looping, multiple tabs, etc.) gets.
//
// Concurrent requests for the same key are deduplicated onto a single in-flight
// promise (rather than each independently kicking off its own outbound call and only
// de-duplicating *after* the fact) so the "at most one call per window" guarantee
// holds even under simultaneous access. A failed attempt is not retained -- the next
// request past NWS_MIN_INTERVAL_MS naturally tries again via fetchWithRetry(),
// instead of this limiter serving a stale error for the rest of the window.
const NWS_MIN_INTERVAL_MS = (Number(process.env.NWS_MIN_INTERVAL_SECONDS) || 60) * 1000;
const lastFetch = new Map(); // key -> { promise, timestamp }

// intervalMs defaults to the standard NWS_MIN_INTERVAL_MS window, but callers whose
// data essentially never changes (e.g. CWA/county boundary geometry -- see
// GetCWABoundary below) can pass a much longer one instead, so it's cached for the
// life of the server process instead of being refetched every minute for no reason.
async function rateLimited(key, producer, intervalMs = NWS_MIN_INTERVAL_MS) {
  const entry = lastFetch.get(key);
  if (entry && (Date.now() - entry.timestamp) < intervalMs) {
    return entry.promise; // in-flight or already resolved -- no new outbound call
  }
  const promise = producer();
  lastFetch.set(key, { promise, timestamp: Date.now() });
  try {
    return await promise;
  } catch (err) {
    lastFetch.delete(key); // don't hold the window open on a failed attempt
    throw err;
  }
}

// Resolve a US zip code to lat/lon + place name.
export async function GetZipLocation(zip) {
  return rateLimited(`zip:${zip}`, async () => {
    const response = await fetchWithRetry(`https://api.zippopotam.us/us/${zip}`);

    if (!response.ok) {
      throw new Error("GetZipLocation: response status:"+response.status);
    }

    const data = await response.json();
    const place = data.places[0];
    return {
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      city: place['place name'],
    };
  });
}

// Resolve a 4-letter ICAO airport/station code to lat/lon + station name.
// For US airports this ICAO code doubles as the NWS observation station ID.
export async function GetStation(icao) {
  return rateLimited(`station:${icao}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/stations/${icao}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetStation: response status:"+response.status);
    }

    const data = await response.json();
    return {
      lat: data.geometry.coordinates[1],
      lon: data.geometry.coordinates[0],
      name: data.properties.name,
    };
  });
}

// Resolve lat/lon to the NWS forecast gridpoint (office + grid x/y) that covers it.
export async function GetPoints(lat, lon) {
  return rateLimited(`points:${lat},${lon}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/points/${lat},${lon}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetPoints: response status:"+response.status);
    }

    const data = await response.json();
    const p = data.properties;
    return {
      gridId: p.gridId,
      gridX: p.gridX,
      gridY: p.gridY,
      relativeCity: p.relativeLocation?.properties?.city,
      radarStation: p.radarStation,
      // IANA zone (e.g. "America/Chicago") for the resolved location itself, not this
      // server's own timezone -- used client-side for anything that needs to reason
      // about "local time at the location being displayed" regardless of where the
      // server or viewer's device actually is, e.g. the traffic slide's peak/off-peak/
      // blackout schedule (see js/TrafficMap.js).
      timeZone: p.timeZone,
    };
  });
}

// Resolve a WSR-88D radar site ID (e.g. "KTWX", from GetPoints()'s radarStation field)
// to its physical lat/lon -- used to mark "this is the radar dish the regional map's
// imagery is actually coming from" on the map (see js/RadarStationMarker.js). Site
// locations are effectively permanent, so this is cached the same way as
// GetCWABoundary below rather than refetched every minute.
const RADAR_STATION_CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

export async function GetRadarStation(id) {
  return rateLimited(`radar-station:${id}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/radar/stations/${id}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetRadarStation: response status:"+response.status);
    }

    const data = await response.json();
    return {
      id,
      lat: data.geometry.coordinates[1],
      lon: data.geometry.coordinates[0],
      name: data.properties.name,
    };
  }, RADAR_STATION_CACHE_MS);
}

// Find the nearest observation station for a forecast gridpoint (used for POSTAL/zip
// mode, where there's no airport ICAO code to use directly as the station ID).
export async function GetNearestStation(gridId, gridX, gridY) {
  return rateLimited(`nearest-station:${gridId}:${gridX}:${gridY}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/stations`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetNearestStation: response status:"+response.status);
    }

    const data = await response.json();
    return data.features[0].properties.stationIdentifier;
  });
}

// Get the most recent `limit` observations for a station, newest first.
// limit=1 for current conditions, limit=2 to derive a rising/falling pressure trend.
export async function GetObservations(stationId, limit) {
  return rateLimited(`observations:${stationId}:${limit}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/stations/${stationId}/observations?limit=${limit}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetObservations: response status:"+response.status);
    }

    const data = await response.json();
    return data.features;
  });
}

// Get the 12-hour day/night forecast periods for a gridpoint. units is "us" (imperial)
// or "si" (metric) — NWS converts server-side, no manual unit math needed here.
export async function GetGridForecast(gridId, gridX, gridY, units) {
  return rateLimited(`forecast:${gridId}:${gridX}:${gridY}:${units}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast?units=${units}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetGridForecast: response status:"+response.status);
    }

    const data = await response.json();
    return data.properties.periods;
  });
}

// Get hour-by-hour forecast periods for a gridpoint (up to ~7 days out, though the
// client only uses the first 48 for the 2-day hourly forecast chart). units is "us"
// (imperial) or "si" (metric), same as GetGridForecast.
export async function GetHourlyForecast(gridId, gridX, gridY, units) {
  return rateLimited(`hourly-forecast:${gridId}:${gridX}:${gridY}:${units}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly?units=${units}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetHourlyForecast: response status:"+response.status);
    }

    const data = await response.json();
    return data.properties.periods;
  });
}

// NWS's own "active" alerts feed keeps an entry around for a little while after it's
// really over: a formal VTEC action of EXP (expired) or CAN (cancelled) means the
// issuing office has already closed the event out, even though the feature is still
// technically present in /alerts/active and its own expires/ends timestamp hasn't
// necessarily elapsed yet (verified live -- e.g. an Extreme Heat Warning showing
// VTEC action EXP with an `ends` timestamp still ~15 minutes in the future). Alerts
// without a VTEC code at all (non-P-VTEC products like Special Weather Statements)
// pass through unfiltered -- there's no cancellation signal to check for those.
// Applied once here, server-side, rather than duplicated in every client that
// consumes alerts (the Alerts page, the CWA warnings panel, the radar overlay).
function isAlertStillInEffect(feature) {
  const vtec = feature?.properties?.parameters?.VTEC?.[0];
  if (!vtec) return true;
  const action = vtec.match(/^\/O\.([A-Z]+)\./)?.[1];
  return action !== 'EXP' && action !== 'CAN';
}

function filterActiveFeatures(geojson) {
  if (!geojson?.features) return geojson;
  return { ...geojson, features: geojson.features.filter(isAlertStillInEffect) };
}

// Get active alerts for a lat/lon point. Returns the raw GeoJSON FeatureCollection —
// same shape the client previously parsed directly from api.weather.gov.
export async function GetAlerts(lat, lon) {
  return rateLimited(`alerts:${lat},${lon}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetAlerts: response status:"+response.status);
    }

    return filterActiveFeatures(await response.json());
  });
}

// Get all currently active Tornado/Severe Thunderstorm/Flash Flood Warnings nationwide,
// full GeoJSON including polygon geometry and CAP severity parameters — used for the "2
// Hour Regional Radar" page's warning-polygon overlay (see RadarWarningOverlay.js on
// the client). Deliberately NOT scoped to a lat/lon like GetAlerts() above: NWS's
// point-based query only returns alerts whose polygon covers the exact point queried,
// which would miss a warning polygon visible elsewhere on the radar map but not
// covering the viewer's own location. This is a small, nationwide dataset even during
// active severe weather (typically a few dozen features at most), so fetching it
// unfiltered and letting Leaflet clip to whatever's actually in view is simpler and
// more correct than trying to bound the query server-side.
export async function GetActiveWarnings() {
  return rateLimited('active-warnings', async () => {
    const response = await fetchWithRetry(
      'https://api.weather.gov/alerts/active?event=Tornado%20Warning,Severe%20Thunderstorm%20Warning,Flash%20Flood%20Warning',
      { headers: NWS_HEADERS }
    );

    if (!response.ok) {
      throw new Error("GetActiveWarnings: response status:"+response.status);
    }

    return filterActiveFeatures(await response.json());
  });
}

// Fetches up to `limit` promises concurrently at a time instead of all at once --
// used below to pull down a CWA's ~40-80 individual county/forecast-zone geometries
// without bursting that many simultaneous requests at NWS at once.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const CWA_BOUNDARY_CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week -- office/zone boundaries essentially never change

// Get the full set of county AND public-forecast-zone boundary polygons that make up
// a CWA (NWS Weather Forecast Office area of responsibility), as one GeoJSON
// FeatureCollection -- used for the persistent CWA warnings map panel (see
// CWAWarningsMap.js on the client) to draw county outlines and, for zone-only alerts
// with no polygon of their own, to know which shape(s) to highlight.
//
// Both county AND forecast-zone geometry are fetched (not just county) because NWS
// files some alert types (e.g. Winter Storm Warning) against forecast zones rather
// than counties -- without also having forecast-zone shapes on hand, a zone-only alert
// filed that way would have nothing to highlight against.
//
// Cached for a full week (see rateLimited()'s intervalMs param) rather than the usual
// 60s window: this is dozens of individual NWS requests (one per county/zone) for data
// that realistically never changes between server restarts, let alone within a week --
// treating it like every other 60s-cached NWS call would mean needlessly re-fetching
// ~80 resources every minute this panel is on screen.
export async function GetCWABoundary(officeId) {
  return rateLimited(`cwa-boundary:${officeId}`, async () => {
    const officeResponse = await fetchWithRetry(`https://api.weather.gov/offices/${officeId}`, { headers: NWS_HEADERS });
    if (!officeResponse.ok) {
      throw new Error("GetCWABoundary: offices response status:"+officeResponse.status);
    }
    const office = await officeResponse.json();

    const zoneRefs = [
      ...(office.responsibleCounties || []).map(url => ({ type: 'county', url })),
      ...(office.responsibleForecastZones || []).map(url => ({ type: 'forecast', url })),
    ];

    const features = await mapWithConcurrency(zoneRefs, 5, async ({ type, url }) => {
      const zoneResponse = await fetchWithRetry(url, { headers: NWS_HEADERS });
      if (!zoneResponse.ok) {
        console.log(`GetCWABoundary: skipping ${url}, response status:`, zoneResponse.status);
        return null;
      }
      const zone = await zoneResponse.json();
      return {
        type: 'Feature',
        geometry: zone.geometry,
        properties: { ugc: zone.properties.id, name: zone.properties.name, zoneType: type },
      };
    });

    const cleanFeatures = features.filter(f => f && f.geometry);

    // A single merged outline of the whole CWA (the county shapes' shared internal
    // edges dissolved away), for the warnings map panel's outer boundary line --
    // computed here rather than client-side since it's real CPU work (a few hundred ms
    // for a few dozen counties) done once per office and then cached for a week, same
    // as everything else in this function, instead of repeating it in every browser.
    const countyFeatures = cleanFeatures.filter(f => f.properties.zoneType === 'county');
    let outline = null;
    try {
      if (countyFeatures.length === 1) {
        outline = countyFeatures[0];
      } else if (countyFeatures.length > 1) {
        outline = turfUnion(turfFeatureCollection(countyFeatures));
      }
    } catch (err) {
      console.log(`GetCWABoundary: outline union failed for ${officeId} (non-fatal, panel will just skip the outline):`, err.message);
    }

    return { type: 'FeatureCollection', features: cleanFeatures, outline };
  }, CWA_BOUNDARY_CACHE_MS);
}

// Get active alerts affecting any county/forecast zone within a CWA (see
// GetCWABoundary above for why both zone types are queried) -- unlike GetAlerts()
// (single point) or GetActiveWarnings() (nationwide, 3 severe-weather types only),
// this returns every active alert of every type/severity across the whole CWA, for
// the persistent CWA warnings map panel.
export async function GetCWAWarnings(officeId) {
  const boundary = await GetCWABoundary(officeId); // already cached -- see above
  const zoneCodes = boundary.features.map(f => f.properties.ugc);
  return rateLimited(`cwa-warnings:${officeId}`, async () => {
    const response = await fetchWithRetry(
      `https://api.weather.gov/alerts/active?zone=${zoneCodes.join(',')}`,
      { headers: NWS_HEADERS }
    );
    if (!response.ok) {
      throw new Error("GetCWAWarnings: response status:"+response.status);
    }
    return filterActiveFeatures(await response.json());
  });
}
