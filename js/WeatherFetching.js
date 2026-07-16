// Custom Radar Handler RainView.
import { getRadarLeafletRainViewer } from "./RadarLeafletRV.js";

// Custom Radar Handler Iowa State Mesonet.
import { getRadarLeafletIEM } from "./RadarLeafletIEM.js";

// Custom Radar Handler Aeris/XWeather.
import { getRadarLeafletXW } from "./RadarLeafletXW.js";

// Custom Radar Handler Rainbow.AI.
import { getRadarLeafletRBAI } from "./RadarLeafletRBAI.js";

// Active Tornado/Severe Thunderstorm/Flash Flood Warning polygon overlay for the
// regional radar map -- see fetchActiveWarnings() below and js/RadarWarningOverlay.js.
import { addActiveWarningOverlay } from "./RadarWarningOverlay.js";

// Closing traffic-conditions slide -- see fetchTrafficMap() below and js/TrafficMap.js.
import { buildTrafficMap } from "./TrafficMap.js";

// NWS icon URL -> assets/icons/conditions/*.svg name mapping.
import { mapIconName, mapPrecipLabel, mapConditionLabel } from "./NWSIconMap.js";

// After all the weather data has been retrieved, start the Local on the 8's playback.
import { scheduleTimeline } from "./MainScript.js";

// import the global configuration (amazingHashtag, etc.)
import { globalConfig } from "../common_configuration.js";

// A note on how this module is designed.
// Most of the weather data is fetch asynchronously and takes varying amounts of time
// to be returned. Only after a particular weather data element is retrieved, the next element
// is requested. The final elements are the radar pages.
// After all of the weather data has been obtained, then the main playback scheduler located
// in MainScript.js is called.
//
// Weather data comes from the free NWS api.weather.gov API (US only), reached through the
// /nws/* routes proxied by server.js (see NWSInterface.js) rather than fetched directly from
// the browser, since NWS asks callers to self-identify via a User-Agent header and browsers
// don't allow client-side JS to set that header.

// Module level variables.
var longitude;
var latitude;
var gridId;
var gridX;
var gridY;
var stationId;

// Small unit-conversion helpers for the fields NWS's /observations endpoint returns
// in fixed SI units. (The /forecast endpoint takes a units=us|si query param and does
// this conversion server-side already, so these are only needed for current conditions.)
// CONFIG.units 'h' (uk_hybrid) isn't specially handled here — it's treated like imperial,
// since this app is now US-only and that mode isn't expected to see real use.
function cToF(c) {
  return c == null ? null : Math.round(c * 9 / 5 + 32);
}

function kmhToMph(kmh) {
  return kmh == null ? null : Math.round(kmh * 0.621371);
}

// Inverse conversions, used by fetchHourlyForecast() below -- that data is always
// requested in °F/mph (see the comment there for why) and converted to metric for
// display afterward, the opposite direction from the helpers above.
function fToC(f) {
  return f == null ? null : Math.round((f - 32) * 5 / 9);
}

function mphToKmh(mph) {
  return mph == null ? null : Math.round(mph * 1.60934);
}

