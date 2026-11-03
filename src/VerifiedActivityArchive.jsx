import { useEffect, useMemo, useState } from 'react';
import './VerifiedActivityArchive.css';

const sampleLogs = [
  {
    id: 'LOG-88219',
    activity: 'Spraying',
    field: 'Field 04-B: Organic Soy',
    date: '2023-10-24',
    time: '09:42 AM',
    latitude: '41.8781° N, 87.6298° W',
    weather: '22°C Clear',
    verification: 'Sample verified',
    verificationNote: 'Illustrative cross-check',
    captureImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBX9DtLk0iGcAEHMsKEuSIh2RZGAdRCkFlJv4ykeEq4kzSqDrfa_PNNcXwaavsovggT5j50jBZfbRTZUQMtXXDiNt5OjMtf6XuzsfI_-PsKB2saDoLaBgcY-zij46niCORAPE9tyH_VAFtLjYiAi8wNGotQUoOQKJGHyO-vFsU30N1c-qYo46we0eaqePh2ZfkDtWdqhQ7OVth-sAkZUPvT_KvrajT_Urch9IW0z49HcyOVIvpBgYp0qd2T51u3OReyosc1OcuWsWg',
    satelliteImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD27cXrHxGDgvxFpB6soN6fJNG3hZNTrbpfE7COUImazQq0x7mI0mXoF-R7kFD4gQrVAy-QHloMSLspdbpm5u2OM5qBeTFbftS7oA5MmiJTXn1BhOKYOOFw2369hxKiyMtpcFJ0TS2S9RWk585NEZN-DdMRg2-HW4A4nPYsRYjSIq5EXQH9YlYEik0WIHUptgHywf1dSaRRyvhClyC__782Rjyhmi6qxSONrSshV4sZFeDqLKsSQPGbqeztWmaJmATMAjskS1zJ3FM',
  },
  {
    id: 'LOG-88214',
    activity: 'Harvesting',
    field: 'North Sector: Winter Wheat',
    date: '2023-10-22',
    time: '04:15 PM',
    latitude: '40.8136° N, 96.7026° W',
    weather: '18°C Sunny',
    verification: 'Sample verified',
    verificationNote: 'Illustrative yield match',
    captureImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnxD-uuTa9UnBvhOOxOjr-fa2F-BZwGtJDvKMLHQsMIjppIG6ElQxD6poONFydLrEMCLJZHQPE5qPOsF6D6tmiT3Js9GlnWC4R3_uup0o8vPD-vyw4LUPWC5LLVB6vbERdCNEauzogGHZy2-1_vQpNJ0-yEUtqpNM9atajt3Fyf_UgCQYpCXiKXPUh2TQbI7ZeTPmvwJez1uyBbBy_nI78u6mn7nGL1IidCq7huAxJ19WRWJyeonisC7GkSwYZ1u6O5MJwElQcH7k',
    satelliteImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPuoS3mk0428n548Aa-TRwJ1nhta_dgVOfXAmJ6JRjsoJzJjZeLLNiQg_SJRgXpQ-n2BHOmepdZk_KNMpXPHXKT34gkgHD7Rd-McCVscfNE09yTW2_x_jnPB_o-6TVLzoWpxSJ7OLOtMEMSjroMF5zXLrQXDgfrbPX5yzOe-fmEd5Z7DrjqLD1pbeNhdVehs2Cf2ju8PQmZbOsQLISJvd4Pe2rr4pYIXcy1hBNnVEwX2cJJwm4rTamymsRLBglp_knRuo8uFp_cWI',
  },
  {
    id: 'LOG-88210',
    activity: 'Irrigation',
    field: 'West Ridge: Corn',
    date: '2023-10-20',
    time: '11:30 PM',
    latitude: '39.0119° N, 98.4842° W',
    weather: '',
    verification: 'In review',
    verificationNote: 'Awaiting image upload',
    captureImage: '',
    satelliteImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAthwW_tUEHRVvkbAb49ku2rDEqa81kCXGH5Ij_UE6lqY2mh1Eq6A-isQ5aag2V39IEfQ_owi0agXVTf2ONEd0nHABaymebmJ6b9UgUKM4PfKtMZRcTbBN0qQ9wxidOeY4Pl4hjldXL61tUN4F4wUGMhoXsTQwrJKFEVrhrHByYJld36i96AZ1U3uuyznqIsr4jQTo72_6fMbpWwEEsB5pMbHzIYTntBTRAZ5SMQqBcjJ9zx2AEM6cCNJ5z-G8c26jp829dbLwsgzk',
  },
];

