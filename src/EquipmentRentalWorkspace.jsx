import { useEffect, useMemo, useState } from 'react';
import './EquipmentRentalWorkspace.css';

const catalogKey = 'agrinest-equipment-rental-catalog';
const sampleListings = [
  { id: 'sample-tractor', ownerId: 'sample-provider', ownerName: 'Sample provider', name: 'Four-wheel tractor', category: 'Tractors', description: 'Illustrative listing · operator arrangement to be confirmed.', dailyRate: 180000, location: 'Morogoro', condition: 'Good', availability: 'Available' },
  { id: 'sample-sheller', ownerId: 'sample-provider', ownerName: 'Sample provider', name: 'Maize sheller', category: 'Processing', description: 'Illustrative listing · power source to be confirmed.', dailyRate: 45000, location: 'Dodoma', condition: 'Good', availability: 'Available' },
  { id: 'sample-pump', ownerId: 'sample-provider', ownerName: 'Sample provider', name: 'Irrigation water pump', category: 'Irrigation', description: 'Illustrative listing · flow rate to be confirmed.', dailyRate: 30000, location: 'Iringa', condition: 'Fair', availability: 'Available' },
];

const emptyListing = { name: '', category: 'Tractors', description: '', dailyRate: '', location: '', condition: 'Good' };
const newId = () => globalThis.crypto?.randomUUID?.() || `equipment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readLocalRecords(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return { records: Array.isArray(parsed) ? parsed.filter((record) => record && typeof record === 'object') : [], error: '' };
  } catch (error) {
    console.error(`Could not read local equipment records (${key}):`, error);
    return { records: [], error: 'Saved equipment records could not be read from this browser.' };
  }
}

function writeLocalRecords(key, records) {
  window.localStorage.setItem(key, JSON.stringify(records));
}

function formatTzs(amount) {
  return `TZS ${Number(amount || 0).toLocaleString('en-TZ')}`;
}

export default function EquipmentRentalWorkspace({ mode = 'browse', section = 'browse', user, profile = {}, onBack, onNavigate }) {
  const accountId = user?.user_id || user?.id || user?.email || 'local-account';
  const ownerId = String(accountId);
  const bookingKey = `agrinest-equipment-rental-inquiries:${ownerId}`;
  const maintenanceKey = `agrinest-equipment-maintenance:${ownerId}`;
  const [catalogState, setCatalogState] = useState(() => readLocalRecords(catalogKey));
  const [inquiryState, setInquiryState] = useState(() => readLocalRecords(bookingKey));
  const [maintenanceState, setMaintenanceState] = useState(() => readLocalRecords(maintenanceKey));
  const [activeSection, setActiveSection] = useState(mode === 'owner' ? section : 'browse');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All equipment');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(catalogState.error || inquiryState.error || maintenanceState.error);
  const [listingDraft, setListingDraft] = useState(emptyListing);
  const [selectedListing, setSelectedListing] = useState(null);
  const [inquiryDraft, setInquiryDraft] = useState({ startDate: '', endDate: '', message: '' });
  const [maintenanceDraft, setMaintenanceDraft] = useState({ equipmentId: '', date: new Date().toISOString().slice(0, 10), type: 'Routine service', details: '' });

  useEffect(() => {
    if (mode === 'owner') setActiveSection(section);
    else setActiveSection('browse');
  }, [mode, section]);

  const catalog = catalogState.records;
  const inquiries = inquiryState.records;
  const maintenance = maintenanceState.records;
  const ownerListings = catalog.filter((listing) => listing.ownerId === ownerId);
  const listings = [...sampleListings, ...catalog].filter((listing) => listing.availability !== 'Paused');
  const categories = ['All equipment', ...new Set(listings.map((listing) => listing.category).filter(Boolean))];
  const filteredListings = useMemo(() => listings.filter((listing) => {
    if (listing.availability !== 'Available') return false;
    if (category !== 'All equipment' && listing.category !== category) return false;
    const searchText = `${listing.name} ${listing.category} ${listing.location} ${listing.description}`.toLowerCase();
    return !search || searchText.includes(search.trim().toLowerCase());
  }), [listings, category, search]);

  const persistCatalog = (next) => {
    try {
      writeLocalRecords(catalogKey, next);
      setCatalogState({ records: next, error: '' });
      setError('');
      return true;
    } catch (writeError) {
      console.error('Could not save equipment listings:', writeError);
      setError('Equipment listings could not be saved in this browser.');
      return false;
    }
  };

  const persistInquiries = (next) => {
    try {
      writeLocalRecords(bookingKey, next);
      setInquiryState({ records: next, error: '' });
      return true;
    } catch (writeError) {
      console.error('Could not save equipment rental inquiry:', writeError);
      setError('The rental inquiry could not be saved in this browser.');
      return false;
    }
  };

  const persistMaintenance = (next) => {
    try {
      writeLocalRecords(maintenanceKey, next);
      setMaintenanceState({ records: next, error: '' });
      return true;
    } catch (writeError) {
      console.error('Could not save equipment maintenance record:', writeError);
      setError('The maintenance record could not be saved in this browser.');
      return false;
    }
  };

  const saveListing = (event) => {
    event.preventDefault();
    const dailyRate = Number(listingDraft.dailyRate);
    if (!listingDraft.name.trim() || !listingDraft.location.trim() || !Number.isFinite(dailyRate) || dailyRate <= 0) {
      setError('Enter an equipment name, location, and daily rate above zero.');
      return;
    }
    const listing = {
      ...listingDraft,
      id: newId(),
      ownerId,
      ownerName: profile.name || user?.name || 'Equipment owner',
      name: listingDraft.name.trim(),
      location: listingDraft.location.trim(),
      description: listingDraft.description.trim(),
      dailyRate,
      availability: 'Available',
      createdAt: new Date().toISOString(),
    };
    if (!persistCatalog([listing, ...catalog])) return;
    setListingDraft(emptyListing);
    setNotice('Listing saved on this device. It is not published to a shared marketplace.');
  };

  const saveInquiry = (event) => {
    event.preventDefault();
    if (!selectedListing || !inquiryDraft.startDate || !inquiryDraft.endDate || inquiryDraft.endDate < inquiryDraft.startDate) {
      setError('Choose valid rental dates before saving your inquiry.');
      return;
    }
    const inquiry = {
      id: newId(),
      listingId: selectedListing.id,
      equipmentName: selectedListing.name,
      ownerName: selectedListing.ownerName,
      startDate: inquiryDraft.startDate,
      endDate: inquiryDraft.endDate,
      message: inquiryDraft.message.trim(),
      status: 'Local note',
      createdAt: new Date().toISOString(),
    };
    if (!persistInquiries([inquiry, ...inquiries])) return;
    setSelectedListing(null);
    setInquiryDraft({ startDate: '', endDate: '', message: '' });
    setNotice('Inquiry saved on this device only. It was not sent to the equipment owner and does not reserve equipment.');
  };

  const saveMaintenance = (event) => {
    event.preventDefault();
    const listing = ownerListings.find((item) => item.id === maintenanceDraft.equipmentId);
    if (!listing || !maintenanceDraft.date || !maintenanceDraft.details.trim()) {
      setError('Choose equipment, a date, and maintenance details.');
      return;
    }
    const record = { id: newId(), equipmentId: listing.id, equipmentName: listing.name, date: maintenanceDraft.date, type: maintenanceDraft.type, details: maintenanceDraft.details.trim(), createdAt: new Date().toISOString() };
    if (!persistMaintenance([record, ...maintenance])) return;
    setMaintenanceDraft((current) => ({ ...current, details: '' }));
    setNotice('Maintenance record saved on this device.');
  };

  const changeAvailability = (listing) => {
    const next = catalog.map((item) => item.id === listing.id ? { ...item, availability: item.availability === 'Paused' ? 'Available' : 'Paused' } : item);
    if (persistCatalog(next)) setNotice(`${listing.name} is now ${listing.availability === 'Paused' ? 'available' : 'paused'} on this device.`);
  };

  const navigate = (next) => {
    setActiveSection(next);
    onNavigate?.(next);
  };

  const ownerTabs = [
    ['equipment', 'precision_manufacturing', 'Equipment Listings'],
    ['availability', 'calendar_month', 'Availability'],
    ['bookings', 'event_available', 'Inquiries'],
    ['maintenance', 'build', 'Maintenance'],
  ];

  return (
    <main className="equipment-rental-page">
      <header className="equipment-rental-header">
        <div>
          <span className="farmer-workspace-eyebrow">{mode === 'owner' ? 'EQUIPMENT OWNER WORKSPACE' : 'FARM EQUIPMENT RENTAL'}</span>
          <h1>{mode === 'owner' ? 'Machinery &amp; Equipment' : 'Rent Farm Equipment'}</h1>
          <p>{mode === 'owner' ? 'Manage your equipment listings, availability, renter inquiries, and maintenance notes.' : 'Find equipment by type and location, then save an inquiry for your rental planning.'}</p>
        </div>
        {onBack && <button type="button" className="equipment-back-button" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Dashboard</button>}
      </header>
      {error && <div className="equipment-message is-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><span className="material-symbols-outlined">close</span></button></div>}
      {notice && <div className="equipment-message" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <div className="equipment-local-note"><span className="material-symbols-outlined">info</span><p>{mode === 'owner' ? 'Listings, availability, inquiries, and maintenance are stored in this browser. Owner-created listings can appear to other profiles using this browser, but are not published to a network marketplace; no booking or payment is processed.' : 'Sample listings are illustrative. Owner-created listings, rental inquiries, and availability are saved only in this browser; no request is sent, booking reserved, or payment processed.'}</p></div>

      {mode === 'owner' ? (
        <>
          <nav className="equipment-owner-tabs" aria-label="Equipment owner workspace">{ownerTabs.map(([id, icon, label]) => <button type="button" key={id} className={activeSection === id ? 'active' : ''} onClick={() => navigate(id)}><span className="material-symbols-outlined">{icon}</span>{label}{id === 'bookings' && inquiries.length > 0 && <span className="equipment-tab-count">{inquiries.length}</span>}</button>)}</nav>
          <section className="equipment-owner-summary">
            <article><span>My Equipment</span><strong>{ownerListings.length}</strong><small>Listings saved on this device</small></article>
            <article><span>Available Now</span><strong>{ownerListings.filter((item) => item.availability === 'Available').length}</strong><small>Availability you recorded</small></article>
            <article><span>Local Inquiries</span><strong>{inquiries.length}</strong><small>Not delivered to owners</small></article>
            <article><span>Maintenance Notes</span><strong>{maintenance.length}</strong><small>Saved in this account</small></article>
          </section>
          {activeSection === 'equipment' ? (
            <section className="equipment-owner-grid">
              <form className="equipment-panel equipment-listing-form" onSubmit={saveListing}>
                <div className="equipment-panel-heading"><span className="material-symbols-outlined">add_circle</span><div><h2>List Equipment</h2><p>Add an asset and rental terms.</p></div></div>
                <label>Equipment name<input required maxLength="100" value={listingDraft.name} onChange={(event) => setListingDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. 75 HP tractor" /></label>
                <label>Category<select value={listingDraft.category} onChange={(event) => setListingDraft((current) => ({ ...current, category: event.target.value }))}><option>Tractors</option><option>Land preparation</option><option>Planting</option><option>Harvesting</option><option>Processing</option><option>Irrigation</option><option>Transport</option><option>Other</option></select></label>
                <label>Daily rate (TZS)<input required type="number" min="1" step="1" value={listingDraft.dailyRate} onChange={(event) => setListingDraft((current) => ({ ...current, dailyRate: event.target.value }))} /></label>
                <label>Location<input required maxLength="100" value={listingDraft.location} onChange={(event) => setListingDraft((current) => ({ ...current, location: event.target.value }))} placeholder="District or region" /></label>
                <label>Condition<select value={listingDraft.condition} onChange={(event) => setListingDraft((current) => ({ ...current, condition: event.target.value }))}><option>Excellent</option><option>Good</option><option>Fair</option><option>Needs service</option></select></label>
                <label>Description<textarea maxLength="300" value={listingDraft.description} onChange={(event) => setListingDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Capacity, attachments, or operating terms" /></label>
                <button type="submit" className="equipment-primary-button"><span className="material-symbols-outlined">add</span>Save Listing</button>
              </form>
              <section className="equipment-panel">
                <div className="equipment-panel-heading"><span className="material-symbols-outlined">agriculture</span><div><h2>My Listings</h2><p>Your equipment records on this device.</p></div></div>
                {ownerListings.length ? <div className="equipment-owner-list">{ownerListings.map((item) => <article className="equipment-owner-card" key={item.id}><div className="equipment-card-icon"><span className="material-symbols-outlined">agriculture</span></div><div className="equipment-card-content"><div className="equipment-card-title"><div><h3>{item.name}</h3><span>{item.category}</span></div><span className={`equipment-status ${item.availability === 'Available' ? 'is-available' : 'is-paused'}`}>{item.availability}</span></div><p>{item.location} · {item.condition}</p><strong>{formatTzs(item.dailyRate)} <small>/ day</small></strong><button type="button" className="equipment-secondary-button" onClick={() => changeAvailability(item)}>{item.availability === 'Paused' ? 'Make available' : 'Pause listing'}</button></div></article>)}</div> : <div className="equipment-empty"><span className="material-symbols-outlined">precision_manufacturing</span><strong>No equipment listed yet</strong><p>Saved listings are local to this browser and are not published to a shared marketplace.</p></div>}
              </section>
            </section>
          ) : activeSection === 'availability' ? (
            <section className="equipment-panel"><div className="equipment-panel-heading"><span className="material-symbols-outlined">calendar_month</span><div><h2>Availability Calendar</h2><p>Pause or reopen listings. Date-based calendars are not connected.</p></div></div>{ownerListings.length ? <div className="equipment-owner-list">{ownerListings.map((item) => <article className="equipment-availability-row" key={item.id}><div><strong>{item.name}</strong><small>{item.location} · {item.category}</small></div><span className={`equipment-status ${item.availability === 'Available' ? 'is-available' : 'is-paused'}`}>{item.availability}</span><button type="button" className="equipment-secondary-button" onClick={() => changeAvailability(item)}>{item.availability === 'Paused' ? 'Reopen' : 'Pause'}</button></article>)}</div> : <div className="equipment-empty"><strong>No listings to schedule</strong><p>Add equipment before managing availability.</p><button type="button" className="equipment-secondary-button" onClick={() => navigate('equipment')}>Open listings</button></div>}</section>
          ) : activeSection === 'bookings' ? (
            <section className="equipment-panel"><div className="equipment-panel-heading"><span className="material-symbols-outlined">event_available</span><div><h2>Rental Inquiries</h2><p>Local notes are not delivered by the app and do not reserve equipment.</p></div></div>{inquiries.length ? <div className="equipment-inquiry-list">{inquiries.map((item) => <article key={item.id}><div><strong>{item.equipmentName}</strong><p>{item.startDate} – {item.endDate}</p>{item.message && <small>{item.message}</small>}</div><span className="equipment-status is-local">{item.status}</span></article>)}</div> : <div className="equipment-empty"><span className="material-symbols-outlined">event_busy</span><strong>No local inquiries</strong><p>Rental interest notes saved on this browser appear here. Cross-account inquiry delivery is not connected.</p></div>}</section>
          ) : (
            <section className="equipment-maintenance-grid"><form className="equipment-panel" onSubmit={saveMaintenance}><div className="equipment-panel-heading"><span className="material-symbols-outlined">build</span><div><h2>Log Maintenance</h2><p>Record service performed or planned.</p></div></div><label>Equipment<select required value={maintenanceDraft.equipmentId} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, equipmentId: event.target.value }))}><option value="">Choose equipment</option>{ownerListings.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Service date<input required type="date" value={maintenanceDraft.date} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, date: event.target.value }))} /></label><label>Service type<select value={maintenanceDraft.type} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, type: event.target.value }))}><option>Routine service</option><option>Repair</option><option>Inspection</option><option>Parts replacement</option></select></label><label>Details<textarea required maxLength="500" value={maintenanceDraft.details} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, details: event.target.value }))} /></label><button type="submit" className="equipment-primary-button" disabled={!ownerListings.length}>Save Maintenance Note</button></form><section className="equipment-panel"><div className="equipment-panel-heading"><span className="material-symbols-outlined">history</span><div><h2>Maintenance History</h2><p>Records saved in this account.</p></div></div>{maintenance.length ? <div className="equipment-inquiry-list">{maintenance.map((item) => <article key={item.id}><div><strong>{item.equipmentName}</strong><p>{item.date} · {item.type}</p><small>{item.details}</small></div></article>)}</div> : <div className="equipment-empty"><strong>No maintenance notes</strong><p>Service records you add will appear here.</p></div>}</section></section>
          )}
        </>
      ) : (
        <>
          <section className="equipment-market-summary"><div><span className="material-symbols-outlined">agriculture</span><div><strong>{filteredListings.length}</strong><small>Equipment listings shown</small></div></div><div><span className="material-symbols-outlined">location_on</span><div><strong>{new Set(filteredListings.map((item) => item.location)).size}</strong><small>Locations represented</small></div></div><div><span className="material-symbols-outlined">verified_user</span><div><strong>Confirm directly</strong><small>Condition &amp; availability are unverified</small></div></div></section>
          <section className="equipment-market-tools"><label className="equipment-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search equipment or location" aria-label="Search equipment or location" /></label><label className="equipment-category-filter"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((option) => <option key={option}>{option}</option>)}</select></label></section>
          {filteredListings.length ? <section className="equipment-listing-grid" aria-label="Equipment listings">{filteredListings.map((listing) => <article className="equipment-rental-card" key={listing.id}><div className="equipment-card-illustration"><span className="material-symbols-outlined">{listing.category === 'Irrigation' ? 'water_pump' : listing.category === 'Processing' ? 'precision_manufacturing' : 'agriculture'}</span><span className="equipment-status is-available">{listing.availability}</span></div><div className="equipment-rental-card-body"><div className="equipment-card-title"><div><span>{listing.category}</span><h2>{listing.name}</h2></div></div><p className="equipment-location"><span className="material-symbols-outlined">location_on</span>{listing.location}</p><p className="equipment-description">{listing.description}</p><div className="equipment-rental-card-footer"><div><strong>{formatTzs(listing.dailyRate)}</strong><small>/ day · {listing.condition}</small></div><button type="button" className="equipment-primary-button" onClick={() => setSelectedListing(listing)}>Request rental</button></div></div></article>)}</section> : <div className="equipment-empty"><span className="material-symbols-outlined">search_off</span><strong>No equipment matches</strong><p>Try another search or category.</p></div>}
          <section className="equipment-panel equipment-local-inquiries"><div className="equipment-panel-heading"><span className="material-symbols-outlined">bookmark</span><div><h2>Your Saved Rental Notes</h2><p>Only this account in this browser; notes are not sent to providers.</p></div></div>{inquiries.length ? <div className="equipment-inquiry-list">{inquiries.map((item) => <article key={item.id}><div><strong>{item.equipmentName}</strong><p>{item.startDate} – {item.endDate} · {item.status}</p></div></article>)}</div> : <p className="equipment-empty-copy">No rental notes saved.</p>}</section>
          {selectedListing && <div className="digital-farm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedListing(null); }}><section className="digital-farm-dialog equipment-inquiry-dialog" role="dialog" aria-modal="true" aria-labelledby="equipment-inquiry-title"><div className="digital-farm-dialog-heading"><div><span className="farmer-workspace-eyebrow">LOCAL RENTAL NOTE</span><h2 id="equipment-inquiry-title">Request {selectedListing.name}</h2></div><button type="button" aria-label="Close dialog" onClick={() => setSelectedListing(null)}><span className="material-symbols-outlined">close</span></button></div><form onSubmit={saveInquiry}><label>Start date<input type="date" required min={new Date().toISOString().slice(0, 10)} value={inquiryDraft.startDate} onChange={(event) => setInquiryDraft((current) => ({ ...current, startDate: event.target.value }))} /></label><label>End date<input type="date" required min={inquiryDraft.startDate || new Date().toISOString().slice(0, 10)} value={inquiryDraft.endDate} onChange={(event) => setInquiryDraft((current) => ({ ...current, endDate: event.target.value }))} /></label><label className="wide">Message<textarea maxLength="300" value={inquiryDraft.message} onChange={(event) => setInquiryDraft((current) => ({ ...current, message: event.target.value }))} placeholder="Add a note for your own planning" /></label><p className="digital-farm-dialog-note">This only saves a note here. It does not notify the owner, reserve equipment, or process payment.</p><button type="submit" className="farmer-workspace-submit">Save Rental Note</button></form></section></div>}
        </>
      )}
    </main>
  );
}
