// Server-side "when did we last actually get fresh data from each source API"
// tracker, for the client's bottom-left #api-last-updated panel (js/LastUpdated.js,
// served via the /status/last-updated route in server.js).
//
// This is deliberately separate from each Interface.js's own request-level caching
// (NWSInterface.js's rateLimited(), TomTomInterface.js's tileCache,
// AirNowInterface.js's cachedFetch(), etc. -- each keyed per specific request, e.g.
// per zip/gridpoint/tile/location) -- recordFetch() is called by those modules only
// at the exact point a live upstream call actually succeeds, never when a request
// was served from cache. That's what makes this an honest freshness signal instead
// of "when a client last happened to ask" (which is all the client itself could ever
// know, since from its side a cached response and a freshly-fetched one look
// identical).
const lastFetched = {}; // category -> Date

// Categories match the client panel's 4 rows: weather, radar, traffic, airQuality.
export function recordFetch(category) {
  lastFetched[category] = new Date();
}

export function getAllLastFetched() {
  return { ...lastFetched };
}
