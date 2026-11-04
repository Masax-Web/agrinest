import { useState } from 'react';
import './TransporterWorkspaces.css';

const routes = [
  { id: 'iringa-dar', from: 'Iringa Hub', to: 'Dar es Salaam', distance: 'Approx. 500 km', time: 'Estimate unavailable', notes: 'Primary corridor · confirm conditions before travel' },
  { id: 'iringa-mbeya', from: 'Iringa Hub', to: 'Mbeya', distance: 'Approx. 330 km', time: 'Estimate unavailable', notes: 'Alternate corridor · confirm conditions before travel' },
  { id: 'moro-dar', from: 'Morogoro', to: 'Dar es Salaam', distance: 'Approx. 200 km', time: 'Estimate unavailable', notes: 'Regional corridor · confirm conditions before travel' },
];

const maintenanceItems = [
  { id: 'inspection', title: 'Routine vehicle inspection', vehicle: 'No connected vehicle', status: 'Example checklist item' },
  { id: 'tyres', title: 'Tyre and brake check', vehicle: 'No connected vehicle', status: 'Example checklist item' },
];

function saveLocalNote(note) {
  const key = 'agrinest-transporter-workspace-records';
  const current = JSON.parse(window.localStorage.getItem(key) || '[]');
  if (!Array.isArray(current)) throw new Error('Saved transporter records are invalid.');
  window.localStorage.setItem(key, JSON.stringify([{ id: `dispatch-${Date.now()}`, ...note, savedAt: new Date().toISOString() }, ...current]));
}

