// Adds an overlay of currently-active Tornado/Severe Thunderstorm/Flash Flood Warning
// polygons onto a regional radar Leaflet map, plus a small legend built only from
// whichever warning types are actually visible in the current map view. Shared by all
// four radar provider modules (RadarLeafletIEM.js etc.) since they all create their
// regional map ('radar-container') the same way -- see addActiveWarningOverlay() below.
//
// Data comes from Weather.activeWarnings (a raw NWS GeoJSON FeatureCollection, fetched
// nationwide -- see fetchActiveWarnings() in WeatherFetching.js for why it isn't scoped
// to the viewer's own location). Colors follow common broadcast-meteorology convention:
// Tornado Warning=red (upgraded to purple/magenta for an observed/confirmed tornado or
// "Tornado Emergency" -- NWS flags these via the tornadoDetection/tornadoDamageThreat
// CAP parameters, not a separate alert type), Severe Thunderstorm Warning=yellow,
// Flash Flood Warning=green.
const WARNING_STYLES = {
  'tor-confirmed': { color: '#FF00FF', fillColor: '#FF00FF', label: 'Tornado Warning (Confirmed/Emergency)' },
  'tor':           { color: '#FF0000', fillColor: '#FF0000', label: 'Tornado Warning' },
  'svr':           { color: '#CC8800', fillColor: '#FFD700', label: 'Severe Thunderstorm Warning' },
  'ffw':           { color: '#006622', fillColor: '#00CC44', label: 'Flash Flood Warning' },
};

function classifyWarning(feature) {
  const event = feature?.properties?.event;
  const params = feature?.properties?.parameters || {};
  if (event === 'Tornado Warning') {
    const confirmed = (params.tornadoDamageThreat || []).includes('CATASTROPHIC') ||
                       (params.tornadoDetection || []).includes('OBSERVED');
    return confirmed ? 'tor-confirmed' : 'tor';
  }
  if (event === 'Severe Thunderstorm Warning') return 'svr';
  if (event === 'Flash Flood Warning') return 'ffw';
  return null; // shouldn't happen -- the server route already filters to these 3 events
}

function styleFeature(feature) {
  const style = WARNING_STYLES[classifyWarning(feature)];
  if (!style) return { opacity: 0, fillOpacity: 0 }; // hide anything unrecognized rather than throw
  return { color: style.color, weight: 3, fillColor: style.fillColor, fillOpacity: 0.25 };
}

const LegendControl = L.Control.extend({
  options: { position: 'bottomleft' },
  onAdd: function () {
    this._div = L.DomUtil.create('div', 'warning-legend');
    return this._div;
  },
  update: function (keys) {
    this._div.innerHTML = Array.from(keys).map((key) => {
      const style = WARNING_STYLES[key];
      return `<div class="warning-legend-item">`
        + `<span class="warning-legend-swatch" style="background:${style.fillColor};border-color:${style.color}"></span>`
        + `<span class="warning-legend-label">${style.label}</span>`
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

  const features = warningsGeoJSON?.features?.filter((f) => f.geometry) || [];
  if (features.length === 0) return;

  map._warningLayer = L.geoJSON({ type: 'FeatureCollection', features }, { style: styleFeature }).addTo(map);

  // Only list warning types actually visible in the current view -- this fetch is
  // nationwide, so most of what's in it will be nowhere near this particular map.
  const bounds = map.getBounds();
  const visibleKeys = new Set();
  map._warningLayer.eachLayer((featureLayer) => {
    if (typeof featureLayer.getBounds === 'function' && bounds.intersects(featureLayer.getBounds())) {
      const key = classifyWarning(featureLayer.feature);
      if (key) visibleKeys.add(key);
    }
  });
  if (visibleKeys.size > 0) {
    map._warningLegend = new LegendControl().addTo(map);
    map._warningLegend.update(visibleKeys);
  }
}
