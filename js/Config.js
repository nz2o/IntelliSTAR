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
  // Stable fallback for fetchAlerts() to restore CONFIG.crawl to when a cycle has
  // no active alerts, after a previous cycle overwrote it with alert crawl text.
  baseCrawl: globalConfig.general.crawlText,
  greeting: globalConfig.general.greetingText,
  language: 'en-US', // Locale for date/text formatting
  countryCode: 'US', // For postal/zip lookups
  units: 'e', // e = English (imperial), m = Metric, h = Hybrid (UK)
  unitField: 'imperial', // Filled in automatically from units above (imperial = e, metric = m, uk_hybrid = h)
  loop: false,
  locationMode: "POSTAL",
  alertsEnabled: true,
  voiceEnabled: true,
  voiceURL: "",
  voiceSelect: "",
  voiceAlertNarration: true,
  musicEnabled:true,
  musicMute:false,
  radarSource: "",
  radarAPIKey: "",
  audioVolume:"1", // Default to full/max volume. Config can override this.
  
  isLocationValid: () => {
    // This is called from the UI dialog, where there is a combined zip/airport entrybox. 
    // Need to determine if a zip code or airport code was entered and validate it. 
    const usertext = getElement('usertext').value.trim();
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
  // Resolves globalConfig.general.defaultLocation (DEFAULT_LOCATION in .env) into the
  // #usertext field. Only called from load() when this browser has no valid saved
  // location yet. "AUTOMATIC" asks the server to geolocate its own public IP; anything
  // else is treated as a literal zip or airport code, same as typing it into the dialog.
  resolveDefaultLocation: async () => {
    const loc = globalConfig.general.defaultLocation.trim();
    if (!loc) return;

    if (loc.toUpperCase() === "AUTOMATIC") {
      try {
        const response = await fetch('/geoip/lookup');
        if (response.ok) {
          const data = await response.json();
          if (data.zip) {
            getElement('usertext').value = data.zip;
          } else {
            console.log("resolveDefaultLocation: IP geolocation returned no zip code.");
          }
        } else {
          console.log("resolveDefaultLocation: /geoip/lookup response status:", response.status);
        }
      } catch (err) {
        console.log("resolveDefaultLocation: IP geolocation failed:", err.message);
      }
    } else {
      getElement('usertext').value = loc.toUpperCase();
    }
  },
  run: () => {
    let wfText;
    let result=false;
    if(CONFIG.isLocationValid()) {
      if(CONFIG.locationMode === "POSTAL") {
        wfText = `Fetching current weather for zip-code: ${zipCode}`;
        // Zip Codes are US Only, set US Radar Provider
        CONFIG.radarSource = globalConfig.radar.ProviderUS;
        CONFIG.radarAPIKey = globalConfig.radar.APIKeyUS;
      } else if(CONFIG.locationMode === "AIRPORT") {
        wfText = `Fetching current weather for airport: ${airportCode}`;
        // Set the correct Radar Provider based on the 1st letter of the airport code.
        if(airportCode[0]==="K") {
          // ICAO code starts with K, set US Radar Provider
          CONFIG.radarSource = globalConfig.radar.ProviderUS;
          CONFIG.radarAPIKey = globalConfig.radar.APIKeyUS;
        } else {
          // ICAO code does not start with K, set WW Radar Provider
          CONFIG.radarSource = globalConfig.radar.ProviderWW;
          CONFIG.radarAPIKey = globalConfig.radar.APIKeyWW;
        }
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

      // Handle Audio Volume
      CONFIG.audioVolume = getElement('volumeSlider').value

      // Units Selection
      CONFIG.units = document.querySelector('input[name="input-units"]:checked').value;

      CONFIG.unitField = CONFIG.units === 'm' ? 'metric' : (CONFIG.units === 'h' ? 'uk_hybrid' : 'imperial')
      if (globalConfig.general.showFetchingMessage) {
        getElement("weatherfetch-text").innerHTML = wfText;
        getElement('weatherfetch-container').classList.add("shown");
        getElement('weatherfetch-text').classList.add('extend');
      }
      fetchCurrentWeather();  // Get the weather data from online sources.
      result=true;
    }
    return result;
  },
  load: async () => {
    let optYN,optBool,selElement;

    // zip or airport code.
    const usertext = localStorage.getItem('usertext');
    getElement('usertext').value=usertext || '';

    // Fall back to the .env-configured default location (DEFAULT_LOCATION, see
    // common_configuration.js general.defaultLocation) when this browser has no
    // location saved from a previous visit.
    if (!CONFIG.isLocationValid() && globalConfig.general.defaultLocation) {
      await CONFIG.resolveDefaultLocation();
    }

    // loop (see nwsLogoClick() in MainScript.js) -- restored here so that looping
    // persists across page loads. First-visit default comes from
    // globalConfig.general.loopEnabledDefault (LOOP_ENABLED_DEFAULT in .env); once
    // the user has toggled it via the NWS logo, that saved preference takes over.
    optYN = localStorage.getItem('loop');
    CONFIG.loop = (optYN === null) ? globalConfig.general.loopEnabledDefault : (optYN === "y");

    // alertsEnabled
    optYN = localStorage.getItem('alertsEnabled');
    if(optYN === null) {optBool = globalConfig.general.alertsEnabledDefault} else {optBool = optYN !== "n"};
    getElement('alertsEnabled').checked=optBool;

    // Units
    const inputUnits = localStorage.getItem('inputUnits') || globalConfig.general.unitsDefault;
    document.querySelector('input[name="input-units"][value="' + inputUnits + '"]').checked = true;

    // custom greeting
    const customGreeting = localStorage.getItem('customGreeting');
    getElement('customGreeting').value=customGreeting;

    // musicEnabled
    optYN = localStorage.getItem('musicEnabled');
    if(optYN === null) {optBool = globalConfig.general.musicEnabledDefault} else {optBool = optYN !== "n"};
    getElement('musicEnabled').checked=optBool;

    // appleWorkaround
    optYN = localStorage.getItem('appleWorkaround');
    if(optYN === null) {optBool = globalConfig.general.appleWorkaroundDefault} else {optBool = optYN === "y"};
    getElement('appleWorkaround').checked=optBool;

    // volumeSlider
    const volumeSlider = localStorage.getItem('volumeSlider');
    if(!volumeSlider) {
      getElement('volumeSlider').value=CONFIG.audioVolume
    } else {
      getElement('volumeSlider').value=volumeSlider};

    // voiceEnabled
    optYN = localStorage.getItem('voiceEnabled');
    if(optYN === null) {optBool = globalConfig.general.voiceEnabledDefault} else {optBool = optYN !== "n"};
    getElement('voiceEnabled').checked=optBool;
    let voiceEnabled=optBool;

    // PiperTTS Selected Voice
    const voiceSelect = localStorage.getItem('voiceSelect') || globalConfig.general.voiceSelectDefault;
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
    if(optYN === null) {optBool = globalConfig.general.voiceAlertsNarrationDefault} else {optBool = optYN !== "n"};
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

    // volumeSlider
    const volumeSlider = getElement('volumeSlider').value;
    localStorage.setItem('volumeSlider',volumeSlider);

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

//CONFIG.unitField = CONFIG.units === 'm' ? 'metric' : (CONFIG.units === 'h' ? 'uk_hybrid' : 'imperial')
