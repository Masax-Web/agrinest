import { useMemo, useState } from 'react';
import LivestockHealthWorkspace from './LivestockHealthWorkspace';
import LivestockKnowledge from './LivestockKnowledge';

const animalSpecies = ['Cattle', 'Goat', 'Sheep', 'Chicken', 'Duck', 'Turkey', 'Quail', 'Pig', 'Rabbit', 'Fish', 'Bee colony', 'Donkey', 'Camel', 'Other'];
const animalHealthOptions = ['healthy', 'under treatment', 'needs attention', 'not assessed'];
const healthEventTypes = ['Vaccination', 'Deworming', 'Treatment', 'Disease history', 'Vet visit', 'Health check'];
const livestockSections = [
  { id: 'register', label: 'Herd & flock', icon: 'pets' },
  { id: 'health', label: 'Health', icon: 'vaccines' },
  { id: 'facilities', label: 'Housing', icon: 'home_work' },
  { id: 'feed', label: 'Feed & nutrition', icon: 'grass' },
  { id: 'breeding', label: 'Breeding', icon: 'event' },
  { id: 'production', label: 'Production', icon: 'monitoring' },
  { id: 'sales', label: 'Sales', icon: 'storefront' },
  { id: 'knowledge', label: 'Knowledge', icon: 'menu_book' },
];

