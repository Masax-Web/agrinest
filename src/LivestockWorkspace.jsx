import { useMemo, useState } from 'react';

const animalSpecies = ['Cattle', 'Goat', 'Sheep', 'Chicken', 'Pig', 'Other'];
const animalHealthOptions = ['healthy', 'under treatment', 'needs attention', 'not assessed'];
const healthEventTypes = ['Vaccination', 'Deworming', 'Treatment', 'Vet visit', 'Health check'];

function createId() {
  return globalThis.crypto?.randomUUID?.() || `livestock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return 'Date not recorded';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTzs(value) {
  return `TZS ${Number(value || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}

function formatCompactTzs(value) {
  return `TZS ${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
}

function compareNewestFirst(left, right) {
  const leftDate = new Date(left.date || left.createdAt || 0).getTime();
  const rightDate = new Date(right.date || right.createdAt || 0).getTime();
  const primary = (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  if (primary) return primary;
  const leftCreated = new Date(left.createdAt || 0).getTime();
  const rightCreated = new Date(right.createdAt || 0).getTime();
  return (Number.isFinite(rightCreated) ? rightCreated : 0) - (Number.isFinite(leftCreated) ? leftCreated : 0);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeAnimalCode(species, existingAnimals) {
  const prefix = String(species || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'ANI';
  const existingIds = new Set(existingAnimals.map((animal) => String(animal.animalId || '').toLowerCase()));
  let nextNumber = existingAnimals.filter((animal) => String(animal.species || '').toLowerCase() === String(species).toLowerCase()).length + 1;
  let animalId = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  while (existingIds.has(animalId.toLowerCase())) {
    nextNumber += 1;
    animalId = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }
  return animalId;
}

function LivestockWorkspace({ profile, records, search = '', onSearch, onRecordsChange, onProfileSave, onBack }) {
  const [dialog, setDialog] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [animalFilter, setAnimalFilter] = useState('active');
  const [editingAnimalId, setEditingAnimalId] = useState('');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [healthLogOpen, setHealthLogOpen] = useState(false);
  const [animalDraft, setAnimalDraft] = useState({
    animalId: '', species: 'Cattle', breed: '', count: '1', age: '', earTag: '',
    health: 'not assessed', reproductiveStatus: 'not recorded', lastWeight: '', status: 'active',
  });
  const [milkDraft, setMilkDraft] = useState({ liters: '', date: localDateValue(), animalId: '', notes: '' });
  const [healthDraft, setHealthDraft] = useState({
    eventType: 'Vaccination', animalId: '', date: localDateValue(), dueDate: '', provider: '', notes: '',
  });
  const [quoteDraft, setQuoteDraft] = useState({
    species: 'Cattle', marketClass: '', market: profile.location || profile.region || '', price: '', date: localDateValue(),
  });

  const livestockRecords = Array.isArray(records.livestock) ? records.livestock : [];
  const activities = Array.isArray(records.activities) ? records.activities : [];
  const animals = livestockRecords.filter((record) => record.module === 'livestock' && record.species);
  const milkEntries = activities.filter((entry) => entry.module === 'livestock-milk');
  const healthEntries = activities.filter((entry) => entry.module === 'livestock-health');
  const marketQuotes = activities.filter((entry) => entry.module === 'livestock-market-quote');
  const baselineRecord = livestockRecords.find((record) => record.module === 'livestock-baseline');
  const animalHeadCount = animals
    .filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased')
    .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
  const legacyCountEntry = livestockRecords
    .filter((record) => record.module !== 'livestock' && record.module !== 'livestock-baseline' && Number.isFinite(Number(record.count)))
    .sort(compareNewestFirst)[0];
  const baselineHeads = Number(baselineRecord?.count
    ?? (animals.length
      ? Math.max(0, Number(profile.livestock || 0) - animalHeadCount)
      : Math.max(Number(profile.livestock || 0), Number(legacyCountEntry?.count || 0)))) || 0;
  const totalHeads = baselineHeads + animalHeadCount;
  const activeAnimals = animals.filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased');
  const assessedHeads = activeAnimals
    .filter((animal) => animal.health && animal.health !== 'not assessed')
    .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
  const healthyHeads = activeAnimals
    .filter((animal) => animal.health === 'healthy')
    .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
  const healthyPercent = assessedHeads ? Math.round((healthyHeads / assessedHeads) * 100) : null;
  const today = localDateValue();
  const milkToday = milkEntries
    .filter((entry) => String(entry.date).slice(0, 10) === today)
    .reduce((sum, entry) => sum + (Number(entry.liters) || 0), 0);
  const activeSpecies = [...new Set(activeAnimals.map((animal) => String(animal.species || '').trim()).filter(Boolean))];
  const quoteKey = (quote) => `${String(quote.species || '').toLowerCase()}|${String(quote.marketClass || '').trim().toLowerCase()}`;
  const quotesByKey = new Map();
  [...marketQuotes].sort(compareNewestFirst).forEach((quote) => {
    const key = quoteKey(quote);
    quotesByKey.set(key, [...(quotesByKey.get(key) || []), quote]);
  });
  const latestQuotes = [...quotesByKey.values()].map(([latest, previous]) => ({
    ...latest,
    change: previous && Number(previous.price) > 0
      ? ((Number(latest.price) - Number(previous.price)) / Number(previous.price)) * 100
      : null,
  }));
  const latestSpeciesQuotes = new Map();
  [...marketQuotes].sort(compareNewestFirst)
    .forEach((quote) => {
      const key = String(quote.species || '').toLowerCase();
      if (!latestSpeciesQuotes.has(key)) latestSpeciesQuotes.set(key, quote);
    });
  const canEstimateValue = baselineHeads === 0
    && activeAnimals.length > 0
    && activeSpecies.length > 0
    && activeSpecies.every((species) => latestSpeciesQuotes.has(species.toLowerCase()));
  const estimatedMarketValue = canEstimateValue
    ? activeAnimals.reduce((sum, animal) => sum
      + (Number(animal.count) || 0) * Number(latestSpeciesQuotes.get(String(animal.species).toLowerCase())?.price || 0), 0)
    : null;
  const milkWeek = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = localDateValue(date);
    return {
      date: key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      liters: milkEntries
        .filter((entry) => String(entry.date).slice(0, 10) === key)
        .reduce((sum, entry) => sum + (Number(entry.liters) || 0), 0),
    };
  }), [milkEntries]);
  const maxMilk = Math.max(...milkWeek.map((day) => day.liters), 0);
  const dueEvents = healthEntries
    .filter((entry) => entry.status !== 'completed' && entry.dueDate)
    .map((entry) => {
      const dueDate = new Date(`${String(entry.dueDate).slice(0, 10)}T12:00:00`);
      return { ...entry, daysUntilDue: Math.ceil((dueDate - new Date(`${today}T12:00:00`)) / 86400000) };
    })
    .filter((entry) => entry.daysUntilDue <= 7)
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue);
  const recentVetVisit = [...healthEntries]
    .filter((entry) => entry.eventType === 'Vet visit')
    .sort(compareNewestFirst)[0];
  const visibleAnimals = useMemo(() => animals.filter((animal) => {
    const isActive = animal.status !== 'sold' && animal.status !== 'deceased';
    const matchesStatus = animalFilter === 'all' || (animalFilter === 'active' ? isActive : !isActive);
    const text = `${animal.animalId} ${animal.earTag} ${animal.species} ${animal.breed} ${animal.health}`.toLowerCase();
    return matchesStatus && (!search.trim() || text.includes(search.trim().toLowerCase()));
  }), [animals, animalFilter, search]);

  const saveHerd = (nextRecords) => {
    const nextAnimals = nextRecords.filter((record) => record.module === 'livestock' && record.species);
    const existingBaseline = nextRecords.find((record) => record.module === 'livestock-baseline');
    const nextAnimalHeads = nextAnimals
      .filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased')
      .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
    const nextBaseline = existingBaseline ? Number(existingBaseline.count || 0) : baselineHeads;
    const withBaseline = existingBaseline || nextAnimals.length
      ? nextRecords.some((record) => record.module === 'livestock-baseline')
        ? nextRecords
        : [...nextRecords, { id: createId(), module: 'livestock-baseline', count: nextBaseline, createdAt: new Date().toISOString() }]
      : nextRecords;
    onRecordsChange('livestock', withBaseline);
    onProfileSave({ ...profile, livestock: String(nextBaseline + nextAnimalHeads) });
  };

  const openNewAnimal = () => {
    setFormError('');
    setEditingAnimalId('');
    setAnimalDraft({
      animalId: '', species: 'Cattle', breed: '', count: '1', age: '', earTag: '',
      health: 'not assessed', reproductiveStatus: 'not recorded', lastWeight: '', status: 'active',
    });
    setDialog('animal');
  };

  const openEditAnimal = (animal) => {
    setFormError('');
    setEditingAnimalId(animal.id);
    setAnimalDraft({
      animalId: animal.animalId || '', species: animal.species || 'Cattle', breed: animal.breed || '',
      count: String(animal.count || 1), age: animal.age || '', earTag: animal.earTag || '',
      health: animal.health || 'not assessed', reproductiveStatus: animal.reproductiveStatus || 'not recorded',
      lastWeight: animal.lastWeight || '', status: animal.status || 'active',
    });
    setDialog('animal');
  };

  const saveAnimal = (event) => {
    event.preventDefault();
    const count = Number(animalDraft.count);
    const species = animalDraft.species.trim();
    const animalId = animalDraft.animalId.trim() || makeAnimalCode(species, animals);
    if (!species || !Number.isInteger(count) || count < 1) {
      setFormError('Choose a species and enter a whole-number head count greater than zero.');
      return;
    }
    if (animals.some((animal) => animal.id !== editingAnimalId
      && (String(animal.animalId || '').toLowerCase() === animalId.toLowerCase()
        || (animalDraft.earTag.trim() && String(animal.earTag || '').toLowerCase() === animalDraft.earTag.trim().toLowerCase())))) {
      setFormError('That animal ID or ear tag is already in your register.');
      return;
    }
    const existing = livestockRecords.find((animal) => animal.id === editingAnimalId);
    const savedAnimal = {
      ...existing,
      ...animalDraft,
      animalId,
      species,
      breed: animalDraft.breed.trim(),
      count,
      earTag: animalDraft.earTag.trim(),
      lastWeight: animalDraft.lastWeight === '' ? '' : Number(animalDraft.lastWeight),
      id: editingAnimalId || createId(),
      module: 'livestock',
      updatedAt: new Date().toISOString(),
      ...(editingAnimalId ? {} : { createdAt: new Date().toISOString() }),
    };
    const next = editingAnimalId
      ? livestockRecords.map((animal) => animal.id === editingAnimalId ? savedAnimal : animal)
      : [...livestockRecords, savedAnimal];
    saveHerd(next);
    setFormError('');
    setDialog('');
    setNotice(editingAnimalId ? 'Animal record updated.' : 'Animal record added.');
  };

  const removeAnimal = (animal) => {
    if (!window.confirm(`Remove ${animal.animalId || animal.species} from your livestock register? This cannot be undone.`)) return;
    saveHerd(livestockRecords.filter((record) => record.id !== animal.id));
    setNotice('Animal record removed from your register.');
  };

  const updateActivity = (nextActivity) => onRecordsChange('activities', nextActivity);

  const openMilkDialog = () => {
    setFormError('');
    setMilkDraft({ liters: '', date: localDateValue(), animalId: '', notes: '' });
    setDialog('milk');
  };

  const saveMilk = (event) => {
    event.preventDefault();
    const liters = Number(milkDraft.liters);
    if (!Number.isFinite(liters) || liters <= 0 || !milkDraft.date || milkDraft.date > today) {
      setFormError('Enter a milk quantity above zero and choose a date that is not in the future.');
      return;
    }
    updateActivity([...activities, {
      id: createId(), module: 'livestock-milk', liters, date: milkDraft.date,
      animalId: milkDraft.animalId, notes: milkDraft.notes.trim(), createdAt: new Date().toISOString(),
    }]);
    setMilkDraft({ liters: '', date: localDateValue(), animalId: '', notes: '' });
    setFormError('');
    setDialog('');
    setNotice('Milk yield saved to your livestock production log.');
  };

  const saveHealthEvent = (event) => {
    event.preventDefault();
    if (!healthDraft.eventType || !healthDraft.date || (healthDraft.dueDate && healthDraft.dueDate < healthDraft.date)) {
      setFormError('Choose a valid event date. A follow-up date cannot be earlier than the event date.');
      return;
    }
    updateActivity([...activities, {
      ...healthDraft, id: createId(), module: 'livestock-health', status: 'open',
      notes: healthDraft.notes.trim(), provider: healthDraft.provider.trim(), createdAt: new Date().toISOString(),
    }]);
    setFormError('');
    setDialog('');
    setNotice('Health event saved. Follow-up reminders are based on the date you entered.');
  };

  const openHealthDialog = (animalId = '') => {
    setFormError('');
    setSelectedAnimalId(animalId);
    setHealthDraft({ eventType: 'Vaccination', animalId, date: localDateValue(), dueDate: '', provider: '', notes: '' });
    setDialog('health');
  };

  const openQuoteDialog = () => {
    setFormError('');
    setQuoteDraft({ species: 'Cattle', marketClass: '', market: profile.location || profile.region || '', price: '', date: localDateValue() });
    setDialog('quote');
  };

  const markHealthComplete = (healthId) => {
    updateActivity(activities.map((entry) => entry.id === healthId
      ? { ...entry, status: 'completed', completedAt: new Date().toISOString() }
      : entry));
    setNotice('Health reminder marked complete in your records.');
  };

  const saveMarketQuote = (event) => {
    event.preventDefault();
    const price = Number(quoteDraft.price);
    if (!quoteDraft.species || !quoteDraft.date || quoteDraft.date > today || !Number.isFinite(price) || price <= 0) {
      setFormError('Choose a species, enter a market price above zero, and record a quote date that is not in the future.');
      return;
    }
    updateActivity([...activities, {
      ...quoteDraft, id: createId(), module: 'livestock-market-quote', price,
      market: quoteDraft.market.trim(), marketClass: quoteDraft.marketClass.trim(),
      createdAt: new Date().toISOString(),
    }]);
    setQuoteDraft({ species: 'Cattle', marketClass: '', market: profile.location || profile.region || '', price: '', date: localDateValue() });
    setFormError('');
    setDialog('');
    setNotice('Market quote saved as a farmer-entered reference. It is not a live or verified price.');
  };

  const exportMilk = () => downloadCsv('agrinest-livestock-milk-yield.csv', [
    ['Date', 'Animal ID', 'Liters', 'Notes'],
    ...milkEntries.map((entry) => [entry.date, entry.animalId, entry.liters, entry.notes]),
  ]);
  const exportAnimals = () => downloadCsv('agrinest-livestock-register.csv', [
    ['Animal ID', 'Species', 'Breed', 'Count', 'Age', 'Ear tag', 'Health', 'Status', 'Last weight (kg)'],
    ...animals.map((animal) => [animal.animalId, animal.species, animal.breed, animal.count, animal.age, animal.earTag, animal.health, animal.status, animal.lastWeight]),
  ]);

  return (
    <main className="livestock-page" aria-label="Livestock Management">
      {notice && <div className="livestock-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <header className="livestock-heading">
        <div>
          <button type="button" className="livestock-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Dashboard</button>
          <span className="farmer-workspace-eyebrow">SHAMBA LANGU · ANIMAL RECORDS</span>
          <h1>Livestock Management</h1>
          <p>Track production, monitor herd health, and review farmer-entered market quotes.</p>
        </div>
        <div className="livestock-heading-actions">
          <button type="button" className="livestock-secondary-button" onClick={() => openHealthDialog()}><span className="material-symbols-outlined">medical_services</span>Log health event</button>
          <button type="button" className="livestock-primary-button" onClick={openNewAnimal}><span className="material-symbols-outlined">add</span>Add animal</button>
        </div>
      </header>

      <section className="livestock-stats" aria-label="Herd summary">
        <article className="livestock-stat"><span><span className="material-symbols-outlined">pets</span>Total head</span><strong>{totalHeads.toLocaleString()}</strong><small>{animals.length ? `${animals.length} saved herd record${animals.length === 1 ? '' : 's'}` : 'From your saved herd count'}</small></article>
        <article className="livestock-stat is-mint"><span><span className="material-symbols-outlined">water_drop</span>Milk today</span><strong>{milkToday.toLocaleString(undefined, { maximumFractionDigits: 1 })}<small> L</small></strong><small>{milkEntries.some((entry) => String(entry.date).slice(0, 10) === today) ? 'From today’s saved yield entries' : 'No milk yield recorded today'}</small></article>
        <article className="livestock-stat"><span><span className="material-symbols-outlined">monitor_heart</span>Healthy</span><strong>{healthyPercent === null ? '—' : `${healthyPercent}`}<small>{healthyPercent === null ? '' : '%'}</small></strong><small>{assessedHeads ? `${healthyHeads} of ${assessedHeads} assessed head` : 'No health assessments recorded'}</small></article>
        <article className="livestock-stat is-peach"><span><span className="material-symbols-outlined">account_balance_wallet</span>Market value</span><strong>{estimatedMarketValue === null ? '—' : formatCompactTzs(estimatedMarketValue)}</strong><small>{estimatedMarketValue === null ? 'Add herd records and local quotes' : 'Estimate from saved local quotes'}</small></article>
      </section>

      <div className="livestock-layout">
        <div className="livestock-main-column">
          <section className="livestock-card livestock-animal-card">
            <header className="livestock-card-heading">
              <div><h2>My Animals</h2><p>{activeAnimals.length} active herd record{activeAnimals.length === 1 ? '' : 's'} · {animalHeadCount.toLocaleString()} registered head</p></div>
              <div className="livestock-card-actions">
                <button type="button" className="livestock-small-button" onClick={exportAnimals} disabled={!animals.length}><span className="material-symbols-outlined">download</span>Export</button>
                <button type="button" className="livestock-primary-button" onClick={openNewAnimal}><span className="material-symbols-outlined">add</span>Add animal</button>
              </div>
            </header>
            <div className="livestock-table-tools">
              <label className="livestock-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => onSearch?.(event.target.value)} placeholder="Search ID, breed, or species" aria-label="Search livestock register" /></label>
              <label className="livestock-filter">Show<select value={animalFilter} onChange={(event) => setAnimalFilter(event.target.value)}><option value="active">Active</option><option value="all">All records</option><option value="inactive">Sold or deceased</option></select></label>
            </div>
            {visibleAnimals.length ? <div className="livestock-table-wrap"><table className="livestock-table">
              <thead><tr><th>ID &amp; breed</th><th>Type</th><th>Age / count</th><th>Health status</th><th>Actions</th></tr></thead>
              <tbody>{visibleAnimals.map((animal) => {
                const healthLabel = animal.reproductiveStatus === 'pregnant' ? 'Pregnant' : animal.status === 'sold' ? 'Sold' : animal.status === 'deceased' ? 'Deceased' : animal.health || 'Not assessed';
                const badgeType = healthLabel === 'healthy' || healthLabel === 'Healthy' ? 'healthy'
                  : healthLabel === 'Pregnant' ? 'pregnant'
                    : healthLabel === 'Sold' || healthLabel === 'Deceased' ? 'inactive' : 'attention';
                return <tr key={animal.id}>
                  <td><span className="livestock-animal-identity"><span className="livestock-animal-icon material-symbols-outlined">{animal.species?.toLowerCase() === 'chicken' ? 'egg_alt' : 'pets'}</span><span><strong>{animal.animalId || animal.earTag || animal.species}</strong><small>{animal.breed || 'Breed not recorded'}{animal.earTag ? ` · Tag ${animal.earTag}` : ''}</small></span></span></td>
                  <td>{animal.species}</td>
                  <td>{animal.age || 'Age not set'}<small className="livestock-count-subtext">{Number(animal.count || 1)} head</small></td>
                  <td><span className={`livestock-status-badge ${badgeType}`}>{healthLabel}</span></td>
                  <td><div className="livestock-row-actions"><button type="button" onClick={() => openEditAnimal(animal)}>Edit</button><button type="button" aria-label={`Log health event for ${animal.animalId || animal.species}`} onClick={() => openHealthDialog(animal.id)}>Log event</button>{animal.status !== 'sold' && animal.status !== 'deceased' && <button type="button" onClick={() => saveHerd(livestockRecords.map((entry) => entry.id === animal.id ? { ...entry, status: 'sold', updatedAt: new Date().toISOString() } : entry))}>Mark sold</button>}<button type="button" className="is-danger" onClick={() => removeAnimal(animal)}>Remove</button></div></td>
                </tr>;
              })}</tbody>
            </table></div> : <div className="livestock-empty"><span className="material-symbols-outlined">pets</span><strong>{animals.length ? 'No animal records match' : 'Your animal register is empty'}</strong><p>{animals.length ? 'Try another search or choose a different status.' : 'Add a herd record to keep animal identity, breed, and health details together.'}</p>{!animals.length && <button type="button" className="livestock-primary-button" onClick={openNewAnimal}><span className="material-symbols-outlined">add</span>Add first animal</button>}</div>}
            <p className="livestock-data-note">Animal identity, counts, and health status are farmer-entered and are not independently verified.</p>
          </section>

          <section className="livestock-card livestock-milk-card">
            <header className="livestock-card-heading">
              <div><h2>Daily Milk Yield</h2><p>Last 7 days · liters from your saved production log</p></div>
              <div className="livestock-card-actions"><button type="button" className="livestock-small-button" onClick={exportMilk} disabled={!milkEntries.length}><span className="material-symbols-outlined">download</span>Export</button><button type="button" className="livestock-secondary-button" onClick={openMilkDialog}><span className="material-symbols-outlined">add</span>Log milk</button></div>
            </header>
            {milkWeek.some((day) => day.liters > 0) ? <div className="livestock-chart" role="img" aria-label={`Milk yield over the last seven days: ${milkWeek.map((day) => `${day.label} ${day.liters} liters`).join(', ')}`}>
              <div className="livestock-chart-bars">{milkWeek.map((day) => <div className="livestock-chart-day" key={day.date}>
                <div className="livestock-chart-bar-wrap"><span className="livestock-chart-value">{day.liters ? `${day.liters} L` : ''}</span><i style={{ height: `${day.liters ? Math.max(8, day.liters / maxMilk * 100) : 0}%` }} /></div>
                <small>{day.label}</small>
              </div>)}</div>
            </div> : <div className="livestock-chart-empty"><span className="material-symbols-outlined">water_drop</span><strong>No milk yields recorded in the last seven days</strong><p>Log a milking entry to build your production chart.</p></div>}
          </section>
        </div>

        <aside className="livestock-sidebar">
          <section className="livestock-card livestock-health-card">
            <header className="livestock-sidebar-heading"><h2><span className="material-symbols-outlined">medical_services</span>Health &amp; Vet</h2><button type="button" aria-label="Add health event" onClick={() => openHealthDialog()}><span className="material-symbols-outlined">add</span></button></header>
            {dueEvents.length ? <div className="livestock-due-list">{dueEvents.slice(0, 3).map((entry) => <article className={`livestock-due-item ${entry.daysUntilDue < 0 ? 'is-overdue' : ''}`} key={entry.id}>
              <span className="material-symbols-outlined">warning</span><div><strong>{entry.eventType} {entry.daysUntilDue < 0 ? 'overdue' : 'due'}</strong><p>{entry.animalId ? `${animals.find((animal) => animal.id === entry.animalId)?.animalId || 'Animal'} · ` : ''}{formatDate(entry.dueDate)}</p><button type="button" onClick={() => markHealthComplete(entry.id)}>Mark complete</button></div>
            </article>)}</div> : <div className="livestock-no-reminders"><span className="material-symbols-outlined">event_available</span><p>No upcoming health reminders saved. Add a vaccination, deworming, or follow-up date to track it here.</p></div>}
            <article className="livestock-vet-visit"><span className="material-symbols-outlined">assignment</span><div><strong>Recent Vet Visit</strong>{recentVetVisit ? <><p>{recentVetVisit.provider || 'Provider not recorded'} · {recentVetVisit.notes || 'No visit notes'}</p><small>{formatDate(recentVetVisit.date)}</small></> : <><p>No vet visit has been added to your records.</p><small>Record visits to keep a health history.</small></>}</div></article>
            <button type="button" className="livestock-outline-button" onClick={() => setHealthLogOpen(true)}>View full log <span>{healthEntries.length}</span></button>
          </section>

          <section className="livestock-card livestock-market-card">
            <header className="livestock-sidebar-heading"><h2><span className="material-symbols-outlined">storefront</span>Market Prices</h2><span className="livestock-region">{profile.region || profile.district || 'Region not set'}</span></header>
            <p className="livestock-market-caption">Your saved local quotes · not a live market feed</p>
            {latestQuotes.length ? <ul className="livestock-price-list">{latestQuotes.slice(0, 5).map((quote) => <li key={quote.id}>
              <span><strong>{quote.species}{quote.marketClass ? ` (${quote.marketClass})` : ''}</strong><small>{quote.market || 'Market not recorded'} · {formatDate(quote.date)}</small></span>
              <span className="livestock-price-value"><strong>{formatTzs(quote.price)}</strong>{quote.change === null ? <small>First quote</small> : <small className={quote.change > 0 ? 'is-up' : quote.change < 0 ? 'is-down' : ''}>{quote.change > 0 ? '+' : ''}{quote.change.toFixed(1)}% vs previous</small>}</span>
            </li>)}</ul> : <div className="livestock-no-quotes"><span className="material-symbols-outlined">price_change</span><p>No local price quotes recorded yet.</p></div>}
            <p className="livestock-market-disclaimer">Prices and changes are based on entries you provide. They are not verified or financial advice.</p>
            <button type="button" className="livestock-outline-button" onClick={openQuoteDialog}><span className="material-symbols-outlined">add</span>Record market quote</button>
          </section>
        </aside>
      </div>

      {dialog && <div className="livestock-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(''); }}>
        <section className="livestock-modal" role="dialog" aria-modal="true" aria-labelledby="livestock-dialog-title">
          <header className="livestock-modal-heading"><div><span className="farmer-workspace-eyebrow">LIVESTOCK REGISTER</span><h2 id="livestock-dialog-title">{dialog === 'animal' ? editingAnimalId ? 'Edit animal record' : 'Add an animal' : dialog === 'milk' ? 'Log milk yield' : dialog === 'health' ? 'Record a health event' : 'Record a local market quote'}</h2></div><button type="button" aria-label="Close dialog" onClick={() => setDialog('')}><span className="material-symbols-outlined">close</span></button></header>
          {formError && <p className="livestock-form-error" role="alert">{formError}</p>}
          {dialog === 'animal' ? <form className="livestock-form" onSubmit={saveAnimal}>
            <div className="livestock-form-grid">
              <label>Species<input required list="livestock-species-options" value={animalDraft.species} onChange={(event) => setAnimalDraft((current) => ({ ...current, species: event.target.value }))} /><datalist id="livestock-species-options">{[...new Set([...animalSpecies, ...animals.map((animal) => animal.species).filter(Boolean)])].map((species) => <option key={species} value={species} />)}</datalist></label>
              <label>Animal ID<input value={animalDraft.animalId} onChange={(event) => setAnimalDraft((current) => ({ ...current, animalId: event.target.value }))} placeholder="Auto-generated if blank" /></label>
              <label>Breed<input value={animalDraft.breed} onChange={(event) => setAnimalDraft((current) => ({ ...current, breed: event.target.value }))} placeholder="e.g. Friesian" /></label>
              <label>Head count<input required type="number" min="1" step="1" value={animalDraft.count} onChange={(event) => setAnimalDraft((current) => ({ ...current, count: event.target.value }))} /></label>
              <label>Age or age range<input value={animalDraft.age} onChange={(event) => setAnimalDraft((current) => ({ ...current, age: event.target.value }))} placeholder="e.g. 3 years" /></label>
              <label>Ear tag (optional)<input value={animalDraft.earTag} onChange={(event) => setAnimalDraft((current) => ({ ...current, earTag: event.target.value }))} /></label>
              <label>Health assessment<select value={animalDraft.health} onChange={(event) => setAnimalDraft((current) => ({ ...current, health: event.target.value }))}>{animalHealthOptions.map((option) => <option key={option} value={option}>{option.replace(/^./, (character) => character.toUpperCase())}</option>)}</select></label>
              <label>Reproductive status<select value={animalDraft.reproductiveStatus} onChange={(event) => setAnimalDraft((current) => ({ ...current, reproductiveStatus: event.target.value }))}><option value="not recorded">Not recorded</option><option value="pregnant">Pregnant</option><option value="lactating">Lactating</option><option value="not applicable">Not applicable</option></select></label>
              <label>Last weight (kg)<input type="number" min="0" step="0.1" value={animalDraft.lastWeight} onChange={(event) => setAnimalDraft((current) => ({ ...current, lastWeight: event.target.value }))} /></label>
              {editingAnimalId && <label>Record status<select value={animalDraft.status} onChange={(event) => setAnimalDraft((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="sold">Sold</option><option value="deceased">Deceased</option></select></label>}
            </div>
            <p className="livestock-form-disclaimer">These are farmer-entered herd records. AGRI-NEST does not verify animal identity or diagnose animal health.</p>
            <div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>{editingAnimalId ? 'Save changes' : 'Add animal'}</button></div>
          </form> : dialog === 'milk' ? <form className="livestock-form" onSubmit={saveMilk}>
            <div className="livestock-form-grid"><label>Milk yield (liters)<input required type="number" min="0.1" step="0.1" value={milkDraft.liters} onChange={(event) => setMilkDraft((current) => ({ ...current, liters: event.target.value }))} /></label><label>Milking date<input required type="date" max={today} value={milkDraft.date} onChange={(event) => setMilkDraft((current) => ({ ...current, date: event.target.value }))} /></label><label>Animal or group (optional)<select value={milkDraft.animalId} onChange={(event) => setMilkDraft((current) => ({ ...current, animalId: event.target.value }))}><option value="">Not specified</option>{activeAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.animalId || animal.species} · {animal.species}</option>)}</select></label><label className="is-wide">Notes (optional)<textarea value={milkDraft.notes} onChange={(event) => setMilkDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div>
            <p className="livestock-form-disclaimer">Milk entries are recorded as provided by you; the app does not measure or verify production.</p><div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>Save yield</button></div>
          </form> : dialog === 'health' ? <form className="livestock-form" onSubmit={saveHealthEvent}>
            <div className="livestock-form-grid"><label>Event type<select value={healthDraft.eventType} onChange={(event) => setHealthDraft((current) => ({ ...current, eventType: event.target.value }))}>{healthEventTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Animal or group (optional)<select value={healthDraft.animalId || selectedAnimalId} onChange={(event) => setHealthDraft((current) => ({ ...current, animalId: event.target.value }))}><option value="">Whole herd / not specified</option>{activeAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.animalId || animal.species} · {animal.species}</option>)}</select></label><label>Event date<input required type="date" value={healthDraft.date} onChange={(event) => setHealthDraft((current) => ({ ...current, date: event.target.value }))} /></label><label>Next due / follow-up date<input type="date" min={healthDraft.date} value={healthDraft.dueDate} onChange={(event) => setHealthDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label><label>Vet or provider (optional)<input value={healthDraft.provider} onChange={(event) => setHealthDraft((current) => ({ ...current, provider: event.target.value }))} /></label><label className="is-wide">Notes<textarea value={healthDraft.notes} onChange={(event) => setHealthDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Treatment, vaccine name, or visit notes" /></label></div>
            <p className="livestock-form-disclaimer">This health log is not a veterinary diagnosis. Contact a qualified animal-health professional for urgent concerns.</p><div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>Save health event</button></div>
          </form> : <form className="livestock-form" onSubmit={saveMarketQuote}>
            <div className="livestock-form-grid"><label>Species<select value={quoteDraft.species} onChange={(event) => setQuoteDraft((current) => ({ ...current, species: event.target.value }))}>{animalSpecies.map((species) => <option key={species}>{species}</option>)}</select></label><label>Class or animal type (optional)<input value={quoteDraft.marketClass} onChange={(event) => setQuoteDraft((current) => ({ ...current, marketClass: event.target.value }))} placeholder="e.g. bull, heifer, mature goat" /></label><label>Price per head (TZS)<input required type="number" min="1" step="1" value={quoteDraft.price} onChange={(event) => setQuoteDraft((current) => ({ ...current, price: event.target.value }))} /></label><label>Market or location<input value={quoteDraft.market} onChange={(event) => setQuoteDraft((current) => ({ ...current, market: event.target.value }))} /></label><label>Quote date<input required type="date" max={today} value={quoteDraft.date} onChange={(event) => setQuoteDraft((current) => ({ ...current, date: event.target.value }))} /></label></div>
            <p className="livestock-form-disclaimer">Record a quote you observed or received. AGRI-NEST does not provide live market prices; the herd value estimate uses your latest saved quote per species.</p><div className="livestock-modal-actions"><button type="button" className="livestock-secondary-button" onClick={() => setDialog('')}>Cancel</button><button type="submit" className="livestock-primary-button"><span className="material-symbols-outlined">save</span>Save quote</button></div>
          </form>}
        </section>
      </div>}

      {healthLogOpen && <div className="livestock-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHealthLogOpen(false); }}>
        <section className="livestock-modal livestock-health-log-modal" role="dialog" aria-modal="true" aria-labelledby="livestock-health-log-title">
          <header className="livestock-modal-heading"><div><span className="farmer-workspace-eyebrow">ANIMAL HEALTH HISTORY</span><h2 id="livestock-health-log-title">Health &amp; vet log</h2></div><button type="button" aria-label="Close health log" onClick={() => setHealthLogOpen(false)}><span className="material-symbols-outlined">close</span></button></header>
          {healthEntries.length ? <div className="livestock-health-log">{[...healthEntries].sort(compareNewestFirst).map((entry) => <article key={entry.id}><span className="material-symbols-outlined">{entry.eventType === 'Vet visit' ? 'medical_services' : entry.eventType === 'Vaccination' ? 'vaccines' : 'health_and_safety'}</span><div><strong>{entry.eventType}</strong><p>{entry.notes || 'No notes recorded'}{entry.provider ? ` · ${entry.provider}` : ''}</p><small>{formatDate(entry.date)}{entry.dueDate ? ` · Follow-up ${formatDate(entry.dueDate)}` : ''}</small></div><span className={`livestock-status-badge ${entry.status === 'completed' ? 'healthy' : 'attention'}`}>{entry.status === 'completed' ? 'Completed' : 'Open'}</span>{entry.status !== 'completed' && entry.dueDate && <button type="button" onClick={() => markHealthComplete(entry.id)}>Complete</button>}</article>)}</div> : <div className="livestock-empty"><span className="material-symbols-outlined">medical_information</span><strong>No health events recorded</strong><p>Vaccinations, treatment notes, and vet visits you save will appear here.</p></div>}
        </section>
      </div>}
    </main>
  );
}

export default LivestockWorkspace;