function degToCardinal(deg) {
  if (deg == null) return '';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fetchAlerts(){
  var alertCrawl = "";
  var alertCSec = "";
  var alertText = "";
  var alertCount = 0;
  var alertDup = false;

  // Clear any alerts left over from a previous cycle (looping re-runs this same
  // function in place, so stale entries from a prior, longer alert list would
  // otherwise survive at higher indices -- see resetForNewCycle() in MainScript.js).
  Weather.alerts.length = 0;

  // Only fetch alerts if the global setting allows,
  // otherwise just fetch the forecast.

  if(CONFIG.alertsEnabled) {
    fetch(`/nws/alerts/${latitude}/${longitude}`)
      .then(function(response) {
          if (response.status !== 200) {
              console.warn("Alerts Error, no alerts will be shown");
          }
        response.json().then(function(data) {
          if (data.features !== undefined) {
            for(var i = 0; i < data.features.length; i++) {
              alertText=AlertFormat("<b>"+data.features[i].properties.event + "</b><br>" + data.features[i].properties.description).replace(/\n/g," ");
              // If alerts already exist, need to compare the dispText values to avoid duplicates.
              alertDup=false;
              if (alertCount>0){
                for(var i2 = 0; i2 < alertCount; i2++) {
                  if (alertText==Weather.alerts[i2].dispText) {
                    alertDup=true;
                    break;
                  }
                }
              }
              if (!alertDup) {
                // Initialize a new AlertObj object.
                Weather.alerts[alertCount] = new Weather.AlertObj;
                // Compute a non-narration alert display time, based roughly on the length of the alert.
                Weather.alerts[alertCount].duration = 5000+(40*alertText.length); // default minimum display duration (used if not narrating)
                Weather.alerts[alertCount].dispText = alertText;
                // Set the crawl to be a constant string with all the newlines removed.
                alertCSec = AlertFormat(data.features[i].properties.event + ". " + data.features[i].properties.description).replace(/\n/g," ");
                // define the spoken alert text with expanded terms so the pronunciation is correct.
                Weather.alerts[alertCount].speechText=VFormat(alertCSec);
                alertCrawl = alertCrawl + " " + alertCSec;
                alertCount++; // After the new object has been created, update the total alert counter.
              }
            }
            // Restore the base crawl text when this cycle has no alert crawl to show,
            // instead of leaving a previous cycle's alert text stuck in CONFIG.crawl.
            CONFIG.crawl = alertCrawl || CONFIG.baseCrawl;
            Weather.alertsActive = alertCount;
          } else {
            Weather.alertsActive = 0 ; // No active alerts returned.
          }
          fetchForecast(); // continue getting weather data only after response is received and processed.
        });
      })
  } else {
    Weather.alertsActive = 0; // no alerts since alerts are disabled.
    CONFIG.crawl = CONFIG.baseCrawl;
    fetchForecast();
  }
}

function KVReplace(SString,KeyPairs) {
// This function performs a bulk replacement on a string using a set of key value pairs and resturns the resulting string.

  Object.entries(KeyPairs).forEach(([key, value]) => {
   SString = SString.replaceAll(key,value);
  });

return SString;
}

function AlertFormat(RawNarrative) {
// This function removes some of the key terms from the narrative to display a more natural readability.
  var KeyTerms = {"* WHAT...":" ","* WHERE...":"Location ","* WHEN...":"Lasting ","* IMPACTS...":" ","* ADDITIONAL DETAILS...":" "};

return KVReplace(RawNarrative,KeyTerms);
}

function VFormat(RawNarrative) {
// This function replaces weather abbreviations in the narrative with the full words to allow spoken voice.
//Wind
  const WindDir = {" N ":" north "," NNE ":" north north east "," NE ":" north east "," NNW ":" north north west "," NW ":" north west ",
                 " E ":" east "," ENE ":" east north east "," ESE ":" east south east ",
                 " S ":" south "," SSE ":" south south east "," SE ":" south east "," SSW ":" south south west "," SW ":" south west ",
                 " W ":" west "," WNW ":" west north west "," WSW ":" west south west "};
//Time Zones
  const TimeZone = {" EST ":" eastern standard time "," EDT ":" eastern daylight time ",
    " CST ":" central standard time "," CDT ":" central daylight time ",
    " MST ":" mountain standard time "," MDT ":" mountain daylight time ",
    " PST ":" pacific standard time "," PDT ":" pacific daylight time ",
    " HST ":" Hawaii standard time "};
//Fractional Distances
  const FracDist = {" 1/4 ":" a quarter "," 1/2 ":" a half "," 3/4 ":" three quarters of a "};

  RawNarrative = KVReplace(RawNarrative,WindDir);
  RawNarrative = KVReplace(RawNarrative,TimeZone);
  RawNarrative = KVReplace(RawNarrative,FracDist);

  RawNarrative = RawNarrative.replace(/(\d+)F/gi," $1 degrees.");
  RawNarrative = RawNarrative.replace(/mph/gi,"miles per hour");

  RawNarrative = RawNarrative.replace(/(\d+)C/gi," $1 celsius.");
  RawNarrative = RawNarrative.replace(/km\/h/gi,"kilometers per hour");
return RawNarrative;
}

// NWS's official heat index formula (Rothfusz regression, https://www.weather.gov/ama/heatindex)
// -- only valid/meaningful roughly at tempF>=80; below that "feels like" is just the
// actual temperature.
function heatIndexF(tempF, humidityPct) {
  if (tempF < 80) return tempF;
  let hi = 0.5 * (tempF + 61.0 + ((tempF - 68.0) * 1.2) + (humidityPct * 0.094));
  if (hi < 80) return hi;
  hi = -42.379 + 2.04901523*tempF + 10.14333127*humidityPct - 0.22475541*tempF*humidityPct
     - 0.00683783*tempF*tempF - 0.05481717*humidityPct*humidityPct
     + 0.00122874*tempF*tempF*humidityPct + 0.00085282*tempF*humidityPct*humidityPct
     - 0.00000199*tempF*tempF*humidityPct*humidityPct;
  if (humidityPct < 13 && tempF >= 80 && tempF <= 112) {
    hi -= ((13 - humidityPct) / 4) * Math.sqrt((17 - Math.abs(tempF - 95.0)) / 17);
  } else if (humidityPct > 85 && tempF >= 80 && tempF <= 87) {
    hi += ((humidityPct - 85) / 10) * ((87 - tempF) / 5);
  }
  return hi;
}

// NWS's official wind chill formula (https://www.weather.gov/safety/cold-wind-chill-chart)
// -- only valid for tempF<=50 and windMph>=3; outside that, "feels like" is just the
// actual temperature.
function windChillF(tempF, windMph) {
  if (tempF > 50 || windMph < 3) return tempF;
  return 35.74 + 0.6215*tempF - 35.75*Math.pow(windMph, 0.16) + 0.4275*tempF*Math.pow(windMph, 0.16);
}

function feelsLikeF(tempF, humidityPct, windMph) {
  if (tempF >= 80) return heatIndexF(tempF, humidityPct);
  if (tempF <= 50 && windMph >= 3) return windChillF(tempF, windMph);
  return tempF;
}

const HOURLY_FORECAST_HOURS = 48; // 2 days

// Populates Weather.hourly for the hourly-forecast-page chart (Precipitation
// Probability, Temperature, Heat Index/Wind Chill, Wind Speed over the next 2 days).
// Always requested in imperial units regardless of CONFIG.units -- the heat
// index/wind chill formulas above are only valid in °F/mph, so this fetches in
// °F/mph, computes feels-like there, then converts the whole series to metric
// afterward if the display is set to metric (see fToC/mphToKmh above).
async function fetchHourlyForecast(){
  try {
    const response = await fetch(`/nws/hourly-forecast/${gridId}/${gridX}/${gridY}/us`);
    if (response.status !== 200) {
      console.log('hourly forecast request error');
      return;
    }
    const periods = (await response.json()).slice(0, HOURLY_FORECAST_HOURS);
    const isMetric = CONFIG.units === 'm';

    Weather.hourly = periods.map(p => {
      const tempF = p.temperature;
      const humidityPct = p.relativeHumidity?.value ?? 0;
      const windMph = parseInt(p.windSpeed, 10) || 0;
      const feelsF = feelsLikeF(tempF, humidityPct, windMph);

      return {
        label: new Date(p.startTime).toLocaleTimeString([], { hour: 'numeric' }),
        temp: isMetric ? fToC(tempF) : Math.round(tempF),
        feelsLike: isMetric ? fToC(feelsF) : Math.round(feelsF),
        windSpeed: isMetric ? mphToKmh(windMph) : windMph,
        precip: p.probabilityOfPrecipitation?.value ?? 0,
      };
    });
  } catch (err) {
    console.error('hourly forecast request error', err);
  }
}

const MOON_PHASE_NAMES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];
const MOON_PHASE_ICONS = [
  'moon-new', 'moon-waxing-crescent', 'moon-first-quarter', 'moon-waxing-gibbous',
  'moon-full', 'moon-waning-gibbous', 'moon-last-quarter', 'moon-waning-crescent',
];

