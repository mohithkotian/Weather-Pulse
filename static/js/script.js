// script.js
// Expects your Flask endpoint at: /weather?city=CityName

// === WEATHER NOTIFICATION SYSTEM ===
let currentAlerts = [];
let hasNewAlerts = false;

// Check if it's daytime or nighttime based on local time
function isDaytime() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18; // Daytime: 6 AM to 6 PM
}

// Map OpenWeather conditions to custom icons with automatic day/night switching
function getCustomIcon(description, iconCode) {
  const desc = description.toLowerCase();
  // Use iconCode if available, otherwise use local time
  const isNight = iconCode ? iconCode.includes('n') : !isDaytime();
  
  // Check for specific conditions
  if (desc.includes('clear')) {
    return isNight ? '/static/images/night.png' : '/static/images/sun.png';
  }
  if (desc.includes('cloud') && (desc.includes('few') || desc.includes('scattered') || desc.includes('partly'))) {
    return isNight ? '/static/images/night-cloud.png' : '/static/images/party-cloudy-day.png';
  }
  if (desc.includes('cloud') || desc.includes('overcast')) {
    return '/static/images/cloudy.png';
  }
  if (desc.includes('rain') || desc.includes('drizzle')) {
    return '/static/images/raining.png';
  }
  if (desc.includes('thunder') || desc.includes('storm')) {
    return '/static/images/strom.png';
  }
  if (desc.includes('snow') || desc.includes('sleet')) {
    return '/static/images/snowy.png';
  }
  if (desc.includes('mist') || desc.includes('fog') || desc.includes('haze')) {
    return '/static/images/fog.png';
  }
  if (desc.includes('wind')) {
    return '/static/images/windy.png';
  }
  
  // Default fallback
  return '/static/images/cloudy.png';
}

const $ = id => document.getElementById(id);
const searchBtn = document.getElementById('searchBtn');
const cityInput = document.getElementById('cityInput');
const dateEl = document.getElementById('date');

function formatDate(d=new Date()){
  return d.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'});
}
dateEl.textContent = formatDate();

// Charts global refs
let tempChart = null;
let precipChart = null;

