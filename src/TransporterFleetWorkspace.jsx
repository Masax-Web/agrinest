import { useState } from 'react';
import './TransporterWorkspaces.css';

const sampleRequests = [
  { id: 'maize-iringa-dar', title: 'Maize harvest delivery', cargo: '5 t maize', route: 'Iringa → Dar es Salaam', distance: '500 km', fare: 680000, priority: 'Priority' },
  { id: 'beans-morogoro-dar', title: 'Beans delivery', cargo: '2.5 t beans', route: 'Morogoro → Dar es Salaam', distance: '200 km', fare: 320000, priority: 'Standard' },
  { id: 'sunflower-dodoma-moro', title: 'Sunflower seed collection', cargo: '8 t sunflower', route: 'Dodoma → Morogoro', distance: '260 km', fare: 410000, priority: 'Standard' },
];

const initialVehicles = [
  { id: 'demo-01', name: '5-ton refrigerated lorry', registration: 'SAMPLE-01', status: 'Available' },
  { id: 'demo-02', name: '10-ton flatbed truck', registration: 'SAMPLE-02', status: 'On trip' },
  { id: 'demo-03', name: '3-ton cargo truck', registration: 'SAMPLE-03', status: 'Maintenance' },
];

const formatTzs = (amount) => `TSh ${amount.toLocaleString('en-TZ')}`;

function saveLocalNote(note) {
  const key = 'agrinest-transporter-workspace-records';
  const current = JSON.parse(window.localStorage.getItem(key) || '[]');
  if (!Array.isArray(current)) throw new Error('Saved transporter records are invalid.');
  window.localStorage.setItem(key, JSON.stringify([{ id: `dispatch-${Date.now()}`, ...note, savedAt: new Date().toISOString() }, ...current]));
}

