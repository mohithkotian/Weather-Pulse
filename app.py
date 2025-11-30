"""
Weather Intelligence Platform - Main Application
Complete weather dashboard with AI bot, travel advisor, and alert system
"""

from flask import Flask, render_template, request, jsonify
from backend.alert_service import AlertService
from backend.weather_service import WeatherService
import os
import time

# Initialize Flask app with correct template and static folders
app = Flask(__name__, 
            template_folder='frontend/templates',
            static_folder='frontend/static')

# Initialize services
alert_service = AlertService()
weather_service = WeatherService()

# API Keys - Replace with your actual keys or use environment variables
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', 'YOUR_GOOGLE_MAPS_KEY')
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', 'YOUR_OPENWEATHER_KEY')


# ==================== PAGE ROUTES ====================

@app.route('/')
def index():
    """Home page - Weather dashboard"""
    return render_template('index.html')


@app.route('/map')
def map_page():
    """Interactive map page with weather layers"""
    return render_template('map.html')


@app.route('/alerts')
def alerts_page():
    """Alert center page with statistics"""
    return render_template('alerts.html')


@app.route('/travel')
def travel_page():
    """Travel safety advisor page"""
    return render_template('travel.html')


# ==================== API ROUTES - CONFIG ====================

@app.route('/api/config')
def get_config():
    """Provide API keys to frontend"""
    return jsonify({
        'googleMapsApiKey': GOOGLE_MAPS_API_KEY,
        'openWeatherApiKey': OPENWEATHER_API_KEY
    })


# ==================== API ROUTES - WEATHER ====================

