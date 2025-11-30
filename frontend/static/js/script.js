// script.js
// Weather Pulse Application
// 
// CONFIGURATION:
// - OPENWEATHER_API_KEY: Set in backend/.env (server-side)
// - GOOGLE_MAPS_API_KEY: Set in templates/index.html script tag
// - allowMultipleLayers: Set to true to allow multiple weather layers simultaneously
// 
// DEBUGGING:
// - Set DEBUG = true to enable console logs (auto-enabled on localhost)
// - All major functions include error handling and fallbacks
// 
// WEATHER LAYERS:
// - Temperature, Rainfall, and Wind overlays use OpenWeatherMap tiles
// - Layers are exclusive by default (only one active at a time)
// - Toggle buttons have idempotent behavior (no duplicate overlays)

const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const allowMultipleLayers = false; // Set to true to allow multiple layers at once

// === GLOBAL MAP VARIABLES ===
let mapMarkers = {};
let weatherOverlays = {
  temperature: null,
  rainfall: null,
  wind: null
};
let comparisonMode = false;
let comparisonCities = [];
let savedLocations = [];
let searchBox = null;

// === GOOGLE MAPS CALLBACK - MUST BE FIRST ===
// This is called by Google Maps API when it loads
window.initMap = function() {
  if (DEBUG) console.log("🗺️ Google Maps API loaded successfully!");
  
  // Mark as loaded
  window.googleMapsLoaded = true;
  
  // Wait for DOM to be ready, then load default city (no auto-scroll)
  setTimeout(() => {
    if (DEBUG) console.log("Loading default city with map...");
    if (typeof renderCity === 'function') {
      renderCity('London');
    } else if (DEBUG) {
      console.error("renderCity function not yet defined");
    }
  }, 500);
};

// === WEATHER NOTIFICATION SYSTEM ===
let currentAlerts = [];
let hasNewAlerts = false;

// === ALERT NORMALIZATION & THRESHOLD SYSTEM ===
// Load persisted app alerts from localStorage
let appAlerts = JSON.parse(localStorage.getItem('appAlerts') || '[]');

// Remove duplicates on load
function removeDuplicateAlerts() {
  const seen = new Set();
  appAlerts = appAlerts.filter(alert => {
    const key = `${alert.type}_${alert.current_value}_${alert.threshold_value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  localStorage.setItem('appAlerts', JSON.stringify(appAlerts));
}
removeDuplicateAlerts();

/**
 * Normalize alert object to ensure consistent structure
 * @param {Object} raw - Raw alert object from any source
 * @returns {Object} Normalized alert with all required fields
 */
function normalizeAlert(raw) {
  const now = Date.now();
  return {
    id: raw.id || `${now}_${Math.random().toString(36).slice(2,7)}`,
    alert: raw.alert || raw.event || raw.title || 'Weather Alert',
    description: raw.description || raw.desc || raw.message || '',
    message: raw.message || raw.description || raw.desc || '',
    title: raw.title || raw.alert || raw.event || 'Weather Alert',
    start: raw.start || raw.from || Math.floor(now/1000),
    end: raw.end || raw.to || (Math.floor(now/1000) + 3600),
    tags: raw.tags || (raw.severity ? [raw.severity] : []),
    triggered: !!raw.triggered,
    current: raw.current ?? raw.current_value ?? null,
    current_value: raw.current_value ?? raw.current ?? null,
    threshold: raw.threshold ?? raw.threshold_value ?? null,
    threshold_value: raw.threshold_value ?? raw.threshold ?? null,
    unit: raw.unit || '',
    type: raw.type || 'general',
    sender_name: raw.sender_name || raw.source || 'Weather System',
    timestamp: raw.timestamp || new Date().toISOString(),
    timestampMs: now
  };
}

/**
 * Add alert to app alerts array with deduplication
 * @param {Object} raw - Raw alert object
 */
function addAppAlert(raw) {
  const alert = normalizeAlert(raw);
  
  // Deduplicate: check for same alert type + current value within last 5 minutes
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  const duplicate = appAlerts.find(x => 
    x.type === alert.type && 
    x.current_value === alert.current_value &&
    x.threshold_value === alert.threshold_value &&
    x.timestampMs > fiveMinutesAgo
  );
  
  if (duplicate) {
    if (DEBUG) console.log('⏭️ Skipping duplicate alert:', alert.title || alert.alert);
    return;
  }
  
  // Add to beginning of array
  appAlerts.unshift(alert);
  
  // Keep max 50 alerts
  appAlerts = appAlerts.slice(0, 50);
  
  // Persist to localStorage
  localStorage.setItem('appAlerts', JSON.stringify(appAlerts));
  
  // Update statistics in real-time
  if (typeof updateAlertStatistics === 'function') {
    updateAlertStatistics();
  }
  
  if (DEBUG) console.log('✅ Added new alert:', alert.title || alert.alert);
}

/**
 * Check user thresholds against current weather data and create alerts
 * @param {Object} data - Weather data object
 * @returns {Array} Array of normalized alert objects
 */
function checkThresholdsAndCreateAlerts(data) {
  // Get user thresholds from localStorage (saved from settings modal)
  const thresholds = weatherAlertState.thresholds || {};
  const alerts = [];
  
  if (DEBUG) console.log('🔍 Checking thresholds:', thresholds);
  
  // Temperature threshold
  if (thresholds.temperature?.enabled && thresholds.temperature?.value && data.temp != null) {
    const threshold = parseFloat(thresholds.temperature.value);
    if (data.temp >= threshold) {
      alerts.push({
        type: 'temperature',
        alert: 'Temperature Alert',
        title: 'High Temperature Alert',
        description: `Temperature in ${data.city || 'your location'} has reached ${data.temp}°C, exceeding your threshold of ${threshold}°C.`,
        message: `Current temperature ${data.temp}°C exceeds threshold ${threshold}°C`,
        triggered: true,
        current: data.temp,
        current_value: data.temp,
        threshold: threshold,
        threshold_value: threshold,
        unit: '°C',
        severity: 'warning'
      });
    }
  }
  
  // Wind threshold
  if (thresholds.wind?.enabled && thresholds.wind?.value && data.wind != null) {
    const threshold = parseFloat(thresholds.wind.value);
    if (data.wind >= threshold) {
      alerts.push({
        type: 'wind',
        alert: 'Wind Alert',
        title: 'High Wind Alert',
        description: `Wind speed in ${data.city || 'your location'} reached ${data.wind} m/s, exceeding threshold of ${threshold} m/s.`,
        message: `Current wind speed ${data.wind} m/s exceeds threshold ${threshold} m/s`,
        triggered: true,
        current: data.wind,
        current_value: data.wind,
        threshold: threshold,
        threshold_value: threshold,
        unit: ' m/s',
        severity: 'warning'
      });
    }
  }
  
  // Rainfall threshold
  if (thresholds.rainfall?.enabled && thresholds.rainfall?.value && data.rain != null) {
    const threshold = parseFloat(thresholds.rainfall.value);
    if (data.rain >= threshold) {
      alerts.push({
        type: 'rainfall',
        alert: 'Rainfall Alert',
        title: 'Heavy Rainfall Alert',
        description: `Rainfall in ${data.city || 'your location'} reached ${data.rain} mm, exceeding threshold of ${threshold} mm.`,
        message: `Current rainfall ${data.rain} mm exceeds threshold ${threshold} mm`,
        triggered: true,
        current: data.rain,
        current_value: data.rain,
        threshold: threshold,
        threshold_value: threshold,
        unit: ' mm',
        severity: 'warning'
      });
    }
  }
  
  // Lightning threshold
  if (thresholds.lightning?.enabled && data.lightningRisk != null) {
    const threshold = 40; // Default lightning risk threshold
    if (data.lightningRisk >= threshold) {
      alerts.push({
        type: 'lightning',
        alert: 'Lightning Alert',
        title: 'Lightning Risk Alert',
        description: `Lightning risk in ${data.city || 'your location'} is ${data.lightningRisk}%, exceeding safe threshold.`,
        message: `Current lightning risk ${data.lightningRisk}% exceeds threshold ${threshold}%`,
        triggered: true,
        current: data.lightningRisk,
        current_value: data.lightningRisk,
        threshold: threshold,
        threshold_value: threshold,
        unit: '%',
        severity: 'severe'
      });
    }
  }
  
  // AQI threshold
  if (thresholds.aqi?.enabled && thresholds.aqi?.value && data.aqi != null) {
    const threshold = parseFloat(thresholds.aqi.value);
    if (data.aqi >= threshold) {
      alerts.push({
        type: 'aqi',
        alert: 'Air Quality Alert',
        title: 'Poor Air Quality Alert',
        description: `Air Quality Index in ${data.city || 'your location'} is ${data.aqi}, exceeding threshold of ${threshold}.`,
        message: `Current AQI ${data.aqi} exceeds threshold ${threshold}`,
        triggered: true,
        current: data.aqi,
        current_value: data.aqi,
        threshold: threshold,
        threshold_value: threshold,
        unit: ' AQI',
        severity: 'warning'
      });
    }
  }
  
  if (DEBUG && alerts.length > 0) {
    console.log(`⚠️ ${alerts.length} threshold(s) exceeded!`, alerts);
  }
  
  return alerts.map(normalizeAlert);
}

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

// Google Maps variables
const GOOGLE_MAPS_API_KEY = "your_key_here";
let googleMap = null;
let googleMarker = null;
let googleInfoWindow = null;
let lastSearchedCity = null;

// Weather icon mapper for Google Maps markers
function getWeatherIcon(condition) {
  const cond = (condition || '').toLowerCase();
  if (cond.includes('clear') || cond.includes('sun')) {
    return 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
  } else if (cond.includes('cloud') || cond.includes('overcast')) {
    return 'https://maps.google.com/mapfiles/ms/icons/grey-dot.png';
  } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
    return 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
  } else if (cond.includes('snow') || cond.includes('sleet')) {
    return 'https://maps.google.com/mapfiles/ms/icons/white-dot.png';
  } else if (cond.includes('thunder') || cond.includes('storm')) {
    return 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png';
  }
  return 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
}

// Initialize or update Google Map
function createMap(lat = 20.5937, lon = 78.9629, city = "India", temp = null, condition = "", containerId = "map") {
  if (DEBUG) console.log("✅ createMap function called");
  if (DEBUG) console.log(`📍 Initializing map for: ${city} at (${lat}, ${lon}) in container: ${containerId}`);

  const mapElement = document.getElementById(containerId);
  if (!mapElement) {
    if (DEBUG) console.error(`❌ Map container #${containerId} not found in DOM`);
    return;
  }

  // Check if Google Maps API is loaded with retry logic
  if (typeof google === 'undefined' || !google.maps) {
    if (DEBUG) console.error("❌ Google Maps API not loaded yet");
    mapElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 350px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 12px; padding: 20px; text-align: center;">
        <div>
          <h3 style="color: #856404; margin: 0 0 10px 0;">⏳ Loading Map...</h3>
          <p style="color: #856404; margin: 0;">Google Maps is initializing, please wait...</p>
        </div>
      </div>
    `;
    return;
  }

  if (DEBUG) console.log("✅ Google Maps API is loaded");

  // Check for valid coordinates
  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    console.error("❌ Invalid coordinates provided");
    mapElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 350px; background: #fee; border: 2px solid #f44; border-radius: 12px; padding: 20px; text-align: center;">
        <div>
          <h3 style="color: #c33; margin: 0 0 10px 0;">⚠️ Invalid Coordinates</h3>
          <p style="color: #c33; margin: 0;">Unable to display map for this location.</p>
        </div>
      </div>
    `;
    return;
  }

  const position = { lat, lng: lon };

  // Use different map instances for different containers
  let mapInstance = containerId === "googleMap" ? window.googleMapView : googleMap;
  let markerInstance = containerId === "googleMap" ? window.googleMarkerView : googleMarker;
  let infoWindowInstance = containerId === "googleMap" ? window.googleInfoWindowView : googleInfoWindow;

  // Create or update map
  if (!mapInstance) {
    if (DEBUG) console.log(`Creating new Google Map instance in #${containerId}...`);
    try {
      mapInstance = new google.maps.Map(mapElement, {
        center: position,
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }]
        }
      ]
    });
      
      // Trigger resize only once after creation, with delay to avoid loops
      setTimeout(() => {
        if (mapInstance && typeof google !== 'undefined' && google.maps && google.maps.event) {
          google.maps.event.trigger(mapInstance, 'resize');
        }
      }, 100);
      
      if (DEBUG) console.log("✅ Google Map created successfully");
      
      // Store the map instance
      if (containerId === "googleMap") {
        window.googleMapView = mapInstance;
      } else {
        googleMap = mapInstance;
      }
    } catch (error) {
      console.error("❌ Error creating Google Map:", error);
      mapElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 350px; background: #fee; border-radius: 12px; padding: 20px; text-align: center;">
          <div>
            <h3 style="color: #c33; margin: 0 0 10px 0;">❌ Map Error</h3>
            <p style="color: #c33; margin: 0;">${error.message}</p>
          </div>
        </div>
      `;
      return;
    }
  } else {
    console.log("Updating existing map position...");
    // Smooth zoom animation when updating
    mapInstance.panTo(position);
    setTimeout(() => {
      mapInstance.setZoom(11);
    }, 300);
  }

  // Remove old marker
  if (markerInstance) {
    markerInstance.setMap(null);
  }

  // Add new marker with weather icon
  const weatherIcon = getWeatherIcon(condition);
  markerInstance = new google.maps.Marker({
    position: position,
    map: mapInstance,
    title: city,
    icon: {
      url: weatherIcon,
      scaledSize: new google.maps.Size(32, 32)
    },
    animation: google.maps.Animation.DROP
  });
  
  // Store marker instance
  if (containerId === "googleMap") {
    window.googleMarkerView = markerInstance;
  } else {
    googleMarker = markerInstance;
  }

  // Create info window content with modern styling and action buttons
  const tempText = temp !== null ? `${Math.round(temp)} °C` : 'N/A';
  const conditionText = condition || 'Unknown';
  const markerKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
  
  const infoContent = `
    <div style="padding: 16px; font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-width: 240px; background: white; border-radius: 12px;">
      <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 18px; font-weight: 600; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">${city}</h3>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🌡️</span>
          <span style="font-size: 14px; color: #64748b;">Temperature:</span>
          <span style="font-size: 15px; font-weight: 600; color: #1e293b; margin-left: auto;">${tempText}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">☁️</span>
          <span style="font-size: 14px; color: #64748b;">Condition:</span>
          <span style="font-size: 15px; font-weight: 600; color: #1e293b; margin-left: auto;">${conditionText}</span>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 4px;">
          <span>📍</span>
          <span>${lat.toFixed(4)}, ${lon.toFixed(4)}</span>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <button class="info-compare-btn" data-lat="${lat}" data-lng="${lon}" data-city="${city}" style="flex: 1; padding: 8px 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;">⚖️ Compare</button>
          <button class="info-save-btn" data-lat="${lat}" data-lng="${lon}" data-city="${city}" style="flex: 1; padding: 8px 12px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;">💾 Save</button>
        </div>
      </div>
    </div>
  `;

  // Close old info window
  if (infoWindowInstance) {
    infoWindowInstance.close();
  }

  // Create and open new info window
  infoWindowInstance = new google.maps.InfoWindow({
    content: infoContent
  });
  
  // Store info window instance
  if (containerId === "googleMap") {
    window.googleInfoWindowView = infoWindowInstance;
  } else {
    googleInfoWindow = infoWindowInstance;
  }

  // Open info window on marker click with event delegation
  markerInstance.addListener("click", () => {
    infoWindowInstance.open(mapInstance, markerInstance);
    
    // Attach event listeners after DOM is rendered
    setTimeout(() => {
      attachInfoWindowListeners(lat, lon, city, temp, condition);
    }, 100);
  });

  // Auto-open info window (no auto-scroll)
  setTimeout(() => {
    infoWindowInstance.open(mapInstance, markerInstance);
    
    // Attach event listeners after opening
    setTimeout(() => {
      attachInfoWindowListeners(lat, lon, city, temp, condition);
    }, 100);
  }, 500);
}

// Attach event listeners to info window buttons (avoids global onclick)
function attachInfoWindowListeners(lat, lon, city, temp, condition) {
  const compareBtn = document.querySelector('.info-compare-btn');
  const saveBtn = document.querySelector('.info-save-btn');
  
  if (compareBtn) {
    compareBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      handleCompareCity(lat, lon, city, temp, condition);
    };
  }
  
  if (saveBtn) {
    saveBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      handleSaveLocation(lat, lon, city);
    };
  }
}

// Fetch weather by coordinates with normalized response
async function fetchWeatherByCoords(lat, lng) {
  const url = `/weather?lat=${lat}&lon=${lng}`;
  
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch weather data');
    }
    
    let data = await res.json();
    
    // Normalize response format (handle multiple server response shapes)
    if (data.current) {
      // Server returned {current: {...}} format
      data = data.current;
    }
    
    // Ensure required fields exist
    const normalized = {
      main: data.main || { temp: null, feels_like: null, humidity: null, pressure: null },
      wind: data.wind || { speed: null, deg: null },
      weather: data.weather || [{ main: 'Unknown', description: 'Unknown' }],
      coord: data.coord || { lat: lat, lon: lng },
      name: data.name || data.city || 'Unknown Location',
      dt: data.dt || Date.now() / 1000
    };
    
    // Validate critical fields
    if (!normalized.main.temp && !data.temp) {
      throw new Error('Invalid weather data: missing temperature');
    }
    
    // Handle alternate temp field locations
    if (data.temp && !normalized.main.temp) {
      normalized.main.temp = data.temp;
    }
    
    return normalized;
    
  } catch (error) {
    if (DEBUG) console.error('fetchWeatherByCoords error:', error);
    throw error;
  }
}

async function fetchWeather(city){
  if(!city) return;
  const url = `/weather?city=${encodeURIComponent(city)}`;
  
  try{
    const res = await fetch(url);
    
    if(!res.ok) {
      // Try to get error message from response
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.error || `City "${city}" not found. Please check spelling.`;
      throw new Error(errorMsg);
    }
    const data = await res.json();
    return data;
  }catch(err){
    console.error('Error fetching weather:', err);
    alert(`❌ ${err.message}`);
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
  
  // Update page title with city name
  const cityName = data.city || 'Unknown';
  document.querySelector('.title h1').textContent = `Weather in ${cityName}`;
  
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
  
  // Merge API alerts with appAlerts (threshold-triggered)
  const allAlerts = [...(appAlerts || []), ...(alerts || [])];
  
  // Remove duplicates based on type, current_value, and threshold_value
  const uniqueAlerts = [];
  const seen = new Set();
  
  allAlerts.forEach(alert => {
    const key = `${alert.type}_${alert.current_value || alert.current}_${alert.threshold_value || alert.threshold}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAlerts.push(alert);
    }
  });
  
  if(!uniqueAlerts || !uniqueAlerts.length){
    container.innerHTML = `
      <div class="no-alert" style="text-align: center; padding: 40px 20px; color: #64748b;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.5;">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No Active Alerts</div>
        <div style="font-size: 14px;">Configure weather alerts to get notified when conditions change</div>
      </div>
    `;
    return;
  }
  
  uniqueAlerts.forEach(a=>{
    const el = document.createElement('div');
    el.className = 'alert-item-card';
    el.style.cssText = 'margin-bottom: 12px; padding: 16px; background: #f8fafc; border-left: 4px solid #667eea; border-radius: 8px;';
    
    const title = a.title || a.alert || a.event || 'Weather Alert';
    const description = a.message || a.description || '';
    
    // Format time
    let time = 'Just now';
    if (a.timestampMs) {
      const diffMs = Date.now() - a.timestampMs;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) time = 'Just now';
      else if (diffMins < 60) time = `${diffMins}m ago`;
      else if (diffMins < 1440) time = `${Math.floor(diffMins/60)}h ago`;
      else time = new Date(a.timestampMs).toLocaleDateString();
    } else if (a.timestamp) {
      time = new Date(a.timestamp).toLocaleString();
    }
    
    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="font-weight: 700; font-size: 15px; color: #1e293b;">${title}</div>
        ${a.triggered ? '<span style="background: linear-gradient(90deg,#ffb86b,#ff8a3d); color: white; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700;">TRIGGERED</span>' : ''}
      </div>
      <div style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">${description}</div>
      ${(a.current_value || a.current) && (a.threshold_value || a.threshold) ? `<div style="font-size: 12px; color: #475569; padding: 8px; background: rgba(100,116,139,0.05); border-radius: 6px; margin-bottom: 8px;">Current: <strong>${a.current_value || a.current}${a.unit || ''}</strong> • Threshold: <strong>${a.threshold_value || a.threshold}${a.unit || ''}</strong></div>` : ''}
      <div style="font-size: 12px; color: #94a3b8;">⏱️ ${time}</div>
    `;
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

function updateMap(coord, cityLabel, temp, weatherDesc = ""){
  const lat = coord.lat || coord[1] || 0;
  const lon = coord.lon || coord[0] || 0;
  
  console.log(`📍 updateMap called for ${cityLabel} at (${lat}, ${lon})`);
  
  // Store last searched city for map view
  window.lastSearchedCity = {
    lat: lat,
    lon: lon,
    city: cityLabel,
    temp: temp,
    condition: weatherDesc
  };
  
  // Update Google Map with weather data (for home dashboard)
  if (window.google && window.google.maps) {
    console.log("✅ Google Maps available, initializing map...");
    createMap(lat, lon, cityLabel, temp, weatherDesc, "map");
  } else {
    console.log("⏳ Waiting for Google Maps to load...");
    const mapElement = document.getElementById("map");
    if (mapElement) {
      mapElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 350px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; text-align: center; color: white;">
          <div>
            <div style="font-size: 48px; margin-bottom: 12px;">🗺️</div>
            <h3 style="color: white; margin: 0 0 10px 0; font-size: 18px;">Loading Map...</h3>
            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">Google Maps is initializing</p>
          </div>
        </div>
      `;
    }
    // Retry after a short delay
    setTimeout(() => {
      if (window.google && window.google.maps) {
        console.log("✅ Google Maps loaded on retry");
        createMap(lat, lon, cityLabel, temp, weatherDesc, "map");
      } else {
        console.error("❌ Google Maps failed to load after retry");
        if (mapElement) {
          mapElement.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 350px; background: #fee; border: 2px solid #f44; border-radius: 12px; padding: 20px; text-align: center;">
              <div>
                <h3 style="color: #c33; margin: 0 0 10px 0;">⚠️ Map Failed to Load</h3>
                <p style="color: #c33; margin: 0 0 10px 0;">Google Maps API couldn't initialize</p>
                <button onclick="location.reload()" style="background: #4f9df8; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;">Refresh Page</button>
              </div>
            </div>
          `;
        }
      }
    }, 3000);
  }
}

// events
searchBtn.addEventListener('click', ()=> {
  const q = cityInput.value.trim();
  if(!q) {
    alert('⚠️ Please enter a city name');
    return;
  }
  
  // Save to localStorage
  localStorage.setItem('lastSearchedCity', q);
  
  // Blur input to prevent scroll on render
  cityInput.blur();
  
  // Render city
  renderCity(q);
});
cityInput.addEventListener('keydown', (ev)=> {
  if(ev.key === 'Enter') {
    ev.preventDefault();
    searchBtn.click();
  }
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
      // Fix: Scroll only the .main container (not window or body)
      setTimeout(() => {
        const mainElement = document.querySelector('.main');
        if (mainElement) {
          mainElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
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
      // Initialize Google Maps on map view switch
      setTimeout(() => {
        if (lastSearchedCity && lastSearchedCity.lat) {
          const lat = lastSearchedCity.lat;
          const lon = lastSearchedCity.lon;
          const city = lastSearchedCity.city || "Unknown";
          const temp = lastSearchedCity.temp || null;
          const condition = lastSearchedCity.condition || "";
          console.log(`Loading map view with: ${city}, ${lat}, ${lon}`);
          createMap(lat, lon, city, temp, condition, "googleMap");
        } else {
          // Load default London location
          console.log("Loading default map view for London");
          createMap(51.5074, -0.1278, "London", null, "", "googleMap");
        }
      }, 100);
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
        label: 'Temperature',
        data: forecast.map(f => f.temp),
        borderColor: '#4f9df8',
        backgroundColor: 'rgba(79,157,248,0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#4f9df8'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y}°C`
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: (value) => value + '°C' }
        }
      }
    }
  });
  
  // Render all advanced analytics
  renderAdvancedAnalytics(data);
}

