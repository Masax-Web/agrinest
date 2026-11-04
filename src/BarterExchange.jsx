import { useMemo, useState } from 'react';
import './BarterExchange.css';

const exampleOffers = [
  {
    id: 'example-maize-manure',
    kind: 'Goods for Goods',
    owner: 'Example farmer · Arusha',
    trust: 'Example profile',
    offers: '100 kg maize',
    wants: '200 kg manure',
    offerIcon: 'grass',
    wantsIcon: 'compost',
    disclosure: 'Illustrative offer — not a real listing',
  },
  {
    id: 'example-plough-harvest',
    kind: 'Services for Services',
    owner: 'Example farmer · Moshi',
    trust: 'Example profile',
    offers: 'Ploughing · 2 acres',
    wants: 'Harvesting help',
    offerIcon: 'agriculture',
    wantsIcon: 'shopping_basket',
    disclosure: 'Illustrative offer — not a real listing',
  },
];

const barterKinds = ['All', 'Goods for Goods', 'Services for Services', 'Mixed'];
const newRecordId = () => globalThis.crypto?.randomUUID?.() || `barter-${Date.now()}`;

function offerKind(offer) {
  if (offer.kind) return offer.kind;
  const offersService = /plough|labor|labour|harvest|service/i.test(offer.offers || '');
  const wantsService = /plough|labor|labour|harvest|service/i.test(offer.wants || '');
  return offersService && wantsService ? 'Services for Services' : offersService || wantsService ? 'Mixed' : 'Goods for Goods';
}

