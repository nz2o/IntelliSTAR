// Server-side interface to TomTom's Traffic Flow tile API, used by the traffic-
// conditions slide (js/TrafficMap.js). Keeps the API key off the client entirely --
// the browser only ever talks to this server's own /traffic/tile/:z/:x/:y route (see
// server.js), never tomtom.com directly.
//
// There's no free/keyless nationwide live-traffic source (unlike NWS for weather), so
// this is a real, rate-limited commercial API: TomTom's free tier is 2,500 tile
// requests/day. Everything below exists to stay well under that on a single self-
// hosted display looping this slide every few minutes, all day, forever:
//
//   - Per-tile caching: the same handful of tile (z,x,y) coordinates cover a given
//     location's map every single time it's requested (the location doesn't move),
//     so repeat requests for a tile already fetched recently are served from memory
//     instead of hitting TomTom again -- this is the main thing that makes "rebuild
//     the map every loop cycle" (simplest, matches how the radar pages already work)
//     affordable at all.
//   - Peak/off-peak refresh cadence: refreshes faster during commute hours (when
//     stale traffic data is actually misleading) and slower the rest of the day.
//   - A blackout window (nights) where no requests are made at all.
//   - A hard daily budget as a final safety net, independent of the above.
//
// All time-of-day decisions use the WATCHED LOCATION's own timezone (passed in by the
// client per-request, since only it knows which location is configured), not this
// server's.

const API_KEY = process.env.TOMTOM_TRAFFIC_API_KEY || '';
const APP_ID = process.env.TOMTOM_APP_ID || '';

const TRAFFIC_FLOW_STYLE = 'relative'; // TomTom's classic green/yellow/red-relative-to-free-flow-speed style

// Kept comfortably under TomTom's 2,500/day free-tier ceiling -- see the cadence math
// in the comment on PEAK_REFRESH_MS below for why this is rarely if ever actually hit
// under normal use; this is a backstop, not the primary control.
const DAILY_BUDGET = 2000;

// A given location's map only ever covers a small, fixed set of tiles (the location
// doesn't move), so at ~20 tiles per full map and a 15-minute peak refresh, ~9.5
// peak hours/day costs roughly 20 * (9.5*60/15) = ~760 requests; off-peak (60-minute
// refresh, minus the blackout window) adds a few hundred more -- comfortably inside
// DAILY_BUDGET with room for estimation error or a slightly larger map.
const PEAK_REFRESH_MS = 15 * 60 * 1000;
const OFFPEAK_REFRESH_MS = 60 * 60 * 1000;

// Local hours (location's own timezone) considered "peak" -- weighted toward morning
// and evening commute plus a midday bump, per the operator's own usage pattern for
// this deployment. Expressed as [startHour, endHour) pairs; endHour may be fractional
// (18.5 = 6:30pm).
const PEAK_WINDOWS = [
  [4, 9],
  [11, 13],
  [16, 18.5],
];

export function isConfigured() {
  return API_KEY !== '';
}

// Local hour-of-day (0-23.999...) at `timeZone`, as a fractional number so half-hour
// window boundaries (e.g. 18.5) compare correctly. Falls back to this server's own
// local hour if timeZone is missing/invalid (e.g. not yet resolved, or a bad IANA
// name slipped through) rather than throwing -- better to apply *some* schedule than
// to crash the tile route.
function localHourOfDay(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || undefined,
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const hour = Number(parts.find(p => p.type === 'hour').value);
    const minute = Number(parts.find(p => p.type === 'minute').value);
    return hour + minute / 60;
  } catch {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }
}

function isPeak(timeZone) {
  const hour = localHourOfDay(timeZone);
  return PEAK_WINDOWS.some(([start, end]) => hour >= start && hour < end);
}

// Handles the overnight wraparound (e.g. start=22, end=4 means "22:00-23:59 OR
// 00:00-03:59"), same shape as start<end for a same-day window (e.g. 1-3).
function isBlackout(timeZone) {
  const start = Number(process.env.TRAFFIC_BLACKOUT_START_HOUR ?? 22);
  const end = Number(process.env.TRAFFIC_BLACKOUT_END_HOUR ?? 4);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return false;
  const hour = localHourOfDay(timeZone);
  return start < end ? (hour >= start && hour < end) : (hour >= start || hour < end);
}

// tile (z,x,y) -> { buffer, fetchedAt }. Deliberately keyed on tile coordinates alone,
// not timezone -- the same tile always shows the same patch of road network regardless
// of which location's schedule decided to (re)fetch it.
const tileCache = new Map();

// Simple UTC-calendar-day counter, reset lazily on first access of a new day. This is
// a backstop safety margin (see DAILY_BUDGET above), not a billing-accurate clock --
// exact alignment with TomTom's own reset time doesn't matter as long as it reliably
// resets once a day and doesn't leak across restarts within the same day mattering
// much (an in-memory counter resetting to 0 on a server restart just means a few
// hours' worth of extra headroom that day, never less than the real remaining budget).
let budgetDayKey = null;
let budgetCount = 0;

function checkBudget() {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (todayKey !== budgetDayKey) {
    budgetDayKey = todayKey;
    budgetCount = 0;
  }
  return budgetCount < DAILY_BUDGET;
}

// Returns a PNG tile buffer, or null if there's genuinely nothing to serve (not
// configured, blacked out with no prior cache, or a fetch failed with no prior
// cache). Never throws -- every failure path degrades to "serve what we have" or null.
export async function GetTrafficTile(z, x, y, timeZone) {
  if (!isConfigured()) return null;
  if (isBlackout(timeZone)) return null; // client shouldn't even be asking during blackout; fail closed if it does anyway

  const key = `${z}:${x}:${y}`;
  const cached = tileCache.get(key);
  const refreshMs = isPeak(timeZone) ? PEAK_REFRESH_MS : OFFPEAK_REFRESH_MS;

  if (cached && (Date.now() - cached.fetchedAt) < refreshMs) {
    return cached.buffer;
  }

  if (!checkBudget()) {
    console.log('TomTomInterface: daily tile budget exhausted, serving cached tile if available for', key);
    return cached ? cached.buffer : null;
  }

  try {
    const url = `https://api.tomtom.com/traffic/map/4/tile/flow/${TRAFFIC_FLOW_STYLE}/${z}/${x}/${y}.png`
      + `?key=${encodeURIComponent(API_KEY)}`
      + (APP_ID ? `&appId=${encodeURIComponent(APP_ID)}` : '');
    const response = await fetch(url);
    if (!response.ok) {
      console.log('TomTomInterface: tile fetch failed, status', response.status, 'for', key);
      return cached ? cached.buffer : null;
    }
    budgetCount++;
    const buffer = Buffer.from(await response.arrayBuffer());
    tileCache.set(key, { buffer, fetchedAt: Date.now() });
    return buffer;
  } catch (err) {
    console.log('TomTomInterface: tile fetch error (non-fatal, serving cache if any):', err.message);
    return cached ? cached.buffer : null;
  }
}
