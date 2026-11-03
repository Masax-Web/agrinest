import { useEffect, useMemo, useState } from 'react';

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const makeId = () => globalThis.crypto?.randomUUID?.() || `irrigation-${Date.now()}`;
const positiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const formatLiters = (value) => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
const formatDate = (value) => {
  if (!value) return 'Date not recorded';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date not recorded'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

function getLastSevenDays(logs, selectedFieldId) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      date: dateKey,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      liters: 0,
    };
  });
  const totalsByDate = new Map(days.map((day) => [day.date, day]));

  logs.forEach((log) => {
    if (selectedFieldId && log.fieldId !== selectedFieldId) return;
    const day = totalsByDate.get(String(log.date || '').slice(0, 10));
    const liters = Number(log.waterLiters);
    if (day && Number.isFinite(liters) && liters > 0) day.liters += liters;
  });
  return days;
}

export default function IrrigationWorkspace({
  fields = [],
  logs = [],
  settings = [],
  weather,
  weatherStatus = '',
  onLogsChange,
  onSettingsChange,
  onNavigate,
}) {
  const [selectedFieldId, setSelectedFieldId] = useState(fields[0]?.id || (fields.length ? 'field-0' : ''));
  const [bucketSize, setBucketSize] = useState('');
  const [bucketCount, setBucketCount] = useState('');
  const [pumpFlow, setPumpFlow] = useState('');
  const [volume, setVolume] = useState('');
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState('');
  const [logDate, setLogDate] = useState(today);
  const [logNote, setLogNote] = useState('');
  const [moistureThreshold, setMoistureThreshold] = useState('');
  const [notice, setNotice] = useState('');

  const selectedFieldIndex = fields.findIndex((field, index) => (field.id || `field-${index}`) === selectedFieldId);
  const selectedField = selectedFieldIndex >= 0 ? fields[selectedFieldIndex] : undefined;
  const selectedSetting = settings.find((setting) => setting.fieldId === selectedFieldId);
  const validBuckets = positiveNumber(bucketSize) && positiveNumber(bucketCount);
  const estimatedLiters = validBuckets ? Number(bucketSize) * Number(bucketCount) : null;
  const estimatedPumpMinutes = estimatedLiters && positiveNumber(pumpFlow)
    ? estimatedLiters / Number(pumpFlow)
    : null;
  const fieldLogs = useMemo(() => logs
    .filter((log) => !selectedFieldId || log.fieldId === selectedFieldId)
    .filter((log) => positiveNumber(log.waterLiters))
    .sort((left, right) => `${right.date || ''}T${right.time || ''}`.localeCompare(`${left.date || ''}T${left.time || ''}`)), [logs, selectedFieldId]);
  const sevenDayTrend = useMemo(() => getLastSevenDays(logs, selectedFieldId), [logs, selectedFieldId]);
  const sevenDayTotal = sevenDayTrend.reduce((total, day) => total + day.liters, 0);
  const chartMaximum = Math.max(...sevenDayTrend.map((day) => day.liters), 1);
  const latestRainForecast = weather?.forecast?.[0];

  useEffect(() => {
    setMoistureThreshold(selectedSetting ? String(selectedSetting.moistureThresholdPercent) : '');
  }, [selectedFieldId, selectedSetting]);

  const saveLog = (event) => {
    event.preventDefault();
    if (!positiveNumber(volume)) {
      setNotice('Enter the water volume applied in litres.');
      return;
    }
    const record = {
      id: makeId(),
      type: 'irrigation',
      fieldId: selectedField ? selectedFieldId : '',
      fieldName: selectedField?.name || '',
      crop: selectedField?.crop || '',
      date: logDate,
      time,
      waterLiters: Number(volume),
      durationMinutes: duration ? Number(duration) : null,
      note: logNote.trim(),
      source: 'farmer-reported',
    };
    onLogsChange([...logs, record]);
    setVolume('');
    setDuration('');
    setLogNote('');
    setNotice('Irrigation record saved to your farm records.');
  };

  const saveSettings = () => {
    const threshold = Number(moistureThreshold);
    if (!selectedFieldId || !Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
      setNotice('Choose a field and enter a moisture reminder target from 0 to 100%.');
      return;
    }
    const nextSetting = {
      id: selectedSetting?.id || makeId(),
      fieldId: selectedFieldId,
      moistureThresholdPercent: threshold,
    };
    onSettingsChange([
      ...settings.filter((setting) => setting.fieldId !== selectedFieldId),
      nextSetting,
    ]);
    setNotice('Reminder target saved. It will not trigger watering without a connected sensor or controller.');
  };

  return (
    <main className="irrigation-hub">
      <header className="irrigation-heading">
        <div>
          <span className="irrigation-eyebrow">FIELD WATER RECORDS</span>
          <h1>Smart Irrigation Hub</h1>
          <p>Track water you apply, check available local weather, and estimate quantities using your own measurements.</p>
        </div>
        <span className="irrigation-heading-mark material-symbols-outlined" aria-hidden="true">water_drop</span>
      </header>

      <p className="irrigation-disclaimer">
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        Crop-water demand, evapotranspiration, live soil moisture, irrigation control, equipment listings, and NIRC data are not connected. No irrigation recommendation or compliance status is calculated here.
      </p>

      <section className="irrigation-field-row" aria-label="Selected field details">
        <article className="irrigation-card irrigation-field-picker">
          <label htmlFor="irrigation-field">Selected field</label>
          <select id="irrigation-field" value={selectedFieldId} onChange={(event) => setSelectedFieldId(event.target.value)}>
            <option value="">All farm records / no field selected</option>
            {fields.map((field, index) => (
              <option value={field.id || `field-${index}`} key={field.id || `field-${index}`}>
                {field.name || `Field ${index + 1}`}{field.crop ? ` · ${field.crop}` : ''}
              </option>
            ))}
          </select>
        </article>
        <article className="irrigation-card irrigation-field-summary">
          <div><small>Field size</small><strong>{selectedField?.area ? `${selectedField.area} acres` : 'Not recorded'}</strong></div>
          <div><small>Crop</small><strong>{selectedField?.crop || 'Not recorded'}</strong></div>
          <div><small>Soil record</small><strong>{selectedField?.soil?.type || selectedField?.soil?.soilType || 'Not recorded'}</strong></div>
          <div><small>Season</small><strong>{selectedField?.season || (selectedField?.plantedOn ? `Planted ${formatDate(selectedField.plantedOn)}` : 'Not recorded')}</strong></div>
        </article>
      </section>

      <section className="irrigation-core-grid">
        <article className="irrigation-card">
          <div className="irrigation-card-heading"><span className="material-symbols-outlined">cloud</span><div><h2>Weather &amp; external data</h2><p>{weather?.location || weatherStatus || 'Farm weather unavailable'}</p></div></div>
          {weather?.source === 'default' && <p className="irrigation-footnote">Regional weather reference only; your field location has not been confirmed.</p>}
          {weather ? (
            <div className="irrigation-weather-data">
              <div><small>Current conditions</small><strong>{weather.current.symbol} {weather.current.conditions}</strong></div>
              <div><small>Precipitation now</small><strong>{weather.current.rain}</strong></div>
              <div><small>Today&apos;s forecast</small><strong>{latestRainForecast?.precipitationMm == null ? 'Rain amount unavailable' : `${latestRainForecast.precipitationMm} mm forecast`}</strong></div>
              <div><small>Rain chance</small><strong>{latestRainForecast?.precipitationProbabilityPercent == null ? 'Not provided' : `${latestRainForecast.precipitationProbabilityPercent}%`}</strong></div>
            </div>
          ) : (
            <p className="irrigation-empty-note">{weatherStatus || 'Weather has not been loaded for a saved or available farm location.'}</p>
          )}
          {weather?.forecast?.length > 0 && (
            <div className="irrigation-rain-forecast" aria-label="Seven-day precipitation forecast">
              {weather.forecast.slice(0, 7).map((day, index) => (
                <div key={`${day.day}-${index}`}>
                  <small>{day.day}</small>
                  <strong>{day.precipitationMm == null ? '—' : `${day.precipitationMm} mm`}</strong>
                  <span>{day.precipitationProbabilityPercent == null ? 'Chance n/a' : `${day.precipitationProbabilityPercent}% chance`}</span>
                </div>
              ))}
            </div>
          )}
          <div className="irrigation-integration-note"><strong>Evapotranspiration</strong><span>Not provided by the connected weather feed.</span></div>
          <div className="irrigation-integration-note"><strong>NIRC water allocation</strong><span>No NIRC connection or verified status is available.</span></div>
        </article>

        <article className="irrigation-card irrigation-ledger-card">
          <div className="irrigation-card-heading"><span className="material-symbols-outlined">water</span><div><h2>Water ledger</h2><p>From your saved irrigation logs</p></div></div>
          <div className="irrigation-ledger-value">{formatLiters(sevenDayTotal)}<small>recorded in the last 7 days</small></div>
          <div className="irrigation-ledger-stats">
            <div><strong>{fieldLogs.length}</strong><span>saved irrigation records</span></div>
            <div><strong>{fieldLogs[0] ? formatDate(fieldLogs[0].date) : '—'}</strong><span>most recent record</span></div>
          </div>
          <p className="irrigation-footnote">This is recorded applied water only. It is not compared with crop demand or rainfall.</p>
        </article>

        <article className="irrigation-card irrigation-estimator-card">
          <div className="irrigation-card-heading"><span className="material-symbols-outlined">straighten</span><div><h2>Practical estimator</h2><p>Calculations use only values you enter</p></div></div>
          <div className="irrigation-form-grid">
            <label>Container capacity (litres)<input type="number" min="0.01" step="any" value={bucketSize} onChange={(event) => setBucketSize(event.target.value)} placeholder="e.g. 20" /></label>
            <label>Number of containers<input type="number" min="1" step="1" value={bucketCount} onChange={(event) => setBucketCount(event.target.value)} placeholder="e.g. 12" /></label>
            <label>Pump flow rate (L/min), optional<input type="number" min="0.01" step="any" value={pumpFlow} onChange={(event) => setPumpFlow(event.target.value)} placeholder="Enter measured flow" /></label>
          </div>
          {validBuckets ? (
            <div className="irrigation-estimate-result" aria-live="polite">
              <div><strong>{formatLiters(estimatedLiters)}</strong><span>based on your container entries</span></div>
              {estimatedPumpMinutes && <div><strong>{estimatedPumpMinutes.toLocaleString(undefined, { maximumFractionDigits: 1 })} min</strong><span>at your entered pump flow rate</span></div>}
            </div>
          ) : <p className="irrigation-empty-note">Enter container capacity and count to estimate a volume.</p>}
          <p className="irrigation-footnote">This is arithmetic, not a crop-water target or pump-performance check.</p>
        </article>
      </section>

      <section className="irrigation-lower-grid">
        <article className="irrigation-card irrigation-log-card">
          <div className="irrigation-card-heading"><span className="material-symbols-outlined">history</span><div><h2>Log irrigation</h2><p>Save what was applied to your farm records</p></div></div>
          <form onSubmit={saveLog}>
            <label>Water applied (litres)<input required type="number" min="0.01" step="any" value={volume} onChange={(event) => setVolume(event.target.value)} placeholder="Enter measured volume" /></label>
            <div className="irrigation-form-grid irrigation-log-fields">
              <label>Date<input required type="date" max={today()} value={logDate} onChange={(event) => setLogDate(event.target.value)} /></label>
              <label>Time started<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
              <label>Duration (minutes, optional)<input type="number" min="1" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="If known" /></label>
            </div>
            <label>Note (optional)<input maxLength="240" value={logNote} onChange={(event) => setLogNote(event.target.value)} placeholder="Method or other details" /></label>
            <button type="submit" className="irrigation-primary-button"><span className="material-symbols-outlined">save</span>Record irrigation</button>
          </form>
          {notice && <p className="irrigation-status" role="status">{notice}</p>}
          <div className="irrigation-recent-heading"><h3>Recent records{selectedField?.name ? ` · ${selectedField.name}` : ''}</h3></div>
          {fieldLogs.length ? (
            <ul className="irrigation-log-list">
              {fieldLogs.slice(0, 5).map((log) => (
                <li key={log.id}>
                  <span><strong>{formatLiters(log.waterLiters)}</strong><small>{log.fieldName || 'No field linked'} · {formatDate(log.date)}{log.time ? ` · ${log.time}` : ''}</small></span>
                  {log.durationMinutes ? <small>{log.durationMinutes} min</small> : null}
                </li>
              ))}
            </ul>
          ) : <p className="irrigation-empty-note">No irrigation records for this selection yet.</p>}
        </article>

        <div className="irrigation-side-column">
          <article className="irrigation-card">
            <div className="irrigation-card-heading"><span className="material-symbols-outlined">water_drop</span><div><h2>7-day irrigation trend</h2><p>Daily totals from your saved records</p></div></div>
            {sevenDayTotal > 0 ? (
              <div className="irrigation-chart" role="img" aria-label="Daily recorded irrigation volumes for the last seven days">
                {sevenDayTrend.map((day) => (
                  <div className="irrigation-chart-day" key={day.date} title={`${day.label}: ${formatLiters(day.liters)}`}>
                    <span>{day.liters ? formatLiters(day.liters) : ''}</span>
                    <div className="irrigation-chart-track"><i style={{ height: `${day.liters ? Math.max(8, day.liters / chartMaximum * 100) : 0}%` }} /></div>
                    <small>{day.label}</small>
                  </div>
                ))}
              </div>
            ) : <p className="irrigation-empty-note">Log irrigation to see recorded water use here. No soil-moisture measurements are available.</p>}
          </article>

          <article className="irrigation-card">
            <div className="irrigation-card-heading"><span className="material-symbols-outlined">tune</span><div><h2>Moisture reminder</h2><p>Manual reference only</p></div></div>
            <label className="irrigation-threshold-label">Reminder target (%)<input type="number" min="0" max="100" step="1" value={moistureThreshold} onChange={(event) => setMoistureThreshold(event.target.value)} placeholder="Set a value from 0 to 100" /></label>
            <p className="irrigation-footnote">No soil-moisture sensor or irrigation controller is connected. This setting will not automatically start, skip, or schedule watering.</p>
            <button type="button" className="irrigation-secondary-button" onClick={saveSettings} disabled={!selectedFieldId}>Save reminder target</button>
          </article>

          <article className="irrigation-card irrigation-equipment-card">
            <div className="irrigation-card-heading"><span className="material-symbols-outlined">storefront</span><div><h2>Equipment</h2><p>Find supplies through the marketplace</p></div></div>
            <p className="irrigation-empty-note">No verified equipment inventory, prices, or compatibility recommendations are connected here.</p>
            <button type="button" className="irrigation-secondary-button" onClick={() => onNavigate?.('agrishop')}>Open Agrishop Network</button>
          </article>
        </div>
      </section>
    </main>
  );
}
