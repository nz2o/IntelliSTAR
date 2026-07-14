// This is the Iowa State University Iowa Environmental Mesonet API Radar Support Module.
// Nexrad images from the Iowa State University Mesonet Project.


// import the global configuration
import { globalConfig } from "../common_configuration.js";

// Active Tornado/Severe Thunderstorm/Flash Flood Warning polygon overlay for the
// regional radar map only (not the zoomed radar) -- see js/RadarWarningOverlay.js.
import { addActiveWarningOverlay } from "./RadarWarningOverlay.js";

// === CONFIGURATION ===
// TILE_SIZE and ZOOM_OFFSET should be changed in pairs to preserve map display.
//const TILE_SIZE = 512;
//const ZOOM_OFFSET = -1;
const TILE_SIZE = 256;
const ZOOM_OFFSET = 0;

const RADAR_OPACITY = 0.7; // How transparent the radar is over the map.
const ANIMATION_DELAY_MS = 500;
const API_URL = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::USCOMP-N0Q-';
const API_URL_TAIL = '/{z}/{x}/{y}.png';
const RADAR_ATTRIB = "Iowa Environmental Mesonet"
const FRAME_COUNT = 10;
const FRAME_INTERVAL = (10 * 60 * 1000); // time between radar frames in milliseconds (10 minutes)


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

function dateMath2ISO(sDate,offset) {
    const newDate = new Date(sDate.getTime() + offset);
    return newDate.toISOString().replace(/[^0-9]/g, '').slice(0, 12);
}

// === LAYER MANAGEMENT ===
function createRadarLayer(frame) {
    return new L.TileLayer(frame, {
        attribution: RADAR_ATTRIB,
        tileSize: 256,
        opacity: 0.001,
        maxNativeZoom: 20,
        maxZoom: 20,
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
    // Capture the current date+time and round down to the previous 5 minute.
    const fiveMinMS = 300000; // 5 * 60 * 1000
    const nowDT= new Date();
    const firstFrame=new Date(nowDT - (nowDT % fiveMinMS));
    const maxFrame=FRAME_COUNT - 1; // Set the last image to be the most recent (offset of 0 minutes)

    let tileUrl;
    let timeOffset;

    // Calculate the date/time for each frame and retrieve the layer into the map.
    for (let i = 0; i < FRAME_COUNT; i++) {
        timeOffset= (i - maxFrame) * FRAME_INTERVAL ;
        tileUrl= API_URL + dateMath2ISO(firstFrame,timeOffset) + API_URL_TAIL;
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

export function getRadarLeafletIEM(latitude,longitude) {
    // === MAP SETUP Regional ===
    Weather.radarImage.map = L.map('radar-container', { maxZoom: 20 }).setView([latitude, longitude], globalConfig.radar.zoomLevelRegional);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        tileSize: TILE_SIZE,
        zoomOffset: ZOOM_OFFSET
    }).addTo(Weather.radarImage.map);

    initialize(Weather.radarImage);
    addActiveWarningOverlay(Weather.radarImage.map, Weather.activeWarnings);

    // zoomed-radar-page ("2 Hour Local Radar") was removed from the alert sequences in
    // MainScript.js -- no longer building Weather.zoomedRadarImage here either, since
    // that page never shows now and this would otherwise just be wasted NEXRAD/basemap
    // tile requests every cycle for a map nobody ever sees.
}