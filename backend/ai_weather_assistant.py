"""
AI Weather Assistant Module
An advanced conversational AI that provides weather insights, safety recommendations,
and personalized guidance with a friendly, professional tone.

This assistant can:
- Explain current weather conditions
- Provide 7-day forecasts
- Analyze lightning & thunderstorm risks
- Predict rainfall intensity
- Give travel safety recommendations
- Compare weather between cities
- Offer clothing and activity suggestions
- Explain air quality and UV index
- Detect user intent from natural language
"""

import re
from datetime import datetime
from typing import Dict, List, Optional, Any


class AIWeatherAssistant:
    """
    Advanced AI Weather Assistant with natural language understanding
    """
    
    def __init__(self, weather_service):
        """
        Initialize AI Assistant with weather service
        
        Args:
            weather_service: Instance of WeatherService for fetching weather data
        """
        self.weather_service = weather_service
        
    def process_query(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Process user query and return a conversational response
        
        Args:
            message (str): User's question or request
            context (dict, optional): Additional context like current location, previous queries
            
        Returns:
            str: Friendly, formatted response with weather information
        """
        message_lower = message.lower().strip()
        
        # === Greetings & Introductions ===
        if self._is_greeting(message_lower):
            return self._handle_greeting()
        
        # === Help & Capabilities ===
        if self._is_help_request(message_lower):
            return self._handle_help()
        
        # === Thank you / Acknowledgment ===
        if self._is_thank_you(message_lower):
            return self._handle_thank_you()
        
        # Extract cities from query
        cities = self._extract_cities(message)
        
        # === City Comparison ===
        if self._is_comparison(message_lower) and len(cities) >= 2:
            return self._handle_city_comparison(cities[0], cities[1])
        
        # === Travel Safety ===
        if self._is_travel_query(message_lower):
            if cities:
                return self._handle_travel_safety(cities[0])
            else:
                # Try to extract from entire message as fallback
                words = message.split()
                for word in words:
                    if len(word) > 3 and word[0].isupper():
                        return self._handle_travel_safety(word)
                return "✈️ I'd love to help with travel planning! Just mention a destination.\n\n" \
                       "For example: 'Is it safe to travel to Paris?'"
        
        # === Lightning & Thunder ===
        if self._is_lightning_query(message_lower):
            if cities:
                return self._handle_lightning_query(cities[0])
            else:
                return "⚡ I can check lightning activity for you!\n\n" \
                       "Which city would you like me to check? For example:\n" \
                       "• 'Lightning near Mumbai'\n" \
                       "• 'Is there thunder in Seattle?'\n" \
                       "• 'Storm activity in London'"
        
        # === Rainfall Prediction ===
        if self._is_rain_query(message_lower):
            if cities:
                return self._handle_rain_query(cities[0])
            else:
                return "🌧️ I can check rainfall predictions! Just mention a city.\n\nExample: 'Will it rain in London?'"
        
        # === Clothing Suggestion ===
        if self._is_clothing_query(message_lower):
            if cities:
                return self._handle_clothing_suggestion(cities[0])
            else:
                return "👕 I can suggest what to wear! Just mention a city.\n\nExample: 'What to wear in Paris?'"
        
        # === Air Quality ===
        if self._is_air_quality_query(message_lower):
            if cities:
                return self._handle_air_quality(cities[0])
            else:
                return "😷 I can check air quality! Just mention a city.\n\nExample: 'Air quality in Delhi'"
        
        # === 7-Day Forecast ===
        if self._is_forecast_query(message_lower):
            if cities:
                return self._handle_forecast(cities[0])
            else:
                return "📅 I can provide a 7-day forecast! Just mention a city.\n\nExample: 'Forecast for London'"
        
        # === Current Weather (Default) ===
        if cities:
            return self._handle_current_weather(cities[0])
        else:
            return "🤔 I'd love to help! Just mention a city.\n\nExample: 'Weather in London'"
    
    # ===============================================
    # INTENT DETECTION METHODS
    # ===============================================
    
    def _is_greeting(self, message: str) -> bool:
        """Detect greeting patterns"""
        greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 
                     'good evening', 'greetings', 'howdy', "what's up", 'sup']
        return any(word in message for word in greetings)
    
    def _is_help_request(self, message: str) -> bool:
        """Detect help/capability requests"""
        help_patterns = ['help', 'what can you do', 'how to use', 'capabilities',
                         'features', 'commands', 'what do you know']
        return any(pattern in message for pattern in help_patterns)
    
    def _is_thank_you(self, message: str) -> bool:
        """Detect thank you messages"""
        thanks = ['thank', 'thanks', 'appreciate', 'thx', 'ty']
        return any(word in message for word in thanks)
    
    def _is_comparison(self, message: str) -> bool:
        """Detect city comparison queries"""
        patterns = ['compare', 'vs', 'versus', 'difference between', 'better', 'worse']
        return any(pattern in message for pattern in patterns)
    
    def _is_travel_query(self, message: str) -> bool:
        """Detect travel safety queries"""
        patterns = ['travel', 'trip', 'visit', 'safe to', 'should i go', 'journey',
                    'vacation', 'holiday', 'fly', 'drive']
        return any(pattern in message for pattern in patterns)
    
    def _is_lightning_query(self, message: str) -> bool:
        """Detect lightning/thunder queries"""
        patterns = ['lightning', 'thunder', 'storm', 'electric', 'strikes']
        return any(pattern in message for pattern in patterns)
    
    def _is_rain_query(self, message: str) -> bool:
        """Detect rainfall queries"""
        patterns = ['rain', 'umbrella', 'wet', 'drizzle', 'shower', 'downpour',
                    'precipitation', 'will it rain']
        return any(pattern in message for pattern in patterns)
    
    def _is_clothing_query(self, message: str) -> bool:
        """Detect clothing suggestion queries"""
        patterns = ['wear', 'clothing', 'dress', 'jacket', 'coat', 'outfit',
                    'what should i wear', 'bring']
        return any(pattern in message for pattern in patterns)
    
    def _is_air_quality_query(self, message: str) -> bool:
        """Detect air quality queries"""
        patterns = ['air quality', 'aqi', 'pollution', 'breathe', 'smog', 'pm2.5']
        return any(pattern in message for pattern in patterns)
    
    def _is_forecast_query(self, message: str) -> bool:
        """Detect forecast queries"""
        patterns = ['forecast', 'next week', '7 day', 'seven day', 'upcoming',
                    'tomorrow', 'day after', 'this week']
        return any(pattern in message for pattern in patterns)
    
    # ===============================================
    # UTILITY METHODS
    # ===============================================
    
    def _extract_cities(self, message: str) -> List[str]:
        """
        Extract city names from user message - AGGRESSIVELY extracts any location mention
        
        Returns:
            List of city names found in the message
        """
        cities = []
        
        # Enhanced patterns - case insensitive, captures more variations
        patterns = [
            r'\bin\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:today|tomorrow|now|right now|\?|$))',
            r'\bat\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:today|tomorrow|now|right now|\?|$))',
            r'\bfor\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:today|tomorrow|now|right now|\?|$))',
            r'\bto\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:today|tomorrow|now|right now|\?|$))',
            r'\bnear\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:today|tomorrow|now|right now|\?|$))',
            r'\bof\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:today|tomorrow|now|right now|\?|$))',
            r'(?:weather|rain|temperature|forecast|hot|cold|sunny|cloudy)\s+(?:in|at|for|near)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s|$|\?)',
            r'\b([a-zA-Z][a-zA-Z\s]+?)\s+(?:weather|rain|temperature|forecast|or)\b',
            r'\b(udupi|malpe|manipal|mangalore|kundapura|murudeshwar|byndoor|suratkal|delhi|mumbai|bangalore|london|paris|tokyo|new york|los angeles|chicago|seattle|dubai|singapore)\b',
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\?',
            r'\bvs\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s|$|\?)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, message, re.IGNORECASE)
            if matches:
                cities.extend([m.strip() for m in matches if isinstance(m, str)])
        
        # Split on "vs", "versus", "or" for comparisons
        comparison_words = [' vs ', ' versus ', ' or ', ' and ']
        for word in comparison_words:
            if word in message.lower():
                parts = message.lower().split(word)
                for part in parts:
                    # Extract words that look like city names (capitalized or not)
                    words = part.strip().split()
                    for w in words:
                        if len(w) > 2 and w.isalpha():
                            cities.append(w.title())
        
        # Remove common words that aren't cities
        stop_words = {'weather', 'rain', 'today', 'tomorrow', 'now', 'the', 'is', 'it', 
                     'will', 'what', 'how', 'can', 'should', 'about', 'tell', 'me',
                     'safe', 'travel', 'wear', 'need', 'forecast', 'compare', 'right'}
        
        # Remove duplicates and stop words, preserve order
        seen = set()
        unique_cities = []
        for city in cities:
            city = city.strip().title()
            city_lower = city.lower()
            if city and city_lower not in seen and city_lower not in stop_words and len(city) > 2:
                seen.add(city_lower)
                unique_cities.append(city)
        
        return unique_cities
    
    def _get_weather_emoji(self, description: str, temp: float) -> str:
        """Get appropriate emoji for weather condition"""
        desc_lower = description.lower()
        
        if 'clear' in desc_lower:
            return '☀️' if temp > 15 else '🌤️'
        elif 'cloud' in desc_lower:
            return '☁️'
        elif 'rain' in desc_lower or 'drizzle' in desc_lower:
            return '🌧️'
        elif 'thunder' in desc_lower or 'storm' in desc_lower:
            return '⛈️'
        elif 'snow' in desc_lower:
            return '❄️'
        elif 'fog' in desc_lower or 'mist' in desc_lower:
            return '🌫️'
        else:
            return '🌤️'
    
    # ===============================================
    # RESPONSE HANDLERS
    # ===============================================
    
    def _handle_greeting(self) -> str:
        """Handle greeting messages"""
        return "👋 Hello! I'm your AI Weather Assistant 😊\n\n" \
               "I'm here to help you with:\n" \
               "• Current weather conditions ☀️\n" \
               "• 7-day forecasts 📅\n" \
               "• Travel safety advice ✈️\n" \
               "• Lightning & storm alerts ⚡\n" \
               "• Rainfall predictions 🌧️\n" \
               "• City comparisons 🌍\n" \
               "• Clothing suggestions 👕\n\n" \
               "Just ask me anything about weather!"
    
    def _handle_help(self) -> str:
        """Handle help requests"""
        return "🤖 **I'm your Weather Assistant!** Here's what I can do:\n\n" \
               "**Current Weather:**\n" \
               "• 'What's the weather in London?'\n" \
               "• 'How's Paris today?'\n\n" \
               "**Forecasts:**\n" \
               "• '7-day forecast for New York'\n" \
               "• 'Will it rain tomorrow in Tokyo?'\n\n" \
               "**Travel Safety:**\n" \
               "• 'Is it safe to travel to Dubai?'\n" \
               "• 'Should I visit Mumbai this week?'\n\n" \
               "**Comparisons:**\n" \
               "• 'Compare London vs Paris weather'\n" \
               "• 'Which is warmer, Miami or LA?'\n\n" \
               "**Lightning & Storms:**\n" \
               "• 'Lightning near Seattle'\n" \
               "• 'Is there thunder in Delhi?'\n\n" \
               "**Clothing Advice:**\n" \
               "• 'What should I wear in Berlin?'\n" \
               "• 'Do I need a jacket today?'\n\n" \
               "Ask me anything! 😊"
    
    def _handle_thank_you(self) -> str:
        """Handle thank you messages"""
        responses = [
            "You're very welcome! 😊 Stay safe out there!",
            "Happy to help! 🌤️ Have a wonderful day!",
            "My pleasure! ☀️ Feel free to ask anytime!",
            "Glad I could help! 🌈 Stay weather-wise!"
        ]
        import random
        return random.choice(responses)
    
    def _handle_current_weather(self, city: str) -> str:
        """Handle current weather queries"""
        try:
            location = self.weather_service.get_location_coordinates(city)
            if not location:
                return f"😕 Sorry, I couldn't find '{city}'. Could you check the spelling?"
            
            current = self.weather_service.get_current_weather(location['lat'], location['lon'])
            if not current:
                return "⚠️ Weather data is temporarily unavailable. Please try again in a moment."
            
            temp = round(current['main']['temp'])
            feels_like = round(current['main']['feels_like'])
            condition = current['weather'][0]['description'].capitalize()
            humidity = current['main']['humidity']
            wind_kmh = round(current['wind']['speed'] * 3.6, 1)
            visibility_km = round(current.get('visibility', 10000) / 1000, 1)
            pressure = current['main']['pressure']
            
            emoji = self._get_weather_emoji(condition, temp)
            
            response = f"Here's the current weather in **{city}** {emoji}:\n\n"
            response += f"🌡️ **Temperature:** {temp}°C (feels like {feels_like}°C)\n"
            response += f"🌤️ **Condition:** {condition}\n"
            response += f"💧 **Humidity:** {humidity}%\n"
            response += f"💨 **Wind:** {wind_kmh} km/h\n"
            response += f"👁️ **Visibility:** {visibility_km} km\n"
            response += f"📊 **Pressure:** {pressure} hPa\n\n"
            
            # Proactive suggestions
            suggestions = []
            if temp < 5:
                suggestions.append("❄️ It's very cold - bundle up with warm layers!")
            elif temp > 35:
                suggestions.append("🔥 Extremely hot - stay hydrated and avoid direct sun!")
            elif temp > 28:
                suggestions.append("☀️ It's hot - drink plenty of water!")
            
            if 'rain' in condition.lower() or 'drizzle' in condition.lower():
                suggestions.append("☔ Don't forget your umbrella!")
            
            if wind_kmh > 30:
                suggestions.append("💨 Strong winds - secure loose objects!")
            
            if humidity > 80:
                suggestions.append("💦 High humidity - it might feel muggy outside")
            
            if visibility_km < 1:
                suggestions.append("🌫️ Poor visibility - drive carefully!")
            
            if suggestions:
                response += "**💡 My Suggestions:**\n"
                for suggestion in suggestions:
                    response += f"• {suggestion}\n"
            else:
                response += "✨ **Great conditions!** Perfect for outdoor activities!"
            
            return response.strip()
            
        except Exception as e:
            return f"😕 I had trouble fetching weather for {city}. Please try again or check the city name."
    
    def _handle_forecast(self, city: str) -> str:
        """Handle 7-day forecast queries"""
        try:
            location = self.weather_service.get_location_coordinates(city)
            if not location:
                return f"😕 Sorry, I couldn't find '{city}'. Could you check the spelling?"
            
            forecast = self.weather_service.get_forecast(location['lat'], location['lon'])
            if not forecast:
                return "⚠️ Forecast data is temporarily unavailable. Please try again."
            
            response = f"📅 **7-Day Forecast for {city}:**\n\n"
            
            seen_dates = set()
            day_count = 0
            
            for item in forecast['list']:
                if day_count >= 7:
                    break
                
                dt = datetime.utcfromtimestamp(item['dt'])
                date_key = dt.strftime('%Y-%m-%d')
                
                if date_key not in seen_dates:
                    seen_dates.add(date_key)
                    day_name = dt.strftime('%A, %b %d')
                    temp = round(item['main']['temp'])
                    temp_min = round(item['main']['temp_min'])
                    temp_max = round(item['main']['temp_max'])
                    condition = item['weather'][0]['description'].capitalize()
                    rain_prob = int(item.get('pop', 0) * 100)
                    
                    emoji = self._get_weather_emoji(condition, temp)
                    
                    response += f"{emoji} **{day_name}**\n"
                    response += f"   🌡️ {temp}°C (Low: {temp_min}°C, High: {temp_max}°C)\n"
                    response += f"   🌤️ {condition}\n"
                    if rain_prob > 20:
                        response += f"   🌧️ Rain: {rain_prob}%\n"
                    response += "\n"
                    day_count += 1
            
            response += "Stay prepared! 💪"
            return response.strip()
            
        except Exception as e:
            return f"😕 I had trouble fetching the forecast for {city}. Please try again."
    
    def _handle_travel_safety(self, city: str) -> str:
        """Handle travel safety queries"""
        try:
            assessment = self.weather_service.assess_travel_safety(city)
            location = assessment['location']
            current = self.weather_service.get_current_weather(location['lat'], location['lon'])
            
            score = assessment['score']
            
            # Safety verdict with emoji
            if score >= 80:
                verdict = "✅ **Excellent** - Perfect travel conditions!"
                verdict_emoji = "✅"
            elif score >= 60:
                verdict = "🟢 **Good** - Safe to travel with minor precautions"
                verdict_emoji = "🟢"
            elif score >= 40:
                verdict = "🟡 **Moderate** - Travel possible but watch weather"
                verdict_emoji = "🟡"
            elif score >= 20:
                verdict = "🟠 **Poor** - Delay if possible"
                verdict_emoji = "🟠"
            else:
                verdict = "🔴 **Not Recommended** - Unsafe conditions"
                verdict_emoji = "🔴"
            
            response = f"✈️ **Travel Safety Check for {city}**\n\n"
            response += f"{verdict_emoji} **Safety Score: {score}/100**\n"
            response += f"{verdict}\n\n"
            
            # Current conditions
            temp = round(current['main']['temp'])
            condition = current['weather'][0]['description'].capitalize()
            wind_kmh = round(current['wind']['speed'] * 3.6, 1)
            visibility_km = round(current.get('visibility', 10000) / 1000, 1)
            
            response += "**🌤️ Current Conditions:**\n"
            response += f"• Temperature: {temp}°C\n"
            response += f"• Weather: {condition}\n"
            response += f"• Wind: {wind_kmh} km/h\n"
            response += f"• Visibility: {visibility_km} km\n\n"
            
            # Warnings
            if assessment.get('warnings'):
                response += "**⚠️ Warnings:**\n"
                for warning in assessment['warnings'][:3]:
                    response += f"• {warning}\n"
                response += "\n"
            
            # Recommendations
            if assessment.get('recommendations'):
                response += "**💡 Recommendations:**\n"
                for rec in assessment['recommendations'][:3]:
                    response += f"• {rec}\n"
            
            return response.strip()
            
        except Exception as e:
            return f"😕 I couldn't assess travel safety for {city}. Please try again."
    
    def _handle_city_comparison(self, city1: str, city2: str) -> str:
        """Handle city comparison queries"""
        try:
            # Get data for both cities
            loc1 = self.weather_service.get_location_coordinates(city1)
            loc2 = self.weather_service.get_location_coordinates(city2)
            
            if not loc1 or not loc2:
                return "😕 I couldn't find one or both cities. Please check the spelling."
            
            weather1 = self.weather_service.get_current_weather(loc1['lat'], loc1['lon'])
            weather2 = self.weather_service.get_current_weather(loc2['lat'], loc2['lon'])
            
            if not weather1 or not weather2:
                return "⚠️ Weather data unavailable. Please try again."
            
            # Extract data
            temp1 = round(weather1['main']['temp'])
            temp2 = round(weather2['main']['temp'])
            cond1 = weather1['weather'][0]['description'].capitalize()
            cond2 = weather2['weather'][0]['description'].capitalize()
            humid1 = weather1['main']['humidity']
            humid2 = weather2['main']['humidity']
            wind1 = round(weather1['wind']['speed'] * 3.6, 1)
            wind2 = round(weather2['wind']['speed'] * 3.6, 1)
            
            emoji1 = self._get_weather_emoji(cond1, temp1)
            emoji2 = self._get_weather_emoji(cond2, temp2)
            
            response = f"🌍 **Weather Comparison**\n\n"
            response += f"{emoji1} **{city1}** vs {emoji2} **{city2}**\n\n"
            
            # Temperature comparison
            temp_diff = abs(temp1 - temp2)
            if temp1 > temp2:
                response += f"🌡️ **Temperature:** {city1} is warmer by {temp_diff}°C\n"
                response += f"   • {city1}: {temp1}°C\n"
                response += f"   • {city2}: {temp2}°C\n\n"
            elif temp2 > temp1:
                response += f"🌡️ **Temperature:** {city2} is warmer by {temp_diff}°C\n"
                response += f"   • {city1}: {temp1}°C\n"
                response += f"   • {city2}: {temp2}°C\n\n"
            else:
                response += f"🌡️ **Temperature:** Same ({temp1}°C)\n\n"
            
            # Condition comparison
            response += f"🌤️ **Conditions:**\n"
            response += f"   • {city1}: {cond1}\n"
            response += f"   • {city2}: {cond2}\n\n"
            
            # Humidity comparison
            response += f"💧 **Humidity:**\n"
            response += f"   • {city1}: {humid1}%\n"
            response += f"   • {city2}: {humid2}%\n\n"
            
            # Wind comparison
            response += f"💨 **Wind Speed:**\n"
            response += f"   • {city1}: {wind1} km/h\n"
            response += f"   • {city2}: {wind2} km/h\n\n"
            
            # Summary
            response += "**📊 Summary:**\n"
            if temp1 > temp2 and humid1 < humid2:
                response += f"• {city1} is warmer and less humid - likely more comfortable\n"
            elif temp2 > temp1 and humid2 < humid1:
                response += f"• {city2} is warmer and less humid - likely more comfortable\n"
            elif 'rain' in cond1.lower() and 'clear' in cond2.lower():
                response += f"• {city2} has better weather conditions\n"
            elif 'rain' in cond2.lower() and 'clear' in cond1.lower():
                response += f"• {city1} has better weather conditions\n"
            else:
                response += f"• Both cities have similar conditions\n"
            
            return response.strip()
            
        except Exception as e:
            return f"😕 I couldn't compare {city1} and {city2}. Please try again."
    
    def _handle_lightning_query(self, city: str) -> str:
        """Handle lightning/thunder queries"""
        try:
            geocode_result = self.weather_service.geocode_city(city)
            if not geocode_result or 'error' in geocode_result:
                return f"😕 Sorry, I couldn't find '{city}'. Could you check the spelling?"
            
            lat = geocode_result['lat']
            lon = geocode_result['lon']
            
            lightning_data = self.weather_service.get_lightning_data(lat, lon)
            
            if not lightning_data:
                return "⚠️ Lightning data temporarily unavailable. Please try again."
            
            thunder_prob = lightning_data.get('thunderstormProbability', 0)
            precip_intensity = lightning_data.get('precipitationIntensity', 0)
            
            response = f"⚡ **Lightning & Thunder Report for {city}:**\n\n"
            
            # Thunderstorm risk
            if thunder_prob >= 70:
                response += f"🚨 **HIGH RISK** - {thunder_prob}% thunderstorm probability\n\n"
                response += "**⚠️ Severe Weather Alert:**\n"
                response += "• Stay indoors immediately\n"
                response += "• Avoid using electronics connected to outlets\n"
                response += "• Stay away from windows\n"
                response += "• Do not go outside\n\n"
            elif thunder_prob >= 40:
                response += f"🟡 **MODERATE RISK** - {thunder_prob}% thunderstorm probability\n\n"
                response += "**💡 Safety Tips:**\n"
                response += "• Monitor weather updates closely\n"
                response += "• Postpone outdoor activities\n"
                response += "• Have a safe shelter ready\n\n"
            elif thunder_prob >= 20:
                response += f"🟢 **LOW RISK** - {thunder_prob}% thunderstorm probability\n\n"
                response += "**✅ Conditions are relatively safe**\n"
                response += "• Light chance of thunder\n"
                response += "• Stay weather-aware\n\n"
            else:
                response += f"✅ **NO RISK** - {thunder_prob}% thunderstorm probability\n\n"
                response += "**🌤️ All Clear!**\n"
                response += "• No thunderstorm activity detected\n"
                response += "• Safe to continue outdoor activities\n\n"
            
            # Rainfall intensity
            if precip_intensity > 0:
                response += f"🌧️ **Rainfall:** {precip_intensity:.1f} mm/h\n"
            
            return response.strip()
            
        except Exception as e:
            return f"😕 I couldn't check lightning data for {city}. Please try again."
    
    def _handle_rain_query(self, city: str) -> str:
        """Handle rainfall prediction queries"""
        try:
            location = self.weather_service.get_location_coordinates(city)
            if not location:
                return f"😕 Sorry, I couldn't find '{city}'. Could you check the spelling?"
            
            forecast = self.weather_service.get_forecast(location['lat'], location['lon'])
            if not forecast:
                return "⚠️ Forecast data unavailable. Please try again."
            
            # Check next 24 hours
            response = f"🌧️ **Rainfall Forecast for {city}:**\n\n"
            
            rain_hours = []
            for item in forecast['list'][:8]:  # Next 24 hours (3-hour intervals)
                dt = datetime.utcfromtimestamp(item['dt'])
                time_str = dt.strftime('%I:%M %p')
                rain_prob = int(item.get('pop', 0) * 100)
                
                if rain_prob > 30:
                    rain_hours.append((time_str, rain_prob))
            
            if rain_hours:
                response += "**Yes, rain is expected:**\n\n"
                for time_str, prob in rain_hours[:4]:
                    if prob >= 70:
                        response += f"☔ {time_str}: **{prob}%** (High chance)\n"
                    elif prob >= 50:
                        response += f"🌧️ {time_str}: **{prob}%** (Moderate chance)\n"
                    else:
                        response += f"🌦️ {time_str}: **{prob}%** (Light chance)\n"
                
                response += "\n**💡 My Advice:**\n"
                response += "• Bring an umbrella ☂️\n"
                response += "• Wear water-resistant clothing\n"
                response += "• Plan indoor activities if possible\n"
            else:
                response += "**No significant rain expected in the next 24 hours** ✅\n\n"
                response += "**💡 You're good to go!**\n"
                response += "• No umbrella needed\n"
                response += "• Great time for outdoor activities\n"
            
            return response.strip()
            
        except Exception as e:
            return f"😕 I couldn't check rainfall for {city}. Please try again."
    
    def _handle_clothing_suggestion(self, city: str) -> str:
        """Handle clothing recommendation queries"""
        try:
            location = self.weather_service.get_location_coordinates(city)
            if not location:
                return f"😕 Sorry, I couldn't find '{city}'. Could you check the spelling?"
            
            current = self.weather_service.get_current_weather(location['lat'], location['lon'])
            if not current:
                return "⚠️ Weather data unavailable. Please try again."
            
            temp = round(current['main']['temp'])
            feels_like = round(current['main']['feels_like'])
            condition = current['weather'][0]['description'].lower()
            wind_speed = current['wind']['speed']
            
            response = f"👕 **What to Wear in {city} Today:**\n\n"
            response += f"🌡️ Temperature: {temp}°C (feels like {feels_like}°C)\n\n"
            
            suggestions = []
            
            # Temperature-based suggestions
            if temp < 0:
                suggestions.append("🧥 Heavy winter coat, thermal layers")
                suggestions.append("🧤 Gloves, scarf, and winter hat")
                suggestions.append("👢 Insulated boots")
            elif temp < 10:
                suggestions.append("🧥 Warm jacket or coat")
                suggestions.append("🧣 Scarf and light gloves")
                suggestions.append("👖 Long pants, warm socks")
            elif temp < 18:
                suggestions.append("🧥 Light jacket or sweater")
                suggestions.append("👖 Long pants or jeans")
                suggestions.append("👟 Closed-toe shoes")
            elif temp < 25:
                suggestions.append("👕 T-shirt or light shirt")
                suggestions.append("👖 Light pants or shorts")
                suggestions.append("😎 Optional: light jacket for evening")
            elif temp < 32:
                suggestions.append("👕 Light, breathable clothing")
                suggestions.append("🩳 Shorts recommended")
                suggestions.append("🕶️ Sunglasses and sun hat")
            else:
                suggestions.append("👕 Very light, loose-fitting clothes")
                suggestions.append("🩳 Shorts definitely")
                suggestions.append("🧴 Sunscreen is essential!")
                suggestions.append("💧 Carry water bottle")
            
            # Weather condition adjustments
            if 'rain' in condition or 'drizzle' in condition:
                suggestions.append("☔ Waterproof jacket/raincoat")
                suggestions.append("☔ Don't forget your umbrella!")
            
            if wind_speed > 5:
                suggestions.append("💨 Windbreaker or wind-resistant layer")
            
            response += "**👗 Clothing Recommendations:**\n"
            for suggestion in suggestions:
                response += f"• {suggestion}\n"
            
            response += "\n**💡 Additional Tips:**\n"
            if temp > 30:
                response += "• Stay in shade during peak hours (12-3 PM)\n"
                response += "• Choose light colors to reflect heat\n"
            elif temp < 5:
                response += "• Layer your clothing for warmth\n"
                response += "• Protect extremities (hands, feet, ears)\n"
            
            return response.strip()
            
        except Exception as e:
            return f"😕 I couldn't generate clothing suggestions for {city}. Please try again."
    
    def _handle_air_quality(self, city: str) -> str:
        """Handle air quality queries"""
        # Note: This is a placeholder as OpenWeather free tier has limited AQI data
        # In production, you'd integrate with a proper AQI API
        
        try:
            location = self.weather_service.get_location_coordinates(city)
            if not location:
                return f"😕 Sorry, I couldn't find '{city}'. Could you check the spelling?"
            
            current = self.weather_service.get_current_weather(location['lat'], location['lon'])
            if not current:
                return "⚠️ Weather data unavailable. Please try again."
            
            # Use visibility and humidity as proxy indicators
            visibility = current.get('visibility', 10000) / 1000  # km
            humidity = current['main']['humidity']
            
            response = f"😷 **Air Quality Info for {city}:**\n\n"
            
            # Rough estimation based on visibility
            if visibility < 1:
                aqi_estimate = "Poor (150-200)"
                color = "🔴"
                advice = "Avoid outdoor activities. Close windows. Use air purifier indoors."
            elif visibility < 3:
                aqi_estimate = "Moderate (50-100)"
                color = "🟡"
                advice = "Sensitive people should limit outdoor exposure."
            else:
                aqi_estimate = "Good (0-50)"
                color = "🟢"
                advice = "Air quality is satisfactory. Perfect for outdoor activities!"
            
            response += f"{color} **Estimated AQI:** {aqi_estimate}\n\n"
            response += f"👁️ **Visibility:** {visibility:.1f} km\n"
            response += f"💧 **Humidity:** {humidity}%\n\n"
            response += f"**💡 Health Advice:**\n• {advice}\n\n"
            response += "⚠️ *Note: This is an estimate. For accurate AQI, check local air quality monitoring stations.*"
            
            return response.strip()
            
        except Exception as e:
            return f"😕 I couldn't check air quality for {city}. Please try again."
