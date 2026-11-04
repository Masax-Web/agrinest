import { useEffect, useState } from 'react';
import './FoundationImpactPortal.css';

const portalNavigation = [
  ['dashboard', 'Impact Dashboard', 'dashboard'],
  ['scholarships', 'Scholarships', 'school'],
  ['projects', 'Projects', 'yard'],
  ['contributions', 'Contributions', 'payments'],
  ['awards', 'Community Awards', 'military_tech'],
];

const impactProjects = [
  { title: 'Iringa Girls Agri-Scholarship', progress: 69, detail: '248 of 360 Students Sponsored' },
  { title: 'Drought Relief Dodoma', progress: 82, detail: 'TZS 12.3M of TZS 15M target' },
  { title: 'Borehole Singida', progress: 88, detail: 'Infrastructure phase: Pump installation' },
];

const awards = [
  { icon: 'workspace_premium', title: 'Best Smallholder', description: 'Honoring efficiency & grit', tone: 'gold' },
  { icon: 'bolt', title: 'Most Innovative', description: 'Tech-forward farming', tone: 'mint' },
  { icon: 'groups', title: 'Best Farmer Group', description: 'Excellence in cooperation', tone: 'green' },
];

function FoundationImpactPortal({ user, onLogout, onOpenEvidence, onOpenCommunity, onOpenSecurity }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRoundUpEnabled, setIsRoundUpEnabled] = useState(true);
  const [dialog, setDialog] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [notice, setNotice] = useState('');
  const userName = user?.name || user?.email || 'Foundation Member';
  const userInitials = userName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => {
    if (!dialog) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDialog('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog]);

  const navigate = (view) => {
    setActiveView(view);
    setIsSidebarOpen(false);
    setNotice('');
  };

  const startDonation = (project = '') => {
    setSelectedProject(project);
    setDialog('donation');
    setNotice('');
  };

  const renderDashboard = () => (
    <>
      <section className="foundation-hero">
        <div className="foundation-hero-copy">
          <div className="foundation-eyebrow"><span className="material-symbols-outlined">public</span> Foundation Hub</div>
          <h1>Giving Back to Our Communities</h1>
          <div className="foundation-hero-stats">
            <div><span>Total Disbursed</span><strong>TZS 142M</strong></div>
            <div><span>Beneficiaries</span><strong>847</strong></div>
            <div><span>Communities</span><strong>12</strong></div>
          </div>
        </div>
      </section>

      <section className="foundation-highlights" aria-label="Foundation priorities">
        <button type="button" className="foundation-highlight scholarships" onClick={() => navigate('scholarships')}>
          <span className="material-symbols-outlined">school</span>
          <span><strong>Scholarships</strong><small>42 New grants pending</small></span>
        </button>
        <button type="button" className="foundation-highlight relief" onClick={() => navigate('projects')}>
          <span className="material-symbols-outlined">emergency</span>
          <span><strong>Emergency Relief</strong><small>Active in Dodoma Region</small></span>
        </button>
        <button type="button" className="foundation-highlight infrastructure" onClick={() => navigate('projects')}>
          <span className="material-symbols-outlined">foundation</span>
          <span><strong>Infrastructure</strong><small>3 Borehole projects live</small></span>
        </button>
        <button type="button" className="foundation-highlight innovation" onClick={() => navigate('projects')}>
          <span className="material-symbols-outlined">lightbulb</span>
          <span><strong>Innovation</strong><small>Researching climate-smart seeds</small></span>
        </button>
      </section>

      <div className="foundation-dashboard-grid">
        <div className="foundation-dashboard-primary">
          <section className="foundation-scholarship-callout">
            <div>
              <h2>Scholarship Eligibility</h2>
              <p>Your profile meets the high-trust criteria for the 2026 Academic Cycle.</p>
              <div className="foundation-trust-row">
                <span className="foundation-trust-score"><span className="material-symbols-outlined">verified</span>Trust Score: 845</span>
                <strong>Excellent Standing</strong>
              </div>
            </div>
            <button type="button" className="foundation-primary-button" onClick={() => setDialog('scholarship')}>Apply Now</button>
          </section>

          <section className="foundation-card foundation-chart-card">
            <div className="foundation-card-heading">
              <div><h2>Foundation Impact 2026</h2><p>Projected resource distribution (Billion TZS)</p></div>
              <div className="foundation-chart-legend"><span><i />Allocated</span><span><i />Spent</span></div>
            </div>
            <div className="foundation-chart" role="img" aria-label="Quarterly allocated and spent resources. Q4 is projected.">
              {[
                ['Q1', 42, 25],
                ['Q2', 62, 42],
                ['Q3', 77, 60],
                ['Q4 (Est.)', 94, 40],
              ].map(([quarter, allocated, spent], index) => (
                <div className="foundation-quarter" key={quarter}>
                  <div className="foundation-bar-pair">
                    <span className={index === 3 ? 'foundation-bar allocated projected' : 'foundation-bar allocated'} style={{ height: `${allocated}%` }} />
                    <span className={index === 3 ? 'foundation-bar spent projected' : 'foundation-bar spent'} style={{ height: `${spent}%` }} />
                  </div>
                  <span className="foundation-quarter-label">{quarter}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="foundation-awards-section">
            <div className="foundation-section-heading">
              <h2>Shambaa Awards 2026</h2>
              <button type="button" className="foundation-text-button" onClick={() => navigate('awards')}>View All Categories <span className="material-symbols-outlined">chevron_right</span></button>
            </div>
            <div className="foundation-award-grid">
              {awards.map((award) => (
                <button type="button" className="foundation-award-card" key={award.title} onClick={() => navigate('awards')}>
                  <span className={`foundation-award-icon ${award.tone}`}><span className="material-symbols-outlined">{award.icon}</span></span>
                  <strong>{award.title}</strong>
                  <small>{award.description}</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="foundation-dashboard-secondary">
          <section className="foundation-card foundation-project-card">
            <h2>Live Impact Projects</h2>
            <div className="foundation-project-list">
              {impactProjects.map((project) => (
                <div className="foundation-project" key={project.title}>
                  <div className="foundation-project-heading"><strong>{project.title}</strong><span>{project.progress}%</span></div>
                  <div className="foundation-progress-track" role="progressbar" aria-label={`${project.title} progress`} aria-valuenow={project.progress} aria-valuemin="0" aria-valuemax="100">
                    <span style={{ width: `${project.progress}%` }} />
                  </div>
                  <small>{project.detail}</small>
                </div>
              ))}
            </div>
            <button type="button" className="foundation-outline-button" onClick={() => navigate('projects')}>Support Projects</button>
          </section>

          <section className="foundation-contribute-card">
            <h2>How to Contribute</h2>
            <div className="foundation-payment-method">
              <span className="material-symbols-outlined">smartphone</span>
              <div><strong>M-Pesa</strong><span>Mobile money details</span><small>Contact the foundation team</small></div>
            </div>
            <div className="foundation-payment-method">
              <span className="material-symbols-outlined">account_balance</span>
              <div><strong>CRDB Bank</strong><span>Bank transfer details</span><small>Request verified instructions</small></div>
            </div>
            <label className="foundation-roundup-control">
              <span className="material-symbols-outlined">refresh</span>
              <span><strong>Soko Round-Up</strong><small>Donate loose change from sales</small></span>
              <input type="checkbox" checked={isRoundUpEnabled} onChange={(event) => setIsRoundUpEnabled(event.target.checked)} aria-label="Enable Soko Round-Up" />
            </label>
          </section>
        </aside>
      </div>
    </>
  );

  const renderCollection = () => {
    if (activeView === 'scholarships') {
      return (
        <section className="foundation-collection">
          <div className="foundation-collection-heading"><div><span>COMMUNITY &amp; GROWTH</span><h1>Scholarships</h1><p>Education opportunities supporting the next generation of agricultural leaders.</p></div><button type="button" className="foundation-primary-button" onClick={() => setDialog('scholarship')}>Apply for a Scholarship</button></div>
          <div className="foundation-collection-grid">
            {[
              ['2026 Academic Cycle', 'Applications open', 'Scholarships for students pursuing agriculture and related studies.', '42 grants pending'],
              ['Iringa Girls Agri-Scholarship', 'In progress', 'Supporting girls continuing their education in agricultural science.', '248 of 360 students sponsored'],
              ['Young Innovators Award', 'Coming soon', 'A new opportunity for youth-led climate-smart farming ideas.', 'Applications opening soon'],
            ].map(([title, status, description, detail]) => <article className="foundation-card foundation-opportunity-card" key={title}><span className="foundation-status-pill">{status}</span><h2>{title}</h2><p>{description}</p><small>{detail}</small><button type="button" className="foundation-outline-button" onClick={() => setDialog('scholarship')}>View opportunity</button></article>)}
          </div>
        </section>
      );
    }

    if (activeView === 'projects') {
      return (
        <section className="foundation-collection">
          <div className="foundation-collection-heading"><div><span>FOUNDATION HUB</span><h1>Community Projects</h1><p>Follow local initiatives and choose a project to support.</p></div></div>
          <div className="foundation-collection-grid">
            {impactProjects.map((project) => <article className="foundation-card foundation-opportunity-card" key={project.title}><span className="foundation-status-pill">Active project</span><h2>{project.title}</h2><p>{project.detail}</p><div className="foundation-progress-track"><span style={{ width: `${project.progress}%` }} /></div><div className="foundation-project-heading"><small>Funding progress</small><strong>{project.progress}%</strong></div><button type="button" className="foundation-primary-button" onClick={() => startDonation(project.title)}>Support this project</button></article>)}
          </div>
        </section>
      );
    }

    if (activeView === 'contributions') {
      return (
        <section className="foundation-collection">
          <div className="foundation-collection-heading"><div><span>COMMUNITY &amp; GROWTH</span><h1>Contributions</h1><p>Every contribution helps strengthen a farming community.</p></div><button type="button" className="foundation-primary-button" onClick={() => startDonation()}>Make a Contribution</button></div>
          <div className="foundation-contributions-layout">
            <article className="foundation-card foundation-contribution-detail"><span className="material-symbols-outlined">volunteer_activism</span><h2>Support the Foundation</h2><p>Choose an active project or contribute to the foundation’s community programmes.</p><button type="button" className="foundation-primary-button" onClick={() => startDonation()}>Choose contribution amount</button></article>
            <article className="foundation-card foundation-contribution-detail"><span className="material-symbols-outlined">refresh</span><h2>Soko Round-Up</h2><p>Round up marketplace sales to support community initiatives.</p><label className="foundation-roundup-light"><span>{isRoundUpEnabled ? 'Round-Up is enabled' : 'Round-Up is paused'}</span><input type="checkbox" checked={isRoundUpEnabled} onChange={(event) => setIsRoundUpEnabled(event.target.checked)} /></label></article>
          </div>
        </section>
      );
    }

    return (
      <section className="foundation-collection">
        <div className="foundation-collection-heading"><div><span>COMMUNITY &amp; GROWTH</span><h1>Shambaa Awards 2026</h1><p>Celebrating the people and groups building a stronger agricultural community.</p></div></div>
        <div className="foundation-award-grid foundation-award-grid-expanded">
          {awards.map((award) => <article className="foundation-card foundation-award-card" key={award.title}><span className={`foundation-award-icon ${award.tone}`}><span className="material-symbols-outlined">{award.icon}</span></span><strong>{award.title}</strong><small>{award.description}</small><button type="button" className="foundation-outline-button" onClick={() => setNotice(`Nominations for ${award.title} will be announced soon.`)}>Learn about this category</button></article>)}
        </div>
        {notice && <p className="foundation-notice" role="status">{notice}</p>}
      </section>
    );
  };

  return (
    <div className="foundation-portal">
      <header className="foundation-topbar">
        <button type="button" className="foundation-mobile-menu" onClick={() => setIsSidebarOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={isSidebarOpen}>
          <span className="material-symbols-outlined">menu</span>
        </button>
        <button type="button" className="foundation-wordmark" onClick={() => navigate('dashboard')}>AGRI-NEST</button>
        <nav className="foundation-top-navigation" aria-label="Main navigation">
          {portalNavigation.slice(0, 4).map(([view, label]) => <button type="button" key={view} className={activeView === view ? 'active' : ''} onClick={() => navigate(view)}>{label}</button>)}
        </nav>
        <div className="foundation-account-actions">
          <button type="button" aria-label="Open notifications" onClick={() => setDialog('notifications')}><span className="material-symbols-outlined">notifications</span></button>
          <button type="button" aria-label="Open contributions" onClick={() => navigate('contributions')}><span className="material-symbols-outlined">account_balance_wallet</span></button>
          <div className="foundation-profile-wrap">
            <button type="button" className="foundation-profile-button" aria-label="Open account menu" aria-expanded={isProfileOpen} onClick={() => setIsProfileOpen((open) => !open)}>{userInitials}</button>
            {isProfileOpen && <div className="foundation-profile-menu"><strong>{userName}</strong><button type="button" onClick={onLogout}>Sign out</button></div>}
          </div>
        </div>
      </header>

      {isSidebarOpen && <button type="button" className="foundation-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className={isSidebarOpen ? 'foundation-sidebar open' : 'foundation-sidebar'}>
        <div className="foundation-sidebar-heading"><h2>Impact Portal</h2><p>Community &amp; Growth</p></div>
        <nav aria-label="Impact portal navigation">
          {portalNavigation.map(([view, label, icon]) => <button type="button" key={view} className={activeView === view ? 'active' : ''} onClick={() => navigate(view)}><span className="material-symbols-outlined">{icon}</span><span>{label}</span></button>)}
        </nav>
        <div className="foundation-sidebar-footer">
          <button type="button" className="foundation-donate-button" onClick={() => startDonation()}>Make a Donation</button>
          <button type="button" onClick={() => navigate('settings')}><span className="material-symbols-outlined">settings</span>Settings</button>
          <button type="button" onClick={() => navigate('support')}><span className="material-symbols-outlined">help</span>Support</button>
          <button type="button" onClick={onOpenEvidence}><span className="material-symbols-outlined">verified</span>Evidence Archive</button>
          <button type="button" onClick={onOpenCommunity}><span className="material-symbols-outlined">forum</span>Community Chat</button>
        </div>
      </aside>

      <main className="foundation-main">
        {activeView === 'dashboard' ? renderDashboard() : activeView === 'settings' || activeView === 'support' ? (
          <section className="foundation-collection"><div className="foundation-collection-heading"><div><span>FOUNDATION HUB</span><h1>{activeView === 'settings' ? 'Settings' : 'Support'}</h1><p>{activeView === 'settings' ? 'Manage your foundation portal preferences.' : 'For help with scholarships, projects, or contributions, contact the foundation team.'}</p></div></div><article className="foundation-card foundation-opportunity-card"><h2>{activeView === 'settings' ? 'Account security' : 'How can we help?'}</h2><p>{activeView === 'settings' ? 'Review your sign-in and account security settings.' : 'Use the Community Chat or contact your AGRI-NEST administrator for assistance.'}</p><button type="button" className="foundation-outline-button" onClick={activeView === 'support' ? onOpenCommunity : onOpenSecurity}>{activeView === 'settings' ? 'Manage account security' : 'Open Community Chat'}</button></article></section>
        ) : renderCollection()}
      </main>

      <nav className="foundation-mobile-navigation" aria-label="Mobile navigation">
        {[['dashboard', 'Impact', 'analytics'], ['projects', 'Projects', 'diversity_3'], ['contributions', 'Give', 'volunteer_activism'], ['awards', 'Awards', 'workspace_premium']].map(([view, label, icon]) => <button type="button" className={activeView === view ? 'active' : ''} key={view} onClick={() => navigate(view)}><span className="material-symbols-outlined">{icon}</span><span>{label}</span></button>)}
      </nav>

      {activeView === 'dashboard' && <button type="button" className="foundation-quick-donation" aria-label="Quick donation" onClick={() => startDonation()}><span className="material-symbols-outlined">add</span><span>Quick Donation</span></button>}
      {notice && activeView !== 'awards' && <div className="foundation-toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

      {dialog && <div className="foundation-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(''); }}>
        <section className="foundation-dialog" role="dialog" aria-modal="true" aria-labelledby="foundation-dialog-title">
          <button type="button" className="foundation-dialog-close" aria-label="Close dialog" onClick={() => { setDialog(''); setNotice(''); }}><span className="material-symbols-outlined">close</span></button>
          {dialog === 'donation' ? <>
            <span className="foundation-dialog-icon material-symbols-outlined">volunteer_activism</span>
            <h2 id="foundation-dialog-title">Support {selectedProject || 'the Foundation'}</h2>
            <p>Donation checkout isn’t available yet. Contact the foundation team for verified payment instructions.</p>
            <div className="foundation-verified-payment-note"><span className="material-symbols-outlined">verified_user</span>Payment details are shared securely by the foundation team.</div>
            <button type="button" className="foundation-primary-button" onClick={() => { setDialog(''); setNotice('Please contact the foundation team for verified contribution instructions.'); }}>Got it</button>
          </> : dialog === 'scholarship' ? <>
            <span className="foundation-dialog-icon material-symbols-outlined">school</span>
            <h2 id="foundation-dialog-title">2026 Academic Cycle</h2>
            <p>The scholarship application workflow isn’t available here yet. Contact the foundation team for eligibility details and application dates.</p>
            <button type="button" className="foundation-primary-button" onClick={() => setDialog('')}>Got it</button>
          </> : <>
            <span className="foundation-dialog-icon material-symbols-outlined">notifications</span>
            <h2 id="foundation-dialog-title">Notifications</h2>
            <p>You’re all caught up on foundation updates.</p>
            <button type="button" className="foundation-primary-button" onClick={() => setDialog('')}>Close</button>
          </>}
        </section>
      </div>}
    </div>
  );
}

export default FoundationImpactPortal;
