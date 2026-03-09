// The Local on the 8's Emulator
// forked from https://github.com/qconrad/intellistar-emulator and extensively modified.
// for my son Matthew, who loves the weather on the 8's.

// Handle application versioning.
const webAppVersion = "1.2.0";

// import the InformationSetting functions.
import {
  setGreetingPage,setTimelineEvents,setCurrentConditions,createLogoElements,
  setForecast,setOutlook,setAlertPage,setInitialPositionCurrentPage,getPageLogoFileName
} from './InformationSetting.js';

// import the RainViewer Radar Animation Control
import {setRadarAnimation as setRVAnimation} from './RadarLeafletRV.js';

// import the Iowa State Mesonet Animation Control
import {setRadarAnimation as setIEMAnimation} from './RadarLeafletIEM.js';

// import the RainViewer Radar Animation Control
import {setRadarAnimation as setXWAnimation} from './RadarLeafletXW.js';


// Preset timeline sequences 
// For music to finish without looping, sequence needs to match the total duration which is computed and set in XXXXXX_DURATION costant.
// During execution the variable pageDuration is set to the selected sequence total duration so that appropriate music clips can be selected.
const MORNING = [
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000}]},
{name: "Today", subpages: [{name: "today-page", duration: 18000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "tomorrow-page", duration: 18000},{name: "7day-page", duration: 15000}]},]
const MORNING_DURATION = totalDuration(MORNING);

const NIGHT = [
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "tomorrow-page", duration: 18000},{name: "tomorrow-night-page", duration: 18000},{name: "7day-page", duration: 15000}]},]
const NIGHT_DURATION = totalDuration(NIGHT);

const ALERTS_MORNING = [
{name: "Alerts", subpages: [{name: "dynamic-alerts-page", duration: 6000}]},
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000},{name: "zoomed-radar-page", duration: 12000}]},
{name: "Today", subpages: [{name: "today-page", duration: 18000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "7day-page", duration: 15000}]},]
const ALERTS_MORNING_DURATION = totalDuration(ALERTS_MORNING);

const ALERTS_NIGHT = [
{name: "Alerts", subpages: [{name: "dynamic-alerts-page", duration: 6000}]},
{name: "Now", subpages: [{name: "current-page", duration: 13000},{name: "radar-page", duration: 12000},{name: "zoomed-radar-page", duration: 12000}]},
{name: "Tonight", subpages: [{name: "tonight-page", duration: 18000}]},
{name: "Beyond", subpages: [{name: "tomorrow-page", duration: 18000},{name: "7day-page", duration: 15000}]},]
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

var tomorrowName;
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
  // Determine the day name for tomorrow, in case it is needed in the narration.
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1); // add +1 to today's date for tomorrow's date.
  tomorrowName = tomorrowDate.toLocaleDateString(CONFIG.language, { weekday: 'long'});

  setMainBackground();
  resizeWindow();
  setClockTime();
//TF Implement feeding zip code on URL as ?zip=nnnnn or ?airport=aaaa and auto-starting.
  if (urlParams.has('zip')) {
    zipCode=urlParams.get('zip');
    getElement('usertext').value=zipCode;
    CONFIG.run();
  } else if (urlParams.has('airport')) {
    airportCode=urlParams.get('airport').toUpperCase();
    getElement('usertext').value=airportCode;
    CONFIG.run();
  } else {
    openSettingsDialog();
  }
}

function preLoadMusic(){
  const SONG_COUNT = 12;
  var index = Math.floor(Math.random() * SONG_COUNT) + 1;
  music = new Audio("assets/music/" + index + "-" + pageDuration + ".wav");
  speech = new Audio("assets/music/" + index + "-" + pageDuration + ".wav");
  alertmusic= new Audio("assets/music/storm-68.wav");
}

// Called from WeatherFetching after all weather data has been received and processed.
/* Set the timeline page order depending on time of day and if
alerts are present */
export function scheduleTimeline(){
  console.log("Alerts Length=",Weather.alerts.length,"Weather.alertsActive=",Weather.alertsActive);
  if(Weather.alertsActive > 0){
    // Active alerts, decide which sequence based on forecast availability.
    if(isDay) {
      pageOrder = ALERTS_MORNING;
      pageDuration = ALERTS_MORNING_DURATION;
    }else{
      pageOrder = ALERTS_NIGHT;
      pageDuration = ALERTS_NIGHT_DURATION;
    }
  }else {
    // No active weather alerts, decide wich non-alert sequence based on forecast availability.
    if(isDay){
      pageOrder = MORNING;
      pageDuration = MORNING_DURATION;
    }else{
      pageOrder = NIGHT;
      pageDuration = NIGHT_DURATION;
    }
  }
  // At this point pageOrder & pageDuration will be set to exactly one sequence.
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
  createLogoElements();
  setCurrentConditions();
  setTimelineEvents();
  setTimeout(startAnimation, 1000);
}

function setMainBackground(){
  getElement('background-image').style.backgroundImage = 'url(https://picsum.photos/1920/1080/?random';
}