// Circular distance between two points on a 0-1 cycle (e.g. moon phase), handling
// wraparound at the 0/1 boundary correctly.
function circDist(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

// Finds the next upcoming occurrence (within `days`) of each of the 4 primary moon
// phases, by scanning forward day-by-day and taking the first local minimum
// (checking both neighbors) of circular distance to each target phase value -- same
// brute-force forward scan approach WeatherStar 4000+ (ws4kp) uses via SunCalc.
// (A global-minimum-over-the-window approach was tried first and rejected: with a
// scan window longer than one synodic month, it can pick the *second* upcoming
// occurrence if that day's sample happens to land closer to the exact phase moment
// than the first one's sample does.)
function nextPrimaryPhaseDates(from, days = 40) {
  const targets = [
    { name: 'New Moon', value: 0, icon: 'moon-new' },
    { name: 'First Quarter', value: 0.25, icon: 'moon-first-quarter' },
    { name: 'Full Moon', value: 0.5, icon: 'moon-full' },
    { name: 'Last Quarter', value: 0.75, icon: 'moon-last-quarter' },
  ];
  return targets.map(t => {
    const dists = [];
    for (let i = 0; i <= days; i++) {
      const date = new Date(from.getTime() + i * 86400000);
      dists.push({ date, dist: circDist(SunCalc.getMoonIllumination(date).phase, t.value) });
    }
    let found = dists[dists.length - 1];
    for (let i = 1; i < dists.length - 1; i++) {
      if (dists[i].dist <= dists[i - 1].dist && dists[i].dist <= dists[i + 1].dist) {
        found = dists[i];
        break;
      }
    }
    return { name: t.name, icon: t.icon, date: found.date };
  });
}

function formatAlmanacTime(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m < 10 ? '0' : ''}${m} ${suffix}`;
}

function formatAlmanacDate(date) {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Populates Weather.almanac for the almanac-page: sunrise/sunset (today + tomorrow)
// and moon phase data (current phase + next occurrence of each of the 4 primary
// phases). Computed locally via the vendored SunCalc library (js/vendor/suncalc.js,
// global `SunCalc`) from the already-resolved latitude/longitude -- a pure
// astronomical calculation, no external API call. Same library ws4kp uses for the
// same purpose.
function computeAlmanac(){
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const todayTimes = SunCalc.getTimes(now, latitude, longitude);
  const tomorrowTimes = SunCalc.getTimes(tomorrow, latitude, longitude);

  const illumination = SunCalc.getMoonIllumination(now);
  const phaseIdx = Math.round(illumination.phase * 8) % 8;

  Weather.almanac = {
    sunriseToday: formatAlmanacTime(todayTimes.sunrise),
    sunsetToday: formatAlmanacTime(todayTimes.sunset),
    sunriseTomorrow: formatAlmanacTime(tomorrowTimes.sunrise),
    sunsetTomorrow: formatAlmanacTime(tomorrowTimes.sunset),
    currentPhaseName: MOON_PHASE_NAMES[phaseIdx],
    currentPhaseIcon: MOON_PHASE_ICONS[phaseIdx],
    // Sorted soonest-first: nextPrimaryPhaseDates() finds each of the 4 primary
    // phases' own next occurrence independently, so depending on where today falls
    // in the current cycle, they don't necessarily come back out in New/First/Full/
    // Last order -- e.g. shortly after a Full Moon, the next Last Quarter lands
    // before the next New Moon does. The almanac-page shows these left to right as
    // "what's coming up," so they need to be in actual date order, not phase order.
    phases: nextPrimaryPhaseDates(now)
      .map(p => ({ ...p, dateText: formatAlmanacDate(p.date) }))
      .sort((a, b) => a.date - b.date),
  };
}

// Populates Weather.endingHashtag for the closing "It's Amazing Out There" slide.
// Uses the AMAZING_HASHTAG override from .env if set (globalConfig.general.
// amazingHashtag), otherwise builds one from the resolved NWS forecast office/CWA
// identifier (gridId) -- e.g. Birmingham, AL's CWA "BMX" becomes "#bmxWX".
function computeEndingHashtag(){
  Weather.endingHashtag = globalConfig.general.amazingHashtag || `#${gridId.toLowerCase()}WX`;
}

