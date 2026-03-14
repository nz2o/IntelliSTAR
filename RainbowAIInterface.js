// import the global configuration
import {globalConfig} from './common_configuration.js';

// RAINBOW.AI API CONFIGURATION
const API_URL_SS = "https://api.rainbow.ai/tiles/v1/snapshot?token=";
const API_URL_TILE = "https://api.rainbow.ai/tiles/v1/precip/";

// User configured API Key
let API_KEY = "";

// Determine if leaflet-rainbowai is a configured radar provider and if so, 
// set the API Key for subsequent calls.
// Returns status: 
//  0=provider not configured
//  1=provider configured and reachable
//  2=provider reachable but key is blank.
export function GetAPIKey() {
  
  let validKey=0;

  // See if leaflet-rainbowai is the configured radar provider.
  if (globalConfig.radar.ProviderUS === "leaflet-rainbowai") {
    // It is, setup the API key for future function calls.
    API_KEY = globalConfig.radar.APIKeyUS;
    // Validate that a non-blank key was found.
    if (API_KEY != "") {
      validKey=1;
    } else {
      console.log("Error! Radar Provider set to leaflet-rainbowai, but the APIKeyUS is empty! Radar is disabled!!");
      validKey=2;
    }
  }
  if (globalConfig.radar.ProviderWW === "leaflet-rainbowai" && validKey!=1) {
    // It is, setup the API key for future function calls.
    API_KEY = globalConfig.radar.APIKeyWW;
    // Validate that a non-blank key was found.
    if (API_KEY != "") {
      validKey=1;
    } else {
      console.log("Error! Radar Provider set to leaflet-rainbowai, but the APIKeyWW is empty! Radar is disabled!!");
      validKey=2;
    }
  }
  return validKey;
}

// Handle querying the Rainbow.AI Server for the current radar image timestamp.
 export async function GetTimestamp() {

  const url = API_URL_SS + API_KEY;

  // Call the Rainbow.AI Server
  const response = await fetch(url, {
    method: 'GET'
  });

  if (!response.ok) {
    //console.log("response status:"+response.status);
    if (!response.ok) {
      console.log("Rainbow.AI response still not ok. status=",response.status);
    }
    throw new Error("Rainbow.AI Server Response was not ok. status="+response.status);
  }

  // The API returns a JSON string, element 'snapshot' is the timestamp.
  const tsJSON = await response.json();
  return tsJSON.snapshot;
}

// Handle querying the Rainbow.AI Server for the current radar image timestamp.
 export async function GetTile(ssTimestamp,timeOffset,zoom,p_x,p_y,pColor) {

  const url = API_URL_TILE+ssTimestamp+"/"+timeOffset+"/"+zoom+"/"+p_x+"/"+p_y+"?color="+pColor+"&token="+API_KEY;
  //console.log("In RB-GetTile. url=",url);

  // Call the Rainbow.AI Server
  const response = await fetch(url, {
    method: 'GET'
  });

  if (!response.ok) {
    //console.log("response status:"+response.status);
    if (!response.ok) {
      console.log("Rainbow.AI response still not ok. status=",response.status);
    }
    throw new Error("Rainbow.AI Server Response was not ok. status="+response.status);
  }

  // The API returns a PNG image.
  const tilePNG = await response.blob();
  return tilePNG;
}
