import { useState } from 'react';
import { calculateFarmerTrust } from './lib/farmer-trust';

const workspaceDetails = {
  fields: { title: 'Digital Farm', icon: 'agriculture', description: 'Register fields and keep their crop and area records together.', recordType: 'fields', submitLabel: 'Add field', fields: [['name', 'Field name', 'text'], ['crop', 'Crop', 'text'], ['area', 'Area (acres)', 'number']] },
  trust: { title: 'Trust Score', icon: 'verified_user', description: 'Your profile completeness score and the records that support it.', recordType: 'activities' },
  listings: { title: 'Active Listings', icon: 'storefront', description: 'Manage produce listings and open the marketplace to publish or update an offer.', recordType: 'listings' },
  income: { title: 'Season Income', icon: 'payments', description: 'Keep a local ledger of crop sales and season income.', recordType: 'income', submitLabel: 'Record income', fields: [['crop', 'Produce', 'text'], ['amount', 'Amount (TZS)', 'number'], ['date', 'Sale date', 'date'], ['note', 'Buyer or note', 'text']] },
  livestock: { title: 'Livestock Head', icon: 'pets', description: 'Update the livestock count saved in your farmer profile.', recordType: 'livestock', submitLabel: 'Save livestock count', fields: [['count', 'Current head count', 'number'], ['notes', 'Notes', 'text']] },
  groups: { title: 'My Groups', icon: 'groups', description: 'Track your farmer groups and open community conversations.', recordType: 'groups', submitLabel: 'Join group', fields: [['name', 'Group name', 'text'], ['region', 'Region', 'text']] },
  loans: { title: 'Loan Applications', icon: 'account_balance', description: 'Prepare an application record for a farm or input loan.', recordType: 'requests', submitLabel: 'Save loan request', fields: [['title', 'Loan purpose', 'text'], ['amount', 'Amount requested (TZS)', 'number'], ['details', 'Additional details', 'textarea']] },
  'smart-loan': { title: 'Smart Loan', icon: 'psychology', description: 'Create a loan request using your saved farm and income records.', recordType: 'requests', submitLabel: 'Save smart-loan request', fields: [['title', 'Loan purpose', 'text'], ['amount', 'Amount requested (TZS)', 'number'], ['details', 'How will the loan be used?', 'textarea']] },
  experts: { title: 'Expert Support', icon: 'support_agent', description: 'Describe the topic you need help with and save an expert request.', recordType: 'requests', submitLabel: 'Request expert help', fields: [['title', 'Topic', 'text'], ['details', 'What do you need help with?', 'textarea']] },
  transport: { title: 'Transport Booking', icon: 'local_shipping', description: 'Record a produce or farm-input transport request.', recordType: 'requests', submitLabel: 'Save transport request', fields: [['title', 'Route or destination', 'text'], ['amount', 'Load size (kg)', 'number'], ['details', 'Cargo and pickup details', 'textarea']] },
  activity: { title: 'Farm Activity Log', icon: 'edit_calendar', description: 'Record completed farm work. Activity entries are stored on this device.', recordType: 'activities', submitLabel: 'Log activity', fields: [['title', 'Activity', 'text'], ['date', 'Date', 'date'], ['details', 'Field, crop, or notes', 'textarea']] },
  'rent-space': { title: 'Rent Space or Land', icon: 'landscape', description: 'Save a request for land, storage, or farm space.', recordType: 'requests', submitLabel: 'Save space request', fields: [['title', 'Space needed', 'text'], ['amount', 'Area or capacity', 'number'], ['details', 'Location and dates', 'textarea']] },
  labour: { title: 'Hire Labour', icon: 'engineering', description: 'Record the work and timing for a labour request.', recordType: 'requests', submitLabel: 'Save labour request', fields: [['title', 'Work needed', 'text'], ['amount', 'Number of workers', 'number'], ['details', 'Location and work dates', 'textarea']] },
  insurance: { title: 'Insurance', icon: 'shield', description: 'Record a request for crop, livestock, or equipment cover.', recordType: 'requests', submitLabel: 'Save insurance request', fields: [['title', 'Cover type', 'text'], ['amount', 'Estimated value (TZS)', 'number'], ['details', 'Farm and risk details', 'textarea']] },
  waste: { title: 'Waste Exchange', icon: 'recycling', description: 'Record agricultural waste or by-products available for exchange.', recordType: 'requests', submitLabel: 'Save exchange offer', fields: [['title', 'Material', 'text'], ['amount', 'Available quantity', 'number'], ['details', 'Condition and pickup location', 'textarea']] },
  analytics: { title: 'Farm Analytics', icon: 'analytics', description: 'A summary built from your saved fields, income, listings, livestock, and activity records.', recordType: 'activities' },
  'farm-erp': { title: 'Farm ERP', icon: 'precision_manufacturing', description: 'Use one place to record fields, sales, livestock, and farm activities.', recordType: 'activities' },
  'market-news': { title: 'Market News', icon: 'newspaper', description: 'Review market updates and save a note for your farm records.', recordType: 'activities' },
  'farmer-forum': { title: 'Farmer Forum', icon: 'diversity_3', description: 'Join community discussions and keep your group conversations close.', recordType: 'groups' },
  traceability: { title: 'Traceability & QR', icon: 'qr_code_2', description: 'Record a crop batch note for later traceability.', recordType: 'activities', submitLabel: 'Save batch note', fields: [['title', 'Batch or crop', 'text'], ['details', 'Origin and handling notes', 'textarea']] },
  compliance: { title: 'Compliance & Export', icon: 'fact_check', description: 'Track export and compliance tasks for your produce.', recordType: 'requests', submitLabel: 'Add compliance task', fields: [['title', 'Task', 'text'], ['date', 'Due date', 'date'], ['details', 'Requirements or notes', 'textarea']] },
  training: { title: 'Wanafunzi Hub', icon: 'school', description: 'Save a learning activity or request a training follow-up.', recordType: 'activities', submitLabel: 'Save learning note', fields: [['title', 'Course or topic', 'text'], ['details', 'Learning note', 'textarea']] },
  agrishop: { title: 'Agrishop Network', icon: 'storefront', description: 'Browse supplies in the marketplace or record an input you need.', recordType: 'requests', submitLabel: 'Save input request', fields: [['title', 'Input needed', 'text'], ['amount', 'Quantity', 'number'], ['details', 'Preferred supplier or delivery notes', 'textarea']] },
  payroll: { title: 'Payroll & Labour', icon: 'payments', description: 'Keep a record of farm labour and payments.', recordType: 'requests', submitLabel: 'Save labour record', fields: [['title', 'Worker or work item', 'text'], ['amount', 'Amount (TZS)', 'number'], ['details', 'Payment or work notes', 'textarea']] },
  carbon: { title: 'Carbon Credits', icon: 'eco', description: 'Record a climate-smart practice for follow-up.', recordType: 'activities', submitLabel: 'Save practice', fields: [['title', 'Practice', 'text'], ['date', 'Date started', 'date'], ['details', 'Field and practice notes', 'textarea']] },
  crowdfunding: { title: 'Crowdfunding', icon: 'volunteer_activism', description: 'Save a farm project idea to prepare for a funding request.', recordType: 'requests', submitLabel: 'Save project idea', fields: [['title', 'Project', 'text'], ['amount', 'Funding goal (TZS)', 'number'], ['details', 'Project summary', 'textarea']] },
  foundation: { title: 'AGRI-NEST Foundation', icon: 'groups_2', description: 'Record a request for community or extension support.', recordType: 'requests', submitLabel: 'Save support request', fields: [['title', 'Support needed', 'text'], ['details', 'Location and request details', 'textarea']] },
};

