// Animated GPS crosshair marker -- shared by the CWA Local Warnings panel
// (js/CWAWarningsMap.js) and the 2-hour regional radar page's four provider modules
// (RadarLeafletIEM.js etc.), so "here's the point this map is built for" looks the
// same everywhere. Styling lives in css/cwamap.css (.cwa-gps-*) -- loaded globally for
// the whole app already (not just the CWA panel), so it's fine to reuse here without
// duplicating any CSS.
export function addGPSMarker(map, lat, lon) {
  return L.marker([lat, lon], {
    icon: L.divIcon({
      className: 'cwa-gps-marker-icon',
      html: '<div class="cwa-gps-marker">'
        + '<div class="cwa-gps-pulse"></div>'
        + '<div class="cwa-gps-tick cwa-gps-tick-n"></div>'
        + '<div class="cwa-gps-tick cwa-gps-tick-e"></div>'
        + '<div class="cwa-gps-tick cwa-gps-tick-s"></div>'
        + '<div class="cwa-gps-tick cwa-gps-tick-w"></div>'
        + '<div class="cwa-gps-ring"></div>'
        + '<div class="cwa-gps-dot"></div>'
        + '</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    }),
    interactive: false,
  }).addTo(map);
}
