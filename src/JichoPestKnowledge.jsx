import { useMemo, useState } from 'react';
import './AgriKnowledge.css';
import { KnowledgeImage, KnowledgeLoading, KnowledgeSearch, KnowledgeSourceStatus, KnowledgeSources } from './AgriKnowledgeComponents';
import useAgriKnowledge from './useAgriKnowledge';

const filters = ['All', 'Crop pests', 'Crop diseases', 'Animal diseases'];

function threatGroup(threat) {
  const type = threat.type.toLowerCase();
  if (type.includes('pest')) return 'Crop pests';
  if (type.includes('livestock') || type.includes('poultry')) return 'Animal diseases';
  return 'Crop diseases';
}

function downloadReport(threats, sources) {
  const content = [
    'AGRI-NEST | PEST AND DISEASE REFERENCE',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    ...threats.flatMap((threat) => {
      const sourceNames = sources.filter((source) => threat.sourceIds.includes(source.id)).map((source) => source.name);
      return [
        `${threat.name} (${threat.scientificName})`,
        `Type: ${threat.type}`,
        `Hosts: ${threat.hosts.join(', ')}`,
        `Signs: ${threat.symptoms}`,
        `Prevention: ${threat.prevention}`,
        `Response: ${threat.response}`,
        `Escalation: ${threat.urgent}`,
        `References: ${sourceNames.join('; ')}`,
        '',
      ];
    }),
    'Educational reference only. Confirm diagnosis with an extension or veterinary professional. Follow official directions and product labels.',
  ].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'agrinest-pest-disease-reference.txt';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function JichoPestKnowledge({ search = '', onSearch, onScan }) {
  const { catalog, illustrations, loading, error, retry, loadIllustration } = useAgriKnowledge('threats');
  const [filter, setFilter] = useState(filters[0]);
  const [selectedThreat, setSelectedThreat] = useState(null);
  const [localSearch, setLocalSearch] = useState('');
  const query = (onSearch ? search : localSearch).trim().toLowerCase();
  const threats = catalog?.threats || [];
  const records = [...(catalog?.crops || []), ...(catalog?.livestock || [])];
  const visibleThreats = useMemo(() => threats.filter((threat) => {
    const matchesGroup = filter === 'All' || threatGroup(threat) === filter;
    const hostNames = threat.hosts.map((hostId) => records.find((item) => item.id === hostId)?.name || hostId);
    const matchesSearch = !query || [
      threat.name,
      threat.scientificName,
      threat.type,
      threat.symptoms,
      threat.prevention,
      ...hostNames,
    ].some((value) => String(value).toLowerCase().includes(query));
    return matchesGroup && matchesSearch;
  }), [threats, filter, records, query]);
  const hostNames = (threat) => threat.hosts.map((hostId) => records.find((item) => item.id === hostId)?.name || hostId);
  const openThreat = (threat) => {
    loadIllustration(threat.id);
    setSelectedThreat(threat);
  };

  if (loading && !catalog) return <div className="agri-knowledge-page"><KnowledgeLoading onRetry={retry} /></div>;
  if (!catalog) return <div className="agri-knowledge-page"><KnowledgeLoading error={error} onRetry={retry} /></div>;

  return (
    <main className="agri-knowledge-page" aria-labelledby="threat-knowledge-title">
      <header className="agri-knowledge-heading">
        <div>
          <span className="agri-knowledge-eyebrow">JICHO · SCOUTING & RESPONSE</span>
          <h1 id="threat-knowledge-title">Pest &amp; disease library</h1>
          <p>Compare common warning signs, prevention, and safe next steps for crops and animals. Symptoms are not a diagnosis.</p>
        </div>
        {onScan && <button type="button" className="agri-knowledge-primary" onClick={onScan}><span className="material-symbols-outlined">document_scanner</span>Scan a crop</button>}
      </header>

      <KnowledgeSourceStatus sources={catalog.sources} checkedAt={catalog.official_sources_checked_at} />
      <section className="agri-official-alerts" aria-label="Official alert availability">
        <div className="agri-official-alerts-icon"><span className="material-symbols-outlined">campaign</span></div>
        <div>
          <h2>Official alerts</h2>
          <p>No live outbreak feed is connected. The catalog does not claim that a pest or disease is currently present in any region. Check current notices directly with the responsible authority.</p>
          <div className="agri-official-links">
            {catalog.sources.filter((source) => ['tphpa', 'livestock-ministry', 'tma'].includes(source.id)).map((source) => (
              <a href={source.url} key={source.id} target="_blank" rel="noreferrer">{source.name}<span className="material-symbols-outlined">open_in_new</span></a>
            ))}
          </div>
        </div>
      </section>

      <div className="agri-threat-toolbar">
        <KnowledgeSearch
          value={onSearch ? search : localSearch}
          onChange={onSearch || setLocalSearch}
          label="Search pests and diseases"
          placeholder="Search a pest, disease, host, or symptom…"
        />
        <div className="agri-knowledge-filters" role="group" aria-label="Filter pest and disease guides">
          {filters.map((option) => <button type="button" key={option} className={filter === option ? 'is-active' : ''} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}
        </div>
        <button type="button" className="agri-knowledge-secondary" onClick={() => downloadReport(visibleThreats, catalog.sources)} disabled={!visibleThreats.length}>
          <span className="material-symbols-outlined">download</span>Download reference
        </button>
      </div>

      {visibleThreats.length ? (
        <div className="agri-knowledge-grid agri-threat-grid">
          {visibleThreats.map((threat) => (
            <article className="agri-knowledge-card agri-threat-card" key={threat.id}>
              <KnowledgeImage record={threat} illustration={illustrations[threat.id]} />
              <div className="agri-threat-card-copy">
                <span className="agri-knowledge-pill">{threat.type}</span>
                <h2>{threat.name}</h2>
                <em>{threat.scientificName}</em>
                <p><strong>Hosts:</strong> {hostNames(threat).join(', ')}</p>
                <p>{threat.symptoms}</p>
                <button type="button" className="agri-knowledge-text-button" onClick={() => openThreat(threat)}>Open guidance <span className="material-symbols-outlined">arrow_forward</span></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="agri-knowledge-message">No entries match this search and filter.</p>
      )}

      <p className="agri-knowledge-disclaimer">{catalog.notice} Content version {catalog.version}. If a notifiable disease is suspected, contact the relevant authority promptly and follow movement or reporting instructions.</p>

      {selectedThreat && (
        <div className="agri-knowledge-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedThreat(null); }}>
          <section className="agri-knowledge-modal" role="dialog" aria-modal="true" aria-labelledby="threat-detail-title">
            <button type="button" className="agri-knowledge-modal-close" aria-label="Close guidance" onClick={() => setSelectedThreat(null)}><span className="material-symbols-outlined">close</span></button>
            <KnowledgeImage record={selectedThreat} illustration={illustrations[selectedThreat.id]} className="is-detail-image" />
            <span className="agri-knowledge-eyebrow">{selectedThreat.type} · {hostNames(selectedThreat).join(', ')}</span>
            <h2 id="threat-detail-title">{selectedThreat.name}</h2>
            <em>{selectedThreat.scientificName}</em>
            <dl className="agri-knowledge-guide">
              <div><dt>What to look for</dt><dd>{selectedThreat.symptoms}</dd></div>
              <div><dt>Prevention</dt><dd>{selectedThreat.prevention}</dd></div>
              <div><dt>Next steps</dt><dd>{selectedThreat.response}</dd></div>
              <div><dt>When to escalate</dt><dd>{selectedThreat.urgent}</dd></div>
            </dl>
            <KnowledgeSources sourceIds={selectedThreat.sourceIds} sources={catalog.sources} />
            <p className="agri-knowledge-disclaimer">Do not treat from a photo or this summary alone. Confirm diagnosis and follow current official advice and, where applicable, the product label.</p>
          </section>
        </div>
      )}
    </main>
  );
}
