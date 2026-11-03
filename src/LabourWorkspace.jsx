import { useMemo, useState } from 'react';

const skills = ['Harvesting', 'Weeding', 'Spraying', 'Irrigation', 'Management', 'Planting', 'Livestock care'];
const requestModules = {
  worker: 'labour-worker',
  job: 'labour-job',
  contract: 'labour-contract',
  application: 'labour-application',
};

function createId() {
  return globalThis.crypto?.randomUUID?.() || `labour-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTzs(amount) {
  return `TZS ${Number(amount || 0).toLocaleString('en-TZ')}`;
}

function formatShortDate(value) {
  if (!value) return 'Date not set';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Date not set' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function LabourWorkspace({ page, profile, records, onRecordsChange, onBack, onNavigate }) {
  const [mode, setMode] = useState('hire');
  const [query, setQuery] = useState('');
  const [activeSkill, setActiveSkill] = useState('');
  const [dialog, setDialog] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [notice, setNotice] = useState('');
  const [jobDraft, setJobDraft] = useState({ title: '', skill: 'Harvesting', location: profile.location || profile.region || '', workersNeeded: '1', dailyRate: '', startDate: '', durationDays: '', details: '' });
  const [workerDraft, setWorkerDraft] = useState({ name: profile.name || '', skill: '', location: profile.location || profile.region || '', dailyRate: '', experience: '', availability: 'available', bio: '' });
  const [paymentDraft, setPaymentDraft] = useState({ contractId: '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'Cash', reference: '', notes: '' });

  const requests = Array.isArray(records.requests) ? records.requests : [];
  const payrollRecords = Array.isArray(records.payroll) ? records.payroll : [];
  const workers = requests.filter((item) => item.module === requestModules.worker);
  const jobs = requests.filter((item) => item.module === requestModules.job);
  const contracts = requests.filter((item) => item.module === requestModules.contract);
  const applications = requests.filter((item) => item.module === requestModules.application);
  const activeContracts = contracts.filter((item) => item.status === 'active');
  const availableWorkers = workers.filter((worker) => worker.availability !== 'busy');
  const openJobs = jobs.filter((job) => job.status === 'open');
  const spentThisYear = payrollRecords
    .filter((item) => String(item.date || '').slice(0, 4) === String(new Date().getFullYear()))
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const paidWorkerIds = new Set(payrollRecords.map((item) => item.workerId).filter(Boolean));
  const filteredWorkers = useMemo(() => availableWorkers.filter((worker) => {
    const text = `${worker.name} ${worker.skill} ${worker.location} ${worker.bio}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!activeSkill || String(worker.skill || '').toLowerCase().includes(activeSkill.toLowerCase()));
  }), [availableWorkers, query, activeSkill]);
  const filteredJobs = useMemo(() => openJobs.filter((job) => {
    const text = `${job.title} ${job.skill} ${job.location} ${job.details}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!activeSkill || String(job.skill || '').toLowerCase().includes(activeSkill.toLowerCase()));
  }), [openJobs, query, activeSkill]);
  const averageRate = availableWorkers.length
    ? Math.round(availableWorkers.reduce((sum, worker) => sum + Number(worker.dailyRate || 0), 0) / availableWorkers.length)
    : 0;
  const skillCounts = [...availableWorkers.reduce((counts, worker) => {
    const skill = String(worker.skill || '').trim();
    if (skill) counts.set(skill, (counts.get(skill) || 0) + 1);
    return counts;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1]);
  const payrollTotal = payrollRecords.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const updateRequests = (next) => onRecordsChange('requests', next);

  const saveWorkerProfile = (event) => {
    event.preventDefault();
    if (!workerDraft.name.trim() || !workerDraft.skill.trim() || !workerDraft.location.trim() || Number(workerDraft.dailyRate) <= 0) {
      setNotice('Add a name, skill, location, and a daily rate above zero.');
      return;
    }
    updateRequests([...requests.filter((item) => !(item.module === requestModules.worker && item.ownerId === profile.name)), {
      ...workerDraft,
      name: workerDraft.name.trim(),
      skill: workerDraft.skill.trim(),
      location: workerDraft.location.trim(),
      dailyRate: Number(workerDraft.dailyRate),
      experience: String(workerDraft.experience || '').trim(),
      ownerId: profile.name,
      module: requestModules.worker,
      id: createId(),
      updatedAt: new Date().toISOString(),
    }]);
    setDialog('');
    setNotice('Worker profile saved. It is self-reported and only visible in this account.');
  };

  const saveJob = (event) => {
    event.preventDefault();
    const workersNeeded = Number(jobDraft.workersNeeded);
    const dailyRate = Number(jobDraft.dailyRate);
    const durationDays = Number(jobDraft.durationDays);
    if (!jobDraft.title.trim() || !jobDraft.skill.trim() || !jobDraft.location.trim()
      || !Number.isInteger(workersNeeded) || workersNeeded < 1 || dailyRate <= 0
      || !Number.isInteger(durationDays) || durationDays < 1) {
      setNotice('Complete the role, skill, work location, worker count, daily rate, and duration.');
      return;
    }
    updateRequests([...requests, {
      ...jobDraft,
      title: jobDraft.title.trim(),
      skill: jobDraft.skill.trim(),
      location: jobDraft.location.trim(),
      workersNeeded,
      dailyRate,
      durationDays,
      employer: profile.name,
      module: requestModules.job,
      status: 'open',
      id: createId(),
      createdAt: new Date().toISOString(),
    }]);
    setDialog('');
    setNotice('Work opportunity saved. It is private to this account until a shared worker directory is connected.');
  };

  const hireWorker = (worker) => {
    const contract = {
      id: createId(),
      module: requestModules.contract,
      workerId: worker.id,
      workerName: worker.name,
      skill: worker.skill,
      location: worker.location,
      dailyRate: Number(worker.dailyRate || 0),
      employer: profile.name,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    updateRequests([...requests, contract]);
    setSelectedWorker(null);
    setNotice('Hire request saved as pending. Confirm terms with the worker before activating a contract.');
  };

  const changeContractStatus = (contract, status) => {
    updateRequests(requests.map((item) => item.id === contract.id
      ? { ...item, status, statusUpdatedAt: new Date().toISOString() }
      : item));
    setNotice(status === 'active'
      ? 'Contract marked active. Confirm agreement with the worker before recording payroll.'
      : 'Contract marked completed.');
  };

  const savePayment = (event) => {
    event.preventDefault();
    const contract = contracts.find((item) => item.id === paymentDraft.contractId);
    const amount = Number(paymentDraft.amount);
    if (!contract || contract.status !== 'active' || !Number.isFinite(amount) || amount <= 0 || !paymentDraft.date) {
      setNotice('Select an active contract and enter a valid payment amount and date.');
      return;
    }
    onRecordsChange('payroll', [...payrollRecords, {
      ...paymentDraft,
      id: createId(),
      workerId: contract.workerId,
      workerName: contract.workerName,
      contractId: contract.id,
      amount,
      date: paymentDraft.date,
      module: 'labour-payment',
      createdAt: new Date().toISOString(),
    }]);
    setPaymentDraft({ contractId: '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'Cash', reference: '', notes: '' });
    setDialog('');
    setNotice('Payroll payment recorded on this account. No money was transferred by AGRI-NEST.');
  };

  const topNavigation = () => (
    <header className="labour-heading">
      <div>
        <span className="farmer-workspace-eyebrow">VIBARUA NETWORK</span>
        <h1>{page === 'payroll' ? 'Labour & Payroll' : 'Find agricultural work'}</h1>
        <p>{page === 'payroll' ? 'Keep contract terms and payments together.' : 'Find local opportunities or organise farm labour.'}</p>
      </div>
      <div className="labour-tabs" role="tablist" aria-label="Labour workspace">
        <button type="button" className={page === 'labour' && mode === 'hire' ? 'active' : ''} onClick={() => page !== 'labour' ? onNavigate('labour') : setMode('hire')}><span className="material-symbols-outlined">group_add</span>Hire Workers</button>
        <button type="button" className={page === 'labour' && mode === 'find' ? 'active' : ''} onClick={() => { if (page !== 'labour') onNavigate('labour'); setMode('find'); }}><span className="material-symbols-outlined">work</span>Find Work</button>
        <button type="button" className={page === 'payroll' ? 'active' : ''} onClick={() => onNavigate('payroll')}><span className="material-symbols-outlined">payments</span>Payroll</button>
      </div>
    </header>
  );

  if (page === 'payroll') {
    return (
      <main className="farmer-workspace labour-page" aria-label="Labour and payroll">
        {topNavigation()}
        {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
        <section className="labour-kpis" aria-label="Payroll summary">
          <article><span>PAYMENTS RECORDED THIS YEAR</span><strong>{formatTzs(spentThisYear)}</strong></article>
          <article><span>ACTIVE CONTRACTS</span><strong>{activeContracts.length}</strong></article>
          <article><span>WORKERS PAID</span><strong>{paidWorkerIds.size}</strong></article>
          <article><span>ALL-TIME PAYROLL</span><strong>{formatTzs(payrollTotal)}</strong></article>
        </section>
        <section className="labour-panel">
          <div className="labour-section-heading"><div><h2>Active Contracts</h2><p>Confirm agreed work terms before recording pay.</p></div>
            {activeContracts.length > 0 && <button type="button" className="labour-primary-button" onClick={() => setDialog('payment')}><span className="material-symbols-outlined">add</span>Record payment</button>}
          </div>
          {contracts.length ? <div className="labour-contract-list">{contracts.map((contract) => {
            const contractPayments = payrollRecords.filter((payment) => payment.contractId === contract.id);
            return <article className="labour-contract-card" key={contract.id}>
              <div><strong>{contract.workerName || 'Worker'} · {contract.skill || 'Farm work'}</strong><p>{contract.location || 'Location not set'} · {formatTzs(contract.dailyRate)} / day</p><small>{contractPayments.length} payment{contractPayments.length === 1 ? '' : 's'} recorded · {formatTzs(contractPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))}</small></div>
              <div className="labour-contract-actions"><span className={`labour-status is-${contract.status}`}>{contract.status}</span>{contract.status === 'pending' && <button type="button" onClick={() => changeContractStatus(contract, 'active')}>Confirm agreement</button>}{contract.status === 'active' && <button type="button" onClick={() => { setPaymentDraft((current) => ({ ...current, contractId: contract.id })); setDialog('payment'); }}>Pay worker</button>}{contract.status === 'active' && <button type="button" className="labour-quiet-button" onClick={() => changeContractStatus(contract, 'completed')}>Complete</button>}</div>
            </article>;
          })}</div> : <div className="labour-empty"><span className="material-symbols-outlined">receipt_long</span><strong>No contracts yet</strong><p>Hire workers to create a pending request, then confirm the agreed terms here.</p><button type="button" onClick={() => onNavigate('labour')}>Browse workers</button></div>}
        </section>
        <section className="labour-panel">
          <div className="labour-section-heading"><div><h2>Payment Ledger</h2><p>Farmer-entered records only; payments are not processed by AGRI-NEST.</p></div></div>
          {payrollRecords.length ? <div className="labour-table-wrap"><table className="labour-table"><thead><tr><th>Date</th><th>Worker</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{[...payrollRecords].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((payment) => <tr key={payment.id}><td>{formatShortDate(payment.date)}</td><td>{payment.workerName || 'Worker'}</td><td>{payment.method || 'Not set'}</td><td>{payment.reference || '—'}</td><td>{formatTzs(payment.amount)}</td></tr>)}</tbody></table></div> : <div className="labour-empty compact"><p>No payroll payments recorded.</p></div>}
        </section>
      </main>
    );
  }

  return (
    <main className="farmer-workspace labour-page" aria-label="Vibarua Network">
      {topNavigation()}
      {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      <section className="labour-kpis" aria-label="Labour network summary">
        <article className="labour-search-card">
          <label htmlFor="labour-search">Find specific skills</label>
          <div className="labour-search-input"><span className="material-symbols-outlined">search</span><input id="labour-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === 'hire' ? 'e.g., Harvesting, Weeding, Spraying…' : 'Search work by skill or location…'} /></div>
          <div className="labour-skill-chips">{skills.slice(0, 5).map((skill) => <button type="button" key={skill} className={activeSkill === skill ? 'active' : ''} onClick={() => setActiveSkill(activeSkill === skill ? '' : skill)}>{skill}</button>)}</div>
        </article>
        <article><span>{mode === 'hire' ? 'AVAILABLE WORKER PROFILES' : 'OPEN JOB POSTS'}</span><strong>{mode === 'hire' ? availableWorkers.length : openJobs.length}</strong><small>Self-reported · not independently verified</small></article>
        <article><span>AVERAGE DAILY RATE</span><strong>{averageRate ? formatTzs(averageRate) : '—'}</strong><small>{skillCounts[0] ? `Common skill: ${skillCounts[0][0]}` : 'Based on saved worker profiles'}</small></article>
      </section>
      <div className="labour-main-grid">
        <section className="labour-results">
          <div className="labour-section-heading"><div><h2>{mode === 'hire' ? 'Available Worker Profiles' : 'Open Farm Work'}</h2><p>{mode === 'hire' ? 'Only worker profiles saved to this account are listed.' : 'Work opportunities saved to this account.'}</p></div>
            {mode === 'hire' ? <button type="button" className="labour-primary-button" onClick={() => { setWorkerDraft((current) => ({ ...current, name: profile.name || current.name })); setDialog('worker'); }}><span className="material-symbols-outlined">person_add</span>Add worker profile</button> : <div className="labour-header-actions"><button type="button" className="labour-outline-button" onClick={() => { setWorkerDraft((current) => ({ ...current, name: profile.name || current.name })); setDialog('worker'); }}><span className="material-symbols-outlined">person_add</span>Worker profile</button><button type="button" className="labour-primary-button" onClick={() => setDialog('job')}><span className="material-symbols-outlined">add</span>Post a job</button></div>}
          </div>
          {mode === 'hire' ? (filteredWorkers.length ? <div className="labour-worker-grid">{filteredWorkers.map((worker) => {
            const active = contracts.filter((contract) => contract.workerId === worker.id && contract.status === 'active').length;
            return <article className="labour-worker-card" key={worker.id}>
              <div className="labour-worker-heading"><span className="labour-avatar">{String(worker.name || '?').trim().slice(0, 1).toUpperCase()}</span><div><h3>{worker.name}</h3><p>{worker.skill}</p></div></div>
              <div className="labour-worker-meta"><span><span className="material-symbols-outlined">location_on</span>{worker.location}</span><span><span className="material-symbols-outlined">payments</span>{formatTzs(worker.dailyRate)} / day</span></div>
              <p className="labour-worker-bio">{worker.bio || worker.experience || 'No experience details provided.'}</p>
              <div className="labour-worker-foot"><span className="labour-status is-self-reported">{worker.availability || 'available'} · self-reported</span><span>{active} active contract{active === 1 ? '' : 's'}</span></div>
              <div className="labour-card-actions"><button type="button" className="labour-primary-button" onClick={() => hireWorker(worker)}>Request hire</button><button type="button" className="labour-outline-button" onClick={() => setSelectedWorker(worker)} aria-label={`View ${worker.name} details`}><span className="material-symbols-outlined">chat</span>Details</button></div>
            </article>;
          })}</div> : <div className="labour-empty"><span className="material-symbols-outlined">groups</span><strong>{availableWorkers.length ? 'No matching worker profiles' : workers.length ? 'No workers currently available' : 'No worker profiles yet'}</strong><p>{availableWorkers.length ? 'Try another skill or search term.' : workers.length ? 'All saved worker profiles are marked busy.' : 'Add a worker profile to organise your network. Cross-account worker discovery is not connected yet.'}</p>{!workers.length && <button type="button" onClick={() => setDialog('worker')}>Add first worker profile</button>}</div>) : (filteredJobs.length ? <div className="labour-job-list">{filteredJobs.map((job) => {
            const applied = applications.some((application) => application.jobId === job.id && application.applicant === profile.name);
            const ownPost = job.employer === profile.name;
            return <article className="labour-job-card" key={job.id}><div><span className="labour-status is-open">{ownPost ? 'your post' : job.status}</span><h3>{job.title}</h3><p>{job.skill} · {job.location}</p><small>{job.workersNeeded} worker{Number(job.workersNeeded) === 1 ? '' : 's'} · {job.durationDays} days · starts {formatShortDate(job.startDate)}</small>{job.details && <p className="labour-worker-bio">{job.details}</p>}</div><div className="labour-job-side"><strong>{formatTzs(job.dailyRate)}<small> / day</small></strong><button type="button" className="labour-primary-button" disabled={ownPost || applied || job.status !== 'open'} onClick={() => { updateRequests([...requests, { id: createId(), module: requestModules.application, jobId: job.id, jobTitle: job.title, applicant: profile.name, createdAt: new Date().toISOString(), status: 'pending' }]); setNotice('Interest recorded in this account. Contact sharing and cross-account applications are not available yet.'); }}>{ownPost ? 'Your post' : applied ? 'Interest recorded' : 'I’m interested'}</button></div></article>;
          })}</div> : <div className="labour-empty"><span className="material-symbols-outlined">work</span><strong>{jobs.length ? 'No matching jobs' : 'No open jobs yet'}</strong><p>Post a work opportunity from Hire Workers to keep it in your farm records.</p><button type="button" onClick={() => setDialog('job')}>Post a job</button></div>)}
        </section>
        <aside className="labour-sidebar">
          <article className="labour-history-card"><h2>Your Hiring History</h2><div><span>Total payroll (YTD)</span><strong>{formatTzs(spentThisYear)}</strong></div><div><span>Workers hired</span><strong>{new Set(contracts.filter((contract) => contract.status !== 'pending').map((contract) => contract.workerId)).size}</strong></div><div><span>Active contracts</span><strong>{activeContracts.length}</strong></div><button type="button" onClick={() => onNavigate('payroll')}>View contracts &amp; payroll</button></article>
          <article className="labour-history-card"><h2><span className="material-symbols-outlined">military_tech</span>Top Skills</h2>{skillCounts.length ? skillCounts.slice(0, 5).map(([skill, count]) => <div className="labour-skill-row" key={skill}><span>{skill}</span><strong>{count}</strong></div>) : <p>No worker skill records yet. No ratings or rankings are fabricated.</p>}</article>
          <article className="labour-trust-note"><span className="material-symbols-outlined">info</span><p>Worker details are self-reported. AGRI-NEST does not yet verify identities, ratings, references, or employment history.</p></article>
        </aside>
      </div>

      {dialog && <div className="digital-farm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(''); }}>
        <section className="digital-farm-dialog labour-dialog" role="dialog" aria-modal="true" aria-labelledby="labour-dialog-title">
          <div className="digital-farm-dialog-heading"><div><span className="farmer-workspace-eyebrow">VIBARUA NETWORK</span><h2 id="labour-dialog-title">{dialog === 'worker' ? 'Add worker profile' : dialog === 'job' ? 'Post farm work' : 'Record payroll payment'}</h2></div><button type="button" aria-label="Close dialog" onClick={() => setDialog('')}><span className="material-symbols-outlined">close</span></button></div>
          {dialog === 'worker' ? <form onSubmit={saveWorkerProfile}>
            <label>Worker name<input required value={workerDraft.name} onChange={(event) => setWorkerDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Primary skill<input required list="labour-skills" value={workerDraft.skill} onChange={(event) => setWorkerDraft((current) => ({ ...current, skill: event.target.value }))} placeholder="e.g. Harvesting" /></label>
            <datalist id="labour-skills">{skills.map((skill) => <option key={skill} value={skill} />)}</datalist>
            <label>Location<input required value={workerDraft.location} onChange={(event) => setWorkerDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Village, ward, or district" /></label>
            <label>Daily rate (TZS)<input required type="number" min="1" step="1" value={workerDraft.dailyRate} onChange={(event) => setWorkerDraft((current) => ({ ...current, dailyRate: event.target.value }))} /></label>
            <label>Experience<input value={workerDraft.experience} onChange={(event) => setWorkerDraft((current) => ({ ...current, experience: event.target.value }))} /></label>
            <label>Availability<select value={workerDraft.availability} onChange={(event) => setWorkerDraft((current) => ({ ...current, availability: event.target.value }))}><option value="available">Available</option><option value="busy">Busy</option><option value="seasonal">Seasonal</option></select></label>
            <label>About this worker<textarea value={workerDraft.bio} onChange={(event) => setWorkerDraft((current) => ({ ...current, bio: event.target.value }))} /></label>
            <p className="digital-farm-dialog-note">Self-reported information; this profile is not independently verified and is currently private to this account.</p>
            <button type="submit" className="farmer-workspace-submit">Save worker profile</button>
          </form> : dialog === 'job' ? <form onSubmit={saveJob}>
            <label>Job title<input required value={jobDraft.title} onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Harvest maize field" /></label>
            <label>Skill needed<input required list="labour-skills" value={jobDraft.skill} onChange={(event) => setJobDraft((current) => ({ ...current, skill: event.target.value }))} /></label>
            <label>Work location<input required value={jobDraft.location} onChange={(event) => setJobDraft((current) => ({ ...current, location: event.target.value }))} /></label>
            <label>Number of workers<input required type="number" min="1" step="1" value={jobDraft.workersNeeded} onChange={(event) => setJobDraft((current) => ({ ...current, workersNeeded: event.target.value }))} /></label>
            <label>Daily rate per worker (TZS)<input required type="number" min="1" step="1" value={jobDraft.dailyRate} onChange={(event) => setJobDraft((current) => ({ ...current, dailyRate: event.target.value }))} /></label>
            <label>Start date<input required type="date" value={jobDraft.startDate} onChange={(event) => setJobDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
            <label>Duration (days)<input required type="number" min="1" step="1" value={jobDraft.durationDays} onChange={(event) => setJobDraft((current) => ({ ...current, durationDays: event.target.value }))} /></label>
            <label>Work details<textarea value={jobDraft.details} onChange={(event) => setJobDraft((current) => ({ ...current, details: event.target.value }))} /></label>
            <p className="digital-farm-dialog-note">Work posts are saved to this account and are not yet visible to other users.</p>
            <button type="submit" className="farmer-workspace-submit">Save work opportunity</button>
          </form> : <form onSubmit={savePayment}>
            <label>Active contract<select required value={paymentDraft.contractId} onChange={(event) => setPaymentDraft((current) => ({ ...current, contractId: event.target.value }))}><option value="">Select a worker</option>{activeContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.workerName} · {contract.skill}</option>)}</select></label>
            <label>Amount paid (TZS)<input required type="number" min="1" step="1" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} /></label>
            <label>Payment date<input required type="date" value={paymentDraft.date} onChange={(event) => setPaymentDraft((current) => ({ ...current, date: event.target.value }))} /></label>
            <label>Payment method<select value={paymentDraft.method} onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value }))}><option>Cash</option><option>Mobile money</option><option>Bank transfer</option><option>Other</option></select></label>
            <label>Reference (optional)<input value={paymentDraft.reference} onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))} /></label>
            <label>Notes<textarea value={paymentDraft.notes} onChange={(event) => setPaymentDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <p className="digital-farm-dialog-note">This records a payment you made; it does not initiate a transfer or prove receipt by the worker.</p>
            <button type="submit" className="farmer-workspace-submit">Save payment record</button>
          </form>}
        </section>
      </div>}

      {selectedWorker && <div className="field-profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedWorker(null); }}><section className="field-profile-share-modal" role="dialog" aria-modal="true" aria-labelledby="worker-detail-title"><div className="field-profile-modal-heading"><div><span className="farmer-workspace-eyebrow">SELF-REPORTED WORKER</span><h2 id="worker-detail-title">{selectedWorker.name}</h2></div><button type="button" aria-label="Close worker details" onClick={() => setSelectedWorker(null)}><span className="material-symbols-outlined">close</span></button></div><p>{selectedWorker.skill} · {selectedWorker.location}</p><p>{selectedWorker.bio || selectedWorker.experience || 'No experience details provided.'}</p><p>{formatTzs(selectedWorker.dailyRate)} / day · {selectedWorker.availability || 'availability not set'}</p><p>Identity, references, rating, and experience have not been independently verified.</p><div className="field-profile-modal-actions"><button type="button" className="field-profile-secondary" onClick={() => setSelectedWorker(null)}>Close</button><button type="button" className="field-profile-primary" onClick={() => hireWorker(selectedWorker)}>Request hire</button></div></section></div>}
    </main>
  );
}

export default LabourWorkspace;
