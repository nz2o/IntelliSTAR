// The Local on the 8's Emulator
// forked from https://github.com/qconrad/intellistar-emulator and extensively modified.
// for my son Matthew, who loves the weather on the 8's.

// Handle application versioning.
const webAppVersion = "1.5.0";

// import the global configuration (narrationDwellMs, etc.)
import { globalConfig } from '../common_configuration.js';

// import the InformationSetting functions.
import {
  setGreetingPage,setTimelineEvents,setCurrentConditions,createLogoElements,
  setForecast,setOutlook,setAlmanac,setAlertPage,setInitialPositionCurrentPage,getPageLogoFileName
} from './InformationSetting.js';

// import the RainViewer Radar Animation Control
import {setRadarAnimation as setRVAnimation} from './RadarLeafletRV.js';

// import the Iowa State Mesonet Radar Animation Control
import {setRadarAnimation as setIEMAnimation} from './RadarLeafletIEM.js';

// import the Aeris/XWeather Radar Animation Control
import {setRadarAnimation as setXWAnimation} from './RadarLeafletXW.js';

// import the Rainbow.AI Radar Animation Control
import {setRadarAnimation as setRBAIAnimation} from './RadarLeafletRBAI.js';

// import the 2-day hourly forecast chart control
import {renderHourlyForecastChart, destroyHourlyForecastChart} from './HourlyForecastChart.js';

// import the persistent CWA warnings panel's show/hide controls (see the panel's own
// no-warnings-hides-itself logic in CWAWarningsMap.js -- these two just additionally
// suppress it during the greeting/closing screens, on top of that).
import {suppressCWAPanel, unsuppressCWAPanel} from './CWAWarningsMap.js';

// import the closing traffic-conditions slide's availability check (configured AND
// not currently in its blackout window -- see js/TrafficMap.js).
import {trafficSlideAvailable} from './TrafficMap.js';

// import the closing air-quality slide's availability check (configured AND has
// monitoring data for this cycle's location -- see js/AirQuality.js) and its DOM
// renderer.
import {airQualitySlideAvailable, renderAirQuality, aqiNarrationText} from './AirQuality.js';

// import the optional air-quality contour-map slide's availability check -- same
// idea as airQualitySlideAvailable() above, see js/AirQualityContourMap.js.
import {airQualityContourSlideAvailable} from './AirQualityContourMap.js';

// import the bottom-left "last updated per API" status panel's poller -- see
// js/LastUpdated.js. It polls the server's own /status/last-updated route (see
// DataFreshness.js), the one place that actually knows when each source was last
// genuinely refreshed from its real upstream API, not just "when a client asked."
import {startPolling as startLastUpdatedPolling} from './LastUpdated.js';

// Preset timeline sequences 
// For music to finish without looping, sequence needs to match the total duration which is computed and set in XXXXXX_DURATION costant.
// During execution the variable pageDuration is set to the selected sequence total duration so that appropriate music clips can be selected.
const MORNING = [
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000},{name: "hourly-forecast-page", duration: 15000}]},
{name: "Today", subpages: [{name: "today-page", duration: 18000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "tomorrow-page", duration: 18000},{name: "7day-page", duration: 15000},{name: "almanac-page", duration: 15000}]},]
const MORNING_DURATION = totalDuration(MORNING);

const NIGHT = [
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000},{name: "hourly-forecast-page", duration: 15000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "tomorrow-page", duration: 18000},{name: "tomorrow-night-page", duration: 18000},{name: "7day-page", duration: 15000},{name: "almanac-page", duration: 15000}]},]
const NIGHT_DURATION = totalDuration(NIGHT);

const ALERTS_MORNING = [
{name: "Alerts", subpages: [{name: "dynamic-alerts-page", duration: 6000}]},
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000},{name: "hourly-forecast-page", duration: 15000}]},
{name: "Today", subpages: [{name: "today-page", duration: 18000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "7day-page", duration: 15000},{name: "almanac-page", duration: 15000}]},]
const ALERTS_MORNING_DURATION = totalDuration(ALERTS_MORNING);

const ALERTS_NIGHT = [
{name: "Alerts", subpages: [{name: "dynamic-alerts-page", duration: 6000}]},
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000},{name: "hourly-forecast-page", duration: 15000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "tomorrow-page", duration: 18000},{name: "7day-page", duration: 15000},{name: "almanac-page", duration: 15000}]},]
const ALERTS_NIGHT_DURATION = totalDuration(ALERTS_NIGHT);

const jingle = new Audio("assets/music/jingle.wav");

const crawlSpeedCasual = 10; // A normal reading pace, in characters per second
const crawlSpeedFast = 20; // A fast reading pace, in characters per second
const crawlScreenTime = 45; // Shortest time crawl will be on screen, in seconds
const crawlSpace = 70; // Approx number of characters that can fix in the crawl bar. Used for crawl speed calcs
//TF Add config setting for opening &  ending screen hold time.
const greetingScreenDelay = 8000;
const endScreenDelay = 5000; //time to hold in ms.

//TF Implement feeding zip code on URL as ?zip=nnnnn
const urlParams = new URLSearchParams(window.location.search);

var currentLogo;
var currentLogoIndex = 0;
export var pageOrder;
var pageDuration;
var music;
var alertmusic;
var speech;
var voiceGreetURL;
var voiceAlertIndex;
var voiceAlertDurationCalc = false;
var voiceNarrativeDurationCalc = false;

// Browsers block audio autoplay (music, jingle, TTS narration) until the page has
// received a real user gesture -- normally the dialog's "Run" button click provides
// that, but AUTO_START (see common_configuration.js) skips the dialog entirely, so
// there is no gesture and every .play() call below gets rejected. blockedAudio tracks
// which Audio elements the browser refused, so the #audio-toggle icon (a real click,
// which does count as a user gesture) can retry exactly those once clicked.
var blockedAudio = new Set();
var userMuted = false;

// Wraps Audio.play() so a blocked autoplay attempt fails quietly (avoiding the
// "Uncaught (in promise) DOMException" console spam) instead of throwing, and tracks
// the element in blockedAudio so retryBlockedAudio() can retry it after a user gesture.
function safePlay(audioEl) {
  if (!audioEl) return;
  const p = audioEl.play();
  if (p && typeof p.catch === 'function') {
    p.then(() => {
      blockedAudio.delete(audioEl);
      updateAudioToggleIcon();
    }).catch(() => {
      blockedAudio.add(audioEl);
      updateAudioToggleIcon();
    });
  }
}

// Called from the #audio-toggle icon's click handler -- that click is itself a user
// gesture, so any Audio element the browser previously refused to autoplay is now
// allowed to play.
function retryBlockedAudio() {
  for (const el of Array.from(blockedAudio)) {
    safePlay(el);
  }
}

// Click handler for the #audio-toggle icon (see index.html). First click after a
// blocked autoplay unlocks/resumes audio; once unlocked, it's a plain mute toggle.
function fn_toggleAudio() {
  if (blockedAudio.size > 0) {
    userMuted = false;
    retryBlockedAudio();
  } else {
    userMuted = !userMuted;
    [music, speech, alertmusic, jingle].forEach((el) => { if (el) el.muted = userMuted; });
  }
  updateAudioToggleIcon();
}
globalThis.fn_toggleAudio = fn_toggleAudio;

function updateAudioToggleIcon() {
  const icon = getElement('audio-toggle');
  if (!icon) return;
  if (blockedAudio.size > 0) {
    icon.textContent = '🔇';
    icon.title = 'Sound is blocked by the browser -- click to enable';
  } else if (userMuted) {
    icon.textContent = '🔇';
    icon.title = 'Unmute';
  } else {
    icon.textContent = '🔊';
    icon.title = 'Mute';
  }
}

// Click handler for the #tts-toggle icon (see index.html) -- on/off for voice
// narration for the whole presentation. Flips the same CONFIG.voiceEnabled flag the
// settings dialog's checkbox controls (speechStart() in this file already checks
// only that one flag, so this doesn't need a second parallel on/off state to stay
// in sync with) and persists it the same way CONFIG.save() does, so the choice
// survives CONFIG.loop's page-reload-based looping instead of quietly reverting to
// whatever was last saved via the dialog. Also syncs the dialog's own checkbox, so
// opening it afterward doesn't show a stale value.
function fn_toggleTTS() {
  CONFIG.voiceEnabled = !CONFIG.voiceEnabled;
  localStorage.setItem('voiceEnabled', CONFIG.voiceEnabled ? 'y' : 'n');
  const dialogCheckbox = getElement('voiceEnabled');
  if (dialogCheckbox) dialogCheckbox.checked = CONFIG.voiceEnabled;
  if (!CONFIG.voiceEnabled && speech) {
    speech.pause(); // stop any narration already in progress immediately, not just future narration
  }
  updateTTSToggleIcon();
}
globalThis.fn_toggleTTS = fn_toggleTTS;