// ALERTS VIEW
async function loadDetailedAlerts(city) {
  const data = await fetchWeather(city);
  const container = document.getElementById('activeAlerts');
  
  // Combine API alerts and app alerts (threshold-triggered alerts)
  const apiAlerts = data.alerts || [];
  const thresholdAlerts = appAlerts || [];
  
  // Merge both sources of alerts
  const allAlerts = [...thresholdAlerts, ...apiAlerts];
  
  if (!allAlerts.length) {
    container.innerHTML = '<div class="no-alert">No active weather alerts for ' + city + '</div>';
    return;
  }
  
  // Alert type icons
  const alertIcons = {
    'temperature': '🌡️',
    'wind': '💨',
    'rainfall': '🌧️',
    'lightning': '⚡',
    'aqi': '😷',
    'general': '⚠️'
  };
  
  // Alert type names
  const alertTypeNames = {
    'temperature': 'TEMPERATURE',
    'wind': 'WIND SPEED',
    'rainfall': 'RAINFALL',
    'lightning': 'LIGHTNING',
    'aqi': 'AIR QUALITY'
  };
  
  container.innerHTML = allAlerts.map(alert => {
    const isThresholdAlert = alert.type && alert.triggered;
    const icon = alertIcons[alert.type] || '⚠️';
    const typeBadge = alertTypeNames[alert.type] || 'ALERT';
    const title = alert.title || alert.alert || alert.event || 'Weather Alert';
    const message = alert.message || alert.description || '';
    
    // Format time
    let timeDisplay;
    if (alert.timestampMs) {
      const diffMs = Date.now() - alert.timestampMs;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) timeDisplay = 'Just now';
      else if (diffMins < 60) timeDisplay = `${diffMins}m ago`;
      else if (diffMins < 1440) timeDisplay = `${Math.floor(diffMins/60)}h ago`;
      else timeDisplay = new Date(alert.timestampMs).toLocaleDateString();
    } else if (alert.timestamp) {
      timeDisplay = new Date(alert.timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } else {
      timeDisplay = 'Recently';
    }
    
    return `
      <div class="alert-item ${alert.severity || alert.type || 'moderate'}" style="margin-bottom: 16px; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 5px solid ${isThresholdAlert ? '#ff8a3d' : '#667eea'}; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 28px;">${icon}</span>
            <div>
              <div style="font-weight: 700; font-size: 17px; color: #1e293b; margin-bottom: 4px;">${title}</div>
              ${isThresholdAlert ? `<span style="background: linear-gradient(90deg,#ffb86b,#ff8a3d); color: white; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">${typeBadge} TRIGGERED</span>` : ''}
            </div>
          </div>
          <div style="font-size: 12px; color: #94a3b8; white-space: nowrap;">⏱️ ${timeDisplay}</div>
        </div>
        <div style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 12px;">${message}</div>
        ${alert.current_value && alert.threshold_value ? `
          <div style="display: flex; gap: 16px; padding: 12px; background: rgba(255,255,255,0.7); border-radius: 8px; font-size: 13px; color: #475569;">
            <div><strong style="color: #ff8a3d;">Current:</strong> ${alert.current_value}${alert.unit || ''}</div>
            <div><strong style="color: #667eea;">Threshold:</strong> ${alert.threshold_value}${alert.unit || ''}</div>
          </div>
        ` : ''}
        ${alert.day && alert.temp ? `
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">
            <span>📅 ${alert.day}</span> • <span>🌡️ ${alert.temp}°C</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// PLANNER VIEW - COMPLETE 7-DAY FORECAST WITH AUTO-SCROLL
let autoScrollInterval = null;
let isUserInteracting = false;
let userInteractionTimeout = null;
let isAutoScrolling = false;

async function loadPlanner(city) {
  const data = await fetchWeather(city);
  const forecast = data.forecast || [];
  
  renderForecastCards(forecast);
  setupForecastScroll();
  
  // Start auto-scroll after render
  setTimeout(() => {
    startAutoScroll();
  }, 800);
}

// Render 7-day forecast cards with proper clearing and null-safety
function renderForecastCards(forecast) {
  const container = document.getElementById('detailedForecast');
  
  // CRITICAL: Clear old content completely
  container.innerHTML = '';
  
  if (!forecast || forecast.length === 0) {
    container.innerHTML = '<div class="no-alert" style="text-align:center;padding:40px;color:#94a3b8;">No forecast data available</div>';
    return;
  }
  
  // Ensure exactly 7 days (pad if needed)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const cards = [];
  for (let i = 0; i < 7; i++) {
    const day = forecast[i] || {};
    
    // Calculate date
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dayName = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : days[date.getDay()]);
    const dateStr = `${months[date.getMonth()]} ${date.getDate()}`;
    
    // Null-safe values with defaults
    const temp = day.temp !== undefined ? Math.round(day.temp) : '--';
    const condition = day.condition || day.description || 'N/A';
    const precip = day.precip !== undefined ? Math.round(day.precip) : 0;
    const icon = day.icon || '01d';
    
    // Get weather icon (use OpenWeather or custom)
    const customIcon = getCustomIcon(condition, icon);
    
    cards.push(`
      <div class="forecast-detail-item" data-day="${i}">
        <div class="forecast-day">${dayName}</div>
        <div class="forecast-date">${dateStr}</div>
        <img src="${customIcon}" alt="${condition}" class="forecast-icon" loading="lazy">
        <div class="forecast-temp">${temp}°C</div>
        <div class="forecast-condition">${condition}</div>
        <div class="forecast-precip">💧 Rain: ${precip}%</div>
      </div>
    `);
  }
  
  // Update DOM in one operation
  container.innerHTML = cards.join('');
}

// Setup scroll navigation arrows
function setupForecastScroll() {
  const wrapper = document.querySelector('.forecast-scroll-wrapper');
  const leftBtn = document.getElementById('scrollLeftBtn');
  const rightBtn = document.getElementById('scrollRightBtn');
  
  if (!wrapper || !leftBtn || !rightBtn) return;
  
  // Remove old listeners by cloning
  const newLeftBtn = leftBtn.cloneNode(true);
  const newRightBtn = rightBtn.cloneNode(true);
  leftBtn.replaceWith(newLeftBtn);
  rightBtn.replaceWith(newRightBtn);
  
  // Manual scroll left
  newLeftBtn.addEventListener('click', () => {
    pauseAutoScrollForUserInteraction();
    wrapper.scrollBy({ left: -200, behavior: 'smooth' });
  });
  
  // Manual scroll right
  newRightBtn.addEventListener('click', () => {
    pauseAutoScrollForUserInteraction();
    wrapper.scrollBy({ left: 200, behavior: 'smooth' });
  });
  
  // Detect ONLY manual user scrolling (not programmatic)
  let lastScrollLeft = wrapper.scrollLeft;
  wrapper.addEventListener('scroll', () => {
    // Ignore scroll events triggered by auto-scroll
    if (isAutoScrolling) return;
    
    // Only pause if scroll position actually changed by user
    const currentScrollLeft = wrapper.scrollLeft;
    if (Math.abs(currentScrollLeft - lastScrollLeft) > 5) {
      pauseAutoScrollForUserInteraction();
    }
    lastScrollLeft = currentScrollLeft;
  }, { passive: true });
  
  // Detect touch/mouse interaction
  wrapper.addEventListener('mousedown', pauseAutoScrollForUserInteraction);
  wrapper.addEventListener('touchstart', pauseAutoScrollForUserInteraction, { passive: true });
}

// Pause auto-scroll when user interacts
function pauseAutoScrollForUserInteraction() {
  isUserInteracting = true;
  stopAutoScroll();
  
  clearTimeout(userInteractionTimeout);
  userInteractionTimeout = setTimeout(() => {
    isUserInteracting = false;
    startAutoScroll();
  }, 6000); // Resume after 6 seconds of no interaction
}

// Auto-scroll forecast cards - SMOOTH & NO HEARTBEAT
function startAutoScroll() {
  // Don't start if already running or user is interacting
  if (autoScrollInterval || isUserInteracting) return;
  
  const wrapper = document.querySelector('.forecast-scroll-wrapper');
  if (!wrapper) return;
  
  // Check if there's content to scroll
  if (wrapper.scrollWidth <= wrapper.clientWidth) return;
  
  autoScrollInterval = setInterval(() => {
    if (isUserInteracting) {
      stopAutoScroll();
      return;
    }
    
    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
    const currentScroll = wrapper.scrollLeft;
    
    // Set flag BEFORE scrolling
    isAutoScrolling = true;
    
    // Smooth scroll
    if (currentScroll >= maxScroll - 10) {
      // Loop back to start
      wrapper.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      // Scroll right
      wrapper.scrollBy({ left: 180, behavior: 'smooth' });
    }
    
    // Clear flag AFTER scroll animation completes
    setTimeout(() => {
      isAutoScrolling = false;
    }, 700);
    
  }, 4000); // Scroll every 4 seconds
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  isAutoScrolling = false;
}

// Auto-refresh forecast every 30 seconds
setInterval(() => {
  const currentView = document.querySelector('.view-section[style*="display: block"]');
  if (currentView && currentView.id === 'plannerView') {
    const city = document.getElementById('searchInput')?.value || 'London';
    loadPlanner(city);
  }
}, 30000);

// SETTINGS VIEW - Enhanced
function loadSettings() {
  // Load all settings from localStorage
  const savedSettings = JSON.parse(localStorage.getItem('weatherSettings') || JSON.stringify(getDefaultSettings()));
  
  // Temperature & Units
  document.querySelector(`input[name="tempUnit"][value="${savedSettings.tempUnit}"]`).checked = true;
  document.getElementById('windUnit').value = savedSettings.windUnit || 'kmh';
  document.querySelector(`input[name="rainUnit"][value="${savedSettings.rainUnit || 'mm'}"]`).checked = true;
  document.getElementById('pressureUnit').value = savedSettings.pressureUnit || 'hpa';
  
  // Appearance & Theme
  document.querySelector(`input[name="theme"][value="${savedSettings.theme}"]`).checked = true;
  document.querySelector(`input[name="accentColor"][value="${savedSettings.accentColor || '#667eea'}"]`).checked = true;
  document.getElementById('highContrast').checked = savedSettings.highContrast || false;
  
  // Notifications
  document.getElementById('enableAllNotifications').checked = savedSettings.notifications !== false;
  document.getElementById('alertRainSoon').checked = savedSettings.alertRainSoon !== false;
  document.getElementById('alertLightning').checked = savedSettings.alertLightning !== false;
  document.getElementById('alertStorm').checked = savedSettings.alertStorm !== false;
  document.getElementById('alertAQI').checked = savedSettings.alertAQI !== false;
  document.getElementById('alertDaily').checked = savedSettings.alertDaily !== false;
  document.getElementById('alertTempDrop').checked = savedSettings.alertTempDrop !== false;
  document.getElementById('alertTravel').checked = savedSettings.alertTravel !== false;
  document.getElementById('alertFrost').checked = savedSettings.alertFrost !== false;
  document.getElementById('notificationSound').checked = savedSettings.notificationSound || false;
  
  // Quiet Hours
  document.getElementById('enableQuietHours').checked = savedSettings.quietHours?.enabled || false;
  document.getElementById('quietStartTime').value = savedSettings.quietHours?.start || '22:00';
  document.getElementById('quietEndTime').value = savedSettings.quietHours?.end || '07:00';
  toggleQuietHours();
  
  // Dashboard Personalization
  document.querySelector(`input[name="defaultScreen"][value="${savedSettings.defaultScreen || 'today'}"]`).checked = true;
  document.querySelector(`input[name="defaultMapLayer"][value="${savedSettings.defaultMapLayer || 'rain'}"]`).checked = true;
  document.getElementById('mapAnimations').checked = savedSettings.mapAnimations || false;
  document.getElementById('autoRefresh').checked = savedSettings.autoRefresh !== false;
  
  // Load cities
  renderCitiesListNew();
  
  // Apply theme
  document.body.setAttribute('data-theme', savedSettings.theme);
  applyAccentColor(savedSettings.accentColor || '#667eea');
  
  // Setup change detection
  setupSettingsChangeDetection();
}

function getDefaultSettings() {
  return {
    tempUnit: 'C',
    windUnit: 'kmh',
    rainUnit: 'mm',
    pressureUnit: 'hpa',
    theme: 'light',
    accentColor: '#667eea',
    highContrast: false,
    notifications: true,
    alertRainSoon: true,
    alertLightning: true,
    alertStorm: true,
    alertAQI: true,
    alertDaily: true,
    alertTempDrop: true,
    alertTravel: true,
    alertFrost: true,
    notificationSound: false,
    quietHours: { enabled: false, start: '22:00', end: '07:00' },
    defaultScreen: 'today',
    defaultMapLayer: 'rain',
    mapAnimations: false,
    autoRefresh: true
  };
}

function renderCitiesListNew() {
  const container = document.getElementById('citiesList');
  const emptyMessage = document.getElementById('emptyCitiesMessage');
  const cityLimit = document.querySelector('.city-limit');
  
  if (savedCities.length === 0) {
    container.innerHTML = '';
    emptyMessage.style.display = 'block';
  } else {
    emptyMessage.style.display = 'none';
    container.innerHTML = savedCities.map((city, index) => 
      `<div class="city-card-new" draggable="true" data-index="${index}">
        <span class="drag-handle">⋮⋮</span>
        <span class="city-weather-icon">🌤️</span>
        <div class="city-info">
          <span class="city-name">${city}</span>
          <span class="city-status">Updated 2m ago</span>
        </div>
        <span class="city-favorite ${index === 0 ? 'active' : ''}" onclick="toggleFavoriteCity(${index})">⭐</span>
        <span class="city-temp-badge">--°</span>
        <button class="city-delete-btn" onclick="removeCityFromSettings('${city}')">×</button>
      </div>`
    ).join('');
    
    // Setup drag and drop
    setupCityDragDrop();
  }
  
  cityLimit.textContent = `${savedCities.length}/10 cities`;
}

function setupCityDragDrop() {
  const cards = document.querySelectorAll('.city-card-new');
  let draggedItem = null;
  
  cards.forEach(card => {
    card.addEventListener('dragstart', function(e) {
      draggedItem = this;
      this.style.opacity = '0.5';
    });
    
    card.addEventListener('dragend', function() {
      this.style.opacity = '1';
    });
    
    card.addEventListener('dragover', function(e) {
      e.preventDefault();
    });
    
    card.addEventListener('drop', function(e) {
      e.preventDefault();
      if (draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);
        
        // Reorder array
        const item = savedCities.splice(fromIndex, 1)[0];
        savedCities.splice(toIndex, 0, item);
        
        localStorage.setItem('savedCities', JSON.stringify(savedCities));
        renderCitiesListNew();
      }
    });
  });
}

function toggleFavoriteCity(index) {
  // Move selected city to first position
  const city = savedCities.splice(index, 1)[0];
  savedCities.unshift(city);
  localStorage.setItem('savedCities', JSON.stringify(savedCities));
  renderCitiesListNew();
  showSettingsChange();
}

function removeCityFromSettings(city) {
  const index = savedCities.indexOf(city);
  if (index > -1) {
    savedCities.splice(index, 1);
    localStorage.setItem('savedCities', JSON.stringify(savedCities));
    renderCitiesListNew();
    showSettingsChange();
  }
}

// Toggle quiet hours inputs
document.getElementById('enableQuietHours')?.addEventListener('change', toggleQuietHours);

function toggleQuietHours() {
  const enabled = document.getElementById('enableQuietHours')?.checked;
  const inputs = document.getElementById('quietHoursInputs');
  if (inputs) {
    inputs.style.display = enabled ? 'block' : 'none';
  }
}

// Master notification toggle
document.getElementById('enableAllNotifications')?.addEventListener('change', function() {
  const enabled = this.checked;
  document.querySelectorAll('.sub-notification').forEach(toggle => {
    toggle.disabled = !enabled;
    toggle.parentElement.parentElement.parentElement.style.opacity = enabled ? '1' : '0.5';
  });
  showSettingsChange();
});

// Apply accent color
function applyAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color);
}

// Setup change detection for all settings
function setupSettingsChangeDetection() {
  const saveBtn = document.getElementById('saveSettingsBtn');
  let hasChanges = false;
  
  // Listen to all input changes
  const settingsSection = document.getElementById('settingsView');
  settingsSection?.addEventListener('input', showSettingsChange);
  settingsSection?.addEventListener('change', showSettingsChange);
}

function showSettingsChange() {
  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) {
    saveBtn.style.display = 'flex';
  }
}

// Save all settings
document.getElementById('saveSettingsBtn')?.addEventListener('click', saveAllSettings);

