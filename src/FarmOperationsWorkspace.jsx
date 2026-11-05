import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import './FarmOperationsWorkspace.css';

const money = (amount) => `TZS ${Number(amount || 0).toLocaleString('en-TZ')}`;
const farmCreationErrorMessages = {
  farm_location_required: 'Grant location permission and capture the farm GPS before saving.',
  invalid_farm_location: 'The captured location is not valid. Capture GPS again.',
  farm_location_accuracy_too_low: 'GPS accuracy must be 50 m or better. Move outdoors and try again.',
  farm_location_stamp_expired: 'Capture the farm location again; GPS stamps are valid for 15 minutes.',
  farm_location_photo_required: 'A photo of the farm location is required.',
  invalid_farm_location_photo: 'The farm photo could not be accepted. Choose a JPEG, PNG, or WebP image.',
  farm_location_photo_too_large: 'The farm photo is too large. Choose a smaller image.',
};

function compressLocationPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Choose a farm location photo.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Choose a photo smaller than 8 MB.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Photo processing is unavailable in this browser.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      if (dataUrl.length > 1500000) {
        reject(new Error('This photo is too large to upload. Choose a smaller image.'));
        return;
      }
      resolve({
        name: file.name.slice(0, 150) || 'farm-location.jpg',
        mime_type: 'image/jpeg',
        data_url: dataUrl,
        captured_at: new Date().toISOString(),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected photo could not be opened.'));
    };
    image.src = url;
  });
}

function Field({ label, children }) {
  return <label className="farm-operations-field">{label}{children}</label>;
}