function updateTTSToggleIcon() {
  const icon = getElement('tts-toggle');
  if (!icon) return;
  if (CONFIG.voiceEnabled) {
    icon.textContent = '💬';
    icon.title = 'Disable Voice Narration';
  } else {
    icon.textContent = '🚫';
    icon.title = 'Enable Voice Narration';
  }
}
var narrativeAudioURL = {}; // subpage name -> pre-synthesized narration audio URL

// Calculate entire sequence duration from individual sub-page durations.
function totalDuration(pageSequence){
  var cumlativeTime = 0;
  for(var p = 0; p < pageSequence.length; p++){
    for (var s = 0; s < pageSequence[p].subpages.length; s++) {
      //for every single sub page
      cumlativeTime += pageSequence[p].subpages[s].duration;
    }
  }
return cumlativeTime;
}

window.onload = async function () {
  getElement('webappversion-text').innerHTML = 'Web Application Version: ' + webAppVersion ;
  await CONFIG.load();

  setMainBackground();
  resizeWindow();
  setClockTime();
  initIdleControls(); // live from page load, so the audio/TTS toggles work even during the startup dialog
  updateTTSToggleIcon(); // reflect CONFIG.voiceEnabled as loaded from localStorage above, in case it was previously turned off
  startLastUpdatedPolling();
// TF 03/2026 Implement additional url parameters for controlling options.
  // Units 
  if (urlParams.has('units')) {
    const inputUnits=urlParams.get('units');
    document.querySelector('input[name="input-units"][value="' + inputUnits + '"]').checked = true;
  }
//TF Implement feeding zip code on URL as ?zip=nnnnn or ?airport=aaaa and auto-starting.
  if (urlParams.has('zip')) {
    zipCode=urlParams.get('zip');
    getElement('usertext').value=zipCode;
    CONFIG.run();
  } else if (urlParams.has('airport')) {
    airportCode=urlParams.get('airport').toUpperCase();
    getElement('usertext').value=airportCode;
    CONFIG.run();
  } else if (CONFIG.loop && CONFIG.isLocationValid()) {
    // Looping (nwsLogoClick()) works by reloading the page, and CONFIG.load() above
    // already restored the last-used location into #usertext -- resume automatically
    // instead of showing the settings dialog, so looping actually loops unattended.
    CONFIG.run();
  } else if (globalConfig.general.autoStart && CONFIG.isLocationValid()) {
    // AUTO_START=true in .env -- CONFIG.load() above already applied the saved (or
    // DEFAULT_LOCATION-derived) location and option defaults to the dialog's fields;
    // skip showing it and start immediately, with no click required.
    CONFIG.run();
  } else {
    openSettingsDialog();
  }
}

// Available background-music track durations (ms), matching assets/music/<n>-<duration>.wav
// filenames on disk. pageDuration (the nominal sequence length) won't always match one
// of these exactly -- narration overflow already stretches individual subpage
// durations past their nominal value (see loadNarrativeVoices()/loadAlertVoices()),
// and sequence changes can shift the nominal total too -- so this picks the closest
// available track and loops it, instead of requesting an exact-duration file that may
// not exist (a 404 there silently kills the music entirely, it doesn't just cut off
// early).
const MUSIC_DURATIONS_MS = [94000];

function preLoadMusic(){
  const SONG_COUNT = 12;
  var index = Math.floor(Math.random() * SONG_COUNT) + 1;
  const musicDuration = MUSIC_DURATIONS_MS.reduce((closest, d) =>
    Math.abs(d - pageDuration) < Math.abs(closest - pageDuration) ? d : closest
  );
  music = new Audio("assets/music/" + index + "-" + musicDuration + ".wav");
  music.loop = true;
  speech = new Audio("assets/music/" + index + "-" + musicDuration + ".wav");
  alertmusic= new Audio("assets/music/storm-68.wav");
}

// Called from WeatherFetching after all weather data has been received and processed.
/* Set the timeline page order depending on time of day and if
alerts are present */
export async function scheduleTimeline(){
  console.log("Alerts Length=",Weather.alerts.length,"Weather.alertsActive=",Weather.alertsActive);
  // structuredClone() here is deliberate: pageOrder must be a working COPY, not a
  // reference to the shared MORNING/NIGHT/ALERTS_* consts. loadAlertVoices() and
  // loadNarrativeVoices() mutate subpage .duration values in place on pageOrder --
  // without cloning, looping (which re-runs this function in place, unlike a page
  // reload) would permanently inflate those durations a little more every cycle.
  if(Weather.alertsActive > 0){
    // Active alerts, decide which sequence based on forecast availability.
    if(isDay) {
      pageOrder = structuredClone(ALERTS_MORNING);
      pageDuration = ALERTS_MORNING_DURATION;
    }else{
      pageOrder = structuredClone(ALERTS_NIGHT);
      pageDuration = ALERTS_NIGHT_DURATION;
    }
  }else {
    // No active weather alerts, decide wich non-alert sequence based on forecast availability.
    if(isDay){
      pageOrder = structuredClone(MORNING);
      pageDuration = MORNING_DURATION;
    }else{
      pageOrder = structuredClone(NIGHT);
      pageDuration = NIGHT_DURATION;
    }
  }
  // At this point pageOrder & pageDuration will be set to exactly one sequence.

  // Traffic slide: appended dynamically rather than baked into MORNING/NIGHT/
  // ALERTS_* above, since whether it's shown depends on runtime state -- TomTom
  // configured at all, and not currently in the location's own local-time blackout
  // window (see trafficSlideAvailable() in js/TrafficMap.js) -- neither of which is
  // knowable at module load time. Added to the last group ("Beyond" in every
  // sequence) so it lands right before the outro, same spot clearPage() already
  // treats generically as "whichever page is last" (see its isLastPage handling).
  // preLoadMusic() already tolerates pageDuration not exactly matching any one music
  // track (picks the closest available), so there's no need for a separate
  // *_DURATION constant per traffic on/off state.
  if (await trafficSlideAvailable()) {
    const trafficDuration = 15000;
    pageOrder[pageOrder.length - 1].subpages.push({ name: "traffic-page", duration: trafficDuration });
    pageDuration += trafficDuration;
  }

  // Air-quality slide: same dynamic-append reasoning as traffic above, right after
  // it in the rotation. airQualitySlideAvailable() is synchronous (unlike
  // trafficSlideAvailable()) and just reads whatever fetchAirQuality() last resolved
  // to -- that fetch is fire-and-forget from WeatherFetching.js (a real outbound API
  // call has no business blocking the whole presentation from starting), so this can
  // reflect the previous cycle's result rather than one already refreshed for this
  // exact instant. That's fine: it just means the slide's on/off state lags the real
  // data by about one loop cycle, never zero.
  if (airQualitySlideAvailable()) {
    const airQualityDuration = 15000;
    pageOrder[pageOrder.length - 1].subpages.push({ name: "air-quality-page", duration: airQualityDuration });
    pageDuration += airQualityDuration;
  }

  // Optional air-quality contour map, right after the main air-quality slide --
  // same reasoning as both blocks above. Independent of airQualitySlideAvailable()
  // above: the contour file is a separate data source (see
  // AirNowContourInterface.js) that can have data even where the point-observation
  // API doesn't, or vice versa.
  if (airQualityContourSlideAvailable()) {
    const contourDuration = 15000;
    pageOrder[pageOrder.length - 1].subpages.push({ name: "air-quality-contour-page", duration: contourDuration });
    pageDuration += contourDuration;
  }

  setInformation();
}

function revealTimeline(){
  getElement('timeline-event-container').classList.add('shown');
  getElement('progressbar-container').classList.add('shown');
  getElement('logo-stack').classList.add('shown');
  var timelineElements = document.querySelectorAll(".timeline-item");
  for (var i = 0; i < timelineElements.length; i++) {
    timelineElements[i].style.top = '0px';
  }
}

/* Now that all the fetched information is stored in memory, display them in
the appropriate elements */
function setInformation(){
  setKbdShortcuts("enable");
  setGreetingPage();
  preLoadMusic();
  setAlertPage();
  setForecast();
  setOutlook();
  setAlmanac();
  renderAirQuality(); // no-op if the slide isn't in this cycle's rotation (see scheduleTimeline() above)
  createLogoElements();
  setCurrentConditions();
  setTimelineEvents();
  setTimeout(startAnimation, 1000);
}

function setPicsumBackground(){
  getElement('background-image').style.backgroundImage = 'url(https://picsum.photos/1920/1080/?random';
}

