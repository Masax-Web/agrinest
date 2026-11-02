import { useEffect, useMemo, useRef, useState } from 'react';
import api from './lib/api';

const categories = ['All categories', 'Livestock feed', 'Day-old chicks', 'Vet supplies', 'Equipment', 'Grains'];

const products = [
  {
    id: 'layer-mash',
    name: 'Premium Layer Mash',
    category: 'Livestock feed',
    description: 'High-protein growth formula for laying hens. 50 kg bag.',
    price: 34500,
    unit: '50 kg bag',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAoiCfS4YjgFBfYT72IuGIGUH0pY4hbAq-GH2YKFWsL2A4MKBoLJUXFPcneKjm0LKKndgr61fiLfiVRKDKNgtZASGHINCdWUPBQMgpnW9V50rI4YlTNDMSCPoql69dhMG4HgBiSfrP6qVgMNMoCnw8obGHWI_6MG4QiSYFR9s7LgTfyBKrCuHLfmtjtfo4NsZUtXNGQiZZupLm53mwU4b5JWJnIOVJKliojIR-jcmhmcSZzdpTQ10mprfMFKgIvGYLLGQWHyQZrwJg',
    seller: 'Example listing · Morogoro',
    demo: true,
  },
  {
    id: 'kuroiler-chicks',
    name: 'Day-old Kuroiler Chicks',
    category: 'Day-old chicks',
    description: 'Dual-purpose improved breed. Minimum order: 50 chicks.',
    price: 1100,
    unit: 'per chick',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfSli7Hf6Qus2LeKpWlknNbwAxAWsz4rV_je8dW0emCbPKlITz8FPbYDoNliLLLXOXdlmyga-2Sh-_xx5eWy2nMGJqoBS_oVvFhztTfvb9maQPs1f7dkwoJVLbi2ZHcODIidhhW_DA8AmfMVYPcJbXpHer0vebCjC_LlJQxKky0w60KCQPMskhjc7P-CQCz2dGqs0DKcyhwsbvF0xgF0fvr7WVTtNnzC2wvT-RGfv2fsr_NFbMXJCG5wAadmQtvs3xJcThE9qB0KM',
    seller: 'Example listing · Iringa',
    demo: true,
  },
  {
    id: 'gumboro-vaccine',
    name: 'Gumboro Vaccine',
    category: 'Vet supplies',
    description: 'Infectious Bursal Disease vaccine. Pack of 1,000 doses.',
    price: 12000,
    unit: '1,000 doses',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ON1koo5_h4c4I8BwIc9VQM3HdJCa1e8uCFH9WRQDqa7ljBBFxZagrWp6WkwY-KNpAgMEKtD8g2Bb3Tix8QYKomIIOblNc5gFZ1C5eCqEyKv_RrNRY9Onq-MYLvWTUaApq8eaNvM4wW8Jrk1xAMAMdL_kN_isGxt15HxFei2RjnNvGLSTY-oB7KMxyfjIOPutjNCxbhuZDVlGuDVt_-7a61qFWH13_xEmdo8AUXG24EXDPYpO6FS-c5UOSxWoGvsshOaIqYM2eEQ',
    seller: 'Example listing · Dar es Salaam',
    demo: true,
  },
  {
    id: 'broiler-starter',
    name: 'Broiler Starter Crumbles',
    category: 'Livestock feed',
    description: 'Starter feed for chicks from day 1 to 14. 50 kg bag.',
    price: 38000,
    unit: '50 kg bag',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOK-KrMx517G0PrbbYWnW1BBxXT3CgqaqUumP0Q9rSfi1p6DwC6lxCjy6QaC2yjLPyQNw1jkk7qcAGQiW2QUhv94FX_RTiww0qzCnjlQT_HKCNqXDXUVpX9KpDFwmDjggyv-TZ41oD0ojHvxyaC6UA69nqJ4F5OPGaP6Tgi_2snPnn1XddmUd64FjKCdu086PLJW8gwgJkyY4YTVWkkMMA_D_Ne074Wr5UaojizYUZ5LLuKPDt7by7KIcQe9BKCOCuocZiU4QR7Lg',
    seller: 'Example listing · Morogoro',
    demo: true,
  },
  {
    id: 'poultry-feeder',
    name: 'Automatic Poultry Feeder',
    category: 'Equipment',
    description: 'Anti-waste design with a 10 kg capacity. Durable HDPE.',
    price: 21500,
    unit: 'each',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPayz0OvMfqKdnxXpEcUxxUYB3H1gP-PeiRoccQN8IpachYEejTA1bU6v8c3YmwO7jzVCGdL4y04-IMvfNpiz2Ljl17A8FQP0yz4gWA-2sZAYk7CWNQhNr5OAj3QrsCcnCe7h0jSnROPAJLsSGllXuaW4EsVZc3_8N9KJ-Z8c3fJYxq3Zml-U9XU2i09rVZdvdOBUY80R-iISNxK2qE7QW3l2tQ9hMq3dFbcEvGcpstv0FEN12heg9GHO6w2iDkT0eMwWvyvNVluo',
    seller: 'Example listing · Mbeya',
    demo: true,
  },
  {
    id: 'maize-bran',
    name: 'Pure Maize Bran',
    category: 'Grains',
    description: 'Grade A sifted maize bran, excellent for feed mixing. 90 kg.',
    price: 19500,
    unit: '90 kg bag',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBtkUOKrYUlPRGt74LE3_iIEt3wwhLdgCXBkfep09wQoFRGfa4Yzg1dQRSKuEfbHhwPvDzTwe0HfNWWkBiwsC5txwsNmL33XFxEKNeOdXeEGLnbX-0E5eig8ewhgCvL1mKCESas9aYeut-c6iamz5CLKbib3wBkCH-ELlugnnd-4y74j9rSixaZbpdLd-X_gmFWd63PmVPukAzhCLNsDiW3D2vGkUupgQtisyLv-HipxeTiOUJb-ViBoNikbZkxVWv5vQiSjrL1-dg',
    seller: 'Example listing · Kilimanjaro',
    demo: true,
  },
];

