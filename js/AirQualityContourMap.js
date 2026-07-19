// Optional air-quality contour-map slide ("air-quality-contour-page", shown right
// after the main air-quality slide, before the outro) -- combined ozone/PM2.5
// contour polygons from AirNow-Tech's free public KML file product, cropped to a box
// around the current location, over an OpenStreetMap basemap. See
// AirNowContourInterface.js/server.js for the server-side fetch/parse/clip pipeline
// (no API key needed for this specific data source, but still gated on AirNow being
// configured at all, same as the main air-quality slide -- see server.js).
import { globalConfig } from '../common_configuration.js';
import { addGPSMarker } from './GPSMarker.js';

let map;
let latestFeatures = [];

// Fetches fresh contour polygons for the current location -- called from
// WeatherFetching.js as fire-and-forget, same as buildTrafficMap() (this involves a
// multi-MB file download + parse server-side on a cold cache -- see
// AirNowContourInterface.js -- which has no business blocking the whole
// presentation from starting; it used to be awaited here, which is exactly what
// made the presentation visibly hang on load, especially right after a server
// restart with an empty cache). airQualityContourSlideAvailable() below is
// therefore checked synchronously by scheduleTimeline() before this necessarily
// finishes -- deliberately NOT clearing latestFeatures up front (only ever
// overwritten once a new result, success or empty, actually arrives) so that
// synchronous check reads the previous cycle's still-valid data instead of a
// freshly-wiped empty array. In practice this means the slide's on/off state lags
// the real data by about one loop cycle, never zero.
export async function fetchAirQualityContours(lat, lon) {
  if (!globalConfig.airQuality.enabled || lat == null || lon == null) {
    latestFeatures = [];
    return false;
  }

  let newFeatures;
  try {
    const response = await fetch(`/airquality/contours?lat=${lat}&lon=${lon}`);
    newFeatures = await response.json();
  } catch (err) {
    console.log('[AirQualityContourMap] fetch failed (non-fatal, leaving previous data in place):', err.message);
    return latestFeatures.length > 0;
  }
  latestFeatures = newFeatures;

  if (latestFeatures.length === 0) {
    console.log('[AirQualityContourMap] Contour slide hidden: no contour data available near this location.');
    return false;
  }
  return true;
}

// Synchronous -- same pattern as airQualitySlideAvailable() in js/AirQuality.js.
export function airQualityContourSlideAvailable() {
  return latestFeatures.length > 0;
}

function buildContourLegend() {
  const seen = new Map(); // category -> {label, color}, in first-seen order
  for (const feature of latestFeatures) {
    seen.set(feature.properties.category, feature.properties);
  }
  getElement('air-quality-contour-legend').innerHTML = Array.from(seen.values()).map((p) => {
    return `<div class="aqi-legend-item">`
      + `<span class="aqi-legend-swatch" style="background:${p.color}"></span>`
      + `<span>${p.label}</span>`
      + `</div>`;
  }).join('');
}

// Builds (or rebuilds) the contour map -- called once per weather-fetch cycle from
// WeatherFetching.js, same pattern as the traffic/CWA maps. No-op (leaves any
// previous map torn down) if there's nothing to show this cycle.
export function buildAirQualityContourMap(lat, lon) {
  if (map) {
    map.remove();
    map = null;
  }
  if (latestFeatures.length === 0) return;

  map = L.map('air-quality-contour-container', {
    attributionControl: false,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    tap: false,
    // Continuous (not whole-level) zoom so fitBounds() below can zoom in to the
    // exact fit -- see the identical fix (and its "why") in CWAWarningsMap.js.
    zoomSnap: 0,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const geoJsonLayer = L.geoJSON(latestFeatures, {
    style: (feature) => ({
      color: feature.properties.color,
      weight: 1,
      fillColor: feature.properties.color,
      fillOpacity: 0.45,
    }),
  }).addTo(map);

  addGPSMarker(map, lat, lon);

  map.invalidateSize();
  map.fitBounds(geoJsonLayer.getBounds(), { padding: [10, 10] });

  buildContourLegend();
}