function createId() {
  return globalThis.crypto?.randomUUID?.() || `livestock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return 'Date not recorded';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTzs(value) {
  return `TZS ${Number(value || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}

function formatCompactTzs(value) {
  return `TZS ${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
}

function compressAnimalPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Choose an animal or farm activity photo.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Choose a photo smaller than 8 MB.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Photo processing is unavailable in this browser.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      if (dataUrl.length > 700_000) {
        reject(new Error('This photo is too large to save. Choose a smaller image.'));
        return;
      }
      resolve(dataUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected photo could not be opened.'));
    };
    image.src = url;
  });
}

function LivestockEvidenceCapture({ gps, setGps, photo, setPhoto, photoAddedAt, setPhotoAddedAt, setError }) {
  const [gpsBusy, setGpsBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const capture = () => {
    if (!navigator.geolocation) {
      setError('Location capture is not available in this browser.');
      return;
    }
    setGpsBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setGps({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy,
        captured_at: new Date().toISOString(),
      });
      setGpsBusy(false);
    }, (error) => {
      setGpsBusy(false);
      setGps(null);
      setError(error.code === error.PERMISSION_DENIED
        ? 'Location permission is required for this animal record.'
        : error.message || 'Could not capture animal record location.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const selectPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    try {
      setPhoto(await compressAnimalPhoto(file));
      setPhotoAddedAt(new Date().toISOString());
    } catch (error) {
      setError(error.message || 'Could not prepare the animal record photo.');
    } finally {
      setPhotoBusy(false);
    }
  };
  return (
    <div className="livestock-evidence-capture">
      <button type="button" className="livestock-secondary-button" onClick={capture} disabled={gpsBusy}>
        <span className="material-symbols-outlined">my_location</span>
        {gpsBusy ? 'Capturing GPS…' : gps ? `GPS captured · ±${Math.round(gps.accuracy_m)} m` : 'Grant location & capture GPS'}
      </button>
      <label>Geotagged photo evidence<input type="file" accept="image/*" capture="environment" onChange={selectPhoto} disabled={photoBusy} /></label>
      {photo && <img className="livestock-evidence-preview" src={photo} alt="Animal record evidence preview" />}
      <small>Fresh GPS (accuracy within 50 m) and a photo are required. Device-reported evidence is not independent verification.</small>
    </div>
  );
}

function compareNewestFirst(left, right) {
  const leftDate = new Date(left.date || left.createdAt || 0).getTime();
  const rightDate = new Date(right.date || right.createdAt || 0).getTime();
  const primary = (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  if (primary) return primary;
  const leftCreated = new Date(left.createdAt || 0).getTime();
  const rightCreated = new Date(right.createdAt || 0).getTime();
  return (Number.isFinite(rightCreated) ? rightCreated : 0) - (Number.isFinite(leftCreated) ? leftCreated : 0);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeAnimalCode(species, existingAnimals) {
  const prefix = String(species || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'ANI';
  const existingIds = new Set(existingAnimals.map((animal) => String(animal.animalId || '').toLowerCase()));
  let nextNumber = existingAnimals.filter((animal) => String(animal.species || '').toLowerCase() === String(species).toLowerCase()).length + 1;
  let animalId = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  while (existingIds.has(animalId.toLowerCase())) {
    nextNumber += 1;
    animalId = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }
  return animalId;
}

function LivestockRecordsSection({ section, records, animals, onRecordsChange, profile, farmerId, farmId }) {
  const [draft, setDraft] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [gps, setGps] = useState(null);
  const [photo, setPhoto] = useState('');
  const [photoAddedAt, setPhotoAddedAt] = useState('');
  const activities = Array.isArray(records.activities) ? records.activities : [];
  const facilities = (Array.isArray(records.livestock) ? records.livestock : []).filter((entry) => entry.module === 'livestock-facility');
  const entries = activities.filter((entry) => entry.module === `livestock-${section}`);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const activeAnimals = animals.filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased');
  const recordDate = draft.date || localDateValue();
  const save = (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!farmId || !farmerId) return setError('Create or select a farm before saving animal records.');
    if (!gps || gps.accuracy_m > 50
      || Math.abs(Date.now() - Date.parse(gps.captured_at)) > 15 * 60 * 1000
      || Math.abs(Date.parse(gps.captured_at) - Date.parse(photoAddedAt)) > 15 * 60 * 1000
      || !photo) {
      return setError('Capture fresh GPS with accuracy within 50 m and attach a photo before saving.');
    }
    const now = new Date().toISOString();
    const newEntry = {
      ...draft,
      farmerId,
      farmId,
      gpsStamp: { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy_m, stampedAt: gps.captured_at },
      location: gps,
      photo,
      photoAddedAt,
      evidenceKind: 'geotagged',
      id: createId(),
      module: `livestock-${section}`,
      createdAt: now,
    };
    if (section === 'facilities') {
      const name = String(draft.name || '').trim();
      if (!name) return setError('Enter a name for this housing unit.');
      onRecordsChange('livestock', [...(records.livestock || []), {
        ...newEntry,
        name,
        facilityType: draft.facilityType || 'Animal housing',
        capacity: draft.capacity ? Number(draft.capacity) : null,
      }]);
      setNotice('Housing record saved. Device-reported location is farmer-provided and not verified.');
    } else if (section === 'feed') {
      const quantity = Number(draft.quantity);
      if (!draft.feedType?.trim() || !Number.isFinite(quantity) || quantity <= 0) return setError('Enter a feed type and quantity greater than zero.');
      onRecordsChange('activities', [...activities, {
        ...newEntry,
        feedType: draft.feedType.trim(),
        quantity,
        unit: draft.unit || 'kg',
        cost: draft.cost ? Number(draft.cost) : null,
        source: String(draft.source || '').trim(),
        date: recordDate,
      }]);
      setNotice('Feed entry saved to your animal records.');
    } else if (section === 'breeding') {
      if (!draft.eventType || !draft.date || (draft.expectedDate && draft.expectedDate < draft.date)) return setError('Choose an event date and an expected date on or after it.');
      onRecordsChange('activities', [...activities, { ...newEntry, date: draft.date, expectedDate: draft.expectedDate || '', notes: String(draft.notes || '').trim() }]);
      setNotice('Breeding record saved. Expected dates are farmer-entered estimates.');
    } else if (section === 'production') {
      const quantity = Number(draft.quantity);
      if (!draft.productType || !draft.date || draft.date > localDateValue() || !Number.isFinite(quantity) || quantity <= 0) return setError('Enter a product, positive quantity, and a date that is not in the future.');
      onRecordsChange('activities', [...activities, {
        ...newEntry,
        productType: draft.productType,
        quantity,
        unit: draft.unit || 'liters',
        date: draft.date,
        animalId: draft.animalId || '',
        notes: String(draft.notes || '').trim(),
      }]);
      setNotice('Production entry saved. Quantities are farmer-reported and not independently measured.');
    } else {
      const quantity = Number(draft.quantity);
      const price = Number(draft.price);
      if (!draft.productType?.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !draft.date || draft.date > localDateValue()) return setError('Enter a product, positive quantity and price, and a valid sale date.');
      onRecordsChange('activities', [...activities, {
        ...newEntry,
        productType: draft.productType.trim(),
        quantity,
        unit: draft.unit || 'head',
        price,
        date: draft.date,
        buyer: String(draft.buyer || '').trim(),
        notes: String(draft.notes || '').trim(),
      }]);
      setNotice('Sale saved to your farmer-entered records.');
    }
    setDraft({});
    setGps(null);
    setPhoto('');
    setPhotoAddedAt('');
  };

  const title = {
    facilities: 'Housing & infrastructure',
    feed: 'Feed & nutrition',
    breeding: 'Breeding & reproduction',
    production: 'Milk, egg & meat production',
    sales: 'Animal & product sales',
  }[section];
  const description = {
    facilities: 'Keep simple records for pens, poultry houses, zero-grazing units, paddocks, and other animal housing.',
    feed: 'Record feed types, sources, quantities, and costs for your herd or flock.',
    breeding: 'Track breeding events and farmer-estimated calving, lambing, or hatching dates.',
    production: 'Log milk, eggs, meat, honey, or other animal products as they are collected.',
    sales: 'Record sales of live animals, meat, milk, eggs, hides, or other products.',
  }[section];
  const sectionRows = section === 'facilities' ? facilities : entries;

  return (
    <section className="livestock-module">
      <header className="livestock-module-heading"><div><span className="farmer-workspace-eyebrow">DIGITAL FARM · LIVESTOCK &amp; POULTRY</span><h1>{title}</h1><p>{description}</p></div></header>
      <div className="livestock-module-layout">
        <form className="livestock-module-card livestock-module-form" onSubmit={save}>
          <h2>{section === 'facilities' ? 'Add housing unit' : section === 'feed' ? 'Log feed' : section === 'breeding' ? 'Add breeding event' : section === 'production' ? 'Log production' : 'Record a sale'}</h2>
          {section === 'facilities' ? <>
            <label>Unit name<input required maxLength={120} value={draft.name || ''} onChange={(event) => update('name', event.target.value)} placeholder="e.g. East poultry house" /></label>
            <label>Housing type<select value={draft.facilityType || 'Animal housing'} onChange={(event) => update('facilityType', event.target.value)}>{['Animal housing', 'Poultry house', 'Zero-grazing unit', 'Pen', 'Paddock', 'Milking area', 'Other'].map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Capacity (optional)<input type="number" min="1" step="1" value={draft.capacity || ''} onChange={(event) => update('capacity', event.target.value)} placeholder="Animals or birds" /></label>
          </> : section === 'feed' ? <>
            <label>Feed type<input required maxLength={120} value={draft.feedType || ''} onChange={(event) => update('feedType', event.target.value)} placeholder="e.g. Dairy meal, hay, layer mash" /></label>
            <label>Animal or group (optional)<select value={draft.animalId || ''} onChange={(event) => update('animalId', event.target.value)}><option value="">Whole herd / flock</option>{activeAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.animalId || animal.species} · {animal.species}</option>)}</select></label>
            <div className="livestock-module-inline"><label>Quantity<input required type="number" min="0.01" step="any" value={draft.quantity || ''} onChange={(event) => update('quantity', event.target.value)} /></label><label>Unit<select value={draft.unit || 'kg'} onChange={(event) => update('unit', event.target.value)}>{['kg', 'bags', 'liters', 'bales', 'sacks', 'other'].map((unit) => <option key={unit}>{unit}</option>)}</select></label></div>
            <div className="livestock-module-inline"><label>Cost (TZS, optional)<input type="number" min="0" step="any" value={draft.cost || ''} onChange={(event) => update('cost', event.target.value)} /></label><label>Date<input type="date" max={localDateValue()} value={draft.date || localDateValue()} onChange={(event) => update('date', event.target.value)} /></label></div>
            <label>Source or notes<input maxLength={300} value={draft.source || ''} onChange={(event) => update('source', event.target.value)} placeholder="Supplier, forage, or notes" /></label>
          </> : section === 'breeding' ? <>
            <label>Animal or group<select value={draft.animalId || ''} onChange={(event) => update('animalId', event.target.value)}><option value="">Whole herd / flock</option>{activeAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.animalId || animal.species} · {animal.species}</option>)}</select></label>
            <label>Event<select value={draft.eventType || 'Breeding'} onChange={(event) => update('eventType', event.target.value)}>{['Breeding', 'Mating', 'Artificial insemination', 'Pregnancy check', 'Birth / hatch', 'Weaning'].map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Event date<input required type="date" max={localDateValue()} value={draft.date || localDateValue()} onChange={(event) => update('date', event.target.value)} /></label>
            <label>Expected calving / lambing / hatch date<input type="date" min={draft.date || localDateValue()} value={draft.expectedDate || ''} onChange={(event) => update('expectedDate', event.target.value)} /></label>
            <label>Notes<input maxLength={500} value={draft.notes || ''} onChange={(event) => update('notes', event.target.value)} /></label>
          </> : section === 'production' ? <>
            <label>Product<select value={draft.productType || 'Milk'} onChange={(event) => update('productType', event.target.value)}>{['Milk', 'Eggs', 'Meat', 'Honey', 'Hides', 'Other'].map((product) => <option key={product}>{product}</option>)}</select></label>
            <label>Animal or group (optional)<select value={draft.animalId || ''} onChange={(event) => update('animalId', event.target.value)}><option value="">Whole herd / flock</option>{activeAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.animalId || animal.species} · {animal.species}</option>)}</select></label>
            <div className="livestock-module-inline"><label>Quantity<input required type="number" min="0.01" step="any" value={draft.quantity || ''} onChange={(event) => update('quantity', event.target.value)} /></label><label>Unit<select value={draft.unit || (draft.productType === 'Eggs' ? 'eggs' : draft.productType === 'Meat' ? 'kg' : 'liters')} onChange={(event) => update('unit', event.target.value)}>{['liters', 'eggs', 'kg', 'pieces', 'other'].map((unit) => <option key={unit}>{unit}</option>)}</select></label></div>
            <label>Date<input required type="date" max={localDateValue()} value={draft.date || localDateValue()} onChange={(event) => update('date', event.target.value)} /></label>
            <label>Notes<input maxLength={300} value={draft.notes || ''} onChange={(event) => update('notes', event.target.value)} /></label>
          </> : <>
            <label>Product sold<input required maxLength={120} list="livestock-sale-products" value={draft.productType || ''} onChange={(event) => update('productType', event.target.value)} placeholder="Live cattle, eggs, milk, hides…" /><datalist id="livestock-sale-products">{['Live animal', 'Meat', 'Milk', 'Eggs', 'Hides', 'Honey', 'Other'].map((product) => <option key={product} value={product} />)}</datalist></label>
            <div className="livestock-module-inline"><label>Quantity<input required type="number" min="0.01" step="any" value={draft.quantity || ''} onChange={(event) => update('quantity', event.target.value)} /></label><label>Unit<select value={draft.unit || 'head'} onChange={(event) => update('unit', event.target.value)}>{['head', 'kg', 'liters', 'eggs', 'pieces', 'other'].map((unit) => <option key={unit}>{unit}</option>)}</select></label></div>
            <label>Total sale value (TZS)<input required type="number" min="1" step="any" value={draft.price || ''} onChange={(event) => update('price', event.target.value)} /></label>
            <label>Sale date<input required type="date" max={localDateValue()} value={draft.date || localDateValue()} onChange={(event) => update('date', event.target.value)} /></label>
            <label>Buyer or notes<input maxLength={300} value={draft.buyer || ''} onChange={(event) => update('buyer', event.target.value)} /></label>
          </>}
          <LivestockEvidenceCapture gps={gps} setGps={setGps} photo={photo} setPhoto={setPhoto} photoAddedAt={photoAddedAt} setPhotoAddedAt={setPhotoAddedAt} setError={setError} />
          {error && <p className="livestock-module-error" role="alert">{error}</p>}
          {notice && <p className="livestock-module-notice" role="status">{notice}</p>}
          <button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>Save record</button>
        </form>
        <section className="livestock-module-card">
          <h2>Saved records <span>{sectionRows.length}</span></h2>
          {sectionRows.length ? <div className="livestock-module-record-list">{[...sectionRows].sort(compareNewestFirst).map((entry) => (
            <article key={entry.id}>
              <span className="material-symbols-outlined">{section === 'facilities' ? 'home_work' : section === 'feed' ? 'grass' : section === 'breeding' ? 'event' : section === 'production' ? 'monitoring' : 'storefront'}</span>
              <div><strong>{section === 'facilities' ? entry.name : section === 'feed' ? entry.feedType : section === 'breeding' ? entry.eventType : entry.productType}</strong>
                <p>{section === 'facilities'
                  ? `${entry.facilityType || 'Housing'}${entry.capacity ? ` · Capacity ${entry.capacity}` : ''}${entry.location ? ' · Location attached' : ''}`
                  : section === 'feed'
                    ? `${entry.quantity} ${entry.unit || 'kg'}${entry.cost ? ` · TZS ${Number(entry.cost).toLocaleString()}` : ''}${entry.source ? ` · ${entry.source}` : ''}`
                    : section === 'breeding'
                      ? `${formatDate(entry.date)}${entry.expectedDate ? ` · Expected ${formatDate(entry.expectedDate)}` : ''}${entry.notes ? ` · ${entry.notes}` : ''}`
                      : section === 'production'
                        ? `${entry.quantity} ${entry.unit || ''} · ${formatDate(entry.date)}${entry.notes ? ` · ${entry.notes}` : ''}`
                        : `${entry.quantity} ${entry.unit || ''} · TZS ${Number(entry.price || 0).toLocaleString()} · ${formatDate(entry.date)}${entry.buyer ? ` · ${entry.buyer}` : ''}`}</p>
              </div>
            </article>
          ))}</div> : <div className="livestock-empty"><span className="material-symbols-outlined">{section === 'facilities' ? 'home_work' : section === 'feed' ? 'grass' : section === 'breeding' ? 'event' : section === 'production' ? 'monitoring' : 'storefront'}</span><strong>No records yet</strong><p>Saved records will appear here. All entries are farmer-provided.</p></div>}
          <p className="livestock-data-note">These entries are stored with your Digital Farm profile and are not independently verified.</p>
        </section>
      </div>
    </section>
  );
}

function LivestockWorkspace({ profile, records, farmerId, farmId, search = '', onSearch, onRecordsChange, onProfileSave, onNavigate, onBack }) {
  const [dialog, setDialog] = useState('');
  const [activeSection, setActiveSection] = useState('register');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [animalFilter, setAnimalFilter] = useState('active');
  const [editingAnimalId, setEditingAnimalId] = useState('');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [healthLogOpen, setHealthLogOpen] = useState(false);
  const [evidenceGps, setEvidenceGps] = useState(null);
  const [evidencePhoto, setEvidencePhoto] = useState('');
  const [evidencePhotoAddedAt, setEvidencePhotoAddedAt] = useState('');
  const [animalDraft, setAnimalDraft] = useState({
    animalId: '', species: 'Cattle', breed: '', count: '1', age: '', earTag: '',
    health: 'not assessed', reproductiveStatus: 'not recorded', lastWeight: '', status: 'active',
  });
  const [milkDraft, setMilkDraft] = useState({ liters: '', date: localDateValue(), animalId: '', notes: '' });
  const [healthDraft, setHealthDraft] = useState({
    eventType: 'Vaccination', animalId: '', date: localDateValue(), dueDate: '', provider: '', dosage: '', notes: '',
  });
  const [quoteDraft, setQuoteDraft] = useState({
    species: 'Cattle', marketClass: '', market: profile.location || profile.region || '', price: '', date: localDateValue(),
  });

  const livestockRecords = Array.isArray(records.livestock) ? records.livestock : [];
  const activities = Array.isArray(records.activities) ? records.activities : [];
  const animals = livestockRecords.filter((record) => record.module === 'livestock' && record.species);
  const milkEntries = [
    ...activities.filter((entry) => entry.module === 'livestock-milk'),
    ...activities
      .filter((entry) => entry.module === 'livestock-production' && entry.productType === 'Milk')
      .map((entry) => ({ ...entry, liters: entry.quantity })),
  ];
  const healthEntries = activities.filter((entry) => entry.module === 'livestock-health');
  const marketQuotes = activities.filter((entry) => entry.module === 'livestock-market-quote');
  const productionEntries = activities.filter((entry) => entry.module === 'livestock-production');
  const baselineRecord = livestockRecords.find((record) => record.module === 'livestock-baseline');
  const animalHeadCount = animals
    .filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased')
    .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
  const legacyCountEntry = livestockRecords
    .filter((record) => record.module !== 'livestock' && record.module !== 'livestock-baseline' && Number.isFinite(Number(record.count)))
    .sort(compareNewestFirst)[0];
  const baselineHeads = Number(baselineRecord?.count
    ?? (animals.length
      ? Math.max(0, Number(profile.livestock || 0) - animalHeadCount)
      : Math.max(Number(profile.livestock || 0), Number(legacyCountEntry?.count || 0)))) || 0;
  const totalHeads = baselineHeads + animalHeadCount;
  const activeAnimals = animals.filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased');
  const assessedHeads = activeAnimals
    .filter((animal) => animal.health && animal.health !== 'not assessed')
    .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
  const healthyHeads = activeAnimals
    .filter((animal) => animal.health === 'healthy')
    .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
  const healthyPercent = assessedHeads ? Math.round((healthyHeads / assessedHeads) * 100) : null;
  const today = localDateValue();
  const milkToday = milkEntries
    .filter((entry) => String(entry.date).slice(0, 10) === today)
    .reduce((sum, entry) => sum + (Number(entry.liters) || 0), 0);
  const activeSpecies = [...new Set(activeAnimals.map((animal) => String(animal.species || '').trim()).filter(Boolean))];
  const quoteKey = (quote) => `${String(quote.species || '').toLowerCase()}|${String(quote.marketClass || '').trim().toLowerCase()}`;
  const quotesByKey = new Map();
  [...marketQuotes].sort(compareNewestFirst).forEach((quote) => {
    const key = quoteKey(quote);
    quotesByKey.set(key, [...(quotesByKey.get(key) || []), quote]);
  });
  const latestQuotes = [...quotesByKey.values()].map(([latest, previous]) => ({
    ...latest,
    change: previous && Number(previous.price) > 0
      ? ((Number(latest.price) - Number(previous.price)) / Number(previous.price)) * 100
      : null,
  }));
  const latestSpeciesQuotes = new Map();
  [...marketQuotes].sort(compareNewestFirst)
    .forEach((quote) => {
      const key = String(quote.species || '').toLowerCase();
      if (!latestSpeciesQuotes.has(key)) latestSpeciesQuotes.set(key, quote);
    });
  const canEstimateValue = baselineHeads === 0
    && activeAnimals.length > 0
    && activeSpecies.length > 0
    && activeSpecies.every((species) => latestSpeciesQuotes.has(species.toLowerCase()));
  const estimatedMarketValue = canEstimateValue
    ? activeAnimals.reduce((sum, animal) => sum
      + (Number(animal.count) || 0) * Number(latestSpeciesQuotes.get(String(animal.species).toLowerCase())?.price || 0), 0)
    : null;
  const milkWeek = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = localDateValue(date);
    return {
      date: key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      liters: milkEntries
        .filter((entry) => String(entry.date).slice(0, 10) === key)
        .reduce((sum, entry) => sum + (Number(entry.liters) || 0), 0),
    };
  }), [milkEntries]);
  const maxMilk = Math.max(...milkWeek.map((day) => day.liters), 0);
  const dueEvents = healthEntries
    .filter((entry) => entry.status !== 'completed' && entry.dueDate)
    .map((entry) => {
      const dueDate = new Date(`${String(entry.dueDate).slice(0, 10)}T12:00:00`);
      return { ...entry, daysUntilDue: Math.ceil((dueDate - new Date(`${today}T12:00:00`)) / 86400000) };
    })
    .filter((entry) => entry.daysUntilDue <= 7)
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue);
  const recentVetVisit = [...healthEntries]
    .filter((entry) => entry.eventType === 'Vet visit')
    .sort(compareNewestFirst)[0];
  const visibleAnimals = useMemo(() => animals.filter((animal) => {
    const isActive = animal.status !== 'sold' && animal.status !== 'deceased';
    const matchesStatus = animalFilter === 'all' || (animalFilter === 'active' ? isActive : !isActive);
    const text = `${animal.animalId} ${animal.earTag} ${animal.species} ${animal.breed} ${animal.health}`.toLowerCase();
    return matchesStatus && (!search.trim() || text.includes(search.trim().toLowerCase()));
  }), [animals, animalFilter, search]);

  const saveHerd = (nextRecords) => {
    const nextAnimals = nextRecords.filter((record) => record.module === 'livestock' && record.species);
    const existingBaseline = nextRecords.find((record) => record.module === 'livestock-baseline');
    const nextAnimalHeads = nextAnimals
      .filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased')
      .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
    const nextBaseline = existingBaseline ? Number(existingBaseline.count || 0) : baselineHeads;
    const withBaseline = existingBaseline || nextAnimals.length
      ? nextRecords.some((record) => record.module === 'livestock-baseline')
        ? nextRecords
        : [...nextRecords, { id: createId(), module: 'livestock-baseline', count: nextBaseline, createdAt: new Date().toISOString() }]
      : nextRecords;
    onRecordsChange('livestock', withBaseline);
    onProfileSave({ ...profile, livestock: String(nextBaseline + nextAnimalHeads) });
  };

  const requireGeotaggedEvidence = () => {
    if (!farmId || !farmerId) {
      setFormError('Create or select a farm before saving animal records.');
      return false;
    }
    if (!evidenceGps || evidenceGps.accuracy_m > 50
      || Math.abs(Date.now() - Date.parse(evidenceGps.captured_at)) > 15 * 60 * 1000
      || Math.abs(Date.parse(evidenceGps.captured_at) - Date.parse(evidencePhotoAddedAt)) > 15 * 60 * 1000
      || !evidencePhoto) {
      setFormError('Capture fresh GPS with accuracy within 50 m and attach a photo before saving.');
      return false;
    }
    return true;
  };

  const openNewAnimal = () => {
    setFormError('');
    setEditingAnimalId('');
    setEvidenceGps(null);
    setEvidencePhoto('');
    setEvidencePhotoAddedAt('');
    setAnimalDraft({
      animalId: '', species: 'Cattle', breed: '', count: '1', age: '', earTag: '',
      health: 'not assessed', reproductiveStatus: 'not recorded', lastWeight: '', status: 'active',
    });
    setDialog('animal');
  };

  const openEditAnimal = (animal) => {
    setFormError('');
    setEditingAnimalId(animal.id);
    setEvidenceGps(null);
    setEvidencePhoto('');
    setEvidencePhotoAddedAt('');
    setAnimalDraft({
      animalId: animal.animalId || '', species: animal.species || 'Cattle', breed: animal.breed || '',
      count: String(animal.count || 1), age: animal.age || '', earTag: animal.earTag || '',
      health: animal.health || 'not assessed', reproductiveStatus: animal.reproductiveStatus || 'not recorded',
      lastWeight: animal.lastWeight || '', status: animal.status || 'active',
    });
    setDialog('animal');
  };

  const saveAnimal = (event) => {
    event.preventDefault();
    if (!requireGeotaggedEvidence()) return;
    const count = Number(animalDraft.count);
    const species = animalDraft.species.trim();
    const animalId = animalDraft.animalId.trim() || makeAnimalCode(species, animals);
    if (!species || !Number.isInteger(count) || count < 1) {
      setFormError('Choose a species and enter a whole-number head count greater than zero.');
      return;
    }
    if (animals.some((animal) => animal.id !== editingAnimalId
      && (String(animal.animalId || '').toLowerCase() === animalId.toLowerCase()
        || (animalDraft.earTag.trim() && String(animal.earTag || '').toLowerCase() === animalDraft.earTag.trim().toLowerCase())))) {
      setFormError('That animal ID or ear tag is already in your register.');
      return;
    }
    const existing = livestockRecords.find((animal) => animal.id === editingAnimalId);
    const savedAnimal = {
      ...existing,
      ...animalDraft,
      farmerId: existing?.farmerId || farmerId,
      farmId: existing?.farmId || farmId,
      gpsStamp: { latitude: evidenceGps.latitude, longitude: evidenceGps.longitude, accuracy: evidenceGps.accuracy_m, stampedAt: evidenceGps.captured_at },
      photo: evidencePhoto,
      photoAddedAt: evidencePhotoAddedAt,
      evidenceKind: 'geotagged',
      animalId,
      species,
      breed: animalDraft.breed.trim(),
      count,
      earTag: animalDraft.earTag.trim(),
      lastWeight: animalDraft.lastWeight === '' ? '' : Number(animalDraft.lastWeight),
      id: editingAnimalId || createId(),
      module: 'livestock',
      updatedAt: new Date().toISOString(),
      ...(editingAnimalId ? {} : { createdAt: new Date().toISOString() }),
    };
    const next = editingAnimalId
      ? livestockRecords.map((animal) => animal.id === editingAnimalId ? savedAnimal : animal)
      : [...livestockRecords, savedAnimal];
    saveHerd(next);
    setFormError('');
    setDialog('');
    setNotice(editingAnimalId ? 'Animal record updated.' : 'Animal record added.');
  };

  const removeAnimal = (animal) => {
    if (!window.confirm(`Remove ${animal.animalId || animal.species} from your livestock register? This cannot be undone.`)) return;
    saveHerd(livestockRecords.filter((record) => record.id !== animal.id));
    setNotice('Animal record removed from your register.');
  };

  const updateActivity = (nextActivity) => onRecordsChange('activities', nextActivity);

  const openMilkDialog = () => {
    setFormError('');
    setEvidenceGps(null);
    setEvidencePhoto('');
    setEvidencePhotoAddedAt('');
    setMilkDraft({ liters: '', date: localDateValue(), animalId: '', notes: '' });
    setDialog('milk');
  };

  const saveMilk = (event) => {
    event.preventDefault();
    if (!requireGeotaggedEvidence()) return;
    const liters = Number(milkDraft.liters);
    if (!Number.isFinite(liters) || liters <= 0 || !milkDraft.date || milkDraft.date > today) {
      setFormError('Enter a milk quantity above zero and choose a date that is not in the future.');
      return;
    }
    updateActivity([...activities, {
      id: createId(), module: 'livestock-milk', liters, date: milkDraft.date,
      animalId: milkDraft.animalId, notes: milkDraft.notes.trim(), createdAt: new Date().toISOString(),
      farmerId, farmId, gpsStamp: { latitude: evidenceGps.latitude, longitude: evidenceGps.longitude, accuracy: evidenceGps.accuracy_m, stampedAt: evidenceGps.captured_at },
      photo: evidencePhoto, photoAddedAt: evidencePhotoAddedAt, evidenceKind: 'geotagged',
    }]);
    setMilkDraft({ liters: '', date: localDateValue(), animalId: '', notes: '' });
    setFormError('');
    setDialog('');
    setNotice('Milk yield saved to your livestock production log.');
  };

  const saveHealthEvent = (event) => {
    event.preventDefault();
    if (!requireGeotaggedEvidence()) return;
    if (!healthDraft.eventType || !healthDraft.date || (healthDraft.dueDate && healthDraft.dueDate < healthDraft.date)) {
      setFormError('Choose a valid event date. A follow-up date cannot be earlier than the event date.');
      return;
    }
    updateActivity([...activities, {
      ...healthDraft, id: createId(), module: 'livestock-health', status: 'open',
      notes: healthDraft.notes.trim(), provider: healthDraft.provider.trim(), dosage: healthDraft.dosage.trim(), createdAt: new Date().toISOString(),
      farmerId, farmId, gpsStamp: { latitude: evidenceGps.latitude, longitude: evidenceGps.longitude, accuracy: evidenceGps.accuracy_m, stampedAt: evidenceGps.captured_at },
      photo: evidencePhoto, photoAddedAt: evidencePhotoAddedAt, evidenceKind: 'geotagged',
    }]);
    setFormError('');
    setDialog('');
    setNotice('Health event saved. Follow-up reminders are based on the date you entered.');
  };

  const openHealthDialog = (animalId = '', eventType = 'Vaccination') => {
    setFormError('');
    setEvidenceGps(null);
    setEvidencePhoto('');
    setEvidencePhotoAddedAt('');
    setSelectedAnimalId(animalId);
    setHealthDraft({ eventType, animalId, date: localDateValue(), dueDate: '', provider: '', dosage: '', notes: '' });
    setDialog('health');
  };

  const openQuoteDialog = () => {
    setFormError('');
    setEvidenceGps(null);
    setEvidencePhoto('');
    setQuoteDraft({ species: 'Cattle', marketClass: '', market: profile.location || profile.region || '', price: '', date: localDateValue() });
    setDialog('quote');
  };

  const markHealthComplete = (healthId) => {
    updateActivity(activities.map((entry) => entry.id === healthId
      ? { ...entry, status: 'completed', completedAt: new Date().toISOString() }
      : entry));
    setNotice('Health reminder marked complete in your records.');
  };

  const saveMarketQuote = (event) => {
    event.preventDefault();
    if (!requireGeotaggedEvidence()) return;
    const price = Number(quoteDraft.price);
    if (!quoteDraft.species || !quoteDraft.date || quoteDraft.date > today || !Number.isFinite(price) || price <= 0) {
      setFormError('Choose a species, enter a market price above zero, and record a quote date that is not in the future.');
      return;
    }
    updateActivity([...activities, {
      ...quoteDraft, id: createId(), module: 'livestock-market-quote', price,
      market: quoteDraft.market.trim(), marketClass: quoteDraft.marketClass.trim(),
      createdAt: new Date().toISOString(),
      farmerId, farmId, gpsStamp: { latitude: evidenceGps.latitude, longitude: evidenceGps.longitude, accuracy: evidenceGps.accuracy_m, stampedAt: evidenceGps.captured_at },
      photo: evidencePhoto, photoAddedAt: evidencePhotoAddedAt, evidenceKind: 'geotagged',
    }]);
    setQuoteDraft({ species: 'Cattle', marketClass: '', market: profile.location || profile.region || '', price: '', date: localDateValue() });
    setFormError('');
    setDialog('');
    setNotice('Market quote saved as a farmer-entered reference. It is not a live or verified price.');
  };

  const exportMilk = () => downloadCsv('agrinest-livestock-milk-yield.csv', [
    ['Date', 'Animal ID', 'Liters', 'Notes'],
    ...milkEntries.map((entry) => [entry.date, entry.animalId, entry.liters, entry.notes]),
  ]);
  const exportAnimals = () => downloadCsv('agrinest-livestock-register.csv', [
    ['Animal ID', 'Species', 'Breed', 'Count', 'Age', 'Ear tag', 'Health', 'Status', 'Last weight (kg)'],
    ...animals.map((animal) => [animal.animalId, animal.species, animal.breed, animal.count, animal.age, animal.earTag, animal.health, animal.status, animal.lastWeight]),
  ]);

  return (
    <main className={`livestock-page ${activeSection === 'health' ? 'livestock-health-page' : ''}`} aria-label="Livestock Management">
      {notice && <div className="livestock-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <nav className="livestock-section-nav" aria-label="Livestock and poultry records">
        {livestockSections.map((section) => <button
          key={section.id}
          type="button"
          className={activeSection === section.id ? 'active' : ''}
          aria-current={activeSection === section.id ? 'page' : undefined}
          onClick={() => setActiveSection(section.id)}
        ><span className="material-symbols-outlined">{section.icon}</span>{section.label}</button>)}
      </nav>
      {activeSection === 'knowledge' ? <LivestockKnowledge onBack={onBack} /> : activeSection === 'health' ? <LivestockHealthWorkspace
        profile={profile}
        records={records}
        animals={animals}
        healthEntries={healthEntries}
        dueEvents={dueEvents}
        totalHeads={totalHeads}
        healthyPercent={healthyPercent}
        healthyHeads={healthyHeads}
        assessedHeads={assessedHeads}
        search={search}
        onSearch={onSearch}
        onBack={onBack}
        onShowRegister={() => setActiveSection('register')}
        onSelectSection={setActiveSection}
        onAddAnimal={openNewAnimal}
        onOpenHealthDialog={openHealthDialog}
        onMarkHealthComplete={markHealthComplete}
        onViewHealthLog={() => setHealthLogOpen(true)}
        onRecordsChange={onRecordsChange}
      /> : !['register'].includes(activeSection) ? <LivestockRecordsSection
        section={activeSection}
        records={records}
        animals={animals}
        profile={profile}
        farmerId={farmerId}
        farmId={farmId}
        onRecordsChange={onRecordsChange}
      /> : <>
      <header className="livestock-heading">
        <div>
          <button type="button" className="livestock-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Digital Farm</button>
          <span className="farmer-workspace-eyebrow">SHAMBA LANGU · ANIMAL RECORDS</span>
          <h1>Livestock &amp; Poultry</h1>
          <small>Farmer ID {farmerId || 'Unavailable'} · Farm ID {farmId || 'Create a farm first'}</small>
          <p>Register your herd or flock, then keep health, feed, housing, breeding, production, and sales records together.</p>
        </div>
        <div className="livestock-heading-actions">
          <button type="button" className="livestock-secondary-button" onClick={() => setActiveSection('health')}><span className="material-symbols-outlined">vaccines</span>Health &amp; Vaccines</button>
          <button type="button" className="livestock-secondary-button" onClick={() => openHealthDialog()}><span className="material-symbols-outlined">medical_services</span>Log health event</button>
          <button type="button" className="livestock-primary-button" onClick={openNewAnimal}><span className="material-symbols-outlined">add</span>Add animal</button>
        </div>
      </header>

      <section className="livestock-stats" aria-label="Herd summary">
        <article className="livestock-stat"><span><span className="material-symbols-outlined">pets</span>Total head</span><strong>{totalHeads.toLocaleString()}</strong><small>{animals.length ? `${animals.length} saved herd record${animals.length === 1 ? '' : 's'}` : 'From your saved herd count'}</small></article>
        <article className="livestock-stat is-mint"><span><span className="material-symbols-outlined">water_drop</span>Milk today</span><strong>{milkToday.toLocaleString(undefined, { maximumFractionDigits: 1 })}<small> L</small></strong><small>{milkEntries.some((entry) => String(entry.date).slice(0, 10) === today) ? 'From today’s saved yield entries' : 'No milk yield recorded today'}</small></article>
        <article className="livestock-stat"><span><span className="material-symbols-outlined">monitor_heart</span>Healthy</span><strong>{healthyPercent === null ? '—' : `${healthyPercent}`}<small>{healthyPercent === null ? '' : '%'}</small></strong><small>{assessedHeads ? `${healthyHeads} of ${assessedHeads} assessed head` : 'No health assessments recorded'}</small></article>
        <article className="livestock-stat is-peach"><span><span className="material-symbols-outlined">account_balance_wallet</span>Market value</span><strong>{estimatedMarketValue === null ? '—' : formatCompactTzs(estimatedMarketValue)}</strong><small>{estimatedMarketValue === null ? 'Add herd records and local quotes' : 'Estimate from saved local quotes'}</small></article>
      </section>

      <div className="livestock-layout">
        <div className="livestock-main-column">
          <section className="livestock-card livestock-animal-card">
            <header className="livestock-card-heading">
              <div><h2>My Animals</h2><p>{activeAnimals.length} active herd record{activeAnimals.length === 1 ? '' : 's'} · {animalHeadCount.toLocaleString()} registered head</p></div>
              <div className="livestock-card-actions">
                <button type="button" className="livestock-small-button" onClick={exportAnimals} disabled={!animals.length}><span className="material-symbols-outlined">download</span>Export</button>
                <button type="button" className="livestock-primary-button" onClick={openNewAnimal}><span className="material-symbols-outlined">add</span>Add animal</button>
              </div>
            </header>
            <div className="livestock-table-tools">
              <label className="livestock-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => onSearch?.(event.target.value)} placeholder="Search ID, breed, or species" aria-label="Search livestock register" /></label>
              <label className="livestock-filter">Show<select value={animalFilter} onChange={(event) => setAnimalFilter(event.target.value)}><option value="active">Active</option><option value="all">All records</option><option value="inactive">Sold or deceased</option></select></label>
            </div>
            {visibleAnimals.length ? <div className="livestock-table-wrap"><table className="livestock-table">
              <thead><tr><th>ID &amp; breed</th><th>Type</th><th>Age / count</th><th>Health status</th><th>Actions</th></tr></thead>
              <tbody>{visibleAnimals.map((animal) => {
                const healthLabel = animal.reproductiveStatus === 'pregnant' ? 'Pregnant' : animal.status === 'sold' ? 'Sold' : animal.status === 'deceased' ? 'Deceased' : animal.health || 'Not assessed';
                const badgeType = healthLabel === 'healthy' || healthLabel === 'Healthy' ? 'healthy'
                  : healthLabel === 'Pregnant' ? 'pregnant'
                    : healthLabel === 'Sold' || healthLabel === 'Deceased' ? 'inactive' : 'attention';
                return <tr key={animal.id}>
                  <td><span className="livestock-animal-identity"><span className="livestock-animal-icon material-symbols-outlined">{animal.species?.toLowerCase() === 'chicken' ? 'egg_alt' : 'pets'}</span><span><strong>{animal.animalId || animal.earTag || animal.species}</strong><small>{animal.breed || 'Breed not recorded'}{animal.earTag ? ` · Tag ${animal.earTag}` : ''}</small></span></span></td>
                  <td>{animal.species}</td>
                  <td>{animal.age || 'Age not set'}<small className="livestock-count-subtext">{Number(animal.count || 1)} head</small></td>
                  <td><span className={`livestock-status-badge ${badgeType}`}>{healthLabel}</span></td>
                  <td><div className="livestock-row-actions"><button type="button" onClick={() => openEditAnimal(animal)}>Edit</button><button type="button" aria-label={`Log health event for ${animal.animalId || animal.species}`} onClick={() => openHealthDialog(animal.id)}>Log event</button>{animal.status !== 'sold' && animal.status !== 'deceased' && <button type="button" onClick={() => saveHerd(livestockRecords.map((entry) => entry.id === animal.id ? { ...entry, status: 'sold', updatedAt: new Date().toISOString() } : entry))}>Mark sold</button>}<button type="button" className="is-danger" onClick={() => removeAnimal(animal)}>Remove</button></div></td>
                </tr>;
              })}</tbody>
            </table></div> : <div className="livestock-empty"><span className="material-symbols-outlined">pets</span><strong>{animals.length ? 'No animal records match' : 'Your animal register is empty'}</strong><p>{animals.length ? 'Try another search or choose a different status.' : 'Add a herd record to keep animal identity, breed, and health details together.'}</p>{!animals.length && <button type="button" className="livestock-primary-button" onClick={openNewAnimal}><span className="material-symbols-outlined">add</span>Add first animal</button>}</div>}
            <p className="livestock-data-note">Animal identity, counts, and health status are farmer-entered and are not independently verified.</p>
          </section>

          <section className="livestock-card livestock-milk-card">
            <header className="livestock-card-heading">
              <div><h2>Daily Milk Yield</h2><p>Last 7 days · liters from your saved production log</p></div>
              <div className="livestock-card-actions"><button type="button" className="livestock-small-button" onClick={exportMilk} disabled={!milkEntries.length}><span className="material-symbols-outlined">download</span>Export</button><button type="button" className="livestock-secondary-button" onClick={openMilkDialog}><span className="material-symbols-outlined">add</span>Log milk</button></div>
            </header>
            {milkWeek.some((day) => day.liters > 0) ? <div className="livestock-chart" role="img" aria-label={`Milk yield over the last seven days: ${milkWeek.map((day) => `${day.label} ${day.liters} liters`).join(', ')}`}>
              <div className="livestock-chart-bars">{milkWeek.map((day) => <div className="livestock-chart-day" key={day.date}>
                <div className="livestock-chart-bar-wrap"><span className="livestock-chart-value">{day.liters ? `${day.liters} L` : ''}</span><i style={{ height: `${day.liters ? Math.max(8, day.liters / maxMilk * 100) : 0}%` }} /></div>
                <small>{day.label}</small>
              </div>)}</div>
            </div> : <div className="livestock-chart-empty"><span className="material-symbols-outlined">water_drop</span><strong>No milk yields recorded in the last seven days</strong><p>Log a milking entry to build your production chart.</p></div>}
          </section>
        </div>

        <aside className="livestock-sidebar">
          <section className="livestock-card livestock-health-card">
            <header className="livestock-sidebar-heading"><h2><span className="material-symbols-outlined">medical_services</span>Health &amp; Vet</h2><button type="button" aria-label="Add health event" onClick={() => openHealthDialog()}><span className="material-symbols-outlined">add</span></button></header>
            {dueEvents.length ? <div className="livestock-due-list">{dueEvents.slice(0, 3).map((entry) => <article className={`livestock-due-item ${entry.daysUntilDue < 0 ? 'is-overdue' : ''}`} key={entry.id}>
              <span className="material-symbols-outlined">warning</span><div><strong>{entry.eventType} {entry.daysUntilDue < 0 ? 'overdue' : 'due'}</strong><p>{entry.animalId ? `${animals.find((animal) => animal.id === entry.animalId)?.animalId || 'Animal'} · ` : ''}{formatDate(entry.dueDate)}</p><button type="button" onClick={() => markHealthComplete(entry.id)}>Mark complete</button></div>
            </article>)}</div> : <div className="livestock-no-reminders"><span className="material-symbols-outlined">event_available</span><p>No upcoming health reminders saved. Add a vaccination, deworming, or follow-up date to track it here.</p></div>}
            <article className="livestock-vet-visit"><span className="material-symbols-outlined">assignment</span><div><strong>Recent Vet Visit</strong>{recentVetVisit ? <><p>{recentVetVisit.provider || 'Provider not recorded'} · {recentVetVisit.notes || 'No visit notes'}</p><small>{formatDate(recentVetVisit.date)}</small></> : <><p>No vet visit has been added to your records.</p><small>Record visits to keep a health history.</small></>}</div></article>
            <button type="button" className="livestock-outline-button" onClick={() => setHealthLogOpen(true)}>View full log <span>{healthEntries.length}</span></button>
          </section>

          <section className="livestock-card livestock-market-card">
            <header className="livestock-sidebar-heading"><h2><span className="material-symbols-outlined">storefront</span>Market Prices</h2><span className="livestock-region">{profile.region || profile.district || 'Region not set'}</span></header>
            <p className="livestock-market-caption">Your saved local quotes · not a live market feed</p>
            {latestQuotes.length ? <ul className="livestock-price-list">{latestQuotes.slice(0, 5).map((quote) => <li key={quote.id}>
              <span><strong>{quote.species}{quote.marketClass ? ` (${quote.marketClass})` : ''}</strong><small>{quote.market || 'Market not recorded'} · {formatDate(quote.date)}</small></span>
              <span className="livestock-price-value"><strong>{formatTzs(quote.price)}</strong>{quote.change === null ? <small>First quote</small> : <small className={quote.change > 0 ? 'is-up' : quote.change < 0 ? 'is-down' : ''}>{quote.change > 0 ? '+' : ''}{quote.change.toFixed(1)}% vs previous</small>}</span>
            </li>)}</ul> : <div className="livestock-no-quotes"><span className="material-symbols-outlined">price_change</span><p>No local price quotes recorded yet.</p></div>}
            <p className="livestock-market-disclaimer">Prices and changes are based on entries you provide. They are not verified or financial advice.</p>
            <button type="button" className="livestock-outline-button" onClick={openQuoteDialog}><span className="material-symbols-outlined">add</span>Record market quote</button>
          </section>

          <section className="livestock-card livestock-connected-services">
            <header className="livestock-sidebar-heading"><h2><span className="material-symbols-outlined">hub</span>Farm services</h2></header>
            <p>Use your animal and product records with AGRI-NEST services.</p>
            <button type="button" onClick={() => onNavigate?.('farm-operations')}><span className="material-symbols-outlined">account_balance</span>Shared budgets &amp; team</button>
            <button type="button" onClick={() => onNavigate?.('marketplace')}><span className="material-symbols-outlined">storefront</span>Sell animals &amp; products</button>
            <button type="button" onClick={() => onNavigate?.('transport')}><span className="material-symbols-outlined">local_shipping</span>Arrange transport</button>
            <button type="button" onClick={() => onNavigate?.('experts')}><span className="material-symbols-outlined">support_agent</span>Ask an expert</button>
          </section>
        </aside>
      </div>
      </>}

      {dialog && <div className="livestock-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(''); }}>
        <section className="livestock-modal" role="dialog" aria-modal="true" aria-labelledby="livestock-dialog-title">
          <header className="livestock-modal-heading"><div><span className="farmer-workspace-eyebrow">LIVESTOCK REGISTER</span><h2 id="livestock-dialog-title">{dialog === 'animal' ? editingAnimalId ? 'Edit animal record' : 'Add an animal' : dialog === 'milk' ? 'Log milk yield' : dialog === 'health' ? 'Record a health event' : 'Record a local market quote'}</h2></div><button type="button" aria-label="Close dialog" onClick={() => setDialog('')}><span className="material-symbols-outlined">close</span></button></header>
          {formError && <p className="livestock-form-error" role="alert">{formError}</p>}
          {dialog === 'animal' ? <form className="livestock-form" onSubmit={saveAnimal}>
            <div className="livestock-form-grid">
              <label>Species<input required list="livestock-species-options" value={animalDraft.species} onChange={(event) => setAnimalDraft((current) => ({ ...current, species: event.target.value }))} /><datalist id="livestock-species-options">{[...new Set([...animalSpecies, ...animals.map((animal) => animal.species).filter(Boolean)])].map((species) => <option key={species} value={species} />)}</datalist></label>
              <label>Animal ID<input value={animalDraft.animalId} onChange={(event) => setAnimalDraft((current) => ({ ...current, animalId: event.target.value }))} placeholder="Auto-generated if blank" /></label>
              <label>Breed<input value={animalDraft.breed} onChange={(event) => setAnimalDraft((current) => ({ ...current, breed: event.target.value }))} placeholder="e.g. Friesian" /></label>
              <label>Head count<input required type="number" min="1" step="1" value={animalDraft.count} onChange={(event) => setAnimalDraft((current) => ({ ...current, count: event.target.value }))} /></label>
              <label>Age or age range<input value={animalDraft.age} onChange={(event) => setAnimalDraft((current) => ({ ...current, age: event.target.value }))} placeholder="e.g. 3 years" /></label>
              <label>Ear tag (optional)<input value={animalDraft.earTag} onChange={(event) => setAnimalDraft((current) => ({ ...current, earTag: event.target.value }))} /></label>
              <label>Health assessment<select value={animalDraft.health} onChange={(event) => setAnimalDraft((current) => ({ ...current, health: event.target.value }))}>{animalHealthOptions.map((option) => <option key={option} value={option}>{option.replace(/^./, (character) => character.toUpperCase())}</option>)}</select></label>
              <label>Reproductive status<select value={animalDraft.reproductiveStatus} onChange={(event) => setAnimalDraft((current) => ({ ...current, reproductiveStatus: event.target.value }))}><option value="not recorded">Not recorded</option><option value="pregnant">Pregnant</option><option value="lactating">Lactating</option><option value="not applicable">Not applicable</option></select></label>
              <label>Last weight (kg)<input type="number" min="0" step="0.1" value={animalDraft.lastWeight} onChange={(event) => setAnimalDraft((current) => ({ ...current, lastWeight: event.target.value }))} /></label>
              {editingAnimalId && <label>Record status<select value={animalDraft.status} onChange={(event) => setAnimalDraft((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="sold">Sold</option><option value="deceased">Deceased</option></select></label>}
            </div>
            <LivestockEvidenceCapture gps={evidenceGps} setGps={setEvidenceGps} photo={evidencePhoto} setPhoto={setEvidencePhoto} photoAddedAt={evidencePhotoAddedAt} setPhotoAddedAt={setEvidencePhotoAddedAt} setError={setFormError} />
            <p className="livestock-form-disclaimer">These are farmer-entered herd records. AGRI-NEST does not verify animal identity or diagnose animal health.</p>
            <div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>{editingAnimalId ? 'Save changes' : 'Add animal'}</button></div>
          </form> : dialog === 'milk' ? <form className="livestock-form" onSubmit={saveMilk}>
            <div className="livestock-form-grid"><label>Milk yield (liters)<input required type="number" min="0.1" step="0.1" value={milkDraft.liters} onChange={(event) => setMilkDraft((current) => ({ ...current, liters: event.target.value }))} /></label><label>Milking date<input required type="date" max={today} value={milkDraft.date} onChange={(event) => setMilkDraft((current) => ({ ...current, date: event.target.value }))} /></label><label>Animal or group (optional)<select value={milkDraft.animalId} onChange={(event) => setMilkDraft((current) => ({ ...current, animalId: event.target.value }))}><option value="">Not specified</option>{activeAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.animalId || animal.species} · {animal.species}</option>)}</select></label><label className="is-wide">Notes (optional)<textarea value={milkDraft.notes} onChange={(event) => setMilkDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div>
            <LivestockEvidenceCapture gps={evidenceGps} setGps={setEvidenceGps} photo={evidencePhoto} setPhoto={setEvidencePhoto} photoAddedAt={evidencePhotoAddedAt} setPhotoAddedAt={setEvidencePhotoAddedAt} setError={setFormError} />
            <p className="livestock-form-disclaimer">Milk entries are recorded as provided by you; the app does not measure or verify production.</p><div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>Save yield</button></div>
          </form> : dialog === 'health' ? <form className="livestock-form" onSubmit={saveHealthEvent}>
            <div className="livestock-form-grid"><label>Event type<select value={healthDraft.eventType} onChange={(event) => setHealthDraft((current) => ({ ...current, eventType: event.target.value }))}>{healthEventTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Animal or group (optional)<select value={healthDraft.animalId || selectedAnimalId} onChange={(event) => setHealthDraft((current) => ({ ...current, animalId: event.target.value }))}><option value="">Whole herd / not specified</option>{activeAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.animalId || animal.species} · {animal.species}</option>)}</select></label><label>Event date<input required type="date" value={healthDraft.date} onChange={(event) => setHealthDraft((current) => ({ ...current, date: event.target.value }))} /></label><label>Next due / follow-up date<input type="date" min={healthDraft.date} value={healthDraft.dueDate} onChange={(event) => setHealthDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label><label>Vet or provider (optional)<input value={healthDraft.provider} onChange={(event) => setHealthDraft((current) => ({ ...current, provider: event.target.value }))} /></label><label>Dosage or product (optional)<input value={healthDraft.dosage} onChange={(event) => setHealthDraft((current) => ({ ...current, dosage: event.target.value }))} /></label><label className="is-wide">Notes<textarea value={healthDraft.notes} onChange={(event) => setHealthDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Treatment, vaccine name, or visit notes" /></label></div>
            <LivestockEvidenceCapture gps={evidenceGps} setGps={setEvidenceGps} photo={evidencePhoto} setPhoto={setEvidencePhoto} photoAddedAt={evidencePhotoAddedAt} setPhotoAddedAt={setEvidencePhotoAddedAt} setError={setFormError} />
            <p className="livestock-form-disclaimer">This health log is not a veterinary diagnosis. Contact a qualified animal-health professional for urgent concerns.</p><div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>Save health event</button></div>
          </form> : <form className="livestock-form" onSubmit={saveMarketQuote}>
            <div className="livestock-form-grid"><label>Species<select value={quoteDraft.species} onChange={(event) => setQuoteDraft((current) => ({ ...current, species: event.target.value }))}>{animalSpecies.map((species) => <option key={species}>{species}</option>)}</select></label><label>Class or animal type (optional)<input value={quoteDraft.marketClass} onChange={(event) => setQuoteDraft((current) => ({ ...current, marketClass: event.target.value }))} placeholder="e.g. bull, heifer, mature goat" /></label><label>Price per head (TZS)<input required type="number" min="1" step="1" value={quoteDraft.price} onChange={(event) => setQuoteDraft((current) => ({ ...current, price: event.target.value }))} /></label><label>Market or location<input value={quoteDraft.market} onChange={(event) => setQuoteDraft((current) => ({ ...current, market: event.target.value }))} /></label><label>Quote date<input required type="date" max={today} value={quoteDraft.date} onChange={(event) => setQuoteDraft((current) => ({ ...current, date: event.target.value }))} /></label></div>
            <LivestockEvidenceCapture gps={evidenceGps} setGps={setEvidenceGps} photo={evidencePhoto} setPhoto={setEvidencePhoto} photoAddedAt={evidencePhotoAddedAt} setPhotoAddedAt={setEvidencePhotoAddedAt} setError={setFormError} />
            <p className="livestock-form-disclaimer">Record a quote you observed or received. AGRI-NEST does not provide live market prices; the herd value estimate uses your latest saved quote per species.</p><div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>Save quote</button></div>
          </form>}
        </section>
      </div>}

      {healthLogOpen && <div className="livestock-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHealthLogOpen(false); }}>
        <section className="livestock-modal livestock-health-log-modal" role="dialog" aria-modal="true" aria-labelledby="livestock-health-log-title">
          <header className="livestock-modal-heading"><div><span className="farmer-workspace-eyebrow">ANIMAL HEALTH HISTORY</span><h2 id="livestock-health-log-title">Health &amp; vet log</h2></div><button type="button" aria-label="Close health log" onClick={() => setHealthLogOpen(false)}><span className="material-symbols-outlined">close</span></button></header>
          {healthEntries.length ? <div className="livestock-health-log">{[...healthEntries].sort(compareNewestFirst).map((entry) => <article key={entry.id}><span className="material-symbols-outlined">{entry.eventType === 'Vet visit' ? 'medical_services' : entry.eventType === 'Vaccination' ? 'vaccines' : 'health_and_safety'}</span><div><strong>{entry.eventType}</strong><p>{entry.notes || 'No notes recorded'}{entry.provider ? ` · ${entry.provider}` : ''}</p><small>{formatDate(entry.date)}{entry.dueDate ? ` · Follow-up ${formatDate(entry.dueDate)}` : ''}</small></div><span className={`livestock-status-badge ${entry.status === 'completed' ? 'healthy' : 'attention'}`}>{entry.status === 'completed' ? 'Completed' : 'Open'}</span>{entry.status !== 'completed' && entry.dueDate && <button type="button" onClick={() => markHealthComplete(entry.id)}>Complete</button>}</article>)}</div> : <div className="livestock-empty"><span className="material-symbols-outlined">medical_information</span><strong>No health events recorded</strong><p>Vaccinations, treatment notes, and vet visits you save will appear here.</p></div>}
        </section>
      </div>}
    </main>
  );
}

export default LivestockWorkspace;
