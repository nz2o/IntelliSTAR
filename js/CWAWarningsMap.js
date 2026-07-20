// Persistent CWA (County Warning Area) warnings map -- shows the full area of
// responsibility of the NWS Weather Forecast Office serving a location, with county
// outlines, plus any currently active watches/warnings/advisories highlighted within
// it (real polygon geometry where an alert has one, the matching county/zone shape(s)
// filled in otherwise). Lives in the persistent right-side panel (#cwa-panel, see
// index.html/css/cwamap.css) -- always visible, independent of whichever page is
// currently rotating through #content-frame.
//
// Location is resolved in this priority order, each one only used if the one above
// it isn't available:
//   1. A ?lat=/?lon= URL override (e.g. to preview a different area, or on a device
//      where the configured zip/airport is a stand-in location) -- see init() below.
//   2. The configured zip/airport code -- the exact same resolved latitude/longitude
//      the rest of the app (including the regional radar page's own crosshair) uses,
//      pushed in from WeatherFetching.js's fetchForecast() via setResolvedLocation()
//      below once it's resolved, so the two maps are always in agreement. This panel
//      used to ask the browser for its own GPS geolocation by default instead, which
//      could legitimately differ from the zip/airport-derived location the rest of
//      the presentation is built around, showing a different point on the two maps
//      for the same location.
//   3. IP geolocation, as a last resort if the configured zip/airport location
//      hasn't shown up within IP_FALLBACK_DELAY_MS below -- the same infrastructure
//      DEFAULT_LOCATION=AUTOMATIC in .env uses (see IPGeolocationInterface.js/
//      server.js's /geoip/lookup), geocoded into a lat/lon the same way the rest of
//      the app geocodes a zip code. See useIPGeolocationFallback() below.
//
// The panel itself is hidden (not just showing an empty map) during the greeting and
// closing ("It's Amazing Out There"/"Stay Updated") screens -- see
// suppressCWAPanel()/unsuppressCWAPanel(), called from MainScript.js -- and whenever
// the current CWA has no active watches/warnings/advisories at all, since an empty
// county outline with nothing highlighted isn't useful to show all the time.
//
// Colors are NWS's own official map colors, not an approximation -- see
// js/NWSHazardColors.js (shared with the 2-hour radar page's overlay, so the same
// hazard always looks the same regardless of which page is showing it). That table
// also carries NWS's own severity/priority ordering, used below for both the legend
// order and draw order (most severe drawn on top when polygons overlap).
import { classifyFeature, sortByDrawOrder } from './NWSHazardColors.js';
import { addGPSMarker } from './GPSMarker.js';

// How often this panel re-fetches active warnings. Safe to set this as low as NWS's
// own server-side floor (rateLimited()'s NWS_MIN_INTERVAL_SECONDS in NWSInterface.js,
// default 60s -- see GetCWAWarnings()) without hitting NWS any harder: requests faster
// than that just get served the same cached response instead of triggering a new
// outbound call, so this is purely "how stale can the displayed data be," not "how
// often NWS gets hit."
const REFRESH_INTERVAL_MS = 60 * 1000;

// Hazard labels the user has clicked off in the legend -- persists across the 1-minute
// refreshWarnings() polls (module-level, not reset by clearWarningLayers()) so toggling
// a noisy hazard type off stays off until clicked again, even as NWS data keeps
// updating underneath. Purely a display filter; the underlying fetched data is
// untouched.
const hiddenHazards = new Set();

function styleForHazard(feature) {
  const hazard = classifyFeature(feature);
  if (!hazard) return { opacity: 0, fillOpacity: 0 }; // hide anything unrecognized rather than throw
  if (hiddenHazards.has(hazard.label)) return { opacity: 0, fillOpacity: 0 };
  return { color: hazard.color, weight: 2, fillColor: hazard.color, fillOpacity: 0.35 };
}

// A short, human-readable line for a warning polygon's hover tooltip -- NWS's own
// headline field is already written as a single concise sentence (e.g. "Severe
// Thunderstorm Warning issued July 15 at 2:30PM MDT until 3:15PM MDT"), so prefer that
// over the much longer free-text description; fall back to just the event name for the
// rare alert missing one.
function tooltipTextForAlert(properties) {
  return properties.headline || properties.event;
}

let map;
let boundaryLayer;
let outlineBounds;
let warningLayers = [];
let currentWarningLayer = null; // the single L.geoJSON layer from renderWarnings(), if any -- restyled in place when a legend item is toggled
let boundaryFeatures = [];
let refreshTimer;