// Leaflet map
let map = null;
let marker = null;
function createMap(){
  if(map) return;
  map = L.map('map', {zoomControl: false}).setView([20,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);
}

createMap();

async function fetchWeather(city){
  if(!city) return;
  const url = `/weather?city=${encodeURIComponent(city)}`;
  try{
    const res = await fetch(url);
    if(!res.ok) {
      // Try to get error message from response
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.error || `Location not found (HTTP ${res.status})`;
      throw new Error(errorMsg);
    }
    const data = await res.json();
    return data;
  }catch(err){
    console.error(err);
    alert(err.message || 'Could not fetch weather — check backend and city name.');
    throw err;
  }
}

function renderCurrent(data){
  // Date information
  const now = new Date();
  const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
  const fullDate = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  
  $('dayName').textContent = dayName;
  $('fullDate').textContent = fullDate;
  
  // Location badge - use country from API response
  const country = data.country || 'Unknown';
  $('countryName').textContent = country;
  
  // Temperature and conditions
  $('desc').textContent = data.desc || '--';
  $('tempBig').textContent = (Math.round(data.temp)) + '°C';
  $('high').textContent = (data.high !== undefined ? data.high+'°' : '--');
  $('low').textContent = (data.low !== undefined ? data.low+'°' : '--');

  $('humidity').textContent = (data.humidity !== undefined ? data.humidity + '%' : '--');
  $('wind').textContent = (data.wind !== undefined ? `${data.wind} m/s` : '--');
  
  // Sunrise/Sunset
  $('sunrise').textContent = data.sunrise || '--:--';
  $('sunset').textContent = data.sunset || '--:--';

  // Use custom icon - properly sized, no stretching
  const iconEl = $('conditionIcon');
  const customIconPath = getCustomIcon(data.desc || '', data.icon);
  iconEl.src = customIconPath;
  iconEl.alt = data.desc || 'Weather';
  
  // Add weather-based background animation
  applyWeatherAnimation(data.desc || '');
}

function applyWeatherAnimation(description) {
  const desc = description.toLowerCase();
  const mainEl = document.querySelector('.main');
  
  // Remove existing animation classes
  mainEl.classList.remove('weather-sunny', 'weather-rainy', 'weather-snowy', 'weather-cloudy', 'weather-stormy');
  
  // Apply appropriate animation
  if (desc.includes('clear') || desc.includes('sunny')) {
    mainEl.classList.add('weather-sunny');
  } else if (desc.includes('rain') || desc.includes('drizzle')) {
    mainEl.classList.add('weather-rainy');
  } else if (desc.includes('snow')) {
    mainEl.classList.add('weather-snowy');
  } else if (desc.includes('thunder') || desc.includes('storm')) {
    mainEl.classList.add('weather-stormy');
  } else if (desc.includes('cloud')) {
    mainEl.classList.add('weather-cloudy');
  }
}

function renderForecast(list){
  const container = $('forecastList');
  container.innerHTML = '';
  if(!list || !list.length) {
    container.innerHTML = '<div class="no-alert">No forecast</div>';
    return;
  }
  list.forEach(item=>{
    const el = document.createElement('div');
    el.className = 'forecast-item';
    const customIcon = getCustomIcon(item.condition || '', item.icon);
    el.innerHTML = `<div class="day">${item.day}</div>
                    <div class="icon"><img src="${customIcon}" alt="${item.condition}" style="width:40px;height:40px;object-fit:contain"></div>
                    <div class="temp">${Math.round(item.temp)}°C</div>
                    <div class="cond" style="color:var(--muted);font-size:12px">${item.condition||''}</div>`;
    container.appendChild(el);
  });
}

function renderRegions(regions){
  const container = $('regionsTable');
  container.innerHTML = '';
  if(!regions || !regions.length) {
    container.innerHTML = '<div style="color:var(--muted)">No regional data</div>';
    return;
  }
  const list = document.createElement('div');
  list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px';
  regions.forEach(r=>{
    const row = document.createElement('div');
    row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
    row.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><div style="width:10px;height:10px;border-radius:50%;background:${pickColor(r.temp)}"></div><div style="font-weight:600">${r.region}</div></div>
                     <div style="color:var(--muted)">${Math.round(r.temp)}°C</div>`;
    list.appendChild(row);
  });
  container.appendChild(list);
}

function pickColor(temp){
  // simple color scale
  if(temp >= 30) return '#ff6b6b';
  if(temp >= 20) return '#ffcc66';
  if(temp >= 10) return '#66c2ff';
  return '#8fbfff';
}

function renderAlerts(alerts){
  const container = $('alertsList');
  container.innerHTML = '';
  if(!alerts || !alerts.length){
    container.innerHTML = '<div class="no-alert">No alerts</div>';
    return;
  }
  alerts.forEach(a=>{
    const el = document.createElement('div');
    el.style.marginBottom = '10px';
    el.innerHTML = `<div style="font-weight:700">${a.alert}</div><div style="color:var(--muted)">Day: ${a.day} • Temp: ${a.temp}°C</div>`;
    container.appendChild(el);
  });
}

// Charts
function drawTempChart(hourly){
  const ctx = document.getElementById('tempChart').getContext('2d');
  const labels = hourly.map(h=>h.time);
  const data = hourly.map(h=>h.temp);

  if(tempChart) tempChart.destroy();
  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temperature',
        data,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        borderColor: '#4f9df8',
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0,0,0,140);
          gradient.addColorStop(0, 'rgba(79,157,248,0.18)');
          gradient.addColorStop(1, 'rgba(79,157,248,0.02)');
          return gradient;
        }
      }]
    },
    options: {
      plugins:{legend:{display:false}},
      scales: {
        y: { ticks:{color:'#6c7b8f'}},
        x: { ticks:{color:'#6c7b8f'} }
      }
    }
  });
}

function drawPrecipChart(forecast){
  const ctx = document.getElementById('precipChart').getContext('2d');
  const labels = forecast.map(f=>f.day);
  const data = forecast.map(f=> Math.round(f.precip || 0));
  if(precipChart) precipChart.destroy();
  precipChart = new Chart(ctx, {
    type:'bar',
    data: {
      labels,
      datasets: [{
        label: 'Precipitation %',
        data,
        backgroundColor: data.map(v=>'rgba(79,157,248,0.85)'),
        borderRadius:6
      }]
    },
    options:{
      plugins:{legend:{display:false}},
      scales:{ y:{ beginAtZero:true, max:100, ticks:{color:'#6c7b8f'} }, x:{ ticks:{color:'#6c7b8f'} } }
    }
  });
}

function updateMap(coord, cityLabel, temp){
  if(!map) createMap();
  const lat = coord.lat || coord[1] || 0;
  const lon = coord.lon || coord[0] || 0;
  map.setView([lat, lon], 10);
  if(marker) marker.remove();
  marker = L.marker([lat, lon]).addTo(map).bindPopup(`${cityLabel} • ${Math.round(temp)}°C`).openPopup();
}

// main render
async function renderCity(city){
  try{
    const data = await fetchWeather(city);
    renderCurrent(data);
    renderForecast(data.forecast || []);
    renderRegions(data.regions || []);
    renderAlerts(data.alerts || []);
    // Update notification bell with alerts
    updateNotificationBell(data.alerts || []);
    drawPrecipChart(data.forecast || []);
    // hourly for trend: try hourly then fallback to forecast temps
    const hourly = data.hourly && data.hourly.length ? data.hourly : (data.forecast || []).slice(0,8).map((f,idx)=>({time:f.day, temp:f.temp}));
    drawTempChart(hourly);
    if(data.coord) updateMap(data.coord, data.city, data.temp);
  }catch(e){
    console.error(e);
  }
}

// events
searchBtn.addEventListener('click', ()=> {
  const q = cityInput.value.trim();
  if(!q) return;
  renderCity(q);
});
cityInput.addEventListener('keydown', (ev)=> {
  if(ev.key === 'Enter') searchBtn.click();
});

// VIEW MANAGEMENT
let currentView = 'dashboard';
const savedCities = JSON.parse(localStorage.getItem('savedCities') || '["London", "New York", "Tokyo"]');
const settings = JSON.parse(localStorage.getItem('weatherSettings') || '{"tempUnit":"C","theme":"light","notifications":false,"dailyForecast":false}');

function switchView(viewName) {
  // Hide all views
  document.querySelectorAll('.view-section').forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById('date').parentElement.parentElement.style.display = 'none';
  
  // Remove active class from all buttons
  document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected view
  currentView = viewName;
  if (viewName === 'dashboard') {
    document.querySelector('.grid').style.display = 'grid';
    document.getElementById('date').parentElement.parentElement.style.display = 'flex';
  } else {
    document.querySelector('.grid').style.display = 'none';
    const viewId = viewName + 'View';
    const viewElement = document.getElementById(viewId);
    if (viewElement) {
      viewElement.style.display = 'block';
    }
  }
  
  // Set active button
  const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Load view-specific data
  loadViewData(viewName);
}

function loadViewData(viewName) {
  const city = cityInput.value.trim() || 'London';
  
  switch(viewName) {
    case 'analytics':
      loadAnalytics(city);
      break;
    case 'map':
      loadInteractiveMap();
      break;
    case 'alerts':
      loadDetailedAlerts(city);
      break;
    case 'planner':
      loadPlanner(city);
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

// ANALYTICS VIEW
let tempVarChart = null;
let rainfallChartObj = null;

async function loadAnalytics(city) {
  const data = await fetchWeather(city);
  
  // Temperature variation chart
  const forecast = data.forecast || [];
  const ctx1 = document.getElementById('tempVariationChart').getContext('2d');
  if (tempVarChart) tempVarChart.destroy();
  
  tempVarChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: forecast.map(f => f.day),
      datasets: [{
        label: 'Max Temp',
        data: forecast.map(f => f.temp),
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255,107,107,0.1)',
        tension: 0.4
      }, {
        label: 'Min Temp',
        data: forecast.map(f => (f.temp - 5)), // Simulated min temp
        borderColor: '#4f9df8',
        backgroundColor: 'rgba(79,157,248,0.1)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } }
    }
  });
  
  // Rainfall chart
  const ctx2 = document.getElementById('rainfallChart').getContext('2d');
  if (rainfallChartObj) rainfallChartObj.destroy();
  
  rainfallChartObj = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: forecast.map(f => f.day),
      datasets: [{
        label: 'Precipitation %',
        data: forecast.map(f => f.precip || Math.random() * 80),
        backgroundColor: 'rgba(79,157,248,0.7)',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
  
  // AQI and UV (simulated data)
  document.querySelector('.aqi-value').textContent = Math.floor(Math.random() * 150);
  document.querySelector('.aqi-label').textContent = ['Good', 'Moderate', 'Unhealthy'][Math.floor(Math.random() * 3)];
  document.querySelector('.uv-value').textContent = Math.floor(Math.random() * 11);
  document.querySelector('.uv-label').textContent = ['Low', 'Moderate', 'High', 'Very High'][Math.floor(Math.random() * 4)];
}

// INTERACTIVE MAP VIEW
let interactiveMap = null;
let mapMarkers = [];

function loadInteractiveMap() {
  if (!interactiveMap) {
    interactiveMap = L.map('interactiveMap').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(interactiveMap);
  }
  
  setTimeout(() => interactiveMap.invalidateSize(), 100);
  
  // Add saved locations to map
  savedCities.forEach(async city => {
    try {
      const data = await fetchWeather(city);
      if (data.coord) {
        const marker = L.marker([data.coord.lat, data.coord.lon])
          .addTo(interactiveMap)
          .bindPopup(`<b>${city}</b><br>${Math.round(data.temp)}°C<br>${data.desc}`);
        mapMarkers.push(marker);
      }
    } catch(e) {
      console.error('Failed to load city:', city);
    }
  });
  
  renderSavedLocations();
}

function renderSavedLocations() {
  const container = document.getElementById('savedLocationsList');
  container.innerHTML = savedCities.map(city => 
    `<div class="saved-location-item">
      <span>${city}</span>
      <button onclick="removeCity('${city}')" class="remove-btn">×</button>
    </div>`
  ).join('');
}

// ALERTS VIEW
async function loadDetailedAlerts(city) {
  const data = await fetchWeather(city);
  const container = document.getElementById('activeAlerts');
  
  const alerts = data.alerts || [];
  if (!alerts.length) {
    container.innerHTML = '<div class="no-alert">No active weather alerts for ' + city + '</div>';
    return;
  }
  
  container.innerHTML = alerts.map(alert => `
    <div class="alert-item ${alert.severity || 'moderate'}">
      <div class="alert-title">${alert.alert}</div>
      <div class="alert-details">
        <span>Day: ${alert.day}</span>
        <span>Temp: ${alert.temp}°C</span>
      </div>
    </div>
  `).join('');
}

// PLANNER VIEW
async function loadPlanner(city) {
  const data = await fetchWeather(city);
  const forecast = data.forecast || [];
  
  const container = document.getElementById('detailedForecast');
  container.innerHTML = forecast.map(day => {
    const customIcon = getCustomIcon(day.condition || '', day.icon);
    return `
      <div class="forecast-detail-item">
        <div class="forecast-day">${day.day}</div>
        <img src="${customIcon}" alt="${day.condition}" class="forecast-icon">
        <div class="forecast-temp">${Math.round(day.temp)}°C</div>
        <div class="forecast-condition">${day.condition}</div>
        <div class="forecast-precip">Rain: ${Math.round(day.precip || 0)}%</div>
      </div>
    `;
  }).join('');
  
  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('eventDate').min = today;
}

document.getElementById('checkWeatherBtn')?.addEventListener('click', async () => {
  const dateInput = document.getElementById('eventDate').value;
  if (!dateInput) {
    alert('Please select a date');
    return;
  }
  
  const selectedDate = new Date(dateInput);
  const today = new Date();
  const daysAhead = Math.floor((selectedDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysAhead < 0 || daysAhead > 7) {
    document.getElementById('eventWeather').innerHTML = 
      '<div class="event-result error">Please select a date within the next 7 days</div>';
    return;
  }
  
  const city = cityInput.value.trim() || 'London';
  const data = await fetchWeather(city);
  const dayForecast = data.forecast[daysAhead];
  
  if (dayForecast) {
    const recommendation = dayForecast.precip < 30 ? 'Great day for outdoor activities!' : 
                          dayForecast.precip < 60 ? 'Might want to have a backup plan' : 
                          'Indoor activities recommended';
    
    document.getElementById('eventWeather').innerHTML = `
      <div class="event-result">
        <h4>${dayForecast.day}</h4>
        <p><strong>Temperature:</strong> ${Math.round(dayForecast.temp)}°C</p>
        <p><strong>Condition:</strong> ${dayForecast.condition}</p>
        <p><strong>Precipitation:</strong> ${Math.round(dayForecast.precip || 0)}%</p>
        <p class="recommendation">${recommendation}</p>
      </div>
    `;
  }
});

// SETTINGS VIEW
function loadSettings() {
  document.querySelector(`input[name="tempUnit"][value="${settings.tempUnit}"]`).checked = true;
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
  document.getElementById('enableNotifications').checked = settings.notifications;
  document.getElementById('enableDailyForecast').checked = settings.dailyForecast;
  
  renderCitiesList();
  
  // Apply theme
  document.body.setAttribute('data-theme', settings.theme);
}

function renderCitiesList() {
  const container = document.getElementById('citiesList');
  container.innerHTML = savedCities.map(city => 
    `<div class="city-item">
      <span>${city}</span>
      <button onclick="removeCityFromSettings('${city}')" class="remove-city-btn">Remove</button>
    </div>`
  ).join('');
}

function removeCityFromSettings(city) {
  const index = savedCities.indexOf(city);
  if (index > -1) {
    savedCities.splice(index, 1);
    localStorage.setItem('savedCities', JSON.stringify(savedCities));
    renderCitiesList();
  }
}

window.removeCity = removeCityFromSettings;

document.getElementById('addCityBtn')?.addEventListener('click', () => {
  const city = document.getElementById('addCityInput').value.trim();
  if (city && !savedCities.includes(city)) {
    savedCities.push(city);
    localStorage.setItem('savedCities', JSON.stringify(savedCities));
    document.getElementById('addCityInput').value = '';
    renderCitiesList();
  }
});

// Save settings on change
document.querySelectorAll('input[name="tempUnit"]').forEach(input => {
  input.addEventListener('change', (e) => {
    settings.tempUnit = e.target.value;
    localStorage.setItem('weatherSettings', JSON.stringify(settings));
  });
});

document.querySelectorAll('input[name="theme"]').forEach(input => {
  input.addEventListener('change', (e) => {
    settings.theme = e.target.value;
    localStorage.setItem('weatherSettings', JSON.stringify(settings));
    document.body.setAttribute('data-theme', settings.theme);
  });
});

document.getElementById('enableNotifications')?.addEventListener('change', (e) => {
  settings.notifications = e.target.checked;
  localStorage.setItem('weatherSettings', JSON.stringify(settings));
});

document.getElementById('enableDailyForecast')?.addEventListener('change', (e) => {
  settings.dailyForecast = e.target.checked;
  localStorage.setItem('weatherSettings', JSON.stringify(settings));
});

// Navigation event listeners
document.querySelectorAll('.icon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.getAttribute('data-view');
    if (view) switchView(view);
  });
});

// === WEATHER NOTIFICATION SYSTEM FUNCTIONS ===

// Get icon for alert type
function getAlertIcon(event) {
  const eventLower = event.toLowerCase();
  if (eventLower.includes('thunder') || eventLower.includes('storm')) {
    return '/static/images/strom.png';
  }
  if (eventLower.includes('rain')) {
    return '/static/images/raining.png';
  }
  if (eventLower.includes('snow')) {
    return '/static/images/snowy.png';
  }
  if (eventLower.includes('wind')) {
    return '/static/images/windy.png';
  }
  if (eventLower.includes('fog') || eventLower.includes('mist')) {
    return '/static/images/fog.png';
  }
  if (eventLower.includes('heat') || eventLower.includes('hot')) {
    return '/static/images/sun.png';
  }
  return '/static/images/cloudy.png';
}

// Format timestamp to readable date/time
function formatAlertTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Get severity class
function getAlertSeverity(tags) {
  if (!tags || tags.length === 0) return 'minor';
  const severity = tags[0].toLowerCase();
  if (severity.includes('extreme') || severity.includes('severe')) {
    return 'severe';
  }
  if (severity.includes('moderate')) {
    return 'moderate';
  }
  return 'minor';
}

// Update notification bell
function updateNotificationBell(alerts) {
  const bell = document.getElementById('notificationBell');
  const bellIcon = document.getElementById('bellIcon');
  const badge = document.getElementById('notificationBadge');
  
  const activeAlerts = alerts.filter(alert => {
    const now = Math.floor(Date.now() / 1000);
    return alert.start <= now && alert.end >= now;
  });
  
  if (activeAlerts.length > 0) {
    bellIcon.src = '/static/images/bell-active.svg';
    bell.classList.add('has-alerts');
    badge.style.display = 'block';
    hasNewAlerts = true;
  } else {
    bellIcon.src = '/static/images/bell-deactive.svg';
    bell.classList.remove('has-alerts');
    badge.style.display = 'none';
    hasNewAlerts = false;
  }
  
  currentAlerts = activeAlerts;
  renderAlertDrawer(activeAlerts);
}

// Render alert drawer content
function renderAlertDrawer(alerts) {
  const content = document.getElementById('alertsContent');
  const alertCount = document.getElementById('alertCount');
  const lastUpdated = document.getElementById('lastUpdated');
  
  // Update count
  if (alerts.length > 0) {
    alertCount.textContent = `${alerts.length} Active`;
    alertCount.style.display = 'inline-block';
  } else {
    alertCount.style.display = 'none';
  }
  
  // Update last updated time
  lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  
  // Render alerts or no alerts message
  if (alerts.length === 0) {
    content.innerHTML = `
      <div class="no-alerts-state">
        <img src="/static/images/sun.png" alt="All clear" class="no-alerts-icon">
        <div class="no-alerts-card">
          <div class="no-alerts-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>All Clear!</span>
          </div>
          <p class="no-alerts-text">No active weather alerts for your location.</p>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = alerts.map(alert => `
      <div class="alert-item ${getAlertSeverity(alert.tags)}">
        <img src="${getAlertIcon(alert.event)}" alt="${alert.event}" class="alert-icon">
        <div class="alert-details">
          <div class="alert-title">${alert.event}</div>
          <div class="alert-description">${alert.description}</div>
          <div class="alert-time">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${formatAlertTime(alert.start)} - ${formatAlertTime(alert.end)}</span>
          </div>
          ${alert.sender_name ? `<div class="alert-sender">Source: ${alert.sender_name}</div>` : ''}
        </div>
      </div>
    `).join('');
  }
}

// Toggle drawer visibility
function toggleNotificationDrawer() {
  const drawer = document.getElementById('notificationDrawer');
  const isVisible = drawer.style.display === 'flex';
  
  drawer.style.display = isVisible ? 'none' : 'flex';
  
  // Hide badge when opened
  if (!isVisible) {
    document.getElementById('notificationBadge').style.display = 'none';
  }
}

// Close drawer when clicking outside
document.addEventListener('click', (e) => {
  const drawer = document.getElementById('notificationDrawer');
  const bell = document.getElementById('notificationBell');
  const container = document.querySelector('.notification-bell-container');
  
  if (drawer && drawer.style.display === 'flex') {
    if (!container.contains(e.target)) {
      drawer.style.display = 'none';
    }
  }
});

// Setup notification bell event listener
document.getElementById('notificationBell')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleNotificationDrawer();
});

// initial sample (optional: remove if you want blank on load)
const initialCity = 'London';
renderCity(initialCity);
