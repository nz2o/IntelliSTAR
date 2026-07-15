// Official NWS hazard/weather-event map colors and priority order, transcribed
// verbatim from NWS's own published reference table ("Hazard/Weather Event, Priority,
// Color Sample, Color Name, RGB Color, Hex Code" -- weather.gov/media/nws/
// WWA_Changes_10124.pdf) -- the same colors NWS's own maps use, so a Severe
// Thunderstorm Warning looks like a Severe Thunderstorm Warning regardless of which
// page/provider in this app is showing it, and adjacent hazard types that used to
// share an approximated color (e.g. Severe Thunderstorm Watch and Flood Watch) are
// now visually distinct the same way NWS's own graphics are.
//
// Priority is NWS's own significance ordering -- 1 is most severe (Tsunami Warning),
// 111 is least (Blue Alert). Used here for draw order too (see sortByDrawOrder below),
// not just color, so the most severe hazard affecting a given spot is always the one
// actually visible when multiple overlap.
export const HAZARD_COLORS = {
  'Tsunami Warning': { priority: 1, color: '#FD6347' },
  'Tornado Warning': { priority: 2, color: '#FF0000' },
  'Extreme Wind Warning': { priority: 3, color: '#FF8C00' },
  'Severe Thunderstorm Warning': { priority: 4, color: '#FFA500' },
  'Flash Flood Warning': { priority: 5, color: '#8B0000' },
  'Flash Flood Statement': { priority: 6, color: '#8B0000' },
  'Severe Weather Statement': { priority: 7, color: '#00FFFF' },
  'Shelter In Place Warning': { priority: 8, color: '#FA8072' },
  'Evacuation Immediate': { priority: 9, color: '#7FFF00' },
  'Civil Danger Warning': { priority: 10, color: '#FFB6C1' },
  'Nuclear Power Plant Warning': { priority: 11, color: '#4B0082' },
  'Radiological Hazard Warning': { priority: 12, color: '#4B0082' },
  'Hazardous Materials Warning': { priority: 13, color: '#4B0082' },
  'Fire Warning': { priority: 14, color: '#A0522D' },
  'Civil Emergency Message': { priority: 15, color: '#FFB6C1' },
  'Law Enforcement Warning': { priority: 16, color: '#C0C0C0' },
  'Storm Surge Warning': { priority: 17, color: '#B524F7' },
  'Hurricane Force Wind Warning': { priority: 18, color: '#CD5C5C' },
  'Hurricane Warning': { priority: 19, color: '#DC143C' },
  'Typhoon Warning': { priority: 20, color: '#DC143C' },
  'Special Marine Warning': { priority: 21, color: '#FFA500' },
  'Blizzard Warning': { priority: 22, color: '#FF4500' },
  'Snow Squall Warning': { priority: 23, color: '#C71585' },
  'Ice Storm Warning': { priority: 24, color: '#8B008B' },
  'Heavy Freezing Spray Warning': { priority: 25, color: '#00BFFF' },
  'Winter Storm Warning': { priority: 26, color: '#FF69B4' },
  'Lake Effect Snow Warning': { priority: 27, color: '#008B8B' },
  'Dust Storm Warning': { priority: 28, color: '#FFE4C4' },
  'Blowing Dust Warning': { priority: 29, color: '#FFE4C4' },
  'High Wind Warning': { priority: 30, color: '#DAA520' },
  'Tropical Storm Warning': { priority: 31, color: '#B22222' },
  'Storm Warning': { priority: 32, color: '#9400D3' },
  'Tsunami Advisory': { priority: 33, color: '#D2691E' },
  'Tsunami Watch': { priority: 34, color: '#FF00FF' },
  'Avalanche Warning': { priority: 35, color: '#1E90FF' },
  'Earthquake Warning': { priority: 36, color: '#8B4513' },
  'Volcano Warning': { priority: 37, color: '#2F4F4F' },
  'Ashfall Warning': { priority: 38, color: '#A9A9A9' },
  'Flood Warning': { priority: 39, color: '#00FF00' },
  'Coastal Flood Warning': { priority: 40, color: '#228B22' },
  'Lakeshore Flood Warning': { priority: 41, color: '#228B22' },
  'Ashfall Advisory': { priority: 42, color: '#696969' },
  'High Surf Warning': { priority: 43, color: '#228B22' },
  'Excessive Heat Warning': { priority: 44, color: '#C71585' },
  'Tornado Watch': { priority: 45, color: '#FFFF00' },
  'Severe Thunderstorm Watch': { priority: 46, color: '#DB7093' },
  'Flash Flood Watch': { priority: 47, color: '#2E8B57' },
  'Gale Warning': { priority: 48, color: '#DDA0DD' },
  'Flood Statement': { priority: 49, color: '#00FF00' },
  'Extreme Cold Warning': { priority: 50, color: '#0000FF' },
  'Freeze Warning': { priority: 51, color: '#483D8B' },
  'Red Flag Warning': { priority: 52, color: '#FF1493' },
  'Storm Surge Watch': { priority: 53, color: '#DB7FF7' },
  'Hurricane Watch': { priority: 54, color: '#FF00FF' },
  'Hurricane Force Wind Watch': { priority: 55, color: '#9932CC' },
  'Typhoon Watch': { priority: 56, color: '#FF00FF' },
  'Tropical Storm Watch': { priority: 57, color: '#F08080' },
  'Storm Watch': { priority: 58, color: '#FFE4B5' },
  'Tropical Cyclone Local Statement': { priority: 59, color: '#FFE4B5' },
  'Winter Weather Advisory': { priority: 60, color: '#7B68EE' },
  'Avalanche Advisory': { priority: 61, color: '#CD853F' },
  'Cold Weather Advisory': { priority: 62, color: '#AFEEEE' },
  'Heat Advisory': { priority: 63, color: '#FF7F50' },
  'Flood Advisory': { priority: 64, color: '#00FF7F' },
  'Coastal Flood Advisory': { priority: 65, color: '#7CFC00' },
  'Lakeshore Flood Advisory': { priority: 66, color: '#7CFC00' },
  'High Surf Advisory': { priority: 67, color: '#BA55D3' },
  'Dense Fog Advisory': { priority: 68, color: '#708090' },
  'Dense Smoke Advisory': { priority: 69, color: '#F0E68C' },
  'Small Craft Advisory': { priority: 70, color: '#D8BFD8' },
  'Brisk Wind Advisory': { priority: 71, color: '#D8BFD8' },
  'Hazardous Seas Warning': { priority: 72, color: '#D8BFD8' },
  'Dust Advisory': { priority: 73, color: '#BDB76B' },
  'Blowing Dust Advisory': { priority: 74, color: '#BDB76B' },
  'Lake Wind Advisory': { priority: 75, color: '#D2B48C' },
  'Wind Advisory': { priority: 76, color: '#D2B48C' },
  'Frost Advisory': { priority: 77, color: '#6495ED' },
  'Freezing Fog Advisory': { priority: 78, color: '#008080' },
  'Freezing Spray Advisory': { priority: 79, color: '#00BFFF' },
  'Low Water Advisory': { priority: 80, color: '#A52A2A' },
  'Local Area Emergency': { priority: 81, color: '#C0C0C0' },
  'Winter Storm Watch': { priority: 82, color: '#4682B4' },
  'Rip Current Statement': { priority: 83, color: '#40E0D0' },
  'Beach Hazards Statement': { priority: 84, color: '#40E0D0' },
  'Gale Watch': { priority: 85, color: '#FFC0CB' },
  'Avalanche Watch': { priority: 86, color: '#F4A460' },
  'Hazardous Seas Watch': { priority: 87, color: '#483D8B' },
  'Heavy Freezing Spray Watch': { priority: 88, color: '#BC8F8F' },
  'Flood Watch': { priority: 89, color: '#2E8B57' },
  'Coastal Flood Watch': { priority: 90, color: '#66CDAA' },
  'Lakeshore Flood Watch': { priority: 91, color: '#66CDAA' },
  'High Wind Watch': { priority: 92, color: '#B8860B' },
  'Excessive Heat Watch': { priority: 93, color: '#800000' },
  'Extreme Cold Watch': { priority: 94, color: '#5F9EA0' },
  'Freeze Watch': { priority: 95, color: '#00FFFF' },
  'Fire Weather Watch': { priority: 96, color: '#FFDEAD' },
  'Extreme Fire Danger': { priority: 97, color: '#E9967A' },
  '911 Telephone Outage': { priority: 98, color: '#C0C0C0' },
  'Coastal Flood Statement': { priority: 99, color: '#6B8E23' },
  'Lakeshore Flood Statement': { priority: 100, color: '#6B8E23' },
  'Special Weather Statement': { priority: 101, color: '#FFE4B5' },
  'Marine Weather Statement': { priority: 102, color: '#FFDAB9' },
  'Air Quality Alert': { priority: 103, color: '#808080' },
  'Air Stagnation Advisory': { priority: 104, color: '#808080' },
  'Hazardous Weather Outlook': { priority: 105, color: '#EEE8AA' },
  'Hydrologic Outlook': { priority: 106, color: '#90EE90' },
  'Short Term Forecast': { priority: 107, color: '#98FB98' },
  'Administrative Message': { priority: 108, color: '#C0C0C0' },
  'Test': { priority: 109, color: '#F0FFFF' },
  // Child Abduction Emergency / Blue Alert intentionally omitted -- NWS's own table
  // marks both "Transparent" (no fill), and neither is a weather hazard anyway.
};

