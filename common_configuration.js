// This is the common configuration file for the IntelliSTAR Local onm the 8's Emulator
// Edit this file to set default configuration for operation.
// See the comments for each section for details.
export const globalConfig = {

general: {
    // General default configuration items.

    // greetingText is the text displayed (and spoken) on the Greeting/HELLO page.
    // this setting can be customized in the UI, this is just the default.
    // Overridable via the GREETING_TEXT variable in .env (see .env.example) --
    // server.js substitutes it in when serving this file, since .env is server-only
    // and this file is also loaded directly by the browser.
    greetingText: "Your local forecast",

    // crawlText is the text displayed in a single line below the various weather pages.
    // it is scrolled horizontally throughout the weather presentation.
    // the default text set here is displayed only if there are no active alerts (or if alerts are disabled in the UI)
    // Overridable via the CRAWL_TEXT variable in .env (see .env.example), same as greetingText above.
    crawlText: "Sample Crawl Text",

    // The hashtag shown on the closing "It's Amazing Out There" slide. Leave blank
    // ("") to build one automatically instead, from the resolved NWS forecast
    // office/CWA (County Warning Area) identifier for the current location -- e.g.
    // Birmingham, AL's CWA is "BMX", giving "#bmxWX" (see computeEndingHashtag() in
    // WeatherFetching.js).
    // Overridable via the AMAZING_HASHTAG variable in .env, same mechanism as greetingText above.
    amazingHashtag: "",

    // Extra pause (ms) after narration audio finishes before the page advances --
    // applies to alerts and the today/tonight/tomorrow/tomorrow-night forecast pages.
    // Overridable via the NARRATION_DWELL_SECONDS variable in .env (whole seconds;
    // server.js converts to ms when substituting it in), same mechanism as greetingText above.
    narrationDwellMs: 5000,

    // Whether to show the "Fetching current weather for..." message while data loads.
    // Overridable via SHOW_FETCHING_MESSAGE=false in .env (same mechanism as above).
    showFetchingMessage: true,

    // How much to duck (reduce, not mute) the background music volume while voice
    // narration is speaking, as a fraction of the current master volume (CONFIG.
    // audioVolume) -- 0 would be silent, 1 would leave it at full volume alongside
    // the narration. Restored to full volume when narration finishes. Does not apply
    // on iOS Safari (the "Apple Mobile Device Workaround" option), which only
    // supports muting -- see musicMute handling in MainScript.js, that's a real
    // platform limitation (iOS ignores JS volume changes on <audio> elements), not
    // adjustable here.
    // Overridable via MUSIC_DUCK_LEVEL in .env (same mechanism as above).
    musicDuckLevel: 0.3,

    // Weather data comes from the free NWS api.weather.gov API (US only), proxied through
    // server.js so a proper contact User-Agent can be sent. See .env.example / PORT and
    // NWS_USER_AGENT — those live in .env (server-side only), not here.

    // Default startup location: a 5-digit US zip code, a 3-4 character airport ICAO
    // code, or the literal string "AUTOMATIC" to have the server geolocate its own
    // public IP address and use the resulting zip code (see IPGeolocationInterface.js
    // and the /geoip/lookup route in server.js). Leave blank ("") to require the user
    // to type a location into the startup dialog, as before. Only used when this
    // browser has no location already saved from a previous visit.
    // Overridable via the DEFAULT_LOCATION variable in .env, same mechanism as greetingText above.
    defaultLocation: "",

    // Whether Watch/Warning/Advisory alerts are included by default. Only applies the
    // first time this browser is used -- once the user saves a preference via the
    // dialog, that saved value takes over.
    // Overridable via ALERTS_ENABLED_DEFAULT=false in .env (same mechanism as above).
    alertsEnabledDefault: true,

    // Default measurement units: "e" (US/imperial, °F + mph) or "m" (metric, °C +
    // km/h). Overridable via UNITS_DEFAULT=US or UNITS_DEFAULT=Metric in .env --
    // server.js maps those human-friendly names to e/m here. Same mechanism as above,
    // and same "first visit only" caveat as alertsEnabledDefault.
    unitsDefault: "e",

    // Whether background music is enabled by default (first-visit only, see above).
    // Overridable via MUSIC_ENABLED_DEFAULT=false in .env (same mechanism as above).
    musicEnabledDefault: true,

    // Whether the Apple mobile device background-music workaround (mutes instead of
    // changing volume, since iOS Safari does not allow JS volume control) is enabled
    // by default (first-visit only, see above).
    // Overridable via APPLE_WORKAROUND_DEFAULT=true in .env (same mechanism as above).
    appleWorkaroundDefault: false,

    // Whether PiperTTS voice narration is enabled by default (first-visit only, see above).
    // Overridable via VOICE_ENABLED_DEFAULT=false in .env (same mechanism as above).
    voiceEnabledDefault: true,

    // Default PiperTTS voice to pre-select, if it's present in the voice list returned
    // by the configured PiperTTS server (see PiperTTS.endpoints below). First-visit only.
    // Overridable via VOICE_SELECT_DEFAULT in .env (same mechanism as above).
    voiceSelectDefault: "en_US-lessac-medium",

    // Whether narration of alert text is enabled by default -- only relevant when
    // voice narration itself is also enabled (first-visit only, see above).
    // Overridable via VOICE_ALERTS_NARRATION_DEFAULT=false in .env (same mechanism as above).
    voiceAlertsNarrationDefault: true,

    // Whether clicking (or pressing Enter on) the NWS logo's looping toggle starts
    // enabled by default -- i.e. whether the presentation automatically restarts
    // itself in place (see resetForNewCycle()/restartSequence() in MainScript.js)
    // once it finishes, instead of stopping and requiring a manual restart. Clicking
    // the logo still toggles it per-browser after that (first-visit only, see above).
    // Overridable via LOOP_ENABLED_DEFAULT=false in .env (same mechanism as above).
    loopEnabledDefault: true,

    // When true, skip the startup "Weather Location" dialog entirely and begin the
    // presentation automatically -- using a location already saved in this browser
    // from a previous visit, or otherwise defaultLocation above -- as soon as the page
    // loads, with no click required.
    // Overridable via AUTO_START=true in .env (same mechanism as above).
    autoStart: false,

},

radar: {
    // Radar Configuration

    // zoomLevelRegional and zoomLevelLocal define the radar map zoom level.
    zoomLevelRegional: 8,
    zoomLevelLocal: 10,

    // ProviderUS and radarProviderWW are the names of the radar image/data providers for the corresponding area.
    // ProviderUS is used for all zip codes, and for all airports that start with the letter K.
    // ProviderWW is used for all airports that do not start with the letter K.
    //
    // For each variable, one of the following provider IDs must be specified. (The same ID can be used for both.)
    //
    // "direct-nws" 
    // is the original provider where the US national weather service radar page is encapsulated
    // within an i-frame and displayed. This approach is very slow and impacts performance on light-duty
    // appliances such as fire stick or onn streaming box. On these underpowered devices the radar will often
    // fail to load prior to the presentation moving on to the next page.
    //
    // "leaflet-rainviewer" (default INTERNATIONAL, radar is non-standard blue colors, works internationally)
    // uses the leaflet framework to combine openstreetmap.org map data with rainviewer.com radar data.
    // rainviewer.com provides a free API that aggregates the mesonet radar image data from Iowa State University.
    // this provider loads extremely fast and works well on all tested platforms. However, the radar images seem to be
    // off color and there are a lot of error frames and false echos from this provider.
    //
    // "leaflet-iowastate" (preferred, default US ONLY)
    // uses the leaflet framework to combine openstreetmap.org map data with Nexrad Mosaics obtained directly from
    // the Iowa State University Mesonet. US Base Reflectivity (N0Q) Composite images are used.
    //
    // "leaflet-xweather" (needs API key, works well internationally)
    // uses the leaflet framework to combine openstreetmap.org map data with xweather.com radar data.
    // this provider loads fast and works well on all tested platforms. However, there is no free API key
    // (not even for non-commercial use) so you will have to acquire a valid key to use this provider.
    // APIKey: "(AERIS_ID)_(AERIS_KEY)"
    //
    // "leaflet-rainbowai" (needs API key, works well internationally)
    // uses the leaflet framework to combine openstreetmap.org map data with rainbow.ai radar data.
    // this provider loads fast and works well on all tested platforms. However, an API Key is required
    // to use this provider, and a payment method is required to be on-file to use the "free" tier.
    // Charges will automatically accrue after the free usage allotment is exhausted in a given month
    // so care must be taken not to exceed the current limits to avoid being billed.
    // APIKey: "RAINBOW.AI KEY"
    ProviderWW: "leaflet-rainviewer",
    APIKeyWW: "", // only if needed by the selected provider. See instructions.
    ProviderUS: "leaflet-iowastate",
    APIKeyUS: "", // only if needed by the selected provider. See instructions.
},

traffic: {
    // Traffic-conditions slide (shown just before the closing "It's Amazing Out
    // There" screen): a TomTom Traffic Flow map centered on the current location.
    // Nothing here should be edited by hand -- there's no free/keyless traffic data
    // source (unlike NWS for weather/radar), so this whole slide is opt-in via a
    // TomTom developer account. The API key itself lives in .env (server-side only,
    // never sent to the browser -- see /traffic/tile/:z/:x/:y in server.js, which
    // proxies TomTom on the browser's behalf) and is never exposed here.

    // Set to true by server.js when it serves this file, if TOMTOM_TRAFFIC_API_KEY
    // is present in .env. Stays false (slide never shown) otherwise.
    enabled: false,

    // Local hours (0-23, in the resolved location's own timezone, not this server's)
    // during which the slide is skipped and no tile requests are made at all.
    // 22/4 = blacked out 10pm-4am local. Overridable via TRAFFIC_BLACKOUT_START_HOUR /
    // TRAFFIC_BLACKOUT_END_HOUR in .env (see .env.example), same substitution
    // mechanism as greetingText above.
    blackoutStartHour: 22,
    blackoutEndHour: 4,
},

airQuality: {
    // Closing air-quality slide (right after the traffic slide, before the outro):
    // current AQI and a breakdown by pollutant (ozone, PM2.5, PM10/dust, etc.) from
    // the EPA's free AirNow API, for the current location. Nothing here should be
    // edited by hand -- the API key itself lives in .env (server-side only, never
    // sent to the browser -- see /airquality/* in server.js, which proxies AirNow on
    // the browser's behalf) and is never exposed here.

    // Set to true by server.js when it serves this file, if AIRNOW_API_KEY is
    // present in .env. Stays false (slide never shown) otherwise. Even when true,
    // the slide is still skipped on any given cycle if AirNow has no monitoring data
    // near the current location (common for smaller towns) -- see
    // fetchAirQuality() in js/AirQuality.js.
    enabled: false,
},

seismic: {
    // Closing seismic-activity slide (right after the air-quality slides, before the
    // outro): recent earthquakes within a radius of the current location, from
    // USGS's free, keyless earthquake feed -- see USGSInterface.js for the
    // radius/magnitude/lookback window queried. Unlike traffic/airQuality above, no
    // API key is needed at all, so this defaults to on.

    // Server.js flips this to false if SEISMIC_ENABLED=false is set in .env. Even
    // when true, the slide is still skipped on any given cycle if there simply
    // hasn't been any qualifying activity nearby recently (true for most of the US
    // away from a plate boundary, most of the time) -- see fetchSeismicActivity() in
    // js/SeismicActivity.js.
    enabled: true,
},

PiperTTS: {
    // Configuration specific to the PiperTTS Engine Interface

    // The application needs to have at least 1 configured endpoint if voice narration is enabled.
    // If voice narration is disabled, then this endpoint configuration does not apply and is ignored.
    // Multiple endpoint types and targets may be configured. The application will try to contact the
    // endpoint with "order = 1" first, then try subsequent endpoints with a higher order.
    // Setting an endpoint order to 0 disables that endpoint.

    // For each endpoint there are three values that must be set as follows:
    // order: 0, or 1-9
    //      0= endpoint is disabled and is ignored.
    //      1= primary endpoint to be used for voice narration (if enabled)
    //      2-9= secondary fallback endpoint(s) to be tried if the primary endpoint is unreachable.
    // type: either "Server" or "Client". 
    //      Server = Application is running on a webserver and the webserver contacts the PiperTTS endpoint on behalf of the user's web browser.
    //      Client = User's web browser contacts the PiperTTS endpoint directly. 
    //      For performance and long-term availability, a local webserver that can query a local PiperTTS server instance is preferred.
    //      however, there may be situations, like with the demo website, where this is not possible.
    // url: the URL of the PiperTTS web server. 
    //      If type="Server" then this URL need to be reachable from the application webserver.
    //      If type="Client" then this URL needs to be reachable from the client's web browser.
    //      A simple diagnostic test is to try to reach the url/voices with a browser on the corresponding source. A list of available
    //      narration voices should be returned if the PiperTTS server is reachable.
    endpoints: [
        // "piper" is the self-hosted PiperTTS sidecar container in docker-compose.yml
        // (see piper/). Running server.js outside Docker instead (e.g. scripts/startpiper.sh)?
        // Change this back to "http://localhost:5000".
        {order:1, type: "Server", url:"http://piper:5000"},
        {order:0, type: "Server", url:"https://someuser.pythonanywhere.com"},
        {order:2, type: "Client", url:"https://fillimerica.pythonanywhere.com"},
    ]
},
};
