import { useMemo, useState } from 'react';

const animalFields = [
  ['cattle', 'Cattle (heads)', 'pets'],
  ['smallRuminants', 'Goats / sheep (heads)', 'cruelty_free'],
  ['pigs', 'Pigs (heads)', 'sound_detection_dog_barking'],
  ['poultry', 'Poultry (birds)', 'egg_alt'],
];

const animalGasFactors = { cattle: 0.25, smallRuminants: 0.04, pigs: 0.15, poultry: 0.006 };
const defaultAnimalCounts = { cattle: 0, smallRuminants: 0, pigs: 0, poultry: 0 };
const activityTypes = [
  'Planted trees',
  'Started biogas digester',
  'Reduced tillage logged',
  'Agroforestry practice',
  'Manure management',
  'Other climate-smart practice',
];

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => globalThis.crypto?.randomUUID?.() || `carbon-${Date.now()}`;
const savedAnimals = (records) => records.find((record) => record.module === 'carbon-livestock')?.animals || defaultAnimalCounts;
const carbonActivities = (records) => records.filter((record) => record.module === 'carbon-activity');
const creditReviews = (records) => records.filter((record) => record.module === 'carbon-review');

function CarbonActivityDialog({ fields, onClose, onSave }) {
  const [values, setValues] = useState({ title: activityTypes[0], date: today(), fieldId: '', details: '' });

  const submit = (event) => {
    event.preventDefault();
    const field = fields.find((candidate) => candidate.id === values.fieldId);
    onSave({
      id: makeId(),
      module: 'carbon-activity',
      title: values.title,
      date: values.date || today(),
      fieldId: field?.id || '',
      fieldName: field?.name || '',
      details: values.details.trim(),
      status: 'Farmer reported',
    });
    onClose();
  };

  return (
    <div className="carbon-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="carbon-dialog" role="dialog" aria-modal="true" aria-labelledby="carbon-activity-title">
        <div className="carbon-dialog-heading"><div><span className="carbon-eyebrow">CLIMATE-SMART PRACTICE</span><h2 id="carbon-activity-title">Log an activity</h2></div><button type="button" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button></div>
        <form onSubmit={submit}>
          <label>Activity<select value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}>{activityTypes.map((activity) => <option key={activity}>{activity}</option>)}</select></label>
          <div className="carbon-form-row">
            <label>Date<input required type="date" max={today()} value={values.date} onChange={(event) => setValues((current) => ({ ...current, date: event.target.value }))} /></label>
            <label>Farm field <span>(optional)</span><select value={values.fieldId} onChange={(event) => setValues((current) => ({ ...current, fieldId: event.target.value }))}><option value="">Not linked</option>{fields.map((field) => <option value={field.id} key={field.id}>{field.name}</option>)}</select></label>
          </div>
          <label>Notes <span>(optional)</span><textarea rows="3" maxLength="500" value={values.details} onChange={(event) => setValues((current) => ({ ...current, details: event.target.value }))} placeholder="Add details to help document this activity" /></label>
          <p className="carbon-dialog-note">This saves a farmer-reported record. It does not verify the activity or issue carbon credits.</p>
          <div className="carbon-dialog-actions"><button type="button" className="carbon-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="carbon-primary-button">Save activity</button></div>
        </form>
      </section>
    </div>
  );
}

