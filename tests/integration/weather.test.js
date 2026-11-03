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

  it('uses complete saved farm coordinates, including valid zero coordinates', async () => {
    const { getSavedWeatherLocation } = await import('../../src/lib/weather.js');
    expect(getSavedWeatherLocation({ latitude: '0', longitude: '0', city: 'Accra' })).to.deep.equal({
      latitude: 0,
      longitude: 0,
      location: 'Accra',
      source: 'saved',
    });
    expect(getSavedWeatherLocation({ latitude: '', longitude: '35.69' })).to.equal(null);
    expect(getSavedWeatherLocation({ latitude: '91', longitude: '35.69' })).to.equal(null);
  });

  it('geocodes a saved farm address and returns source metadata', async () => {
    const { geocodeSavedWeatherLocation } = await import('../../src/lib/weather.js');
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      expect(String(url)).to.include('name=Iringa');
      return {
        ok: true,
        json: async () => ({
          results: [{ name: 'Iringa', admin1: 'Iringa', country: 'Tanzania', latitude: -7.77, longitude: 35.69 }],
        }),
      };
    };

    try {
      expect(await geocodeSavedWeatherLocation({ city: 'Iringa' })).to.deep.equal({
        latitude: -7.77,
        longitude: 35.69,
        location: 'Iringa, Tanzania',
        source: 'saved',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('preserves the requested weather location and source in the snapshot', async () => {
    const { buildWeatherSnapshot } = await import('../../src/lib/weather.js');
    const weather = buildWeatherSnapshot({ current: { temperature_2m: 21, weather_code: 3 } }, {
      location: 'Current GPS location',
      source: 'gps',
    });
    expect(weather.location).to.equal('Current GPS location');
    expect(weather.source).to.equal('gps');
  });
});
