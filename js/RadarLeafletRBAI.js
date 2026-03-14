// This is the Rainbow.AI API Radar Support Module.
// Nexrad images from the Rainbow.AI Commercial Provider.
//
// !! REQUIRES a valid Rainbow.AI API Key to be set in common_configuration.js !!
// !! REQUIRES a self-hosted IntelliSTAR Emulator. Interface is Client-Server ONLY !!
// !! this is due to CORS restrictions imposed by Rainbow.AI !!

// Usage Note: While Rainbow.AI has a free usage tier, a payment method on file is
// required to obtain a key. Charges will be incurred after the free tiles allowance
// has been consumed. Therefore, with this provider it is imperative to set the frame count
// and the zoom level to a low number, and to monitor the tile request count in the Rainbow.AI
// account dashboard. 

// import the global configuration
import { globalConfig } from "../common_configuration.js";

// === CONFIGURATION ===
const FRAME_COUNT = 5; // Gives 2 hour historical radar loop
const FRAME_INTERVAL = (30 * 60); // time between radar frames in seconds. (Set to 30 minutes)

const RADAR_OPACITY = 0.7; // How transparent the radar is over the map.
const ANIMATION_DELAY_MS = 500;

// Pointers to the server-side rainbowai handler.
const API_URL_SS = "/rainbowai/gettimestamp";
const API_URL_TILE = "/rainbowai/gettile";
const API_COLOR = 1; // Radar presentation color palette index. (See documentation for values)
const API_URL_TAIL = "{z}/{x}/{y}";
const RADAR_ATTRIB = "Rainbow.AI"

// TILE_SIZE and ZOOM_OFFSET should be changed in pairs to preserve map display.
//const TILE_SIZE = 512;
//const ZOOM_OFFSET = -1;
const TILE_SIZE = 256;
const ZOOM_OFFSET = 0;

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

function loadFrames(radarObj,ssTimestamp) {
    const maxFrame=FRAME_COUNT - 1; // Set the last image to be the most recent (offset of 0 minutes)
    let tileUrl;
    let timeOffset;
    let tileTime;

    // Calculate the date/time for each frame and retrieve the layer into the map.
    for (let i = 0; i < FRAME_COUNT; i++) {
        timeOffset= (i - maxFrame) * FRAME_INTERVAL ;
        tileTime=ssTimestamp+timeOffset;
        tileUrl= API_URL_TILE+"/"+tileTime+"/0/"+API_URL_TAIL+"/"+API_COLOR ;
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
    let apiTimestamp;
    var apiRequest = new XMLHttpRequest();
    apiRequest.open("GET", API_URL_SS, true);
    apiRequest.onload = function() {
        apiTimestamp = JSON.parse(apiRequest.response);
        if (apiTimestamp) {
            clearLayerCache(radarObj);
            radarObj.animationPosition = 0;
            loadFrames(radarObj,apiTimestamp);
        } else {
            console.log("Rainbow.AI Radar Provider Selected, but invalid response received from GetTimestamp.");
            return;
        }
    };
    apiRequest.send();
}

export function setRadarAnimation(radarObj,AnimationEnabled) {
    radarObj.animationTimer= AnimationEnabled;
    showFrame(radarObj,radarObj.animationPosition);
}

export function getRadarLeafletRBAI(latitude,longitude) {
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