const trends = [
  { label: 'Maize bran · 90 kg', price: 19500, change: 4.2, up: true, bars: [3, 5, 4, 6, 8, 10] },
  { label: 'Soya meal · 50 kg', price: 42000, change: 2.1, up: false, bars: [8, 7, 9, 6, 5, 4] },
];

const formatTzs = (value) => `TZS ${Number(value || 0).toLocaleString('en-TZ')}`;

function fromListing(listing) {
  const fallback = products.find((product) => product.category === listing.category) || products[0];
  return {
    id: String(listing.listing_id),
    name: listing.name || listing.crop_type || 'Farm product',
    category: categories.includes(listing.category) ? listing.category : 'Grains',
    description: listing.description || `${listing.quantity || ''} ${listing.unit || 'units'} available.`,
    price: Number(listing.price || 0),
    unit: listing.unit || 'per unit',
    image: listing.image_url || fallback.image,
    seller: [listing.seller_name, listing.region].filter(Boolean).join(' · ') || 'AGRI-NEST seller',
    verified: false,
    demo: false,
  };
}

function activityLabel(activity) {
  const details = activity.details || {};
  if (activity.event_type === 'listing_created') return `New listing: ${details.name || 'Farm product'}${details.region ? ` · ${details.region}` : ''}`;
  if (activity.event_type === 'cart_item_added') return `A shopper added ${details.product_name || 'a product'} to their cart`;
  if (activity.event_type === 'order_placed') return `An order was placed for ${details.item_count || 0} items · ${formatTzs(details.total_amount)}`;
  return 'Marketplace updated';
}

