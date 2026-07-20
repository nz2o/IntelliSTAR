// Picks and applies the main background image -- a random local photo (see
// assets/background/README.md for the full setup/phenomenon-folder documentation)
// matching the current active alert or condition for this CWA, if one's available,
// otherwise a random picsum.photos/Unsplash image. See
// BackgroundPhotoInterface.js/server.js for the server-side file listing this calls
// into -- the API key-free picsum.photos fallback needs no server involvement at all.
//
// Phenomenon is picked in two tiers (see assets/background/README.md for the full
// rationale):
//   1. Active alerts -- by category, in a fixed priority order (not NWS's own
//      numeric severity ranking, which js/NWSHazardColors.js uses instead for map
//      coloring/draw order -- this is a separate, presentation-driven ordering).
//   2. Current conditions (Weather.currentIcon), only when no active alert maps to
//      a phenomenon.
// Whatever that phenomenon folder doesn't have covered, applyBackground() below
// falls through further: the time-of-day-appropriate clearday/clearnight folder,
// then the plain CWA folder (see BackgroundPhotoInterface.js), then picsum.photos.

const PICSUM_URL = 'https://picsum.photos/1920/1080/?random';

// NWS's own official event-name strings (see js/NWSHazardColors.js's HAZARD_COLORS
// for the full verified table this app already uses for hazard map coloring) --
// grouped here into the phenomenon folders documented in
// assets/background/README.md. Anything not listed (Tsunami/Earthquake/Volcano,
// marine-only products, purely-informational statements/outlooks, etc.) simply
// doesn't drive a background choice.
const ALERT_PHENOMENA = {
  hurricane: ['Hurricane Warning', 'Hurricane Watch', 'Hurricane Force Wind Warning', 'Hurricane Force Wind Watch', 'Typhoon Warning', 'Typhoon Watch', 'Tropical Storm Warning', 'Tropical Storm Watch', 'Storm Surge Warning', 'Storm Surge Watch', 'Tropical Cyclone Local Statement'],
  tornado: ['Tornado Warning', 'Tornado Watch'],
  storm: ['Severe Thunderstorm Warning', 'Severe Thunderstorm Watch', 'Special Weather Statement', 'Severe Weather Statement'],
  snow: ['Winter Storm Warning', 'Winter Storm Watch', 'Winter Weather Advisory', 'Blizzard Warning', 'Snow Squall Warning', 'Lake Effect Snow Warning'],
  ice: ['Ice Storm Warning'],
  flood: ['Flood Warning', 'Flood Watch', 'Flood Advisory', 'Flood Statement', 'Flash Flood Warning', 'Flash Flood Watch', 'Flash Flood Statement', 'Coastal Flood Warning', 'Coastal Flood Watch', 'Coastal Flood Advisory', 'Coastal Flood Statement', 'Lakeshore Flood Warning', 'Lakeshore Flood Watch', 'Lakeshore Flood Advisory', 'Lakeshore Flood Statement'],
  wind: ['High Wind Warning', 'High Wind Watch', 'Wind Advisory', 'Extreme Wind Warning', 'Lake Wind Advisory'],
  firewx: ['Red Flag Warning', 'Fire Weather Watch', 'Extreme Fire Danger', 'Fire Warning'],
  dust: ['Dust Storm Warning', 'Blowing Dust Warning', 'Dust Advisory', 'Blowing Dust Advisory'],
  heat: ['Excessive Heat Warning', 'Excessive Heat Watch', 'Heat Advisory'],
  cold: ['Extreme Cold Warning', 'Extreme Cold Watch', 'Freeze Warning', 'Freeze Watch', 'Cold Weather Advisory', 'Frost Advisory'],
  fog: ['Dense Fog Advisory', 'Freezing Fog Advisory', 'Dense Smoke Advisory'],
  airquality: ['Air Quality Alert', 'Air Stagnation Advisory'],
};

// The "ranked/ordered by priority" list -- the first category with at least one
// currently-active alert wins. hurricane/tornado/storm/snow/ice/flood are in the
// exact order originally requested; the rest are additions slotted in after those.
const ALERT_PRIORITY_ORDER = [
  'hurricane', 'tornado', 'storm', 'snow', 'ice', 'flood',
  'wind', 'firewx', 'dust', 'heat', 'cold', 'fog', 'airquality',
];

// Weather.currentIcon values (see mapIconName() in js/NWSIconMap.js) grouped into
// the same phenomenon folders, reused where the visual look is the same regardless
// of whether an alert is active (e.g. "snow" covers both a Winter Storm Warning and
// plain old snow falling with no alert at all).
const CONDITION_PHENOMENA = {
  rain: ['rain', 'nt_rain', 'chancerain', 'nt_chancerain'],
  snow: ['snow', 'nt_snow', 'sleet', 'nt_sleet'],
  storm: ['chancetstorms', 'nt_chancetstorms', 'tstorms', 'nt_tstorms'],
  fog: ['fog', 'nt_fog'],
  haze: ['hazy', 'nt_hazy'],
  cloudy: ['partlycloudy', 'nt_partlycloudy', 'cloudy', 'nt_cloudy'],
};

