import { useMemo, useState } from 'react';
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

const warehouses = [
  {
    id: 'sample-pwani-cold',
    name: 'Pwani Cold Storage',
    type: 'Cold storage',
    temperature: 'Sample range −4°C to −18°C',
    occupancy: 65,
    price: 180000,
    badge: 'Sample listing',
    icon: 'ac_unit',
  },
  {
    id: 'sample-kijitonyama-silos',
    name: 'Kijitonyama Dry Silos',
    type: 'Dry grain storage',
    temperature: 'Sample humidity control: 12% max',
    occupancy: 30,
    price: 120000,
    badge: 'Sample listing',
    icon: 'warehouse',
  },
];

const money = (value) => `TSh ${Number(value || 0).toLocaleString('en-TZ')}`;
const newRecordId = () => globalThis.crypto?.randomUUID?.() || `transport-${Date.now()}`;

export default function TransportLogisticsWorkspace({ user, profile, records, onRecordsChange }) {
  const [pickup, setPickup] = useState(profile?.location || profile?.district || profile?.region || 'Iringa Farm, Section A4');
  const [destination, setDestination] = useState('Dar es Salaam Port, Terminal 3');
  const [selectedDriverId, setSelectedDriverId] = useState(drivers[0].id);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouses[1].id);
  const [notice, setNotice] = useState('');
  const [savedRequestId, setSavedRequestId] = useState('');

  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
  const quote = useMemo(() => {
    const transportEstimate = selectedDriver?.fare || 0;
    const storageEstimate = selectedWarehouse?.price || 0;
    const handlingEstimate = selectedWarehouse ? 15000 : 0;
    const fuelEstimate = selectedDriver ? 45000 : 0;
    const transitCoverEstimate = selectedDriver ? 25000 : 0;
    const serviceEstimate = Math.round((transportEstimate + storageEstimate + handlingEstimate + fuelEstimate + transitCoverEstimate) * 0.01);
    return {
      transportEstimate,
      storageEstimate,
      handlingEstimate,
      fuelEstimate,
      transitCoverEstimate,
      serviceEstimate,
      total: transportEstimate + storageEstimate + handlingEstimate + fuelEstimate + transitCoverEstimate + serviceEstimate,
    };
  }, [selectedDriver, selectedWarehouse]);

  const confirmRequest = () => {
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
    const id = newRecordId();
    const request = {
      id,
      module: 'transport',
      title: `Transport request: ${pickup.trim()} to ${destination.trim()}`,
      details: [
        'Illustrative route distance: 550 km.',
        `Sample carrier profile: ${selectedDriver?.name || 'Not selected'} (${selectedDriver?.vehicle || 'no vehicle selected'}).`,
        `Sample storage option: ${selectedWarehouse?.name || 'Not selected'}.`,
        `Non-binding sample estimate: ${money(quote.total)}.`,
        'This is a request note only; it has not been submitted to a provider. No driver or warehouse was contacted, no reservation was made, and no payment or escrow was initiated.',
      ].join(' '),
      date: new Date().toISOString().slice(0, 10),
      status: 'Request note · not submitted',
    };
    onRecordsChange('requests', [...records.requests, request]);
    setSavedRequestId(id);
    setNotice('Request saved in farmer records. No transport or storage provider was contacted; nothing was booked or charged.');
  };

  return (
    <main className="transport-logistics">
      {notice && <div className="transport-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <header className="transport-page-heading">
        <div><p>FARMER WORKSPACE · MARKET &amp; LOGISTICS</p><h1>Harvest-to-Market Logistics</h1><span>Plan a sample transport and storage estimate for your harvest.</span></div>
        <span className="transport-demo-badge"><span className="material-symbols-outlined">info</span>Demo directory · no live bookings</span>
      </header>

      <div className="transport-demo-disclosure" role="note">
        <span className="material-symbols-outlined">info</span>
        <span>Driver profiles, availability, ratings, warehouse listings, route distance, and prices below are illustrative. AGRI-NEST is not connected to these providers and does not verify availability, reserve storage, process payment, or offer escrow.</span>
      </div>

      <div className="transport-layout">
        <section className="transport-main-column">
          <section className="transport-card transport-booking-card">
            <header className="transport-card-heading">
              <div><span className="material-symbols-outlined">local_shipping</span><h2>Transport Fleet Booking</h2></div>
              <span className="transport-directory-count">2 sample profiles</span>
            </header>

            <div className="transport-route-grid">
              <label><span>Pickup location</span><div className="transport-input-wrap"><span className="material-symbols-outlined">my_location</span><input value={pickup} onChange={(event) => { setPickup(event.target.value); setSavedRequestId(''); }} maxLength={140} placeholder="Farm, village, or collection point" /></div></label>
              <label><span>Destination</span><div className="transport-input-wrap"><span className="material-symbols-outlined">location_on</span><input value={destination} onChange={(event) => { setDestination(event.target.value); setSavedRequestId(''); }} maxLength={140} placeholder="Market, port, or storage site" /></div></label>
            </div>

            <div className="transport-section-title"><span>Sample carrier profiles</span><small>Illustrative only · not verified or available-to-book</small></div>
            <div className="transport-driver-list">
              {drivers.map((driver) => <button
                type="button"
                key={driver.id}
                className={selectedDriverId === driver.id ? 'transport-driver selected' : 'transport-driver'}
                aria-pressed={selectedDriverId === driver.id}
                onClick={() => { setSelectedDriverId(driver.id); setSavedRequestId(''); }}
              >
                <span className="transport-driver-icon"><span className="material-symbols-outlined">{driver.icon}</span></span>
                <span className="transport-driver-info">
                  <strong>{driver.name}</strong>
                  <span>{driver.vehicle} · ID {driver.vehicleId}</span>
                  <small><span className="material-symbols-outlined">star</span>{driver.rating} · {driver.trips} sample trips</small>
                </span>
                <span className="transport-driver-price"><strong>{money(driver.fare + 70000)}</strong><small>{driver.availability}</small></span>
              </button>)}
            </div>
          </section>

          <section className="transport-card transport-storage-card">
            <header className="transport-card-heading">
              <div><span className="material-symbols-outlined">warehouse</span><h2>Warehouse Reservation</h2></div>
              <span className="transport-demo-label">Sample facilities · 30-day estimate</span>
            </header>
            <div className="transport-warehouse-grid">
              {warehouses.map((warehouse) => <article key={warehouse.id} className={selectedWarehouseId === warehouse.id ? 'transport-warehouse selected' : 'transport-warehouse'}>
                <div className={`transport-warehouse-art ${warehouse.id === warehouses[0].id ? 'cold' : 'silo'}`} aria-hidden="true">
                  <span className="material-symbols-outlined">{warehouse.icon}</span>
                  <span>{warehouse.type}</span>
                </div>
                <div className="transport-warehouse-content">
                  <div className="transport-warehouse-title"><div><h3>{warehouse.name}</h3><span>{warehouse.badge}</span></div><strong>{money(warehouse.price)}<small> / 30 days</small></strong></div>
                  <p><span className="material-symbols-outlined">{warehouse.id === warehouses[0].id ? 'thermostat' : 'humidity_percentage'}</span>{warehouse.temperature}</p>
                  <div className="transport-occupancy"><div><span>Sample occupancy</span><strong>{warehouse.occupancy}%</strong></div><span className="transport-progress"><i style={{ width: `${warehouse.occupancy}%` }} /></span></div>
                  <button type="button" aria-pressed={selectedWarehouseId === warehouse.id} onClick={() => { setSelectedWarehouseId((current) => current === warehouse.id ? '' : warehouse.id); setSavedRequestId(''); }}>{selectedWarehouseId === warehouse.id ? 'Selected for estimate' : 'Add to estimate'}</button>
                </div>
              </article>)}
            </div>
          </section>
        </section>

        <aside className="transport-summary-column">
          <section className="transport-card transport-summary-card">
            <header><h2>Booking Summary</h2><span>Illustrative estimate</span></header>
            <div className="transport-summary-group">
              <h3><span className="material-symbols-outlined">local_shipping</span>Transport</h3>
              <div><span>Sample carrier estimate</span><strong>{money(quote.transportEstimate)}</strong></div>
              <div><span>Sample fuel surcharge</span><strong>{money(quote.fuelEstimate)}</strong></div>
              <div><span>Indicative transit cover</span><strong>{money(quote.transitCoverEstimate)}</strong></div>
              <p>Cover is an example fee only. No insurer or carrier has confirmed it.</p>
            </div>

            <div className="transport-summary-group">
              <h3><span className="material-symbols-outlined">warehouse</span>Storage · 30 days</h3>
              <div><span>{selectedWarehouse?.name || 'No storage selected'}</span><strong>{money(quote.storageEstimate)}</strong></div>
              {selectedWarehouse && <div><span>Sample handling fee</span><strong>{money(quote.handlingEstimate)}</strong></div>}
            </div>

            <div className="transport-summary-group service">
              <h3><span className="material-symbols-outlined">receipt_long</span>Estimated service fee</h3>
              <div><span>Example fee · 1%</span><strong>{money(quote.serviceEstimate)}</strong></div>
              <p>Not escrow. No funds are collected or held.</p>
            </div>

            <div className="transport-total"><span><small>Sample total</small><strong>{money(quote.total)}</strong></span><small>Not a provider quote. Confirm costs directly with providers.</small></div>

            <button type="button" className="transport-confirm-button" onClick={confirmRequest}>{savedRequestId ? 'Request note saved' : 'Save request note'}<span className="material-symbols-outlined">{savedRequestId ? 'check' : 'arrow_forward'}</span></button>
            <p className="transport-confirm-disclaimer"><span className="material-symbols-outlined">lock</span>Saving records your request in AGRI-NEST. It does not book transport or storage, notify a provider, reserve funds, or create escrow.</p>
          </section>

          <section className="transport-network-status">
            <span className="material-symbols-outlined">map</span>
            <div><strong>Logistics network status</strong><p>Live route and provider status are not connected. Ask your carrier about route conditions and transit time.</p></div>
          </section>
        </aside>
      </div>
    </main>
  );
}