@app.route('/weather', methods=['GET'])
@app.route('/api/weather', methods=['GET'])
def get_weather():
    """
    Get weather data for a location (supports both /weather and /api/weather)
    Query params: city, lat, lon
    """
    city = request.args.get('city')
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    try:
        if city:
            # Get location coordinates
            location = weather_service.get_location_coordinates(city)
            if not location:
                return jsonify({'error': f'City "{city}" not found'}), 404
            
            # Get current weather and forecast
            current = weather_service.get_current_weather(location['lat'], location['lon'])
            forecast_data = weather_service.get_forecast(location['lat'], location['lon'])
            
            if not current:
                return jsonify({'error': 'Unable to fetch weather data'}), 500
            
            # Process forecast
            forecast_list = weather_service.process_forecast_data(forecast_data) if forecast_data else []
            hourly_list = weather_service.process_hourly_data(forecast_data) if forecast_data else []
            
            # Generate alerts
            alerts = weather_service.generate_weather_alerts(current, forecast_data) if forecast_data else []
            
            # Get regional data
            regional = weather_service.get_regional_data(current['main']['temp'])
            
            # Format response for old dashboard
            response = {
                'city': current.get('name', city),
                'country': location.get('country', 'Unknown'),
                'lat': location['lat'],
                'lon': location['lon'],
                'temp': current['main']['temp'],
                'feels_like': current['main']['feels_like'],
                'high': current['main'].get('temp_max', current['main']['temp']),
                'low': current['main'].get('temp_min', current['main']['temp']),
                'humidity': current['main']['humidity'],
                'pressure': current['main']['pressure'],
                'wind': current['wind']['speed'],
                'desc': current['weather'][0]['description'] if current.get('weather') else 'Unknown',
                'icon': current['weather'][0]['icon'] if current.get('weather') else '01d',
                'sunrise': weather_service.format_time(current.get('sys', {}).get('sunrise', 0)),
                'sunset': weather_service.format_time(current.get('sys', {}).get('sunset', 0)),
                'forecast': forecast_list,
                'hourly': hourly_list,
                'alerts': alerts,
                'regions': regional,
                'current': current,
                'location': location
            }
            
            return jsonify(response)
            
        elif lat and lon:
            weather_data = weather_service.get_weather_by_coords(float(lat), float(lon))
            return jsonify(weather_data)
        else:
            return jsonify({'error': 'Missing location parameters'}), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    """Get 5-day forecast for a location"""
    city = request.args.get('city')
    
    if not city:
        return jsonify({'error': 'City parameter required'}), 400
    
    try:
        forecast_data = weather_service.get_forecast(city)
        return jsonify(forecast_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/travel-check', methods=['POST'])
def check_travel_safety():
    """
    Check if it's safe to travel to a destination
    Body: { destination, date_from, date_to }
    """
    data = request.json
    
    if not data or 'destination' not in data:
        return jsonify({'error': 'Missing destination'}), 400
    
    try:
        result = weather_service.assess_travel_safety(
            data['destination'],
            data.get('date_from'),
            data.get('date_to')
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== API ROUTES - AI BOT ====================

@app.route('/api/bot/chat', methods=['POST'])
def bot_chat():
    """
    AI Weather Bot endpoint
    Body: { message }
    """
    data = request.json
    
    if not data or 'message' not in data:
        return jsonify({'error': 'Missing message'}), 400
    
    try:
        response = weather_service.process_bot_query(data['message'])
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': str(e), 'response': 'Sorry, I encountered an error. Please try again.'}), 500


# ==================== API ROUTES - ALERTS ====================

@app.route('/api/alerts/thresholds', methods=['GET'])
def get_thresholds():
    """Get user alert thresholds"""
    user_id = request.args.get('user_id', 'default_user')
    try:
        thresholds = alert_service.get_user_thresholds(user_id)
        return jsonify(thresholds)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/check', methods=['GET'])
def check_alerts():
    """Check if any alerts are triggered"""
    user_id = request.args.get('user_id', 'default_user')
    try:
        alerts = alert_service.check_thresholds(user_id)
        return jsonify({'alerts': alerts})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts', methods=['POST'])
def create_alert():
    """
    Create a new weather alert
    Body: { type, field, value, threshold, location }
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['type', 'field', 'value', 'threshold', 'location']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        alert = alert_service.save_alert(
            alert_type=data['type'],
            field=data['field'],
            value=data['value'],
            threshold=data['threshold'],
            location=data['location']
        )
        
        return jsonify({
            'success': True,
            'alert': alert
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/get', methods=['GET'])
def get_alerts():
    """Retrieve all alerts"""
    try:
        alerts = alert_service.get_alerts()
        return jsonify(alerts)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/stats', methods=['GET'])
def get_alert_stats():
    """Get alert statistics"""
    try:
        stats = alert_service.get_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/clear', methods=['POST'])
def clear_alerts():
    """Clear all alerts"""
    try:
        result = alert_service.clear_alerts()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== LIGHTNING & THUNDER API ====================

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


# ==================== REAL-TIME LIGHTNING STRIKES API ====================

@app.route('/api/lightning/realtime', methods=['GET'])
def realtime_lightning():
    """Get real-time lightning strikes from Tomorrow.io"""
    try:
        city = request.args.get('city', '').strip()
        lat = request.args.get('lat', '').strip()
        lon = request.args.get('lon', '').strip()
        radius = int(request.args.get('radius', 75))
        
        # Get coordinates from city if provided
        if city:
            geocode_result = weather_service.geocode_city(city)
            if geocode_result is None or 'error' in geocode_result:
                return jsonify({
                    "success": False,
                    "message": "Could not find location"
                }), 400
            lat = geocode_result['lat']
            lon = geocode_result['lon']
            city_name = geocode_result['city']
        elif lat and lon:
            lat = float(lat)
            lon = float(lon)
            city_name = f"{lat}, {lon}"
        else:
            return jsonify({
                "success": False,
                "message": "City or coordinates required"
            }), 400
        
        # Fetch real lightning strike data
        lightning_data = weather_service.get_real_lightning_strikes(lat, lon, radius)
        
        if lightning_data is None:
            return jsonify({
                "success": False,
                "message": "Lightning data temporarily unavailable"
            }), 500
        
        return jsonify({
            "success": True,
            "location": {
                "city": city_name,
                "lat": lat,
                "lon": lon
            },
            "data": lightning_data,
            "timestamp": time.time()
        }), 200
        
    except Exception as e:
        print(f"❌ Real-time lightning API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to fetch real-time lightning data",
            "error": str(e)
        }), 500


# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500


# ==================== MAIN ====================

if __name__ == '__main__':
    print("=" * 70)
    print("🌤️  Weather Intelligence Platform Starting...")
    print("=" * 70)
    print(f"Google Maps API: {'✓ Set' if GOOGLE_MAPS_API_KEY != 'YOUR_GOOGLE_MAPS_KEY' else '✗ Not set'}")
    print(f"OpenWeather API: {'✓ Set' if OPENWEATHER_API_KEY != 'YOUR_OPENWEATHER_KEY' else '✗ Not set'}")
    print("=" * 70)
    print("Server running at: http://127.0.0.1:5000")
    print("=" * 70)
    print("\n📍 Available Routes:")
    print("  Home:           http://127.0.0.1:5000/")
    print("  Map:            http://127.0.0.1:5000/map")
    print("  Alerts:         http://127.0.0.1:5000/alerts")
    print("  Travel Advisor: http://127.0.0.1:5000/travel")
    print("\n🤖 AI Bot enabled on all pages")
    print("=" * 70)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