// (Re-)fits the map to the whole CWA outline, accounting for however much space the
// legend currently takes -- needed because #cwa-legend (a flex sibling of
// #cwa-map-container, see cwamap.css) grows/shrinks with however many distinct
// alert types are currently listed, which changes how much vertical room the map
// itself actually has. Leaflet doesn't notice its container being resized on its
// own, hence invalidateSize() before re-fitting -- called both right after the map
// is first built and again every time the legend's content changes.
function fitMapToOutline() {
  if (!map || !outlineBounds) return;
  map.invalidateSize();
  map.fitBounds(outlineBounds, { padding: [10, 10] });
}
let suppressed = true; // starts suppressed -- every cycle begins on the greeting page
let hasWarnings = false;
let locationError = false;

// Combines all the hide/show conditions into the two classes that actually control
// what's visible: .hidden (nothing at all -- intro/outro suppression from
// MainScript.js, or a resolved CWA that simply has no active warnings right now, which
// isn't worth showing) and .no-location (an error message instead of the map -- only
// when there's a genuine problem, e.g. an unresolvable location, NOT just "nothing is
// happening right now"). suppressed always wins over everything, including errors --
// no message popping up during the greeting either.
function updateVisibility() {
  const panel = getElement('cwa-panel');
  panel.classList.toggle('hidden', suppressed || (!locationError && !hasWarnings));
  panel.classList.toggle('no-location', !suppressed && locationError);
}

export function suppressCWAPanel() {
  suppressed = true;
  updateVisibility();
}

export function unsuppressCWAPanel() {
  suppressed = false;
  updateVisibility();
}

function showMessage(text) {
  locationError = true;
  getElement('cwa-panel-message').innerHTML = text;
  updateVisibility();
}

// fetch() only rejects on a genuine network failure -- a non-2xx response (e.g. NWS
// returning an HTML error page for a request outside the US, as happens for
// /nws/points with a positive/non-US longitude) still resolves successfully, and
// calling .json() on that throws a confusing "Unexpected token '<'" instead of a clear
// error. Checking response.ok first turns that into an actual diagnosable message.
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function buildLegend(visibleFeatures) {
  const seen = new Map(); // event label -> hazard {color, priority, label}
  for (const f of visibleFeatures) {
    const hazard = classifyFeature(f);
    if (hazard) seen.set(hazard.label, hazard);
  }
  // Most severe first (NWS's own priority order -- lower number is more severe).
  const rows = Array.from(seen.values()).sort((a, b) => a.priority - b.priority);
  const legendEl = getElement('cwa-legend');
  legendEl.innerHTML = rows.map((hazard) => {
    const hiddenClass = hiddenHazards.has(hazard.label) ? ' cwa-legend-item-hidden' : '';
    return `<div class="cwa-legend-item${hiddenClass}" data-hazard-label="${hazard.label}">`
      + `<span class="cwa-legend-swatch" style="background:${hazard.color};border-color:${hazard.color}"></span>`
      + `<span>${hazard.label}</span>`
      + `</div>`;
  }).join('');
  // Clicking a legend item hides that hazard type on the map (so a cluster of
  // overlapping warnings doesn't obscure what else is going on) and greys it out here;
  // clicking again brings it back. Delegated per-item rather than as one listener on
  // legendEl since innerHTML above already gives each row a stable element to close
  // over directly.
  legendEl.querySelectorAll('.cwa-legend-item').forEach((item) => {
    item.addEventListener('click', () => {
      const label = item.dataset.hazardLabel;
      if (hiddenHazards.has(label)) {
        hiddenHazards.delete(label);
      } else {
        hiddenHazards.add(label);
      }
      item.classList.toggle('cwa-legend-item-hidden', hiddenHazards.has(label));
      if (currentWarningLayer) currentWarningLayer.setStyle(styleForHazard);
    });
  });
  // The legend's own height just changed (more/fewer rows than before), which changes
  // how much space is actually left for the map above it -- refit now that the DOM has
  // the new legend content (innerHTML above is synchronous, and reading layout via
  // invalidateSize() below forces the browser to reflow before measuring).
  fitMapToOutline();
}

function clearWarningLayers() {
  warningLayers.forEach((layer) => map.removeLayer(layer));
  warningLayers = [];
  currentWarningLayer = null;
}