// Sets the main background image -- a random local photo for the current CWA (see
// assets/background/README.md) if one's available, otherwise falls back to a random
// picsum.photos/Unsplash image (the original behavior -- also always used at initial
// page load, via window.onload below, since there's no location resolved yet at that
// point to even have a CWA for). Called again once the CWA becomes known (see
// resolveGridpoint() in WeatherFetching.js), so the background can switch over to a
// local photo shortly after the location resolves.
export async function setMainBackground(cwa){
  if (cwa) {
    try {
      const response = await fetch(`/background-photos/${cwa}`);
      const photos = await response.json();
      if (photos.length > 0) {
        const photo = photos[Math.floor(Math.random() * photos.length)];
        getElement('background-image').style.backgroundImage = `url(${photo})`;
        return;
      }
    } catch (err) {
      console.log('setMainBackground: local photo lookup failed (falling back to picsum):', err.message);
    }
  }
  setPicsumBackground();
}

function startAnimation(){
  suppressCWAPanel(); // hidden for the greeting -- unsuppressCWAPanel() in clearGreetingPage() once it ends
  setInitialPositionCurrentPage();
  //setTimeout(startMusic, 5000)
  getElement('weatherfetch-container').classList.add("hide");
  executeGreetingPage();
  loadAlertVoices();
  loadNarrativeVoices();
}

// Shared "fade out when idle, reveal on mouse movement" behavior for the top-right
// audio/TTS toggles and the bottom-left #api-last-updated panel -- like a video
// player's controls. Elements register themselves via registerAutoHideControl();
// initIdleControls() (called once from window.onload, so this is live even during
// the startup dialog, before the presentation itself starts) does the rest: any
// mousemove shows everything registered and resets an idle timer, which -- after
// IDLE_TIMEOUT_MS with no further movement -- adds .auto-hide-idle to fade them all
// back out (opacity only, see each element's own CSS -- not display/visibility, so
// :hover on one still works to reveal it individually even while otherwise idle).
const IDLE_TIMEOUT_MS = 4000;
const autoHideControls = [];
let idleTimer;

function registerAutoHideControl(element) {
  if (element) autoHideControls.push(element);
}

function showAutoHideControls() {
  autoHideControls.forEach((el) => el.classList.remove('auto-hide-idle'));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    autoHideControls.forEach((el) => el.classList.add('auto-hide-idle'));
  }, IDLE_TIMEOUT_MS);
}

function initIdleControls() {
  registerAutoHideControl(getElement('audio-toggle'));
  registerAutoHideControl(getElement('tts-toggle'));
  registerAutoHideControl(getElement('api-last-updated'));
  document.addEventListener('mousemove', showAutoHideControls);
  document.addEventListener('touchstart', showAutoHideControls);
  showAutoHideControls(); // visible to start with, then idles out same as everything else
}

function getAudioDuration(audioUrl) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.src = audioUrl;

        audio.addEventListener('loadedmetadata', function() {
            resolve(audio.duration);
        }, false);

        audio.addEventListener('error', function(err) {
            reject(err);
        }, false);
    });
}

async function loadAlertVoices() {
// This function runs during the greeting page display and checks for any active alerts.
// If alerts are found, then the alert speech text is converted to voice and the total
// duration needed to speak it is calculated. Then the pageOrder is updated so the alert
// is displayed for the time required.
  const cAlertTimePadding=globalConfig.general.narrationDwellMs;
  const curPageDuration=pageOrder[0].subpages[0].duration;

  if (Weather.alertsActive < 1) {voiceAlertDurationCalc = true; return}; // no active alerts, return no modifications.

  // Synthesize every alert concurrently instead of one at a time -- each alert's
  // narration is independent of the others, and Piper's server is threaded to handle
  // concurrent requests, so serializing these here just adds up wait time for nothing.
  await Promise.all(Weather.alerts.map(async (alert, i) => {
    // Only need to compute the actual speaking duration if the alert is narrated,
    // otherwise use the default duration provided in WeatherFetching.
    if (CONFIG.voiceAlertNarration) {
      alert.URL = await ttsGetSpeech(alert.speechText,CONFIG.voiceURL,CONFIG.voiceSelect);
      console.log(`AV # ${i}= `+alert.URL);
      await getAudioDuration(alert.URL)
      .then(duration => {
          console.log('The duration of the voice is: ' + duration + ' seconds');
          alert.duration = (duration*1000)+cAlertTimePadding;

      })
      .catch(error => {
          console.error('Error getting audio duration:', error);
      });
    }
  }));
  const AlertDuration = Weather.alerts.reduce((sum, alert) => sum + alert.duration, 0);
  console.log(`Total Alert Duration= ${AlertDuration} ms`);
  pageOrder[0].subpages[0].duration = curPageDuration + AlertDuration; // return total alert duration in ms
  voiceAlertDurationCalc = true;
}

// Pre-synthesizes forecast narration and extends each narrative subpage's duration
// to match how long it actually takes to speak, so page transitions don't cut
// narration off mid-sentence -- same idea as loadAlertVoices() above, applied to
// the today/tonight/tomorrow/tomorrow-night forecast pages instead of alerts.
async function loadNarrativeVoices() {
  const narrativeTimePadding = globalConfig.general.narrationDwellMs;
  // Spoken prefix comes from Weather.forecastDayLabel (NWS's own period name for that
  // index -- see fetchForecast() in WeatherFetching.js), not a hardcoded "today"/
  // "tonight"/tomorrowName guess: today-page/tonight-page/etc. are fixed DOM slots for
  // forecastNarrative[0..3], but which actual NWS period lands in each slot shifts by
  // one whenever the forecast is fetched at night (periods[0] is "Tonight" itself, not
  // "Today"). Using the real period name here keeps the narration in sync with
  // whatever the on-screen header (setForecast() in InformationSetting.js) is actually
  // showing for that same index.
  const narrativePages = [
    { subPageName: "today-page", text: () => Weather.forecastDayLabel[0] + ". " + Weather.forecastNarrative[0] },
    { subPageName: "tonight-page", text: () => Weather.forecastDayLabel[1] + ". " + Weather.forecastNarrative[1] },
    { subPageName: "tomorrow-page", text: () => Weather.forecastDayLabel[2] + ". " + Weather.forecastNarrative[2] },
    { subPageName: "tomorrow-night-page", text: () => Weather.forecastDayLabel[3] + ". " + Weather.forecastNarrative[3] },
  ];

  if (!CONFIG.voiceEnabled) { voiceNarrativeDurationCalc = true; return; }

  // Synthesize every narrative page concurrently instead of one at a time -- each
  // page's narration is independent of the others (same reasoning as loadAlertVoices()
  // above), so this cuts total wait time roughly to however long the slowest single
  // synthesis takes, instead of the sum of all of them.
  await Promise.all(narrativePages.map(async (page) => {
    // Find this subpage in whichever sequence (MORNING/NIGHT/ALERTS_*) was selected --
    // not every sequence contains every narrative page (e.g. NIGHT has no today-page).
    let subpage;
    for (const p of pageOrder) {
      subpage = p.subpages.find(sp => sp.name === page.subPageName);
      if (subpage) break;
    }
    if (!subpage) return;

    try {
      const audioURL = await ttsGetSpeech(page.text(), CONFIG.voiceURL, CONFIG.voiceSelect);
      narrativeAudioURL[page.subPageName] = audioURL;
      const duration = await getAudioDuration(audioURL);
      const neededDuration = (duration * 1000) + narrativeTimePadding;
      if (neededDuration > subpage.duration) {
        subpage.duration = neededDuration;
      }
    } catch (error) {
      console.error('Error pre-synthesizing narrative voice for', page.subPageName, error);
    }
  }));
  voiceNarrativeDurationCalc = true;
}

// Plays a pre-synthesized narration audio URL (from loadNarrativeVoices() above),
// same ducking/restore behavior as speechStart() but without re-synthesizing.
function speechStartFromURL(audioURL) {
  if (!CONFIG.voiceEnabled || !audioURL) return;
  console.log("Speech has started (pre-synthesized): "+audioURL);
  if(CONFIG.musicMute) {
    music.muted = true;
  } else {
    music.volume=CONFIG.audioVolume * globalConfig.general.musicDuckLevel;
  }
  speech.src = audioURL;
  speech.volume=CONFIG.audioVolume;
  safePlay(speech);
  speech.onended = () => speechEnd(audioURL);
}

function startMusic(){
  if(CONFIG.musicEnabled) {
    music.muted = false;
    music.volume=CONFIG.audioVolume;
    safePlay(music);
  }
}