// Populates Weather.activeWarnings for the 2-Hour Regional Radar page's warning-polygon
// overlay -- a nationwide fetch (see GetActiveWarnings() in NWSInterface.js for why),
// not scoped to this location like fetchAlerts() above. Fire-and-forget like
// fetchHourlyForecast(): the radar page isn't the first thing shown each cycle, so this
// has several seconds to resolve before it would ever be visible. Non-fatal on
// failure -- the radar itself still works, it just won't have the overlay this cycle.
function fetchActiveWarnings(){
  fetch('/nws/warnings/active')
    .then((response) => response.json())
    .then((data) => {
      Weather.activeWarnings = data;
      // The regional radar map may or may not already exist by the time this resolves
      // (this isn't awaited before fetchRadarImages() runs) -- if it doesn't yet, this
      // simply no-ops, and the radar provider module applies this same data itself once
      // it creates the map (see e.g. RadarLeafletIEM.js).
      addActiveWarningOverlay(Weather.radarImage?.map, Weather.activeWarnings);
    })
    .catch((err) => console.log("fetchActiveWarnings failed (non-fatal, radar overlay just won't show):", err.message));
}

async function fetchForecast(){
  try {
    const units = CONFIG.units === 'm' ? 'si' : 'us';
    const response = await fetch(`/nws/forecast/${gridId}/${gridX}/${gridY}/${units}`);
    if (response.status !== 200) {
      console.log('forecast request error');
      return;
    }
    const periods = await response.json();

    // NWS periods are a flat timeline alternating day/night, starting with the current
    // (possibly partial) period.
    isDay = periods[0].isDaytime;

    // narratives: the first 4 periods usually cover today/tonight/tomorrow/tomorrow-
    // night, but NOT always -- if it's already night out when this fetches, periods[0]
    // is "Tonight" itself, not "Today", and everything shifts by one. The 4 forecast
    // boxes' own header text (forecastDayLabel, set from NWS's own period name) is
    // what keeps the label honest about which period is actually in each box, rather
    // than assuming a fixed Today/Tonight/Tomorrow/Tomorrow-Night order that only
    // holds true when fetched during the day.
    for (let i = 0; i <= 3; i++) {
      let n = periods[i];
      Weather.forecastDayLabel[i] = n.name.toUpperCase();
      Weather.forecastTemp[i] = n.temperature;
      Weather.forecastIcon[i] = mapIconName(n.icon);
      Weather.forecastNarrative[i] = VFormat(n.detailedForecast);
      Weather.forecastPrecip[i] = `${n.probabilityOfPrecipitation?.value ?? 0}% Chance<br/> of ${mapPrecipLabel(n.icon)}`;
    }

    // 7-day outlook: pair up consecutive day/night periods into one calendar day's
    // high/low/condition/icon each, starting from the same period the narrative boxes
    // above start from (day 1 of the outlook intentionally overlaps "today", same as
    // the earlier version of this app did) -- NWS only returns ~14 periods total, just
    // enough for 7 such pairs, so this can't start any later without running out.
    // Reset first: looping re-runs this function in place, and if a cycle yields fewer
    // usable periods than a previous one, stale trailing entries would otherwise survive.
    Weather.outlookHigh = [];
    Weather.outlookLow = [];
    Weather.outlookCondition = [];
    Weather.outlookIcon = [];
    for (let i = 0; i < 7; i++) {
      const idx = i * 2;
      const p1 = periods[idx];
      const p2 = periods[idx + 1];
      if (!p1 && !p2) break; // ran out of periods

      const dayPeriod = p1?.isDaytime ? p1 : p2;
      const nightPeriod = p1?.isDaytime ? p2 : p1;
      const primary = dayPeriod || nightPeriod;

      Weather.outlookHigh[i] = (dayPeriod || nightPeriod).temperature;
      Weather.outlookLow[i] = (nightPeriod || dayPeriod).temperature;
      Weather.outlookCondition[i] = mapConditionLabel(primary.icon);
      Weather.outlookIcon[i] = mapIconName(primary.icon);
    }

    fetchHourlyForecast();
    computeAlmanac(); // synchronous, no network call -- no need to fire-and-forget like the above
    computeEndingHashtag();
    fetchActiveWarnings();
    fetchRadarImages();
    buildTrafficMap(latitude, longitude);
  } catch (err) {
    console.error('forecast request error', err);
  }
}