export default function TransporterFleetWorkspace() {
  const [filter, setFilter] = useState('All requests');
  const [recordedRequests, setRecordedRequests] = useState([]);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleName, setVehicleName] = useState('');
  const [registration, setRegistration] = useState('');
  const [notice, setNotice] = useState('');
  const visibleRequests = sampleRequests.filter((request) => filter === 'All requests' || request.priority === filter);

  const recordInterest = (request) => {
    try {
      saveLocalNote({ title: `Transport request interest: ${request.title}`, details: `${request.route}; ${request.cargo}; sample estimate ${formatTzs(request.fare)}. This note does not contact a customer, reserve a job, or confirm payment.` });
      setRecordedRequests((current) => [...current, request.id]);
      setNotice('Interest saved locally. This is not a bid submission or booking.');
    } catch (error) {
      setNotice(error instanceof Error ? `Could not save your note: ${error.message}` : 'Could not save your note in this browser.');
    }
  };

  const addVehicle = (event) => {
    event.preventDefault();
    const name = vehicleName.trim();
    const plate = registration.trim();
    if (!name || !plate) return;
    const vehicle = { id: `local-${Date.now()}`, name, registration: plate, status: 'Status not set' };
    try {
      saveLocalNote({ title: `Fleet vehicle added: ${name}`, details: `Registration ${plate}. Vehicle details are stored as a local follow-up note, not a verified fleet record.` });
      setVehicles((current) => [...current, vehicle]);
      setVehicleName('');
      setRegistration('');
      setShowVehicleForm(false);
      setNotice('Vehicle details saved locally; fleet status has not been verified.');
    } catch (error) {
      setNotice(error instanceof Error ? `Could not save vehicle details: ${error.message}` : 'Could not save vehicle details in this browser.');
    }
  };

  return (
    <main className="transporter-workspace">
      <header className="transporter-workspace-heading">
        <div><p className="transporter-eyebrow">TRANSPORTER WORKSPACE</p><h2>Fleet management</h2><p>Keep fleet follow-ups and transport opportunities in one place.</p></div>
        <button type="button" className="transporter-primary-button" onClick={() => setShowVehicleForm((open) => !open)}><span className="material-symbols-outlined">add</span>{showVehicleForm ? 'Close form' : 'Add vehicle'}</button>
      </header>

      <div className="transporter-data-note" role="note"><span className="material-symbols-outlined">info</span><span>Illustrative dashboard: vehicle totals, requests, fares, and earnings are examples—not live listings or connected fleet records. Actions here save local notes only; no job is accepted, booked, or paid.</span></div>
      {notice && <div className="transporter-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      {showVehicleForm && <form className="transporter-vehicle-form" onSubmit={addVehicle}>
        <label>Vehicle type<input required maxLength={80} value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} placeholder="e.g. 5-ton lorry" /></label>
        <label>Registration<input required maxLength={24} value={registration} onChange={(event) => setRegistration(event.target.value)} placeholder="Registration number" /></label>
        <button type="submit" className="transporter-primary-button">Save local note</button>
      </form>}

      <section className="transporter-fleet-metrics" aria-label="Illustrative fleet metrics">
        <article><span className="material-symbols-outlined">local_shipping</span><small>Vehicles in example</small><strong>{vehicles.length}</strong><em>Illustrative list</em></article>
        <article><span className="material-symbols-outlined">check_circle</span><small>Example available</small><strong>{vehicles.filter((vehicle) => vehicle.status === 'Available').length}</strong><em>Not live status</em></article>
        <article><span className="material-symbols-outlined">work_history</span><small>Requests shown</small><strong>{sampleRequests.length}</strong><em>Sample opportunities</em></article>
        <article><span className="material-symbols-outlined">payments</span><small>Weekly earnings</small><strong>Not connected</strong><em>No earnings data available</em></article>
      </section>

      <div className="transporter-fleet-layout">
        <section className="transporter-panel transporter-request-panel">
          <div className="transporter-panel-heading"><div><p className="transporter-eyebrow">EXAMPLE ONLY</p><h3>Transport opportunities</h3></div><label className="transporter-filter">Show<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All requests</option><option>Priority</option><option>Standard</option></select></label></div>
          <div className="transporter-request-list">{visibleRequests.map((request) => <article className="transporter-request-card" key={request.id}>
            <div className="transporter-request-icon"><span className="material-symbols-outlined">agriculture</span></div>
            <div className="transporter-request-copy"><div className="transporter-request-title"><h4>{request.title}</h4><span>{request.priority}</span></div><p>{request.cargo} <i>·</i> {request.distance}</p><p><span className="material-symbols-outlined">route</span>{request.route}</p></div>
            <div className="transporter-request-action"><strong>{formatTzs(request.fare)}</strong><small>Illustrative estimate</small><button type="button" disabled={recordedRequests.includes(request.id)} onClick={() => recordInterest(request)}>{recordedRequests.includes(request.id) ? 'Note saved' : 'Save interest'}</button></div>
          </article>)}</div>
        </section>

        <aside className="transporter-fleet-side">
          <section className="transporter-panel transporter-earnings-panel">
            <div className="transporter-panel-heading"><div><p className="transporter-eyebrow">NO ACCOUNT DATA</p><h3>Weekly earnings</h3></div><span className="material-symbols-outlined">bar_chart</span></div>
            <div className="transporter-empty-chart" role="img" aria-label="Weekly earnings chart unavailable because no earnings data is connected"><span className="material-symbols-outlined">insert_chart_outlined</span><strong>Connect earnings data</strong><small>No weekly earnings are available to chart.</small></div>
          </section>
          <section className="transporter-panel">
            <div className="transporter-panel-heading"><div><p className="transporter-eyebrow">LOCAL EXAMPLE LIST</p><h3>Fleet status</h3></div><span className="material-symbols-outlined">garage</span></div>
            <ul className="transporter-vehicle-list">{vehicles.map((vehicle) => <li key={vehicle.id}><span className="material-symbols-outlined">local_shipping</span><span><strong>{vehicle.name}</strong><small>{vehicle.registration}</small></span><em>{vehicle.status}</em></li>)}</ul>
            <p className="transporter-footnote">Status labels are not connected to vehicle tracking.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
