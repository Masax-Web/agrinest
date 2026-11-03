import { useEffect, useMemo, useState } from 'react';
import api from './lib/api';

const feedOptions = ['Layer Mash', 'Maize Bran', 'Broiler Starter', 'Dairy Meal'];

function defaultDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function formatTzs(value) {
  return `TZS ${Number(value || 0).toLocaleString('en-TZ')}`;
}

function formatDate(value) {
  if (!value) return 'Date not set';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date not set'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProcurementWorkspace({ user, profile }) {
  const [rfqs, setRfqs] = useState([]);
  const [selectedRfqId, setSelectedRfqId] = useState('');
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [feedType, setFeedType] = useState(feedOptions[0]);
  const [customFeedType, setCustomFeedType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDate);
  const [specifications, setSpecifications] = useState('');
  const [bidDraft, setBidDraft] = useState({ price_per_bag: '', delivery_fee: '0', notes: '' });

  const selectedRfq = rfqs.find((rfq) => rfq.rfq_id === selectedRfqId) || null;
  const isOwner = selectedRfq?.buyer_id === user?.user_id;
  const myBid = bids.find((bid) => bid.supplier_id === user?.user_id) || null;
  const activeRfqs = useMemo(() => rfqs.filter((rfq) => rfq.status === 'open'), [rfqs]);

  const loadRfqs = async ({ selectFirst = false } = {}) => {
    setError('');
    const result = await api.getFeedRfqs();
    const items = Array.isArray(result.items) ? result.items : [];
    setRfqs(items);
    if (selectFirst) {
      const currentSelectionExists = items.some((rfq) => rfq.rfq_id === selectedRfqId);
      if (!currentSelectionExists) setSelectedRfqId(items[0]?.rfq_id || '');
    }
    return items;
  };

  useEffect(() => {
    let active = true;
    api.getFeedRfqs()
      .then((result) => {
        if (!active) return;
        const items = Array.isArray(result.items) ? result.items : [];
        setRfqs(items);
        setSelectedRfqId(items[0]?.rfq_id || '');
      })
      .catch((loadError) => {
        if (active) setError(`Could not load procurement requests: ${loadError.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedRfq || !isOwner) {
      setBids([]);
      return;
    }
    let active = true;
    setBidsLoading(true);
    api.getFeedRfqBids(selectedRfq.rfq_id)
      .then((result) => {
        if (active) setBids(Array.isArray(result.items) ? result.items : []);
      })
      .catch((loadError) => {
        if (active) setError(`Could not load supplier bids: ${loadError.message}`);
      })
      .finally(() => {
        if (active) setBidsLoading(false);
      });
    return () => { active = false; };
  }, [selectedRfq?.rfq_id, selectedRfq?.status, isOwner]);

  const refreshAfterAction = async (message) => {
    try {
      const items = await loadRfqs();
      if (!items.some((rfq) => rfq.rfq_id === selectedRfqId)) setSelectedRfqId(items[0]?.rfq_id || '');
      setNotice(message);
    } catch (loadError) {
      setError(`Your change was saved, but the latest requests could not be loaded: ${loadError.message}`);
    }
  };

  const createRfq = async (event) => {
    event.preventDefault();
    const selectedFeed = feedType === 'Other' ? customFeedType.trim() : feedType;
    const quantityBags = Number(quantity);
    if (!selectedFeed || !Number.isSafeInteger(quantityBags) || quantityBags < 1 || !deliveryDate) {
      setError('Choose a feed type, enter a whole-number bag quantity, and set a delivery date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const rfq = await api.createFeedRfq({
        feed_type: selectedFeed,
        quantity_bags: quantityBags,
        required_delivery_date: deliveryDate,
        specifications,
      });
      setQuantity('');
      setSpecifications('');
      setSelectedRfqId(rfq.rfq_id);
      await refreshAfterAction('Request published. Signed-in suppliers can now submit quotes.');
    } catch (saveError) {
      setError(`Request could not be published: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const submitBid = async (event) => {
    event.preventDefault();
    if (!selectedRfq) return;
    const price = Number(bidDraft.price_per_bag);
    const deliveryFee = Number(bidDraft.delivery_fee);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(deliveryFee) || deliveryFee < 0) {
      setError('Enter a price above zero and a delivery fee of zero or more.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.submitFeedRfqBid(selectedRfq.rfq_id, {
        price_per_bag: price,
        delivery_fee: deliveryFee,
        notes: bidDraft.notes,
      });
      setNotice('Your quote was sent to the buyer.');
      const items = await loadRfqs();
      const refreshedRfq = items.find((rfq) => rfq.rfq_id === selectedRfq.rfq_id);
      if (refreshedRfq) setSelectedRfqId(refreshedRfq.rfq_id);
    } catch (saveError) {
      setError(`Quote could not be submitted: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const acceptBid = async (bid) => {
    if (!selectedRfq || !window.confirm(`Accept ${bid.supplier_name || 'this supplier'}'s quote and award the request?`)) return;
    setSaving(true);
    setError('');
    try {
      await api.acceptFeedRfqBid(selectedRfq.rfq_id, bid.bid_id);
      await refreshAfterAction('Quote accepted. The request is now marked awarded.');
    } catch (actionError) {
      setError(`Quote could not be accepted: ${actionError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const closeRfq = async () => {
    if (!selectedRfq || !window.confirm('Close this request? Suppliers will no longer be able to submit quotes.')) return;
    setSaving(true);
    setError('');
    try {
      await api.closeFeedRfq(selectedRfq.rfq_id);
      await refreshAfterAction('Request closed.');
    } catch (actionError) {
      setError(`Request could not be closed: ${actionError.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="farmer-workspace procurement-page" aria-label="Feed procurement">
      <header className="procurement-heading">
        <div>
          <span className="farmer-workspace-eyebrow">SOKO · BULK INPUTS</span>
          <h1>Feed Procurement Hub</h1>
          <p>Request livestock feed quotes and compare supplier offers for {profile?.name || user?.name || 'your farm'}.</p>
        </div>
        <button type="button" className="procurement-refresh" onClick={() => loadRfqs({ selectFirst: true }).catch((loadError) => setError(`Refresh failed: ${loadError.message}`))} disabled={loading || saving}>
          <span className="material-symbols-outlined">refresh</span>Refresh requests
        </button>
      </header>

      {error && <div className="farmer-workspace-notice procurement-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><span className="material-symbols-outlined">close</span></button></div>}
      {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <section className="procurement-summary" aria-label="Procurement summary">
        <article><span>OPEN REQUESTS</span><strong>{activeRfqs.length}</strong><small>Visible to signed-in suppliers</small></article>
        <article><span>YOUR REQUESTS</span><strong>{rfqs.filter((rfq) => rfq.buyer_id === user?.user_id).length}</strong><small>Requests on your account</small></article>
        <article><span>QUOTES TO REVIEW</span><strong>{rfqs.filter((rfq) => rfq.buyer_id === user?.user_id && rfq.status === 'open').reduce((total, rfq) => total + Number(rfq.bid_count || 0), 0)}</strong><small>Actual supplier submissions</small></article>
      </section>

      <div className="procurement-layout">
        <div className="procurement-left-column">
          <section className="procurement-panel">
            <div className="procurement-section-heading">
              <div><h2><span className="material-symbols-outlined">pending_actions</span>Active RFQs</h2><p>Open feed requests from your account and other buyers.</p></div>
              <span className="procurement-live-tag">Shared marketplace</span>
            </div>
            {loading ? <div className="procurement-empty">Loading requests…</div> : activeRfqs.length ? (
              <div className="procurement-rfq-grid">
                {activeRfqs.map((rfq) => (
                  <button type="button" key={rfq.rfq_id} className={`procurement-rfq-card${rfq.rfq_id === selectedRfqId ? ' is-selected' : ''}`} onClick={() => setSelectedRfqId(rfq.rfq_id)}>
                    <span className="procurement-rfq-card-top"><span className="procurement-feed-chip">{rfq.feed_type}</span><span className="procurement-rfq-status">Open</span></span>
                    <span className="procurement-rfq-meta"><span>Quantity</span><strong>{Number(rfq.quantity_bags).toLocaleString()} bags (50kg)</strong></span>
                    <span className="procurement-rfq-meta"><span>Deliver by</span><strong>{formatDate(rfq.required_delivery_date)}</strong></span>
                    <span className="procurement-rfq-card-foot"><span>{rfq.buyer_id === user?.user_id ? 'Your request' : `Requested by ${rfq.buyer_name || 'buyer'}`}</span><strong>{rfq.bid_count || 0} quote{Number(rfq.bid_count) === 1 ? '' : 's'}</strong></span>
                  </button>
                ))}
              </div>
            ) : <div className="procurement-empty"><span className="material-symbols-outlined">inventory_2</span><strong>No open feed requests</strong><p>Create a request for quotes, or check back when another buyer publishes one.</p></div>}
          </section>

          <section className="procurement-panel procurement-detail-panel">
            <div className="procurement-section-heading">
              <div><h2>{selectedRfq ? `${isOwner ? 'Quotes received' : 'Request details'}: ${selectedRfq.feed_type}` : 'Select a request'}</h2><p>{selectedRfq ? `${Number(selectedRfq.quantity_bags).toLocaleString()} bags · delivery by ${formatDate(selectedRfq.required_delivery_date)}` : 'Choose an open RFQ to see its details.'}</p></div>
              {selectedRfq?.status === 'open' && isOwner && <button type="button" className="procurement-secondary-button" onClick={closeRfq} disabled={saving}>Close RFQ</button>}
            </div>
            {selectedRfq ? <>
              {selectedRfq.specifications && <p className="procurement-specifications">{selectedRfq.specifications}</p>}
              {isOwner ? (
                bidsLoading ? <div className="procurement-empty">Loading supplier quotes…</div> : bids.length ? (
                  <div className="procurement-table-wrap"><table className="procurement-table">
                    <thead><tr><th>Supplier account</th><th>Price / bag</th><th>Delivery fee</th><th>Status</th>{selectedRfq.status === 'open' && <th>Action</th>}</tr></thead>
                    <tbody>{bids.map((bid) => <tr key={bid.bid_id}>
                      <td><strong>{bid.supplier_name || 'Supplier account'}</strong>{bid.notes && <small>{bid.notes}</small>}</td>
                      <td>{formatTzs(bid.price_per_bag)}</td><td>{Number(bid.delivery_fee) === 0 ? 'Free delivery' : formatTzs(bid.delivery_fee)}</td>
                      <td><span className={`procurement-status is-${bid.status}`}>{bid.status === 'not_selected' ? 'Not selected' : bid.status}</span></td>
                      {selectedRfq.status === 'open' && <td><button type="button" className="procurement-accept-button" onClick={() => acceptBid(bid)} disabled={saving || bid.status !== 'submitted'}>{bid.status === 'submitted' ? 'Accept quote' : '—'}</button></td>}
                    </tr>)}</tbody>
                  </table></div>
                ) : <div className="procurement-empty compact">No supplier quotes yet. Quotes appear here as suppliers respond.</div>
              ) : selectedRfq.status === 'open' ? (
                <form className="procurement-bid-form" onSubmit={submitBid}>
                  <h3>Submit your quote</h3>
                  {myBid && <p className="procurement-own-bid-note">You have already quoted this request. Submitting again updates your quote.</p>}
                  <div className="procurement-form-grid">
                    <label>Price per 50kg bag (TZS)<input type="number" min="0.01" step="0.01" required value={bidDraft.price_per_bag} onChange={(event) => setBidDraft((current) => ({ ...current, price_per_bag: event.target.value }))} /></label>
                    <label>Delivery fee (TZS)<input type="number" min="0" step="0.01" value={bidDraft.delivery_fee} onChange={(event) => setBidDraft((current) => ({ ...current, delivery_fee: event.target.value }))} /></label>
                    <label className="procurement-full-row">Delivery and product notes<textarea maxLength="2000" rows="3" value={bidDraft.notes} onChange={(event) => setBidDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Availability, delivery timing, quality or packaging…" /></label>
                  </div>
                  <button type="submit" className="procurement-primary-button" disabled={saving}>{saving ? 'Submitting…' : myBid ? 'Update quote' : 'Submit quote'}</button>
                </form>
              ) : <div className="procurement-empty compact">This request is {selectedRfq.status}. Quotes are no longer being accepted.</div>}
            </> : !loading && <div className="procurement-empty compact">Select an active request above, or create one using the form.</div>}
          </section>
          <p className="procurement-disclaimer">Supplier names come from AGRI-NEST accounts. The marketplace does not currently verify supplier credentials, ratings, or delivery claims. Quotes are not payments or purchase contracts.</p>
        </div>

        <aside className="procurement-panel procurement-create-panel">
          <div className="procurement-create-heading"><span className="material-symbols-outlined">add_task</span><h2>Create New RFQ</h2></div>
          <form onSubmit={createRfq}>
            <label>Feed type<select value={feedType} onChange={(event) => setFeedType(event.target.value)}>{feedOptions.map((option) => <option key={option}>{option}</option>)}<option>Other</option></select></label>
            {feedType === 'Other' && <label>Feed name<input required maxLength="120" value={customFeedType} onChange={(event) => setCustomFeedType(event.target.value)} placeholder="Specify livestock feed" /></label>}
            <label>Quantity (50kg bags)<input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 500" /></label>
            <label>Required delivery date<input required type="date" min={new Date().toISOString().slice(0, 10)} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
            <label>Additional specifications<textarea maxLength="2000" rows="4" value={specifications} onChange={(event) => setSpecifications(event.target.value)} placeholder="Specify protein %, packaging, delivery location or other requirements." /></label>
            <div className="procurement-tip"><strong><span className="material-symbols-outlined">info</span>Clear requests help</strong><p>Include a delivery location, feed quality, and packaging requirements so suppliers can quote accurately.</p></div>
            <button type="submit" className="procurement-primary-button" disabled={saving}>{saving ? 'Publishing…' : 'Publish request for quotes'}</button>
          </form>
        </aside>
      </div>
    </main>
  );
}

export default ProcurementWorkspace;
