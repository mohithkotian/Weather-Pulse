/**
 * Weather Alert System
 * Handles alert display, statistics, and real-time updates
 * Supports both polling (default) and Socket.IO (optional)
 */

// Global state
let alerts = [];
let stats = {
    total_alerts_today: 0,
    most_frequent: null,
    last_alert: null,
    counts_by_type: {}
};

// Polling interval (10 seconds)
const POLL_INTERVAL = 10000;
let pollTimer = null;

// Optional: Socket.IO client (uncomment to enable)
// let socket = null;

/**
 * Initialize alerts page
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Alerts page initializing...');
    
    // Initial data fetch
    fetchAlerts();
    fetchStats();
    
    // Start polling for updates (default mode)
    startPolling();
    
    // Optional: Initialize Socket.IO (comment out polling if using this)
    // initSocketIO();
    
    // Set up event listeners
    setupEventListeners();
});

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Clear all button
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllAlerts);
    }
    
    // Test alert button
    const testAlertBtn = document.getElementById('testAlertBtn');
    if (testAlertBtn) {
        testAlertBtn.addEventListener('click', generateTestAlert);
    }
}

/**
 * Fetch all alerts from backend
 */
async function fetchAlerts() {
    try {
        const response = await fetch('/api/alerts');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        alerts = await response.json();
        displayAlerts();
        
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        showToast('Failed to fetch alerts', 'error');
    }
}

/**
 * Fetch alert statistics from backend
 */