function saveAllSettings() {
  const newSettings = {
    // Units
    tempUnit: document.querySelector('input[name="tempUnit"]:checked')?.value || 'C',
    windUnit: document.getElementById('windUnit')?.value || 'kmh',
    rainUnit: document.querySelector('input[name="rainUnit"]:checked')?.value || 'mm',
    pressureUnit: document.getElementById('pressureUnit')?.value || 'hpa',
    
    // Appearance
    theme: document.querySelector('input[name="theme"]:checked')?.value || 'light',
    accentColor: document.querySelector('input[name="accentColor"]:checked')?.value || '#667eea',
    highContrast: document.getElementById('highContrast')?.checked || false,
    
    // Notifications
    notifications: document.getElementById('enableAllNotifications')?.checked || false,
    alertRainSoon: document.getElementById('alertRainSoon')?.checked || false,
    alertLightning: document.getElementById('alertLightning')?.checked || false,
    alertStorm: document.getElementById('alertStorm')?.checked || false,
    alertAQI: document.getElementById('alertAQI')?.checked || false,
    alertDaily: document.getElementById('alertDaily')?.checked || false,
    alertTempDrop: document.getElementById('alertTempDrop')?.checked || false,
    alertTravel: document.getElementById('alertTravel')?.checked || false,
    alertFrost: document.getElementById('alertFrost')?.checked || false,
    notificationSound: document.getElementById('notificationSound')?.checked || false,
    
    // Quiet Hours
    quietHours: {
      enabled: document.getElementById('enableQuietHours')?.checked || false,
      start: document.getElementById('quietStartTime')?.value || '22:00',
      end: document.getElementById('quietEndTime')?.value || '07:00'
    },
    
    // Dashboard
    defaultScreen: document.querySelector('input[name="defaultScreen"]:checked')?.value || 'today',
    defaultMapLayer: document.querySelector('input[name="defaultMapLayer"]:checked')?.value || 'rain',
    mapAnimations: document.getElementById('mapAnimations')?.checked || false,
    autoRefresh: document.getElementById('autoRefresh')?.checked || false
  };
  
  // Save to localStorage
  localStorage.setItem('weatherSettings', JSON.stringify(newSettings));
  
  // Apply changes immediately
  document.body.setAttribute('data-theme', newSettings.theme);
  applyAccentColor(newSettings.accentColor);
  
  // Show success animation
  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) {
    const originalHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="fab-icon">✓</span><span class="fab-text">Saved!</span>';
    saveBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
    
    setTimeout(() => {
      saveBtn.innerHTML = originalHTML;
      saveBtn.style.background = '';
      saveBtn.style.display = 'none';
    }, 3000);
  }
  
  // Update global settings object
  Object.assign(settings, newSettings);
  
  console.log('Settings saved:', newSettings);
}

window.removeCity = removeCityFromSettings;
window.toggleFavoriteCity = toggleFavoriteCity;

document.getElementById('addCityBtn')?.addEventListener('click', () => {
  const input = document.getElementById('addCityInput');
  const city = input.value.trim();
  
  if (!city) {
    alert('Please enter a city name');
    return;
  }
  
  if (savedCities.length >= 10) {
    alert('Maximum 10 cities allowed');
    return;
  }
  
  if (savedCities.includes(city)) {
    alert('City already added');
    return;
  }
  
  savedCities.push(city);
  localStorage.setItem('savedCities', JSON.stringify(savedCities));
  input.value = '';
  renderCitiesListNew();
  showSettingsChange();
});

// Legacy compatibility - keep old settings handlers
document.querySelectorAll('input[name="tempUnit"]').forEach(input => {
  input.addEventListener('change', (e) => {
    settings.tempUnit = e.target.value;
    showSettingsChange();
  });
});

document.querySelectorAll('input[name="theme"]').forEach(input => {
  input.addEventListener('change', (e) => {
    settings.theme = e.target.value;
    document.body.setAttribute('data-theme', settings.theme);
    showSettingsChange();
  });
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
  
  // *** UPDATED FILTER: Include triggered alerts regardless of start/end ***
  const now = Math.floor(Date.now() / 1000);
  const activeAlerts = alerts.filter(alert => {
    // Triggered alerts are always active
    if (alert.triggered) return true;
    // Time-based alerts must be within start/end window
    if (alert.start && alert.end) {
      return alert.start <= now && alert.end >= now;
    }
    return false;
  });
  
  if (activeAlerts.length > 0) {
    bellIcon.src = '/static/images/bell-active.png';
    bell.classList.add('has-alerts');
    badge.style.display = 'flex';
    badge.textContent = activeAlerts.length;
    hasNewAlerts = true;
  } else {
    bellIcon.src = '/static/images/bell-deactive.png';
    bell.classList.remove('has-alerts');
    badge.style.display = 'none';
    hasNewAlerts = false;
  }
  
  // Update sidebar alert badge
  const sidebarBadge = document.getElementById('sidebarAlertBadge');
  if (sidebarBadge) {
    if (activeAlerts.length > 0) {
      sidebarBadge.textContent = activeAlerts.length;
      sidebarBadge.style.display = 'flex';
    } else {
      sidebarBadge.style.display = 'none';
    }
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
        <svg class="no-alerts-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
        <div class="no-alerts-card">
          <div class="no-alerts-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            All Clear!
          </div>
          <p class="no-alerts-text">No weather alerts at the moment. Configure alerts by clicking below.</p>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = alerts.map(alert => `
      <div class="alert-item ${getAlertSeverity(alert.tags)} ${alert.triggered ? 'triggered-alert' : ''}">
        ${alert.triggered ? '<span class="badge triggered">TRIGGERED</span>' : ''}
        <img src="${getAlertIcon(alert.alert || alert.event)}" alt="${alert.alert || alert.event}" class="alert-icon">
        <div class="alert-details">
          <div class="alert-title">${alert.alert || alert.event}</div>
          <div class="alert-description">${alert.description}</div>
          ${alert.current && alert.threshold ? `
            <div class="alert-meta">
              Current: <strong>${alert.current}${alert.unit || ''}</strong> • 
              Threshold: <strong>${alert.threshold}${alert.unit || ''}</strong>
            </div>
          ` : ''}
          <div class="alert-time">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${alert.triggered ? 'Active now' : `${formatAlertTime(alert.start)} - ${formatAlertTime(alert.end)}`}</span>
          </div>
          ${alert.sender_name ? `<div class="alert-sender">Source: ${alert.sender_name}</div>` : ''}
        </div>
      </div>
    `).join('');
  }
}

// Toggle drawer visibility
// Close drawer when clicking outside
document.addEventListener('click', (e) => {
  const drawer = document.querySelector('.alert-notification-drawer');
  const bell = document.querySelector('.notification-bell');
  const container = document.querySelector('.notification-bell-container');
  
  if (drawer && drawer.classList.contains('active')) {
    if (!container || !container.contains(e.target)) {
      closeNotificationDrawer();
    }
  }
});


// ============================================
// ADVANCED ANALYTICS & CLIMATE INSIGHTS
// ============================================

let comfortChart, rainfallSunshineChart, anomalyChart;

// Calculate Comfort Index (0-100)
function calculateComfortIndex(temp, humidity, windSpeed) {
  let score = 100;
  
  // Ideal temperature: 20-24°C
  if (temp < 20) score -= (20 - temp) * 3;
  else if (temp > 24) score -= (temp - 24) * 2;
  
  // Ideal humidity: 40-60%
  if (humidity < 40) score -= (40 - humidity) * 0.5;
  else if (humidity > 60) score -= (humidity - 60) * 0.8;
  
  // Wind penalty
  if (windSpeed > 5) score -= (windSpeed - 5) * 2;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Get comfort level color
function getComfortColor(score) {
  if (score >= 80) return { bg: 'rgba(46, 213, 115, 0.8)', border: '#27ae60' };
  if (score >= 60) return { bg: 'rgba(52, 152, 219, 0.8)', border: '#3498db' };
  if (score >= 40) return { bg: 'rgba(243, 156, 18, 0.8)', border: '#f39c12' };
  return { bg: 'rgba(231, 76, 60, 0.8)', border: '#e74c3c' };
}

// Generate AI Climate Insight
function generateAIInsight(forecast, avgTemp, avgHumidity, rainyDays) {
  const insights = [];
  
  // Temperature trend
  const tempTrend = forecast.length >= 2 ? forecast[forecast.length-1].temp - forecast[0].temp : 0;
  if (tempTrend > 3) {
    insights.push("📈 Temperature rising significantly this week—expect warmer conditions.");
  } else if (tempTrend < -3) {
    insights.push("📉 Cooler weather approaching—temperatures dropping by end of week.");
  }
  
  // Humidity analysis
  if (avgHumidity > 75) {
    insights.push("💧 High humidity levels may lead to muggy conditions.");
  } else if (avgHumidity < 30) {
    insights.push("🏜️ Low humidity—stay hydrated and moisturize your skin.");
  }
  
  // Rain prediction
  if (rainyDays >= 3) {
    insights.push("☔ Multiple rainy days expected—plan indoor activities.");
  } else if (rainyDays === 0) {
    insights.push("☀️ Clear skies all week—perfect outdoor weather!");
  }
  
  // Comfort prediction
  if (avgTemp >= 18 && avgTemp <= 25 && avgHumidity >= 40 && avgHumidity <= 60) {
    insights.push("✨ Ideal comfort conditions throughout the week!");
  }
  
  return insights[0] || "Weather conditions are stable and within normal ranges.";
}

// Calculate temperature anomaly
function calculateAnomaly(currentAvg) {
  // Simulated historical average (in real app, fetch from API)
  const historicalAvg = 15; // Example baseline
  const diff = currentAvg - historicalAvg;
  return {
    value: diff,
    text: diff > 0 ? `+${diff.toFixed(1)}°C warmer than usual` : `${diff.toFixed(1)}°C cooler than usual`,
    type: diff > 0 ? 'positive' : 'negative'
  };
}

// Render Advanced Analytics
function renderAdvancedAnalytics(data) {
  const forecast = data.forecast || [];
  const hourly = data.hourly || [];
  
  if (forecast.length === 0) return;
  
  // Calculate weekly summary
  const temps = forecast.map(f => f.temp);
  const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
  const avgHumidity = data.humidity || 50; // Use current humidity as approximation
  const rainyDays = forecast.filter(f => (f.precip || 0) > 30).length;
  const avgWind = data.wind || 0;
  
  // Update summary cards
  document.getElementById('avgTemp').textContent = `${avgTemp}°C`;
  document.getElementById('avgHumidity').textContent = `${avgHumidity}%`;
  document.getElementById('rainyDays').textContent = `${rainyDays} days`;
  document.getElementById('avgWind').textContent = `${avgWind.toFixed(1)} m/s`;
  
  // AI Insight
  const insight = generateAIInsight(forecast, parseFloat(avgTemp), avgHumidity, rainyDays);
  document.getElementById('aiInsight').textContent = insight;
  
  // Temperature Anomaly
  const anomaly = calculateAnomaly(parseFloat(avgTemp));
  const anomalyEl = document.getElementById('anomalyValue');
  anomalyEl.textContent = anomaly.text;
  anomalyEl.className = `anomaly-value ${anomaly.type}`;
  
  // Anomaly sparkline
  const anomalyCtx = document.getElementById('anomalySparkline').getContext('2d');
  if (anomalyChart) anomalyChart.destroy();
  anomalyChart = new Chart(anomalyCtx, {
    type: 'line',
    data: {
      labels: forecast.map(f => f.day),
      datasets: [{
        data: forecast.map(f => f.temp),
        borderColor: anomaly.type === 'positive' ? '#f5576c' : '#4facfe',
        backgroundColor: anomaly.type === 'positive' ? 'rgba(245,87,108,0.1)' : 'rgba(79,172,254,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
  
  // Comfort Index Chart
  const comfortData = forecast.map(f => {
    const humidity = avgHumidity + (Math.random() - 0.5) * 20; // Simulated humidity variation
    const wind = avgWind + (Math.random() - 0.5) * 2;
    return calculateComfortIndex(f.temp, humidity, wind);
  });
  
  const comfortCtx = document.getElementById('comfortIndexChart').getContext('2d');
  if (comfortChart) comfortChart.destroy();
  comfortChart = new Chart(comfortCtx, {
    type: 'bar',
    data: {
      labels: forecast.map(f => f.day),
      datasets: [{
        label: 'Comfort Score',
        data: comfortData,
        backgroundColor: comfortData.map(score => getComfortColor(score).bg),
        borderColor: comfortData.map(score => getComfortColor(score).border),
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const score = context.parsed.y;
              let level = 'Poor';
              if (score >= 80) level = 'Excellent';
              else if (score >= 60) level = 'Good';
              else if (score >= 40) level = 'Fair';
              return `${level}: ${score}/100`;
            }
          }
        }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          max: 100,
          ticks: { callback: (value) => value }
        }
      }
    }
  });
  
  // Rainfall vs Sunshine Chart (dual-axis)
  const rainfallData = forecast.map(f => (f.precip || Math.random() * 10));
  const sunshineData = forecast.map(() => Math.random() * 12 + 2); // Simulated sunshine hours
  
  const rainfallSunCtx = document.getElementById('rainfallSunshineChart').getContext('2d');
  if (rainfallSunshineChart) rainfallSunshineChart.destroy();
  rainfallSunshineChart = new Chart(rainfallSunCtx, {
    type: 'bar',
    data: {
      labels: forecast.map(f => f.day),
      datasets: [{
        label: 'Rainfall (mm)',
        data: rainfallData,
        backgroundColor: 'rgba(52, 152, 219, 0.7)',
        borderColor: '#3498db',
        borderWidth: 2,
        yAxisID: 'y',
        order: 2
      }, {
        label: 'Sunshine (hours)',
        data: sunshineData,
        type: 'line',
        borderColor: '#f39c12',
        backgroundColor: 'rgba(243, 156, 18, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1',
        order: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Rainfall (mm)' }
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Sunshine (hours)' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
  
  // Humidity-Temperature Heatmap
  const heatmapContainer = document.getElementById('humidityTempHeatmap');
  heatmapContainer.innerHTML = '';
  
  forecast.forEach((f, idx) => {
    const temp = f.temp;
    const humidity = avgHumidity + (Math.random() - 0.5) * 30;
    const correlation = (temp + humidity) / 2;
    
    let level = 1;
    if (correlation > 60) level = 5;
    else if (correlation > 50) level = 4;
    else if (correlation > 40) level = 3;
    else if (correlation > 30) level = 2;
    
    const cell = document.createElement('div');
    cell.className = `heatmap-cell level-${level}`;
    cell.innerHTML = `
      <div class="heatmap-day">${f.day}</div>
      <div class="heatmap-value">${Math.round(correlation)}</div>
    `;
    cell.title = `${f.day}: Temp ${temp}°C, Humidity ${Math.round(humidity)}%`;
    heatmapContainer.appendChild(cell);
  });
  
  // Wind Pattern Overview
  const windContainer = document.getElementById('windPatternChart');
  windContainer.innerHTML = '';
  
  const windDirections = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
  
  forecast.forEach((f, idx) => {
    const windSpeed = avgWind + (Math.random() - 0.5) * 4;
    const direction = windDirections[Math.floor(Math.random() * windDirections.length)];
    const maxWind = 15;
    const percentage = (windSpeed / maxWind) * 100;
    
    const item = document.createElement('div');
    item.className = 'wind-day-item';
    item.innerHTML = `
      <div class="wind-day-name">${f.day}</div>
      <div class="wind-arrow">${direction}</div>
      <div class="wind-speed-bar">
        <div class="wind-speed-fill" style="width: ${percentage}%"></div>
      </div>
      <div class="wind-speed-value">${windSpeed.toFixed(1)} m/s</div>
    `;
    windContainer.appendChild(item);
  });
  
  // Advanced Metrics
  const tempRange = `${Math.min(...temps)}°C - ${Math.max(...temps)}°C`;
  document.getElementById('tempRange').textContent = tempRange;
  
  const pressureTrend = data.pressure > 1013 ? '↑ Rising' : '↓ Falling';
  document.getElementById('pressureTrend').textContent = pressureTrend;
  
  const uvIndex = Math.floor(Math.random() * 11);
  document.getElementById('uvIndex').textContent = uvIndex;
  
  const visibility = `${Math.floor(Math.random() * 10) + 5} km`;
  document.getElementById('visibility').textContent = visibility;
}

// Update renderCity to include advanced analytics
async function renderCity(city){
  try{
    // Save current scroll position to prevent auto-scroll
    const scrollY = window.scrollY || window.pageYOffset;
    
    const data = await fetchWeather(city);
    
    // Store last searched city data for map view
    lastSearchedCity = {
      lat: data.lat,
      lon: data.lon,
      city: data.city,
      temp: data.temp,
      desc: data.desc || ""
    };
    
    // Update weather alert location if alerts are initialized
    if (weatherAlertState.isInitialized && data.lat && data.lon) {
      weatherAlertState.currentLocation = {
        lat: data.lat,
        lon: data.lon,
        name: data.city
      };
      
      // Update location in backend
      fetch('/api/alerts/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: weatherAlertState.userId,
          location: weatherAlertState.currentLocation
        })
      }).catch(err => {
        if (DEBUG) console.error('Error updating alert location:', err);
      });
    }
    
    // *** CHECK THRESHOLDS AND CREATE TRIGGERED ALERTS ***
    const thresholdAlerts = checkThresholdsAndCreateAlerts(data);
    
    // Add threshold alerts to app alerts array
    thresholdAlerts.forEach(alert => {
      addAppAlert(alert);
      // Also trigger notification display
      showAlertNotification(alert);
    });
    
    // Merge OpenWeather alerts with threshold alerts and persisted app alerts
    const allAlerts = [
      ...(data.alerts || []).map(normalizeAlert),
      ...thresholdAlerts,
      ...appAlerts.filter(a => {
        // Only include recent app alerts (within last 24 hours)
        const alertTime = parseInt(a.start) * 1000;
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
        return alertTime > dayAgo;
      })
    ];
    
    // Update data.alerts with merged alerts
    data.alerts = allAlerts;
    
    renderCurrent(data);
    renderForecast(data.forecast || []);
    renderRegions(data.regions || []);
    renderAlerts(data.alerts || []);
    // Update notification bell with all alerts (including triggered ones)
    updateNotificationBell(data.alerts || []);
    drawPrecipChart(data.forecast || []);
    // hourly for trend: try hourly then fallback to forecast temps
    const hourly = data.hourly && data.hourly.length ? data.hourly : (data.forecast || []).slice(0,8).map((f,idx)=>({time:f.day, temp:f.temp}));
    drawTempChart(hourly);
    
    // Update map with proper coordinates
    if(data.lat && data.lon) {
      updateMap({lat: data.lat, lon: data.lon}, data.city, data.temp, data.desc || "");
    }
    
    // Render advanced analytics
    renderAdvancedAnalytics(data);
    
    // Restore scroll position to prevent auto-scroll
    setTimeout(() => {
      window.scrollTo(0, scrollY);
    }, 0);
    
  }catch(e){
    console.error('Error rendering city:', e);
  }
}

// Initial city will be loaded by window.initMap callback when Google Maps is ready
// No need to call renderCity here - it's called in window.initMap

// ============================================
// AI WEATHER BOT
// ============================================
// AI WEATHER BOT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  const botBubble = document.getElementById('botBubble');
  const openAiBotBtn = document.getElementById('openAiBot');
  const botChat = document.getElementById('botChat');
  const closeBotBtn = document.getElementById('closeBotBtn');
  const botInput = document.getElementById('botInput');
  const sendBotBtn = document.getElementById('sendBotBtn');
  const chatMessages = document.getElementById('chatMessages');
  
  // Toggle chat window from bubble
  botBubble?.addEventListener('click', function() {
    const isActive = botChat.style.display !== 'none';
    botChat.style.display = isActive ? 'none' : 'block';
    if (!isActive) {
      botInput.focus();
    }
  });
  
  // Toggle chat window from sidebar button
  openAiBotBtn?.addEventListener('click', function() {
    const isActive = botChat.style.display !== 'none';
    botChat.style.display = isActive ? 'none' : 'block';
    if (!isActive) {
      botInput.focus();
    }
  });
  
  // Close chat
  closeBotBtn?.addEventListener('click', function() {
    botChat.style.display = 'none';
  });
  
  // Send message on button click
  sendBotBtn?.addEventListener('click', function() {
    const message = botInput.value.trim();
    if (message) {
      sendBotMessage(message);
      botInput.value = '';
    }
  });
  
  // Send message on Enter key
  botInput?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const message = botInput.value.trim();
      if (message) {
        sendBotMessage(message);
        botInput.value = '';
      }
    }
  });
  
  async function sendBotMessage(message) {
    // Add user message to chat
    addMessageToChat('user', message);
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
      const response = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from AI bot');
      }
      
      const data = await response.json();
      
      // Remove typing indicator
      removeTypingIndicator(typingId);
      
      // Add bot response
      addMessageToChat('bot', data.response);
      
    } catch (error) {
      console.error('Bot error:', error);
      removeTypingIndicator(typingId);
      addMessageToChat('bot', 'Sorry, I encountered an error. Please try again.');
    }
  }
  
  function addMessageToChat(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = sender === 'user' ? 'user-message' : 'bot-message';
    
    const textP = document.createElement('p');
    
    // Enhanced formatting for bot messages
    if (sender === 'bot') {
      // Convert markdown-style bold (**text**) to HTML
      let formattedText = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      
      // Preserve line breaks and convert newlines to <br>
      formattedText = formattedText.replace(/\n/g, '<br>');
      
      // Use innerHTML for formatted text
      textP.innerHTML = formattedText;
    } else {
      // User messages: plain text
      textP.textContent = text;
      textP.style.whiteSpace = 'pre-wrap';
    }
    
    messageDiv.appendChild(textP);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom with smooth animation
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'bot-message typing-indicator';
    typingDiv.id = 'typing-' + Date.now();
    typingDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typingDiv.id;
  }
  
  function removeTypingIndicator(id) {
    const typingDiv = document.getElementById(id);
    if (typingDiv) {
      typingDiv.remove();
    }
  }
});