async function speechStartAlert(alertIndex) {
  console.log("Alert narration start. Index: ",alertIndex," Duration=",Weather.alerts[alertIndex].duration);
  // Duck the music for the narration. Either mute or reduce the volume of the background music.
  if(CONFIG.musicMute) {
    alertmusic.muted = true;
  } else {
    alertmusic.volume=CONFIG.audioVolume * globalConfig.general.musicDuckLevel;
  }

  speech.src = Weather.alerts[alertIndex].URL;
  speech.volume=CONFIG.audioVolume;
  safePlay(speech);
  speech.onended = () => speechEndAlert(Weather.alerts[alertIndex].URL);
};

async function speechStart(SpeechStr) {
  if(CONFIG.voiceEnabled) {
    console.log("Speech has started: "+SpeechStr);

    const audioURL = await ttsGetSpeech(SpeechStr,CONFIG.voiceURL,CONFIG.voiceSelect);
    // Duck the music for the narration. Either mute or reduce the volume of the background music.
    if(CONFIG.musicMute) {
      music.muted = true;
    } else {
      music.volume=CONFIG.audioVolume * globalConfig.general.musicDuckLevel;
    }
    speech.src = audioURL;
    speech.volume=CONFIG.audioVolume;
    safePlay(speech);
    speech.onended = () => speechEnd(audioURL);
  } else {
    console.log("Speech is disabled.");
  }
};

function speechEnd(audioURL) {
  console.log("Speech has ended!");
  // Restore the music after the narration has ended. Either unmute or increase the volume of the background music.
  if(CONFIG.musicMute) {
    music.muted = false;
  } else {
    music.volume=CONFIG.audioVolume;
  }
  URL.revokeObjectURL(audioURL);  // free up memory after speech has ended.
  
};

function speechEndAlert(audioURL) {
  // Restore the music after the narration has ended. Either unmute or increase the volume of the background music.
  if(CONFIG.musicMute) {
    alertmusic.muted = false;
  } else {
    alertmusic.volume=CONFIG.audioVolume;
  }
  URL.revokeObjectURL(audioURL);  // free up memory after speech has ended. 
};

function SpeakGreeting() {
  //const speech = new Audio(voiceGreetURL);
  speech.src=voiceGreetURL;
  speech.volume=CONFIG.audioVolume;
  safePlay(speech);
  speech.onended = () => speechEnd(voiceGreetURL);
}

async function executeGreetingPage(){
  let voiceGreetDuration = 0;
  let voiceGreetOverflow = 0;

  jingle.currentTime = 0; // rewind -- looping re-plays this same Audio object each cycle
  jingle.volume=CONFIG.audioVolume;
  safePlay(jingle);
  // Queue the greeting narration. Get the duration to see if the page time needs
  // to be extended.
  if(CONFIG.voiceEnabled) {
    voiceGreetURL = await ttsGetSpeech(CONFIG.greeting,CONFIG.voiceURL,CONFIG.voiceSelect);
    await getAudioDuration(voiceGreetURL)
    .then(duration => {
        console.log('The duration of the voice is: ' + duration + ' seconds');
        voiceGreetDuration = (duration*1000);
    })
    .catch(error => {
        console.error('Error getting audio duration:', error);
    });
    // Extend the greeting page time if needed to accommodate the greeting duration.
    // voiceGreetOverflow will be > 0 to extend the timing. Otherwise = 0.
    voiceGreetOverflow = voiceGreetDuration - (greetingScreenDelay-5000);
    if(voiceGreetOverflow < 0) {voiceGreetOverflow = 0;}
    if(voiceGreetDuration > 0) {
      setTimeout(SpeakGreeting,4000);
    }
  }

  getElement('background-image').classList.remove("below-screen");
  getElement('content-container').classList.add('shown');
  getElement('infobar-nws-logo').classList.add('shown');
  getElement('hello-text').classList.add('shown');
  getElement('hello-location-text').classList.add('shown');
  getElement('greeting-text').classList.add('shown');
  getElement('local-logo-container').classList.add("shown");
  setTimeout(clearGreetingPage, (greetingScreenDelay + voiceGreetOverflow));
}

async function clearGreetingPage(){
  // Remove transition delay from greeting
  getElement('greeting-text').classList.remove('shown');
  getElement('local-logo-container').classList.remove('shown');

  // Hide everything
  getElement('greeting-text').classList.add('hidden');
  getElement('hello-text-container').classList.add('hidden');
  getElement("hello-location-container").classList.add("hidden");
  getElement("local-logo-container").classList.add("hidden");

  // Make sure narration duration calculations (alerts, and forecast narrative
  // pages) have completed prior to trying to schedule the page sequence, so
  // per-page timing can account for how long narration actually takes to speak.

  // Added a little informational prompt to let user know that Narration is being cached.
  getElement("greeting-narrationMsg").classList.add("shown");

  while (!voiceAlertDurationCalc || !voiceNarrativeDurationCalc) {
    console.log("Waiting for voice Alert/Narrative Duration Calculation Completion..");
    await delay(1000);
  }
  getElement("greeting-narrationMsg").classList.remove("shown");

  schedulePages();
  loadInfoBar();
  revealTimeline();
  unsuppressCWAPanel(); // greeting's over -- let the CWA panel show again (if it has warnings to show)
  // If no alerts then start the background music now. If alerts are active
  // then the music will be controlled by the alerts system.
  if(Weather.alertsActive == 0) {
    startMusic();
  }
  setTimeout(showCrawl, 3000);
}

// 1. Define a reusable delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Set start and end times for every sub page.
function schedulePages(){
  var cumlativeTime = 0;
  for(var p = 0; p < pageOrder.length; p++){
    for (var s = 0; s < pageOrder[p].subpages.length; s++) {
      //for every single sub page
      var startTime = cumlativeTime;
      var clearTime = cumlativeTime + pageOrder[p].subpages[s].duration;
      console.log(`Page ${p} ${s} duration= ${pageOrder[p].subpages[s].duration}`);
      setTimeout(executePage, startTime, p, s);
      setTimeout(clearPage, clearTime, p, s);
      cumlativeTime = clearTime;
    }
  }
  // Handle the dynamic weather alerts. Schedule the page transition and narration events.
  if(Weather.alertsActive > 0) {
    cumlativeTime = 0;
    for (var i = 0; i < Weather.alertsActive; i++){
      cumlativeTime = cumlativeTime + Weather.alerts[i].duration;
      setTimeout(execAlerts, cumlativeTime, (i+1));
    }
  }
}

// Handle the alert transitions. Controls which alert is displayed, narration being played
// and the cutover from the alert storm music to the regular music.
function execAlerts(alertIndex) {
  var alertElement;

  // Check and handle the last alert ending.
  if (alertIndex === Weather.alertsActive) {
    if (CONFIG.musicEnabled) {
      alertmusic.pause();
      music.volume=CONFIG.audioVolume; // resume the normal background music volume.
      safePlay(music);
    }
  } else {
    // Initial alert setup (correct div is already showing?)
    if (alertIndex === 0) {
      // Start the storm music.
      if(CONFIG.musicEnabled) {
        alertmusic.volume=CONFIG.audioVolume;
        safePlay(alertmusic);
        alertmusic.loop=true;
      }
    } else {
      // Hide the prior alert to reveal the next alert.
      const alertIDPrev='alert' + (alertIndex-1);
      alertElement = getElement(alertIDPrev);
      alertElement.classList.add("hidden");
    }
    // If narrations are not disabled, queue up the alert narration.
    if(CONFIG.voiceAlertNarration) {
      speechStartAlert(alertIndex);
    }
    // TF 07/2026 See if alert text overflows the alert container.
    // If it does, calculate the time and distance to initiate a scrolling animation.
    const alertID = 'alert' + alertIndex;
    alertElement = getElement(alertID);
    const aCHeight=alertElement.clientHeight;
    const aSHeight=alertElement.scrollHeight;
    console.log("Alert #",alertIndex,"Container=",aCHeight,"Scroll=",aSHeight);
    const oFlowDist = aSHeight - aCHeight; // distance needed to scroll to the bottom
    if (oFlowDist>0) {
      console.log("Scrolling Needed. Distance=",oFlowDist);
      const scrollSpeed = 40; // Scrolling rate in pixels per second.
      const scrollDuration = oFlowDist / scrollSpeed;
      // Set the new dynamic CSS scrolling variables.
      alertElement.style.setProperty("--scroll-distance", `-${oFlowDist}px`);
      alertElement.style.setProperty("--scroll-duration", `${scrollDuration}s`);

      // Delay scrolling onset until most of the text has been narrated or read.
      // Default hardcoded for 20 seconds.
      setTimeout(() => {
        alertElement.classList.add("is-scrolling");
      }, 20000);
    }

  }
}

