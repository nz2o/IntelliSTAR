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

function categoryFor(categoryField) {
  return AQI_CATEGORIES[categoryField?.Number] || { name: categoryField?.Name || 'Unknown', color: '#888888' };
}

let latestObservations = [];
let latestForecast = [];

// Fetches fresh data for the current location -- called (and awaited) from
// WeatherFetching.js BEFORE scheduleTimeline() runs, so airQualitySlideAvailable()
// below always reflects this cycle's result, not a stale one from before. "Nothing
// to show" covers AirNow not being configured, the key not working, AND -- just as
// likely, and not an error at all -- a smaller town with no monitor nearby; either
// way the slide is skipped the same way.
export async function fetchAirQuality(lat, lon, zip) {
  latestObservations = [];
  latestForecast = [];

  if (!globalConfig.airQuality.enabled) {
    return false;
  }

  const params = (lat != null && lon != null) ? `lat=${lat}&lon=${lon}` : (zip ? `zip=${zip}` : null);
  if (!params) return false;

  try {
    const [obsResponse, forecastResponse] = await Promise.all([
      fetch(`/airquality/observations?${params}`),
      fetch(`/airquality/forecast?${params}`),
    ]);
    latestObservations = await obsResponse.json();
    latestForecast = await forecastResponse.json();
  } catch (err) {
    console.log('[AirQuality] fetch failed (non-fatal, slide will be hidden this cycle):', err.message);
    return false;
  }

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

// Populates the DOM -- called from MainScript.js's setInformation(), same
// pattern as every other page's setXxx(), only once scheduleTimeline() has already
// confirmed (via fetchAirQuality() above) there's real data for this cycle.
export function renderAirQuality() {
  if (latestObservations.length === 0) return;

  // EPA defines "the AQI" for a reporting area as the single highest (worst) value
  // across whatever pollutants are actually monitored there -- same reasoning
  // AirNow's own current-conditions displays use.
  const overall = latestObservations.reduce((max, o) => (o.AQI > max.AQI ? o : max), latestObservations[0]);
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
