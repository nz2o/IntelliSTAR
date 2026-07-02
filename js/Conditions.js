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
  outlookHigh:[],
  outlookLow:[],
  outlookCondition:[],
  outlookIcon:[],
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