function executePage(pageIndex, subPageIndex){
  var currentPage = pageOrder[pageIndex];
  var currentSubPageName = currentPage.subpages[subPageIndex].name;
  var currentSubPageElement = getElement(currentSubPageName);
  var subPageCount = currentPage.subpages.length
  var currentSubPageDuration = currentPage.subpages[subPageIndex].duration;

  if(subPageIndex === 0){
    var pageTime = 0;
    for (var i = 0; i < subPageCount; i++) {
      pageTime += currentPage.subpages[i].duration;
    }
      getElement('progressbar').style.transitionDuration = pageTime + "ms";
      getElement('progressbar').classList.add('progress');
      getElement('timeline-event-container').style.left = (-280*pageIndex).toString() + "px";
      getElement('progress-stack').style.left = (-280*pageIndex).toString() + "px";
  }

  if(currentLogo != getPageLogoFileName(currentSubPageName)){
    getElement('logo-stack').style.left = ((-85*currentLogoIndex)-(20*currentLogoIndex)).toString() + "px";
    currentLogo = getPageLogoFileName(currentSubPageName);
    currentLogoIndex++;
  }

  currentSubPageElement.style.transitionDelay = '0.5s';
  // Always reset left, even on the page-0/subpage-0 top-axis entrance branch below --
  // dynamic-alerts-page (the only page ever shown that way) rests at left:0px per its
  // own CSS (see .alert-page-container in alert.css), but clearPage() unconditionally
  // dismisses every page via left:-101%, regardless of which axis actually shows it.
  // Left unreset here, that stale left:-101% from the previous loop cycle's clearPage()
  // would survive alongside a freshly-reset top:0px, permanently keeping the alert page
  // off-screen from the 2nd loop cycle onward -- narration still fires (that doesn't
  // depend on CSS position), but the alert box itself never becomes visible again.
  currentSubPageElement.style.left = '0px';
  if(pageIndex === 0 && subPageIndex == 0){
    currentSubPageElement.style.top = '0px';
  }

  var isLastPage = pageIndex >= pageOrder.length-1 //&& subPageIndex >= pageOrder[pageOrder.length-1].subpages.length-1;

  if(currentSubPageName == "current-page"){
    speechStart(cCondText());    
    setTimeout(loadCC, 1000);
    setTimeout(scrollCC, currentSubPageDuration / 2);
    animateDialFill('cc-dial', Weather.currentTemperature, 5000);
  }
  else if(currentSubPageName == 'radar-page'){
    startRadar();
    // not spoken in live broadcast speechStart("Here is the Regional Radar.");
  }
  else if(currentSubPageName == 'hourly-forecast-page'){
    renderHourlyForecastChart();
    // visual-only, like the radar pages -- not narrated in the live broadcast either.
  }
  else if(currentSubPageName == 'zoomed-radar-page'){
    startZoomedRadar();
    // not spoken in live broadcast speechStart("and here is the Local Radar.");    
  }
  else if(currentSubPageName == "today-page"){
    speechStartFromURL(narrativeAudioURL[currentSubPageName]);
    scrollNarrativeIfNeeded(currentSubPageName, currentSubPageDuration);
  }
  else if(currentSubPageName == "tonight-page"){
    speechStartFromURL(narrativeAudioURL[currentSubPageName]);
    scrollNarrativeIfNeeded(currentSubPageName, currentSubPageDuration);
  }
  else if(currentSubPageName == "tomorrow-page"){
    speechStartFromURL(narrativeAudioURL[currentSubPageName]);
    scrollNarrativeIfNeeded(currentSubPageName, currentSubPageDuration);
  }
  else if(currentSubPageName == "tomorrow-night-page"){
    speechStartFromURL(narrativeAudioURL[currentSubPageName]);
    scrollNarrativeIfNeeded(currentSubPageName, currentSubPageDuration);
  }
  else if(currentSubPageName == "7day-page"){
    speechStart("Here is our seven day outlook.");
  }
  else if(currentSubPageName == "traffic-page"){
    // visual-only, like the radar/hourly-forecast pages -- not narrated. The map
    // itself was already built (buildTrafficMap() in WeatherFetching.js) well before
    // this page is ever actually shown, so there's nothing to trigger here.
  }
  else if(currentSubPageName == "air-quality-page"){
    // Dynamic narration of the current AQI rating, same pattern as current-page's
    // own cCondText() -- built fresh from this cycle's data (see
    // aqiNarrationText() in js/AirQuality.js) rather than pre-synthesized/duration-
    // extended like the forecast pages, since it's a single short sentence that
    // comfortably fits the page's normal dwell time.
    speechStart(aqiNarrationText());
  }
  else if(currentSubPageName == "air-quality-contour-page"){
    // visual-only -- not narrated. The map itself was already built
    // (buildAirQualityContourMap() in WeatherFetching.js) well before this page is
    // ever actually shown, so there's nothing to trigger here.
  }
  else if(currentSubPageName == "dynamic-alerts-page"){
    execAlerts(0); // Start the alerts sequence at the 1st alert.
  }
}

// Auto-scrolls a forecast narrative-text element if its content overflows the space
// available for it, using the same clientHeight/scrollHeight + CSS custom property
// technique as the alert page's overflow scroll (see execAlerts above).
function scrollNarrativeIfNeeded(subPageName, subPageDuration) {
  const textElement = getElement(subPageName.replace('-page', '-narrative-text'));
  const oFlowDist = textElement.scrollHeight - textElement.clientHeight;
  if (oFlowDist > 0) {
    const scrollSpeed = 40; // pixels per second, matches the alert page's rate
    const scrollDuration = oFlowDist / scrollSpeed;
    textElement.style.setProperty("--scroll-distance", `-${oFlowDist}px`);
    textElement.style.setProperty("--scroll-duration", `${scrollDuration}s`);
    // Give the reader a moment on the top of the text before scrolling starts,
    // scaled to this page's (much shorter than an alert's) dwell time.
    setTimeout(() => {
      textElement.classList.add("is-scrolling");
    }, subPageDuration / 3);
  }
}

// TF 03/2026 Implement dynamic narrative for the current conditions page based on real broadcast style.
function cCondText() {
  let rString="";
  // inspect Weather.currentCondition for key words that define the narrative.
  // Rain
  if (Weather.currentCondition.search(/rain|showers|snow|thunder/i)!=-1) {
    rString="Currently in our area. "+Weather.currentTemperature+" degrees, with "+Weather.currentCondition+".";
  } else {
    rString="Currently in our area. "+Weather.currentTemperature+" degrees, under "+Weather.currentCondition+" skies.";
  }
  return rString;
}

function clearPage(pageIndex, subPageIndex){
  var currentPage = pageOrder[pageIndex];
  var currentSubPageName = currentPage.subpages[subPageIndex].name;
  var currentSubPageElement = getElement(currentSubPageName);
  var subPageCount = currentPage.subpages.length
  var currentSubPageDuration = currentPage.subpages[subPageIndex].duration;

  var isNewPage = subPageCount-1 == subPageIndex;
  var isLastPage = pageIndex >= pageOrder.length-1 && subPageIndex >= pageOrder[pageOrder.length-1].subpages.length-1;

  if(isNewPage && !isLastPage){
    resetProgressBar();
  }

  if(isLastPage){
//TF Allow crawl to last until all the pages and subpages are displayed.
    // The last page never got the same slide-off every other page gets below, so
    // whatever page happens to be last stayed fully visible, superimposed underneath
    // the "It's Amazing Out There"/"Stay Updated" overlay that fades in next. This
    // was previously papered over only for 7day-page specifically (see the hardcoded
    // outlook-titlebar/forecast-left-container/forecast-right-container hiding in
    // clearElements() below) -- fixed generically here instead, since whichever page
    // is actually last (7day-page, almanac-page, or anything added after it) needs
    // the exact same treatment, not a hardcoded one-off patch per page.
    currentSubPageElement.style.transitionDelay = '0s';
    currentSubPageElement.style.left = '-101%';
    // The rest of this (via endSequence() -> clearInfoBar() -> clearElements()) is
    // delayed 200ms, which left a brief but noticeable window where the content area
    // had already gone blank (last page just slid away, above) but the timeline/logo
    // bar at the bottom -- still scrolled to show the last page's icon -- hadn't been
    // hidden yet, right before the "It's Amazing Out There"/"Stay Updated" overlay
    // appears. Hidden immediately here instead of waiting on that delay.
    getElement("timeline-container").style.visibility = "hidden";
    hideCrawl();
    stopRadar();
    endSequence();
  }
  else{
    currentSubPageElement.style.transitionDelay = '0s';
    currentSubPageElement.style.left = '-101%';
  }
}

