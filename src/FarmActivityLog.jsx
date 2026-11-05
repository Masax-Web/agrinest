import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { api } from './lib/api';
import 'leaflet/dist/leaflet.css';
import './FarmActivityLog.css';

const ACTIVITY_TYPES = [
  'Planting',
  'Spraying (Pest Control)',
  'Irrigation',
  'Harvest',
  'Fertilizing',
  'Other',
];

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fieldLabel(field) {
  return field?.name || field?.field_name || field?.crop || field?.crop_type || 'Saved field';
}

function fieldCrop(field) {
  return field?.crop || field?.crop_type || '';
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      URL.revokeObjectURL(imageUrl);
      const canvas = document.createElement('canvas');
      let scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      for (let attempt = 0; attempt < 4; attempt += 1) {
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('This browser could not prepare the photo.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolveBlob) => canvas.toBlob(resolveBlob, 'image/jpeg', 0.76 - attempt * 0.1));
        if (blob && blob.size <= 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = () => resolve({
            name: file.name.slice(0, 150) || 'field-evidence.jpg',
            mime_type: 'image/jpeg',
            data_url: reader.result,
            captured_at: new Date().toISOString(),
          });
          reader.onerror = () => reject(new Error('The photo could not be read.'));
          reader.readAsDataURL(blob);
          return;
        }
        scale *= 0.78;
      }
      reject(new Error('This photo is too large to attach. Choose a smaller image.'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('This image could not be opened.'));
    };
    image.src = imageUrl;
  });
}

function Field({ label, children }) {
  return <label className="farm-activity-field">{label}{children}</label>;
}

