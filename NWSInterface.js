// Server-side interface to the free NWS api.weather.gov API (US only), plus the free
// api.zippopotam.us zip geocoder. Calls are made here (not from the browser) because
// browsers forbid client-side JS from setting the User-Agent header, and NWS asks API
// callers to self-identify via that header.

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

async function rateLimited(key, producer) {
  const entry = lastFetch.get(key);
  if (entry && (Date.now() - entry.timestamp) < NWS_MIN_INTERVAL_MS) {
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
    };
  });
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

// Get active alerts for a lat/lon point. Returns the raw GeoJSON FeatureCollection —
// same shape the client previously parsed directly from api.weather.gov.
export async function GetAlerts(lat, lon) {
  return rateLimited(`alerts:${lat},${lon}`, async () => {
    const response = await fetchWithRetry(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, { headers: NWS_HEADERS });

    if (!response.ok) {
      throw new Error("GetAlerts: response status:"+response.status);
    }

    return await response.json();
  });
}