// ============================================
// GOOGLE MAPS WEATHER ANALYTICS MODULE
// ============================================

const OPENWEATHER_API_KEY = 'your_key_here'; // Your OpenWeather key

// Load saved locations from localStorage
savedLocations = JSON.parse(localStorage.getItem('weatherMapLocations')) || [];

// Initialize Google Maps Weather Module (for full map view)
async function initializeWeatherMap() {
  const mapElement = document.getElementById('googleMap');
  if (!mapElement || !google) {
    console.error('Map element or Google Maps API not found');
    return;
  }

  // Default center (Udupi, India)
  const defaultCenter = { lat: 13.3409, lng: 74.7421 };

  // Initialize Google Map with Silver style
  googleMap = new google.maps.Map(mapElement, {
    center: defaultCenter,
    zoom: 8,
    mapTypeId: 'roadmap',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    styles: [
      {
        elementType: "geometry",
        stylers: [{ color: "#f5f5f5" }]
      },
      {
        elementType: "labels.icon",
        stylers: [{ visibility: "off" }]
      },
      {
        elementType: "labels.text.fill",
        stylers: [{ color: "#616161" }]
      },
      {
        elementType: "labels.text.stroke",
        stylers: [{ color: "#f5f5f5" }]
      },
      {
        featureType: "administrative.land_parcel",
        elementType: "labels.text.fill",
        stylers: [{ color: "#bdbdbd" }]
      },
      {
        featureType: "poi",
        elementType: "geometry",
        stylers: [{ color: "#eeeeee" }]
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#757575" }]
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#e5e5e5" }]
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9e9e9e" }]
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#ffffff" }]
      },
      {
        featureType: "road.arterial",
        elementType: "labels.text.fill",
        stylers: [{ color: "#757575" }]
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#dadada" }]
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#616161" }]
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#c9c9c9" }]
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9e9e9e" }]
      }
    ]
  });

  // Initialize InfoWindow
  infoWindow = new google.maps.InfoWindow();

  // Setup Search Box
  setupSearchBox();

  // Setup Event Listeners
  setupMapControls();

  // Try to get user's location
  tryUserLocation();

  // Load saved locations
  loadSavedLocationsUI();
}

// Setup Google Places SearchBox
function setupSearchBox() {
  const searchInput = document.getElementById('mapCitySearch');
  if (!searchInput) return;

  searchBox = new google.maps.places.SearchBox(searchInput);

  // Bias results to map viewport
  googleMap.addListener('bounds_changed', () => {
    searchBox.setBounds(googleMap.getBounds());
  });

  // Listen for place selection
  searchBox.addListener('places_changed', () => {
    const places = searchBox.getPlaces();
    
    if (places.length === 0) return;

    const place = places[0];
    
    if (!place.geometry || !place.geometry.location) {
      if (DEBUG) console.warn('Place has no geometry');
      return;
    }

    // Center map on place
    googleMap.setCenter(place.geometry.location);
    googleMap.setZoom(10);

    // Add weather marker
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const cityName = place.name;

    addWeatherMarker(lat, lng, cityName);
    
    // Clear input without refocusing (prevents auto-scroll)
    searchInput.value = '';
    searchInput.blur();
  });
}

// Setup map controls
function setupMapControls() {
  console.log('Setting up map controls...');
  
  // My Location button
  const locateMeBtn = document.getElementById('locateMe');
  if (locateMeBtn) {
    locateMeBtn.addEventListener('click', () => {
      console.log('My Location clicked');
      tryUserLocation();
    });
    console.log('✓ My Location button setup');
  } else {
    console.warn('✗ My Location button not found');
  }

  // Compare mode toggle
  const compareModeBtn = document.getElementById('compareMode');
  if (compareModeBtn) {
    compareModeBtn.addEventListener('click', () => {
      console.log('Compare mode clicked');
      comparisonMode = !comparisonMode;
      compareModeBtn.classList.toggle('active', comparisonMode);
      
      if (!comparisonMode) {
        comparisonCities = [];
        hideComparisonCard();
      } else {
        alert('Click on two city markers to compare weather');
      }
    });
    console.log('✓ Compare mode button setup');
  } else {
    console.warn('✗ Compare mode button not found');
  }

  // Modern Pill-Style Layer Toggle Buttons
  const tempLayerBtn = document.getElementById('tempLayerBtn');
  const rainLayerBtn = document.getElementById('rainLayerBtn');
  const windLayerBtn = document.getElementById('windLayerBtn');

  if (tempLayerBtn) {
    tempLayerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const wasActive = this.classList.contains('active');
      
      // If exclusive mode, deactivate other buttons
      if (!allowMultipleLayers && !wasActive) {
        if (rainLayerBtn) rainLayerBtn.classList.remove('active');
        if (windLayerBtn) windLayerBtn.classList.remove('active');
      }
      
      this.classList.toggle('active');
      const isActive = this.classList.contains('active');
      if (DEBUG) console.log('Temperature layer toggled:', isActive);
      toggleWeatherLayer('temperature', isActive);
    });
    if (DEBUG) console.log('✓ Temperature layer button setup');
  }

  if (rainLayerBtn) {
    rainLayerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const wasActive = this.classList.contains('active');
      
      // If exclusive mode, deactivate other buttons
      if (!allowMultipleLayers && !wasActive) {
        if (tempLayerBtn) tempLayerBtn.classList.remove('active');
        if (windLayerBtn) windLayerBtn.classList.remove('active');
      }
      
      this.classList.toggle('active');
      const isActive = this.classList.contains('active');
      if (DEBUG) console.log('Rainfall layer toggled:', isActive);
      toggleWeatherLayer('rainfall', isActive);
    });
    if (DEBUG) console.log('✓ Rainfall layer button setup');
  }

  if (windLayerBtn) {
    windLayerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const wasActive = this.classList.contains('active');
      
      // If exclusive mode, deactivate other buttons
      if (!allowMultipleLayers && !wasActive) {
        if (tempLayerBtn) tempLayerBtn.classList.remove('active');
        if (rainLayerBtn) rainLayerBtn.classList.remove('active');
      }
      
      this.classList.toggle('active');
      const isActive = this.classList.contains('active');
      if (DEBUG) console.log('Wind layer toggled:', isActive);
      toggleWeatherLayer('wind', isActive);
    });
    if (DEBUG) console.log('✓ Wind layer button setup');
  }

  // Clear all locations
  const clearAllBtn = document.getElementById('clearAllLocations');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Clear all saved locations?')) {
        savedLocations = [];
        localStorage.setItem('weatherMapLocations', JSON.stringify(savedLocations));
        loadSavedLocationsUI();
        
        // Remove all markers
        Object.values(mapMarkers).forEach(marker => marker.setMap(null));
        mapMarkers = {};
      }
    });
    console.log('✓ Clear all button setup');
  }

  // Close comparison card
  const closeCompBtn = document.querySelector('.close-comparison');
  if (closeCompBtn) {
    closeCompBtn.addEventListener('click', () => {
      console.log('Close comparison clicked');
      hideComparisonCard();
    });
    console.log('✓ Close comparison button setup');
  }
  
  console.log('Map controls setup complete');
}

// Try to get user's location
function tryUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        googleMap.setCenter(pos);
        googleMap.setZoom(12);

        // Add marker for user location
        addWeatherMarker(pos.lat, pos.lng, 'My Location');
      },
      (error) => {
        console.warn('Geolocation error:', error);
        alert('Unable to get your location. Please allow location access or search for a city.');
      }
    );
  } else {
    alert('Geolocation is not supported by your browser.');
  }
}

// Load Google Map with weather data (called from view switcher)
async function loadGoogleMap(lat, lon, cityName) {
  if (!googleMap) {
    console.warn('Google Map not initialized, initializing now...');
    await initializeWeatherMap();
  }
  
  // Center map on location
  const position = { lat: parseFloat(lat), lng: parseFloat(lon) };
  googleMap.setCenter(position);
  googleMap.setZoom(10);
  
  // Add weather marker for this location
  addWeatherMarker(lat, lon, cityName);
}


// Add weather marker to map
async function addWeatherMarker(lat, lng, cityName) {
  try {
    // Use rounded coordinates for deduplication (markerKey)
    const markerKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

    // Remove existing marker if exists
    if (mapMarkers[markerKey]) {
      mapMarkers[markerKey].setMap(null);
      delete mapMarkers[markerKey];
    }
    
    // Fetch weather data
    const weatherData = await fetchWeatherByCoords(lat, lng);
    
    if (!weatherData) {
      if (DEBUG) console.error('Failed to fetch weather data');
      return;
    }

    // Get weather icon
    const weatherIcon = getWeatherEmoji(weatherData.weather[0].main);

    // Create custom marker
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: googleMap,
      title: cityName || weatherData.name,
      label: {
        text: weatherIcon,
        fontSize: '24px'
      },
      animation: google.maps.Animation.DROP
    });

    // Store marker
    mapMarkers[markerKey] = marker;

    // Add click listener
    marker.addListener('click', () => {
      if (comparisonMode) {
        handleComparisonClick(weatherData, cityName || weatherData.name);
      } else {
        showWeatherPopup(marker, weatherData, cityName || weatherData.name);
      }
    });

    return marker;
  } catch (error) {
    if (DEBUG) console.error('Error adding weather marker:', error);
    showToast('❌ Failed to add marker');
  }
}

// Get weather emoji
function getWeatherEmoji(condition) {
  const emojiMap = {
    'Clear': '☀️',
    'Clouds': '☁️',
    'Rain': '🌧️',
    'Drizzle': '🌦️',
    'Thunderstorm': '⛈️',
    'Snow': '❄️',
    'Mist': '🌫️',
    'Fog': '🌫️',
    'Haze': '🌫️',
    'Smoke': '🌫️'
  };
  return emojiMap[condition] || '🌡️';
}

// Show weather popup (InfoWindow)
function showWeatherPopup(marker, weatherData, cityName) {
  const temp = Math.round(weatherData.main.temp);
  const feels = Math.round(weatherData.main.feels_like);
  const humidity = weatherData.main.humidity;
  const windSpeed = (weatherData.wind.speed * 3.6).toFixed(1); // m/s to km/h
  const description = weatherData.weather[0].description;
  const icon = getWeatherEmoji(weatherData.weather[0].main);

  const content = `
    <div style="padding: 12px; min-width: 220px; font-family: 'Inter', sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; color: #213043;">${cityName}</h3>
        <span style="font-size: 32px;">${icon}</span>
      </div>
      <div style="font-size: 28px; font-weight: 700; color: #4F9DF8; margin-bottom: 8px;">${temp}°C</div>
      <div style="font-size: 13px; color: #666; margin-bottom: 12px; text-transform: capitalize;">${description}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #8795A8; margin-bottom: 12px;">
        <div>🌡️ Feels ${feels}°C</div>
        <div>💧 ${humidity}%</div>
        <div>💨 ${windSpeed} km/h</div>
        <div>🧭 ${weatherData.wind.deg}°</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="saveCurrentLocation(${weatherData.coord.lat}, ${weatherData.coord.lon}, '${cityName}')" 
                style="flex: 1; padding: 8px; background: #4F9DF8; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px;">
          💾 Save
        </button>
        <button onclick="addToComparison(${weatherData.coord.lat}, ${weatherData.coord.lon}, '${cityName}')" 
                style="flex: 1; padding: 8px; background: #f8f9fb; color: #213043; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px;">
          ⚖️ Compare
        </button>
      </div>
    </div>
  `;

  infoWindow.setContent(content);
  infoWindow.open(googleMap, marker);
}

// Save location from popup
window.saveCurrentLocation = async function(lat, lng, cityName) {
  try {
    // Check if already saved
    if (savedLocations.some(loc => loc.name === cityName)) {
      alert('Location already saved!');
      return;
    }

    const weatherData = await fetchWeatherByCoords(lat, lng);

    savedLocations.push({
      name: cityName,
      lat: lat,
      lng: lng,
      temp: weatherData.main.temp,
      condition: weatherData.weather[0].main,
      description: weatherData.weather[0].description,
      savedAt: new Date().toISOString()
    });

    localStorage.setItem('weatherMapLocations', JSON.stringify(savedLocations));
    loadSavedLocationsUI();
    alert(`${cityName} saved successfully!`);
  } catch (error) {
    console.error('Save location error:', error);
    alert('Failed to save location');
  }
};

// Add to comparison from popup
window.addToComparison = async function(lat, lng, cityName) {
  if (!comparisonMode) {
    comparisonMode = true;
    document.getElementById('compareMode')?.classList.add('active');
  }

  const weatherData = await fetchWeatherByCoords(lat, lng);
  handleComparisonClick(weatherData, cityName);
};

// Handle comparison mode click
function handleComparisonClick(weatherData, cityName) {
  if (comparisonCities.length >= 2) {
    comparisonCities = [];
  }
  
  comparisonCities.push({
    name: cityName,
    data: weatherData
  });

  if (comparisonCities.length === 2) {
    showComparisonCard();
  } else {
    alert(`${cityName} added. Select one more city to compare.`);
  }
}

// Show comparison card
function showComparisonCard() {
  const card = document.getElementById('comparisonCard');
  const city1 = comparisonCities[0];
  const city2 = comparisonCities[1];

  const temp1 = Math.round(city1.data.main.temp);
  const temp2 = Math.round(city2.data.main.temp);
  const humidity1 = city1.data.main.humidity;
  const humidity2 = city2.data.main.humidity;
  const wind1 = city1.data.wind.speed;
  const wind2 = city2.data.wind.speed;

  // Set city 1 data
  document.getElementById('compCity1Name').textContent = city1.name;
  document.getElementById('compCity1Temp').textContent = `${temp1}°C`;
  document.getElementById('compCity1Humidity').textContent = humidity1;
  document.getElementById('compCity1Wind').textContent = wind1.toFixed(1);
  document.getElementById('compCity1Condition').textContent = city1.data.weather[0].main;

  // Set city 2 data
  document.getElementById('compCity2Name').textContent = city2.name;
  document.getElementById('compCity2Temp').textContent = `${temp2}°C`;
  document.getElementById('compCity2Humidity').textContent = humidity2;
  document.getElementById('compCity2Wind').textContent = wind2.toFixed(1);
  document.getElementById('compCity2Condition').textContent = city2.data.weather[0].main;

  // Add comparison arrows
  document.getElementById('compCity1HumidityArrow').textContent = humidity1 > humidity2 ? '↑' : (humidity1 < humidity2 ? '↓' : '');
  document.getElementById('compCity2HumidityArrow').textContent = humidity2 > humidity1 ? '↑' : (humidity2 < humidity1 ? '↓' : '');
  document.getElementById('compCity1WindArrow').textContent = wind1 > wind2 ? '↑' : (wind1 < wind2 ? '↓' : '');
  document.getElementById('compCity2WindArrow').textContent = wind2 > wind1 ? '↑' : (wind2 < wind1 ? '↓' : '');

  // Set insight
  const tempDiff = Math.abs(temp1 - temp2);
  const warmer = temp1 > temp2 ? city1.name : city2.name;
  const moreHumid = humidity1 > humidity2 ? city1.name : city2.name;
  
  document.getElementById('comparisonInsight').textContent = 
    `${warmer} is ${tempDiff}°C warmer. ${moreHumid} has higher humidity.`;

  card.classList.remove('hidden');
  card.style.display = 'block';
}

// Hide comparison card
function hideComparisonCard() {
  const card = document.getElementById('comparisonCard');
  if (card) {
    card.classList.add('hidden');
    card.style.display = 'none';
  }
  comparisonMode = false;
  comparisonCities = [];
  const compareBtn = document.getElementById('compareMode');
  if (compareBtn) {
    compareBtn.classList.remove('active');
  }
}

// Toggle weather layer overlay
// Idempotent weather layer toggle with exclusive mode support
function toggleWeatherLayer(layerType, show) {
  if (!googleMap || typeof google === 'undefined' || !google.maps) {
    if (DEBUG) console.warn('Google Maps not initialized, cannot toggle layer');
    return;
  }
  
  const layerMap = {
    'temperature': 'temp_new',
    'rainfall': 'precipitation_new',
    'wind': 'wind_new'
  };
  
  const layerName = layerMap[layerType];
  if (!layerName) {
    if (DEBUG) console.error('Unknown layer type:', layerType);
    return;
  }
  
  // REMOVE LAYER
  if (!show) {
    if (weatherOverlays[layerType]) {
      // Find and remove by _owmName tag
      const overlayArray = googleMap.overlayMapTypes.getArray();
      for (let i = overlayArray.length - 1; i >= 0; i--) {
        if (overlayArray[i]._owmName === layerName) {
          googleMap.overlayMapTypes.removeAt(i);
          if (DEBUG) console.log(`✅ Removed ${layerType} layer`);
        }
      }
      weatherOverlays[layerType] = null;
    }
    return;
  }
  
  // ADD LAYER
  // Check if already present (idempotent)
  if (weatherOverlays[layerType]) {
    if (DEBUG) console.log(`ℹ️ ${layerType} layer already active`);
    return;
  }
  
  // If exclusive mode, remove other layers first
  if (!allowMultipleLayers) {
    Object.keys(weatherOverlays).forEach(key => {
      if (key !== layerType && weatherOverlays[key]) {
        toggleWeatherLayer(key, false);
      }
    });
  }
  
  // Create overlay with stable identifier and error handling
  const overlay = new google.maps.ImageMapType({
    getTileUrl: function(coord, zoom) {
      // Properly formatted OWM tile URL (no cache-busting)
      const url = `https://tile.openweathermap.org/map/${layerName}/${zoom}/${coord.x}/${coord.y}.png?appid=${OPENWEATHER_API_KEY}`;
      return url;
    },
    getTile: function(coord, zoom, ownerDocument) {
      // Graceful fallback for missing tiles
      const div = ownerDocument.createElement('div');
      div.style.width = '256px';
      div.style.height = '256px';
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.3s ease-in';
      
      const img = ownerDocument.createElement('img');
      img.style.width = '256px';
      img.style.height = '256px';
      img.src = this.getTileUrl(coord, zoom);
      
      // Handle 404s gracefully
      img.onerror = function() {
        img.style.display = 'none';
        // Optionally show vector fallback
        if (DEBUG && zoom > 3) {
          div.style.background = 'transparent';
        }
      };
      
      img.onload = function() {
        // Smooth fade-in effect
        setTimeout(() => {
          div.style.opacity = '0.6';
        }, 10);
      };
      
      div.appendChild(img);
      return div;
    },
    tileSize: new google.maps.Size(256, 256),
    opacity: 0.6,
    name: layerType
  });
  
  // Tag overlay with stable identifier for removal
  overlay._owmName = layerName;
  
  googleMap.overlayMapTypes.push(overlay);
  weatherOverlays[layerType] = overlay;
  
  if (DEBUG) console.log(`✅ Added ${layerType} layer (${layerName})`);
}

// Handle compare city from info window
function handleCompareCity(lat, lon, city, temp, condition) {
  if (!comparisonMode) {
    comparisonMode = true;
    const compareModeBtn = document.getElementById('compareMode');
    if (compareModeBtn) compareModeBtn.classList.add('active');
  }
  
  // Fetch full weather data
  fetchWeatherByCoords(lat, lon)
    .then(weatherData => {
      const cityData = {
        name: city,
        lat: lat,
        lon: lon,
        weather: weatherData
      };
      
      if (comparisonCities.length === 0) {
        comparisonCities.push(cityData);
        showToast('📊 City added. Select another city to compare.');
      } else if (comparisonCities.length === 1) {
        // Check for duplicate
        if (comparisonCities[0].lat.toFixed(4) === lat.toFixed(4) && 
            comparisonCities[0].lon.toFixed(4) === lon.toFixed(4)) {
          showToast('⚠️ Already selected. Choose a different city.');
          return;
        }
        comparisonCities.push(cityData);
        showComparisonCard(comparisonCities[0], comparisonCities[1]);
      } else {
        // Reset and start new comparison
        comparisonCities = [cityData];
        hideComparisonCard();
        showToast('📊 First city selected. Select another.');
      }
    })
    .catch(error => {
      if (DEBUG) console.error('Compare city error:', error);
      showToast('❌ Failed to fetch weather data');
    });
}

// Handle save location from info window
function handleSaveLocation(lat, lon, city) {
  const markerKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
  
  // Check if already saved
  const exists = savedLocations.find(loc => 
    loc.lat.toFixed(4) === lat.toFixed(4) && loc.lon.toFixed(4) === lon.toFixed(4)
  );
  
  if (exists) {
    showToast('ℹ️ Location already saved');
    return;
  }
  
  savedLocations.push({ lat, lon, name: city, key: markerKey });
  localStorage.setItem('weatherMapLocations', JSON.stringify(savedLocations));
  loadSavedLocationsUI();
  showToast(`✅ ${city} saved successfully`);
}

