import { useEffect, useMemo, useState } from 'react';
import './AgrishopNetwork.css';

const categories = [
  { id: 'Seeds', icon: 'local_florist' },
  { id: 'Fertilizer', icon: 'science' },
  { id: 'Pesticides', icon: 'bug_report' },
  { id: 'Tools', icon: 'hardware' },
];

const shops = [
  {
    id: 'mavuno-agro-vet',
    name: 'Mavuno Agro-vet',
    categories: ['Seeds', 'Fertilizer'],
    region: 'Morogoro Region',
    distance: '2.4 km',
    rating: '4.8',
    reviewCount: 124,
    profileStatus: 'Directory profile',
    featured: [
      { name: 'Hybrid Maize Seed (10kg)', price: 45000, category: 'Seeds' },
      { name: 'DAP Fertilizer (50kg)', price: 68000, category: 'Fertilizer' },
    ],
  },
  {
    id: 'green-leaf-supplies',
    name: 'Green Leaf Supplies',
    categories: ['Pesticides', 'Tools'],
    region: 'Dodoma Region',
    distance: '5.1 km',
    rating: '4.5',
    reviewCount: 89,
    profileStatus: 'Directory profile',
    featured: [
      { name: 'Fungicide X (1L)', price: 28000, category: 'Pesticides' },
      { name: 'Knapsack Sprayer (16L)', price: 95000, category: 'Tools' },
    ],
  },
  {
    id: 'rift-valley-seeds',
    name: 'Rift Valley Seeds',
    categories: ['Seeds'],
    region: 'Iringa Region',
    distance: '8.0 km',
    rating: '3.9',
    reviewCount: 42,
    profileStatus: 'Not independently verified',
    featured: [
      { name: 'Bean Seeds (5kg)', price: 18000, category: 'Seeds' },
      { name: 'Sorghum Seeds (2kg)', price: 12000, category: 'Seeds' },
    ],
  },
];

const flashSales = [
  { title: 'Premium DAP', shopId: 'mavuno-agro-vet', productIndex: 1, discount: '15%', originalPrice: 68000, price: 57800 },
  { title: 'Drought Tolerant Maize', shopId: 'mavuno-agro-vet', productIndex: 0, discount: '10%', originalPrice: 45000, price: 40500 },
];

const sampleMapPins = [
  { left: '37%', top: '59%' },
  { left: '62%', top: '37%' },
  { left: '69%', top: '60%' },
];

function formatTzs(amount) {
  return `TZS ${Number(amount || 0).toLocaleString('en-TZ')}`;
}

function readNearbyShops(location, query, selectedCategory) {
  const search = query.trim().toLowerCase();
  const region = location.trim().toLowerCase();
  return shops.filter((shop) => {
    const matchesCategory = !selectedCategory || shop.categories.includes(selectedCategory);
    const matchesSearch = !search || `${shop.name} ${shop.categories.join(' ')} ${shop.region} ${shop.featured.map((product) => product.name).join(' ')}`.toLowerCase().includes(search);
    const matchesLocation = !region || shop.region.toLowerCase().includes(region) || region.includes('tanzania');
    return matchesCategory && matchesSearch && matchesLocation;
  });
}

function ArchiveDialog({ title, onClose, children }) {
  return (
    <div className="agrishop-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="agrishop-dialog" role="dialog" aria-modal="true" aria-labelledby="agrishop-dialog-title">
        <header><h2 id="agrishop-dialog-title">{title}</h2><button type="button" className="agrishop-icon-button" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button></header>
        {children}
      </section>
    </div>
  );
}

