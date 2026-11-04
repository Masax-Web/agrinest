import { useMemo, useState } from 'react';
import './SprayDiaryWorkspace.css';

const sprayTypes = ['Pesticide', 'Herbicide', 'Fungicide', 'Other crop-protection product'];

function todayValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `spray-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function utcDay(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return NaN;
  return Date.UTC(year, month - 1, day) / 86400000;
}

function clearDateFor(application) {
  const applicationDay = utcDay(application.date);
  if (application.phiDays === '' || application.phiDays === null || application.phiDays === undefined) return '';
  const phiDays = Number(application.phiDays);
  if (!Number.isFinite(applicationDay) || !Number.isInteger(phiDays) || phiDays < 0) return '';
  const clearDate = new Date((applicationDay + phiDays) * 86400000);
  return `${clearDate.getUTCFullYear()}-${String(clearDate.getUTCMonth() + 1).padStart(2, '0')}-${String(clearDate.getUTCDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTzs(value) {
  return `TZS ${Number(value || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}

function downloadCsv(applications, fields) {
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const rows = [
    ['Application date', 'Field', 'Crop', 'Product type', 'Product', 'Dose / rate', 'Product-label PHI (days)', 'Harvest interval ends', 'Operator', 'Cost (TZS)', 'Notes'],
    ...applications.map((application) => [
      application.date || '',
      fieldById.get(application.fieldId)?.name || application.fieldName || 'Not linked',
      fieldById.get(application.fieldId)?.crop || application.crop || '',
      application.productType || '',
      application.product || '',
      application.dose || '',
      application.phiDays ?? '',
      clearDateFor(application),
      application.operator || '',
      application.costTzs ?? '',
      application.notes || '',
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'agrinest-spray-diary-compliance.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function phiDetails(application, today) {
  const clearDate = clearDateFor(application);
  const remaining = utcDay(clearDate) - utcDay(today);
  if (!clearDate) return { clearDate: '', remaining: null, label: 'PHI not recorded', state: 'unknown' };
  if (remaining > 0) return { clearDate, remaining, label: `${remaining} day${remaining === 1 ? '' : 's'} remaining`, state: 'waiting' };
  if (remaining === 0) return { clearDate, remaining: 0, label: 'Interval ends today', state: 'today' };
  return { clearDate, remaining, label: 'Recorded interval elapsed', state: 'elapsed' };
}

function readWeatherValue(value, suffix = '') {
  if (value === null || value === undefined || value === '' || value === 'Not provided') return 'Not available';
  return `${value}${suffix}`;
}

function exportDataNotice() {
  return 'CSV export prepared from farmer-entered application records. It is not a certificate or proof of regulatory compliance.';
}

export default function SprayDiaryWorkspace({
  records = [],
  fields = [],
  weather,
  weatherStatus = '',
  onRecordsChange,
  onBack,
  onNavigate,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const today = todayValue();
  const applications = useMemo(() => records
    .filter((record) => record.module === 'spray-application')
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))), [records]);
  const [draft, setDraft] = useState(() => ({
    date: today,
    fieldId: '',
    crop: '',
    productType: sprayTypes[0],
    product: '',
    dose: '',
    phiDays: '',
    operator: '',
    costTzs: '',
    notes: '',
  }));
  const currentYear = today.slice(0, 4);
  const seasonalApplications = applications.filter((application) => String(application.date || '').startsWith(currentYear));
  const activePhi = applications.map((application) => ({ application, ...phiDetails(application, today) }))
    .filter((item) => item.state === 'waiting' || item.state === 'today');
  const treatedFieldCount = new Set(seasonalApplications.map((application) => application.fieldId || application.fieldName).filter(Boolean)).size;
  const seasonalCost = seasonalApplications.reduce((sum, application) => sum + Math.max(0, Number(application.costTzs) || 0), 0);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const filteredApplications = applications.filter((application) => {
    const field = fieldById.get(application.fieldId);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${application.product || ''} ${application.productType || ''} ${application.crop || field?.crop || ''} ${application.fieldName || field?.name || ''} ${application.operator || ''}`.toLowerCase().includes(query);
    const state = phiDetails(application, today).state;
    const matchesFilter = filter === 'all'
      || (filter === 'active' && (state === 'waiting' || state === 'today'))
      || (filter === 'elapsed' && state === 'elapsed')
      || (filter === 'missing' && state === 'unknown');
    return matchesSearch && matchesFilter;
  });
  const visibleApplications = showAll ? filteredApplications : filteredApplications.slice(0, 4);

  const saveApplication = (event) => {
    event.preventDefault();
    setFormError('');
    const phiDays = Number(draft.phiDays);
    const costTzs = draft.costTzs === '' ? 0 : Number(draft.costTzs);
    if (!draft.date || draft.date > today) {
      setFormError('Choose an application date that is not in the future.');
      return;
    }
    if (!draft.product.trim() || !draft.dose.trim()) {
      setFormError('Enter the product name and the dose or application rate from your records.');
      return;
    }
    if (draft.phiDays === '' || !Number.isInteger(phiDays) || phiDays < 0 || phiDays > 365) {
      setFormError('Enter the pre-harvest interval in days exactly as stated on the product label (0–365).');
      return;
    }
    if (draft.costTzs !== '' && (!Number.isFinite(costTzs) || costTzs < 0)) {
      setFormError('Enter a non-negative cost in TZS.');
      return;
    }
    const field = fields.find((candidate) => candidate.id === draft.fieldId);
    const nextApplication = {
      id: createId(),
      module: 'spray-application',
      date: draft.date,
      fieldId: field?.id || '',
      fieldName: field?.name || '',
      crop: field?.crop || draft.crop.trim(),
      productType: draft.productType,
      product: draft.product.trim(),
      dose: draft.dose.trim(),
      phiDays,
      operator: draft.operator.trim(),
      costTzs,
      notes: draft.notes.trim(),
      source: 'Farmer-entered',
      createdAt: new Date().toISOString(),
    };
    onRecordsChange('activities', [...records, nextApplication]);
    setDraft({ date: today, fieldId: '', crop: '', productType: sprayTypes[0], product: '', dose: '', phiDays: '', operator: '', costTzs: '', notes: '' });
    setDialogOpen(false);
    setNotice('Application saved to your farm records. Check the current product label and applicable local requirements.');
  };

  const weatherCurrent = weather?.current;
  const weatherUpdated = weather?.updatedAt ? formatDate(weather.updatedAt) : '';

  return (
    <main className="spray-diary-page" aria-label="Spray Diary">
      {notice && <div className="spray-diary-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      {dialogOpen && <div className="spray-diary-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
        <section className="spray-diary-modal" role="dialog" aria-modal="true" aria-labelledby="spray-diary-dialog-title">
          <header><div><span className="spray-diary-eyebrow">FARMER-ENTERED RECORD</span><h2 id="spray-diary-dialog-title">Log an application</h2></div><button type="button" aria-label="Close dialog" onClick={() => setDialogOpen(false)}><span className="material-symbols-outlined">close</span></button></header>
          {formError && <p className="spray-diary-form-error" role="alert">{formError}</p>}
          <form onSubmit={saveApplication}>
            <div className="spray-diary-form-grid">
              <label>Application date<input required type="date" max={today} value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
              <label>Product type<select value={draft.productType} onChange={(event) => setDraft((current) => ({ ...current, productType: event.target.value }))}>{sprayTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Farm field<select value={draft.fieldId} onChange={(event) => {
                const field = fields.find((candidate) => candidate.id === event.target.value);
                setDraft((current) => ({ ...current, fieldId: event.target.value, crop: field?.crop || current.crop }));
              }}><option value="">Not linked to a saved field</option>{fields.map((field) => <option value={field.id} key={field.id}>{field.name || 'Unnamed field'}{field.crop ? ` · ${field.crop}` : ''}</option>)}</select></label>
              <label>Crop<input maxLength="100" value={draft.crop} onChange={(event) => setDraft((current) => ({ ...current, crop: event.target.value }))} placeholder="e.g. Tomatoes" /></label>
              <label>Product name<input required maxLength="120" value={draft.product} onChange={(event) => setDraft((current) => ({ ...current, product: event.target.value }))} placeholder="As shown on the product label" /></label>
              <label>Dose / application rate<input required maxLength="80" value={draft.dose} onChange={(event) => setDraft((current) => ({ ...current, dose: event.target.value }))} placeholder="Record label rate and unit" /></label>
              <label>Pre-harvest interval (days)<input required type="number" min="0" max="365" step="1" value={draft.phiDays} onChange={(event) => setDraft((current) => ({ ...current, phiDays: event.target.value }))} placeholder="From the product label" /></label>
              <label>Operator<input maxLength="100" value={draft.operator} onChange={(event) => setDraft((current) => ({ ...current, operator: event.target.value }))} placeholder="Name (optional)" /></label>
              <label>Application cost (TZS)<input type="number" min="0" step="1" value={draft.costTzs} onChange={(event) => setDraft((current) => ({ ...current, costTzs: event.target.value }))} placeholder="Optional" /></label>
              <label className="spray-diary-wide">Notes<textarea rows="3" maxLength="500" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional application notes" /></label>
            </div>
            <p className="spray-diary-form-note">Enter product and PHI details from the exact product label. This diary does not validate product approvals, recommend application rates, assess residue, or certify harvest readiness.</p>
            <div className="spray-diary-modal-actions"><button type="button" onClick={() => setDialogOpen(false)}>Cancel</button><button type="submit"><span className="material-symbols-outlined">save</span>Save application</button></div>
          </form>
        </section>
      </div>}

      <header className="spray-diary-topbar">
        <button type="button" aria-label="Back to dashboard" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span></button>
        <span className="spray-diary-brand">Farm workspace</span>
        <div className="spray-diary-top-actions"><button type="button" aria-label="Review active PHI reminders" onClick={() => setNotice(activePhi.length ? `${activePhi.length} pre-harvest interval reminder${activePhi.length === 1 ? '' : 's'} active. Verify the product label before harvest.` : 'No active interval reminders are recorded. Check product labels before harvest.')}><span className="material-symbols-outlined">notifications</span></button><button type="button" aria-label="Open help" onClick={() => setNotice('For product-specific use and harvest intervals, consult the current label and a qualified local agricultural adviser.')}><span className="material-symbols-outlined">help_outline</span></button></div>
      </header>

      <div className="spray-diary-content">
        <header className="spray-diary-heading">
          <div><span className="spray-diary-eyebrow">DIGITAL FARM · CROP PROTECTION RECORDS</span><h1>Spray Diary</h1><p>Record pesticide, herbicide, and fungicide applications with label-based pre-harvest interval notes.</p></div>
          <div className="spray-diary-heading-actions"><button type="button" className="spray-diary-export" onClick={() => { downloadCsv(applications, fields); setNotice(exportDataNotice()); }} disabled={!applications.length}><span className="material-symbols-outlined">download</span>Export for Compliance</button><button type="button" className="spray-diary-primary" onClick={() => { setFormError(''); setDialogOpen(true); }}><span className="material-symbols-outlined">add</span>Log Application</button></div>
        </header>

        <p className="spray-diary-safety-note"><span className="material-symbols-outlined">info</span>PHI countdowns are date calculations from intervals you enter from the product label. They are reminders only—not residue testing, regulatory advice, or confirmation that produce is safe to harvest.</p>

        <section className="spray-diary-stats" aria-label="Spray diary summary">
          <article><div><span>Applications</span><span className="material-symbols-outlined">water_drop</span></div><strong>{seasonalApplications.length}</strong><small>This calendar year · saved records</small></article>
          <article className="is-alert"><div><span>Active PHI reminders</span><span className="material-symbols-outlined">timer</span></div><strong>{activePhi.length}</strong><small>Based on recorded label intervals</small></article>
          <article><div><span>Fields treated</span><span className="material-symbols-outlined">landscape</span></div><strong>{treatedFieldCount}</strong><small>Distinct linked fields this year</small></article>
          <article><div><span>Total cost</span><span className="material-symbols-outlined">payments</span></div><strong>{formatTzs(seasonalCost)}</strong><small>Recorded this calendar year</small></article>
        </section>

        <div className="spray-diary-layout">
          <section className="spray-diary-log">
            <header><div><h2>Spray Log</h2><p>{applications.length} saved application record{applications.length === 1 ? '' : 's'}</p></div><label className="spray-diary-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, field, or crop" aria-label="Search spray log" /></label><label className="spray-diary-filter"><span className="material-symbols-outlined">filter_list</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setShowAll(true); }} aria-label="Filter spray applications"><option value="all">All records</option><option value="active">Active PHI</option><option value="elapsed">Interval elapsed</option><option value="missing">PHI not recorded</option></select></label></header>
            {visibleApplications.length ? <div className="spray-diary-table-wrap"><table><thead><tr><th>Date</th><th>Field &amp; crop</th><th>Product (dose)</th><th>PHI status</th><th>Operator</th></tr></thead><tbody>{visibleApplications.map((application) => {
              const field = fieldById.get(application.fieldId);
              const phi = phiDetails(application, today);
              return <tr key={application.id}><td>{formatDate(application.date)}</td><td><strong>{field?.name || application.fieldName || 'Field not linked'}</strong><small>{field?.crop || application.crop || 'Crop not recorded'}</small></td><td><strong>{application.product}</strong><small>{application.dose}</small></td><td><span className={`spray-diary-phi-badge ${phi.state}`}><span className="material-symbols-outlined">{phi.state === 'waiting' || phi.state === 'today' ? 'timer' : phi.state === 'elapsed' ? 'check_circle' : 'help'}</span>{phi.label}</span>{phi.clearDate && <small className="spray-diary-clear-date">Recorded interval ends: {formatDate(phi.clearDate)}</small>}</td><td>{application.operator || 'Not recorded'}</td></tr>;
            })}</tbody></table></div> : <div className="spray-diary-empty"><span className="material-symbols-outlined">event_note</span><strong>{applications.length ? 'No applications match this filter' : 'No applications recorded yet'}</strong><p>{applications.length ? 'Try another search or filter.' : 'Log an application to start your farmer-entered spray diary.'}</p>{!applications.length && <button type="button" className="spray-diary-primary" onClick={() => setDialogOpen(true)}><span className="material-symbols-outlined">add</span>Log Application</button>}</div>}
            {filteredApplications.length > visibleApplications.length && <button type="button" className="spray-diary-view-more" onClick={() => setShowAll(true)}>View Full Log</button>}
          </section>

          <aside className="spray-diary-sidebar">
            <section className="spray-diary-weather">
              <h2><span className="material-symbols-outlined">routine</span>Weather Conditions</h2>
              <div className="spray-diary-weather-status"><span className="material-symbols-outlined">{weatherCurrent ? 'cloud' : 'cloud_off'}</span><div><strong>{weatherCurrent ? weatherCurrent.conditions : 'Weather unavailable'}</strong><small>{weather?.location || weatherStatus || 'No current weather reading'}</small></div></div>
              <div className="spray-diary-weather-reading"><span><span className="material-symbols-outlined">air</span>Wind speed</span><strong>{readWeatherValue(weatherCurrent?.wind)}</strong></div>
              <div className="spray-diary-weather-reading"><span><span className="material-symbols-outlined">water_drop</span>Current precipitation</span><strong>{readWeatherValue(weatherCurrent?.rain)}</strong></div>
              <p>Weather is informational only and does not determine whether an application is safe or appropriate. Check the product label and local guidance.</p>
              {weatherUpdated && <small className="spray-diary-weather-updated">Reading updated: {weatherUpdated}</small>}
            </section>

            <section className="spray-diary-alerts">
              <header><h2><span className="material-symbols-outlined">warning</span>Active PHI Reminders</h2><p>Use the exact pre-harvest interval on the product label. Verify requirements before harvest.</p></header>
              {activePhi.length ? <div className="spray-diary-alert-list">{activePhi.map(({ application, remaining, clearDate }) => {
                const field = fieldById.get(application.fieldId);
                return <article key={application.id}><div><strong>{field?.name || application.fieldName || 'Field not linked'}{field?.crop || application.crop ? ` (${field?.crop || application.crop})` : ''}</strong><small>{application.product}</small></div><span>{remaining} <small>day{remaining === 1 ? '' : 's'}</small></span><div className="spray-diary-progress" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(8, (remaining / Math.max(1, Number(application.phiDays))) * 100))}%` }} /></div><small className="spray-diary-harvest-date">Recorded interval ends: {formatDate(clearDate)}</small></article>;
              })}</div> : <div className="spray-diary-no-alerts"><span className="material-symbols-outlined">check_circle</span><p>No active interval reminders in the records. Confirm all harvest restrictions on the product label; elapsed dates are not a safety certification.</p></div>}
            </section>

            <button type="button" className="spray-diary-fields-link" onClick={() => onNavigate?.('fields')}><span className="material-symbols-outlined">agriculture</span>Manage fields <span className="material-symbols-outlined">arrow_forward</span></button>
          </aside>
        </div>
      </div>
    </main>
  );
}