function startAnimation(){
  setInitialPositionCurrentPage();
  //setTimeout(startMusic, 5000)
  getElement('weatherfetch-container').classList.add("hide");
  executeGreetingPage();
  loadAlertVoices();
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
  const cAlertTimePadding=4000;
  var AlertDuration=0;
  const curPageDuration=pageOrder[0].subpages[0].duration;

  if (Weather.alertsActive < 1) {return}; // no active alerts, return no modifications.

  for (let i = 0; i < Weather.alerts.length; i++) { 
    // Only need to compute the actual speaking duration if the alert is narrated,
    // otherwise use the default duration provided in WeatherFetching.
    if (CONFIG.voiceAlertNarration) {
      Weather.alerts[i].URL = await ttsGetSpeech(Weather.alerts[i].speechText,CONFIG.voiceURL,CONFIG.voiceSelect);
      console.log(`AV # ${i}= `+Weather.alerts[i].URL);
      await getAudioDuration(Weather.alerts[i].URL)
      .then(duration => {
          console.log('The duration of the voice is: ' + duration + ' seconds');
          Weather.alerts[i].duration = (duration*1000)+cAlertTimePadding;

      })
      .catch(error => {
          console.error('Error getting audio duration:', error);
      });
    }
    AlertDuration = AlertDuration + Weather.alerts[i].duration;
  }
  console.log(`Total Alert Duration= ${AlertDuration} ms`);
  pageOrder[0].subpages[0].duration = curPageDuration + AlertDuration; // return total alert duration in ms
  voiceAlertDurationCalc = true;
}

function startMusic(){
  if(CONFIG.musicEnabled) {
    music.muted = false;
    music.play();
  }
}


async function speechStartAlert(alertIndex) {
  console.log("Alert narration start. Index: ",alertIndex," Duration=",Weather.alerts[alertIndex].duration);
  // Duck the music for the narration. Either mute or reduce the volume of the background music.
  if(CONFIG.musicMute) {
    alertmusic.muted = true;
  } else {
    alertmusic.volume=0.1;
  }

  speech.src = Weather.alerts[alertIndex].URL;
  speech.play();
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
      music.volume=0.1;
    }
    speech.src = audioURL;
    speech.play();
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
    music.volume=1.0;
  }
  URL.revokeObjectURL(audioURL);  // free up memory after speech has ended.
  
};

function speechEndAlert(audioURL) {
  // Restore the music after the narration has ended. Either unmute or increase the volume of the background music.
  if(CONFIG.musicMute) {
    alertmusic.muted = false;
  } else {
    alertmusic.volume=1.0;
  }
  URL.revokeObjectURL(audioURL);  // free up memory after speech has ended. 
};

function SpeakGreeting() {
  //const speech = new Audio(voiceGreetURL);
  speech.src=voiceGreetURL;
  speech.play();
  speech.onended = () => speechEnd(voiceGreetURL);
}

async function executeGreetingPage(){
  let voiceGreetDuration = 0;
  let voiceGreetOverflow = 0;

  jingle.play();
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
    // Extend the greeting page time if needed to accomidate the greeting duration.
    // voiceGreetOverflow will be > 0 to extend the timing. Otherwise = 0.
    voiceGreetOverflow = voiceGreetDuration - (greetingScreenDelay-5000);
    if(voiceGreetOverflow < 0) {voiceGreetOverflow = 0;}
    if(voiceGreetDuration > 0) {
      setTimeout(SpeakGreeting,4000);
    }
  }

  getElement('background-image').classList.remove("below-screen");
  getElement('content-container').classList.add('shown');
  getElement('infobar-twc-logo').classList.add('shown');
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

  // If alerts are active, make sure the duration calculation has completed
  // prior to trying to schedule the page sequence.
  if(Weather.alertsActive > 0) {
    while (!voiceAlertDurationCalc) {
      console.log("Waiting for voice Alert Duration Calculation Completion..");
      await delay(1000); 
    }
  }
 
  schedulePages();
  loadInfoBar();
  revealTimeline();
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