// Tornado Warnings get one non-official embellishment on top of NWS's own table:
// broadcast convention (and an earlier explicit request for this app) marks a
// *confirmed* tornado -- NWS flags this via the tornadoDetection/tornadoDamageThreat
// CAP parameters, not a separate event name -- in purple/magenta instead of plain red,
// drawn above literally everything else.
const TORNADO_CONFIRMED_COLOR = '#FF00FF';

export function classifyFeature(feature) {
  const event = feature?.properties?.event;
  const hazard = event ? HAZARD_COLORS[event] : null;
  if (!hazard) return null;

  if (event === 'Tornado Warning') {
    const params = feature.properties.parameters || {};
    const confirmed = (params.tornadoDamageThreat || []).includes('CATASTROPHIC') ||
                       (params.tornadoDetection || []).includes('OBSERVED');
    if (confirmed) {
      return { color: TORNADO_CONFIRMED_COLOR, priority: 0, label: 'Tornado Warning (Confirmed/Emergency)' };
    }
  }
  return { color: hazard.color, priority: hazard.priority, label: event };
}

// Returns features reordered so the most severe (lowest NWS priority number) ends up
// last in the array. Meant to be added to a Leaflet map/GeoJSON layer in that order --
// later-added shapes render on top in Leaflet's SVG renderer, so this makes the most
// severe hazard affecting a spot the one actually visible when polygons overlap,
// instead of whichever happened to be listed last in NWS's own feed order.
export function sortByDrawOrder(features, classify = classifyFeature) {
  return [...features].sort((a, b) => (classify(b)?.priority ?? -1) - (classify(a)?.priority ?? -1));
}
