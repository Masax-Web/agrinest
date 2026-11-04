import { useState } from 'react';
import './TransportLogisticsWorkspace.css';

const drivers = [
  {
    id: 'sample-driver-james',
    name: 'James Mwangi',
    vehicle: '5-ton refrigerated lorry',
    vehicleId: 'DEMO-882',
    rating: '4.9',
    trips: 124,
    availability: 'Example · ready in 15 min',
    fare: 380000,
    icon: 'ac_unit',
  },
  {
    id: 'sample-driver-grace',
    name: 'Grace Atieno',
    vehicle: '10-ton flatbed truck',
    vehicleId: 'DEMO-901',
    rating: '4.7',
    trips: 89,
    availability: 'Example · available in 2 h',
    fare: 650000,
    icon: 'local_shipping',
  },
];

const transportRoutes = [
  { origin: 'Iringa', destination: 'Dar es Salaam', distance: '~500 km', vehicle: 'Standard lorry', estimate: 300000 },
  { origin: 'Iringa', destination: 'Mbeya', distance: '~330 km', vehicle: 'Pickup', estimate: 150000 },
  { origin: 'Morogoro', destination: 'Dar es Salaam', distance: '~200 km', vehicle: 'Cold chain', estimate: 250000 },
];

const money = (value) => `TSh ${Number(value || 0).toLocaleString('en-TZ')}`;
const newRecordId = () => globalThis.crypto?.randomUUID?.() || `transport-${Date.now()}`;

