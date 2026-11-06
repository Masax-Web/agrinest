import { useEffect, useMemo, useState } from 'react';
import AgrishopNetwork from './AgrishopNetwork';
import EquipmentRentalWorkspace from './EquipmentRentalWorkspace';
import ExportReadinessWorkspace from './ExportReadinessWorkspace';
import FarmActivityLog from './FarmActivityLog';
import FarmOperationsWorkspace from './FarmOperationsWorkspace';
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
import TrustVerificationWorkspace from './TrustVerificationWorkspace';
import { api } from './lib/api';

const workspaceDetails = {
  fields: { title: 'Digital Farm', icon: 'agriculture', description: 'Register fields and keep their crop and area records together.', recordType: 'fields', submitLabel: 'Add field', fields: [['name', 'Field name', 'text'], ['crop', 'Crop', 'text'], ['area', 'Area (acres)', 'number']] },
  trust: { title: 'Trust & Verification', icon: 'verified_user', description: 'Review your profile completeness, farmer-entered evidence, and verification limits.', recordType: 'activities' },
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
  if (page === 'trust') {
    return <TrustVerificationWorkspace
      profile={profile}
      records={records}
      syncStatus={farmRecordsSyncStatus}
      weatherStatus={weatherStatus}
      onNavigate={onNavigate}
      onBack={onBack}
    />;
  }
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
  if (['fields', 'records', 'production', 'farm-operations', 'activity', 'livestock'].includes(page)) {
    return <DigitalFarmPage
      page={page}
      user={user}
      profile={profile}
      records={records}
      farmRecordsSyncStatus={farmRecordsSyncStatus}
      onRetryFarmRecordsSync={onRetryFarmRecordsSync}
      onRecordsChange={onRecordsChange}
      onProfileSave={onProfileSave}
      onNavigate={onNavigate}
    />;
  }

  const recordsForPage = page === 'analytics' || page === 'farm-erp'
    ? records.activities
    : page === 'listings'
      ? records.listings
      : records[details.recordType].filter((record) => details.recordType !== 'requests' || record.module === page);
  const seasonIncome = records.income.reduce((total, entry) => total + Number(entry.amount || 0), 0);

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
      user={user}
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

      {page === 'analytics' || page === 'farm-erp' ? (
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

const digitalFarmSections = [
  { id: 'fields', label: 'Overview', icon: 'space_dashboard' },
  { id: 'records', label: 'Farm records', icon: 'folder_open' },
  { id: 'activity', label: 'Journal', icon: 'fact_check' },
  { id: 'farm-operations', label: 'Team & operations', icon: 'groups_2' },
];

function DigitalFarmSectionNavigation({ activeSection, onNavigate }) {
  return (
    <nav className="digital-farm-section-nav" aria-label="Digital Farm sections">
      {digitalFarmSections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={activeSection === section.id ? 'active' : ''}
          aria-current={activeSection === section.id ? 'page' : undefined}
          onClick={() => onNavigate(section.id)}
        >
          <span className="material-symbols-outlined">{section.icon}</span>
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function GovernmentIntegrationStatus() {
  return (
    <aside className="digital-farm-government-status" role="note">
      <strong>Official government services</strong>
      <span>NIDA identity · TMA weather · TARI agricultural guidance</span>
      <small>Live API access is not configured. No identity data is sent and no government verification or forecast is simulated; official API documentation and deployment credentials are required.</small>
    </aside>
  );
}

function DigitalFarmPage({ page, user, profile, records, farmRecordsSyncStatus, onRetryFarmRecordsSync, onRecordsChange, onProfileSave, onNavigate }) {
  const [dialog, setDialog] = useState('');
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [recordView, setRecordView] = useState('index');
  const [fieldDraft, setFieldDraft] = useState({ name: '', crop: '', area: '', plantedOn: '', expectedHarvest: '', season: '', seedVariety: '', fertilizer: '' });
  const [activityDraft, setActivityDraft] = useState({ category: farmActivityTypes[0][0], fieldId: '', date: localDateTimeValue(), details: '' });
  const [gpsStamp, setGpsStamp] = useState(null);
  const [fieldGpsStamp, setFieldGpsStamp] = useState(null);
  const [fieldPhoto, setFieldPhoto] = useState('');
  const [fieldPhotoCapturedAt, setFieldPhotoCapturedAt] = useState('');
  const [activityPhoto, setActivityPhoto] = useState('');
  const [activityPhotoCapturedAt, setActivityPhotoCapturedAt] = useState('');
  const [gpsMessage, setGpsMessage] = useState('');
  const [notice, setNotice] = useState('');
  const selectedFarm = farms.find((farm) => farm.farm_id === selectedFarmId);
  const fields = records.fields;
  const farmFields = fields.filter((field) => field.farmId === selectedFarmId);
  useEffect(() => {
    let active = true;
    api.listFarms()
      .then((response) => {
        if (!active) return;
        const nextFarms = (Array.isArray(response.farms) ? response.farms : []).filter((farm) => farm.status !== 'pending');
        setFarms(nextFarms);
        setSelectedFarmId((current) => nextFarms.some((farm) => farm.farm_id === current)
          ? current
          : nextFarms.find((farm) => farm.role === 'owner')?.farm_id || nextFarms[0]?.farm_id || '');
      })
      .catch((error) => {
        if (active) setNotice(`Farm IDs could not be loaded: ${error.message || 'account API unavailable'}.`);
      });
    return () => { active = false; };
  }, [user?.user_id]);
  const livestockRecords = Array.isArray(records.livestock) ? records.livestock : [];
  const allFarmActivities = records.activities.filter((item) => item.module === 'activity' || (item.category && (item.fieldId || item.verification)));
  const farmLivestockRecords = livestockRecords.filter((animal) => animal.farmId === selectedFarmId);
  const farmActivities = allFarmActivities.filter((activity) => activity.farmId === selectedFarmId);
  const unassignedFields = fields.filter((field) => !field.farmId);
  const unassignedAnimals = livestockRecords.filter((animal) => animal.module === 'livestock' && !animal.farmId);
  const unassignedActivities = allFarmActivities.filter((activity) => !activity.farmId);
  const unassignedRecordCount = unassignedFields.length + unassignedAnimals.length + unassignedActivities.length;
  const activeAnimalRecords = farmLivestockRecords.filter((animal) => animal.module === 'livestock' && animal.status !== 'sold' && animal.status !== 'deceased');
  const registeredAnimalCount = activeAnimalRecords.reduce((total, animal) => total + Math.max(0, Number(animal.count) || 0), 0);
  const animalGroupsBySpecies = activeAnimalRecords.reduce((groups, animal) => {
    const species = String(animal.species || 'Other').trim();
    const key = species.toLocaleLowerCase();
    const existing = groups.get(key) || { species, heads: 0, groups: 0, needsAttention: false };
    existing.heads += Math.max(0, Number(animal.count) || 0);
    existing.groups += 1;
    existing.needsAttention ||= ['under treatment', 'needs attention'].includes(String(animal.health || '').toLowerCase());
    groups.set(key, existing);
    return groups;
  }, new Map());
  const animalSpeciesGroups = [...animalGroupsBySpecies.values()].sort((left, right) => right.heads - left.heads);
  const acres = farmFields.reduce((total, field) => total + (Number(field.area) || 0), 0);
  const activeCrops = new Set(farmFields.map((field) => String(field.crop || '').trim().toLowerCase()).filter(Boolean)).size;
  const filteredActivities = farmActivities
    .slice()
    .sort((left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0));
  const farmRecordSyncLabels = {
    loading: 'Checking sync status…',
    syncing: 'Syncing to your account…',
    synced: 'Synced to your account',
    pending: 'Saved here · waiting to sync',
    offline: 'Offline · saved here, waiting to sync',
    local: 'Saved here · account sync unavailable',
  };
  const contentSection = ['fields', 'records', 'production', 'farm-operations', 'activity', 'livestock'].includes(page) ? page : 'fields';
  const activeSection = ['livestock', 'production'].includes(contentSection) ? 'records' : contentSection;
  const scopedLivestockRecords = [
    ...farmLivestockRecords,
    ...livestockRecords.filter((record) => record.module === 'livestock-baseline'
      && (!record.farmId || record.farmId === selectedFarmId)),
  ];
  const scopedActivities = records.activities.filter((activity) => activity.farmId === selectedFarmId);
  const scopedRecords = { ...records, fields: farmFields, livestock: scopedLivestockRecords, activities: scopedActivities };
  const onScopedRecordsChange = (collection, updatedRecords) => {
    const allRecords = Array.isArray(records[collection]) ? records[collection] : [];
    if (!selectedFarmId) {
      setNotice('Select a farm before saving farm-specific records.');
      return;
    }
    const updatedIds = new Set(updatedRecords.map((record) => record.id));
    const otherFarmRecords = allRecords.filter((record) => record.farmId !== selectedFarmId && !updatedIds.has(record.id));
    onRecordsChange(collection, [...otherFarmRecords, ...updatedRecords]);
  };
  const navigateFarmSection = (section) => {
    if (section === 'records') setRecordView('index');
    onNavigate(section);
  };

  const openRecordView = (view) => {
    setRecordView(view);
    setSelectedFieldId('');
    onNavigate('records');
  };

  const openAddRecord = (recordType) => {
    if (recordType === 'farm') {
      setDialog('');
      onNavigate('farm-operations');
    } else if (recordType === 'field') {
      setFieldDraft({ name: '', crop: '', area: '', plantedOn: '', expectedHarvest: '', season: '', seedVariety: '', fertilizer: '' });
      setFieldGpsStamp(null);
      setFieldPhoto('');
      setFieldPhotoCapturedAt('');
      setGpsMessage('');
      setDialog('field');
    } else if (recordType === 'livestock') {
      setDialog('');
      openRecordView('livestock');
    } else {
      openActivityDialog();
    }
  };

  const linkRecordToSelectedFarm = (recordType, recordId) => {
    if (!selectedFarmId) {
      setNotice('Create or select a farm first, then link this record to it.');
      return;
    }
    const collection = recordType === 'field' ? 'fields' : recordType === 'animal' ? 'livestock' : 'activities';
    const currentRecords = Array.isArray(records[collection]) ? records[collection] : [];
    onRecordsChange(collection, currentRecords.map((record) => record.id === recordId
      ? { ...record, farmId: selectedFarmId, farmerId: record.farmerId || user?.user_id }
      : record));
    const recordName = recordType === 'field' ? 'Field' : recordType === 'animal' ? 'Livestock record' : 'Activity';
    setNotice(`${recordName} linked to ${selectedFarm?.name || 'the selected farm'} (${selectedFarmId}). Existing evidence was not changed or independently verified.`);
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
    setActivityPhotoCapturedAt('');
    setGpsMessage('');
    setNotice('');
    setDialog('activity');
  };

  const captureFieldLocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage('This browser does not support GPS location; a field cannot be saved without it.');
      return;
    }
    setGpsMessage('Requesting current location. Allow access to continue.');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setFieldGpsStamp({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        stampedAt: new Date().toISOString(),
      });
      setGpsMessage(`GPS captured · approximate accuracy ±${Math.round(coords.accuracy)} m${coords.accuracy > 50 ? ' · move outdoors for better accuracy' : ''}.`);
    }, (error) => {
      setFieldGpsStamp(null);
      setGpsMessage(error.code === error.PERMISSION_DENIED
        ? 'Location permission is required to add a field.'
        : error.message || 'Could not capture field location.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const updateFieldPhoto = async (file) => {
    if (!file) return;
    try {
      setFieldPhoto(await compressFarmPhoto(file));
      setFieldPhotoCapturedAt(new Date().toISOString());
      setNotice('');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const saveField = (event) => {
    event.preventDefault();
    const name = fieldDraft.name.trim();
    const crop = fieldDraft.crop.trim();
    const area = Number(fieldDraft.area);
    if (!selectedFarm) {
      setNotice('Create or select a farm with a Farm ID before adding fields.');
      return;
    }
    if (!fieldGpsStamp || fieldGpsStamp.accuracy > 50
      || Math.abs(Date.now() - Date.parse(fieldGpsStamp.stampedAt)) > 15 * 60 * 1000
      || Math.abs(Date.parse(fieldGpsStamp.stampedAt) - Date.parse(fieldPhotoCapturedAt)) > 15 * 60 * 1000
      || !fieldPhoto) {
      setNotice('A fresh GPS stamp with accuracy within 50 m and a field photo are required.');
      return;
    }
    if (!name || !crop || !Number.isFinite(area) || area <= 0) {
      setNotice('Enter a field name, crop, and positive area.');
      return;
    }
    onRecordsChange('fields', [...fields, {
      ...fieldDraft,
      name,
      crop,
      area,
      farmerId: user.user_id,
      farmId: selectedFarm.farm_id,
      gpsStamp: fieldGpsStamp,
      photo: fieldPhoto,
      photoAddedAt: fieldPhotoCapturedAt,
      evidenceKind: 'geotagged',
      verification: 'Device GPS and photo attached; not independently verified',
      id: createRecordId(),
      module: 'fields',
      status: 'Saved locally',
      createdAt: new Date().toISOString(),
    }]);
    setFieldDraft({ name: '', crop: '', area: '', plantedOn: '', expectedHarvest: '', season: '', seedVariety: '', fertilizer: '' });
    setFieldGpsStamp(null);
    setFieldPhoto('');
    setFieldPhotoCapturedAt('');
    setDialog('');
    setNotice(`Field saved under Farmer ID ${user.user_id} and Farm ID ${selectedFarm.farm_id}. GPS and photo are device-reported evidence, not independent verification.`);
  };

  const updateActivityPhoto = async (file) => {
    if (!file) return;
    try {
      setActivityPhoto(await compressFarmPhoto(file));
      setActivityPhotoCapturedAt(new Date().toISOString());
      setNotice('');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const stampActivityLocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage('This browser does not support GPS location; an activity cannot be saved without it.');
      return;
    }
    setGpsMessage('Requesting current location. Allow access to continue.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsStamp({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, stampedAt: new Date().toISOString() });
        setGpsMessage(`GPS captured · approximate accuracy ±${Math.round(coords.accuracy)} m${coords.accuracy > 50 ? ' · move outdoors for better accuracy' : ''}.`);
      },
      (error) => {
        const reason = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your location is unavailable.'
            : 'Location request timed out.';
        setGpsStamp(null);
        setGpsMessage(`${reason} Location permission is required to save this activity.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const saveActivity = (event) => {
    event.preventDefault();
    const field = fields.find((item) => item.id === activityDraft.fieldId);
    const activityDate = new Date(activityDraft.date);
    if (!selectedFarm) {
      setNotice('Create or select a farm with a Farm ID before logging activity.');
      return;
    }
    if (!gpsStamp || gpsStamp.accuracy > 50
      || Math.abs(Date.now() - Date.parse(gpsStamp.stampedAt)) > 15 * 60 * 1000
      || Math.abs(Date.parse(gpsStamp.stampedAt) - Date.parse(activityPhotoCapturedAt)) > 15 * 60 * 1000
      || !activityPhoto) {
      setNotice('A fresh GPS stamp with accuracy within 50 m and an activity photo are required.');
      return;
    }
    if (Number.isNaN(activityDate.getTime())) {
      setNotice('Choose a valid activity date and time.');
      return;
    }
    onRecordsChange('activities', [...records.activities, {
      id: createRecordId(),
      module: 'activity',
      category: activityDraft.category,
      title: activityDraft.category,
      farmerId: user.user_id,
      farmId: selectedFarm.farm_id,
      fieldId: field?.id || '',
      fieldName: field?.name || '',
      details: activityDraft.details.trim(),
      date: activityDate.toISOString(),
      gpsStamp,
      photo: activityPhoto,
      photoAddedAt: activityPhotoCapturedAt,
      evidenceKind: 'geotagged',
      verification: 'Device GPS and photo attached; not independently verified',
    }]);
    setDialog('');
    setGpsStamp(null);
    setActivityPhoto('');
    setActivityPhotoCapturedAt('');
    setGpsMessage('');
    setNotice(`Activity saved under Farmer ID ${user.user_id} and Farm ID ${selectedFarm.farm_id}. Location and photo are device-reported, not independently verified.`);
  };

  const selectedField = fields.find((field) => field.id === selectedFieldId);
  if (selectedField && ['fields', 'records'].includes(contentSection)) {
    const fieldActivities = farmActivities.filter((activity) => activity.fieldId === selectedField.id
      || String(activity.fieldName || '').trim().toLowerCase() === String(selectedField.name || '').trim().toLowerCase());
    return (
      <div className="digital-farm-section-shell">
        <DigitalFarmSectionNavigation activeSection="records" onNavigate={navigateFarmSection} />
        <FieldDataProfile
          field={selectedField}
          profile={profile}
          activities={fieldActivities}
          onBack={() => { setSelectedFieldId(''); onNavigate('records'); }}
          onNavigate={onNavigate}
          onUpdateField={(updatedField) => onRecordsChange('fields', fields.map((field) => field.id === updatedField.id ? updatedField : field))}
        />
      </div>
    );
  }

  if (contentSection === 'records') {
    return (
      <div className="digital-farm-section-shell">
        <header className="digital-farm-section-header">
          <span className="material-symbols-outlined">folder_open</span>
          <div><strong>Farm records</strong><small>Choose what you want to review for the active farm.</small></div>
        </header>
        <DigitalFarmSectionNavigation activeSection="records" onNavigate={navigateFarmSection} />
        <div className="digital-farm-identifiers">
          <span><small>FARMER ID</small><strong>{user?.user_id || 'Unavailable'}</strong></span>
          <label><small>ACTIVE FARM · FARM ID</small>
            {farms.length ? <select value={selectedFarmId} onChange={(event) => setSelectedFarmId(event.target.value)}>{farms.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farm.name} · {farm.farm_id}</option>)}</select> : <button type="button" onClick={() => onNavigate('farm-operations')}>Create my first farm</button>}
          </label>
        </div>
        {notice && <div className="farmer-workspace-notice" role="status">{notice}</div>}
        {recordView === 'livestock' ? (
          <LivestockWorkspace
            profile={profile}
            records={scopedRecords}
            farmerId={user?.user_id}
            farmId={selectedFarmId}
            search=""
            onRecordsChange={onScopedRecordsChange}
            onProfileSave={onProfileSave}
            onNavigate={onNavigate}
            onBack={() => openRecordView('index')}
          />
        ) : recordView === 'production' ? (
          <ProductionProfileWorkspace profile={profile} onProfileSave={onProfileSave} onBack={() => openRecordView('index')} />
        ) : recordView === 'fields' ? (
          <section className="digital-farm-record-view">
            <div className="digital-farm-record-view-heading">
              <div><h2>Fields & crops</h2><p>{selectedFarm ? `Records assigned to ${selectedFarm.name}.` : 'Create a farm before adding or assigning fields.'}</p></div>
              <button type="button" disabled={!selectedFarm} onClick={() => { setFieldDraft({ name: '', crop: '', area: '', plantedOn: '', expectedHarvest: '', season: '', seedVariety: '', fertilizer: '' }); setFieldGpsStamp(null); setFieldPhoto(''); setFieldPhotoCapturedAt(''); setGpsMessage(''); setDialog('field'); onNavigate('fields'); }}>Add field</button>
            </div>
            {farmFields.length ? farmFields.map((field) => (
              <article className="digital-farm-record-row" key={field.id}>
                <div><strong>{field.name} · {field.crop}</strong><small>{Number(field.area || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} acres · Farm ID {field.farmId}</small></div>
                <button type="button" onClick={() => setSelectedFieldId(field.id)}>View field</button>
              </article>
            )) : <p className="digital-farm-record-empty">No fields are linked to this farm yet.</p>}
          </section>
        ) : (
          <>
            <div className="digital-farm-record-cards">
              <button type="button" onClick={() => openRecordView('fields')}><span className="material-symbols-outlined">agriculture</span><strong>Fields & crops</strong><small>{farmFields.length} linked · {unassignedFields.length} need a farm</small></button>
              <button type="button" onClick={() => openRecordView('livestock')}><span className="material-symbols-outlined">pets</span><strong>Livestock & poultry</strong><small>{activeAnimalRecords.length} groups linked · {unassignedAnimals.length} need a farm</small></button>
              <button type="button" onClick={() => openRecordView('production')}><span className="material-symbols-outlined">eco</span><strong>Farm profile</strong><small>Production preferences and farm details</small></button>
            </div>
            {unassignedRecordCount > 0 && (
              <section className="digital-farm-unassigned" aria-labelledby="digital-farm-unassigned-heading">
                <div><h2 id="digital-farm-unassigned-heading">Records that need a farm</h2><p>These older records are still saved. Link each one only if it belongs to the active farm.</p></div>
                {!selectedFarm && <button type="button" onClick={() => onNavigate('farm-operations')}>Create or select a farm</button>}
                {unassignedFields.map((field) => <article className="digital-farm-record-row" key={`field-${field.id}`}><div><strong>{field.name} · {field.crop}</strong><small>Field · {field.area || 0} acres · No Farm ID</small></div><button type="button" disabled={!selectedFarm} onClick={() => linkRecordToSelectedFarm('field', field.id)}>Link to active farm</button></article>)}
                {unassignedAnimals.map((animal) => <article className="digital-farm-record-row" key={`animal-${animal.id}`}><div><strong>{animal.count || 1} {animal.species || 'Animal'}</strong><small>Livestock · No Farm ID</small></div><button type="button" disabled={!selectedFarm} onClick={() => linkRecordToSelectedFarm('animal', animal.id)}>Link to active farm</button></article>)}
                {unassignedActivities.map((activity) => <article className="digital-farm-record-row" key={`activity-${activity.id}`}><div><strong>{activity.category || activity.title || 'Farm activity'}</strong><small>Journal entry · {formatFarmDate(activity.date || activity.createdAt)} · No Farm ID</small></div><button type="button" disabled={!selectedFarm} onClick={() => linkRecordToSelectedFarm('activity', activity.id)}>Link to active farm</button></article>)}
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  if (contentSection !== 'fields') {
    return (
      <div className="digital-farm-section-shell">
        <header className="digital-farm-section-header">
          <span className="material-symbols-outlined">{contentSection === 'activity' ? 'fact_check' : contentSection === 'farm-operations' ? 'groups_2' : contentSection === 'livestock' ? 'pets' : 'eco'}</span>
          <div><strong>{contentSection === 'activity' ? 'Farm journal' : contentSection === 'farm-operations' ? 'Team & operations' : contentSection === 'livestock' ? 'Livestock & poultry' : 'Farm profile'}</strong><small>Farmer ID and active Farm ID are shown above.</small></div>
        </header>
        <DigitalFarmSectionNavigation activeSection={activeSection} onNavigate={navigateFarmSection} />
        <div className="digital-farm-identifiers">
          <span><small>FARMER ID</small><strong>{user?.user_id || 'Unavailable'}</strong></span>
          <label><small>ACTIVE FARM · FARM ID</small>
            {farms.length ? <select value={selectedFarmId} onChange={(event) => setSelectedFarmId(event.target.value)}>{farms.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farm.name} · {farm.farm_id}</option>)}</select> : <button type="button" onClick={() => onNavigate('farm-operations')}>Create a GPS-verified farm first</button>}
          </label>
        </div>
        {notice && <div className="farmer-workspace-notice" role="status">{notice}</div>}
        {contentSection === 'farm-operations' ? (
          <FarmOperationsWorkspace user={user} activeFarmId={selectedFarmId} onActiveFarmChange={setSelectedFarmId} onBack={() => onNavigate('fields')} />
        ) : contentSection === 'livestock' ? (
          <LivestockWorkspace
            profile={profile}
            records={scopedRecords}
            farmerId={user?.user_id}
            farmId={selectedFarmId}
            search=""
            onRecordsChange={onScopedRecordsChange}
            onProfileSave={onProfileSave}
            onNavigate={onNavigate}
            onBack={() => { setRecordView('index'); onNavigate('records'); }}
          />
        ) : contentSection === 'production' ? (
          <ProductionProfileWorkspace profile={profile} onProfileSave={onProfileSave} onBack={() => openRecordView('index')} />
        ) : (
          <FarmActivityLog
            user={user}
            profile={profile}
            fields={farmFields}
            activeFarmId={selectedFarmId}
            onActiveFarmChange={setSelectedFarmId}
            onBack={() => onNavigate('fields')}
            onNavigate={onNavigate}
          />
        )}
      </div>
    );
  }

  return (
    <main className="farmer-workspace digital-farm-page" aria-label="Digital Farm">
      {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <header className="digital-farm-heading">
        <div>
          <span className="digital-farm-eyebrow">YOUR FARM PORTFOLIO</span>
          <h1>Shamba Langu</h1>
          <p>Your farms, fields, livestock, and day-to-day records in one place.</p>
        </div>
        <div className="digital-farm-local-status">
          <span className="digital-farm-local-badge" aria-live="polite"><span className="material-symbols-outlined">{farmRecordsSyncStatus === 'synced' ? 'cloud_done' : farmRecordsSyncStatus === 'syncing' ? 'sync' : 'devices'}</span>{farmRecordSyncLabels[farmRecordsSyncStatus] || farmRecordSyncLabels.pending}</span>
          {farmRecordsSyncStatus !== 'synced' && farmRecordsSyncStatus !== 'syncing' && <button type="button" onClick={onRetryFarmRecordsSync}><span className="material-symbols-outlined">sync</span>Retry sync</button>}
          <button type="button" onClick={exportFarmBackup}><span className="material-symbols-outlined">download</span>Download backup</button>
          <button type="button" className="digital-farm-primary-action" disabled={!selectedFarm} onClick={() => setDialog('add-record')}><span className="material-symbols-outlined">add</span>Add a record</button>
        </div>
      </header>
      <DigitalFarmSectionNavigation activeSection="fields" onNavigate={navigateFarmSection} />
      <section className={`digital-farm-identity-card${selectedFarm ? '' : ' is-empty'}`} aria-label="Active farm">
        <div className="digital-farm-identity-copy">
          <span className="digital-farm-eyebrow">{selectedFarm ? 'ACTIVE FARM' : 'GET STARTED'}</span>
          <h2>{selectedFarm?.name || 'Create your first farm'}</h2>
          <p>{selectedFarm
            ? `${selectedFarm.soil_type ? `${selectedFarm.soil_type} · ` : ''}${Number(selectedFarm.total_acres) > 0 ? `${Number(selectedFarm.total_acres).toLocaleString()} farm acres` : `${acres.toLocaleString(undefined, { maximumFractionDigits: 1 })} recorded field acres`}`
            : 'Your Farmer ID stays with you. Each farm gets a separate Farm ID and its own records.'}</p>
          {selectedFarm && (
            <div className="digital-farm-identity-status">
              <span className="digital-farm-id-chip"><small>FARMER ID</small><strong>{user?.user_id || 'Unavailable'}</strong></span>
              <span className="digital-farm-id-chip"><small>FARM ID</small><strong>{selectedFarm.farm_id}</strong></span>
              <span className={`digital-farm-location-chip${selectedFarm.location_latitude != null && selectedFarm.location_longitude != null ? ' is-ready' : ''}`}>
                <span className="material-symbols-outlined">{selectedFarm.location_latitude != null && selectedFarm.location_longitude != null ? 'location_on' : 'location_searching'}</span>
                {selectedFarm.location_latitude != null && selectedFarm.location_longitude != null
                  ? `GPS captured${selectedFarm.location_accuracy_m ? ` · ±${Math.round(selectedFarm.location_accuracy_m)} m` : ''}`
                  : 'Location not captured'}
              </span>
              {selectedFarm.has_location_evidence && <span className="digital-farm-location-chip is-ready"><span className="material-symbols-outlined">photo_camera</span>Farm photo attached</span>}
              {selectedFarm.location_review_status === 'pending' && <span className="digital-farm-location-chip is-pending"><span className="material-symbols-outlined">pending</span>Location review pending</span>}
            </div>
          )}
          {!selectedFarm && <span className="digital-farm-id-chip"><small>FARMER ID</small><strong>{user?.user_id || 'Unavailable'}</strong></span>}
        </div>
        <div className="digital-farm-identity-actions">
          {selectedFarm ? (
            <>
              <label className="digital-farm-switcher"><span>Switch farm</span><select aria-label="Switch active farm" value={selectedFarmId} onChange={(event) => setSelectedFarmId(event.target.value)}>{farms.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farm.name} · {farm.farm_id}</option>)}</select></label>
              <button type="button" className="digital-farm-secondary-action" onClick={() => onNavigate('farm-operations')}>Farm settings</button>
            </>
          ) : <button type="button" className="digital-farm-primary-action" onClick={() => onNavigate('farm-operations')}><span className="material-symbols-outlined">add_home</span>Create my farm</button>}
        </div>
      </section>

      {selectedFarm && unassignedRecordCount > 0 && (
        <button type="button" className="digital-farm-attention-card" onClick={() => onNavigate('records')}>
          <span className="material-symbols-outlined">rule</span>
          <span><strong>{unassignedRecordCount} saved {unassignedRecordCount === 1 ? 'record needs' : 'records need'} a farm</strong><small>Review older records and link them only if they belong to {selectedFarm.name}.</small></span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      )}

      <section className="digital-farm-dashboard-stats" aria-label="Active farm summary">
        <button type="button" className="digital-farm-summary-card" onClick={() => openRecordView('fields')} disabled={!selectedFarm}>
          <span className="digital-farm-summary-icon"><span className="material-symbols-outlined">agriculture</span></span>
          <span className="digital-farm-summary-value">{selectedFarm ? farmFields.length : '—'}</span>
          <span className="digital-farm-summary-label">Fields</span>
          <span className="digital-farm-summary-detail">{acres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres recorded</span>
        </button>
        <button type="button" className="digital-farm-summary-card" onClick={() => openRecordView('fields')} disabled={!selectedFarm}>
          <span className="digital-farm-summary-icon"><span className="material-symbols-outlined">eco</span></span>
          <span className="digital-farm-summary-value">{selectedFarm ? activeCrops : '—'}</span>
          <span className="digital-farm-summary-label">Crop types</span>
          <span className="digital-farm-summary-detail">Across this farm’s fields</span>
        </button>
        <button type="button" className="digital-farm-summary-card" onClick={() => openRecordView('livestock')} disabled={!selectedFarm}>
          <span className="digital-farm-summary-icon"><span className="material-symbols-outlined">pets</span></span>
          <span className="digital-farm-summary-value">{selectedFarm ? registeredAnimalCount.toLocaleString() : '—'}</span>
          <span className="digital-farm-summary-label">Animal heads</span>
          <span className="digital-farm-summary-detail">{animalSpeciesGroups.length} species groups · not individual verified count</span>
        </button>
        <button type="button" className="digital-farm-summary-card" onClick={() => onNavigate('activity')} disabled={!selectedFarm}>
          <span className="digital-farm-summary-icon"><span className="material-symbols-outlined">event_note</span></span>
          <span className="digital-farm-summary-value">{selectedFarm ? farmActivities.length : '—'}</span>
          <span className="digital-farm-summary-label">Journal entries</span>
          <span className="digital-farm-summary-detail">Recent work and observations</span>
        </button>
      </section>

      <section className="digital-farm-dashboard-grid" aria-label="Farm records overview">
        <article className="digital-farm-preview-card">
          <div className="digital-farm-preview-heading">
            <div><span className="digital-farm-eyebrow">CROPS</span><h2>Fields & crops</h2></div>
            <button type="button" onClick={() => openRecordView('fields')} disabled={!selectedFarm}>View all <span className="material-symbols-outlined">arrow_forward</span></button>
          </div>
          {farmFields.length ? (
            <div className="digital-farm-preview-list">
              {farmFields.slice(0, 3).map((field) => {
                const hasEvidence = Boolean(field.gpsStamp && field.photo);
                return (
                  <button type="button" className="digital-farm-preview-row" key={field.id} onClick={() => setSelectedFieldId(field.id)}>
                    <span className="digital-farm-preview-icon"><span className="material-symbols-outlined">eco</span></span>
                    <span className="digital-farm-preview-copy"><strong>{field.name}</strong><small>{field.crop} · {Number(field.area || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} acres</small><small>{hasEvidence ? 'GPS + photo attached · device evidence' : 'Location/photo evidence incomplete'}</small></span>
                    <span className="material-symbols-outlined digital-farm-preview-arrow">chevron_right</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="digital-farm-preview-empty"><span className="material-symbols-outlined">grass</span><strong>No fields recorded</strong><small>{selectedFarm ? 'Add a field to start tracking crops and seasons.' : 'Create a farm before adding fields.'}</small><button type="button" disabled={!selectedFarm} onClick={() => openAddRecord('field')}>Add a field</button></div>
          )}
          {farmFields.length > 3 && <button type="button" className="digital-farm-preview-more" onClick={() => openRecordView('fields')}>See all {farmFields.length} fields</button>}
        </article>

        <article className="digital-farm-preview-card">
          <div className="digital-farm-preview-heading">
            <div><span className="digital-farm-eyebrow">ANIMALS</span><h2>Livestock & poultry</h2></div>
            <button type="button" onClick={() => openRecordView('livestock')} disabled={!selectedFarm}>View all <span className="material-symbols-outlined">arrow_forward</span></button>
          </div>
          {animalSpeciesGroups.length ? (
            <div className="digital-farm-preview-list">
              {animalSpeciesGroups.slice(0, 3).map((group) => (
                <button type="button" className="digital-farm-preview-row" key={group.species} onClick={() => openRecordView('livestock')}>
                  <span className="digital-farm-preview-icon"><span className="material-symbols-outlined">pets</span></span>
                  <span className="digital-farm-preview-copy"><strong>{group.heads.toLocaleString()} head · {group.species}</strong><small>{group.groups} {group.groups === 1 ? 'group' : 'groups'} recorded</small><small>{group.needsAttention ? 'Health follow-up recorded' : 'Farmer-entered animal records'}</small></span>
                  <span className="material-symbols-outlined digital-farm-preview-arrow">chevron_right</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="digital-farm-preview-empty"><span className="material-symbols-outlined">pets</span><strong>No animal groups recorded</strong><small>{selectedFarm ? 'Add cattle, goats, poultry, or other livestock.' : 'Create a farm before adding animals.'}</small><button type="button" disabled={!selectedFarm} onClick={() => openAddRecord('livestock')}>Add livestock</button></div>
          )}
          <small className="digital-farm-preview-disclaimer">Head counts and health are farmer-reported, not independently verified.</small>
        </article>

        <article className="digital-farm-location-card">
          <div className="digital-farm-preview-heading">
            <div><span className="digital-farm-eyebrow">LOCATION</span><h2>Farm location</h2></div>
            <button type="button" onClick={() => onNavigate('ramani')} disabled={!selectedFarm}>Open map <span className="material-symbols-outlined">arrow_forward</span></button>
          </div>
          {selectedFarm && selectedFarm.location_latitude != null && selectedFarm.location_longitude != null ? (
            <>
              <div className="digital-farm-map">
                <RamaniMapPage profile={{ ...profile, latitude: selectedFarm.location_latitude, longitude: selectedFarm.location_longitude }} search="" onSearch={() => {}} compact />
              </div>
              <p className="digital-farm-location-note">Centered on the farm’s device-captured GPS. A location pin is not a land boundary or proof of ownership.</p>
            </>
          ) : (
            <div className="digital-farm-location-empty">
              <span className="material-symbols-outlined">location_searching</span>
              <strong>{selectedFarm ? 'Farm location not captured' : 'No active farm selected'}</strong>
              <small>{selectedFarm ? 'Capture GPS and a farm photo to add location context.' : 'Select or create a farm to see its location.'}</small>
              <button type="button" disabled={!selectedFarm} onClick={() => onNavigate('farm-operations')}>{selectedFarm ? 'Capture farm location' : 'Create my farm'}</button>
            </div>
          )}
        </article>
      </section>

      <section className="digital-farm-journal digital-farm-recent-card">
        <div className="digital-farm-journal-heading">
          <div><span className="digital-farm-eyebrow">LATEST UPDATES</span><h2>Recent farm journal</h2><p>{selectedFarm ? `Recent records for ${selectedFarm.name}` : 'Select or create a farm to view its journal.'}</p></div>
          <button type="button" onClick={() => onNavigate('activity')} disabled={!selectedFarm}>View journal <span className="material-symbols-outlined">arrow_forward</span></button>
        </div>
        {filteredActivities.length ? (
          <div className="digital-farm-recent-list">
            {filteredActivities.slice(0, 3).map((activity) => {
              const category = activity.category || activity.title || 'Farm activity';
              const icon = farmActivityTypes.find(([name]) => name === category)?.[1] || 'edit_note';
              const fieldName = activity.fieldName || farmFields.find((field) => field.id === activity.fieldId)?.name || 'Farm-wide';
              const hasEvidence = Boolean(activity.gpsStamp && activity.photo);
              return (
                <article className="digital-farm-recent-row" key={activity.id}>
                  <span className="digital-farm-preview-icon"><span className="material-symbols-outlined">{icon}</span></span>
                  <div className="digital-farm-preview-copy"><strong>{category}</strong><small>{fieldName} · {formatFarmDate(activity.date || activity.createdAt, { month: 'short', day: 'numeric' })}{activity.details || activity.notes ? ` · ${activity.details || activity.notes}` : ''}</small></div>
                  <span className={`digital-farm-evidence-chip${hasEvidence ? ' is-ready' : ''}`}><span className="material-symbols-outlined">{hasEvidence ? 'verified_user' : 'info'}</span>{hasEvidence ? 'GPS + photo' : 'Evidence incomplete'}</span>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="digital-farm-preview-empty journal-empty"><span className="material-symbols-outlined">event_note</span><strong>{selectedFarm ? 'Your journal is ready' : 'No farm selected'}</strong><small>{selectedFarm ? 'Log the first activity when work happens.' : 'Create a farm to begin a journal.'}</small><button type="button" disabled={!selectedFarm} onClick={() => openAddRecord('activity')}>Log an activity</button></div>
        )}
      </section>

      {dialog && <div className="digital-farm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(''); }}>
        <section className="digital-farm-dialog" role="dialog" aria-modal="true" aria-labelledby="digital-farm-dialog-title">
          <div className="digital-farm-dialog-heading"><div><span className="farmer-workspace-eyebrow">{dialog === 'add-record' ? 'QUICK ACTIONS' : dialog === 'field' ? 'FIELD RECORD' : 'FIELD JOURNAL'}</span><h2 id="digital-farm-dialog-title">{dialog === 'add-record' ? 'What would you like to add?' : dialog === 'field' ? 'Add a field' : 'Log farm activity'}</h2></div><button type="button" aria-label="Close dialog" onClick={() => setDialog('')}><span className="material-symbols-outlined">close</span></button></div>
          {dialog === 'add-record' ? (
            <div className="digital-farm-action-grid">
              <button type="button" disabled={!selectedFarm} onClick={() => openAddRecord('field')}><span className="material-symbols-outlined">agriculture</span><strong>Field or crop</strong><small>Record a field, area, and crop.</small></button>
              <button type="button" disabled={!selectedFarm} onClick={() => openAddRecord('livestock')}><span className="material-symbols-outlined">pets</span><strong>Livestock</strong><small>Register animals and capture evidence.</small></button>
              <button type="button" disabled={!selectedFarm} onClick={() => openAddRecord('activity')}><span className="material-symbols-outlined">event_note</span><strong>Farm activity</strong><small>Log work with GPS and a photo.</small></button>
              {!selectedFarm && <button type="button" onClick={() => openAddRecord('farm')}><span className="material-symbols-outlined">add_home</span><strong>New farm</strong><small>Create a farm before adding records.</small></button>}
            </div>
          ) : dialog === 'field' ? <form onSubmit={saveField}>
            {selectedFarm ? <p className="digital-farm-dialog-note">Farmer ID {user?.user_id} · Farm ID {selectedFarm.farm_id}</p> : <p className="digital-farm-dialog-note">Create a farm before adding a field. <button type="button" onClick={() => { setDialog(''); onNavigate('farm-operations'); }}>Open Farm Operations</button></p>}
            <label>Field name<input required value={fieldDraft.name} onChange={(event) => setFieldDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. North field" /></label>
            <label>Crop<input required value={fieldDraft.crop} onChange={(event) => setFieldDraft((current) => ({ ...current, crop: event.target.value }))} placeholder="e.g. Maize" /></label>
            <label>Area (acres)<input required type="number" min="0.01" step="any" value={fieldDraft.area} onChange={(event) => setFieldDraft((current) => ({ ...current, area: event.target.value }))} /></label>
            <button type="button" className="digital-farm-gps-button" onClick={captureFieldLocation}><span className="material-symbols-outlined">{fieldGpsStamp ? 'location_on' : 'my_location'}</span>{fieldGpsStamp ? `GPS captured · ±${Math.round(fieldGpsStamp.accuracy)} m` : 'Grant location & capture field GPS'}</button>
            {gpsMessage && <p className="digital-farm-gps-message" role="status">{gpsMessage}</p>}
            <label>Field location photo<input required type="file" accept="image/*" capture="environment" onChange={(event) => { updateFieldPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label>
            {fieldPhoto && <img className="digital-farm-photo-preview" src={fieldPhoto} alt="Selected field location evidence" />}
            <label>Planting date<input type="date" value={fieldDraft.plantedOn} onChange={(event) => setFieldDraft((current) => ({ ...current, plantedOn: event.target.value }))} /></label>
            <label>Expected harvest<input type="date" value={fieldDraft.expectedHarvest} onChange={(event) => setFieldDraft((current) => ({ ...current, expectedHarvest: event.target.value }))} /></label>
            <label>Season<input value={fieldDraft.season} onChange={(event) => setFieldDraft((current) => ({ ...current, season: event.target.value }))} placeholder="e.g. 2026 short rains" /></label>
            <label>Seed variety<input value={fieldDraft.seedVariety} onChange={(event) => setFieldDraft((current) => ({ ...current, seedVariety: event.target.value }))} placeholder="Optional" /></label>
            <label>Fertilizer / inputs<input value={fieldDraft.fertilizer} onChange={(event) => setFieldDraft((current) => ({ ...current, fertilizer: event.target.value }))} placeholder="Optional" /></label>
            <p className="digital-farm-dialog-note">A current device GPS stamp (accuracy within 50 m) and field photo are required. They are farmer-provided evidence, not proof of land ownership or independent verification.</p>
            <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">add</span>Save field</button>
          </form> : <form onSubmit={saveActivity}>
            <p className="digital-farm-dialog-note">Farmer ID {user?.user_id} · Farm ID {selectedFarm?.farm_id || 'Create a farm first'}</p>
            <label>Activity<select value={activityDraft.category} onChange={(event) => setActivityDraft((current) => ({ ...current, category: event.target.value }))}>{farmActivityTypes.map(([name]) => <option key={name}>{name}</option>)}</select></label>
            <label>Field<select value={activityDraft.fieldId} onChange={(event) => setActivityDraft((current) => ({ ...current, fieldId: event.target.value }))}><option value="">Farm-wide / not specified</option>{farmFields.map((field) => <option key={field.id} value={field.id}>{field.name} — {field.crop}</option>)}</select></label>
            <label>Date and time<input required type="datetime-local" value={activityDraft.date} onChange={(event) => setActivityDraft((current) => ({ ...current, date: event.target.value }))} /></label>
            <label>Notes<textarea value={activityDraft.details} onChange={(event) => setActivityDraft((current) => ({ ...current, details: event.target.value }))} placeholder="What work was done or observed?" /></label>
            <button type="button" className="digital-farm-gps-button" onClick={stampActivityLocation}><span className="material-symbols-outlined">{gpsStamp ? 'location_on' : 'my_location'}</span>{gpsStamp ? `GPS captured · ±${Math.round(gpsStamp.accuracy)} m` : 'Grant location & capture activity GPS'}</button>
            {gpsMessage && <p className="digital-farm-gps-message" role="status">{gpsMessage}</p>}
            <label>Activity photo evidence<input required type="file" accept="image/*" capture="environment" onChange={(event) => { updateActivityPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label>
            {activityPhoto && <img className="digital-farm-photo-preview" src={activityPhoto} alt="Selected farm activity evidence" />}
            <p className="digital-farm-dialog-note">A current device GPS stamp (accuracy within 50 m) and photo are required. They are device-reported evidence and not proof that the activity happened. Keep sensitive people or documents out of photos.</p>
            <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">save</span>Save activity</button>
          </form>}
        </section>
      </div>}
    </main>
  );
}