# 🌤️ Weather Pulse

A professional, full-stack weather application built with Flask (Python backend) and modern HTML/CSS/JavaScript frontend. Features real-time weather data, 5-day forecasts, interactive maps, weather alerts, and a beautiful responsive UI.

## 📁 Project Structure

```
weatherapp/
├── backend/                    # Flask Backend
│   ├── app.py                 # Main Flask application
│   ├── weather_service.py     # Weather API service
│   ├── ai_weather_assistant.py # 🆕 AI Weather Assistant module
│   ├── alert_service.py       # Weather alerts service
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables (not in git)
│   ├── .env.example           # Environment template
│   └── __init__.py            # Package initialization
│
├── frontend/                   # Frontend Assets
│   ├── templates/
│   │   └── index.html         # Main dashboard HTML
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css      # Dashboard styles (enhanced for AI bot)
│   │   ├── js/
│   │   │   └── script.js      # Client-side logic (enhanced bot UI)
│   │   ├── images/            # Icons and images
│   │   └── maps/              # Generated map files
│
├── AI_ASSISTANT_GUIDE.md       # 🆕 AI Assistant user guide
├── AI_ASSISTANT_TECHNICAL_DOCS.md # 🆕 Technical documentation
├── AI_ASSISTANT_QUICK_REFERENCE.md # 🆕 Developer quick reference
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## ✨ Features

### 🤖 AI Weather Assistant (NEW!)
- 💬 **Conversational AI** - Natural language understanding
- 🌤️ **Current Weather** - Detailed conditions with emojis
- 📅 **7-Day Forecasts** - Complete weekly outlook
- ✈️ **Travel Safety** - Risk assessment with scores (0-100)
- 🌍 **City Comparisons** - Side-by-side weather analysis
- ⚡ **Lightning Detection** - Real-time storm monitoring
- 🌧️ **Rain Predictions** - Hourly rainfall forecasts
- 👕 **Clothing Advice** - Weather-appropriate outfit suggestions
- 😷 **Air Quality** - Breathing safety recommendations
- 💡 **Proactive Tips** - Smart suggestions (umbrella, jacket, etc.)

**See detailed documentation:**
- `AI_ASSISTANT_GUIDE.md` - Complete user guide with examples
- `AI_ASSISTANT_TECHNICAL_DOCS.md` - Technical documentation
- `AI_ASSISTANT_QUICK_REFERENCE.md` - Developer quick reference

### Backend Features
- 🔐 **Secure API Key Management** - Environment-based configuration
- 🌍 **OpenWeather API Integration** - Current weather & 5-day forecast
- 📍 **Geocoding** - Convert city names to coordinates
- ⚠️ **Smart Weather Alerts** - Automatic alert generation for severe conditions
- 🔔 **Custom Alert System** - User-defined thresholds with real-time monitoring
- 🗺️ **Regional Data** - Temperature data for different regions
- 📊 **Hourly Data** - 24-hour temperature trends
- 🏥 **Health Check** - API health monitoring endpoint

### Frontend Features
- 🎨 **Modern Weatherly UI** - Clean, professional dashboard design
- 🔍 **City Search** - Real-time weather data for any city
- 🌡️ **Current Weather Card** - Temperature, humidity, wind, pressure
- 📈 **Temperature Trend Chart** - Interactive Chart.js visualization
- 📅 **5-Day Forecast** - Daily weather predictions
- 🌅 **Sunrise/Sunset Times** - Formatted local times
- 🗺️ **Interactive Map** - Leaflet.js map integration
- ⚡ **Weather Alert System** - Custom threshold notifications
- 🔔 **Push Notifications** - Browser-based alert notifications
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎯 **Sidebar Navigation** - Easy access to all features
- 🌙 **Weather Animations** - Dynamic background effects

### 🆕 Weather Alert System (Premium Feature)
- ⚙️ **Custom Thresholds** - Set limits for temperature, wind, rainfall, lightning & AQI
- ⏰ **Auto-Monitoring** - Checks weather every 5 minutes
- 🔔 **Instant Alerts** - Beautiful slide-in notifications when thresholds exceeded
- 📲 **Browser Notifications** - Desktop push notifications with permission
- 🎨 **Modern UI** - Gradient modal with smooth animations
- 📍 **Location-Aware** - Updates when you change cities
- 🛡️ **Smart Cooldown** - Prevents duplicate alerts (30-min intervals)
- 📊 **Severity Indicators** - Color-coded by severity (severe/moderate/minor)

**See detailed documentation in:**
- `QUICK_START_ALERTS.md` - Quick setup guide
- `WEATHER_ALERT_SYSTEM.md` - Complete technical documentation
- `DEMO_SCENARIOS.md` - Testing scenarios & examples
- `IMPLEMENTATION_SUMMARY.md` - Requirements checklist

## 🚀 Getting Started

### Prerequisites
- Python 3.8 or higher
- OpenWeather API key ([Get one here](https://openweathermap.org/api))
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd weatherapp
   ```

