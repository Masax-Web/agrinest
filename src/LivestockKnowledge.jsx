import { useEffect, useMemo, useState } from 'react';
import './AgriKnowledge.css';
import { KnowledgeImage, KnowledgeLoading, KnowledgeSearch, KnowledgeSourceStatus, KnowledgeSources } from './AgriKnowledgeComponents';
import useAgriKnowledge from './useAgriKnowledge';

const careLabels = {
  feed: 'Feeding & nutrition',
  housing: 'Housing & welfare',
  health: 'Health & prevention',
  breeding: 'Breeding & reproduction',
  warningSigns: 'Seek veterinary help',
  dailyRecords: 'Useful daily records',
};

export default function LivestockKnowledge({ onBack }) {
  const { catalog, illustrations, loading, error, retry, loadIllustration } = useAgriKnowledge('livestock');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const animals = catalog?.livestock || [];
  const visibleAnimals = useMemo(() => {
    const query = search.trim().toLowerCase();
    return animals.filter((animal) => !query || [
      animal.name,
      animal.scientificName,
      animal.summary,
      ...Object.values(animal.care || {}),
    ].some((value) => String(value).toLowerCase().includes(query)));
  }, [animals, search]);
  const selectedAnimal = visibleAnimals.find((animal) => animal.id === selectedId) || visibleAnimals[0];
  useEffect(() => {
    if (selectedAnimal) loadIllustration(selectedAnimal.id);
  }, [selectedAnimal?.id, loadIllustration]);

  if (loading && !catalog) return <div className="agri-knowledge-page"><KnowledgeLoading onRetry={retry} /></div>;
  if (!catalog) return <div className="agri-knowledge-page"><KnowledgeLoading error={error} onRetry={retry} /></div>;

  return (
    <main className="agri-knowledge-page" aria-labelledby="livestock-knowledge-title">
      <button type="button" className="agri-knowledge-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Digital Farm</button>
      <header className="agri-knowledge-heading">
        <div>
          <span className="agri-knowledge-eyebrow">SHAMBA LANGU · ANIMAL CARE</span>
          <h1 id="livestock-knowledge-title">Livestock &amp; poultry guides</h1>
          <p>Browse practical care and record-keeping guidance for common farm species. Consult a qualified veterinarian or livestock officer for diagnosis and treatment.</p>
        </div>
      </header>
      <KnowledgeSourceStatus sources={catalog.sources.filter((source) => ['livestock-ministry', 'tphpa', 'tfs'].includes(source.id))} checkedAt={catalog.official_sources_checked_at} />
      <div className="agri-knowledge-content">
        <section className="agri-knowledge-library" aria-label="Livestock species catalog">
          <div className="agri-knowledge-toolbar">
            <KnowledgeSearch value={search} onChange={setSearch} label="Search livestock guides" placeholder="Search species, feeding, housing, or care…" />
            <span>{visibleAnimals.length} of {animals.length} species</span>
          </div>
          {visibleAnimals.length ? (
            <div className="agri-knowledge-grid">
              {visibleAnimals.map((animal) => (
                <article className={`agri-knowledge-card ${selectedAnimal?.id === animal.id ? 'is-selected' : ''}`} key={animal.id}>
                  <KnowledgeImage record={animal} illustration={illustrations[animal.id]} />
                  <button type="button" className="agri-knowledge-card-select" aria-pressed={selectedAnimal?.id === animal.id} onClick={() => setSelectedId(animal.id)}>
                    <strong>{animal.name}</strong>
                    <em>{animal.scientificName}</em>
                    <span>{animal.summary}</span>
                  </button>
                </article>
              ))}
            </div>
          ) : <p className="agri-knowledge-message">No species matches “{search}”. Try another term.</p>}
        </section>

        {selectedAnimal && (
          <article className="agri-knowledge-detail" aria-live="polite">
            <div className="agri-knowledge-detail-heading">
              <div><span className="agri-knowledge-eyebrow">SPECIES CARE GUIDE</span><h2>{selectedAnimal.name}</h2><p>{selectedAnimal.summary}</p></div>
            </div>
            <KnowledgeImage record={selectedAnimal} illustration={illustrations[selectedAnimal.id]} className="is-detail-image" />
            <dl className="agri-knowledge-guide">
              {Object.entries(selectedAnimal.care).map(([key, text]) => (
                <div key={key}><dt>{careLabels[key] || key}</dt><dd>{text}</dd></div>
              ))}
            </dl>
            <KnowledgeSources sourceIds={selectedAnimal.sourceIds} sources={catalog.sources} />
          </article>
        )}
      </div>
      <p className="agri-knowledge-disclaimer">{catalog.notice} Content version {catalog.version}; this is educational guidance, not a diagnosis or ration formulation.</p>
    </main>
  );
}
