import { useCallback, useEffect, useState } from 'react';
import api from './lib/api';
import { personas } from '../shared/personas.json';
import AccountSecurityEntry from './AccountSecurityEntry';

const adminPersonas = personas.filter((persona) => persona.id !== 'super_admin');
const invitationalPersonas = personas.filter((persona) => persona.registration === 'invite' && persona.id !== 'super_admin');

export default function AdminDashboard({ user, onLogout, onOpenSecurity, onImpersonate }) {
  const [section, setSection] = useState('users');
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [locationReviews, setLocationReviews] = useState([]);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [invitePersona, setInvitePersona] = useState(invitationalPersonas[0]?.id || '');
  const [invitation, setInvitation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [userResult, auditResult, integrationResult, messageResult, locationReviewResult] = await Promise.all([
        api.getAdminUsers(filter ? { q: search, status: filter } : search ? { q: search } : {}),
        api.getAdminAudit(100),
        api.getAdminIntegrations(),
        api.getAdminMessages(),
        api.getFarmLocationReviews(),
      ]);
      setUsers(userResult.users || []);
      setAudit(auditResult.entries || []);
      setIntegrations(integrationResult.integrations || []);
      setMessages(messageResult.messages || []);
      setLocationReviews(locationReviewResult.reviews || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load administrator data.');
    }
  }, [filter, search]);

  useEffect(() => { refresh(); }, [refresh]);

  const runAction = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (actionError) {
      setError(actionError.message || 'The requested action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleInvitation = async (event) => {
    event.preventDefault();
    setInvitation('');
    await runAction(async () => {
      const result = await api.createAdminInvitation(invitePersona);
      setInvitation(result.token);
    });
  };

  const handleImpersonate = async (account) => {
    const accountLabel = account.name || account.email || account.phone || 'this account';
    const personaLabel = personas.find((persona) => persona.id === account.persona_id)?.label || account.persona_id || account.role;
    const confirmed = window.confirm(
      `Temporarily access ${accountLabel} as ${personaLabel} for up to 15 minutes? Actions will apply to this account and the session will be recorded in the audit log.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      await onImpersonate(account);
    } catch (actionError) {
      setError(actionError.message || 'Could not start the impersonation session.');
      setBusy(false);
    }
  };

  const sections = [
    ['users', 'manage_accounts', 'Users'],
    ['moderation', 'forum', 'Moderation'],
    ['farm-locations', 'location_on', 'Farm location reviews'],
    ['integrations', 'tune', 'Integrations'],
    ['audit', 'history', 'Audit log'],
    ['settings', 'settings', 'Settings'],
  ];

  return (
    <div className="admin-console">
      <header className="admin-console-header">
        <div><strong>AGRI-NEST</strong><span>Platform administration</span></div>
        <div className="admin-console-actions">
          <span>{user?.email || user?.name || 'Administrator'}</span>
          <button type="button" onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <div className="admin-console-layout">
        <nav className="admin-console-nav" aria-label="Administration">
          {sections.map(([id, icon, label]) => (
            <button type="button" key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>
              <span className="material-symbols-outlined">{icon}</span>{label}
            </button>
          ))}
          <button type="button" className="admin-console-refresh" onClick={refresh} disabled={busy}>Refresh data</button>
        </nav>
        <main className="admin-console-content">
          <div className="admin-console-heading">
            <div><span>ADMINISTRATOR CONSOLE</span><h1>{sections.find(([id]) => id === section)?.[2]}</h1></div>
            {section === 'users' && <button type="button" onClick={() => setSection('audit')}>View audit log</button>}
          </div>
          {error && <p className="admin-console-error" role="alert">{error}</p>}

          {section === 'users' && (
            <>
              <div className="admin-console-toolbar">
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" aria-label="Search users" />
                <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by account status">
                  <option value="">All statuses</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option>
                </select>
                <button type="button" onClick={refresh} disabled={busy}>Search</button>
              </div>
              <div className="admin-console-table-wrap">
                <table className="admin-console-table">
                  <thead><tr><th>Account</th><th>Persona</th><th>Status</th><th>Security</th><th>Actions</th></tr></thead>
                  <tbody>{users.map((account) => (
                    <tr key={account.user_id}>
                      <td><strong>{account.name || 'Unnamed account'}</strong><small>{account.email || account.phone || account.user_id}</small></td>
                      <td>
                        <select value={account.persona_id} disabled={busy || account.is_admin} aria-label={`Persona for ${account.email || account.name}`} onChange={(event) => runAction(() => api.setAdminUserPersona(account.user_id, event.target.value))}>
                          {adminPersonas.map((persona) => <option key={persona.id} value={persona.id}>{persona.label}</option>)}
                          {account.is_admin && <option value={account.persona_id}>{personas.find((persona) => persona.id === account.persona_id)?.label || account.persona_id}</option>}
                        </select>
                      </td>
                      <td><span className={`admin-status ${account.role_status}`}>{account.role_status}</span></td>
                      <td>{account.pin_enabled ? 'PIN enabled' : account.password_enabled ? 'Password' : 'Google'}</td>
                      <td className="admin-console-row-actions">
                        {account.role_status === 'pending' && <button type="button" disabled={busy} onClick={() => runAction(() => api.approveAdminUser(account.user_id))}>Approve</button>}
                        {!account.is_admin && account.role_status !== 'pending' && <button type="button" className="admin-secondary-button" disabled={busy} onClick={() => runAction(() => api.setAdminUserStatus(account.user_id, account.role_status === 'suspended' ? 'active' : 'suspended'))}>{account.role_status === 'suspended' ? 'Reactivate' : 'Suspend'}</button>}
                        {!account.is_admin && account.role_status === 'active' && <button type="button" className="admin-impersonate-button" disabled={busy} aria-label={`Switch to ${account.name || account.email || 'user'} account`} onClick={() => handleImpersonate(account)}><span className="material-symbols-outlined">switch_account</span>Switch to account</button>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                {!users.length && <p className="admin-console-empty">No accounts match this search.</p>}
              </div>
              <form className="admin-invitation-form" onSubmit={handleInvitation}>
                <div><strong>Invite staff</strong><small>Invitation tokens are single-use and expire after seven days.</small></div>
                <select value={invitePersona} onChange={(event) => setInvitePersona(event.target.value)} aria-label="Staff persona">
                  {invitationalPersonas.map((persona) => <option value={persona.id} key={persona.id}>{persona.label}</option>)}
                </select>
                <button type="submit" disabled={busy || !invitePersona}>Create invitation</button>
              </form>
              {invitation && <p className="admin-invitation-token">Copy this invitation token and share it securely: <code>{invitation}</code></p>}
            </>
          )}

          {section === 'moderation' && (
            <div className="admin-console-table-wrap">
              <table className="admin-console-table">
                <thead><tr><th>Author</th><th>Message</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>{messages.map((message) => (
                  <tr key={message.message_id}><td>{message.author}</td><td>{message.body}</td><td>{new Date(message.created_at).toLocaleString()}</td><td><button type="button" className="admin-danger-button" disabled={busy} onClick={() => runAction(() => api.deleteAdminMessage(message.message_id))}>Remove</button></td></tr>
                ))}</tbody>
              </table>
              {!messages.length && <p className="admin-console-empty">No community messages to review.</p>}
            </div>
          )}

          {section === 'farm-locations' && (
            <div className="admin-console-table-wrap">
              <p>Farm points registered within 50 m are allowed but flagged for review. Only farmer and farm IDs are shown here; no profile details or messaging access are exposed.</p>
              <table className="admin-console-table">
                <thead><tr><th>New farm / farmer</th><th>Nearby farm / farmer</th><th>Distance</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{locationReviews.map((review) => (
                  <tr key={review.review_id}>
                    <td><strong>{review.new_farm_id}</strong><small>Farmer ID {review.new_farmer_id}</small></td>
                    <td><strong>{review.nearby_farm_id}</strong><small>Farmer ID {review.nearby_farmer_id}</small></td>
                    <td>{Math.round(Number(review.distance_m))} m</td>
                    <td><span className={`admin-status ${review.status}`}>{review.status}</span></td>
                    <td className="admin-console-row-actions">
                      {review.status === 'pending' && <>
                        <button type="button" disabled={busy} onClick={() => runAction(() => api.resolveFarmLocationReview(review.review_id, 'reviewed'))}>Reviewed</button>
                        <button type="button" className="admin-secondary-button" disabled={busy} onClick={() => runAction(() => api.resolveFarmLocationReview(review.review_id, 'dismissed'))}>Dismiss</button>
                      </>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {!locationReviews.length && <p className="admin-console-empty">No farm location reviews are pending.</p>}
            </div>
          )}

          {section === 'integrations' && (
            <div className="admin-integration-list">
              <p>Enable or disable configured providers. Secrets remain in Railway and are never shown here.</p>
              {integrations.map((integration) => (
                <div className="admin-integration-row" key={integration.id}>
                  <div><strong>{integration.label}</strong><small>{integration.configured ? 'Credentials configured in deployment' : 'Credentials not configured in deployment'}</small></div>
                  <label><input type="checkbox" checked={integration.enabled} disabled={busy || !integration.configured} onChange={(event) => runAction(() => api.setAdminIntegration(integration.id, event.target.checked))} /> Enabled</label>
                </div>
              ))}
            </div>
          )}

          {section === 'audit' && (
            <div className="admin-audit-list">
              {!audit.length && <p className="admin-console-empty">No administrative actions have been recorded.</p>}
              {audit.map((entry) => (
                <article key={entry.audit_id}>
                  <div><strong>{entry.action.replaceAll('.', ' ')}</strong><small>{entry.actor_email || 'System'}{entry.target_email ? ` → ${entry.target_email}` : ''}</small></div>
                  <time>{new Date(entry.created_at).toLocaleString()}</time>
                </article>
              ))}
            </div>
          )}

          {section === 'settings' && <AccountSecurityEntry onOpenSecurity={onOpenSecurity} />}
        </main>
      </div>
    </div>
  );
}
