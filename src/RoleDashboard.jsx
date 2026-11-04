import { useState } from 'react';
import RoleWorkspace from './RoleWorkspace';
import LabourWorkspace from './LabourWorkspace';
import EquipmentRentalWorkspace from './EquipmentRentalWorkspace';
import AccountSecurityEntry from './AccountSecurityEntry';
import WorkforceMarketplace from './WorkforceMarketplace';
import roleModel from '../shared/role-model.json';

const dashboards = {
  commercial: {
    title: 'Commercial Farm',
    greeting: 'Farm Operations',
    summary: 'Coordinate fields, produce, workforce, and sales from one workspace.',
    navigation: [['fields', 'agriculture', 'Fields'], ['listings', 'storefront', 'Produce'], ['income', 'payments', 'Sales'], ['logistics', 'local_shipping', 'Logistics'], ['workforce', 'groups', 'Workforce & Tasks'], ['payroll', 'payments', 'Payroll'], ['analytics', 'analytics', 'Analytics'], ['settings', 'settings', 'Settings']],
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
  worker: {
    title: 'Agricultural Worker',
    greeting: 'Worker Opportunities',
    summary: 'Build your profile, find farm jobs, and follow your applications.',
    navigation: [['jobs', 'work', 'Find Farm Work'], ['applications', 'assignment', 'My Applications'], ['profile', 'account_circle', 'Worker Profile'], ['settings', 'settings', 'Settings']],
    metrics: [['jobs', 'work', 'Open Jobs'], ['applications', 'assignment', 'Applications'], ['profile', 'account_circle', 'Worker Profile']],
  },
};

function loadRecords(storageKey) {
  try {
    const records = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function loadLabourRecords(storageKey) {
  try {
    const records = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    return { records: {
      requests: Array.isArray(records.requests) ? records.requests : [],
      payroll: Array.isArray(records.payroll) ? records.payroll : [],
    }, error: '' };
  } catch (error) {
    console.error('Could not read workforce records:', error);
    return { records: { requests: [], payroll: [] }, error: 'Workforce records could not be read from this browser.' };
  }
}

export default function RoleDashboard({ role, persona, user, onLogout, onOpenSecurity, initialView = 'overview' }) {
  const recordsStorageKey = `agrinest-${role}-workspace-records:${user?.user_id || 'anonymous'}:${persona?.id || 'unknown'}`;
  const labourStorageKey = `agrinest-commercial-labour-records:${user?.user_id || 'anonymous'}`;
  const journey = roleModel.coreRoles.find((coreRole) => coreRole.id === user?.role)?.journey || [];
  const personaDashboard = persona ? {
    title: persona.label,
    greeting: `${persona.label} Workspace`,
    summary: `Manage ${persona.modules.map((module) => module.label.toLowerCase()).join(', ')} from your AGRI-NEST workspace.`,
    navigation: persona.modules.map(({ id, label, icon }) => [id, icon, label]),
    metrics: persona.modules.slice(0, 4).map(({ id, label, icon }) => [id, icon, label]),
  } : null;
  const baseDashboard = dashboards[role] || personaDashboard || {
    title: 'AGRI-NEST Workspace',
    greeting: 'Workspace',
    summary: 'Manage your AGRI-NEST records and follow-ups.',
    navigation: [['records', 'task_alt', 'Records']],
    metrics: [['records', 'task_alt', 'Records']],
  };
  const journeyNavigation = journey.map(({ module, label, icon }) => [module, icon, label]);
  const dashboardNavigation = [
    ...baseDashboard.navigation,
    ...journeyNavigation.filter(([view]) => !baseDashboard.navigation.some(([existingView]) => existingView === view)),
  ];
  const dashboard = {
    ...baseDashboard,
    navigation: dashboardNavigation.some(([view]) => view === 'settings')
      ? dashboardNavigation
      : [...dashboardNavigation, ['settings', 'settings', 'Settings']],
  };
  const [activeView, setActiveView] = useState(initialView);
  const [records, setRecords] = useState(() => loadRecords(recordsStorageKey));
  const [labourState, setLabourState] = useState(() => loadLabourRecords(labourStorageKey));
  const labourRecords = labourState.records;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const recordCounts = (view) => records.filter((record) => record.module === view).length;
  const visibleRecords = records.filter((record) => Object.values(record).join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const updateLabourRecords = (key, nextRecords) => {
    const next = { ...labourRecords, [key]: nextRecords };
    try {
      window.localStorage.setItem(labourStorageKey, JSON.stringify(next));
      setLabourState({ records: next, error: '' });
    } catch (error) {
      console.error('Could not save workforce records:', error);
      setLabourState((current) => ({ ...current, error: 'Workforce changes could not be saved in this browser.' }));
    }
  };

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
        ) : role === 'worker' && ['jobs', 'applications', 'profile'].includes(activeView) ? (
          <WorkforceMarketplace key={`${user?.user_id}-${activeView}`} user={user} mode="worker" section={activeView} />
        ) : role === 'commercial' && ['workforce', 'payroll'].includes(activeView) ? (
          <>
            {labourState.error && <div className="role-workspace-notice" role="alert">{labourState.error}</div>}
          <LabourWorkspace
            page={activeView === 'payroll' ? 'payroll' : 'labour'}
            user={user}
              profile={{ name: user?.name || 'Farm manager', location: user?.region || '' }}
              records={labourRecords}
              onRecordsChange={updateLabourRecords}
              onNavigate={(target) => setActiveView(target === 'payroll' ? 'payroll' : 'workforce')}
              onBack={() => setActiveView('overview')}
            />
          </>
        ) : role === 'equipment' && ['equipment', 'availability', 'bookings', 'maintenance'].includes(activeView) ? (
          <EquipmentRentalWorkspace
            mode="owner"
            section={activeView}
            user={user}
            profile={{ name: user?.name || 'Equipment owner' }}
            onBack={() => setActiveView('overview')}
            onNavigate={setActiveView}
          />
        ) : activeView === 'settings' ? (
            <>
              <RoleWorkspace
                role={role}
                persona={persona}
                page={activeView}
                storageKey={recordsStorageKey}
                journeyStep={journey.find((step) => step.module === activeView)}
                onBack={() => setActiveView('overview')}
                onSaved={setRecords}
              />
              <AccountSecurityEntry onOpenSecurity={onOpenSecurity} />
            </>
          ) : <RoleWorkspace
            role={role}
            persona={persona}
            page={activeView}
            storageKey={recordsStorageKey}
            journeyStep={journey.find((step) => step.module === activeView)}
            onBack={() => setActiveView('overview')}
            onSaved={setRecords}
          />}
      </main>
    </div>
  );
}