const formatTzs = (amount) => `TZS ${Number(amount || 0).toLocaleString('en-TZ')}`;

function createRecordId() {
  return globalThis.crypto?.randomUUID?.() || `record-${Date.now()}`;
}

export default function FarmerWorkspace({ page, profile, records, liveListingCount = 0, onRecordsChange, onProfileSave, onNavigate, onBack }) {
  const details = workspaceDetails[page] || { title: page.replaceAll('-', ' '), icon: 'dashboard', description: 'Record and manage this part of your farm account.', recordType: 'requests', submitLabel: 'Save record', fields: [['title', 'Name', 'text'], ['details', 'Details', 'textarea']] };
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState('');
  const trust = calculateFarmerTrust(profile);
  const recordsForPage = page === 'trust' || page === 'analytics' || page === 'farm-erp'
    ? records.activities
    : page === 'listings'
      ? records.listings
      : page === 'livestock'
        ? records.livestock
        : records[details.recordType].filter((record) => details.recordType !== 'requests' || record.module === page);
  const seasonIncome = records.income.reduce((total, entry) => total + Number(entry.amount || 0), 0);

  const saveRecord = (event) => {
    event.preventDefault();
    if (page === 'listings') {
      onNavigate('marketplace');
      return;
    }
    if (page === 'livestock') {
      const count = Math.max(0, Math.floor(Number(draft.count)));
      if (!Number.isFinite(count)) return;
      onProfileSave({ ...profile, livestock: String(count) });
      onRecordsChange('livestock', [...records.livestock, { id: createRecordId(), count, notes: draft.notes || '', date: new Date().toISOString() }]);
    } else if (page === 'groups') {
      const name = String(draft.name || '').trim();
      if (!name || records.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
        setNotice(name ? 'You are already a member of that group.' : 'Enter a group name to join.');
        return;
      }
      onRecordsChange('groups', [...records.groups, { id: createRecordId(), name, region: String(draft.region || '').trim(), joinedAt: new Date().toISOString() }]);
    } else {
      const recordType = details.recordType;
      const entries = page === 'income' ? records.income : records[recordType];
      const record = { ...draft, id: createRecordId(), module: page, date: draft.date || new Date().toISOString().slice(0, 10), status: recordType === 'requests' ? 'Saved' : undefined };
      if (recordType === 'fields') record.area = Number(draft.area || 0);
      if (recordType === 'income') record.amount = Number(draft.amount || 0);
      if (recordType === 'activities') record.title = String(draft.title || '').trim();
      if (!record.title && recordType !== 'fields' && recordType !== 'income') record.title = String(draft.activity || '').trim();
      if (page === 'income') onRecordsChange('income', [...entries, record]);
      else onRecordsChange(recordType, [...entries, record]);
    }
    setDraft({});
    setNotice(`${details.title} record saved on this device.`);
  };

  return (
    <main className="farmer-workspace" aria-label={details.title}>
      <header className="farmer-workspace-header">
        <button type="button" className="farmer-workspace-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Dashboard</button>
        <div><span className="farmer-workspace-eyebrow">FARMER WORKSPACE</span><h1><span className="material-symbols-outlined">{details.icon}</span>{details.title}</h1><p>{details.description}</p></div>
      </header>

      {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      {page === 'trust' ? (
        <section className="farmer-workspace-summary">
          <div className="farmer-trust-score"><span>PROFILE SCORE</span><strong>{trust.score}<small>/ 1000</small></strong><p>{trust.tier}</p></div>
          <div className="farmer-trust-categories">{trust.categories.map((category) => <div key={category.key}><span>{category.label}</span><strong>{category.percent}%</strong><i><b style={{ width: `${category.percent}%` }} /></i></div>)}</div>
          <p className="farmer-workspace-note">The score is calculated from your saved profile. Logged activities are shown separately and are not independently verified.</p>
        </section>
      ) : page === 'analytics' || page === 'farm-erp' ? (
        <section className="farmer-workspace-metrics">
          <div><span>Registered fields</span><strong>{records.fields.length}</strong></div>
          <div><span>Active listings</span><strong>{records.listings.length}</strong></div>
          <div><span>Season income</span><strong>{formatTzs(seasonIncome)}</strong></div>
          <div><span>Livestock head</span><strong>{Number(profile.livestock || 0).toLocaleString()}</strong></div>
          <div><span>Logged activities</span><strong>{records.activities.length}</strong></div>
        </section>
      ) : page === 'listings' ? (
        <section className="farmer-workspace-empty"><span className="material-symbols-outlined">storefront</span><h2>{Math.max(records.listings.length, liveListingCount) ? `${Math.max(records.listings.length, liveListingCount)} active listing${Math.max(records.listings.length, liveListingCount) === 1 ? '' : 's'}` : 'No active listings yet'}</h2><p>Publish produce in Soko Marketplace to make it visible to buyers.</p><button type="button" onClick={() => onNavigate('marketplace')}>Open Marketplace</button></section>
      ) : null}

      {details.fields && (
        <form className="farmer-workspace-form" onSubmit={saveRecord}>
          <h2>{page === 'fields' ? 'Register a field' : page === 'income' ? 'Record a sale' : page === 'livestock' ? 'Update herd count' : page === 'groups' ? 'Join a farmer group' : 'Add a record'}</h2>
          <div className="farmer-workspace-inputs">
            {details.fields.map(([name, label, type]) => (
              <label key={name} className={type === 'textarea' ? 'wide' : ''}>{label}{type === 'textarea' ? <textarea value={draft[name] || ''} onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))} required /> : <input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} value={draft[name] || ''} onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))} required />}</label>
            ))}
          </div>
          <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">add</span>{details.submitLabel}</button>
        </form>
      )}

      <section className="farmer-workspace-records">
        <div className="farmer-workspace-section-heading"><div><span>YOUR RECORDS</span><h2>{details.recordType === 'requests' ? 'Saved requests' : details.recordType === 'activities' ? 'Activity history' : details.recordType === 'fields' ? 'Registered fields' : details.recordType === 'income' ? 'Income ledger' : details.recordType === 'groups' ? 'Joined groups' : 'Recent updates'}</h2></div><span className="farmer-workspace-count">{recordsForPage.length}</span></div>
        {recordsForPage.length ? <div className="farmer-workspace-record-list">{recordsForPage.map((record) => <article key={record.id}>
          <span className="material-symbols-outlined">{details.recordType === 'fields' ? 'agriculture' : details.recordType === 'income' ? 'payments' : details.recordType === 'groups' ? 'groups' : details.recordType === 'livestock' ? 'pets' : 'task_alt'}</span>
          <div><strong>{record.name || record.title || record.crop || record.count ? `${record.name || record.title || record.crop || `${record.count} head`}` : details.title}</strong><p>{record.crop ? `${record.crop}${record.area ? ` · ${record.area} acres` : ''}` : record.amount ? formatTzs(record.amount) : record.region || record.details || record.notes || record.status || record.date || 'Saved record'}</p></div>
          <small>{record.date ? new Date(record.date).toLocaleDateString() : record.status || ''}</small>
        </article>)}</div> : <div className="farmer-workspace-empty"><span className="material-symbols-outlined">inventory_2</span><h2>No records here yet</h2><p>New records saved in this workspace will appear here.</p></div>}
      </section>
    </main>
  );
}