async function fetchCurrentConditions(){
  try {
    const isMetric = CONFIG.units === 'm';
    const response = await fetch(`/nws/observations/${stationId}/2`);
    if (response.status !== 200) {
      console.log("conditions request error");
      return;
    }
    const observations = await response.json(); // newest first
    const latest = observations[0]?.properties;
    const previous = observations[1]?.properties;

    if (!latest) {
      console.log("conditions request error: no observations returned");
      return;
    }

    const tempC = latest.temperature.value;
    const feelsC = latest.heatIndex.value ?? latest.windChill.value ?? tempC;
    const gustKmh = latest.windGust.value;

    Weather.currentTemperature = isMetric ? Math.round(tempC) : cToF(tempC);
    // Small/rural stations often don't report a present-weather description at all
    // (textDescription: "") -- "Fair" reads naturally in both the on-screen condition
    // box and the spoken narrative ("...under Fair skies"), unlike leaving this blank.
    Weather.currentCondition = latest.textDescription || 'Fair';
    Weather.windSpeed = `${degToCardinal(latest.windDirection.value)} ${isMetric ? Math.round(latest.windSpeed.value ?? 0) : (kmhToMph(latest.windSpeed.value) ?? 0)} ${isMetric ? 'km/h' : 'mph'}`;
    Weather.gusts = gustKmh != null ? (isMetric ? Math.round(gustKmh) : kmhToMph(gustKmh)) : 'NONE';
    Weather.feelsLike = isMetric ? Math.round(feelsC) : cToF(feelsC);
    Weather.currentIcon = mapIconName(latest.icon);

    // visibility.value is always meters; humidity is always a %; dewpoint is always °C.
    // Same station sparsity as above -- visibility (and pressure, below) come back
    // null rather than merely absent for some stations, and null survives arithmetic
    // silently in JS (null/x is 0, not NaN), which previously rendered as a misleading
    // literal "0" instead of showing this stat is simply unavailable. Kept as null here
    // deliberately -- scrollCC() in MainScript.js checks for it and shows "N/A" instead
    // of animating toward it (that animation helper can't handle a non-numeric target).
    Weather.visibility = latest.visibility.value != null
      ? Math.round(isMetric ? latest.visibility.value / 1000 : latest.visibility.value / 1609.344)
      : null;
    Weather.humidity = Math.round(latest.relativeHumidity.value);
    Weather.dewPoint = isMetric ? Math.round(latest.dewpoint.value) : cToF(latest.dewpoint.value);

    // Prefer sea-level (altimeter-style) pressure -- falls back to raw station pressure
    // since sea-level pressure is sometimes unreported by a given station.
    const pressurePa = latest.seaLevelPressure.value ?? latest.barometricPressure.value;
    Weather.pressure = pressurePa != null
      ? (isMetric ? pressurePa / 100 : pressurePa / 3386.39).toPrecision(4)
      : null;

    // Derive a rising/falling pressure trend arrow from the two most recent readings,
    // since a single NWS observation doesn't include a trend field.
    const p1 = latest.barometricPressure.value;
    const p2 = previous?.barometricPressure?.value;
    Weather.pressureTrend = (p1 != null && p2 != null) ? (p1 > p2 ? '▲' : p1 < p2 ? '▼' : '') : '';

    fetchAlerts();
  } catch (err) {
    console.error('conditions request error', err);
  }
}

