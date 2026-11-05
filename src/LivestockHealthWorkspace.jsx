import { useMemo, useState } from 'react';
import './LivestockHealthWorkspace.css';

const biosecurityChecks = [
  { id: 'footbath', title: 'Footbath active', detail: 'Mark when the entry footbath has been checked.' },
  { id: 'isolate-arrivals', title: 'Isolate arrivals', detail: 'Mark when new arrivals are being isolated.' },
  { id: 'clean-water', title: 'Clean water scan', detail: 'Mark after checking and cleaning water troughs.' },
  { id: 'staff-sanitization', title: 'Staff sanitization', detail: 'Mark after checking the staff entry log.' },
];

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return 'Date not recorded';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date not recorded'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function compareNewestFirst(left, right) {
  const leftDate = new Date(left.date || left.createdAt || 0).getTime();
  const rightDate = new Date(right.date || right.createdAt || 0).getTime();
  return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `livestock-health-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function exportHealthHistory(entries, animals) {
  const animalById = new Map(animals.map((animal) => [animal.id, animal]));
  const rows = [
    ['Date', 'Livestock ID', 'Treatment or vaccine', 'Dosage', 'Vet or provider', 'Status', 'Notes'],
    ...entries.map((entry) => [
      entry.date || '',
      animalById.get(entry.animalId)?.animalId || (entry.animalId ? 'Animal record' : 'Whole herd / not specified'),
      entry.eventType || '',
      entry.dosage || '',
      entry.provider || '',
      entry.status || 'recorded',
      entry.notes || '',
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'agrinest-livestock-health-history.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LivestockHealthWorkspace({
  profile,
  records,
  animals,
  healthEntries,
  dueEvents,
  totalHeads,
  healthyPercent,
  healthyHeads,
  assessedHeads,
  search,
  onSearch,
  onBack,
  onShowRegister,
  onSelectSection,
  onAddAnimal,
  onOpenHealthDialog,
  onMarkHealthComplete,
  onViewHealthLog,
  onRecordsChange,
}) {
  const [cardView, setCardView] = useState('grid');
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(4);
  const [biosecurityNotice, setBiosecurityNotice] = useState('');
  const today = localDateValue();
  const activityEntries = Array.isArray(records?.activities) ? records.activities : [];
  const biosecurityEntries = activityEntries.filter((entry) => entry.module === 'livestock-biosecurity' && entry.date === today);
  const biosecurityStatus = new Map();
  [...biosecurityEntries].sort(compareNewestFirst).forEach((entry) => {
    if (!biosecurityStatus.has(entry.itemKey)) biosecurityStatus.set(entry.itemKey, entry);
  });
  const activeAnimals = animals.filter((animal) => animal.status !== 'sold' && animal.status !== 'deceased');
  const searchedAnimals = useMemo(() => activeAnimals.filter((animal) => {
    if (!search.trim()) return true;
    const relatedEvents = healthEntries.filter((entry) => entry.animalId === animal.id);
    const searchText = `${animal.animalId} ${animal.earTag} ${animal.species} ${animal.breed} ${animal.health} ${relatedEvents.map((entry) => `${entry.eventType} ${entry.notes}`).join(' ')}`;
    return searchText.toLowerCase().includes(search.trim().toLowerCase());
  }), [activeAnimals, healthEntries, search]);
  const sortedHistory = [...healthEntries].sort(compareNewestFirst);
  const currentMonth = today.slice(0, 7);
  const vetVisitsThisMonth = healthEntries.filter((entry) => entry.eventType === 'Vet visit' && String(entry.date).slice(0, 7) === currentMonth).length;
  const vaccinatedAnimalIds = new Set(healthEntries
    .filter((entry) => entry.eventType === 'Vaccination' && entry.animalId)
    .map((entry) => entry.animalId));
  const wholeHerdVaccinationRecorded = healthEntries.some((entry) => entry.eventType === 'Vaccination' && !entry.animalId);
  const vaccinatedHeads = wholeHerdVaccinationRecorded
    ? totalHeads
    : activeAnimals.filter((animal) => vaccinatedAnimalIds.has(animal.id))
      .reduce((sum, animal) => sum + Math.max(0, Number(animal.count) || 0), 0);
  const overdueCount = dueEvents.filter((entry) => entry.daysUntilDue < 0).length;

  const toggleBiosecurityCheck = (check, checked) => {
    const nextEntry = {
      id: createId(),
      module: 'livestock-biosecurity',
      itemKey: check.id,
      itemLabel: check.title,
      checked,
      date: today,
      createdAt: new Date().toISOString(),
    };
    const nextActivities = [
      ...activityEntries.filter((entry) => !(entry.module === 'livestock-biosecurity' && entry.itemKey === check.id && entry.date === today)),
      nextEntry,
    ];
    onRecordsChange('activities', nextActivities);
    setBiosecurityNotice(`${check.title} ${checked ? 'marked complete' : 'marked incomplete'} for today.`);
  };

  const navigateToHealthHistory = () => document.getElementById('livestock-health-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const navigateToSchedule = () => document.getElementById('livestock-health-schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const navigateToMetrics = () => document.getElementById('livestock-health-metrics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="livestock-health-hub">
      <aside className="livestock-health-nav">
        <div className="livestock-health-brand"><strong>Agri-Nest</strong><span>LIVESTOCK HUB</span></div>
        <nav aria-label="Livestock workspace">
          <button type="button" onClick={onShowRegister}><span className="material-symbols-outlined">list_alt</span>Register</button>
          <button type="button" className="is-active" aria-current="page"><span className="material-symbols-outlined">vaccines</span>Health &amp; Vaccines</button>
          <button type="button" onClick={() => onSelectSection('production')}><span className="material-symbols-outlined">bar_chart</span>Production</button>
          <button type="button" onClick={() => onSelectSection('breeding')}><span className="material-symbols-outlined">pets</span>Breeding</button>
          <button type="button" onClick={() => onSelectSection('feed')}><span className="material-symbols-outlined">inventory_2</span>Feed Log</button>
          <button type="button" onClick={() => onSelectSection('sales')}><span className="material-symbols-outlined">storefront</span>Sales</button>
          <button type="button" onClick={() => onSelectSection('facilities')}><span className="material-symbols-outlined">home_work</span>Housing</button>
        </nav>
        <div className="livestock-health-nav-bottom">
          <button type="button" className="livestock-health-add" onClick={onAddAnimal}><span className="material-symbols-outlined">add_circle</span>Add Livestock</button>
          <span><span className="material-symbols-outlined">settings</span>Settings</span>
          <span><span className="material-symbols-outlined">help_outline</span>Support</span>
        </div>
      </aside>

      <div className="livestock-health-content">
        <header className="livestock-health-topbar">
          <button type="button" className="livestock-health-mobile-back" onClick={onBack} aria-label="Back to dashboard"><span className="material-symbols-outlined">arrow_back</span></button>
          <div className="livestock-health-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => onSearch?.(event.target.value)} placeholder="Search livestock, vaccines, or reports..." aria-label="Search livestock health records" /></div>
          <nav aria-label="Health workspace shortcuts">
            <button type="button" onClick={onBack}>Dashboard</button>
            <button type="button" onClick={navigateToHealthHistory}>Reports</button>
            <button type="button" onClick={navigateToMetrics}>Analytics</button>
          </nav>
          <button type="button" className="livestock-health-icon-button" aria-label="Upcoming schedule" onClick={navigateToSchedule}><span className="material-symbols-outlined">notifications</span>{dueEvents.length > 0 && <span className="livestock-health-notification-count">{dueEvents.length}</span>}</button>
          <button type="button" className="livestock-health-icon-button" aria-label="Health log help" onClick={onViewHealthLog}><span className="material-symbols-outlined">help_outline</span></button>
          <span className="livestock-health-avatar" aria-label={profile?.name || 'Farmer profile'}><span className="material-symbols-outlined">person</span></span>
        </header>

        <div className="livestock-health-main">
          <div className="livestock-health-title-row">
            <div>
              <div className="livestock-health-breadcrumb"><span>Livestock Hub</span><span>/</span><strong>Health &amp; Biosecurity</strong></div>
              <h1>Livestock Health &amp; Biosecurity</h1>
              <p>Review saved animal health records, upcoming follow-ups, and daily farm checks.</p>
            </div>
            <button type="button" className="livestock-health-primary" onClick={() => onOpenHealthDialog('', 'Health check')}><span className="material-symbols-outlined">medical_services</span>Log Health Check</button>
          </div>

          <p className="livestock-health-disclosure"><span className="material-symbols-outlined">info</span>Information here is entered by you and is not independently verified or a veterinary diagnosis. Contact a qualified animal-health professional for urgent concerns.</p>

          <section className="livestock-health-metrics" id="livestock-health-metrics" aria-label="Livestock health summary">
            <article><span className="livestock-health-metric-label">Head with Vaccination Notes</span><div className="livestock-health-metric-value">{vaccinatedHeads.toLocaleString()}<span className="material-symbols-outlined">vaccines</span></div><small>{totalHeads ? `of ${totalHeads} head · saved notes only; dates may be old` : 'Add livestock records to track notes'}</small></article>
            <article className={overdueCount ? 'is-alert' : ''}><span className="livestock-health-metric-label">Overdue Follow-ups</span><div className="livestock-health-metric-value"><span className="material-symbols-outlined">error</span>{overdueCount}</div><small>{overdueCount ? 'Based on dates you entered' : 'No overdue follow-ups in saved records'}</small></article>
            <article><span className="livestock-health-metric-label">Saved Herd Assessments</span><div className="livestock-health-metric-value is-healthy">{healthyPercent === null ? 'Not assessed' : `${healthyPercent}% healthy`}</div><small>{assessedHeads ? `${healthyHeads} of ${assessedHeads} assessed head · farmer-entered` : 'No health assessment recorded'}</small></article>
            <article><span className="livestock-health-metric-label">Vet Consultations</span><div className="livestock-health-metric-value"><span className="material-symbols-outlined">stethoscope</span>{vetVisitsThisMonth}</div><small>Saved visits this month</small></article>
          </section>

          <div className="livestock-health-columns">
            <section className="livestock-health-schedule" id="livestock-health-schedule">
              <header><h2><span className="material-symbols-outlined">event_upcoming</span>Upcoming Schedule</h2></header>
              {dueEvents.length ? <div className="livestock-health-schedule-list">{dueEvents.slice(0, 4).map((entry) => {
                const animal = animals.find((record) => record.id === entry.animalId);
                const isOverdue = entry.daysUntilDue < 0;
                return <article key={entry.id} className={isOverdue ? 'is-overdue' : ''}>
                  <span className="livestock-health-timeline-dot" />
                  <div><small>{isOverdue ? `${Math.abs(entry.daysUntilDue)} day${Math.abs(entry.daysUntilDue) === 1 ? '' : 's'} overdue` : entry.daysUntilDue === 0 ? 'Due today' : `In ${entry.daysUntilDue} day${entry.daysUntilDue === 1 ? '' : 's'}`}</small><strong>{entry.eventType}</strong><p>{animal?.animalId || 'Whole herd / not specified'}{animal ? ` · ${animal.species}` : ''}</p><time>{formatDate(entry.dueDate)}</time><button type="button" onClick={() => onMarkHealthComplete(entry.id)}>Mark Done</button></div>
                </article>;
              })}</div> : <div className="livestock-health-empty-schedule"><span className="material-symbols-outlined">event_available</span><strong>No upcoming reminders</strong><p>Save a follow-up date on a health record to see it here.</p></div>}
              <button type="button" className="livestock-health-text-button" onClick={onViewHealthLog}>View Full Calendar <span className="material-symbols-outlined">arrow_forward</span></button>
            </section>

            <section className="livestock-health-animal-section">
              <div className="livestock-health-section-heading"><div><h2>Individual Health Cards</h2><p>{activeAnimals.length} active saved herd record{activeAnimals.length === 1 ? '' : 's'}</p></div><div><button type="button" aria-label="Show health cards as a list" aria-pressed={cardView === 'list'} onClick={() => setCardView('list')}><span className="material-symbols-outlined">filter_list</span></button><button type="button" aria-label="Show health cards as a grid" aria-pressed={cardView === 'grid'} onClick={() => setCardView('grid')}><span className="material-symbols-outlined">grid_view</span></button></div></div>
              {searchedAnimals.length ? <div className={`livestock-health-animal-cards ${cardView === 'list' ? 'is-list' : ''}`}>{searchedAnimals.slice(0, 8).map((animal) => {
                const latestTreatment = healthEntries.filter((entry) => entry.animalId === animal.id)
                  .sort(compareNewestFirst)[0];
                const healthLabel = animal.health && animal.health !== 'not assessed'
                  ? animal.health.replace(/^./, (character) => character.toUpperCase())
                  : 'Not assessed';
                return <article className="livestock-health-animal-card" key={animal.id}>
                  <div className="livestock-health-animal-image"><span className="material-symbols-outlined">{String(animal.species).toLowerCase() === 'chicken' ? 'egg_alt' : 'pets'}</span><strong>{animal.animalId || animal.earTag || animal.species}</strong></div>
                  <div className="livestock-health-animal-info">
                    <div className="livestock-health-animal-title"><div><h3>{animal.animalId || animal.species}</h3><p>{animal.species}{animal.breed ? ` · ${animal.breed}` : ''} · {Number(animal.count || 1)} head</p></div><span className={`livestock-health-badge ${animal.health === 'healthy' ? 'is-healthy' : animal.health === 'needs attention' ? 'is-attention' : ''}`}>{healthLabel}</span></div>
                    <p className="livestock-health-last-treatment">{latestTreatment ? `Last recorded: ${latestTreatment.eventType} (${formatDate(latestTreatment.date)})` : 'No health treatment recorded'}</p>
                    <div className="livestock-health-animal-stats"><div><small>Temp</small><strong>Not recorded</strong></div><div><small>BCS</small><strong>Not recorded</strong></div><div><small>Weight</small><strong>{animal.lastWeight ? `${animal.lastWeight} kg` : 'Not recorded'}</strong></div></div>
                    <button type="button" className="livestock-health-card-action" onClick={() => onOpenHealthDialog(animal.id, 'Health check')}>Log health check</button>
                  </div>
                </article>;
              })}</div> : <div className="livestock-health-no-animals"><span className="material-symbols-outlined">pets</span><strong>{activeAnimals.length ? 'No livestock match your search' : 'No livestock records yet'}</strong><p>Add animals to see farmer-entered health records here.</p><button type="button" className="livestock-health-primary" onClick={onAddAnimal}><span className="material-symbols-outlined">add</span>Add Livestock</button></div>}
              <p className="livestock-health-data-note">Temperature and body-condition readings are shown only when supported by saved records; the app does not collect sensor data.</p>
            </section>

            <aside className="livestock-health-biosecurity">
              <header><h2><span className="material-symbols-outlined">verified_user</span>Biosecurity Focus</h2></header>
              <div className="livestock-health-biosecurity-body">
                <p>Farm protocol checklist · marked by you today</p>
                {biosecurityChecks.map((check) => {
                  const record = biosecurityStatus.get(check.id);
                  return <label className="livestock-health-check" key={check.id}><input type="checkbox" checked={record?.checked === true} onChange={(event) => toggleBiosecurityCheck(check, event.target.checked)} /><span><strong>{check.title}</strong><small>{record?.checked ? `Marked today · ${new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : check.detail}</small></span></label>;
                })}
                {biosecurityNotice && <p className="livestock-health-biosecurity-notice" role="status">{biosecurityNotice}</p>}
                <div className="livestock-health-quarantine"><span className="material-symbols-outlined">warning</span><div><strong>QUARANTINE STATUS</strong><p>No quarantine record is saved for this farm. This is not a veterinary or authority clearance.</p></div></div>
              </div>
            </aside>
          </div>

          <section className="livestock-health-history" id="livestock-health-history">
            <header><h2>Recent Medical History</h2><button type="button" onClick={() => exportHealthHistory(sortedHistory, animals)} disabled={!sortedHistory.length}>Export CSV <span className="material-symbols-outlined">download</span></button></header>
            {sortedHistory.length ? <div className="livestock-health-history-wrap"><table><thead><tr><th>Date</th><th>Livestock ID</th><th>Treatment/Vaccine</th><th>Dosage</th><th>Specialist / Vet</th><th>Status</th></tr></thead><tbody>{sortedHistory.slice(0, visibleHistoryCount).map((entry) => {
              const animal = animals.find((record) => record.id === entry.animalId);
              return <tr key={entry.id}><td>{formatDate(entry.date)}</td><td><strong>{animal?.animalId || (entry.animalId ? 'Animal record' : 'Whole herd')}</strong></td><td>{entry.eventType || 'Health event'}{entry.notes ? <small>{entry.notes}</small> : null}</td><td>{entry.dosage || 'Not recorded'}</td><td>{entry.provider || 'Not recorded'}</td><td><span className={`livestock-health-history-status ${entry.status === 'completed' ? 'is-completed' : 'is-open'}`}>{entry.status === 'completed' ? 'Completed' : entry.dueDate ? 'Follow-up' : 'Recorded'}</span></td></tr>;
            })}</tbody></table></div> : <div className="livestock-health-history-empty"><span className="material-symbols-outlined">medical_information</span><strong>No medical history recorded yet</strong><p>Health checks, treatments, vaccinations, and vet visits you save will appear here.</p></div>}
            {sortedHistory.length > visibleHistoryCount && <button type="button" className="livestock-health-load-more" onClick={() => setVisibleHistoryCount((count) => count + 4)}>Load More Treatment Records</button>}
          </section>
        </div>
      </div>
    </div>
  );
}
