import { useEffect, useMemo, useState } from 'react';
import './AgriKnowledge.css';
import { KnowledgeImage, KnowledgeLoading, KnowledgeSearch, KnowledgeSourceStatus, KnowledgeSources } from './AgriKnowledgeComponents';
import useAgriKnowledge from './useAgriKnowledge';

const guideLabels = {
  siteSelection: 'Site selection',
  landPreparation: 'Land preparation',
  planting: 'Planting',
  nutrition: 'Soil & nutrition',
  waterAndWeeds: 'Water & weeds',
  pestsAndDiseases: 'Pest & disease scouting',
  harvestAndStorage: 'Harvest & storage',
  records: 'Farm records',
};

export default function JichoGrowingGuide({ onScan, onMarketplace, onExpert }) {
  const { catalog, illustrations, loading, error, retry, loadIllustration } = useAgriKnowledge('crops');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const crops = catalog?.crops || [];
  const visibleCrops = useMemo(() => {
    const query = search.trim().toLowerCase();
    return crops.filter((crop) => !query || [
      crop.name,
      crop.scientificName,
      crop.group,
      crop.summary,
      ...Object.values(crop.guide || {}),
    ].some((value) => String(value).toLowerCase().includes(query)));
  }, [crops, search]);
  const selectedCrop = visibleCrops.find((crop) => crop.id === selectedId) || visibleCrops[0];
  useEffect(() => {
    if (selectedCrop) loadIllustration(selectedCrop.id);
  }, [selectedCrop?.id, loadIllustration]);

  if (loading && !catalog) return <div className="agri-knowledge-page"><KnowledgeLoading onRetry={retry} /></div>;
  if (!catalog) return <div className="agri-knowledge-page"><KnowledgeLoading error={error} onRetry={retry} /></div>;

  return (
    <main className="agri-knowledge-page" aria-labelledby="crop-knowledge-title">
      <header className="agri-knowledge-heading">
        <div>
          <span className="agri-knowledge-eyebrow">JICHO · VERIFIED REFERENCES</span>
          <h1 id="crop-knowledge-title">Crop growing guides</h1>
          <p>Browse practical crop guidance for Tanzania. Local seasons, varieties, soil tests, and extension advice take priority over a one-size-fits-all calendar.</p>
        </div>
        <div className="agri-knowledge-actions">
          {onScan && <button type="button" className="agri-knowledge-primary" onClick={onScan}><span className="material-symbols-outlined">document_scanner</span>Scan a crop</button>}
          {onExpert && <button type="button" className="agri-knowledge-secondary" onClick={onExpert}><span className="material-symbols-outlined">support_agent</span>Ask an expert</button>}
          {onMarketplace && <button type="button" className="agri-knowledge-secondary" onClick={() => onMarketplace('')}><span className="material-symbols-outlined">storefront</span>Open marketplace</button>}
        </div>
      </header>

      <KnowledgeSourceStatus sources={catalog.sources} checkedAt={catalog.official_sources_checked_at} />
      <div className="agri-knowledge-content">
        <section className="agri-knowledge-library" aria-label="Crop catalog">
          <div className="agri-knowledge-toolbar">
            <KnowledgeSearch value={search} onChange={setSearch} label="Search crop guides" placeholder="Search crops, practices, or symptoms…" />
            <span>{visibleCrops.length} of {crops.length} crops</span>
          </div>
          {visibleCrops.length ? (
            <div className="agri-knowledge-grid">
              {visibleCrops.map((crop) => (
                <article className={`agri-knowledge-card ${selectedCrop?.id === crop.id ? 'is-selected' : ''}`} key={crop.id}>
                  <KnowledgeImage record={crop} illustration={illustrations[crop.id]} />
                  <button type="button" className="agri-knowledge-card-select" aria-pressed={selectedCrop?.id === crop.id} onClick={() => setSelectedId(crop.id)}>
                    <small>{crop.group}</small>
                    <strong>{crop.name}</strong>
                    <em>{crop.scientificName}</em>
                    <span>{crop.summary}</span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="agri-knowledge-message">No crop matches “{search}”. Try another crop name or topic.</p>
          )}
        </section>

        {selectedCrop && (
          <article className="agri-knowledge-detail" aria-live="polite">
            <div className="agri-knowledge-detail-heading">
              <div><span className="agri-knowledge-eyebrow">GROWING GUIDE</span><h2>{selectedCrop.name}</h2><p>{selectedCrop.summary}</p></div>
              <span className="agri-knowledge-pill">{selectedCrop.group}</span>
            </div>
            <KnowledgeImage record={selectedCrop} illustration={illustrations[selectedCrop.id]} className="is-detail-image" />
            <dl className="agri-knowledge-guide">
              {Object.entries(selectedCrop.guide).map(([key, text]) => (
                <div key={key}><dt>{guideLabels[key] || key}</dt><dd>{text}</dd></div>
              ))}
            </dl>
            <KnowledgeSources sourceIds={selectedCrop.sourceIds} sources={catalog.sources} />
          </article>
        )}
      </div>
      <p className="agri-knowledge-disclaimer">{catalog.notice} Catalog version {catalog.version}. Content is curated, not a live feed from government systems.</p>
    </main>
  );
}