// Cooldown before automatically retrying the whole fetchCurrentWeather() pipeline
// after a transient failure (NWSInterface.js has already retried the individual NWS/
// zippopotam request a few times by this point -- this is the "it's still down"
// fallback). A native alert() here would block all JS on the page (timers, audio,
// animation) until someone physically clicks it, which never happens on an
// unattended/AUTO_START display -- so this logs and self-heals instead.
const WEATHER_RETRY_COOLDOWN_MS = 60000;

function scheduleWeatherRetry() {
  console.error(`Weather fetch failed; retrying in ${WEATHER_RETRY_COOLDOWN_MS / 1000}s.`);
  setTimeout(fetchCurrentWeather, WEATHER_RETRY_COOLDOWN_MS);
}

async function resolveGridpoint(){
  const response = await fetch(`/nws/points/${latitude}/${longitude}`);
  if (response.status !== 200) {
    console.error('gridpoint request error');
    scheduleWeatherRetry();
    return;
  }
  const points = await response.json();
  gridId = points.gridId;
  gridX = points.gridX;
  gridY = points.gridY;
  Weather.timeZone = points.timeZone;

  // The physical WSR-88D radar site NWS considers "local" for this location -- marked
  // on the regional radar map (see RadarStationMarker.js) so it's clear which dish the
  // displayed imagery is actually coming from. Non-fatal on failure: the radar map
  // itself doesn't depend on this, it just won't have the marker for this cycle.
  Weather.radarStation = null;
  if (points.radarStation) {
    try {
      const radarStationResponse = await fetch(`/nws/radar-station/${points.radarStation}`);
      if (radarStationResponse.status === 200) {
        Weather.radarStation = await radarStationResponse.json();
      } else {
        console.log('radar-station request error, status', radarStationResponse.status);
      }
    } catch (err) {
      console.log('radar-station request failed (non-fatal, marker just won\'t show):', err.message);
    }
  }

  // AIRPORT mode already resolved its observation station directly (the ICAO code
  // doubles as the NWS station ID); POSTAL mode still needs the nearest station.
  if (!stationId) {
    const stationResponse = await fetch(`/nws/nearest-station/${gridId}/${gridX}/${gridY}`);
    if (stationResponse.status !== 200) {
      console.error('nearest-station request error');
      scheduleWeatherRetry();
      return;
    }
    stationId = (await stationResponse.json()).stationId;
  }

  fetchCurrentConditions();
}

