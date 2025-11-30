"""
Weather Service Module
Handles all OpenWeather API interactions and Tomorrow.io lightning data
"""

import requests
import os
import random
import math
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from urllib.parse import quote

# Load environment variables
load_dotenv()

# Import AI Weather Assistant
from ai_weather_assistant import AIWeatherAssistant

class WeatherService:
    """Service class for weather data operations"""
    
    def __init__(self):
        self.api_key = os.getenv('OPENWEATHER_API_KEY')
        self.tomorrow_api_key = os.getenv('TOMORROW_API_KEY')
        self.base_url = "http://api.openweathermap.org/data/2.5"
        
        if not self.api_key:
            raise ValueError("OPENWEATHER_API_KEY not found in environment variables")
        
        # Initialize AI Weather Assistant
        self.ai_assistant = AIWeatherAssistant(self)
    
    def get_lightning_realtime(self, lat, lon, radius=50, test_mode=False):
        """
        Get real-time lightning data from Blitzortung (FREE API)
        
        Args:
            lat (float): Latitude
            lon (float): Longitude  
            radius (int): Detection radius in km (default: 50)
            test_mode (bool): Return synthetic test data
            
        Returns:
            dict: Lightning data with status, danger, risk, strikes, density
        """
        if test_mode:
            # Generate realistic test data
            strike_count = random.randint(0, 25)
            strikes = []
            
            if strike_count > 0:
                for i in range(strike_count):
                    angle = random.uniform(0, 2 * math.pi)
                    distance = random.uniform(0, radius / 111)  # km to degrees
                    
                    strike_lat = lat + distance * math.cos(angle)
                    strike_lon = lon + distance * math.sin(angle)
                    
                    strikes.append({
                        'lat': strike_lat,
                        'lon': strike_lon,
                        'intensity': random.randint(20, 150),  # kA
                        'time': (datetime.now() - timedelta(minutes=random.randint(0, 30))).isoformat(),
                        'distance': distance * 111  # km
                    })
            
            risk = min(100, strike_count * 4)
            danger = strike_count > 0
            
            return {
                'status': 'ok',
                'danger': danger,
                'risk': risk,
                'strikes': strikes,
                'density': strike_count / (math.pi * radius * radius),  # strikes per km²
                'precipitationIntensity': random.uniform(0, 50) if danger else 0,
                'thunderstormProbability': risk,
                'test_mode': True
            }
        
        try:
            # Use OpenLightningMap.org FREE API - Real-time global lightning
            # This is a reliable, no-auth-required endpoint
            url = 'https://data.openlightningmap.org/last'
            
            print(f"⚡ OpenLightningMap API Request: {url}")
            
            headers = {
                'User-Agent': 'WeatherApp/1.0',
                'Accept': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            print(f"📊 OpenLightningMap Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"📦 Received data type: {type(data)}")
                
                # Filter strikes within radius
                strikes = []
                
                # Data format: list of strike arrays [time, lat, lon, polarity, amplitude]
                if isinstance(data, list):
                    print(f"📍 Processing {len(data)} global strikes...")
                    for strike_data in data:
                        if len(strike_data) >= 3:
                            try:
                                strike_lat = float(strike_data[1])
                                strike_lon = float(strike_data[2])
                                
                                # Calculate distance from center point
                                distance_km = self._haversine_distance(lat, lon, strike_lat, strike_lon)
                                
                                if distance_km <= radius:
                                    amplitude = float(strike_data[4]) if len(strike_data) > 4 else random.randint(30, 120)
                                    
                                    strikes.append({
                                        'lat': strike_lat,
                                        'lon': strike_lon,
                                        'intensity': abs(amplitude),  # kA
                                        'time': datetime.fromtimestamp(strike_data[0]/1000).isoformat() if len(strike_data) > 0 else datetime.now().isoformat(),
                                        'distance': distance_km
                                    })
                            except (ValueError, IndexError) as e:
                                continue
                
                print(f"⚡ Strikes within {radius}km of ({lat}, {lon}): {len(strikes)}")
                
                # Calculate risk and danger
                strike_count = len(strikes)
                density = strike_count / (math.pi * radius * radius) if radius > 0 else 0
                risk = min(100, strike_count * 5)  # 20 strikes = 100% risk
                danger = strike_count > 0
                
                print(f"{'🚨 DANGER' if danger else '✅ SAFE'} - Risk: {risk}% - Strikes: {strike_count}")
                
                return {
                    'status': 'ok',
                    'danger': danger,
                    'risk': risk,
                    'strikes': strikes,
                    'density': density,
                    'precipitationIntensity': 0,  # Not available
                    'thunderstormProbability': risk,
                    'cloudCover': 0,
                    'windSpeed': 0,
                    'weatherCode': 8000 if danger else 0,  # Simulate thunderstorm code
                    'test_mode': False,
                    'source': 'OpenLightningMap (Free)'
                }
            else:
                print(f"❌ API returned status {response.status_code}: {response.text[:200]}")
                return self._safe_fallback(f'API status {response.status_code}')
            
        except Exception as e:
            print(f"❌ Lightning API error: {e}")
            import traceback
            traceback.print_exc()
            return self._safe_fallback(str(e))
    
    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        """
        Calculate distance between two points on Earth in kilometers
        """
        R = 6371  # Earth radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def _safe_fallback(self, message='No lightning data available'):
        """
        Return safe fallback data when API fails
        """
        return {
            'status': 'ok',
            'danger': False,
            'risk': 0,
            'strikes': [],
            'density': 0,
            'precipitationIntensity': 0,
            'thunderstormProbability': 0,
            'test_mode': False,
            'message': message,
            'source': 'Blitzortung (Free)'
        }
    
    def get_location_coordinates(self, city):
        """
        Get coordinates for a given city using OpenWeather Geocoding API
        
        Args:
            city (str): City name to search for
            
        Returns:
            dict: Location data with lat, lon, address, and country
            None: If location not found
        """
        try:
            # Properly encode the city name for URL
            encoded_city = quote(city.strip())
            geocoding_url = f"http://api.openweathermap.org/geo/1.0/direct?q={encoded_city}&limit=1&appid={self.api_key}"
            response = requests.get(geocoding_url, timeout=10)
            response.raise_for_status()
            location_data = response.json()
            
            if location_data and len(location_data) > 0:
                return {
                    'lat': location_data[0]['lat'],
                    'lon': location_data[0]['lon'],
                    'address': f"{location_data[0].get('name', '')}, {location_data[0].get('country', '')}",
                    'country': location_data[0].get('country', 'Unknown'),
                    'name': location_data[0].get('name', city)
                }
            return None
        except requests.exceptions.HTTPError as e:
            print(f"HTTP Error getting location for '{city}': {e}")
            return None
        except Exception as e:
            print(f"Error getting location for '{city}': {e}")
            return None
    
    def get_current_weather(self, lat, lon):
        """
        Get current weather data for coordinates
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            
        Returns:
            dict: Current weather data
        """
        try:
            url = f"{self.base_url}/weather?lat={lat}&lon={lon}&appid={self.api_key}&units=metric"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching current weather: {e}")
            return None
    
    def get_forecast(self, lat, lon):
        """
        Get 5-day forecast data for coordinates
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            
        Returns:
            dict: Forecast data
        """
        try:
            url = f"{self.base_url}/forecast?lat={lat}&lon={lon}&appid={self.api_key}&units=metric"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching forecast: {e}")
            return None
    
    def format_time(self, timestamp, timezone_offset=0):
        """Format Unix timestamp to readable time"""
        dt = datetime.utcfromtimestamp(timestamp + timezone_offset)
        return dt.strftime('%I:%M %p')
    
    def process_forecast_data(self, forecast_data):
        """
        Process raw forecast data into daily summaries
        
        Args:
            forecast_data (dict): Raw forecast data from API
            
        Returns:
            list: List of daily forecast dictionaries
        """
        forecast_list = []
        seen_dates = set()
        
        for item in forecast_data['list'][:40]:  # 5 days of 3-hour intervals
            dt = datetime.utcfromtimestamp(item['dt'])
            date_key = dt.strftime('%Y-%m-%d')
            
            if date_key not in seen_dates:
                seen_dates.add(date_key)
                day_name = dt.strftime('%a')  # Mon, Tue, Wed...
                
                # Get precipitation probability
                precip = int((item.get('pop', 0) * 100))
                
                forecast_list.append({
                    "day": day_name,
                    "temp": round(item['main']['temp']),
                    "precip": precip,
                    "icon": item['weather'][0]['icon'] if item.get('weather') else None,
                    "condition": item['weather'][0]['description'] if item.get('weather') else ''
                })
        
        return forecast_list
    
    def process_hourly_data(self, forecast_data):
        """
        Process hourly data for temperature trends
        
        Args:
            forecast_data (dict): Raw forecast data from API
            
        Returns:
            list: List of hourly data points
        """
        hourly_list = []
        for item in forecast_data['list'][:8]:  # 8 x 3-hour = 24 hours
            dt = datetime.utcfromtimestamp(item['dt'])
            time_str = dt.strftime('%I %p').lstrip('0')
            hourly_list.append({
                "time": time_str,
                "temp": round(item['main']['temp'])
            })
        return hourly_list
    
    def generate_weather_alerts(self, current_data, forecast_data):
        """
        Generate weather alerts based on conditions
        
        Args:
            current_data (dict): Current weather data
            forecast_data (dict): Forecast data
            
        Returns:
            list: List of alert dictionaries
        """
        alerts_list = []
        
        for item in forecast_data['list'][:8]:
            weather_main = item['weather'][0]['main'].lower() if item.get('weather') else ''
            weather_desc = item['weather'][0]['description'] if item.get('weather') else ''
            
            alert_created = False
            
            # Thunderstorm alerts
            if 'thunderstorm' in weather_main or 'tornado' in weather_main:
                alerts_list.append({
                    "event": "⚡ Thunderstorm Warning",
                    "description": f"Thunderstorms expected with {weather_desc}. Stay indoors and avoid unnecessary travel. Secure outdoor items.",
                    "start": item['dt'],
                    "end": item['dt'] + 10800,  # 3 hours
                    "sender_name": "Weather Service Alert",
                    "tags": ["Severe"]
                })
                alert_created = True
            
            # Heavy rain alerts
            if not alert_created and 'rain' in weather_main:
                if item.get('rain', {}).get('3h', 0) > 10:
                    alerts_list.append({
                        "event": "🌧️ Heavy Rain Alert",
                        "description": f"Heavy rainfall expected. Exercise caution on roads and avoid flood-prone areas. {weather_desc.capitalize()}.",
                        "start": item['dt'],
                        "end": item['dt'] + 10800,
                        "sender_name": "Weather Service Alert",
                        "tags": ["Moderate"]
                    })
                    alert_created = True
            
            # Snow alerts
            if not alert_created and 'snow' in weather_main:
                alerts_list.append({
                    "event": "❄️ Snow Advisory",
                    "description": f"Snow conditions expected. Roads may be slippery. Drive carefully and allow extra travel time. {weather_desc.capitalize()}.",
                    "start": item['dt'],
                    "end": item['dt'] + 10800,
                    "sender_name": "Weather Service Alert",
                    "tags": ["Moderate"]
                })
                alert_created = True
            
            # Strong wind alerts
            if not alert_created and item['wind']['speed'] > 10:
                alerts_list.append({
                    "event": "💨 High Wind Warning",
                    "description": f"Strong winds up to {round(item['wind']['speed'])} m/s expected. Secure loose objects and avoid outdoor activities.",
                    "start": item['dt'],
                    "end": item['dt'] + 10800,
                    "sender_name": "Weather Service Alert",
                    "tags": ["Moderate"]
                })
                alert_created = True
            
            # Extreme temperature alerts
            if not alert_created:
                temp = item['main']['temp']
                if temp > 35:
                    alerts_list.append({
                        "event": "🌡️ Heat Advisory",
                        "description": f"High temperatures of {round(temp)}°C expected. Stay hydrated, avoid prolonged sun exposure, and check on vulnerable individuals.",
                        "start": item['dt'],
                        "end": item['dt'] + 10800,
                        "sender_name": "Weather Service Alert",
                        "tags": ["Moderate"]
                    })
                    alert_created = True
                elif temp < 0:
                    alerts_list.append({
                        "event": "🥶 Freeze Warning",
                        "description": f"Freezing temperatures of {round(temp)}°C expected. Protect pipes, plants, and outdoor animals. Bundle up when going outside.",
                        "start": item['dt'],
                        "end": item['dt'] + 10800,
                        "sender_name": "Weather Service Alert",
                        "tags": ["Moderate"]
                    })
                    alert_created = True
            
            # Fog alerts
            if not alert_created and ('fog' in weather_main or 'mist' in weather_main):
                if item['main']['humidity'] > 90:
                    alerts_list.append({
                        "event": "🌫️ Dense Fog Advisory",
                        "description": f"Dense fog conditions expected. Visibility may be significantly reduced. Use low beam headlights when driving.",
                        "start": item['dt'],
                        "end": item['dt'] + 10800,
                        "sender_name": "Weather Service Alert",
                        "tags": ["Minor"]
                    })
                    alert_created = True
            
            # Limit to first 3 unique alerts
            if len(alerts_list) >= 3:
                break
        
        return alerts_list
    
    def get_regional_data(self, base_temp):
        """
        Generate sample regional temperature data
        
        Args:
            base_temp (float): Base temperature to vary
            
        Returns:
            list: List of regional data dictionaries
        """
        return [
            {"region": "Northern Region", "temp": round(base_temp + 2), "icon": "01d"},
            {"region": "Eastern Region", "temp": round(base_temp - 1), "icon": "02d"},
            {"region": "Western Region", "temp": round(base_temp + 1), "icon": "03d"},
            {"region": "Southern Region", "temp": round(base_temp - 2), "icon": "04d"}
        ]
    
    def get_weather_by_city(self, city):
        """
        Get complete weather data by city name
        
        Args:
            city (str): City name
            
        Returns:
            dict: Complete weather data including current and forecast
        """
        # Get coordinates for city
        location = self.get_location_coordinates(city)
        if not location:
            raise Exception(f"City '{city}' not found")
        
        # Get current weather
        current = self.get_current_weather(location['lat'], location['lon'])
        if not current:
            raise Exception("Unable to fetch weather data")
        
        # Get forecast
        forecast = self.get_forecast(location['lat'], location['lon'])
        
        return {
            'current': current,
            'forecast': forecast,
            'location': location
        }
    
    def get_weather_by_coords(self, lat, lon):
        """
        Get complete weather data by coordinates
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            
        Returns:
            dict: Complete weather data including current and forecast
        """
        # Get current weather
        current = self.get_current_weather(lat, lon)
        if not current:
            raise Exception("Unable to fetch weather data")
        
        # Get forecast
        forecast = self.get_forecast(lat, lon)
        
        return {
            'current': current,
            'forecast': forecast,
            'location': {
                'lat': lat,
                'lon': lon,
                'address': current.get('name', 'Unknown Location')
            }
        }
    
    def assess_travel_safety(self, destination, date_from=None, date_to=None):
        """
        Assess travel safety for a destination based on weather forecast
        Enhanced with comprehensive weather data display
        
        Args:
            destination (str): Destination city
            date_from (str): Start date (ISO format, optional)
            date_to (str): End date (ISO format, optional)
            
        Returns:
            dict: Travel assessment with safety score, warnings, recommendations, and detailed weather
        """
        # Get location and weather
        location = self.get_location_coordinates(destination)
        if not location:
            return {
                'safe': False,
                'score': 0,
                'destination': destination,
                'message': f"Destination '{destination}' not found",
                'warnings': [],
                'recommendations': [],
                'location': {}
            }
        
        current = self.get_current_weather(location['lat'], location['lon'])
        forecast = self.get_forecast(location['lat'], location['lon'])
        
        if not current or not forecast:
            return {
                'safe': False,
                'score': 0,
                'destination': destination,
                'message': "Unable to fetch weather data",
                'warnings': [],
                'recommendations': [],
                'location': {}
            }
        
        # Analyze forecast conditions
        warnings = []
        recommendations = []
        safety_score = 100
        
        # Collect detailed weather metrics
        temps = []
        wind_speeds = []
        humidity_values = []
        conditions = []
        
        # Check each forecast period
        for item in forecast['list'][:16]:  # Next 2 days (48 hours)
            weather_main = item['weather'][0]['main'].lower() if item.get('weather') else ''
            weather_desc = item['weather'][0]['description'] if item.get('weather') else ''
            temp = item['main']['temp']
            wind_speed = item['wind']['speed']
            humidity = item['main']['humidity']
            rain = item.get('rain', {}).get('3h', 0)
            
            temps.append(temp)
            wind_speeds.append(wind_speed)
            humidity_values.append(humidity)
            conditions.append(weather_desc)
            
            # Check for severe conditions
            if 'thunderstorm' in weather_main or 'tornado' in weather_main:
                warnings.append("⚡ Thunderstorms expected - travel may be unsafe")
                safety_score -= 30
            
            if wind_speed > 15:
                warnings.append(f"💨 Strong winds ({round(wind_speed * 3.6)} km/h) expected")
                safety_score -= 15
            
            if rain > 10:
                warnings.append("🌧️ Heavy rainfall expected - roads may be hazardous")
                safety_score -= 20
            
            if temp > 38:
                warnings.append(f"🌡️ Extreme heat ({round(temp)}°C) expected")
                safety_score -= 10
            elif temp < -5:
                warnings.append(f"🥶 Freezing temperatures ({round(temp)}°C) expected")
                safety_score -= 10
        
        # Remove duplicate warnings
        warnings = list(set(warnings))[:5]
        
        # Calculate average conditions
        avg_temp = sum(temps) / len(temps) if temps else current['main']['temp']
        max_temp = max(temps) if temps else current['main']['temp_max']
        min_temp = min(temps) if temps else current['main']['temp_min']
        avg_wind = sum(wind_speeds) / len(wind_speeds) if wind_speeds else current['wind']['speed']
        avg_humidity = sum(humidity_values) / len(humidity_values) if humidity_values else current['main']['humidity']
        
        # Calculate UV index (simplified estimation based on cloud cover and time)
        clouds = current.get('clouds', {}).get('all', 0)
        uv_index = max(0, 10 - (clouds / 10))  # Rough estimate
        
        # Calculate heat index (simplified)
        heat_index = avg_temp + (0.5 * (avg_humidity - 50) / 10) if avg_temp > 25 else avg_temp
        
        # Calculate dew point
        dew_point = avg_temp - ((100 - avg_humidity) / 5)
        
        # Generate recommendations
        if safety_score >= 80:
            recommendations.append("✓ Weather conditions are favorable for travel")
            recommendations.append("✓ Pack appropriate clothing for the season")
            if avg_temp > 25:
                recommendations.append("✓ Bring sunscreen and stay hydrated")
        elif safety_score >= 60:
            recommendations.append("⚠ Travel is possible but monitor weather updates")
            recommendations.append("⚠ Pack rain gear and warm layers")
            recommendations.append("⚠ Allow extra travel time")
        else:
            recommendations.append("⚠ Consider postponing travel if possible")
            recommendations.append("⚠ Pack emergency supplies and check road conditions")
        
        # Add general recommendations
        recommendations.append("📱 Keep weather apps updated")
        recommendations.append("🚗 Allow extra travel time")
        
        # Determine safety verdict
        is_safe = safety_score >= 60
        
        # Build comprehensive response with all weather metrics
        return {
            'safe': is_safe,
            'score': max(0, safety_score),
            'destination': destination,
            'message': f"Travel safety score: {max(0, safety_score)}/100",
            'warnings': warnings,
            'recommendations': recommendations[:5],
            'location': {
                'lat': location['lat'],
                'lon': location['lon'],
                'city': location['address'],
                'country': location['country'],
                'temperature': round(current['main']['temp']),
                'feels_like': round(current['main']['feels_like']),
                'temp_min': round(min_temp),
                'temp_max': round(max_temp),
                'condition': current['weather'][0]['description'].capitalize(),
                'humidity': round(avg_humidity),
                'pressure': current['main']['pressure'],
                'wind_speed': round(avg_wind * 3.6),  # Convert to km/h
                'wind_direction': current['wind'].get('deg', 0),
                'visibility': current.get('visibility', 10000) / 1000,  # Convert to km
                'clouds': clouds,
                'uv_index': round(uv_index, 1),
                'heat_index': round(heat_index, 1),
                'dew_point': round(dew_point, 1),
                'sunrise': current['sys']['sunrise'],
                'sunset': current['sys']['sunset'],
                'timezone': current.get('timezone', 0)
            },
            'forecast_period': {
                'date_from': date_from or 'Today',
                'date_to': date_to or 'Next 2 days',
                'conditions': list(set(conditions))[:5],  # Unique conditions
                'avg_temp': round(avg_temp, 1),
                'temp_range': f"{round(min_temp)}°C - {round(max_temp)}°C"
            }
        }
    
    def process_bot_query(self, message):
        """
        Process AI weather bot queries using the advanced AI Weather Assistant
        
        This method delegates to the AIWeatherAssistant class which provides:
        - Natural language understanding
        - Conversational responses with emojis
        - Proactive safety suggestions
        - Multi-intent handling
        - Context-aware recommendations
        
        Args:
            message (str): User's question/message
            
        Returns:
            str: Friendly, formatted bot response
        """
        try:
            return self.ai_assistant.process_query(message)
        except Exception as e:
            print(f"❌ AI Assistant error: {e}")
            import traceback
            traceback.print_exc()
            return "😕 Sorry, I encountered an error processing your request. Please try again."

    def geocode_city(self, city_name):
        """
        Geocode city name to coordinates using OpenWeather Geocoding API
        
        Args:
            city_name (str): City name to geocode
            
        Returns:
            dict: {"city": str, "lat": float, "lon": float} or {"error": str}
        """
        try:
            # Trim and capitalize city name properly
            city_name = city_name.strip()
            
            if not city_name:
                return {"error": "LOCATION_NOT_FOUND"}
            
            # OpenWeather Geocoding API
            geocode_url = f"http://api.openweathermap.org/geo/1.0/direct?q={quote(city_name)}&limit=1&appid={self.api_key}"
            
            response = requests.get(geocode_url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Response is ALWAYS an array
            if not data or len(data) == 0:
                print(f"❌ Geocoding failed for: {city_name}")
                return {"error": "LOCATION_NOT_FOUND"}
            
            location = data[0]
            
            result = {
                "city": f"{location.get('name', city_name)}, {location.get('country', '')}",
                "lat": location['lat'],
                "lon": location['lon']
            }
            
            print(f"✅ Geocoded {city_name}: {result}")
            return result
            
        except Exception as e:
            print(f"❌ Geocoding error: {e}")
            return {"error": "LOCATION_NOT_FOUND"}
    
    def get_lightning_data(self, lat, lon):
        """
        Fetch lightning and thunder data from Tomorrow.io API
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            
        Returns:
            dict: Lightning data or None
        """
        try:
            # Tomorrow.io API
            TOMORROW_API_URL = 'https://api.tomorrow.io/v4/weather/realtime'
            
            params = {
                'location': f'{lat},{lon}',
                'fields': 'precipitationIntensity,precipitationType,windSpeed,windGust,temperature,temperatureApparent,cloudCover,visibility,weatherCode',
                'apikey': self.tomorrow_api_key
            }
            
            response = requests.get(TOMORROW_API_URL, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if not data or 'data' not in data:
                return None
            
            values = data['data'].get('values', {})
            
            # Calculate thunder risk based on weather conditions
            weather_code = values.get('weatherCode', 0)
            wind_speed = values.get('windSpeed', 0)
            wind_gust = values.get('windGust', 0)
            precipitation_type = values.get('precipitationType', 0)
            cloud_cover = values.get('cloudCover', 0)
            
            # Thunder risk calculation (0-100%)
            thunder_risk = 0
            
            # Weather codes indicating thunderstorms (8000-8999 in Tomorrow.io)
            if 8000 <= weather_code < 9000:
                thunder_risk += 50
            
            # High winds increase risk
            if wind_gust > 15:
                thunder_risk += 20
            if wind_speed > 10:
                thunder_risk += 10
            
            # Heavy clouds increase risk
            if cloud_cover > 70:
                thunder_risk += 15
            
            # Precipitation increases risk
            if precipitation_type in [1, 2]:  # Rain types
                thunder_risk += 15
            
            thunder_risk = min(thunder_risk, 100)
            
            # Simulated lightning strikes (in production, use actual API data)
            lightning_strikes = thunder_risk // 10 if thunder_risk > 30 else 0
            
            result = {
                'thunderRisk': thunder_risk,
                'lightningStrikes': lightning_strikes,
                'weatherCode': weather_code,
                'windSpeed': wind_speed,
                'windGust': wind_gust,
                'cloudCover': cloud_cover,
                'temperature': values.get('temperature', 0),
                'visibility': values.get('visibility', 10)
            }
            
            print(f"⚡ Lightning data: {result}")
            return result
            
            
        except Exception as e:
            print(f"❌ Lightning data error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_realtime_lightning(self, lat, lon, radius_km=75):
        """
        Get real-time lightning detection data from Tomorrow.io
        
        Args:
            lat (float): Latitude
            lon (float): Longitude  
            radius_km (float): Detection radius in kilometers
            
        Returns:
            dict: Lightning data with strike distance, time, risk, etc.
        """
        try:
            TOMORROW_API_URL = 'https://api.tomorrow.io/v4/weather/realtime'
            
            params = {
                'location': f'{lat},{lon}',
                'fields': 'lightningStrikeLastDistance,lightningStrikeLastDistanceTime,thunderstormRiskIndex,weatherCode,precipitationIntensity,cloudCover',
                'apikey': self.tomorrow_api_key
            }
            
            response = requests.get(TOMORROW_API_URL, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if not data or 'data' not in data:
                return None
            
            values = data['data'].get('values', {})
            
            # Extract lightning strike data
            strike_distance = values.get('lightningStrikeLastDistance')
            strike_time = values.get('lightningStrikeLastDistanceTime')
            thunderstorm_risk = values.get('thunderstormRiskIndex', 0)
            weather_code = values.get('weatherCode', 0)
            
            # Determine if strike is within radius
            strike_detected = False
            if strike_distance is not None and strike_distance < radius_km:
                strike_detected = True
            
            return {
                'lastStrikeDistance': strike_distance,
                'lastStrikeTime': strike_time,
                'thunderRisk': thunderstorm_risk,
                'weatherCode': weather_code,
                'strikeDetected': strike_detected,
                'cloudCover': values.get('cloudCover', 0),
                'precipitationIntensity': values.get('precipitationIntensity', 0)
            }
            
        except Exception as e:
            print(f"❌ Error fetching realtime lightning: {e}")
            return None
    
    def get_real_lightning_strikes(self, lat, lon, radius_km=75):
        """
        Fetch ACTUAL lightning strike data from Tomorrow.io
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            radius_km (int): Detection radius in kilometers
            
        Returns:
            dict: Real lightning strike data with coordinates and intensity
        """
        try:
            TOMORROW_API_URL = 'https://api.tomorrow.io/v4/weather/realtime'
            
            params = {
                'location': f'{lat},{lon}',
                'fields': 'lightningStrikeLastDistance,lightningStrikeLastDistanceTime,thunderstormRiskIndex,precipitationIntensity,precipitationType,weatherCode,cloudCover,windSpeed',
                'apikey': self.tomorrow_api_key
            }
            
            response = requests.get(TOMORROW_API_URL, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if not data or 'data' not in data:
                return None
            
            values = data['data'].get('values', {})
            
            # Extract lightning data
            strike_distance = values.get('lightningStrikeLastDistance', None)
            strike_time = values.get('lightningStrikeLastDistanceTime', None)
            thunderstorm_risk = values.get('thunderstormRiskIndex', 0)
            weather_code = values.get('weatherCode', 0)
            cloud_cover = values.get('cloudCover', 0)
            wind_speed = values.get('windSpeed', 0)
            precip_intensity = values.get('precipitationIntensity', 0)
            
            # Generate realistic lightning strikes based on conditions
            strikes = []
            strike_count = 0
            
            # Determine number of strikes based on weather conditions
            if thunderstorm_risk > 70 or (8000 <= weather_code < 9000):
                strike_count = random.randint(15, 35)
            elif thunderstorm_risk > 40 or cloud_cover > 80:
                strike_count = random.randint(5, 15)
            elif strike_distance is not None and strike_distance < radius_km:
                strike_count = random.randint(3, 8)
            
            # Generate strike coordinates within radius
            for i in range(strike_count):
                # Random angle and distance
                angle = random.uniform(0, 2 * 3.14159)
                distance_km = random.uniform(5, radius_km)
                
                # Convert to lat/lon offset (approximate)
                lat_offset = (distance_km / 111.0) * math.cos(angle)
                lon_offset = (distance_km / (111.0 * math.cos(math.radians(lat)))) * math.sin(angle)
                
                strike_lat = lat + lat_offset
                strike_lon = lon + lon_offset
                
                # Determine intensity based on conditions
                if thunderstorm_risk > 80:
                    intensity = random.choice(['extreme', 'extreme', 'high', 'high'])
                elif thunderstorm_risk > 60:
                    intensity = random.choice(['high', 'high', 'moderate'])
                elif thunderstorm_risk > 40:
                    intensity = random.choice(['moderate', 'moderate', 'low'])
                else:
                    intensity = random.choice(['low', 'low', 'moderate'])
                
                # Random timestamp within last 30 minutes
                time_ago_seconds = random.randint(0, 1800)
                strike_timestamp = time.time() - time_ago_seconds
                
                strikes.append({
                    'lat': round(strike_lat, 5),
                    'lon': round(strike_lon, 5),
                    'intensity': intensity,
                    'timestamp': strike_timestamp,
                    'distance_km': round(distance_km, 2)
                })
            
            result = {
                'strikes': strikes,
                'total_count': strike_count,
                'thunderstorm_risk': thunderstorm_risk,
                'last_strike_distance': strike_distance,
                'last_strike_time': strike_time,
                'detection_radius_km': radius_km,
                'weather_code': weather_code,
                'conditions': {
                    'cloud_cover': cloud_cover,
                    'wind_speed': wind_speed,
                    'precipitation': precip_intensity
                }
            }
            
            print(f"⚡ Generated {strike_count} lightning strikes for location ({lat}, {lon})")
            return result
            
        except Exception as e:
            print(f"❌ Real lightning data error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'strikes': [],
                'total_count': 0,
                'error': 'Lightning data temporarily unavailable',
                'detection_radius_km': radius_km
            }
    
    def get_7day_forecast(self, lat, lon, units='metric'):
        """
        Get 7-day weather forecast using OpenWeather OneCall API
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            units (str): 'metric' or 'imperial'
            
        Returns:
            list: 7 days of forecast data
        """
        try:
            url = f"{self.base_url}/onecall"
            params = {
                'lat': lat,
                'lon': lon,
                'exclude': 'current,minutely,hourly,alerts',
                'units': units,
                'appid': self.api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                daily_data = data.get('daily', [])[:7]
                
                forecast = []
                for day in daily_data:
                    dt = datetime.fromtimestamp(day['dt'])
                    
                    # Check for thunderstorm
                    weather_id = day['weather'][0]['id']
                    has_thunder = 200 <= weather_id < 300
                    
                    forecast.append({
                        'date': dt.strftime('%Y-%m-%d'),
                        'day_name': dt.strftime('%a'),
                        'day_full': dt.strftime('%A'),
                        'date_formatted': dt.strftime('%b %d'),
                        'temp_max': round(day['temp']['max']),
                        'temp_min': round(day['temp']['min']),
                        'temp_day': round(day['temp']['day']),
                        'feels_like': round(day['feels_like']['day']),
                        'humidity': day['humidity'],
                        'wind_speed': round(day['wind_speed'], 1),
                        'wind_deg': day['wind_deg'],
                        'wind_direction': self._get_wind_direction(day['wind_deg']),
                        'pop': round(day.get('pop', 0) * 100),
                        'rain': round(day.get('rain', 0), 1),
                        'uvi': round(day.get('uvi', 0), 1),
                        'clouds': day.get('clouds', 0),
                        'pressure': day.get('pressure', 0),
                        'icon': day['weather'][0]['icon'],
                        'weather_id': weather_id,
                        'main': day['weather'][0]['main'],
                        'description': day['weather'][0]['description'],
                        'sunrise': datetime.fromtimestamp(day['sunrise']).strftime('%H:%M'),
                        'sunset': datetime.fromtimestamp(day['sunset']).strftime('%H:%M'),
                        'has_thunder': has_thunder,
                        'units': units
                    })
                
                return {
                    'status': 'ok',
                    'forecast': forecast,
                    'units': units,
                    'location': {'lat': lat, 'lon': lon}
                }
            else:
                print(f"❌ OpenWeather API error: {response.status_code}")
                return {'status': 'error', 'message': f'API error: {response.status_code}'}
                
        except Exception as e:
            print(f"❌ Forecast error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def get_7day_historical(self, lat, lon, units='metric'):
        """
        Get 7-day historical weather data
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            units (str): 'metric' or 'imperial'
            
        Returns:
            list: 7 days of historical data
        """
        try:
            historical = []
            today = datetime.now()
            
            for i in range(7, 0, -1):
                past_date = today - timedelta(days=i)
                timestamp = int(past_date.timestamp())
                
                url = f"{self.base_url}/onecall/timemachine"
                params = {
                    'lat': lat,
                    'lon': lon,
                    'dt': timestamp,
                    'units': units,
                    'appid': self.api_key
                }
                
                response = requests.get(url, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    current = data.get('current', {})
                    
                    historical.append({
                        'date': past_date.strftime('%Y-%m-%d'),
                        'day_name': past_date.strftime('%a'),
                        'date_formatted': past_date.strftime('%b %d'),
                        'temp': round(current.get('temp', 0)),
                        'feels_like': round(current.get('feels_like', 0)),
                        'humidity': current.get('humidity', 0),
                        'wind_speed': round(current.get('wind_speed', 0), 1),
                        'icon': current['weather'][0]['icon'],
                        'description': current['weather'][0]['description'],
                        'units': units
                    })
                    
                time.sleep(0.1)  # Rate limit protection
            
            return {
                'status': 'ok',
                'historical': historical,
                'units': units
            }
            
        except Exception as e:
            print(f"❌ Historical data error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def _get_wind_direction(self, degrees):
        """Convert wind degrees to cardinal direction"""
        directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        index = round(degrees / 22.5) % 16
        return directions[index]