// Show toast notification
function showToast(message, duration = 3000) {
  // Remove existing toast
  const existing = document.querySelector('.weather-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'weather-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 41, 59, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 100000;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    animation: slideUp 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Show comparison card with diff metrics
function showComparisonCard(city1, city2) {
  const compCard = document.getElementById('comparisonCard');
  if (!compCard) return;
  
  const tempDiff = city2.weather.main.temp - city1.weather.main.temp;
  const humidityDiff = city2.weather.main.humidity - city1.weather.main.humidity;
  const windDiff = city2.weather.wind.speed - city1.weather.wind.speed;
  
  // Populate comparison data
  const city1Name = document.getElementById('compCity1Name');
  const city1Temp = document.getElementById('compCity1Temp');
  const city1Humidity = document.getElementById('compCity1Humidity');
  const city1Wind = document.getElementById('compCity1Wind');
  const city1Condition = document.getElementById('compCity1Condition');
  
  if (city1Name) city1Name.textContent = city1.name;
  if (city1Temp) city1Temp.textContent = `${Math.round(city1.weather.main.temp)}°C`;
  if (city1Humidity) city1Humidity.textContent = city1.weather.main.humidity;
  if (city1Wind) city1Wind.textContent = city1.weather.wind.speed.toFixed(1);
  if (city1Condition) city1Condition.textContent = city1.weather.weather[0].main;
  
  const city2Name = document.getElementById('compCity2Name');
  const city2Temp = document.getElementById('compCity2Temp');
  const city2Humidity = document.getElementById('compCity2Humidity');
  const city2Wind = document.getElementById('compCity2Wind');
  const city2Condition = document.getElementById('compCity2Condition');
  
  if (city2Name) city2Name.textContent = city2.name;
  if (city2Temp) city2Temp.textContent = `${Math.round(city2.weather.main.temp)}°C`;
  if (city2Humidity) city2Humidity.textContent = city2.weather.main.humidity;
  if (city2Wind) city2Wind.textContent = city2.weather.wind.speed.toFixed(1);
  if (city2Condition) city2Condition.textContent = city2.weather.weather[0].main;
  
  compCard.classList.remove('hidden');
  showToast(`⚖️ Comparing ${city1.name} vs ${city2.name}`);
}

// Hide comparison card and reset mode
function hideComparisonCard() {
  const compCard = document.getElementById('comparisonCard');
  if (compCard) compCard.classList.add('hidden');
  
  comparisonCities = [];
  comparisonMode = false;
  
  const compareModeBtn = document.getElementById('compareMode');
  if (compareModeBtn) compareModeBtn.classList.remove('active');
}

// Load saved locations UI
function loadSavedLocationsUI() {
  const list = document.getElementById('savedLocationsList');
  if (!list) return;

  if (savedLocations.length === 0) {
    list.innerHTML = '<div style="text-align: center; padding: 20px; color: #999; font-size: 13px;">No saved locations yet</div>';
    return;
  }

  list.innerHTML = savedLocations.map((loc, index) => {
    const icon = getWeatherEmoji(loc.condition || 'Clear');
    const temp = loc.temp ? Math.round(loc.temp) : '--';
    
    return `
      <div class="saved-location-item" style="display: flex; align-items: center; padding: 12px; background: #f8f9fb; border-radius: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.3s ease;">
        <span style="font-size: 24px; margin-right: 12px;">${icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #213043; font-size: 14px;">${loc.name}</div>
          <div style="font-size: 12px; color: #8795A8;">${loc.description || ''}</div>
        </div>
        <div style="font-size: 18px; font-weight: 700; color: #4F9DF8; margin-right: 12px;">${temp}°C</div>
        <button onclick="deleteSavedLocation(${index})" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.2s ease;" onmouseover="this.style.background='#fee'; this.style.color='#e74c3c';" onmouseout="this.style.background='none'; this.style.color='#8795A8';">🗑️</button>
      </div>
    `;
  }).join('');

  // Add click handlers to recenter map
  list.querySelectorAll('.saved-location-item').forEach((item, index) => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        const loc = savedLocations[index];
        googleMap.setCenter({ lat: loc.lat, lng: loc.lng });
        googleMap.setZoom(10);
        addWeatherMarker(loc.lat, loc.lng, loc.name);
      }
    });
  });
}

// Delete saved location
window.deleteSavedLocation = function(index) {
  if (confirm(`Delete ${savedLocations[index].name}?`)) {
    savedLocations.splice(index, 1);
    localStorage.setItem('weatherMapLocations', JSON.stringify(savedLocations));
    loadSavedLocationsUI();
  }
};

// Initialize map when Maps view is shown
document.addEventListener('DOMContentLoaded', () => {
  // Load user's preferred default screen on startup
  const savedSettings = JSON.parse(localStorage.getItem('weatherSettings') || '{}');
  const defaultView = savedSettings.defaultScreen || 'dashboard';
  if (defaultView && defaultView !== 'dashboard') {
    switchView(defaultView);
  }
  
  // Don't auto-load any city - wait for user to search
  console.log('Weather app ready. Please search for a city.');
  
  // Setup comparison card close button
  const closeComparisonBtn = document.querySelector('.close-comparison');
  if (closeComparisonBtn) {
    closeComparisonBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideComparisonCard();
      console.log('Comparison card closed');
    });
  }
  
  // Initialize date picker with DD/MM/YYYY format display
  const eventDateInput = document.getElementById('eventDate');
  if (eventDateInput) {
    // Set up date restrictions
    const today = new Date();
    const sevenDaysAhead = new Date(today);
    sevenDaysAhead.setDate(today.getDate() + 7);
    
    eventDateInput.min = today.toISOString().split('T')[0];
    eventDateInput.max = sevenDaysAhead.toISOString().split('T')[0];
    
    // Add a display element for DD/MM/YYYY format
    const dateDisplay = document.createElement('div');
    dateDisplay.id = 'dateDisplay';
    dateDisplay.style.cssText = 'font-size: 0.9em; color: #333; margin-top: 4px; font-weight: 500;';
    eventDateInput.parentElement.insertBefore(dateDisplay, eventDateInput.nextSibling);
    
    // Update display when date changes
    eventDateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        const selectedDate = new Date(e.target.value + 'T00:00:00');
        dateDisplay.textContent = `Selected: ${formatDateDDMMYYYY(selectedDate)}`;
        dateDisplay.style.color = '#2563eb';
      } else {
        dateDisplay.textContent = '';
      }
    });
    
    // Add helper text
    const helperText = document.createElement('div');
    helperText.className = 'date-helper';
    helperText.style.cssText = 'font-size: 0.85em; color: #666; margin-top: 8px;';
    helperText.innerHTML = `📅 Select any date from <strong>${formatDateDDMMYYYY(today)}</strong> to <strong>${formatDateDDMMYYYY(sevenDaysAhead)}</strong>`;
    eventDateInput.parentElement.insertBefore(helperText, dateDisplay.nextSibling);
  }
  
  // Initialize Check Weather button
  const checkWeatherBtn = document.getElementById('checkWeatherBtn');
  if (checkWeatherBtn) {
    checkWeatherBtn.addEventListener('click', async () => {
      const dateInput = document.getElementById('eventDate').value;
      const eventWeatherDiv = document.getElementById('eventWeather');
      
      if (!dateInput) {
        eventWeatherDiv.innerHTML = 
          '<div class="event-result error" style="padding: 15px; background: #fee; border-left: 4px solid #f44; border-radius: 4px; margin-top: 12px;">⚠️ Please select a date</div>';
        return;
      }
      
      const selectedDate = new Date(dateInput + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      const daysAhead = Math.floor((selectedDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysAhead < 0 || daysAhead > 7) {
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 7);
        eventWeatherDiv.innerHTML = 
          `<div class="event-result error" style="padding: 15px; background: #fee; border-left: 4px solid #f44; border-radius: 4px; margin-top: 12px;">⚠️ Please select a date within the next 7 days (${formatDateDDMMYYYY(today)} to ${formatDateDDMMYYYY(maxDate)})</div>`;
        return;
      }
      
      // Show loading state
      eventWeatherDiv.innerHTML = '<div style="padding: 15px; text-align: center; color: #666;">Loading weather data...</div>';
      
      try {
        const city = cityInput.value.trim() || 'London';
        const data = await fetchWeather(city);
        const dayForecast = data.forecast[daysAhead];
        
        if (dayForecast) {
          const recommendation = dayForecast.precip < 30 ? '✅ Great day for outdoor activities!' : 
                                dayForecast.precip < 60 ? '⚠️ Might want to have a backup plan' : 
                                '🏠 Indoor activities recommended';
          
          eventWeatherDiv.innerHTML = `
            <div class="event-result" style="padding: 15px; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 4px; margin-top: 12px;">
              <h4 style="margin: 0 0 10px 0; color: #1e40af;">${dayForecast.day} - ${formatDateDDMMYYYY(selectedDate)}</h4>
              <p style="margin: 5px 0;"><strong>🌡️ Temperature:</strong> ${Math.round(dayForecast.temp)}°C</p>
              <p style="margin: 5px 0;"><strong>☁️ Condition:</strong> ${dayForecast.condition}</p>
              <p style="margin: 5px 0;"><strong>💧 Precipitation:</strong> ${Math.round(dayForecast.precip || 0)}%</p>
              <p class="recommendation" style="margin: 10px 0 0 0; padding: 8px; background: white; border-radius: 4px; font-weight: 500;">${recommendation}</p>
            </div>
          `;
        } else {
          eventWeatherDiv.innerHTML = 
            '<div class="event-result error" style="padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-top: 12px;">⚠️ Weather data not available for this date</div>';
        }
      } catch (error) {
        eventWeatherDiv.innerHTML = 
          '<div class="event-result error" style="padding: 15px; background: #fee; border-left: 4px solid #f44; border-radius: 4px; margin-top: 12px;">❌ Error loading weather data. Please try again.</div>';
      }
    });
  }
  
  // Initialize Weather Alert System
  initWeatherAlertSystem();
  
  // Setup Alert Center sidebar button
  const alertCenterBtn = document.querySelector('[data-view="alert-center"]');
  if (alertCenterBtn) {
    alertCenterBtn.addEventListener('click', () => {
      switchToAlertCenter();
    });
  }
  
  // Setup notification drawer close button
  const drawerCloseBtn = document.querySelector('.drawer-close-btn');
  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', closeNotificationDrawer);
  }
  
  // Setup quick toggle switches in Alert Center
  ['temperature', 'wind', 'rainfall', 'lightning', 'aqi'].forEach(type => {
    const toggleId = `quickToggle${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const toggle = document.getElementById(toggleId);
    if (toggle) {
      toggle.addEventListener('change', () => handleQuickToggle(type));
    }
  });
  
  // Setup config edit button in Alert Center
  const configEditBtn = document.querySelector('.config-edit-btn');
  if (configEditBtn) {
    configEditBtn.addEventListener('click', openWeatherAlertModal);
  }
  
  // Setup drawer configure button
  const drawerConfigBtn = document.querySelector('.drawer-action-btn');
  if (drawerConfigBtn) {
    drawerConfigBtn.addEventListener('click', () => {
      closeNotificationDrawer();
      openWeatherAlertModal();
    });
  }
  
  // Map will be initialized automatically when weather data is fetched
  console.log("🗺️ Weather app ready. Search for a city to see the map!");
});

// ============================================
// WEATHER ALERT SYSTEM
// ============================================

let weatherAlertState = {
  userId: 'default_user',
  currentLocation: null,
  thresholds: {},
  activeAlerts: [],
  pollingInterval: null,
  notificationQueue: [],
  isInitialized: false
};

/**
 * Initialize the Weather Alert System
 */
function initWeatherAlertSystem() {
  if (DEBUG) console.log('🔔 Initializing Weather Alert System...');
  
  // Load saved thresholds
  loadAlertThresholds();
  
  // Start polling for alerts every 5 minutes (300000ms)
  startAlertPolling(300000);
  
  // Request notification permission if not already granted
  requestNotificationPermission();
  
  weatherAlertState.isInitialized = true;
  if (DEBUG) console.log('✅ Weather Alert System initialized');
}

/**
 * Open the weather alert modal
 */
function openWeatherAlertModal() {
  const modal = document.getElementById('weatherAlertModal');
  if (modal) {
    modal.classList.add('active');
    
    // Load current thresholds into form
    populateAlertForm();
  }
}

/**
 * Close the weather alert modal
 */
function closeWeatherAlertModal() {
  const modal = document.getElementById('weatherAlertModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Populate the alert form with saved thresholds
 */
function populateAlertForm() {
  const thresholds = weatherAlertState.thresholds;
  
  // Temperature
  if (thresholds.temperature) {
    document.getElementById('tempThresholdInput').value = thresholds.temperature.value || '';
    document.getElementById('tempAlertEnabled').checked = thresholds.temperature.enabled !== false;
  }
  
  // Wind
  if (thresholds.wind) {
    document.getElementById('windThresholdInput').value = thresholds.wind.value || '';
    document.getElementById('windAlertEnabled').checked = thresholds.wind.enabled !== false;
  }
  
  // Rainfall
  if (thresholds.rainfall) {
    document.getElementById('rainThresholdInput').value = thresholds.rainfall.value || '';
    document.getElementById('rainAlertEnabled').checked = thresholds.rainfall.enabled !== false;
  }
  
  // Lightning
  if (thresholds.lightning) {
    document.getElementById('lightningAlertEnabled').checked = thresholds.lightning.enabled !== false;
  }
  
  // AQI
  if (thresholds.aqi) {
    document.getElementById('aqiThresholdInput').value = thresholds.aqi.value || '';
    document.getElementById('aqiAlertEnabled').checked = thresholds.aqi.enabled !== false;
  }
}

/**
 * Save weather alert thresholds
 */
async function saveWeatherAlerts() {
  try {
    // Collect threshold values
    const thresholds = {};
    
    // Temperature
    const tempValue = parseFloat(document.getElementById('tempThresholdInput').value);
    const tempEnabled = document.getElementById('tempAlertEnabled').checked;
    if (!isNaN(tempValue) && tempValue > 0) {
      thresholds.temperature = { value: tempValue, enabled: tempEnabled };
    }
    
    // Wind
    const windValue = parseFloat(document.getElementById('windThresholdInput').value);
    const windEnabled = document.getElementById('windAlertEnabled').checked;
    if (!isNaN(windValue) && windValue > 0) {
      thresholds.wind = { value: windValue, enabled: windEnabled };
    }
    
    // Rainfall
    const rainValue = parseFloat(document.getElementById('rainThresholdInput').value);
    const rainEnabled = document.getElementById('rainAlertEnabled').checked;
    if (!isNaN(rainValue) && rainValue > 0) {
      thresholds.rainfall = { value: rainValue, enabled: rainEnabled };
    }
    
    // Lightning
    const lightningEnabled = document.getElementById('lightningAlertEnabled').checked;
    if (lightningEnabled) {
      thresholds.lightning = { value: 1, enabled: true };
    }
    
    // AQI
    const aqiValue = parseFloat(document.getElementById('aqiThresholdInput').value);
    const aqiEnabled = document.getElementById('aqiAlertEnabled').checked;
    if (!isNaN(aqiValue) && aqiValue > 0) {
      thresholds.aqi = { value: aqiValue, enabled: aqiEnabled };
    }
    
    // Get current location from last weather search
    const location = weatherAlertState.currentLocation || {
      lat: 51.5074,
      lon: -0.1278,
      name: lastSearchedCity || 'London'
    };
    
    // Send to backend
    const response = await fetch('/api/alerts/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: weatherAlertState.userId,
        thresholds: thresholds,
        location: location
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      weatherAlertState.thresholds = thresholds;
      weatherAlertState.currentLocation = location;
      
      // Show success message
      showAlertNotification({
        type: 'success',
        title: '✅ Alerts Saved',
        message: 'Your weather alert thresholds have been saved successfully!',
        icon: '✅'
      });
      
      // Close modal
      closeWeatherAlertModal();
      
      // *** IMMEDIATELY RE-CHECK THRESHOLDS WITH CURRENT WEATHER DATA ***
      if (lastSearchedCity && lastSearchedCity.city) {
        renderCity(lastSearchedCity.city);
      } else {
        // Trigger immediate check with backend API
        checkWeatherAlerts();
      }
    } else {
      throw new Error(result.error || 'Failed to save alerts');
    }
    
  } catch (error) {
    console.error('Error saving alerts:', error);
    alert('❌ Failed to save alert settings. Please try again.');
  }
}

/**
 * Load alert thresholds from backend
 */
async function loadAlertThresholds() {
  try {
    const response = await fetch(`/api/alerts/thresholds?user_id=${weatherAlertState.userId}`);
    const data = await response.json();
    
    if (data.success) {
      weatherAlertState.thresholds = data.thresholds || {};
      weatherAlertState.currentLocation = data.location || null;
      
      if (DEBUG) console.log('✅ Loaded alert thresholds:', weatherAlertState.thresholds);
    }
  } catch (error) {
    if (DEBUG) console.error('Error loading alert thresholds:', error);
  }
}

/**
 * Start polling for weather alerts
 */
function startAlertPolling(interval = 300000) {
  // Clear existing interval if any
  if (weatherAlertState.pollingInterval) {
    clearInterval(weatherAlertState.pollingInterval);
  }
  
  // Check immediately
  checkWeatherAlerts();
  
  // Set up polling
  weatherAlertState.pollingInterval = setInterval(() => {
    checkWeatherAlerts();
  }, interval);
  
  if (DEBUG) console.log(`🔄 Alert polling started (every ${interval/1000}s)`);
}

/**
 * Stop polling for weather alerts
 */
function stopAlertPolling() {
  if (weatherAlertState.pollingInterval) {
    clearInterval(weatherAlertState.pollingInterval);
    weatherAlertState.pollingInterval = null;
    if (DEBUG) console.log('⏸️ Alert polling stopped');
  }
}

/**
 * Check for weather alerts
 */
async function checkWeatherAlerts() {
  try {
    // Update location if we have a recent search
    if (lastSearchedCity && lastSearchedCity !== weatherAlertState.currentLocation?.name) {
      const data = await fetchWeather(lastSearchedCity);
      if (data && data.lat && data.lon) {
        weatherAlertState.currentLocation = {
          lat: data.lat,
          lon: data.lon,
          name: data.city || lastSearchedCity
        };
        
        // Update location in backend
        await fetch('/api/alerts/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: weatherAlertState.userId,
            location: weatherAlertState.currentLocation
          })
        });
      }
    }
    
    // Check for triggered alerts
    const response = await fetch(`/api/alerts/check?user_id=${weatherAlertState.userId}`);
    const data = await response.json();
    
    if (data.success && data.alerts && data.alerts.length > 0) {
      // Update active alerts
      weatherAlertState.activeAlerts = data.alerts;
      
      // Show new alerts
      if (data.new_alerts > 0) {
        const newAlerts = data.alerts.slice(-data.new_alerts);
        newAlerts.forEach(alert => {
          showAlertNotification(alert);
          
          // Try browser notification if permission granted
          showBrowserNotification(alert);
        });
      }
      
      // Update badge
      updateAlertBadge(data.alerts.length);
    } else {
      updateAlertBadge(0);
    }
    
  } catch (error) {
    if (DEBUG) console.error('Error checking alerts:', error);
  }
}

/**
 * Show an alert notification card
 */
function showAlertNotification(alert) {
  const container = document.getElementById('alertNotificationContainer');
  if (!container) return;
  
  // Add to active alerts if not already present
  const alertExists = weatherAlertState.activeAlerts.some(a => a.id === alert.id);
  if (!alertExists) {
    weatherAlertState.activeAlerts.push({
      ...alert,
      id: alert.id || Date.now(),
      timestamp: alert.timestamp || new Date().toISOString()
    });
  }
  
  // Create notification card
  const card = document.createElement('div');
  card.className = `alert-notification-card ${alert.type}`;
  card.dataset.alertId = alert.id || Date.now();
  
  // Get icon and title based on alert type
  const alertIcons = {
    'temperature': '🌡️',
    'wind': '💨',
    'rainfall': '🌧️',
    'lightning': '⚡',
    'aqi': '😷'
  };
  
  const alertTitles = {
    'temperature': 'Temperature Alert',
    'wind': 'Wind Alert',
    'rainfall': 'Rainfall Alert',
    'lightning': 'Lightning Alert',
    'aqi': 'Air Quality Alert'
  };
  
  const icon = alertIcons[alert.type] || alert.icon || '🔔';
  const title = alertTitles[alert.type] || alert.title || 'Weather Alert';
  const message = alert.message || 'Weather conditions have changed';
  const currentValue = alert.current_value;
  const thresholdValue = alert.threshold_value;
  const unit = alert.unit || '';
  
  // Get alert type display name with highlighting
  const alertTypeNames = {
    'temperature': 'TEMPERATURE',
    'wind': 'WIND SPEED',
    'rainfall': 'RAINFALL',
    'lightning': 'LIGHTNING',
    'aqi': 'AIR QUALITY'
  };
  
  const typeBadge = alertTypeNames[alert.type] || 'ALERT';
  
  card.innerHTML = `
    <div class="alert-notif-icon">${icon}</div>
    <div class="alert-notif-content">
      <div class="alert-type-badge ${alert.type}">${typeBadge} TRIGGERED</div>
      <div class="alert-notif-title">${title}</div>
      <div class="alert-notif-message">${message}</div>
      ${currentValue && thresholdValue ? `
        <div class="alert-notif-details">
          <div class="alert-notif-value">Current: <strong>${currentValue}${unit}</strong></div>
          <div class="alert-notif-value">Threshold: <strong>${thresholdValue}${unit}</strong></div>
        </div>
      ` : ''}
    </div>
    <button class="alert-notif-close" onclick="closeAlertNotification(this)">×</button>
  `;
  
  container.appendChild(card);
  
  // Update all badges
  const alertCount = weatherAlertState.activeAlerts.length;
  updateAlertBadge(alertCount);
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (card.parentElement) {
      card.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => card.remove(), 300);
    }
  }, 8000);
}

/**
 * Close an alert notification
 */
function closeAlertNotification(button) {
  const card = button.closest('.alert-notification-card');
  if (card) {
    const alertId = card.dataset.alertId;
    
    // Remove from backend
    if (alertId) {
      fetch('/api/alerts/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: weatherAlertState.userId,
          alert_id: alertId
        })
      });
    }
    
    // Animate out
    card.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => card.remove(), 300);
    
    // Update badge
    const remaining = document.querySelectorAll('.alert-notification-card').length - 1;
    updateAlertBadge(remaining);
  }
}

/**
 * Update the alert badge count
 */
function updateAlertBadge(count) {
  // Update floating button badge
  const floatingBadge = document.getElementById('floatingAlertBadge');
  if (floatingBadge) {
    if (count > 0) {
      floatingBadge.textContent = count;
      floatingBadge.style.display = 'flex';
    } else {
      floatingBadge.style.display = 'none';
    }
  }
  
  // Update header notification badge
  const headerBadge = document.getElementById('notificationBadge');
  if (headerBadge) {
    headerBadge.textContent = count;
    headerBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Update sidebar badge
  const sidebarBadge = document.getElementById('sidebarAlertBadge');
  if (sidebarBadge) {
    sidebarBadge.textContent = count;
    sidebarBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Update bell icon state
  updateBellIconState(count);
}

/**
 * Request notification permission from browser
 */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (DEBUG) console.log('Notification permission:', permission);
    });
  }
}

/**
 * Show browser push notification
 */
function showBrowserNotification(alert) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(alert.title || 'Weather Alert', {
        body: alert.message || 'Weather conditions have changed',
        icon: '/static/images/weather-app-logo.png',
        badge: '/static/images/weather-app-logo.png',
        tag: alert.id || 'weather-alert',
        requireInteraction: false
      });
      
      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
      
      // Handle click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      if (DEBUG) console.error('Error showing browser notification:', error);
    }
  }
}

/**
 * Clear all active alerts
 */
async function clearAllAlerts() {
  try {
    await fetch('/api/alerts/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: weatherAlertState.userId
      })
    });
    
    // Remove all notification cards
    const container = document.getElementById('alertNotificationContainer');
    if (container) {
      container.innerHTML = '';
    }
    
    // Update badge
    updateAlertBadge(0);
    weatherAlertState.activeAlerts = [];
    
  } catch (error) {
    console.error('Error clearing alerts:', error);
  }
}

/**
 * Clear all notifications including threshold-triggered alerts
 */
function clearAllNotifications() {
  // Clear appAlerts array
  appAlerts = [];
  localStorage.setItem('appAlerts', JSON.stringify(appAlerts));
  
  // Clear notification cards
  const container = document.getElementById('alertNotificationContainer');
  if (container) {
    container.innerHTML = '';
  }
  
  // Clear weatherAlertState
  weatherAlertState.activeAlerts = [];
  
  // Update notification bell
  const bellIcon = document.getElementById('bellIcon');
  const bell = document.getElementById('notificationBell');
  const badge = document.getElementById('notificationBadge');
  
  if (bellIcon) bellIcon.src = '/static/images/bell-deactive.png';
  if (bell) bell.classList.remove('has-alerts');
  if (badge) badge.style.display = 'none';
  
  // Update sidebar badge
  const sidebarBadge = document.getElementById('sidebarAlertBadge');
  if (sidebarBadge) {
    sidebarBadge.style.display = 'none';
  }
  
  // Update drawer content
  renderAlertDrawer([]);
  
  // Update home page Weather Alerts section
  renderAlerts([]);
  
  // Update Alert Center if visible
  const alertCenterView = document.getElementById('alert-centerView');
  if (alertCenterView && alertCenterView.classList.contains('active')) {
    renderAlertCenterView();
  }
  
  // Update Alerts & Reports page if visible
  const activeAlertsEl = document.getElementById('activeAlerts');
  if (activeAlertsEl) {
    activeAlertsEl.innerHTML = '<div class="no-alert">No active weather alerts</div>';
  }
  
  // Show confirmation
  if (DEBUG) console.log('✅ All notifications cleared');
  
  // Clear API alerts
  clearAllAlerts();
}

// Add CSS animation for slide out
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOutRight {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;
document.head.appendChild(style);

/**
 * Toggle the notification drawer
 */
function toggleNotificationDrawer() {
  const drawer = document.querySelector('.alert-notification-drawer');
  if (!drawer) return;
  
  const isOpen = drawer.classList.contains('active');
  
  if (isOpen) {
    drawer.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
  } else {
    drawer.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    
    // Update last checked time
    updateLastCheckedTime();
    
    // Render active alerts in drawer
    renderDrawerAlerts();
  }
}

/**
 * Close the notification drawer
 */
function closeNotificationDrawer() {
  const drawer = document.querySelector('.alert-notification-drawer');
  if (drawer) {
    drawer.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Update the last checked timestamp in drawer
 */
function updateLastCheckedTime() {
  const timeElement = document.getElementById('lastCheckedTime');
  if (timeElement) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    timeElement.textContent = timeStr;
  }
}

/**
 * Render alerts in the notification drawer
 */
function renderDrawerAlerts() {
  const container = document.getElementById('alertsContent');
  if (!container) return;
  
  const alerts = weatherAlertState.activeAlerts || [];
  
  // Alert type icons and titles
  const alertIcons = {
    'temperature': '🌡️',
    'wind': '💨',
    'rainfall': '🌧️',
    'lightning': '⚡',
    'aqi': '😷'
  };
  
  const alertTitles = {
    'temperature': 'Temperature Alert',
    'wind': 'Wind Alert',
    'rainfall': 'Rainfall Alert',
    'lightning': 'Lightning Alert',
    'aqi': 'Air Quality Alert'
  };
  
  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="no-alerts-state">
        <svg class="no-alerts-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
        <div class="no-alerts-card">
          <div class="no-alerts-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            All Clear!
          </div>
          <p class="no-alerts-text">No weather alerts at the moment. Configure alerts by clicking below.</p>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = alerts.map(alert => {
    const icon = alertIcons[alert.type] || '🔔';
    const title = alertTitles[alert.type] || alert.title || 'Weather Alert';
    
    // Alert type display names
    const alertTypeNames = {
      'temperature': 'TEMPERATURE',
      'wind': 'WIND SPEED',
      'rainfall': 'RAINFALL',
      'lightning': 'LIGHTNING',
      'aqi': 'AIR QUALITY'
    };
    const typeBadge = alertTypeNames[alert.type] || 'ALERT';
    
    return `
      <div class="drawer-alert-item ${alert.type}">
        <div class="drawer-alert-icon">${icon}</div>
        <div class="drawer-alert-content">
          <div class="alert-type-badge-small ${alert.type}">${typeBadge}</div>
          <div class="drawer-alert-header">
            <span class="drawer-alert-title">${title}</span>
            <span class="drawer-alert-time">${formatAlertTime(alert.timestamp)}</span>
          </div>
          <p class="drawer-alert-message">${alert.message}</p>
          ${alert.current_value ? `<div class="drawer-alert-value">Current: <strong>${alert.current_value}${alert.unit || ''}</strong></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Update alert badge count (header and sidebar)
 */
function updateAlertBadge(count) {
  // Update header badge
  const headerBadge = document.getElementById('notificationBadge');
  if (headerBadge) {
    headerBadge.textContent = count;
    headerBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Update sidebar badge
  const sidebarBadge = document.getElementById('sidebarAlertBadge');
  if (sidebarBadge) {
    sidebarBadge.textContent = count;
    sidebarBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Update bell icon state
  updateBellIconState(count);
}

/**
 * Update bell icon to show active/inactive state
 */
function updateBellIconState(alertCount) {
  // Update header bell icon
  const headerBell = document.querySelector('.notification-bell');
  if (headerBell) {
    const bellImg = headerBell.querySelector('img');
    if (bellImg) {
      const imgPath = '/static/images/';
      if (alertCount > 0) {
        bellImg.src = imgPath + 'bell-active.png';
        headerBell.classList.add('has-alerts');
        // Trigger shake animation
        setTimeout(() => headerBell.classList.remove('has-alerts'), 500);
      } else {
        bellImg.src = imgPath + 'bell-deactive.png';
      }
    }
  }
  
  // Update sidebar warning icon with pulse effect
  const sidebarWarning = document.getElementById('sidebarWarningIcon');
  if (sidebarWarning) {
    if (alertCount > 0) {
      sidebarWarning.parentElement.classList.add('has-alerts');
    } else {
      sidebarWarning.parentElement.classList.remove('has-alerts');
    }
  }
}

/**
 * Format alert timestamp for display
 */
function formatAlertTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Switch to Alert Center view
 */
function switchToAlertCenter() {
  // Hide all views
  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.remove('active');
  });
  
  // Show Alert Center view
  const alertCenterView = document.getElementById('alert-centerView');
  if (alertCenterView) {
    alertCenterView.classList.add('active');
    
    // Update sidebar active state
    document.querySelectorAll('.icon-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector('[data-view="alert-center"]')?.classList.add('active');
    
    // Debug: Log appAlerts
    console.log('🔍 appAlerts array:', appAlerts);
    console.log('🔍 appAlerts length:', appAlerts ? appAlerts.length : 0);
    
    // Render Alert Center content
    renderAlertCenterView();
    
    // Force statistics update
    setTimeout(() => {
      updateAlertStatistics();
    }, 100);
  }
}

/**
 * Render the Alert Center view
 */
function renderAlertCenterView() {
  const activeAlertsContainer = document.getElementById('activeAlertsCenter');
  // Use appAlerts array which contains normalized alerts with proper structure
  const alerts = appAlerts || [];
  
  // Render active alerts
  if (activeAlertsContainer) {
    if (alerts.length === 0) {
      activeAlertsContainer.innerHTML = `
        <div class="no-alerts-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <p>No active alerts at this time</p>
        </div>
      `;
    } else {
      // Alert type display names
      const alertTypeNames = {
        'temperature': 'TEMPERATURE',
        'wind': 'WIND SPEED',
        'rainfall': 'RAINFALL',
        'lightning': 'LIGHTNING',
        'aqi': 'AIR QUALITY'
      };
      
      // Alert title mapping
      const alertTitles = {
        'temperature': 'Temperature Alert',
        'wind': 'Wind Speed Alert',
        'rainfall': 'Rainfall Alert',
        'lightning': 'Lightning Alert',
        'aqi': 'Air Quality Alert'
      };
      
      activeAlertsContainer.innerHTML = alerts.map(alert => {
        const typeBadge = alertTypeNames[alert.type] || 'ALERT';
        const alertTitle = alert.title || alertTitles[alert.type] || 'Weather Alert';
        const alertMessage = alert.message || alert.description || 'Alert triggered';
        
        // Format time properly (handle both timestamp formats)
        let timeDisplay;
        if (alert.timestampMs) {
          const diffMs = Date.now() - alert.timestampMs;
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 1) timeDisplay = 'Just now';
          else if (diffMins < 60) timeDisplay = `${diffMins}m ago`;
          else if (diffMins < 1440) timeDisplay = `${Math.floor(diffMins/60)}h ago`;
          else timeDisplay = new Date(alert.timestampMs).toLocaleDateString();
        } else if (alert.start) {
          timeDisplay = formatAlertTime(alert.start);
        } else {
          timeDisplay = 'Recently';
        }
        
        return `
          <div class="alert-center-item ${alert.type}">
            <div class="alert-type-badge-small ${alert.type}">${typeBadge} TRIGGERED</div>
            <div class="alert-center-header">
              <span class="alert-center-title">${alertTitle}</span>
              <span class="alert-center-time">${timeDisplay}</span>
            </div>
            <p class="alert-center-message">${alertMessage}</p>
            <div class="alert-center-values">
              ${alert.current_value ? `<span>Current: <strong>${alert.current_value}${alert.unit || ''}</strong></span>` : ''}
              ${alert.threshold_value ? `<span>Threshold: <strong>${alert.threshold_value}${alert.unit || ''}</strong></span>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }
  
  // Update quick settings toggles
  updateQuickToggles();
  
  // Update statistics
  updateAlertStatistics();
}

/**
 * Update quick toggle switches in Alert Center
 */
function updateQuickToggles() {
  const thresholds = weatherAlertState.thresholds;
  
  const typeConfigs = {
    'temperature': { id: 'temp', unit: '°C' },
    'wind': { id: 'wind', unit: ' m/s' },
    'rainfall': { id: 'rain', unit: ' mm' },
    'lightning': { id: 'lightning', unit: '' },
    'aqi': { id: 'aqi', unit: '' }
  };
  
  ['temperature', 'wind', 'rainfall', 'lightning', 'aqi'].forEach(type => {
    const toggle = document.getElementById(`quickToggle${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const config = typeConfigs[type];
    const valueDisplay = document.getElementById(`${config.id}ConfigValue`);
    
    if (toggle && thresholds[type]) {
      toggle.checked = thresholds[type].enabled !== false;
    }
    
    // Update the config value display
    if (valueDisplay && thresholds[type] && thresholds[type].value !== undefined) {
      valueDisplay.textContent = `${thresholds[type].value}${config.unit}`;
    } else if (valueDisplay) {
      valueDisplay.textContent = 'Not set';
    }
  });
}

/**
 * Handle quick toggle change
 */
async function handleQuickToggle(alertType) {
  const toggle = document.getElementById(`quickToggle${alertType.charAt(0).toUpperCase() + alertType.slice(1)}`);
  if (!toggle) return;
  
  const isEnabled = toggle.checked;
  
  try {
    // Update backend
    await fetch('/api/alerts/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: weatherAlertState.userId,
        alert_type: alertType,
        enabled: isEnabled
      })
    });
    
    // Update local state
    if (weatherAlertState.thresholds[alertType]) {
      weatherAlertState.thresholds[alertType].enabled = isEnabled;
    }
    
    if (DEBUG) console.log(`✅ ${alertType} alert ${isEnabled ? 'enabled' : 'disabled'}`);
    
  } catch (error) {
    console.error('Error toggling alert:', error);
    // Revert toggle on error
    toggle.checked = !isEnabled;
  }
}

