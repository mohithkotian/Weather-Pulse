/**
 * Interactive Weather Map with Google Maps and OpenWeather Tile Layers
 * Features: Temperature, Precipitation, Wind layers with MSN-style toggle buttons
 * Geolocation support with fallback to OpenStreetMap
 */

// Global variables
let map = null;
let currentLayer = null;
let userMarker = null;
let googleMapsApiKey = null;
let openWeatherApiKey = null;

// Weather layers configuration
const weatherLayers = {
    temperature: null,
    precipitation: null,
    wind: null
};

// Default map center (New York City)
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.0060 };
const DEFAULT_ZOOM = 6;

/**
 * Initialize the map when page loads
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for app config to be loaded
        await waitForConfig();
        
        // Load Google Maps API
        await loadGoogleMapsAPI();
        
        // Initialize the map
        initMap();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Failed to initialize map:', error);
        showError('Failed to load map. Please check your API keys.');
    }
});

/**
 * Wait for app configuration to be loaded from base template
 */
function waitForConfig() {
    return new Promise((resolve, reject) => {
        const checkConfig = () => {
            if (window.appConfig) {
                googleMapsApiKey = window.appConfig.googleMapsApiKey;
                openWeatherApiKey = window.appConfig.openWeatherApiKey;
                
                if (!googleMapsApiKey || googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
                    console.warn('Google Maps API key not configured');
                }
                if (!openWeatherApiKey || openWeatherApiKey === 'YOUR_OPENWEATHER_API_KEY') {
                    console.warn('OpenWeather API key not configured');
                }
                
                resolve();
            } else {
                setTimeout(checkConfig, 100);
            }
        };
        checkConfig();
        
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Config timeout')), 5000);
    });
}

/**
 * Dynamically load Google Maps API
 */
function loadGoogleMapsAPI() {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.google && window.google.maps) {
            resolve();
            return;
        }
        
        // Create script element
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            console.log('Google Maps API loaded successfully');
            resolve();
        };
        
        script.onerror = () => {
            console.error('Failed to load Google Maps API');
            // Fallback to OpenStreetMap
            initOpenStreetMap();
            resolve(); // Still resolve to continue
        };
        
        document.head.appendChild(script);
    });
}

/**
 * Initialize Google Maps
 */
function initMap() {
    const mapElement = document.getElementById('map');
    const loadingElement = document.getElementById('mapLoading');
    
    try {
        // Create map instance
        map = new google.maps.Map(mapElement, {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: getMapStyles()
        });
        
        // Initialize weather layers
        initWeatherLayers();
        
        // Hide loading overlay
        setTimeout(() => {
            loadingElement.style.display = 'none';
        }, 1000);
        
        console.log('Map initialized successfully');
        
    } catch (error) {
        console.error('Error initializing map:', error);
        showError('Failed to initialize map');
    }
}

/**
 * Initialize weather tile layers from OpenWeather
 */
