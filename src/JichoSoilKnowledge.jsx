import { useMemo, useState } from 'react';

const soilProfiles = [
  {
    id: 'loam',
    name: 'Loam Soil',
    icon: '🌱',
    badge: 'BALANCED MIX',
    description: 'A balanced mix of sand, silt, and clay. Often workable and able to hold useful moisture.',
    ph: '6.0–7.0',
    measure: 'Drainage',
    value: 'Moderate to good',
    crops: ['Maize', 'Wheat', 'Tomatoes'],
    care: 'Maintain organic matter with compost or retained crop residues. Check soil moisture before irrigation.',
  },
  {
    id: 'clay',
    name: 'Clay Soil',
    icon: '🏺',
    badge: 'FINE TEXTURE',
    description: 'Fine particles can retain water and nutrients, but heavy clay may drain slowly and compact.',
    ph: '6.0–7.5',
    measure: 'Drainage',
    value: 'Often slow',
    crops: ['Rice', 'Beans', 'Broccoli'],
    care: 'Avoid working wet clay. Add organic matter and use suitable drainage practices where waterlogging is a concern.',
  },
  {
    id: 'volcanic',
    name: 'Volcanic / Red Soil',
    icon: '🌋',
    badge: 'HIGHLAND SOILS',
    description: 'Red and volcanic soils occur in several highland areas. Properties vary with parent material and management.',
    ph: '5.5–6.5*',
    measure: 'Typical feature',
    value: 'Variable retention',
    crops: ['Coffee', 'Tea', 'Pyrethrum', 'Bananas'],
    care: 'Use a soil test to check acidity and phosphorus availability before choosing amendments or fertilizer.',
  },
  {
    id: 'sandy',
    name: 'Sandy Soil',
    icon: '🏖️',
    badge: 'FAST DRAINING',
    description: 'Coarse particles usually drain quickly and may hold less water and nutrients than finer soils.',
    ph: '4.5–6.5*',
    measure: 'Fertility',
    value: 'Depends on site',
    crops: ['Groundnuts', 'Cashew'],
    care: 'Build organic matter gradually and consider smaller, well-timed irrigation and nutrient applications.',
  },
  {
    id: 'black-cotton',
    name: 'Black Cotton Soil',
    icon: '🌑',
    badge: 'EXPANSIVE CLAY',
    description: 'Some dark clay soils swell when wet and crack as they dry. Drainage and traffic need careful management.',
    ph: 'Site-specific',
    measure: 'Texture',
    value: 'High clay content',
    crops: ['Cotton', 'Sunflower'],
    care: 'Avoid heavy machinery when wet. Confirm local drainage, crop suitability, and soil chemistry with an extension officer.',
  },
];

const managementTips = [
  {
    icon: 'compost',
    title: 'Build organic matter',
    text: 'Use well-managed compost, manure, or crop residues appropriate to your field and local guidance.',
  },
  {
    icon: 'science',
    title: 'Test before liming',
    text: 'Lime rate depends on a laboratory soil test and crop needs. Do not apply a blanket rate based only on appearance.',
  },
  {
    icon: 'agriculture',
    title: 'Protect soil structure',
    text: 'Reduce unnecessary disturbance and avoid working soil when it is too wet, especially on clay soils.',
  },
];