export default function MarketplacePage({ profile, search = '' }) {
  const [category, setCategory] = useState(categories[0]);
  const [cart, setCart] = useState([]);
  const [notice, setNotice] = useState('');
  const [listingProducts, setListingProducts] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [isListingFormOpen, setIsListingFormOpen] = useState(false);
  const [isPublishingListing, setIsPublishingListing] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [listingDraft, setListingDraft] = useState({ name: '', category: 'Livestock feed', description: '', price: '', quantity: '', unit: '', region: profile.region || '' });
  const lastActivityId = useRef(0);

  useEffect(() => {
    let isCurrent = true;
    let unsubscribe = () => {};

    Promise.allSettled([api.getListings(), api.getMarketplaceActivity()]).then(([listingResponse, activityResponse]) => {
      if (!isCurrent) return;
      const listingResult = listingResponse.status === 'fulfilled' ? listingResponse.value : { items: [] };
      const activityResult = activityResponse.status === 'fulfilled' ? activityResponse.value : { items: [] };
      const liveListings = Array.isArray(listingResult.items) ? listingResult.items.map(fromListing) : [];
      setListingProducts(liveListings);
      const recent = Array.isArray(activityResult.items) ? activityResult.items : [];
      setActivities(recent);
      lastActivityId.current = Math.max(0, ...recent.map((activity) => Number(activity.activity_id) || 0));
      if (listingResponse.status === 'rejected' || activityResponse.status === 'rejected') {
        setNotice('Some live market data is unavailable. Featured products are shown while we reconnect.');
      }
      unsubscribe = api.subscribeMarketplaceActivity((activity) => {
        if (!isCurrent) return;
        lastActivityId.current = Math.max(lastActivityId.current, Number(activity.activity_id) || 0);
        setActivities((current) => [activity, ...current.filter((item) => item.activity_id !== activity.activity_id)].slice(0, 12));
        if (activity.event_type === 'listing_created') {
          api.getListings().then((result) => {
            if (isCurrent) setListingProducts((result.items || []).map(fromListing));
          }).catch(() => setNotice('A new listing arrived, but the catalog could not refresh.'));
        }
      }, setIsLive, lastActivityId.current);
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  const catalog = listingProducts?.length ? listingProducts : products;

  const visibleProducts = useMemo(() => catalog.filter((product) => {
    const matchesCategory = category === categories[0] || product.category === category;
    const searchText = `${product.name} ${product.description} ${product.seller} ${product.category}`.toLowerCase();
    return matchesCategory && searchText.includes(search.trim().toLowerCase());
  }), [category, search, catalog]);

  const addToCart = (product) => {
    if (product.demo) {
      setNotice('This is a featured example, not a live seller listing. Add a real seller listing to place an order.');
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { product, quantity: 1 }];
    });
    setNotice(`${product.name} added to your cart.`);
    api.createMarketplaceActivity({
      event_type: 'cart_item_added',
      details: { product_name: product.name, category: product.category, region: profile.region || '' },
    }).catch(() => setIsLive(false));
  };

  const changeQuantity = (productId, amount) => setCart((current) => current
    .map((item) => item.product.id === productId ? { ...item, quantity: item.quantity + amount } : item)
    .filter((item) => item.quantity > 0));

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
        seller_name: profile.name,
        region: listingDraft.region.trim(),
        farmer_id: null,
      });
      const product = fromListing(result);
      setListingProducts((current) => [product, ...(current || []).filter((item) => item.id !== product.id)]);
      setIsListingFormOpen(false);
      setListingDraft({ name: '', category: 'Livestock feed', description: '', price: '', quantity: '', unit: '', region: profile.region || '' });
      setNotice(`${product.name} is now listed for AGRI-NEST shoppers.`);
    } catch {
      setNotice('Could not publish the listing. Check your connection and try again.');
    } finally {
      setIsPublishingListing(false);
    }
  };

  const placeOrder = async () => {
    setIsPlacingOrder(true);
    try {
      const order = await api.createMarketplaceOrder({
        buyer_name: profile.name,
        items: cart.map(({ product, quantity }) => ({
          product_id: product.id,
          name: product.name,
          quantity,
          unit_price: product.price,
        })),
        total_amount: cart.reduce((total, item) => total + item.product.price * item.quantity, 0),
      });
      setCart([]);
      setNotice(`Order request ${String(order.order_id).slice(0, 8)} was sent. The seller will confirm availability and delivery.`);
    } catch {
      setNotice('Could not send your order request. Your cart is still saved on this page.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const cartHasExamples = cart.some((item) => item.product.demo);

  return (
    <main className="marketplace-page">
      <section className="marketplace-main-column" aria-label="Marketplace products">
        <div className="marketplace-filter-bar">
          <div className="marketplace-categories" role="group" aria-label="Filter products by category">
            {categories.map((option) => (
              <button type="button" key={option} className={category === option ? 'marketplace-category active' : 'marketplace-category'} onClick={() => setCategory(option)}>
                {option}
              </button>
            ))}
          </div>
          <div className="marketplace-toolbar-actions">
            <button type="button" className="marketplace-sell-button" onClick={() => setIsListingFormOpen(true)}><span className="material-symbols-outlined">add</span>Sell item</button>
            <button type="button" className="marketplace-filter-button" onClick={() => setNotice('Advanced filters are coming soon.')}><span className="material-symbols-outlined">tune</span>Advanced filters</button>
          </div>
        </div>

        {notice && <div className="marketplace-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
        {listingProducts?.length === 0 && <p className="marketplace-catalog-note">Showing featured items while sellers add live listings.</p>}

        {isListingFormOpen && (
          <div className="marketplace-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsListingFormOpen(false); }}>
            <section className="marketplace-listing-modal" role="dialog" aria-modal="true" aria-labelledby="marketplace-listing-title">
              <div className="marketplace-modal-heading"><div><span>AGRI-NEST SOKO</span><h2 id="marketplace-listing-title">List a product</h2></div><button type="button" aria-label="Close listing form" onClick={() => setIsListingFormOpen(false)}><span className="material-symbols-outlined">close</span></button></div>
              <form className="marketplace-listing-form" onSubmit={publishListing}>
                <label>Product name<input required maxLength="120" value={listingDraft.name} onChange={(event) => setListingDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Sunflower seed, 50 kg" /></label>
                <label>Category<select value={listingDraft.category} onChange={(event) => setListingDraft((current) => ({ ...current, category: event.target.value }))}>{categories.slice(1).map((option) => <option key={option}>{option}</option>)}</select></label>
                <label className="marketplace-listing-full">Description<textarea maxLength="500" rows="3" value={listingDraft.description} onChange={(event) => setListingDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Quality, variety, packaging, or collection details" /></label>
                <label>Price per unit (TZS)<input required type="number" min="1" step="1" value={listingDraft.price} onChange={(event) => setListingDraft((current) => ({ ...current, price: event.target.value }))} placeholder="e.g. 35000" /></label>
                <label>Available quantity<input required type="number" min="1" step="any" value={listingDraft.quantity} onChange={(event) => setListingDraft((current) => ({ ...current, quantity: event.target.value }))} placeholder="e.g. 20" /></label>
                <label>Unit<input required maxLength="40" value={listingDraft.unit} onChange={(event) => setListingDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="50 kg bag, crate, or kg" /></label>
                <label>Region<input maxLength="100" value={listingDraft.region} onChange={(event) => setListingDraft((current) => ({ ...current, region: event.target.value }))} placeholder="e.g. Iringa Region" /></label>
                <p className="marketplace-listing-note">Your profile name is shown as the seller. Listing prices are in Tanzanian shillings.</p>
                <div className="marketplace-listing-actions-row"><button type="button" onClick={() => setIsListingFormOpen(false)}>Cancel</button><button type="submit" disabled={isPublishingListing}>{isPublishingListing ? 'Publishing…' : 'Publish listing'}</button></div>
              </form>
            </section>
          </div>
        )}

        <div className="marketplace-product-grid">
          {visibleProducts.map((product) => (
            <article className="marketplace-product" key={product.id}>
              <div className="marketplace-product-image">
                <img src={product.image} alt={product.name} loading="lazy" />
                {product.verified && <span className="marketplace-verified"><span className="material-symbols-outlined">verified</span>Verified seller</span>}
              </div>
              <div className="marketplace-product-info">
                <span className="marketplace-product-category">{product.category}</span>
                <h2>{product.name}</h2>
                <p className="marketplace-product-description">{product.description}</p>
                <p className="marketplace-seller">{product.seller}</p>
                <div className="marketplace-product-buy">
                  <div><strong>{formatTzs(product.price)}</strong><small>{product.unit}</small></div>
                  <button type="button" aria-label={`Add ${product.name} to cart`} title="Add to cart" onClick={() => addToCart(product)}><span className="material-symbols-outlined">add_shopping_cart</span></button>
                </div>
              </div>
            </article>
          ))}
          {!visibleProducts.length && <div className="marketplace-empty-results"><span className="material-symbols-outlined">search_off</span><h2>No matching products</h2><p>Try a different search or category.</p></div>}
        </div>
      </section>

      <aside className="marketplace-side-column" aria-label="Cart and market information">
        <section className="marketplace-panel marketplace-cart-panel">
          <div className="marketplace-panel-heading"><h2>Your cart</h2><span>{cartCount} {cartCount === 1 ? 'item' : 'items'}</span></div>
          {cart.length ? (
            <div className="marketplace-cart-items">
              {cart.map(({ product, quantity }) => (
                <div className="marketplace-cart-item" key={product.id}>
                  <img src={product.image} alt="" />
                  <div className="marketplace-cart-item-copy"><strong>{product.name}</strong><small>{formatTzs(product.price * quantity)}</small><div className="marketplace-quantity"><button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => changeQuantity(product.id, -1)}>−</button><span>{quantity}</span><button type="button" aria-label={`Increase ${product.name} quantity`} onClick={() => changeQuantity(product.id, 1)}>+</button></div></div>
                </div>
              ))}
            </div>
          ) : <div className="marketplace-cart-empty"><span className="material-symbols-outlined">shopping_basket</span><p>Your cart is empty</p><small>Add products to start an order.</small></div>}
          <div className="marketplace-cart-total"><span>Estimated total</span><strong>{formatTzs(cartTotal)}</strong></div>
          <button type="button" className="marketplace-checkout-button" disabled={!cart.length || cartHasExamples || isPlacingOrder} onClick={placeOrder}>
            {isPlacingOrder ? 'Sending request…' : 'Place order request'} <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <p className="marketplace-payment-note">{cartHasExamples ? 'Featured examples cannot be ordered. Add a live seller listing to your cart.' : 'No payment is taken here. Sellers confirm availability and delivery.'}</p>
        </section>

        <section className="marketplace-panel marketplace-trends-panel">
          <div className="marketplace-trends-heading"><span className="material-symbols-outlined">trending_up</span><h2>Price trends</h2><small>Illustrative · TZS</small></div>
          {trends.map((trend) => (
            <div className="marketplace-trend" key={trend.label}>
              <div><span>{trend.label}</span><strong>{formatTzs(trend.price)} <small className={trend.up ? 'marketplace-trend-up' : 'marketplace-trend-down'}>{trend.up ? '↑' : '↓'} {trend.change}%</small></strong></div>
              <div className="marketplace-trend-bars" aria-label={`${trend.label} recent price trend`}>{trend.bars.map((height, index) => <i className={index === trend.bars.length - 1 ? 'current' : ''} style={{ height: `${height * 4}px` }} key={`${trend.label}-${index}`} />)}</div>
            </div>
          ))}
          <div className="marketplace-market-note"><span className="material-symbols-outlined">lightbulb</span><div><strong>Market note</strong><p>Prices vary by region, season, and delivery distance. Confirm the final total with the seller.</p></div></div>
        </section>

        <section className="marketplace-panel marketplace-activity-panel">
          <div className="marketplace-panel-heading"><h2>Market activity</h2><span className={isLive ? 'marketplace-live-status' : 'marketplace-live-status offline'}><i />{isLive ? 'Live' : 'Reconnecting'}</span></div>
          {activities.length ? <ul className="marketplace-activity-list">{activities.slice(0, 5).map((activity) => <li key={activity.activity_id}><span>{activityLabel(activity)}</span><time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ul> : <p>New listings, cart interest, and order requests will appear here for all connected shoppers.</p>}
        </section>
      </aside>
    </main>
  );
}