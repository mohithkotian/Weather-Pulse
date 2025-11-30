"""
Weather Dashboard Flask Backend
Serves the weather dashboard and provides API endpoints for weather data
"""

from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
from weather_service import WeatherService
from alert_service import AlertService
import os
import requests

app = Flask(__name__, 
            template_folder='../frontend/templates',
            static_folder='../frontend/static')
CORS(app)

# Initialize services
weather_service = WeatherService()
alert_service = AlertService()

@app.route('/images/<path:filename>')
def serve_images(filename):
    """Serve images from the images folder"""
    return send_from_directory('../images', filename)

@app.route('/')
def index():
    """Serve the main dashboard page"""
    return render_template('index.html')

@app.route('/map-layer')
def map_layer():
    """Serve the Windy-style weather layer page"""
    return render_template('map_layer.html')

@app.route('/weather-map')
def weather_map():
    """Serve the complete Windy-style weather map"""
    return render_template('weather_map.html')

@app.route('/forecast')
def forecast_page():
    """Serve the 7-day forecast page"""
    return render_template('forecast_7day.html')

@app.route('/api/lightning/realtime', methods=['GET'])
def lightning_realtime():
    """
    Lightning Real-time Detection API
    
    Returns lightning strike data similar to Windy.com Rain & Thunder layer
    
    Parameters:
    - lat: Latitude (required)
    - lon: Longitude (required)
    - radius: Detection radius in km (default: 50)
    - test: Test mode for synthetic data (optional, default: false)
    
    Returns:
    {
        "status": "ok",
        "danger": true/false,
        "risk": 0-100,
        "strikes": [...],
        "density": number,
        "precipitationIntensity": number,
        "thunderstormProbability": number
    }
    """
    try:
        lat = float(request.args.get('lat', 0))
        lon = float(request.args.get('lon', 0))
        radius = float(request.args.get('radius', 50))
        test_mode = request.args.get('test', 'false').lower() == 'true'
        
        # Get lightning data from weather service
        lightning_data = weather_service.get_lightning_realtime(lat, lon, radius, test_mode)
        
        return jsonify(lightning_data)
        
    except Exception as e:
        print(f"❌ Lightning API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'danger': False,
            'risk': 0,
            'strikes': [],
            'density': 0,
            'message': str(e)
        }), 500

