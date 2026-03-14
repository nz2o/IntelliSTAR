// This is the Aeris/xWeather API Radar Support Module.
// Nexrad images from the XWeather Commercial Provider.
//
// !! REQUIRES a valid Aeris/xWeather API Key to be set in common_configuration.js !!

// import the global configuration
import { globalConfig } from "../common_configuration.js";

// === CONFIGURATION ===
// TILE_SIZE and ZOOM_OFFSET should be changed in pairs to preserve map display.
//const TILE_SIZE = 512;
//const ZOOM_OFFSET = -1;
const TILE_SIZE = 256;
const ZOOM_OFFSET = 0;

const RADAR_OPACITY = 0.7; // How transparent the radar is over the map.
const ANIMATION_DELAY_MS = 500;
const API_URLPRE = "https://maps.aerisapi.com/";
const API_URLSUF = "/radar-global/{z}/{x}/{y}/";
const API_URL_TAIL = "min.png"+TILE_SIZE;
const RADAR_ATTRIB = "Aeris/XWeather"
const FRAME_COUNT = 10;
const FRAME_INTERVAL = 10; // time between radar frames in minutes

// The Aeris/XWeather API URL is built in the GetRadarLeafletXW function call.
let xwAPIURL="";

// === STATE ===
// Regional radar image
Weather.radarImage = {};
Weather.radarImage.map = {};
Weather.radarImage.layerCache = {};
Weather.radarImage.animationTimer = false;
Weather.radarImage.animationPosition = 0;

// Local radar image
Weather.zoomedRadarImage = {};
Weather.zoomedRadarImage.map = {};
Weather.zoomedRadarImage.layerCache = {};
Weather.zoomedRadarImage.animationTimer = false;
Weather.zoomedRadarImage.animationPosition = 0;

// === UTILITIES ===
function wrapPosition(radarObj,position) {
    // index is 0 based so upper bounds is the length
    if (position >= FRAME_COUNT) {
        position = 0;
    }
    return position;
}

// === LAYER MANAGEMENT ===
function createRadarLayer(frame) {
    return new L.TileLayer(frame, {
        attribution: RADAR_ATTRIB,
        tileSize: TILE_SIZE,
        opacity: 0.001,
        maxNativeZoom: 12,
        maxZoom: 12,
        zoomOffset: ZOOM_OFFSET
    });
}

function clearLayerCache(radarObj) {
    for (var pos in radarObj.layerCache) {
        if (parseInt(pos) !== radarObj.animationPosition) {
            radarObj.map.removeLayer(radarObj.layerCache[pos]);
            delete radarObj.layerCache[pos];
        }
    }
}

// === DISPLAY ===
function showFrame(radarObj,position) {
    console.log("In Showframe Pos=",position);
    position = wrapPosition(radarObj,position);

    // Set the opacity of the selected frame to > 0, then set the 
    // opacity of the previous frame to 0. This will animate the sequence.
    radarObj.layerCache[position].setOpacity(RADAR_OPACITY);
    radarObj.layerCache[radarObj.animationPosition].setOpacity(0);

    radarObj.animationPosition = position;

    if (radarObj.animationTimer) {
        setTimeout(showFrame, ANIMATION_DELAY_MS, radarObj,(position+1));
    }
}

function loadFrames(radarObj) {
    const maxFrame=FRAME_COUNT - 1; // Set the last image to be the most recent (offset of 0 minutes)
    let tileUrl;
    let timeOffset;

    // Calculate the date/time for each frame and retrieve the layer into the map.
    for (let i = 0; i < FRAME_COUNT; i++) {
        timeOffset= (i - maxFrame) * FRAME_INTERVAL ;
        tileUrl= xwAPIURL + timeOffset + API_URL_TAIL;
        console.log("I=",i,"URL=",tileUrl);
        var newLayer = createRadarLayer(tileUrl);
        newLayer.setOpacity(0);
        radarObj.layerCache[i] = newLayer;
        newLayer.addTo(radarObj.map);
    }
    showFrame(radarObj,maxFrame);
}


// === INITIALIZATION ===
function initialize(radarObj) {
    clearLayerCache(radarObj);
    radarObj.animationPosition = 0;
    loadFrames(radarObj);
}

export function setRadarAnimation(radarObj,AnimationEnabled) {
    radarObj.animationTimer= AnimationEnabled;
    showFrame(radarObj,radarObj.animationPosition);
}

export function getRadarLeafletXW(latitude,longitude,xwAPIKey) {
    // Define the base URL from the fixed elements and the passed API key.
    if(xwAPIKey != null) {
        xwAPIURL=API_URLPRE+xwAPIKey+API_URLSUF;
    } else {
        console.log("Aeris/XWeather Radar Selected, but API Key is blank. Key=",xwAPIKey);
        return;
    }

    // === MAP SETUP Regional ===
    Weather.radarImage.map = L.map('radar-container', { maxZoom: 12 }).setView([latitude, longitude], globalConfig.radar.zoomLevelRegional);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        tileSize: TILE_SIZE,
        zoomOffset: ZOOM_OFFSET
    }).addTo(Weather.radarImage.map);

    initialize(Weather.radarImage);

    // If there are active alerts, configure the local radar as well.

    if(Weather.alertsActive> 0) {

        // === MAP SETUP Local ===
        Weather.zoomedRadarImage.map = L.map('zoomed-radar-container', { maxZoom: 12 }).setView([latitude, longitude], globalConfig.radar.zoomLevelLocal);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
            tileSize: TILE_SIZE,
            zoomOffset: ZOOM_OFFSET
        }).addTo(Weather.zoomedRadarImage.map);

        initialize(Weather.zoomedRadarImage);
    }

}