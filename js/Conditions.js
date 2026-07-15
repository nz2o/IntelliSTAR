// This file holds the weather conditions global object.
window.Weather = {
  currentTemperature: undefined,
  currentIcon: undefined,
  currentCondition: undefined,
  windSpeed: undefined,
  gusts: undefined,
  feelsLike: undefined,
  visibility: undefined,
  humidity: undefined,
  dewPoint: undefined,
  pressure: undefined,
  pressureTrend: undefined,
  forecastNarrative: [],
  forecastTemp:[],
  forecastIcon:[],
  forecastPrecip:[],
  forecastDayLabel:[], // NWS's own period name (e.g. "Tonight", "Wednesday") for each of the 4 forecast boxes -- see fetchForecast() in WeatherFetching.js and setForecast() in InformationSetting.js

  outlookHigh:[],
  outlookLow:[],
  outlookCondition:[],
  outlookIcon:[],
  hourly:[], // 2-day hourly forecast for the hourly-forecast-page chart -- see fetchHourlyForecast() in WeatherFetching.js
  almanac:{}, // sunrise/sunset + moon phase data for the almanac-page -- see computeAlmanac() in WeatherFetching.js
  endingHashtag: undefined, // closing "It's Amazing Out There" slide's hashtag -- see computeEndingHashtag() in WeatherFetching.js
  activeWarnings: null, // nationwide active TOR/SVR/FFW GeoJSON for the radar warning overlay -- see fetchActiveWarnings() in WeatherFetching.js and js/RadarWarningOverlay.js
  radarImage: undefined,
  zoomedRadarImage: undefined,

  // Extending the Alerts to handle speech translation, length and URL pointers to cached speech data.
  alertsActive:-1, // -1 alert data not returned, 0 no alerts, 1 single alert, >1 multiple alerts.
  alerts:[],
  AlertObj: function(dispText,speechText,URL,duration) {
    this.dispText = dispText;
    this.speechText = speechText;
    this.URL = URL;
    this.duration = duration;
  },

}