function resetProgressBar(){
  getElement('progressbar').style.transitionDuration = '0ms';
  getElement('progressbar').classList.remove('progress');
  void getElement('progressbar').offsetWidth;
}

function startRadar(){
  switch(CONFIG.radarSource) {
    case "leaflet-iowastate":
      setIEMAnimation(Weather.radarImage,true);
      break;
    case "leaflet-rainviewer":
      setRVAnimation(Weather.radarImage,true);
      break;
    case "leaflet-xweather":
      setXWAnimation(Weather.radarImage,true);
      break;
    case "leaflet-rainbowai":
      setRBAIAnimation(Weather.radarImage,true);
      break;
    case "direct-nws":
      getElement('radar-container').appendChild(Weather.radarImage);
      break;
    default:
      console.log("Unknown Radar Service! No Regional Radar Animation. radarSource=",CONFIG.radarSource);
      break;
  }
}

function startZoomedRadar(){
  switch(CONFIG.radarSource) {
    case "leaflet-iowastate":
      setIEMAnimation(Weather.zoomedRadarImage,true);
      break;
    case "leaflet-rainviewer":
      setRVAnimation(Weather.zoomedRadarImage,true);
      break;
    case "leaflet-xweather":
      setXWAnimation(Weather.zoomedRadarImage,true);
      break;
    case "leaflet-rainbowai":
      setRBAIAnimation(Weather.zoomedRadarImage,true);
      break;
    case "direct-nws":
      getElement('radar-container').appendChild(Weather.zoomedRadarImage);
      break;
    default:
      console.log("Unknown Radar Service! No Local Radar Animation. radarSource=",CONFIG.radarSource);
      break;
  }
}

function stopRadar(){
  // This function is called at the closing screen to stop updating
  // the hidden radar images.
  switch(CONFIG.radarSource) {
    case "leaflet-iowastate":
      setIEMAnimation(Weather.radarImage,false);
      if (Weather.zoomedRadarImage.animationTimer) {
        setIEMAnimation(Weather.zoomedRadarImage,false);
      }
      break;
    case "leaflet-rainviewer":
      setRVAnimation(Weather.radarImage,false);
      if (Weather.zoomedRadarImage.animationTimer) {
        setRVAnimation(Weather.zoomedRadarImage,false);
      }
      break;
    case "leaflet-xweather":
      setXWAnimation(Weather.radarImage,false);
      if (Weather.zoomedRadarImage.animationTimer) {
        setXWAnimation(Weather.zoomedRadarImage,false);
      }
      break;
    case "leaflet-rainbowai":
      setRBAIAnimation(Weather.radarImage,false);
      if (Weather.zoomedRadarImage.animationTimer) {
        setRBAIAnimation(Weather.zoomedRadarImage,false);
      }
      break;
    case "direct-nws":
      // Legacy NWS Radar presentation
      let radarCont;
      radarCont = getElement('radar-container')
      if (radarCont.querySelector('iframe')) {
        radarCont.removeChild(Weather.radarImage);
      }
      radarCont = getElement('zoomed-radar-container')
      if (radarCont.querySelector('iframe')) {
        radarCont.removeChild(Weather.zoomedRadarImage);
      }
      break;
    default:
      console.log("Unknown Radar Service! Unable to Control Animation. radarSource=",CONFIG.radarSource);
      break;
  }
}

function loadCC(){
  var ccElements = document.querySelectorAll(".cc-vertical-group");
  for (var i = 0; i < ccElements.length; i++) {
    ccElements[i].style.top = '0px';
  }
}

function scrollCC(){
  var ccElements = document.querySelectorAll(".cc-vertical-group");
  for (var i = 0; i < ccElements.length; i++) {
    ccElements[i].style.top = '-80px';
  }
  // Weather.visibility/pressure are null (not a number) when the station simply didn't
  // report that reading -- common for small/rural stations. animateValue() can't
  // animate toward a non-numeric target (its internal range/step-time math goes NaN,
  // the completion check current==end never matches, and the interval never clears),
  // so those cases skip straight to a plain "N/A" instead of calling it.
  if (Weather.visibility != null) {
    animateValue("cc-visibility", 0, Weather.visibility, 800, 1);
  } else {
    getElement("cc-visibility").innerHTML = 'N/A';
  }
  if(CONFIG.units != 'm') {
      getElement("cc-visibility-unit-metric").style.fontSize = "0px";		//Doing the work twice, for good reason: if we simply hide it, the spacing left by the word still exists; if we simply set the size to zero, then it might still be visible at extreme zoom levels.
      getElement("cc-visibility-unit-metric").style.visibility = "hidden";
  } else {
      getElement("cc-visibility-unit-imperial").style.fontSize = "0px";
      getElement("cc-visibility-unit-imperial").style.visibility = "hidden";
  }
  animateValue("cc-humidity", 0, Weather.humidity, 1000, 1);
  animateValue("cc-dewpoint", 0, Weather.dewPoint, 1200, 1);
  if (Weather.pressure == null) {
    getElement("cc-pressure1").innerHTML = 'N/A';
    getElement("cc-pressure2").style.visibility = "hidden";
    getElement("cc-pressure2").style.fontSize = "0px";
    getElement("cc-pressure-decimal").style.visibility = "hidden";
    getElement("cc-pressure-decimal").style.fontSize = "0px";
    getElement("cc-pressure-metric").style.visibility = "hidden";
    getElement("cc-pressure-metric").style.fontSize = "0px";
  } else if (CONFIG.units === 'e') {		//Imperial units.
    // Split decimal into 2 objects so that we can animate them individually.
    var pressureArray = Weather.pressure.toString().split('.');
    animateValue("cc-pressure1", 0, pressureArray[0], 1400, 1);
    animateValue("cc-pressure2", 0, pressureArray[1], 1400, 2);
    getElement("cc-pressure-metric").style.fontSize = "0px";		//hide the "mbar" tag
    getElement("cc-pressure-metric").style.visibility = "hidden";
  } else {      //Metric units.
      var pressureArray = Weather.pressure.toString().split('.');
      animateValue("cc-pressure1", 800, pressureArray[0], 1400, 3);
      getElement("cc-pressure2").style.visibility = "hidden";		//Hide figures after the decimal, since we don't really use decimal points when using hectopascals in the context of meteorology
      getElement("cc-pressure2").style.fontSize = "0px";
      getElement("cc-pressure-decimal").style.visibility = "hidden";		//And same for the decimal, which would look silly without something after it.
      getElement("cc-pressure-decimal").style.fontSize = "0px";
  }
}

// Called at end of sequence. Animates everything out and shows ending text
function endSequence(){
  suppressCWAPanel(); // hidden for the closing screen -- unsuppressCWAPanel() again once the next cycle's greeting ends
  setKbdShortcuts("disable");
  clearInfoBar();
}

// Called to enable or disable keyboard shortcuts during the run
// mode="enable", "disable"
// Currently controls Enter key trapping for looping.
function setKbdShortcuts(mode) {
  if(mode ==="enable") {
    document.addEventListener("keydown", KbdListener);
  } else {
    document.removeEventListener("keydown", KbdListener);
  }

}

function KbdListener(p_event) {
  // Check the key value
  if (p_event.key === "Enter") {
    // Perform an action, e.g., submit a form
    nwsLogoClick();
  }
}

function nwsLogoClick() {
  var alertMessageShown = getElement('alert-message').classList.contains('shown');
  if(alertMessageShown) return;
  var loopStatus = localStorage.getItem('loop');
  if(loopStatus == "y"){
    localStorage.setItem('loop', 'n');
    CONFIG.loop = false;
  }
  else{
    localStorage.setItem('loop', 'y');
    CONFIG.loop = true;
  }
  showLoopMessage();
}
// Exposed globally since index.html's onclick="nwsLogoClick()" attribute runs in
// global scope and can't otherwise see a module-scoped function (same reason
// getElement is exposed via globalThis below).
globalThis.nwsLogoClick = nwsLogoClick;

function clearInfoBar(){
  getElement("infobar-nws-logo").classList.add("hidden");
  getElement("infobar-local-logo").classList.add("hidden");
  getElement("infobar-location-container").classList.add("hidden");
  getElement("infobar-time-container").classList.add("hidden");
  setTimeout(clearElements, 200);
}

// Animates everything out (not including main background)
function clearElements(){
  // outlook-titlebar/forecast-left-container/forecast-right-container used to get
  // explicitly hidden here too (this function only ever ran once 7day-page itself was
  // the last page, back when the last page's own parent slide-off never happened at
  // all -- see clearPage()'s isLastPage branch). Now that the last page (whichever
  // one it is) is always properly slid off-screen on its own, 7day-page is already
  // fully hidden by the time this runs -- and re-adding .hidden to
  // forecast-right-container here actively broke that: its hidden state is a
  // *positive* relative left offset (882px, meant to push it off the right edge of a
  // stationary page), which -- applied on top of the parent's already-applied -101%
  // shift -- partially cancels that shift back out instead of hiding it further.
  getElement("content-container").classList.add("expand");
  getElement("timeline-container").style.visibility = "hidden";
  showEnding();
  setTimeout(clearEnd, endScreenDelay);
}

