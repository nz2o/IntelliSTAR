// This is the common configuration file for the IntelliSTAR Local onm the 8's Emulator
// Edit this file to set default configuration for operation.
// See the comments for each section for details.
export const globalConfig = {

general: {
    // General default configuration items.

    // greetingText is the text displayed (and spoken) on the Greeting/HELLO page.
    // this setting can be customized in the UI, this is just the default.
    greetingText: "Matthew, this is your weather.",

    // crawlText is the text displayed in a single line below the various weather pages.
    // it is scrolled horizontally throughout the weather presentation.
    // the default text set here is displayed only if there are no active alerts (or if alerts are disabled in the UI)
    crawlText: "Hi Matthew! If there was a severe weather alert, it would be scrolling here... But right now there are no active alerts so dad can say hi.",

    // twcAPIKey is the API key used to access the weather data.
    // this key may need to be updated on occasion if it becomes invalid.
    twcAPIKey: 'e1f10a1e78da46f5b10a1e78da96f525',

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
        {order:1, type: "Server", url:"http://fillimanpvr:7701"},
        {order:0, type: "Server", url:"http://localhost:5000"},
        {order:0, type: "Server", url:"someuser.pythonanywhere.com"},
        {order:0, type: "Client", url:"someuser.pythonanywhere.com"},
        {order:2, type: "Client", url:"https://basictts.com"},
    ]
},
};