export default function AgrishopNetwork({ user, profile, records, onRecordsChange, search: initialSearch = '', onSearch }) {
  const [selectedCategory, setSelectedCategory] = useState('Seeds');
  const [search, setSearch] = useState(initialSearch);
  const [location, setLocation] = useState(profile?.region || profile?.district || 'Morogoro Region');
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [serialCode, setSerialCode] = useState('');
  const [serialMessage, setSerialMessage] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const visibleShops = useMemo(
    () => readNearbyShops(location, search, selectedCategory),
    [location, search, selectedCategory],
  );
  const visibleShopCount = useMemo(
    () => readNearbyShops(location, '', '').length,
    [location],
  );

  const requestProduct = (shop, product) => {
    if (!user?.user_id) {
      setNotice('Sign in to save a shop inquiry.');
      return;
    }
    if (!onRecordsChange) {
      setNotice('Unable to save this inquiry because farmer records are unavailable.');
      return;
    }

    const existingRequests = records?.requests || [];
    const request = {
      id: globalThis.crypto?.randomUUID?.() || `agrishop-${Date.now()}`,
      module: 'agrishop',
      title: `Inquiry: ${product.name}`,
      details: `Shop: ${shop.name}. Region: ${shop.region}. Listed sample price: ${formatTzs(product.price)}. No request was sent to the shop.`,
      date: new Date().toISOString().slice(0, 10),
      status: 'Local note',
    };
    onRecordsChange?.('requests', [...existingRequests, request]);
    setSelectedShop(null);
    setSelectedProduct(null);
    setNotice('Inquiry note saved on this device only. It was not sent to the shop.');
  };

  const verifyProductCode = (event) => {
    event.preventDefault();
    if (!serialCode.trim()) {
      setSerialMessage('Enter the code printed on the product label.');
      return;
    }
    setSerialMessage('Verification unavailable: AGRI-NEST is not connected to KEPHIS or a manufacturer verification database. Check the code with the product maker or your local agricultural authority.');
  };

  const openProduct = (shop, product) => {
    setSelectedShop(shop);
    setSelectedProduct(product);
  };

  return (
    <div className="agrishop-app">
      <main className="agrishop-main">
          <div className="agrishop-heading">
            <div>
              <h1>Agrishop Network</h1>
              <p>Find farm inputs and nearby agro-dealers.</p>
            </div>
            <button type="button" className="agrishop-verify-launch" onClick={() => document.getElementById('agrishop-serial-code')?.focus()}>
              <span className="material-symbols-outlined">qr_code_scanner</span>Verify Product
            </button>
          </div>

          <div className="agrishop-demo-notice" role="note">
            <span className="material-symbols-outlined">info</span>
            <span>Demo directory: shop names, prices, ratings, distances, offers, and map pins are illustrative. AGRI-NEST does not currently verify agro-dealers, list live inventory, or connect to product-authenticity databases.</span>
          </div>

          <div className="agrishop-discovery">
            <section className="agrishop-filters" aria-label="Shop filters">
              <div className="agrishop-category-card">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={selectedCategory === category.id ? 'selected' : ''}
                    aria-pressed={selectedCategory === category.id}
                    onClick={() => setSelectedCategory((current) => current === category.id ? '' : category.id)}
                  >
                    <span className="material-symbols-outlined">{category.icon}</span>{category.id}
                  </button>
                ))}
                <button type="button" className={!selectedCategory ? 'selected' : ''} aria-pressed={!selectedCategory} onClick={() => setSelectedCategory('')}>
                  <span className="material-symbols-outlined">apps</span>All
                </button>
              </div>
              <label className="agrishop-location-card">
                <span>Location</span>
                <span className="agrishop-location-input">
                  <span className="material-symbols-outlined">location_on</span>
                  <input value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Filter by region" placeholder="Enter a region" />
                  {location && <button type="button" aria-label="Clear location" onClick={() => setLocation('')}><span className="material-symbols-outlined">close</span></button>}
                </span>
              </label>
            </section>

            <div className="agrishop-map-card" role="img" aria-label={`Illustrative dealer map for ${location || 'all regions'}; locations are not live`}>
              <svg className="agrishop-map-fields" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs>
                  <linearGradient id="agrishop-map-bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#64877b" /><stop offset="1" stopColor="#c5c6b6" /></linearGradient>
                  <linearGradient id="agrishop-map-land" x1="0" x2="0.9" y1="0" y2="1"><stop offset="0" stopColor="#d0c8a9" /><stop offset="1" stopColor="#96aa91" /></linearGradient>
                  <filter id="agrishop-map-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#142a25" floodOpacity=".35" /></filter>
                </defs>
                <rect width="640" height="360" fill="url(#agrishop-map-bg)" />
                <path d="M-20 240 C95 198 160 273 253 236 S425 182 660 223 V380 H-20Z" fill="#d0d0c1" opacity=".25" />
                <path d="M-20 47 C120 18 204 72 315 55 S511 21 660 61" fill="none" stroke="#eef0df" strokeOpacity=".22" strokeWidth="2" />
                <g filter="url(#agrishop-map-shadow)" transform="translate(95 58) rotate(-8 225 120)">
                  <path d="M35 104 L290 8 L480 92 L220 218Z" fill="url(#agrishop-map-land)" stroke="#d4d0b9" strokeWidth="4" />
                  <path d="M35 104 L220 218 M104 78 L290 193 M177 51 L363 164 M247 24 L433 137 M95 126 L350 31 M143 151 L396 57 M188 177 L442 82" fill="none" stroke="#f0ead4" strokeOpacity=".8" strokeWidth="2" />
                  <path d="M43 104 C139 80 152 119 231 97 S366 66 462 96 M107 119 C184 105 228 154 311 116 S379 95 433 111" fill="none" stroke="#91aaa0" strokeWidth="4" />
                  <path d="M70 91 L272 17 M112 117 L326 35 M153 143 L378 51 M204 174 L418 81" fill="none" stroke="#b3bb9d" strokeWidth="1.5" />
                </g>
              </svg>
              {sampleMapPins.slice(0, Math.min(visibleShopCount, sampleMapPins.length)).map((pin, index) => (
                <span key={index} className="agrishop-map-pin" style={pin} aria-hidden="true"><span className="material-symbols-outlined">location_on</span></span>
              ))}
              <span className="agrishop-map-count"><i />{visibleShopCount} sample shop profile{visibleShopCount === 1 ? '' : 's'} in directory</span>
              <span className="agrishop-map-legend">Illustrative map · not live locations</span>
            </div>
          </div>

          <div className="agrishop-results-layout">
            <section className="agrishop-results">
              <div className="agrishop-results-heading">
                <div><h2>Shop Profiles <span className="material-symbols-outlined">storefront</span></h2><p>{visibleShops.length} demo profile{visibleShops.length === 1 ? '' : 's'} match your filters</p></div>
                <button type="button" className="agrishop-clear-filters" onClick={() => { setSearch(''); setSelectedCategory(''); setLocation(''); onSearch?.(''); }}>Clear filters</button>
              </div>
              {visibleShops.length ? (
                <div className="agrishop-shop-grid">
                  {visibleShops.map((shop) => (
                    <article key={shop.id} className={`agrishop-shop-card ${shop.profileStatus.startsWith('Not independently') ? 'unverified' : ''}`}>
                      <div className="agrishop-shop-card-content">
                        <div className="agrishop-shop-title-row">
                          <div><h3>{shop.name}</h3>                          <p><span className="material-symbols-outlined">category</span>{shop.categories.join(' & ')}</p></div>
                          <span className={shop.profileStatus.startsWith('Not independently') ? 'agrishop-status unverified' : 'agrishop-status'}>
                            <span className="material-symbols-outlined">{shop.profileStatus.startsWith('Not independently') ? 'pending' : 'storefront'}</span>
                            {shop.profileStatus}
                          </span>
                        </div>
                        <div className="agrishop-shop-meta">
                          <span className="agrishop-rating"><span className="material-symbols-outlined">star</span>{shop.rating} <small>({shop.reviewCount} sample reviews)</small></span>
                          <span><span className="material-symbols-outlined">location_on</span>{shop.distance} · {shop.region}</span>
                        </div>
                        <div className="agrishop-top-products">
                          <p>Sample Products · Illustrative prices</p>
                          <ul>{shop.featured.map((product) => (
                            <li key={product.name}>
                              <button type="button" onClick={() => openProduct(shop, product)}>{product.name}</button>
                              <strong>{formatTzs(product.price)}</strong>
                            </li>
                          ))}</ul>
                        </div>
                      </div>
                      <div className="agrishop-shop-card-footer">
                        <button type="button" onClick={() => { setSelectedShop(shop); setSelectedProduct(null); }}>View Shop<span className="material-symbols-outlined">arrow_forward</span></button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="agrishop-empty">
                  <span className="material-symbols-outlined">storefront</span>
                  <strong>No sample shop profiles match those filters.</strong>
                  <p>Try a different product category or region. This directory is a demo and does not include live dealer inventory.</p>
                  <button type="button" onClick={() => { setSearch(''); setSelectedCategory(''); setLocation(''); onSearch?.(''); }}>Show all sample profiles</button>
                </div>
              )}
            </section>

            <aside className="agrishop-right-rail">
              <section className="agrishop-flash-card">
                <h2><span className="material-symbols-outlined">local_fire_department</span>Flash Sales <small>Sample offers</small></h2>
                <div className="agrishop-flash-list">
                  {flashSales.map((sale) => {
                    const shop = shops.find((entry) => entry.id === sale.shopId);
                    const product = shop?.featured[sale.productIndex];
                    return <button type="button" className="agrishop-flash-item" key={sale.title} onClick={() => shop && product && openProduct(shop, product)}>
                      <span className="agrishop-flash-top"><strong>{sale.title}</strong><b>-{sale.discount}</b></span>
                      <span className="agrishop-flash-shop">{shop?.name}</span>
                      <span className="agrishop-flash-price"><del>{formatTzs(sale.originalPrice)}</del><strong>{formatTzs(sale.price)}</strong></span>
                    </button>;
                  })}
                </div>
                <small className="agrishop-sample-caption">Illustrative prices; confirm price and stock directly with the seller.</small>
              </section>

              <section className="agrishop-counterfeit-card">
                <div className="agrishop-counterfeit-title"><span className="material-symbols-outlined">shield</span><h2>Product Code Check</h2></div>
                <p>Enter a product serial code to check whether a supported verification service is available.</p>
                <form onSubmit={verifyProductCode}>
                  <input id="agrishop-serial-code" value={serialCode} onChange={(event) => { setSerialCode(event.target.value); setSerialMessage(''); }} maxLength={100} placeholder="Enter serial code" aria-label="Product serial code" />
                  <button type="submit" aria-label="Check product code"><span className="material-symbols-outlined">arrow_forward</span></button>
                </form>
                {serialMessage && <p className="agrishop-serial-message" role="status">{serialMessage}</p>}
                <small>External verification provider not connected</small>
              </section>
            </aside>
          </div>
      </main>

      {notice && <div className="agrishop-toast" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      {selectedShop && <ArchiveDialog title={selectedProduct ? 'Product details' : selectedShop.name} onClose={() => { setSelectedShop(null); setSelectedProduct(null); }}>
        <div className="agrishop-shop-dialog-content">
          <span className="agrishop-dialog-label">{selectedShop.profileStatus} · Sample directory listing</span>
          {!selectedProduct && <><h3>{selectedShop.name}</h3><p className="agrishop-dialog-region"><span className="material-symbols-outlined">location_on</span>{selectedShop.region} · illustrative distance {selectedShop.distance}</p><p className="agrishop-dialog-note">This directory profile is sample content. AGRI-NEST has not checked the shop’s identity, product authenticity, stock, or credentials.</p></>}
          {selectedProduct ? (
            <div className="agrishop-selected-product">
              <span className="material-symbols-outlined">inventory_2</span>
              <div><strong>{selectedProduct.name}</strong><p>{selectedShop.name} · illustrative price</p><b>{formatTzs(selectedProduct.price)}</b></div>
            </div>
          ) : <div className="agrishop-dialog-products">{selectedShop.featured.map((product) => <button type="button" key={product.name} onClick={() => setSelectedProduct(product)}><span>{product.name}</span><strong>{formatTzs(product.price)}</strong></button>)}</div>}
          {selectedProduct && <p className="agrishop-dialog-note">Product availability, specifications, and price have not been confirmed by the seller.</p>}
          <div className="agrishop-dialog-actions">
            {selectedProduct && <button type="button" className="agrishop-secondary-button" onClick={() => setSelectedProduct(null)}>Back to shop</button>}
            <button type="button" className="agrishop-primary-button" onClick={() => requestProduct(selectedShop, selectedProduct || selectedShop.featured[0])}>Save inquiry note</button>
          </div>
          <p className="agrishop-local-only-note">Inquiry notes are saved in your farmer records on this device only. They are not sent to this shop and do not create an order or payment.</p>
        </div>
      </ArchiveDialog>}

    </div>
  );
}