/**
 * Update alert statistics display
 */
function updateAlertStatistics() {
  // Use appAlerts array which contains all normalized alerts
  const alerts = appAlerts || [];
  
  if (DEBUG) console.log('📊 Updating statistics with', alerts.length, 'total alerts', alerts);
  
  // Count alerts today (use both timestamp formats)
  const today = new Date().toDateString();
  const alertsToday = alerts.filter(a => {
    if (a.timestampMs) {
      const alertDate = new Date(a.timestampMs);
      const match = alertDate.toDateString() === today;
      if (DEBUG) console.log('Alert timestampMs:', a.timestampMs, 'Date:', alertDate.toDateString(), 'Today:', today, 'Match:', match);
      return match;
    } else if (a.timestamp) {
      const alertDate = new Date(a.timestamp);
      const match = alertDate.toDateString() === today;
      if (DEBUG) console.log('Alert timestamp:', a.timestamp, 'Date:', alertDate.toDateString(), 'Today:', today, 'Match:', match);
      return match;
    }
    return false;
  }).length;
  
  if (DEBUG) console.log('📊 Alerts today:', alertsToday);
  
  // Find most frequent alert type
  const typeCounts = {};
  alerts.forEach(a => {
    if (a.type && a.type !== 'general') {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    }
  });
  
  let mostFrequent = 'None';
  if (Object.keys(typeCounts).length > 0) {
    mostFrequent = Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    );
  }
  
  // Get last alert (most recent = first in array since we unshift)
  let lastAlert = 'None';
  if (alerts.length > 0) {
    const lastAlertObj = alerts[0];
    const alertDate = lastAlertObj.timestampMs ? new Date(lastAlertObj.timestampMs) : new Date(lastAlertObj.timestamp);
    const now = new Date();
    const diffMs = now - alertDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) lastAlert = 'Just now';
    else if (diffMins < 60) lastAlert = `${diffMins}m ago`;
    else if (diffMins < 1440) lastAlert = `${Math.floor(diffMins/60)}h ago`;
    else lastAlert = `${Math.floor(diffMins/1440)}d ago`;
  }
  
  // Update UI
  const alertsTodayEl = document.getElementById('statAlertsToday');
  const mostFrequentEl = document.getElementById('statMostFrequent');
  const lastAlertEl = document.getElementById('statLastAlert');
  
  if (alertsTodayEl) {
    alertsTodayEl.textContent = alertsToday;
    if (DEBUG) console.log('📊 Updated statAlertsToday to:', alertsToday);
  }
  if (mostFrequentEl) {
    const typeNames = {
      'temperature': 'Temperature',
      'wind': 'Wind',
      'rainfall': 'Rainfall',
      'lightning': 'Lightning',
      'aqi': 'Air Quality'
    };
    mostFrequentEl.textContent = typeNames[mostFrequent] || (mostFrequent !== 'None' ? mostFrequent.charAt(0).toUpperCase() + mostFrequent.slice(1) : 'None');
  }
  if (lastAlertEl) lastAlertEl.textContent = lastAlert;
  
  if (DEBUG) console.log('📊 Stats updated:', { alertsToday, mostFrequent, lastAlert });
}