export default function BarterExchange({ profile, user, records, onRecordsChange, onBack }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [offerDraft, setOfferDraft] = useState({ offers: '', wants: '', kind: 'Goods for Goods', location: '' });
  const [negotiation, setNegotiation] = useState(null);
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requests = Array.isArray(records?.requests) ? records.requests : [];
  const ownOffers = requests.filter((record) => record.module === 'barter' && record.recordType === 'offer');
  const savedTradeNotes = requests.filter((record) => record.module === 'barter' && record.recordType !== 'offer');
  const offers = useMemo(() => [
    ...ownOffers.map((offer) => ({
      id: offer.id,
      kind: offer.kind || offerKind(offer),
      owner: `${profile?.name || user?.name || 'You'} · ${offer.location || profile?.region || 'Location not added'}`,
      trust: 'Your saved offer',
      offers: offer.offers,
      wants: offer.wants,
      offerIcon: /plough|labor|labour|harvest|service/i.test(offer.offers || '') ? 'agriculture' : 'grass',
      wantsIcon: /plough|labor|labour|harvest|service/i.test(offer.wants || '') ? 'agriculture' : 'compost',
      disclosure: 'Saved to your farmer records',
      isOwn: true,
    })),
    ...exampleOffers,
  ], [ownOffers, profile?.name, profile?.region, user?.name]);
  const visibleOffers = offers.filter((offer) => (
    (filter === 'All' || offer.kind === filter)
    && `${offer.owner} ${offer.offers} ${offer.wants} ${offer.kind}`.toLowerCase().includes(search.trim().toLowerCase())
  ));

  const saveBarterRecord = (record) => {
    if (!user?.user_id && !user?.id) {
      setNotice('Sign in to save barter offers and trade follow-ups to your farmer records.');
      return false;
    }
    if (!onRecordsChange) {
      setNotice('Barter records are unavailable right now. Please try again later.');
      return false;
    }
    try {
      onRecordsChange('requests', [...requests, {
        id: newRecordId(),
        module: 'barter',
        date: new Date().toISOString().slice(0, 10),
        status: 'Saved locally · not shared',
        ...record,
      }]);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? `Could not save your barter record: ${error.message}` : 'Could not save your barter record.');
      return false;
    }
  };

  const publishOffer = (event) => {
    event.preventDefault();
    const offersText = offerDraft.offers.trim();
    const wantsText = offerDraft.wants.trim();
    if (!offersText || !wantsText) return;
    setSubmitting(true);
    if (saveBarterRecord({
      recordType: 'offer',
      title: `Barter offer: ${offersText} for ${wantsText}`,
      offers: offersText,
      wants: wantsText,
      kind: offerDraft.kind,
      location: offerDraft.location.trim() || profile?.region || profile?.location || '',
      details: 'Saved to your farmer records only. This offer was not published or shared with other farmers.',
    })) {
      setOfferDraft({ offers: '', wants: '', kind: 'Goods for Goods', location: '' });
      setFormOpen(false);
      setNotice('Offer saved to your farmer records only. It has not been published or shared.');
    }
    setSubmitting(false);
  };

  const recordTradeIntent = (offer, action, message = '') => {
    const saved = saveBarterRecord({
      recordType: action === 'Negotiate' ? 'negotiation-note' : 'trade-interest',
      title: `${action}: ${offer.offers} ↔ ${offer.wants}`,
      offerId: offer.id,
      otherParty: offer.owner,
      details: [
        `${action} recorded as a private local follow-up only.`,
        `Offer: ${offer.offers}. Wants: ${offer.wants}.`,
        message ? `Your note: ${message}` : '',
        'No other farmer was contacted, no trade was accepted, and no goods or services were exchanged.',
      ].filter(Boolean).join(' '),
    });
    if (saved) {
      setNegotiation(null);
      setNegotiationMessage('');
      setNotice(`${action} saved privately. No message was sent and no trade was confirmed.`);
    }
  };

  return (
    <main className="barter-exchange">
      <header className="barter-heading">
        <div>
          <span className="barter-eyebrow">AGRI-NEST SOKO · FARMER-TO-FARMER</span>
          <h1>Barter Exchange <span>— Trade without cash</span></h1>
          <p>Offer what you have and find what you need. Agree on quantities, quality, and handover details directly before exchanging.</p>
        </div>
        <div className="barter-heading-actions">
          <button type="button" className="barter-back-button" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Marketplace</button>
          <button type="button" className="barter-create-button" onClick={() => setFormOpen((open) => !open)}><span className="material-symbols-outlined">add</span>{formOpen ? 'Close form' : 'Create offer'}</button>
        </div>
      </header>

      <div className="barter-disclosure" role="note"><span className="material-symbols-outlined">info</span><p>Example offers below are illustrative and are not real listings or verified farmer profiles. Offers and trade actions you create are saved in your farmer records only; they are not published, sent to another person, or confirmed as trades.</p></div>
      {notice && <div className="barter-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      {formOpen && <form className="barter-offer-form" onSubmit={publishOffer}>
        <div className="barter-form-heading"><span className="barter-eyebrow">PRIVATE FARMER RECORD</span><h2>Create a barter offer</h2><p>Save a draft of what you can offer and what you need.</p></div>
        <label>I can offer<input required maxLength={120} value={offerDraft.offers} onChange={(event) => setOfferDraft((current) => ({ ...current, offers: event.target.value }))} placeholder="e.g. 100 kg maize" /></label>
        <label>I am looking for<input required maxLength={120} value={offerDraft.wants} onChange={(event) => setOfferDraft((current) => ({ ...current, wants: event.target.value }))} placeholder="e.g. 200 kg manure" /></label>
        <label>Trade type<select value={offerDraft.kind} onChange={(event) => setOfferDraft((current) => ({ ...current, kind: event.target.value }))}>{barterKinds.slice(1).map((kind) => <option key={kind}>{kind}</option>)}</select></label>
        <label>Location (optional)<input maxLength={80} value={offerDraft.location} onChange={(event) => setOfferDraft((current) => ({ ...current, location: event.target.value }))} placeholder={profile?.region || 'Region or district'} /></label>
        <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save offer draft'}</button>
      </form>}

      <section className="barter-metrics" aria-label="Barter summary">
        <article><span className="material-symbols-outlined">storefront</span><small>Example offers shown</small><strong>{exampleOffers.length}</strong><em>Illustrative only</em></article>
        <article><span className="material-symbols-outlined">inventory_2</span><small>Your saved offers</small><strong>{ownOffers.length}</strong><em>Private farmer records</em></article>
        <article><span className="material-symbols-outlined">handshake</span><small>Trade confirmations</small><strong>Not tracked</strong><em>No exchange service connected</em></article>
        <article><span className="material-symbols-outlined">location_on</span><small>Nearby listings</small><strong>Unavailable</strong><em>No location search connected</em></article>
      </section>

      <div className="barter-layout">
        <section className="barter-market-column" aria-label="Barter offers">
          <div className="barter-filter-bar">
            <label className="barter-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What are you looking for? (e.g. manure)" aria-label="Search barter offers" /></label>
            <div className="barter-filter-chips" role="group" aria-label="Filter barter offers">{barterKinds.map((kind) => <button type="button" key={kind} className={filter === kind ? 'active' : ''} onClick={() => setFilter(kind)}>{kind}</button>)}</div>
          </div>

          <div className="barter-offer-grid">
            {visibleOffers.map((offer) => <article className="barter-offer-card" key={offer.id}>
              <div className="barter-offer-owner"><span className="barter-avatar">{offer.isOwn ? (profile?.name || user?.name || 'You').slice(0, 1).toUpperCase() : offer.owner.slice(0, 1)}</span><div><h2>{offer.owner}</h2><p><span className="material-symbols-outlined">verified_user</span>{offer.trust} <i>·</i> {offer.kind}</p></div><span className="barter-example-badge">{offer.isOwn ? 'Your offer' : 'Example'}</span></div>
              <p className="barter-offer-disclosure">{offer.disclosure}</p>
              <div className="barter-trade-items">
                <div><small>OFFERS</small><span className="barter-trade-icon goods"><span className="material-symbols-outlined">{offer.offerIcon}</span></span><strong>{offer.offers}</strong></div>
                <span className="material-symbols-outlined barter-exchange-icon">sync_alt</span>
                <div><small>WANTS</small><span className="barter-trade-icon needs"><span className="material-symbols-outlined">{offer.wantsIcon}</span></span><strong>{offer.wants}</strong></div>
              </div>
              <div className="barter-card-actions">
                <button type="button" disabled={offer.isOwn} title={offer.isOwn ? 'This is your saved offer.' : 'Saves private interest only; does not accept a trade.'} onClick={() => recordTradeIntent(offer, 'Trade interest')}>Save interest</button>
                <button type="button" onClick={() => { setNegotiation(offer); setNegotiationMessage(''); }}>Negotiate</button>
              </div>
            </article>)}
            {!visibleOffers.length && <div className="barter-empty"><span className="material-symbols-outlined">search_off</span><strong>No matching barter offers</strong><p>Try a different search or category, or save your own offer draft.</p></div>}
          </div>
        </section>

        <aside className="barter-sidebar">
          <section className="barter-panel">
            <h2><span className="material-symbols-outlined">pending_actions</span>Your saved trade follow-ups</h2>
            {savedTradeNotes.length ? <div className="barter-followups">{[...savedTradeNotes].reverse().map((note) => <article key={note.id}><strong>{note.title}</strong><p>{note.details}</p><small>Private note · not shared</small></article>)}</div> : <div className="barter-empty-followups"><span className="material-symbols-outlined">handshake</span><p>No trade follow-ups yet.</p><small>Use “Save interest” or “Negotiate” to add a private reminder.</small></div>}
          </section>
          <section className="barter-guidelines">
            <h2><span className="material-symbols-outlined">gavel</span>Barter guidelines</h2>
            <ul><li><span className="material-symbols-outlined">check_circle</span>Inspect goods and agree on quality before exchanging.</li><li><span className="material-symbols-outlined">check_circle</span>Agree on quantities and a safe handover location.</li><li><span className="material-symbols-outlined">check_circle</span>Keep a written record of what both parties agreed.</li></ul>
          </section>
          <section className="barter-panel barter-parity-panel">
            <h2><span className="material-symbols-outlined">balance</span>Trade planning</h2>
            <p>There are no verified exchange rates or parity values available.</p>
            <div><span>Compare condition, quantity, and local value</span><span className="material-symbols-outlined">compare_arrows</span><span>Agree directly before handover</span></div>
          </section>
        </aside>
      </div>

      {negotiation && <div className="barter-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNegotiation(null); }}>
        <section className="barter-dialog" role="dialog" aria-modal="true" aria-labelledby="barter-dialog-title">
          <header><div><span className="barter-eyebrow">PRIVATE FOLLOW-UP NOTE</span><h2 id="barter-dialog-title">Negotiate trade terms</h2></div><button type="button" aria-label="Close dialog" onClick={() => setNegotiation(null)}><span className="material-symbols-outlined">close</span></button></header>
          <p><strong>Offer:</strong> {negotiation.offers}<br /><strong>Looking for:</strong> {negotiation.wants}</p>
          <label>Your proposed terms or reminder<textarea maxLength={500} value={negotiationMessage} onChange={(event) => setNegotiationMessage(event.target.value)} placeholder="For example: confirm quality, quantity, and handover place." /></label>
          <p className="barter-dialog-disclosure">This saves a note in your farmer records. It will not be sent to the example farmer or create an agreement.</p>
          <button type="button" onClick={() => recordTradeIntent(negotiation, 'Negotiate', negotiationMessage.trim())}>Save private note</button>
        </section>
      </div>}
    </main>
  );
}