export default function TransportLogisticsWorkspace({ user, profile, records, onRecordsChange }) {
  const [pickup, setPickup] = useState(profile?.location || profile?.district || profile?.region || 'Iringa Farm, Section A4');
  const [destination, setDestination] = useState('Dar es Salaam Port, Terminal 3');
  const [selectedDriverId, setSelectedDriverId] = useState(drivers[0].id);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [sortBy, setSortBy] = useState('relevance');
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [cargo, setCargo] = useState('');
  const [weight, setWeight] = useState('');
  const [notice, setNotice] = useState('');

  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);
  const transportRequests = (Array.isArray(records?.requests) ? records.requests : []).filter((request) => request.module === 'transport');
  const filteredDrivers = drivers
    .filter((driver) => vehicleFilter === 'All' || (vehicleFilter === 'Cold chain' ? /refrigerated|reefer/i.test(driver.vehicle) : driver.vehicle.toLowerCase().includes(vehicleFilter.toLowerCase())))
    .filter((driver) => `${driver.name} ${driver.vehicle} ${pickup} ${destination}`.toLowerCase().includes(search.toLowerCase()));
  const sortedDrivers = [...filteredDrivers].sort((first, second) => sortBy === 'price' ? first.fare - second.fare : second.trips - first.trips);
  const matchingRoute = transportRoutes.find((route) => pickup.toLowerCase().includes(route.origin.toLowerCase()) && destination.toLowerCase().includes(route.destination.toLowerCase()));
  const estimatedFare = matchingRoute?.estimate || selectedDriver?.fare || 0;

  const confirmRequest = (requestType = 'estimate', driverId = selectedDriverId) => {
    if (!user?.user_id) {
      setNotice('Sign in to save a transport and storage request.');
      return;
    }
    if (!pickup.trim() || !destination.trim()) {
      setNotice('Enter both a pickup location and destination.');
      return;
    }
    if (!onRecordsChange || !records?.requests) {
      setNotice('Unable to save the request because farmer records are unavailable.');
      return;
    }
    const requestDriver = drivers.find((driver) => driver.id === driverId);
    const requestEstimate = requestType === 'carrier-request' && requestDriver ? requestDriver.fare : estimatedFare;
    const id = newRecordId();
    const request = {
      id,
      module: 'transport',
      requestType,
      title: cargo.trim() ? `${cargo.trim()} transport: ${pickup.trim()} to ${destination.trim()}` : `Transport request: ${pickup.trim()} to ${destination.trim()}`,
      pickup: pickup.trim(),
      destination: destination.trim(),
      cargo: cargo.trim(),
      weightKg: weight ? Number(weight) : null,
      driverId: requestDriver?.id || '',
      estimateTzs: requestEstimate,
      details: [
        `Illustrative route distance: ${matchingRoute?.distance || 'not available'}.`,
        `Sample carrier profile: ${requestDriver?.name || 'Not selected'} (${requestDriver?.vehicle || 'no vehicle selected'}).`,
        `Non-binding sample estimate: ${money(requestEstimate)}.`,
        'This is a local request note only; it has not been submitted to a provider. No driver or warehouse was contacted, no reservation was made, and no payment or escrow was initiated.',
      ].join(' '),
      date: new Date().toISOString().slice(0, 10),
      status: 'Saved locally · not submitted',
    };
    onRecordsChange('requests', [...records.requests, request]);
    setSavedRequestId(id);
    setJobFormOpen(false);
    setNotice('Transport request saved in farmer records. No provider was contacted; nothing was booked or charged.');
  };

  return (
    <main className="transport-logistics">
      {notice && <div className="transport-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <header className="transport-page-heading">
        <div><p>FARMER WORKSPACE · MARKET &amp; LOGISTICS</p><h1>Usafiri Transport</h1><span>Plan produce transport and cold-chain requests.</span></div>
        <button type="button" className="transport-post-job-button" onClick={() => setJobFormOpen((open) => !open)}><span className="material-symbols-outlined">add_circle</span>{jobFormOpen ? 'Close transport job' : 'Post Transport Job'}</button>
      </header>

      <div className="transport-demo-disclosure" role="note">
        <span className="material-symbols-outlined">info</span>
        <span>Transporter profiles and route prices are illustrative examples, not verified or live listings. Saving a request creates a note in your farmer records only; it does not contact a carrier, confirm availability, book a trip, or initiate payment.</span>
      </div>

      {jobFormOpen && <form className="transport-job-form" onSubmit={(event) => { event.preventDefault(); confirmRequest('transport-job'); }}>
        <div><span className="transport-demo-label">LOCAL REQUEST FORM</span><h2>Post a transport job</h2><p>Save your cargo and route details for your own follow-up.</p></div>
        <label>Cargo or produce<input required maxLength={120} value={cargo} onChange={(event) => setCargo(event.target.value)} placeholder="e.g. Tomatoes" /></label>
        <label>Estimated weight (kg)<input type="number" min="1" step="1" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Optional" /></label>
        <button type="submit" className="transport-post-job-button"><span className="material-symbols-outlined">save</span>Save request note</button>
      </form>}

      <section className="transport-stats" aria-label="Transport workspace summary">
        <article><span className="material-symbols-outlined">local_shipping</span><div><small>Sample transporter profiles</small><strong>{drivers.length}</strong><span>Illustrative only</span></div></article>
        <article><span className="material-symbols-outlined">outbox</span><div><small>Your saved transport requests</small><strong>{transportRequests.length}</strong><span>Not submitted to providers</span></div></article>
        <article><span className="material-symbols-outlined">route</span><div><small>Route estimate</small><strong>{money(estimatedFare)}</strong><span>{matchingRoute ? `${matchingRoute.distance} · sample rate` : 'Example only · confirm with carrier'}</span></div></article>
        <article><span className="material-symbols-outlined">ac_unit</span><div><small>Live cold-chain status</small><strong>Not connected</strong><span>Confirm directly with providers</span></div></article>
      </section>

      <div className="transport-layout">
        <section className="transport-main-column">
          <div className="transport-filter-bar">
            <label className="transport-search"><span className="material-symbols-outlined">search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search driver, route, or vehicle..." aria-label="Search transport examples" /></label>
            <div className="transport-filter-options" aria-label="Filter sample vehicle profiles">
              {['All', 'Lorry', 'Pickup', 'Cold chain'].map((filter) => <button type="button" key={filter} className={vehicleFilter === filter ? 'active' : ''} aria-pressed={vehicleFilter === filter} onClick={() => setVehicleFilter(filter)}><span className="material-symbols-outlined">{filter === 'Pickup' ? 'directions_car' : filter === 'Cold chain' ? 'ac_unit' : 'local_shipping'}</span>{filter}</button>)}
            </div>
          </div>

          <section className="transport-card transport-map-card">
            <header className="transport-card-heading"><div><span className="material-symbols-outlined">map</span><h2>Nearby Transporters</h2></div><span className="transport-demo-label">Illustrative route view · no live map</span></header>
            <div className="transport-route-fields">
              <label>Pickup<div className="transport-input-wrap"><span className="material-symbols-outlined">my_location</span><input value={pickup} onChange={(event) => setPickup(event.target.value)} maxLength={140} /></div></label>
              <span className="material-symbols-outlined transport-route-arrow">east</span>
              <label>Destination<div className="transport-input-wrap"><span className="material-symbols-outlined">location_on</span><input value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={140} /></div></label>
            </div>
            <div className="transport-illustrative-map" role="img" aria-label="Illustrative transport route between the entered pickup and destination. Not a real-time map or vehicle location.">
              <div className="transport-map-road transport-map-road-one" /><div className="transport-map-road transport-map-road-two" /><div className="transport-map-path" />
              <span className="transport-map-stop transport-map-stop-start"><span className="material-symbols-outlined">agriculture</span><small>Pickup</small></span>
              <span className="transport-map-stop transport-map-stop-truck"><span className="material-symbols-outlined">local_shipping</span><small>Sample lorry</small></span>
              <span className="transport-map-stop transport-map-stop-cold"><span className="material-symbols-outlined">ac_unit</span><small>Cold chain</small></span>
              <span className="transport-map-stop transport-map-stop-end"><span className="material-symbols-outlined">location_on</span><small>Destination</small></span>
              <span className="transport-map-legend">Illustration only · no GPS data</span>
            </div>
          </section>

          <section className="transport-available-section">
            <div className="transport-available-heading"><div><span className="transport-demo-label">SAMPLE DIRECTORY</span><h2>Available Drivers</h2></div><label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="relevance">Relevance</option><option value="price">Example rate</option></select></label></div>
            <div className="transport-driver-list">
              {sortedDrivers.map((driver) => <article key={driver.id} className="transport-driver-card">
                <span className="transport-driver-icon"><span className="material-symbols-outlined">{driver.icon}</span></span>
                <div className="transport-driver-info"><strong>{driver.name}<span className="transport-sample-badge">Sample</span></strong><span>{driver.vehicle}</span><small><span className="material-symbols-outlined">star</span>{driver.rating} · {driver.trips} example trips</small></div>
                <div className="transport-driver-route"><span className="material-symbols-outlined">route</span><div><strong>{pickup.split(',')[0]} <span className="material-symbols-outlined">east</span> {destination.split(',')[0]}</strong><small>Route not verified</small></div></div>
                <div className="transport-driver-price"><strong>{money(driver.fare)}</strong><small>Illustrative rate</small><button type="button" onClick={() => { setSelectedDriverId(driver.id); confirmRequest('carrier-request', driver.id); }}>Save request</button></div>
              </article>)}
              {!sortedDrivers.length && <div className="transport-empty"><span className="material-symbols-outlined">search_off</span><strong>No sample profiles match</strong><p>Try a different search or vehicle filter.</p></div>}
            </div>
            <p className="transport-directory-disclaimer">Profiles, vehicle details, ratings, availability, and rates are fictional interface examples, not verified carrier listings.</p>
          </section>
        </section>

        <aside className="transport-summary-column">
          <section className="transport-card transport-trips-card">
            <header><h2>My Transport Requests</h2><span>{transportRequests.length} saved</span></header>
            <div className="transport-trip-list">{transportRequests.length ? transportRequests.slice(-4).reverse().map((request) => <article key={request.id}><div className="transport-trip-status">SAVED · NOT BOOKED</div><div className="transport-trip-title"><strong>{request.cargo || request.title || 'Transport request'}</strong><small>{request.id.slice(0, 8)}</small></div><p>{request.pickup || 'Pickup not recorded'} <span className="material-symbols-outlined">east</span> {request.destination || 'Destination not recorded'}</p><small>{request.weightKg ? `${Number(request.weightKg).toLocaleString()} kg · ` : ''}{request.date || 'Date not recorded'}</small><div className="transport-trip-actions"><strong>{request.estimateTzs ? money(request.estimateTzs) : 'No estimate'}</strong><span>Local note</span></div></article>) : <div className="transport-empty"><span className="material-symbols-outlined">local_shipping</span><strong>No transport requests yet</strong><p>Save a request note to keep its route details here.</p></div>}</div>
            <p className="transport-confirm-disclaimer"><span className="material-symbols-outlined">info</span>These are request notes, not active trips. No live tracking or carrier connection is available.</p>
          </section>

          <section className="transport-card transport-marketplace-card">
            <h2>Transport Marketplace</h2><p>Example prices for popular routes. Confirm all costs and availability directly with a carrier.</p>
            <div className="transport-marketplace-routes">{transportRoutes.map((route) => <button type="button" key={`${route.origin}-${route.destination}`} onClick={() => { setPickup(route.origin); setDestination(route.destination); }}><span><strong>{route.origin} to {route.destination}</strong><small>{route.distance} · {route.vehicle}</small></span><span>From {money(route.estimate)}</span></button>)}</div>
            <p className="transport-marketplace-disclaimer">Sample route estimates only · not provider quotes.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
