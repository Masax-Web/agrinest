import { useMemo, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => globalThis.crypto?.randomUUID?.() || `sustainability-${Date.now()}`;
const validNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const dateLabel = (value) => {
  if (!value) return 'Date not recorded';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

function MeasurementDialog({ fields, initialKind = 'water', onClose, onSave }) {
  const [kind, setKind] = useState(initialKind);
  const [values, setValues] = useState({ date: today(), crop: '', waterLiters: '', yieldKg: '', species: '', count: '', location: 'Field' });

  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const field = fields.find((candidate) => candidate.id === values.fieldId);
    const record = kind === 'water'
      ? {
        id: makeId(),
        type: 'water',
        date: values.date,
        crop: values.crop.trim(),
        waterLiters: Number(values.waterLiters),
        yieldKg: Number(values.yieldKg),
        fieldId: field?.id || '',
        fieldName: field?.name || '',
      }
      : {
        id: makeId(),
        type: 'biodiversity',
        date: values.date,
        species: values.species.trim(),
        count: values.count ? Number(values.count) : null,
        location: values.location,
        fieldId: field?.id || '',
        fieldName: field?.name || '',
      };
    onSave(record);
    onClose();
  };

  return (
    <div className="sustainability-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="sustainability-dialog" role="dialog" aria-modal="true" aria-labelledby="sustainability-dialog-title">
        <div className="sustainability-dialog-heading">
          <div><span className="sustainability-eyebrow">FARMER-REPORTED DATA</span><h2 id="sustainability-dialog-title">Add an observation</h2></div>
          <button type="button" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={submit}>
          <label>Record type
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="water">Water use and crop yield</option>
              <option value="biodiversity">Species sighting</option>
            </select>
          </label>
          {kind === 'water' ? (
            <>
              <label>Crop<input required maxLength="80" value={values.crop} onChange={(event) => update('crop', event.target.value)} placeholder="e.g. Maize" /></label>
              <div className="sustainability-form-row">
                <label>Water used (litres)<input required type="number" min="0.01" step="any" value={values.waterLiters} onChange={(event) => update('waterLiters', event.target.value)} /></label>
                <label>Harvest (kg)<input required type="number" min="0.01" step="any" value={values.yieldKg} onChange={(event) => update('yieldKg', event.target.value)} /></label>
              </div>
            </>
          ) : (
            <>
              <label>Species or group observed<input required maxLength="100" value={values.species} onChange={(event) => update('species', event.target.value)} placeholder="e.g. Honey bees" /></label>
              <div className="sustainability-form-row">
                <label>Count <span>(optional)</span><input type="number" min="1" step="1" value={values.count} onChange={(event) => update('count', event.target.value)} /></label>
                <label>Observation area
                  <select value={values.location} onChange={(event) => update('location', event.target.value)}>
                    <option>Field</option><option>Buffer zone</option><option>Other</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <div className="sustainability-form-row">
            <label>Date<input required type="date" max={today()} value={values.date} onChange={(event) => update('date', event.target.value)} /></label>
            <label>Farm field <span>(optional)</span><select value={values.fieldId || ''} onChange={(event) => update('fieldId', event.target.value)}><option value="">Not linked</option>{fields.map((field) => <option value={field.id} key={field.id}>{field.name || 'Unnamed field'}</option>)}</select></label>
          </div>
          <p className="sustainability-dialog-note">This saves your observation to your farm records. It is not independently measured or verified.</p>
          <div className="sustainability-dialog-actions">
            <button type="button" className="sustainability-secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="sustainability-primary-button" disabled={kind === 'water' && (!validNumber(values.waterLiters) || !validNumber(values.yieldKg))}>Save observation</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RequirementsDialog({ onClose }) {
  return (
    <div className="sustainability-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="sustainability-dialog" role="dialog" aria-modal="true" aria-labelledby="sustainability-requirements-title">
        <div className="sustainability-dialog-heading">
          <div><span className="sustainability-eyebrow">CERTIFICATION GUIDANCE</span><h2 id="sustainability-requirements-title">Organic certification</h2></div>
          <button type="button" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <p className="sustainability-dialog-note">This dashboard is not a certification service. Requirements vary by certifier and market; contact an accredited organic certification body for a formal assessment.</p>
        <ul className="sustainability-requirements">
          <li>Keep records of inputs and pesticide use, including dates and product details.</li>
          <li>Maintain soil test results and field-management history.</li>
          <li>Document buffer areas and measures that reduce contamination risk.</li>
          <li>Confirm conversion periods, inspections, and documentation with your chosen certifier.</li>
        </ul>
        <div className="sustainability-dialog-actions"><button type="button" className="sustainability-primary-button" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function EvidenceStatus({ complete, children }) {
  return (
    <li className={complete ? 'complete' : ''}>
      <span className="material-symbols-outlined">{complete ? 'check_circle' : 'radio_button_unchecked'}</span>
      <span>{children}</span>
      <small>{complete ? 'Recorded' : 'Not recorded'}</small>
    </li>
  );
}

export default function SustainabilityWorkspace({ activities = [], records = [], fields = [], carbonRecords = [], onRecordsChange }) {
  const [dialog, setDialog] = useState('');
  const waterRecords = records.filter((record) => record.type === 'water'
    && validNumber(record.waterLiters) && validNumber(record.yieldKg) && record.crop);
  const sightings = records.filter((record) => record.type === 'biodiversity' && record.species);
  const carbonActivities = carbonRecords.filter((record) => record.module === 'carbon-activity');
  const soilSamples = fields.flatMap((field) => {
    const soil = field.soil;
    if (!soil || (!validNumber(soil.organicMatter) && !validNumber(soil.pH))) return [];
    return [{ ...soil, fieldName: field.name || 'Unnamed field', fieldId: field.id || '' }];
  });
  const cropFootprints = useMemo(() => {
    const grouped = new Map();
    waterRecords.forEach((record) => {
      const current = grouped.get(record.crop) || { liters: 0, yieldKg: 0 };
      current.liters += Number(record.waterLiters);
      current.yieldKg += Number(record.yieldKg);
      grouped.set(record.crop, current);
    });
    return [...grouped.entries()]
      .map(([crop, totals]) => ({ crop, litersPerKg: totals.liters / totals.yieldKg }))
      .sort((a, b) => a.crop.localeCompare(b.crop));
  }, [records]);
  const uniqueSpecies = new Set(sightings.map((record) => record.species.toLowerCase())).size;
  const evidenceCount = [soilSamples.length > 0, waterRecords.length > 0, carbonActivities.length > 0, sightings.length > 0].filter(Boolean).length;
  const latestSoil = [...soilSamples].sort((a, b) => String(b.sampleDate || '').localeCompare(String(a.sampleDate || '')))[0];
  const maxFootprint = Math.max(1, ...cropFootprints.map((entry) => entry.litersPerKg));
  const hasPesticideHistory = activities.some((activity) => /spray|pesticide/i.test(`${activity.type || ''} ${activity.title || ''}`));
  const hasBufferSighting = sightings.some((record) => record.location === 'Buffer zone');

  const addRecord = (record) => onRecordsChange([...records, record]);

  return (
    <main className="sustainability-hub">
      <header className="sustainability-heading">
        <div><span className="sustainability-eyebrow">FARM & ENVIRONMENT</span><h1>Environmental Impact Dashboard</h1><p>Track environmental records from your farm. Only entered observations appear here; no regional averages or estimated outcomes are assumed.</p></div>
        <button type="button" className="sustainability-primary-button" onClick={() => setDialog('measurement')}><span className="material-symbols-outlined">add</span>Log observation</button>
      </header>

      <div className="sustainability-disclaimer"><span className="material-symbols-outlined">info</span><span>Evidence coverage shows which indicators have records. It is not an environmental performance score, certification, or independent verification.</span></div>

      <section className="sustainability-overview-grid">
        <article className="sustainability-card sustainability-rating-card">
          <div className="sustainability-rating-ring" role="img" aria-label={`${evidenceCount} of 4 environmental indicators have records`} style={{ background: `conic-gradient(#24483f ${evidenceCount * 25}%, #e8dfda 0)` }}><strong>{evidenceCount}<small>/4</small></strong></div>
          <div><h2>Environmental evidence coverage</h2><p>{evidenceCount} of 4 indicators have at least one farm record. Add measurements over time to build a more complete picture.</p>          <div className="sustainability-meter" role="progressbar" aria-label="Environmental evidence coverage" aria-valuemin="0" aria-valuemax="4" aria-valuenow={evidenceCount}><span style={{ width: `${evidenceCount * 25}%` }} /></div><small>Based on soil, water, climate-practice, and biodiversity records</small></div>
        </article>
        <article className="sustainability-card sustainability-cert-card">
          <div className="sustainability-card-title"><h2>Certification evidence</h2><span className="material-symbols-outlined">verified_user</span></div>
          <p>Records that may help prepare for an independent organic certification assessment.</p>
          <ul className="sustainability-evidence-list">
            <EvidenceStatus complete={hasPesticideHistory}>Pesticide-use history</EvidenceStatus>
            <EvidenceStatus complete={soilSamples.length > 0}>Soil test or baseline record</EvidenceStatus>
            <EvidenceStatus complete={hasBufferSighting}>Buffer-zone observation</EvidenceStatus>
          </ul>
          <button type="button" className="sustainability-secondary-button sustainability-full-button" onClick={() => setDialog('requirements')}>View requirements</button>
          <small className="sustainability-not-certified">No certification status is issued or implied.</small>
        </article>
      </section>

      <section className="sustainability-data-grid">
        <article className="sustainability-card sustainability-carbon-card">
          <div className="sustainability-icon-tile"><span className="material-symbols-outlined">co2</span></div>
          <h2>Carbon & climate practices</h2>
          <p className="sustainability-card-subtitle">Farmer-reported activities on file</p>
          <strong className="sustainability-large-number">{carbonActivities.length}<small> logged</small></strong>
          {carbonActivities.length ? (
            <ul className="sustainability-activity-list">{carbonActivities.slice(0, 4).map((activity) => <li key={activity.id || `${activity.title}-${activity.date}`}><span>{activity.title || 'Climate-smart practice'}</span><small>{dateLabel(activity.date)}</small></li>)}</ul>
          ) : <p className="sustainability-empty-note">No climate-practice records yet. Log practices in Carbon & Biogas to see them here.</p>}
          <p className="sustainability-method-note">No CO₂ sequestration or offset quantity is calculated from activity logs.</p>
        </article>

        <article className="sustainability-card sustainability-water-card">
          <div className="sustainability-card-title"><div><h2>Water footprint</h2><p>Recorded irrigation per kg of harvest</p></div><span className="material-symbols-outlined">water_drop</span></div>
          {cropFootprints.length ? (
            <div className="sustainability-water-chart" aria-label="Water use per kilogram by crop">
              {cropFootprints.map((entry) => <div className="sustainability-water-row" key={entry.crop}><span title={entry.crop}>{entry.crop}</span><div className="sustainability-water-track"><span style={{ width: `${Math.max(3, (entry.litersPerKg / maxFootprint) * 100)}%` }} /></div><strong>{entry.litersPerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} L/kg</strong></div>)}
              <small>Calculated from your recorded total water used ÷ recorded harvest for each crop. No regional comparison is available.</small>
            </div>
          ) : <div className="sustainability-empty-state"><span className="material-symbols-outlined">water_drop</span><p>No water-use and harvest measurements recorded yet.</p><button type="button" className="sustainability-text-button" onClick={() => setDialog('measurement')}>Add water measurement</button></div>}
        </article>

        <article className="sustainability-card sustainability-soil-card">
          <div className="sustainability-card-title"><h2>Soil health records</h2><span className="material-symbols-outlined">grass</span></div>
          {latestSoil ? (
            <>
              <div className="sustainability-soil-stats">
                <div><strong>{validNumber(latestSoil.organicMatter) ? `${Number(latestSoil.organicMatter).toLocaleString()}%` : '—'}</strong><span>Organic matter</span></div>
                <div><strong>{validNumber(latestSoil.pH) ? Number(latestSoil.pH).toLocaleString() : '—'}</strong><span>Soil pH</span></div>
              </div>
              <p className="sustainability-method-note">{latestSoil.fieldName} · {latestSoil.source || 'Source not recorded'} · {dateLabel(latestSoil.sampleDate)}</p>
              <p className="sustainability-empty-note">A trend needs multiple dated samples for the same field; this view shows the latest available field record.</p>
            </>
          ) : <p className="sustainability-empty-note">No soil-test values recorded. Add a soil record to a field in Digital Farm.</p>}
          <small>{soilSamples.length} field{soilSamples.length === 1 ? '' : 's'} with soil values</small>
        </article>

        <article className="sustainability-card sustainability-biodiversity-card">
          <div className="sustainability-card-title"><h2>Biodiversity observations</h2><span className="material-symbols-outlined">bug_report</span></div>
          <p>Farmer-reported species sightings. These are observations, not a biodiversity survey.</p>
          {sightings.length ? (
            <>
              <div className="sustainability-biodiversity-summary"><strong>{uniqueSpecies}</strong><span>distinct species or groups recorded</span></div>
              <ul className="sustainability-sighting-list">{sightings.slice(-4).reverse().map((record) => <li key={record.id}><span className="material-symbols-outlined">emoji_nature</span><div><strong>{record.species}</strong><small>{record.location || 'Area not recorded'} · {dateLabel(record.date)}</small></div></li>)}</ul>
            </>
          ) : <p className="sustainability-empty-note">No species sightings recorded yet.</p>}
          <button type="button" className="sustainability-text-button" onClick={() => setDialog('biodiversity')}>Log a species sighting</button>
        </article>
      </section>
      {(dialog === 'measurement' || dialog === 'biodiversity') && <MeasurementDialog fields={fields} initialKind={dialog === 'biodiversity' ? 'biodiversity' : 'water'} onClose={() => setDialog('')} onSave={addRecord} />}
      {dialog === 'requirements' && <RequirementsDialog onClose={() => setDialog('')} />}
    </main>
  );
}