const activityTypes = ['All Activities', 'Spraying', 'Harvesting', 'Irrigation', 'Fertilizing'];

function readArchiveState(userId) {
  try {
    const stored = window.localStorage.getItem(`agrinest-activity-archive:${userId || 'institutional'}`);
    if (!stored) return { logs: sampleLogs, error: '' };
    const logs = JSON.parse(stored);
    if (Array.isArray(logs) && logs.every((log) => (
      log
      && typeof log.id === 'string'
      && typeof log.activity === 'string'
      && typeof log.field === 'string'
      && typeof log.date === 'string'
    ))) return { logs, error: '' };
    throw new Error('Saved archive data is not a valid list of entries.');
  } catch (error) {
    console.error('Could not read the activity archive from this browser:', error.message);
    return { logs: sampleLogs, error: 'Saved archive data could not be read. Showing sample records.' };
  }
}

function formatLogDate(date) {
  if (!date) return 'Date not provided';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function csvCell(value) {
  const text = String(value || '');
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function getLocalDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function ArchiveImage({ src, alt, label, satellite = false }) {
  return (
    <div className={`archive-image ${satellite ? 'satellite' : ''}`}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : <span className="material-symbols-outlined" aria-hidden="true">image_not_supported</span>}
      <span className="archive-image-label">{label}</span>
    </div>
  );
}

function ArchiveDialog({ title, onClose, children }) {
  return (
    <div className="archive-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-dialog-title">
        <header>
          <h2 id="archive-dialog-title">{title}</h2>
          <button type="button" className="archive-icon-button" aria-label="Close dialog" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function VerifiedActivityArchive({ user, onLogout, onNavigate }) {
  const [archiveState, setArchiveState] = useState(() => readArchiveState(user?.user_id));
  const { logs } = archiveState;
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('All Activities');
  const [dateFilter, setDateFilter] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('All statuses');
  const [selectedLog, setSelectedLog] = useState(null);
  const [entryDraft, setEntryDraft] = useState(null);
  const [entryNote, setEntryNote] = useState('');
  const [toast, setToast] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('verified-archive-active');
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('verified-archive-active');
  }, []);

  const visibleLogs = useMemo(() => logs.filter((log) => {
    const searchText = `${log.id} ${log.activity} ${log.field} ${log.latitude} ${log.verificationNote}`.toLowerCase();
    return (!search || searchText.includes(search.toLowerCase()))
      && (activityFilter === 'All Activities' || log.activity === activityFilter)
      && (!dateFilter || log.date === dateFilter)
      && (reviewFilter === 'All statuses' || log.verification === reviewFilter);
  }), [activityFilter, dateFilter, logs, reviewFilter, search]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 4000);
  };

  const saveLogs = (nextLogs) => {
    try {
      window.localStorage.setItem(`agrinest-activity-archive:${user?.user_id || 'institutional'}`, JSON.stringify(nextLogs));
      setArchiveState({ logs: nextLogs, error: '' });
    } catch (error) {
      console.error('Could not save the activity archive locally:', error.message);
      setArchiveState({ logs: nextLogs, error: 'This browser could not save the archive. New entries may not persist.' });
      notify('This entry is visible for this session but could not be saved in this browser.');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setActivityFilter('All Activities');
    setDateFilter('');
    setReviewFilter('All statuses');
  };

  const exportArchive = () => {
    const columns = ['ID', 'Activity', 'Field', 'Date', 'Time', 'Location', 'Review status', 'Review note', 'Entry note'];
    const rows = visibleLogs.map((log) => [
      log.id, log.activity, log.field, log.date, log.time, log.latitude, log.verification, log.verificationNote, log.entryNote,
    ]);
    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agrinest-activity-archive-demo.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Demo archive exported as CSV. It is not a signed audit package.');
  };

  const openNewEntry = (log = null) => {
    setIsMobileNavOpen(false);
    setEntryDraft(log ? { ...log } : {
      id: '',
      activity: 'Spraying',
      field: '',
      date: getLocalDate(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latitude: '',
      weather: '',
      verification: 'In review',
      verificationNote: 'Awaiting review',
      captureImage: '',
      satelliteImage: '',
    });
    setEntryNote(log?.entryNote || '');
  };

  const saveEntry = (event) => {
    event.preventDefault();
    const log = {
      ...entryDraft,
      id: entryDraft.id || `LOCAL-${Date.now().toString().slice(-6)}`,
      verification: 'In review',
      verificationNote: entryNote.trim() ? 'Details added locally; awaiting review' : 'Awaiting review',
      entryNote: entryNote.trim(),
    };
    const nextLogs = entryDraft.id
      ? logs.map((current) => current.id === entryDraft.id ? log : current)
      : [log, ...logs];
    saveLogs(nextLogs);
    setEntryDraft(null);
    notify('Entry saved in this browser as a local draft; no evidence was uploaded or verified.');
  };

  const selectNavigation = (destination) => {
    if (destination === 'evidence') return;
    setIsMobileNavOpen(false);
    onNavigate(destination);
  };

  return (
    <div className="verified-archive">
      <header className="archive-topbar">
        <button type="button" className="archive-icon-button archive-mobile-menu" aria-label="Toggle navigation" aria-expanded={isMobileNavOpen} onClick={() => setIsMobileNavOpen((open) => !open)}>
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="archive-brand">AgriVerify</div>
        <label className="archive-global-search">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search archive logs..." aria-label="Search archive logs" />
        </label>
        <div className="archive-top-actions">
          <button type="button" className="archive-icon-button" aria-label="Refresh archive" onClick={() => { resetFilters(); notify('Sample archive refreshed.'); }}>
            <span className="material-symbols-outlined">sync</span>
          </button>
          <button type="button" className="archive-icon-button" aria-label="Notifications" onClick={() => notify('No new archive notifications.')}>
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button type="button" className="archive-icon-button" aria-label="Account" onClick={() => notify(user?.name ? `Signed in as ${user.name}.` : 'Institutional demo account.')}>
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </header>

      <button type="button" className={isMobileNavOpen ? 'archive-mobile-backdrop visible' : 'archive-mobile-backdrop'} aria-label="Close navigation" onClick={() => setIsMobileNavOpen(false)} />
      <aside className={isMobileNavOpen ? 'archive-sidebar mobile-open' : 'archive-sidebar'}>
        <div className="archive-partner">
          <div className="archive-partner-mark"><span className="material-symbols-outlined">agriculture</span></div>
          <div><strong>GreenFields Co.</strong><small>Verified Institutional Partner</small></div>
        </div>
        <nav className="archive-navigation" aria-label="Institutional navigation">
          <button type="button" onClick={() => selectNavigation('dashboard')}><span className="material-symbols-outlined">agriculture</span>Operations</button>
          <button type="button" className="active" aria-current="page"><span className="material-symbols-outlined">verified</span>Evidence</button>
          <button type="button" onClick={() => selectNavigation('reports')}><span className="material-symbols-outlined">analytics</span>Reports</button>
          <button type="button" onClick={() => selectNavigation('settings')}><span className="material-symbols-outlined">settings</span>Settings</button>
        </nav>
        <div className="archive-sidebar-spacer" />
        <button type="button" className="archive-new-entry" onClick={() => openNewEntry()}><span className="material-symbols-outlined">add</span>New Log Entry</button>
        <div className="archive-sidebar-footer">
          <p>DEMO · Sample archive data</p>
          <button type="button" onClick={() => notify('Help Center is not connected in this demo.')}><span className="material-symbols-outlined">help</span>Help Center</button>
          <button type="button" onClick={onLogout}><span className="material-symbols-outlined">logout</span>Logout</button>
        </div>
      </aside>

      <main className="archive-main">
        <div className="archive-page-header">
          <div>
            <h1>Verified Activity Archive</h1>
            <p>A comprehensive historical record of agricultural operations cross-referenced with satellite imagery and field-level metadata for audit compliance.</p>
          </div>
          <div className="archive-header-actions">
            <button type="button" className="archive-button archive-filter-button" onClick={() => setShowMoreFilters((shown) => !shown)} aria-expanded={showMoreFilters}>
              <span className="material-symbols-outlined">filter_list</span>Filter View
            </button>
            <button type="button" className="archive-button archive-export-button" onClick={exportArchive}>
              <span className="material-symbols-outlined">download</span>Export Audit
            </button>
          </div>
        </div>

        <div className="archive-disclaimer" role="note">
          <span className="material-symbols-outlined">info</span>
          <span>          Demo archive: the partner identity, figures, records, images, and review labels are illustrative only. No satellite cross-check, independent verification, or digital signing is connected.{archiveState.error && <strong> {archiveState.error}</strong>}</span>
        </div>

        <div className="archive-content-grid">
          <section className="archive-list-column" aria-label="Activity archive">
            <div className="archive-filters">
              <label>
                <span>Activity Type</span>
                <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
                  {activityTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label>
                <span>Date Range</span>
                <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter by date" />
              </label>
              <button type="button" className="archive-reset-button" aria-label="Reset filters" onClick={resetFilters}><span className="material-symbols-outlined">refresh</span></button>
              {showMoreFilters && <label className="archive-status-filter">
                <span>Review Status</span>
                <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
                  <option>All statuses</option>
                  <option>Sample verified</option>
                  <option>In review</option>
                </select>
              </label>}
            </div>

            <div className="archive-log-list">
              {visibleLogs.map((log) => (
                <article className="archive-log-card" key={log.id}>
                  <div className="archive-log-images">
                    <ArchiveImage src={log.captureImage} alt={`Capture image for ${log.field}`} label={log.captureImage ? 'Capture' : 'Pending'} />
                    <ArchiveImage src={log.satelliteImage} alt={`Illustrative satellite image for ${log.field}`} label="Satellite" satellite />
                  </div>
                  <div className="archive-log-body">
                    <div className="archive-log-heading">
                      <div>
                        <div className="archive-log-meta">
                          <span className={`archive-activity-tag ${log.activity.toLowerCase()}`}>{log.activity}</span>
                          <span>ID: {log.id}</span>
                        </div>
                        <h2>{log.field || 'Untitled field entry'}</h2>
                        <p className="archive-log-date"><span className="material-symbols-outlined">schedule</span>{formatLogDate(log.date)} · {log.time || 'Time not provided'}</p>
                      </div>
                      <div className={`archive-verification ${log.verification === 'In review' ? 'pending' : ''}`}>
                        <strong><span className="material-symbols-outlined">{log.verification === 'In review' ? 'pending' : 'verified_user'}</span>{log.verification === 'In review' ? 'In-Review' : '100% Verified'}</strong>
                        <small>{log.verificationNote}</small>
                      </div>
                    </div>
                    <div className="archive-log-footer">
                      <div className="archive-log-context">
                        {log.latitude && <span><span className="material-symbols-outlined">location_on</span>{log.latitude}</span>}
                        {log.weather && <span><span className="material-symbols-outlined">device_thermostat</span>{log.weather}</span>}
                      </div>
                      {log.verification === 'In review'
                        ? <button type="button" className="archive-text-action" onClick={() => openNewEntry(log)}>Complete Entry <span className="material-symbols-outlined">edit</span></button>
                        : <button type="button" className="archive-text-action" onClick={() => setSelectedLog(log)}>View Report <span className="material-symbols-outlined">arrow_forward</span></button>}
                    </div>
                  </div>
                </article>
              ))}
              {visibleLogs.length === 0 && <div className="archive-empty"><span className="material-symbols-outlined">search_off</span><strong>No archive records match.</strong><button type="button" onClick={resetFilters}>Clear filters</button></div>}
            </div>
          </section>

          <aside className="archive-summary-column">
            <section className="archive-summary-card">
              <h2><span className="material-symbols-outlined">analytics</span>Archive Summary</h2>
              <div className="archive-summary-metric">
                <div><span>Total Verified Logs</span><strong>1,284</strong></div>
                <div className="archive-quota"><span /></div>
                <small>Target quota: 1,400 logs / Q4</small>
              </div>
              <div className="archive-accuracy">
                <div><span>Accuracy Rate</span><strong>99.8%</strong></div>
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div className="archive-review-counts">
                <div><span>Pending</span><strong>12</strong></div>
                <div><span>Rejected</span><strong>0</strong></div>
              </div>
              <small className="archive-sample-caption">Illustrative sample figures; not live measurements.</small>
            </section>

            <section className="archive-inspector-card">
              <h2>Export Inspector Mode</h2>
              <p>Prepare an archive package for regulatory review. Digital signing and independent verification are not connected in this demo.</p>
              <button type="button" onClick={() => notify('Digital signing is not connected. Use Export Audit to download a clearly labeled sample CSV.')}>
                <span className="material-symbols-outlined">verified</span>Sign &amp; Export Archive
              </button>
            </section>

            <section className="archive-map-card">
              <h2><span className="material-symbols-outlined">map</span>Field Distribution</h2>
              <div className="archive-map-illustration" role="img" aria-label="Illustrative map of field plots">
                <div className="archive-map-grid" />
                <div className="archive-map-cluster" />
              </div>
              <div className="archive-map-legend">
                <div><span><i className="high" />High Activity</span><strong>64%</strong></div>
                <div><span><i className="moderate" />Moderate</span><strong>28%</strong></div>
                <div><span><i className="inactive" />Inactive</span><strong>8%</strong></div>
              </div>
              <small className="archive-sample-caption">Illustrative distribution; no live field map is connected.</small>
            </section>
          </aside>
        </div>
      </main>

      {toast && <div className="archive-toast" role="status">{toast}</div>}

      {selectedLog && <ArchiveDialog title="Activity Report" onClose={() => setSelectedLog(null)}>
        <div className="archive-dialog-content">
          <p className="archive-dialog-eyebrow">{selectedLog.id} · {selectedLog.activity}</p>
          <h3>{selectedLog.field}</h3>
          <dl>
            <div><dt>Date</dt><dd>{formatLogDate(selectedLog.date)} · {selectedLog.time}</dd></div>
            <div><dt>Location</dt><dd>{selectedLog.latitude || 'Not provided'}</dd></div>
            <div><dt>Review label</dt><dd>{selectedLog.verificationNote}</dd></div>
            {selectedLog.entryNote && <div><dt>Entry details</dt><dd>{selectedLog.entryNote}</dd></div>}
          </dl>
          <p className="archive-dialog-note">This sample record has not been independently checked or verified by AGRI-NEST.</p>
          <button type="button" className="archive-button archive-export-button" onClick={() => setSelectedLog(null)}>Close Report</button>
        </div>
      </ArchiveDialog>}

      {entryDraft && <ArchiveDialog title={entryDraft.id ? 'Complete Log Entry' : 'New Log Entry'} onClose={() => setEntryDraft(null)}>
        <form className="archive-entry-form" onSubmit={saveEntry}>
          <label>Activity Type
            <select value={entryDraft.activity} onChange={(event) => setEntryDraft((current) => ({ ...current, activity: event.target.value }))}>
              {activityTypes.slice(1).map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Field or Activity
            <input required maxLength={120} value={entryDraft.field} onChange={(event) => setEntryDraft((current) => ({ ...current, field: event.target.value }))} placeholder="e.g. North field: maize" />
          </label>
          <label>Date
            <input required type="date" value={entryDraft.date} onChange={(event) => setEntryDraft((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label>Location
            <input maxLength={120} value={entryDraft.latitude} onChange={(event) => setEntryDraft((current) => ({ ...current, latitude: event.target.value }))} placeholder="Optional location or coordinates" />
          </label>
          <label>Entry Notes
            <textarea maxLength={1000} rows="4" value={entryNote} onChange={(event) => setEntryNote(event.target.value)} placeholder="Add field notes for this local draft" />
          </label>
          <p className="archive-dialog-note">Saved in this browser only. Attachments, satellite review, and verification are not connected.</p>
          <div className="archive-dialog-actions">
            <button type="button" className="archive-button archive-filter-button" onClick={() => setEntryDraft(null)}>Cancel</button>
            <button type="submit" className="archive-button archive-export-button">Save Local Draft</button>
          </div>
        </form>
      </ArchiveDialog>}
    </div>
  );
}