function renderWarnings(warningsGeoJSON, officeId) {
  clearWarningLayers();
  const features = warningsGeoJSON?.features || [];
  const visibleFeatures = [];

  for (const feature of features) {
    if (!classifyFeature(feature)) continue; // not in NWSHazardColors.js -- not a mappable hazard
    if (feature.geometry) {
      visibleFeatures.push(feature);
    } else {
      // Zone-only alert -- highlight whichever of our own county/forecast-zone shapes
      // match its affected UGC codes (an alert can span into a neighboring CWA too;
      // codes that don't match anything in our own boundary set are simply skipped).
      const ugcCodes = feature.properties?.geocode?.UGC || [];
      for (const code of ugcCodes) {
        const boundaryFeature = boundaryFeatures.find((f) => f.properties.ugc === code);
        if (boundaryFeature) {
          visibleFeatures.push({ type: 'Feature', geometry: boundaryFeature.geometry, properties: feature.properties });
        }
      }
    }
  }

  if (visibleFeatures.length > 0) {
    const layer = L.geoJSON({ type: 'FeatureCollection', features: sortByDrawOrder(visibleFeatures) }, {
      style: styleForHazard,
      onEachFeature: (feature, featureLayer) => {
        featureLayer.bindTooltip(tooltipTextForAlert(feature.properties), { sticky: true });
        // NWS's own human-readable summary page for this alert type/office, e.g.
        // https://forecast.weather.gov/wwamap/wwatxtget.php?cwa=GGW&wwa=severe%20thunderstorm%20warning
        // -- verified live. Not alert-instance-specific (there's no per-alert human
        // page -- api.weather.gov only serves raw CAP JSON, and alerts.weather.gov,
        // the domain that might once have had one, doesn't resolve anymore), but this
        // is the real NWS page for "this event type, from this office," which is what
        // was actually asked for here.
        if (feature.properties.event) {
          const wwaUrl = `https://forecast.weather.gov/wwamap/wwatxtget.php?cwa=${officeId}&wwa=${encodeURIComponent(feature.properties.event.toLowerCase())}`;
          featureLayer.on('click', () => window.open(wwaUrl, '_blank'));
        }
      },
    }).addTo(map);
    warningLayers.push(layer);
    currentWarningLayer = layer;
  }

  buildLegend(visibleFeatures);
  hasWarnings = visibleFeatures.length > 0;
  locationError = false; // got this far -- whatever error state existed before is over
  updateVisibility();
}

async function refreshWarnings(officeId) {
  try {
    const data = await fetchJSON(`/nws/cwa-warnings/${officeId}`);
    renderWarnings(data, officeId);
  } catch (err) {
    console.log('CWAWarningsMap: refreshWarnings failed (non-fatal):', err.message);
  }
}

async function initForLocation(lat, lon) {
  try {
    const points = await fetchJSON(`/nws/points/${lat}/${lon}`);
    const officeId = points.gridId;
    if (!officeId) {
      showMessage('Could not resolve a forecast office for this location.');
      return;
    }

    const boundary = await fetchJSON(`/nws/cwa-boundary/${officeId}`);
    boundaryFeatures = boundary.features;
    const countyFeatures = boundary.features.filter((f) => f.properties.zoneType === 'county');

    // Rebuilding from scratch each time this successfully resolves a location (rather
    // than only ever once) covers the rare case of initForLocation() somehow running
    // twice -- L.map() throws "Map container is already initialized" the second time
    // otherwise.
    if (map) {
      map.remove();
    }
    map = L.map('cwa-map-container', {
      attributionControl: false,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false,
      // Leaflet's default zoomSnap (1 -- whole zoom levels only) makes fitBounds()
      // round DOWN to the nearest whole zoom whenever the ideal fit falls between two
      // levels, so it wouldn't zoom in past the point where the bounds still fit --
      // that rounding is what was leaving a uniform margin on all four sides even
      // though the map itself never gets dragged/zoomed interactively here, so there's
      // no reason it needs to stick to whole levels at all. 0 = fully continuous zoom,
      // so fitMapToOutline() below can zoom in to the exact fit every time.
      zoomSnap: 0,
    });

    // A real basemap underneath, same tile source the regional radar page uses.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Individual county shapes are still added -- invisible by default (a barely-non-
    // zero fillOpacity, not 0, so they still register hover/click at all: an SVG
    // shape with fill-opacity exactly 0 stops receiving pointer events in some
    // browsers) -- purely so hovering anywhere in the CWA can name the county under
    // the cursor. The CWA's actual visible outline is the single merged shape below,
    // not these.
    boundaryLayer = L.geoJSON({ type: 'FeatureCollection', features: countyFeatures }, {
      style: { color: 'transparent', weight: 0, fillColor: '#FFFFFF', fillOpacity: 0.01 },
      onEachFeature: (feature, featureLayer) => {
        featureLayer.bindTooltip(feature.properties.name, { sticky: true });
      },
    }).addTo(map);

    outlineBounds = boundaryLayer.getBounds(); // same extent as boundary.outline itself -- it's the union of these same counties
    if (boundary.outline) {
      L.geoJSON(boundary.outline, {
        style: { color: '#FFEE55', weight: 3, fill: false },
        interactive: false,
      }).addTo(map);
    }

    // Marks the actual lat/lon this map was built for (the ?lat=/?lon= override, or
    // the same resolved location the radar page's own crosshair uses -- see init()/
    // setResolvedLocation() below).
    addGPSMarker(map, lat, lon);

    fitMapToOutline();

    await refreshWarnings(officeId);
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshWarnings(officeId), REFRESH_INTERVAL_MS);
  } catch (err) {
    console.log('CWAWarningsMap: initForLocation failed:', err.message);
    showMessage('Local warnings map unavailable.');
  }
}