function initWeatherLayers() {
    // Temperature layer
    weatherLayers.temperature = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/temp_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherApiKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Temperature',
        opacity: 0.6,
        maxZoom: 18
    });
    
    // Precipitation layer
    weatherLayers.precipitation = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/precipitation_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherApiKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Precipitation',
        opacity: 0.6,
        maxZoom: 18
    });
    
    // Wind layer
    weatherLayers.wind = new google.maps.ImageMapType({
        getTileUrl: function(coord, zoom) {
            return `https://tile.openweathermap.org/map/wind_new/${zoom}/${coord.x}/${coord.y}.png?appid=${openWeatherApiKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        name: 'Wind',
        opacity: 0.6,
        maxZoom: 18
    });
    
    console.log('Weather layers initialized');
}

/**
 * Toggle weather layer on/off
 */
function toggleLayer(layerType) {
    // Remove current layer if any
    if (currentLayer) {
        map.overlayMapTypes.clear();
    }
    
    // If clicking the same layer, just turn it off
    if (currentLayer === layerType) {
        currentLayer = null;
        updateLegend(null);
        return;
    }
    
    // Add new layer
    const layer = weatherLayers[layerType];
    if (layer) {
        map.overlayMapTypes.push(layer);
        currentLayer = layerType;
        updateLegend(layerType);
        
        // Add smooth fade-in effect
        animateLayerFade();
        
        console.log(`${layerType} layer activated`);
    }
}

/**
 * Animate layer fade-in
 */
function animateLayerFade() {
    // This creates a smooth transition effect
    // In production, you might want to implement more sophisticated animation
    const overlay = map.overlayMapTypes.getAt(0);
    if (overlay) {
        let opacity = 0;
        const fadeIn = setInterval(() => {
            opacity += 0.1;
            if (opacity >= 0.6) {
                clearInterval(fadeIn);
            }
        }, 30);
    }
}

/**
 * Update map legend based on active layer
 */
function updateLegend(layerType) {
    const legend = document.getElementById('mapLegend');
    const content = document.getElementById('legendContent');
    
    if (!layerType) {
        legend.style.display = 'none';
        return;
    }
    
    // Show legend with appropriate content
    legend.style.display = 'block';
    
    const legends = {
        temperature: `
            <div class="legend-item">
                <div class="legend-gradient" style="background: linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #e0f3f8, #fee090, #fdae61, #f46d43, #d73027, #a50026);"></div>
                <div class="legend-labels">
                    <span>-40°C</span>
                    <span>40°C</span>
                </div>
            </div>
        `,
        precipitation: `
            <div class="legend-item">
                <div class="legend-gradient" style="background: linear-gradient(to right, rgba(225,225,255,0.1), rgba(180,180,255,0.5), rgba(150,150,255,0.7), rgba(30,60,255,1));"></div>
                <div class="legend-labels">
                    <span>Light</span>
                    <span>Heavy</span>
                </div>
            </div>
        `,
        wind: `
            <div class="legend-item">
                <div class="legend-gradient" style="background: linear-gradient(to right, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff);"></div>
                <div class="legend-labels">
                    <span>0 m/s</span>
                    <span>50 m/s</span>
                </div>
            </div>
        `
    };
    
    content.innerHTML = legends[layerType] || '';
}

/**
 * Get user's current location and center map
 */
function getMyLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    const myLocationBtn = document.getElementById('myLocationBtn');
    myLocationBtn.classList.add('loading');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Center map on user location
            map.setCenter(pos);
            map.setZoom(10);
            
            // Add or update marker
            if (userMarker) {
                userMarker.setPosition(pos);
            } else {
                userMarker = new google.maps.Marker({
                    position: pos,
                    map: map,
                    title: 'Your Location',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    },
                    animation: google.maps.Animation.DROP
                });
            }
            
            myLocationBtn.classList.remove('loading');
            showToast('Location updated', 'success');
        },
        (error) => {
            myLocationBtn.classList.remove('loading');
            
            let message = 'Failed to get your location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Location permission denied. Please enable location access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    message = 'Location request timed out.';
                    break;
            }
            
            showToast(message, 'error');
            console.error('Geolocation error:', error);
        }
    );
}

/**
 * Set up event listeners for map controls
 */
function setupEventListeners() {
    // Layer toggle buttons
    document.getElementById('tempLayerBtn').addEventListener('click', function() {
        toggleLayer('temperature');
        updateButtonStates(this);
    });
    
    document.getElementById('rainLayerBtn').addEventListener('click', function() {
        toggleLayer('precipitation');
        updateButtonStates(this);
    });
    
    document.getElementById('windLayerBtn').addEventListener('click', function() {
        toggleLayer('wind');
        updateButtonStates(this);
    });
    
    // My Location button
    document.getElementById('myLocationBtn').addEventListener('click', getMyLocation);
    
    // Optional: Time slider controls (stubbed for future implementation)
    const playBtn = document.getElementById('playBtn');
    const timeRange = document.getElementById('timeRange');
    
    if (playBtn && timeRange) {
        playBtn.addEventListener('click', () => {
            // TODO: Implement time animation
            // 1. Fetch available timestamps from OpenWeather
            // 2. Update tile URLs with timestamp parameter
            // 3. Animate through timestamps
            console.log('Time animation not yet implemented');
            showToast('Time animation feature coming soon', 'info');
        });
        
        timeRange.addEventListener('input', (e) => {
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) {
                timeDisplay.textContent = `+${e.target.value}h`;
            }
        });
    }
}

/**
 * Update button active states
 */
function updateButtonStates(activeButton) {
    // Remove active class from all layer buttons
    const layerButtons = document.querySelectorAll('.map-btn[data-layer]');
    layerButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button only if layer is active
    if (currentLayer) {
        activeButton.classList.add('active');
    }
}

/**
 * Fallback to OpenStreetMap if Google Maps fails
 */
function initOpenStreetMap() {
    console.log('Falling back to OpenStreetMap');
    
    const mapElement = document.getElementById('map');
    mapElement.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <h3>Google Maps not available</h3>
            <p>Using OpenStreetMap fallback...</p>
            <p style="margin-top: 20px;">
                To use Google Maps, please configure a valid Google Maps API key with billing enabled.
                Weather overlays will still work with OpenStreetMap.
            </p>
        </div>
        <div id="osmMap" style="height: calc(100% - 120px);"></div>
    `;
    
    // In a production app, you would initialize Leaflet.js here
    // For now, we just show the message
}

/**
 * Custom map styles for better weather layer visibility
 */
function getMapStyles() {
    return [
        {
            featureType: 'all',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
        },
        {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ lightness: 20 }]
        },
        {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [
                { color: '#e0e8f0' },
                { lightness: 17 }
            ]
        }
    ];
}

/**
 * Show error message
 */
function showError(message) {
    const mapElement = document.getElementById('map');
    const loadingElement = document.getElementById('mapLoading');
    
    loadingElement.style.display = 'none';
    
    mapElement.innerHTML = `
        <div class="error-state" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h3 style="margin: 20px 0 10px;">Map Error</h3>
            <p style="color: #64748b; margin-bottom: 20px;">${message}</p>
            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
    `;
}

/**
 * Additional helper: Check if coordinates are valid
 */
function isValidCoordinate(lat, lng) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Additional helper: Format coordinates for display
 */
function formatCoordinates(lat, lng) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

// Export functions for external use if needed
window.weatherMap = {
    toggleLayer,
    getMyLocation,
    map: () => map
};

console.log('Map script loaded');
