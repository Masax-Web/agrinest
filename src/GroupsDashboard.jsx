import { useMemo, useState } from 'react';
import './GroupsDashboard.css';

const suggestedGroups = [
  {
    id: 'iringa-sunflower-coop',
    name: 'Iringa Sunflower Coop',
    members: 128,
    crop: 'Sunflower',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqIG4LLhwG7vlaj00306OdaNu-2lOD90R8h-bW8jrbvNysfZBh0W6LKL4NdK0aC5s6ZHpiLoIOE9ErCAYu_6WtWevqz6q6DcqYOO0xg1AWdekULC9ieO1JEEVUkLB445tWD5aDBgqQ1xrhoMYn844rf2uXIFta0HmdQx0QNyUxokxLyywZocvL_synQn4in6H5ql_9BFQDpaQjQa0O6yUDBLuK-olufngL-KMKCFqHm2vXkrDWb6ufAuQlg1acLnFoIBAZOnn0fOI',
  },
  {
    id: 'njombe-dairy-association',
    name: 'Njombe Dairy Association',
    members: 85,
    crop: 'Dairy',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAraSSVcvPIctM6MKePq2Z5NOBBE2I844LKJgwgDk0WAKslJFx0bK30j_B40tmvsMDrrs2vQXNWGR7dF_52B8BQ5HmR0Z7DTDHJOE-piJ8OoIclyuTbc0G3WArkfCVs_Y2v9bqBEic5DvEj1GwdtDYWiEK_tajF7DymXt8D8qS_ZAb3B10SHjtix0we_jeCKGWagy24gf7Z4XQhPjHNG5MO3MYFVe04kmSo8W1RN_GLHd-Pu2BMw5nLE5SrGJ7BFQ6RkWkrnAyr4nY',
  },
];

const opportunities = [
  {
    id: 'bulk-dap-2026',
    title: 'Bulk DAP fertilizer order',
    group: 'Iringa Women Farmers',
    status: 'Collecting Funds',
    deadline: 'Nov 15, 2026',
    action: 'Contribute',
    type: 'contribution',
  },
  {
    id: 'bidii-maize-sale-2026',
    title: 'Collective sale — Bidii Company',
    group: 'Iringa Women Farmers',
    status: 'Pledging Open',
    deadline: 'Nov 20, 2026',
    action: 'Pledge Harvest',
    type: 'harvest',
  },
];

