// Import parent variables manipulated in this module.
import { pageOrder } from "./MainScript.js";

export function setGreetingPage(){
  document.title = "LocalWX - " + cityName;

  getElement("hello-location-text").innerHTML = cityName + ",";

  // City and Airport names can be long, so rather than truncate the text,
  // reduce the font size instead until the text fits on one line.
  // (Previously compared infobar-time-container's offsetTop to its own offsetHeight,
  // which doesn't actually test whether anything overflows -- comparing a position to
  // a size is coincidental at best, and gave inconsistent results run to run. This
  // checks the row's actual content width against its available width instead, same
  // overflow-detection technique used for the alert/narrative-text auto-scroll.)
  const ibText=getElement("infobar-location-text");
  const ibContainer=getElement("infobar-container");
  ibText.innerHTML = cityName;
  for (let i = 62; i>5; i--) {
    ibText.style.fontSize=i + "px";
    if (ibContainer.scrollWidth <= ibContainer.clientWidth) {
      break;
    }
  }

  getElement("greeting-text").innerHTML = CONFIG.greeting;
  getElement("crawl-text").innerHTML = CONFIG.crawl;

  // "ALERT" badge on the left edge of the crawl bar -- shown exactly when
  // CONFIG.crawl is currently alert text instead of the default crawl (see
  // fetchAlerts() in WeatherFetching.js, which sets CONFIG.crawl from
  // Weather.alertsActive each cycle). css/crawl.css's #crawler-container.has-alert
  // rules both reveal the badge and narrow the scrolling text area to make room for
  // it, so this one class toggle drives both.
  getElement("crawler-container").classList.toggle("has-alert", Weather.alertsActive > 0);
}

export function setTimelineEvents(){
  var eventContainer = getElement('timeline-event-container');
  var progreessBarStack = getElement('progress-stack');
  for(var i = 0; i < pageOrder.length; i++){
    var eventElement = document.createElement("div");
    eventElement.innerHTML = pageOrder[i].name;
    eventElement.classList.add("regular-text");
    eventElement.classList.add("timeline-item");
    eventElement.style.transitionDelay = (i*200).toString() + "ms";
    eventContainer.appendChild(eventElement);

    if(i != 0){
      var progressElement = document.createElement("div");
      progressElement.classList.add("timeline-bar");
      progreessBarStack.appendChild(progressElement);
    }
  }
}

export function setCurrentConditions(){
  getElement('cc-condition').innerHTML = Weather.currentCondition;
  getElement('cc-wind').innerHTML = Weather.windSpeed;
  getElement('cc-gusts').innerHTML = Weather.gusts;
  getElement('cc-feelslike').innerHTML = Weather.feelsLike;
  getElement('cc-pressuretrend').innerHTML = Weather.pressureTrend;
  getElement('ccicon').href.baseVal = 'assets/icons/conditions/' + Weather.currentIcon +'.svg';
}

export function createLogoElements(){
  var alreadyAddedLogos = [];
  for(var p = 0; p < pageOrder.length; p++){
    for (var s = 0; s < pageOrder[p].subpages.length; s++) {
      //for every single sub page
      var currentPage = getPageLogoFileName(pageOrder[p].subpages[s].name);

      if(!alreadyAddedLogos.includes(currentPage)){
        var logo = new Image();
        logo.style.width = '85px';
        logo.style.height = '85px';
        logo.style.marginRight = '20px';
        logo.style.display = 'inline';
        logo.src = 'assets/timeline/' + currentPage;
        getElement('logo-stack').appendChild(logo);
        alreadyAddedLogos.push(currentPage);
      }
    }
  }
}

// This is the individual day stuff (Today, Tomorrow, etc.). The 4 boxes' own header
// text is set from Weather.forecastDayLabel (NWS's own period name, e.g. "Tonight" or
// "Wednesday Night") rather than assumed fixed as Today/Tonight/Tomorrow/Tomorrow-
// Night -- if it's already night out when the forecast is fetched, periods[0] from NWS
// is "Tonight" itself and everything shifts by one, so a fixed label would show the
// wrong period's content under the wrong heading. See fetchForecast() in
// WeatherFetching.js.
export function setForecast(){
  // Store all the needed elements as arrays so that they can be referenced in loops
  var forecastDateElement=
    [getElement("today-narrative-date"),
     getElement("tonight-narrative-date"),
     getElement("tomorrow-narrative-date"),
     getElement("tomorrow-night-narrative-date")];

  var forecastNarrativeElement=
    [getElement("today-narrative-text"),
     getElement("tonight-narrative-text"),
     getElement("tomorrow-narrative-text"),
     getElement("tomorrow-night-narrative-text")];

  var forecastTempElement =
    [getElement("today-forecast-temp"),
     getElement("tonight-forecast-temp"),
     getElement("tomorrow-forecast-temp"),
     getElement("tomorrow-night-forecast-temp")];

  var forecastIconElement =
    [getElement("today-forecast-icon"),
     getElement("tonight-forecast-icon"),
     getElement("tomorrow-forecast-icon"),
     getElement("tomorrow-night-forecast-icon")];

  var forecastPrecipElement =
    [getElement("today-forecast-precip"),
     getElement("tonight-forecast-precip"),
     getElement("tomorrow-forecast-precip"),
     getElement("tomorrow-night-forecast-precip")];

  for (var i = 0; i < 4; i++) {
    forecastDateElement[i].innerHTML = Weather.forecastDayLabel[i];
    forecastNarrativeElement[i].innerHTML = Weather.forecastNarrative[i];
    forecastTempElement[i].innerHTML = Weather.forecastTemp[i];
    forecastPrecipElement[i].innerHTML = Weather.forecastPrecip[i];

    var icon = new Image();
    icon.style.width = '100%';
    icon.style.height = '100%';
    icon.src = 'assets/icons/conditions/' + Weather.forecastIcon[i] +'.svg';
    forecastIconElement[i].innerHTML = '';
    forecastIconElement[i].appendChild(icon);
  }
}