function dateLabel(date) {
  if (!date) return 'Date not recorded';
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CarbonCreditsWorkspace({ profile, records = [], fields = [], onRecordsChange, onNavigate }) {
  const [animals, setAnimals] = useState(() => ({ ...defaultAnimalCounts, ...savedAnimals(records) }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const activities = useMemo(() => carbonActivities(records).sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))), [records]);
  const reviews = useMemo(() => creditReviews(records), [records]);
  const totalAnimalCount = Object.values(animals).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const gasVolume = Object.entries(animalGasFactors).reduce((total, [animal, factor]) => total + Math.max(0, Number(animals[animal]) || 0) * factor, 0);
  const cookingHours = gasVolume * 2.5;
  const indicativeMonthlyCredits = gasVolume * 30 * 1.5 / 1000;
  const issuedCredits = records.filter((record) => record.module === 'carbon-credit-issued')
    .reduce((total, record) => total + Math.max(0, Number(record.credits) || 0), 0);
  const hasCoordinates = Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude))
    && profile.latitude !== '' && profile.longitude !== '';

  const saveLivestockCounts = () => {
    const nextRecords = records.filter((record) => record.module !== 'carbon-livestock');
    onRecordsChange([...nextRecords, { id: 'carbon-livestock-counts', module: 'carbon-livestock', animals, updatedAt: new Date().toISOString() }]);
    setNotice('Livestock counts saved to your account. Calculator outputs are illustrative estimates.');
  };

  const saveActivity = (activity) => {
    onRecordsChange([...records, activity]);
    setNotice('Activity saved as farmer-reported. Third-party verification is not included.');
  };

  const requestReview = () => {
    const alreadyPending = reviews.some((review) => review.status === 'review-requested');
    if (alreadyPending) {
      setNotice('A review request is already recorded on this account. No verifier has received it.');
      return;
    }
    onRecordsChange([...records, {
      id: makeId(),
      module: 'carbon-review',
      status: 'review-requested',
      requestedAt: new Date().toISOString(),
    }]);
    setNotice('Review request saved on this account only. No external auditor has been contacted.');
  };

  return (
    <main className="carbon-hub" aria-label="Carbon and biogas workspace">
      {dialogOpen && <CarbonActivityDialog fields={fields} onClose={() => setDialogOpen(false)} onSave={saveActivity} />}
      {notice && <div className="carbon-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <header className="carbon-heading">
        <div><span className="carbon-eyebrow">KIJANI OS · CARBON MODULE</span><h1>Mkaa wa Mazingira — Carbon &amp; Biogas Hub</h1><p>Document sustainable farming practices, explore biogas potential, and prepare records for independent review.</p></div>
        <button type="button" className="carbon-primary-button" onClick={requestReview}><span className="material-symbols-outlined">verified</span>Request credit review</button>
      </header>

      <div className="carbon-disclaimer"><span className="material-symbols-outlined">info</span><span>Calculator values are indicative planning estimates, not measured output or verified carbon credits. No carbon registry, auditor, buyer, or payment provider is connected.</span></div>

      <section className="carbon-metrics" aria-label="Carbon activity summary">
        <article className="carbon-metric-card"><div><span>Credits issued</span><span className="material-symbols-outlined">eco</span></div><strong>{issuedCredits.toFixed(1)} CR</strong><small>Only registry-confirmed credits count here</small></article>
        <article className="carbon-metric-card"><div><span>Market value</span><span className="material-symbols-outlined">payments</span></div><strong>Not available</strong><small>No verified credits or live buyer pricing</small></article>
        <article className="carbon-metric-card"><div><span>Estimated biogas</span><span className="material-symbols-outlined">local_fire_department</span></div><strong>{gasVolume.toFixed(2)} m³/day</strong><small>Planning estimate from saved animal counts</small></article>
        <article className="carbon-metric-card"><div><span>Logged activities</span><span className="material-symbols-outlined">forest</span></div><strong>{activities.length}</strong><small>Farmer-reported, not independently verified</small></article>
      </section>

      <section className="carbon-main-grid">
        <article className="carbon-card carbon-calculator">
          <div className="carbon-card-heading"><div><span className="carbon-eyebrow">FARM INPUTS</span><h2><span className="material-symbols-outlined">calculate</span>Biogas potential calculator</h2></div><button type="button" className="carbon-text-button" onClick={() => setAnimals(defaultAnimalCounts)}>Reset</button></div>
          <div className="carbon-calculator-body">
            <div className="carbon-animal-inputs">
              {animalFields.map(([key, label, icon]) => (
                <label key={key}>{label}<div className="carbon-number-input"><input aria-label={label} type="number" min="0" max="100000" step="1" value={animals[key] ?? 0} onChange={(event) => setAnimals((current) => ({ ...current, [key]: Math.min(100000, Math.max(0, Math.floor(Number(event.target.value) || 0)) ) }))} /><span className="material-symbols-outlined">{icon}</span></div></label>
              ))}
              <button type="button" className="carbon-secondary-button" onClick={saveLivestockCounts}><span className="material-symbols-outlined">save</span>Save livestock counts</button>
            </div>
            <div className="carbon-estimate-panel">
              <span className="carbon-eyebrow">ILLUSTRATIVE DAILY ESTIMATE</span>
              <div className="carbon-estimate-stat"><div><span>Biogas potential</span><strong>{gasVolume.toFixed(2)} m³</strong></div><div className="carbon-progress"><span style={{ width: `${Math.min(100, gasVolume / 10 * 100)}%` }} /></div></div>
              <div className="carbon-estimate-stat"><div><span>Potential cooking time</span><strong>{cookingHours.toFixed(1)} hrs</strong></div><div className="carbon-progress cooking"><span style={{ width: `${Math.min(100, cookingHours / 10 * 100)}%` }} /></div></div>
              <div className="carbon-estimate-monthly"><span>Indicative monthly reduction potential</span><strong>{indicativeMonthlyCredits.toFixed(2)} tCO₂e</strong></div>
              <details className="carbon-method-note"><summary>See estimate assumptions</summary><p>Planning factors: cattle 0.25, goats/sheep 0.04, pigs 0.15, and poultry 0.006 m³ of biogas per head per day; cooking-time estimate 2.5 hours per m³. The indicative reduction uses 1.5 kg CO₂e displaced per m³ for 30 days. These assumptions are not a project baseline or a carbon-credit methodology.</p></details>
              <small>Based on {totalAnimalCount.toLocaleString()} farmer-entered animals. Actual digesters and yields vary.</small>
            </div>
          </div>
        </article>

        <article className="carbon-card carbon-verification">
          <div className="carbon-card-heading"><div><span className="carbon-eyebrow">CREDIT JOURNEY</span><h2><span className="material-symbols-outlined">verified</span>Verification status</h2></div></div>
          <ol className="carbon-timeline">
            <li className={activities.length ? 'complete' : ''}><span className="carbon-timeline-dot" /><div><strong>Activity logged</strong><p>{activities.length ? `${activities.length} farmer-reported activity record${activities.length === 1 ? '' : 's'} saved.` : 'Log a climate-smart practice to begin your record.'}</p></div></li>
            <li className={hasCoordinates ? 'current' : ''}><span className="carbon-timeline-dot" /><div><strong>Location details</strong><p>{hasCoordinates ? 'Coordinates are saved in your profile; they have not been independently checked.' : 'Add farm coordinates to your profile if they are needed for a future review.'}</p></div></li>
            <li className={reviews.length ? 'current' : ''}><span className="carbon-timeline-dot" /><div><strong>Independent review</strong><p>{reviews.length ? 'Review request recorded locally. No auditor has received it.' : 'No third-party audit provider is connected.'}</p></div></li>
            <li><span className="carbon-timeline-dot" /><div><strong>Credits issued</strong><p>{issuedCredits ? `${issuedCredits.toFixed(1)} credits recorded as issued.` : 'No registry-issued credits are recorded.'}</p></div></li>
          </ol>
          <button type="button" className="carbon-primary-button carbon-review-button" onClick={requestReview}>Request review</button>
        </article>
      </section>

      <section className="carbon-lower-grid">
        <article className="carbon-card carbon-market-card">
          <div className="carbon-card-heading"><div><span className="carbon-eyebrow">CARBON MARKET</span><h2><span className="material-symbols-outlined">storefront</span>Buyer connections</h2></div></div>
          <p>There are no verified carbon-credit buyers or live price offers connected to this account. Issued-credit sales are not available here yet.</p>
          <div className="carbon-market-status"><span className="material-symbols-outlined">info</span><span>Only an independent verifier and registry can confirm credit issuance and tradable value.</span></div>
          <button type="button" className="carbon-secondary-button" onClick={() => onNavigate('marketplace')}><span className="material-symbols-outlined">arrow_forward</span>Explore farm marketplace</button>
        </article>

        <article className="carbon-card carbon-activities-card">
          <div className="carbon-card-heading"><div><span className="carbon-eyebrow">FARMER RECORDS</span><h2><span className="material-symbols-outlined">history_edu</span>Recent activities</h2></div><button type="button" className="carbon-text-button" onClick={() => setDialogOpen(true)}>Log activity <span className="material-symbols-outlined">add</span></button></div>
          {activities.length ? <div className="carbon-activity-list">{activities.slice(0, 6).map((activity) => (
            <article key={activity.id}><span className="material-symbols-outlined">{/tree|agroforest/i.test(activity.title) ? 'forest' : /biogas|manure/i.test(activity.title) ? 'energy_savings_leaf' : 'eco'}</span><div><strong>{activity.title}</strong><small>{activity.fieldName ? `${activity.fieldName} · ` : ''}{activity.status || 'Farmer reported'}{activity.details ? ` · ${activity.details}` : ''}</small></div><time dateTime={activity.date}>{dateLabel(activity.date)}</time></article>
          ))}</div> : <div className="carbon-empty"><span className="material-symbols-outlined">eco</span><p>Your climate-smart practice records will appear here.</p><button type="button" className="carbon-text-button" onClick={() => setDialogOpen(true)}>Log your first activity</button></div>}
        </article>
      </section>
    </main>
  );
}
