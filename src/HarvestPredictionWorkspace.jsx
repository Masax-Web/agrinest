import { useMemo, useState } from 'react';
import './HarvestPredictionWorkspace.css';

const cropColor = (crop) => {
  const name = String(crop || '').toLowerCase();
  if (name.includes('bean')) return 'beans';
  if (name.includes('sunflower')) return 'sunflower';
  return 'maize';
};

function formatHarvestDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : date.toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function harvestStatus(value, today) {
  if (!value) return { label: 'Date needed', className: 'missing' };
  const harvestDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(harvestDate.getTime())) return { label: 'Check date', className: 'missing' };
  const difference = Math.ceil((harvestDate - today) / 86400000);
  if (difference < 0) return { label: 'Past entered date', className: 'past' };
  if (difference <= 14) return { label: 'Within 14 days', className: 'soon' };
  return { label: 'Later', className: 'later' };
}

function downloadHarvestReport(fields) {
  const rows = [
    ['Field', 'Crop', 'Area (acres)', 'Planting date', 'Farmer-entered expected harvest', 'Prediction status'],
    ...fields.map((field) => [
      field.name || '',
      field.crop || '',
      Number(field.area || 0),
      field.plantedOn || '',
      field.expectedHarvest || '',
      field.expectedHarvest ? 'Farmer-entered date; not independently forecast' : 'No date recorded',
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'agrinest-harvest-planning-report.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function HarvestPredictionWorkspace({ fields = [], activities = [], onNavigate }) {
  const [selectedFieldId, setSelectedFieldId] = useState(fields[0]?.id || '');
  const [notice, setNotice] = useState('');
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const selectedField = fields.find((field) => field.id === selectedFieldId) || fields[0] || null;
  const timeline = fields.map((field) => ({
    ...field,
    status: harvestStatus(field.expectedHarvest, today),
    color: cropColor(field.crop),
  }));
  const harvestActivityCount = activities.filter((activity) => /harvest/i.test(`${activity.category || ''} ${activity.title || ''}`)).length;

  const routeTo = (view, message) => {
    if (!onNavigate) {
      setNotice('Navigation is unavailable right now.');
      return;
    }
    if (message) setNotice(message);
    onNavigate(view);
  };

  return (
    <main className="harvest-prediction">
      <header className="harvest-heading">
        <div><span className="harvest-eyebrow">AGRI-NEST · FARM PLANNING</span><h1>Harvest Window Planning</h1><p>Review your field records and organize next steps around dates you have entered.</p></div>
        <button type="button" className="harvest-report-button" disabled={!fields.length} onClick={() => downloadHarvestReport(fields)}><span className="material-symbols-outlined">download</span>Generate report</button>
      </header>

      <div className="harvest-data-note" role="note"><span className="material-symbols-outlined">info</span><p>This page summarizes farmer-entered field and expected-harvest dates. It does not calculate crop maturity, growing degree days, yield, quality, soil moisture, nitrogen, or harvest readiness. No sensor or satellite prediction is connected.</p></div>
      {notice && <div className="harvest-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <section className="harvest-timeline-panel">
        <div className="harvest-panel-heading"><div><span className="harvest-eyebrow">FIELD RECORDS</span><h2>Multi-field harvest timeline</h2></div><div className="harvest-legend"><span><i className="maize" />Maize</span><span><i className="beans" />Beans</span><span><i className="sunflower" />Sunflower</span></div></div>
        {timeline.length ? <div className="harvest-timeline-scroll"><div className="harvest-timeline">
          <div className="harvest-timeline-header"><span>FIELD IDENTITY</span><span>EXPECTED HARVEST DATE · FARMER-ENTERED</span><span>RECORD STATUS</span></div>
          {timeline.map((field) => <button type="button" className={selectedField?.id === field.id ? 'harvest-timeline-row selected' : 'harvest-timeline-row'} key={field.id} onClick={() => setSelectedFieldId(field.id)}>
            <span className="harvest-field-name"><strong>{field.name || 'Unnamed field'}</strong><small>{field.crop || 'Crop not recorded'}</small></span>
            <span className="harvest-date-track"><i className={field.color} /><strong>{formatHarvestDate(field.expectedHarvest)}</strong></span>
            <span className={`harvest-status ${field.status.className}`}>{field.status.label}</span>
          </button>)}
        </div></div> : <div className="harvest-empty"><span className="material-symbols-outlined">agriculture</span><strong>No field records yet</strong><p>Add a crop and optional expected harvest date in Digital Farm to start a planning timeline.</p><button type="button" onClick={() => routeTo('fields')}>Open Digital Farm</button></div>}
      </section>

      <div className="harvest-detail-grid">
        <section className="harvest-maturity-panel">
          <div className="harvest-panel-heading"><div><span className="harvest-eyebrow">FIELD OVERVIEW</span><h2>{selectedField ? `${selectedField.name || 'Field'} · ${selectedField.crop || 'Crop not recorded'}` : 'Crop and maturity details'}</h2></div>{selectedField && <span className={`harvest-status ${harvestStatus(selectedField.expectedHarvest, today).className}`}>{harvestStatus(selectedField.expectedHarvest, today).label}</span>}</div>
          {selectedField ? <div className="harvest-field-overview">
            <div className="harvest-maturity-indicator"><div><strong>—</strong><span>MATURITY<br />NOT CALCULATED</span></div></div>
            <div className="harvest-field-facts">
              <div><small>Area on record</small><strong>{Number(selectedField.area || 0).toLocaleString('en-TZ', { maximumFractionDigits: 2 })} acres</strong></div>
              <div><small>Planting date</small><strong>{formatHarvestDate(selectedField.plantedOn)}</strong></div>
              <div><small>Expected harvest</small><strong>{formatHarvestDate(selectedField.expectedHarvest)}</strong></div>
              <div><small>Crop stage / GDD</small><strong>Not available</strong></div>
              <p><span className="material-symbols-outlined">info</span>Use an agronomist's guidance and observe crop condition before deciding when to harvest. The entered date is not a forecast.</p>
            </div>
          </div> : <div className="harvest-empty-detail"><p>Select a field to review its saved dates and crop details.</p></div>}
        </section>

        <section className="harvest-quality-panel">
          <div className="harvest-panel-heading"><div><span className="harvest-eyebrow">CROP QUALITY &amp; YIELD</span><h2>Not estimated</h2></div><span className="material-symbols-outlined">verified</span></div>
          <p>There is not enough connected crop or measurement data to estimate grade or yield.</p>
          <ul><li><span className="material-symbols-outlined">sensors_off</span>Soil moisture: not connected</li><li><span className="material-symbols-outlined">science</span>Nitrogen: not recorded</li><li><span className="material-symbols-outlined">image_search</span>Crop stress assessment: not available</li></ul>
          <div className="harvest-activity-count"><small>Harvest activities in your journal</small><strong>{harvestActivityCount}</strong><button type="button" onClick={() => routeTo('fields')}>Review farm records</button></div>
        </section>
      </div>

      <section className="harvest-readiness-panel">
        <div className="harvest-panel-heading"><div><span className="harvest-eyebrow">NEXT STEPS</span><h2>Operational readiness checklist</h2></div><span className="material-symbols-outlined">hub</span></div>
        <div className="harvest-readiness-grid">
          <article><span className="material-symbols-outlined warehouse">warehouse</span><div><h3>Storage or warehouse</h3><p>Check available space, location, and storage conditions.</p></div><span className="harvest-status missing">Not checked</span><button type="button" onClick={() => routeTo('rent-space')}>Explore storage options</button></article>
          <article><span className="material-symbols-outlined transport">local_shipping</span><div><h3>Transport</h3><p>Plan pickup after confirming harvest quantities and dates.</p></div><span className="harvest-status missing">Not booked</span><button type="button" onClick={() => routeTo('transport')}>Open Usafiri Transport</button></article>
          <article><span className="material-symbols-outlined market">trending_up</span><div><h3>Soko marketplace</h3><p>Review current seller listings; no harvest price trend is connected.</p></div><span className="harvest-status missing">No trend data</span><button type="button" onClick={() => routeTo('marketplace')}>Open Soko Marketplace</button></article>
        </div>
      </section>
    </main>
  );
}
