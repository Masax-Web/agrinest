import { useEffect, useMemo, useState } from 'react';
import { calculateFarmerTrust } from './lib/farmer-trust';
import './SmartLoanApplication.css';

const steps = ['Loan Details', 'Digital Evidence', 'AI Schedule', 'Review'];
const crops = [
  { label: 'Maize', icon: 'eco' },
  { label: 'Beans', icon: 'grass' },
  { label: 'Sunflower', icon: 'filter_vintage' },
  { label: 'Poultry', icon: 'egg' },
];
const lenders = ['CRDB Bank', 'NMB Bank', 'SACCOS Network'];
const annualRate = 0.085;
const formatTzs = (amount) => `TZS ${Math.round(amount).toLocaleString('en-TZ')}`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const addMonths = (value, months) => {
  const [year, month, day] = value.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
};
const formatDate = (value) => new Intl.DateTimeFormat('en-TZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(new Date(`${value}T00:00:00`));
const createId = () => globalThis.crypto?.randomUUID?.() || `smart-loan-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function createDraft() {
  const start = today();
  return {
    crop: 'Maize',
    lender: lenders[0],
    amount: 2500000,
    termMonths: 6,
    harvestDate: addMonths(start, 6),
  };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidDraft(draft) {
  return draft && crops.some(({ label }) => label === draft.crop)
    && lenders.includes(draft.lender)
    && Number.isSafeInteger(draft.amount) && draft.amount >= 500000 && draft.amount <= 5000000
    && [3, 6, 9, 12].includes(draft.termMonths)
    && isValidDate(draft.harvestDate);
}

function isValidApplication(application) {
  return application && typeof application.id === 'string' && application.id
    && typeof application.draftId === 'string' && application.draftId
    && crops.some(({ label }) => label === application.crop)
    && lenders.includes(application.lender)
    && Number.isSafeInteger(application.amount) && application.amount >= 500000 && application.amount <= 5000000
    && [3, 6, 9, 12].includes(application.termMonths)
    && isValidDate(application.harvestDate)
    && typeof application.savedAt === 'string'
    && Array.isArray(application.evidence)
    && application.evidence.every((file) => file && typeof file.name === 'string'
      && Number.isSafeInteger(file.size) && file.size >= 0
      && ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type));
}

function readSavedState(storageKey) {
  if (!storageKey) {
    return { draftId: createId(), draft: createDraft(), applications: [], error: 'Your account ID is unavailable; this application cannot be saved on this browser.' };
  }
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (!saved) return { draftId: createId(), draft: createDraft(), applications: [], error: '' };
    if (saved.format !== 'agrinest-smart-loan' || saved.version !== 1
      || typeof saved.draftId !== 'string' || !saved.draftId
      || !isValidDraft(saved.draft) || !Array.isArray(saved.applications)
      || !saved.applications.every(isValidApplication)) {
      return { draftId: createId(), draft: createDraft(), applications: [], error: 'Saved smart-loan data is invalid or from an unsupported version. Clear it to start again.' };
    }
    return { draftId: saved.draftId, draft: saved.draft, applications: saved.applications, error: '' };
  } catch (error) {
    console.error('Smart-loan application data could not be read:', error);
    return { draftId: createId(), draft: createDraft(), applications: [], error: 'Saved smart-loan data could not be read. Clear it to start again.' };
  }
}

function InterestEstimate({ amount, termMonths }) {
  const interest = Math.round(amount * annualRate * termMonths / 12);
  const total = amount + interest;
  const monthlyPayment = Math.round(total / termMonths);
  return { interest, total, monthlyPayment };
}

function Stepper({ activeStep, onSelect }) {
  return (
    <nav className="smart-loan-stepper" aria-label="Application progress">
      {steps.map((label, index) => (
        <div className="smart-loan-step-wrap" key={label}>
          <button
            type="button"
            className={`smart-loan-step ${index === activeStep ? 'active' : ''} ${index < activeStep ? 'complete' : ''}`}
            aria-current={index === activeStep ? 'step' : undefined}
            onClick={() => index < activeStep && onSelect(index)}
            disabled={index >= activeStep}
          >
            <span className="smart-loan-step-number">{index < activeStep ? <span className="material-symbols-outlined" aria-hidden="true">check</span> : index + 1}</span>
            <span>{label}</span>
          </button>
          {index < steps.length - 1 && <span className="smart-loan-step-line" aria-hidden="true" />}
        </div>
      ))}
    </nav>
  );
}

function EvidenceStep({ evidence, onAdd, onRemove, error }) {
  return (
    <section className="smart-loan-panel" aria-labelledby="smart-loan-evidence-title">
      <div className="smart-loan-panel-heading">
        <span className="smart-loan-eyebrow">SUPPORTING DOCUMENTS</span>
        <h2 id="smart-loan-evidence-title">Link digital evidence</h2>
        <p>Add relevant farm or harvest records to keep with your application draft.</p>
      </div>
      <label className="smart-loan-upload">
        <span className="material-symbols-outlined" aria-hidden="true">cloud_upload</span>
        <strong>Choose supporting files</strong>
        <span>PDF, JPG or PNG · up to 5 files · 10 MB maximum each</span>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={onAdd} />
      </label>
      {error && <p className="smart-loan-inline-error" role="alert">{error}</p>}
      {evidence.length > 0 ? (
        <ul className="smart-loan-evidence-list">
          {evidence.map(({ id, file }) => (
            <li key={id}>
              <span className="material-symbols-outlined" aria-hidden="true">{file.type === 'application/pdf' ? 'picture_as_pdf' : 'image'}</span>
              <span className="smart-loan-evidence-name"><strong>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></span>
              <button type="button" aria-label={`Remove ${file.name}`} onClick={() => onRemove(id)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="smart-loan-no-evidence"><span className="material-symbols-outlined" aria-hidden="true">folder_open</span><p>No evidence selected yet. You can continue without files and add them to a new draft later.</p></div>
      )}
      <p className="smart-loan-privacy-note"><span className="material-symbols-outlined" aria-hidden="true">lock</span>Files stay in this page session and are not uploaded or saved to this browser. AGRI-NEST has no lender document-transfer connection on this screen.</p>
    </section>
  );
}

function ScheduleStep({ draft, estimate }) {
  const payments = useMemo(() => {
    const start = today();
    return Array.from({ length: draft.termMonths }, (_, index) => ({
      number: index + 1,
      date: addMonths(start, index + 1),
      amount: index === draft.termMonths - 1
        ? estimate.total - estimate.monthlyPayment * (draft.termMonths - 1)
        : estimate.monthlyPayment,
    }));
  }, [draft.termMonths, estimate.total, estimate.monthlyPayment]);

  return (
    <section className="smart-loan-panel" aria-labelledby="smart-loan-schedule-title">
      <div className="smart-loan-panel-heading">
        <span className="smart-loan-eyebrow">STEP 3 · PAYMENT OUTLINE</span>
        <h2 id="smart-loan-schedule-title">Indicative repayment schedule</h2>
        <p>Review a simple estimate based on your selected amount and period.</p>
      </div>
      <div className="smart-loan-model-notice" role="note">
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        <p><strong>AI schedule suggestions are not active.</strong> These equal monthly estimates are calculated from an illustrative 8.5% annual rate, not an AI prediction or a lender offer. Confirm the actual rate, fees and dates with your chosen partner.</p>
      </div>
      <div className="smart-loan-schedule-summary">
        <div><span>Estimated principal</span><strong>{formatTzs(draft.amount)}</strong></div>
        <div><span>Estimated interest</span><strong>{formatTzs(estimate.interest)}</strong></div>
        <div><span>Estimated total</span><strong>{formatTzs(estimate.total)}</strong></div>
      </div>
      <div className="smart-loan-schedule-list" aria-label="Estimated monthly payments">
        {payments.map((payment) => (
          <div className="smart-loan-schedule-row" key={payment.number}>
            <span className="smart-loan-payment-number">{String(payment.number).padStart(2, '0')}</span>
            <span><strong>Payment {payment.number}</strong><small>{formatDate(payment.date)}</small></span>
            <strong>{formatTzs(payment.amount)}</strong>
          </div>
        ))}
      </div>
      <div className="smart-loan-harvest-alignment">
        <span className="material-symbols-outlined" aria-hidden="true">event</span>
        <span><small>Expected harvest date</small><strong>{formatDate(draft.harvestDate)}</strong></span>
      </div>
    </section>
  );
}

export default function SmartLoanApplication({ userId, profile, onBack, onOpenPlanner }) {
  const storageKey = userId ? `agrinest-smart-loan-applications:v1:${userId}` : '';
  const [saved, setSaved] = useState(() => readSavedState(storageKey));
  const [activeStep, setActiveStep] = useState(0);
  const [evidence, setEvidence] = useState([]);
  const [evidenceError, setEvidenceError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [savedCurrentDraft, setSavedCurrentDraft] = useState(() => saved.applications.some((application) => application.draftId === saved.draftId));
  const savedApplication = saved.applications.find((application) => application.draftId === saved.draftId);
  const reviewEvidence = evidence.length
    ? evidence.map(({ id, file }) => ({ id, name: file.name }))
    : savedCurrentDraft && savedApplication
      ? savedApplication.evidence.map((file, index) => ({ id: `${savedApplication.id}-${index}`, name: file.name }))
      : [];
  const trust = calculateFarmerTrust(profile || {});
  const estimate = InterestEstimate({ amount: Number(saved.draft.amount), termMonths: Number(saved.draft.termMonths) });
  const draft = saved.draft;

  useEffect(() => {
    const nextSaved = readSavedState(storageKey);
    setSaved(nextSaved);
    setSavedCurrentDraft(nextSaved.applications.some((application) => application.draftId === nextSaved.draftId));
    setEvidence([]);
    setActiveStep(0);
    setConfirmed(false);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || saved.error || !saved.draft) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        format: 'agrinest-smart-loan',
        version: 1,
        draftId: saved.draftId,
        draft: saved.draft,
        applications: saved.applications,
      }));
    } catch (error) {
      console.error('Smart-loan application data could not be saved:', error);
      setSaved((current) => ({ ...current, error: 'Could not save your application on this browser. Check available storage and try again.' }));
    }
  }, [storageKey, saved.draft, saved.applications, saved.error]);

  const updateDraft = (field, value) => {
    setSaved((current) => ({
      ...current,
      draftId: current.applications.some((application) => application.draftId === current.draftId) ? createId() : current.draftId,
      draft: { ...current.draft, [field]: value },
    }));
    setSavedCurrentDraft(false);
    setNotice('');
  };

  const markEvidenceChanged = () => {
    setSaved((current) => current.applications.some((application) => application.draftId === current.draftId)
      ? { ...current, draftId: createId() }
      : current);
    setSavedCurrentDraft(false);
  };

  const handleAddEvidence = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    const accepted = [];
    let message = '';
    for (const file of selected) {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        message = 'Choose PDF, JPG or PNG files only.';
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        message = `${file.name} is larger than the 10 MB per-file limit.`;
        continue;
      }
      accepted.push({ id: createId(), file });
    }
    const remaining = Math.max(0, 5 - evidence.length);
    if (accepted.length > remaining) message = 'You can attach up to 5 files.';
    setEvidence((current) => [...current, ...accepted.slice(0, remaining)]);
    setEvidenceError(message);
    markEvidenceChanged();
  };

  const validateDetails = () => {
    if (!crops.some(({ label }) => label === draft.crop) || !lenders.includes(draft.lender)) {
      setNotice('Choose a listed crop and lending partner.');
      return false;
    }
    if (!Number.isSafeInteger(Number(draft.amount)) || Number(draft.amount) < 500000 || Number(draft.amount) > 5000000) {
      setNotice('Choose an amount between TZS 500,000 and TZS 5,000,000.');
      return false;
    }
    if (![3, 6, 9, 12].includes(Number(draft.termMonths))) {
      setNotice('Choose a repayment period from the available options.');
      return false;
    }
    if (!isValidDate(draft.harvestDate) || draft.harvestDate < today()) {
      setNotice('Choose an expected harvest date that is today or later.');
      return false;
    }
    return true;
  };

  const continueToNextStep = () => {
    setNotice('');
    if (activeStep === 0 && !validateDetails()) return;
    if (activeStep < steps.length - 1) setActiveStep((current) => current + 1);
  };

  const saveApplication = () => {
    if (!storageKey || saved.error) {
      setNotice('Resolve the local storage issue before saving this application.');
      return;
    }
    if (!confirmed) {
      setNotice('Confirm that the details are accurate before saving.');
      return;
    }
    const application = {
      id: createId(),
      draftId: saved.draftId,
      crop: draft.crop,
      lender: draft.lender,
      amount: Number(draft.amount),
      termMonths: Number(draft.termMonths),
      harvestDate: draft.harvestDate,
      evidence: evidence.map(({ file }) => ({ name: file.name, size: file.size, type: file.type })),
      savedAt: new Date().toISOString(),
    };
    const applications = [application, ...saved.applications];
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        format: 'agrinest-smart-loan',
        version: 1,
        draftId: saved.draftId,
        draft: saved.draft,
        applications,
      }));
    } catch (error) {
      console.error('Smart-loan application could not be saved:', error);
      setSaved((current) => ({ ...current, error: 'Could not save your application on this browser. Check available storage and try again.' }));
      setNotice('Could not save your application. Check browser storage and try again.');
      return;
    }
    setSaved((current) => ({ ...current, applications }));
    setSavedCurrentDraft(true);
    setNotice('Application saved on this browser. It has not been submitted to or shared with a lender.');
  };

  const clearSavedData = () => {
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
      setSaved({ draftId: createId(), draft: createDraft(), applications: [], error: '' });
      setNotice('Saved smart-loan data was cleared from this browser.');
      setActiveStep(0);
      setEvidence([]);
      setConfirmed(false);
      setSavedCurrentDraft(false);
    } catch (error) {
      console.error('Smart-loan data could not be cleared:', error);
      setSaved((current) => ({ ...current, error: 'Could not clear smart-loan data from this browser.' }));
    }
  };

  const beginNewApplication = () => {
    setSaved((current) => ({ ...current, draftId: createId(), draft: createDraft() }));
    setEvidence([]);
    setActiveStep(0);
    setConfirmed(false);
    setSavedCurrentDraft(false);
    setNotice('');
  };

  return (
    <main className="smart-loan-page">
      <header className="smart-loan-page-header">
        <div>
          <span className="smart-loan-eyebrow">FARM FINANCE · YOUR PLAN, YOUR CHOICE</span>
          <h1>Apply for a Seasonal Smart Loan</h1>
          <p>Prepare a seasonal financing application with a transparent repayment estimate and supporting farm records.</p>
        </div>
        <button type="button" className="smart-loan-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Dashboard</button>
      </header>

      <Stepper activeStep={activeStep} onSelect={(index) => { setActiveStep(index); setNotice(''); }} />

      {(saved.error || !storageKey) && (
        <div className="smart-loan-storage-alert" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <div><strong>Local application storage needs attention</strong><p>{saved.error}</p>{storageKey && <button type="button" onClick={clearSavedData}>Clear saved data</button>}</div>
        </div>
      )}
      {notice && <div className="smart-loan-notice" role="status"><span className="material-symbols-outlined" aria-hidden="true">info</span>{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <div className="smart-loan-layout">
        <div className="smart-loan-main-column">
          {activeStep === 0 && (
            <>
              <section className="smart-loan-panel" aria-labelledby="smart-loan-details-title">
                <div className="smart-loan-panel-heading">
                  <span className="smart-loan-eyebrow">STEP 1 · APPLICATION DETAILS</span>
                  <h2 id="smart-loan-details-title">Shape your seasonal plan</h2>
                  <p>Choose the farm enterprise, partner and a repayment period that fits your season.</p>
                </div>
                <div className="smart-loan-details-grid">
                  <fieldset className="smart-loan-crop-field">
                    <legend>Select crop or enterprise</legend>
                    <div className="smart-loan-crop-options">
                      {crops.map(({ label, icon }) => (
                        <button type="button" key={label} className={draft.crop === label ? 'selected' : ''} aria-pressed={draft.crop === label} onClick={() => updateDraft('crop', label)}>
                          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="smart-loan-field">Lending partner
                    <select value={draft.lender} onChange={(event) => updateDraft('lender', event.target.value)}>
                      {lenders.map((lender) => <option key={lender}>{lender}</option>)}
                    </select>
                    <small>Partner selection is for your draft only; AGRI-NEST does not contact the lender.</small>
                  </label>
                </div>
                <div className="smart-loan-amount-control">
                  <div className="smart-loan-amount-heading"><label htmlFor="smart-loan-amount">Loan amount (TZS)</label><output htmlFor="smart-loan-amount">{Number(draft.amount).toLocaleString('en-TZ')}</output></div>
                  <input id="smart-loan-amount" type="range" min="500000" max="5000000" step="50000" value={draft.amount} onChange={(event) => updateDraft('amount', Number(event.target.value))} />
                  <div className="smart-loan-range-labels"><span>500k</span><span>1.5M</span><span>2.5M</span><span>3.5M</span><span>5.0M</span></div>
                </div>
                <fieldset className="smart-loan-term-field">
                  <legend>Repayment period (months)</legend>
                  <div className="smart-loan-term-options">
                    {[3, 6, 9, 12].map((months) => (
                      <button type="button" key={months} className={Number(draft.termMonths) === months ? 'selected' : ''} aria-pressed={Number(draft.termMonths) === months} onClick={() => updateDraft('termMonths', months)}>{months}</button>
                    ))}
                  </div>
                </fieldset>
                <label className="smart-loan-field smart-loan-harvest-date">Expected harvest date
                  <input type="date" min={today()} value={draft.harvestDate} onChange={(event) => updateDraft('harvestDate', event.target.value)} />
                </label>
              </section>

              <section className="smart-loan-insight-grid" aria-label="Farmer profile insight">
                <article className="smart-loan-trust-card">
                  <div className="smart-loan-trust-heading"><span>PROFILE TRUST SCORE</span><span className="smart-loan-tier">{trust.tier}</span></div>
                  <div className="smart-loan-trust-score">{trust.score}<small>/ 1000</small></div>
                  <p>Calculated from the details in your farmer profile. A profile score does not guarantee loan approval or terms.</p>
                  <span className="material-symbols-outlined smart-loan-trust-watermark" aria-hidden="true">verified_user</span>
                </article>
                <article className="smart-loan-insight-card">
                  <span className="material-symbols-outlined">trending_up</span>
                  <h3>Estimate, not an offer</h3>
                  <p>Your current plan uses an illustrative 8.5% annual rate. Your chosen partner sets the actual rate, fees and eligibility.</p>
                </article>
              </section>
            </>
          )}

          {activeStep === 1 && <EvidenceStep evidence={evidence} onAdd={handleAddEvidence} onRemove={(id) => { setEvidence((current) => current.filter((entry) => entry.id !== id)); markEvidenceChanged(); }} error={evidenceError} />}
          {activeStep === 2 && <ScheduleStep draft={draft} estimate={estimate} />}
          {activeStep === 3 && (
            <section className="smart-loan-panel" aria-labelledby="smart-loan-review-title">
              <div className="smart-loan-panel-heading">
                <span className="smart-loan-eyebrow">STEP 4 · FINAL CHECK</span>
                <h2 id="smart-loan-review-title">Review your application</h2>
                <p>Check your details before saving this application draft on this browser.</p>
              </div>
              <dl className="smart-loan-review-list">
                <div><dt>Crop or enterprise</dt><dd>{draft.crop}</dd></div>
                <div><dt>Lending partner</dt><dd>{draft.lender}</dd></div>
                <div><dt>Loan amount</dt><dd>{formatTzs(draft.amount)}</dd></div>
                <div><dt>Repayment period</dt><dd>{draft.termMonths} months</dd></div>
                <div><dt>Expected harvest</dt><dd>{formatDate(draft.harvestDate)}</dd></div>
                <div><dt>Estimated interest</dt><dd>{formatTzs(estimate.interest)} · illustrative 8.5% p.a.</dd></div>
              </dl>
              <div className="smart-loan-review-evidence"><strong>{savedCurrentDraft ? 'Evidence in saved draft' : 'Selected evidence'}</strong>{reviewEvidence.length ? <><ul>{reviewEvidence.map(({ id, name }) => <li key={id}>{name}</li>)}</ul>{savedCurrentDraft && evidence.length === 0 && <p>Only filenames are retained; files themselves were not saved or uploaded.</p>}</> : <p>No evidence attached.</p>}</div>
              <label className="smart-loan-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I have reviewed these details and confirm they are accurate to the best of my knowledge.</span></label>
              <div className="smart-loan-local-only" role="note"><span className="material-symbols-outlined" aria-hidden="true">devices</span><p>Saving creates a local application record only. Nothing is sent to {draft.lender}; your selected files are not uploaded or saved.</p></div>
            </section>
          )}
        </div>

        <aside className="smart-loan-side-column">
          <section className="smart-loan-summary-card" aria-labelledby="smart-loan-summary-title">
            <div className="smart-loan-summary-header"><h2 id="smart-loan-summary-title">Repayment Summary</h2><span className="material-symbols-outlined" aria-hidden="true">account_balance</span></div>
            <div className="smart-loan-summary-content">
              <div className="smart-loan-summary-row"><span>Estimated interest</span><strong>{formatTzs(estimate.interest)}</strong></div>
              <div className="smart-loan-summary-payment"><span>Estimated monthly installment</span><strong>{formatTzs(estimate.monthlyPayment)}</strong></div>
              <div className="smart-loan-summary-row"><span>Estimated total repayment</span><strong>{formatTzs(estimate.total)}</strong></div>
              <div className="smart-loan-summary-date"><span className="material-symbols-outlined" aria-hidden="true">calendar_today</span><span>Expected harvest</span><strong>{formatDate(draft.harvestDate)}</strong></div>
              <p className="smart-loan-summary-disclaimer">Illustrative estimate at 8.5% simple annual interest. Excludes fees. Confirm all terms with the lender.</p>
            </div>
            <div className="smart-loan-summary-actions">
              {activeStep < steps.length - 1 ? (
                <button type="button" onClick={continueToNextStep}>{activeStep === 0 ? 'Next: Link Digital Evidence' : activeStep === 1 ? 'Next: View Schedule' : 'Next: Review'}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
              ) : (
                <button type="button" disabled={!confirmed || Boolean(saved.error) || !storageKey || savedCurrentDraft} onClick={saveApplication}>{savedCurrentDraft ? 'Draft Saved' : 'Save Application Draft'}<span className="material-symbols-outlined" aria-hidden="true">{savedCurrentDraft ? 'check' : 'save'}</span></button>
              )}
              {activeStep > 0 && <button type="button" className="smart-loan-secondary-action" onClick={() => { setActiveStep((current) => current - 1); setNotice(''); }}>Back to {steps[activeStep - 1]}</button>}
              <button type="button" className="smart-loan-planner-link" onClick={onOpenPlanner}>Open Loan Spending Planner<span className="material-symbols-outlined" aria-hidden="true">open_in_new</span></button>
            </div>
          </section>
          <section className="smart-loan-growth-card">
            <span className="material-symbols-outlined" aria-hidden="true">agriculture</span>
            <div><h2>Seasonal planning</h2><p>Keep a clear record of your proposed financing and expected harvest timing.</p></div>
          </section>
          {saved.applications.length > 0 && (
            <section className="smart-loan-saved-applications" aria-labelledby="smart-loan-saved-title">
              <div className="smart-loan-saved-heading"><h2 id="smart-loan-saved-title">Saved applications</h2><button type="button" onClick={beginNewApplication}>New</button></div>
              <ul>
                {saved.applications.slice(0, 4).map((application) => (
                  <li key={application.id}><span><strong>{application.crop} · {application.lender}</strong><small>{formatTzs(application.amount)} · {application.termMonths} months</small></span><span className="smart-loan-draft-badge">Local draft</span></li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
