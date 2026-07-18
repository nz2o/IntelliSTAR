// Server-side interface to AirNow-Tech's free, no-API-key national contour map file
// -- a combined ozone+PM2.5 KML, regenerated roughly hourly, covering the whole US --
// used by the optional air-quality contour-map slide (js/AirQualityContourMap.js).
// Unlike AirNowInterface.js's per-location observation/forecast calls, this doesn't
// need an API key at all: it's a static file product, not a rate-limited web service.
// See https://files.airnowtech.org/ (AirNow-Tech's public file listing).
//
// The file is national in scope (~800+ polygons, ~5MB) and only changes roughly
// hourly, so the work here is: fetch + parse it once per cache window (not once per
// request), then crop down to a small bounding box around whatever location actually
// asked, so the client only ever receives the handful of polygons relevant to it.

import { XMLParser } from 'fast-xml-parser';
import bboxClip from '@turf/bbox-clip';

const KML_URL = 'https://files.airnowtech.org/airnow/today/cur_aqi_combined.kml';
const CACHE_MS = 30 * 60 * 1000; // 30 min -- the file's own folder name (e.g. "1hr_Combined_AQI_USA_...") confirms roughly hourly regeneration

// Same official EPA category colors as js/AirQuality.js's AQI_CATEGORIES -- kept as
// an independent copy here (server-side vs. client-side, and keyed by the KML's own
// style-id spelling, e.g. "UnhealthySG", rather than AirNow's JSON API's
// Category.Number) rather than sharing a module, since the two are looked up by
// different keys from different data shapes.
const CATEGORY_COLORS = {
  Good: '#00E400',
  Moderate: '#FFFF00',
  UnhealthySG: '#FF7E00',
  Unhealthy: '#FF0000',
  VeryUnhealthy: '#8F3F97',
  Hazardous: '#7E0023',
  Unavailable: '#CCCCCC',
};
const CATEGORY_LABELS = {
  Good: 'Good',
  Moderate: 'Moderate',
  UnhealthySG: 'Unhealthy for Sensitive Groups',
  Unhealthy: 'Unhealthy',
  VeryUnhealthy: 'Very Unhealthy',
  Hazardous: 'Hazardous',
  Unavailable: 'Unavailable',
};

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseRing(coordinatesText) {
  return coordinatesText.trim().split(/\s+/).map((triplet) => {
    const [lon, lat] = triplet.split(',');
    return [Number(lon), Number(lat)];
  });
}

function ringBbox(ring) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function parsePolygon(polygon) {
  const rings = [parseRing(polygon.outerBoundaryIs.LinearRing.coordinates)];
  for (const hole of toArray(polygon.innerBoundaryIs)) {
    rings.push(parseRing(hole.LinearRing.coordinates));
  }
  return rings;
}

async function fetchAndParseNational() {
  const response = await fetch(KML_URL);
  if (!response.ok) {
    throw new Error(`AirNow contour KML fetch failed with HTTP ${response.status}`);
  }
  let text = await response.text();

  // Strip <description> blocks (an HTML info-window blob repeated in every one of
  // the ~800+ Placemarks, not used here at all) before parsing -- their combined
  // &nbsp;/&amp; entity count on a file this size trips fast-xml-parser's built-in
  // entity-expansion safety limit (1000) otherwise. Stripping first avoids needing
  // to loosen that limit, and roughly halves parse time as a side benefit.
  text = text.replace(/<description[^>]*>[\s\S]*?<\/description>/g, '');

  const parsed = xmlParser.parse(text);
  const placemarks = toArray(parsed?.kml?.Document?.Folder?.Placemark);

  const features = [];
  for (const placemark of placemarks) {
    const category = (placemark.styleUrl?.['#text'] ?? placemark.styleUrl ?? '').replace('#', '');
    // "Invisible" is a fully-transparent filler style with no informational value at
    // all -- everything else (including "Unavailable", areas with no current data)
    // is kept, since that's still meaningful to show as "no data here" on the map.
    if (!category || category === 'Invisible' || !placemark.Polygon) continue;
    try {
      const rings = parsePolygon(placemark.Polygon);
      features.push({
        type: 'Feature',
        properties: {
          category,
          label: CATEGORY_LABELS[category] || category,
          color: CATEGORY_COLORS[category] || '#888888',
        },
        geometry: { type: 'Polygon', coordinates: rings },
        _bbox: ringBbox(rings[0]), // outer ring only -- good enough for a coarse crop pre-filter, not exposed to the client
      });
    } catch {
      // one malformed polygon shouldn't sink parsing the other 800+ -- skip it
    }
  }
  return features;
}

