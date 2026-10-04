export const WEATHER_LOCATION = { label: 'Iringa, Tanzania', latitude: -7.77, longitude: 35.69 };

const WEATHER_CODE_MAP = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Cloudy', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Foggy', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy drizzle', icon: '🌧️' },
  56: { label: 'Freezing drizzle', icon: '🌧️' },
  57: { label: 'Heavy freezing drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌦️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Freezing rain', icon: '🌧️' },
  67: { label: 'Heavy freezing rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '❄️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  77: { label: 'Snow grains', icon: '❄️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Heavy showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  85: { label: 'Snow showers', icon: '🌨️' },
  86: { label: 'Heavy snow showers', icon: '🌨️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm with hail', icon: '⛈️' },
  99: { label: 'Severe thunderstorm', icon: '⛈️' },
};

function getWeatherMeta(code) {
  return WEATHER_CODE_MAP[code] || { label: 'Conditions unclear', icon: '🌤️' };
}

function getDayLabel(dateString) {
  if (!dateString) return 'Now';

  const date = new Date(`${dateString}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function buildWeatherSnapshot(data) {
  const current = data?.current || {};
  const daily = data?.daily || {};
  const defaultCode = Number(daily.weather_code?.[0] ?? current.weather_code ?? 0);
  const weatherMeta = getWeatherMeta(defaultCode);

  const currentTemperature = Number(current.temperature_2m ?? 0);
  const currentHumidity = Number(current.relative_humidity_2m ?? 0);
  const currentWindSpeed = Number(current.wind_speed_10m ?? 0);
  const currentPrecipitation = Number(current.precipitation ?? 0);
  const currentUvIndex = Number(current.uv_index ?? 0);

  const forecast = Array.from({ length: Math.min(7, daily.time?.length || 0) }, (_, index) => {
    const date = daily.time?.[index];
    const code = Number(daily.weather_code?.[index] ?? 0);
    const meta = getWeatherMeta(code);
    const maxTemp = Number(daily.temperature_2m_max?.[index] ?? 0);

    return {
      day: getDayLabel(date),
      icon: meta.icon,
      temp: `${Math.round(maxTemp)}°`,
      summary: meta.label,
    };
  });

  return {
    location: WEATHER_LOCATION.label,
    current: {
      temperature: Math.round(currentTemperature),
      humidity: Math.round(currentHumidity),
      wind: `${Math.round(currentWindSpeed)} km/h`,
      uv: Number.isFinite(currentUvIndex) ? Math.round(currentUvIndex) : 0,
      rain: `${Number(currentPrecipitation).toFixed(1)}mm`,
      conditions: weatherMeta.label,
      symbol: weatherMeta.icon,
    },
    forecast,
  };
}

export async function fetchWeatherData({ latitude = WEATHER_LOCATION.latitude, longitude = WEATHER_LOCATION.longitude } = {}) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=7`;

  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error(`Weather API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return buildWeatherSnapshot(data);
}
