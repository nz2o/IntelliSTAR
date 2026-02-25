// import the global configuration
import { globalConfig } from "../common_configuration.js";

// import the function to get the weather and start the playback sequence.
import {fetchCurrentWeather } from "./WeatherFetching.js";

// Applicationwide Global Definitions.
(function(win){
  win.zipCode = "";
  win.airportCode= "";
  win.cityName = "";

  win.WEEKDAY = ["SUN",  "MON", "TUES", "WED", "THU", "FRI", "SAT"];
  win.isDay = true;
}(window));


window.CONFIG = {
  crawl: globalConfig.general.crawlText,
  greeting: globalConfig.general.greetingText,
  language: 'en-US', // Supported in TWC API
  countryCode: 'US', // Supported in TWC API (for postal key)
  units: 'e', // Supported in TWC API (e = English (imperial), m = Metric, h = Hybrid (UK)),
  unitField: 'imperial', // Supported in TWC API. This field will be filled in automatically. (imperial = e, metric = m, uk_hybrid = h)
  loop: false,
  locationMode: "POSTAL",
  alertsEnabled: true,
  voiceEnabled: true,
  voiceURL: "",
  voiceSelect: "",
  voiceAlertNarration: true,
  musicEnabled:true,
  musicMute:false,
  radarSource: globalConfig.general.radarProvider,

  isLocationValid: () => {
    // This is called from the UI dialog, where there is a combined zip/airport entrybox. 
    // Need to determine if a zip code or airport code was entered and validate it. 
    const usertext = getElement('usertext').value;
    let isValid = false;

    // See if it is a zip code. (exactly 5 digits)
    if(ValidZipFormat(usertext)) {
      CONFIG.locationMode="POSTAL"
      zipCode = usertext;
      isValid=true;

    } else if(ValidAirportFormat(usertext)) {
      CONFIG.locationMode="AIRPORT"
      airportCode = usertext;
      isValid=true;

    } else {
      isValid=false;
    }
    return isValid;
  },
  run: () => {
    let wfText;
    let result=false;
    if(CONFIG.isLocationValid()) {
      if(CONFIG.locationMode === "POSTAL") {
        wfText = `Fetching current weather for zip-code: ${zipCode}`;
      } else if(CONFIG.locationMode === "AIRPORT") {
        wfText = `Fetching current weather for airport: ${airportCode}`;
      } else {
        wfText = `Unknown Location Type. Forecast may not be valid.`;
      }

      // Handle user specified custom greeting.
      const cGreetMsg=getElement('customGreeting').value;
      if (cGreetMsg.length>0) {
        CONFIG.greeting=cGreetMsg;
      }

      // Handle the voice narration options.
      CONFIG.voiceEnabled=getElement('voiceEnabled').checked;
      CONFIG.voiceSelect=getElement('voiceSelect').value;
      console.log("in run, Selected voice=",CONFIG.voiceSelect);
      CONFIG.voiceAlertNarration=getElement('alertsNarration').checked;

      // Handle Background Music.
      CONFIG.musicEnabled = getElement('musicEnabled').checked;

      // Handle Apple Mobile Device Workaround (mute instead of volume change for background music)
      CONFIG.musicMute = getElement('appleWorkaround').checked;

      // Handle Including Alerts (watches, warnings, advisories) in the sequence.
      CONFIG.alertsEnabled = getElement('alertsEnabled').checked;

      // Units Selection
      CONFIG.units = document.querySelector('input[name="input-units"]:checked').value;

      CONFIG.unitField = CONFIG.units === 'm' ? 'metric' : (CONFIG.units === 'h' ? 'uk_hybrid' : 'imperial')
      getElement("weatherfetch-text").innerHTML = wfText;
      getElement('weatherfetch-container').classList.add("shown");
      getElement('weatherfetch-text').classList.add('extend');
      fetchCurrentWeather();  // Get the weather data from online sources.
      result=true;
    }
    return result;
  },
  load: async () => {
    let optYN,optBool,selElement;

    // zip or airport code.
    const usertext = localStorage.getItem('usertext');
    getElement('usertext').value=usertext;

    // alertsEnabled 
    optYN = localStorage.getItem('alertsEnabled');
    if(optYN === "n") {optBool=false} else {optBool=true};
    getElement('alertsEnabled').checked=optBool;

    // Units
    const inputUnits = localStorage.getItem('inputUnits') || CONFIG.units;
    document.querySelector('input[name="input-units"][value="' + inputUnits + '"]').checked = true;

    // custom greeting
    const customGreeting = localStorage.getItem('customGreeting');
    getElement('customGreeting').value=customGreeting;

    // musicEnabled 
    optYN = localStorage.getItem('musicEnabled');
    if(optYN === "n") {optBool=false} else {optBool=true};
    getElement('musicEnabled').checked=optBool;

    // appleWorkaround
    optYN = localStorage.getItem('appleWorkaround');
    if(optYN === "y") {optBool=true} else {optBool=false};
    getElement('appleWorkaround').checked=optBool;

    // voiceEnabled 
    optYN = localStorage.getItem('voiceEnabled');
    if(optYN === "n") {optBool=false} else {optBool=true};
    getElement('voiceEnabled').checked=optBool;
    let voiceEnabled=optBool;

    // PiperTTS Selected Voice
    const voiceSelect = localStorage.getItem('voiceSelect');
    selElement = getElement('voiceSelect');
    if(voiceEnabled) {
      selElement.disabled = !voiceEnabled;
      voiceEnabled= await fn_voiceURLCheck(voiceSelect); // Load the dropdown with available voices from the server.
      console.log("in Load, after voiceURLCheck. Selected voice=",selElement.value);
      // If there was an issue reaching the configured PiperTTS server, disable voice narrations.
      if(!voiceEnabled) {
         getElement('voiceEnabled').checked=voiceEnabled;
      }
    }

    // narrateAlerts
    optYN = localStorage.getItem('alertsNarration');
    if(optYN === "n") {optBool=false} else {optBool=true};
    selElement = getElement('alertsNarration')
    selElement.disabled = !voiceEnabled;
    selElement.checked=optBool;

  },
  save: () => {
    let optYN,optBool;

    // zip or airport code.
    const usertext = getElement('usertext').value;
    localStorage.setItem('usertext',usertext);

    // alertsEnabled 
    optBool=getElement('alertsEnabled').checked;
    if(optBool) {optYN="y"} else {optYN="n"};
    localStorage.setItem('alertsEnabled',optYN);

    // Units
    const inputUnits = document.querySelector('input[name="input-units"]:checked').value;
    localStorage.setItem('inputUnits',inputUnits);

    // custom greeting
    const customGreeting = getElement('customGreeting').value;
    localStorage.setItem('customGreeting',customGreeting);

    // musicEnabled 
    optBool=getElement('musicEnabled').checked;
    if(optBool) {optYN="y"} else {optYN="n"};
    localStorage.setItem('musicEnabled',optYN);

    // appleWorkaround
    optBool = getElement('appleWorkaround').checked;
    if(optBool) {optYN="y"} else {optYN="n"};
    localStorage.setItem('appleWorkaround',optYN);

    // voiceEnabled 
    optBool=getElement('voiceEnabled').checked;
    if(optBool) {optYN="y"} else {optYN="n"};
    localStorage.setItem('voiceEnabled',optYN);

    // PiperTTS Selected Voice
    const voiceSelect = getElement('voiceSelect').value;
    localStorage.setItem('voiceSelect',voiceSelect);

    // narrateVoices
    optBool=getElement('alertsNarration').checked;
    if(optBool) {optYN="y"} else {optYN="n"};
    localStorage.setItem('alertsNarration',optYN);

    MsgBox("Save Settings","Settings have been saved.");
  }
}

// Local validation functions.
function ValidZipFormat(input) {
    // ^: start of string
    // \d{5}: exactly 5 digits (0-9)
    // $: end of string
    return /^\d{5}$/.test(input);
}

function ValidAirportFormat(input) {
  // Regex:
  // ^ - start of string
  // [A-Z0-9] - alphanumeric characters
  // {3,4} - 3 or 4 characters
  // $ - end of string
  const regex = /^[A-Z0-9]{3,4}$/;
  return regex.test(input);
}

CONFIG.unitField = CONFIG.units === 'm' ? 'metric' : (CONFIG.units === 'h' ? 'uk_hybrid' : 'imperial')