function downloadSoilReport(profile, savedFields) {
  const report = {
    reportTitle: 'AGRI-NEST Soil Knowledge & Field Notes',
    generatedAt: new Date().toISOString(),
    farmer: profile?.name || 'Farmer',
    location: profile?.location || profile?.region || 'Not recorded',
    disclaimer: 'General educational guidance only. Soil ranges are illustrative references, not live regional measurements, laboratory results, or fertilizer recommendations. Confirm field decisions with a soil laboratory or qualified extension officer.',
    fieldRecords: savedFields.map((field) => ({
      field: field.name || 'Unnamed field',
      crop: field.crop || 'Not recorded',
      soilType: field.soil?.type || 'Not recorded',
      ph: field.soil?.pH || 'Not recorded',
      organicMatter: field.soil?.organicMatter || 'Not recorded',
      sampleDate: field.soil?.sampleDate || 'Not recorded',
      source: field.soil?.source || 'Not recorded',
    })),
    soilReferences: soilProfiles.map(({ name, ph, crops, care }) => ({ name, illustrativePhRange: ph, cropExamples: crops, generalCare: care })),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agrinest-soil-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SoilProfileCard({ soil, wide = false }) {
  return (
    <article className={`soil-knowledge-card${wide ? ' is-wide' : ''}`}>
      <div className="soil-knowledge-card-top">
        <span className="soil-knowledge-emoji" aria-hidden="true">{soil.icon}</span>
        <span className={`soil-knowledge-badge soil-badge-${soil.id}`}>{soil.badge}</span>
      </div>
      <div>
        <h2>{soil.name}</h2>
        <p className="soil-knowledge-description">{soil.description}</p>
      </div>
      <div className="soil-knowledge-metrics">
        <div><small>ILLUSTRATIVE pH</small><strong>{soil.ph}</strong></div>
        <div><small>{soil.measure.toUpperCase()}</small><strong>{soil.value}</strong></div>
      </div>
      <div className="soil-knowledge-crops">
        <small>COMMON CROP EXAMPLES</small>
        <div>{soil.crops.map((crop) => <span key={crop}>{crop}</span>)}</div>
      </div>
      <details className="soil-knowledge-care">
        <summary>Soil care guidance</summary>
        <p>{soil.care}</p>
      </details>
    </article>
  );
}

export default function JichoSoilKnowledge({ profile, records, search = '', onSearch, onMap, onExpert }) {
  const [serviceOpen, setServiceOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleSoils = useMemo(() => soilProfiles.filter((soil) => [
    soil.name, soil.badge, soil.description, soil.ph, soil.value, ...soil.crops,
  ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))), [normalizedSearch]);
  const savedFields = (Array.isArray(records?.fields) ? records.fields : []).filter((field) => field.soil);
  const measuredPh = savedFields
    .map((field) => Number(field.soil?.pH))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 14);
  const averagePh = measuredPh.length
    ? (measuredPh.reduce((sum, value) => sum + value, 0) / measuredPh.length).toFixed(1)
    : null;
  const location = profile?.region || profile?.location || 'Iringa & Mbeya';

  const downloadPriceGuide = () => {
    const guide = [
      'AGRI-NEST | Soil Testing: Request a Quote',
      '',
      'Laboratory prices depend on the laboratory, sample location, and tests requested. AGRI-NEST does not have a verified current TARI price list.',
      'Contact a TARI laboratory or your local agricultural extension office to confirm current prices, sample requirements, and turnaround time.',
      '',
      'When requesting a quote, ask about:',
      '- Soil pH and recommended sampling depth',
      '- Available nutrient tests and whether phosphorus/potassium are included',
      '- Organic matter, salinity, or texture tests if relevant',
      '- Sample quantity, packaging, labeling, and delivery instructions',
      '- Cost per sample, payment method, and expected turnaround time',
      '- Whether crop-specific fertilizer recommendations are included',
      '',
      'Do not apply lime or fertilizer based only on a generic soil profile. Follow your laboratory report and qualified local advice.',
    ].join('\n');
    const blob = new Blob([guide], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agrinest-soil-testing-quote-guide.txt';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Downloaded a soil-testing quote checklist. Prices vary by laboratory; no price was invented.');
  };

  return (
    <main className="soil-knowledge-page" aria-label="Soils knowledge base">
      {notice && <div className="soil-knowledge-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><span className="material-symbols-outlined">close</span></button></div>}
      <header className="soil-knowledge-heading">
        <div><span className="farmer-workspace-eyebrow">JICHO AI · FIELD REFERENCES</span><h1>Soils Knowledge Base</h1><p>Explore common soil characteristics and practical management guidance for Tanzania.</p></div>
        <button type="button" className="soil-report-button" onClick={() => downloadSoilReport(profile, savedFields)}><span className="material-symbols-outlined">download</span>Generate Report</button>
      </header>

      <div className="soil-knowledge-layout">
        <section className="soil-knowledge-main">
          <label className="soil-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search soils, crops, pH levels…" aria-label="Search soils, crop examples, or pH references" /></label>
          <div className="soil-knowledge-disclaimer"><span className="material-symbols-outlined">info</span><p>These are general educational references, not live regional soil measurements or lab results. Soil varies between fields; test a representative sample before making nutrient or lime decisions.</p></div>
          {visibleSoils.length ? <div className="soil-knowledge-grid">
            {visibleSoils.map((soil) => <SoilProfileCard key={soil.id} soil={soil} wide={soil.id === 'volcanic'} />)}
          </div> : <div className="soil-knowledge-empty"><span className="material-symbols-outlined">search_off</span><strong>No soil profiles match “{search}”</strong><p>Try a soil type, crop, or pH range.</p></div>}

          <section className="soil-testing-card">
            <div className="soil-testing-art" aria-hidden="true"><span className="material-symbols-outlined">science</span><span className="material-symbols-outlined">biotech</span></div>
            <div className="soil-testing-content"><span className="farmer-workspace-eyebrow">FIELD TESTING</span><h2>Soil Testing Services</h2><p>Ask a TARI laboratory or local extension office about accredited soil analysis, sample preparation, turnaround time, and crop-specific recommendations.</p><div className="soil-testing-actions"><button type="button" className="soil-report-button" onClick={() => setServiceOpen(true)}><span className="material-symbols-outlined">contact_support</span>Contact an expert</button><button type="button" className="soil-testing-guide-button" onClick={downloadPriceGuide}><span className="material-symbols-outlined">download</span>Testing quote guide</button></div></div>
          </section>
        </section>

        <aside className="soil-knowledge-sidebar">
          <section className="soil-regional-card">
            <div className="soil-sidebar-heading"><h2>Regional Soil Outlook</h2><span>REFERENCE</span></div>
            <p>{location} · broad regional context</p>
            <div className="soil-regional-illustration" role="img" aria-label="Illustrative terrain and soil zones; not a live or field-verified soil map">
              <span className="soil-region-contour contour-one" /><span className="soil-region-contour contour-two" /><span className="soil-region-contour contour-three" />
              <span className="soil-region-pin pin-one" /><span className="soil-region-pin pin-two" />
              <div><i className="soil-legend-volcanic" />Highland soils · variable</div>
              <div><i className="soil-legend-plains" />Valleys &amp; plains · variable</div>
            </div>
            <small className="soil-map-caption">Illustration only · not live geospatial data</small>
            <button type="button" className="soil-map-button" onClick={onMap}>Explore farm map <span className="material-symbols-outlined">arrow_forward</span></button>
          </section>

          <section className="soil-management-card">
            <h2><span className="material-symbols-outlined">tips_and_updates</span>Management Tips</h2>
            {managementTips.map((tip) => <article key={tip.title}><span className="material-symbols-outlined">{tip.icon}</span><div><strong>{tip.title}</strong><p>{tip.text}</p></div></article>)}
          </section>

          <section className="soil-pulse-card">
            <h2>Soil Health Pulse</h2>
            {savedFields.length ? <>
              <div className="soil-pulse-stat"><span>Fields with soil records</span><strong>{savedFields.length}</strong><div><i style={{ width: `${Math.min(100, savedFields.length * 20)}%` }} /></div></div>
              <div className="soil-pulse-stat"><span>Recorded pH average</span><strong>{averagePh || 'Not recorded'}</strong><div><i className="soil-pulse-neutral" style={{ width: averagePh ? `${Math.max(8, Math.min(100, Number(averagePh) / 14 * 100))}%` : '0%' }} /></div></div>
              <small>Based only on soil entries you saved for fields; not sensor or regional data.</small>
            </> : <div className="soil-pulse-unavailable"><span className="material-symbols-outlined">sensors_off</span><p>No soil tests or sensor readings are connected yet. Add a field soil record in Digital Farm to see your saved pH details here.</p></div>}
          </section>
        </aside>
      </div>

      {serviceOpen && <div className="soil-service-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setServiceOpen(false); }}>
        <section className="soil-service-modal" role="dialog" aria-modal="true" aria-labelledby="soil-service-title">
          <div className="soil-service-modal-heading"><div><span className="farmer-workspace-eyebrow">LABORATORY TESTING</span><h2 id="soil-service-title">Request soil testing information</h2></div><button type="button" aria-label="Close dialog" onClick={() => setServiceOpen(false)}><span className="material-symbols-outlined">close</span></button></div>
          <p>Ask an agricultural expert or extension officer for current TARI laboratory contacts, sample instructions, available tests, and pricing in your region.</p>
          <p className="soil-service-note">AGRI-NEST does not submit samples or confirm laboratory prices from this page.</p>
          <div className="soil-service-actions"><button type="button" className="soil-testing-guide-button" onClick={() => { setServiceOpen(false); downloadPriceGuide(); }}>Download quote checklist</button><button type="button" className="soil-report-button" onClick={() => { setServiceOpen(false); onExpert(); }}>Open expert support</button></div>
        </section>
      </div>}
    </main>
  );
}
