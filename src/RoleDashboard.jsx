import { useState } from 'react';
import RoleWorkspace from './RoleWorkspace';

const dashboards = {
  commercial: {
    title: 'Commercial Farm',
    greeting: 'Farm Operations',
    summary: 'Coordinate fields, produce, workforce, and sales from one workspace.',
    navigation: [['fields', 'agriculture', 'Fields'], ['listings', 'storefront', 'Produce'], ['income', 'payments', 'Sales'], ['logistics', 'local_shipping', 'Logistics'], ['workforce', 'groups', 'Workforce'], ['analytics', 'analytics', 'Analytics'], ['settings', 'settings', 'Settings']],
    metrics: [['fields', 'agriculture', 'Field Records'], ['listings', 'storefront', 'Produce Offers'], ['income', 'payments', 'Sales Records'], ['workforce', 'groups', 'Workforce Records']],
  },
  bank: {
    title: 'Financial Services',
    greeting: 'Finance Portfolio',
    summary: 'Track farmer applications, portfolio reviews, repayments, and risk follow-ups.',
    navigation: [['applications', 'assignment', 'Applications'], ['portfolio', 'account_balance', 'Portfolio'], ['repayments', 'payments', 'Repayments'], ['risk', 'verified_user', 'Risk Reviews'], ['reports', 'assessment', 'Reports'], ['settings', 'settings', 'Settings']],
    metrics: [['applications', 'assignment', 'Application Records'], ['portfolio', 'account_balance', 'Portfolio Reviews'], ['repayments', 'payments', 'Repayment Records'], ['risk', 'verified_user', 'Risk Reviews']],
  },
  coop: {
    title: 'Cooperative Hub',
    greeting: 'Cooperative Operations',
    summary: 'Organize members, collective produce, group orders, and training follow-ups.',
    navigation: [['members', 'groups', 'Members'], ['groups', 'diversity_3', 'Groups'], ['produce', 'agriculture', 'Produce Lots'], ['orders', 'receipt_long', 'Orders'], ['payments', 'payments', 'Payments'], ['training', 'school', 'Training'], ['settings', 'settings', 'Settings']],
    metrics: [['members', 'groups', 'Member Records'], ['produce', 'agriculture', 'Produce Lots'], ['orders', 'receipt_long', 'Order Records'], ['groups', 'diversity_3', 'Group Records']],
  },
  expert: {
    title: 'Expert Services',
    greeting: 'Advisory Desk',
    summary: 'Track farmer consultations, field visits, diagnoses, and follow-up advice.',
    navigation: [['consultations', 'support_agent', 'Consultations'], ['visits', 'map', 'Field Visits'], ['advisory', 'description', 'Advisory Notes'], ['diagnostics', 'biotech', 'Diagnostics'], ['community', 'forum', 'Community'], ['settings', 'settings', 'Settings']],
    metrics: [['consultations', 'support_agent', 'Consultation Records'], ['visits', 'map', 'Field Visits'], ['advisory', 'description', 'Advice Notes'], ['diagnostics', 'biotech', 'Diagnostic Records']],
  },
};