@app.route('/api/weather/realtime', methods=['GET'])
def weather_realtime():
    """
    Real-time Weather & Lightning API
    
    Fetches live data from Tomorrow.io API for lightning and precipitation
    
    Parameters:
    - lat: Latitude (required)
    - lon: Longitude (required)
    - radius: Detection radius in km (default: 100)
    """
    try:
        from datetime import datetime
        import requests
        
        lat = float(request.args.get('lat', 20))
        lon = float(request.args.get('lon', 0))
        radius = float(request.args.get('radius', 100))
        
        TOMORROW_API_KEY = 'Q5comtfrYeC3HZcssHEIQyrK5O69psf3'
        
        # Fetch realtime weather data from Tomorrow.io
        url = f'https://api.tomorrow.io/v4/weather/realtime'
        params = {
            'location': f'{lat},{lon}',
            'apikey': TOMORROW_API_KEY,
            'units': 'metric'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            values = data.get('data', {}).get('values', {})
            
            # Build response
            result = {
                'status': 'ok',
                'location': {'lat': lat, 'lon': lon},
                'timestamp': datetime.now().isoformat(),
                'weather': {
                    'temperature': values.get('temperature'),
                    'precipitationIntensity': values.get('precipitationIntensity', 0),
                    'windSpeed': values.get('windSpeed', 0),
                    'windDirection': values.get('windDirection', 0),
                    'cloudCover': values.get('cloudCover', 0),
                    'thunderstormProbability': values.get('thunderstormProbability', 0)
                },
                'hasThunderstorm': values.get('thunderstormProbability', 0) > 30,
                'hasPrecipitation': values.get('precipitationIntensity', 0) > 0
            }
            
            return jsonify(result)
        else:
            return jsonify({
                'status': 'error',
                'message': f'Tomorrow.io API error: {response.status_code}'
            }), 500
            
    except Exception as e:
        print(f"❌ Realtime weather API error: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/weather/layer', methods=['GET'])
def weather_layer():
    """
    Weather Layer API Endpoint
    
    Returns normalized weather data for map visualization:
    - Precipitation grid (for particle animation)
    - Lightning strikes (for markers and heatmap)
    - Timestamp
    
    Parameters:
    - lat: Latitude (required)
    - lon: Longitude (required)
    - radius: Detection radius in km (default: 100)
    - model: Weather model (ECMWF/GFS/ICON, default: ECMWF)
    - dev: Development mode - returns synthetic test data (optional)
    
    Dev Mode:
    Append ?dev=true to generate realistic test data for UI preview
    """
    try:
        import random
        import math
        from datetime import datetime, timedelta
        
        lat = float(request.args.get('lat', 20))
        lon = float(request.args.get('lon', 0))
        radius = float(request.args.get('radius', 100))
        model = request.args.get('model', 'ECMWF')
        dev_mode = request.args.get('dev', '').lower() == 'true'
        
        if dev_mode:
            # SYNTHETIC TEST DATA - Windy-style clusters
            # Generate realistic precipitation grid
            grid = []
            for i in range(50):
                # Create clusters in Africa and Indonesia regions
                if random.random() > 0.3:
                    # Africa cluster (Central Africa)
                    cluster_lat = lat + random.uniform(-5, 5)
                    cluster_lon = lon + random.uniform(-5, 5)
                else:
                    # Indonesia cluster
                    cluster_lat = random.uniform(-5, 5)
                    cluster_lon = random.uniform(100, 140)
                
                intensity = random.uniform(0, 50)  # mm/h
                
                # Add wind vectors for particle movement
                wind_x = random.uniform(-2, 2)
                wind_y = random.uniform(-2, 2)
                
                grid.append({
                    'lat': cluster_lat,
                    'lon': cluster_lon,
                    'intensity': intensity,
                    'windX': wind_x,
                    'windY': wind_y
                })
            
            # Generate realistic lightning strikes
            strikes = []
            strike_count = random.randint(15, 40)
            
            for i in range(strike_count):
                # Cluster strikes in storm regions
                if random.random() > 0.4:
                    # Africa thunderstorm region
                    strike_lat = random.uniform(-5, 15)
                    strike_lon = random.uniform(10, 40)
                else:
                    # Indonesia thunderstorm region
                    strike_lat = random.uniform(-10, 5)
                    strike_lon = random.uniform(100, 120)
                
                # Random intensity
                intensity_val = random.random()
                if intensity_val > 0.8:
                    intensity = 'extreme'
                elif intensity_val > 0.6:
                    intensity = 'high'
                elif intensity_val > 0.3:
                    intensity = 'moderate'
                else:
                    intensity = 'low'
                
                # Random time within last 30 minutes
                time_ago = random.randint(0, 30)
                strike_time = (datetime.now() - timedelta(minutes=time_ago)).isoformat()
                
                strikes.append({
                    'lat': strike_lat,
                    'lon': strike_lon,
                    'intensity': intensity,
                    'time': strike_time
                })
            
            return jsonify({
                'status': 'ok',
                'grid': grid,
                'strikes': strikes,
                'timestamp': datetime.now().isoformat(),
                'model': model,
                'dev_mode': True
            })
        
        # REAL DATA MODE - Use Tomorrow.io API
        import requests
        
        TOMORROW_API_KEY = 'Q5comtfrYeC3HZcssHEIQyrK5O69psf3'
        
        # Try to fetch real weather data
        try:
            url = f'https://api.tomorrow.io/v4/weather/realtime'
            params = {
                'location': f'{lat},{lon}',
                'apikey': TOMORROW_API_KEY,
                'units': 'metric'
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                values = data.get('data', {}).get('values', {})
                
                # Build strikes array if thunderstorm detected
                strikes = []
                thunder_prob = values.get('thunderstormProbability', 0)
                precip_intensity = values.get('precipitationIntensity', 0)
                
                if thunder_prob > 30:
                    # Create strike points around location
                    strike_count = min(10, int(thunder_prob / 10))
                    for i in range(strike_count):
                        angle = random.uniform(0, 2 * math.pi)
                        distance = random.uniform(0, radius / 111)
                        
                        strike_lat = lat + distance * math.cos(angle)
                        strike_lon = lon + distance * math.sin(angle)
                        
                        intensity = 'extreme' if thunder_prob > 80 else 'high' if thunder_prob > 60 else 'moderate'
                        
                        strikes.append({
                            'lat': strike_lat,
                            'lon': strike_lon,
                            'intensity': intensity,
                            'time': datetime.now().isoformat()
                        })
                
                # Build precipitation grid
                grid = []
                if precip_intensity > 0:
                    for i in range(30):
                        angle = random.uniform(0, 2 * math.pi)
                        distance = random.uniform(0, radius / 111)
                        
                        point_lat = lat + distance * math.cos(angle)
                        point_lon = lon + distance * math.sin(angle)
                        
                        # Vary intensity around reported value
                        varied_intensity = precip_intensity * random.uniform(0.5, 1.5)
                        
                        grid.append({
                            'lat': point_lat,
                            'lon': point_lon,
                            'intensity': varied_intensity,
                            'windX': values.get('windSpeed', 0) * math.cos(values.get('windDirection', 0) * math.pi / 180) / 10,
                            'windY': values.get('windSpeed', 0) * math.sin(values.get('windDirection', 0) * math.pi / 180) / 10
                        })
                
                return jsonify({
                    'status': 'ok',
                    'grid': grid,
                    'strikes': strikes,
                    'timestamp': datetime.now().isoformat(),
                    'model': model,
                    'dev_mode': False,
                    'real_data': True
                })
            else:
                print(f"⚠️ Tomorrow.io API returned {response.status_code}, using fallback")
                
        except Exception as api_error:
            print(f"⚠️ Tomorrow.io API error: {api_error}, using fallback")
        
        # Fallback: Return empty data
        return jsonify({
            'status': 'ok',
            'grid': [],
            'strikes': [],
            'timestamp': datetime.now().isoformat(),
            'model': model,
            'message': 'No weather data available. Enable dev mode (?dev=true) for test data.'
        })
        
    except Exception as e:
        print(f"❌ Weather layer API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/weather', methods=['GET'])
def get_weather():
    """
    Weather API Endpoint (GET)
    Accepts: ?city=city_name or ?lat=X&lon=Y
    Returns: Complete weather data
    """
    city = request.args.get('city', '').strip()
    lat = request.args.get('lat', '')
    lon = request.args.get('lon', '')
    
    if not city and not (lat and lon):
        return jsonify({"error": "City parameter or lat/lon required"}), 400
    
    try:
        # Get location coordinates if city provided
        if city:
            location_info = weather_service.get_location_coordinates(city)
            if not location_info:
                return jsonify({"error": f"Location '{city}' not found"}), 404
            lat = location_info['lat']
            lon = location_info['lon']
        else:
            location_info = {
                'lat': float(lat),
                'lon': float(lon),
                'address': f"{lat}, {lon}",
                'country': 'Unknown'
            }
        
        # Get weather and forecast
        current_data = weather_service.get_current_weather(lat, lon)
        forecast_data = weather_service.get_forecast(lat, lon)
        
        if not current_data or not forecast_data:
            return jsonify({"error": "Weather data unavailable"}), 500
        
        # Format times
        timezone_offset = current_data.get('timezone', 0)
        sunrise = weather_service.format_time(
            current_data['sys']['sunrise'], 
            timezone_offset
        ) if 'sys' in current_data else '--:--'
        sunset = weather_service.format_time(
            current_data['sys']['sunset'], 
            timezone_offset
        ) if 'sys' in current_data else '--:--'
        
        # Process forecast and hourly data
        forecast_list = weather_service.process_forecast_data(forecast_data)
        hourly_list = weather_service.process_hourly_data(forecast_data)
        
        # Generate weather alerts
        alerts_list = weather_service.generate_weather_alerts(current_data, forecast_data)
        
        # Get regional data
        regions_list = weather_service.get_regional_data(current_data['main']['temp'])
        
        # Calculate high/low from forecast
        temps = [item['main']['temp'] for item in forecast_data['list'][:8]]
        high = round(max(temps)) if temps else round(current_data['main']['temp_max'])
        low = round(min(temps)) if temps else round(current_data['main']['temp_min'])
        
        # Build FLAT response that frontend expects
        response = {
            # Location info
            "city": location_info['address'].split(',')[0],
            "country": location_info['country'],
            "lat": lat,
            "lon": lon,
            
            # Current weather
            "temp": round(current_data['main']['temp']),
            "desc": current_data['weather'][0]['description'].capitalize(),
            "icon": current_data['weather'][0]['icon'],
            "high": high,
            "low": low,
            "humidity": current_data['main']['humidity'],
            "wind": round(current_data['wind']['speed'], 1),
            "pressure": current_data['main']['pressure'],
            "visibility": current_data.get('visibility', 0) / 1000,  # km
            "clouds": current_data.get('clouds', {}).get('all', 0),
            
            # Times
            "sunrise": sunrise,
            "sunset": sunset,
            
            # Processed data
            "forecast": forecast_list,
            "hourly": hourly_list,
            "alerts": alerts_list,
            "regions": regions_list,
            
            # Raw data for advanced features
            "current": current_data,
            "forecastData": forecast_data
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        print("❌ Error in /weather:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/weather", methods=["POST"])
def get_weather_api():
    """
    Weather API Endpoint (POST)
    Accepts: JSON body with { "location": "city_name" }
    Returns: Complete weather data including current, forecast, alerts, and regional data
    """
    data = request.get_json()
    city = data.get("location", "").strip()

    if not city:
        return jsonify({"error": "City parameter is required"}), 400

    try:
        # Get coordinates
        location_info = weather_service.get_location_coordinates(city)
        if not location_info:
            return jsonify({"error": f"Location '{city}' not found. Please check spelling."}), 404

        # Get weather and forecast
        current_data = weather_service.get_current_weather(location_info['lat'], location_info['lon'])
        forecast_data = weather_service.get_forecast(location_info['lat'], location_info['lon'])

        # Handle empty data
        if not current_data or not forecast_data:
            return jsonify({"error": "Weather data unavailable for this location."}), 500

        # Format times
        timezone_offset = current_data.get('timezone', 0)
        sunrise = weather_service.format_time(
            current_data['sys']['sunrise'], 
            timezone_offset
        ) if 'sys' in current_data else '--:--'
        sunset = weather_service.format_time(
            current_data['sys']['sunset'], 
            timezone_offset
        ) if 'sys' in current_data else '--:--'

        # Process forecast and hourly data
        forecast_list = weather_service.process_forecast_data(forecast_data)
        hourly_list = weather_service.process_hourly_data(forecast_data)

        # Generate weather alerts
        alerts_list = weather_service.generate_weather_alerts(current_data, forecast_data)

        # Get regional data
        regions_list = weather_service.get_regional_data(current_data['main']['temp'])

        # Calculate high/low from forecast
        temps = [item['main']['temp'] for item in forecast_data['list'][:8]]
        high = round(max(temps)) if temps else round(current_data['main']['temp_max'])
        low = round(min(temps)) if temps else round(current_data['main']['temp_min'])

        # Build comprehensive response
        response = {
            "location": location_info,
            "weather": {
                "current": current_data,
                "forecast": forecast_data
            },
            "processed": {
                "forecast": forecast_list,
                "hourly": hourly_list,
                "alerts": alerts_list,
                "regions": regions_list,
                "high": high,
                "low": low,
                "sunrise": sunrise,
                "sunset": sunset
            }
        }

        return jsonify(response), 200

    except Exception as e:
        print("❌ Error in /api/weather:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

# ============================================
# WEATHER ALERT ENDPOINTS
# ============================================

@app.route('/api/alerts/thresholds', methods=['GET'])
def get_thresholds():
    """Get all user thresholds"""
    user_id = request.args.get('user_id', 'default_user')
    try:
        data = alert_service.get_user_thresholds(user_id)
        return jsonify({
            "success": True,
            "thresholds": data.get('thresholds', {}),
            "location": data.get('location', {})
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/alerts/thresholds', methods=['POST'])
def save_thresholds():
    """Save all user thresholds at once"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default_user')
        thresholds = data.get('thresholds', {})
        location = data.get('location', {})
        
        if not thresholds:
            return jsonify({"success": False, "error": "No thresholds provided"}), 400
        
        # Save each threshold
        for alert_type, config in thresholds.items():
            if 'value' in config and config['value'] is not None:
                alert_service.set_threshold(
                    user_id, 
                    alert_type, 
                    config['value'], 
                    location,
                    config.get('enabled', True)
                )
        
        return jsonify({
            "success": True,
            "message": "Alert thresholds saved successfully"
        }), 200
        
    except Exception as e:
        print(f"Error saving thresholds: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/alerts/set', methods=['POST'])
def set_alert():
    """Set a single weather threshold alert"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default_user')
        alert_type = data.get('alert_type')
        threshold_value = data.get('threshold_value')
        location = data.get('location', {})
        enabled = data.get('enabled', True)
        
        if not alert_type or threshold_value is None:
            return jsonify({"error": "alert_type and threshold_value required"}), 400
        
        alert_service.set_threshold(user_id, alert_type, float(threshold_value), location, enabled)
        
        return jsonify({
            "success": True,
            "message": f"{alert_type.capitalize()} alert set to {threshold_value}"
        }), 200
        
    except Exception as e:
        print(f"Error setting alert: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts/check', methods=['GET'])
def check_alerts():
    """Check if any alerts are triggered and return them"""
    user_id = request.args.get('user_id', 'default_user')
    
    try:
        # Check thresholds and get triggered alerts
        triggered_alerts = alert_service.check_thresholds(user_id)
        
        # Add triggered alerts to active alerts
        for alert in triggered_alerts:
            alert_service.add_active_alert(user_id, alert)
        
        # Return all active alerts
        active_alerts = alert_service.get_active_alerts(user_id)
        
        return jsonify({
            "success": True,
            "alerts": active_alerts,
            "new_alerts": len(triggered_alerts)
        }), 200
    except Exception as e:
        print(f"Error checking alerts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e), "alerts": []}), 500

@app.route('/api/alerts/active', methods=['GET'])
def get_active_alerts():
    """Get currently active alerts without checking new ones"""
    user_id = request.args.get('user_id', 'default_user')
    
    try:
        active = alert_service.get_active_alerts(user_id)
        return jsonify({
            "success": True,
            "alerts": active
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e), "alerts": []}), 500

@app.route('/api/alerts/clear', methods=['POST'])
def clear_alert():
    """Clear a specific alert or all alerts"""
    data = request.get_json()
    user_id = data.get('user_id', 'default_user')
    alert_id = data.get('alert_id')
    
    try:
        if alert_id:
            alert_service.clear_alert(alert_id)
            return jsonify({"success": True, "message": "Alert cleared"}), 200
        else:
            alert_service.clear_all_alerts(user_id)
            return jsonify({"success": True, "message": "All alerts cleared"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/alerts/delete', methods=['POST'])
def delete_alert():
    """Delete a threshold alert"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default_user')
        alert_type = data.get('alert_type')
        
        if not alert_type:
            return jsonify({"error": "alert_type required"}), 400
        
        success = alert_service.delete_threshold(user_id, alert_type)
        
        if success:
            return jsonify({"success": True, "message": f"{alert_type} alert deleted"}), 200
        else:
            return jsonify({"error": "Alert not found"}), 404
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts/toggle', methods=['POST'])
def toggle_alert():
    """Enable or disable a threshold alert"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default_user')
        alert_type = data.get('alert_type')
        enabled = data.get('enabled', True)
        
        if not alert_type:
            return jsonify({"error": "alert_type required"}), 400
        
        success = alert_service.toggle_threshold(user_id, alert_type, enabled)
        
        if success:
            status = "enabled" if enabled else "disabled"
            return jsonify({"success": True, "message": f"{alert_type} alert {status}"}), 200
        else:
            return jsonify({"error": "Alert not found"}), 404
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts/location', methods=['POST'])
def update_alert_location():
    """Update the monitoring location for alerts"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default_user')
        location = data.get('location', {})
        
        if not location:
            return jsonify({"error": "location required"}), 400
        
        success = alert_service.update_location(user_id, location)
        
        if success:
            return jsonify({"success": True, "message": "Location updated"}), 200
        else:
            return jsonify({"error": "Failed to update location"}), 400
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================
# PAGE ROUTES
# ============================================

@app.route('/map')
def map_page():
    """Serve the interactive weather map page"""
    return render_template('map.html')

@app.route('/alerts')
def alerts_page():
    """Serve the alerts center page"""
    return render_template('alerts.html')

@app.route('/travel')
def travel_page():
    """Serve the travel safety advisor page"""
    return render_template('travel.html')

# ============================================
# AI BOT & TRAVEL SAFETY API ENDPOINTS
# ============================================

@app.route('/api/bot/chat', methods=['POST'])
def bot_chat():
    """AI Weather Bot Chat Endpoint"""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({"error": "Message required"}), 400
        
        # Process query using weather service
        response = weather_service.process_bot_query(message)
        
        return jsonify({
            "success": True,
            "response": response
        }), 200
        
    except Exception as e:
        print(f"❌ Bot chat error: {e}")
        return jsonify({
            "success": False,
            "response": "Sorry, I encountered an error. Please try again."
        }), 500

@app.route('/api/travel-check', methods=['POST'])
def travel_check():
    """Travel Safety Assessment Endpoint"""
    try:
        data = request.get_json()
        destination = data.get('destination', '').strip()
        
        if not destination:
            return jsonify({"error": "Destination required"}), 400
        
        # Get travel safety assessment
        assessment = weather_service.assess_travel_safety(destination)
        
        return jsonify(assessment), 200
        
    except Exception as e:
        print(f"❌ Travel check error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to assess travel safety",
            "message": str(e)
        }), 500

@app.route('/api/lightning', methods=['GET'])
def lightning_data():
    """Lightning & Thunder Data Endpoint with Geocoding"""
    try:
        city = request.args.get('city', '').strip()
        
        if not city:
            return jsonify({
                "success": False,
                "message": "City name is required"
            }), 400
        
        # Step 1: Geocode the city using OpenWeather API
        geocode_result = weather_service.geocode_city(city)
        
        if geocode_result is None or 'error' in geocode_result:
            return jsonify({
                "success": False,
                "message": "Could not find location. Please check the spelling and try again."
            }), 400
        
        # Step 2: Fetch lightning/thunder data from Tomorrow.io
        lat = geocode_result['lat']
        lon = geocode_result['lon']
        city_name = geocode_result['city']
        
        lightning_data = weather_service.get_lightning_data(lat, lon)
        
        if lightning_data is None:
            return jsonify({
                "success": False,
                "message": "Could not fetch lightning data"
            }), 500
        
        # Step 3: Return combined result
        return jsonify({
            "success": True,
            "location": {
                "city": city_name,
                "lat": lat,
                "lon": lon
            },
            "data": lightning_data
        }), 200
        
    except Exception as e:
        print(f"❌ Lightning API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to fetch lightning data"
        }), 500

@app.route('/api/forecast', methods=['GET'])
def api_forecast():
    """
    7-Day Weather Forecast API
    
    Query Parameters:
    - lat: Latitude (required)
    - lon: Longitude (required)
    - units: 'metric' or 'imperial' (default: metric)
    - history: 'true' to get 7-day historical data instead of forecast
    
    Returns:
    JSON with 7 days of weather data
    """
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        units = request.args.get('units', 'metric')
        history = request.args.get('history', 'false').lower() == 'true'
        
        if lat is None or lon is None:
            return jsonify({
                'status': 'error',
                'message': 'Missing required parameters: lat, lon'
            }), 400
        
        if units not in ['metric', 'imperial']:
            units = 'metric'
        
        # Get forecast or historical data
        if history:
            result = weather_service.get_7day_historical(lat, lon, units)
        else:
            result = weather_service.get_7day_forecast(lat, lon, units)
        
        if result.get('status') == 'error':
            return jsonify(result), 502
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Forecast API error: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)


