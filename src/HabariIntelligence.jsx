import { useMemo, useState } from 'react';
import './HabariIntelligence.css';

const marketRows = [
  { crop: 'Maize', icon: 'eco', iringa: 850, kariakoo: 920, mbeya: 830, trend: '+2.4%', direction: 'up' },
  { crop: 'Beans', icon: 'grain', iringa: 1800, kariakoo: 2100, mbeya: 1750, trend: '-1.2%', direction: 'down' },
  { crop: 'Rice', icon: 'rice_bowl', iringa: 2200, kariakoo: 2450, mbeya: 2150, trend: '0.0%', direction: 'steady' },
  { crop: 'Sunflower', icon: 'sunny', iringa: 1100, kariakoo: 1300, mbeya: 1050, trend: '+4.8%', direction: 'up' },
];

const ministryStories = [
  { date: 'July 24, 2024', title: 'Government Announces New Subsidy Program for Sunflower Fertilizers', summary: 'A sample headline about a fertilizer support program for smallholder farmers in central regions.' },
  { date: 'July 22, 2024', title: 'Export Guidelines for Legumes to the Indian Market Updated', summary: 'A sample headline about export standards and phytosanitary guidance for legume producers.' },
  { date: 'July 20, 2024', title: 'Warehouse Receipt System Digitalization Drive in Mbeya', summary: 'A sample headline about digital warehouse receipt services and regional market access.' },
  { date: 'July 18, 2024', title: 'Extension Services Expand Seasonal Crop Training', summary: 'A sample headline about seasonal field training and extension support.' },
  { date: 'July 16, 2024', title: 'New Irrigation Guidance for Smallholder Farms', summary: 'A sample headline about water management practices for the growing season.' },
];

const globalStories = [
  { title: 'Global Rice Prices Surge as Major Exporters Tighten Caps', category: 'Commodity News', age: '4h ago', icon: 'sailing', imageClass: 'grain' },
  { title: 'Sustainability Rules for Coffee and Cocoa Trade', category: 'Logistics', age: '1d ago', icon: 'public', imageClass: 'trade' },
  { title: 'Sunflower Oil Market Opportunities in East Africa', category: 'Market Analysis', age: '2d ago', icon: 'wb_sunny', imageClass: 'sunflower' },
];

const formatNumber = (value) => Number(value || 0).toLocaleString('en-TZ');

function getForecastAdvice(weather) {
  const wind = Number.parseInt(weather?.current?.wind || '', 10);
  if (Number.isFinite(wind) && wind >= 25) {
    return { title: 'Elevated wind', message: `${weather.current.wind} recorded. Check product labels and local guidance before spraying.` };
  }
  const conditions = weather?.current?.conditions || '';
  if (/thunder|heavy rain|violent shower/i.test(conditions)) {
    return { title: 'Weather caution', message: `${conditions} reported. Review local conditions before field work.` };
  }
  return { title: 'Field conditions', message: weather ? `${conditions} reported. Use your field conditions and product instructions to guide farm work.` : 'A local forecast will appear when weather data is available.' };
}

function ArticleDialog({ story, onClose }) {
  if (!story) return null;
  return (
    <div className="habari-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="habari-dialog" role="dialog" aria-modal="true" aria-labelledby="habari-dialog-title">
        <header><span>Sample story · not a verified news feed</span><button type="button" aria-label="Close story" onClick={onClose}><span className="material-symbols-outlined">close</span></button></header>
        <div><p className="habari-dialog-date">{story.date || `${story.category} · ${story.age}`}</p><h2 id="habari-dialog-title">{story.title}</h2><p>{story.summary || 'This is illustrative sample news content. AGRI-NEST is not currently connected to a publisher or live news source for this item.'}</p><p className="habari-dialog-disclaimer">This story is sample UI content, not a current government notice, market bulletin, or independently sourced report.</p></div>
      </section>
    </div>
  );
}