function readableDate(value) {
  if (!value) return 'Date not recorded';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function FarmActivityLog({ user, profile, fields = [], onBack, onNavigate }) {
  const [farms, setFarms] = useState([]);
  const [farmId, setFarmId] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [crop, setCrop] = useState('');
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [activityDate, setActivityDate] = useState(localDate);
  const [productName, setProductName] = useState('');
  const [dosageRate, setDosageRate] = useState('');
  const [waterVolume, setWaterVolume] = useState('');
  const [equipment, setEquipment] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState(null);
  const [gps, setGps] = useState(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState('');
  const [evidenceById, setEvidenceById] = useState({});

  const activeFarms = useMemo(() => farms.filter((farm) => farm.status !== 'pending'), [farms]);
  const selectedFarm = activeFarms.find((farm) => farm.farm_id === farmId);
  const canFinalize = ['owner', 'manager', 'worker'].includes(selectedFarm?.role);
  const savedFields = Array.isArray(fields) ? fields : [];

  const loadLogs = useCallback(async (selectedFarmId) => {
    if (!selectedFarmId) {
      setLogs([]);
      return;
    }
    const response = await api.listFarmActivityLogs(selectedFarmId);
    setLogs(Array.isArray(response.logs) ? response.logs : []);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.listFarms();
        if (!active) return;
        const nextFarms = Array.isArray(response.farms) ? response.farms : [];
        setFarms(nextFarms);
        const preferred = nextFarms.find((farm) => farm.status === 'active') || nextFarms[0];
        setFarmId(preferred?.farm_id || '');
      } catch (requestError) {
        if (active) setError(requestError.message || 'Could not load your farms.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user?.user_id]);

  useEffect(() => {
    let active = true;
    if (!farmId) {
      setLogs([]);
      return undefined;
    }
    api.listFarmActivityLogs(farmId)
      .then((response) => { if (active) setLogs(Array.isArray(response.logs) ? response.logs : []); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Could not load the farm activity history.'); });
    return () => { active = false; };
  }, [farmId]);

  useEffect(() => {
    const field = savedFields.find((item) => fieldLabel(item) === selectedField);
    if (field && fieldCrop(field)) setCrop(fieldCrop(field));
  }, [savedFields, selectedField]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setError('Location capture is not available in this browser.');
      return;
    }
    setGpsBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const captured = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          captured_at: new Date(position.timestamp).toISOString(),
        };
        setGps(captured);
        setGpsBusy(false);
      },
      (locationError) => {
        setGpsBusy(false);
        setError(locationError.code === locationError.PERMISSION_DENIED
          ? 'Location permission was denied. Allow location access in your browser and try again.'
          : locationError.message || 'Could not capture the device location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const selectEvidence = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for field evidence.');
      return;
    }
    setEvidenceBusy(true);
    setError('');
    try {
      setEvidence(await compressImage(file));
    } catch (requestError) {
      setError(requestError.message || 'Could not prepare the evidence photo.');
    } finally {
      setEvidenceBusy(false);
    }
  };

  const toggleEvidence = async (log) => {
    if (expandedEvidence === log.activity_id) {
      setExpandedEvidence('');
      return;
    }
    setExpandedEvidence(log.activity_id);
    if (evidenceById[log.activity_id]) return;
    try {
      const response = await api.getFarmActivityEvidence(farmId, log.activity_id);
      setEvidenceById((current) => ({ ...current, [log.activity_id]: response.evidence }));
    } catch (requestError) {
      setError(requestError.message || 'Could not load this activity photo.');
    }
  };

  const finalizeLog = async (event) => {
    event.preventDefault();
    if (!farmId || !canFinalize) {
      setError('Select a farm where you are an owner, manager, or worker to finalize a record.');
      return;
    }
    if (!crop.trim() || !activityDate) {
      setError('Enter the crop and activity date before finalizing.');
      return;
    }
    if (!gps || gps.accuracy_m > 50 || Math.abs(Date.now() - Date.parse(gps.captured_at)) > 15 * 60 * 1000) {
      setError('Capture a fresh GPS location with accuracy within 50 m before finalizing.');
      return;
    }
    if (!evidence) {
      setError('Attach a field photo before finalizing this activity.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.createFarmActivityLog(farmId, {
        activity_date: activityDate,
        crop: crop.trim(),
        activity_type: activityType,
        ...(selectedField ? { field_name: selectedField } : {}),
        details: {
          product_name: productName,
          dosage_rate: dosageRate,
          ...(waterVolume ? { water_volume_liters: Number(waterVolume) } : {}),
          equipment,
          notes,
        },
        ...(gps ? { location: gps } : {}),
        ...(evidence ? { evidence } : {}),
      });
      setLogs((current) => [response.log, ...current]);
      setNotice(`Activity record finalized. Record hash: ${response.log.content_hash}`);
      setProductName('');
      setDosageRate('');
      setWaterVolume('');
      setEquipment('');
      setNotes('');
      setEvidence(null);
      setGps(null);
      setActivityDate(localDate());
    } catch (requestError) {
      setError(requestError.message || 'The activity could not be finalized.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="farm-activity">
      <header className="farm-activity-header">
        <button type="button" className="farm-activity-back" onClick={onBack}>
          <span className="material-symbols-outlined">arrow_back</span>Digital Farm
        </button>
        <div className="farm-activity-heading-row">
          <div>
            <p className="farm-activity-eyebrow">FARM OPERATIONS · FIELD RECORDS</p>
            <h1>Precision Farm Activity Log</h1>
            <p>Capture current GPS and a field photo to keep a traceable farm history.</p>
            <small>Farmer ID: {user?.user_id || 'Unavailable'} · Farm ID: {farmId || 'Select a farm'}</small>
          </div>
          {activeFarms.length > 0 && (
            <label className="farm-activity-selector">Farm
              <select value={farmId} onChange={(event) => setFarmId(event.target.value)}>
              {activeFarms.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farm.name} · Farm ID {farm.farm_id} · {farm.role}</option>)}
              </select>
            </label>
          )}
        </div>
      </header>

      <div className="farm-activity-provenance" role="note">
        <span className="material-symbols-outlined">verified_user</span>
        <div><strong>Farmer-signed record · tamper-evident history</strong><span>Records are linked by a hash chain. GPS and photo are device-reported evidence, not independent verification.</span></div>
      </div>

      {error && <div className="farm-activity-message is-error" role="alert">{error}</div>}
      {notice && <div className="farm-activity-message is-success" role="status">{notice}</div>}

      {loading ? (
        <div className="farm-activity-empty" role="status">Loading your farms…</div>
      ) : activeFarms.length === 0 ? (
        <section className="farm-activity-empty">
          <span className="material-symbols-outlined">agriculture</span>
          <h2>Create or join a farm first</h2>
          <p>Activity records are securely associated with a farm workspace.</p>
          <button type="button" onClick={() => onNavigate('farm-operations')}>Open Farm Operations</button>
        </section>
      ) : (
        <div className="farm-activity-layout">
          <form className="farm-activity-form" onSubmit={finalizeLog}>
            <section className="farm-activity-card">
              <div className="farm-activity-card-heading"><span className="farm-activity-step">01</span><div><h2>Activity details</h2><p>What happened in the field?</p></div></div>
              <div className="farm-activity-fields-grid">
                <Field label="Activity date"><input type="date" required value={activityDate} onChange={(event) => setActivityDate(event.target.value)} /></Field>
                <Field label="Crop"><input required maxLength={100} value={crop} onChange={(event) => setCrop(event.target.value)} placeholder="e.g. Maize" list="farm-activity-crops" /><datalist id="farm-activity-crops">{savedFields.map((field, index) => fieldCrop(field) && <option key={`${fieldLabel(field)}-${index}`} value={fieldCrop(field)} />)}</datalist></Field>
                <Field label="Activity type"><select value={activityType} onChange={(event) => setActivityType(event.target.value)}>{ACTIVITY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
                {savedFields.length > 0 && <Field label="Saved field (optional)"><select value={selectedField} onChange={(event) => setSelectedField(event.target.value)}><option value="">Choose field</option>{savedFields.map((field, index) => <option key={`${fieldLabel(field)}-${index}`} value={fieldLabel(field)}>{fieldLabel(field)}</option>)}</select></Field>}
              </div>
            </section>

            <section className="farm-activity-card">
              <div className="farm-activity-card-heading"><span className="farm-activity-step">02</span><div><h2>Field evidence</h2><p>A field photo is required to finalize this record.</p></div></div>
              <div className={`farm-activity-evidence ${evidence ? 'has-image' : ''}`}>
                {evidence ? <img src={evidence.data_url} alt="Selected field evidence preview" /> : <span className="material-symbols-outlined">add_a_photo</span>}
                <div><strong>{evidence ? evidence.name : evidenceBusy ? 'Preparing image…' : 'Add a field photo'}</strong><span>{evidence ? 'Stored with the GPS-stamped record.' : 'Required to finalize; device-reported evidence is not independently verified.'}</span></div>
                <label className="farm-activity-button secondary">{evidence ? 'Replace photo' : 'Choose photo'}<input type="file" accept="image/*" capture="environment" onChange={selectEvidence} disabled={evidenceBusy} /></label>
                {evidence && <button className="farm-activity-remove" type="button" onClick={() => setEvidence(null)} aria-label="Remove photo">×</button>}
              </div>
            </section>

            <section className="farm-activity-card">
              <div className="farm-activity-card-heading"><span className="farm-activity-step">03</span><div><h2>Activity location</h2><p>Current location is required when you finalize this entry.</p></div></div>
              <div className="farm-activity-context-actions">
                <button className="farm-activity-button secondary" type="button" onClick={captureGps} disabled={gpsBusy}><span className="material-symbols-outlined">my_location</span>{gpsBusy ? 'Capturing…' : gps ? `GPS captured · ±${Math.round(gps.accuracy_m)} m` : 'Grant location & capture GPS'}</button>
              </div>
              {gps && <div className="farm-activity-location">
                <div className="farm-activity-map"><MapContainer center={[gps.latitude, gps.longitude]} zoom={15} scrollWheelZoom={false}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <CircleMarker center={[gps.latitude, gps.longitude]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#43885a', fillOpacity: 1 }}><Popup>Device-reported location</Popup></CircleMarker>
                </MapContainer></div>
                <div><strong>Device-reported coordinates</strong><span>{gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}</span><span>Reported accuracy ±{Math.round(gps.accuracy_m)} m · {new Date(gps.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><small>Coordinates are reported by your device and have not been independently verified.</small></div>
              </div>}
            </section>

            <section className="farm-activity-card">
              <div className="farm-activity-card-heading"><span className="farm-activity-step">04</span><div><h2>Operation details</h2><p>Record products, quantities, equipment, and notes.</p></div></div>
              <div className="farm-activity-fields-grid">
                <Field label="Product / input (optional)"><input maxLength={120} value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Product or material" /></Field>
                <Field label="Dosage / rate (optional)"><input maxLength={80} value={dosageRate} onChange={(event) => setDosageRate(event.target.value)} placeholder="e.g. 2 L/ha" /></Field>
                <Field label="Water volume in litres (optional)"><input type="number" min="0.001" max="1000000000" step="any" value={waterVolume} onChange={(event) => setWaterVolume(event.target.value)} placeholder="e.g. 200" /></Field>
                <Field label="Equipment (optional)"><input maxLength={120} value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="e.g. Knapsack sprayer" /></Field>
                <Field label="Notes (optional)"><textarea rows="3" maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context about this activity" /></Field>
              </div>
            </section>

            <div className="farm-activity-submit">
              <p>Finalizing adds a permanent entry to this farm’s append-only activity chain.</p>
              <button type="submit" className="farm-activity-button primary" disabled={saving || !canFinalize}>{saving ? 'Finalizing…' : 'Finalize activity record'}<span className="material-symbols-outlined">arrow_forward</span></button>
            </div>
            {!canFinalize && <p className="farm-activity-help">Your farm role is read-only for activity records.</p>}
          </form>

          <aside className="farm-activity-history">
            <div className="farm-activity-history-heading"><div><p className="farm-activity-eyebrow">FARM RECORDS</p><h2>Activity history</h2></div><span>{logs.length}</span></div>
            {logs.length === 0 ? <p className="farm-activity-history-empty">No activity records yet. Finalize the first entry to start this farm’s hash chain.</p> : (
              <ol className="farm-activity-timeline">
                {logs.map((log) => <li key={log.activity_id}>
                  <span className="farm-activity-timeline-dot" />
                  <article>
                    <div className="farm-activity-log-meta"><time>{readableDate(log.activity_date)}</time><span>#{log.sequence}</span></div>
                    <h3>{log.activity_type}</h3>
                    <p>{log.crop}{log.field_name ? ` · ${log.field_name}` : ''}</p>
                    <small>Recorded by {log.actor_name || 'farm member'} · {log.recorded_at ? new Date(log.recorded_at).toLocaleString() : ''}</small>
                    <div className="farm-activity-hash"><span>SHA-256</span><code>{log.content_hash?.slice(0, 20) || 'Hash unavailable'}…</code></div>
                    {log.has_evidence && <button type="button" className="farm-activity-evidence-link" onClick={() => toggleEvidence(log)}>{expandedEvidence === log.activity_id ? 'Hide evidence' : 'View attached photo'}</button>}
                    {expandedEvidence === log.activity_id && evidenceById[log.activity_id] && <img className="farm-activity-history-image" src={evidenceById[log.activity_id].data_url} alt={`Evidence for ${log.activity_type}`} />}
                  </article>
                </li>)}
              </ol>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