async function fetchStats() {
    try {
        const response = await fetch('/api/alerts/stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        stats = await response.json();
        displayStats();
        updateSidebarBadge(alerts.length);
        
    } catch (error) {
        console.error('Failed to fetch stats:', error);
    }
}

/**
 * Display alerts in the UI
 */
function displayAlerts() {
    const container = document.getElementById('alertsContainer');
    const emptyState = document.getElementById('emptyState');
    const clearAllBtn = document.getElementById('clearAllBtn');
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'flex';
        clearAllBtn.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    clearAllBtn.style.display = 'inline-flex';
    
    // Create alert cards
    container.innerHTML = alerts.map(alert => createAlertCard(alert)).join('');
}

/**
 * Create HTML for a single alert card
 */
function createAlertCard(alert) {
    const alertClass = getAlertClass(alert.type);
    const fieldLabel = formatFieldLabel(alert.field);
    const timeFormatted = formatAlertTime(alert.time);
    
    return `
        <div class="alert-card ${alertClass}">
            <div class="alert-header">
                <div>
                    <h3 class="alert-type">${alert.type} Alert</h3>
                    <p style="font-size: 0.875rem; color: #64748b; margin-top: 4px;">
                        <strong>${fieldLabel}</strong> triggered
                    </p>
                </div>
                <span class="alert-time">${timeFormatted}</span>
            </div>
            <div class="alert-details">
                <div class="alert-detail-item">
                    <span class="alert-detail-label">Field</span>
                    <span class="alert-detail-value">${fieldLabel}</span>
                </div>
                <div class="alert-detail-item">
                    <span class="alert-detail-label">Current Value</span>
                    <span class="alert-detail-value">${alert.value} ${getUnit(alert.field)}</span>
                </div>
                <div class="alert-detail-item">
                    <span class="alert-detail-label">Threshold</span>
                    <span class="alert-detail-value">${alert.threshold} ${getUnit(alert.field)}</span>
                </div>
                <div class="alert-detail-item">
                    <span class="alert-detail-label">Location</span>
                    <span class="alert-detail-value">${alert.location}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Get CSS class based on alert type
 */
function getAlertClass(type) {
    const typeMap = {
        'Temperature': 'alert-temperature',
        'Wind Speed': 'alert-wind',
        'Rainfall': 'alert-rainfall',
        'Lightning': 'alert-lightning',
        'Air Quality': 'alert-air'
    };
    return typeMap[type] || 'alert-temperature';
}

/**
 * Format field name for display
 */
function formatFieldLabel(field) {
    const labels = {
        'temperature': 'Temperature',
        'wind_speed': 'Wind Speed',
        'rainfall': 'Rainfall',
        'lightning_strikes': 'Lightning Strikes',
        'air_quality_index': 'Air Quality Index'
    };
    return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get unit for field
 */
function getUnit(field) {
    const units = {
        'temperature': '°C',
        'wind_speed': 'm/s',
        'rainfall': 'mm',
        'lightning_strikes': 'strikes',
        'air_quality_index': 'AQI'
    };
    return units[field] || '';
}

/**
 * Format alert timestamp to human-readable time
 */
function formatAlertTime(timeString) {
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

/**
 * Display statistics in the UI
 */
function displayStats() {
    // Update stat cards
    document.getElementById('totalAlertsToday').textContent = stats.total_alerts_today || 0;
    document.getElementById('mostFrequent').textContent = stats.most_frequent || '--';
    document.getElementById('lastAlert').textContent = stats.last_alert || '--';
    document.getElementById('totalAlerts').textContent = alerts.length || 0;
    
    // Update chart
    displayChart();
}

/**
 * Display alert type breakdown chart
 */
function displayChart() {
    const chartContainer = document.getElementById('chartBars');
    
    if (!stats.counts_by_type || Object.keys(stats.counts_by_type).length === 0) {
        chartContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">No data available</p>';
        return;
    }
    
    // Find max count for scaling
    const maxCount = Math.max(...Object.values(stats.counts_by_type));
    
    // Create chart bars
    chartContainer.innerHTML = Object.entries(stats.counts_by_type)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .map(([type, count]) => {
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return `
                <div class="chart-bar">
                    <span class="chart-bar-label">${type}</span>
                    <div class="chart-bar-container">
                        <div class="chart-bar-fill" style="width: ${percentage}%;"></div>
                    </div>
                    <span class="chart-bar-value">${count}</span>
                </div>
            `;
        })
        .join('');
}

/**
 * Clear all alerts
 */
async function clearAllAlerts() {
    if (!confirm('Are you sure you want to clear all alerts?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/alerts/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Update UI
        alerts = [];
        displayAlerts();
        fetchStats();
        
        showToast(`Cleared ${result.cleared} alert${result.cleared !== 1 ? 's' : ''}`, 'success');
        
    } catch (error) {
        console.error('Failed to clear alerts:', error);
        showToast('Failed to clear alerts', 'error');
    }
}

/**
 * Generate a test alert
 */
async function generateTestAlert() {
    const testAlerts = [
        {
            type: 'Temperature',
            field: 'temperature',
            value: 35,
            threshold: 30,
            location: 'Test City'
        },
        {
            type: 'Wind Speed',
            field: 'wind_speed',
            value: 45,
            threshold: 40,
            location: 'Test City'
        },
        {
            type: 'Rainfall',
            field: 'rainfall',
            value: 50,
            threshold: 30,
            location: 'Test City'
        }
    ];
    
    // Pick random test alert
    const testAlert = testAlerts[Math.floor(Math.random() * testAlerts.length)];
    
    try {
        const response = await fetch('/api/alerts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testAlert)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Refresh alerts and stats
        await fetchAlerts();
        await fetchStats();
        
        showToast('Test alert generated successfully', 'success');
        
    } catch (error) {
        console.error('Failed to generate test alert:', error);
        showToast('Failed to generate test alert', 'error');
    }
}

/**
 * Start polling for updates (default mode)
 */
function startPolling() {
    // Clear any existing timer
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    
    // Poll every 10 seconds
    pollTimer = setInterval(() => {
        fetchAlerts();
        fetchStats();
    }, POLL_INTERVAL);
    
    console.log('Polling started (10s interval)');
}

/**
 * Stop polling
 */
function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        console.log('Polling stopped');
    }
}

// ========== OPTIONAL: SOCKET.IO IMPLEMENTATION ==========
// Uncomment this section to enable real-time updates via Socket.IO
// Remember to also uncomment Socket.IO imports in app.py

/*
function initSocketIO() {
    // Stop polling if switching to Socket.IO
    stopPolling();
    
    // Initialize Socket.IO connection
    socket = io();
    
    // Connection event
    socket.on('connect', () => {
        console.log('Socket.IO connected');
        showToast('Real-time updates enabled', 'success');
    });
    
    // Disconnection event
    socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
        showToast('Real-time updates disconnected', 'warning');
    });
    
    // New alert event
    socket.on('new_alert', (alert) => {
        console.log('New alert received:', alert);
        
        // Add to local array
        alerts.unshift(alert);
        
        // Update UI
        displayAlerts();
        fetchStats();
        
        // Show notification
        showToast(`New ${alert.type} alert for ${alert.location}`, 'warning');
    });
    
    // Alerts cleared event
    socket.on('alerts_cleared', () => {
        console.log('Alerts cleared');
        alerts = [];
        displayAlerts();
        fetchStats();
    });
    
    // Stats update event
    socket.on('stats_update', (newStats) => {
        stats = newStats;
        displayStats();
    });
}
*/

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopPolling();
    // if (socket) socket.disconnect();
});

console.log('Alerts script loaded');
