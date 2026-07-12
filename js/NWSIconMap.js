// Maps NWS icon URLs (e.g. https://api.weather.gov/icons/land/day/tsra,40) onto this
// repo's existing assets/icons/conditions/*.svg names (e.g.
// sunny/nt_clear/partlysunny/chancetstorms). Condition-token vocabulary verified
// against ws4kp's own NWS icon mapper (netbymatt/ws4kp icons-large.mjs), then remapped
// onto the icon names this repo actually ships.

// Day-side base icon name for each NWS sky/precip condition token. "skc"/"hot"/"cold"
// are handled separately below since this repo uses a distinct "clear" icon for night
// rather than an "nt_" prefix of "sunny".
const CONDITION_MAP = {
  skc: 'sunny', hot: 'sunny', cold: 'sunny',
  few: 'mostlysunny',
  sct: 'partlysunny',
  bkn: 'partlycloudy',
  ovc: 'cloudy',
  fog: 'fog',
  haze: 'hazy', dust: 'hazy', smoke: 'hazy',
  rain: 'rain',
  rain_showers: 'chancerain', rain_showers_hi: 'chancerain',
  snow: 'snow', blizzard: 'snow',
  sleet: 'sleet', rain_sleet: 'sleet', snow_sleet: 'sleet', rain_snow: 'sleet', winter_mix: 'sleet',
  fzra: 'sleet', rain_fzra: 'sleet', snow_fzra: 'sleet',
  tsra: 'chancetstorms', tsra_sct: 'chancetstorms',
  tsra_hi: 'tstorms', tornado: 'tstorms', hurricane: 'tstorms', tropical_storm: 'tstorms',
};

// Conditions that use a distinct "clear" icon at night instead of an "nt_" prefix.
const CLEAR_SKY_TOKENS = new Set(['skc', 'hot', 'cold']);

// Human-readable precip type, for the forecast precip-chance line. Conditions not
// listed here (e.g. plain sky-cover tokens) have no meaningful precip type.
const PRECIP_TYPE_LABELS = {
  rain: 'Rain', rain_showers: 'Rain', rain_showers_hi: 'Rain',
  snow: 'Snow', blizzard: 'Snow', rain_snow: 'Snow',
  sleet: 'Sleet', rain_sleet: 'Sleet', snow_sleet: 'Sleet', winter_mix: 'Wintry Mix',
  fzra: 'Freezing Rain', rain_fzra: 'Freezing Rain', snow_fzra: 'Freezing Rain',
  tsra: 'Thunderstorms', tsra_sct: 'Thunderstorms', tsra_hi: 'Thunderstorms',
};

// Short (<=2 line) condition labels for the 7-day outlook tiles, which are only
// 172px wide. NWS's shortForecast text (e.g. "Chance Showers And Thunderstorms")
// is unbounded in length and overflows those tiles when split one word per line,
// so this is a curated table instead, keyed by the same condition tokens as
// CONDITION_MAP above.
const CONDITION_LABELS = {
  skc: 'Sunny', hot: 'Sunny', cold: 'Sunny',
  few: 'Mostly<br/>Sunny',
  sct: 'Partly<br/>Sunny',
  bkn: 'Partly<br/>Cloudy',
  ovc: 'Cloudy',
  fog: 'Fog',
  haze: 'Hazy', dust: 'Hazy', smoke: 'Hazy',
  rain: 'Rain',
  rain_showers: 'Rain<br/>Showers', rain_showers_hi: 'Rain<br/>Showers',
  snow: 'Snow', blizzard: 'Snow',
  sleet: 'Sleet', rain_sleet: 'Sleet', snow_sleet: 'Sleet', rain_snow: 'Sleet', winter_mix: 'Wintry<br/>Mix',
  fzra: 'Freezing<br/>Rain', rain_fzra: 'Freezing<br/>Rain', snow_fzra: 'Freezing<br/>Rain',
  tsra: 'Chance<br/>T-Storms', tsra_sct: 'Chance<br/>T-Storms',
  tsra_hi: 'T-Storms', tornado: 'Tornado', hurricane: 'Hurricane', tropical_storm: 'Trop.<br/>Storm',
};

// Extracts { token, isNight } from an NWS icon URL. Returns null if the URL is
// missing or doesn't match the expected /icons/land/{day|night}/{token}[,pop] shape.
function parseIconUrl(iconUrl) {
  if (!iconUrl) return null;
  try {
    const parts = new URL(iconUrl).pathname.split('/').filter(Boolean);
    const dayIndex = parts.indexOf('day');
    const nightIndex = parts.indexOf('night');
    const dnIndex = dayIndex !== -1 ? dayIndex : nightIndex;
    if (dnIndex === -1 || dnIndex + 1 >= parts.length) return null;

    // Transition periods chain two conditions (e.g. bkn,30/ovc,40) — use the first
    // (current/dominant) one, same approach ws4kp takes.
    let token = parts[dnIndex + 1].split(',')[0];
    token = token.replace(/^wind_/, ''); // no dedicated "windy" icon; fall back to the base sky condition

    return { token, isNight: dnIndex === nightIndex };
  } catch {
    return null;
  }
}

// Maps an NWS icon URL to one of this repo's assets/icons/conditions/*.svg base names
// (without the .svg extension). 'na' = no icon data at all, 'unknown'/'nt_unknown' =
// icon data present but the condition token isn't recognized.
export function mapIconName(iconUrl) {
  const parsed = parseIconUrl(iconUrl);
  if (!parsed) return 'na';

  const { token, isNight } = parsed;
  const dayName = CONDITION_MAP[token];
  if (!dayName) return isNight ? 'nt_unknown' : 'unknown';
  if (isNight) return CLEAR_SKY_TOKENS.has(token) ? 'clear' : 'nt_' + dayName;
  return dayName;
}

// Maps an NWS icon URL to a human-readable precip type ("Rain", "Snow", ...) for
// display alongside a probability-of-precipitation percentage. Falls back to a
// generic label when the condition isn't a recognized precip type (e.g. clear skies).
export function mapPrecipLabel(iconUrl) {
  const parsed = parseIconUrl(iconUrl);
  if (!parsed) return 'Precipitation';
  return PRECIP_TYPE_LABELS[parsed.token] || 'Precipitation';
}

// Maps an NWS icon URL to a short, pre-formatted (<=2 line, <br/>-joined) condition
// label for the 7-day outlook tiles. See CONDITION_LABELS above for why this exists
// instead of using NWS's own (unbounded-length) shortForecast text directly.
export function mapConditionLabel(iconUrl) {
  const parsed = parseIconUrl(iconUrl);
  if (!parsed) return '';
  return CONDITION_LABELS[parsed.token] || 'N/A';
}