// mapIconName() only ever returns these during the day ('clear' -- not 'nt_clear' --
// is what it returns for a clear night sky, see NWSIconMap.js's CLEAR_SKY_TOKENS),
// so the icon name alone already tells day from night; no separate isDay check needed.
const CLEAR_DAY_ICONS = ['sunny', 'mostlysunny', 'partlysunny'];
const CLEAR_NIGHT_ICONS = ['clear', 'nt_mostlysunny', 'nt_partlysunny'];

function alertPhenomenon(alertEvents) {
  const activeEvents = new Set((alertEvents || []).filter(Boolean));
  for (const category of ALERT_PRIORITY_ORDER) {
    if (ALERT_PHENOMENA[category].some((event) => activeEvents.has(event))) {
      return category;
    }
  }
  return null;
}

function conditionPhenomenon(currentIcon) {
  for (const [category, icons] of Object.entries(CONDITION_PHENOMENA)) {
    if (icons.includes(currentIcon)) return category;
  }
  if (CLEAR_DAY_ICONS.includes(currentIcon)) return 'clearday';
  if (CLEAR_NIGHT_ICONS.includes(currentIcon)) return 'clearnight';
  return null;
}

// Exported for testability -- see the two callers below for the actual normal usage.
export function selectPhenomenon(alertEvents, currentIcon) {
  return alertPhenomenon(alertEvents) || conditionPhenomenon(currentIcon) || null;
}

function setPicsumBackground() {
  getElement('background-image').style.backgroundImage = `url(${PICSUM_URL})`;
}

async function fetchPhotos(cwa, phenomenon) {
  try {
    const query = phenomenon ? `?phenomenon=${encodeURIComponent(phenomenon)}` : '';
    const response = await fetch(`/background-photos/${cwa}${query}`);
    return await response.json();
  } catch (err) {
    console.log('[BackgroundSelector] local photo lookup failed (non-fatal, trying the next fallback):', err.message);
    return [];
  }
}

function pickRandom(photos) {
  return photos[Math.floor(Math.random() * photos.length)];
}

// Tries, in order: the matched phenomenon folder; the time-of-day-appropriate
// clearday/clearnight folder (skipped if that's already what was matched, so it's
// not asked for twice); the plain CWA folder itself; picsum.photos. Each tier is
// only actually asked for if the previous one came back with nothing -- see
// assets/background/README.md for the full reasoning (clearday/clearnight photos
// are a much more pleasant generic fallback than jumping straight from "no tornado
// photos configured" to a plain untagged CWA photo or picsum).
async function applyBackground(cwa, phenomenon, isDayNow) {
  if (cwa) {
    const clearFallback = isDayNow ? 'clearday' : 'clearnight';
    const candidates = [];
    if (phenomenon) candidates.push(phenomenon);
    if (phenomenon !== clearFallback) candidates.push(clearFallback);
    candidates.push(null); // plain CWA folder -- GetBackgroundPhotos() ignores a null/empty phenomenon

    for (const candidate of candidates) {
      const photos = await fetchPhotos(cwa, candidate);
      if (photos.length > 0) {
        getElement('background-image').style.backgroundImage = `url(${pickRandom(photos)})`;
        return;
      }
    }
  }
  setPicsumBackground();
}

// Called once at page load, before any location is known -- see window.onload in
// MainScript.js. There's no CWA or weather data yet at that point, so this is always
// picsum.photos; refreshBackground() below takes over once real data is available.
export function applyDefaultBackground() {
  setPicsumBackground();
}

// Called once conditions+alerts+forecast are all resolved for this cycle -- see
// fetchForecast() in WeatherFetching.js. alertEvents is this cycle's active alerts'
// own NWS event names (Weather.alerts[].event -- see fetchAlerts() in
// WeatherFetching.js), currentIcon is Weather.currentIcon, isDayNow is the same
// NWS-forecast-derived day/night flag the rest of the app already uses (window.isDay
// -- see fetchForecast() in WeatherFetching.js) rather than re-deriving day/night
// from currentIcon here, so the clearday/clearnight fallback reflects actual
// sunrise/sunset, not just whatever the current condition happens to be.
export async function refreshBackground(cwa, alertEvents, currentIcon, isDayNow) {
  const phenomenon = selectPhenomenon(alertEvents, currentIcon);
  await applyBackground(cwa, phenomenon, isDayNow);
}
