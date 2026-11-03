import { useMemo, useState } from 'react';
import './JichoPestKnowledge.css';

const threats = [
  {
    id: 'fall-armyworm',
    name: 'Fall Armyworm',
    scientificName: 'Spodoptera frugiperda',
    category: 'Insect Pest',
    group: 'Insect Pests',
    severity: 'Critical',
    crops: ['Maize', 'Sorghum'],
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeW7hBUjKQ5i-VoPLffWQAkM81jzq39XCE04nSlVvLG1nOX_K6BnZ9l7-3WJmARcXYimB3IiLZS0HHpRMIV-4gXONrW1qw_5znBtZg0N6b_AuRaMNVXimCm7evVkyuZr7wzBG_QtFEQBw3Ixuv17Yxh6vYakodIjDAUwhmeDf0-qOmv014E9da38Ujv63eiaA55IijcYdznkvkXEcKODP8MIwjPnK0vh5OxuLDYsD-y_-h6zOghqF4euanbsmi17tjinI80Bce7NI',
    alt: 'Fall armyworm caterpillar on a maize leaf',
    signs: 'Window-pane feeding, ragged leaves, and fresh frass in the whorl.',
    management: 'Scout maize whorls regularly, protect natural enemies, and use locally approved integrated pest management. If a pesticide is needed, confirm current TPHPA registration and follow its label.',
  },
  {
    id: 'tomato-leafminer',
    name: 'Tomato Leafminer',
    scientificName: 'Tuta absoluta',
    category: 'Insect Pest',
    group: 'Insect Pests',
    severity: 'Critical',
    crops: ['Tomato', 'Potato'],
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXbE2afpItOwqct3AdbPESSf67tYCAzJLGUu6XotLuOzHlxSY-ET1L6iOf-0SsnioBn2pafvRGYiNp-lozgiP1VjD7hATuQddeAXs8seDRtKdR5Il8Fk_X2muncY4Ehf_qAnMHwAwnaFqmWUmoQG67SBpFts5yc2-XgrOeTjqyNCK1D1E5_3yCH3IzrzsYcaSNd-YIEGNH7_5r871SCm_oS_j7zLAqBpwBa8wYPp-xMg97GH7ut1ojfvD9pD9vG6E9W6gy0sG7km8',
    alt: 'Tomato leaf showing leafminer damage',
    signs: 'Serpentine leaf mines, damaged shoots, and pinholes in fruit.',
    management: 'Remove and safely dispose of infested plant material, monitor with suitable traps, and rotate crops. Ask an extension officer about locally registered controls before treating.',
  },
  {
    id: 'maize-stalk-borer',
    name: 'Maize Stalk Borer',
    scientificName: 'Busseola fusca',
    category: 'Insect Pest',
    group: 'Insect Pests',
    severity: 'Medium',
    crops: ['Maize', 'Millet'],
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDYh97wCMmWMi5ciHu1rc09BeU4YLwS8VWLF2pWLx5dTvnVEcMhgGCpFkwCqrGspsMM3x2_H_TkSGUZd9266qJRGZ6PhzthVLaiajeCzfAK895oBZttXqtNdkhTvzhg1WnRC7gxB68jobE3IKfH9zF3_8C5sCq2puOOvEbzgZ93X2_ojfvzkACEovBg3DFmgj5Bxs2kZYITo1fijZcjvD6YGbDtduoK_TJ0GV3senyA7_H7pgWIaiDRdMnKsRqEl95-oJyAAufSqjo',
    alt: 'Maize stalk showing signs of borer damage',
    signs: 'Shot holes in leaves, stem tunnelling, and dead-heart symptoms.',
    management: 'Scout young crops, remove heavily infested crop residues after harvest, and use locally recommended cultural and biological controls.',
  },
  {
    id: 'bean-rust',
    name: 'Bean Rust',
    scientificName: 'Uromyces appendiculatus',
    category: 'Fungal Disease',
    group: 'Fungal Diseases',
    severity: 'Medium',
    crops: ['Common Beans'],
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD4FYRNQt4P7C69LytliLm6aXXh4Iwy-i0eOWRuPKf63lnaTUbbHa4tTRxkJ_Ta0SGxMcdEu35S6ePJJHUAtrZcdF9xnzM4wRNBtdHu_BkSRxIZBfEY1-TxSZQZQgCwGC4-6JDao1LZsg-IevR-GU6zIG-hW-t85bL8gkEmWMxiionclH1EzPBj3vND4BBoL9YHtEtGbyO1NJdsmmIgXy2G3dxjcjJXCiW-r5AUyR99OujoIokiSl_CcQsL1rkl5rwyfMsm5YRzJaQ',
    alt: 'Bean leaves with visible rust pustules',
    signs: 'Small orange-brown pustules, often on the undersides of bean leaves.',
    management: 'Use clean seed and resistant varieties when available, rotate away from beans, and avoid prolonged leaf wetness. Confirm suspected cases with an agronomist before choosing a treatment.',
  },
];

