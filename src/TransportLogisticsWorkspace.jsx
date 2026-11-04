import { useEffect, useState } from 'react';
import { api } from './lib/api';
import TransportRouteMap from './TransportRouteMap';
import './TransportLogisticsWorkspace.css';

const money = (value) => `TSh ${Number(value || 0).toLocaleString('en-TZ')}`;

async function geocodeLocation(value) {
  const params = new URLSearchParams({
    name: value,
    count: '1',
    language: 'en',
    format: 'json',
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!response.ok) throw new Error(`Location lookup failed (${response.status}).`);
  const payload = await response.json();
  const result = payload.results?.[0];
  if (!result || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) {
    throw new Error(`Could not find “${value}”. Try a nearby town or district.`);
  }
  return {
    coordinates: [Number(result.latitude), Number(result.longitude)],
    label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
  };
}

function requestStatusLabel(request) {
  if (request.status === 'assigned') return 'Quote accepted';
  if (request.status === 'completed') return 'Completed';
  if (request.status === 'cancelled') return 'Cancelled';
  return 'Awaiting quotes';
}

export default function TransportLogisticsWorkspace({ user, profile }) {
  const [pickup, setPickup] = useState(profile?.location || profile?.district || profile?.region || '');
  const [destination, setDestination] = useState('');
  const [cargo, setCargo] = useState('');
  const [weight, setWeight] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [details, setDetails] = useState('');
  const [route, setRoute] = useState({ pickup: null, destination: null });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [busyQuoteId, setBusyQuoteId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadRequests = async () => {
    setError('');
    try {
      const response = await api.getMyTransportRequests();
      setRequests(Array.isArray(response.items) ? response.items : []);
    } catch (requestError) {
      setError(requestError.message || 'Could not load your transport requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user?.user_id]);

  const showRoute = async () => {
    if (!pickup.trim() || !destination.trim()) {
      setError('Enter both a pickup location and destination to show the map.');
      return;
    }
    setMapping(true);
    setError('');
    try {
      const [pickupLocation, destinationLocation] = await Promise.all([
        geocodeLocation(pickup.trim()),
        geocodeLocation(destination.trim()),
      ]);
      setRoute({ pickup: pickupLocation.coordinates, destination: destinationLocation.coordinates });
      setNotice(`Map locations found: ${pickupLocation.label} → ${destinationLocation.label}.`);
    } catch (lookupError) {
      setRoute({ pickup: null, destination: null });
      setError(lookupError.message || 'Could not locate those places.');
    } finally {
      setMapping(false);
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await api.createTransportRequest({
        pickup: pickup.trim(),
        destination: destination.trim(),
        cargo: cargo.trim(),
        ...(weight ? { weight_kg: Number(weight) } : {}),
        ...(pickupDate ? { pickup_date: pickupDate } : {}),
        details: details.trim(),
      });
      const createdRequest = response.request || response;
      setRequests((current) => [createdRequest, ...current.filter((item) => item.request_id !== createdRequest.request_id)]);
      setCargo('');
      setWeight('');
      setPickupDate('');
      setDetails('');
      setNotice('Transport request posted. Transporters can now submit quotes for you to review.');
    } catch (requestError) {
      setError(requestError.message || 'Could not post the transport request.');
    } finally {
      setSubmitting(false);
    }
  };

  const decideQuote = async (quoteId, status) => {
    setBusyQuoteId(quoteId);
    setError('');
    setNotice('');
    try {
      await api.updateTransportQuote(quoteId, status);
      await loadRequests();
      setNotice(status === 'accepted'
        ? 'Quote accepted. The transport request is now assigned; confirm trip details directly with the carrier.'
        : 'Quote declined. The request remains open for other carrier quotes.');
    } catch (requestError) {
      setError(requestError.message || 'Could not accept this quote.');
    } finally {
      setBusyQuoteId('');
    }
  };

  return (
    <main className="transport-logistics">
      {notice && <div className="transport-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      {error && <div className="transport-workflow-error" role="alert">{error}</div>}

      <header className="transport-page-heading">
        <div><p>FARMER WORKSPACE · MARKET &amp; LOGISTICS</p><h1>Usafiri Transport</h1><span>Post a real transport request and compare carrier quotes.</span></div>
      </header>

      <div className="transport-demo-disclosure" role="note">
        <span className="material-symbols-outlined">info</span>
        <span>Requests and quotes are shared through AGRI-NEST. The map shows geocoded endpoints and a straight-line reference only—not a road route, live vehicle location, booking confirmation, or payment.</span>
      </div>

      <div className="transport-layout transport-workflow-layout">
        <section className="transport-main-column">
          <section className="transport-card transport-request-form-card">
            <header className="transport-card-heading"><div><span className="material-symbols-outlined">local_shipping</span><h2>Post a transport request</h2></div></header>
            <form className="transport-workflow-form" onSubmit={submitRequest}>
              <label>Pickup location<input required maxLength={160} value={pickup} onChange={(event) => { setPickup(event.target.value); setRoute({ pickup: null, destination: null }); }} placeholder="Farm, town, or district" /></label>
              <label>Destination<input required maxLength={160} value={destination} onChange={(event) => { setDestination(event.target.value); setRoute({ pickup: null, destination: null }); }} placeholder="Market, town, or district" /></label>
              <label>Cargo or produce<input required maxLength={120} value={cargo} onChange={(event) => setCargo(event.target.value)} placeholder="e.g. Tomatoes" /></label>
              <label>Estimated weight (kg)<input type="number" min="0.01" max="1000000" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Optional" /></label>
              <label>Pickup date<input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} /></label>
              <label className="transport-workflow-form-wide">Additional details<textarea maxLength={2000} rows="3" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Loading notes, vehicle needs, or handling requirements" /></label>
              <div className="transport-workflow-form-actions">
                <button type="button" className="transport-secondary-button" onClick={showRoute} disabled={mapping}>{mapping ? 'Finding locations…' : 'Show locations on map'}</button>
                <button type="submit" className="transport-post-job-button" disabled={submitting}>{submitting ? 'Posting…' : 'Post request'}</button>
              </div>
            </form>
          </section>

          <section className="transport-card transport-map-card">
            <header className="transport-card-heading"><div><span className="material-symbols-outlined">map</span><h2>Pickup and destination map</h2></div><span className="transport-demo-label">Not live tracking</span></header>
            <div className="transport-route-map-wrap"><TransportRouteMap pickup={route.pickup} destination={route.destination} /></div>
            <p className="transport-map-explanation">Dashed line is a direct-line reference between geocoded places. It is not a drivable route or vehicle tracking.</p>
          </section>
        </section>

        <aside className="transport-summary-column">
          <section className="transport-card transport-trips-card">
            <header><h2>My transport requests</h2><span>{requests.length}</span></header>
            {loading ? <div className="transport-empty"><strong>Loading requests…</strong></div> : requests.length ? (
              <div className="transport-trip-list">{requests.map((request) => <article key={request.request_id}>
                <div className="transport-trip-status">{requestStatusLabel(request)}</div>
                <div className="transport-trip-title"><strong>{request.cargo}</strong><small>{request.weight_kg ? `${Number(request.weight_kg).toLocaleString()} kg` : 'Weight not specified'}</small></div>
                <p>{request.pickup}<span className="material-symbols-outlined">east</span>{request.destination}</p>
                {request.pickup_date && <small>Pickup date: {String(request.pickup_date).slice(0, 10)}</small>}
                {request.details && <p className="transport-request-details">{request.details}</p>}
                {request.quotes?.length ? <div className="transport-quote-list"><strong>Carrier quotes</strong>{request.quotes.map((quote) => <article key={quote.quote_id}>
                  <div><strong>{quote.provider_name}</strong><span>{money(quote.amount)} · {quote.status}</span>{quote.details && <small>{quote.details}</small>}</div>
                  {quote.status === 'pending' && request.status === 'open' && <div className="transport-quote-actions">
                    <button type="button" disabled={busyQuoteId === quote.quote_id} onClick={() => decideQuote(quote.quote_id, 'accepted')}>{busyQuoteId === quote.quote_id ? 'Saving…' : 'Accept'}</button>
                    <button type="button" className="transport-quote-decline" disabled={busyQuoteId === quote.quote_id} onClick={() => decideQuote(quote.quote_id, 'declined')}>Decline</button>
                  </div>}
                </article>)}</div> : <p className="transport-request-empty-quotes">No carrier quotes yet.</p>}
              </article>)}</div>
            ) : <div className="transport-empty"><span className="material-symbols-outlined">local_shipping</span><strong>No requests yet</strong><p>Post a request and transporters can send quotes here.</p></div>}
            <p className="transport-confirm-disclaimer"><span className="material-symbols-outlined">info</span>Accepting a quote assigns the request in AGRI-NEST. Confirm service terms directly with the transporter.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
