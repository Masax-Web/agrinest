export function KnowledgeImage({ record, illustration, className = '' }) {
  const image = illustration?.image;
  return (
    <figure className={`agri-knowledge-image ${className}`}>
      {image ? (
        <img src={image.url} alt={`${record.name} reference image`} loading="lazy" />
      ) : (
        <div className="agri-knowledge-image-placeholder" role="img" aria-label={`${record.name} illustration unavailable`}>
          <span className="material-symbols-outlined" aria-hidden="true">image_not_supported</span>
          <span>{illustration?.loading
            ? 'Searching for a relevant, attributed image…'
            : illustration?.error || 'Select this item to search for a relevant, attributed image.'}</span>
        </div>
      )}
      {image && (
        <figcaption>
          <a href={image.page_url} target="_blank" rel="noreferrer">{image.source}: {image.title}</a>
          <span>{image.author} · <a href={image.license_url} target="_blank" rel="noreferrer">License: {image.license}</a></span>
        </figcaption>
      )}
    </figure>
  );
}

export function KnowledgeSources({ sourceIds = [], sources = [] }) {
  const selected = sources.filter((source) => sourceIds.includes(source.id));
  if (!selected.length) return null;
  return (
    <div className="agri-knowledge-sources">
      <h3>Verified reference sources</h3>
      <ul>
        {selected.map((source) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
            {source.publicationsUrl && <a href={source.publicationsUrl} target="_blank" rel="noreferrer">Official publications</a>}
            <span className={`agri-source-status ${source.status?.available ? 'is-available' : 'is-unavailable'}`}>
              {source.status?.available ? 'Site reachable' : 'Not reachable'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KnowledgeSourceStatus({ sources = [], checkedAt = '' }) {
  return (
    <section className="agri-knowledge-source-status" aria-label="Official source availability">
      <div>
        <strong>Official source availability</strong>
        <span>
          {checkedAt
            ? `Checked ${new Date(checkedAt).toLocaleString()}`
            : 'Waiting for source checks'}
          {' · '}This checks official site availability, not live alerts or live crop advice.
        </span>
      </div>
      <ul>
        {sources.map((source) => (
          <li key={source.id}>
            <span className={`agri-source-dot ${source.status?.available ? 'is-available' : 'is-unavailable'}`} aria-hidden="true" />
            <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
            <span>{source.status?.available ? 'Available' : source.status?.error || 'Check unavailable'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function KnowledgeLoading({ error, onRetry }) {
  if (!error) {
    return <p className="agri-knowledge-message" role="status">Loading knowledge catalog…</p>;
  }
  return (
    <div className="agri-knowledge-message is-error" role="alert">
      <strong>Knowledge catalog unavailable</strong>
      <span>{error}</span>
      {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function KnowledgeSearch({ value, onChange, label, placeholder }) {
  return (
    <label className="agri-knowledge-search">
      <span className="material-symbols-outlined" aria-hidden="true">search</span>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} placeholder={placeholder} />
    </label>
  );
}
