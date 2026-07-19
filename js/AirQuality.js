// Closing air-quality slide ("air-quality-page", shown right after the traffic
// slide, before the outro) -- current AQI plus a breakdown by pollutant (ozone,
// PM2.5, PM10/dust, etc.) from the EPA's free AirNow API, plus today's forecast
// category. See AirNowInterface.js/server.js for the server-side proxy that keeps
// the API key off the client and handles caching/rate-limit-safe behavior.
import { globalConfig } from '../common_configuration.js';

// EPA's own official AQI category colors/names (Category.Number 1-6 in AirNow's
// response), not an approximation -- https://www.airnow.gov/aqi/aqi-basics/.
const AQI_CATEGORIES = {
  1: { name: 'Good', color: '#00E400' },
  2: { name: 'Moderate', color: '#FFFF00' },
  3: { name: 'Unhealthy for Sensitive Groups', color: '#FF7E00' },
  4: { name: 'Unhealthy', color: '#FF0000' },
  5: { name: 'Very Unhealthy', color: '#8F3F97' },
  6: { name: 'Hazardous', color: '#7E0023' },
};

// AirNow's own ParameterName codes -> a friendlier on-screen label. PM10 is labeled
// with "Dust" alongside its formal name since wind-blown dust is its single most
// common real-world source and that's the plain-language term most viewers actually
// look for (matches how the user described wanting this feature).
const POLLUTANT_LABELS = {
  'O3': 'Ozone',
  'PM2.5': 'Fine Particles (PM2.5)',
  'PM10': 'Dust / Coarse Particles (PM10)',
  'CO': 'Carbon Monoxide',
  'SO2': 'Sulfur Dioxide',
  'NO2': 'Nitrogen Dioxide',
};

// A separate, speech-friendly version of the same labels for aqiNarrationText()
// below -- the on-screen labels' parenthetical abbreviations and slash ("Fine
// Particles (PM2.5)", "Dust / Coarse Particles (PM10)") read fine as text but sound
// awkward spoken aloud by TTS.
const SPOKEN_POLLUTANT_LABELS = {
  'O3': 'ozone',
  'PM2.5': 'fine particles',
  'PM10': 'dust and coarse particles',
  'CO': 'carbon monoxide',
  'SO2': 'sulfur dioxide',
  'NO2': 'nitrogen dioxide',
};

function categoryFor(categoryField) {
  return AQI_CATEGORIES[categoryField?.Number] || { name: categoryField?.Name || 'Unknown', color: '#888888' };
}

// EPA defines "the AQI" for a reporting area as the single highest (worst) value
// across whatever pollutants are actually monitored there -- same reasoning AirNow's
// own current-conditions displays use. Shared by renderAirQuality() and
// aqiNarrationText() below so the spoken rating always matches the on-screen one.
function getOverallObservation() {
  return latestObservations.reduce((max, o) => (o.AQI > max.AQI ? o : max), latestObservations[0]);
}

let latestObservations = [];
let latestForecast = [];

// Fetches fresh data for the current location -- called from WeatherFetching.js as
// fire-and-forget, same as buildTrafficMap() (a real API call, some of it a multi-MB
// file download for the contour slide, has no business blocking the whole
// presentation from starting -- it used to be awaited here, which is exactly what
// made the presentation visibly hang on load). airQualitySlideAvailable() below is
// therefore checked synchronously by scheduleTimeline() before this necessarily
// finishes -- deliberately NOT clearing latestObservations up front (only ever
// overwritten once a new result, success or empty, actually arrives) so that
// synchronous check reads the previous cycle's still-valid data instead of a
// freshly-wiped empty array. In practice this means the slide's on/off state lags
// the real data by about one loop cycle, never zero.
export async function fetchAirQuality(lat, lon, zip) {
  if (!globalConfig.airQuality.enabled) {
    latestObservations = [];
    latestForecast = [];
    return false;
  }

  const params = (lat != null && lon != null) ? `lat=${lat}&lon=${lon}` : (zip ? `zip=${zip}` : null);
  if (!params) {
    latestObservations = [];
    latestForecast = [];
    return false;
  }

  let newObservations, newForecast;
  try {
    const [obsResponse, forecastResponse] = await Promise.all([
      fetch(`/airquality/observations?${params}`),
      fetch(`/airquality/forecast?${params}`),
    ]);
    newObservations = await obsResponse.json();
    newForecast = await forecastResponse.json();
  } catch (err) {
    console.log('[AirQuality] fetch failed (non-fatal, leaving previous data in place):', err.message);
    return latestObservations.length > 0;
  }
  latestObservations = newObservations;
  latestForecast = newForecast;

  if (latestObservations.length === 0) {
    console.log('[AirQuality] Air quality slide hidden: no AirNow monitoring data available near this location.');
    return false;
  }
  return true;
}

