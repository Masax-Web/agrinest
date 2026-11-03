import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => globalThis.crypto?.randomUUID?.() || `ndvi-${Date.now()}`;
const validObservation = (record) => record
  && typeof record === 'object'
  && typeof record.fieldId === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(record.date || '')
  && record.value !== '' && record.value !== null && record.value !== undefined
  && Number.isFinite(Number(record.value))
  && Number(record.value) >= -1
  && Number(record.value) <= 1
  && typeof record.source === 'string'
  && Boolean(record.source.trim());
const dateLabel = (value) => {
  if (!value) return 'Date not recorded';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

function readCoordinates(value) {
  if (!Array.isArray(value) || value.length < 2 || value.slice(0, 2).some((coordinate) => coordinate === '' || coordinate === null || coordinate === undefined)) return null;
  const [latitude, longitude] = value.map(Number);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? [latitude, longitude]
    : null;
}

function saveReport(fields, observations, profile) {
  const report = {
    title: 'AGRI-NEST field vegetation observations',
    generatedAt: new Date().toISOString(),
    farmer: profile?.name || 'Farmer',
    notice: 'NDVI observations in this report are farmer-entered values from the source named on each record. AGRI-NEST did not calculate or independently verify them. This is not satellite imagery, a crop diagnosis, or a yield forecast.',
    fields: fields.map(({ id, name, crop, area, season }) => ({
      id,
      name: name || 'Unnamed field',
      crop: crop || 'Not recorded',
      areaAcres: area || 'Not recorded',
      season: season || 'Not recorded',
      observations: observations
        .filter((record) => record.fieldId === id)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ date, value, source, notes }) => ({ date, ndvi: Number(value), source, notes: notes || '' })),
    })),
  };
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  link.href = url;
  link.download = `agrinest-vegetation-report-${today()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ObservationDialog({ fields, initialFieldId, onClose, onSave }) {
  const [values, setValues] = useState({
    fieldId: initialFieldId || fields[0]?.id || '',
    date: today(),
    value: '',
    source: '',
    notes: '',
  });
  const numericValue = Number(values.value);
  const validValue = values.value !== '' && Number.isFinite(numericValue) && numericValue >= -1 && numericValue <= 1;
  const submit = (event) => {
    event.preventDefault();
    if (!validValue || !values.fieldId || !values.source.trim()) return;
    const field = fields.find((candidate) => candidate.id === values.fieldId);
    onSave({
      id: makeId(),
      fieldId: values.fieldId,
      fieldName: field?.name || '',
      date: values.date,
      value: numericValue,
      source: values.source.trim(),
      notes: values.notes.trim(),
      recordedAt: new Date().toISOString(),
      sourceType: 'farmer-entered',
    });
    onClose();
  };

  return (
    <div className="jicho-ndvi-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="jicho-ndvi-dialog" role="dialog" aria-modal="true" aria-labelledby="jicho-ndvi-dialog-title">
        <div className="jicho-ndvi-dialog-heading">
          <div><span className="jicho-ndvi-eyebrow">FARMER-ENTERED MEASUREMENT</span><h2 id="jicho-ndvi-dialog-title">Record an NDVI observation</h2></div>
          <button type="button" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={submit}>
          <label>Field
            <select required value={values.fieldId} onChange={(event) => setValues((current) => ({ ...current, fieldId: event.target.value }))}>
              {fields.map((field) => <option value={field.id} key={field.id}>{field.name || 'Unnamed field'}{field.crop ? ` · ${field.crop}` : ''}</option>)}
            </select>
          </label>
          <div className="jicho-ndvi-form-row">
            <label>Observation date<input required type="date" max={today()} value={values.date} onChange={(event) => setValues((current) => ({ ...current, date: event.target.value }))} /></label>
            <label>NDVI value <span>(−1.00 to 1.00)</span><input required type="number" min="-1" max="1" step="0.01" value={values.value} onChange={(event) => setValues((current) => ({ ...current, value: event.target.value }))} /></label>
          </div>
          <label>Data source<input required maxLength="120" value={values.source} onChange={(event) => setValues((current) => ({ ...current, source: event.target.value }))} placeholder="Name the satellite provider, sensor, or report" /></label>
          <label>Notes <span>(optional)</span><textarea rows="3" maxLength="500" value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} placeholder="Context about the measurement" /></label>
          <p className="jicho-ndvi-dialog-note">Only record an NDVI value from a source that actually provided it. This saves your report; it does not fetch satellite data, calculate NDVI, or verify the source.</p>
          <div className="jicho-ndvi-dialog-actions"><button type="button" className="jicho-ndvi-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="jicho-ndvi-primary-button" disabled={!validValue || !values.source.trim()}>Save observation</button></div>
        </form>
      </section>
    </div>
  );
}

function EmptyState({ icon, title, description, action, onAction }) {
  return (
    <div className="jicho-ndvi-empty">
      <span className="material-symbols-outlined">{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && <button type="button" className="jicho-ndvi-text-button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export default function JichoNdviWorkspace({ fields = [], observations = [], profile, search = '', onNavigate, onObservationsChange }) {
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const validObservations = observations.filter(validObservation);
  const visibleFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    return fields.filter((field) => !query || `${field.name || ''} ${field.crop || ''} ${field.seedVariety || ''} ${field.season || ''}`.toLowerCase().includes(query));
  }, [fields, search]);
  const selectedField = visibleFields.find((field) => field.id === selectedFieldId) || visibleFields[0] || null;
  const fieldObservations = (fieldId) => validObservations
    .filter((record) => record.fieldId === fieldId)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.recordedAt || '').localeCompare(String(b.recordedAt || '')));
  const observationCount = validObservations.length;
  const sourceCount = new Set(validObservations.map((record) => record.source.trim()).filter(Boolean)).size;
  const coords = readCoordinates([profile?.latitude, profile?.longitude]);
  const fieldsWithCoords = fields.filter((field) => readCoordinates([field.latitude, field.longitude]));
  const mapCenter = readCoordinates([selectedField?.latitude, selectedField?.longitude])
    || coords
    || readCoordinates([fieldsWithCoords[0]?.latitude, fieldsWithCoords[0]?.longitude]);
  const monthlyTrend = useMemo(() => {
    const grouped = new Map();
    validObservations.forEach((record) => {
      const month = record.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      const group = grouped.get(month) || { total: 0, count: 0 };
      group.total += Number(record.value);
      group.count += 1;
      grouped.set(month, group);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, values]) => ({
      month,
      label: new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' }),
      value: values.total / values.count,
      count: values.count,
    }));
  }, [observations]);
  const completeComparisons = fields.filter((field) => {
    const readingDatesBySource = new Map();
    fieldObservations(field.id).forEach((record) => {
      const dates = readingDatesBySource.get(record.source) || new Set();
      dates.add(record.date);
      readingDatesBySource.set(record.source, dates);
    });
    return [...readingDatesBySource.values()].some((dates) => dates.size > 1);
  }).length;
  const addObservation = (record) => {
    onObservationsChange('ndvi', [...observations, record]);
    setSelectedFieldId(record.fieldId);
  };

  return (
    <section className="jicho-ndvi-workspace">
      <header className="jicho-ndvi-heading">
        <div><span className="jicho-ndvi-eyebrow">JICHO AI · FIELD MONITORING</span><h1>Crops &amp; NDVI</h1><p>Review your farm fields and keep dated vegetation observations together.</p></div>
        <div className="jicho-ndvi-heading-actions">
          <button type="button" className="jicho-ndvi-secondary-button" onClick={() => saveReport(fields, validObservations, profile)}><span className="material-symbols-outlined">download</span>Generate report</button>
          <button type="button" className="jicho-ndvi-primary-button" onClick={() => setDialogOpen(true)} disabled={!fields.length}><span className="material-symbols-outlined">add</span>Record NDVI</button>
        </div>
      </header>

      <div className="jicho-ndvi-notice" role="note"><span className="material-symbols-outlined">info</span><span>No satellite NDVI feed is connected. Values shown below are only the dated observations you enter, with their stated source; no values, diagnoses, or harvest forecasts are generated here.</span></div>

      <div className="jicho-ndvi-layout">
        <div className="jicho-ndvi-main-column">
          <article className="jicho-ndvi-map-card" aria-label="Farm location map">
            {mapCenter ? (
              <MapContainer center={mapCenter} zoom={14} scrollWheelZoom={false} className="jicho-ndvi-leaflet-map" aria-label="Satellite basemap at saved farm coordinates">
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                />
                {fieldsWithCoords.map((field) => {
                  const position = readCoordinates([field.latitude, field.longitude]);
                  return <Marker position={position} key={field.id}><Popup>{field.name || 'Farm field'}{field.crop ? ` · ${field.crop}` : ''}</Popup></Marker>;
                })}
                {!fieldsWithCoords.length && <Marker position={mapCenter}><Popup>Saved farm location</Popup></Marker>}
              </MapContainer>
            ) : (
              <div className="jicho-ndvi-map-placeholder">
                <span className="material-symbols-outlined">satellite_alt</span>
                <strong>Farm map is not positioned</strong>
                <p>Add farm coordinates or map a field in Ramani GIS. No sample location or field boundary is shown.</p>
                <button type="button" className="jicho-ndvi-secondary-button" onClick={() => onNavigate('ramani')}>Open Ramani GIS</button>
              </div>
            )}
            <div className="jicho-ndvi-map-status"><span className="material-symbols-outlined">layers</span><span>Satellite basemap</span><strong>NDVI imagery unavailable</strong></div>
            {selectedField && <div className="jicho-ndvi-map-field"><span className="material-symbols-outlined">location_on</span>{selectedField.name || 'Unnamed field'}{selectedField.crop ? ` · ${selectedField.crop}` : ''}</div>}
            <div className="jicho-ndvi-map-footer"><span>Farm location only</span><span>Basemap is not a vegetation measurement · Esri receives map viewport coordinates</span></div>
          </article>

          <article className="jicho-ndvi-card jicho-ndvi-insights">
            <div className="jicho-ndvi-section-title"><span className="material-symbols-outlined">psychology</span><div><h2>Field follow-up</h2><p>Evidence-based reminders from your saved records</p></div></div>
            <div className="jicho-ndvi-insight-grid">
              <div className="jicho-ndvi-insight jicho-ndvi-insight-neutral">
                <span className="material-symbols-outlined">satellite_alt</span>
                <div><h3>Satellite assessment unavailable</h3><p>Connect an imagery provider before treating vegetation differences as crop stress. NDVI alone cannot diagnose nutrient or water problems.</p></div>
              </div>
              <div className="jicho-ndvi-insight jicho-ndvi-insight-positive">
                <span className="material-symbols-outlined">event_note</span>
                <div><h3>{completeComparisons ? 'Repeat observations on file' : 'Build a field history'}</h3><p>{completeComparisons ? `${completeComparisons} field${completeComparisons === 1 ? '' : 's'} have more than one dated reading. Compare like-for-like dates and conditions before interpreting a change.` : 'Add repeated, dated readings from the same source to compare a field over time. One value is not a trend.'}</p></div>
              </div>
            </div>
          </article>
        </div>

        <aside className="jicho-ndvi-side-column">
          <article className="jicho-ndvi-card jicho-ndvi-health-card">
            <div className="jicho-ndvi-section-title jicho-ndvi-health-title"><div><h2>Field health pulse</h2><p>Latest recorded NDVI · {fields.length} field{fields.length === 1 ? '' : 's'}</p></div><span className="material-symbols-outlined">filter_list</span></div>
            {visibleFields.length ? (
              <div className="jicho-ndvi-field-list">
                {visibleFields.map((field) => {
                  const readings = fieldObservations(field.id);
                  const latest = readings[readings.length - 1];
                  const previous = latest && [...readings].reverse().find((record) => record.source === latest.source && record.date < latest.date);
                  const delta = latest && previous ? Number(latest.value) - Number(previous.value) : null;
                  return (
                    <button type="button" key={field.id} className={`jicho-ndvi-field-card${selectedField?.id === field.id ? ' selected' : ''}`} onClick={() => setSelectedFieldId(field.id)}>
                      <span className="jicho-ndvi-field-top"><span><strong>{field.name || 'Unnamed field'}</strong><small>{field.crop || 'Crop not recorded'}{field.seedVariety ? ` · ${field.seedVariety}` : ''}</small></span><span className="jicho-ndvi-field-badge">{latest ? 'RECORDED' : 'NO DATA'}</span></span>
                      <span className="jicho-ndvi-field-bottom">
                        <strong>{latest ? Number(latest.value).toFixed(2) : '—'} <small>NDVI</small></strong>
                        <span>{latest ? `${dateLabel(latest.date)} · ${latest.source}` : 'No observation recorded'}</span>
                      </span>
                      {delta !== null && <span className={`jicho-ndvi-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}><span className="material-symbols-outlined">{delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'horizontal_rule'}</span>{delta > 0 ? '+' : ''}{delta.toFixed(2)} since previous reading · not a diagnosis</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="agriculture" title={fields.length ? 'No matching fields' : 'No farm fields yet'} description={fields.length ? 'Try a different field search.' : 'Add a field in Digital Farm before recording vegetation observations.'} action={!fields.length ? 'Open Digital Farm' : ''} onAction={() => onNavigate('fields')} />
            )}
          </article>

          <article className="jicho-ndvi-card jicho-ndvi-trend-card">
            <div className="jicho-ndvi-section-title"><div><h2>Vegetation trend</h2><p>Monthly mean of entered observations</p></div><span className="material-symbols-outlined">show_chart</span></div>
            {monthlyTrend.length ? (
              <>
                <div className="jicho-ndvi-chart" role="img" aria-label={`Monthly mean NDVI: ${monthlyTrend.map((point) => `${point.label} ${point.value.toFixed(2)}`).join(', ')}`}>
                  <div className="jicho-ndvi-chart-grid"><span>1.0</span><span>0.0</span><span>−1.0</span></div>
                  {monthlyTrend.map((point) => {
                    const height = Math.max(4, ((point.value + 1) / 2) * 100);
                    return <div className="jicho-ndvi-chart-column" key={point.month}><div className="jicho-ndvi-chart-bar-wrap"><span className="jicho-ndvi-chart-bar" style={{ height: `${height}%` }} title={`${point.value.toFixed(2)} · ${point.count} reading${point.count === 1 ? '' : 's'}`} /></div><small>{point.label}</small></div>;
                  })}
                </div>
                <p className="jicho-ndvi-chart-caption">{observationCount} farmer-entered reading{observationCount === 1 ? '' : 's'} from {sourceCount} named source{sourceCount === 1 ? '' : 's'}. Monthly means combine available fields; they are not satellite-derived.</p>
              </>
            ) : <EmptyState icon="show_chart" title="No trend to display" description="Record at least one dated observation to start a chart. The chart will only use entered values." />}
          </article>
        </aside>
      </div>
      {dialogOpen && fields.length > 0 && <ObservationDialog fields={fields} initialFieldId={selectedField?.id} onClose={() => setDialogOpen(false)} onSave={addObservation} />}
    </section>
  );
}