function loadRecords(role) {
  try {
    const records = JSON.parse(window.localStorage.getItem(`agrinest-${role}-workspace-records`) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export default function RoleDashboard({ role, persona, onLogout }) {
  const personaDashboard = persona ? {
    title: persona.label,
    greeting: `${persona.label} Workspace`,
    summary: `Manage ${persona.modules.map((module) => module.label.toLowerCase()).join(', ')} from your AGRI-NEST workspace.`,
    navigation: persona.modules.map(({ id, label, icon }) => [id, icon, label]),
    metrics: persona.modules.slice(0, 4).map(({ id, label, icon }) => [id, icon, label]),
  } : null;
  const dashboard = dashboards[role] || personaDashboard || {
    title: 'AGRI-NEST Workspace',
    greeting: 'Workspace',
    summary: 'Manage your AGRI-NEST records and follow-ups.',
    navigation: [['records', 'task_alt', 'Records']],
    metrics: [['records', 'task_alt', 'Records']],
  };
  const [activeView, setActiveView] = useState('overview');
  const [records, setRecords] = useState(() => loadRecords(role));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const recordCounts = (view) => records.filter((record) => record.module === view).length;
  const visibleRecords = records.filter((record) => Object.values(record).join(' ').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className={isSidebarOpen ? 'role-dashboard-shell' : 'role-dashboard-shell sidebar-collapsed'}>
      <header className="role-dashboard-topbar">
        <div className="role-dashboard-topbar-left">
          <button type="button" className="role-dashboard-menu" aria-label="Toggle navigation" aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen((open) => !open)}><span className="material-symbols-outlined">menu</span></button>
          <div className="role-dashboard-topbar-title"><strong>AGRI-NEST</strong><span>{dashboard.title}</span></div>
          <label className="role-dashboard-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this workspace" aria-label="Search workspace records" /></label>
        </div>
        <div className="role-dashboard-topbar-actions">
          <button type="button" aria-label="Notifications" onClick={() => setActiveView('notifications')}><span className="material-symbols-outlined">notifications</span></button>
          <button type="button" className="role-dashboard-avatar" aria-label="Open profile menu" aria-expanded={isProfileMenuOpen} onClick={() => setIsProfileMenuOpen((open) => !open)}>{dashboard.title.slice(0, 1)}</button>
          {isProfileMenuOpen && <div className="role-dashboard-profile-menu" role="dialog" aria-label="Profile menu"><strong>{dashboard.title}</strong><span>AGRI-NEST account</span><button type="button" onClick={onLogout}><span className="material-symbols-outlined">logout</span>Sign out</button></div>}
        </div>
      </header>
      <aside className={isSidebarOpen ? 'role-dashboard-sidebar' : 'role-dashboard-sidebar collapsed'}>
        <div className="role-dashboard-brand"><span className="material-symbols-outlined">agriculture</span><div><strong>AGRI-NEST</strong><small>{dashboard.title}</small></div></div>
        <button type="button" className={activeView === 'overview' ? 'role-dashboard-nav active' : 'role-dashboard-nav'} onClick={() => setActiveView('overview')}><span className="material-symbols-outlined">dashboard</span>Overview</button>
        {dashboard.navigation.map(([view, icon, label]) => <button key={view} type="button" className={activeView === view ? 'role-dashboard-nav active' : 'role-dashboard-nav'} onClick={() => setActiveView(view)}><span className="material-symbols-outlined">{icon}</span>{label}</button>)}
        <div className="role-dashboard-sidebar-bottom"><span>{dashboard.title}</span><button type="button" className="role-dashboard-nav" onClick={onLogout}><span className="material-symbols-outlined">logout</span>Sign out</button></div>
      </aside>
      <main className="role-dashboard-main">
        {activeView === 'overview' ? (
          <>
            <header className="role-dashboard-heading"><div><span>AGRI-NEST WORKSPACE</span><h1>{dashboard.greeting}</h1><p>{dashboard.summary}</p></div><button type="button" onClick={() => setActiveView(dashboard.navigation[0][0])}>Open workspace<span className="material-symbols-outlined">arrow_forward</span></button></header>
            <section className="role-dashboard-metrics">{dashboard.metrics.map(([view, icon, label]) => <button type="button" key={view} onClick={() => setActiveView(view)}><span className="material-symbols-outlined">{icon}</span><strong>{recordCounts(view)}</strong><small>{label}</small></button>)}</section>
            <section className="role-dashboard-quick-links"><div><span>WORKSPACES</span><h2>Recent records</h2></div>{visibleRecords.length ? visibleRecords.slice(0, 5).map((record) => <button type="button" key={record.id} onClick={() => setActiveView(record.module)}><span className="material-symbols-outlined">{dashboard.navigation.find(([view]) => view === record.module)?.[1] || 'task_alt'}</span><span><strong>{record.title || record.name || record.module}</strong><small>{record.details || 'Open saved record'}</small></span></button>) : <p>{records.length ? 'No records match this search.' : 'No records yet. Open a workspace to add the first one.'}</p>}</section>
          </>
        ) : (
          <RoleWorkspace role={role} persona={persona} page={activeView} onBack={() => setActiveView('overview')} onSaved={setRecords} />
        )}
      </main>
    </div>
  );
}