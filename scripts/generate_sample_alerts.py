"""
Sample Alert Generator Script
Generates and posts sample weather alerts to the Flask backend for testing
"""

import requests
import json
import random
from datetime import datetime, timedelta

# Backend API endpoint
API_URL = "http://127.0.0.1:5000/api/alerts"

# Sample alert templates
ALERT_TEMPLATES = [
    {
        "type": "Temperature",
        "field": "temperature",
        "threshold": 30,
        "locations": ["Delhi", "Mumbai", "Phoenix", "Las Vegas", "Dubai"]
    },
    {
        "type": "Wind Speed",
        "field": "wind_speed",
        "threshold": 40,
        "locations": ["Chicago", "Boston", "London", "Wellington", "Kansas City"]
    },
    {
        "type": "Rainfall",
        "field": "rainfall",
        "threshold": 30,
        "locations": ["Seattle", "Portland", "Mumbai", "Singapore", "Bangalore"]
    },
    {
        "type": "Lightning",
        "field": "lightning_strikes",
        "threshold": 10,
        "locations": ["Tampa", "Orlando", "Miami", "Chennai", "Jakarta"]
    },
    {
        "type": "Air Quality",
        "field": "air_quality_index",
        "threshold": 150,
        "locations": ["Los Angeles", "Beijing", "Delhi", "Kolkata", "Mexico City"]
    }
]

def generate_random_alert():
    """Generate a random alert based on templates"""
    template = random.choice(ALERT_TEMPLATES)
    
    alert = {
        "type": template["type"],
        "field": template["field"],
        "value": template["threshold"] + random.randint(5, 50),
        "threshold": template["threshold"],
        "location": random.choice(template["locations"])
    }
    
    return alert

def post_alert(alert):
    """Post an alert to the backend API"""
    try:
        response = requests.post(API_URL, json=alert)
        response.raise_for_status()
        result = response.json()
        print(f"✓ Posted {alert['type']} alert for {alert['location']}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"✗ Failed to post alert: {e}")
        return None

def load_sample_alerts():
    """Load alerts from sample_alerts.json file"""
    try:
        with open('data/sample_alerts.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("sample_alerts.json not found")
        return []

def post_sample_alerts():
    """Post all alerts from sample file"""
    alerts = load_sample_alerts()
    
    if not alerts:
        print("No sample alerts found")
        return
    
    print(f"\nPosting {len(alerts)} sample alerts...\n")
    
    success_count = 0
    for alert in alerts:
        # Remove time field if present (backend will add it)
        if 'time' in alert:
            del alert['time']
        
        result = post_alert(alert)
        if result:
            success_count += 1
    
    print(f"\n✓ Successfully posted {success_count}/{len(alerts)} alerts")

def generate_and_post_alerts(count=10):
    """Generate and post random alerts"""
    print(f"\nGenerating and posting {count} random alerts...\n")
    
    success_count = 0
    for i in range(count):
        alert = generate_random_alert()
        result = post_alert(alert)
        if result:
            success_count += 1
    
    print(f"\n✓ Successfully posted {success_count}/{count} alerts")

def test_all_alert_types():
    """Test one alert of each type"""
    print("\nTesting all alert types...\n")
    
    for template in ALERT_TEMPLATES:
        alert = {
            "type": template["type"],
            "field": template["field"],
            "value": template["threshold"] + 10,
            "threshold": template["threshold"],
            "location": template["locations"][0]
        }
        post_alert(alert)
    
    print("\n✓ All alert types tested")

def clear_all_alerts():
    """Clear all alerts from the backend"""
    try:
        response = requests.post("http://127.0.0.1:5000/api/alerts/clear")
        response.raise_for_status()
        result = response.json()
        print(f"\n✓ Cleared {result.get('cleared', 0)} alerts")
    except requests.exceptions.RequestException as e:
        print(f"✗ Failed to clear alerts: {e}")

def show_menu():
    """Display interactive menu"""
    print("\n" + "="*60)
    print("Weather Alert Generator - Test Script")
    print("="*60)
    print("\nOptions:")
    print("1. Post sample alerts from file")
    print("2. Generate and post 10 random alerts")
    print("3. Test one alert of each type")
    print("4. Clear all alerts")
    print("5. Exit")
    print("\n" + "="*60)

def main():
    """Main function with interactive menu"""
    while True:
        show_menu()
        choice = input("\nEnter your choice (1-5): ").strip()
        
        if choice == '1':
            post_sample_alerts()
        elif choice == '2':
            count = input("How many alerts? (default: 10): ").strip()
            count = int(count) if count.isdigit() else 10
            generate_and_post_alerts(count)
        elif choice == '3':
            test_all_alert_types()
        elif choice == '4':
            confirm = input("Are you sure you want to clear all alerts? (yes/no): ").strip().lower()
            if confirm == 'yes':
                clear_all_alerts()
            else:
                print("Cancelled")
        elif choice == '5':
            print("\nGoodbye!")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    print("\nMake sure the Flask server is running at http://127.0.0.1:5000")
    print("Press Ctrl+C to exit at any time\n")
    
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nScript interrupted by user")
    except Exception as e:
        print(f"\nError: {e}")
