import { useMemo, useState } from 'react';
import './ExportReadinessWorkspace.css';

const certificationSuggestions = ['GlobalG.A.P.', 'Organic certification', 'Fairtrade'];
const documentFolders = ['Legal Identity', 'Land Titles', 'Export Permits'];

const createId = () => globalThis.crypto?.randomUUID?.() || `compliance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);

function formatDate(value) {
  if (!value) return 'Date not recorded';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Date not recorded' : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function downloadRecord(record) {
  const blob = new Blob([JSON.stringify({
    documentType: 'AGRI-NEST farmer-entered compliance record',
    notice: 'This record is not an official certificate, laboratory report, verified document, or government submission.',
    record,
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `agrinest-compliance-record-${record.id}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RecordForm({ kind, initialTitle = '', folder = '', onClose, onSave }) {
  const [values, setValues] = useState({
    title: initialTitle,
    category: folder || documentFolders[0],
    authority: '',
    reference: '',
    date: today(),
    dueDate: '',
    expiresAt: '',
    result: '',
    market: '',
    details: '',
  });
  const [error, setError] = useState('');
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!values.title.trim()) {
      setError(kind === 'laboratory' ? 'Enter a test or inspection type.' : 'Enter a record title.');
      return;
    }
    onSave({
      id: createId(),
      module: 'compliance',
      entryType: kind,
      title: values.title.trim(),
      category: values.category,
      authority: values.authority.trim(),
      reference: values.reference.trim(),
      date: values.date,
      dueDate: values.dueDate,
      expiresAt: values.expiresAt,
      result: values.result.trim(),
      market: values.market.trim(),
      details: values.details.trim(),
      status: kind === 'export' ? 'Preparation record' : kind === 'certification' ? 'Farmer-entered' : 'Saved',
      createdAt: new Date().toISOString(),
    });
  };

  const heading = {
    certification: 'Add certification record',
    laboratory: 'Add lab or inspection record',
    document: 'Add document record',
    export: 'Prepare an export request record',
    task: 'Add compliance follow-up',
  }[kind];

  return (
    <div className="export-hub-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="export-hub-modal" role="dialog" aria-modal="true" aria-labelledby="export-hub-modal-title">
        <div className="export-hub-modal-heading">
          <div><span className="export-hub-eyebrow">FARMER-ENTERED RECORD</span><h2 id="export-hub-modal-title">{heading}</h2></div>
          <button type="button" className="export-hub-icon-button" aria-label="Close form" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <p className="export-hub-form-notice">Saving here records information in your AGRI-NEST account. It does not submit to or verify with an authority.</p>
        <form onSubmit={submit}>
          <label>{kind === 'laboratory' ? 'Test or inspection type' : kind === 'export' ? 'Produce or certificate request' : kind === 'document' ? 'Document name' : 'Certification name'}
            <input autoFocus required value={values.title} onChange={(event) => update('title', event.target.value)} placeholder={kind === 'laboratory' ? 'e.g. Aflatoxin test' : 'Enter a name'} />
          </label>
          {kind === 'document' && <label>Folder<select value={values.category} onChange={(event) => update('category', event.target.value)}>{documentFolders.map((folderName) => <option key={folderName}>{folderName}</option>)}</select></label>}
          {kind === 'export' && <label>Target market<input value={values.market} onChange={(event) => update('market', event.target.value)} placeholder="e.g. destination country or region" /></label>}
          {(kind === 'certification' || kind === 'laboratory') && <label>Issuing authority or lab<input value={values.authority} onChange={(event) => update('authority', event.target.value)} placeholder="Enter the authority or lab name" /></label>}
          {kind !== 'export' && <label>Reference number (optional)<input value={values.reference} onChange={(event) => update('reference', event.target.value)} /></label>}
          {kind === 'task' && <label>Due date (optional)<input type="date" value={values.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label>}
          {kind !== 'export' && kind !== 'task' && <div className="export-hub-form-row">
            {kind !== 'task' && <label>{kind === 'laboratory' ? 'Test date' : 'Issue or record date'}<input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} /></label>}
            {(kind === 'certification' || kind === 'document') && <label>Expiry date (optional)<input type="date" value={values.expiresAt} onChange={(event) => update('expiresAt', event.target.value)} /></label>}
          </div>}
          {kind === 'laboratory' && <label>Result as written on your report<input value={values.result} onChange={(event) => update('result', event.target.value)} placeholder="Farmer-entered; not verified" /></label>}
          <label>{kind === 'export' ? 'Produce, destination, and preparation notes' : 'Notes (optional)'}<textarea value={values.details} onChange={(event) => update('details', event.target.value)} rows="3" /></label>
          {error && <p className="export-hub-form-error" role="alert">{error}</p>}
          <div className="export-hub-form-actions"><button type="button" className="export-hub-button export-hub-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="export-hub-button export-hub-button-primary">{kind === 'export' ? 'Save request record' : 'Save record'}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function ExportReadinessWorkspace({ records, fields, onRecordsChange, onBack }) {
  const [formKind, setFormKind] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formFolder, setFormFolder] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [notice, setNotice] = useState('');
  const complianceRecords = useMemo(
    () => (Array.isArray(records.requests) ? records.requests : []).filter((record) => record.module === 'compliance'),
    [records.requests],
  );
  const certifications = complianceRecords.filter((record) => record.entryType === 'certification');
  const labLogs = complianceRecords.filter((record) => record.entryType === 'laboratory').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const documents = complianceRecords.filter((record) => record.entryType === 'document');
  const exportRequests = complianceRecords.filter((record) => record.entryType === 'export');
  const followUps = complianceRecords.filter((record) => !record.entryType || record.entryType === 'task');
  const readinessChecks = [fields.length > 0, certifications.length > 0, labLogs.length > 0, documents.length > 0];
  const readiness = Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100);
  const visibleLogs = showAllLogs ? labLogs : labLogs.slice(0, 5);
  const folders = documentFolders.map((name) => ({ name, count: documents.filter((record) => record.category === name).length }));
  const openedFolderDocuments = selectedFolder ? documents.filter((record) => record.category === selectedFolder) : [];

  const openForm = (kind, title = '', folder = '') => {
    setFormTitle(title);
    setFormFolder(folder);
    setFormKind(kind);
  };

  const saveRecord = (record) => {
    onRecordsChange('requests', [...records.requests, record]);
    setFormKind('');
    setNotice(record.entryType === 'export'
      ? 'Export request record saved. It has not been submitted to an export authority.'
      : 'Record saved to your farmer account. The information is user-entered and not independently verified.');
  };

  return (
    <main className="export-readiness-hub" aria-label="Export Readiness Hub">
      <header className="export-hub-header">
        <button type="button" className="export-hub-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Dashboard</button>
        <div className="export-hub-title-row">
          <div><span className="export-hub-eyebrow">COMPLIANCE &amp; EXPORT</span><h1>Export Readiness Hub</h1><p>Organise farmer-entered records for your export preparation.</p></div>
          <button type="button" className="export-hub-button export-hub-button-primary" onClick={() => openForm('export')}><span className="material-symbols-outlined">send</span>Prepare export request</button>
        </div>
      </header>

      {notice && <div className="export-hub-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <div className="export-hub-integrity-note"><span className="material-symbols-outlined">info</span><p>Records and progress below are based only on information you add. AGRI-NEST is not connected to certification registries, laboratories, or export authorities; this hub does not verify compliance or market eligibility.</p></div>

      <div className="export-hub-grid">
        <section className="export-hub-card export-hub-readiness">
          <div className="export-hub-section-title"><div><span className="export-hub-eyebrow">RECORD COVERAGE</span><h2>Preparation records</h2></div><span className="material-symbols-outlined" title="Not an official compliance score">info</span></div>
          <div className="export-hub-ring" style={{ '--export-progress': `${readiness}%` }} role="img" aria-label={`${readiness}% of four preparation record categories contain records`}>
            <div><strong>{readiness}<small>%</small></strong><span>record coverage</span></div>
          </div>
          <p className="export-hub-readiness-caption">{readinessChecks.filter(Boolean).length} of 4 record categories have entries</p>
          <div className="export-hub-checklist">
            {[
              ['Farm fields', readinessChecks[0], 'agriculture'],
              ['Certification records', readinessChecks[1], 'verified'],
              ['Lab & inspection logs', readinessChecks[2], 'science'],
              ['Document index', readinessChecks[3], 'folder'],
            ].map(([label, complete, icon]) => <div key={label}><span className="material-symbols-outlined">{icon}</span><span>{label}</span><strong>{complete ? 'Recorded' : 'Add records'}</strong></div>)}
          </div>
          <p className="export-hub-disclaimer">Record coverage is not an official readiness score, certification, or approval for any market.</p>
        </section>

        <section className="export-hub-card export-hub-certifications">
          <div className="export-hub-section-title"><div><span className="export-hub-eyebrow">YOUR RECORDS</span><h2>Certification tracker</h2><p>Track certificate details you have entered. No registry check is performed.</p></div><button type="button" className="export-hub-text-action" onClick={() => openForm('certification')}>Add record<span className="material-symbols-outlined">arrow_forward</span></button></div>
          <div className="export-hub-cert-grid">
            {certificationSuggestions.map((suggestion) => {
              const certification = certifications.find((record) => record.title.toLowerCase() === suggestion.toLowerCase());
              return (
                <article className="export-hub-cert-card" key={suggestion}>
                  <div className="export-hub-cert-top"><span className="export-hub-cert-icon material-symbols-outlined">{suggestion === 'Organic certification' ? 'eco' : suggestion === 'Fairtrade' ? 'handshake' : 'verified'}</span><span className={`export-hub-status ${certification ? 'recorded' : 'missing'}`}>{certification ? 'Recorded' : 'No record'}</span></div>
                  <h3>{suggestion}</h3>
                  {certification ? <><p>{certification.authority || 'Issuing authority not recorded'}</p><small>{certification.expiresAt ? `Expiry entered: ${formatDate(certification.expiresAt)}` : 'Expiry date not recorded'}</small><button type="button" className="export-hub-text-action" onClick={() => downloadRecord(certification)}>Download record<span className="material-symbols-outlined">download</span></button></> : <><p>No certificate details added.</p><button type="button" className="export-hub-text-action" onClick={() => openForm('certification', suggestion)}>Add details<span className="material-symbols-outlined">arrow_forward</span></button></>}
                </article>
              );
            })}
            {certifications.filter((record) => !certificationSuggestions.some((name) => name.toLowerCase() === record.title.toLowerCase())).map((record) => (
              <article className="export-hub-cert-card" key={record.id}>
                <div className="export-hub-cert-top"><span className="export-hub-cert-icon material-symbols-outlined">verified</span><span className="export-hub-status recorded">Recorded</span></div>
                <h3>{record.title}</h3><p>{record.authority || 'Issuing authority not recorded'}</p><small>{record.expiresAt ? `Expiry entered: ${formatDate(record.expiresAt)}` : 'Expiry date not recorded'}</small>
                <button type="button" className="export-hub-text-action" onClick={() => downloadRecord(record)}>Download record<span className="material-symbols-outlined">download</span></button>
              </article>
            ))}
          </div>
        </section>

        <section className="export-hub-card export-hub-logs">
          <div className="export-hub-section-title"><div><span className="export-hub-eyebrow">USER-ENTERED EVIDENCE INDEX</span><h2>Phytosanitary &amp; lab logs</h2></div><div className="export-hub-log-actions"><button type="button" className="export-hub-icon-button" aria-label={showAllLogs ? 'Show recent lab logs' : 'Show all lab logs'} onClick={() => setShowAllLogs((current) => !current)}><span className="material-symbols-outlined">{showAllLogs ? 'filter_list_off' : 'filter_list'}</span></button><button type="button" className="export-hub-text-action" onClick={() => openForm('laboratory')}>Add log<span className="material-symbols-outlined">add</span></button></div></div>
          <div className="export-hub-table-wrap">
            <table className="export-hub-table"><thead><tr><th>Date</th><th>Type</th><th>Authority / lab</th><th>Result entered</th><th>Action</th></tr></thead>
              <tbody>{visibleLogs.map((record) => <tr key={record.id}><td>{formatDate(record.date)}</td><td>{record.title}</td><td>{record.authority || 'Not recorded'}</td><td><span className="export-hub-result">{record.result || 'Not recorded'}</span></td><td><button type="button" className="export-hub-icon-button" aria-label={`Download record for ${record.title}`} onClick={() => downloadRecord(record)}><span className="material-symbols-outlined">download</span></button></td></tr>)}</tbody>
            </table>
            {!visibleLogs.length && <div className="export-hub-empty"><span className="material-symbols-outlined">science</span><strong>No test or inspection records</strong><p>Add details from a lab report or inspection for your own tracking.</p></div>}
          </div>
          <p className="export-hub-small-note">These are entered details, not verified laboratory results. Original report files are not stored here.</p>
        </section>

        <section className="export-hub-card export-hub-vault">
          <div className="export-hub-section-title"><div><span className="export-hub-eyebrow">DOCUMENT INDEX</span><h2>Document vault</h2></div><button type="button" className="export-hub-icon-button export-hub-add-document" aria-label="Add document record" onClick={() => openForm('document')}><span className="material-symbols-outlined">add</span></button></div>
          <p className="export-hub-small-note">Metadata only. Document files are not uploaded or stored.</p>
          <div className="export-hub-folder-list">
            {folders.map((folder) => <button type="button" className={`export-hub-folder ${selectedFolder === folder.name ? 'active' : ''}`} key={folder.name} onClick={() => setSelectedFolder((current) => current === folder.name ? '' : folder.name)}>
              <span className="export-hub-folder-icon material-symbols-outlined">folder</span><span className="export-hub-folder-label"><strong>{folder.name}</strong><small>{folder.count} record{folder.count === 1 ? '' : 's'}</small></span><span className="material-symbols-outlined">chevron_right</span>
            </button>)}
          </div>
          {selectedFolder && <div className="export-hub-folder-detail"><h3>{selectedFolder}</h3>{openedFolderDocuments.length ? openedFolderDocuments.map((record) => <button type="button" key={record.id} onClick={() => downloadRecord(record)}><span><strong>{record.title}</strong><small>{record.reference || 'No reference number'}</small></span><span className="material-symbols-outlined">download</span></button>) : <p>No document records in this folder.</p>}<button type="button" className="export-hub-text-action" onClick={() => openForm('document', '', selectedFolder)}>Add document record<span className="material-symbols-outlined">add</span></button></div>}
        </section>
      </div>

      {exportRequests.length > 0 && <section className="export-hub-card export-hub-requests"><div className="export-hub-section-title"><div><span className="export-hub-eyebrow">LOCAL FOLLOW-UP</span><h2>Export request records</h2><p>These notes have not been submitted to an authority.</p></div><span className="export-hub-count">{exportRequests.length}</span></div><div className="export-hub-request-list">{exportRequests.map((record) => <article key={record.id}><span className="material-symbols-outlined">outbox</span><div><strong>{record.title}</strong><p>{record.market ? `Target market: ${record.market}` : 'Target market not recorded'}{record.details ? ` · ${record.details}` : ''}</p></div><small>{formatDate(record.date)}</small></article>)}</div></section>}

      <section className="export-hub-card export-hub-requests">
        <div className="export-hub-section-title"><div><span className="export-hub-eyebrow">SAVED COMPLIANCE TASKS</span><h2>Compliance follow-ups</h2><p>Existing and new follow-up notes saved in your farmer account.</p></div><button type="button" className="export-hub-text-action" onClick={() => openForm('task')}>Add task<span className="material-symbols-outlined">add</span></button></div>
        {followUps.length ? <div className="export-hub-request-list">{followUps.map((record) => <article key={record.id}><span className="material-symbols-outlined">task_alt</span><div><strong>{record.title || 'Compliance task'}</strong><p>{record.details || 'No notes recorded.'}</p></div><small>{record.dueDate ? `Due ${formatDate(record.dueDate)}` : formatDate(record.date)}</small></article>)}</div> : <p className="export-hub-task-empty">No compliance follow-ups yet.</p>}
      </section>

      {formKind && <RecordForm kind={formKind} initialTitle={formTitle} folder={formFolder} onClose={() => setFormKind('')} onSave={saveRecord} />}
    </main>
  );
}