2. **Set up the backend**
   ```bash
   cd backend
   
   # Create virtual environment (recommended)
   python -m venv venv
   
   # Activate virtual environment
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example file
   copy .env.example .env    # Windows
   cp .env.example .env      # macOS/Linux
   
   # Edit .env and add your API key
   OPENWEATHER_API_KEY=your_api_key_here
   ```

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Open your browser**
   Navigate to: `http://localhost:5000`

## 🔧 Configuration

### Environment Variables

Edit `backend/.env`:

```env
# Required
OPENWEATHER_API_KEY=your_openweather_api_key

# Optional
MAPBOX_TOKEN=your_mapbox_token    # For advanced map features
FLASK_ENV=development              # development | production
FLASK_DEBUG=True                   # True | False
```

### Flask Configuration

In `backend/app.py`, you can modify:
- **Port**: Change `port=5000` to any available port
- **Host**: Change `host="0.0.0.0"` to specific IP
- **Debug Mode**: Set `debug=False` for production

## 📡 API Endpoints

### GET `/`
Serves the main dashboard page

### GET `/weather?city={cityname}`
Returns comprehensive weather data for a city

**Query Parameters:**
- `city` (required): City name (e.g., "London", "New York")

**Response:**
```json
{
  "city": "London, GB",
  "country": "GB",
  "temp": 12,
  "feels_like": 10,
  "desc": "overcast clouds",
  "icon": "04d",
  "humidity": 82,
  "wind": 5.14,
  "pressure": 1010,
  "coord": {"lat": 51.5074, "lon": -0.1278},
  "high": 15,
  "low": 9,
  "sunrise": "06:45 AM",
  "sunset": "05:30 PM",
  "forecast": [...],
  "alerts": [...],
  "regions": [...],
  "hourly": [...]
}
```

### GET `/health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "weather-api"
}
```

## 🎨 Frontend Architecture

### JavaScript Modules
- **Weather API Client**: Fetches data from backend
- **UI Renderer**: Updates dashboard components
- **Chart Manager**: Chart.js temperature/precipitation charts
- **Map Controller**: Leaflet.js interactive maps
- **Notification System**: Weather alerts management
- **View Switcher**: Navigate between dashboard sections

### CSS Architecture
- **Variables**: Consistent color scheme and spacing
- **Components**: Modular card-based design
- **Animations**: Smooth transitions and weather effects
- **Responsive**: Mobile-first approach with breakpoints
- **Utilities**: Helper classes for common patterns

## 🛠️ Development

### Backend Development
```bash
cd backend
python app.py
```
The server will auto-reload on code changes with debug mode enabled.

### Frontend Development
Edit files in `frontend/`:
- `templates/index.html` - HTML structure
- `static/css/style.css` - Styling
- `static/js/script.js` - JavaScript logic

Refresh browser to see changes.

## 📦 Dependencies

### Backend (Python)
- **Flask 3.0.0** - Web framework
- **requests 2.31.0** - HTTP client
- **python-dotenv 1.0.0** - Environment variables
- **geopy 2.4.1** - Geocoding (optional)
- **folium 0.15.1** - Map generation (optional)

### Frontend (CDN)
- **Chart.js 4.4.0** - Charts and graphs
- **Leaflet.js** - Interactive maps
- **Inter Font** - Typography

## 🚢 Production Deployment

1. **Set environment to production**
   ```env
   FLASK_ENV=production
   FLASK_DEBUG=False
   ```

2. **Use a production WSGI server**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

3. **Set up reverse proxy** (nginx/Apache)

4. **Enable HTTPS** (Let's Encrypt)

5. **Configure firewall** rules

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **OpenWeather API** - Weather data provider
- **Chart.js** - Beautiful charts
- **Leaflet.js** - Interactive maps
- **Flask** - Python web framework

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Made with ☕ and ❤️**