export async function fetchCurrentWeather(){

  //Let's check what we're dealing with
  console.log(CONFIG.locationMode)

  if (CONFIG.locationMode == "POSTAL") {
    try {
      const response = await fetch(`/nws/geocode/${zipCode}`);
      if (response.status == 404) {
        alert("Location not found!");
        console.log('conditions request error');
        return;
      }
      if (response.status !== 200) {
        console.error('conditions request error');
        scheduleWeatherRetry();
        return;
      }
      const data = await response.json();
      cityName = data.city.toUpperCase();
      latitude = data.lat;
      longitude = data.lon;
      stationId = undefined; // resolved from the gridpoint in resolveGridpoint()
      resolveGridpoint();
    } catch (err) {
      alert('Enter valid ZIP code');
      console.error(err);
      getZipCodeFromUser();
    }
  } else if (CONFIG.locationMode == "AIRPORT") {
    //Determine whether this is an IATA or ICAO code. NWS station IDs are always the
    //4-letter ICAO form, so a 3-letter IATA code gets the "K" (CONUS) prefix added.
    let airportCodeLength = airportCode.length;
    let icao;
    if (airportCodeLength == 3) { icao = "K" + airportCode; }
    else if (airportCodeLength == 4) { icao = airportCode; }
    else {
      alert("Please enter a valid ICAO or IATA Code");
      console.error(`Expected Airport Code Lenght to be 3 or 4 but was ${airportCodeLength}`);
      return;
    }

    try {
      const response = await fetch(`/nws/station/${icao}`);
      if (response.status == 404) {
        alert("Location not found!");
        console.log('conditions request error');
        return;
      }
      if (response.status !== 200) {
        console.error('conditions request error');
        scheduleWeatherRetry();
        return;
      }
      const data = await response.json();
      cityName = data.name
        .toUpperCase() //Airport names are long
        .replace("INTERNATIONAL","") //If a city name is too long, info bar breaks
        .trim();
      latitude = data.lat;
      longitude = data.lon;
      stationId = icao; // the ICAO code is itself a valid NWS observation station ID
      resolveGridpoint();
    } catch (err) {
      alert('Enter a valid airport code');
      console.error(err);
      getZipCodeFromUser();
    }
  } else {
    alert("Please select a location type");
    console.error("Unknown what to use for location");
  }

}