// Set once the ?lat=/?lon= URL override is found valid at init() time below -- makes
// that override "sticky" so a later setResolvedLocation() call (which arrives async,
// once WeatherFetching.js actually resolves the configured zip/airport location)
// can't come along afterwards and silently replace an explicit manual override.
let overrideActive = false;

// Set once setResolvedLocation() below actually receives a real zip/airport-derived
// location -- cancels/blocks the IP-geolocation fallback past this point, since
// zip/airport outranks IP geolocation in the priority order documented at the top of
// this file, and shouldn't get clobbered by a slower, less-precise IP-based guess
// racing in around the same time.
let zipResolved = false;

let ipFallbackTimer;

// How long to wait for WeatherFetching.js to resolve the configured zip/airport
// location (via setResolvedLocation() below) before falling back to IP geolocation.
// 20s comfortably covers a normal cold-start weather fetch; if it's still not in by
// then, something's wrong with that path and an IP-based guess is a better bet than
// leaving the panel blank for the rest of the session.
const IP_FALLBACK_DELAY_MS = 20000;

// Called from WeatherFetching.js's fetchForecast() with the exact same
// latitude/longitude the regional radar page's own crosshair is built from (see
// fetchRadarImages() there), once that's resolved -- this is what keeps the two
// crosshairs in agreement rather than this panel re-deriving (and potentially
// diverging from) the location on its own. A no-op if the ?lat=/?lon= override is
// active, since that outranks it; otherwise cancels the pending IP-geolocation
// fallback timer, since this (rank 2) outranks that (rank 3).
export function setResolvedLocation(lat, lon) {
  if (overrideActive) return;
  if (lat == null || lon == null) return;
  zipResolved = true;
  clearTimeout(ipFallbackTimer);
  initForLocation(lat, lon);
}

// Lowest-priority fallback: geolocates by IP address, the same infrastructure
// DEFAULT_LOCATION=AUTOMATIC in .env uses (see IPGeolocationInterface.js/server.js's
// /geoip/lookup) -- only reached if neither the ?lat=/?lon= override nor the
// configured zip/airport location (setResolvedLocation() above) showed up within
// IP_FALLBACK_DELAY_MS. Resolves to a zip code, then geocodes that the same way the
// rest of the app geocodes a configured zip code.
async function useIPGeolocationFallback() {
  if (overrideActive || zipResolved) return; // something higher-priority beat us to it
  try {
    const geoip = await fetchJSON('/geoip/lookup');
    if (!geoip.zip) throw new Error('IP geolocation returned no zip code');
    const geo = await fetchJSON(`/nws/geocode/${geoip.zip}`);
    if (geo.lat == null || geo.lon == null) throw new Error('geocode lookup returned no coordinates');
    if (overrideActive || zipResolved) return; // re-check -- setResolvedLocation() may have won the race while this was in flight
    initForLocation(geo.lat, geo.lon);
  } catch (err) {
    console.log('CWAWarningsMap: IP-geolocation fallback failed:', err.message);
    showMessage('Local warnings map unavailable.');
  }
}

function init() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('lat') && urlParams.has('lon')) {
    const lat = parseFloat(urlParams.get('lat'));
    const lon = parseFloat(urlParams.get('lon'));
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      overrideActive = true;
      initForLocation(lat, lon);
      return;
    }
  }
  // No override -- wait for setResolvedLocation() above (rank 2, the configured
  // zip/airport location); fall back to IP geolocation (rank 3) if that hasn't shown
  // up within IP_FALLBACK_DELAY_MS.
  ipFallbackTimer = setTimeout(useIPGeolocationFallback, IP_FALLBACK_DELAY_MS);
}

window.addEventListener('load', init);