export default function FarmOperationsWorkspace({ user, onBack }) {
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [farmArea, setFarmArea] = useState('');
  const [farmLocation, setFarmLocation] = useState(null);
  const [farmLocationPhoto, setFarmLocationPhoto] = useState(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [locationAlerts, setLocationAlerts] = useState([]);
  const [memberDraft, setMemberDraft] = useState({ email: '', role: 'manager' });
  const [taskDraft, setTaskDraft] = useState({ title: '', details: '', assigned_to: '', due_date: '' });
  const [requestDraft, setRequestDraft] = useState({ title: '', details: '', quantity: '', estimated_cost: '' });
  const [budgetDraft, setBudgetDraft] = useState({
    title: '',
    crop: '',
    field_id: '',
    area_acres: '',
    expected_yield_kg: '',
    target_price_per_kg: '',
    start_date: '',
    end_date: '',
    planned_costs: [{ category: 'Seeds', amount: '' }, { category: 'Fertilizer', amount: '' }, { category: 'Labor', amount: '' }],
  });
  const [budgetEntryDraft, setBudgetEntryDraft] = useState({
    budget_id: '',
    type: 'expense',
    category: '',
    amount: '',
    entry_date: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const selectedFarm = farms.find((farm) => farm.farm_id === selectedFarmId);
  const role = operations?.role || selectedFarm?.role || '';
  const isPendingInvite = selectedFarm?.status === 'pending';
  const canManageTasks = ['owner', 'manager'].includes(role);
  const canManageRequests = ['owner', 'manager'].includes(role);
  const activeWorkers = useMemo(
    () => (operations?.members || []).filter((member) => member.status === 'active' && member.role === 'worker'),
    [operations],
  );
  const budgets = operations?.budgets || [];
  const selectedBudget = budgets.find((budget) => budget.budget_id === budgetEntryDraft.budget_id) || budgets[0];

  const loadFarms = useCallback(async (preferredFarmId = '') => {
    setError('');
    try {
      const response = await api.listFarms();
      const nextFarms = Array.isArray(response.farms) ? response.farms : [];
      setFarms(nextFarms);
      setSelectedFarmId((current) => {
        const candidate = preferredFarmId || current;
        if (nextFarms.some((farm) => farm.farm_id === candidate)) return candidate;
        return nextFarms.find((farm) => farm.status === 'active')?.farm_id
          || nextFarms[0]?.farm_id
          || '';
      });
    } catch (requestError) {
      setError(requestError.message || 'Could not load farms.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOperations = useCallback(async (farmId) => {
    if (!farmId) {
      setOperations(null);
      return;
    }
    setError('');
    try {
      setOperations(await api.getFarmOperations(farmId));
    } catch (requestError) {
      setOperations(null);
      setError(requestError.message || 'Could not load farm operations.');
    }
  }, []);

  useEffect(() => {
    loadFarms();
  }, [loadFarms, user?.user_id]);

  useEffect(() => {
    let active = true;
    api.listFarmLocationAlerts()
      .then((response) => { if (active) setLocationAlerts(Array.isArray(response.alerts) ? response.alerts : []); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Could not load farm location alerts.'); });
    return () => { active = false; };
  }, [user?.user_id]);

  useEffect(() => {
    if (selectedFarm?.status === 'active') loadOperations(selectedFarm.farm_id);
    else setOperations(null);
  }, [selectedFarm?.farm_id, selectedFarm?.status, loadOperations]);

  const runAction = async (action, successMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await loadFarms(selectedFarmId);
      await loadOperations(selectedFarmId);
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message || 'The farm operation could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const createFarm = (event) => {
    event.preventDefault();
    const name = farmName.trim();
    const area = farmArea ? Number(farmArea) : null;
    if (!name || (area !== null && (!Number.isFinite(area) || area <= 0))) {
      setError('Enter a farm name and a valid positive area.');
      return;
    }
    if (!farmLocation || farmLocation.accuracy_m > 50 || !farmLocationPhoto) {
      setError('Capture a fresh GPS location with accuracy of 50 m or better and add a farm photo.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    api.createFarm({
        user_id: user.user_id,
        name,
        ...(area ? { total_acres: area } : {}),
        location: farmLocation,
        location_evidence: farmLocationPhoto,
      }).then(async (farm) => {
      setFarmName('');
      setFarmArea('');
      setFarmLocation(null);
      setFarmLocationPhoto(null);
      await loadFarms(farm.farm_id);
      setSelectedFarmId(farm.farm_id);
      const nearby = Array.isArray(farm.nearby_farms) ? farm.nearby_farms : [];
      setNotice(nearby.length
        ? `Farm ${farm.farm_id} was created and flagged for admin review because it is within 50 m of ${nearby.map((item) => `${item.farm_id} (farmer ${item.farmer_id})`).join(', ')}. Both farmers and an administrator are notified.`
        : `Farm created. Farmer ID: ${user.user_id}. Farm ID: ${farm.farm_id}.`);
    }).catch((requestError) => {
      setError(farmCreationErrorMessages[requestError.message] || requestError.message || 'The farm could not be created.');
    }).finally(() => setBusy(false));
  };

  const captureFarmLocation = () => {
    if (!navigator.geolocation) {
      setError('Location capture is not available in this browser.');
      return;
    }
    setLocationBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setFarmLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy,
        captured_at: new Date().toISOString(),
      });
      setLocationBusy(false);
    }, (locationError) => {
      setLocationBusy(false);
      setError(locationError.code === locationError.PERMISSION_DENIED
        ? 'Location permission is required to register this farm.'
        : locationError.message || 'Could not capture farm location.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const selectFarmLocationPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    try {
      setFarmLocationPhoto(await compressLocationPhoto(file));
    } catch (photoError) {
      setError(photoError.message || 'Could not prepare the farm photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const inviteMember = (event) => {
    event.preventDefault();
    runAction(async () => {
      await api.inviteFarmMember(selectedFarmId, memberDraft);
      setMemberDraft({ email: '', role: 'manager' });
    }, 'Invitation created. The invited account must accept before accessing this farm.');
  };

  const createTask = (event) => {
    event.preventDefault();
    runAction(async () => {
      await api.createFarmTask(selectedFarmId, {
        ...taskDraft,
        assigned_to: taskDraft.assigned_to || undefined,
        due_date: taskDraft.due_date || undefined,
      });
      setTaskDraft({ title: '', details: '', assigned_to: '', due_date: '' });
    }, 'Task assigned to the farm.');
  };

  const createResourceRequest = (event) => {
    event.preventDefault();
    runAction(async () => {
      await api.createFarmResourceRequest(selectedFarmId, {
        ...requestDraft,
        quantity: requestDraft.quantity ? Number(requestDraft.quantity) : undefined,
        estimated_cost: requestDraft.estimated_cost ? Number(requestDraft.estimated_cost) : undefined,
      });
      setRequestDraft({ title: '', details: '', quantity: '', estimated_cost: '' });
    }, 'Resource request sent to the farm owner for review.');
  };

  const createBudget = (event) => {
    event.preventDefault();
    if (budgetDraft.start_date && budgetDraft.end_date && budgetDraft.end_date < budgetDraft.start_date) {
      setError('Season end date must be on or after the start date.');
      return;
    }
    const plannedCosts = budgetDraft.planned_costs
      .filter((item) => item.category.trim() && Number(item.amount) > 0)
      .map((item) => ({ category: item.category.trim(), amount: Number(item.amount) }));
    runAction(async () => {
      const { budget } = await api.createFarmBudget(selectedFarmId, {
        title: budgetDraft.title.trim(),
        crop: budgetDraft.crop.trim(),
        field_id: budgetDraft.field_id.trim(),
        area_acres: budgetDraft.area_acres ? Number(budgetDraft.area_acres) : undefined,
        expected_yield_kg: budgetDraft.expected_yield_kg ? Number(budgetDraft.expected_yield_kg) : undefined,
        target_price_per_kg: budgetDraft.target_price_per_kg ? Number(budgetDraft.target_price_per_kg) : undefined,
        start_date: budgetDraft.start_date || undefined,
        end_date: budgetDraft.end_date || undefined,
        planned_costs: plannedCosts,
      });
      setBudgetDraft({
        title: '',
        crop: '',
        field_id: '',
        area_acres: '',
        expected_yield_kg: '',
        target_price_per_kg: '',
        start_date: '',
        end_date: '',
        planned_costs: [{ category: 'Seeds', amount: '' }, { category: 'Fertilizer', amount: '' }, { category: 'Labor', amount: '' }],
      });
      if (budget?.budget_id) setBudgetEntryDraft((current) => ({ ...current, budget_id: budget.budget_id }));
    }, 'Farm season budget saved. Planning values are assumptions, not guaranteed results.');
  };

  const addBudgetEntry = (event) => {
    event.preventDefault();
    if (!selectedBudget) return;
    runAction(async () => {
      await api.createFarmBudgetEntry(selectedFarmId, selectedBudget.budget_id, {
        type: budgetEntryDraft.type,
        category: budgetEntryDraft.category.trim(),
        amount: Number(budgetEntryDraft.amount),
        entry_date: budgetEntryDraft.entry_date,
        note: budgetEntryDraft.note.trim(),
      });
      setBudgetEntryDraft((current) => ({ ...current, category: '', amount: '', note: '' }));
    }, 'Actual finance record added to the shared farm budget.');
  };

  const respondToInvitation = (status) => {
    if (!selectedFarm?.membership_id) return;
    runAction(
      () => api.respondToFarmInvitation(selectedFarm.membership_id, status),
      status === 'active' ? 'Farm invitation accepted.' : 'Farm invitation declined.',
    );
  };

  const updateTask = (taskId, status) => runAction(
    () => api.updateFarmTask(selectedFarmId, taskId, status),
    `Task marked ${status.replace('_', ' ')}.`,
  );

  const updateRequest = (requestId, status) => runAction(
    () => api.updateFarmResourceRequest(selectedFarmId, requestId, status),
    `Resource request ${status}.`,
  );

  return (
    <main className="farm-operations-workspace">
      <header className="farm-operations-header">
        <button type="button" className="farm-operations-back" onClick={onBack}><span className="material-symbols-outlined">arrow_back</span>Digital Farm</button>
        <span className="farm-operations-eyebrow">MULTI-FARM · TEAM OPERATIONS</span>
        <div className="farm-operations-title-row">
          <div><h1>Farm Operations</h1><p>Share work with your farm team, assign tasks, and review resource requests. Members only see farms they have been invited to join.</p></div>
          {farms.length > 0 && <label className="farm-operations-selector">Selected farm<select value={selectedFarmId} onChange={(event) => setSelectedFarmId(event.target.value)}>{farms.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farm.name} · Farm ID {farm.farm_id} · {farm.role}{farm.status === 'pending' ? ' · invitation' : ''}</option>)}</select></label>}
        </div>
      </header>

      <div className="farm-operations-boundary"><span className="material-symbols-outlined">shield</span><p>This workspace records tasks and approvals; it does not place Agrishop orders, move money, verify credentials, or track workers continuously. Farm membership and changes are recorded in the account database.</p></div>
      {error && <div className="farm-operations-message is-error" role="alert">{error}</div>}
      {notice && <div className="farm-operations-message" role="status">{notice}</div>}
      {locationAlerts.filter((alert) => alert.status === 'pending').map((alert) => (
        <div className="farm-operations-message is-warning" role="status" key={alert.review_id}>
          Farm location review: Farm {alert.new_farm_id} (farmer {alert.new_farmer_id}) is about {Math.round(Number(alert.distance_m))} m from farm {alert.nearby_farm_id} (farmer {alert.nearby_farmer_id}). An administrator has been notified. No messaging or marketplace access is restricted.
        </div>
      ))}

      {loading ? <div className="farm-operations-empty">Loading your farms…</div> : null}
      {!loading && (
        <section className="farm-operations-card farm-operations-create-card">
          <span className="material-symbols-outlined">add_home</span>
          <div><h2>{farms.length ? 'Add another farm' : 'Create your first farm'}</h2><p>Each farm gets its own Farm ID and GPS location. Your Farmer ID is {user?.user_id || 'loaded from your account'}. Nearby farm points within 50 m are allowed but sent to an administrator for review.</p></div>
          <form onSubmit={createFarm}>
            <Field label="Farm name"><input required maxLength={120} value={farmName} onChange={(event) => setFarmName(event.target.value)} /></Field>
            <Field label="Total area (acres, optional)"><input type="number" min="0.01" step="any" value={farmArea} onChange={(event) => setFarmArea(event.target.value)} /></Field>
            <div className="farm-operations-location-row">
              <button type="button" disabled={locationBusy} onClick={captureFarmLocation}>{locationBusy ? 'Capturing GPS…' : farmLocation ? `GPS captured · ±${Math.round(farmLocation.accuracy_m)} m` : 'Grant location & capture GPS'}</button>
              <Field label="Photo of this farm location"><input type="file" accept="image/*" capture="environment" onChange={selectFarmLocationPhoto} disabled={photoBusy} />{farmLocationPhoto && <small>{farmLocationPhoto.name} ready</small>}</Field>
            </div>
            <small className="farm-operations-location-note">Location permission is required. The photo and GPS stamp are device-reported evidence, not proof of ownership or government verification.</small>
            <button type="submit" disabled={busy || photoBusy}>{busy ? 'Creating…' : farms.length ? 'Create farm' : 'Create my farm'}</button>
          </form>
        </section>
      )}

      {selectedFarm && isPendingInvite && (
        <section className="farm-operations-card farm-operations-invite-card">
          <span className="material-symbols-outlined">mail</span>
          <div><h2>Farm invitation</h2><p>You have been invited to join <strong>{selectedFarm.name}</strong> as a {selectedFarm.role}. Accept to view its tasks and resource requests.</p></div>
          <div className="farm-operations-actions"><button type="button" disabled={busy} onClick={() => respondToInvitation('declined')}>Decline</button><button type="button" disabled={busy} onClick={() => respondToInvitation('active')}>Accept invitation</button></div>
        </section>
      )}

      {selectedFarm && selectedFarm.status === 'active' && (
        <>
          <section className="farm-operations-metrics">
            <article><span>Team members</span><strong>{operations?.members?.filter((member) => member.status === 'active').length || 0}</strong></article>
            <article><span>Open tasks</span><strong>{operations?.tasks?.filter((task) => ['open', 'in_progress'].includes(task.status)).length || 0}</strong></article>
            <article><span>Pending approvals</span><strong>{operations?.resource_requests?.filter((request) => request.status === 'pending').length || 0}</strong></article>
            <article><span>Your access</span><strong className="farm-operations-role">{role}</strong></article>
          </section>

          {canManageTasks && (
            <section className="farm-operations-card">
              <div className="farm-operations-section-heading"><div><span>DAILY OPERATIONS</span><h2>Assign a task</h2></div></div>
              <form className="farm-operations-form" onSubmit={createTask}>
                <Field label="Task title"><input required maxLength={120} value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} /></Field>
                <Field label="Assign worker"><select value={taskDraft.assigned_to} onChange={(event) => setTaskDraft({ ...taskDraft, assigned_to: event.target.value })}><option value="">Unassigned</option>{activeWorkers.map((member) => <option key={member.user_id} value={member.user_id}>{member.name || 'Farm worker'}</option>)}</select></Field>
                <Field label="Due date"><input type="date" value={taskDraft.due_date} onChange={(event) => setTaskDraft({ ...taskDraft, due_date: event.target.value })} /></Field>
                <Field label="Instructions"><textarea maxLength={2000} rows="2" value={taskDraft.details} onChange={(event) => setTaskDraft({ ...taskDraft, details: event.target.value })} /></Field>
                <button type="submit" disabled={busy}>Create task</button>
              </form>
            </section>
          )}

          <section className="farm-operations-card">
            <div className="farm-operations-section-heading"><div><span>ASSIGNED WORK</span><h2>Farm tasks</h2></div><button type="button" onClick={() => loadOperations(selectedFarmId)}>Refresh</button></div>
            {operations?.tasks?.length ? <div className="farm-operations-list">{operations.tasks.map((task) => {
              const isAssignedWorker = role === 'worker' && task.assigned_to === user?.user_id;
              return <article key={task.task_id}>
                <div className="farm-operations-item-copy"><div><h3>{task.title}</h3><span className={`farm-operations-status status-${task.status}`}>{task.status.replace('_', ' ')}</span></div><p>{task.details || 'No extra instructions.'}</p><small>{task.assignee_name ? `Assigned to ${task.assignee_name}` : 'Unassigned'}{task.due_date ? ` · Due ${String(task.due_date).slice(0, 10)}` : ''}</small></div>
                {(canManageTasks || isAssignedWorker) && task.status !== 'completed' && task.status !== 'cancelled' && <div className="farm-operations-actions">{task.status === 'open' && <button type="button" disabled={busy} onClick={() => updateTask(task.task_id, 'in_progress')}>Start</button>}<button type="button" disabled={busy} onClick={() => updateTask(task.task_id, 'completed')}>Complete</button>{canManageTasks && <button type="button" disabled={busy} onClick={() => updateTask(task.task_id, 'cancelled')}>Cancel</button>}</div>}
              </article>;
            })}</div> : <p className="farm-operations-empty">No tasks yet.</p>}
          </section>

          {canManageRequests && (
            <section className="farm-operations-card">
              <div className="farm-operations-section-heading"><div><span>INPUTS &amp; BUDGET CONTROL</span><h2>Request a resource</h2></div></div>
              <form className="farm-operations-form" onSubmit={createResourceRequest}>
                <Field label="Resource"><input required maxLength={120} value={requestDraft.title} onChange={(event) => setRequestDraft({ ...requestDraft, title: event.target.value })} placeholder="e.g. DAP fertilizer" /></Field>
                <Field label="Quantity"><input type="number" min="0.01" step="any" value={requestDraft.quantity} onChange={(event) => setRequestDraft({ ...requestDraft, quantity: event.target.value })} /></Field>
                <Field label="Estimated cost (TZS)"><input type="number" min="0.01" step="1" value={requestDraft.estimated_cost} onChange={(event) => setRequestDraft({ ...requestDraft, estimated_cost: event.target.value })} /></Field>
                <Field label="Reason and timing"><textarea maxLength={2000} rows="2" value={requestDraft.details} onChange={(event) => setRequestDraft({ ...requestDraft, details: event.target.value })} /></Field>
                <button type="submit" disabled={busy}>Submit for approval</button>
              </form>
            </section>
          )}

          <section className="farm-operations-card">
            <div className="farm-operations-section-heading"><div><span>OWNER APPROVALS</span><h2>Resource requests</h2></div></div>
            {operations?.resource_requests?.length ? <div className="farm-operations-list">{operations.resource_requests.map((request) => <article key={request.request_id}>
              <div className="farm-operations-item-copy"><div><h3>{request.title}</h3><span className={`farm-operations-status status-${request.status}`}>{request.status}</span></div><p>{request.details || 'No reason provided.'}</p><small>Requested by {request.requester_name}{request.quantity ? ` · ${request.quantity} units` : ''}{request.estimated_cost ? ` · Estimate ${money(request.estimated_cost)}` : ''}</small></div>
              {role === 'owner' && request.status === 'pending' && <div className="farm-operations-actions"><button type="button" disabled={busy} onClick={() => updateRequest(request.request_id, 'declined')}>Decline</button><button type="button" disabled={busy} onClick={() => updateRequest(request.request_id, 'approved')}>Approve</button></div>}
              {['owner', 'manager'].includes(role) && request.status === 'approved' && <div className="farm-operations-actions"><button type="button" disabled={busy} onClick={() => updateRequest(request.request_id, 'fulfilled')}>Mark fulfilled</button></div>}
            </article>)}</div> : <p className="farm-operations-empty">No resource requests yet.</p>}
          </section>

          {canManageRequests && (
            <section className="farm-operations-card">
              <div className="farm-operations-section-heading"><div><span>HESABU YA MSIMU</span><h2>Shared farm budgets</h2></div></div>
              <p className="farm-operations-muted">Owners and managers can plan a season together. Budget assumptions are farmer-entered; actuals only include income and expense entries recorded here.</p>
              <form className="farm-operations-form farm-budget-form" onSubmit={createBudget}>
                <Field label="Budget name"><input required maxLength={120} value={budgetDraft.title} onChange={(event) => setBudgetDraft({ ...budgetDraft, title: event.target.value })} placeholder="e.g. 2026 sunflower season" /></Field>
                <Field label="Crop or livestock enterprise"><input required maxLength={80} value={budgetDraft.crop} onChange={(event) => setBudgetDraft({ ...budgetDraft, crop: event.target.value })} placeholder="e.g. Maize, dairy cattle, or layers" /></Field>
                <Field label="Field or animal unit (optional)"><input maxLength={120} value={budgetDraft.field_id} onChange={(event) => setBudgetDraft({ ...budgetDraft, field_id: event.target.value })} placeholder="Field, herd, or poultry house" /></Field>
                <Field label="Area (acres)"><input type="number" min="0.01" step="any" value={budgetDraft.area_acres} onChange={(event) => setBudgetDraft({ ...budgetDraft, area_acres: event.target.value })} /></Field>
                <Field label="Planned output (kg, liters, eggs…)"><input type="number" min="0.01" step="any" value={budgetDraft.expected_yield_kg} onChange={(event) => setBudgetDraft({ ...budgetDraft, expected_yield_kg: event.target.value })} /></Field>
                <Field label="Target price per unit (TZS)"><input type="number" min="0.01" step="any" value={budgetDraft.target_price_per_kg} onChange={(event) => setBudgetDraft({ ...budgetDraft, target_price_per_kg: event.target.value })} /></Field>
                <Field label="Season start"><input type="date" value={budgetDraft.start_date} onChange={(event) => setBudgetDraft({ ...budgetDraft, start_date: event.target.value })} /></Field>
                <Field label="Season end"><input type="date" value={budgetDraft.end_date} onChange={(event) => setBudgetDraft({ ...budgetDraft, end_date: event.target.value })} /></Field>
                <div className="farm-budget-cost-editor">
                  <strong>Planned costs (TZS)</strong>
                  {budgetDraft.planned_costs.map((item, index) => <div key={index}>
                    <input aria-label={`Planned cost ${index + 1} category`} maxLength={60} value={item.category} onChange={(event) => setBudgetDraft((current) => ({ ...current, planned_costs: current.planned_costs.map((cost, costIndex) => costIndex === index ? { ...cost, category: event.target.value } : cost) }))} placeholder="Category" />
                    <input aria-label={`Planned cost ${index + 1} amount`} type="number" min="0" step="1" value={item.amount} onChange={(event) => setBudgetDraft((current) => ({ ...current, planned_costs: current.planned_costs.map((cost, costIndex) => costIndex === index ? { ...cost, amount: event.target.value } : cost) }))} placeholder="Amount" />
                  </div>)}
                  <button type="button" disabled={budgetDraft.planned_costs.length >= 20} onClick={() => setBudgetDraft((current) => ({ ...current, planned_costs: [...current.planned_costs, { category: '', amount: '' }] }))}>Add cost category</button>
                </div>
                <button type="submit" disabled={busy}>Save shared budget</button>
              </form>

              {budgets.length > 0 && (
                <>
                  <div className="farm-budget-entry-form-wrap">
                    <h3>Record actual income or expense</h3>
                    <form className="farm-operations-form farm-budget-entry-form" onSubmit={addBudgetEntry}>
                      <Field label="Season budget"><select value={selectedBudget?.budget_id || ''} onChange={(event) => setBudgetEntryDraft({ ...budgetEntryDraft, budget_id: event.target.value })}>{budgets.map((budget) => <option value={budget.budget_id} key={budget.budget_id}>{budget.title}</option>)}</select></Field>
                      <Field label="Type"><select value={budgetEntryDraft.type} onChange={(event) => setBudgetEntryDraft({ ...budgetEntryDraft, type: event.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select></Field>
                      <Field label="Category"><input required maxLength={80} value={budgetEntryDraft.category} onChange={(event) => setBudgetEntryDraft({ ...budgetEntryDraft, category: event.target.value })} /></Field>
                      <Field label="Amount (TZS)"><input required type="number" min="0.01" step="1" value={budgetEntryDraft.amount} onChange={(event) => setBudgetEntryDraft({ ...budgetEntryDraft, amount: event.target.value })} /></Field>
                      <Field label="Date"><input required type="date" value={budgetEntryDraft.entry_date} onChange={(event) => setBudgetEntryDraft({ ...budgetEntryDraft, entry_date: event.target.value })} /></Field>
                      <Field label="Note"><input maxLength={1000} value={budgetEntryDraft.note} onChange={(event) => setBudgetEntryDraft({ ...budgetEntryDraft, note: event.target.value })} /></Field>
                      <button type="submit" disabled={busy}>Save actual</button>
                    </form>
                  </div>
                  <div className="farm-operations-list farm-budget-list">{budgets.map((budget) => {
                    const entries = budget.entries || [];
                    const planned = (budget.planned_costs || []).reduce((total, item) => total + Number(item.amount || 0), 0);
                    const actualIncome = entries.filter((entry) => entry.type === 'income').reduce((total, entry) => total + Number(entry.amount || 0), 0);
                    const actualExpenses = entries.filter((entry) => entry.type === 'expense').reduce((total, entry) => total + Number(entry.amount || 0), 0);
                    const estimatedRevenue = Number(budget.expected_yield_kg || 0) * Number(budget.target_price_per_kg || 0);
                    return <article key={budget.budget_id}><div className="farm-operations-item-copy"><div><h3>{budget.title} · {budget.crop}</h3>{budget.field_id && <span className="farm-operations-status">{budget.field_id}</span>}</div><p>Planned costs {money(planned)} · Revenue estimate {money(estimatedRevenue)} · Actual income {money(actualIncome)} · Actual expenses {money(actualExpenses)}</p><small>Planning values are not forecasts. Actual entries: {entries.length}</small>{entries.slice(0, 4).map((entry) => <small key={entry.entry_id}>{entry.entry_date} · {entry.type} · {entry.category}: {money(entry.amount)}{entry.note ? ` · ${entry.note}` : ''}</small>)}</div></article>;
                  })}</div>
                </>
              )}
            </section>
          )}

          {role === 'owner' && (
            <section className="farm-operations-card">
              <div className="farm-operations-section-heading"><div><span>ACCESS CONTROL</span><h2>Invite a team member</h2></div></div>
              <p className="farm-operations-muted">Invite an existing AGRI-NEST account by its registered email. They must accept before gaining farm access.</p>
              <form className="farm-operations-form farm-member-form" onSubmit={inviteMember}>
                <Field label="Account email"><input required type="email" maxLength={254} value={memberDraft.email} onChange={(event) => setMemberDraft({ ...memberDraft, email: event.target.value })} /></Field>
                <Field label="Farm role"><select value={memberDraft.role} onChange={(event) => setMemberDraft({ ...memberDraft, role: event.target.value })}><option value="manager">Manager — manage tasks and resource requests</option><option value="worker">Worker — update assigned tasks</option><option value="adviser">Adviser — read-only farm operations</option></select></Field>
                <button type="submit" disabled={busy}>Send invitation</button>
              </form>
              <div className="farm-member-list">{operations?.members?.map((member) => <div key={member.user_id}><span>{member.name || 'Farm member'}</span><small>{member.role} · {member.status}</small></div>)}</div>
            </section>
          )}

          <section className="farm-operations-card">
            <div className="farm-operations-section-heading"><div><span>ACCOUNTABILITY</span><h2>Recent farm activity</h2></div></div>
            {operations?.audit?.length ? <div className="farm-audit-list">{operations.audit.map((entry) => <p key={entry.audit_id}><strong>{entry.actor_name || 'Team member'}</strong> {entry.action.replaceAll('_', ' ')} <time>{new Date(entry.created_at).toLocaleString()}</time></p>)}</div> : <p className="farm-operations-empty">New farm actions will appear here.</p>}
          </section>
        </>
      )}
    </main>
  );
}
