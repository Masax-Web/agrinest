import { useEffect, useMemo, useState } from 'react';
import './LenderDashboard.css';

const navigation = [
  { id: 'overview', label: 'Dashboard', icon: 'dashboard' },
  { id: 'applications', label: 'Applications', icon: 'assignment' },
  { id: 'portfolio', label: 'Capital Overview', icon: 'account_balance' },
  { id: 'disbursements', label: 'Disbursement Queue', icon: 'outbox' },
  { id: 'vendors', label: 'Vendor Records', icon: 'storefront' },
  { id: 'repayments', label: 'Payout History', icon: 'payments' },
  { id: 'audit', label: 'Audit Log', icon: 'history' },
  { id: 'risk', label: 'Risk Reviews', icon: 'verified_user' },
  { id: 'transactions', label: 'Transactions', icon: 'receipt_long' },
  { id: 'soil', label: 'Soil Analytics', icon: 'bar_chart' },
  { id: 'maps', label: 'Field Maps', icon: 'map' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
const applicationStatuses = ['Submitted', 'In review', 'Info requested', 'Decision recorded', 'Closed'];
const initialApplications = [
  { id: 'DEMO-2048', farmerRef: 'Farmer A-104', crop: 'Maize', amount: 12500000, term: 9, region: 'Iringa', status: 'In review', date: '2026-10-28', purpose: 'Seasonal inputs', demo: true, updates: [] },
  { id: 'DEMO-2047', farmerRef: 'Farmer B-221', crop: 'Sunflower', amount: 8200000, term: 6, region: 'Dodoma', status: 'Submitted', date: '2026-10-26', purpose: 'Seed and equipment', demo: true, updates: [] },
  { id: 'DEMO-2046', farmerRef: 'Farmer C-390', crop: 'Beans', amount: 6400000, term: 12, region: 'Mbeya', status: 'Info requested', date: '2026-10-24', purpose: 'Farm working capital', demo: true, updates: [] },
  { id: 'DEMO-2045', farmerRef: 'Farmer D-081', crop: 'Poultry', amount: 4800000, term: 6, region: 'Morogoro', status: 'Decision recorded', date: '2026-10-21', purpose: 'Poultry housing', demo: true, updates: [] },
];
const demoRepayments = [
  { id: 'PAY-DEMO-108', applicationId: 'DEMO-2045', date: '2026-11-02', amount: 800000, status: 'Recorded' },
  { id: 'PAY-DEMO-107', applicationId: 'DEMO-2047', date: '2026-10-30', amount: 1200000, status: 'Recorded' },
  { id: 'PAY-DEMO-106', applicationId: 'DEMO-2046', date: '2026-10-29', amount: 550000, status: 'Reconciliation needed' },
];
const financingTemplates = [
  {
    id: 'irrigation',
    title: 'Irrigation equipment request',
    purpose: 'Irrigation equipment',
    crop: 'Other',
    term: '6',
    category: 'Equipment',
    icon: 'water_drop',
    description: 'A local workflow template for reviewing an irrigation-equipment funding request.',
  },
  {
    id: 'seasonal-inputs',
    title: 'Seasonal input request',
    purpose: 'Seeds and farm inputs',
    crop: 'Maize',
    term: '6',
    category: 'Farm inputs',
    icon: 'grass',
    description: 'A local workflow template for reviewing a seed or input funding request.',
  },
];
const formatTzs = (amount) => `TZS ${Number(amount || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

function isValidApplication(application) {
  return application && typeof application.id === 'string' && application.id
    && typeof application.farmerRef === 'string'
    && typeof application.crop === 'string'
    && Number.isSafeInteger(application.amount) && application.amount > 0
    && Number.isInteger(application.term) && application.term >= 1 && application.term <= 60
    && typeof application.region === 'string'
    && applicationStatuses.includes(application.status)
    && typeof application.date === 'string'
    && typeof application.purpose === 'string'
    && typeof application.demo === 'boolean'
    && Array.isArray(application.updates)
    && application.updates.every((update) => update && typeof update.id === 'string'
      && typeof update.note === 'string' && typeof update.date === 'string');
}

function readWorkspace(storageKey) {
  if (!storageKey) return { applications: [], error: 'Your authenticated account ID is unavailable; this lender workspace cannot save records.' };
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (!saved) return { applications: initialApplications, error: '' };
    if (saved.format !== 'agrinest-lender-workspace' || saved.version !== 1
      || !Array.isArray(saved.applications) || !saved.applications.every(isValidApplication)) {
      return { applications: [], error: 'Saved lender workspace data is invalid or from an unsupported version. Clear it to continue.' };
    }
    return { applications: saved.applications, error: '' };
  } catch (error) {
    console.error('Lender workspace data could not be read:', error);
    return { applications: [], error: 'Saved lender workspace data could not be read. Clear it to continue.' };
  }
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatusBadge({ status }) {
  return <span className={`lender-status lender-status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>;
}

function LenderModal({ application, onClose, onSave }) {
  const [status, setStatus] = useState(application?.status || 'In review');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  if (!application) return null;

  const submitUpdate = (event) => {
    event.preventDefault();
    if (!note.trim()) {
      setError('Add a short note describing the review action.');
      return;
    }
    onSave(application.id, status, note.trim());
  };

  return (
    <div className="lender-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="lender-modal" role="dialog" aria-modal="true" aria-labelledby="lender-modal-title">
        <div className="lender-modal-header">
          <div><span className="lender-eyebrow">APPLICATION RECORD</span><h2 id="lender-modal-title">{application.id}</h2></div>
          <button type="button" className="lender-icon-button" aria-label="Close application details" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        {application.demo && <p className="lender-demo-inline">Illustrative example — not a real borrower application.</p>}
        <dl className="lender-detail-grid">
          <div><dt>Borrower reference</dt><dd>{application.farmerRef}</dd></div>
          <div><dt>Crop / enterprise</dt><dd>{application.crop}</dd></div>
          <div><dt>Requested amount</dt><dd>{formatTzs(application.amount)}</dd></div>
          <div><dt>Requested term</dt><dd>{application.term} months</dd></div>
          <div><dt>Region</dt><dd>{application.region}</dd></div>
          <div><dt>Purpose</dt><dd>{application.purpose}</dd></div>
          <div><dt>Received</dt><dd>{application.date}</dd></div>
          <div><dt>Current workflow status</dt><dd><StatusBadge status={application.status} /></dd></div>
        </dl>
        <div className="lender-review-history">
          <h3>Review history</h3>
          {application.updates.length ? (
            <ol>{application.updates.map((update) => <li key={update.id}><strong>{update.date} · {update.status}</strong><p>{update.note}</p></li>)}</ol>
          ) : <p>No review notes recorded.</p>}
        </div>
        <form className="lender-review-form" onSubmit={submitUpdate}>
          <h3>Record a human review update</h3>
          <label>Workflow status<select value={status} onChange={(event) => setStatus(event.target.value)}>{applicationStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Review note<textarea maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record the follow-up needed or review step completed" /></label>
          {error && <p role="alert" className="lender-form-error">{error}</p>}
          <p>Workflow notes only. This action does not approve or decline credit, contact a borrower, transfer funds, or change a lender system.</p>
          <div className="lender-modal-actions"><button type="button" className="lender-secondary-button" onClick={onClose}>Close</button><button type="submit" className="lender-primary-button">Save review update</button></div>
        </form>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, tone }) {
  return (
    <article className="lender-metric-card">
      <div className="lender-metric-top"><span className={`material-symbols-outlined lender-metric-icon ${tone}`}>{icon}</span>{detail && <span className="lender-metric-detail">{detail}</span>}</div>
      <p>{label}</p><strong>{value}</strong>
    </article>
  );
}

export default function LenderDashboard({ user, persona, onLogout }) {
  const storageKey = user?.user_id ? `agrinest-lender-workspace:v1:${user.user_id}` : '';
  const [workspace, setWorkspace] = useState(() => readWorkspace(storageKey));
  const [activePage, setActivePage] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [selectedId, setSelectedId] = useState('');
  const [showNewTrade, setShowNewTrade] = useState(false);
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newTrade, setNewTrade] = useState({ farmerRef: '', crop: 'Maize', amount: '', term: '6', region: '', purpose: '' });
  const applications = workspace.applications;
  const selectedApplication = applications.find((application) => application.id === selectedId) || null;
  const query = search.trim().toLowerCase();
  const visibleApplications = useMemo(() => applications.filter((application) => {
    const matchesText = !query || [application.id, application.farmerRef, application.crop, application.region, application.purpose]
      .some((value) => value.toLowerCase().includes(query));
    return matchesText && (statusFilter === 'All statuses' || application.status === statusFilter);
  }), [applications, query, statusFilter]);
  const activeApplications = applications.filter((application) => !['Closed', 'Decision recorded'].includes(application.status));
  const activeCapital = activeApplications.reduce((total, application) => total + application.amount, 0);
  const resolvedApplications = applications.filter((application) => ['Closed', 'Decision recorded'].includes(application.status));
  const reviewCoverage = applications.length ? Math.round((resolvedApplications.length / applications.length) * 100) : 0;
  const applicationCounts = applicationStatuses.reduce((counts, status) => {
    counts[status] = applications.filter((application) => application.status === status).length;
    return counts;
  }, {});
  const regionCounts = applications.reduce((counts, application) => {
    counts[application.region] = (counts[application.region] || 0) + 1;
    return counts;
  }, {});
  const auditEntries = applications.flatMap((application) => [
    {
      id: `${application.id}-created`,
      applicationId: application.id,
      date: application.date,
      action: 'Local workflow record created',
      detail: `${application.farmerRef} · ${application.crop}`,
      demo: application.demo,
    },
    ...application.updates.map((update) => ({
      ...update,
      applicationId: application.id,
      action: `Review status updated to ${update.status}`,
      detail: update.note,
      demo: application.demo,
    })),
  ]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const todayLabel = new Intl.DateTimeFormat('en-TZ', { dateStyle: 'medium' }).format(new Date());
  const userName = user?.name || 'Lender team';
  const institution = user?.institution_name || user?.organization || user?.company || 'Financial Institution';
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FI';
  const isDemo = applications.some((application) => application.demo);
  const pageTitles = {
    overview: ['Smart Loan Hub', 'Manage agricultural finance workflows without implying live loan, balance, or payment services.'],
    applications: ['Loan Applications', 'Review incoming application records and document human follow-ups.'],
    portfolio: ['Capital Overview', 'Review requested amounts in local workflow records, not escrow balances.'],
    disbursements: ['Disbursement Queue', 'Track application hand-offs locally. Nothing on this page authorizes or sends a payment.'],
    vendors: ['Vendor Records', 'Vendor onboarding and verification are not connected to this workspace.'],
    repayments: ['Payout History', 'Illustrative payout examples only. No payment system or bank ledger is connected.'],
    audit: ['Local Audit Log', 'Browser-local workflow activity. This is not an immutable or institution-synced audit trail.'],
    risk: ['Risk Reviews', 'Record human follow-ups without automated borrower risk scores or credit decisions.'],
    transactions: ['Transactions', 'Review transaction records and reconciliation notes.'],
    soil: ['Soil Analytics', 'Explore illustrative field indicators attached to the demo portfolio.'],
    maps: ['Field Maps', 'Browse regional coverage at an aggregate level.'],
    settings: ['Workspace Settings', 'Manage local display preferences for this lender workspace.'],
  };

  useEffect(() => {
    setWorkspace(readWorkspace(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || workspace.error) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        format: 'agrinest-lender-workspace',
        version: 1,
        applications: workspace.applications,
      }));
    } catch (error) {
      console.error('Lender workspace data could not be saved:', error);
      setWorkspace((current) => ({ ...current, error: 'Could not save lender workspace records in this browser. Check available storage.' }));
    }
  }, [storageKey, workspace.applications, workspace.error]);

  const updateApplication = (id, status, note) => {
    const update = { id: makeId('NOTE'), status, note, date: today() };
    setWorkspace((current) => ({
      ...current,
      applications: current.applications.map((application) => application.id === id
        ? { ...application, status, updates: [update, ...application.updates] }
        : application),
    }));
    setSelectedId('');
    setNotice('Human review update saved to this lender workspace on this browser.');
  };

  const createTrade = (event) => {
    event.preventDefault();
    const amount = Number(newTrade.amount);
    if (!newTrade.farmerRef.trim() || !newTrade.region.trim() || !newTrade.purpose.trim()
      || !Number.isSafeInteger(amount) || amount <= 0) {
      setNotice('Enter a borrower reference, region, purpose and whole-number amount.');
      return;
    }
    const application = {
      id: makeId('LOCAL'),
      farmerRef: newTrade.farmerRef.trim(),
      crop: newTrade.crop,
      amount,
      term: Number(newTrade.term),
      region: newTrade.region.trim(),
      status: 'In review',
      date: today(),
      purpose: newTrade.purpose.trim(),
      demo: false,
      updates: [],
    };
    setWorkspace((current) => ({ ...current, applications: [application, ...current.applications] }));
    setShowNewTrade(false);
    setNewTrade({ farmerRef: '', crop: 'Maize', amount: '', term: '6', region: '', purpose: '' });
    setActivePage('disbursements');
    setStatusFilter('All statuses');
    setSearch('');
    setNotice('Local workflow record created. No loan was approved or funds transferred.');
  };

  const handleExportApplications = () => {
    try {
      downloadCsv('agrinest-lender-application-register.csv', [
        ['application_id', 'borrower_reference', 'crop', 'amount_tzs', 'term_months', 'region', 'purpose', 'workflow_status', 'received_date', 'record_type'],
        ...visibleApplications.map((application) => [
          application.id, application.farmerRef, application.crop, application.amount,
          application.term, application.region, application.purpose, application.status,
          application.date, application.demo ? 'illustrative_demo' : 'local_workspace_record',
        ]),
      ]);
      setNotice('Application register exported as CSV.');
    } catch (error) {
      console.error('Lender application export failed:', error);
      setNotice('Could not export the application register in this browser.');
    }
  };

  const clearDemoData = () => {
    if (!window.confirm('Remove illustrative examples and local workflow records from this browser?')) return;
    try {
      window.localStorage.removeItem(storageKey);
      setWorkspace({ applications: [], error: '' });
      setNotice('Illustrative examples and local records were cleared from this browser.');
    } catch (error) {
      console.error('Lender workspace data could not be cleared:', error);
      setWorkspace((current) => ({ ...current, error: 'Could not clear lender workspace data from this browser.' }));
    }
  };

  const openPage = (page) => {
    setActivePage(page);
    setMenuOpen(false);
    setNotice('');
  };

  const openFinancingTemplate = (template) => {
    setNewTrade({
      farmerRef: '',
      crop: template.crop,
      amount: '',
      term: template.term,
      region: '',
      purpose: template.purpose,
    });
    setShowNewTrade(true);
  };

  const currentPageTitle = pageTitles[activePage] || pageTitles.overview;

  return (
    <div className="lender-dashboard">
      <aside className={menuOpen ? 'lender-sidebar open' : 'lender-sidebar'}>
        <div className="lender-brand"><span className="lender-brand-mark">AN</span><span><strong>Agri-NEST</strong><small>Lender Workspace</small></span></div>
        <div className="lender-profile">
          <span className="lender-avatar">{initials}</span>
          <span><strong>{userName}</strong><small>{institution}{persona?.label ? ` · ${persona.label}` : ''}</small></span>
        </div>
        <button type="button" className="lender-new-trade" onClick={() => { setShowNewTrade(true); setMenuOpen(false); }}><span className="material-symbols-outlined">add</span>New Request Record</button>
        <nav className="lender-navigation" aria-label="Lender workspace">
          {navigation.map((item) => (
            <button type="button" key={item.id} className={activePage === item.id ? 'active' : ''} aria-current={activePage === item.id ? 'page' : undefined} onClick={() => openPage(item.id)}>
              <span className="material-symbols-outlined">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="lender-sidebar-footer">
          <button type="button" onClick={() => setNotice('Support: contact your AGRI-NEST account administrator for lender access assistance.')}><span className="material-symbols-outlined">help</span>Support</button>
          <button type="button" onClick={onLogout}><span className="material-symbols-outlined">logout</span>Logout</button>
        </div>
      </aside>

      {menuOpen && <button type="button" className="lender-mobile-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <div className="lender-main-shell">
        <header className="lender-topbar">
          <button type="button" className="lender-menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span className="material-symbols-outlined">menu</span></button>
          <div className="lender-topbar-brand"><strong>Agri-NEST</strong><span>Lender Workspace</span></div>
          <label className="lender-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setActivePage('applications'); }} placeholder="Search applications" aria-label="Search lender applications" /></label>
          <button type="button" className="lender-icon-button" aria-label="Notifications" onClick={() => openPage('applications')}><span className="material-symbols-outlined">notifications</span>{applicationCounts.Submitted > 0 && <span className="lender-notification-dot" />}</button>
          <button type="button" className="lender-topbar-avatar" aria-label={`Signed in as ${userName}`}>{initials}</button>
        </header>

        <main className="lender-content">
          <header className="lender-page-heading">
            <div><span className="lender-eyebrow">{institution.toUpperCase()} · LENDER WORKSPACE</span><h1>{currentPageTitle[0]}</h1><p>{currentPageTitle[1]}</p></div>
            <span className="lender-date">{todayLabel}</span>
          </header>

          {(workspace.error || !storageKey) && (
            <div className="lender-alert" role="alert"><span className="material-symbols-outlined">warning</span><div><strong>Local workspace storage needs attention</strong><p>{workspace.error}</p>{storageKey && <button type="button" onClick={clearDemoData}>Clear workspace data</button>}</div></div>
          )}
          {notice && <div className="lender-notice" role="status"><span className="material-symbols-outlined">info</span><p>{notice}</p><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
          {isDemo && <div className="lender-demo-banner" role="note"><span className="material-symbols-outlined">science</span><span><strong>Illustrative demo portfolio</strong> The sample records and initial metrics on this page are fictional examples stored in this browser, not real borrower data or connected bank records.</span><button type="button" onClick={clearDemoData}>Clear examples</button></div>}

          {activePage === 'overview' && (
            <>
              <div className="lender-loan-hub">
                <section className="lender-loan-summary-grid" aria-label="Loan workflow summary">
                  <article className="lender-card lender-loan-evidence">
                    <div className="lender-loan-card-heading"><div><span className="lender-eyebrow">HUMAN REVIEW WORKFLOW</span><h2>Review coverage</h2></div><span className="material-symbols-outlined" title="Not a borrower credit score">info</span></div>
                    <div className="lender-review-ring" style={{ '--review-coverage': `${reviewCoverage}%` }} role="img" aria-label={`${reviewCoverage}% of local workflow records are marked decision recorded or closed`}>
                      <div><strong>{reviewCoverage}%</strong><span>review records</span></div>
                    </div>
                    <p className="lender-review-ring-caption">{resolvedApplications.length} of {applications.length} local records marked decision recorded or closed</p>
                    <div className="lender-loan-evidence-stats">
                      <div><span>Open review records</span><strong>{activeApplications.length}</strong></div>
                      <div><span>Credit scoring</span><strong>Not connected</strong></div>
                    </div>
                    <p className="lender-loan-disclaimer">Workflow coverage is not an Agri-Trust Score, credit score, sustainability rating, or eligibility assessment.</p>
                  </article>

                  <article className="lender-card lender-loan-balance">
                    <div className="lender-loan-card-heading"><div><span className="lender-eyebrow">LOCAL APPLICATION REGISTER</span><h2>Amount in open requests</h2></div><span className="lender-status lender-status-in-review">REQUESTED</span></div>
                    <div className="lender-loan-balance-value"><strong>{formatTzs(activeCapital)}</strong><span>requested · not a loan balance</span></div>
                    <div className="lender-loan-progress-heading"><span>Workflow records with a closed decision</span><strong>{reviewCoverage}%</strong></div>
                    <div className="lender-loan-progress" role="img" aria-label={`Review workflow coverage ${reviewCoverage}%`}><span style={{ width: `${reviewCoverage}%` }} /></div>
                    <div className="lender-loan-inline-note"><span className="material-symbols-outlined">info</span><p>Figures reflect {isDemo ? 'illustrative examples and ' : ''}local application records only. No borrower loan balance, repayment schedule, or lender account is connected.</p></div>
                    <div className="lender-loan-balance-actions">
                      <button type="button" className="lender-primary-button" onClick={() => setShowNewTrade(true)}>New request record</button>
                      <button type="button" className="lender-secondary-button" onClick={() => openPage('applications')}>Review applications</button>
                    </div>
                  </article>
                </section>

                <section className="lender-loan-detail-grid">
                  <article className="lender-card lender-loan-timeline">
                    <div className="lender-section-heading"><div><span className="lender-eyebrow">LOCAL WORKSPACE ACTIVITY</span><h2>Recent review timeline</h2></div><button type="button" onClick={() => openPage('audit')}>Audit log<span className="material-symbols-outlined">arrow_forward</span></button></div>
                    {auditEntries.length ? (
                      <ol>{auditEntries.slice(0, 4).map((entry) => (
                        <li key={entry.id}>
                          <span className="lender-timeline-marker"><span className="material-symbols-outlined">{entry.action.includes('updated') ? 'check' : 'radio_button_unchecked'}</span></span>
                          <div><small>{entry.date} · {entry.demo ? 'Illustrative example' : 'Local record'}</small><strong>{entry.action}</strong><p>{entry.applicationId} · {entry.detail}</p></div>
                        </li>
                      ))}</ol>
                    ) : <div className="lender-empty"><span className="material-symbols-outlined">history</span><strong>No review activity yet</strong><p>Local application records and manual review notes will appear here.</p></div>}
                    <p className="lender-loan-disclaimer">This editable browser activity is not a payment history, immutable audit, or synced lender record.</p>
                  </article>

                  <section className="lender-loan-templates" aria-labelledby="lender-template-heading">
                    <div className="lender-section-heading"><div><span className="lender-eyebrow">REQUEST WORKFLOW</span><h2 id="lender-template-heading">Financing request templates</h2><p>Example categories to start a local review record—not live offers or approved products.</p></div><button type="button" onClick={() => openPage('applications')}>View applications<span className="material-symbols-outlined">arrow_forward</span></button></div>
                    <div className="lender-loan-template-list">
                      {financingTemplates.map((template, index) => (
                        <article className={`lender-card lender-loan-template lender-loan-template-${index + 1}`} key={template.id}>
                          <span className="lender-template-art" aria-hidden="true"><span className="material-symbols-outlined">{template.icon}</span></span>
                          <div className="lender-template-content"><span className="lender-template-category">{template.category} · Example template</span><h3>{template.title}</h3><p>{template.description}</p></div>
                          <button type="button" className="lender-primary-button" onClick={() => openFinancingTemplate(template)}>Use template</button>
                        </article>
                      ))}
                    </div>
                    <div className="lender-model-note"><span className="material-symbols-outlined">info</span><p>No live financing offers, APRs, eligibility decisions, or repayments are connected. Using a template only opens a form to create a local record for human review.</p></div>
                  </section>
                </section>
              </div>
            </>
          )}

          {activePage === 'disbursements' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading lender-list-heading"><div><span className="lender-eyebrow">APPLICATION HAND-OFF QUEUE</span><h2>Disbursement request records</h2><p>These are application workflow records, not approved disbursements. No escrow account, payment rail, or funds-release service is connected.</p></div><button type="button" className="lender-outline-button" onClick={() => setShowNewTrade(true)}><span className="material-symbols-outlined">add</span>New request record</button></div>
              {applications.length ? <div className="lender-table-scroll"><table className="lender-table lender-applications-table"><thead><tr><th>Request ref.</th><th>Borrower ref.</th><th>Purpose</th><th>Requested amount</th><th>Workflow status</th><th>Received</th><th>Record type</th><th /></tr></thead><tbody>{applications.map((application) => <tr key={application.id}><td><strong>{application.id}</strong></td><td>{application.farmerRef}</td><td>{application.purpose}</td><td>{formatTzs(application.amount)}</td><td><StatusBadge status={application.status} /></td><td>{application.date}</td><td>{application.demo ? 'Illustrative' : 'Local'}</td><td><button type="button" className="lender-row-action" onClick={() => setSelectedId(application.id)}>Open record</button></td></tr>)}</tbody></table></div> : <div className="lender-empty"><span className="material-symbols-outlined">outbox</span><strong>No request records yet</strong><p>New records remain in this browser and do not initiate a payment.</p><button type="button" onClick={() => setShowNewTrade(true)}>Create a request record</button></div>}
              <div className="lender-model-note"><span className="material-symbols-outlined">info</span><p>A recorded workflow status is not a credit decision or authorization to release funds. Confirm all decisions and payments through your institution's verified systems.</p></div>
            </section>
          )}

          {activePage === 'vendors' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">VENDOR DIRECTORY</span><h2>Vendor records</h2><p>No vendor records are currently available in this lender workspace.</p></div></div>
              <div className="lender-integration-state"><span className="material-symbols-outlined">storefront</span><div><strong>Vendor onboarding and verification are not connected</strong><p>There is no vendor directory, verification provider, or evidence source configured here. Vendor status cannot be verified or represented as approved.</p></div></div>
            </section>
          )}

          {activePage === 'audit' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">BROWSER-LOCAL ACTIVITY</span><h2>Workflow audit log</h2><p>Activity is reconstructed from records stored in this browser. It is not immutable, institution-synced, or a compliance audit trail.</p></div></div>
              {auditEntries.length ? <div className="lender-table-scroll"><table className="lender-table"><thead><tr><th>Date</th><th>Record</th><th>Activity</th><th>Details</th><th>Type</th></tr></thead><tbody>{auditEntries.map((entry) => <tr key={entry.id}><td>{entry.date}</td><td><strong>{entry.applicationId}</strong></td><td>{entry.action}</td><td>{entry.detail}</td><td>{entry.demo ? 'Illustrative' : 'Local'}</td></tr>)}</tbody></table></div> : <div className="lender-empty"><span className="material-symbols-outlined">history</span><strong>No activity records yet</strong><p>Local application records and review notes will appear here.</p></div>}
            </section>
          )}

          {activePage === 'applications' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading lender-list-heading"><div><span className="lender-eyebrow">APPLICATION REGISTER</span><h2>Applications and review follow-ups</h2><p>Human workflow tracking only. No credit decision or borrower data connection is active.</p></div><button type="button" className="lender-outline-button" onClick={handleExportApplications}><span className="material-symbols-outlined">download</span>Export CSV</button></div>
              <div className="lender-list-controls"><label>Filter by status<select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><span>{visibleApplications.length} record{visibleApplications.length === 1 ? '' : 's'}</span></div>
              {visibleApplications.length ? <div className="lender-table-scroll"><table className="lender-table lender-applications-table"><thead><tr><th>Reference</th><th>Borrower ref.</th><th>Crop / enterprise</th><th>Amount</th><th>Term</th><th>Region</th><th>Received</th><th>Status</th><th /></tr></thead><tbody>{visibleApplications.map((application) => <tr key={application.id}><td><strong>{application.id}</strong>{application.demo && <small>Demo example</small>}</td><td>{application.farmerRef}</td><td>{application.crop}</td><td>{formatTzs(application.amount)}</td><td>{application.term} mo</td><td>{application.region}</td><td>{application.date}</td><td><StatusBadge status={application.status} /></td><td><button type="button" className="lender-row-action" onClick={() => setSelectedId(application.id)}>Review</button></td></tr>)}</tbody></table></div> : <div className="lender-empty"><span className="material-symbols-outlined">search_off</span><strong>No matching applications</strong><p>Adjust your search or status filter, or create a local workflow record.</p><button type="button" onClick={() => { setSearch(''); setStatusFilter('All statuses'); }}>Clear filters</button></div>}
            </section>
          )}

          {activePage === 'portfolio' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">LOCAL WORKFLOW SUMMARY</span><h2>Capital overview</h2><p>Summaries reflect application records only. They are not escrow balances, approved capital, or funds disbursed.</p></div></div>
              <div className="lender-soil-grid">{[
                ['Open application value', formatTzs(activeCapital), `${activeApplications.length} open workflow records`, 'account_balance'],
                ['Submitted', String(applicationCounts.Submitted || 0), 'Awaiting initial human review', 'assignment'],
                ['In review', String(applicationCounts['In review'] || 0), 'Manual review status', 'manage_search'],
                ['Info requested', String(applicationCounts['Info requested'] || 0), 'Manual follow-up status', 'mark_email_unread'],
              ].map(([label, value, helper, icon]) => <article key={label}><span className="material-symbols-outlined">{icon}</span><small>{label}</small><strong>{value}</strong><p>{helper}</p></article>)}</div>
              <div className="lender-model-note"><span className="material-symbols-outlined">info</span><p>Do not treat these workflow sums as approved or disbursed funds. Actual credit decisions, capital balances, and servicing must come from verified institutional systems.</p></div>
            </section>
          )}

          {activePage === 'repayments' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">PAYOUT HISTORY · ILLUSTRATIVE</span><h2>Example payout records</h2><p>No live payout history is available because a payment system and bank ledger are not connected.</p></div><button type="button" className="lender-outline-button" onClick={() => { try { downloadCsv('agrinest-lender-payout-examples.csv', [['example_id', 'application_id', 'example_date', 'example_amount_tzs', 'example_status'], ...demoRepayments.map((entry) => [entry.id, entry.applicationId, entry.date, entry.amount, entry.status])]); setNotice('Illustrative payout examples exported.'); } catch (error) { console.error('Payout example export failed:', error); setNotice('Could not export payout examples.'); } }}><span className="material-symbols-outlined">download</span>Export examples</button></div>
              <div className="lender-demo-inline">These fictional rows are for interface demonstration only. They are not real payouts, payment instructions, or reconciled transactions.</div>
              <div className="lender-table-scroll"><table className="lender-table"><thead><tr><th>Example ref.</th><th>Application ref.</th><th>Example date</th><th>Example amount</th><th>Example status</th></tr></thead><tbody>{demoRepayments.map((entry) => <tr key={entry.id}><td><strong>{entry.id}</strong></td><td>{entry.applicationId}</td><td>{entry.date}</td><td>{formatTzs(entry.amount)}</td><td><StatusBadge status={entry.status === 'Recorded' ? 'Decision recorded' : 'Info requested'} /></td></tr>)}</tbody></table></div>
              <div className="lender-model-note"><span className="material-symbols-outlined">account_balance</span><p>Exporting these examples does not contact a bank, debit or credit an account, or reconcile a real borrower balance.</p></div>
            </section>
          )}

          {activePage === 'risk' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">HUMAN FOLLOW-UP QUEUE</span><h2>Risk review tasks</h2><p>Tasks are surfaced from the manual “Info requested” workflow status, not from an automated risk model.</p></div></div>
              <div className="lender-model-note"><span className="material-symbols-outlined">policy</span><p>No individual risk scores, approval recommendations, or eligibility judgments are generated here. Reviewers should use institution policy, verified records, and appropriate borrower consent.</p></div>
              {applications.filter((application) => application.status === 'Info requested').length ? (
                <div className="lender-table-scroll"><table className="lender-table"><thead><tr><th>Reference</th><th>Borrower reference</th><th>Purpose</th><th>Region</th><th>Follow-up</th><th /></tr></thead><tbody>{applications.filter((application) => application.status === 'Info requested').map((application) => <tr key={application.id}><td><strong>{application.id}</strong>{application.demo && <small>Demo example</small>}</td><td>{application.farmerRef}</td><td>{application.purpose}</td><td>{application.region}</td><td><StatusBadge status="Info requested" /></td><td><button type="button" className="lender-row-action" onClick={() => setSelectedId(application.id)}>Record review</button></td></tr>)}</tbody></table></div>
              ) : <div className="lender-empty"><span className="material-symbols-outlined">task_alt</span><strong>No manual follow-ups queued</strong><p>Applications enter this list only when a human reviewer records “Info requested”.</p></div>}
            </section>
          )}

          {activePage === 'transactions' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading lender-list-heading"><div><span className="lender-eyebrow">RECONCILIATION REGISTER</span><h2>Transaction records</h2><p>Example activity only. No payment processor or bank ledger is connected.</p></div><button type="button" className="lender-outline-button" onClick={() => { try { downloadCsv('agrinest-lender-transaction-register.csv', [['transaction_id', 'application_id', 'date', 'amount_tzs', 'status'], ...demoRepayments.map((entry) => [entry.id, entry.applicationId, entry.date, entry.amount, entry.status])]); setNotice('Illustrative transaction register exported.'); } catch (error) { console.error('Transaction register export failed:', error); setNotice('Could not export the transaction register.'); } }}><span className="material-symbols-outlined">download</span>Export CSV</button></div>
              <div className="lender-demo-inline">Illustrative transaction records are static examples and do not represent actual payments.</div>
              <div className="lender-table-scroll"><table className="lender-table"><thead><tr><th>Transaction ref.</th><th>Application ref.</th><th>Recorded date</th><th>Amount</th><th>Reconciliation status</th></tr></thead><tbody>{demoRepayments.map((entry) => <tr key={entry.id}><td><strong>{entry.id}</strong></td><td>{entry.applicationId}</td><td>{entry.date}</td><td>{formatTzs(entry.amount)}</td><td><StatusBadge status={entry.status === 'Recorded' ? 'Decision recorded' : 'Info requested'} /></td></tr>)}</tbody></table></div>
            </section>
          )}

          {activePage === 'soil' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">AGRONOMIC CONTEXT · DEMO</span><h2>Soil analytics</h2><p>Example regional context for discussion. No actual soil sampling, field sensor, or satellite data is connected.</p></div></div>
              <div className="lender-soil-grid">{[
                ['Soil moisture', '62%', 'Illustrative seasonal index', 'water_drop'],
                ['Organic matter', '3.1%', 'Example regional reference', 'compost'],
                ['Soil pH', '6.4', 'Example regional reference', 'science'],
                ['Field conditions', 'Seasonal', 'Verify with local agronomists', 'agriculture'],
              ].map(([label, value, helper, icon]) => <article key={label}><span className="material-symbols-outlined">{icon}</span><small>{label}</small><strong>{value}</strong><p>{helper}</p></article>)}</div>
              <div className="lender-model-note"><span className="material-symbols-outlined">info</span><p>These indicators are illustrative placeholders only, not measurements or farmer-specific information. Use verified agronomic sources and borrower consent before including environmental data in a human review.</p></div>
            </section>
          )}

          {activePage === 'maps' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">REGIONAL COVERAGE · AGGREGATED</span><h2>Field maps</h2><p>Application counts by entered region. This screen does not contain precise farmer coordinates.</p></div></div>
              <div className="lender-region-map">
                <div className="lender-map-illustration" aria-label="Stylized illustration of regional coverage, not a geographic map" role="img"><span className="lender-map-label label-iringa">Iringa</span><span className="lender-map-label label-mbeya">Mbeya</span><span className="lender-map-label label-dodoma">Dodoma</span><span className="lender-map-label label-morogoro">Morogoro</span><span className="lender-map-point point-1" /><span className="lender-map-point point-2" /><span className="lender-map-point point-3" /><span className="lender-map-point point-4" /><div className="lender-map-disclaimer">Illustrative regional diagram · not to scale</div></div>
                <div className="lender-region-list"><h3>Portfolio by region</h3>{Object.entries(regionCounts).length ? Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).map(([region, count]) => <div key={region}><span><i />{region}</span><strong>{count} record{count === 1 ? '' : 's'}</strong></div>) : <p>No regional application records are available.</p>}<small>Region comes from local workflow records and may be unverified.</small></div>
              </div>
            </section>
          )}

          {activePage === 'settings' && (
            <section className="lender-card lender-full-card">
              <div className="lender-section-heading"><div><span className="lender-eyebrow">ACCOUNT CONTEXT</span><h2>Workspace settings</h2><p>Identity and access are managed by AGRI-NEST authentication and your institution administrator.</p></div></div>
              <div className="lender-settings-list"><div><span>Institution account</span><strong>{institution}</strong></div><div><span>Signed-in account</span><strong>{user?.email || user?.phone || userName}</strong></div><div><span>Access role</span><strong>{persona?.label || 'Financial Institution'}</strong></div><div><span>Regional format</span><strong>Tanzania · TZS</strong></div><div><span>Record storage</span><strong>This browser · account-scoped</strong></div></div>
              <div className="lender-model-note"><span className="material-symbols-outlined">security</span><p>Only authorized institutional users should access lender workspaces. This demo stores records locally and does not provide production role audit, encryption-at-rest guarantees, or inter-institution data isolation.</p></div>
              <button type="button" className="lender-secondary-button" onClick={onLogout}>Sign out of lender workspace</button>
            </section>
          )}
        </main>
      </div>

      {showNewTrade && (
        <div className="lender-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewTrade(false); }}>
          <section className="lender-modal lender-new-trade-modal" role="dialog" aria-modal="true" aria-labelledby="lender-new-trade-title">
            <div className="lender-modal-header"><div><span className="lender-eyebrow">LOCAL WORKFLOW ONLY</span><h2 id="lender-new-trade-title">New request record</h2></div><button type="button" className="lender-icon-button" aria-label="Close new request form" onClick={() => setShowNewTrade(false)}><span className="material-symbols-outlined">close</span></button></div>
            <p className="lender-demo-inline">Create an application record for human review. This does not approve a loan, create an escrow balance, or move money.</p>
            <form className="lender-new-trade-form" onSubmit={createTrade}>
              <label>Borrower reference<input required maxLength={60} value={newTrade.farmerRef} onChange={(event) => setNewTrade((current) => ({ ...current, farmerRef: event.target.value }))} placeholder="Use a permitted internal reference" /></label>
              <label>Crop / enterprise<select value={newTrade.crop} onChange={(event) => setNewTrade((current) => ({ ...current, crop: event.target.value }))}>{['Maize', 'Beans', 'Sunflower', 'Poultry', 'Other'].map((crop) => <option key={crop}>{crop}</option>)}</select></label>
              <label>Requested amount (TZS)<input required type="number" min="1" max="1000000000" step="1" value={newTrade.amount} onChange={(event) => setNewTrade((current) => ({ ...current, amount: event.target.value }))} /></label>
              <label>Requested term<select value={newTrade.term} onChange={(event) => setNewTrade((current) => ({ ...current, term: event.target.value }))}>{[3, 6, 9, 12, 18, 24].map((term) => <option key={term} value={term}>{term} months</option>)}</select></label>
              <label>Region<input required maxLength={80} value={newTrade.region} onChange={(event) => setNewTrade((current) => ({ ...current, region: event.target.value }))} placeholder="Region" /></label>
              <label>Purpose<input required maxLength={120} value={newTrade.purpose} onChange={(event) => setNewTrade((current) => ({ ...current, purpose: event.target.value }))} placeholder="Purpose of the application" /></label>
              <div className="lender-model-note lender-new-trade-note"><span className="material-symbols-outlined">lock</span><p>Avoid entering national ID numbers, account credentials, or unnecessary personal data. Store only references authorized by your institution.</p></div>
              <div className="lender-modal-actions"><button type="button" className="lender-secondary-button" onClick={() => setShowNewTrade(false)}>Cancel</button><button type="submit" className="lender-primary-button">Create local record</button></div>
            </form>
          </section>
        </div>
      )}

      <LenderModal application={selectedApplication} onClose={() => setSelectedId('')} onSave={updateApplication} />
    </div>
  );
}