// Synchronous -- reads whatever fetchAirQuality() last resolved to, without a new
// network round trip. Called from MainScript.js's scheduleTimeline() to decide
// whether to include the slide in this cycle's rotation.
export function airQualitySlideAvailable() {
  return latestObservations.length > 0;
}

// Spoken narration for the air-quality-page -- called from MainScript.js's
// executePage() (speechStart(aqiNarrationText())), same pattern as current-page's
// own dynamic cCondText(). Returns '' if there's nothing to say, which in practice
// never actually reaches speechStart() -- the page is only ever in the rotation at
// all when airQualitySlideAvailable() (same underlying data) is true.
export function aqiNarrationText() {
  if (latestObservations.length === 0) return '';
  const overall = getOverallObservation();
  const category = categoryFor(overall.Category);
  const pollutant = SPOKEN_POLLUTANT_LABELS[overall.ParameterName] || overall.ParameterName;
  return `The current Air Quality Index is ${overall.AQI}, rated ${category.name}, driven primarily by ${pollutant}.`;
}

// Populates the DOM -- called from MainScript.js's setInformation(), same
// pattern as every other page's setXxx(), only once scheduleTimeline() has already
// confirmed (via fetchAirQuality() above) there's real data for this cycle.
export function renderAirQuality() {
  if (latestObservations.length === 0) return;

  const overall = getOverallObservation();
  const overallCategory = categoryFor(overall.Category);

  const valueEl = getElement('aqi-overall-value');
  const categoryEl = getElement('aqi-overall-category');
  valueEl.textContent = overall.AQI;
  valueEl.style.color = overallCategory.color;
  categoryEl.textContent = overallCategory.name;
  categoryEl.style.color = overallCategory.color;
  getElement('aqi-reporting-area').textContent = `${overall.ReportingArea}, ${overall.StateCode}`;

  const listEl = getElement('aqi-pollutant-list');
  listEl.innerHTML = latestObservations
    .slice()
    .sort((a, b) => b.AQI - a.AQI)
    .map((o) => {
      const cat = categoryFor(o.Category);
      const label = POLLUTANT_LABELS[o.ParameterName] || o.ParameterName;
      return `<div class="aqi-pollutant-item">`
        + `<span class="aqi-pollutant-swatch" style="background:${cat.color}"></span>`
        + `<span class="aqi-pollutant-name regular-text">${label}</span>`
        + `<span class="aqi-pollutant-value regular-text">${o.AQI}</span>`
        + `</div>`;
    })
    .join('');

  const forecastEl = getElement('aqi-forecast');
  const todaysForecasts = latestForecast.filter(f => f.DateForecast === overall.DateObserved);
  const worstToday = todaysForecasts.length > 0
    ? todaysForecasts.reduce((max, f) => (f.AQI > max.AQI ? f : max), todaysForecasts[0])
    : null;
  if (worstToday) {
    const fCategory = categoryFor(worstToday.Category);
    forecastEl.textContent = `Today's Forecast: ${fCategory.name}`;
    forecastEl.style.color = fCategory.color;
  } else {
    forecastEl.textContent = '';
  }
}