export default function HabariIntelligence({ weather, weatherStatus = '', search = '', onSearch, onNavigate, onRecordsChange, records }) {
  const [expandedMinistryFeed, setExpandedMinistryFeed] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [notice, setNotice] = useState('');
  const [watchlistSaved, setWatchlistSaved] = useState(false);
  const normalizedSearch = search.trim().toLowerCase();
  const forecastAdvice = getForecastAdvice(weather);

  const matchingMarketRows = useMemo(
    () => marketRows.filter((row) => `${row.crop} iringa kariakoo mbeya`.toLowerCase().includes(normalizedSearch)),
    [normalizedSearch],
  );
  const matchingMinistryStories = useMemo(
    () => ministryStories.filter((story) => `${story.title} ${story.summary}`.toLowerCase().includes(normalizedSearch)),
    [normalizedSearch],
  );
  const matchingGlobalStories = useMemo(
    () => globalStories.filter((story) => `${story.title} ${story.category}`.toLowerCase().includes(normalizedSearch)),
    [normalizedSearch],
  );

  const savePriceWatch = () => {
    if (watchlistSaved) {
      setNotice('You have already saved a local market-watch note.');
      return;
    }
    if (!onRecordsChange || !records) {
      setNotice('Unable to save the market-watch note because farmer records are unavailable.');
      return;
    }
    onRecordsChange('activities', [...records.activities, {
      id: globalThis.crypto?.randomUUID?.() || `market-watch-${Date.now()}`,
      module: 'market-news',
      title: 'Market watch reminder',
      details: 'Check current crop prices with buyers or at a local market. The prices and trends shown in Habari Intelligence are illustrative sample data.',
      date: new Date().toISOString().slice(0, 10),
      status: 'Local note',
    }]);
    setWatchlistSaved(true);
    setNotice('Market-watch reminder saved in your farmer records on this device.');
  };

  const forecast = weather?.forecast?.slice(0, 3) || [];
  const humidity = weather?.current?.humidity;

  return (
    <main className="habari-page">
      {notice && <div className="habari-toast" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <div className="habari-page-heading">
        <div><p>COMMUNITY &amp; LEARNING</p><h1>Habari Intelligence</h1><span>Market context, agricultural news, and farm weather in one place.</span></div>
        <button type="button" className="habari-watch-button" onClick={savePriceWatch}><span className="material-symbols-outlined">add_chart</span>{watchlistSaved ? 'Reminder saved' : 'Save market reminder'}</button>
      </div>

      <label className="habari-mobile-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => onSearch?.(event.target.value)} placeholder="Search crop, region, or news..." aria-label="Search crop, region, or news stories" /></label>
      <div className="habari-sample-banner" role="note"><span className="material-symbols-outlined">info</span><span>Prices, trends, forecast recommendations, and news stories on this page are illustrative examples, not live market quotes, AI predictions, or official notices. Farm weather below uses AGRI-NEST’s available weather feed.</span></div>

      {normalizedSearch && <div className="habari-search-status" role="status">Showing results for “{search}”. <button type="button" onClick={() => onSearch?.('')}>Clear search</button></div>}

      <section className="habari-top-grid">
        <article className="habari-card habari-market-card">
          <div className="habari-card-heading">
            <div><span className="material-symbols-outlined">trending_up</span><div><h2>Market Price Snapshot</h2><p>Illustrative sample · not live quotes</p></div></div>
            <div className="habari-market-tags"><span>Tanzania hubs</span><span>Demo data</span></div>
          </div>
          <div className="habari-table-wrap">
            <table>
              <thead><tr><th>Crop</th><th>Iringa<br />(TZS/kg)</th><th>Kariakoo<br />(TZS/kg)</th><th>Mbeya<br />(TZS/kg)</th><th>Sample trend</th></tr></thead>
              <tbody>
                {matchingMarketRows.map((row) => <tr key={row.crop}>
                  <th scope="row"><span className="material-symbols-outlined">{row.icon}</span>{row.crop}</th>
                  <td>{formatNumber(row.iringa)}</td><td>{formatNumber(row.kariakoo)}</td><td>{formatNumber(row.mbeya)}</td>
                  <td className={`habari-trend ${row.direction}`}><span className="material-symbols-outlined">{row.direction === 'up' ? 'arrow_upward' : row.direction === 'down' ? 'arrow_downward' : 'horizontal_rule'}</span>{row.trend}</td>
                </tr>)}
                {!matchingMarketRows.length && <tr><td className="habari-table-empty" colSpan="5">No sample crop prices match this search.</td></tr>}
              </tbody>
            </table>
          </div>
          <button type="button" className="habari-text-link" onClick={() => onNavigate?.('marketplace')}>Browse seller listings in Soko <span className="material-symbols-outlined">arrow_forward</span></button>
        </article>

        <article className="habari-tabiri-card">
          <div className="habari-tabiri-heading"><span className="material-symbols-outlined">psychology</span><div><h2>Tabiri AI Analysis</h2><span>Concept preview · not a prediction</span></div></div>
          <p>AI market forecasting is not connected yet. This sample insight illustrates how rainfall, supply, and regional market signals could be presented when a verified data source is available.</p>
          <div className="habari-recommendation">
            <span>Illustrative recommendation</span>
            <strong>Compare maize offers before selling</strong>
            <small>Check recent buyer prices and transport costs in your area.</small>
          </div>
          <div className="habari-tabiri-stats"><span><strong>30 days</strong><small>Example horizon</small></span><span><strong>Not available</strong><small>Expected price</small></span><span><strong>Unknown</strong><small>Supply risk</small></span></div>
        </article>
      </section>

      <section className="habari-middle-grid">
        <article className="habari-card habari-ministry-card">
          <header className="habari-section-header"><div><span className="material-symbols-outlined">account_balance</span><h2>Wizara ya Kilimo Feed</h2></div><span className="habari-sample-label">Sample stories · not official notices</span></header>
          <div className="habari-ministry-list">
            {(expandedMinistryFeed ? matchingMinistryStories : matchingMinistryStories.slice(0, 3)).map((story) => <button type="button" className="habari-ministry-story" key={story.title} onClick={() => setSelectedStory(story)}>
              <span>{story.date} · Sample content</span><strong>{story.title}</strong><p>{story.summary}</p>
            </button>)}
            {!matchingMinistryStories.length && <p className="habari-no-results">No sample stories match this search.</p>}
          </div>
          {matchingMinistryStories.length > 3 && <button type="button" className="habari-feed-more" onClick={() => setExpandedMinistryFeed((expanded) => !expanded)}>{expandedMinistryFeed ? 'Show fewer sample stories' : 'View more sample stories'}<span className="material-symbols-outlined">{expandedMinistryFeed ? 'expand_less' : 'expand_more'}</span></button>}
        </article>

        <article className="habari-card habari-weather-card">
          <header className="habari-weather-heading"><div><span className="material-symbols-outlined">cloud_queue</span><h2>Farm Weather</h2></div><span>{weather?.location || 'Farm location'}</span></header>
          {weather ? <>
            <div className="habari-current-weather"><span className="habari-weather-symbol" aria-hidden="true">{weather.current.symbol}</span><div><strong>{weather.current.temperature}°C</strong><span>{weather.current.conditions}{humidity !== undefined ? ` · Humidity ${humidity}%` : ''}</span></div></div>
            <div className="habari-wind-alert"><span className="material-symbols-outlined">{forecastAdvice.title === 'Field conditions' ? 'check_circle' : 'warning'}</span><div><strong>{forecastAdvice.title}</strong><p>{forecastAdvice.message}</p>{weather.current.wind && <small>Wind: {weather.current.wind}</small>}</div></div>
            {weatherStatus && <p className="habari-weather-status">{weatherStatus}</p>}
            <div className="habari-forecast">{forecast.length ? forecast.map((day) => <div className="habari-forecast-day" key={`${day.day}-${day.temp}`}><span>{day.day}</span><span>{day.icon}</span><strong>{day.temp}</strong></div>) : <p>Forecast data is not available.</p>}</div>
          </> : <div className="habari-weather-empty"><span className="material-symbols-outlined">cloud_off</span><strong>Weather unavailable</strong><p>{weatherStatus || 'Weather data will appear when a farm location is available.'}</p></div>}
        </article>
      </section>

      <section className="habari-bottom-grid">
        <article className="habari-card habari-global-card">
          <header className="habari-section-header"><div><span className="material-symbols-outlined">public</span><h2>Global Market Pulse</h2></div><span className="habari-sample-label">Sample headlines</span></header>
          <div className="habari-global-list">
            {matchingGlobalStories.map((story) => <button type="button" className="habari-global-story" key={story.title} onClick={() => setSelectedStory(story)}>
              <span className={`habari-story-art ${story.imageClass}`}><span className="material-symbols-outlined">{story.icon}</span></span>
              <span className="habari-global-copy"><strong>{story.title}</strong><small>{story.category} · {story.age} · sample</small></span>
            </button>)}
            {!matchingGlobalStories.length && <p className="habari-no-results">No sample headlines match this search.</p>}
          </div>
        </article>

        <div className="habari-feature-column">
          <article className="habari-success-story">
            <div className="habari-field-art" aria-hidden="true">
              <svg viewBox="0 0 900 440" preserveAspectRatio="xMidYMid slice">
                <defs><linearGradient id="habari-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b5d7b4" /><stop offset="1" stopColor="#e9c67e" /></linearGradient><linearGradient id="habari-field" x1="0" x2="0.9" y1="0" y2="1"><stop offset="0" stopColor="#88a84a" /><stop offset="1" stopColor="#284f35" /></linearGradient></defs>
                <rect width="900" height="440" fill="url(#habari-sky)" /><circle cx="744" cy="85" r="44" fill="#fff0b0" opacity=".8" /><path d="M0 245 170 130 315 238 480 110 640 236 772 152 900 236V440H0Z" fill="#718965" opacity=".74" /><path d="M0 260 Q220 218 435 260 T900 245V440H0Z" fill="url(#habari-field)" />
                <g stroke="#c6bc66" strokeWidth="5" strokeLinecap="round" opacity=".92">{Array.from({ length: 19 }, (_, index) => <path key={index} d={`M${index * 53 - 10} 440 Q${index * 48 + 15} 337 ${index * 49 + 3} 257`} />)}</g>
                <g transform="translate(560 120)"><path d="M72 92 Q69 61 95 51 Q123 54 128 90 L148 167H54Z" fill="#314b3d" /><circle cx="99" cy="39" r="25" fill="#754c35" /><path d="M74 36 Q78 4 111 14 Q135 20 124 43 Q111 30 88 43Z" fill="#263e35" /><path d="M63 92 25 139M129 92 163 134" stroke="#754c35" strokeWidth="15" strokeLinecap="round" /><rect x="142" y="106" width="48" height="68" rx="6" fill="#303d39" transform="rotate(-13 142 106)" /><rect x="150" y="113" width="32" height="45" rx="2" fill="#98cbb2" transform="rotate(-13 150 113)" /></g>
              </svg>
            </div>
            <div className="habari-feature-shade" />
            <div className="habari-feature-copy"><span>Illustrative success story</span><h2>Growing Opportunity in the Southern Highlands</h2><p>Explore how better access to practical farm guidance and market information can support seasonal decisions.</p><small>Example story · not a verified case study</small></div>
          </article>
          <div className="habari-shortcuts">
            <button type="button" onClick={() => onNavigate?.('experts')}><span className="material-symbols-outlined">support_agent</span><span><strong>Chat with Expert</strong><small>Explore expert support</small></span><span className="material-symbols-outlined">arrow_forward</span></button>
            <button type="button" onClick={() => onNavigate?.('training')}><span className="material-symbols-outlined">library_books</span><span><strong>Farmer Handbook</strong><small>Open learning resources</small></span><span className="material-symbols-outlined">arrow_forward</span></button>
          </div>
        </div>
      </section>

      {selectedStory && <ArticleDialog story={selectedStory} onClose={() => setSelectedStory(null)} />}
    </main>
  );
}