let cachedFeatures = null;
let cachedAt = 0;

async function getNationalFeatures() {
  if (cachedFeatures && (Date.now() - cachedAt) < CACHE_MS) {
    return cachedFeatures;
  }
  try {
    const features = await fetchAndParseNational();
    cachedFeatures = features;
    cachedAt = Date.now();
  } catch (err) {
    console.log('AirNowContourInterface: national KML fetch/parse failed (non-fatal, serving cache if any):', err.message);
    if (!cachedFeatures) return [];
  }
  return cachedFeatures;
}

// The contour slide's map container is a wide landscape shape (~2.9:1, see
// #air-quality-contour-container in css/airquality.css) -- querying a SQUARE box
// around the location (as this used to) means js/AirQualityContourMap.js's
// fitBounds() has to zoom out to fit the query box's height into that shape,
// leaving wide empty margins left/right even when the data fills the box, which is
// exactly the "map wider than the data" symptom. Shaping the query box itself to
// roughly match the container -- wider in longitude, shorter in latitude -- instead
// of a symmetric box fixes that at the source: the fetched data's own extent is
// already close to the shape the map view needs, so there's much less left for
// fitBounds to pad out. (Total area is actually slightly smaller than the old 5x5
// box, not larger -- this is a reshape, not an expansion.)
const BBOX_LON_DEGREES = 3.5; // ~220mi at mid-latitude longitude
const BBOX_LAT_DEGREES = 1.5; // ~105mi latitude

function bboxIntersects(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

// Returns a GeoJSON-ready feature array (each with a color/category/label already
// resolved) for whatever polygons overlap a box centered on (lat, lon) -- empty
// array if the national file isn't available yet/at all, or genuinely has nothing
// covering that area. js/AirQualityContourMap.js hides the slide in either case.
export async function GetContoursNear(lat, lon) {
  if (lat == null || lon == null) return [];
  const features = await getNationalFeatures();
  if (features.length === 0) return [];

  const box = [
    Number(lon) - BBOX_LON_DEGREES, Number(lat) - BBOX_LAT_DEGREES,
    Number(lon) + BBOX_LON_DEGREES, Number(lat) + BBOX_LAT_DEGREES,
  ];

  const result = [];
  for (const feature of features) {
    if (!bboxIntersects(feature._bbox, box)) continue;

    // The national file's own polygons aren't drawn per-city -- some cover a huge
    // multi-state region as a single shape (thousands of coordinate pairs) wherever
    // the underlying air quality is uniform. Just filtering by "does this feature's
    // bbox overlap the local box" (as above) still lets a whole such polygon through
    // even though only a sliver of it is actually near this location -- bboxClip()
    // here truncates the geometry itself to the local box, so the response stays
    // small (a handful of points) regardless of how large the source polygon is.
    const { _bbox, ...feature_ } = feature;
    let clipped;
    try {
      clipped = bboxClip(feature_, box);
    } catch {
      continue; // a small number of self-intersecting source polygons fail to clip cleanly -- skip rather than fail the whole request
    }
    if (clipped.geometry.coordinates.length === 0) continue; // bbox check was a coarse pre-filter -- this one can still come back empty
    clipped.properties = feature_.properties;
    result.push(clipped);
  }
  return result;
}
