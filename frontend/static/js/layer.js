/* ============================================================================
   LIGHTNING & THUNDER MAP - Complete JavaScript Implementation
   Similar to Windy.com Rain & Thunder Layer
   ============================================================================ */

// Configuration
const OPENWEATHER_API_KEY = 'your_key_here';
const API_ENDPOINT = '/api/lightning/realtime';
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

// Global State
let map = null;
let markerCluster = null;
let heatLayer = null;  // Leaflet heat layer instead of canvas
let particleCanvas = null;
let particleCtx = null;
let particles = [];
let lightningMarkers = [];
let lightningStrikes = [];
let currentLocation = { lat: 20, lon: 0, name: 'World' };
let currentModel = 'ECMWF';
let layerOpacity = 0.7;
let testMode = false;
let autoRefresh = true;
let refreshInterval = null;
let animationFrame = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Lightning & Thunder Map...');
    
    initMap();
    initCanvases();
    initControls();
    initSearch();
    initTimeline();
    loadLightningData();
    startAutoRefresh();
    
    console.log('✅ Map initialized successfully!');
});

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

function initMap() {
    // Initialize Leaflet map
    map = L.map('map', {
        center: [currentLocation.lat, currentLocation.lon],
        zoom: 3,
        zoomControl: true,
        attributionControl: false
    });

    // Add OpenStreetMap tiles - NO GOOGLE MAPS
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: ''
    }).addTo(map);

    // Apply Windy-style dark filter
    const tilePane = map.getPanes().tilePane;
    if (tilePane) {
        tilePane.style.filter = 'grayscale(100%) brightness(0.4) contrast(1.2)';
    }

    // Initialize marker cluster group
    markerCluster = L.markerClusterGroup({
        maxClusterRadius: 60,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            return L.divIcon({
                html: `<div style="background:rgba(251,191,36,0.9);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#1f2937;font-size:14px;">${count}</div>`,
                className: 'marker-cluster-custom',
                iconSize: L.point(40, 40)
            });
        }
    });
    map.addLayer(markerCluster);

    console.log('✅ Map loaded with OpenStreetMap tiles');
}

// ============================================================================
// CANVAS INITIALIZATION
// ============================================================================

function initCanvases() {
    particleCanvas = document.getElementById('particle-canvas');
    
    if (!particleCanvas) {
        console.error('❌ Particle canvas not found!');
        return;
    }
    
    particleCtx = particleCanvas.getContext('2d');
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    
    console.log('✅ Canvas layers initialized');
}

function resizeCanvases() {
    if (particleCanvas) {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }
}

// ============================================================================
// CONTROLS
// ============================================================================

function initControls() {
    // Model selector
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentModel = btn.dataset.model;
            loadLightningData();
        });
    });

    // Opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', (e) => {
            layerOpacity = e.target.value / 100;
            opacityValue.textContent = e.target.value + '%';
            heatmapCanvas.style.opacity = layerOpacity;
        });
    }

    // Test mode toggle
    const testToggle = document.getElementById('test-mode-toggle');
    if (testToggle) {
        testToggle.addEventListener('change', (e) => {
            testMode = e.target.checked;
            loadLightningData();
        });
    }

    // Auto-refresh toggle
    const autoToggle = document.getElementById('auto-refresh-toggle');
    if (autoToggle) {
        autoToggle.addEventListener('change', (e) => {
            autoRefresh = e.target.checked;
            if (autoRefresh) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadLightningData();
        });
    }

    console.log('✅ Controls initialized');
}

// ============================================================================
// SEARCH FUNCTIONALITY
// ============================================================================

function initSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchLocation());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchLocation();
        });
        console.log('✅ Search initialized');
    }
}

async function searchLocation() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput ? searchInput.value.trim() : '';
    
    if (!query) {
        alert('Please enter a location');
        return;
    }

    showLoading();

    try {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${OPENWEATHER_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.length > 0) {
            const location = data[0];
            currentLocation = {
                lat: location.lat,
                lon: location.lon,
                name: location.name
            };

            map.flyTo([currentLocation.lat, currentLocation.lon], 10, {
                duration: 1.5
            });

            L.circleMarker([currentLocation.lat, currentLocation.lon], {
                radius: 10,
                fillColor: '#3b82f6',
                color: '#ffffff',
                weight: 3,
                fillOpacity: 0.8
            }).addTo(map).bindPopup(`📍 ${currentLocation.name}`).openPopup();

            console.log(`🎯 Location: ${currentLocation.name}`);

            setTimeout(() => loadLightningData(), 1500);
        } else {
            hideLoading();
            alert('Location not found');
        }
    } catch (error) {
        hideLoading();
        console.error('Search error:', error);
        alert('Search failed');
    }
}

