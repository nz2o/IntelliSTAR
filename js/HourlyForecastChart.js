// Renders the 2-day hourly forecast line chart (Temperature, Heat Index/Wind Chill,
// Precipitation Probability, Wind Speed) on hourly-forecast-page, using Chart.js --
// loaded globally via CDN in index.html (same pattern as Leaflet's global `L` used by
// the RadarLeaflet*.js modules), not imported here.

let hourlyChart; // Chart.js instance -- destroyed/recreated each cycle, see
                  // destroyHourlyForecastChart() and resetForNewCycle() in MainScript.js
                  // (same "Canvas is already in use" problem Leaflet has with map re-init).

export function renderHourlyForecastChart() {
  const canvas = getElement('hourly-forecast-chart');
  const isMetric = CONFIG.units === 'm';

  hourlyChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: Weather.hourly.map(h => h.label),
      datasets: [
        {
          label: 'Temperature',
          data: Weather.hourly.map(h => h.temp),
          borderColor: '#ff6b35',
          backgroundColor: '#ff6b35',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'yTemp',
        },
        {
          label: 'Heat Index / Wind Chill',
          data: Weather.hourly.map(h => h.feelsLike),
          borderColor: '#ffd166',
          backgroundColor: '#ffd166',
          borderWidth: 3,
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'yTemp',
        },
        {
          label: 'Precipitation Probability',
          data: Weather.hourly.map(h => h.precip),
          borderColor: '#4cc9f0',
          backgroundColor: '#4cc9f0',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'yPercent',
        },
        {
          label: 'Wind Speed',
          data: Weather.hourly.map(h => h.windSpeed),
          borderColor: '#80ed99',
          backgroundColor: '#80ed99',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'yWind',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          ticks: { color: '#fff', autoSkip: true, maxTicksLimit: 16, font: { size: 16 } },
          grid: { color: 'rgba(255,255,255,0.1)' },
        },
        yTemp: {
          position: 'left',
          // Fixed range (not auto-scaled): 0-120°F, or the metric equivalent -20-50°C.
          min: isMetric ? -20 : 0,
          max: isMetric ? 50 : 120,
          ticks: { color: '#fff', font: { size: 16 } },
          grid: { color: 'rgba(255,255,255,0.1)' },
          title: { display: true, text: isMetric ? '°C' : '°F', color: '#fff', font: { size: 16 } },
        },
        yPercent: {
          position: 'right',
          // Fixed range: precipitation probability is always a 0-100% scale.
          min: 0,
          max: 100,
          ticks: { color: '#fff', font: { size: 16 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: '% Precip', color: '#fff', font: { size: 16 } },
        },
        yWind: {
          position: 'right',
          // Fixed range (not auto-scaled): 0-50mph, or the metric equivalent 0-80km/h.
          min: 0,
          max: isMetric ? 80 : 50,
          ticks: { color: '#fff', font: { size: 16 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: isMetric ? 'km/h' : 'mph', color: '#fff', font: { size: 16 } },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#fff', font: { size: 18 }, boxWidth: 30 },
        },
      },
    },
  });
}

export function destroyHourlyForecastChart() {
  hourlyChart?.destroy?.();
  hourlyChart = undefined;
}
