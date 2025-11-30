"""
Test Script for AI Weather Assistant
Run this to verify the AI assistant is working correctly
"""

import sys
import os

# Add project root (so 'backend' is a package)
sys.path.insert(0, os.path.dirname(__file__))

from backend.weather_service import WeatherService

def print_separator():
    print("\n" + "="*70 + "\n")

def test_ai_assistant():
    print("🤖 AI Weather Assistant - Test Suite")
    print_separator()
    
    # Initialize weather service (which initializes AI assistant)
    print("Initializing Weather Service...")
    try:
        weather_service = WeatherService()
        print("✅ Weather Service initialized successfully!")
    except Exception as e:
        print(f"❌ Failed to initialize Weather Service: {e}")
        return
    
    print_separator()
    
    # Test queries
    test_queries = [
        ("Greeting", "Hello"),
        ("Help Request", "What can you do?"),
        ("Current Weather", "What's the weather in London?"),
        ("Forecast", "7-day forecast for Paris"),
        ("Travel Safety", "Is it safe to travel to Tokyo?"),
        ("City Comparison", "Compare London vs Paris"),
        ("Lightning Query", "Lightning near Seattle"),
        ("Rain Query", "Will it rain in Mumbai?"),
        ("Clothing Advice", "What should I wear in Berlin?"),
        ("Air Quality", "Air quality in Delhi"),
        ("Thank You", "Thanks!")
    ]
    
    for i, (category, query) in enumerate(test_queries, 1):
        print(f"Test {i}/{len(test_queries)}: {category}")
        print(f"USER: {query}")
        print("-" * 70)
        
        try:
            response = weather_service.process_bot_query(query)
            print(f"BOT: {response}")
            print("✅ Response generated successfully!")
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        
        print_separator()
    
    print("🎉 Test suite completed!")
    print("\nNote: Some queries require internet connection and valid API keys.")
    print("If you see errors, check your .env file has OPENWEATHER_API_KEY set.")

if __name__ == "__main__":
    test_ai_assistant()
