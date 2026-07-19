// Small, unobtrusive "last updated per API" status panel (#api-last-updated,
// bottom-left -- see css/lastupdated.css and index.html) showing when each backend
// data source last actually completed a LIVE fetch from its real upstream source --
// not "when the browser last got a response from our own server," which tells you
// nothing about real freshness, since a cached response (up to an hour old for some
// sources -- see each Interface.js's own caching) looks identical to a fresh one
// from the client's side. The server is the only place that genuinely knows the
// difference (see DataFreshness.js), so this polls its own /status/last-updated
// route rather than tracking anything client-side.
const API_LABELS = {
  weather: 'Weather',
  radar: 'Radar',
  traffic: 'Traffic',
  airQuality: 'Air Quality',
};

// Independent of the app's own weather-fetch loop cycle on purpose -- e.g. traffic
// tiles can refresh server-side every 15 minutes on their own schedule (see
// TomTomInterface.js), and this panel should reflect that as it happens, not just
// whenever the next full weather cycle happens to re-render it.
const POLL_INTERVAL_MS = 30000;

function formatTimestamp(isoString) {
  if (!isoString) return 'never';
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export async function renderLastUpdated() {
  const container = getElement('api-last-updated');
  if (!container) return;
  try {
    const response = await fetch('/status/last-updated');
    const lastFetched = await response.json();
    container.innerHTML = Object.entries(API_LABELS).map(([key, label]) => {
      return `<div class="api-last-updated-item">${label}: ${formatTimestamp(lastFetched[key])}</div>`;
    }).join('');
  } catch (err) {
    console.log('[LastUpdated] status fetch failed (non-fatal, panel just won\'t update this round):', err.message);
  }
}

// Called once from MainScript.js's window.onload. Renders immediately, then keeps
// polling for the life of the page (this module is only ever loaded once, and
// nothing ever needs to stop the interval).
let pollTimer;
export function startPolling() {
  renderLastUpdated();
  clearInterval(pollTimer);
  pollTimer = setInterval(renderLastUpdated, POLL_INTERVAL_MS);
}