// ============================================================================
// LIGHTNING DATA LOADING
// ============================================================================

async function loadLightningData() {
    showLoading();

    try {
        const params = new URLSearchParams({
            lat: currentLocation.lat,
            lon: currentLocation.lon,
            radius: 50,
            test: testMode
        });

        const response = await fetch(`${API_ENDPOINT}?${params}`);
        const data = await response.json();

        console.log('📡 Lightning API Response:', data);
        console.log(`⚡ Density: ${data.density}, Strikes: ${data.strikes?.length || 0}`);
        console.log(`🌩️ Weather Code: ${data.weatherCode}, Thunderstorm: ${data.thunderstormProbability}%`);

        if (data.status === 'ok') {
            clearMarkers();
            clearHeatmap();
            lightningStrikes = data.strikes || [];

            // Show danger alert if there ARE strikes or high density
            const isDangerous = lightningStrikes.length > 0 || data.density > 0 || data.risk > 40;

            if (lightningStrikes.length > 0) {
                console.log(`🎯 Displaying ${lightningStrikes.length} lightning strikes`);
                displayLightningStrikes(lightningStrikes);
                drawHeatmap();
            } else {
                console.log('✅ No active lightning strikes in this region');
            }
            
            // Particles for precipitation
            if (data.precipitationIntensity > 0) {
                createParticles(data.precipitationIntensity);
                animateParticles();
            }

            // Alert based on ACTUAL conditions
            showAlert(isDangerous, {
                risk: data.risk,
                strikes: lightningStrikes.length,
                location: currentLocation.name,
                density: data.density,
                weatherCode: data.weatherCode
            });
        }
    } catch (error) {
        console.error('❌ Lightning data error:', error);
        showAlert(false, { error: true });
    } finally {
        hideLoading();
    }
}

// ============================================================================
// LIGHTNING MARKERS
// ============================================================================