function showEnding(){
  if(Weather.alerts.length > 0){
    stayUpdated();
  }
  else{
    itsAmazingOutThere();
  }
}

function itsAmazingOutThere(){
  getElement('amazing-text').innerHTML = Weather.endingHashtag;
  getElement('amazing-text').classList.add('extend');
  getElement("amazing-logo").classList.add('shown');
  //getElement("amazing-container").classList.add('hide');
}

function stayUpdated(){
  getElement('updated-text').classList.add('extend');
  getElement("updated-logo").classList.add('shown');
  //getElement("updated-container").classList.add('hide');
}

// Final background animate out
function clearEnd(){
  getElement('background-image').classList.add("above-screen");
  getElement('content-container').classList.add("above-screen");

  // If looping is enabled, restart the whole sequence in place (see restartSequence()).
  // Otherwise, the zip code prompt will show again.
  // NOTE: this intentionally does NOT navigate/reload -- a location.reload() here would
  // create a brand-new page load, and browsers do not carry "this page was user-activated"
  // across a reload, so music/narration autoplay would get silently blocked from the 2nd
  // loop cycle onward.
  if (CONFIG.loop) {
    setTimeout(restartSequence, 400)
  }
}

// Undoes everything a playthrough leaves behind that a page reload used to wipe clean
// for free, so restartSequence() can re-run the whole pipeline in place. See the
// "Loop without page reload" plan for the full audit this is based on -- every line
// here corresponds to a specific state leak that only manifests from the 2nd loop
// cycle onward (duplicate DOM children, stuck CSS classes, a Leaflet "map already
// initialized" crash, stale alert/crawl text, etc).
function resetForNewCycle(){
  // Module state
  currentLogo = undefined;
  currentLogoIndex = 0;
  voiceAlertDurationCalc = false;
  voiceNarrativeDurationCalc = false;
  Object.values(narrativeAudioURL).forEach(url => url && URL.revokeObjectURL(url));
  narrativeAudioURL = {};

  // Stop any audio that might still be playing -- preLoadMusic() replaces these
  // bindings with fresh Audio objects, but dropping the old reference alone doesn't
  // stop old audio from continuing to play.
  music?.pause();
  alertmusic?.pause();
  speech?.pause();

  // Undo one-way-latched CSS classes/styles that are only ever added by the ending
  // sequence and greeting page, never removed -- left alone, these keep whole sections
  // of the display permanently hidden/off-screen from the 2nd loop cycle onward.
  ['infobar-nws-logo','infobar-local-logo','infobar-location-container','infobar-time-container',
   'hello-text-container','hello-location-container','local-logo-container','greeting-text',
   'outlook-titlebar','forecast-left-container','forecast-right-container','crawler-container']
    .forEach(id => getElement(id).classList.remove('hidden'));
  for (let i = 0; i < 5; i++) {
    getElement('alert'+i).classList.remove('hidden');
  }
  // The four infobar elements get .shown added by loadInfoBar() at the right time
  // (after the greeting finishes) but -- same one-way-latch problem as content-container
  // and hello-text above -- it's never removed anywhere. Left in place, removing .hidden
  // above is enough to make the infobar (city name + clock) snap visible immediately,
  // during the greeting phase, well before loadInfoBar() would naturally show it.
  ['infobar-nws-logo','infobar-local-logo','infobar-location-container','infobar-time-container']
    .forEach(id => getElement(id).classList.remove('shown'));
  // Same one-way-latch problem again: revealTimeline() adds .shown to these three
  // (after the greeting finishes, same timing as loadInfoBar() above) but it's never
  // removed anywhere either. Left in place, the timeline/logo bar -- freshly
  // repopulated with this cycle's icons by createLogoElements(), which runs well
  // before the greeting page even starts -- would pop back into view as soon as
  // timeline-container's own visibility is restored below, instead of staying hidden
  // until revealTimeline() actually re-reveals it after the new greeting page.
  ['logo-stack','timeline-event-container','progressbar-container']
    .forEach(id => getElement(id).classList.remove('shown'));
  // .shown is added once by executeGreetingPage() and never removed anywhere -- left
  // in place, removing .expand/.above-screen alone would leave content-container
  // already at its fully-expanded .shown state (height 590px) the instant this
  // function runs, well before the greeting is actually ready to show, instead of
  // properly gating that reveal behind executeGreetingPage()'s own transition timing.
  // This is what made the next page appear to "preload" visibly atop the greeting.
  getElement('content-container').classList.remove('shown','expand','above-screen');
  getElement('background-image').classList.remove('above-screen');
  getElement('weatherfetch-container').classList.remove('hide');
  getElement('timeline-container').style.visibility = '';
  getElement('amazing-text').classList.remove('extend');
  getElement('amazing-logo').classList.remove('shown');
  getElement('updated-text').classList.remove('extend');
  getElement('updated-logo').classList.remove('shown');
  // .shown is added once by showCrawl() (3s after the greeting starts) and never
  // removed -- left in place alongside the .hidden removal above, the crawl bar would
  // start the 2nd cycle already at its fully-open width (both classes present, but
  // .shown would "win" once .hidden is gone) instead of animating open again after the
  // same 3s delay showCrawl() gives it every cycle.
  getElement('crawler-container').classList.remove('shown');

  // hello-text/hello-location-text are children of hello-text-container/
  // hello-location-container (already handled above) but get their OWN .shown
  // added by executeGreetingPage() and -- unlike greeting-text/local-logo-container --
  // it's never removed anywhere. Left in place, they render at their prior on-screen
  // position (visible) the instant their parent's .hidden is lifted above, well before
  // executeGreetingPage() would naturally re-trigger their entrance animation --
  // this is what makes the greeting text appear to "pop under" the next page.
  getElement('hello-text').classList.remove('shown');
  getElement('hello-location-text').classList.remove('shown');

  // weatherfetch-text's .extend (added by CONFIG.run(), never removed) would otherwise
  // leave the previous cycle's "Fetching current weather..." text visibly stale for
  // the instant between weatherfetch-container's .hide being lifted (above) and
  // CONFIG.run() overwriting it with this cycle's text a moment later.
  getElement('weatherfetch-text').classList.remove('extend');

  // Clear leftover overflow-scroll state (alert page + forecast narrative pages)
  // -- .is-scrolling and its --scroll-distance/--scroll-duration custom properties
  // are only ever set, never cleared, so a new cycle's text would otherwise start
  // already shifted by last cycle's scroll amount, or fail to (re)trigger the CSS
  // transition since the class was already present.
  for (let i = 0; i < 5; i++) {
    const el = getElement('alert'+i);
    el.classList.remove('is-scrolling');
    el.style.removeProperty('--scroll-distance');
    el.style.removeProperty('--scroll-duration');
  }
  ['today-narrative-text','tonight-narrative-text','tomorrow-narrative-text','tomorrow-night-narrative-text']
    .forEach(id => {
      const el = getElement(id);
      el.classList.remove('is-scrolling');
      el.style.removeProperty('--scroll-distance');
      el.style.removeProperty('--scroll-duration');
    });

  // The *last* subpage/top-level page of a cycle skips the normal per-page cleanup
  // clearPage() does for every other page (it goes straight to endSequence() instead),
  // so its progress bar and on-screen position are never reset -- do it explicitly.
  resetProgressBar();
  if (pageOrder) {
    for (const page of pageOrder) {
      for (const subpage of page.subpages) {
        const el = getElement(subpage.name);
        el.style.transitionDelay = '0s';
        el.style.left = '-101%';
      }
    }
  }
  // current-page is the one exception to the left-based sliding every other subpage
  // uses: it's revealed via TOP (see executePage()'s pageIndex===0/subPageIndex===0
  // special case and setInitialPositionCurrentPage()), and its default/off-screen top
  // is never reset back by anything once shown. setInitialPositionCurrentPage() always
  // pre-sets its LEFT early in every cycle (by design, so there's no visible pop-in once
  // the greeting clears) -- but with a stale top:0px surviving from the previous cycle,
  // that combination makes current-page fully visible (both left AND top already 0)
  // from the very start of the greeting phase, instead of only once its turn comes up.
  getElement('current-page').style.top = '100%';

  // These containers are appendChild()-ed into every cycle with no clearing first --
  // left alone, logos/timeline labels/progress segments duplicate on every loop.
  getElement('logo-stack').innerHTML = '';
  getElement('timeline-event-container').innerHTML = '';
  getElement('progress-stack').innerHTML = '';

  // Leaflet has no map-teardown of its own, and calling L.map() again on a container
  // that already has a map bound to it throws "Map container is already initialized."
  // No-ops for the direct-nws iframe provider (no .map property) and for a cycle that
  // never created a zoomed-radar map.
  Weather.radarImage?.map?.remove?.();
  Weather.zoomedRadarImage?.map?.remove?.();

  // Same problem, same fix, for the hourly forecast chart: Chart.js throws "Canvas is
  // already in use" if a new Chart is created on a canvas an old instance still owns.
  destroyHourlyForecastChart();
}

