// Server-side interface to the free NWS api.weather.gov API (US only), plus the free
// api.zippopotam.us zip geocoder. Calls are made here (not from the browser) because
// browsers forbid client-side JS from setting the User-Agent header, and NWS asks API
// callers to self-identify via that header.

const USER_AGENT = process.env.NWS_USER_AGENT || 'IntelliSTAR-Weather-Emulator (no-contact-set)';
const NWS_HEADERS = { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' };

// Resolve a US zip code to lat/lon + place name.
export async function GetZipLocation(zip) {
  const response = await fetch(`https://api.zippopotam.us/us/${zip}`);

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
}

// Resolve a 4-letter ICAO airport/station code to lat/lon + station name.
// For US airports this ICAO code doubles as the NWS observation station ID.
export async function GetStation(icao) {
  const response = await fetch(`https://api.weather.gov/stations/${icao}`, { headers: NWS_HEADERS });

  if (!response.ok) {
    throw new Error("GetStation: response status:"+response.status);
  }

  const data = await response.json();
  return {
    lat: data.geometry.coordinates[1],
    lon: data.geometry.coordinates[0],
    name: data.properties.name,
  };
}

// Resolve lat/lon to the NWS forecast gridpoint (office + grid x/y) that covers it.
export async function GetPoints(lat, lon) {
  const response = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers: NWS_HEADERS });

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
}

// Find the nearest observation station for a forecast gridpoint (used for POSTAL/zip
// mode, where there's no airport ICAO code to use directly as the station ID).
export async function GetNearestStation(gridId, gridX, gridY) {
  const response = await fetch(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/stations`, { headers: NWS_HEADERS });

  if (!response.ok) {
    throw new Error("GetNearestStation: response status:"+response.status);
  }

  const data = await response.json();
  return data.features[0].properties.stationIdentifier;
}

// Get the most recent `limit` observations for a station, newest first.
// limit=1 for current conditions, limit=2 to derive a rising/falling pressure trend.
export async function GetObservations(stationId, limit) {
  const response = await fetch(`https://api.weather.gov/stations/${stationId}/observations?limit=${limit}`, { headers: NWS_HEADERS });

  if (!response.ok) {
    throw new Error("GetObservations: response status:"+response.status);
  }

  const data = await response.json();
  return data.features;
}

// Get the 12-hour day/night forecast periods for a gridpoint. units is "us" (imperial)
// or "si" (metric) — NWS converts server-side, no manual unit math needed here.
export async function GetGridForecast(gridId, gridX, gridY, units) {
  const response = await fetch(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast?units=${units}`, { headers: NWS_HEADERS });

  if (!response.ok) {
    throw new Error("GetGridForecast: response status:"+response.status);
  }

  const data = await response.json();
  return data.properties.periods;
}

// Get active alerts for a lat/lon point. Returns the raw GeoJSON FeatureCollection —
// same shape the client previously parsed directly from api.weather.gov.
export async function GetAlerts(lat, lon) {
  const response = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, { headers: NWS_HEADERS });

  if (!response.ok) {
    throw new Error("GetAlerts: response status:"+response.status);
  }

  return await response.json();
}