export function setOutlook(){ // Also known as 7day page
    // TF Adjust 7-day start whether using the day or night forecast start. isDay controls.
  var outlookStart;
  if(isDay) {outlookStart = 0} else {outlookStart = 1};
  for (var i = 0; i < 7; i++) {
    var textElement = getElement("day" + i + "-text");
    var highElement = getElement("day" + i + "-high");
    var lowElement = getElement("day" + i + "-low");
    var conditionElement = getElement("day" + i + "-condition");
    var containerElement = getElement("day" + i + "-container");
    var iconElement = getElement("day" + i + "-icon");
    var dayIndex = (new Date().getDay()+ i + outlookStart) % 7;

    var icon = new Image();
    icon.style.width = '100%';
    icon.style.height = '100%';
    icon.src = 'assets/icons/conditions/' + Weather.outlookIcon[i] +'.svg';
    iconElement.innerHTML = '';
    iconElement.appendChild(icon);

    // Set weekends to transparent
    var isWeekend = dayIndex == 0 || dayIndex == 6;
    if(isWeekend){
      containerElement.style.backgroundColor = "transparent"; //weekend
    }
    textElement.innerHTML = WEEKDAY[dayIndex];

    highElement.innerHTML = Weather.outlookHigh[i];
    lowElement.innerHTML = Weather.outlookLow[i];
    conditionElement.innerHTML = Weather.outlookCondition[i];
  }
}

// Populates the almanac-page from Weather.almanac (see computeAlmanac() in
// WeatherFetching.js). a.phases is already sorted soonest-first, so slot 0 isn't
// always "New Moon" etc. -- icon and caption are set dynamically per slot along with
// the date, same as the "current phase" indicator already needed to be.
export function setAlmanac(){
  const a = Weather.almanac;
  if (!a.sunriseToday) return; // not computed yet

  getElement('almanac-sunrise-today').innerHTML = a.sunriseToday;
  getElement('almanac-sunset-today').innerHTML = a.sunsetToday;
  getElement('almanac-sunrise-tomorrow').innerHTML = a.sunriseTomorrow;
  getElement('almanac-sunset-tomorrow').innerHTML = a.sunsetTomorrow;

  getElement('almanac-moon-current-icon').src = 'assets/icons/almanac/' + a.currentPhaseIcon + '.svg';
  getElement('almanac-moon-current-text').innerHTML = a.currentPhaseName;

  a.phases.forEach((p, i) => {
    getElement(`almanac-moon-slot${i}-icon`).src = 'assets/icons/almanac/' + p.icon + '.svg';
    getElement(`almanac-moon-slot${i}-caption`).innerHTML = p.name;
    getElement(`almanac-moon-slot${i}-date`).innerHTML = p.dateText;
  });
}

export function setAlertPage(){
  if(Weather.alerts.length === 0)
    return;

  for(var i = 0; i < Math.min(4, Weather.alerts.length); i++){
    var idName = 'alert' + i;
    getElement(idName).innerHTML = Weather.alerts[i].dispText;
  }
}

/* Because the first page always animates in from bottom, check if
   current page is first and set either left or top to 0px. */
export function setInitialPositionCurrentPage(){
  if(pageOrder[0].subpages[0].name == 'current-page'){
    getElement('current-page').style.left = '0px';
  }
  else{
    getElement('current-page').style.top = '0px';
  }
}

export function getPageLogoFileName(subPageName){
  switch (subPageName) {
    case "dynamic-alerts-page":
      return "8logo.svg";

    case "current-page":
      return "thermometer.svg";

    case "radar-page":
      return "radar1.svg";

    case "zoomed-radar-page":
      return "radar2.svg";

    case "hourly-forecast-page":
      return "hourly.svg";

    case "today-page":
      return "calendar.svg";

    case "tonight-page":
      return "calendar.svg";

    case "tomorrow-page":
      return "calendar.svg";

    case "tomorrow-night-page":
      return "calendar.svg";

    case "7day-page":
      return "week.svg";

    case "almanac-page":
      return "almanac.svg";

    // radar2.svg was originally the "2 Hour Local Radar" page's icon, but that page
    // was removed from every sequence in MainScript.js -- reused here rather than
    // adding a new asset for a slide that's visually the same idea (a Leaflet map
    // over an OSM basemap), just traffic instead of radar.
    case "traffic-page":
      return "radar2.svg";

    // Copied from assets/icons/conditions/fog.svg (not referenced directly -- this
    // function only ever returns bare filenames looked up under assets/timeline/,
    // see createLogoElements() above) -- haze lines read reasonably as "air quality"
    // at a glance, and there's no existing timeline icon left unused to repurpose
    // the way traffic-page reused radar2.svg above.
    case "air-quality-page":
    // Same icon for both -- createLogoElements() above already dedupes by filename
    // (see alreadyAddedLogos there), same as how calendar.svg is shared across
    // today/tonight/tomorrow/tomorrow-night, so this doesn't add a second logo to
    // the strip when both air-quality slides are in the same cycle's rotation.
    case "air-quality-contour-page":
      return "air-quality.svg";
  }
}