function createId() {
  return globalThis.crypto?.randomUUID?.() || `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTzs(value) {
  return `TZS ${Number(value || 0).toLocaleString('en-TZ')}`;
}

function formatCompactTzs(value) {
  return `TZS ${new Intl.NumberFormat('en-TZ', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0) || 0)}`;
}

function getLocalDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function VikundiModal({ modal, onClose, onSubmit, onDateChange }) {
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  if (!modal) return null;

  const isContribution = modal.type === 'contribution';
  const title = isContribution ? 'Contribute to your group' : modal.type === 'harvest' ? 'Pledge your harvest' : modal.title;
  const submitLabel = isContribution ? 'Save contribution' : modal.type === 'harvest' ? 'Save harvest pledge' : 'Add activity';
  const submit = (event) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (modal.type === 'contribution' && (!Number.isFinite(numericAmount) || numericAmount < 1)) {
      setError('Enter a contribution of at least TZS 1.');
      return;
    }
    if (modal.type === 'harvest' && !details.trim()) {
      setError('Describe the crop and quantity you plan to pledge.');
      return;
    }
    if (modal.type === 'activity' && !details.trim()) {
      setError('Enter a name for your group activity.');
      return;
    }
    onSubmit({ amount: numericAmount, details: details.trim(), date: modal.date });
  };

  return (
    <div className="vikundi-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="vikundi-modal" role="dialog" aria-modal="true" aria-labelledby="vikundi-modal-title">
        <div className="vikundi-modal-heading">
          <div><span>VIKUNDI · IRINGA</span><h2 id="vikundi-modal-title">{title}</h2></div>
          <button type="button" className="vikundi-icon-button" aria-label="Close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <p className="vikundi-modal-context">{modal.context || modal.group || modal.title}</p>
        <form onSubmit={submit}>
          {isContribution && <label>Contribution amount (TZS)<input autoFocus type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 25,000" /></label>}
          {modal.type === 'harvest' && <label>Crop and quantity<input autoFocus required value={details} onChange={(event) => setDetails(event.target.value)} placeholder="e.g. 20 bags of maize" /></label>}
          {modal.type === 'activity' && (
            <>
              <label>Activity<input autoFocus required value={details} onChange={(event) => setDetails(event.target.value)} placeholder="e.g. Field preparation meeting" /></label>
              <label>Date<input type="date" required value={modal.date} onChange={(event) => onDateChange(event.target.value)} /></label>
            </>
          )}
          {error && <p className="vikundi-form-error" role="alert">{error}</p>}
          <div className="vikundi-modal-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit">{submitLabel}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function GroupsDashboard({ profile, records, onRecordsChange }) {
  const [activeSection, setActiveSection] = useState('nearby');
  const [modal, setModal] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [notice, setNotice] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const joinedGroups = Array.isArray(records.groups) ? records.groups : [];
  const requests = Array.isArray(records.requests) ? records.requests : [];
  const activities = Array.isArray(records.activities) ? records.activities : [];
  const memberGroup = joinedGroups.find((group) => group.id === 'iringa-women-farmers' || group.name === 'Iringa Women Farmers')
    || joinedGroups[0]
    || { id: 'iringa-women-farmers', name: 'Iringa Women Farmers', region: profile?.region || 'Iringa' };
  const memberCount = Number(memberGroup.memberCount || 34);
  const groupFund = 8400000 + joinedGroups.reduce((total, group) => total + Number(group.contributedAmount || 0), 0);
  const myRequests = useMemo(() => requests.filter((request) => request.module === 'group-join' || request.module === 'group-opportunity'), [requests]);
  const opportunitiesList = useMemo(() => {
    const saved = requests.filter((request) => request.module === 'group-opportunity');
    return opportunities.map((opportunity) => {
      const participation = saved.find((request) => request.opportunityId === opportunity.id);
      return { ...opportunity, participation };
    });
  }, [requests]);
  const upcomingActivities = useMemo(
    () => activities.filter((activity) => activity.module === 'group-activity').sort((first, second) => String(first.date).localeCompare(String(second.date))),
    [activities],
  );

  const saveOpportunityAction = (opportunity, values) => {
    const record = {
      id: createId(),
      module: 'group-opportunity',
      opportunityId: opportunity.id,
      title: opportunity.title,
      group: opportunity.group,
      amount: values.amount || 0,
      details: values.details || '',
      status: 'Saved',
      date: new Date().toISOString(),
    };
    onRecordsChange('requests', [...requests, record]);
    setModal(null);
    setNotice(opportunity.type === 'contribution' ? 'Your group contribution was saved on this device.' : 'Your harvest pledge was saved on this device.');
  };

  const handleModalSubmit = (values) => {
    if (modal.type === 'contribution') {
      const nextGroups = joinedGroups.map((group) => (
        group.id === memberGroup.id ? { ...group, contributedAmount: Number(group.contributedAmount || 0) + values.amount } : group
      ));
      if (!joinedGroups.some((group) => group.id === memberGroup.id)) nextGroups.push({ ...memberGroup, contributedAmount: values.amount });
      onRecordsChange('groups', nextGroups);
      saveOpportunityAction(modal.opportunity || modal, { amount: values.amount });
      return;
    }
    if (modal.type === 'harvest') {
      saveOpportunityAction(modal.opportunity || modal, { details: values.details });
      return;
    }
    if (modal.type === 'activity') {
      const event = {
        id: createId(),
        module: 'group-activity',
        title: values.details,
        group: memberGroup.name,
          date: modal.date,
        createdAt: new Date().toISOString(),
      };
      onRecordsChange('activities', [...activities, event]);
      setModal(null);
      setNotice('Group activity added to your calendar.');
    }
  };

  const requestToJoin = (group) => {
    if (myRequests.some((request) => request.module === 'group-join' && request.groupId === group.id)) return;
    const request = {
      id: createId(),
      module: 'group-join',
      groupId: group.id,
      title: `Join ${group.name}`,
      group: group.name,
      status: 'Pending',
      date: new Date().toISOString(),
    };
    onRecordsChange('requests', [...requests, request]);
    setNotice(`Your request to join ${group.name} was saved.`);
  };

  const openActivityModal = (date = getLocalDate()) => {
    setModal({ type: 'activity', title: 'Add a group activity', context: memberGroup.name, date });
  };

  const actionForOpportunity = (opportunity) => {
    if (opportunity.participation) return null;
    setModal({ ...opportunity, context: opportunity.group });
  };

  const renderOpportunities = (compact = false) => (
    <div className="vikundi-table-wrap">
      <table className={compact ? 'vikundi-table compact' : 'vikundi-table'}>
        <thead><tr><th>Activity</th><th>Group</th><th>Status</th><th>Deadline</th><th>Action</th></tr></thead>
        <tbody>
          {opportunitiesList.map((opportunity) => (
            <tr key={opportunity.id}>
              <td data-label="Activity"><strong>{opportunity.title}</strong>{opportunity.participation && <small className="vikundi-table-subline">{opportunity.type === 'contribution' ? formatTzs(opportunity.participation.amount) : opportunity.participation.details}</small>}</td>
              <td data-label="Group">{opportunity.group}</td>
              <td data-label="Status"><span className={opportunity.type === 'contribution' ? 'vikundi-status funding' : 'vikundi-status pledge'}>{opportunity.participation ? 'Saved' : opportunity.status}</span></td>
              <td data-label="Deadline">{opportunity.deadline}</td>
              <td data-label="Action">{opportunity.participation ? <span className="vikundi-saved-label">Saved</span> : <button type="button" className="vikundi-table-action" onClick={() => actionForOpportunity(opportunity)}>{opportunity.action}</button>}</td>
            </tr>
          ))}
          {requests.filter((request) => request.module === 'group-opportunity' && !opportunities.some((opportunity) => opportunity.id === request.opportunityId)).map((request) => (
            <tr key={request.id}><td data-label="Activity"><strong>{request.title}</strong></td><td data-label="Group">{request.group}</td><td data-label="Status"><span className="vikundi-status saved">Saved</span></td><td data-label="Deadline">—</td><td data-label="Action"><span className="vikundi-saved-label">Saved</span></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="vikundi-dashboard">
      <section className="vikundi-content">
        {activeSection === 'nearby' && (
          <>
            <header className="vikundi-page-header">
              <div><h1>Vikundi — Farmer Groups</h1><p>Collective buying, selling, and lending power in {profile?.region || 'Iringa'}.</p></div>
              <div className="vikundi-page-actions">
                <button type="button" className="vikundi-page-action vikundi-page-action-light" onClick={() => setActiveSection('calendar')}><span className="material-symbols-outlined">calendar_month</span>Activity Calendar</button>
                <button type="button" className="vikundi-settings-action" aria-label="Group settings" title="Group settings" onClick={() => setActiveSection('settings')}><span className="material-symbols-outlined">settings</span></button>
              </div>
            </header>
            <section className="vikundi-stats" aria-label="Group statistics">
              <div><span className="material-symbols-outlined">groups</span><strong>5</strong><small>Groups Near You</small></div>
              <div><span className="material-symbols-outlined">check_circle</span><strong>{joinedGroups.length || 1}</strong><small>Group Joined</small></div>
              <div><span className="material-symbols-outlined">person</span><strong>347</strong><small>Total Members</small></div>
              <div><span className="material-symbols-outlined">payments</span><strong>TZS 18.4M</strong><small>Combined Funds</small></div>
            </section>

            {notice && <div className="vikundi-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

            <div className="vikundi-groups-grid">
              <section className="vikundi-group-column">
                <h2>My Groups</h2>
                <article className="vikundi-member-card">
                  <div className="vikundi-member-hero">
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkx0JMaZ2xzM1eLXkmlxONtTW9K_BfpFO9Auk8j7Sw9JYTBYYXhkyw_Vrv-gytuBgc2hvb4Gja-runuPwiRWVqPN8_CW8e6YOBgiOKF22fZeB6gAj5Hnj2HuI5r4IjNIEywECy3I6x-qpBbdwVZpkLWX8vzaJJ4Q2jtVl7w_dK2YR1f5f1TmNctHrwqibvpa_jiDY5dmwSsLxgV31Ycx3Cl639Ne7owU4GdecnYLAY7SVQw2NwTDvslzKf71GGTmWH57aePY-xW00" alt="Women farmers working together in a field" />
                    <span className="vikundi-joined-badge">Joined</span>
                    <h3>{memberGroup.name}</h3>
                  </div>
                  <div className="vikundi-member-body">
                    <div className="vikundi-member-stats"><div><span>Members</span><strong>{memberCount}</strong></div><div><span>Group Fund</span><strong>{formatCompactTzs(groupFund)}</strong></div><div><span>Active Sale</span><strong>{memberGroup.activeSale || 'Maize'}</strong></div></div>
                    <div className="vikundi-member-actions">
                      <button type="button" className="vikundi-primary-button" onClick={() => setSelectedGroup(memberGroup)}><span className="material-symbols-outlined">visibility</span>View Details</button>
                      <button type="button" className="vikundi-outline-button" onClick={() => setModal({ type: 'contribution', opportunity: { ...opportunities[0], group: memberGroup.name }, context: memberGroup.name })}>Contribute Funds</button>
                    </div>
                  </div>
                </article>
              </section>

              <section className="vikundi-suggested-column">
                <h2>Suggested Groups</h2>
                <div className="vikundi-suggested-list">
                  {suggestedGroups.map((group) => {
                    const joined = joinedGroups.some((item) => item.id === group.id || item.name === group.name);
                    const requestPending = myRequests.some((request) => request.module === 'group-join' && request.groupId === group.id);
                    return (
                      <article className="vikundi-suggested-card" key={group.id}>
                        <img src={group.image} alt={group.crop === 'Dairy' ? 'Dairy cows in a green pasture' : 'Sunflowers growing in a field'} />
                        <div><h3>{group.name}</h3><p>{group.members} Members • Primary: {group.crop}</p><button type="button" disabled={joined || requestPending} onClick={() => requestToJoin(group)}>{joined ? 'Joined' : requestPending ? 'Request Sent' : 'Request to Join'}</button></div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="vikundi-opportunities">
              <div className="vikundi-section-heading"><h2>Group Opportunities</h2><button type="button" onClick={() => setActiveSection('bulk-orders')}>View All <span className="material-symbols-outlined">arrow_forward</span></button></div>
              {renderOpportunities(true)}
            </section>
          </>
        )}

        {activeSection === 'bulk-orders' && (
          <>
            <header className="vikundi-page-header"><div><h1>Bulk Orders &amp; Group Sales</h1><p>Coordinate input purchases and produce pledges with your group.</p></div><button type="button" className="vikundi-page-action vikundi-page-action-light" onClick={() => setActiveSection('nearby')}><span className="material-symbols-outlined">groups</span>Groups Overview</button></header>
            <section className="vikundi-full-panel"><div className="vikundi-section-heading"><h2>Open Opportunities</h2><span>{opportunitiesList.length} activities</span></div>{renderOpportunities()}</section>
            {myRequests.length > 0 && <section className="vikundi-full-panel"><div className="vikundi-section-heading"><h2>Your Group Requests</h2><span>{myRequests.length} saved</span></div><div className="vikundi-request-list">{myRequests.map((request) => <article key={request.id}><span className="material-symbols-outlined">{request.module === 'group-join' ? 'group_add' : 'task_alt'}</span><div><strong>{request.title}</strong><small>{request.group} · {request.status}</small></div></article>)}</div></section>}
          </>
        )}

        {activeSection === 'calendar' && (
          <>
            <header className="vikundi-page-header"><div><h1>Group Activity Calendar</h1><p>Plan and keep track of activities for {memberGroup.name}.</p></div><div className="vikundi-page-actions"><button type="button" className="vikundi-page-action vikundi-page-action-light" onClick={() => setActiveSection('nearby')}><span className="material-symbols-outlined">groups</span>Groups Overview</button><button type="button" className="vikundi-page-action" onClick={() => openActivityModal()}><span className="material-symbols-outlined">add</span>Add Activity</button></div></header>
            <section className="vikundi-full-panel">
              <div className="vikundi-section-heading"><h2>Upcoming Activities</h2><span>{upcomingActivities.length} scheduled</span></div>
              {upcomingActivities.length ? <div className="vikundi-request-list">{upcomingActivities.map((activity) => <article key={activity.id}><span className="material-symbols-outlined">calendar_month</span><div><strong>{activity.title}</strong><small>{activity.group} · {activity.date}</small></div></article>)}</div> : <div className="vikundi-empty"><span className="material-symbols-outlined">event_available</span><strong>No group activities yet</strong><p>Add a meeting, field day, or other activity to get started.</p><button type="button" className="vikundi-outline-button" onClick={() => openActivityModal()}>Schedule an Activity</button></div>}
            </section>
          </>
        )}

        {activeSection === 'settings' && (
          <>
            <header className="vikundi-page-header"><div><h1>Group Settings</h1><p>Manage your group updates and participation preferences.</p></div><button type="button" className="vikundi-page-action vikundi-page-action-light" onClick={() => setActiveSection('nearby')}><span className="material-symbols-outlined">groups</span>Groups Overview</button></header>
            <section className="vikundi-full-panel vikundi-settings-panel">
              <h2>Notifications</h2>
              <label className="vikundi-setting-row"><span><strong>Group activity updates</strong><small>Get notified about meetings, bulk orders, and group opportunities.</small></span><input type="checkbox" checked={notificationsEnabled} onChange={(event) => setNotificationsEnabled(event.target.checked)} /></label>
              <h2>Membership</h2>
              <div className="vikundi-setting-row"><span><strong>{memberGroup.name}</strong><small>Member · {profile?.region || 'Iringa'}</small></span><span className="vikundi-status funding">Active</span></div>
            </section>
          </>
        )}

        {notice && activeSection !== 'nearby' && <div className="vikundi-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      </section>

          <VikundiModal
        modal={modal}
        onClose={() => setModal(null)}
        onSubmit={handleModalSubmit}
        onDateChange={(date) => setModal((current) => ({ ...current, date }))}
      />
      {selectedGroup && (
        <div className="vikundi-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGroup(null); }}>
          <section className="vikundi-modal vikundi-group-dialog" role="dialog" aria-modal="true" aria-labelledby="vikundi-group-dialog-title">
            <div className="vikundi-modal-heading"><div><span>YOUR FARMER GROUP</span><h2 id="vikundi-group-dialog-title">{selectedGroup.name}</h2></div><button type="button" className="vikundi-icon-button" aria-label="Close details" onClick={() => setSelectedGroup(null)}><span className="material-symbols-outlined">close</span></button></div>
            <div className="vikundi-group-detail-grid"><div><span>Membership</span><strong>Active member</strong></div><div><span>Region</span><strong>{selectedGroup.region || profile?.region || 'Iringa'}</strong></div><div><span>Members</span><strong>{memberCount}</strong></div><div><span>Group fund</span><strong>{formatTzs(groupFund)}</strong></div></div>
            <p className="vikundi-modal-context">Your group brings local farmers together to coordinate produce sales, input purchases, and shared activities.</p>
            <div className="vikundi-modal-actions"><button type="button" onClick={() => setSelectedGroup(null)}>Close</button><button type="button" onClick={() => { setSelectedGroup(null); setActiveSection('calendar'); }}>View Activities</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