function fetchRadarImages(){
  // This is now a routing function. There are specific function calls for each radar service.
  switch (CONFIG.radarSource) {
    case "direct-nws":
      getRadarDirectNWS();
      break;
    case "leaflet-iowastate":
      getRadarLeafletIEM(latitude,longitude);
      break;
    case "leaflet-rainviewer":
      getRadarLeafletRainViewer(latitude,longitude);
      break;
    case "leaflet-xweather":
      getRadarLeafletXW(latitude,longitude,CONFIG.radarAPIKey);
      break;
    case "leaflet-rainbowai":
      getRadarLeafletRBAI(latitude,longitude);
      break;
    default:
      console.log("Unknown Radar Service! No Radar retrieved. radarSource=",CONFIG.radarSource);
      break;
  }

  // Radar is the last in a string of weather elements to obtain.
  // After all the weather data is obtained, start the visual playback sequence.
  scheduleTimeline(); // Start the Local on the 8's main sequencer.
}

function getRadarDirectNWS(){
  var mapSettings;

  Weather.radarImage = document.createElement("iframe");
  Weather.radarImage.onerror = function () {
    getElement('radar-container').style.display = 'none';
  }

  mapSettings = btoa(JSON.stringify({
    "agenda": {
      "id": "weather",
      "center": [longitude, latitude],
      "location": null,
      "zoom": 8
    },
    "animating": true,
    "base": "standard",
    "artcc": false,
    "county": false,
    "cwa": false,
    "rfc": false,
    "state": false,
    "menu": false,
    "shortFusedOnly": false,
    "opacity": {
      "alerts": 0.0,
      "local": 0.0,
      "localStations": 0.0,
      "national": 0.6
    }
  }));
  Weather.radarImage.setAttribute("src", "https://radar.weather.gov/?settings=v1_" + mapSettings);
  Weather.radarImage.style.width = "100%"
  // What is going on here is that the standard NWS presentation contains a banner across the top of the frame.
  // This 56px banner is shifted up out of view and the total height is adjusted to compensate.
  Weather.radarImage.style.height = "calc(100% + 56px)"
  Weather.radarImage.style.marginTop = "-56px"
  Weather.radarImage.style.overflow = "hidden"

  if(Weather.alertsActive == -1) {
    console.log("TIMING ERROR!! In radar page acquisition and alert status is undefined!");
  }

  // zoomed-radar-page ("2 Hour Local Radar") was removed from the alert sequences in
  // MainScript.js -- no longer building Weather.zoomedRadarImage here either, since
  // that page never shows now.
}