export default function TransporterRouteWorkspace() {
  const [routeId, setRouteId] = useState(routes[0].id);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState([]);
  const [notice, setNotice] = useState('');
  const route = routes.find((candidate) => candidate.id === routeId) || routes[0];

  const saveRouteNote = () => {
    try {
      saveLocalNote({ title: `Route plan note: ${route.from} to ${route.to}`, details: `${route.distance}. Route guidance is illustrative only; traffic, road closures, ETA, and vehicle location are not connected.` });
      setNotice('Route plan saved locally. It is not live navigation or a traffic report.');
    } catch (error) {
      setNotice(error instanceof Error ? `Could not save your route note: ${error.message}` : 'Could not save your route note in this browser.');
    }
  };

  const saveMaintenanceNote = (item) => {
    try {
      saveLocalNote({ title: `Maintenance follow-up: ${item.title}`, details: 'Local checklist note only; no inspection has been scheduled and no vehicle data is connected.' });
      setMaintenanceNotes((current) => [...current, item.id]);
      setNotice('Maintenance follow-up saved locally; no service was booked.');
    } catch (error) {
      setNotice(error instanceof Error ? `Could not save the follow-up: ${error.message}` : 'Could not save the follow-up in this browser.');
    }
  };

  return (
    <main className="transporter-workspace">
      <header className="transporter-workspace-heading">
        <div><p className="transporter-eyebrow">TRANSPORTER WORKSPACE</p><h2>Route intelligence</h2><p>Plan a corridor and keep route-related follow-ups together.</p></div>
        <button type="button" className="transporter-primary-button" onClick={saveRouteNote}><span className="material-symbols-outlined">save</span>Save route note</button>
      </header>
      <div className="transporter-data-note" role="note"><span className="material-symbols-outlined">info</span><span>Live GPS, road reports, fuel data, cold-chain sensors, driver-safety monitoring, and maintenance systems are not connected. Route options are approximate examples, not navigation or safety advice.</span></div>
      {notice && <div className="transporter-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <section className="transporter-route-metrics" aria-label="Route data connection status">
        {[['route', 'Route distance', route.distance], ['local_gas_station', 'Fuel consumption', 'Not connected'], ['speed', 'Average speed', 'Not connected'], ['health_and_safety', 'Driver safety', 'Not monitored']].map(([icon, label, value]) => <article key={label}><span className="material-symbols-outlined">{icon}</span><small>{label}</small><strong>{value}</strong><em>Live data unavailable</em></article>)}
      </section>

      <div className="transporter-route-layout">
        <section className="transporter-panel transporter-route-map-panel">
          <div className="transporter-panel-heading"><div><p className="transporter-eyebrow">ILLUSTRATIVE CORRIDOR</p><h3>Route planner</h3></div><span className="transporter-offline-badge"><i />Offline example</span></div>
          <label className="transporter-route-select">Choose a route<select value={routeId} onChange={(event) => { setRouteId(event.target.value); setSelectedRouteId(''); }}>{routes.map((item) => <option value={item.id} key={item.id}>{item.from} → {item.to}</option>)}</select></label>
          <div className="transporter-route-map" aria-label={`Illustrative route from ${route.from} to ${route.to}`}>
            <div className="transporter-map-grid" />
            <span className="transporter-map-road transporter-map-road-one" /><span className="transporter-map-road transporter-map-road-two" /><span className="transporter-map-road transporter-map-road-three" />
            <span className="transporter-map-pin transporter-map-origin"><span className="material-symbols-outlined">trip_origin</span><b>{route.from}</b></span>
            <span className="transporter-map-pin transporter-map-stop"><span className="material-symbols-outlined">local_gas_station</span><b>Example stop</b></span>
            <span className="transporter-map-pin transporter-map-destination"><span className="material-symbols-outlined">location_on</span><b>{route.to}</b></span>
            <span className="transporter-map-disclosure">Stylized route illustration · not a geographic map</span>
          </div>
          <div className="transporter-route-summary"><div><small>Estimated distance</small><strong>{route.distance}</strong></div><div><small>Travel time</small><strong>{route.time}</strong></div><p>{route.notes}</p></div>
          <div className="transporter-route-options"><h4>Route options</h4>{routes.map((option) => <button type="button" className={selectedRouteId === option.id ? 'selected' : ''} key={option.id} onClick={() => { setRouteId(option.id); setSelectedRouteId(option.id); }}><span><strong>{option.from} → {option.to}</strong><small>{option.notes}</small></span><span>{option.distance}</span></button>)}</div>
        </section>

        <aside className="transporter-route-side">
          <section className="transporter-panel"><div className="transporter-panel-heading"><div><p className="transporter-eyebrow">SENSORS NOT CONNECTED</p><h3>Cold-chain readings</h3></div><span className="material-symbols-outlined">ac_unit</span></div><div className="transporter-unavailable"><span className="material-symbols-outlined">sensors_off</span><div><strong>No sensor data</strong><small>Temperature and humidity are unavailable. Check equipment directly.</small></div></div></section>
          <section className="transporter-panel"><div className="transporter-panel-heading"><div><p className="transporter-eyebrow">NO LIVE FEED</p><h3>Road intelligence</h3></div><span className="material-symbols-outlined">traffic</span></div><div className="transporter-road-status"><span><i />Road reports</span><strong>Unavailable</strong><small>No verified traffic, weather, weighbridge, or closure reports are connected.</small></div><div className="transporter-road-status"><span>Fuel and rest stops</span><strong>Example marker only</strong><small>Confirm locations and operating hours independently.</small></div></section>
          <section className="transporter-panel"><div className="transporter-panel-heading"><div><p className="transporter-eyebrow">LOCAL FOLLOW-UP LIST</p><h3>Maintenance queue</h3></div><span className="material-symbols-outlined">build</span></div><ul className="transporter-maintenance-list">{maintenanceItems.map((item) => <li key={item.id}><span><strong>{item.title}</strong><small>{item.vehicle} · {item.status}</small></span><button type="button" disabled={maintenanceNotes.includes(item.id)} onClick={() => saveMaintenanceNote(item)}>{maintenanceNotes.includes(item.id) ? 'Noted' : 'Save note'}</button></li>)}</ul></section>
        </aside>
      </div>
    </main>
  );
}
