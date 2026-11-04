import { useEffect, useMemo, useState } from 'react';
import api from './lib/api';
import { resizeImageForUpload } from './lib/image-uploads';

const spaceTypes = [
  { value: 'farmland', label: 'Farmland', icon: 'agriculture' },
  { value: 'dry_storage', label: 'Dry Storage', icon: 'warehouse' },
  { value: 'cold_storage', label: 'Cold Storage', icon: 'ac_unit' },
  { value: 'processing', label: 'Processing', icon: 'precision_manufacturing' },
];
const filters = [{ value: 'all', label: 'All Types' }, ...spaceTypes];
const pricePeriods = [
  ['day', 'Day'],
  ['month', 'Month'],
  ['season', 'Season'],
  ['year', 'Year'],
  ['ton', 'Tonne'],
  ['acre', 'Acre'],
];
const formatTzs = (amount) => `TZS ${Number(amount || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const typeLabel = (type) => spaceTypes.find((item) => item.value === type)?.label || 'Farm space';

function RentalModal({ title, children, onClose }) {
  return (
    <div className="rental-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="rental-modal" role="dialog" aria-modal="true" aria-labelledby="rental-modal-title">
        <div className="rental-modal-heading">
          <div><span className="farmer-workspace-eyebrow">KUPANGA NAFASI</span><h2 id="rental-modal-title">{title}</h2></div>
          <button type="button" className="rental-icon-button" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function SpaceRentalWorkspace({ user, profile, search = '' }) {
  const [spaces, setSpaces] = useState([]);
  const [mySpaces, setMySpaces] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('browse');
  const [filter, setFilter] = useState('all');
  const [listingOpen, setListingOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imageName, setImageName] = useState('');
  const [imageError, setImageError] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [draft, setDraft] = useState({
    title: '', space_type: 'farmland', description: '', region: profile?.region || '',
    quantity: '', unit: 'acres', price: '', price_period: 'season', available_from: '', image_url: '',
  });
  const [requestDraft, setRequestDraft] = useState({ requested_from: today(), requested_to: '', message: '' });
  const userId = user?.user_id;
  const userName = user?.name || profile?.name;

  const load = async () => {
    setLoading(true);
    setError('');
    const [spacesResult, ownedResult, requestsResult] = await Promise.allSettled([
      api.getSpaceListings(),
      api.getMySpaceListings(),
      api.getSpaceRentalRequests(),
    ]);
    if (spacesResult.status === 'fulfilled') {
      setSpaces(Array.isArray(spacesResult.value.items) ? spacesResult.value.items : []);
    } else {
      setError('Could not load available spaces. Check your connection and retry.');
    }
    if (ownedResult.status === 'fulfilled') {
      setMySpaces(Array.isArray(ownedResult.value.items) ? ownedResult.value.items : []);
    } else {
      setError('Could not load your space listings. Check your connection and retry.');
    }
    if (requestsResult.status === 'fulfilled') {
      setRequests(Array.isArray(requestsResult.value.items) ? requestsResult.value.items : []);
    } else {
      setError('Could not load rental inquiries. Check your connection and retry.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const visibleSpaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return spaces.filter((space) => (filter === 'all' || space.space_type === filter)
      && (!query || [space.title, space.description, space.region, space.owner_name, typeLabel(space.space_type)]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query))));
  }, [spaces, filter, search]);

  const farmlandAcres = spaces
    .filter((space) => space.space_type === 'farmland' && /^acre(s)?$/i.test(space.unit))
    .reduce((sum, space) => sum + Number(space.quantity || 0), 0);
  const storageTonnes = spaces
    .filter((space) => ['dry_storage', 'cold_storage'].includes(space.space_type) && /^ton(ne)?s?$/i.test(space.unit))
    .reduce((sum, space) => sum + Number(space.quantity || 0), 0);
  const averagePrice = spaces.length
    ? spaces.reduce((sum, space) => sum + Number(space.price || 0), 0) / spaces.length
    : 0;
  const pendingReceived = requests.filter((request) => request.owner_id === userId && request.status === 'pending').length;
  const ownIds = new Set(mySpaces.map((space) => space.space_id));

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const saveListing = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.createSpaceListing({
        ...draft,
        quantity: Number(draft.quantity),
        price: Number(draft.price),
        available_from: draft.available_from || null,
        image_url: draft.image_url.trim(),
      });
      setListingOpen(false);
      setDraft({
        title: '', space_type: 'farmland', description: '', region: profile?.region || '',
        quantity: '', unit: 'acres', price: '', price_period: 'season', available_from: '', image_url: '',
      });
      setImageName('');
      setImageError('');
      setNotice('Your space listing is live. It is owner-provided and has not been independently verified.');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Could not publish the space listing. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async (event) => {
    event.preventDefault();
    if (!selectedSpace) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.createSpaceRentalRequest(selectedSpace.space_id, {
        ...requestDraft,
        requested_to: requestDraft.requested_to || null,
      });
      setSelectedSpace(null);
      setRequestDraft({ requested_from: today(), requested_to: '', message: '' });
      setActiveTab('requests');
      setNotice('Your non-binding inquiry was sent to the space owner. No payment or booking has been made.');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Could not send this rental inquiry. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const updateRequest = async (request, status) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.updateSpaceRentalRequest(request.request_id, status);
      setNotice(`Inquiry ${status}. This does not create a lease or collect payment.`);
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Could not update this inquiry. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const updateSpaceStatus = async (space, status) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.setSpaceListingStatus(space.space_id, status);
      setNotice(status === 'inactive' ? 'Your listing is no longer visible in browse.' : 'Your listing is visible in browse again.');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Could not update the listing. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const beginListing = () => {
    setError('');
    setNotice('');
    setListingOpen(true);
  };

  return (
    <main className="space-rental-page" aria-label="Land and space rental">
      {notice && <div className="rental-alert is-success" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      {error && <div className="rental-alert is-error" role="alert">{error}<button type="button" onClick={load}><span className="material-symbols-outlined">refresh</span>Retry</button></div>}

      <div className="space-rental-layout">
        <div className="space-rental-main">
          <header className="space-rental-heading">
            <div><span className="farmer-workspace-eyebrow">LAND &amp; STORAGE MARKETPLACE</span><h1>Kupanga Nafasi <span>— Land &amp; Space Rental</span></h1><p>Find farmland, dry storage, cold rooms, and processing space. Contact owners directly to discuss availability and terms.</p></div>
            <button type="button" className="rental-primary-button rental-mobile-list" onClick={beginListing}><span className="material-symbols-outlined">add</span>List your space</button>
          </header>

          <section className="rental-stats" aria-label="Rental marketplace summary">
            <article><span className="material-symbols-outlined">domain</span><strong>{spaces.length}</strong><small>ACTIVE LISTINGS</small></article>
            <article><span className="material-symbols-outlined">landscape</span><strong>{farmlandAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong><small>ACRES LISTED</small></article>
            <article><span className="material-symbols-outlined">payments</span><strong>{spaces.length ? formatTzs(averagePrice) : '—'}</strong><small>AVERAGE LISTED PRICE</small></article>
            <article><span className="material-symbols-outlined">warehouse</span><strong>{storageTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong><small>STORAGE TONNES</small></article>
          </section>

          <nav className="rental-tabs" aria-label="Rental sections">
            {[['browse', 'Browse spaces', 'search'], ['mine', 'My listings', 'storefront'], ['requests', `Inquiries${pendingReceived ? ` (${pendingReceived})` : ''}`, 'forum']].map(([value, label, icon]) => (
              <button type="button" key={value} className={activeTab === value ? 'active' : ''} aria-current={activeTab === value ? 'page' : undefined} onClick={() => setActiveTab(value)}>
                <span className="material-symbols-outlined">{icon}</span>{label}
              </button>
            ))}
          </nav>

          {activeTab === 'browse' && <>
            <div className="rental-filter-bar" aria-label="Filter spaces by type">
              {filters.map((item) => <button type="button" key={item.value} className={filter === item.value ? 'active' : ''} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
              <span>{visibleSpaces.length} {visibleSpaces.length === 1 ? 'space' : 'spaces'}</span>
            </div>
            {loading ? <div className="rental-empty"><span className="material-symbols-outlined">hourglass_top</span><strong>Loading available spaces…</strong></div>
              : visibleSpaces.length ? <section className="rental-card-grid" aria-label="Available rental spaces">
                {visibleSpaces.map((space) => {
                  const owned = ownIds.has(space.space_id);
                  return <article className="rental-space-card" key={space.space_id}>
                    <div className={`rental-card-image rental-type-${space.space_type}`}>
                      {space.image_url ? <img src={space.image_url} alt="" loading="lazy" /> : <span className="material-symbols-outlined" aria-hidden="true">{spaceTypes.find((item) => item.value === space.space_type)?.icon || 'landscape'}</span>}
                      <span className="rental-type-badge">{typeLabel(space.space_type)}</span>
                    </div>
                    <div className="rental-card-content">
                      <h2>{space.title}</h2>
                      <p className="rental-card-location"><span className="material-symbols-outlined">location_on</span>{space.region}</p>
                      <p className="rental-card-description">{space.description || `${Number(space.quantity).toLocaleString()} ${space.unit} available.`}</p>
                      <div className="rental-owner"><span>Listed by {owned ? 'you' : space.owner_name || 'space owner'}</span><span className="rental-owner-disclaimer">Not verified</span></div>
                      <div className="rental-price"><small>Listed price</small><strong>{formatTzs(space.price)} <span>/ {space.price_period}</span></strong><small>{Number(space.quantity).toLocaleString()} {space.unit}{space.available_from ? ` · From ${new Date(`${String(space.available_from).slice(0, 10)}T00:00:00`).toLocaleDateString()}` : ''}</small></div>
                      {owned ? <button type="button" className="rental-secondary-button" disabled={busy} onClick={() => updateSpaceStatus(space, 'inactive')}>Pause your listing</button>
                        : <div className="rental-card-actions">
                          <button type="button" className="rental-primary-button" onClick={() => { setSelectedSpace(space); setError(''); setNotice(''); }}>Ask about space</button>
                          <button type="button" className="rental-chat-icon" aria-label={`Ask ${space.owner_name || 'owner'} about ${space.title}`} onClick={() => { setSelectedSpace(space); setError(''); setNotice(''); }}><span className="material-symbols-outlined">chat</span></button>
                        </div>}
                    </div>
                  </article>;
                })}
              </section> : <div className="rental-empty"><span className="material-symbols-outlined">search_off</span><strong>{spaces.length ? 'No spaces match these filters' : 'No spaces listed yet'}</strong><p>{spaces.length ? 'Try another category or search term.' : 'Be the first to list farmland or storage space on AGRI-NEST.'}</p>{!spaces.length && <button type="button" className="rental-primary-button" onClick={beginListing}>List your space</button>}</div>}
          </>}

          {activeTab === 'mine' && <section className="rental-my-listings">
            <div className="rental-section-heading"><div><span className="farmer-workspace-eyebrow">YOUR SPACE</span><h2>My listings</h2></div><button type="button" className="rental-primary-button" onClick={beginListing}><span className="material-symbols-outlined">add</span>List a space</button></div>
            {loading ? <div className="rental-empty"><strong>Loading your listings…</strong></div> : mySpaces.length ? mySpaces.map((space) => <article className="rental-manage-card" key={space.space_id}>
              <div><span className={`rental-status-badge ${space.status}`}>{space.status}</span><h3>{space.title}</h3><p>{typeLabel(space.space_type)} · {space.region} · {Number(space.quantity).toLocaleString()} {space.unit} · {formatTzs(space.price)} / {space.price_period}</p></div>
              <button type="button" className="rental-secondary-button" disabled={busy} onClick={() => updateSpaceStatus(space, space.status === 'active' ? 'inactive' : 'active')}>{space.status === 'active' ? 'Pause listing' : 'Publish again'}</button>
            </article>) : <div className="rental-empty"><span className="material-symbols-outlined">storefront</span><strong>You have not listed a space yet</strong><p>Create a listing with its size, location, availability, and asking price.</p><button type="button" className="rental-primary-button" onClick={beginListing}>List your space</button></div>}
          </section>}

          {activeTab === 'requests' && <section className="rental-requests">
            <div className="rental-section-heading"><div><span className="farmer-workspace-eyebrow">RENTAL INQUIRIES</span><h2>Sent and received</h2></div></div>
            {loading ? <div className="rental-empty"><strong>Loading inquiries…</strong></div> : requests.length ? requests.map((request) => {
              const received = request.owner_id === userId;
              return <article className="rental-request-card" key={request.request_id}>
                <div className="rental-request-top"><div><span className="farmer-workspace-eyebrow">{received ? 'RECEIVED FROM' : 'SENT TO'} {received ? request.requester_name : request.owner_name}</span><h3>{request.space_title}</h3></div><span className={`rental-status-badge ${request.status}`}>{request.status}</span></div>
                <p>Requested {new Date(`${String(request.requested_from).slice(0, 10)}T00:00:00`).toLocaleDateString()}{request.requested_to ? ` to ${new Date(`${String(request.requested_to).slice(0, 10)}T00:00:00`).toLocaleDateString()}` : ''}</p>
                {request.message && <blockquote>{request.message}</blockquote>}
                {received && request.status === 'pending' && <div className="rental-request-actions"><button type="button" className="rental-secondary-button" disabled={busy} onClick={() => updateRequest(request, 'declined')}>Decline</button><button type="button" className="rental-primary-button" disabled={busy} onClick={() => updateRequest(request, 'accepted')}>Accept inquiry</button></div>}
              </article>;
            }) : <div className="rental-empty"><span className="material-symbols-outlined">mark_chat_unread</span><strong>No rental inquiries yet</strong><p>Requests you send or receive about listed spaces will appear here.</p></div>}
          </section>}
        </div>

        <aside className="rental-sidebar">
          <section className="rental-list-cta"><span className="material-symbols-outlined">add_business</span><h2>Have space?</h2><p>List unused farmland or storage for other AGRI-NEST members to enquire about.</p><button type="button" className="rental-primary-button" onClick={beginListing}>List your space</button></section>
          <section className="rental-guidelines"><h2><span className="material-symbols-outlined">verified_user</span>Rental guidelines</h2>
            <article><span className="material-symbols-outlined">fact_check</span><div><strong>Check details yourself</strong><p>Listings and owner details are user-provided; AGRI-NEST does not verify ownership or facility conditions.</p></div></article>
            <article><span className="material-symbols-outlined">handshake</span><div><strong>Inquiry is not a booking</strong><p>Accepting an inquiry does not create a lease, reserve space, or confirm payment.</p></div></article>
            <article><span className="material-symbols-outlined">payments</span><div><strong>No in-app payment</strong><p>AGRI-NEST does not provide escrow or collect rental payments through this page.</p></div></article>
          </section>
        </aside>
      </div>

      {listingOpen && <RentalModal title="List your space" onClose={() => !busy && setListingOpen(false)}>
        <form className="rental-form" onSubmit={saveListing}>
          <label>Listing title<input required maxLength="120" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="e.g. 2-acre irrigated plot" /></label>
          <div className="rental-form-row"><label>Space type<select value={draft.space_type} onChange={(event) => {
            const type = event.target.value;
            updateDraft('space_type', type);
            updateDraft('unit', type === 'farmland' ? 'acres' : 'tonnes');
          }}>{spaceTypes.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label><label>Location / region<input required maxLength="120" value={draft.region} onChange={(event) => updateDraft('region', event.target.value)} placeholder="e.g. Iringa Rural" /></label></div>
          <label>Description<textarea maxLength="2000" rows="3" value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} placeholder="Describe access, facilities, conditions, and important terms." /></label>
          <div className="rental-form-row"><label>Available quantity<input required type="number" min="0.01" step="any" value={draft.quantity} onChange={(event) => updateDraft('quantity', event.target.value)} /></label><label>Unit<input required maxLength="40" value={draft.unit} onChange={(event) => updateDraft('unit', event.target.value)} placeholder="acres, tonnes, rooms…" /></label></div>
          <div className="rental-form-row"><label>Total price per period (TZS)<input required type="number" min="0" step="1" value={draft.price} onChange={(event) => updateDraft('price', event.target.value)} /></label><label>Price period<select value={draft.price_period} onChange={(event) => updateDraft('price_period', event.target.value)}>{pricePeriods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          <div className="rental-form-row"><label>Available from (optional)<input type="date" min={today()} value={draft.available_from} onChange={(event) => updateDraft('available_from', event.target.value)} /></label><label>Upload a photo from this device<input type="file" accept="image/*" disabled={isProcessingImage || busy} onChange={async (event) => {
            const [file] = event.target.files || [];
            event.target.value = '';
            if (!file) return;
            setIsProcessingImage(true);
            setImageError('');
            setError('');
            try {
              const imageUrl = await resizeImageForUpload(file);
              updateDraft('image_url', imageUrl);
              setImageName(file.name);
            } catch (uploadError) {
              setImageError(uploadError.message);
            } finally {
              setIsProcessingImage(false);
            }
          }} />{isProcessingImage ? <small>Preparing image…</small> : imageName && <small>Selected: {imageName}</small>}{imageError && <small className="rental-image-error" role="alert">{imageError}</small>}</label></div>
          <label>Or use a secure image URL (optional)<input type="url" maxLength="2048" value={imageName ? '' : draft.image_url} onChange={(event) => { setImageName(''); updateDraft('image_url', event.target.value); }} placeholder="https://…" /></label>
          {draft.image_url && <div className="rental-image-preview"><img src={draft.image_url} alt="Space listing preview" /><button type="button" className="rental-secondary-button" onClick={() => { setImageName(''); updateDraft('image_url', ''); }}>Remove photo</button></div>}
          <p className="rental-form-disclaimer">Your listing will be visible to signed-in and public visitors. Do not include private documents, precise home addresses, or sensitive location details.</p>
          <div className="rental-modal-actions"><button type="button" className="rental-secondary-button" disabled={busy} onClick={() => setListingOpen(false)}>Cancel</button><button type="submit" className="rental-primary-button" disabled={busy || isProcessingImage}>{busy ? 'Publishing…' : 'Publish listing'}</button></div>
        </form>
      </RentalModal>}

      {selectedSpace && <RentalModal title="Ask about this space" onClose={() => !busy && setSelectedSpace(null)}>
        <form className="rental-form" onSubmit={sendRequest}>
          <div className="rental-selected-space"><strong>{selectedSpace.title}</strong><span>{selectedSpace.region} · Listed by {selectedSpace.owner_name || 'space owner'}</span></div>
          <div className="rental-form-row"><label>Requested from<input required type="date" min={today()} value={requestDraft.requested_from} onChange={(event) => setRequestDraft((current) => ({ ...current, requested_from: event.target.value }))} /></label><label>Requested until (optional)<input type="date" min={requestDraft.requested_from || today()} value={requestDraft.requested_to} onChange={(event) => setRequestDraft((current) => ({ ...current, requested_to: event.target.value }))} /></label></div>
          <label>Message to owner<textarea maxLength="2000" rows="4" value={requestDraft.message} onChange={(event) => setRequestDraft((current) => ({ ...current, message: event.target.value }))} placeholder="Ask about availability, access, or rental terms." /></label>
          <p className="rental-form-disclaimer">This sends a non-binding inquiry only. It does not reserve the space, sign an agreement, or make a payment.</p>
          <div className="rental-modal-actions"><button type="button" className="rental-secondary-button" disabled={busy} onClick={() => setSelectedSpace(null)}>Cancel</button><button type="submit" className="rental-primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send inquiry'}</button></div>
        </form>
      </RentalModal>}
    </main>
  );
}
