const { expect } = require('chai');

describe('weather snapshot builder', () => {
  it('maps current conditions and forecast data into the dashboard format', async () => {
    const { buildWeatherSnapshot } = await import('../../src/lib/weather.js');
    const weather = buildWeatherSnapshot({
      current: {
        temperature_2m: 27.4,
        relative_humidity_2m: 62,
        apparent_temperature: 29.1,
        precipitation: 0.0,
        wind_speed_10m: 15,
        uv_index: 4,
      },
      daily: {
        time: ['2026-10-05', '2026-10-06', '2026-10-07'],
        weather_code: [1, 2, 3],
        temperature_2m_max: [28, 26, 27],
        temperature_2m_min: [18, 17, 19],
      },
      timezone: 'Africa/Dar_es_Salaam',
    });

    expect(weather.location).to.equal('Iringa, Tanzania');
    expect(weather.current.temperature).to.equal(27);
    expect(weather.current.humidity).to.equal(62);
    expect(weather.current.wind).to.equal('15 km/h');
    expect(weather.current.rain).to.equal('0.0mm');
    expect(weather.current.uv).to.equal(4);
    expect(weather.forecast).to.have.length(3);
    expect(weather.forecast[0].day).to.equal('Mon');
    expect(weather.forecast[0].temp).to.equal('28°');
    expect(weather.forecast[0].icon).to.equal('🌤️');
  });
});
