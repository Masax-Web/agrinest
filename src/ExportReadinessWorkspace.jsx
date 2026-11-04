import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
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

function downloadBatchDossier(batch, field, traceabilityRecords) {
  const blob = new Blob([JSON.stringify({
    documentType: 'AGRI-NEST farmer-entered batch dossier',
    notice: 'This dossier contains user-entered information only. It is not an official certificate, verified inspection, public registry entry, or blockchain record.',
    batch,
    field: field ? { id: field.id, name: field.name, location: field.location || field.region || '' } : null,
    traceabilityRecords,
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `agrinest-batch-dossier-${batch.reference || batch.id}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RecordForm({ kind, initialTitle = '', folder = '', fields = [], onClose, onSave }) {
  const [values, setValues] = useState({
    title: initialTitle,
    category: folder || documentFolders[0],
    fieldId: '',
    quantity: '',
    location: '',
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
      setError(kind === 'laboratory' ? 'Enter a test or inspection type.' : kind === 'batch' ? 'Enter a crop or batch name.' : 'Enter a record title.');
      return;
    }
    const id = createId();
    onSave({
      id,
      module: kind === 'batch' ? 'traceability' : 'compliance',
      entryType: kind,
      title: values.title.trim(),
      category: values.category,
      fieldId: values.fieldId,
      quantity: values.quantity.trim(),
      location: values.location.trim(),
      authority: values.authority.trim(),
      reference: values.reference.trim() || (kind === 'batch' ? `AN-${today().replaceAll('-', '')}-${id.slice(0, 6).toUpperCase()}` : ''),
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
    batch: 'Create a crop batch',
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
          <label>{kind === 'laboratory' ? 'Test or inspection type' : kind === 'export' ? 'Produce or certificate request' : kind === 'document' ? 'Document name' : kind === 'batch' ? 'Crop or batch name' : kind === 'task' ? 'Follow-up title' : 'Certification name'}
            <input autoFocus required value={values.title} onChange={(event) => update('title', event.target.value)} placeholder={kind === 'laboratory' ? 'e.g. Aflatoxin test' : 'Enter a name'} />
          </label>
          {kind === 'batch' && <>
            <label>Farm field<select value={values.fieldId} onChange={(event) => update('fieldId', event.target.value)}><option value="">No field selected</option>{fields.map((field) => <option value={field.id} key={field.id}>{field.name || 'Unnamed field'}</option>)}</select></label>
            <div className="export-hub-form-row">
              <label>Quantity harvested<input value={values.quantity} onChange={(event) => update('quantity', event.target.value)} placeholder="e.g. 240 kg" /></label>
              <label>Location (optional)<input value={values.location} onChange={(event) => update('location', event.target.value)} placeholder="Village, district, region" /></label>
            </div>
            <label>Harvest or batch date<input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} /></label>
          </>}
          {kind === 'document' && <label>Folder<select value={values.category} onChange={(event) => update('category', event.target.value)}>{documentFolders.map((folderName) => <option key={folderName}>{folderName}</option>)}</select></label>}
          {kind === 'export' && <label>Target market<input value={values.market} onChange={(event) => update('market', event.target.value)} placeholder="e.g. destination country or region" /></label>}
          {(kind === 'certification' || kind === 'laboratory') && <label>Issuing authority or lab<input value={values.authority} onChange={(event) => update('authority', event.target.value)} placeholder="Enter the authority or lab name" /></label>}
          {kind !== 'export' && kind !== 'batch' && <label>Reference number (optional)<input value={values.reference} onChange={(event) => update('reference', event.target.value)} /></label>}
          {kind === 'task' && <label>Due date (optional)<input type="date" value={values.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label>}
          {kind !== 'export' && kind !== 'task' && kind !== 'batch' && <div className="export-hub-form-row">
            {kind !== 'task' && <label>{kind === 'laboratory' ? 'Test date' : 'Issue or record date'}<input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} /></label>}
            {(kind === 'certification' || kind === 'document') && <label>Expiry date (optional)<input type="date" value={values.expiresAt} onChange={(event) => update('expiresAt', event.target.value)} /></label>}
          </div>}
          {kind === 'laboratory' && <label>Result as written on your report<input value={values.result} onChange={(event) => update('result', event.target.value)} placeholder="Farmer-entered; not verified" /></label>}
          <label>{kind === 'export' ? 'Produce, destination, and preparation notes' : kind === 'batch' ? 'Growing, harvest, and handling notes' : 'Notes (optional)'}<textarea value={values.details} onChange={(event) => update('details', event.target.value)} rows="3" /></label>
          {error && <p className="export-hub-form-error" role="alert">{error}</p>}
          <div className="export-hub-form-actions"><button type="button" className="export-hub-button export-hub-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="export-hub-button export-hub-button-primary">{kind === 'export' ? 'Save request record' : kind === 'batch' ? 'Create batch' : 'Save record'}</button></div>
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
  const [batchQr, setBatchQr] = useState('');
  const complianceRecords = useMemo(
    () => (Array.isArray(records.requests) ? records.requests : []).filter((record) => record.module === 'compliance'),
    [records.requests],
  );
  const traceabilityRecords = useMemo(
    () => (Array.isArray(records.activities) ? records.activities : []).filter((record) => record.module === 'traceability'),
    [records.activities],
  );
  const batchRecords = traceabilityRecords.filter((record) => record.entryType === 'batch')
    .sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')));
  const activeBatch = batchRecords[0];
  const activeBatchField = activeBatch && Array.isArray(fields) ? fields.find((field) => String(field.id) === String(activeBatch.fieldId)) : null;
  const certifications = complianceRecords.filter((record) => record.entryType === 'certification');
  const labLogs = complianceRecords.filter((record) => record.entryType === 'laboratory').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const documents = complianceRecords.filter((record) => record.entryType === 'document');
  const exportRequests = complianceRecords.filter((record) => record.entryType === 'export');
  const followUps = complianceRecords.filter((record) => !record.entryType || record.entryType === 'task');
  const visibleLogs = showAllLogs ? labLogs : labLogs.slice(0, 5);
  const folders = documentFolders.map((name) => ({ name, count: documents.filter((record) => record.category === name).length }));
  const openedFolderDocuments = selectedFolder ? documents.filter((record) => record.category === selectedFolder) : [];
  const stageDefinitions = [
    { key: 'nirc', title: 'NIRC water permit', authority: 'NIRC', description: 'Record permit details for your own export file.', pattern: /nirc|irrigation|water permit/i, kind: 'document', folder: 'Export Permits', icon: 'water_drop' },
    { key: 'tphpa', title: 'TPHPA phytosanitary inspection', authority: 'TPHPA', description: 'Keep a note of plant-health or phytosanitary inspection details.', pattern: /tphpa|phytosanitary|plant health/i, kind: 'laboratory', icon: 'pest_control' },
    { key: 'tfda', title: 'TFDA quality test', authority: 'TFDA', description: 'Add quality-test details as written on your report.', pattern: /tfda|aflatoxin|moisture|quality test/i, kind: 'laboratory', icon: 'science' },
    { key: 'tbs', title: 'TBS grading follow-up', authority: 'TBS', description: 'Record grading or standards follow-up notes.', pattern: /tbs|grading|standard/i, kind: 'task', icon: 'grading' },
  ].map((stage) => ({
    ...stage,
    record: [...complianceRecords].reverse().find((record) => stage.pattern.test(`${record.title || ''} ${record.authority || ''} ${record.details || ''}`)),
  }));
  const recordedStages = stageDefinitions.filter((stage) => stage.record).length;
  const stageCoverage = Math.round((recordedStages / stageDefinitions.length) * 100);

  useEffect(() => {
    let active = true;
    if (!activeBatch?.reference) {
      setBatchQr('');
      return () => { active = false; };
    }

    QRCode.toDataURL(activeBatch.reference, { errorCorrectionLevel: 'M', margin: 1, width: 192 })
      .then((dataUrl) => { if (active) setBatchQr(dataUrl); })
      .catch((error) => {
        console.error('Unable to generate the batch ID QR code.', error);
        if (active) setNotice('The batch record was saved, but its QR code could not be generated. Try reloading this page.');
      });

    return () => { active = false; };
  }, [activeBatch?.reference]);

  const openForm = (kind, title = '', folder = '') => {
    setFormTitle(title);
    setFormFolder(folder);
    setFormKind(kind);
  };

  const saveRecord = (record) => {
    if (record.module === 'traceability') {
      onRecordsChange('activities', [...(Array.isArray(records.activities) ? records.activities : []), record]);
    } else {
      onRecordsChange('requests', [...(Array.isArray(records.requests) ? records.requests : []), record]);
    }
    setFormKind('');
    setNotice(record.entryType === 'batch'
      ? 'Crop batch saved to your farmer account. Its QR code contains the batch ID only.'
      : record.entryType === 'export'
        ? 'Export request record saved. It has not been submitted to an export authority.'
        : 'Record saved to your farmer account. The information is user-entered and not independently verified.');
  };

  return (
    <main className="export-readiness-hub" aria-label="Export Readiness Hub">
      <header className="export-hub-header">
        <button type="button" className="export-hub-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Dashboard</button>
        <div className="export-hub-title-row">
          <div><span className="export-hub-eyebrow">COMPLIANCE &amp; EXPORT</span><h1>Export Readiness Hub</h1><p>Organise farmer-entered records for your export preparation.</p></div>
          <div className="export-hub-header-actions">
            <button type="button" className="export-hub-button export-hub-button-secondary" onClick={() => openForm('batch')}><span className="material-symbols-outlined">add</span>New crop batch</button>
            <button type="button" className="export-hub-button export-hub-button-primary" onClick={() => openForm('export')}><span className="material-symbols-outlined">send</span>Prepare export request</button>
          </div>
        </div>
      </header>

      {notice && <div className="export-hub-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <div className="export-hub-integrity-note"><span className="material-symbols-outlined">info</span><p>Records and progress below are based only on information you add. AGRI-NEST is not connected to certification registries, laboratories, or export authorities; this hub does not verify compliance or market eligibility.</p></div>

      <div className="export-hub-export-grid">
        <section className="export-hub-card export-hub-inspection-card">
          <div className="export-hub-section-title">
            <div><span className="export-hub-eyebrow">EXPORT CHECKLIST</span><h2>Inspection &amp; documentation</h2><p>Track the records you have added for each export-preparation step.</p></div>
            <div className="export-hub-stage-progress"><strong>{stageCoverage}%</strong><span>recorded</span></div>
          </div>
          <div className="export-hub-progress-track" role="img" aria-label={`${recordedStages} of ${stageDefinitions.length} export checklist records added`}><span style={{ width: `${stageCoverage}%` }} /></div>
          <div className="export-hub-inspection-list">
            {stageDefinitions.map((stage, index) => (
              <article className="export-hub-inspection-step" key={stage.key}>
                <span className={`export-hub-step-number ${stage.record ? 'complete' : ''}`}>{stage.record ? <span className="material-symbols-outlined">check</span> : `0${index + 1}`}</span>
                <div className="export-hub-step-content">
                  <div className="export-hub-step-heading"><span className="material-symbols-outlined">{stage.icon}</span><h3>{stage.title}</h3><span className={`export-hub-status ${stage.record ? 'recorded' : 'missing'}`}>{stage.record ? 'Record added' : 'Not recorded'}</span></div>
                  {stage.record ? <p>{stage.record.reference ? `Reference: ${stage.record.reference} · ` : ''}{stage.record.result ? `Entered result: ${stage.record.result} · ` : ''}{formatDate(stage.record.date)}</p> : <p>{stage.description}</p>}
                  <div className="export-hub-step-actions">
                    <button type="button" className="export-hub-text-action" onClick={() => openForm(stage.kind, stage.title, stage.folder || '')}>{stage.record ? 'Add update' : stage.key === 'nirc' ? 'Add permit record' : stage.key === 'tbs' ? 'Record follow-up' : 'Add inspection record'}<span className="material-symbols-outlined">arrow_forward</span></button>
                    {stage.record && <button type="button" className="export-hub-text-action" onClick={() => downloadRecord(stage.record)}>Download record<span className="material-symbols-outlined">download</span></button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="export-hub-small-note">“Record added” means information was entered in your account; it does not mean an inspection passed or a permit was issued.</p>
        </section>

        <div className="export-hub-dossier-column">
          <section className="export-hub-card export-hub-dossier-card">
            <div className="export-hub-section-title"><div><span className="export-hub-eyebrow">TRACEABILITY</span><h2>Batch dossier</h2></div><span className="material-symbols-outlined export-hub-dossier-icon">qr_code_2</span></div>
            {activeBatch ? <>
              <div className="export-hub-batch-summary">
                <div><span>ACTIVE CROP BATCH</span><strong>{activeBatch.title}</strong><small>{activeBatch.reference}</small></div>
                {batchQr && <img className="export-hub-batch-qr" src={batchQr} alt={`QR code containing batch ID ${activeBatch.reference}`} />}
              </div>
              <dl className="export-hub-batch-details">
                <div><dt>Harvest date</dt><dd>{formatDate(activeBatch.date)}</dd></div>
                <div><dt>Quantity entered</dt><dd>{activeBatch.quantity || 'Not recorded'}</dd></div>
                <div><dt>Farm field</dt><dd>{activeBatchField?.name || 'Not linked'}</dd></div>
                <div><dt>Location</dt><dd>{activeBatch.location || activeBatchField?.location || activeBatchField?.region || 'Not recorded'}</dd></div>
              </dl>
              <p className="export-hub-small-note">The QR contains only this batch ID. It is not a public lookup, blockchain record, or independent verification.</p>
              <div className="export-hub-dossier-actions">
                <button type="button" className="export-hub-button export-hub-button-primary" onClick={() => downloadBatchDossier(activeBatch, activeBatchField, traceabilityRecords)}><span className="material-symbols-outlined">download</span>Download dossier</button>
                <button type="button" className="export-hub-button export-hub-button-secondary" onClick={() => openForm('batch')}><span className="material-symbols-outlined">add</span>New batch</button>
              </div>
            </> : <div className="export-hub-batch-empty"><span className="material-symbols-outlined">inventory_2</span><strong>No crop batch yet</strong><p>Create a batch to record its harvest date, quantity, field, and notes.</p><button type="button" className="export-hub-button export-hub-button-primary" onClick={() => openForm('batch')}><span className="material-symbols-outlined">add</span>Create crop batch</button></div>}
          </section>

          <section className="export-hub-card export-hub-gap-card">
            <div className="export-hub-section-title"><div><span className="export-hub-eyebrow">GOOD AGRICULTURAL PRACTICES</span><h2>GlobalG.A.P. tracking</h2></div><span className="material-symbols-outlined export-hub-gap-icon">eco</span></div>
            {(() => {
              const gapRecord = certifications.find((record) => /global\s*\.?\s*g\.?\s*a\.?\s*p\.?/i.test(record.title));
              return <><span className={`export-hub-status ${gapRecord ? 'recorded' : 'missing'}`}>{gapRecord ? 'Details recorded · unverified' : 'No record added'}</span><p>{gapRecord ? `Farmer-entered details${gapRecord.expiresAt ? ` · expiry entered ${formatDate(gapRecord.expiresAt)}` : ''}. No auditor or registry check is connected.` : 'No certification status or independent audit result is available.'}</p><button type="button" className="export-hub-text-action" onClick={() => openForm('certification', 'GlobalG.A.P.')}>{gapRecord ? 'Add record update' : 'Add GAP record'}<span className="material-symbols-outlined">arrow_forward</span></button></>;
            })()}
          </section>
        </div>
      </div>

      <div className="export-hub-grid">
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

      {formKind && <RecordForm kind={formKind} initialTitle={formTitle} folder={formFolder} fields={Array.isArray(fields) ? fields : []} onClose={() => setFormKind('')} onSave={saveRecord} />}
    </main>
  );
}
