import { useEffect, useMemo, useRef, useState } from 'react';
import api from './lib/api';
import BarterExchange from './BarterExchange';
import { resizeImageForUpload } from './lib/image-uploads';

const listingTypes = ['All listings', 'Livestock', 'Animal products', 'Farm inputs'];
const formListingTypes = listingTypes.slice(1);

const formatTzs = (value) => `TZS ${Number(value || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;

function listingType(listing) {
  const category = String(listing.category || '').trim().toLowerCase();
  if (category === 'livestock') return 'Livestock';
  if (category === 'animal products') return 'Animal products';
  if (category === 'farm inputs') return 'Farm inputs';
  if (/feed|chick|veterinary|vet supplies|equipment|grain|seed|fertili[sz]er|tool/.test(category)) return 'Farm inputs';
  const searchable = `${listing.name || ''} ${listing.crop_type || ''} ${listing.description || ''} ${category}`.toLowerCase();
  if (/\b(milk|egg|manure|honey|meat|wool|leather|cheese)\b/.test(searchable)) return 'Animal products';
  if (/\b(cattle|cow|cows|bull|bulls|heifer|heifers|goat|goats|sheep|pig|pigs|poultry|chicken|chickens|duck|ducks|livestock|animal|animals)\b/.test(searchable)) return 'Livestock';
  return 'Farm inputs';
}

function safeImageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string' && value.length <= 1_400_000
    && /^data:image\/(?:webp|jpeg|png);base64,[a-z0-9+/]+=*$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function fromListing(listing) {
  return {
    id: String(listing.listing_id || ''),
    name: listing.name || listing.crop_type || 'Farm product',
    type: listingType(listing),
    description: listing.description || '',
    price: Number(listing.price || 0),
    quantity: Number(listing.quantity || 0),
    unit: listing.unit || 'unit',
    image: safeImageUrl(listing.image_url),
    seller: listing.seller_name || 'AGRI-NEST seller',
    sellerId: listing.farmer_id || '',
    region: listing.region || '',
    createdAt: listing.created_at || '',
  };
}

function activityLabel(activity) {
  const details = activity.details || {};
  if (activity.event_type === 'listing_created') return `New listing: ${details.name || 'Farm product'}${details.region ? ` · ${details.region}` : ''}`;
  if (activity.event_type === 'cart_item_added') return `A shopper added ${details.product_name || 'a product'} to their cart`;
  if (activity.event_type === 'order_placed') return `An order request was placed for ${details.item_count || 0} items · ${formatTzs(details.total_amount)}`;
  return 'Marketplace updated';
}

function downloadRegionalReport(products, region) {
  const regionalProducts = region
    ? products.filter((product) => product.region.trim().toLowerCase() === region.trim().toLowerCase())
    : products;
  const rows = [
    ['Listing', 'Type', 'Seller', 'Region', 'Price (TZS)', 'Available quantity', 'Unit'],
    ...regionalProducts.map((product) => [product.name, product.type, product.seller, product.region, product.price, product.quantity, product.unit]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `agrinest-market-${String(region || 'all-regions').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ListingImage({ product }) {
  return product.image
    ? <img src={product.image} alt={product.name} loading="lazy" />
    : <div className="soko-listing-placeholder" aria-hidden="true"><span className="material-symbols-outlined">{product.type === 'Livestock' ? 'pets' : product.type === 'Animal products' ? 'egg_alt' : 'agriculture'}</span></div>;
}

export default function MarketplacePage({ profile, user, search = '', onTransport, records, onRecordsChange }) {
  const [selectedType, setSelectedType] = useState(listingTypes[0]);
  const [page, setPage] = useState('browse');
  const [cart, setCart] = useState([]);
  const [notice, setNotice] = useState('');
  const [listingProducts, setListingProducts] = useState(null);
  const [activities, setActivities] = useState([]);
  const [listingLoadFailed, setListingLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [isListingFormOpen, setIsListingFormOpen] = useState(false);
  const [isPublishingListing, setIsPublishingListing] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [listingImageName, setListingImageName] = useState('');
  const [listingImageError, setListingImageError] = useState('');
  const [isProcessingListingImage, setIsProcessingListingImage] = useState(false);
  const [listingDraft, setListingDraft] = useState({
    name: '', category: 'Livestock', description: '', price: '', quantity: '',
    unit: '', region: profile.region || profile.location || '', imageUrl: '',
  });
  const lastActivityId = useRef(0);
  const userId = user?.user_id || user?.id || '';
  const profileName = profile.name || user?.name || '';
  const region = profile.region || profile.district || profile.location || '';

  useEffect(() => {
    let isCurrent = true;
    let unsubscribe = () => {};

    Promise.allSettled([api.getListings(), api.getMarketplaceActivity()]).then(([listingResponse, activityResponse]) => {
      if (!isCurrent) return;
      const activityResult = activityResponse.status === 'fulfilled' ? activityResponse.value : { items: [] };
      if (listingResponse.status === 'fulfilled') {
        const liveListings = Array.isArray(listingResponse.value.items) ? listingResponse.value.items.map(fromListing) : [];
        setListingProducts(liveListings);
        setListingLoadFailed(false);
      } else {
        setListingProducts(null);
        setListingLoadFailed(true);
      }
      const recent = Array.isArray(activityResult.items) ? activityResult.items : [];
      setActivities(recent);
      lastActivityId.current = Math.max(0, ...recent.map((activity) => Number(activity.activity_id) || 0));
      if (listingResponse.status === 'rejected' || activityResponse.status === 'rejected') {
        setNotice('Live marketplace data is temporarily unavailable. Please reconnect and try again.');
      }
      unsubscribe = api.subscribeMarketplaceActivity((activity) => {
        if (!isCurrent) return;
        lastActivityId.current = Math.max(lastActivityId.current, Number(activity.activity_id) || 0);
        setActivities((current) => [activity, ...current.filter((item) => item.activity_id !== activity.activity_id)].slice(0, 12));
        if (activity.event_type === 'listing_created') {
          api.getListings().then((result) => {
            if (isCurrent) setListingProducts((result.items || []).map(fromListing));
          }).catch(() => setNotice('A new listing arrived, but the marketplace could not refresh.'));
        }
      }, setIsLive, lastActivityId.current);
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [reloadToken]);

  const catalog = listingProducts || [];
  const myListings = useMemo(() => catalog.filter((product) => (
    Boolean(userId && product.sellerId === userId)
  )), [catalog, profileName, userId]);
  const benchmarkListings = page === 'mine' ? myListings : catalog;
  const localListings = region
    ? benchmarkListings.filter((product) => product.region.trim().toLowerCase() === region.trim().toLowerCase())
    : [];
  const averagePrice = (items) => items.length
    ? items.reduce((total, item) => total + item.price, 0) / items.length
    : null;
  const categoryBenchmarks = useMemo(() => formListingTypes.flatMap((type) => {
    const items = benchmarkListings.filter((product) => product.type === type);
    const units = [...new Set(items.map((item) => item.unit.trim().toLowerCase()).filter(Boolean))];
    return units.map((unit) => {
      const comparableItems = items.filter((item) => item.unit.trim().toLowerCase() === unit);
      const localItems = localListings.filter((product) => product.type === type && product.unit.trim().toLowerCase() === unit);
      const localAverage = averagePrice(localItems);
      const marketAverage = averagePrice(comparableItems);
      return {
        type,
        unit,
        count: comparableItems.length,
        localCount: localItems.length,
        localAverage,
        marketAverage,
        difference: localAverage !== null && marketAverage ? ((localAverage - marketAverage) / marketAverage) * 100 : null,
      };
    });
  }), [benchmarkListings, localListings]);
  const visibleBenchmarks = categoryBenchmarks.filter((benchmark) => (
    selectedType === listingTypes[0] || benchmark.type === selectedType
  ));
  const visibleProducts = useMemo(() => {
    const source = page === 'mine' ? myListings : catalog;
    const query = search.trim().toLowerCase();
    return source.filter((product) => {
      const matchesType = selectedType === listingTypes[0] || product.type === selectedType;
      const searchable = `${product.name} ${product.description} ${product.seller} ${product.region} ${product.type}`.toLowerCase();
      return matchesType && searchable.includes(query);
    });
  }, [catalog, myListings, page, search, selectedType]);

  const addToCart = (product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (product.quantity <= 0 || (existing && existing.quantity >= product.quantity)) {
      setNotice(`Only ${product.quantity.toLocaleString()} ${product.unit} are listed as available for ${product.name}.`);
      return;
    }
    setCart((current) => {
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { product, quantity: 1 }];
    });
    setNotice(`${product.name} added to your order request.`);
    api.createMarketplaceActivity({
      event_type: 'cart_item_added',
      details: { product_name: product.name, category: product.type, region: region || '' },
    }).catch(() => setIsLive(false));
  };

  const changeQuantity = (productId, amount) => {
    const item = cart.find((entry) => entry.product.id === productId);
    if (amount > 0 && item && item.quantity >= item.product.quantity) {
      setNotice(`Only ${item.product.quantity.toLocaleString()} ${item.product.unit} are listed as available for ${item.product.name}.`);
      return;
    }
    setCart((current) => current
      .map((entry) => entry.product.id === productId ? { ...entry, quantity: Math.min(entry.product.quantity, entry.quantity + amount) } : entry)
      .filter((entry) => entry.quantity > 0));
  };

  const publishListing = async (event) => {
    event.preventDefault();
    setIsPublishingListing(true);
    try {
      const result = await api.createListing({
        crop_type: listingDraft.name.trim(),
        name: listingDraft.name.trim(),
        category: listingDraft.category,
        description: listingDraft.description.trim(),
        price: Number(listingDraft.price),
        quantity: Number(listingDraft.quantity),
        unit: listingDraft.unit.trim(),
        image_url: listingDraft.imageUrl.trim() || null,
        seller_name: profileName,
        region: listingDraft.region.trim(),
      });
      const product = fromListing(result);
      setListingProducts((current) => [product, ...(current || []).filter((item) => item.id !== product.id)]);
      setIsListingFormOpen(false);
      setListingDraft({ name: '', category: 'Livestock', description: '', price: '', quantity: '', unit: '', region, imageUrl: '' });
      setListingImageName('');
      setListingImageError('');
      setNotice(`${product.name} is now listed in the marketplace.`);
    } catch (error) {
      console.error('Could not publish marketplace listing:', error);
      setNotice(error.message || 'Could not publish the listing. Check your connection and try again.');
    } finally {
      setIsPublishingListing(false);
    }
  };

  const placeOrder = async () => {
    setIsPlacingOrder(true);
    try {
      const order = await api.createMarketplaceOrder({
        buyer_name: profileName,
        items: cart.map(({ product, quantity }) => ({
          product_id: product.id,
          name: product.name,
          quantity,
          unit_price: product.price,
        })),
        total_amount: cart.reduce((total, item) => total + item.product.price * item.quantity, 0),
      });
      setCart([]);
      setNotice(`Order request ${String(order.order_id).slice(0, 8)} was sent. Confirm availability and delivery with the seller before payment.`);
    } catch {
      setNotice('Could not send your order request. Your order items are still in the cart.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const benchmarkCount = page === 'mine' ? myListings.length : catalog.length;

  if (page === 'barter') {
    return <BarterExchange profile={profile} user={user} records={records} onRecordsChange={onRecordsChange} onBack={() => setPage('browse')} />;
  }

  return (
    <main className="marketplace-page soko-marketplace">
      <header className="soko-heading">
        <div>
          <span className="soko-eyebrow">AGRI-NEST SOKO · TANZANIA</span>
          <h1>Farm &amp; livestock marketplace</h1>
          <p>Browse live seller listings, compare current offers, and send an order request.</p>
        </div>
        <button type="button" className="marketplace-sell-button" onClick={() => setIsListingFormOpen(true)}>
          <span className="material-symbols-outlined">add</span>Post a listing
        </button>
      </header>

      <section className="soko-stats" aria-label="Marketplace listing summary">
        <article><span>Listings loaded</span><strong>{listingProducts === null ? '—' : catalog.length.toLocaleString()}</strong><small>Newest records · up to 100</small></article>
        <article><span>Price comparisons</span><strong>{categoryBenchmarks.length.toLocaleString()}</strong><small>Comparable listing units</small></article>
        <article><span>Livestock</span><strong>{catalog.filter((product) => product.type === 'Livestock').length.toLocaleString()}</strong><small>Among newest 100 listings</small></article>
        <article><span>Animal products</span><strong>{catalog.filter((product) => product.type === 'Animal products').length.toLocaleString()}</strong><small>Among newest 100 listings</small></article>
      </section>

      <nav className="soko-tabs" aria-label="Marketplace sections">
        <button type="button" className={page === 'browse' ? 'active' : ''} onClick={() => setPage('browse')}><span className="material-symbols-outlined">storefront</span>Browse</button>
        <button type="button" className={page === 'mine' ? 'active' : ''} onClick={() => setPage('mine')}><span className="material-symbols-outlined">inventory_2</span>My listings <span className="soko-tab-count">{myListings.length}</span></button>
        <button type="button" className={page === 'benchmarks' ? 'active' : ''} onClick={() => setPage('benchmarks')}><span className="material-symbols-outlined">monitoring</span>Price benchmarks</button>
        <button type="button" className={page === 'barter' ? 'active' : ''} onClick={() => setPage('barter')}><span className="material-symbols-outlined">handshake</span>Barter exchange</button>
      </nav>

      {notice && <div className="marketplace-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <div className="soko-content-grid">
        <section className="soko-listings-column" aria-label="Marketplace listings">
          <div className="soko-filter-bar">
            <div className="soko-category-filters" role="group" aria-label="Filter listings">
              {listingTypes.map((type) => (
                <button type="button" key={type} className={selectedType === type ? 'active' : ''} onClick={() => setSelectedType(type)}>{type}</button>
              ))}
            </div>
            <span className="soko-listing-count">{page === 'benchmarks' ? `${visibleBenchmarks.length} price group${visibleBenchmarks.length === 1 ? '' : 's'}` : `${visibleProducts.length} listing${visibleProducts.length === 1 ? '' : 's'}`}</span>
          </div>

          {page === 'benchmarks' ? (
            <section className="soko-panel soko-benchmark-panel">
              <div className="soko-panel-title"><span className="material-symbols-outlined">query_stats</span><div><h2>Asking-price comparison</h2><p>Calculated from the newest 100 listings returned by the marketplace; not a verified market index.</p></div></div>
              {visibleBenchmarks.map((benchmark) => (
                <article className="soko-benchmark-row" key={benchmark.type}>
                  <div>                  <strong>{benchmark.type} · {benchmark.unit}</strong><small>{benchmark.count} listing{benchmark.count === 1 ? '' : 's'} at this unit</small></div>
                  <div className="soko-benchmark-prices">
                    <span><small>{region || 'Your region'}</small><strong>{benchmark.localAverage === null ? 'No local listings' : `${formatTzs(benchmark.localAverage)} / ${benchmark.unit}`}</strong></span>
                    <span><small>Latest listings · all regions</small><strong>{benchmark.marketAverage === null ? 'No listings yet' : `${formatTzs(benchmark.marketAverage)} / ${benchmark.unit}`}</strong></span>
                    {benchmark.difference !== null && <span className={benchmark.difference > 0 ? 'is-higher' : benchmark.difference < 0 ? 'is-lower' : ''}>{benchmark.difference > 0 ? '+' : ''}{benchmark.difference.toFixed(1)}%</span>}
                  </div>
                </article>
              ))}
              <button type="button" className="soko-report-button" disabled={!benchmarkCount} onClick={() => downloadRegionalReport(benchmarkListings, region)}>Download listing report</button>
            </section>
          ) : (
            <>
              <div className="soko-listings-heading">
                <div><h2>{page === 'mine' ? 'My listings' : selectedType === listingTypes[0] ? 'Current seller listings' : selectedType}</h2><p>{page === 'mine' ? 'Listings published by your account.' : 'Prices and availability are provided by the sellers.'}</p></div>
                <span className={isLive ? 'marketplace-live-status' : 'marketplace-live-status offline'}><i />{isLive ? 'Live updates' : 'Live updates reconnecting'}</span>
              </div>
              {listingProducts === null ? (
                <div className="soko-empty"><span className="material-symbols-outlined">{listingLoadFailed ? 'cloud_off' : 'sync'}</span><strong>{listingLoadFailed ? 'Marketplace listings could not load' : 'Loading seller listings'}</strong><p>{listingLoadFailed ? 'Check your connection and retry to load current seller listings.' : 'Connecting to the AGRI-NEST marketplace.'}</p>{listingLoadFailed && <button type="button" onClick={() => setReloadToken((current) => current + 1)}>Retry</button>}</div>
              ) : visibleProducts.length ? (
                <div className="soko-listing-grid">
                  {visibleProducts.map((product) => (
                    <article className="soko-listing-card" key={product.id}>
                      <div className="soko-listing-image"><ListingImage product={product} /><span>{product.type}</span></div>
                      <div className="soko-listing-copy">
                        <div className="soko-product-title"><h3>{product.name}</h3><strong>{formatTzs(product.price)}</strong></div>
                        <p className="soko-product-description">{product.description || 'The seller has not added a description.'}</p>
                        <div className="soko-product-details"><span><span className="material-symbols-outlined">inventory</span>{product.quantity.toLocaleString()} {product.unit} available</span><span><span className="material-symbols-outlined">location_on</span>{product.region || 'Region not provided'}</span></div>
                        <p className="soko-seller"><span className="material-symbols-outlined">person</span>{product.seller}</p>
                        <div className="soko-listing-actions">
                          <button type="button" className="soko-offer-button" disabled={product.quantity <= 0} title={product.quantity <= 0 ? 'This listing has no available quantity.' : ''} onClick={() => addToCart(product)}>{product.quantity <= 0 ? 'Unavailable' : 'Offer'}</button>
                          <button type="button" disabled title="Direct seller chat is not available yet">Chat</button>
                          <button type="button" onClick={() => onTransport ? onTransport(product) : setNotice('Open Transport from the main menu to arrange delivery.')}>Transport</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="soko-empty"><span className="material-symbols-outlined">{page === 'mine' ? 'inventory_2' : 'search_off'}</span><strong>{page === 'mine' ? 'No listings from this account yet' : 'No matching seller listings'}</strong><p>{page === 'mine' ? 'Post an item to make it available to marketplace buyers.' : 'Try another category or search, or check back when sellers post listings.'}</p>{page === 'mine' && <button type="button" onClick={() => setIsListingFormOpen(true)}>Post a listing</button>}</div>
              )}
            </>
          )}
        </section>

        <aside className="soko-side-column" aria-label="Marketplace tools">
          <section className="soko-panel soko-cart-panel">
            <div className="soko-panel-heading"><h2>Order request</h2><span>{cartCount} item{cartCount === 1 ? '' : 's'}</span></div>
            {cart.length ? <div className="soko-cart-items">
              {cart.map(({ product, quantity }) => <article className="soko-cart-item" key={product.id}>
                <div><strong>{product.name}</strong><small>{formatTzs(product.price)} · {product.unit}</small></div>
                <div className="soko-quantity"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)}>−</button><span>{quantity}</span><button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)}>+</button></div>
              </article>)}
              <div className="soko-cart-total"><span>Estimated total</span><strong>{formatTzs(cartTotal)}</strong></div>
              <button type="button" className="soko-checkout-button" disabled={isPlacingOrder} onClick={placeOrder}>{isPlacingOrder ? 'Sending request…' : 'Send order request'}</button>
              <p className="soko-disclaimer">No payment is taken here. Confirm item availability, delivery, and payment terms with the seller.</p>
            </div> : <div className="soko-cart-empty"><span className="material-symbols-outlined">shopping_bag</span><p>Your order request is empty.</p><small>Select Offer on a listing to start.</small></div>}
          </section>

          <section className="soko-panel soko-benchmarks-summary">
            <div className="soko-panel-title"><span className="material-symbols-outlined">monitoring</span><div><h2>Price benchmarks</h2><p>{region ? `Live asking prices · ${region}` : 'Live asking prices by listing type'}</p></div></div>
            {visibleBenchmarks.map((benchmark) => <div className="soko-summary-row" key={`${benchmark.type}-${benchmark.unit}`}><span>{benchmark.type} · {benchmark.unit}</span><strong>{benchmark.localAverage === null ? '—' : `${formatTzs(benchmark.localAverage)} / ${benchmark.unit}`}</strong><small>{benchmark.localAverage === null ? 'No matching regional listings' : `${benchmark.localCount} local listing${benchmark.localCount === 1 ? '' : 's'}`}</small></div>)}
            <p className="soko-disclaimer">Based on the newest 100 seller asking prices; not independently verified market rates.</p>
            <button type="button" className="soko-report-button" disabled={!benchmarkCount} onClick={() => downloadRegionalReport(benchmarkListings, region)}>Download listing report</button>
          </section>

          <section className="soko-safe-trading">
            <div><span className="material-symbols-outlined">shield</span><h2>Trade carefully</h2></div>
            <ul><li>Confirm the seller and item before arranging payment.</li><li>Agree on delivery, inspection, and refund terms directly.</li><li>AGRI-NEST does not hold or process payment for these requests.</li></ul>
          </section>

          <section className="soko-panel soko-activity-panel">
            <div className="soko-panel-heading"><h2>Market activity</h2><span className={isLive ? 'marketplace-live-status' : 'marketplace-live-status offline'}><i />{isLive ? 'Live' : 'Reconnecting'}</span></div>
            {activities.length ? <ul>{activities.slice(0, 5).map((activity) => <li key={activity.activity_id}><span>{activityLabel(activity)}</span><time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ul> : <p>New listing and order-request activity will appear here when available.</p>}
          </section>
        </aside>
      </div>

      {isListingFormOpen && <div className="marketplace-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsListingFormOpen(false); }}>
        <section className="marketplace-listing-modal" role="dialog" aria-modal="true" aria-labelledby="marketplace-listing-title">
          <div className="marketplace-modal-heading"><div><span>AGRI-NEST SOKO</span><h2 id="marketplace-listing-title">Post a seller listing</h2></div><button type="button" aria-label="Close listing form" onClick={() => setIsListingFormOpen(false)}><span className="material-symbols-outlined">close</span></button></div>
          <form className="marketplace-listing-form" onSubmit={publishListing}>
            <label>Listing title<input required maxLength="120" value={listingDraft.name} onChange={(event) => setListingDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Dairy heifer, fresh milk, layer eggs" /></label>
            <label>Listing type<select value={listingDraft.category} onChange={(event) => setListingDraft((current) => ({ ...current, category: event.target.value }))}>{formListingTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="marketplace-listing-full">Description<textarea maxLength="500" rows="3" value={listingDraft.description} onChange={(event) => setListingDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Add breed, quality, packaging, collection, or other useful details" /></label>
            <label>Price per unit (TZS)<input required type="number" min="1" step="1" value={listingDraft.price} onChange={(event) => setListingDraft((current) => ({ ...current, price: event.target.value }))} /></label>
            <label>Available quantity<input required type="number" min="1" step="any" value={listingDraft.quantity} onChange={(event) => setListingDraft((current) => ({ ...current, quantity: event.target.value }))} /></label>
            <label>Unit<input required maxLength="40" value={listingDraft.unit} onChange={(event) => setListingDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="per animal, litre, tray, or kg" /></label>
            <label>Region<input maxLength="100" value={listingDraft.region} onChange={(event) => setListingDraft((current) => ({ ...current, region: event.target.value }))} placeholder="Your district or region" /></label>
            <label className="marketplace-listing-full">Upload photo from this device<input type="file" accept="image/*" disabled={isProcessingListingImage} onChange={async (event) => {
              const [file] = event.target.files || [];
              event.target.value = '';
              if (!file) return;
              setIsProcessingListingImage(true);
              try {
                const imageUrl = await resizeImageForUpload(file);
                setListingDraft((current) => ({ ...current, imageUrl }));
                setListingImageName(file.name);
                setListingImageError('');
                setNotice('');
              } catch (error) {
                setListingImageError(error.message);
              } finally {
                setIsProcessingListingImage(false);
              }
            }} />{isProcessingListingImage && <span>Preparing image…</span>}{listingImageError && <span className="marketplace-listing-image-error" role="alert">{listingImageError}</span>}</label>
            {listingImageName && <div className="marketplace-listing-image-selection"><span>Selected: {listingImageName}</span><button type="button" onClick={() => { setListingImageName(''); setListingDraft((current) => ({ ...current, imageUrl: '' })); }}>Remove photo</button></div>}
            <label className="marketplace-listing-full">Or use a secure photo URL<input type="url" value={listingImageName ? '' : listingDraft.imageUrl} onChange={(event) => { setListingImageName(''); setListingDraft((current) => ({ ...current, imageUrl: event.target.value })); }} placeholder="https://…" /></label>
            {listingDraft.imageUrl && <img className="marketplace-listing-image-preview" src={listingDraft.imageUrl} alt="Listing image preview" />}
            <p className="marketplace-listing-note">Photo uploads are resized before sending and are visible with the published listing. Listing information and prices are provided by the seller.</p>
            <div className="marketplace-listing-actions-row"><button type="button" onClick={() => setIsListingFormOpen(false)}>Cancel</button><button type="submit" disabled={isPublishingListing || isProcessingListingImage}>{isPublishingListing ? 'Publishing…' : 'Publish listing'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
