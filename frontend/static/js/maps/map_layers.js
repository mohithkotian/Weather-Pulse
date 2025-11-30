/**
 * Weather Map with Interactive Layers
 * Google Maps + OpenWeather Tile Layers
 */

let map;
let weatherLayers = {};
let currentLayerType = null;
let marker = null;
let apiKeys = {};

// Initialize map when page loads
async function initMap() {
    try {
        // Fetch API keys from backend
        const response = await fetch('/api/config');
        apiKeys = await response.json();
        
        // Default location (center of USA)
        const defaultLocation = { lat: 39.8283, lng: -98.5795 };
        
        // Create map
        map = new google.maps.Map(document.getElementById('map'), {
            center: defaultLocation,
            zoom: 4,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            streetViewControl: false,
            fullscreenControl: true
        });
        
        // Initialize weather tile layers
        initializeWeatherLayers();
        
        // Set up event listeners
        setupMapControls();
        
        // Try to get user's location
        getUserLocation();
        
        console.log('Map initialized successfully');
        
    } catch (error) {
        console.error('Error initializing map:', error);
        showError('Failed to initialize map. Please refresh the page.');
    }
}

/**
 * Initialize OpenWeather tile layers
 */
function initializeWeatherLayers() {
    const openWeatherKey = apiKeys.openWeatherApiKey;
    
    // Temperature layer
    weatherLayers.temperature = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/temp_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Temperature',
        opacity: 0.6
    });
    
    // Precipitation layer
    weatherLayers.precipitation = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/precipitation_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Precipitation',
        opacity: 0.6
    });
    
    // Wind layer
    weatherLayers.wind = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/wind_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Wind',
        opacity: 0.6
    });
    
    // Clouds layer
    weatherLayers.clouds = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/clouds_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Clouds',
        opacity: 0.5
    });
    
    // Pressure layer
    weatherLayers.pressure = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/pressure_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Pressure',
        opacity: 0.6
    });
}

/**
 * Set up map control event listeners
 */
function setupMapControls() {
    // Layer toggle buttons
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const layerType = this.dataset.layer;
            toggleLayer(layerType, this);
        });
    });
    
    // My Location button
    const myLocationBtn = document.getElementById('myLocationBtn');
    if (myLocationBtn) {
        myLocationBtn.addEventListener('click', getUserLocation);
    }
    
    // City search
    const searchInput = document.getElementById('citySearch');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', () => searchCity(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchCity(searchInput.value);
            }
        });
    }
    
    // Map click to show weather
    map.addListener('click', (event) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        fetchWeatherForLocation(lat, lng);
    });
}

/**
 * Toggle weather layer on/off
 */
function toggleLayer(layerType, button) {
    // Remove current layer if exists
    if (currentLayerType) {
        map.overlayMapTypes.clear();
        
        // Remove active class from all buttons
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    // If clicking same layer, just turn it off
    if (currentLayerType === layerType) {
        currentLayerType = null;
        return;
    }
    
    // Add new layer
    if (weatherLayers[layerType]) {
        map.overlayMapTypes.push(weatherLayers[layerType]);
        currentLayerType = layerType;
        button.classList.add('active');
    }
}

/**
 * Get user's current location
 */
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                map.setCenter(userLocation);
                map.setZoom(10);
                
                // Add marker
                addMarker(userLocation, 'Your Location');
                
                // Fetch weather for this location
                fetchWeatherForLocation(userLocation.lat, userLocation.lng);
            },
            (error) => {
                console.error('Geolocation error:', error);
                showError('Unable to get your location. Please search for a city instead.');
            }
        );
    } else {
        showError('Geolocation is not supported by your browser.');
    }
}

/**
 * Search for a city and center map
 */
async function searchCity(cityName) {
    if (!cityName || cityName.trim() === '') {
        showError('Please enter a city name');
        return;
    }
    
    try {
        // Use OpenWeather Geocoding API
        const response = await fetch(`/api/weather?city=${encodeURIComponent(cityName)}`);
        
        if (!response.ok) {
            throw new Error('City not found');
        }
        
        const data = await response.json();
        
        if (data.current && data.current.coord) {
            const location = {
                lat: data.current.coord.lat,
                lng: data.current.coord.lon
            };
            
            map.setCenter(location);
            map.setZoom(10);
            
            // Add marker
            addMarker(location, data.current.name);
            
            // Show weather info
            displayWeatherInfo(data.current);
        } else {
            throw new Error('Invalid response format');
        }
        
    } catch (error) {
        console.error('City search error:', error);
        showError(`Could not find city "${cityName}". Please try again.`);
    }
}

/**
 * Fetch weather data for a location
 */
async function fetchWeatherForLocation(lat, lng) {
    try {
        const response = await fetch(`/api/weather?lat=${lat}&lon=${lng}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch weather');
        }
        
        const data = await response.json();
        
        if (data.current) {
            // Add marker
            const locationName = data.current.name || 'Selected Location';
            addMarker({ lat, lng }, locationName);
            
            // Display weather info
            displayWeatherInfo(data.current);
        }
        
    } catch (error) {
        console.error('Weather fetch error:', error);
        showError('Unable to fetch weather data for this location.');
    }
}

/**
 * Add or update marker on map
 */
function addMarker(location, title) {
    // Remove existing marker
    if (marker) {
        marker.setMap(null);
    }
    
    // Create new marker
    marker = new google.maps.Marker({
        position: location,
        map: map,
        title: title,
        animation: google.maps.Animation.DROP
    });
}

/**
 * Display weather information in info panel
 */
function displayWeatherInfo(weatherData) {
    const infoPanel = document.getElementById('weatherInfo');
    
    if (!infoPanel) return;
    
    const temp = Math.round(weatherData.main.temp);
    const feelsLike = Math.round(weatherData.main.feels_like);
    const condition = weatherData.weather[0].description;
    const humidity = weatherData.main.humidity;
    const windSpeed = Math.round(weatherData.wind.speed);
    const pressure = weatherData.main.pressure;
    const icon = weatherData.weather[0].icon;
    
    infoPanel.innerHTML = `
        <h3>${weatherData.name}</h3>
        <div class="weather-main">
            <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${condition}">
            <div>
                <div class="temp">${temp}°C</div>
                <div class="condition">${condition}</div>
            </div>
        </div>
        <div class="weather-details">
            <div class="detail-item">
                <span class="label">Feels Like:</span>
                <span class="value">${feelsLike}°C</span>
            </div>
            <div class="detail-item">
                <span class="label">Humidity:</span>
                <span class="value">${humidity}%</span>
            </div>
            <div class="detail-item">
                <span class="label">Wind:</span>
                <span class="value">${windSpeed} m/s</span>
            </div>
            <div class="detail-item">
                <span class="label">Pressure:</span>
                <span class="value">${pressure} hPa</span>
            </div>
        </div>
    `;
    
    infoPanel.style.display = 'block';
}

/**
 * Show error message to user
 */
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

// Initialize map when page loads
window.initMap = initMap;