const filters = ['All Threats', 'Insect Pests', 'Fungal Diseases', 'Viral/Bacterial'];

const resourceHandbook = [
  'JICHO AI | RESPONSIBLE CROP PROTECTION HANDBOOK',
  '',
  'General integrated pest management guidance',
  '',
  '1. Scout fields regularly and record crop, location, symptoms, and affected area.',
  '2. Confirm a diagnosis with a qualified extension officer when symptoms are unclear.',
  '3. Start with prevention, crop hygiene, resistant varieties, crop rotation, and protection of beneficial organisms.',
  '4. Use only products currently registered by TPHPA for the crop and pest listed on the label.',
  '5. Follow the product label, personal protective equipment, pre-harvest interval, and safe storage and disposal instructions.',
  '6. Never mix products or change application rates without label and qualified professional guidance.',
  '',
  'This general reference is not a product label or a substitute for local extension advice.',
  'Check current registrations and official guidance at https://www.tphpa.go.tz/.',
].join('\n');

function downloadTextFile(filename, contents) {
  const file = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ThreatCard({ threat, onOpenGuide }) {
  return (
    <article className="jicho-threat-card">
      <div className="jicho-threat-image">
        <img src={threat.image} alt={threat.alt} loading="lazy" />
        <span className={`jicho-threat-severity ${threat.severity.toLowerCase()}`}>{threat.severity}</span>
      </div>
      <div className="jicho-threat-body">
        <span className="jicho-threat-category">{threat.category}</span>
        <h3>{threat.name}</h3>
        <p className="jicho-threat-scientific">{threat.scientificName}</p>
        <div className="jicho-threat-crops">{threat.crops.map((crop) => <span key={crop}>{crop}</span>)}</div>
        <button type="button" className="jicho-threat-guide-button" onClick={() => onOpenGuide(threat)}>View Management Guide</button>
      </div>
    </article>
  );
}

export default function JichoPestKnowledge({ search = '', onSearch, onScan, onMap }) {
  const [filter, setFilter] = useState(filters[0]);
  const [activeThreat, setActiveThreat] = useState(null);
  const [reportNotice, setReportNotice] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  const visibleThreats = useMemo(() => threats.filter((threat) => {
    const matchesCategory = filter === 'All Threats'
      || (filter === 'Viral/Bacterial' ? threat.group === 'Viral/Bacterial' : threat.group === filter);
    const matchesSearch = !normalizedSearch || [
      threat.name,
      threat.scientificName,
      threat.category,
      threat.signs,
      ...threat.crops,
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
    return matchesCategory && matchesSearch;
  }), [filter, normalizedSearch]);

  const generateReport = () => {
    const report = [
      'JICHO AI | PEST & DISEASE FIELD REPORT',
      `Generated: ${new Date().toLocaleString()}`,
      `Category: ${filter}`,
      `Search: ${search.trim() || 'All threats'}`,
      '',
      ...visibleThreats.flatMap((threat) => [
        `${threat.name} (${threat.scientificName})`,
        `Category: ${threat.category} | Risk: ${threat.severity}`,
        `Crops: ${threat.crops.join(', ')}`,
        `Signs: ${threat.signs}`,
        `Management: ${threat.management}`,
        '',
      ]),
      'Use registered products only and follow their approved labels. Confirm field diagnosis with a qualified extension officer.',
    ].join('\n');
    downloadTextFile('jicho-pest-disease-report.txt', report);
    setReportNotice(`Report downloaded with ${visibleThreats.length} ${visibleThreats.length === 1 ? 'threat' : 'threats'}.`);
  };

  return (
    <section className="jicho-pest-knowledge" aria-labelledby="jicho-pest-title">
      <header className="jicho-pest-heading">
        <h1 id="jicho-pest-title">Pests &amp; Diseases Knowledge Base</h1>
        <p>Access critical intelligence on agricultural threats. Use Jicho AI vision to identify crop damage or browse practical, responsible management guidance.</p>
      </header>

      <div className="jicho-pest-layout">
        <aside className="jicho-pest-sidebar">
          <section className="jicho-outbreak-radar">
            <div className="jicho-outbreak-title"><h2><span className="material-symbols-outlined">radar</span>Outbreak Radar</h2><span>Live Updates</span></div>
            <p>Regional reports indicate elevated scouting priority for maize and tomato crops.</p>
            <div className="jicho-outbreak-list">
              <article><span><strong>Iringa Region</strong><small>Fall Armyworm · High risk</small></span><span className="material-symbols-outlined risk-high">warning</span></article>
              <article><span><strong>Mbeya Region</strong><small>Bean Rust · Emerging</small></span><span className="material-symbols-outlined">info</span></article>
              <article><span><strong>Morogoro Region</strong><small>Tomato Leafminer · Critical</small></span><span className="material-symbols-outlined risk-high">warning</span></article>
            </div>
            <button type="button" className="jicho-outbreak-map" onClick={onMap}>View Detailed Map</button>
          </section>

          <section className="jicho-vision-cta">
            <span className="material-symbols-outlined jicho-vision-watermark" aria-hidden="true">document_scanner</span>
            <div><h2>Jicho Vision</h2><p>Don't recognize the damage? Upload a photo for an AI diagnosis and tailored next steps.</p><button type="button" onClick={onScan}><span className="material-symbols-outlined">photo_camera</span>Scan Crop Now</button></div>
          </section>
        </aside>

        <section className="jicho-threat-library" aria-label="Pest and disease library">
          <div className="jicho-threat-toolbar">
            <label className="jicho-threat-search">
              <span className="material-symbols-outlined">search</span>
              <input type="search" value={search} onChange={(event) => onSearch?.(event.target.value)} placeholder="Search pests, diseases, or symptoms..." aria-label="Search pests, diseases, or symptoms" />
            </label>
            <div className="jicho-threat-filters" role="group" aria-label="Filter threats">
              {filters.map((option) => <button type="button" key={option} className={filter === option ? 'active' : ''} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}
            </div>
            <button type="button" className="jicho-threat-report" onClick={generateReport}>
              <span className="material-symbols-outlined" aria-hidden="true">download</span>
              Download Field Report
            </button>
          </div>
          {visibleThreats.length ? (
            <div className="jicho-threat-grid">
              {visibleThreats.map((threat) => <ThreatCard key={threat.id} threat={threat} onOpenGuide={setActiveThreat} />)}
            </div>
          ) : (
            <div className="jicho-threat-empty" role="status"><span className="material-symbols-outlined">search_off</span><strong>No matching threats found</strong><p>Try a different search or category.</p><button type="button" onClick={() => { setFilter(filters[0]); onSearch?.(''); }}>Clear filters</button></div>
          )}
        </section>
      </div>

      <section className="jicho-control-resources">
        <span className="material-symbols-outlined jicho-resources-icon">verified_user</span>
        <div className="jicho-resources-copy"><h2>Control Resources</h2><p>Use TPHPA-registered treatments and sustainable integrated pest management strategies.</p></div>
        <div className="jicho-resource-links">
          <button type="button" onClick={() => { downloadTextFile('jicho-responsible-crop-protection-handbook.txt', resourceHandbook); setReportNotice('Responsible crop protection handbook downloaded.'); }}><span className="material-symbols-outlined">description</span>Download Pesticide Handbook</button>
          <a href="https://www.tphpa.go.tz/" target="_blank" rel="noreferrer"><span className="material-symbols-outlined">open_in_new</span>Official TPHPA Portal</a>
        </div>
      </section>

      <div className="jicho-report-status" role="status" aria-live="polite">
        {reportNotice && <>{reportNotice}<button type="button" onClick={() => setReportNotice('')} aria-label="Dismiss report message"><span className="material-symbols-outlined">close</span></button></>}
      </div>

      {activeThreat && (
        <div className="jicho-threat-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveThreat(null); }}>
          <section className="jicho-threat-modal" role="dialog" aria-modal="true" aria-labelledby="jicho-threat-modal-title">
            <button type="button" className="jicho-threat-modal-close" aria-label="Close management guide" onClick={() => setActiveThreat(null)}><span className="material-symbols-outlined">close</span></button>
            <img src={activeThreat.image} alt={activeThreat.alt} />
            <span className="jicho-threat-category">{activeThreat.category} · {activeThreat.severity} risk</span>
            <h2 id="jicho-threat-modal-title">{activeThreat.name}</h2>
            <p className="jicho-threat-scientific">{activeThreat.scientificName}</p>
            <div><h3>What to look for</h3><p>{activeThreat.signs}</p></div>
            <div><h3>Management guidance</h3><p>{activeThreat.management}</p></div>
            <p className="jicho-threat-safety-note">Always confirm the diagnosis and check current TPHPA registrations and product labels before using any crop-protection product.</p>
            <button type="button" className="jicho-threat-guide-button" onClick={() => setActiveThreat(null)}>Close Guide</button>
          </section>
        </div>
      )}
    </section>
  );
}
