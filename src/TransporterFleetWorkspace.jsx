import { useEffect, useState } from 'react';
import { api } from './lib/api';
import './TransporterWorkspaces.css';

const formatTzs = (amount) => `TSh ${Number(amount || 0).toLocaleString('en-TZ')}`;

const initialVehicles = [
  { id: 'demo-01', name: '5-ton refrigerated lorry', registration: 'SAMPLE-01', status: 'Example only' },
  { id: 'demo-02', name: '10-ton flatbed truck', registration: 'SAMPLE-02', status: 'Example only' },
  { id: 'demo-03', name: '3-ton cargo truck', registration: 'SAMPLE-03', status: 'Example only' },
];

export default function TransporterFleetWorkspace({ user }) {
  const [requests, setRequests] = useState([]);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [loading, setLoading] = useState(true);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleName, setVehicleName] = useState('');
  const [registration, setRegistration] = useState('');
  const [quoteRequest, setQuoteRequest] = useState(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDetails, setQuoteDetails] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadRequests = async () => {
    setError('');
    try {
      const response = await api.getOpenTransportRequests();
      setRequests(Array.isArray(response.items) ? response.items : []);
    } catch (requestError) {
      setError(requestError.message || 'Could not load open transport requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user?.user_id]);

  const submitQuote = async (event) => {
    event.preventDefault();
    if (!quoteRequest) return;
    setSubmittingQuote(true);
    setError('');
    setNotice('');
    try {
      await api.submitTransportQuote(quoteRequest.request_id, {
        amount: Number(quoteAmount),
        details: quoteDetails.trim(),
      });
      setRequests((current) => current.map((request) => request.request_id === quoteRequest.request_id
        ? { ...request, has_quoted: true, quotes_count: Number(request.quotes_count || 0) + 1 }
        : request));
      setQuoteRequest(null);
      setQuoteAmount('');
      setQuoteDetails('');
      setNotice('Quote submitted to the farmer. The request owner will review it in their transport workspace.');
    } catch (requestError) {
      setError(requestError.message || 'Could not submit the quote.');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const addVehicle = (event) => {
    event.preventDefault();
    const name = vehicleName.trim();
    const plate = registration.trim();
    if (!name || !plate) {
      setError('Enter both a vehicle type and registration.');
      return;
    }
    setVehicles((current) => [...current, { id: `local-${Date.now()}`, name, registration: plate, status: 'Not verified' }]);
    setVehicleName('');
    setRegistration('');
    setShowVehicleForm(false);
    setNotice('Vehicle details added to this view only; they are not yet published or verified.');
  };

  return (
    <main className="transporter-workspace">
      <header className="transporter-workspace-heading">
        <div><p className="transporter-eyebrow">TRANSPORTER WORKSPACE</p><h2>Fleet management</h2><p>Review farm requests and send a quote directly to the requester.</p></div>
        <button type="button" className="transporter-primary-button" onClick={() => setShowVehicleForm((open) => !open)}><span className="material-symbols-outlined">add</span>{showVehicleForm ? 'Close form' : 'Add vehicle'}</button>
      </header>

      <div className="transporter-data-note" role="note"><span className="material-symbols-outlined">info</span><span>Open transport requests and submitted quotes are shared through AGRI-NEST. Vehicle details below are a local draft only—not a verified or published fleet record. Accepting a quote does not create live tracking or process payment.</span></div>
      {notice && <div className="transporter-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      {error && <div className="transporter-workspace-error" role="alert">{error}</div>}

      {showVehicleForm && <form className="transporter-vehicle-form" onSubmit={addVehicle}>
        <label>Vehicle type<input required maxLength={80} value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} placeholder="e.g. 5-ton lorry" /></label>
        <label>Registration<input required maxLength={24} value={registration} onChange={(event) => setRegistration(event.target.value)} placeholder="Registration number" /></label>
        <button type="submit" className="transporter-primary-button">Add local draft</button>
      </form>}

      <section className="transporter-fleet-metrics" aria-label="Transport marketplace status">
        <article><span className="material-symbols-outlined">local_shipping</span><small>Vehicles in this view</small><strong>{vehicles.length}</strong><em>Not published</em></article>
        <article><span className="material-symbols-outlined">work_history</span><small>Open farm requests</small><strong>{loading ? '…' : requests.length}</strong><em>Shared marketplace</em></article>
        <article><span className="material-symbols-outlined">payments</span><small>Weekly earnings</small><strong>Not connected</strong><em>No payment data</em></article>
        <article><span className="material-symbols-outlined">location_on</span><small>Live trip tracking</small><strong>Not connected</strong><em>No GPS feed</em></article>
      </section>

      <div className="transporter-fleet-layout transporter-marketplace-layout">
        <section className="transporter-panel transporter-request-panel">
          <div className="transporter-panel-heading"><div><p className="transporter-eyebrow">SHARED MARKETPLACE</p><h3>Open transport requests</h3></div><button type="button" className="transporter-refresh-button" onClick={loadRequests} disabled={loading}><span className="material-symbols-outlined">refresh</span>Refresh</button></div>
          {loading ? <div className="transporter-unavailable"><span className="material-symbols-outlined">sync</span><div><strong>Loading open requests…</strong></div></div> : requests.length ? (
            <div className="transporter-request-list">{requests.map((request) => <article className="transporter-request-card" key={request.request_id}>
              <div className="transporter-request-icon"><span className="material-symbols-outlined">agriculture</span></div>
              <div className="transporter-request-copy"><div className="transporter-request-title"><h4>{request.cargo}</h4><span>{Number(request.quotes_count || 0)} quotes</span></div>
                <p>{request.weight_kg ? `${Number(request.weight_kg).toLocaleString()} kg` : 'Weight not specified'}{request.pickup_date ? ` · Pickup ${String(request.pickup_date).slice(0, 10)}` : ''}</p>
                <p><span className="material-symbols-outlined">route</span>{request.pickup} → {request.destination}</p>
                {request.details && <small>{request.details}</small>}
                <small>Requested by {request.customer_name}</small>
              </div>
              <div className="transporter-request-action">
                <button type="button" disabled={request.has_quoted} onClick={() => { setQuoteRequest(request); setQuoteAmount(''); setQuoteDetails(''); }}>{request.has_quoted ? 'Quote submitted' : 'Send quote'}</button>
              </div>
            </article>)}</div>
          ) : <div className="transporter-unavailable"><span className="material-symbols-outlined">inbox</span><div><strong>No open transport requests</strong><small>New farmer requests will appear here when posted.</small></div></div>}
        </section>

        <aside className="transporter-fleet-side">
          <section className="transporter-panel">
            <div className="transporter-panel-heading"><div><p className="transporter-eyebrow">LOCAL DRAFTS ONLY</p><h3>Fleet notes</h3></div><span className="material-symbols-outlined">inventory_2</span></div>
            <div className="transporter-vehicle-drafts">{vehicles.map((vehicle) => <article key={vehicle.id}><span className="material-symbols-outlined">local_shipping</span><div><strong>{vehicle.name}</strong><small>{vehicle.registration} · {vehicle.status}</small></div></article>)}</div>
          </section>
          <section className="transporter-panel">
            <div className="transporter-panel-heading"><div><p className="transporter-eyebrow">PAYMENTS NOT CONNECTED</p><h3>Weekly earnings</h3></div><span className="material-symbols-outlined">payments</span></div>
            <div className="transporter-unavailable"><span className="material-symbols-outlined">info</span><div><strong>No earnings data available</strong><small>Quotes are not payment records. Payment and settlement need to be confirmed through the agreed service.</small></div></div>
          </section>
        </aside>
      </div>

      {quoteRequest && <div className="transporter-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submittingQuote) setQuoteRequest(null); }}>
        <section className="transporter-quote-dialog" role="dialog" aria-modal="true" aria-labelledby="transporter-quote-title">
          <header><div><p className="transporter-eyebrow">QUOTE TO {quoteRequest.customer_name}</p><h3 id="transporter-quote-title">{quoteRequest.pickup} → {quoteRequest.destination}</h3></div><button type="button" aria-label="Close quote form" onClick={() => setQuoteRequest(null)}><span className="material-symbols-outlined">close</span></button></header>
          <p>{quoteRequest.cargo}{quoteRequest.weight_kg ? ` · ${Number(quoteRequest.weight_kg).toLocaleString()} kg` : ''}</p>
          <form onSubmit={submitQuote}>
            <label>Quote amount (TSh)<input required type="number" min="0.01" max="1000000000" step="0.01" value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} /></label>
            <label>Details<textarea maxLength={1000} rows="3" value={quoteDetails} onChange={(event) => setQuoteDetails(event.target.value)} placeholder="Vehicle type, timing, included services, or conditions" /></label>
            <button type="submit" className="transporter-primary-button" disabled={submittingQuote}>{submittingQuote ? 'Submitting…' : 'Submit quote'}</button>
          </form>
        </section>
      </div>}
    </main>
  );
}
