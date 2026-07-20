// Closing seismic-activity slide ("seismic-page", shown right after the air-quality
// slides, before the outro) -- recent earthquakes within a radius of the current
// location, from USGS's free, keyless earthquake feed. See USGSInterface.js/server.js
// for the server-side proxy (radius/magnitude/lookback window, caching).
//
// "Forecast" seismic activity isn't offered here -- earthquakes aren't predictable
// short-term the way weather is; USGS only publishes long-term probabilistic hazard
// maps (not event-specific) and post-event aftershock forecasts (only exist after a
// notable quake already happened), neither of which fits a rotating slide. This only
// ever shows what's already happened, same "current conditions" framing as the rest
// of the app.
import { globalConfig } from '../common_configuration.js';

function formatTimeAgo(epochMs) {
  const diffMs = Date.now() - epochMs;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'moments ago';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// USGS's own "significance" score (magnitude + felt reports + estimated impact
// combined, not just raw magnitude) -- same idea as AirQuality.js picking the worst
// pollutant reading to headline rather than just the first one back. See
// USGSInterface.js for where this comes from.
function getMostSignificantEvent() {
  return latestEvents.reduce((max, e) => (e.significance > max.significance ? e : max), latestEvents[0]);
}

let latestEvents = [];

// Fetches fresh data for the current location -- called from WeatherFetching.js as
// fire-and-forget, same reasoning as fetchAirQuality()/buildTrafficMap() (a real
// outbound API call has no business blocking the whole presentation from starting).
// seismicSlideAvailable() below is therefore checked synchronously by
// scheduleTimeline() before this necessarily finishes -- deliberately NOT clearing
// latestEvents up front (only ever overwritten once a new result, success or empty,
// actually arrives) so that synchronous check reads the previous cycle's still-valid
// data instead of a freshly-wiped empty array. In practice this means the slide's
// on/off state lags the real data by about one loop cycle, never zero.
export async function fetchSeismicActivity(lat, lon) {
  if (!globalConfig.seismic.enabled || lat == null || lon == null) {
    latestEvents = [];
    return false;
  }

  let newEvents;
  try {
    const response = await fetch(`/seismic/recent?lat=${lat}&lon=${lon}`);
    newEvents = await response.json();
  } catch (err) {
    console.log('[SeismicActivity] fetch failed (non-fatal, leaving previous data in place):', err.message);
    return latestEvents.length > 0;
  }
  latestEvents = newEvents;

  if (latestEvents.length === 0) {
    console.log('[SeismicActivity] Seismic activity slide hidden: no qualifying earthquakes near this location recently.');
    return false;
  }
  return true;
}

// Synchronous -- reads whatever fetchSeismicActivity() last resolved to, without a
// new network round trip. Called from MainScript.js's scheduleTimeline() to decide
// whether to include the slide in this cycle's rotation.
export function seismicSlideAvailable() {
  return latestEvents.length > 0;
}

// Spoken narration for the seismic-page -- called from MainScript.js's executePage(),
// same pattern as air-quality-page's own aqiNarrationText(). Returns '' if there's
// nothing to say, which in practice never actually reaches speechStart() -- the page
// is only ever in the rotation at all when seismicSlideAvailable() (same underlying
// data) is true.
export function seismicNarrationText() {
  if (latestEvents.length === 0) return '';
  const headline = getMostSignificantEvent();
  const plural = latestEvents.length > 1 ? `, with ${latestEvents.length} earthquakes recorded in the area over the past week` : '';
  return `The most significant recent earthquake in our area was a magnitude ${headline.magnitude.toFixed(1)} near ${headline.place}, ${formatTimeAgo(headline.time)}${plural}.`;
}

// Populates the DOM -- called from MainScript.js's setInformation(), same pattern as
// every other page's setXxx(), only once scheduleTimeline() has already confirmed
// (via fetchSeismicActivity() above) there's real data for this cycle.
export function renderSeismicActivity() {
  if (latestEvents.length === 0) return;

  const headline = getMostSignificantEvent();
  getElement('seismic-headline-magnitude').textContent = `M ${headline.magnitude.toFixed(1)}`;
  getElement('seismic-headline-place').textContent = headline.place;
  getElement('seismic-headline-time').textContent = formatTimeAgo(headline.time);
  getElement('seismic-headline-tsunami').style.display = headline.tsunami ? 'block' : 'none';

  const listEl = getElement('seismic-event-list');
  listEl.innerHTML = latestEvents.map((e) => {
    const tsunamiBadge = e.tsunami ? '<span class="seismic-tsunami-badge">Tsunami</span>' : '';
    return `<div class="seismic-event-item">`
      + `<span class="seismic-event-magnitude">M ${e.magnitude.toFixed(1)}</span>`
      + `<span class="seismic-event-place regular-text">${e.place}${tsunamiBadge}</span>`
      + `<span class="seismic-event-time regular-text">${formatTimeAgo(e.time)}</span>`
      + `</div>`;
  }).join('');
}
