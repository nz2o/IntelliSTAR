// Marks the physical WSR-88D radar site (see NWSInterface.js's GetRadarStation(),
// fetched once per cycle in WeatherFetching.js's resolveGridpoint() and stored on
// Weather.radarStation) on the 2-hour regional radar map, so it's visible which dish
// the displayed imagery is actually being sourced from. Distinct in color/shape from
// the GPS crosshair (GPSMarker.js, which marks the viewer's own location) so the two
// aren't confused when both appear on the same map. Styling lives in css/radar.css
// (.radar-station-*).
export function addRadarStationMarker(map, lat, lon) {
  return L.marker([lat, lon], {
    icon: L.divIcon({
      className: 'radar-station-marker-icon',
      html: '<div class="radar-station-marker">'
        + '<img src="assets/timeline/radar1.svg" class="radar-station-glyph" alt="" />'
        + '</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    }),
    interactive: false,
  }).addTo(map);
}
