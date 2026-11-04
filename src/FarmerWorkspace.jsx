import { useMemo, useState } from 'react';
import { calculateFarmerTrust } from './lib/farmer-trust';
import AgrishopNetwork from './AgrishopNetwork';
import EquipmentRentalWorkspace from './EquipmentRentalWorkspace';
import ExportReadinessWorkspace from './ExportReadinessWorkspace';
import HabariIntelligence from './HabariIntelligence';
import TransportLogisticsWorkspace from './TransportLogisticsWorkspace';
import {
  calculateFieldAreaSquareMeters,
  calculateFieldPerimeterMeters,
  createFieldGeoJson,
  formatFarmCoordinate,
  squareMetersPerAcre,
} from './lib/farm-geometry';
import LabourWorkspace from './LabourWorkspace';
import LivestockWorkspace from './LivestockWorkspace';
import ProductionProfileWorkspace from './ProductionProfileWorkspace';
import RamaniMapPage from './RamaniMapPage';
import SpaceRentalWorkspace from './SpaceRentalWorkspace';
import SprayDiaryWorkspace from './SprayDiaryWorkspace';
import HarvestPredictionWorkspace from './HarvestPredictionWorkspace';

const workspaceDetails = {
  fields: { title: 'Digital Farm', icon: 'agriculture', description: 'Register fields and keep their crop and area records together.', recordType: 'fields', submitLabel: 'Add field', fields: [['name', 'Field name', 'text'], ['crop', 'Crop', 'text'], ['area', 'Area (acres)', 'number']] },
  trust: { title: 'Trust Score', icon: 'verified_user', description: 'Your profile completeness score and the records that support it.', recordType: 'activities' },
  listings: { title: 'Active Listings', icon: 'storefront', description: 'Manage produce listings and open the marketplace to publish or update an offer.', recordType: 'listings' },
  income: { title: 'Season Income', icon: 'payments', description: 'Keep a local ledger of crop sales and season income.', recordType: 'income', submitLabel: 'Record income', fields: [['crop', 'Produce', 'text'], ['amount', 'Amount (TZS)', 'number'], ['date', 'Sale date', 'date'], ['note', 'Buyer or note', 'text']] },
  livestock: { title: 'Livestock Management', icon: 'pets', description: 'Register animals, track milk production, and keep health and local price records together.', recordType: 'livestock' },
  groups: { title: 'My Groups', icon: 'groups', description: 'Track your farmer groups and open community conversations.', recordType: 'groups', submitLabel: 'Join group', fields: [['name', 'Group name', 'text'], ['region', 'Region', 'text']] },
  loans: { title: 'Loan Applications', icon: 'account_balance', description: 'Prepare an application record for a farm or input loan.', recordType: 'requests', submitLabel: 'Save loan request', fields: [['title', 'Loan purpose', 'text'], ['amount', 'Amount requested (TZS)', 'number'], ['details', 'Additional details', 'textarea']] },
  'smart-loan': { title: 'Smart Loan', icon: 'psychology', description: 'Create a loan request using your saved farm and income records.', recordType: 'requests', submitLabel: 'Save smart-loan request', fields: [['title', 'Loan purpose', 'text'], ['amount', 'Amount requested (TZS)', 'number'], ['details', 'How will the loan be used?', 'textarea']] },
  experts: { title: 'Expert Support', icon: 'support_agent', description: 'Describe the topic you need help with and save an expert request.', recordType: 'requests', submitLabel: 'Request expert help', fields: [['title', 'Topic', 'text'], ['details', 'What do you need help with?', 'textarea']] },
  transport: { title: 'Harvest-to-Market Logistics', icon: 'local_shipping', description: 'Plan an illustrative harvest transport and storage estimate.', recordType: 'requests', submitLabel: 'Save transport request', fields: [['title', 'Route or destination', 'text'], ['amount', 'Load size (kg)', 'number'], ['details', 'Cargo and pickup details', 'textarea']] },
  activity: { title: 'Farm Activity Log', icon: 'edit_calendar', description: 'Record completed farm work. Activity entries are stored on this device.', recordType: 'activities', submitLabel: 'Log activity', fields: [['title', 'Activity', 'text'], ['date', 'Date', 'date'], ['details', 'Field, crop, or notes', 'textarea']] },
  'rent-space': { title: 'Rent Space or Land', icon: 'landscape', description: 'Save a request for land, storage, or farm space.', recordType: 'requests', submitLabel: 'Save space request', fields: [['title', 'Space needed', 'text'], ['amount', 'Area or capacity', 'number'], ['details', 'Location and dates', 'textarea']] },
  'equipment-rent': { title: 'Rent Farm Equipment', icon: 'precision_manufacturing', description: 'Browse illustrative machinery listings and save local rental notes.', recordType: 'requests' },
  labour: { title: 'Vibarua Network', icon: 'engineering', description: 'Find work, organise worker profiles, and manage hire requests.', recordType: 'requests' },
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
  payroll: { title: 'Payroll & Labour', icon: 'payments', description: 'Manage labour contracts and keep a clear record of wages paid.', recordType: 'payroll' },
  carbon: { title: 'Carbon Credits', icon: 'eco', description: 'Record a climate-smart practice for follow-up.', recordType: 'activities', submitLabel: 'Save practice', fields: [['title', 'Practice', 'text'], ['date', 'Date started', 'date'], ['details', 'Field and practice notes', 'textarea']] },
  crowdfunding: { title: 'Crowdfunding', icon: 'volunteer_activism', description: 'Save a farm project idea to prepare for a funding request.', recordType: 'requests', submitLabel: 'Save project idea', fields: [['title', 'Project', 'text'], ['amount', 'Funding goal (TZS)', 'number'], ['details', 'Project summary', 'textarea']] },
  foundation: { title: 'AGRI-NEST Foundation', icon: 'groups_2', description: 'Record a request for community or extension support.', recordType: 'requests', submitLabel: 'Save support request', fields: [['title', 'Support needed', 'text'], ['details', 'Location and request details', 'textarea']] },
};

const formatTzs = (amount) => `TZS ${Number(amount || 0).toLocaleString('en-TZ')}`;

function createRecordId() {
  return globalThis.crypto?.randomUUID?.() || `record-${Date.now()}`;
}

const savedMapFieldsKey = 'agrinest-ramani-drawn-fields';
const savedMapNotesKey = 'agrinest-ramani-field-notes';

function readSavedBoundary(field) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(savedMapFieldsKey) || '[]');
    if (!Array.isArray(saved)) return null;
    const fieldName = String(field.name || '').trim().toLowerCase();
    return saved.find((plot) => plot?.saved
      && String(plot.name || '').trim().toLowerCase() === fieldName
      && Array.isArray(plot.points)
      && plot.points.length >= 3
      && plot.points.every((point) => Array.isArray(point)
        && Number.isFinite(Number(point[0]))
        && Number.isFinite(Number(point[1]))
        && Math.abs(Number(point[0])) <= 90
        && Math.abs(Number(point[1])) <= 180)) || null;
  } catch {
    return null;
  }
}