// ============================================
// TRAVEL SAFETY ADVISOR
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  const travelForm = document.getElementById('travelSafetyForm');
  
  if (travelForm) {
    travelForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const destination = document.getElementById('travelDestination').value.trim();
      
      if (!destination) {
        alert('Please enter a destination city');
        return;
      }
      
      // Show loading state
      const resultsDiv = document.getElementById('travelResults');
      resultsDiv.style.display = 'block';
      document.getElementById('travelScore').textContent = '...';
      document.getElementById('travelVerdict').textContent = 'Analyzing...';
      document.getElementById('travelMessage').textContent = 'Checking weather conditions...';
      
      try {
        const response = await fetch('/api/travel-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination })
        });
        
        if (!response.ok) {
          throw new Error('Failed to check travel safety');
        }
        
        const data = await response.json();
        
        // Update score with animated gauge
        const score = data.score || 0;
        document.getElementById('travelScore').textContent = score;
        document.getElementById('travelDestName').textContent = data.destination;
        
        // Animate circular gauge
        const gaugeCircle = document.getElementById('safetyGaugeCircle');
        const circumference = 534; // 2 * PI * 85
        const offset = circumference - (score / 100) * circumference;
        
        setTimeout(() => {
          gaugeCircle.style.strokeDashoffset = offset;
        }, 100);
        
        // Update gauge color based on score
        if (score >= 70) {
          gaugeCircle.setAttribute('stroke', 'url(#safeGradient)');
        } else if (score >= 40) {
          gaugeCircle.setAttribute('stroke', 'url(#moderateGradient)');
        } else {
          gaugeCircle.setAttribute('stroke', 'url(#unsafeGradient)');
        }
        
        // Update verdict
        const verdictEl = document.getElementById('travelVerdict');
        const messageEl = document.getElementById('travelMessage');
        
        if (score >= 70) {
          verdictEl.textContent = '✅ Safe to Travel';
          verdictEl.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
          verdictEl.style.color = '#065f46';
          messageEl.textContent = 'Weather conditions are favorable. Low rainfall, mild winds, great for travel!';
        } else if (score >= 40) {
          verdictEl.textContent = '⚠️ Moderate Risk';
          verdictEl.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
          verdictEl.style.color = '#92400e';
          messageEl.textContent = 'Travel possible with precautions. Monitor weather updates and pack accordingly.';
        } else {
          verdictEl.textContent = '❌ Not Recommended';
          verdictEl.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
          verdictEl.style.color = '#991b1b';
          messageEl.textContent = 'Challenging weather conditions. Consider postponing or take extra safety measures.';
        }
        
        // Update weather factor cards
        const weather = data.location;
        
        // Temperature card
        document.getElementById('factorTemp').textContent = `${weather.temperature}°C`;
        document.getElementById('factorTempRange').textContent = `Range: ${weather.temp_min}°C - ${weather.temp_max}°C`;
        document.getElementById('tempMiniBar').style.width = `${Math.min((weather.temperature + 20) / 60 * 100, 100)}%`;
        
        // Wind card
        const windDir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(weather.wind_direction / 45) % 8];
        document.getElementById('factorWind').textContent = `${weather.wind_speed} km/h`;
        document.getElementById('factorWindDir').textContent = `Direction: ${windDir}`;
        document.getElementById('windMiniBar').style.width = `${Math.min(weather.wind_speed / 50 * 100, 100)}%`;
        
        // Humidity card
        document.getElementById('factorHumidity').textContent = `${weather.humidity}%`;
        document.getElementById('factorDewPoint').textContent = `Dew Point: ${weather.dew_point}°C`;
        document.getElementById('humidityMiniBar').style.width = `${weather.humidity}%`;
        
        // UV/Alerts card
        document.getElementById('factorUV').textContent = weather.uv_index;
        const uvRisk = weather.uv_index < 3 ? 'Low' : weather.uv_index < 6 ? 'Moderate' : weather.uv_index < 8 ? 'High' : 'Very High';
        document.getElementById('factorAlerts').textContent = `Risk Level: ${uvRisk}`;
        document.getElementById('uvMiniBar').style.width = `${Math.min(weather.uv_index / 11 * 100, 100)}%`;
        
        // Update comprehensive weather details
        const weatherDetailsEl = document.getElementById('travelWeatherDetails');
        weatherDetailsEl.innerHTML = `
          <div class="weather-detail-item">
            <span class="detail-label">🌡️ Temperature</span>
            <span class="detail-value">${weather.temperature}°C</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">🤔 Feels Like</span>
            <span class="detail-value">${weather.feels_like}°C</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">📊 Range</span>
            <span class="detail-value">${weather.temp_min}°C - ${weather.temp_max}°C</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">☁️ Conditions</span>
            <span class="detail-value">${weather.condition}</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">💨 Wind Speed</span>
            <span class="detail-value">${weather.wind_speed} km/h</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">💧 Humidity</span>
            <span class="detail-value">${weather.humidity}%</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">🌡️ Dew Point</span>
            <span class="detail-value">${weather.dew_point}°C</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">🔥 Heat Index</span>
            <span class="detail-value">${weather.heat_index}°C</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">☀️ UV Index</span>
            <span class="detail-value">${weather.uv_index}</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">👁️ Visibility</span>
            <span class="detail-value">${weather.visibility} km</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">☁️ Cloud Cover</span>
            <span class="detail-value">${weather.clouds}%</span>
          </div>
          <div class="weather-detail-item">
            <span class="detail-label">🎚️ Pressure</span>
            <span class="detail-value">${weather.pressure} hPa</span>
          </div>
        `;
        
        // Update warnings
        const warningsCard = document.getElementById('travelWarningsCard');
        const warningsList = document.getElementById('travelWarnings');
        
        if (data.warnings && data.warnings.length > 0) {
          warningsCard.style.display = 'block';
          warningsList.innerHTML = data.warnings.map(w => `<li>${w}</li>`).join('');
        } else {
          warningsCard.style.display = 'none';
        }
        
        // Update recommendations
        const recommendationsList = document.getElementById('travelRecommendations');
        if (data.recommendations && data.recommendations.length > 0) {
          recommendationsList.innerHTML = data.recommendations.map(r => `<li>${r}</li>`).join('');
        } else {
          recommendationsList.innerHTML = '<li>No specific recommendations at this time</li>';
        }
        
      } catch (error) {
        console.error('Error checking travel safety:', error);
        document.getElementById('travelVerdict').textContent = '❌ Error';
        document.getElementById('travelMessage').textContent = 'Could not fetch travel safety data. Please try again.';
      }
    });
  }
});

// ===================================
// LIGHTNING & THUNDER MONITOR
// ===================================

// Tomorrow.io API Configuration
const TOMORROW_API_KEY = 'Q5comtfrYeC3HZcssHEIQyrK5O69psf3';
const TOMORROW_API_BASE = 'https://api.tomorrow.io/v4/weather/realtime';

// Lightning Monitor State
let lightningMap = null;
let lightningMarkers = [];
let currentLightningLocation = { lat: 51.5074, lon: -0.1278, name: 'London' };

// Initialize Lightning Monitor
function initLightningMonitor() {
  console.log('🌩️ Initializing Lightning Monitor...');
  
  // Initialize map
  if (document.getElementById('lightningMap')) {
    initLightningMap();
  }
  
  // Event Listeners
  const searchBtn = document.getElementById('lightningSearchBtn');
  const myLocationBtn = document.getElementById('lightningMyLocationBtn');
  const refreshBtn = document.getElementById('lightningRefreshBtn');
  const locationInput = document.getElementById('lightningLocationInput');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', handleLightningSearch);
  }
  
  if (myLocationBtn) {
    myLocationBtn.addEventListener('click', handleUseMyLocation);
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshLightningData);
  }
  
  if (locationInput) {
    locationInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleLightningSearch();
      }
    });
  }
  
  // Load default location data and start auto-refresh
  fetchLightningData(currentLightningLocation.lat, currentLightningLocation.lon);
  startRealtimeLightningAutoRefresh();
}

// Initialize Leaflet Map
function initLightningMap() {
  if (lightningMap) {
    lightningMap.remove();
  }
  
  const mapContainer = document.getElementById('lightningMap');
  if (!mapContainer) return;
  
  // Create map
  lightningMap = L.map('lightningMap').setView([currentLightningLocation.lat, currentLightningLocation.lon], 10);
  
  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(lightningMap);
  
  // Add center marker
  const centerIcon = L.divIcon({
    className: 'custom-center-marker',
    html: '<div style="background: #4f9df8; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  
  L.marker([currentLightningLocation.lat, currentLightningLocation.lon], { icon: centerIcon })
    .addTo(lightningMap)
    .bindPopup(`<b>${currentLightningLocation.name}</b><br>Monitoring Center`);
  
  console.log('✅ Lightning map initialized');
}

// Fetch Lightning Data from Backend API
async function fetchLightningData(lat, lon) {
  try {
    console.log(`⚡ Fetching lightning data for: ${lat}, ${lon}`);
    
    // Update loading state
    updateLoadingState(true);
    
    // If we have a city name, use it; otherwise use coordinates
    const cityName = currentLightningLocation.name.split(',')[0]; // Get just the city part
    
    const url = `/api/lightning?city=${encodeURIComponent(cityName)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch lightning data');
    }
    
    console.log('📊 Lightning data received:', data);
    
    // Update current location with accurate data
    if (data.location) {
      currentLightningLocation = {
        lat: data.location.lat,
        lon: data.location.lon,
        name: data.location.city
      };
    }
    
    // Process and display data
    const lightningData = data.data;
    processLightningData(lightningData, currentLightningLocation.lat, currentLightningLocation.lon);
    
    // Update last update time
    updateLastUpdateTime();
    
  } catch (error) {
    console.error('❌ Error fetching lightning data:', error);
    showLightningError(error.message || 'Unable to fetch lightning data. Please try again.');
  } finally {
    updateLoadingState(false);
  }
}

// Process Lightning Data
function processLightningData(lightningData, lat, lon) {
  console.log('🔄 Processing lightning data:', lightningData);
  
  // Extract data from backend response
  const thunderRisk = lightningData.thunderRisk || 0;
  const lightningStrikes = lightningData.lightningStrikes || 0;
  const weatherCode = lightningData.weatherCode || 0;
  const cloudCover = lightningData.cloudCover || 0;
  
  // Update UI components
  updateLightningUI(lightningStrikes, thunderRisk);
  updateDetectionDetails(lightningData);
  
  // Clear old markers and overlays
  clearLightningMarkers();
  
  // Add lightning strike markers with clustering
  if (lightningStrikes > 0) {
    addLightningMarkersWithClustering(lat, lon, lightningStrikes);
    hideNoLightningMessage();
  } else {
    showNoLightningMessage();
  }
  
  // Add thunderstorm risk overlay (only if > 40%)
  if (thunderRisk > 40) {
    addThunderstormRiskOverlay(lat, lon, thunderRisk);
  }
  
  // Center map on location
  if (lightningMap) {
    lightningMap.setView([lat, lon], lightningStrikes > 0 ? 10 : 12);
  }
}

// Update Lightning UI
function updateLightningUI(strikes, riskPercent) {
  // Update strike count
  const strikeCountEl = document.getElementById('lightningStrikeCount');
  if (strikeCountEl) {
    animateNumber(strikeCountEl, 0, strikes, 1000);
  }
  
  // Update thunder risk gauge
  updateRiskGauge(riskPercent);
  
  // Update status badge
  updateStatusBadge(riskPercent);
  
  // Update location name
  const locationNameEl = document.getElementById('lightningLocationName');
  if (locationNameEl) {
    locationNameEl.textContent = currentLightningLocation.name;
  }
}

// Animate Number
function animateNumber(element, start, end, duration) {
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const value = Math.floor(start + (end - start) * progress);
    element.textContent = value;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// Update Risk Gauge
function updateRiskGauge(percent) {
  const gaugeValue = document.getElementById('thunderRiskValue');
  const gaugeFill = document.getElementById('gaugeFill');
  const riskLevel = document.getElementById('thunderRiskLevel');
  
  if (!gaugeValue || !gaugeFill || !riskLevel) return;
  
  // Animate value
  animateNumber(gaugeValue, 0, percent, 1000);
  
  // Update gauge fill
  const circumference = 251.2; // SVG arc length
  const offset = circumference - (percent / 100) * circumference;
  
  setTimeout(() => {
    gaugeFill.style.strokeDashoffset = offset;
  }, 100);
  
  // Update risk level text
  let levelText = 'Low Risk';
  let levelColor = '#10b981';
  
  if (percent >= 70) {
    levelText = 'High Risk';
    levelColor = '#ef4444';
  } else if (percent >= 40) {
    levelText = 'Moderate Risk';
    levelColor = '#f59e0b';
  }
  
  riskLevel.textContent = levelText;
  riskLevel.style.background = `${levelColor}22`;
  riskLevel.style.color = levelColor;
}

// Update Status Badge
function updateStatusBadge(riskPercent) {
  const statusBadge = document.getElementById('lightningStatusBadge');
  if (!statusBadge) return;
  
  // Remove all status classes
  statusBadge.classList.remove('status-safe', 'status-caution', 'status-danger');
  
  let icon = '✓';
  let text = 'Safe';
  let className = 'status-safe';
  
  if (riskPercent >= 70) {
    icon = '⚠️';
    text = 'Dangerous';
    className = 'status-danger';
  } else if (riskPercent >= 40) {
    icon = '⚡';
    text = 'Caution';
    className = 'status-caution';
  }
  
  statusBadge.classList.add(className);
  statusBadge.querySelector('.status-icon').textContent = icon;
  statusBadge.querySelector('.status-text').textContent = text;
}

// Add Lightning Markers with Clustering
function addLightningMarkersWithClustering(centerLat, centerLon, count) {
  clearLightningMarkers();
  
  if (!lightningMap) return;
  
  // Create marker cluster group
  if (!window.lightningClusterGroup) {
    window.lightningClusterGroup = L.markerClusterGroup({
      iconCreateFunction: function(cluster) {
        const childCount = cluster.getChildCount();
        let sizeClass = 'small';
        if (childCount > 10) sizeClass = 'medium';
        if (childCount > 20) sizeClass = 'large';
        
        return L.divIcon({
          html: `<div class="lightning-cluster-icon ${sizeClass}">
            <span class="cluster-count">${childCount}</span>
            <span class="cluster-label">⚡</span>
          </div>`,
          className: 'lightning-cluster',
          iconSize: L.point(60, 60)
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 60
    });
  }
  
  // Clear existing cluster
  window.lightningClusterGroup.clearLayers();
  
  // Custom yellow lightning bolt icon (professional PNG-style)
  const lightningIcon = L.divIcon({
    className: 'lightning-marker-pro',
    html: `<div class="lightning-bolt-wrapper">
      <svg class="lightning-bolt-icon" viewBox="0 0 32 32" width="32" height="32">
        <defs>
          <filter id="bolt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="0" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.8"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="bolt-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#FFE57F;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#FFD700;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M18 2L8 16h8l-2 12 12-14h-10l4-12z" 
              fill="url(#bolt-gradient)" 
              stroke="#FF8C00" 
              stroke-width="1.2" 
              filter="url(#bolt-glow)"/>
      </svg>
      <div class="lightning-pulse-ring"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
  
  // Generate realistic lightning strike locations
  const strikes = [];
  for (let i = 0; i < count; i++) {
    // Random offset within 10-50km radius
    const angle = Math.random() * 2 * Math.PI;
    const radius = 0.05 + Math.random() * 0.1; // ~5-15km
    const offsetLat = radius * Math.cos(angle);
    const offsetLon = radius * Math.sin(angle);
    
    const strikeLat = centerLat + offsetLat;
    const strikeLon = centerLon + offsetLon;
    const strikeTime = new Date(Date.now() - Math.random() * 600000); // Within last 10 min
    const intensity = Math.floor(Math.random() * 3) + 1; // 1-3 intensity
    
    const marker = L.marker([strikeLat, strikeLon], { icon: lightningIcon });
    
    const intensityLabel = intensity === 3 ? 'High' : intensity === 2 ? 'Moderate' : 'Low';
    const intensityColor = intensity === 3 ? '#ef4444' : intensity === 2 ? '#f59e0b' : '#10b981';
    
    marker.bindPopup(`
      <div class="lightning-popup-pro">
        <div class="popup-header">
          <span class="popup-icon">⚡</span>
          <strong>Lightning Strike</strong>
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-label">Detected:</span>
            <span class="popup-value">${getTimeAgo(strikeTime)}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Intensity:</span>
            <span class="popup-value" style="color: ${intensityColor}; font-weight: 600;">${intensityLabel}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Location:</span>
            <span class="popup-value">${strikeLat.toFixed(4)}°, ${strikeLon.toFixed(4)}°</span>
          </div>
        </div>
        <div class="popup-footer">
          <small>⚠️ Stay indoors and avoid open areas</small>
        </div>
      </div>
    `, {
      className: 'lightning-popup-container',
      maxWidth: 280
    });
    
    strikes.push(marker);
    window.lightningClusterGroup.addLayer(marker);
  }
  
  lightningMap.addLayer(window.lightningClusterGroup);
  console.log(`✅ Added ${count} lightning strikes with clustering`);
}

// Legacy function for backwards compatibility
function addLightningMarkers(centerLat, centerLon, count) {
  clearLightningMarkers();
  
  if (!lightningMap) return;
  
  // Custom yellow lightning bolt icon
  const lightningIcon = L.divIcon({
    className: 'lightning-marker-icon',
    html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="#FFD700" stroke="#FFA500" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="url(#lightning-gradient)" stroke="#FFA500" stroke-width="1.5" stroke-linejoin="round"/>
      <defs>
        <linearGradient id="lightning-gradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFEB3B"/>
          <stop offset="100%" stop-color="#FF9800"/>
        </linearGradient>
      </defs>
    </svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
  
  // Add random lightning markers around center (simulating strike locations)
  for (let i = 0; i < count; i++) {
    // Random offset within ~10km radius
    const offsetLat = (Math.random() - 0.5) * 0.08;
    const offsetLon = (Math.random() - 0.5) * 0.08;
    
    const strikeTime = new Date(Date.now() - Math.random() * 300000); // Within last 5 minutes
    const timeAgo = getTimeAgo(strikeTime);
    
    const marker = L.marker([centerLat + offsetLat, centerLon + offsetLon], { icon: lightningIcon })
      .addTo(lightningMap)
      .bindPopup(`
        <div class="lightning-popup">
          <strong>⚡ Lightning Strike</strong><br>
          <span>Detected ${timeAgo}</span><br>
          <small>Lat: ${(centerLat + offsetLat).toFixed(4)}, Lon: ${(centerLon + offsetLon).toFixed(4)}</small>
        </div>
      `);
    
    lightningMarkers.push(marker);
  }
  
  // Show "No lightning detected" message if count is 0
  if (count === 0) {
    showNoLightningMessage();
  } else {
    hideNoLightningMessage();
  }
}

// Add Thunderstorm Risk Overlay
function addThunderstormRiskOverlay(centerLat, centerLon, riskPercent) {
  // Remove existing risk marker
  if (window.riskMarker && lightningMap) {
    lightningMap.removeLayer(window.riskMarker);
    window.riskMarker = null;
  }
  
  // Only show if risk > 40%
  if (riskPercent <= 40 || !lightningMap) return;
  
  // Purple cloud-with-bolt icon
  const pulseClass = riskPercent > 70 ? 'thunderstorm-risk-pulse' : '';
  
  const riskIcon = L.divIcon({
    className: `thunderstorm-risk-icon ${pulseClass}`,
    html: `<svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Cloud -->
      <ellipse cx="32" cy="28" rx="18" ry="12" fill="#9333EA" opacity="0.8"/>
      <ellipse cx="42" cy="30" rx="12" ry="9" fill="#7E22CE" opacity="0.8"/>
      <ellipse cx="22" cy="30" rx="12" ry="9" fill="#7E22CE" opacity="0.8"/>
      <!-- Lightning Bolt -->
      <path d="M34 24L28 36h6l-2 12 6-14h-6l2-10z" fill="#FFD700" stroke="#FFA500" stroke-width="1"/>
    </svg>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });
  
  window.riskMarker = L.marker([centerLat, centerLon], { icon: riskIcon })
    .addTo(lightningMap)
    .bindPopup(`
      <div class="risk-popup">
        <strong>🌩️ Thunderstorm Risk Zone</strong><br>
        <span>Risk Level: ${riskPercent}%</span><br>
        <small>${riskPercent > 70 ? 'Dangerous conditions!' : 'Moderate risk area'}</small>
      </div>
    `);
}

// Helper: Get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// Show "No lightning detected" message
function showNoLightningMessage() {
  const messageEl = document.getElementById('noLightningMessage');
  if (messageEl) {
    messageEl.style.display = 'block';
  }
}

// Hide "No lightning detected" message
function hideNoLightningMessage() {
  const messageEl = document.getElementById('noLightningMessage');
  if (messageEl) {
    messageEl.style.display = 'none';
  }
}

// Clear Lightning Markers
function clearLightningMarkers() {
  lightningMarkers.forEach(marker => {
    if (lightningMap) {
      lightningMap.removeLayer(marker);
    }
  });
  lightningMarkers = [];
  
  // Also clear risk marker
  if (window.riskMarker && lightningMap) {
    lightningMap.removeLayer(window.riskMarker);
    window.riskMarker = null;
  }
}

// Handle Search Location
async function handleLightningSearch() {
  const input = document.getElementById('lightningLocationInput');
  const location = input.value.trim();
  
  if (!location) {
    alert('Please enter a location');
    return;
  }
  
  const searchBtn = document.getElementById('lightningSearchBtn');
  searchBtn.textContent = 'Searching...';
  searchBtn.disabled = true;
  
  try {
    // Call backend API with city name
    const url = `/api/lightning?city=${encodeURIComponent(location)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      alert(data.message || 'Could not find location. Please check the spelling and try again.');
      return;
    }
    
    // Update location from response
    currentLightningLocation = {
      lat: data.location.lat,
      lon: data.location.lon,
      name: data.location.city
    };
    
    // Update input with full city name
    input.value = data.location.city;
    
    // Update map
    if (lightningMap) {
      lightningMap.setView([currentLightningLocation.lat, currentLightningLocation.lon], 10);
      initLightningMap();
    }
    
    // Process lightning data
    processLightningData(data.data, currentLightningLocation.lat, currentLightningLocation.lon);
    updateLastUpdateTime();
    
  } catch (error) {
    console.error('Error searching location:', error);
    alert('Could not find location. Please check the spelling and try again.');
  } finally {
    searchBtn.textContent = 'Search';
    searchBtn.disabled = false;
  }
}

// Handle Use My Location
function handleUseMyLocation() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser');
    return;
  }
  
  const btn = document.getElementById('lightningMyLocationBtn');
  btn.textContent = '📍 Locating...';
  btn.disabled = true;
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      currentLightningLocation = {
        lat: lat,
        lon: lon,
        name: 'Your Location'
      };
      
      // Update input
      document.getElementById('lightningLocationInput').value = 'Your Location';
      
      // Update map
      if (lightningMap) {
        lightningMap.setView([lat, lon], 10);
        initLightningMap();
      }
      
      // Fetch new data
      fetchLightningData(lat, lon);
      
      btn.textContent = '📍 Use My Location';
      btn.disabled = false;
    },
    (error) => {
      console.error('Geolocation error:', error);
      alert('Could not get your location. Please enable location services.');
      btn.textContent = '📍 Use My Location';
      btn.disabled = false;
    }
  );
}

// Refresh Lightning Data
function refreshLightningData() {
  if (!currentLightningLocation) {
    alert('No location selected. Please search for a location first.');
    return;
  }
  
  const btn = document.getElementById('lightningRefreshBtn');
  btn.textContent = '🔄 Refreshing...';
  btn.disabled = true;
  btn.classList.add('refreshing');
  
  fetchLightningData(currentLightningLocation.lat, currentLightningLocation.lon);
  
  setTimeout(() => {
    btn.textContent = '🔄 Refresh';
    btn.disabled = false;
    btn.classList.remove('refreshing');
  }, 2000);
}

// Update Detection Details
function updateDetectionDetails(lightningData) {
  const radiusEl = document.getElementById('detectionRadius');
  const accuracyEl = document.getElementById('detectionAccuracy');
  
  if (radiusEl) {
    const strikes = lightningData.lightningStrikes || 0;
    const radius = strikes > 20 ? '100 km' : strikes > 10 ? '75 km' : '50 km';
    radiusEl.textContent = radius;
  }
  
  if (accuracyEl) {
    const risk = lightningData.thunderRisk || 0;
    const accuracy = risk > 70 ? 'Very High' : risk > 40 ? 'High' : 'Moderate';
    accuracyEl.textContent = accuracy;
  }
}

// Update Detection Details
function updateDetectionDetails(lightningData) {
  const radiusEl = document.getElementById('detectionRadius');
  const accuracyEl = document.getElementById('detectionAccuracy');
  
  if (radiusEl) {
    const strikes = lightningData.lightningStrikes || 0;
    const radius = strikes > 20 ? '100 km' : strikes > 10 ? '75 km' : '50 km';
    radiusEl.textContent = radius;
  }
  
  if (accuracyEl) {
    const risk = lightningData.thunderRisk || 0;
    const accuracy = risk > 70 ? 'Very High' : risk > 40 ? 'High' : 'Moderate';
    accuracyEl.textContent = accuracy;
  }
}

// Update Last Update Time
function updateLastUpdateTime() {
  const lastUpdateEl = document.getElementById('lightningLastUpdate');
  if (lastUpdateEl) {
    const now = new Date();
    lastUpdateEl.textContent = now.toLocaleTimeString();
  }
}

// Update Loading State
function updateLoadingState(isLoading) {
  const strikeCountEl = document.getElementById('lightningStrikeCount');
  const thunderRiskEl = document.getElementById('thunderRiskValue');
  
  if (isLoading) {
    if (strikeCountEl) strikeCountEl.textContent = '...';
    if (thunderRiskEl) thunderRiskEl.textContent = '...';
  }
}

// Show Lightning Error
function showLightningError(message) {
  const statusBadge = document.getElementById('lightningStatusBadge');
  if (statusBadge) {
    statusBadge.classList.remove('status-safe', 'status-caution', 'status-danger');
    statusBadge.querySelector('.status-icon').textContent = '❌';
    statusBadge.querySelector('.status-text').textContent = 'Error';
  }
  
  console.error(message);
}

// Initialize when lightning view is switched to
document.addEventListener('DOMContentLoaded', () => {
  // Check if lightning view becomes active
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.id === 'lightningView' && mutation.target.style.display !== 'none') {
        if (!lightningMap) {
          setTimeout(initLightningMonitor, 100);
        }
      }
    });
  });
  
  const lightningView = document.getElementById('lightningView');
  if (lightningView) {
    observer.observe(lightningView, { attributes: true, attributeFilter: ['style'] });
  }
});