function displayLightningStrikes(strikes) {
    markerCluster.clearLayers();
    lightningMarkers = [];

    strikes.forEach(strike => {
        const icon = L.icon({
            iconUrl: '/images/icon-for-lighting-and-thunder.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16],
            className: 'lightning-icon'
        });

        const marker = L.marker([strike.lat, strike.lon], { icon });
        
        const popupContent = `
            <div style="padding:10px;color:#fff;background:#1f2937;border-radius:8px;">
                <h4 style="margin:0 0 8px 0;color:#fbbf24;"><img src="/images/icon-for-lighting-and-thunder.png" style="width:20px;height:20px;vertical-align:middle;margin-right:5px;">Lightning Strike</h4>
                <p style="margin:4px 0;"><strong>Intensity:</strong> ${strike.intensity} kA</p>
                <p style="margin:4px 0;"><strong>Time:</strong> ${new Date(strike.time).toLocaleTimeString()}</p>
                ${strike.distance ? `<p style="margin:4px 0;"><strong>Distance:</strong> ${Math.round(strike.distance)} km</p>` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent);
        lightningMarkers.push(marker);
        markerCluster.addLayer(marker);
    });

    console.log(`✅ Displayed ${strikes.length} strikes`);
}

function clearMarkers() {
    markerCluster.clearLayers();
    lightningMarkers = [];
}

function clearHeatmap() {
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
}

// ============================================================================
// HEATMAP RENDERING
// ============================================================================

function drawHeatmap() {
    if (!lightningStrikes.length) {
        if (heatLayer) {
            map.removeLayer(heatLayer);
            heatLayer = null;
        }
        return;
    }

    // Remove old heat layer
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }

    // Create heat layer with Leaflet.heat plugin
    const heatPoints = lightningStrikes.map(strike => {
        const intensity = (strike.intensity || 50) / 150;  // Normalize 0-1
        return [strike.lat, strike.lon, Math.min(1, intensity)];
    });

    heatLayer = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 35,
        maxZoom: 10,
        max: 1.0,
        gradient: {
            0.0: 'rgba(34, 197, 94, 0)',
            0.2: 'rgba(34, 197, 94, 0.5)',
            0.4: 'rgba(251, 191, 36, 0.6)',
            0.6: 'rgba(249, 115, 22, 0.7)',
            0.8: 'rgba(239, 68, 68, 0.8)',
            1.0: 'rgba(220, 38, 38, 0.9)'
        }
    }).addTo(map);

    console.log(`✅ Heatmap rendered with ${heatPoints.length} points`);
}

// ============================================================================
// PARTICLE ANIMATION
// ============================================================================

function createParticles(intensity) {
    particles = [];
    const count = Math.min(200, Math.floor(intensity * 4));

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * particleCanvas.width,
            y: Math.random() * particleCanvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 3 + 2,
            life: Math.random() * 100 + 50,
            intensity: intensity
        });
    }
}

function animateParticles() {
    if (!particleCtx || particles.length === 0) return;

    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    particleCtx.globalAlpha = 0.7;

    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;

        if (p.life > 0) {
            let color = '#3b82f6';
            if (p.intensity > 40) color = '#ef4444';
            else if (p.intensity > 30) color = '#f97316';
            else if (p.intensity > 20) color = '#fbbf24';
            else if (p.intensity > 10) color = '#10b981';

            particleCtx.fillStyle = color;
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            particleCtx.fill();
            return true;
        }
        return false;
    });

    animationFrame = requestAnimationFrame(animateParticles);
}

// ============================================================================
// ALERT CARD
// ============================================================================

function showAlert(isDanger, data = {}) {
    const alertCard = document.getElementById('alert-card');
    const alertIcon = document.getElementById('alert-icon');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');

    if (!alertCard) return;

    if (isDanger) {
        alertCard.className = 'alert-card danger show';
        if (alertIcon) alertIcon.innerHTML = '<img src="/images/icon-for-lighting-and-thunder.png" style="width:48px;height:48px;">';
        alertTitle.textContent = '⚠️ LIGHTNING ALERT';
        
        let msg = `${data.strikes} active strike(s) near ${data.location}.`;
        if (data.density > 0) {
            msg += ` Density: ${data.density.toFixed(2)} strikes/km²/min.`;
        }
        if (data.weatherCode) {
            const codes = {
                8000: 'Thunderstorm',
                8001: 'Thunderstorm with rain',
                8002: 'Severe thunderstorm'
            };
            if (codes[data.weatherCode]) {
                msg += ` ${codes[data.weatherCode]} detected.`
            }
        }
        msg += ` Risk: ${data.risk}%`;
        
        alertMessage.textContent = msg;
        console.log('🚨 DANGER ALERT:', msg);
    } else {
        alertCard.className = 'alert-card safe show';
        if (alertIcon) alertIcon.textContent = '✅';
        alertTitle.textContent = '✓ Safe Conditions';
        
        if (data.error) {
            alertMessage.textContent = `Unable to load lightning data for ${currentLocation.name}`;
        } else {
            alertMessage.textContent = `No active lightning detected near ${data.location || currentLocation.name}`;
        }
        
        console.log('✅ SAFE:', alertMessage.textContent);
    }

    setTimeout(() => alertCard.classList.remove('show'), 10000);
}

// ============================================================================
// TIMELINE
// ============================================================================

function initTimeline() {
    const playBtn = document.getElementById('play-btn');
    const timelineSlider = document.getElementById('timeline-slider');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            const isPlaying = playBtn.textContent === '⏸';
            playBtn.textContent = isPlaying ? '▶' : '⏸';
        });
    }

    if (timelineSlider) {
        timelineSlider.addEventListener('input', (e) => {
            console.log(`Timeline: ${e.target.value}h`);
        });
    }
}

// ============================================================================
// AUTO-REFRESH
// ============================================================================

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        if (autoRefresh) {
            console.log('🔄 Auto-refresh...');
            loadLightningData();
        }
    }, AUTO_REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('show');
}

function hideLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.remove('show');
}

console.log('✅ Lightning Map Script Loaded!');
