"""
Weather Alert Service
Monitors weather conditions and triggers alerts when thresholds are exceeded
"""

import json
import os
from datetime import datetime, timedelta
from threading import Thread, Lock
import time
# Note: WeatherService import removed to avoid circular dependency
# AlertService can be used standalone without WeatherService

class AlertService:
    def __init__(self):
        self.alerts_file = 'user_alerts.json'
        self.active_alerts = []
        self.alert_history = {}  # Track when alerts were last triggered
        self.monitoring = False
        self.lock = Lock()
        self.cooldown_minutes = 30  # Don't trigger same alert within 30 minutes
        
    def load_alerts(self):
        """Load user alert thresholds from file"""
        if os.path.exists(self.alerts_file):
            try:
                with open(self.alerts_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading alerts: {e}")
                return {}
        return {}
    
    def save_alerts(self, alerts):
        """Save user alert thresholds to file"""
        try:
            with open(self.alerts_file, 'w') as f:
                json.dump(alerts, f, indent=2)
        except Exception as e:
            print(f"Error saving alerts: {e}")
    
    def set_threshold(self, user_id, alert_type, threshold_value, location, enabled=True):
        """
        Set a weather threshold for a user
        alert_type: 'temperature', 'wind', 'rainfall', 'lightning', 'aqi'
        threshold_value: numeric value
        location: {'lat': X, 'lon': Y, 'name': 'City'}
        """
        alerts = self.load_alerts()
        
        if user_id not in alerts:
            alerts[user_id] = {
                'thresholds': {},
                'location': location
            }
        
        # Update or create threshold
        if 'thresholds' not in alerts[user_id]:
            alerts[user_id]['thresholds'] = {}
            
        alerts[user_id]['thresholds'][alert_type] = {
            'value': float(threshold_value),
            'enabled': enabled,
            'created_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat()
        }
        alerts[user_id]['location'] = location
        
        self.save_alerts(alerts)
        return True
    
    def update_location(self, user_id, location):
        """Update user's monitoring location"""
        alerts = self.load_alerts()
        if user_id in alerts:
            alerts[user_id]['location'] = location
            self.save_alerts(alerts)
            return True
        return False
    
    def get_user_thresholds(self, user_id):
        """Get all thresholds for a user"""
        alerts = self.load_alerts()
        return alerts.get(user_id, {})
    
    def delete_threshold(self, user_id, alert_type):
        """Delete a specific threshold"""
        alerts = self.load_alerts()
        if user_id in alerts and 'thresholds' in alerts[user_id]:
            if alert_type in alerts[user_id]['thresholds']:
                del alerts[user_id]['thresholds'][alert_type]
                self.save_alerts(alerts)
                return True
        return False
    
    def toggle_threshold(self, user_id, alert_type, enabled):
        """Enable or disable a threshold"""
        alerts = self.load_alerts()
        if user_id in alerts and 'thresholds' in alerts[user_id]:
            if alert_type in alerts[user_id]['thresholds']:
                alerts[user_id]['thresholds'][alert_type]['enabled'] = enabled
                self.save_alerts(alerts)
                return True
        return False
    
    def should_trigger_alert(self, user_id, alert_type):
        """Check if alert should be triggered based on cooldown period"""
        key = f"{user_id}:{alert_type}"
        
        if key not in self.alert_history:
            return True
        
        last_triggered = self.alert_history[key]
        time_since = datetime.now() - last_triggered
        
        return time_since > timedelta(minutes=self.cooldown_minutes)
    
    def mark_alert_triggered(self, user_id, alert_type):
        """Mark an alert as triggered"""
        key = f"{user_id}:{alert_type}"
        self.alert_history[key] = datetime.now()
    
    def check_thresholds(self, user_id, current_data=None):
        """
        Check if current weather exceeds any thresholds
        Returns list of triggered alerts with detailed information
        
        Args:
            user_id: User identifier
            current_data: Weather data dict (if None, will skip weather checks)
        """
        alerts = self.load_alerts()
        user_data = alerts.get(user_id, {})
        
        if not user_data or 'thresholds' not in user_data:
            return []
        
        location = user_data.get('location', {})
        if not location or 'lat' not in location:
            return []
        
        # If no weather data provided, return empty list
        if not current_data:
            return []
            
        triggered = []
        thresholds = user_data['thresholds']
        city_name = location.get('name', 'your location')
        
        # Check temperature
        if 'temperature' in thresholds and thresholds['temperature']['enabled']:
            current_temp = current_data['main']['temp']
            threshold = thresholds['temperature']['value']
            
            if current_temp >= threshold and self.should_trigger_alert(user_id, 'temperature'):
                alert = {
                    'type': 'temperature',
                    'title': '🌡️ High Temperature Alert',
                    'message': f'Temperature in {city_name} has reached {current_temp:.1f}°C, exceeding your threshold of {threshold}°C.',
                    'current_value': round(current_temp, 1),
                    'threshold_value': round(threshold, 1),
                    'unit': '°C',
                    'severity': self._get_temp_severity(current_temp),
                    'icon': '🌡️',
                    'timestamp': datetime.now().isoformat(),
                    'location': city_name
                }
                triggered.append(alert)
                self.mark_alert_triggered(user_id, 'temperature')
        
        # Check wind speed
        if 'wind' in thresholds and thresholds['wind']['enabled']:
            current_wind = current_data['wind']['speed']
            threshold = thresholds['wind']['value']
            
            if current_wind >= threshold and self.should_trigger_alert(user_id, 'wind'):
                alert = {
                    'type': 'wind',
                    'title': '💨 High Wind Alert',
                    'message': f'Wind speed in {city_name} has reached {current_wind:.1f} m/s, exceeding your threshold of {threshold} m/s.',
                    'current_value': round(current_wind, 1),
                    'threshold_value': round(threshold, 1),
                    'unit': 'm/s',
                    'severity': self._get_wind_severity(current_wind),
                    'icon': '💨',
                    'timestamp': datetime.now().isoformat(),
                    'location': city_name
                }
                triggered.append(alert)
                self.mark_alert_triggered(user_id, 'wind')
        
        # Check rainfall (from hourly data if available)
        if 'rainfall' in thresholds and thresholds['rainfall']['enabled']:
            current_rain = current_data.get('rain', {}).get('1h', 0)
            threshold = thresholds['rainfall']['value']
            
            if current_rain >= threshold and self.should_trigger_alert(user_id, 'rainfall'):
                alert = {
                    'type': 'rainfall',
                    'title': '🌧️ Heavy Rainfall Alert',
                    'message': f'Rainfall in {city_name} has reached {current_rain:.1f} mm/h, exceeding your threshold of {threshold} mm/h.',
                    'current_value': round(current_rain, 1),
                    'threshold_value': round(threshold, 1),
                    'unit': 'mm/h',
                    'severity': 'moderate',
                    'icon': '🌧️',
                    'timestamp': datetime.now().isoformat(),
                    'location': city_name
                }
                triggered.append(alert)
                self.mark_alert_triggered(user_id, 'rainfall')
        
        # Check for lightning/thunderstorms
        if 'lightning' in thresholds and thresholds['lightning']['enabled']:
            weather_main = current_data.get('weather', [{}])[0].get('main', '').lower()
            if 'thunderstorm' in weather_main or 'thunder' in weather_main:
                if self.should_trigger_alert(user_id, 'lightning'):
                    alert = {
                        'type': 'lightning',
                        'title': '⚡ Thunderstorm Alert',
                        'message': f'Thunderstorm detected in {city_name}. Lightning activity is present. Stay indoors and avoid outdoor activities.',
                        'current_value': 'Active',
                        'threshold_value': 'Enabled',
                        'unit': '',
                        'severity': 'severe',
                        'icon': '⚡',
                        'timestamp': datetime.now().isoformat(),
                        'location': city_name
                    }
                    triggered.append(alert)
                    self.mark_alert_triggered(user_id, 'lightning')
        
        # Check AQI (placeholder - requires separate API)
        if 'aqi' in thresholds and thresholds['aqi']['enabled']:
            # AQI would require air pollution API endpoint
            # For now, this is a placeholder for future implementation
            pass
        
        return triggered
    
    def _get_temp_severity(self, temp):
        """Determine temperature alert severity"""
        if temp >= 40:
            return 'severe'
        elif temp >= 35:
            return 'moderate'
        else:
            return 'minor'
    
    def _get_wind_severity(self, wind_speed):
        """Determine wind alert severity"""
        if wind_speed >= 20:
            return 'severe'
        elif wind_speed >= 10:
            return 'moderate'
        else:
            return 'minor'
    
    def get_active_alerts(self, user_id):
        """Get active alerts for user"""
        with self.lock:
            return [alert for alert in self.active_alerts if alert.get('user_id') == user_id]
    
    def add_active_alert(self, user_id, alert):
        """Add an alert to active alerts list"""
        with self.lock:
            alert['user_id'] = user_id
            alert['id'] = f"{user_id}_{alert['type']}_{int(time.time())}"
            self.active_alerts.append(alert)
    
    def clear_alert(self, alert_id):
        """Clear a specific alert by ID"""
        with self.lock:
            self.active_alerts = [a for a in self.active_alerts if a.get('id') != alert_id]
            return True
    
    def clear_all_alerts(self, user_id=None):
        """Clear all active alerts for a user or all users"""
        with self.lock:
            if user_id:
                self.active_alerts = [a for a in self.active_alerts if a.get('user_id') != user_id]
            else:
                self.active_alerts = []
