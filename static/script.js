async function getWeather() {
    const location = document.getElementById('location').value;
    if (!location) {
        showError('Please enter a location');
        return;
    }

    // Show loading and hide other sections
    document.getElementById('loading').style.display = 'block';
    document.getElementById('weather-content').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
    
    // Update loading message
    document.querySelector('.loading p').textContent = `Fetching weather data for ${location}...`;

    try {
        const response = await fetch('/api/weather', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ location }),
        });

        if (!response.ok) {
            throw new Error('Location not found or error fetching weather data');
        }

        const data = await response.json();
        displayWeatherData(data);
    } catch (error) {
        showError(error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function displayWeatherData(data) {
    const current = data.weather.current;
    const forecast = data.weather.forecast;

    // Display location with full address
    document.getElementById('location-name').textContent = data.location.address;
    
    // Set appropriate weather icon
    const weatherDesc = current.weather[0].description.toLowerCase();
    const iconElement = document.getElementById('weather-icon');
    iconElement.className = getWeatherIconClass(weatherDesc);
    // Add animation class
    iconElement.classList.add('weather-icon-animate');

    // Current weather with enhanced formatting
    document.getElementById('current-temp').textContent = `${Math.round(current.main.temp)}°C`;
    document.getElementById('feels-like').textContent = `Feels like: ${Math.round(current.main.feels_like)}°C`;
    document.getElementById('humidity').textContent = `${current.main.humidity}%`;
    document.getElementById('wind-speed').textContent = `${current.wind.speed.toFixed(1)} m/s`;
    document.getElementById('pressure').textContent = `${current.main.pressure} hPa`;
    document.getElementById('weather-desc').textContent = 
        current.weather[0].description.charAt(0).toUpperCase() + 
        current.weather[0].description.slice(1);
    
    // Add visibility if available
    if (current.visibility) {
        document.getElementById('visibility').textContent = `${(current.visibility / 1000).toFixed(1)} km`;
    }
    
    // Add wind direction if available
    if (current.wind.deg) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(current.wind.deg / 45) % 8;
        document.getElementById('wind-direction').textContent = directions[index];
    }

    // Enhanced forecast with more details
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = '';

    let previousDate = null;
    forecast.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateString = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        if (dateString !== previousDate) {
            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';
            forecastItem.innerHTML = `
                <div class="forecast-date">${dateString}</div>
                <i class="${getWeatherIconClass(item.weather[0].description.toLowerCase())}"></i>
                <div class="forecast-temp">
                    <span class="temp-main">${Math.round(item.main.temp)}°C</span>
                    <span class="temp-range">
                        <span class="temp-min">${Math.round(item.main.temp_min)}°</span>
                        <span class="temp-max">${Math.round(item.main.temp_max)}°</span>
                    </span>
                </div>
                <div class="forecast-desc">${item.weather[0].description}</div>
                <div class="forecast-details">
                    <span><i class="fas fa-droplet"></i> ${item.main.humidity}%</span>
                    <span><i class="fas fa-wind"></i> ${item.wind.speed.toFixed(1)} m/s</span>
                </div>
            `;
            forecastContainer.appendChild(forecastItem);
            previousDate = dateString;
        }
    });

    // Update map with smooth transition
    if (data.map_file) {
        const mapFrame = document.getElementById('weather-map');
        mapFrame.style.opacity = '0';
        mapFrame.src = data.map_file;
        mapFrame.onload = () => {
            mapFrame.style.opacity = '1';
        };
    }

    // Display Air Quality if available
    const aqiElement = document.getElementById('aqi');
    if (data.weather.air_quality) {
        const aqiClass = {
            'Good': 'aqi-good',
            'Fair': 'aqi-fair',
            'Moderate': 'aqi-moderate',
            'Poor': 'aqi-poor',
            'Very Poor': 'aqi-very-poor'
        };
        aqiElement.innerHTML = `
            <span class="${aqiClass[data.weather.air_quality.label]}">
                ${data.weather.air_quality.label}
            </span>`;
        document.querySelector('.air-quality').style.display = 'block';
    } else {
        document.querySelector('.air-quality').style.display = 'none';
    }

    // Show weather content with animation
    const weatherContent = document.getElementById('weather-content');
    weatherContent.style.display = 'block';
    weatherContent.style.opacity = '0';
    setTimeout(() => {
        weatherContent.style.opacity = '1';
    }, 100);
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    document.getElementById('weather-content').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
}

// Handle Enter key in search box
document.getElementById('location').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        getWeather();
    }
});