function readFieldMapNotes(field, boundary) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(savedMapNotesKey) || '[]');
    if (!Array.isArray(saved)) return [];
    const plotId = boundary?.id || boundary?.name;
    return saved.filter((note) => note && (note.plotId === plotId
      || String(note.plotName || '').trim().toLowerCase() === String(field.name || '').trim().toLowerCase()));
  } catch {
    return [];
  }
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function compressFarmPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Choose an image file.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Choose an image smaller than 8 MB.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const maxDimension = 1280;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Photo processing is unavailable in this browser.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        if (dataUrl.length > 700_000) {
          throw new Error('This photo is still too large to save offline. Choose a smaller image.');
        }
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected image could not be opened.'));
    };
    image.src = objectUrl;
  });
}

function FieldDataProfile({ field, profile, activities, onBack, onNavigate, onUpdateField }) {
  const boundary = useMemo(() => readSavedBoundary(field), [field.id, field.name]);
  const notes = useMemo(() => readFieldMapNotes(field, boundary), [field.id, field.name, boundary]);
  const [mapLayer, setMapLayer] = useState('satellite');
  const [showGeoJson, setShowGeoJson] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAudience, setShareAudience] = useState('extension officer');
  const [includeBoundary, setIncludeBoundary] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [shareConsent, setShareConsent] = useState(false);
  const [notice, setNotice] = useState('');
  const [soilOpen, setSoilOpen] = useState(false);
  const [soilDraft, setSoilDraft] = useState(() => ({
    type: field.soil?.type || '',
    pH: field.soil?.pH || '',
    organicMatter: field.soil?.organicMatter || '',
    sampleDate: field.soil?.sampleDate || '',
    source: field.soil?.source || 'farmer estimate',
    notes: field.soil?.notes || '',
  }));
  const geoJson = useMemo(() => createFieldGeoJson(field, boundary), [field, boundary]);
  const areaSquareMeters = boundary ? calculateFieldAreaSquareMeters(boundary.points) : null;
  const perimeterMeters = boundary ? calculateFieldPerimeterMeters(boundary.points) : null;
  const boundaryAreaAcres = boundary ? areaSquareMeters / squareMetersPerAcre : null;
  const recordedAreaAcres = Number(field.area || 0);
  const gpsAccuracy = Number(boundary?.gpsAccuracy);
  const gpsPrecision = Number.isFinite(gpsAccuracy) && gpsAccuracy > 0
    ? `${gpsAccuracy < 10 ? gpsAccuracy.toFixed(1) : Math.round(gpsAccuracy)} m`
    : '';
  const areaMismatch = boundary && recordedAreaAcres > 0
    && Math.abs(boundaryAreaAcres - recordedAreaAcres) > Math.max(0.1, recordedAreaAcres * 0.1);
  const auditEntries = [
    ...(field.createdAt ? [{ activity: 'Field record created', recordedBy: profile.name, date: field.createdAt, status: 'Local record', icon: 'edit_note' }] : []),
    ...(field.soil?.recordedAt ? [{
      activity: 'Soil record updated',
      recordedBy: profile.name,
      date: field.soil.recordedAt,
      status: field.soil.source || 'Farmer record',
      icon: 'science',
    }] : []),
    ...(boundary ? [{
      activity: boundary.boundarySource === 'gps' ? 'GPS boundary captured' : 'Field boundary saved',
      recordedBy: profile.name,
      date: boundary.updatedAt || boundary.createdAt,
      status: 'Saved on device',
      icon: 'polyline',
    }] : []),
    ...activities.map((activity) => ({
      activity: activity.category || activity.title || 'Farm activity',
      recordedBy: activity.gpsStamp ? 'GPS field log' : profile.name,
      date: activity.date || activity.createdAt,
      status: activity.gpsStamp ? 'GPS recorded' : 'Recorded',
      icon: activity.gpsStamp ? 'sensors' : 'edit_note',
    })),
    ...notes.map((note) => ({
      activity: `${note.category || 'Field'} note`,
      recordedBy: profile.name,
      date: note.date,
      status: 'Local note',
      icon: 'sticky_note_2',
    })),
  ].filter((entry) => entry.date).sort((left, right) => new Date(right.date) - new Date(left.date));
  const batchCount = activities.filter((activity) => /harvest|batch/i.test(`${activity.category || ''} ${activity.title || ''}`)).length;
  const trustScore = calculateFarmerTrust(profile).score;
  const filenameBase = String(field.name || 'field').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'field';

  const prepareShareFile = () => {
    if (!shareConsent) {
      setNotice('Confirm that you have permission to share this field data before preparing the file.');
      return;
    }
    const summary = {
      title: 'AGRI-NEST field data summary',
      audience: shareAudience,
      createdAt: new Date().toISOString(),
      notice: 'This file does not grant account access. Review its contents before sharing.',
      field: {
        name: field.name,
        crop: field.crop,
        areaAcres: Number(field.area || 0),
        areaHectares: Number(field.area || 0) * 0.40468564224,
        plantingDate: field.plantedOn || '',
        season: field.season || '',
        expectedHarvest: field.expectedHarvest || '',
        seedVariety: field.seedVariety || '',
        fertilizer: field.fertilizer || '',
        soil: field.soil || null,
        ...(includeLocation && profile.location ? { farmLocation: profile.location } : {}),
        ...(includeBoundary && boundary ? { boundaryGeoJson: geoJson.features[0] } : {}),
        ...(includeNotes ? { notes: notes.map(({ category, text, date }) => ({ category, text, date })) } : {}),
      },
    };
    downloadJsonFile(`agrinest-field-share-${filenameBase}.json`, summary);
    setShareOpen(false);
    setShareConsent(false);
    setNotice('A private field summary was prepared for review. No account access was granted.');
  };

  const exportFieldCertificate = () => {
    downloadJsonFile(`agrinest-field-record-${filenameBase}.json`, {
      documentType: 'AGRI-NEST field data record',
      generatedAt: new Date().toISOString(),
      verification: boundary ? 'Boundary saved locally; not independently verified by an authority.' : 'No saved boundary is attached to this field record.',
      disclaimer: 'This is a farmer-provided digital field record, not a land title, government certificate, or proof of ownership.',
      field: {
        name: field.name,
        crop: field.crop,
        areaAcres: Number(field.area || 0),
        areaHectares: Number(field.area || 0) * 0.40468564224,
        plantingDate: field.plantedOn || '',
        season: field.season || '',
        expectedHarvest: field.expectedHarvest || '',
        seedVariety: field.seedVariety || '',
        fertilizer: field.fertilizer || '',
        soil: field.soil || null,
        ...(boundary ? { geometry: geoJson.features[0].geometry } : {}),
      },
    });
    setNotice('Field record exported. It is not an official land certificate or proof of ownership.');
  };

  return (
    <main className="farmer-workspace field-profile-page" aria-label={`Field profile for ${field.name}`}>
      {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <header className="field-profile-heading">
        <div>
          <button type="button" className="field-profile-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Back to Digital Farm</button>
          <div className="field-profile-breadcrumb"><span>REGISTRY</span><span className="material-symbols-outlined">chevron_right</span><span>FIELDS</span></div>
          <h1>Field Data Profile — {field.name} <span>({field.crop || 'Crop not set'})</span></h1>
          <span className={boundary ? 'field-profile-badge is-saved' : 'field-profile-badge'}>
            <span className="material-symbols-outlined">{boundary ? 'check_circle' : 'pending'}</span>
            {boundary ? 'Boundary saved on device' : 'Field record · boundary not linked'}
          </span>
        </div>
        <div className="field-profile-actions">
          <button type="button" className="field-profile-secondary" onClick={() => { setShareOpen(true); setNotice(''); }}><span className="material-symbols-outlined">share</span>Share Access</button>
          <button type="button" className="field-profile-primary" onClick={exportFieldCertificate}><span className="material-symbols-outlined">download</span>Export Certificate</button>
        </div>
      </header>

      <section className="field-profile-soil">
        <div>
          <span className="farmer-workspace-eyebrow">CROP &amp; SOIL RECORD</span>
          <h2>{field.seedVariety || 'Seed variety not recorded'}</h2>
          <p>
            {field.plantedOn ? `Planted ${formatFarmDate(field.plantedOn)}` : 'Planting date not recorded'}
            {field.expectedHarvest ? ` · Expected harvest ${formatFarmDate(field.expectedHarvest)}` : ''}
            {field.fertilizer ? ` · Fertilizer: ${field.fertilizer}` : ''}
          </p>
          {field.soil ? (
            <p className="field-profile-soil-details">
              Soil: {field.soil.type || 'Type not recorded'}
              {field.soil.pH ? ` · pH ${field.soil.pH}` : ''}
              {field.soil.organicMatter ? ` · Organic matter ${field.soil.organicMatter}%` : ''}
              {field.soil.sampleDate ? ` · Sampled ${formatFarmDate(field.soil.sampleDate)}` : ''}
              {' · '}{field.soil.source || 'Farmer record'}
            </p>
          ) : <p>No soil record yet. Add a lab result summary or a clearly labeled estimate.</p>}
          <small>Farmer-entered data; lab results are not independently validated by AGRI-NEST.</small>
        </div>
        <button type="button" className="field-profile-secondary" onClick={() => {
          setSoilDraft({
            type: field.soil?.type || '',
            pH: field.soil?.pH || '',
            organicMatter: field.soil?.organicMatter || '',
            sampleDate: field.soil?.sampleDate || '',
            source: field.soil?.source || 'farmer estimate',
            notes: field.soil?.notes || '',
          });
          setSoilOpen(true);
        }}><span className="material-symbols-outlined">science</span>{field.soil ? 'Update soil record' : 'Add soil record'}</button>
      </section>

      <section className="field-profile-layout">
        <article className="field-profile-geometry">
          <div className="field-profile-card-heading">
            <div>
              <h2>Live Field Geometry</h2>
              <p><span className="material-symbols-outlined">sync</span>{boundary
                ? `Saved ${new Date(boundary.updatedAt || boundary.createdAt || field.createdAt).toLocaleString()}${gpsPrecision ? ` · GPS precision ±${gpsPrecision}` : ' · precision not recorded'}`
                : 'No saved boundary found for this field.'}</p>
            </div>
            {boundary && <div className="field-profile-layer-switch" aria-label="Basemap">
              <button type="button" className={mapLayer === 'satellite' ? 'active' : ''} onClick={() => setMapLayer('satellite')}>Satellite</button>
              <button type="button" className={mapLayer === 'terrain' ? 'active' : ''} onClick={() => setMapLayer('terrain')}>Topography</button>
            </div>}
          </div>
          {boundary ? (
            <>
              <div className="field-profile-map">
                <RamaniMapPage profile={profile} search="" onSearch={() => {}} compact focusPlotName={field.name} initialLayer={mapLayer} />
                <div className="field-profile-measures">
                  <div><small>AREA MEASUREMENT</small><strong>{boundaryAreaAcres.toFixed(2)} Acres <span>/ {(areaSquareMeters / 10000).toFixed(2)} Ha</span></strong></div>
                  <div><small>PERIMETER</small><strong>{perimeterMeters >= 1000 ? `${(perimeterMeters / 1000).toFixed(2)} km` : `${Math.round(perimeterMeters)} m`}</strong></div>
                </div>
              </div>
              {areaMismatch && <p className="field-profile-area-warning" role="status">GIS boundary measures {boundaryAreaAcres.toFixed(2)} acres; the field record lists {recordedAreaAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} acres. Review the boundary before sharing.</p>}
            </>
          ) : (
            <div className="field-profile-map-empty">
              <span className="material-symbols-outlined">polyline</span>
              <strong>Draw or save this field&apos;s boundary in Ramani GIS</strong>
              <p>Your field record is saved. Open the map to capture a GPS boundary, then save it with the same field name.</p>
              <button type="button" onClick={() => onNavigate('ramani')}>Open GIS tools</button>
            </div>
          )}
        </article>

        <aside className="field-profile-vertices">
          <div className="field-profile-card-heading"><h2>Vertex Data</h2><span className="material-symbols-outlined">location_on</span></div>
          {boundary ? (
            <>
              <div className="field-profile-vertex-list">{boundary.points.map(([latitude, longitude], index) => (
                <div className="field-profile-vertex" key={`${latitude}-${longitude}-${index}`}>
                  <div><strong>P{index + 1}{index === 0 ? ' (Origin)' : ''}</strong><code>{formatFarmCoordinate(latitude, true)}, {formatFarmCoordinate(longitude, false)}</code></div>
                  <span className="material-symbols-outlined">location_on</span>
                </div>
              ))}</div>
              <button type="button" className="field-profile-geojson-toggle" aria-expanded={showGeoJson} onClick={() => setShowGeoJson((open) => !open)}>{showGeoJson ? 'Hide GeoJSON' : 'View Full GeoJSON'}</button>
              {showGeoJson && <pre className="field-profile-geojson">{JSON.stringify(geoJson, null, 2)}</pre>}
            </>
          ) : <p className="field-profile-no-vertices">Vertex coordinates appear here after you save this field&apos;s boundary in GIS.</p>}
        </aside>
      </section>

      <section className="field-profile-integrations">
        <div className="field-profile-section-title"><h2>Ecosystem Integration</h2><span /></div>
        <div className="field-profile-integration-grid">
          <button type="button" className="field-profile-integration" onClick={() => onNavigate('trust')}>
            <span className="field-profile-integration-top"><span className="material-symbols-outlined">payments</span><small>{trustScore} / 1000</small></span><strong>Finance (Benki)</strong><p>Profile completeness score. Lender eligibility is assessed separately.</p>
          </button>
          <button type="button" className="field-profile-integration" onClick={() => onNavigate('compliance')}>
            <span className="field-profile-integration-top"><span className="material-symbols-outlined">gavel</span><small>REVIEW NEEDED</small></span><strong>Compliance</strong><p>No official certification or export compliance is recorded for this field.</p>
          </button>
          <button type="button" className="field-profile-integration" onClick={() => onNavigate('jicho')}>
            <span className="field-profile-integration-top"><span className="material-symbols-outlined">visibility</span><small>AVAILABLE</small></span><strong>Jicho AI</strong><p>Open crop diagnosis to review evidence from this field.</p>
          </button>
          <button type="button" className="field-profile-integration" onClick={() => onNavigate('traceability')}>
            <span className="field-profile-integration-top"><span className="material-symbols-outlined">qr_code_2</span><small>{batchCount ? `${batchCount} RECORDS` : 'NO BATCHES'}</small></span><strong>Traceability</strong><p>{batchCount ? 'Harvest or batch activity is recorded for this field.' : 'Record harvest and batch activity to build field traceability.'}</p>
          </button>
        </div>
      </section>

      <section className="field-profile-audit">
        <div className="field-profile-audit-heading"><h2>Field Lifecycle &amp; Audit Log</h2><span><span className="material-symbols-outlined">history</span>{auditEntries.length} records</span></div>
        {auditEntries.length ? <div className="field-profile-table-wrap"><table>
          <thead><tr><th>Activity</th><th>Recorded by</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>{auditEntries.map((entry, index) => <tr key={`${entry.activity}-${entry.date}-${index}`}>
            <td><span className="field-profile-audit-activity"><span className="material-symbols-outlined">{entry.icon}</span>{entry.activity}</span></td>
            <td>{entry.recordedBy || 'Farmer record'}</td>
            <td>{new Date(entry.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
            <td><span className="field-profile-audit-status">{entry.status}</span></td>
          </tr>)}</tbody>
        </table></div> : <p className="field-profile-empty-audit">Field and boundary actions will appear here as you save records.</p>}
      </section>

      {soilOpen && <div className="field-profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSoilOpen(false); }}>
        <section className="field-profile-share-modal" role="dialog" aria-modal="true" aria-labelledby="field-profile-soil-title">
          <div className="field-profile-modal-heading"><div><span className="farmer-workspace-eyebrow">FIELD DATA</span><h2 id="field-profile-soil-title">Soil record</h2></div><button type="button" aria-label="Close soil record" onClick={() => setSoilOpen(false)}><span className="material-symbols-outlined">close</span></button></div>
          <form onSubmit={(event) => {
            event.preventDefault();
            onUpdateField({ ...field, soil: { ...soilDraft, recordedAt: new Date().toISOString() } });
            setSoilOpen(false);
            setNotice('Soil record saved on this device. Estimates and lab details are farmer-provided.');
          }}>
            <label>Soil type<input value={soilDraft.type} onChange={(event) => setSoilDraft((current) => ({ ...current, type: event.target.value }))} placeholder="e.g. loam, clay, sand" /></label>
            <label>Record source<select value={soilDraft.source} onChange={(event) => setSoilDraft((current) => ({ ...current, source: event.target.value }))}><option>farmer estimate</option><option>soil laboratory</option></select></label>
            <label>pH (optional)<input type="number" min="0" max="14" step="0.1" value={soilDraft.pH} onChange={(event) => setSoilDraft((current) => ({ ...current, pH: event.target.value }))} /></label>
            <label>Organic matter % (optional)<input type="number" min="0" max="100" step="0.1" value={soilDraft.organicMatter} onChange={(event) => setSoilDraft((current) => ({ ...current, organicMatter: event.target.value }))} /></label>
            <label>Sample or result date<input type="date" value={soilDraft.sampleDate} onChange={(event) => setSoilDraft((current) => ({ ...current, sampleDate: event.target.value }))} /></label>
            <label>Lab or field notes<textarea value={soilDraft.notes} onChange={(event) => setSoilDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional lab name, texture notes, or result reference" /></label>
            <p className="digital-farm-dialog-note">This stores a farmer-entered record only; it does not estimate pH from a photo or verify a laboratory report.</p>
            <div className="field-profile-modal-actions"><button type="button" className="field-profile-secondary" onClick={() => setSoilOpen(false)}>Cancel</button><button type="submit" className="field-profile-primary">Save soil record</button></div>
          </form>
        </section>
      </div>}

      {shareOpen && <div className="field-profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}>
        <section className="field-profile-share-modal" role="dialog" aria-modal="true" aria-labelledby="field-profile-share-title">
          <div className="field-profile-modal-heading"><div><span className="farmer-workspace-eyebrow">PRIVATE FIELD DATA</span><h2 id="field-profile-share-title">Prepare a share file</h2></div><button type="button" aria-label="Close share options" onClick={() => setShareOpen(false)}><span className="material-symbols-outlined">close</span></button></div>
          <p>Choose what to include. This prepares a file for you to review and share; it does not grant anyone account access.</p>
          <label>Intended recipient<select value={shareAudience} onChange={(event) => setShareAudience(event.target.value)}><option>extension officer</option><option>co-operative</option><option>lender</option></select></label>
          {boundary && <label className="field-profile-share-check"><input type="checkbox" checked={includeBoundary} onChange={(event) => setIncludeBoundary(event.target.checked)} />Include precise field boundary</label>}
          <label className="field-profile-share-check"><input type="checkbox" checked={includeNotes} onChange={(event) => setIncludeNotes(event.target.checked)} />Include field notes ({notes.length})</label>
          <label className="field-profile-share-check"><input type="checkbox" checked={includeLocation} onChange={(event) => setIncludeLocation(event.target.checked)} />Include farm location</label>
          <label className="field-profile-share-check field-profile-share-consent"><input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)} />I have permission to share this data and understand that precise farm locations are sensitive.</label>
          <div className="field-profile-modal-actions"><button type="button" className="field-profile-secondary" onClick={() => setShareOpen(false)}>Cancel</button><button type="button" className="field-profile-primary" onClick={prepareShareFile}><span className="material-symbols-outlined">download</span>Prepare file</button></div>
        </section>
      </div>}
    </main>
  );
}

export default function FarmerWorkspace({ page, user, search = '', onSearch, profile, records, farmRecordsSyncStatus = 'loading', onRetryFarmRecordsSync, liveListingCount = 0, weather, weatherStatus, onRecordsChange, onProfileSave, onNavigate, onBack }) {
  const details = workspaceDetails[page] || { title: page.replaceAll('-', ' '), icon: 'dashboard', description: 'Record and manage this part of your farm account.', recordType: 'requests', submitLabel: 'Save record', fields: [['title', 'Name', 'text'], ['details', 'Details', 'textarea']] };
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState('');
  const trust = calculateFarmerTrust(profile);
  if (page === 'harvest-prediction') {
    return <HarvestPredictionWorkspace fields={records.fields} activities={records.activities} onNavigate={onNavigate} />;
  }
  if (page === 'market-news') {
    return <HabariIntelligence
      weather={weather}
      weatherStatus={weatherStatus}
      search={search}
      onSearch={onSearch}
      onNavigate={onNavigate}
      onRecordsChange={onRecordsChange}
      records={records}
    />;
  }

  if (page === 'agrishop') {
    return <AgrishopNetwork
      user={user}
      profile={profile}
      records={records}
      onRecordsChange={onRecordsChange}
      search={search}
      onSearch={onSearch}
    />;
  }

  if (page === 'transport') {
    return <TransportLogisticsWorkspace
      user={user}
      profile={profile}
      records={records}
      onRecordsChange={onRecordsChange}
    />;
  }

  if (page === 'compliance') {
    return <ExportReadinessWorkspace
      records={records}
      fields={records.fields}
      onRecordsChange={onRecordsChange}
      onBack={onBack}
    />;
  }

  if (page === 'spray-diary') {
    return <SprayDiaryWorkspace
      records={records.activities}
      fields={records.fields}
      weather={weather}
      weatherStatus={weatherStatus}
      onRecordsChange={onRecordsChange}
      onBack={onBack}
      onNavigate={onNavigate}
    />;
  }

  const recordsForPage = page === 'trust' || page === 'analytics' || page === 'farm-erp'
    ? records.activities
    : page === 'listings'
      ? records.listings
      : page === 'livestock'
        ? records.livestock
        : records[details.recordType].filter((record) => details.recordType !== 'requests' || record.module === page);
  const seasonIncome = records.income.reduce((total, entry) => total + Number(entry.amount || 0), 0);

  if (page === 'livestock') {
    return <LivestockWorkspace
      profile={profile}
      records={records}
      search={search}
      onSearch={onSearch}
      onRecordsChange={onRecordsChange}
      onProfileSave={onProfileSave}
      onBack={onBack}
    />;
  }

  if (page === 'production') {
    return <ProductionProfileWorkspace profile={profile} onProfileSave={onProfileSave} onBack={onBack} />;
  }

  if (page === 'rent-space') {
    return <SpaceRentalWorkspace user={user} profile={profile} search={search} />;
  }

  if (page === 'equipment-rent') {
    return <EquipmentRentalWorkspace mode="browse" user={user} profile={profile} onBack={onBack} />;
  }

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

  if (page === 'fields') {
    return (
      <DigitalFarmPage
        profile={profile}
        records={records}
        farmRecordsSyncStatus={farmRecordsSyncStatus}
        onRetryFarmRecordsSync={onRetryFarmRecordsSync}
        onRecordsChange={onRecordsChange}
        onProfileSave={onProfileSave}
        onNavigate={onNavigate}
      />
    );
  }

  if (page === 'labour' || page === 'payroll') {
    return <LabourWorkspace
      page={page}
      profile={profile}
      records={records}
      onRecordsChange={onRecordsChange}
      onBack={onBack}
      onNavigate={onNavigate}
    />;
  }

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

const farmActivityTypes = [
  ['Irrigation', 'water_drop'],
  ['Spraying', 'pest_control'],
  ['Weeding', 'grass'],
  ['Planting', 'eco'],
  ['Fertilizer', 'compost'],
  ['Pest observation', 'bug_report'],
  ['Flooding', 'flood'],
  ['Harvest', 'agriculture'],
  ['Other', 'edit_note'],
];

const localDateTimeValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const acresToHectares = (acres) => Number(acres || 0) * 0.4046856422;

function formatFarmDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return 'Date not recorded';
  const valueString = String(value);
  const datePart = valueString.slice(0, 10).split('-');
  if (datePart.length !== 3) return 'Date not recorded';
  const date = valueString.includes('T')
    ? new Date(valueString)
    : new Date(Number(datePart[0]), Number(datePart[1]) - 1, Number(datePart[2]));
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleDateString(undefined, options);
}

function DigitalFarmPage({ profile, records, farmRecordsSyncStatus, onRetryFarmRecordsSync, onRecordsChange, onProfileSave, onNavigate }) {
  const [dialog, setDialog] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [fieldDraft, setFieldDraft] = useState({ name: '', crop: '', area: '', plantedOn: '', expectedHarvest: '', season: '', seedVariety: '', fertilizer: '' });
  const [livestockDraft, setLivestockDraft] = useState({ species: '', breed: '', count: '1', age: '', earTag: '', health: 'healthy', lastWeight: '' });
  const [activityDraft, setActivityDraft] = useState({ category: farmActivityTypes[0][0], fieldId: '', date: localDateTimeValue(), details: '' });
  const [gpsStamp, setGpsStamp] = useState(null);
  const [activityPhoto, setActivityPhoto] = useState('');
  const [gpsMessage, setGpsMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');
  const [fieldFilter, setFieldFilter] = useState('all');

  const fields = records.fields;
  const livestockRecords = Array.isArray(records.livestock) ? records.livestock : [];
  const farmActivities = records.activities.filter((item) => item.module === 'activity' || (item.category && (item.fieldId || item.verification)));
  const acres = fields.reduce((total, field) => total + (Number(field.area) || 0), 0);
  const activeCrops = new Set(fields.map((field) => String(field.crop || '').trim().toLowerCase()).filter(Boolean)).size;
  const filteredActivities = farmActivities
    .filter((item) => activityFilter === 'all' || (item.category || item.title) === activityFilter)
    .filter((item) => fieldFilter === 'all' || item.fieldId === fieldFilter)
    .sort((left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0));
  const farmRecordSyncLabels = {
    loading: 'Checking sync status…',
    syncing: 'Syncing to your account…',
    synced: 'Synced to your account',
    pending: 'Saved here · waiting to sync',
    offline: 'Offline · saved here, waiting to sync',
    local: 'Saved here · account sync unavailable',
  };

  const exportFarmBackup = () => {
    try {
      const backup = {
        documentType: 'AGRI-NEST farmer-entered farm data backup',
        generatedAt: new Date().toISOString(),
        notice: 'Farmer-provided records; this file is not independent verification or proof of land ownership.',
        records,
        mapBoundaries: JSON.parse(window.localStorage.getItem(savedMapFieldsKey) || '[]'),
        mapNotes: JSON.parse(window.localStorage.getItem(savedMapNotesKey) || '[]'),
      };
      downloadJsonFile(`agrinest-farm-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
      setNotice('Farm backup downloaded. Keep it somewhere private and secure.');
    } catch (error) {
      setNotice(`Could not create farm backup: ${error.message}`);
    }
  };

  const openActivityDialog = () => {
    setActivityDraft({ category: farmActivityTypes[0][0], fieldId: '', date: localDateTimeValue(), details: '' });
    setGpsStamp(null);
    setActivityPhoto('');
    setGpsMessage('');
    setNotice('');
    setDialog('activity');
  };

  const saveField = (event) => {
    event.preventDefault();
    const name = fieldDraft.name.trim();
    const crop = fieldDraft.crop.trim();
    const area = Number(fieldDraft.area);
    if (!name || !crop || !Number.isFinite(area) || area <= 0) return;
    onRecordsChange('fields', [...fields, {
      ...fieldDraft,
      name,
      crop,
      area,
      id: createRecordId(),
      module: 'fields',
      status: 'Saved locally',
      createdAt: new Date().toISOString(),
    }]);
    setFieldDraft({ name: '', crop: '', area: '', plantedOn: '', expectedHarvest: '', season: '', seedVariety: '', fertilizer: '' });
    setDialog('');
    setNotice('Field record saved on this device. Add its boundary in the GIS map when ready.');
  };

  const saveLivestock = (event) => {
    event.preventDefault();
    const species = livestockDraft.species.trim();
    const count = Number(livestockDraft.count);
    if (!species || !Number.isInteger(count) || count < 1) {
      setNotice('Enter a species and a whole-number head count greater than zero.');
      return;
    }
    const updatedLivestock = [...livestockRecords, {
      ...livestockDraft,
      species,
      count,
      id: createRecordId(),
      module: 'livestock',
      createdAt: new Date().toISOString(),
    }];
    onRecordsChange('livestock', updatedLivestock);
    const activeLivestock = updatedLivestock
      .filter((record) => record.module === 'livestock' && record.species && record.status !== 'sold' && record.status !== 'deceased')
      .reduce((total, record) => total + Number(record.count || 0), 0);
    const existingBaseline = updatedLivestock.find((record) => record.module === 'livestock-baseline');
    const previousRegisteredCount = livestockRecords
      .filter((record) => record.module === 'livestock' && record.species && record.status !== 'sold' && record.status !== 'deceased')
      .reduce((total, record) => total + Number(record.count || 0), 0);
    const baselineCount = existingBaseline
      ? Number(existingBaseline.count || 0)
      : Math.max(0, Number(profile.livestock || 0) - previousRegisteredCount);
    onProfileSave({ ...profile, livestock: String(baselineCount + activeLivestock) });
    setLivestockDraft({ species: '', breed: '', count: '1', age: '', earTag: '', health: 'healthy', lastWeight: '' });
    setDialog('');
    setNotice('Livestock record saved on this device. Animal identity and health have not been independently verified.');
  };

  const updateActivityPhoto = async (file) => {
    if (!file) return;
    try {
      setActivityPhoto(await compressFarmPhoto(file));
      setNotice('');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const stampActivityLocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage('This browser does not support GPS location. You can still save as a manual entry.');
      return;
    }
    setGpsMessage('Requesting location. Allow access if you want to add a GPS stamp.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsStamp({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, stampedAt: new Date().toISOString() });
        setGpsMessage(`GPS stamp ready · approximate accuracy ±${Math.round(coords.accuracy)} m.`);
      },
      (error) => {
        const reason = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your location is unavailable.'
            : 'Location request timed out.';
        setGpsMessage(`${reason} You can still save as a manual entry.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const saveActivity = (event) => {
    event.preventDefault();
    const field = fields.find((item) => item.id === activityDraft.fieldId);
    const activityDate = new Date(activityDraft.date);
    if (Number.isNaN(activityDate.getTime())) {
      setNotice('Choose a valid activity date and time.');
      return;
    }
    onRecordsChange('activities', [...records.activities, {
      id: createRecordId(),
      module: 'activity',
      category: activityDraft.category,
      title: activityDraft.category,
      fieldId: field?.id || '',
      fieldName: field?.name || '',
      details: activityDraft.details.trim(),
      date: activityDate.toISOString(),
      gpsStamp,
      photo: activityPhoto,
      photoAddedAt: activityPhoto ? new Date().toISOString() : '',
      verification: gpsStamp ? 'GPS stamped' : 'Manual entry',
    }]);
    setDialog('');
    setGpsStamp(null);
    setActivityPhoto('');
    setGpsMessage('');
    setNotice(activityPhoto
      ? 'Activity and photo saved on this device. Photo time and location are farmer-provided and not verified.'
      : 'Activity saved on this device without photo evidence.');
  };

  const selectedField = fields.find((field) => field.id === selectedFieldId);
  if (selectedField) {
    const fieldActivities = farmActivities.filter((activity) => activity.fieldId === selectedField.id
      || String(activity.fieldName || '').trim().toLowerCase() === String(selectedField.name || '').trim().toLowerCase());
    return <FieldDataProfile
      field={selectedField}
      profile={profile}
      activities={fieldActivities}
      onBack={() => setSelectedFieldId('')}
      onNavigate={onNavigate}
      onUpdateField={(updatedField) => onRecordsChange('fields', fields.map((field) => field.id === updatedField.id ? updatedField : field))}
    />;
  }

  return (
    <main className="farmer-workspace digital-farm-page" aria-label="Digital Farm">
      {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <header className="digital-farm-heading">
        <div>
          <h1>Shamba Langu</h1>
          <p>Manage your fields, track activities, and monitor your farm records.</p>
        </div>
        <div className="digital-farm-local-status">
          <span className="digital-farm-local-badge" aria-live="polite"><span className="material-symbols-outlined">{farmRecordsSyncStatus === 'synced' ? 'cloud_done' : farmRecordsSyncStatus === 'syncing' ? 'sync' : 'devices'}</span>{farmRecordSyncLabels[farmRecordsSyncStatus] || farmRecordSyncLabels.pending}</span>
          {farmRecordsSyncStatus !== 'synced' && farmRecordsSyncStatus !== 'syncing' && <button type="button" onClick={onRetryFarmRecordsSync}><span className="material-symbols-outlined">sync</span>Retry sync</button>}
          <button type="button" onClick={exportFarmBackup}><span className="material-symbols-outlined">download</span>Download backup</button>
        </div>
      </header>

      <section className="digital-farm-stats" aria-label="Farm summary">
        <article className="digital-farm-stat">
          <span className="material-symbols-outlined">landscape</span>
          <strong>{acres.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
          <small>ACRES RECORDED · {acresToHectares(acres).toLocaleString(undefined, { maximumFractionDigits: 1 })} ha</small>
        </article>
        <article className="digital-farm-stat">
          <span className="material-symbols-outlined">grass</span>
          <strong>{activeCrops}</strong>
          <small>ACTIVE CROPS</small>
        </article>
        <article className="digital-farm-stat">
          <span className="material-symbols-outlined">history</span>
          <strong>{farmActivities.length}</strong>
          <small>ACTIVITY LOGS</small>
        </article>
        <button type="button" className="digital-farm-log-card" onClick={openActivityDialog}>
          <span className="digital-farm-log-icon"><span className="material-symbols-outlined">add</span></span>
          <strong>Log New Activity</strong>
        </button>
      </section>

      <section className="digital-farm-overview">
        <article className="digital-farm-map-card">
          <div className="digital-farm-card-heading">
            <h2><span className="material-symbols-outlined">map</span>Live Farm Map</h2>
            <button type="button" onClick={() => onNavigate('ramani')}><span className="material-symbols-outlined">draw</span>Open GIS tools</button>
          </div>
          <div className="digital-farm-map">
            <RamaniMapPage profile={profile} search="" onSearch={() => {}} compact />
          </div>
          <p className="digital-farm-map-note">Map boundaries and drawings are managed in Ramani GIS.</p>
        </article>

        <section className="digital-farm-fields">
          <div className="digital-farm-fields-heading">
            <h2>My Fields</h2>
            <button type="button" onClick={() => { setFieldDraft({ name: '', crop: '', area: '', plantedOn: '', expectedHarvest: '', season: '', seedVariety: '', fertilizer: '' }); setDialog('field'); }}>Add field</button>
          </div>
          {fields.length ? fields.map((field) => {
            const fieldActivities = farmActivities.filter((activity) => activity.fieldId === field.id);
            return (
              <article className="digital-farm-field-card" key={field.id}>
                <div className="digital-farm-field-main">
                  <span className="digital-farm-crop-icon"><span className="material-symbols-outlined">eco</span></span>
                  <div><h3>{field.name} — {field.crop}</h3><p>{Number(field.area || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} acres · {acresToHectares(field.area).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha{field.plantedOn ? ` · Planted ${formatFarmDate(field.plantedOn, { month: 'short', day: 'numeric' })}` : ''}{field.expectedHarvest ? ` · Harvest ${formatFarmDate(field.expectedHarvest, { month: 'short', day: 'numeric' })}` : ''}</p></div>
                </div>
                <div className="digital-farm-field-meta">
                  <span>{field.season || 'Season not set'}</span>
                  <span>{fieldActivities.length} logged {fieldActivities.length === 1 ? 'activity' : 'activities'}</span>
                </div>
                <div className="digital-farm-field-actions">
                  <button type="button" className="digital-farm-field-profile-link" onClick={() => setSelectedFieldId(field.id)}>View field profile <span className="material-symbols-outlined">arrow_forward</span></button>
                  <button type="button" className="digital-farm-field-journal" onClick={() => { setFieldFilter(field.id); setFilterOpen(true); document.querySelector('.digital-farm-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>View field journal</button>
                </div>
              </article>
            );
          }) : (
            <div className="digital-farm-empty-field">
              <span className="material-symbols-outlined">agriculture</span>
              <h3>No field records yet</h3>
              <p>Add a field record, then draw or trace its boundary in GIS.</p>
              <button type="button" onClick={() => setDialog('field')}>Add your first field</button>
            </div>
          )}
        </section>
      </section>

      <section className="digital-farm-livestock">
        <div className="digital-farm-journal-heading">
          <div><h2>Livestock Register</h2><p>Farmer-entered animal or herd records</p></div>
          <button type="button" onClick={() => setDialog('livestock')}><span className="material-symbols-outlined">add</span>Add livestock</button>
        </div>
        {livestockRecords.length ? <div className="digital-farm-livestock-grid">{livestockRecords.map((animal) => (
          <article className="digital-farm-livestock-card" key={animal.id}>
            <span className="material-symbols-outlined">pets</span>
            <div><strong>{animal.count || 1} {animal.species || 'Animal'}{Number(animal.count || 1) === 1 ? '' : 's'}</strong>
              <p>{[animal.breed, animal.age ? `Age: ${animal.age}` : '', animal.earTag ? `Tag: ${animal.earTag}` : ''].filter(Boolean).join(' · ') || 'No breed or tag details recorded'}</p>
              <small>Health: {animal.health || 'Not recorded'}{animal.lastWeight ? ` · Last weight: ${animal.lastWeight} kg` : ''}</small>
            </div>
          </article>
        ))}</div> : <p className="digital-farm-livestock-empty">No livestock records yet. Add an animal or group to start your register.</p>}
        <small className="digital-farm-record-disclaimer">Records are farmer-provided. AGRI-NEST has not verified individual animals, tags, or health.</small>
      </section>

      <section className="digital-farm-journal">
        <div className="digital-farm-journal-heading">
          <div><h2>Digital Journal</h2><p>Field work recorded by you</p></div>
          <button type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}><span className="material-symbols-outlined">filter_list</span>Filter</button>
        </div>
        {filterOpen && <div className="digital-farm-filters">
          <label>Activity<select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}><option value="all">All activities</option>{farmActivityTypes.map(([name]) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Field<select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)}><option value="all">All fields</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
        </div>}
        {filteredActivities.length ? (
          <div className="digital-farm-journal-table-wrap">
            <table className="digital-farm-journal-table">
              <thead><tr><th>Date</th><th>Field</th><th>Activity</th><th className="digital-farm-notes-column">Notes / photo</th><th>Location</th></tr></thead>
              <tbody>{filteredActivities.map((activity) => {
                const category = activity.category || activity.title || 'Activity';
                const icon = farmActivityTypes.find(([name]) => name === category)?.[1] || 'edit_note';
                return <tr key={activity.id}>
                  <td>{formatFarmDate(activity.date || activity.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}<small>{activity.date && !Number.isNaN(new Date(activity.date).getTime()) ? new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small></td>
                  <td>{activity.fieldName || fields.find((field) => field.id === activity.fieldId)?.name || 'Farm-wide'}</td>
                  <td><span className="digital-farm-activity-pill"><span className="material-symbols-outlined">{icon}</span>{category}</span></td>
                  <td className="digital-farm-notes-column">{activity.details || activity.notes || '—'}{activity.photo && <img className="digital-farm-journal-photo" src={activity.photo} alt={`Photo for ${category} activity`} loading="lazy" />}</td>
                  <td><span className={activity.gpsStamp ? 'digital-farm-gps-stamp' : 'digital-farm-manual-stamp'}><span className="material-symbols-outlined">{activity.gpsStamp ? 'location_on' : 'location_off'}</span>{activity.gpsStamp ? `GPS ±${Math.round(activity.gpsStamp.accuracy)} m` : 'No GPS stamp'}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : <div className="digital-farm-journal-empty"><span className="material-symbols-outlined">edit_calendar</span><strong>{farmActivities.length ? 'No activities match these filters' : 'Your farm journal is ready'}</strong><p>{farmActivities.length ? 'Try another activity or field filter.' : 'Log planting, irrigation, spraying, pests, flooding, or harvest as work happens.'}</p>{!farmActivities.length && <button type="button" onClick={openActivityDialog}>Log your first activity</button>}</div>}
      </section>

      {dialog && <div className="digital-farm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(''); }}>
        <section className="digital-farm-dialog" role="dialog" aria-modal="true" aria-labelledby="digital-farm-dialog-title">
          <div className="digital-farm-dialog-heading"><div><span className="farmer-workspace-eyebrow">{dialog === 'field' ? 'FIELD RECORD' : dialog === 'livestock' ? 'LIVESTOCK REGISTER' : 'FIELD JOURNAL'}</span><h2 id="digital-farm-dialog-title">{dialog === 'field' ? 'Add a field' : dialog === 'livestock' ? 'Add livestock record' : 'Log farm activity'}</h2></div><button type="button" aria-label="Close dialog" onClick={() => setDialog('')}><span className="material-symbols-outlined">close</span></button></div>
          {dialog === 'field' ? <form onSubmit={saveField}>
            <label>Field name<input required value={fieldDraft.name} onChange={(event) => setFieldDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. North field" /></label>
            <label>Crop<input required value={fieldDraft.crop} onChange={(event) => setFieldDraft((current) => ({ ...current, crop: event.target.value }))} placeholder="e.g. Maize" /></label>
            <label>Area (acres)<input required type="number" min="0.01" step="any" value={fieldDraft.area} onChange={(event) => setFieldDraft((current) => ({ ...current, area: event.target.value }))} /></label>
            <label>Planting date<input type="date" value={fieldDraft.plantedOn} onChange={(event) => setFieldDraft((current) => ({ ...current, plantedOn: event.target.value }))} /></label>
            <label>Expected harvest<input type="date" value={fieldDraft.expectedHarvest} onChange={(event) => setFieldDraft((current) => ({ ...current, expectedHarvest: event.target.value }))} /></label>
            <label>Season<input value={fieldDraft.season} onChange={(event) => setFieldDraft((current) => ({ ...current, season: event.target.value }))} placeholder="e.g. 2026 short rains" /></label>
            <label>Seed variety<input value={fieldDraft.seedVariety} onChange={(event) => setFieldDraft((current) => ({ ...current, seedVariety: event.target.value }))} placeholder="Optional" /></label>
            <label>Fertilizer / inputs<input value={fieldDraft.fertilizer} onChange={(event) => setFieldDraft((current) => ({ ...current, fertilizer: event.target.value }))} placeholder="Optional" /></label>
            <p className="digital-farm-dialog-note">Saved on this device. Draw or trace its boundary separately in GIS. Field details are farmer-provided, not land-ownership proof.</p>
            <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">add</span>Save field</button>
          </form> : dialog === 'livestock' ? <form onSubmit={saveLivestock}>
            <label>Species<input required value={livestockDraft.species} onChange={(event) => setLivestockDraft((current) => ({ ...current, species: event.target.value }))} placeholder="e.g. cattle, goats, chickens" /></label>
            <label>Breed<input value={livestockDraft.breed} onChange={(event) => setLivestockDraft((current) => ({ ...current, breed: event.target.value }))} /></label>
            <label>Head count<input required type="number" min="1" step="1" value={livestockDraft.count} onChange={(event) => setLivestockDraft((current) => ({ ...current, count: event.target.value }))} /></label>
            <label>Age or age range<input value={livestockDraft.age} onChange={(event) => setLivestockDraft((current) => ({ ...current, age: event.target.value }))} placeholder="e.g. 2 years or mixed ages" /></label>
            <label>Ear tag (optional)<input value={livestockDraft.earTag} onChange={(event) => setLivestockDraft((current) => ({ ...current, earTag: event.target.value }))} /></label>
            <label>Health status<select value={livestockDraft.health} onChange={(event) => setLivestockDraft((current) => ({ ...current, health: event.target.value }))}><option>healthy</option><option>under treatment</option><option>needs attention</option><option>not assessed</option></select></label>
            <label>Last weight (kg, optional)<input type="number" min="0" step="0.1" value={livestockDraft.lastWeight} onChange={(event) => setLivestockDraft((current) => ({ ...current, lastWeight: event.target.value }))} /></label>
            <p className="digital-farm-dialog-note">This is a farmer-entered register and does not verify animal identity, ear tags, or health.</p>
            <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">pets</span>Save livestock</button>
          </form> : <form onSubmit={saveActivity}>
            <label>Activity<select value={activityDraft.category} onChange={(event) => setActivityDraft((current) => ({ ...current, category: event.target.value }))}>{farmActivityTypes.map(([name]) => <option key={name}>{name}</option>)}</select></label>
            <label>Field<select value={activityDraft.fieldId} onChange={(event) => setActivityDraft((current) => ({ ...current, fieldId: event.target.value }))}><option value="">Farm-wide / not specified</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name} — {field.crop}</option>)}</select></label>
            <label>Date and time<input required type="datetime-local" value={activityDraft.date} onChange={(event) => setActivityDraft((current) => ({ ...current, date: event.target.value }))} /></label>
            <label>Notes<textarea value={activityDraft.details} onChange={(event) => setActivityDraft((current) => ({ ...current, details: event.target.value }))} placeholder="What work was done or observed?" /></label>
            <button type="button" className="digital-farm-gps-button" onClick={stampActivityLocation}><span className="material-symbols-outlined">{gpsStamp ? 'location_on' : 'my_location'}</span>{gpsStamp ? `GPS ready · ±${Math.round(gpsStamp.accuracy)} m` : 'Add current GPS stamp'}</button>
            {gpsMessage && <p className="digital-farm-gps-message" role="status">{gpsMessage}</p>}
            <label>Photo evidence (optional)<input type="file" accept="image/*" capture="environment" onChange={(event) => { updateActivityPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label>
            {activityPhoto && <img className="digital-farm-photo-preview" src={activityPhoto} alt="Selected farm activity evidence" />}
            <p className="digital-farm-dialog-note">GPS is optional. Photos are compressed and saved on this device; the app does not verify when or where a photo was taken. Keep sensitive people or documents out of photos.</p>
            <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">save</span>Save activity</button>
          </form>}
        </section>
      </div>}
    </main>
  );
}