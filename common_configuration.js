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

    // radarProvider is the name of the radar image/data provider.
    // "direct-nws" 
    // is the original provider where the US national weather service radar page is encapsulated
    // within an i-frame and displayed. This approach is very slow and impacts performance on light-duty
    // appliances such as fire stick or onn streaming box. On these underpowered devices the radar will often
    // fail to load prior to the presentation moving on to the next page.
    // "leaflet-rainviewer" (preferred, default)
    // uses the leaflet framework to combine openstreetmap.org map data with rainviewer.com radar data.
    // rainviewer.com provides a free API that aggregates the mesonet radar image data from Iowa State University.
    // this provider loads extremely fast and works well on all tested platforms.
    radarProvider: "leaflet-rainviewer",

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
        {order:1, type: "Server", url:"http://localhost:5000"},
        {order:0, type: "Server", url:"someuser.pythonanywhere.com"},
        {order:0, type: "Client", url:"someuser.pythonanywhere.com"},
        {order:2, type: "Client", url:"https://basictts.com"},
    ]
},
};