// Restarts the whole fetch -> schedule -> play pipeline in place, without navigating
// away, so the page's original user-activation (and therefore autoplay permission)
// is never lost. This is the loop-enabled replacement for the old reloadPage().
function restartSequence(){
  resetForNewCycle();
  CONFIG.run();
}

function loadInfoBar(){
  getElement("infobar-local-logo").classList.add("shown");
  getElement("infobar-location-container").classList.add("shown");
  getElement("infobar-time-container").classList.add("shown");
}

function setClockTime(){
  var currentTime = new Date();
  var diem = " AM";
  var h = currentTime.getHours();
  var m = currentTime.getMinutes();

  if(h == 0){
    h = 12;
  }
  else if(h > 11){
    diem = " PM";
    if(h > 12){
     h = h - 12
    }
  }
  if(m < 10){
    m = "0" + m;
  }

  var finalString = h + ":" + m + diem;
  getElement("infobar-time-text").innerHTML = finalString;

  // Refresh clock every 5 seconds
  setTimeout(setClockTime, 5000);
}

/* Used to linearly animate a numeric value. In contex, the temperature and
   other current conditions at beginning are animated this way */
function animateValue(id, start, end, duration, pad) {
  var obj = getElement(id);
  if(start == end){
    obj.innerHTML = end;
    return;
  }
  var range = end - start;
  var current = start;
  var increment = end > start? 1 : -1;
  var stepTime = Math.abs(Math.floor(duration / range));
  var timer = setInterval(function() {
      current += increment;
      obj.innerHTML = current.pad(pad);
      if (current == end) {
          clearInterval(timer);
      }
  }, stepTime);
}

// TF Completely rewritten function to utilize the new thermometer style
// fill gauge that utilizes both color and animated fill amount to show the temperature
// just like the real broadcast.
function animateDialFill(id, temperature,duration) {
// Animates the color and fill of the circular thermometer.
// Default temperature normalization is in tMin and tMax
  const tMin=-20, tMax=120;
  const tRange=tMax-tMin;

  const svgbox= getElement(id);
  const cir_therm = svgbox.getElementById('circle-thermometer');
  const cir_text = svgbox.getElementById('cc-temperature-text');
  const thermMin = +cir_therm.dataset.start;
  const thermMax = +cir_therm.dataset.end;

  // Make sure passed temperature is within the allowed range.
  let tgtTemp;
  if(temperature>tMax) {
    tgtTemp=tMax;
  } else if(temperature<tMin) {
    tgtTemp=tMin;
  } else {
    tgtTemp=temperature;
  }

  // Calculate ending strokeDashOffset for the animation
  const fillPct = ((tgtTemp - tMin) / tRange);
  const CirSDOEnd = (thermMax - thermMin) * fillPct + thermMin;

  // Use the animate action to animate the thermometer fill.
  cir_therm.animate([
    {
      strokeDashoffset: thermMin,
      stroke: getTemperatureColor(tMin),
    },
    {
      strokeDashoffset: CirSDOEnd,
      stroke: getTemperatureColor(tgtTemp),
    },
  ],{
    duration: (duration*fillPct),
    easing: 'cubic-bezier(0.57,-0.04, 0.41, 1.13)',
    fill: "forwards",
  })

  // Use a Javascript based animation for the numeric temp. display.
  const range = tgtTemp-tMin; // Get the range
  const timeStart = Date.now();
  const cntDuration= (duration*fillPct);

  const loop = () => {
    let elaps = Date.now() - timeStart;
    if (elaps > cntDuration) elaps = cntDuration; // Stop the loop
    const cntBias = (elaps / cntDuration) * range; // Calculate the value offset from start
    const curr = tMin + cntBias; // Add the offset value to the start value
    cir_text.textContent = Math.trunc(curr); // Apply to UI as integer
    if (elaps < cntDuration) requestAnimationFrame(loop); // Loop
  };

    requestAnimationFrame(loop); // Start the loop!

} ;

    Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

// Used for the beginning dial in order to map warmer
// temperatures to warmer colors and vice versa.
function getTemperatureColor(temperature){
  if(temperature < -20){
    return 'rgb(0, 0, 255)';
  }
  else if(temperature > 100){
    return 'rgb(201, 42, 42)';
  }

  var calculatedColor = [0, 0, 0]
  if(temperature < 40){
    var percent = (temperature + 20)/60
    calculatedColor = interpolateColor([24, 100, 171], [77, 171, 247], percent)
  }
  else if(temperature < 60){
    var percent = (temperature - 40)/20
    calculatedColor = interpolateColor([77, 171, 247], [255, 212, 59], percent)
  }
  else if(temperature < 80){
    var percent = (temperature - 60)/20
    calculatedColor = interpolateColor([255, 212, 59], [247, 103, 7], percent)
  }
  else{
    var percent = (temperature - 80)/20
    calculatedColor = interpolateColor([247, 103, 7], [201, 42, 42], percent)
  }
  return 'rgb(' + calculatedColor[0] + ', ' + calculatedColor[1] + ', ' + calculatedColor[2] + ')'
}

var interpolateColor = function(color1, color2, factor) {
  if (arguments.length < 3) { factor = 0.5; }
  var result = color1.slice();
  for (var i=0;i<3;i++) {
    result[i] = Math.round(result[i] + factor*(color2[i]-color1[i]));
  }
  return result;
};

const baseSize = {
    w: 1920,
    h: 1080
}

window.onresize = resizeWindow;
function resizeWindow(){
  var ww = window.innerWidth;
  var wh = window.innerHeight;
  var newScale = 1;

  // compare ratios
  if(ww/wh < baseSize.w/baseSize.h) { // tall ratio
      newScale = ww / baseSize.w;
  } else { // wide ratio
      newScale = wh / baseSize.h;
  }

  getElement('render-frame').style.transform = 'scale(' + newScale + ',' +  newScale + ')';
}

globalThis.getElement = function(id){
  return document.getElementById(id);
}

function showCrawl(){
  // only show crawl bar if it contains text
  if (CONFIG.crawl.length > 0){
    getElement('crawler-container').classList.add("shown");
    setTimeout(startCrawl, 400); // wait for the settings to fully animate out before starting
  }
}

function hideCrawl(){
  getElement('crawler-container').classList.add("hidden");
}

function startCrawl(){
  calculateCrawlSpeed();
  getElement('crawl-text').classList.add('animate');
}

function calculateCrawlSpeed() {
  var crawlTextElement = getElement('crawl-text');

  // Get the length of the crawl
  var elementLength = crawlTextElement.innerHTML.length;
  var timeTaken;
  // We basically have 3 speed cases to solve for: casual (10 chars/s), fast (20 chars/s), and then anything between.
  // To handle low lengths correctly, we need to add in the ~70 chars worth of length of the crawl box, otherwise short strings fly by too quickly.

  // Handle the low end case
  if (elementLength < ( crawlScreenTime*crawlSpeedCasual) - crawlSpace ){
    timeTaken = (elementLength + crawlSpace) / crawlSpeedCasual;
  }

  // Handle the high end case. This calc will result in animations longer than screen time, which will cut off the end of long messages, which I find preferable to long messages flying by too fast to read. 
  else if (elementLength > (crawlScreenTime*crawlSpeedFast)){
    timeTaken = elementLength / crawlSpeedFast;
  }

  // Handle the in-between case. Pin the animation time to screentime and let the chars/sec float between the casual and fast limits.
  else {
    timeTaken = crawlScreenTime;
  }
  crawlTextElement.style.animationDuration = timeTaken + "s";
}

function showLoopMessage(){
  var loopStatus = ((CONFIG.loop) ? 'enabled' : 'disabled');
  alert("Looping " + loopStatus + ", click NWS logo to toggle");
}

function hideAlertMessage(){
  getElement('alert-message').classList.remove('shown');
}

function alert(message){
  getElement('alert-message').innerHTML = message;
  getElement('alert-message').classList.add('shown');
  setTimeout(hideAlertMessage, 2000);
}
