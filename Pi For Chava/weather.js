// CONFIGURATION
const apiKey = "014755c1113d69f07c28f820937ff774"; // Hardcoded for your Pi
const zip = "97030";
const weatherNow = document.getElementById("weather");
const forecastContainer = document.getElementById("forecast-container");

// 1. EXIT LOGIC: Click anywhere to close/stop
document.addEventListener('click', () => {
    window.close();
    document.body.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:100vh; text-align:center; background:#111; color:white; font-family:sans-serif;">
            <div><h1 style="font-size: 3rem; color: #ff4444;">Dashboard Stopped</h1><p>You can now safely close the browser.</p></div>
        </div>`;
});

function getIconClass(code) {
    const map = {
        '01d': 'wi-day-sunny', '01n': 'wi-night-clear',
        '02d': 'wi-day-cloudy', '02n': 'wi-night-alt-cloudy',
        '03d': 'wi-cloud', '03n': 'wi-cloud',
        '04d': 'wi-cloudy', '04n': 'wi-cloudy',
        '09d': 'wi-showers', '09n': 'wi-night-alt-showers',
        '10d': 'wi-rain', '10n': 'wi-night-alt-rain',
        '11d': 'wi-thunderstorm', '11n': 'wi-thunderstorm',
        '13d': 'wi-snow', '13n': 'wi-snow',
        '50d': 'wi-fog', '50n': 'wi-fog',
    };
    return map[code] || 'wi-na';
}

async function fetchCurrentWeather() {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${zip},us&units=imperial&appid=${apiKey}`);
        if (!res.ok) throw new Error("Data unavailable");
        const data = await res.json();
        
        const iconClass = getIconClass(data.weather[0].icon);
        const temp = Math.round(data.main.temp);
        const desc = data.weather[0].description;
        const time = new Date().toLocaleTimeString();

        // FIX: Clean template literal to prevent "Unterminated" errors
        weatherNow.innerHTML = `
            <h1 style="color: #aaa; font-size: 1.5rem; margin:0;">Gresham, OR</h1>
            <div><i class="weather-icon wi ${iconClass}"></i></div>
            <h2 style="font-size: 4rem; margin: 10px 0;">${temp}°F</h2>
            <p style="text-transform: capitalize; font-size: 1.5rem;">${desc}</p>
            <p style="font-size: 0.8em; color: #666;">Last Sync: ${time}</p>`;
    } catch (err) {
        weatherNow.innerHTML = `<h1>Connection Lost</h1><p>Retrying soon...</p>`;
    }
}

async function fetchForecast() {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?zip=${zip},us&units=imperial&appid=${apiKey}`);
        const data = await res.json();
        const daily = data.list.filter(item => item.dt_txt.includes("12:00:00"));

        forecastContainer.innerHTML = '<div class="forecast-strip"></div>';
        const strip = forecastContainer.querySelector('.forecast-strip');

        daily.forEach(info => {
            const dayName = new Date(info.dt * 1000).toLocaleDateString(undefined, { weekday: "short" });
            const icon = getIconClass(info.weather[0].icon);
            strip.innerHTML += `
                <div class="forecast-day">
                    <div style="font-weight: bold; margin-bottom: 5px;">${dayName}</div>
                    <i class="wi ${icon}"></i>
                    <div style="margin-top: 5px;">${Math.round(info.main.temp)}°F</div>
                </div>`;
        });
    } catch (err) { console.error("Forecast failed:", err); }
}

fetchCurrentWeather();
fetchForecast();
setInterval(fetchCurrentWeather, 15 * 60 * 1000);
setInterval(fetchForecast, 60 * 60 * 1000);