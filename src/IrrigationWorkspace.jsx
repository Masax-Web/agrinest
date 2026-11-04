import { useEffect, useMemo, useState } from 'react';

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const makeId = () => globalThis.crypto?.randomUUID?.() || `irrigation-${Date.now()}`;
const positiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const fieldRecordId = (field, index) => field.id || `field-${index}`;
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
  moistureReadings = [],
  weather,
  weatherStatus = '',
  onLogsChange,
  onSettingsChange,
  onMoistureReadingsChange,
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
  const [moisturePercent, setMoisturePercent] = useState('');
  const [moistureDate, setMoistureDate] = useState(today);
  const [notice, setNotice] = useState('');

  const selectedFieldIndex = fields.findIndex((field, index) => fieldRecordId(field, index) === selectedFieldId);
  const selectedField = selectedFieldIndex >= 0 ? fields[selectedFieldIndex] : undefined;
  const selectedSetting = settings.find((setting) => setting.fieldId === selectedFieldId);
  const moistureByField = useMemo(() => fields.map((field, index) => {
    const fieldId = fieldRecordId(field, index);
    const readings = moistureReadings
      .filter((reading) => reading.fieldId === fieldId && String(reading.moisturePercent ?? '').trim() !== ''
        && Number.isFinite(Number(reading.moisturePercent))
        && Number(reading.moisturePercent) >= 0 && Number(reading.moisturePercent) <= 100)
      .sort((left, right) => `${right.date || ''}T${right.time || ''}`.localeCompare(`${left.date || ''}T${left.time || ''}`));
    const setting = settings.find((item) => item.fieldId === fieldId);
    return { field, fieldId, readings, latest: readings[0], setting };
  }), [fields, moistureReadings, settings]);
  const validBuckets = positiveNumber(bucketSize)
    && Number.isInteger(Number(bucketCount))
    && positiveNumber(bucketCount)
    && Number.isFinite(Number(bucketSize) * Number(bucketCount));
  const estimatedLiters = validBuckets ? Number(bucketSize) * Number(bucketCount) : null;
  const estimatedPumpMinutes = estimatedLiters && positiveNumber(pumpFlow)
    && Number.isFinite(estimatedLiters / Number(pumpFlow))
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
    if (fields.length && !fields.some((field, index) => fieldRecordId(field, index) === selectedFieldId)) {
      setSelectedFieldId(fieldRecordId(fields[0], 0));
    }
  }, [fields, selectedFieldId]);

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

  const saveMoistureReading = (event) => {
    event.preventDefault();
    const value = Number(moisturePercent);
    if (!selectedField) {
      setNotice('Add or select a field in Digital Farm before recording its moisture.');
      return;
    }
    if (moisturePercent.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100) {
      setNotice('Enter a measured moisture value from 0 to 100%.');
      return;
    }
    if (!moistureDate || moistureDate > today()) {
      setNotice('Choose a moisture-reading date that is not in the future.');
      return;
    }
    if (!onMoistureReadingsChange) {
      setNotice('Unable to save the moisture reading because farm records are unavailable.');
      return;
    }
    const reading = {
      id: makeId(),
      fieldId: selectedFieldId,
      fieldName: selectedField.name || `Field ${selectedFieldIndex + 1}`,
      moisturePercent: value,
      date: moistureDate,
      source: 'farmer-entered',
    };
    onMoistureReadingsChange([...moistureReadings, reading]);
    setMoisturePercent('');
    setNotice('Moisture reading saved as a farmer-entered observation. No sensor is connected.');
  };

  const saveSettings = () => {
    const threshold = Number(moistureThreshold);
    if (!selectedFieldId || moistureThreshold.trim() === '' || !Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
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
          <span className="irrigation-eyebrow">KADIRIA MAJI · FIELD WATER RECORDS</span>
          <h1>Smart Irrigation Hub</h1>
          <p>Review field observations, local forecast context, and the water you record applying.</p>
        </div>
        <span className={`irrigation-connection-status ${weather ? 'available' : ''}`}>
          <span className="material-symbols-outlined" aria-hidden="true">{weather ? 'cloud_done' : 'cloud_off'}</span>
          {weather?.source === 'default' ? 'Regional weather reference' : weather ? 'Farm weather snapshot available' : 'Weather unavailable'}
        </span>
      </header>

      <p className="irrigation-disclaimer">
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        Moisture values are farmer-entered observations, not live sensor readings. AGRI-NEST is not connected to irrigation controls, evapotranspiration, crop-water recommendations, equipment inventory, or NIRC records.
      </p>
      {notice && <p className="irrigation-status" role="status">{notice}</p>}

      <section className="irrigation-field-dashboard" aria-labelledby="irrigation-fields-title">
        <div className="irrigation-section-heading">
          <div><span className="material-symbols-outlined" aria-hidden="true">grid_view</span><div><h2 id="irrigation-fields-title">Field moisture overview</h2><p>Select a field to review its saved water records.</p></div></div>
          <span>{fields.length} {fields.length === 1 ? 'field' : 'fields'}</span>
        </div>
        {fields.length ? (
          <div className="irrigation-field-cards">
            {moistureByField.map(({ field, fieldId, readings, latest, setting }, index) => {
              const targetPercent = Number(setting?.moistureThresholdPercent);
              const hasTarget = String(setting?.moistureThresholdPercent ?? '').trim() !== ''
                && Number.isInteger(targetPercent) && targetPercent >= 0 && targetPercent <= 100;
              const isBelowTarget = Boolean(latest && hasTarget && Number(latest.moisturePercent) < targetPercent);
              const status = latest ? (isBelowTarget ? 'Below your target' : hasTarget ? 'At/above your target' : 'Reading saved') : 'No reading';
              const ringOffset = latest ? 251 - (251 * Number(latest.moisturePercent) / 100) : 251;
              const recentReadings = readings.slice(0, 7).reverse();
              return (
                <button
                  type="button"
                  key={fieldId}
                  className={`irrigation-field-card${selectedFieldId === fieldId ? ' selected' : ''}${isBelowTarget ? ' below-target' : ''}`}
                  aria-pressed={selectedFieldId === fieldId}
                  aria-label={`${field.name || `Field ${index + 1}`}, ${latest ? `${latest.moisturePercent}% farmer-entered moisture reading` : 'no moisture reading recorded'}, ${status}`}
                  onClick={() => setSelectedFieldId(fieldId)}
                >
                  <span className="irrigation-field-card-heading">
                    <span><small>FIELD {index + 1}</small><strong>{field.name || `Field ${index + 1}`}</strong><span>{field.crop || 'Crop not recorded'}</span></span>
                    <span className={`irrigation-field-status${isBelowTarget ? ' alert' : ''}`}>{status}</span>
                  </span>
                  <span className="irrigation-field-card-data">
                    <span className={`irrigation-moisture-ring${latest ? '' : ' empty'}${isBelowTarget ? ' alert' : ''}`} aria-hidden="true">
                      <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" />
                        <circle className="value" cx="50" cy="50" r="40" style={{ strokeDashoffset: ringOffset }} />
                      </svg>
                      <strong>{latest ? `${latest.moisturePercent}%` : '—'}</strong>
                    </span>
                    <span className="irrigation-field-reading">
                      <small>{latest ? 'Latest farmer-entered reading' : 'Moisture reading'}</small>
                      <strong>{latest ? formatDate(latest.date) : 'Not recorded'}</strong>
                      <span className="irrigation-reading-sparkline" aria-hidden="true">
                        {recentReadings.length ? recentReadings.map((reading) => (
                          <i key={reading.id} style={{ height: `${Math.max(4, Number(reading.moisturePercent))}%` }} />
                        )) : <span>No sensor data</span>}
                      </span>
                    </span>
                  </span>
                  <span className="irrigation-field-card-footer">
                    <span>{field.area ? `${field.area} acres` : 'Area not recorded'}</span>
                    <span>{field.soil?.type || field.soil?.soilType || 'Soil not recorded'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="irrigation-no-fields">
            <span className="material-symbols-outlined" aria-hidden="true">agriculture</span>
            <p>Add a field in Digital Farm to see field-by-field water records here.</p>
            <button type="button" className="irrigation-secondary-button" onClick={() => onNavigate?.('fields')}>Open Digital Farm</button>
          </div>
        )}
      </section>

      <details className="irrigation-reading-entry">
        <summary><span className="material-symbols-outlined" aria-hidden="true">add_chart</span>Record a manual moisture reading</summary>
        <form onSubmit={saveMoistureReading}>
          <label>Field
            <select value={selectedFieldId} onChange={(event) => setSelectedFieldId(event.target.value)} disabled={!fields.length}>
              {fields.map((field, index) => <option value={fieldRecordId(field, index)} key={fieldRecordId(field, index)}>{field.name || `Field ${index + 1}`}</option>)}
              {!fields.length && <option value="">No fields available</option>}
            </select>
          </label>
          <label>Measured moisture (%)
            <input type="number" min="0" max="100" step="any" value={moisturePercent} onChange={(event) => setMoisturePercent(event.target.value)} placeholder="0–100" />
          </label>
          <label>Reading date
            <input required type="date" max={today()} value={moistureDate} onChange={(event) => setMoistureDate(event.target.value)} />
          </label>
          <button type="submit" className="irrigation-primary-button" disabled={!fields.length}><span className="material-symbols-outlined">save</span>Save reading</button>
          <p>Enter a reading from your own observation or meter. It is not independently verified and will not trigger irrigation.</p>
        </form>
      </details>

      <section className="irrigation-core-grid">
        <article className="irrigation-card">
          <div className="irrigation-card-heading"><span className="material-symbols-outlined">cloud</span><div><h2>Weather &amp; rainfall outlook</h2><p>{weather?.location || weatherStatus || 'Farm weather unavailable'}</p></div></div>
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
          <div className="irrigation-integration-note"><strong>Crop-water guidance</strong><span>Not calculated from this weather feed.</span></div>
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
            ) : <p className="irrigation-empty-note">No irrigation records for this field selection yet.</p>}
          </article>

          <article className="irrigation-card irrigation-nirc-card">
            <div className="irrigation-card-heading"><span className="material-symbols-outlined">gavel</span><div><h2>NIRC &amp; compliance</h2><p>External verification status</p></div></div>
            <div className="irrigation-nirc-status"><span className="material-symbols-outlined" aria-hidden="true">link_off</span><span><strong>Not connected</strong><small>Permit status and regional water allocations are not available in AGRI-NEST.</small></span></div>
            <div className="irrigation-integration-note"><strong>Water-use summary</strong><span>{formatLiters(sevenDayTotal)} recorded in 7 days for this selection</span></div>
            <p className="irrigation-footnote">Recorded usage is not a compliance determination or a comparison with a regional benchmark.</p>
            <button type="button" className="irrigation-secondary-button" onClick={() => onNavigate?.('compliance')}>Open compliance tasks</button>
          </article>

          <article className="irrigation-card irrigation-reminder-card">
            <div className="irrigation-card-heading"><span className="material-symbols-outlined">tune</span><div><h2>Configure reminder</h2><p>{selectedField?.name || 'Select a field above'}</p></div></div>
            <label className="irrigation-threshold-label">Reminder target (%)<input type="number" min="0" max="100" step="1" value={moistureThreshold} onChange={(event) => setMoistureThreshold(event.target.value)} placeholder="Set a value from 0 to 100" /></label>
            <p className="irrigation-footnote">Manual reference only. It will not send an alert or automatically start, skip, or schedule watering.</p>
            <button type="button" className="irrigation-secondary-button" onClick={saveSettings} disabled={!selectedFieldId}>Save configuration</button>
          </article>

        </div>
      </section>

      <section className="irrigation-equipment-section" aria-label="Irrigation equipment">
        <article className="irrigation-card">
          <div className="irrigation-card-heading"><span className="material-symbols-outlined">storefront</span><div><h2>Irrigation equipment</h2><p>Browse supplies through Agrishop Network</p></div></div>
          <p className="irrigation-empty-note">Inventory, pricing, and equipment compatibility are not verified here. Confirm product details with the seller.</p>
          <button type="button" className="irrigation-secondary-button" onClick={() => onNavigate?.('agrishop')}>Browse Agrishop Network</button>
        </article>
      </section>
    </main>
  );
}