// Handle the alert transitions. Controls whioch alert is displayed, narration being played
// and the cutover from the alert storm music to the regular music.
function execAlerts(alertIndex) {
  // Check and handle the last alert ending.
  if (alertIndex === Weather.alertsActive) {
    if (CONFIG.musicEnabled) {
      alertmusic.pause();
      music.volume=1.0; // resume the normal background music volume.
      music.play();
    }
  } else {
    // Initial alert setup (correct div is already showing?)
    if (alertIndex === 0) {
      // Start the storm music.
      if(CONFIG.musicEnabled) {
        alertmusic.play();
        alertmusic.loop=true;
      }
    } else {
      // Hide the prior alert to reveal the next alert.
      const alertIDPrev='alert' + (alertIndex-1);
      const alertElement = getElement(alertIDPrev);
      alertElement.classList.add("hidden");
    }
    // If narrations are not disabled, queue up the alert narration.
    if(CONFIG.voiceAlertNarration) {
      speechStartAlert(alertIndex);
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
  if(pageIndex === 0 && subPageIndex == 0){
    currentSubPageElement.style.top = '0px';
  }
  else{
    currentSubPageElement.style.left = '0px';
  }

  var isLastPage = pageIndex >= pageOrder.length-1 //&& subPageIndex >= pageOrder[pageOrder.length-1].subpages.length-1;
//  if(isLastPage)
//TF Allow crawl to last most of the final page duration.
    //setTimeout(hideCrawl, (pageTime - 500));


  if(currentSubPageName == "current-page"){
    speechStart("Currently in our area. "+Weather.currentTemperature+" degrees under "+Weather.currentCondition+" skies.");    
    setTimeout(loadCC, 1000);
    setTimeout(scrollCC, currentSubPageDuration / 2);
    animateDialFill('cc-dial', Weather.currentTemperature, 5000);
  }
  else if(currentSubPageName == 'radar-page'){
    startRadar();
    // not spoken in live broadcast speechStart("Here is the Regional Radar.");    
  }
  else if(currentSubPageName == 'zoomed-radar-page'){
    startZoomedRadar();
    // not spoken in live broadcast speechStart("and here is the Local Radar.");    
  }
  else if(currentSubPageName == "today-page"){
    speechStart("today. "+Weather.forecastNarrative[0]);    
  }
  else if(currentSubPageName == "tonight-page"){
    speechStart("tonight. "+Weather.forecastNarrative[1]);    
  }
  else if(currentSubPageName == "tomorrow-page"){
    // The Local on the 8's use the actual name of the day of the week here.
    speechStart(tomorrowName+". "+Weather.forecastNarrative[2]);    
  }
  else if(currentSubPageName == "tomorrow-night-page"){
    speechStart(tomorrowName+" Night. "+Weather.forecastNarrative[3]);    
  }
  else if(currentSubPageName == "7day-page"){
    speechStart("Here is our seven day outlook.");    
  }
  else if(currentSubPageName == "dynamic-alerts-page"){
    execAlerts(0); // Start the alerts sequence at the 1st alert.
  }
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
  // Split decimal into 2 objects so that we can animate them individually.
  var pressureArray = Weather.pressure.toString().split('.');
  animateValue("cc-visibility", 0, Weather.visibility, 800, 1);
  if(CONFIG.units != 'm') {
      getElement("cc-visibility-unit-metric").style.fontSize = "0px";		//Doing the work twice, for good reason: if we simply hide it, the spacing left by the word still exists; if we simply set the size to zero, then it might still be visible at extreme zoom levels.
      getElement("cc-visibility-unit-metric").style.visibility = "hidden";
  } else {
      getElement("cc-visibility-unit-imperial").style.fontSize = "0px";
      getElement("cc-visibility-unit-imperial").style.visibility = "hidden";
  }
  animateValue("cc-humidity", 0, Weather.humidity, 1000, 1);
  animateValue("cc-dewpoint", 0, Weather.dewPoint, 1200, 1);
  if (CONFIG.units === 'e') {		//Imperial units.
    animateValue("cc-pressure1", 0, pressureArray[0], 1400, 1);
    animateValue("cc-pressure2", 0, pressureArray[1], 1400, 2);
    getElement("cc-pressure-metric").style.fontSize = "0px";		//hide the "mbar" tag
    getElement("cc-pressure-metric").style.visibility = "hidden";
  } else {      //Metric units.
      animateValue("cc-pressure1", 800, pressureArray[0], 1400, 3);
      getElement("cc-pressure2").style.visibility = "hidden";		//Hide figures after the decimal, since we don't really use decimal points when using hectopascals in the context of meteorology
      getElement("cc-pressure2").style.fontSize = "0px";
      getElement("cc-pressure-decimal").style.visibility = "hidden";		//And same for the decimal, which would look silly without something after it.
      getElement("cc-pressure-decimal").style.fontSize = "0px";
  }
}

// Called at end of sequence. Animates everything out and shows ending text
function endSequence(){
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
    twcLogoClick();
  }
}

function twcLogoClick() {
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

function clearInfoBar(){
  getElement("infobar-twc-logo").classList.add("hidden");
  getElement("infobar-local-logo").classList.add("hidden");
  getElement("infobar-location-container").classList.add("hidden");
  getElement("infobar-time-container").classList.add("hidden");
  setTimeout(clearElements, 200);
}

// Animates everything out (not including main background)
function clearElements(){
  getElement("outlook-titlebar").classList.add('hidden');
  getElement("forecast-left-container").classList.add('hidden');
  getElement("forecast-right-container").classList.add('hidden');
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

  // Reload the page after animation has completed
  // If looping is enabled, the sequence will start again
  // Otherwise, the zip code prompt will show again
  if (CONFIG.loop) {  
    setTimeout(reloadPage, 400)
  }
}

function reloadPage(){
  location.reload()
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
  alert("Looping " + loopStatus + ", click TWC logo to toggle");
}

function hideAlertMessage(){
  getElement('alert-message').classList.remove('shown');
}

function alert(message){
  getElement('alert-message').innerHTML = message;
  getElement('alert-message').classList.add('shown');
  setTimeout(hideAlertMessage, 2000);
}
