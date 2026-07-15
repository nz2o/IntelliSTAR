// Adds an overlay of currently-active Tornado/Severe Thunderstorm/Flash Flood Warning
// polygons onto a regional radar Leaflet map, plus a small legend built only from
// whichever warning types are actually visible in the current map view. Shared by all
// four radar provider modules (RadarLeafletIEM.js etc.) since they all create their
// regional map ('radar-container') the same way -- see addActiveWarningOverlay() below.
//
// Data comes from Weather.activeWarnings (a raw NWS GeoJSON FeatureCollection, fetched
// nationwide -- see fetchActiveWarnings() in WeatherFetching.js for why it isn't scoped
// to the viewer's own location). Colors are NWS's own official map colors, not an
// approximation -- see js/NWSHazardColors.js (shared with the CWA warnings panel, so
// the same hazard always looks the same regardless of which page is showing it).
import { classifyFeature, sortByDrawOrder } from './NWSHazardColors.js';

function styleFeature(feature) {
  const hazard = classifyFeature(feature);
  if (!hazard) return { opacity: 0, fillOpacity: 0 }; // hide anything unrecognized rather than throw
  return { color: hazard.color, weight: 3, fillColor: hazard.color, fillOpacity: 0.3 };
}

// Opens NWS's own human-readable summary page for a clicked polygon's alert
// type/office, e.g. https://forecast.weather.gov/wwamap/wwatxtget.php?cwa=GGW&wwa=severe%20thunderstorm%20warning
// (same page the CWA warnings panel links to -- see js/CWAWarningsMap.js). Unlike
// that panel, this overlay is nationwide (see the module comment above) with no
// single office already known, so the office is resolved lazily on click, from
// roughly the middle of whichever polygon was clicked -- cheap and only happens on
// an actual click, versus resolving up front for every polygon on the map.
async function openWWAPage(feature, featureLayer) {
  const event = feature?.properties?.event;
  if (!event) return;
  const center = featureLayer.getBounds().getCenter();
  try {
    const points = await fetch(`/nws/points/${center.lat}/${center.lng}`).then((r) => r.json());
    if (!points.gridId) return;
    window.open(`https://forecast.weather.gov/wwamap/wwatxtget.php?cwa=${points.gridId}&wwa=${encodeURIComponent(event.toLowerCase())}`, '_blank');
  } catch (err) {
    console.log('RadarWarningOverlay: could not resolve an office for this polygon:', err.message);
  }
}

const LegendControl = L.Control.extend({
  options: { position: 'bottomleft' },
  onAdd: function () {
    this._div = L.DomUtil.create('div', 'warning-legend');
    return this._div;
  },
  update: function (rows) {
    this._div.innerHTML = rows.map(({ color, label }) => {
      return `<div class="warning-legend-item">`
        + `<span class="warning-legend-swatch" style="background:${color};border-color:${color}"></span>`
        + `<span class="warning-legend-label">${label}</span>`
        + `</div>`;
    }).join('');
  }
});

// Idempotent, and safe to call before the map or the warnings data exists yet -- both
// fetchActiveWarnings() (once the nationwide fetch resolves) and the radar provider
// modules (right after creating the map) call this with whatever they currently have;
// whichever runs second, once both the map and real data are available, wins. Always
// clears out any previously-added overlay/legend first rather than stacking duplicates.
export function addActiveWarningOverlay(map, warningsGeoJSON) {
  if (!map || typeof map.getBounds !== 'function') return; // map not created yet

  if (map._warningLayer) {
    map.removeLayer(map._warningLayer);
    map._warningLayer = null;
  }
  if (map._warningLegend) {
    map.removeControl(map._warningLegend);
    map._warningLegend = null;
  }

  const features = sortByDrawOrder(warningsGeoJSON?.features?.filter((f) => f.geometry) || []);
  if (features.length === 0) return;

  map._warningLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style: styleFeature,
    onEachFeature: (feature, featureLayer) => {
      featureLayer.on('click', () => openWWAPage(feature, featureLayer));
    },
  }).addTo(map);

  // Only list warning types actually visible in the current view -- this fetch is
  // nationwide, so most of what's in it will be nowhere near this particular map.
  // Most severe first, matching the draw order above.
  const bounds = map.getBounds();
  const visibleEvents = new Map(); // event label -> hazard {color, priority, label}
  map._warningLayer.eachLayer((featureLayer) => {
    if (typeof featureLayer.getBounds === 'function' && bounds.intersects(featureLayer.getBounds())) {
      const hazard = classifyFeature(featureLayer.feature);
      if (hazard) visibleEvents.set(hazard.label, hazard);
    }
  });
  if (visibleEvents.size > 0) {
    const rows = Array.from(visibleEvents.values()).sort((a, b) => a.priority - b.priority);
    map._warningLegend = new LegendControl().addTo(map);
    map._warningLegend.update(rows);
  }
}
