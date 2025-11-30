"""
Weather Intelligence Platform - Main Application
Complete weather dashboard with AI bot, travel advisor, and alert system
"""

from flask import Flask, render_template, request, jsonify
from backend.alert_service import AlertService
from backend.weather_service import WeatherService
import os

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

@app.route('/api/weather', methods=['GET'])
def get_weather():
    """
    Get weather data for a location
    Query params: city, lat, lon
    """
    city = request.args.get('city')
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    try:
        if city:
            weather_data = weather_service.get_weather_by_city(city)
        elif lat and lon:
            weather_data = weather_service.get_weather_by_coords(float(lat), float(lon))
        else:
            return jsonify({'error': 'Missing location parameters'}), 400
        
        return jsonify(weather_data)
    
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
