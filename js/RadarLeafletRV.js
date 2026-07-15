// This is the RainViewer API Radar Support Module.
// As of February 2026 RainViewer has a free public API to obtain
// Nexrad images from the Iowa State University Mesonet Project.

// import the global configuration
import { globalConfig } from "../common_configuration.js";

// Active Tornado/Severe Thunderstorm/Flash Flood Warning polygon overlay for the
// regional radar map only (not the zoomed radar) -- see js/RadarWarningOverlay.js.
import { addActiveWarningOverlay } from "./RadarWarningOverlay.js";

// Animated GPS crosshair marking the regional radar's own center point.
import { addGPSMarker } from "./GPSMarker.js";

// Marks the physical WSR-88D radar site this imagery is actually sourced from.
import { addRadarStationMarker } from "./RadarStationMarker.js";

// === CONFIGURATION ===
// TILE_SIZE and ZOOM_OFFSET should be changed in pairs to preserve map display.
const TILE_SIZE = 512;
const ZOOM_OFFSET = -1;
//const TILE_SIZE = 256;
//const ZOOM_OFFSET = 0;

const RADAR_OPACITY = 0.7; // How transparent the radar is over the map.
const ANIMATION_DELAY_MS = 500;
const API_URL = "https://api.rainviewer.com/public/weather-maps.json";
const RADAR_ATTRIB = "RainViewer"
// === STATE ===
// Regional radar image
Weather.radarImage = {};
Weather.radarImage.map = {};
Weather.radarImage.mapFrames = [];
Weather.radarImage.layerCache = {};
Weather.radarImage.animationTimer = false;
Weather.radarImage.animationPosition = 0;

// Local radar image
Weather.zoomedRadarImage = {};
Weather.zoomedRadarImage.map = {};
Weather.zoomedRadarImage.mapFrames = [];
Weather.zoomedRadarImage.layerCache = {};
Weather.zoomedRadarImage.animationTimer = false;
Weather.zoomedRadarImage.animationPosition = 0;

var apiData = {};

// === UTILITIES ===
function wrapPosition(radarObj,position) {
    // index is 0 based so upper bounds is the length
    if (position >= radarObj.mapFrames.length) {
        position = 0;
    }
    return position;
}

function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// === LAYER MANAGEMENT ===
function createRadarLayer(frame) {
    return new L.TileLayer(apiData.host + frame.path + '/' + TILE_SIZE + '/{z}/{x}/{y}/2/1_1.png', {
        attribution: RADAR_ATTRIB,
        tileSize: TILE_SIZE,
        opacity: 0.001,
        maxNativeZoom: 7,
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
    for (let i = 0; i < radarObj.mapFrames.length; i++) {
        var position = wrapPosition(radarObj,i);
        console.log("I=",i,"Pos=",position);
        var frame = radarObj.mapFrames[position];
        var newLayer = createRadarLayer(frame);
        newLayer.setOpacity(0);
        radarObj.layerCache[position] = newLayer;

        newLayer.addTo(radarObj.map);
       
    }
    showFrame(radarObj,radarObj.mapFrames.length - 1);
}


// === INITIALIZATION ===
function initialize(radarObj,api) {
    clearLayerCache(radarObj);
    radarObj.mapFrames = [];
    radarObj.animationPosition = 0;

    if (!api || !api.radar || !api.radar.past) {
        return;
    }
    radarObj.mapFrames = api.radar.past;
    loadFrames(radarObj);
}

function loadApiData(radarObj) {
    var apiRequest = new XMLHttpRequest();
    apiRequest.open("GET", API_URL, true);
    apiRequest.onload = function() {
        apiData = JSON.parse(apiRequest.response);
        initialize(radarObj,apiData);
    };
    apiRequest.send();
}

export function setRadarAnimation(radarObj,AnimationEnabled) {
    radarObj.animationTimer= AnimationEnabled;
    showFrame(radarObj,radarObj.animationPosition);
}

export function getRadarLeafletRainViewer(latitude,longitude) {
    // === MAP SETUP Regional ===
    Weather.radarImage.map = L.map('radar-container', { maxZoom: 12 }).setView([latitude, longitude], globalConfig.radar.zoomLevelRegional);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        tileSize: TILE_SIZE,
        zoomOffset: ZOOM_OFFSET
    }).addTo(Weather.radarImage.map);

    loadApiData(Weather.radarImage);
    addActiveWarningOverlay(Weather.radarImage.map, Weather.activeWarnings);
    addGPSMarker(Weather.radarImage.map, latitude, longitude);
    if (Weather.radarStation) {
        addRadarStationMarker(Weather.radarImage.map, Weather.radarStation.lat, Weather.radarStation.lon);
    }

    // zoomed-radar-page ("2 Hour Local Radar") was removed from the alert sequences in
    // MainScript.js -- no longer building Weather.zoomedRadarImage here either, since
    // that page never shows now and this would otherwise just be wasted NEXRAD/basemap
    // tile requests every cycle for a map nobody ever sees.
}