import { useState } from 'react';
import { calculateFarmerTrust } from './lib/farmer-trust';
import { buildFarmerEvidenceReport } from './lib/farmer-evidence-report';
import './TrustVerificationWorkspace.css';

function downloadReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'agrinest-farmer-evidence-summary.json';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EvidenceCard({ icon, title, status, description, action, onAction }) {
  return (
    <article className="trust-evidence-card">
      <div className="trust-evidence-icon"><span className="material-symbols-outlined">{icon}</span></div>
      <div className="trust-evidence-content">
        <div className="trust-evidence-heading"><h3>{title}</h3><span>{status}</span></div>
        <p>{description}</p>
        {action && <button type="button" className="trust-evidence-action" onClick={onAction}>{action}<span className="material-symbols-outlined">arrow_forward</span></button>}
      </div>
    </article>
  );
}

export default function TrustVerificationWorkspace({ profile, records, syncStatus, weatherStatus, onNavigate, onBack }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOptions, setReportOptions] = useState({
    includeIdentity: false,
    includeLocation: false,
    includeFarmDetails: true,
    includeActivitySummary: true,
    includeGroupNames: false,
  });
  const trust = calculateFarmerTrust(profile);
  const activities = records.activities.filter((activity) => activity.module === 'activity');
  const photoActivities = activities.filter((activity) => activity.photo);
  const gpsActivities = activities.filter((activity) => activity.gpsStamp);
  const syncLabel = {
    synced: 'Synced',
    syncing: 'Syncing',
    pending: 'Pending sync',
    offline: 'Offline',
    loading: 'Checking',
  }[syncStatus] || 'Unknown';

  const toggleOption = (option) => (event) => {
    setReportOptions((current) => ({ ...current, [option]: event.target.checked }));
  };

  const prepareReport = () => {
    const report = buildFarmerEvidenceReport({ profile, records, options: reportOptions });
    downloadReport(report);
    setReportOpen(false);
  };

  return (
    <main className="trust-verification-workspace">
      <header className="trust-workspace-header">
        <button type="button" className="trust-workspace-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Dashboard</button>
        <div className="trust-workspace-title-row">
          <div>
            <span className="trust-workspace-eyebrow">FARMER RECORDS &amp; TRANSPARENCY</span>
            <h1>Trust &amp; Verification</h1>
            <p>Review your saved farm evidence, understand what is and is not verified, and choose what to include in a shareable summary.</p>
          </div>
          <button type="button" className="trust-report-button" onClick={() => setReportOpen(true)}><span className="material-symbols-outlined">download</span>Prepare farmer report</button>
        </div>
      </header>

      <section className="trust-score-panel" aria-label="Profile completeness">
        <div className="trust-score-overview">
          <span className="trust-score-eyebrow">PROFILE COMPLETENESS</span>
          <strong>{trust.score}<small>/ 1000</small></strong>
          <span className="trust-score-tier">{trust.tier}</span>
          <p>This measures saved profile fields only. It is not identity verification, a fraud assessment, or a credit score.</p>
        </div>
        <div className="trust-score-categories">
          {trust.categories.map((category) => (
            <div key={category.key}>
              <span>{category.label}</span><strong>{category.percent}%</strong>
              <i><b style={{ width: `${category.percent}%` }} /></i>
            </div>
          ))}
        </div>
      </section>

      <section className="trust-evidence-section">
        <div className="trust-section-heading"><div><span>YOUR SAVED DATA</span><h2>Evidence overview</h2></div><span className="trust-sync-indicator"><span className="material-symbols-outlined">{syncStatus === 'synced' ? 'cloud_done' : 'devices'}</span>{syncLabel}</span></div>
        <div className="trust-evidence-grid">
          <EvidenceCard icon="agriculture" title="Farm fields" status={`${records.fields.length} saved`} description="Field names, crops, areas and optional map boundaries are farmer-entered. A boundary is not proof of land ownership." action="Open Digital Farm" onAction={() => onNavigate('fields')} />
          <EvidenceCard icon="photo_camera" title="Journal evidence" status={`${activities.length} entries`} description={`${photoActivities.length} entries include a farmer-provided photo; ${gpsActivities.length} include a device GPS stamp. Neither is tamper-proof or independently verified.`} action="Open farm journal" onAction={() => onNavigate('activity')} />
          <EvidenceCard icon="groups" title="Farmer groups" status={`${records.groups.length} records`} description="Group records are not endorsements. No group-admin attestation or social-collateral score is connected." action="Open groups" onAction={() => onNavigate('groups')} />
          <EvidenceCard icon="cloud_sync" title="Farm record sync" status={syncLabel} description="Sync status describes account record synchronization only; it does not mean that records have been independently checked." action="View farm records" onAction={() => onNavigate('fields')} />
        </div>
      </section>

      <section className="trust-evidence-section">
        <div className="trust-section-heading"><div><span>CONNECTED SERVICES</span><h2>Verification boundaries</h2></div></div>
        <div className="trust-boundary-grid">
          <article><span className="material-symbols-outlined">storefront</span><div><h3>Marketplace quality</h3><p>Listing details and photos are seller-submitted. No linked buyer-review, dispute, inspection, or transaction-based seller tier is available.</p><button type="button" onClick={() => onNavigate('marketplace')}>Open Marketplace<span className="material-symbols-outlined">arrow_forward</span></button></div></article>
          <article><span className="material-symbols-outlined">public</span><div><h3>Official data sources</h3><p>No NIDA, land-registry, TMA, TARI, TOSCI, NBS, or biometric verification is connected. Weather information uses the app's external weather service, not a confirmed TMA feed.</p><small>Weather status: {weatherStatus || 'not available'}</small></div></article>
          <article><span className="material-symbols-outlined">fact_check</span><div><h3>Export readiness</h3><p>Export checklists and batch records help organize documents. They are not certification, laboratory results, or authority submissions.</p><button type="button" onClick={() => onNavigate('compliance')}>Open export readiness<span className="material-symbols-outlined">arrow_forward</span></button></div></article>
          <article><span className="material-symbols-outlined">account_balance</span><div><h3>Finance &amp; lending</h3><p>Profile completeness does not establish creditworthiness. No lender decision, repayment history, escrow, or loan approval is implied by these records.</p><button type="button" onClick={() => onNavigate('income')}>Open finance<span className="material-symbols-outlined">arrow_forward</span></button></div></article>
        </div>
      </section>

      {reportOpen && (
        <div className="trust-report-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setReportOpen(false);
        }}>
          <section className="trust-report-dialog" role="dialog" aria-modal="true" aria-labelledby="trust-report-title">
            <button type="button" className="trust-report-close" aria-label="Close report options" onClick={() => setReportOpen(false)}><span className="material-symbols-outlined">close</span></button>
            <span className="trust-workspace-eyebrow">PRIVATE BY DEFAULT</span>
            <h2 id="trust-report-title">Choose what to share</h2>
            <p>The report is generated on this device. National ID numbers and bank account details are always excluded. Included records remain self-reported and unverified.</p>
            <div className="trust-report-options">
              <label><input type="checkbox" checked={reportOptions.includeFarmDetails} onChange={toggleOption('includeFarmDetails')} />Farm fields and crop details</label>
              <label><input type="checkbox" checked={reportOptions.includeActivitySummary} onChange={toggleOption('includeActivitySummary')} />Journal activity summary (no photos)</label>
              <label><input type="checkbox" checked={reportOptions.includeGroupNames} onChange={toggleOption('includeGroupNames')} />Farmer group names</label>
              <label><input type="checkbox" checked={reportOptions.includeIdentity} onChange={toggleOption('includeIdentity')} />Farmer name and region</label>
              <label className="trust-sensitive-option"><input type="checkbox" checked={reportOptions.includeLocation} onChange={toggleOption('includeLocation')} />Precise farm and GPS-stamp coordinates</label>
            </div>
            <div className="trust-report-warning"><span className="material-symbols-outlined">info</span><p>Only share the file with a recipient you trust. Precise location is sensitive; leave it unchecked unless the recipient specifically needs it.</p></div>
            <div className="trust-report-actions"><button type="button" onClick={() => setReportOpen(false)}>Cancel</button><button type="button" onClick={prepareReport}><span className="material-symbols-outlined">download</span>Download JSON report</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