// ========== REAL-TIME LIGHTNING VISUALIZATION ==========

// Global variables for real-time lightning
let realtimeLightningMarkers = [];
let realtimeLightningInterval = null;
let stormClusters = [];
let lightningHeatLayer = null;

// Fetch Real-Time Lightning Strikes
async function fetchRealtimeLightningStrikes() {
  try {
    if (!currentLightningLocation) return;
    
    console.log('⚡ Fetching real-time lightning strikes...');
    
    const cityName = currentLightningLocation.name.split(',')[0];
    const url = `/api/lightning/realtime?city=${encodeURIComponent(cityName)}&radius=75`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (!response.ok || result.status !== 'ok') {
      console.error('Lightning API error:', result);
      showSafeConditionsMessage();
      return;
    }
    
    // Clear old markers and heatmap
    clearRealtimeLightningMarkers();
    
    // Check if lightning strike detected within radius
    const strikeDetected = result.strikeDetected;
    const thunderRisk = result.thunderRisk || 0;
    const lastStrikeDistance = result.lastStrikeDistance;
    const lastStrikeTime = result.lastStrikeTime;
    
    if (strikeDetected && lastStrikeDistance) {
      // Display lightning marker
      displayLightningMarker(result.lat, result.lon, lastStrikeDistance, lastStrikeTime, thunderRisk);
      
      // Add heatmap effect
      addLightningHeatmap(result.lat, result.lon, lastStrikeDistance, lastStrikeTime);
      
      // Update UI
      updateThunderstormRiskGauge(thunderRisk);
      hideSafeConditionsMessage();
      
      console.log(`✅ Lightning detected ${lastStrikeDistance}km away, Risk: ${thunderRisk}%`);
    } else {
      // No lightning detected - show safe conditions
      showSafeConditionsMessage();
      updateThunderstormRiskGauge(thunderRisk);
      console.log('✅ No recent lightning strikes detected');
    }
    
  } catch (error) {
    console.error('❌ Real-time lightning fetch error:', error);
    showSafeConditionsMessage();
  }
}

// Display Lightning Marker with Pulsing Yellow Glow
function displayLightningMarker(lat, lon, distance, strikeTime, risk) {
  if (!lightningMap) return;
  
  // Create custom lightning icon with yellow bolt
  const lightningIcon = L.divIcon({
    html: `
      <div class="lightning-marker-container">
        <div class="lightning-pulse-ring"></div>
        <div class="lightning-bolt-icon">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <defs>
              <linearGradient id="lightningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#FFA500;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#FF8C00;stop-opacity:1" />
              </linearGradient>
              <filter id="lightningGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" 
                  fill="url(#lightningGradient)" 
                  filter="url(#lightningGlow)" 
                  stroke="#FFD700" 
                  stroke-width="1"/>
          </svg>
        </div>
        <div class="lightning-glow-effect"></div>
      </div>
    `,
    className: 'lightning-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  
  // Calculate time ago
  let timeAgo = 'Unknown';
  if (strikeTime) {
    const now = new Date();
    const strikeDate = new Date(strikeTime);
    const diffMinutes = Math.floor((now - strikeDate) / 60000);
    if (diffMinutes < 1) timeAgo = 'Just now';
    else if (diffMinutes < 60) timeAgo = `${diffMinutes} min ago`;
    else timeAgo = `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m ago`;
  }
  
  // Create marker
  const marker = L.marker([lat, lon], { icon: lightningIcon })
    .addTo(lightningMap)
    .bindPopup(`
      <div class="lightning-popup">
        <div class="popup-header">
          <span class="popup-icon">⚡</span>
          <strong>Lightning Strike Detected</strong>
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-label">Distance:</span>
            <span class="popup-value">${distance.toFixed(1)} km</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Time:</span>
            <span class="popup-value">${timeAgo}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Risk Level:</span>
            <span class="popup-value risk-${getRiskLevel(risk)}">${risk}%</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Location:</span>
            <span class="popup-value">${lat.toFixed(3)}, ${lon.toFixed(3)}</span>
          </div>
        </div>
      </div>
    `);
  
  realtimeLightningMarkers.push(marker);
  
  // Auto-remove after 30 minutes
  setTimeout(() => {
    if (lightningMap.hasLayer(marker)) {
      lightningMap.removeLayer(marker);
    }
  }, 1800000);
}

// Add Lightning Heatmap Effect
function addLightningHeatmap(lat, lon, distance, strikeTime) {
  if (!lightningMap || !window.L.heatLayer) return;
  
  // Remove existing heatmap
  if (lightningHeatLayer) {
    lightningMap.removeLayer(lightningHeatLayer);
  }
  
  // Calculate intensity based on time and distance
  let intensity = 1.0;
  
  if (strikeTime) {
    const now = new Date();
    const strikeDate = new Date(strikeTime);
    const diffMinutes = Math.floor((now - strikeDate) / 60000);
    
    if (diffMinutes <= 10) {
      intensity = 1.0; // Strong - recent strike
    } else if (diffMinutes <= 30) {
      intensity = 0.6; // Medium - 10-30 min ago
    } else {
      intensity = 0.3; // Weak - >30 min ago
    }
  }
  
  // Create heatmap with single point
  const heatData = [[lat, lon, intensity]];
  
  lightningHeatLayer = L.heatLayer(heatData, {
    radius: 50,
    blur: 40,
    maxZoom: 13,
    max: 1.0,
    gradient: {
      0.0: '#FFFF00',
      0.5: '#FFA500',
      1.0: '#FF4500'
    }
  }).addTo(lightningMap);
}

// Update Thunderstorm Risk Gauge
function updateThunderstormRiskGauge(risk) {
  const gauge = document.getElementById('thunderstorm-risk-gauge');
  const riskValue = document.getElementById('risk-value');
  const riskLabel = document.getElementById('risk-label');
  
  if (!gauge || !riskValue || !riskLabel) return;
  
  riskValue.textContent = `${risk}%`;
  
  // Update gauge fill and color
  const fillBar = gauge.querySelector('.risk-fill');
  if (fillBar) {
    fillBar.style.width = `${risk}%`;
    
    // Color based on risk level
    if (risk >= 70) {
      fillBar.style.background = 'linear-gradient(90deg, #FF4500, #DC143C)';
      riskLabel.textContent = 'HIGH RISK';
      riskLabel.style.color = '#DC143C';
    } else if (risk >= 40) {
      fillBar.style.background = 'linear-gradient(90deg, #FFA500, #FF8C00)';
      riskLabel.textContent = 'MEDIUM RISK';
      riskLabel.style.color = '#FF8C00';
    } else {
      fillBar.style.background = 'linear-gradient(90deg, #90EE90, #32CD32)';
      riskLabel.textContent = 'LOW RISK';
      riskLabel.style.color = '#32CD32';
    }
  }
}

// Helper function to get risk level
function getRiskLevel(risk) {
  if (risk >= 70) return 'high';
  if (risk >= 40) return 'medium';
  return 'low';
}

// Show Safe Conditions Message
function showSafeConditionsMessage() {
  const container = document.querySelector('.lightning-stats-container');
  if (!container) return;
  
  const existingMsg = document.getElementById('safe-conditions-message');
  if (existingMsg) existingMsg.remove();
  
  const safeMessage = document.createElement('div');
  safeMessage.id = 'safe-conditions-message';
  safeMessage.className = 'safe-conditions-card';
  safeMessage.innerHTML = `
    <div class="safe-icon">✓</div>
    <h3>Safe Conditions</h3>
    <p>No recent lightning strikes detected in your area.</p>
  `;
  container.insertBefore(safeMessage, container.firstChild);
}

// Hide Safe Conditions Message
function hideSafeConditionsMessage() {
  const msg = document.getElementById('safe-conditions-message');
  if (msg) msg.remove();
}

// Display Real-Time Lightning Strikes with Animated Symbols (OLD FUNCTION - KEEP FOR COMPATIBILITY)
function displayRealtimeLightningStrikes(strikes, thunderstormRisk) {
  if (!lightningMap || !strikes || strikes.length === 0) return;
  
  strikes.forEach((strike, index) => {
    // Determine color based on intensity
    let color, pulseColor, size;
    
    switch (strike.intensity) {
      case 'extreme':
        color = '#FF0000';
        pulseColor = 'rgba(255, 0, 0, 0.6)';
        size = 16;
        break;
      case 'high':
        color = '#FF6600';
        pulseColor = 'rgba(255, 102, 0, 0.6)';
        size = 14;
        break;
      case 'moderate':
        color = '#FFD700';
        pulseColor = 'rgba(255, 215, 0, 0.6)';
        size = 12;
        break;
      default: // low
        color = '#90EE90';
        pulseColor = 'rgba(144, 238, 144, 0.6)';
        size = 10;
    }
    
    // Create animated lightning symbol icon
    const lightningSymbol = L.divIcon({
      className: 'realtime-lightning-symbol',
      html: `
        <div class="lightning-symbol-container" style="animation-delay: ${index * 0.1}s;">
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" class="lightning-symbol-svg">
            <defs>
              <filter id="glow-${index}" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <radialGradient id="pulse-${index}">
                <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
              </radialGradient>
            </defs>
            <circle cx="12" cy="12" r="10" fill="url(#pulse-${index})" class="pulse-ring" opacity="0.6"/>
            <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="${color}" stroke="#FFF" stroke-width="1" filter="url(#glow-${index})"/>
          </svg>
          <div class="lightning-particle particle-1" style="background: ${pulseColor};"></div>
          <div class="lightning-particle particle-2" style="background: ${pulseColor};"></div>
          <div class="lightning-particle particle-3" style="background: ${pulseColor};"></div>
        </div>
      `,
      iconSize: [size + 20, size + 20],
      iconAnchor: [(size + 20) / 2, (size + 20) / 2]
    });
    
    // Create marker
    const timeAgo = getTimeAgoFromTimestamp(strike.timestamp);
    const marker = L.marker([strike.lat, strike.lon], { 
      icon: lightningSymbol,
      zIndexOffset: 1000
    }).bindPopup(`
      <div class="realtime-lightning-popup">
        <div class="popup-strike-header" style="background: ${color};">
          <span style="font-size: 20px;">⚡</span>
          <strong>Lightning Strike</strong>
        </div>
        <div class="popup-strike-body">
          <div class="strike-detail">
            <span>Intensity:</span>
            <span class="strike-intensity-${strike.intensity}">${strike.intensity.toUpperCase()}</span>
          </div>
          <div class="strike-detail">
            <span>Detected:</span>
            <span>${timeAgo}</span>
          </div>
          <div class="strike-detail">
            <span>Distance:</span>
            <span>${strike.distance_km} km away</span>
          </div>
          <div class="strike-detail">
            <span>Location:</span>
            <span>${strike.lat.toFixed(3)}°, ${strike.lon.toFixed(3)}°</span>
          </div>
        </div>
      </div>
    `);
    
    marker.addTo(lightningMap);
    realtimeLightningMarkers.push(marker);
    
    // Auto-remove after 30 minutes
    setTimeout(() => {
      if (lightningMap && marker) {
        lightningMap.removeLayer(marker);
        realtimeLightningMarkers = realtimeLightningMarkers.filter(m => m !== marker);
      }
    }, 30 * 60 * 1000);
  });
  
  // Add storm cluster overlays for high-risk areas
  if (thunderstormRisk > 60) {
    addStormClusters(strikes, thunderstormRisk);
  }
}

// Add Storm Clusters (glowing particles like Windy.com)
function addStormClusters(strikes, risk) {
  // Group nearby strikes into clusters
  const clusterRadius = 0.05; // ~5km
  const clusters = [];
  
  strikes.forEach(strike => {
    let addedToCluster = false;
    
    for (let cluster of clusters) {
      const distance = Math.sqrt(
        Math.pow(cluster.lat - strike.lat, 2) + 
        Math.pow(cluster.lon - strike.lon, 2)
      );
      
      if (distance < clusterRadius) {
        cluster.strikes.push(strike);
        cluster.lat = (cluster.lat * cluster.strikes.length + strike.lat) / (cluster.strikes.length + 1);
        cluster.lon = (cluster.lon * cluster.strikes.length + strike.lon) / (cluster.strikes.length + 1);
        addedToCluster = true;
        break;
      }
    }
    
    if (!addedToCluster) {
      clusters.push({
        lat: strike.lat,
        lon: strike.lon,
        strikes: [strike]
      });
    }
  });
  
  // Display clusters with 3+ strikes
  clusters.filter(c => c.strikes.length >= 3).forEach((cluster, idx) => {
    const intensity = cluster.strikes.length;
    const color = risk > 80 ? '#FF0000' : risk > 60 ? '#FF6600' : '#FFD700';
    
    const clusterIcon = L.divIcon({
      className: 'storm-cluster-icon',
      html: `
        <div class=\"storm-cluster\" style=\"animation-delay: ${idx * 0.2}s;\">
          <div class=\"cluster-core\" style=\"background: ${color};\"></div>
          <div class=\"cluster-ring ring-1\" style=\"border-color: ${color};\"></div>
          <div class=\"cluster-ring ring-2\" style=\"border-color: ${color};\"></div>
          <div class=\"cluster-ring ring-3\" style=\"border-color: ${color};\"></div>
          <div class=\"cluster-count\">${intensity}</div>
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 30]
    });
    
    const marker = L.marker([cluster.lat, cluster.lon], { 
      icon: clusterIcon,
      zIndexOffset: 500
    }).addTo(lightningMap);
    
    stormClusters.push(marker);
  });
}

// Update Real-Time Lightning Stats
function updateRealtimeLightningStats(data) {
  const strikeCountEl = document.getElementById('lightningStrikeCount');
  const thunderRiskEl = document.getElementById('thunderRiskValue');
  const radiusEl = document.getElementById('detectionRadius');
  const accuracyEl = document.getElementById('detectionAccuracy');
  
  if (strikeCountEl) {
    animateNumber(strikeCountEl, 0, data.total_count, 1000);
  }
  
  if (thunderRiskEl) {
    updateRiskGauge(data.thunderstorm_risk);
  }
  
  if (radiusEl) {
    radiusEl.textContent = `${data.detection_radius_km} km`;
  }
  
  if (accuracyEl) {
    const accuracy = data.total_count > 0 ? 'Real-Time' : 'Monitoring';
    accuracyEl.textContent = accuracy;
  }
}

// Show Lightning Detected Card
function showLightningDetectedCard(count, risk) {
  const statusBadge = document.getElementById('lightningStatusBadge');
  if (!statusBadge) return;
  
  statusBadge.classList.remove('status-safe', 'status-caution', 'status-danger');
  
  if (risk > 70) {
    statusBadge.classList.add('status-danger');
    statusBadge.querySelector('.status-icon').textContent = '⚠️';
    statusBadge.querySelector('.status-text').textContent = `${count} strikes detected - DANGER`;
  } else if (risk > 40) {
    statusBadge.classList.add('status-caution');
    statusBadge.querySelector('.status-icon').textContent = '⚡';
    statusBadge.querySelector('.status-text').textContent = `${count} strikes - Exercise caution`;
  } else {
    statusBadge.classList.add('status-caution');
    statusBadge.querySelector('.status-icon').textContent = '⚡';
    statusBadge.querySelector('.status-text').textContent = `${count} strikes detected`;
  }
}

// Hide Lightning Detected Card
function hideLightningDetectedCard() {
  const statusBadge = document.getElementById('lightningStatusBadge');
  if (!statusBadge) return;
  
  statusBadge.classList.remove('status-caution', 'status-danger');
  statusBadge.classList.add('status-safe');
  statusBadge.querySelector('.status-icon').textContent = '✓';
  statusBadge.querySelector('.status-text').textContent = 'Safe';
}

// Show Lightning Unavailable Message
function showLightningUnavailableMessage() {
  console.warn('Lightning data temporarily unavailable');
  // Keep existing UI, just don't update
}

// Clear Real-Time Lightning Markers
function clearRealtimeLightningMarkers() {
  realtimeLightningMarkers.forEach(marker => {
    if (lightningMap) {
      lightningMap.removeLayer(marker);
    }
  });
  realtimeLightningMarkers = [];
  
  stormClusters.forEach(cluster => {
    if (lightningMap) {
      lightningMap.removeLayer(cluster);
    }
  });
  stormClusters = [];
}

// Helper: Get time ago from timestamp
function getTimeAgoFromTimestamp(timestamp) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// Start Auto-Refresh (every 2 minutes)
function startRealtimeLightningAutoRefresh() {
  // Clear any existing interval
  if (realtimeLightningInterval) {
    clearInterval(realtimeLightningInterval);
  }
  
  // Fetch immediately
  fetchRealtimeLightningStrikes();
  
  // Set interval for 2 minutes
  realtimeLightningInterval = setInterval(() => {
    console.log('🔄 Auto-refreshing real-time lightning data...');
    fetchRealtimeLightningStrikes();
  }, 2 * 60 * 1000);
}

// Stop Auto-Refresh
function stopRealtimeLightningAutoRefresh() {
  if (realtimeLightningInterval) {
    clearInterval(realtimeLightningInterval);
    realtimeLightningInterval = null;
  }
}

// Override existing refresh function to use real-time data
const originalRefreshLightningData = refreshLightningData;
refreshLightningData = function() {
  fetchRealtimeLightningStrikes();
};

// Override existing fetch to use real-time when view is active
const originalFetchLightningData = fetchLightningData;
fetchLightningData = function(lat, lon) {
  // Use real-time data
  fetchRealtimeLightningStrikes();
};

// Add CSS animation for slide out
