import { useEffect, useRef, useState } from 'react';
import api from './lib/api';

const roleButtons = [
  { id: 'smallholder', label: 'Farmer', icon: 'agriculture' },
  { id: 'commercial', label: 'Commercial', icon: 'domain' },
  { id: 'buyer', label: 'Buyer', icon: 'shopping_cart' },
  { id: 'bank', label: 'Financial', icon: 'account_balance' },
  { id: 'gov', label: 'Institutional', icon: 'account_balance_wallet' },
  { id: 'student', label: 'Student', icon: 'school' },
  { id: 'transporter', label: 'Transporter', icon: 'local_shipping' },
  { id: 'coop', label: 'Cooperative', icon: 'groups' },
  { id: 'expert', label: 'Expert', icon: 'science' },
];

const initialNotifications = [
  {
    id: 'armyworm',
    period: 'Today',
    title: 'Pest Outbreak Alert: Fall Armyworm',
    time: '10:42 AM',
    body: 'High probability of Fall Armyworm detected in Sector 4 based on recent weather patterns and neighboring reports. Immediate scouting recommended.',
    icon: 'warning',
    tone: 'critical',
    unread: true,
  },
  {
    id: 'payment',
    period: 'Today',
    title: 'Payment Received: Soko Marketplace',
    time: '08:15 AM',
    body: 'A payment of KES 45,000 for your recent Maize harvest delivery has been credited to your Kilimo Wallet.',
    icon: 'account_balance_wallet',
    tone: 'finance',
    unread: true,
  },
  {
    id: 'moisture',
    period: 'Yesterday',
    title: 'Low Soil Moisture Advisory',
    time: 'Yesterday, 4:30 PM',
    body: 'Soil moisture sensors in Block B have dropped below 30%. Consider initiating supplementary irrigation for optimal tomato growth.',
    icon: 'water_drop',
    tone: 'advisory',
    unread: false,
  },
  {
    id: 'community',
    period: 'Yesterday',
    title: "New Message in 'Rift Valley Growers'",
    time: 'Yesterday, 11:20 AM',
    body: 'Agronomist Sarah posted a new guide on managing nitrogen deficiency during the early vegetative stage.',
    icon: 'forum',
    tone: 'community',
    unread: false,
  },
  {
    id: 'spray-diary',
    period: 'Last Week',
    title: 'Platform Update: New Spray Diary Features',
    time: 'Oct 12',
    body: "We've added automated chemical compatibility checks to the Spray Diary. Tap to explore the new safety features.",
    icon: 'system_update',
    tone: 'system',
    unread: false,
  },
];

const initialChatConversations = [
  {
    id: 'iringa-women',
    name: 'Iringa Women Farmers',
    role: 'Group',
    time: '10:45 AM',
    preview: 'Sawa! I will be there on Friday.',
    avatar: null,
    icon: 'group',
    active: true,
    messages: [
      { id: 'grace-1', author: 'Grace', time: '10:42 AM', body: 'Habari! The collective fertilizer order is ready for pickup.', incoming: true, avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80' },
      { id: 'neema-1', author: 'You', time: '10:45 AM', body: 'Sawa! I will be there on Friday.', incoming: false },
      { id: 'grace-2', author: 'Grace', body: 'Attached: Stock_Receipt.jpg', incoming: true, avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80', image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=900&q=85' },
    ],
  },
  {
    id: 'richard',
    name: 'Dr. Richard Mgata',
    role: 'Expert',
    time: 'Yesterday',
    preview: 'The soil analysis reports are ready.',
    avatar: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=120&q=80',
    messages: [{ id: 'richard-1', author: 'Dr. Richard Mgata', time: 'Yesterday', body: 'The soil analysis reports are ready.', incoming: true, avatar: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=120&q=80' }],
  },
  {
    id: 'samuel',
    name: 'Samuel Banda',
    role: 'Transporter',
    time: 'Monday',
    preview: 'I am arriving at the depot in 30 mins.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    messages: [{ id: 'samuel-1', author: 'Samuel Banda', time: 'Monday', body: 'I am arriving at the depot in 30 mins.', incoming: true, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80' }],
  },
  {
    id: 'agriseeds',
    name: 'AgriSeeds Iringa',
    role: 'Shop',
    time: 'Feb 12',
    preview: 'Your maize seeds order is confirmed.',
    avatar: null,
    icon: 'storefront',
    messages: [{ id: 'agriseeds-1', author: 'AgriSeeds Iringa', time: 'Feb 12', body: 'Your maize seeds order is confirmed.', incoming: true }],
  },
];

const initialJichoScans = [
  { id: 'scan-cabbage', diagnosis: 'Cabbage Looper', confidence: 0.94, farm: 'Farm A', time: '2 hours ago', image: 'https://images.unsplash.com/photo-1598030343246-eec71cb4423f?auto=format&fit=crop&w=180&q=80', severity: 'low' },
  { id: 'scan-nitrogen', diagnosis: 'Nitrogen Deficiency', confidence: 0.87, farm: 'Farm B', time: 'Yesterday', image: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=180&q=80', severity: 'medium' },
  { id: 'scan-coffee', diagnosis: 'Coffee Berry Borer', confidence: 0.91, farm: 'Highland Sector', time: 'Oct 24', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=180&q=80', severity: 'high' },
];

function useNavScrollLock(isSidebarOpen) {
  useEffect(() => {
    const updateBodyScroll = () => {
      const shouldLockScroll = window.innerWidth <= 980 && isSidebarOpen;
      document.body.style.overflow = shouldLockScroll ? 'hidden' : '';
      document.body.style.touchAction = shouldLockScroll ? 'none' : '';
    };

    updateBodyScroll();
    window.addEventListener('resize', updateBodyScroll);

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      window.removeEventListener('resize', updateBodyScroll);
    };
  }, [isSidebarOpen]);
}

function getInitialSidebarState() {
  return typeof window === 'undefined' || window.innerWidth > 980;
}

function App() {
  const [activeTab, setActiveTab] = useState('signin');
  const [selectedRole, setSelectedRole] = useState('smallholder');
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeDashboard, setActiveDashboard] = useState('smallholder');

  const handleLogin = (event) => {
    event.preventDefault();
    const nextDashboard = selectedRole === 'buyer' ? 'buyer' : selectedRole === 'gov' ? 'gov' : selectedRole === 'student' ? 'student' : selectedRole === 'transporter' ? 'transporter' : 'smallholder';
    setActiveDashboard(nextDashboard);
    setLoggedIn(true);
  };

  if (loggedIn && activeDashboard === 'buyer') {
    return <BuyerDashboard onLogout={() => setLoggedIn(false)} />;
  }

  if (loggedIn && activeDashboard === 'gov') {
    return <InstitutionalDashboard onLogout={() => setLoggedIn(false)} />;
  }

  if (loggedIn && activeDashboard === 'student') {
    return <StudentDashboard onLogout={() => setLoggedIn(false)} />;
  }

  if (loggedIn && activeDashboard === 'transporter') {
    return <TransporterDashboard onLogout={() => setLoggedIn(false)} />;
  }

  if (loggedIn) {
    return <SmallholderDashboard onLogout={() => setLoggedIn(false)} />;
  }

  return (
    <div className="agrinest-auth-shell">
      <div className="agrinest-visual-panel">
        <div className="agrinest-brand-row">
          <span className="agrinest-icon">eco</span>
          <span className="agrinest-brand">AGRI-NEST</span>
        </div>

        <h1 className="agrinest-hero-title">Empowering the Future of Farming</h1>
        <p className="agrinest-hero-copy">
          The unified digital infrastructure for Africa&apos;s agricultural ecosystem. Securely connect, grow, and thrive.
        </p>

        <div className="agrinest-metric-row">
          <div className="agrinest-metric-card">
            <p className="metric-label">Ecosystem Growth</p>
            <p className="metric-value">50K+</p>
            <p className="metric-caption">Verified Producers</p>
          </div>
          <div className="agrinest-metric-card">
            <p className="metric-label">Transaction Value</p>
            <p className="metric-value">2B+</p>
            <p className="metric-caption">TZS Facilitated</p>
          </div>
        </div>

        <div className="agrinest-security-pill">
          <div className="agri-shield">shield</div>
          <div>
            <h3>Institutional Security</h3>
            <p>ISO 27001 Certified Data Infrastructure</p>
          </div>
        </div>
      </div>

      <div className="agrinest-form-panel">
        <div className="agrinest-header-row">
          <div className="agrinest-tabs">
            <button
              type="button"
              className={activeTab === 'signin' ? 'tab-button active' : 'tab-button'}
              onClick={() => setActiveTab('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={activeTab === 'register' ? 'tab-button active' : 'tab-button'}
              onClick={() => setActiveTab('register')}
            >
              Register
            </button>
          </div>

          <button type="button" className="staff-access-button">
            <span className="inline-icon">admin_panel_settings</span>
            Staff Access
          </button>
        </div>

        {activeTab === 'signin' ? (
          <div className="signin-panel">
            <div className="signin-heading">
              <h2>Welcome Back</h2>
              <p>Sign in to access your role-based dashboard.</p>
            </div>

            <div className="role-grid">
              {roleButtons.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={selectedRole === role.id ? 'role-option active' : 'role-option'}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <span className="material-symbols-outlined role-icon">{role.icon}</span>
                  <span className="role-name">{role.label}</span>
                </button>
              ))}
            </div>

            <form className="signin-form" onSubmit={handleLogin}>
              <label className="field-label">
                <span>Phone or Email Address</span>
                <div className="input-shell">
                  <span className="input-icon">person</span>
                  <input type="text" defaultValue="neema@agrines.tz" placeholder="e.g., +255... or email@example.com" />
                </div>
              </label>

              <label className="field-label">
                <div className="password-label-row">
                  <span>PIN or Password</span>
                  <a href="#">Forgot?</a>
                </div>
                <div className="input-shell">
                  <span className="input-icon">lock</span>
                  <input type="password" defaultValue="demo1234" placeholder="Enter security key" />
                  <button type="button" className="visibility-button" aria-label="Toggle password visibility">
                    visibility_off
                  </button>
                </div>
              </label>

              <label className="remember-row">
                <input type="checkbox" defaultChecked />
                <span>Keep me signed in on this device</span>
              </label>

              <button type="submit" className="primary-action">
                Secure Login
                <span className="arrow-forward">arrow_forward</span>
              </button>

              <div className="notice-box">
                <span className="notice-icon">info</span>
                <p>
                  <strong>Note:</strong> You will be automatically redirected to your specific module (Farmer, Buyer, or institutional) based on your account credentials.
                </p>
              </div>
            </form>
          </div>
        ) : (
          <div className="register-panel">
            <div className="signin-heading">
              <h2>Join the Nest</h2>
              <p>Choose your role to customize your experience.</p>
            </div>

            <div className="role-grid">
              {roleButtons.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={selectedRole === role.id ? 'role-option active' : 'role-option'}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <span className="material-symbols-outlined role-icon">{role.icon}</span>
                  <span className="role-name">{role.label}</span>
                </button>
              ))}
            </div>

            <div className="register-box">
              <div className="register-row two-up">
                <label>
                  <span>Full Name</span>
                  <input type="text" placeholder="e.g. John Doe" />
                </label>
                <label>
                  <span>Contact</span>
                  <input type="tel" placeholder="+255..." />
                </label>
              </div>

              <div className="role-section active">
                <h4>
                  <span className="material-symbols-outlined">location_on</span>
                  Farm Details
                </h4>
                <input type="text" placeholder="Farm Location (Region/District)" />
                <input type="text" placeholder="Primary Crops (e.g. Maize, Coffee)" />
                <input type="text" placeholder="Group/Association Membership (Optional)" />
              </div>
            </div>

            <button type="button" className="primary-action register-submit">
              Complete Verified Registration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SmallholderDashboard({ onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarState);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [notifications, setNotifications] = useState(initialNotifications);

  useNavScrollLock(isSidebarOpen);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const shouldClose = !event.target.closest('.user-avatar-wrap') && !event.target.closest('.profile-menu');
      if (shouldClose) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const navSections = [
    {
      items: [
        { label: 'Dashboard', icon: 'dashboard', active: true },
        { label: 'Digital Farm', icon: 'agriculture' },
        { label: 'Jicho AI', icon: 'psychology' },
        { label: 'Livestock', icon: 'pets' },
        { label: 'Hesabu Yangu', icon: 'calculate' },
        { label: 'Marketplace', icon: 'shopping_cart' },
        { label: 'Transport', icon: 'local_shipping' },
        { label: 'Agrishop Network', icon: 'storefront' },
        { label: 'Experts', icon: 'person_search' },
        { label: 'Groups', icon: 'groups' },
      ],
    },
    {
      heading: 'Learning & Training',
      items: [
        { label: 'Wanafunzi Hub', icon: 'school' },
        { label: 'Community Chat', icon: 'forum' },
      ],
    },
    {
      heading: 'Finance Hub',
      items: [
        { label: 'Insurance', icon: 'shield' },
        { label: 'Payroll & Labour', icon: 'payments' },
      ],
    },
    {
      heading: 'Intelligence',
      items: [
        { label: 'Ramani — Maps', icon: 'map' },
        { label: 'Habari — Market News', icon: 'newspaper' },
        { label: 'Analytics', icon: 'analytics' },
        { label: 'Farmer Forum', icon: 'diversity_3' },
        { label: 'Traceability & QR', icon: 'qr_code_2' },
        { label: 'Compliance & Export', icon: 'fact_check' },
        { label: 'Farm ERP', icon: 'precision_manufacturing' },
      ],
    },
    {
      heading: 'Community',
      items: [
        { label: 'Rentals & Labour', icon: 'construction' },
        { label: 'Rent Space / Land', icon: 'landscape' },
        { label: 'Hire / Find Work', icon: 'work' },
        { label: 'Rent Equipment', icon: 'agriculture' },
        { label: 'Waste Exchange', icon: 'recycling' },
      ],
    },
    {
      heading: 'Green & Impact',
      items: [
        { label: 'Carbon Credits', icon: 'eco' },
        { label: 'Crowdfunding', icon: 'volunteer_activism' },
        { label: 'AGRI-NEST Foundation', icon: 'groups_2' },
      ],
    },
  ];

  return (
    <div className="smallholder-shell">
      <button
        type="button"
        className={isSidebarOpen ? 'sidebar-backdrop visible' : 'sidebar-backdrop'}
        onClick={() => setIsSidebarOpen(false)}
        aria-label="Close navigation"
      />
      <nav className={isSidebarOpen ? 'sidebar-nav' : 'sidebar-nav collapsed'}>
        <div className="sidebar-header">
          <h1>AGRI-NEST</h1>
          <p>Agricultural OS · Tanzania</p>
        </div>

        <div className="sidebar-links">
          {navSections.map((section, sectionIndex) => (
            <div key={section.heading || `section-${sectionIndex}`} className="nav-section">
              {section.heading && <div className="nav-section-heading">{section.heading}</div>}
              {section.items.map((item) => {
                const isActive = item.label === 'Community Chat'
                  ? activeView === 'community'
                  : item.label === 'Jicho AI'
                    ? activeView === 'jicho'
                    : item.active && activeView === 'dashboard';
                return (
                <a
                  key={item.label}
                  className={isActive ? 'nav-item active' : 'nav-item'}
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    if (item.label === 'Community Chat') setActiveView('community');
                    if (item.label === 'Jicho AI') setActiveView('jicho');
                    if (item.label === 'Dashboard') setActiveView('dashboard');
                  }}
                >
                  <span className={isActive ? 'material-symbols-outlined fill-icon' : 'material-symbols-outlined'}>{item.icon}</span>
                  {item.label}
                </a>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="nav-user-pill">
            <span className="material-symbols-outlined">person</span>
            Neema Mwangi
          </div>
        </div>
      </nav>

      <div className={isSidebarOpen ? 'dashboard-main' : 'dashboard-main nav-collapsed'}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="sidebar-toggle"
              type="button"
              aria-label="Toggle sidebar"
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen((open) => !open)}
            >
              <span className="menu-hamburger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            {activeView === 'community' && <h2 className="topbar-page-title">Community Chat</h2>}
            {activeView === 'jicho' && <h2 className="topbar-page-title">Jicho AI</h2>}
            <div className="search-shell">
              <span className="material-symbols-outlined">search</span>
              <input type="text" placeholder="Search..." />
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className={activeView === 'notifications' ? 'top-icon active' : 'top-icon'}
              aria-label="Open notifications"
              onClick={() => setActiveView('notifications')}
            >
              <span className="material-symbols-outlined">notifications</span>
              {notifications.some((notification) => notification.unread) && <span className="badge-dot" />}
            </button>
            <button
              type="button"
              className="user-avatar-wrap"
              aria-label="Open profile menu"
              aria-expanded={isProfileMenuOpen}
              onClick={() => setIsProfileMenuOpen((open) => !open)}
            >
              <img
                alt="Farmer profile"
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80"
              />
            </button>

            {isProfileMenuOpen && (
              <div className="profile-menu" role="dialog" aria-label="Profile details">
                <div className="profile-menu-header">
                  <div className="user-avatar-wrap large">
                    <img
                      alt="Farmer profile"
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80"
                    />
                  </div>
                  <div>
                    <div className="profile-menu-name">Neema Mwangi</div>
                    <div className="profile-menu-role">Smallholder Farmer</div>
                  </div>
                </div>

                <div className="profile-menu-details">
                  <div>
                    <span>Phone</span>
                    <strong>+255 712 345 678</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>Iringa, Tanzania</strong>
                  </div>
                  <div>
                    <span>Farm</span>
                    <strong>Mtakuja Farm</strong>
                  </div>
                </div>

                <div className="profile-menu-actions">
                  <button type="button" className="profile-edit-btn">Edit profile</button>
                  <button
                    type="button"
                    className="profile-logout-btn"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {activeView === 'notifications' ? (
          <NotificationCenter
            notifications={notifications}
            onNotificationsChange={setNotifications}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        ) : activeView === 'community' ? (
          <CommunityChat onBackToDashboard={() => setActiveView('dashboard')} />
        ) : activeView === 'jicho' ? (
          <JichoDiagnostic onBackToDashboard={() => setActiveView('dashboard')} />
        ) : (
        <main className="content-area">
          <section className="welcome-block">
            <div className="welcome-panel">
              <div className="welcome-glow glow-one" />
              <div className="welcome-glow glow-two" />
              <div className="welcome-inner">
                <h2>Habari za jioni, Neema! 🌙</h2>
                <p>Evening summary ready. Log today&apos;s activities before signing off.</p>
              </div>
            </div>

            <div className="ticker-wrapper">
              <span className="live-badge"><span className="pulse-dot" />📡 Live</span>
              <div className="ticker-rail">
                <div className="ticker-track">
                  <span><strong>[Weather]</strong> 🌧️ Tanzania Meteorological Agency: Favorable rains expected through April in Southern Highlands</span>
                  <span>•</span>
                  <span><strong>[Research]</strong> 🌾 TARI releases drought-tolerant maize variety DK8031 — 40% higher yield in dry conditions</span>
                  <span>•</span>
                  <span><strong>[Markets]</strong> 💰 World Food Programme: Maize prices stabilizing after Q1 shortage — expect TZS 1,100–1,250/kg through June</span>
                  <span>•</span>
                  <span><strong>[Pest Alert]</strong> 🐛 FAO Alert: Fall Armyworm pressure increasing in Iringa, Mbeya, Morogoro districts</span>
                  <span>•</span>
                  <span><strong>[Finance]</strong> 🏦 NMB Bank launches TZS 50B smallholder farmer loan program — apply through AGRI-NEST</span>
                  <span>•</span>
                  <span><strong>[Platform]</strong> 📱 AGRI-NEST crosses 50,000 registered farmers milestone — 3 new regions added</span>
                  <span>•</span>
                  <span><strong>[Policy]</strong> 🌍 COP30 agriculture commitments: Tanzania to receive $200M for climate-smart farming</span>
                </div>
              </div>
            </div>
          </section>

          <section className="stats-grid">
            {[
              { icon: '🌾', value: '0', label: 'Active Fields' },
              { icon: '⭐', value: '855', label: 'Trust Score' },
              { icon: '🛒', value: '0', label: 'Active Listings' },
              { icon: '💰', value: '840K', label: 'Season Income' },
              { icon: '🐄', value: '0', label: 'Livestock Head' },
              { icon: '👥', value: '1', label: 'My Groups' },
            ].map((item) => (
              <div className="stat-card" key={item.label}>
                <div className="stat-head">
                  <span>{item.icon}</span>
                </div>
                <div>
                  <p className="stat-value">{item.value}</p>
                  <p className="stat-label">{item.label}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="action-row">
            {['Sell Produce', 'Scan Crop', 'Apply Loan', 'Get Expert', 'Book Transport', 'Log Activity', 'Rent Space', 'Hire Labour', 'Sell Waste', 'Get Insurance', 'Smart Loan'].map((item, index) => (
              <button key={item} className="action-pill" type="button">
                <span>{['🛒', '🔍', '🏦', '👨‍🌾', '🚛', '📸', '🏚️', '👷', '♻️', '☂️', '🤖'][index]}</span>
                {item}
              </button>
            ))}
          </section>

          <section className="main-grid">
            <div className="left-column">
              <div className="panel-card">
                <div className="panel-header">
                  <h3><span className="material-symbols-outlined text-error">warning</span>Alerts &amp; Reminders</h3>
                </div>
                <div className="alert-grid">
                  <div className="alert-box alert-pink">
                    <span>🌿</span>
                    <div>
                      <p className="alert-title">Possible Leaf Rust — Field 2</p>
                      <p className="alert-note">Jicho AI detected potential rust</p>
                    </div>
                  </div>
                  <div className="alert-box alert-peach">
                    <span>💉</span>
                    <div>
                      <p className="alert-title">Cattle Deworming Due</p>
                      <p className="alert-note">3 cattle overdue</p>
                    </div>
                  </div>
                  <div className="alert-box alert-green">
                    <span>🏦</span>
                    <div>
                      <p className="alert-title">Loan Approved!</p>
                      <p className="alert-note">TZS 500,000 CRDB input loan</p>
                    </div>
                  </div>
                  <div className="alert-box alert-slate">
                    <span>🐛</span>
                    <div>
                      <p className="alert-title">Armyworm Alert — Iringa</p>
                      <p className="alert-note">14 farms reported</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dual-panel-grid">
                <div className="panel-card">
                  <div className="panel-header">
                    <h3>Season Progress</h3>
                  </div>
                  <div className="progress-box">
                    <div className="progress-row">
                      <div className="progress-line-head">
                        <span>🌽 Maize — Field 1 (1.5 ac)</span>
                        <span className="progress-value secondary-text">65%</span>
                      </div>
                      <div className="progress-track"><div className="progress-fill progress-secondary" style={{ width: '65%' }} /></div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-line-head">
                        <span>🌻 Sunflower — Field 3 (0.8 ac)</span>
                        <span className="progress-value tertiary-text">40%</span>
                      </div>
                      <div className="progress-track"><div className="progress-fill progress-tertiary" style={{ width: '40%' }} /></div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-line-head">
                        <span>🫘 Beans — Field 2 (1.2 ac)</span>
                        <span className="progress-value primary-text">82%</span>
                      </div>
                      <div className="progress-track"><div className="progress-fill progress-primary" style={{ width: '82%' }} /></div>
                    </div>
                    <div className="financial-box">
                      <h4>Financials</h4>
                      <div className="financial-row"><span>Projected Revenue</span><span>TZS 2.4M</span></div>
                      <div className="financial-row"><span>Costs to Date</span><span className="text-error">TZS 680K</span></div>
                      <div className="financial-row total-row"><span>Est. Profit</span><span className="text-green">TZS 1.72M</span></div>
                    </div>
                  </div>
                </div>

                <div className="panel-card">
                  <div className="panel-header">
                    <h3>Season Status</h3>
                  </div>
                  <div className="status-grid">
                    <div className="mini-stat"><span>🌾</span><span className="mini-label">Crop health</span><span className="mini-value">Managed</span></div>
                    <div className="mini-stat"><span>💰</span><span className="mini-label">Profit so far</span><span className="mini-value">+TZS 160K</span></div>
                    <div className="mini-stat"><span>📋</span><span className="mini-label">Overdue tasks</span><span className="mini-value danger">2 overdue</span></div>
                    <div className="mini-stat"><span>💊</span><span className="mini-label">PHI countdowns</span><span className="mini-value">None active</span></div>
                  </div>
                </div>
              </div>

              <div className="dual-panel-grid">
                <div className="panel-card">
                  <div className="panel-header">
                    <h3>Personalised Tips</h3>
                  </div>
                  <div className="tips-list">
                    <div className="tip-box tip-green"><span>🌱</span><p><strong>Time to plant Maize!</strong> May is in your planting window.</p></div>
                    <div className="tip-box"><span>💊</span><p>Apply fertilizer to Maize this month (May).</p></div>
                    <div className="tip-box tip-red"><span>🐛</span><p>Watch for Fall armyworm on your Maize — common at this time of year.</p></div>
                  </div>
                </div>

                <div className="panel-card crop-card">
                  <div className="panel-header inline-header">
                    <h3>Crop Alerts</h3>
                    <a href="#">View Jicho <span className="material-symbols-outlined">arrow_forward</span></a>
                  </div>
                  <div className="crop-list">
                    <div className="crop-row"><span>🟢</span><div><p>Maize: Fall Armyworm</p><small>Early planting before moth flight peak...</small></div></div>
                    <div className="crop-row"><span>🟢</span><div><p>Maize: Maize Stalk Borer</p><small>Early planting (escape peak moth flights)...</small></div></div>
                    <div className="crop-row"><span>🟢</span><div><p>Maize: African Armyworm</p><small>Pheromone monitoring traps...</small></div></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="right-column">
              <div className="weather-panel">
                <div className="weather-top">
                  <div>
                    <p>📍 Iringa · Wed 13 May</p>
                    <div className="weather-temp"><span>17°</span><span className="temp-unit">C</span></div>
                    <p className="weather-clear">Clear sky</p>
                  </div>
                  <span className="weather-symbol">🌙</span>
                </div>
                <div className="weather-grid">
                  <div><p>Humidity</p><strong>84%</strong></div>
                  <div><p>Wind</p><strong>15 km/h</strong></div>
                  <div><p>UV</p><strong>4</strong></div>
                  <div><p>Rain</p><strong>0.0mm</strong></div>
                </div>
                <div className="weather-footer">🌾 Good field conditions today</div>
                <div className="forecast-row">
                  {['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'].map((day, index) => (
                    <div className="forecast-day" key={day}>
                      <p>{day}</p>
                      <div>{['🌦️', '☁️', '☁️', '☁️', '🌤️', '🌤️', '🌤️'][index]}</div>
                      <strong>{['24°', '24°', '24°', '23°', '24°', '25°', '26°'][index]}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="market-card">
                <div className="panel-header inline-header">
                  <h3><span className="material-symbols-outlined">monitoring</span>Live Market Prices</h3>
                  <a href="#">All prices <span className="material-symbols-outlined">arrow_forward</span></a>
                </div>
                <div className="chart-box">[Market Chart Placeholder]</div>
                <div className="market-list">
                  <div className="market-row"><span>Maize (Iringa)</span><strong>TZS 850/kg <span className="trend-up">↑</span></strong></div>
                  <div className="market-row"><span>Beans (Mbeya)</span><strong>TZS 1,200/kg <span className="trend-down">↓</span></strong></div>
                </div>
              </div>

              <div className="ussd-card">
                <div className="ussd-header">
                  <span>📱</span>
                  <h3>USSD &amp; SMS Access — *123#</h3>
                </div>
                <p>AGRI-NEST works on any phone — no smartphone needed. Dial *123# for prices, weather, and pest alerts.</p>
                <div className="ussd-grid">
                  <div><p>*123*1#</p><small>Market prices</small></div>
                  <div><p>*123*2#</p><small>Weather forecast</small></div>
                  <div><p>*123*3#</p><small>Pest alerts nearby</small></div>
                  <div><p>*123*4#</p><small>My loan balance</small></div>
                  <div><p>*123*5#</p><small>Order inputs</small></div>
                  <div className="voice-box"><p>Sauti AI</p><small>Swahili voice bot</small></div>
                </div>
                <button type="button" className="ussd-button">📱 Try USSD Simulator</button>
              </div>
            </div>
          </section>
        </main>
        )}
      </div>
    </div>
  );
}

function JichoDiagnostic({ onBackToDashboard }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scans, setScans] = useState(initialJichoScans);
  const [result, setResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('scan');
  const [expertRequested, setExpertRequested] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    api.getJichoScans({ farmer_id: 'demo-farmer' })
      .then((payload) => {
        if (payload?.scans?.length) setScans(payload.scans);
      })
      .catch(() => {});
  }, []);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError('');
    event.target.value = '';
  };

  const scanCrop = () => {
    if (!selectedFile) {
      setError('Upload a crop photo before starting the scan.');
      return;
    }
    setIsScanning(true);
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      api.diagnoseCrop({ farmer_id: 'demo-farmer', image_base64: reader.result, crop: 'unknown' })
        .then((payload) => {
          const scan = {
            id: payload.scan_id || `scan-${Date.now()}`,
            diagnosis: payload.diagnosis,
            confidence: payload.confidence,
            recommended_treatment: payload.recommended_treatment,
            farm: 'Current field',
            time: 'Just now',
            image: previewUrl,
            severity: payload.severity || 'medium',
          };
          setResult(scan);
          setScans((current) => [scan, ...current.filter((item) => item.id !== scan.id)]);
        })
        .catch(() => setError('The diagnostic service is unavailable. Check the API and try again.'))
        .finally(() => setIsScanning(false));
    };
    reader.readAsDataURL(selectedFile);
  };

  const displayResult = result || {
    diagnosis: 'Maize Lethal Necrosis',
    confidence: 0.942,
    recommended_treatment: 'Belt Expert 480 SC or Neem Oil Concentrate',
    severity: 'high',
  };

  return (
    <main className="jicho-page">
      <div className="jicho-workspace-tabs">
        {[['scan', 'document_scanner', 'AI Scan'], ['crops', 'agriculture', 'Crops'], ['soils', 'layers', 'Soils'], ['pests', 'bug_report', 'Pests & Diseases'], ['ndvi', 'sensors', 'NDVI']].map(([id, icon, label]) => (
          <button type="button" className={activeTab === id ? 'jicho-workspace-tab active' : 'jicho-workspace-tab'} key={id} onClick={() => setActiveTab(id)}>
            <span className="material-symbols-outlined">{icon}</span>{label}
          </button>
        ))}
      </div>
      {activeTab === 'crops' ? <JichoCrops /> : activeTab === 'soils' ? <JichoKnowledge title="Soils" icon="layers" copy="Explore soil profiles, nutrient signals, and practical field preparation guidance." /> : activeTab === 'pests' ? <JichoKnowledge title="Pests & Diseases" icon="bug_report" copy="Review regional pest alerts and connect them to a Jicho scan." /> : activeTab === 'ndvi' ? <JichoKnowledge title="NDVI Monitor" icon="sensors" copy="Monitor crop vigor from satellite vegetation signals and field observations." /> : (
      <div className="jicho-layout">
        <section className="jicho-main-column">
          <button type="button" className="jicho-back-button" onClick={onBackToDashboard}><span className="material-symbols-outlined">arrow_back</span> Dashboard</button>
          <div className="jicho-page-heading">
            <h1>Jicho AI Diagnostic</h1>
            <p>Real-time computer vision analysis for precision crop health.</p>
          </div>
          <div className="jicho-capture-card">
            {previewUrl && <img className="jicho-capture-preview" src={previewUrl} alt="Selected crop for diagnosis" />}
            <div className="jicho-capture-content">
              <div className="jicho-capture-icon"><span className="material-symbols-outlined">{isScanning ? 'progress_activity' : 'add_a_photo'}</span></div>
              <h2>{isScanning ? 'Analyzing crop evidence...' : 'Evidence Capture'}</h2>
              <p>Upload a clear photo of the affected plant area or use your device camera for live processing.</p>
              <div className="jicho-capture-actions">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
                <button type="button" className="jicho-primary-button" onClick={() => cameraInputRef.current?.click()}><span className="material-symbols-outlined">photo_camera</span> Launch Camera</button>
                <button type="button" className="jicho-outline-button" onClick={() => fileInputRef.current?.click()}>Upload Files</button>
                <button type="button" className="jicho-scan-button" disabled={isScanning} onClick={scanCrop}>{isScanning ? 'Scanning...' : 'Run AI Scan'}</button>
              </div>
              {selectedFile && <span className="jicho-file-name">{selectedFile.name}</span>}
              {error && <span className="jicho-error">{error}</span>}
            </div>
          </div>
          <div className="jicho-metrics-grid">
            <div><span>AI Confidence</span><strong>{(displayResult.confidence * 100).toFixed(1)}%</strong><div className="jicho-progress"><i style={{ width: `${displayResult.confidence * 100}%` }} /></div><small>Model: Jicho-Agri-v4.1</small></div>
            <div><span>Processing Latency</span><strong>{isScanning ? '...' : '1.2s'}</strong><div className="jicho-progress gold"><i style={{ width: '30%' }} /></div><small>Edge compute active</small></div>
            <div><span>Visual Markers</span><strong>12 detected</strong><div className="jicho-progress dark"><i style={{ width: '80%' }} /></div><small>Lesions &amp; discoloration</small></div>
          </div>
        </section>
        <aside className="jicho-side-column">
          <div className="jicho-result-card">
            <span className="jicho-severity">SEVERITY: {displayResult.severity.toUpperCase()}</span>
            <h2>{displayResult.diagnosis}</h2>
            <p>{result ? 'Diagnosis returned by the Jicho AI service from your uploaded crop evidence.' : 'Upload a crop photo to replace this sample result with a live API diagnosis.'}</p>
            <div className="jicho-treatment"><small>RECOMMENDED TREATMENT</small><strong>{displayResult.recommended_treatment}</strong><span>Follow label instructions and confirm with an agronomist.</span></div>
            <button type="button" className="jicho-expert-button" onClick={() => setExpertRequested((requested) => !requested)}><span className="material-symbols-outlined">contact_support</span> {expertRequested ? 'Expert Request Ready' : 'Talk to Expert'}</button>
          </div>
          <div className="jicho-history-card"><h3>Recent Scans</h3>{scans.slice(0, historyExpanded ? scans.length : 3).map((scan) => <button type="button" key={scan.id} className="jicho-history-item" onClick={() => setResult(scan)}>{scan.image ? <img src={scan.image} alt="" /> : <span className="material-symbols-outlined">image</span>}<span><strong>{scan.diagnosis}</strong><small>{scan.time} • {scan.farm}</small></span><span className={`material-symbols-outlined jicho-status-${scan.severity}`}>{scan.severity === 'high' ? 'error' : scan.severity === 'medium' ? 'warning' : 'check_circle'}</span></button>)}<button type="button" className="jicho-history-link" onClick={() => setHistoryExpanded((expanded) => !expanded)}>{historyExpanded ? 'Collapse history' : 'View full history'} <span className="material-symbols-outlined">arrow_forward</span></button></div>
        </aside>
      </div>
      )}
    </main>
  );
}

const jichoCropCatalog = [
  { id: 'maize', name: 'Maize (Hybrid 614)', price: 'TZS 1,200/kg', maturity: '120 - 150 Days', yield: '35 Bags / Acre', image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=80', guide: 'Plant with the first reliable rains, maintain 25cm spacing, and scout weekly for armyworm.' },
  { id: 'beans', name: 'Yellow Beans', price: 'TZS 2,800/kg', maturity: '70 - 90 Days', yield: '12 Bags / Acre', image: 'https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?auto=format&fit=crop&w=900&q=80', guide: 'Use well-drained soil, inoculate seed before planting, and harvest pods as they mature.' },
  { id: 'sunflower', name: 'Sunflower (Hysun 33)', price: 'TZS 1,500/kg', maturity: '100 - 120 Days', yield: '1.2 Tons / Acre', image: 'https://images.unsplash.com/photo-1597848212624-e19f6f6d0d1b?auto=format&fit=crop&w=900&q=80', guide: 'Plant in full sun, thin early seedlings, and protect flowering heads from birds.' },
  { id: 'tomato', name: 'Tomato (Assila F1)', price: 'TZS 4,500/box', maturity: '75 - 80 Days', yield: '25 Tons / Acre', image: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=900&q=80', guide: 'Stake plants early, irrigate consistently, and inspect leaves for blight after wet weather.' },
];

function JichoCrops() {
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState('');

  return (
    <div className="jicho-crops-layout">
      <section className="jicho-crops-main">
        <div className="jicho-page-heading"><h1>Crops Knowledge Base</h1><p>Practical growing guidance, market context, and crop health signals for your farm.</p></div>
        <div className="jicho-crop-grid">
          {jichoCropCatalog.map((crop) => (
            <article className="jicho-crop-card" key={crop.id}>
              <div className="jicho-crop-image"><img src={crop.image} alt={crop.name} /><span>{crop.price}</span></div>
              <div className="jicho-crop-body"><h2>{crop.name}</h2><div className="jicho-crop-facts"><span><small>MATURITY</small><strong>{crop.maturity}</strong></span><span><small>AVG YIELD</small><strong>{crop.yield}</strong></span></div><button type="button" onClick={() => setSelectedCrop(crop)}>View Growing Guide</button></div>
            </article>
          ))}
        </div>
      </section>
      <aside className="jicho-crops-aside">
        <div className="jicho-forecast-card"><div className="jicho-forecast-heading"><span className="material-symbols-outlined">query_stats</span><div><h2>Tabiri Forecast</h2><small>Market Price Trends (30 Days)</small></div></div><div className="jicho-bars">{[40, 55, 50, 70, 85, 75, 60, 50, 65, 80].map((height, index) => <i className={index === 4 ? 'peak' : ''} style={{ height: `${height}%` }} key={index} />)}</div><div className="jicho-chart-labels"><span>Today</span><span>+15d</span><span>+30d</span></div><div className="jicho-advice"><strong><span className="material-symbols-outlined">auto_awesome</span> Smart Advice</strong><p>Based on the 30-day forecast and upcoming rain patterns, plant <b>Maize</b> within the next 7 days to maximize germination and profit.</p><button type="button" onClick={() => setReportOpen((open) => !open)}>Generate Detailed Report <span className="material-symbols-outlined">arrow_forward</span></button>{reportOpen && <div className="jicho-report">Planting window: next 7 days. Projected price movement: positive. Recommended action: prepare seed and fertilizer.</div>}</div></div>
        <div className="jicho-alerts-card"><h3>Agronomic Alerts</h3><button type="button" onClick={() => setActiveAlert('Fall Armyworm alert opened in Jicho Scan.')}><span className="material-symbols-outlined">warning</span><span><b>Fall Armyworm Alert</b><small>Reported in nearby clusters.</small></span></button><button type="button" onClick={() => setActiveAlert('Irrigation reminder added to your farm tasks.')}><span className="material-symbols-outlined">wb_sunny</span><span><b>Irrigation Needed</b><small>Dry spell expected next week.</small></span></button>{activeAlert && <p className="jicho-alert-feedback">{activeAlert}</p>}</div>
      </aside>
      {selectedCrop && <div className="jicho-guide-overlay" role="dialog" aria-modal="true"><div className="jicho-guide-modal"><button type="button" className="jicho-guide-close" onClick={() => setSelectedCrop(null)} aria-label="Close growing guide"><span className="material-symbols-outlined">close</span></button><img src={selectedCrop.image} alt={selectedCrop.name} /><h2>{selectedCrop.name}</h2><p>{selectedCrop.guide}</p><button type="button" className="jicho-primary-button" onClick={() => setSelectedCrop(null)}>Done</button></div></div>}
    </div>
  );
}

function JichoKnowledge({ title, icon, copy }) {
  const [opened, setOpened] = useState(false);
  return <div className="jicho-knowledge-panel"><span className="material-symbols-outlined">{icon}</span><h1>{title}</h1><p>{opened ? `The ${title.toLowerCase()} workspace is ready for your next field observation.` : copy}</p><button type="button" className="jicho-primary-button" onClick={() => setOpened((value) => !value)}>{opened ? 'Workspace Ready' : `Open ${title} workspace`}</button></div>;
}

function CommunityChat({ onBackToDashboard }) {
  const [conversations, setConversations] = useState(initialChatConversations);
  const [selectedConversationId, setSelectedConversationId] = useState('iringa-women');
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [location, setLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const messageListRef = useRef(null);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) || conversations[0];
  const visibleConversations = conversations.filter((conversation) => (
    `${conversation.name} ${conversation.role} ${conversation.preview}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  useEffect(() => {
    let active = true;
    api.getCommunityConversations()
      .then((payload) => {
        if (active && payload?.conversations?.length) setConversations(payload.conversations);
      })
      .catch(() => {
        // Keep the seeded local state available while the API is offline.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [selectedConversationId, conversations]);

  const sendMessage = () => {
    const body = draft.trim();
    const attachmentName = attachment?.name;
    if (!body && !attachment && !location) return;
    const message = {
      id: `message-${Date.now()}`,
      author: 'You',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      body: body || (attachmentName ? `Attached: ${attachmentName}` : ''),
      incoming: false,
      attachmentName,
      attachmentPreview: attachment?.uploadUrl || attachment?.previewUrl,
      attachmentKind: attachment?.kind,
      location,
    };
    api.sendCommunityMessage(selectedConversation.id, {
      body,
      attachmentName,
      attachmentUrl: attachment?.uploadUrl || attachment?.previewUrl,
      attachmentKind: attachment?.kind,
      location,
    }).catch(() => {
      // The local state still gives the user an immediate usable conversation.
    });
    setConversations((current) => current.map((conversation) => (
      conversation.id === selectedConversation.id
        ? { ...conversation, preview: body || attachmentName || (location ? `Location shared: ${location.label}` : ''), time: message.time, messages: [...conversation.messages, message] }
        : conversation
    )));
    setDraft('');
    setAttachment(null);
    setLocation(null);
  };

  const addLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          latitude: Number(coords.latitude.toFixed(6)),
          longitude: Number(coords.longitude.toFixed(6)),
          label: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
        });
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const canPreview = file.type.startsWith('image/') && !['heic', 'heif'].includes(extension);
      setAttachment({
        name: file.name,
        previewUrl: canPreview ? URL.createObjectURL(file) : null,
        uploadUrl: null,
      });
      const reader = new FileReader();
      reader.onload = () => setAttachment((current) => (
        current?.name === file.name ? { ...current, uploadUrl: reader.result } : current
      ));
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const toggleVoiceRecording = async () => {
    setRecordingError('');
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError('Microphone access is unavailable in this browser.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setRecordingError('Voice recording is not supported in this browser.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setRecordingError('Microphone permission was denied. Allow microphone access and try again.');
      return;
    }
    const supportedMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    const mimeType = supportedMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      if (!blob.size) {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setRecordingError('No audio was captured. Keep recording for a moment, then stop and try again.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setAttachment({ name: 'voice-message.webm', previewUrl: null, uploadUrl: reader.result, kind: 'audio' });
      reader.readAsDataURL(blob);
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    };
    mediaRecorderRef.current = recorder;
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setRecordingError('The microphone stopped unexpectedly. Please try again.');
    };
    recorder.start(250);
    setIsRecording(true);
  };

  return (
    <main className="community-page">
      <div className="community-chat-layout">
        <section className="community-conversations">
          <div className="community-search">
            <span className="material-symbols-outlined">search</span>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search chats..." aria-label="Search chats" />
          </div>
          <div className="community-conversation-list">
            {visibleConversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={conversation.id === selectedConversation.id ? 'community-conversation active' : 'community-conversation'}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                {conversation.avatar ? <img src={conversation.avatar} alt="" /> : <span className="community-avatar-icon material-symbols-outlined">{conversation.icon}</span>}
                <span className="community-conversation-copy">
                  <span className="community-conversation-title"><strong>{conversation.name} <small>({conversation.role})</small></strong><time>{conversation.time}</time></span>
                  <span>{conversation.preview}</span>
                </span>
              </button>
            ))}
            {!visibleConversations.length && <p className="community-empty">No conversations found.</p>}
          </div>
        </section>

        <section className="community-thread">
          <div className="community-security-banner">
            <span>🛡️</span>
            <p>Your transactions are protected. Never share phone numbers or make payments outside the AGRI-NEST platform.</p>
          </div>
          <div className="community-messages" ref={messageListRef}>
            <div className="community-date-divider"><span>Today</span></div>
            {selectedConversation.messages.map((message) => (
              <div className={message.incoming ? 'community-message incoming' : 'community-message outgoing'} key={message.id}>
                {message.incoming && (message.avatar ? <img src={message.avatar} alt="" /> : <span className="community-message-avatar material-symbols-outlined">person</span>)}
                <div className="community-message-content">
                  <div className="community-message-meta"><strong>{message.author}</strong><time>{message.time}</time></div>
                  <div className="community-message-bubble">
                    {message.image && <img src={message.image} alt="Fertilizer stock" />}
                    {message.attachmentPreview && message.attachmentKind !== 'audio' && <img src={message.attachmentPreview} alt={message.attachmentName || 'Attached image'} />}
                    {message.attachmentKind === 'audio' && message.attachmentPreview && <audio controls src={message.attachmentPreview} />}
                    {message.body && !message.body.startsWith('Attached: ') && <p>{message.body}</p>}
                    {message.attachmentName && <small>Attached: {message.attachmentName}</small>}
                    {message.location && <span className="community-location-tag"><span className="material-symbols-outlined">location_on</span>{message.location.label}</span>}
                  </div>
                  {!message.incoming && <div className="community-message-status"><span className="material-symbols-outlined">done_all</span> Read</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="community-composer-wrap">
            {attachment && (
              <div className="community-attachment-preview">
                {attachment.previewUrl ? <img src={attachment.previewUrl} alt={`Preview of ${attachment.name}`} /> : attachment.kind === 'audio' && attachment.uploadUrl ? <audio controls src={attachment.uploadUrl} aria-label="Voice message preview" /> : <span className="material-symbols-outlined">image</span>}
                <div><strong>{attachment.name}</strong><small>{attachment.kind === 'audio' ? 'Voice preview ready' : attachment.previewUrl ? 'Image preview ready' : 'Preview unavailable for this file format'}</small></div>
                <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><span className="material-symbols-outlined">close</span></button>
              </div>
            )}
            {location && <div className="community-location-composer"><span className="material-symbols-outlined">location_on</span>Location attached: {location.label}<button type="button" onClick={() => setLocation(null)} aria-label="Remove location"><span className="material-symbols-outlined">close</span></button></div>}
            {recordingError && <div className="community-recording-error" role="status">{recordingError}</div>}
            <div className="community-composer">
              <div className="community-composer-tools">
                <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFileChange} />
                <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach a file"><span className="material-symbols-outlined">attach_file</span></button>
                <button type="button" onClick={() => photoInputRef.current?.click()} aria-label="Add photo"><span className="material-symbols-outlined">photo_camera</span></button>
                <button type="button" className={isRecording ? 'recording' : ''} onClick={toggleVoiceRecording} aria-label={isRecording ? 'Stop recording' : 'Record voice message'}><span className="material-symbols-outlined">{isRecording ? 'stop_circle' : 'mic'}</span></button>
                <button type="button" className={location ? 'location-attached' : ''} onClick={addLocation} disabled={isLocating} aria-label="Add location"><span className="material-symbols-outlined">{isLocating ? 'progress_activity' : 'location_on'}</span></button>
              </div>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="Type a message..." aria-label="Type a message" />
              <button type="button" className="community-send-button" onClick={sendMessage} aria-label="Send message"><span className="material-symbols-outlined">send</span></button>
            </div>
          </div>
        </section>
      </div>
      <button type="button" className="community-back-dashboard" onClick={onBackToDashboard}><span className="material-symbols-outlined">arrow_back</span> Dashboard</button>
    </main>
  );
}

function TransporterDashboard({ onLogout }) {
  const [activeView, setActiveView] = useState('home');
  const [tripProgress, setTripProgress] = useState(70);
  const [wallet, setWallet] = useState(240000);
  const [notice, setNotice] = useState('');
  const jobs = [
    { id: 'dodoma-arusha', route: 'Dodoma → Arusha', distance: '120km', cargo: '2,000kg Beans', trust: '98%' },
    { id: 'mbeya-dar', route: 'Mbeya → Dar', distance: '850km', cargo: '8,000kg Rice', trust: '95%' },
    { id: 'morogoro-tanga', route: 'Morogoro → Tanga', distance: '340km', cargo: '1,500kg Sisal', trust: '99%' },
  ];

  const action = (message) => setNotice(message);

  return (
    <div className="transporter-shell">
      <nav className="transporter-sidebar">
        <div className="transporter-brand"><span className="transporter-avatar">FM</span><div><strong>Fleet Dashboard</strong><small>Logistic Service Provider</small></div></div>
        <button type="button" className="transporter-post-button" onClick={() => action('Availability post workspace opened.')}>Post Availability</button>
        {[['dashboard', 'Home', 'home'], ['work_history', 'Open Jobs', 'jobs'], ['distance', 'Active Trips', 'trips'], ['local_shipping', 'Fleet Management', 'fleet'], ['account_balance_wallet', 'Earnings', 'earnings'], ['map', 'Route Planner', 'route'], ['forum', 'Community', 'community']].map(([icon, label, id]) => <button type="button" key={id} className={activeView === id ? 'transporter-nav-item active' : 'transporter-nav-item'} onClick={() => setActiveView(id)}><span className="material-symbols-outlined">{icon}</span>{label}</button>)}
        <div className="transporter-nav-bottom"><button type="button" className="transporter-nav-item" onClick={() => action('Settings opened.')}><span className="material-symbols-outlined">settings</span>Settings</button><button type="button" className="transporter-nav-item" onClick={onLogout}><span className="material-symbols-outlined">logout</span>Log Out</button></div>
      </nav>
      <main className="transporter-main">
        <header className="transporter-topbar"><h1>Agri-Nest Logistics</h1><div><button type="button" onClick={() => action('No new notifications.')}><span className="material-symbols-outlined">notifications</span></button><button type="button" onClick={() => action('Fleet support is ready.')}><span className="material-symbols-outlined">support</span></button><span className="transporter-mini-avatar">JK</span></div></header>
        {notice && <button type="button" className="transporter-notice" onClick={() => setNotice('')}>{notice}<span className="material-symbols-outlined">close</span></button>}
        {activeView === 'home' ? <>
          <section className="transporter-heading"><div><h2>Habari za asubuhi, James! 🚛</h2><p>Road conditions to Dar es Salaam are clear. You have <b>3 active bids</b> and <b>1 trip in progress</b>.</p></div></section>
          <section className="transporter-stats"><article><span className="material-symbols-outlined">account_balance_wallet</span><small>Wallet Balance</small><strong>TZS {wallet.toLocaleString()}</strong><button type="button" onClick={() => { setWallet(0); action('Withdrawal request submitted.'); }}>Withdraw</button></article><article><span className="material-symbols-outlined">route</span><small>Trips Done</small><strong>156</strong><p>Historical Total</p></article><article><span className="material-symbols-outlined">star</span><small>Avg Rating</small><strong>4.8 <em>★</em></strong><p className="transporter-badge">Verified Top Rated</p></article><article className="transporter-active-job"><small>Active Job</small><strong>Iringa →<br />Dar es Salaam</strong><span>Maize • In Transit</span></article></section>
          <section className="transporter-dashboard-grid"><article className="transporter-route-card"><div className="transporter-card-heading"><h3><span className="material-symbols-outlined">route</span>Active Route Overview</h3><span>ID: TRP-9284</span></div><div className="transporter-map"><div><small>DESTINATION</small><strong>Kariakoo Market</strong></div><span className="material-symbols-outlined">navigation</span></div><div className="transporter-route-details"><div><small>Status</small><strong>{tripProgress}% Complete</strong><p>ETA 2h 15m</p><span>📦 Cargo<br /><b>5,000kg Maize</b></span><span>👤 Client<br /><b>Mkulima Co-op</b></span></div><div><button type="button" onClick={() => action('Calling Mkulima Co-op...')}>☎ Contact Client</button><button type="button" onClick={() => setTripProgress((progress) => Math.min(100, progress + 10))}>↻ Update Status</button></div></div></article><aside className="transporter-right-column"><article className="transporter-jobs"><div className="transporter-card-heading"><h3>Open Jobs</h3><button type="button" onClick={() => setActiveView('jobs')}>View All</button></div>{jobs.map((job) => <div className="transporter-job" key={job.id}><div><strong>{job.route}</strong><span>{job.distance}</span></div><p>{job.cargo} • <b>👍 {job.trust} Trust</b></p><div><button type="button" onClick={() => action(`Quick bid started for ${job.route}.`)}>Quick Bid</button><button type="button" onClick={() => action(`${job.route}: ${job.cargo}`)}>Details</button></div></div>)}</article><article className="transporter-earnings"><div className="transporter-card-heading"><h3>Weekly Earnings</h3><small>This Week</small></div><div className="transporter-bars">{[30, 50, 90, 40, 60, 10, 5].map((height, index) => <i className={index === 2 ? 'peak' : ''} style={{ height: `${height}%` }} key={index} />)}</div></article><article className="transporter-alerts"><h3><span className="material-symbols-outlined">warning</span>Road Alerts</h3><button type="button" onClick={() => action('Route alert opened: heavy rain in Morogoro.')}><b>☁ Heavy rain in Morogoro</b><small>Expect 30m delays. Reported 1h ago.</small></button><button type="button" onClick={() => action('Route alert opened: weighbridge delay at Mikumi.')}><b>⚠ Weighbridge delay at Mikumi</b><small>Long queue. Reported 15m ago.</small></button></article></aside></section>
        </> : <section className="transporter-placeholder"><span className="material-symbols-outlined">{activeView === 'jobs' ? 'work_history' : activeView === 'trips' ? 'distance' : activeView === 'fleet' ? 'local_shipping' : activeView === 'earnings' ? 'account_balance_wallet' : activeView === 'route' ? 'map' : 'forum'}</span><h2>{activeView.replace('-', ' ')}</h2><p>This logistics workspace is ready for the next fleet workflow.</p><button type="button" onClick={() => setActiveView('home')}>Back to Home</button></section>}
      </main>
    </div>
  );
}

function StudentDashboard({ onLogout }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [notice, setNotice] = useState('');
  const assignmentInputRef = useRef(null);

  useEffect(() => {
    api.getStudentDashboard()
      .then(setDashboard)
      .catch(() => setDashboard({
        name: 'David K.', programme: 'BSc. Agronomy', year: 'Year 3', semester: 'Semester 2',
        metrics: { credits: 24, certifications: 3, field_hours: 12, trust_score: 8.5 },
        focus: { title: 'Soil Microbiology Thesis', status: 'Urgent', description: 'Draft review pending feedback from Dr. M. Okafor. Ensure dataset is attached.' },
        courses: [{ id: 'soil-science', title: 'Soil Science 101', module: 'Module 4: Nutrient Cycling', progress: 75 }, { id: 'irrigation', title: 'Smart Irrigation Systems', module: 'Module 2: Drip Line Calibration', progress: 30 }],
        opportunities: [{ id: 'kifaru-intern', title: 'Agronomy Intern', organization: 'Kifaru Farms', location: 'Naivasha', tags: ['3 Months', 'Paid'] }, { id: 'greenventure-analyst', title: 'Soil Data Analyst', organization: 'GreenVenture NGO', location: 'Nairobi', tags: ['Part-time', 'Remote'] }],
        applications: [], assignments: [],
      }));
  }, []);

  if (!dashboard) return <main className="student-page"><div className="student-loading">Loading student dashboard...</div></main>;

  const updateProgress = (course) => {
    const nextProgress = Math.min(100, course.progress + 5);
    setDashboard((current) => ({ ...current, courses: current.courses.map((item) => item.id === course.id ? { ...item, progress: nextProgress } : item) }));
    api.updateStudentProgress({ student_id: 'demo-student', course_id: course.id, progress: nextProgress }).catch(() => {});
    setNotice(`${course.title} progress updated to ${nextProgress}%.`);
  };

  const submitAssignment = () => {
    if (!assignment) return;
    api.submitStudentAssignment({ student_id: 'demo-student', name: assignment.name }).then(() => setNotice(`${assignment.name} submitted successfully.`)).catch(() => setNotice('Assignment saved locally; API is unavailable.'));
    setAssignment(null);
  };

  const applyNow = (opportunity) => {
    api.applyStudentOpportunity({ student_id: 'demo-student', opportunity_id: opportunity.id }).catch(() => {});
    setDashboard((current) => ({ ...current, applications: [...(current.applications || []), { opportunity_id: opportunity.id, status: 'Submitted' }] }));
    setNotice(`Application submitted for ${opportunity.title}.`);
  };

  return (
    <div className="student-shell">
      <nav className="student-sidebar">
        <div className="student-brand"><span className="material-symbols-outlined">agriculture</span><strong>AGRI-NEST</strong></div>
        {[['dashboard', 'Dashboard'], ['school', 'Learning Path'], ['work', 'Internships'], ['science', 'Research Hub'], ['forum', 'Community']].map(([icon, label]) => <button type="button" className={activeView === label.toLowerCase().replace(' ', '-') ? 'student-nav-item active' : 'student-nav-item'} key={label} onClick={() => setActiveView(label === 'Dashboard' ? 'dashboard' : label.toLowerCase().replace(' ', '-'))}><span className="material-symbols-outlined">{icon}</span>{label}</button>)}
        <button type="button" className="student-nav-item" onClick={() => setActiveView('settings')}><span className="material-symbols-outlined">settings</span>Settings</button>
        <div className="student-user"><span className="student-avatar">DK</span><span><strong>{dashboard.name}</strong><small>{dashboard.programme}</small></span></div>
      </nav>
      <main className="student-main">
        <header className="student-header"><div><h1>Welcome back, {dashboard.name.replace(' K.', '')}</h1><p>Here is your academic overview for {dashboard.semester}.</p></div><button type="button" className="student-submit-button" onClick={() => assignmentInputRef.current?.click()}><span className="material-symbols-outlined">upload_file</span>Submit Assignment</button></header>
        {notice && <button type="button" className="student-notice" onClick={() => setNotice('')}>{notice}<span className="material-symbols-outlined">close</span></button>}
        <input ref={assignmentInputRef} type="file" hidden onChange={(event) => setAssignment(event.target.files?.[0] || null)} />
        {activeView === 'dashboard' ? <>
          <section className="student-top-grid"><div className="student-progress-card"><h2>Academic Progress</h2><p>{dashboard.programme} - {dashboard.year}</p><div className="student-metric-grid">{[['school', dashboard.metrics.credits, 'Credits Earned'], ['workspace_premium', dashboard.metrics.certifications, 'Certifications'], ['science', dashboard.metrics.field_hours, 'Field Hours'], ['star', dashboard.metrics.trust_score, 'Trust Score']].map(([icon, value, label]) => <div key={label}><span className="material-symbols-outlined">{icon}</span><strong>{value}</strong><small>{label}</small></div>)}</div></div><div className="student-focus-card"><div><div className="student-focus-title"><h2>Current Focus</h2><span>{dashboard.focus.status}</span></div><h3>{dashboard.focus.title}</h3><p>{dashboard.focus.description}</p></div><button type="button" onClick={() => setNotice('Workspace opened for your thesis.')}>Open Workspace <span className="material-symbols-outlined">arrow_forward</span></button></div></section>
          <div className="student-content-grid"><div className="student-left-column"><section><div className="student-section-heading"><h2>Learning Path</h2><button type="button" onClick={() => setActiveView('learning-path')}>View All Courses</button></div><div className="student-course-list">{dashboard.courses.map((course) => <div className="student-course-card" key={course.id}><span className="student-course-icon material-symbols-outlined">{course.id === 'soil-science' ? 'grass' : 'water_drop'}</span><div><div className="student-course-title"><h3>{course.title}</h3><span>{course.progress}%</span></div><p>{course.module}</p><div className="student-course-track"><i style={{ width: `${course.progress}%` }} /></div></div><button type="button" onClick={() => updateProgress(course)} aria-label={`Continue ${course.title}`}><span className="material-symbols-outlined">play_arrow</span></button></div>)}</div></section><section><div className="student-section-heading"><h2>Research Hub</h2><button type="button" onClick={() => setNotice('New research paper workspace created.')}>+ New Paper</button></div><div className="student-research-grid"><article><span>Under Review</span><h3>Impact of Organic Mulching on Moisture Retention in Arid Regions</h3><p>Submitted to East African Journal of Agronomy.</p><small>◉ 12 &nbsp; ◌ 2 Peer Reviews</small></article><article><span>Draft</span><h3>Comparative Study of Local Seed Varieties vs GMO Yields</h3><p>Initial data collection phase completed.</p><small>Edited 2d ago</small></article></div></section></div><aside className="student-right-column"><section className="student-opportunities"><h2><span className="material-symbols-outlined">work</span>Opportunities</h2>{dashboard.opportunities.map((opportunity) => <article key={opportunity.id}><div><strong>{opportunity.title}</strong><p>{opportunity.organization} • {opportunity.location}</p></div><div>{opportunity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button type="button" disabled={dashboard.applications.some((item) => item.opportunity_id === opportunity.id)} onClick={() => applyNow(opportunity)}>{dashboard.applications.some((item) => item.opportunity_id === opportunity.id) ? 'Applied' : 'Apply Now'}</button></article>)}<button type="button" className="student-view-all" onClick={() => setNotice('Showing all available postings.')}>View All 14 Postings</button></section><section className="student-forum"><h2>Community Forum</h2><p>Answer questions to earn trust points.</p>{['What is the most organic way to handle aphids on young tomato shoots?', 'Seeking advice on setting up low-cost drip systems for a 1-acre plot.'].map((question) => <button type="button" key={question} onClick={() => setActiveView('community')}><span>Pest Control</span><strong>{question}</strong><small>Asked by Farmer Jane • +15 Trust Pts</small></button>)}</section></aside></div>
        </> : <section className="student-placeholder"><span className="material-symbols-outlined">{activeView === 'settings' ? 'settings' : activeView === 'community' ? 'forum' : 'school'}</span><h2>{activeView.replace('-', ' ')}</h2><p>This student workspace is connected to the same AGRI-NEST account and ready for its next workflow.</p><button type="button" onClick={() => setActiveView('dashboard')}>Back to Dashboard</button></section>}
        <button type="button" className="student-logout" onClick={onLogout}>Sign out</button>
      </main>
    </div>
  );
}

function NotificationCenter({ notifications, onNotificationsChange, onBackToDashboard }) {
  const [preferences, setPreferences] = useState({
    critical: true,
    market: true,
    messages: true,
    community: false,
  });
  const [olderLoaded, setOlderLoaded] = useState(false);

  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const groupedNotifications = notifications.reduce((groups, notification) => {
    groups[notification.period] = [...(groups[notification.period] || []), notification];
    return groups;
  }, {});

  const markAllAsRead = () => {
    onNotificationsChange((current) => current.map((notification) => ({ ...notification, unread: false })));
  };

  const markAsRead = (id) => {
    onNotificationsChange((current) => current.map((notification) => (
      notification.id === id ? { ...notification, unread: false } : notification
    )));
  };

  const loadOlder = () => {
    if (olderLoaded) return;
    onNotificationsChange((current) => [...current, {
      id: 'field-report',
      period: 'Last Week',
      title: 'Field Report Synced Successfully',
      time: 'Oct 10',
      body: 'Your latest crop observations and field activity report are now available in Digital Farm.',
      icon: 'cloud_done',
      tone: 'system',
      unread: false,
    }]);
    setOlderLoaded(true);
  };

  return (
    <main className="notification-page">
      <div className="notification-layout">
        <section className="notification-list-column">
          <div className="notification-heading-row">
            <div>
              <div className="notification-back-row">
                <button type="button" className="notification-back-button" onClick={onBackToDashboard}>
                  <span className="material-symbols-outlined">arrow_back</span>
                  Dashboard
                </button>
              </div>
              <h2>Notifications</h2>
              <p>Stay updated on your farm&apos;s activity</p>
            </div>
            <button type="button" className="mark-read-button" onClick={markAllAsRead} disabled={!unreadCount}>
              <span className="material-symbols-outlined">done_all</span>
              Mark all as read
            </button>
          </div>

          {Object.entries(groupedNotifications).map(([period, items]) => (
            <section className="notification-period" key={period}>
              <h3>{period}</h3>
              <div className="notification-items">
                {items.map((notification) => (
                  <button
                    type="button"
                    className={`notification-card ${notification.unread ? 'unread' : 'read'} tone-${notification.tone}`}
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <span className="notification-card-icon material-symbols-outlined">{notification.icon}</span>
                    <span className="notification-card-content">
                      <span className="notification-card-title-row">
                        <strong>{notification.title}</strong>
                        <time>{notification.time}</time>
                      </span>
                      <span className="notification-card-body">{notification.body}</span>
                    </span>
                    {notification.unread && <span className="notification-unread-dot" aria-label="Unread" />}
                  </button>
                ))}
              </div>
            </section>
          ))}

          <button type="button" className="load-older-button" onClick={loadOlder} disabled={olderLoaded}>
            {olderLoaded ? 'All notifications loaded' : 'Load Older Notifications'}
          </button>
        </section>

        <aside className="notification-preferences">
          <div className="notification-preferences-heading">
            <span className="material-symbols-outlined">tune</span>
            <h3>Preferences</h3>
          </div>
          <p>Customize what you want to see in your feed and receive push alerts for.</p>
          <div className="preference-list">
            {[
              ['critical', 'Critical Alerts', 'Weather warnings, severe pest outbreaks, and equipment failure.'],
              ['market', 'Market News', 'Price fluctuations, buyer requests, and logistics updates.'],
              ['messages', 'Direct Messages', 'Communications from agronomists, buyers, and platform support.'],
              ['community', 'Community Forums', 'New posts and replies in your subscribed community groups.'],
            ].map(([id, label, description]) => (
              <label className="preference-row" key={id}>
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences[id]}
                  onChange={() => setPreferences((current) => ({ ...current, [id]: !current[id] }))}
                />
              </label>
            ))}
          </div>
          <button type="button" className="advanced-settings-button">Advanced Settings</button>
        </aside>
      </div>
    </main>
  );
}

function InstitutionalDashboard({ onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarState);
  const [activeView, setActiveView] = useState('dashboard');

  useNavScrollLock(isSidebarOpen);

  return (
    <div className="impact-shell">
      <button
        type="button"
        className={isSidebarOpen ? 'sidebar-backdrop visible' : 'sidebar-backdrop'}
        onClick={() => setIsSidebarOpen(false)}
        aria-label="Close navigation"
      />
      <header className="impact-topbar">
        <div className="impact-branding">
          <button
            type="button"
            className="sidebar-toggle impact-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((open) => !open)}
          >
            <span className="menu-hamburger" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <span className="impact-brand-name">AgriOS Impact</span>
        </div>

        <nav className="impact-main-nav">
          <a href="#" className="impact-main-link active">Dashboard</a>
          <a href="#" className="impact-main-link">Programmes</a>
          <a href="#" className="impact-main-link">Beneficiaries</a>
          <a href="#" className="impact-main-link">Impact Reports</a>
          <a href="#" className="impact-main-link">Field Intelligence</a>
        </nav>

        <div className="impact-actions">
          <button type="button" className="impact-icon-button" aria-label="Search">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button type="button" className="impact-icon-button" aria-label="Notifications">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button type="button" className="impact-icon-button" aria-label="Settings">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <img
            alt="User profile avatar"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBS7h_9JJoWTEUYZHD0qfIXkn1AZ2c_UdoHlujXkZuVVGn29-3ES_HU5_vEbv9XMtLwcgoKvOAefEYpoKSaRBrgIKdc6qloiu8_JcrOJFff8fvuVfVAmohbeFQZpcsXY2eJtx-K98p3NyOPZgKFXcGFzQ2o9QMNjWP3LAMA8gi8l9oDSL_6vKXONSqoFC2V_n2E9yjh5lRxRYINHV0TulkmBF8R53ZgfDeHzAQ6msTJ3K4VZUUbwy_A4IkV_mrHJP_CFJ1Keq_XAc4"
            className="impact-profile-avatar"
          />
        </div>
      </header>

      <div className={isSidebarOpen ? 'impact-body' : 'impact-body nav-collapsed'}>
        <aside className={isSidebarOpen ? 'impact-sidebar' : 'impact-sidebar collapsed'}>
          <div className="impact-sidebar-brand">
            <div className="impact-logo-circle"><span className="material-symbols-outlined fill">eco</span></div>
            <div className="impact-logo-copy">
              <h2>Impact Portfolio</h2>
              <p>Global Development</p>
            </div>
          </div>

          <nav className="impact-sidebar-nav">
            <a href="#" className="impact-side-link active">
              <span className="material-symbols-outlined fill">dashboard</span>
              <span>Overview</span>
            </a>
            <a href="#" className="impact-side-link">
              <span className="material-symbols-outlined">account_tree</span>
              <span>Programmes</span>
            </a>
            <a href="#" className="impact-side-link">
              <span className="material-symbols-outlined">groups</span>
              <span>Beneficiaries</span>
            </a>
            <a href="#" className="impact-side-link">
              <span className="material-symbols-outlined">assessment</span>
              <span>Impact Reports</span>
            </a>
            <a href="#" className="impact-side-link">
              <span className="material-symbols-outlined">map</span>
              <span>Field Intel</span>
            </a>
            <button type="button" className={activeView === 'community' ? 'impact-side-link active action-button' : 'impact-side-link action-button'} onClick={() => setActiveView('community')}>
              <span className="material-symbols-outlined">forum</span>
              <span>Community Chat</span>
            </button>
          </nav>

          <div className="impact-sidebar-actions">
            <button type="button" className="impact-export-button">
              <span className="material-symbols-outlined">download</span>
              Export Report
            </button>

            <a href="#" className="impact-side-link secondary-link">
              <span className="material-symbols-outlined">help</span>
              <span>Support</span>
            </a>
            <button type="button" className="impact-side-link secondary-link action-button" onClick={onLogout}>
              <span className="material-symbols-outlined">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {activeView === 'community' ? (
          <CommunityChat onBackToDashboard={() => setActiveView('dashboard')} />
        ) : (
        <main className="impact-main-content">
          <div className="impact-page-header">
            <div>
              <h1>Impact Portfolio Overview</h1>
              <p>Monitoring global NGO initiatives and field activities.</p>
            </div>

            <div className="impact-season-picker">
              <span className="material-symbols-outlined">calendar_today</span>
              <select defaultValue="Long Rains 2024">
                <option>Season: Long Rains 2024</option>
                <option>Season: Short Rains 2023</option>
                <option>Annual Report 2023</option>
              </select>
            </div>
          </div>

          <div className="impact-metrics-grid">
            <div className="impact-stat-card">
              <div className="impact-stat-top">
                <div className="impact-stat-icon accent-soft"><span className="material-symbols-outlined">group</span></div>
                <span className="impact-chip success">
                  <span className="material-symbols-outlined">arrow_upward</span>
                  12%
                </span>
              </div>
              <div className="impact-stat-body">
                <p className="impact-stat-label">Total Beneficiaries</p>
                <h3>12,450</h3>
                <p className="impact-stat-subtext">Verified Farmers</p>
              </div>
            </div>

            <div className="impact-stat-card">
              <div className="impact-stat-top">
                <div className="impact-stat-icon neutral-soft"><span className="material-symbols-outlined">payments</span></div>
                <span className="impact-chip muted">4 Active</span>
              </div>
              <div className="impact-stat-body">
                <p className="impact-stat-label">Funding Deployed</p>
                <h3>TZS 1.8B</h3>
                <p className="impact-stat-subtext">Across programmes</p>
              </div>
            </div>

            <div className="impact-stat-card">
              <div className="impact-stat-top">
                <div className="impact-stat-icon green-soft"><span className="material-symbols-outlined">agriculture</span></div>
              </div>
              <div className="impact-stat-body">
                <p className="impact-stat-label">Verified Harvest</p>
                <h3>4.2k Tons</h3>
                <p className="impact-stat-subtext">Impact tracked produce</p>
              </div>
            </div>

            <div className="impact-stat-card">
              <div className="impact-stat-top">
                <div className="impact-stat-icon stone-soft"><span className="material-symbols-outlined">diversity_3</span></div>
                <span className="impact-chip success">
                  <span className="material-symbols-outlined">arrow_upward</span>
                  5% YoY
                </span>
              </div>
              <div className="impact-stat-body">
                <p className="impact-stat-label">Gender Inclusion</p>
                <h3>42%</h3>
                <p className="impact-stat-subtext">Women-led Enterprises</p>
              </div>
            </div>
          </div>

          <div className="impact-split-layout">
            <section className="impact-panel programmes-panel">
              <div className="impact-panel-header">
                <h2>Active Programmes</h2>
                <button type="button">View All</button>
              </div>

              <div className="impact-programme-list">
                <div className="impact-programme-item">
                  <div className="impact-programme-topline">
                    <div>
                      <h4>Iringa Maize Productivity Boost</h4>
                      <p>Focus: Yield optimization &amp; Soil Health</p>
                    </div>
                    <span className="impact-tag beige">On Track</span>
                  </div>
                  <div className="impact-progress-meta">
                    <span>Funding Deployed: 75%</span>
                    <span>TZS 450M / 600M</span>
                  </div>
                  <div className="impact-progress-track"><span style={{ width: '75%' }} /></div>
                </div>

                <div className="impact-programme-item">
                  <div className="impact-programme-topline">
                    <div>
                      <h4>Mbeya Climate-Smart Irrigation</h4>
                      <p>Focus: Water conservation &amp; Infrastructure</p>
                    </div>
                    <span className="impact-tag mint">Ahead</span>
                  </div>
                  <div className="impact-progress-meta">
                    <span>Funding Deployed: 40%</span>
                    <span>TZS 320M / 800M</span>
                  </div>
                  <div className="impact-progress-track mint-track"><span style={{ width: '40%' }} /></div>
                </div>

                <div className="impact-programme-item">
                  <div className="impact-programme-topline">
                    <div>
                      <h4>Youth Agri-Business Fund</h4>
                      <p>Focus: Micro-grants &amp; Training</p>
                    </div>
                    <span className="impact-tag neutral">Planning</span>
                  </div>
                  <div className="impact-progress-meta">
                    <span>Funding Deployed: 10%</span>
                    <span>TZS 40M / 400M</span>
                  </div>
                  <div className="impact-progress-track dark-track"><span style={{ width: '10%' }} /></div>
                </div>
              </div>
            </section>

            <section className="impact-panel region-panel">
              <div className="impact-panel-header region-header">
                <h2>Regional Activity</h2>
              </div>

              <div className="impact-map">
                <div className="impact-map-overlay">
                  <div className="impact-map-badge">
                    <p>Highest Density</p>
                    <h3>Iringa Rural Region</h3>
                    <div className="impact-map-detail">
                      <span className="impact-map-dot" />
                      <span>32 Active Sites</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="impact-lower-grid">
            <section className="impact-panel crop-panel">
              <h2>Crop Diversification</h2>
              <p>Distribution among 12,450 supported farmers.</p>

              <div className="impact-bar-chart">
                <div className="impact-bar-group">
                  <div className="impact-bar bar-maize" style={{ height: '80%' }}><span>65%</span></div>
                  <span className="impact-bar-label">Maize</span>
                </div>
                <div className="impact-bar-group">
                  <div className="impact-bar bar-beans" style={{ height: '45%' }}><span>25%</span></div>
                  <span className="impact-bar-label">Beans</span>
                </div>
                <div className="impact-bar-group">
                  <div className="impact-bar bar-sunflower" style={{ height: '25%' }}><span>10%</span></div>
                  <span className="impact-bar-label">Sunflower</span>
                </div>
              </div>
            </section>

            <section className="impact-panel feed-panel">
              <div className="impact-panel-header report-header">
                <h2>Recent Field Reports</h2>
                <span className="material-symbols-outlined">more_vert</span>
              </div>

              <div className="impact-feed-list">
                <div className="impact-feed-item">
                  <div className="impact-feed-icon orange"><span className="material-symbols-outlined">school</span></div>
                  <div>
                    <p className="impact-feed-time">Today, 10:30 AM</p>
                    <p className="impact-feed-title">IPM Workshop completed in Njombe</p>
                    <p className="impact-feed-summary">45 farmers attended the Integrated Pest Management session led by Dr. Msuya.</p>
                  </div>
                </div>

                <div className="impact-feed-item no-stem">
                  <div className="impact-feed-icon teal"><span className="material-symbols-outlined">local_shipping</span></div>
                  <div>
                    <p className="impact-feed-time">Yesterday, 14:15 PM</p>
                    <p className="impact-feed-title">Seed distribution finished</p>
                    <p className="impact-feed-summary">Distributed drought-resistant maize seeds to 200 registered farmers in Kilolo district.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
        )}
      </div>

      <footer className="impact-footer">
        <div>© 2024 Agricultural Operating System | Digital Stewardship Division</div>
        <div className="impact-footer-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Data Governance</a>
          <a href="#">Contact Support</a>
        </div>
      </footer>
    </div>
  );
}

function BuyerDashboard({ onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarState);
  const [activeView, setActiveView] = useState('dashboard');

  useNavScrollLock(isSidebarOpen);

  return (
    <div className="buyer-dashboard-shell">
      <button
        type="button"
        className={isSidebarOpen ? 'sidebar-backdrop visible' : 'sidebar-backdrop'}
        onClick={() => setIsSidebarOpen(false)}
        aria-label="Close navigation"
      />
      <aside className={isSidebarOpen ? 'buyer-sidebar' : 'buyer-sidebar collapsed'}>
        <div className="brand-name">AgriTrust</div>

        <div className="buyer-profile-card">
          <img
            alt="Buyer profile"
            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80"
            className="buyer-avatar"
          />
          <div className="buyer-profile-meta">
            <div className="buyer-profile-name">John Doe</div>
            <div className="buyer-role">Produce Buyer</div>
          </div>
        </div>

        <nav className="buyer-nav">
          <a className="buyer-nav-item active" href="#">
            <span className="material-symbols-outlined">dashboard</span>
            Dashboard
          </a>
          <a className="buyer-nav-item" href="#">
            <span className="material-symbols-outlined">storefront</span>
            Marketplace
          </a>
          <a className="buyer-nav-item" href="#">
            <span className="material-symbols-outlined">receipt_long</span>
            My Orders
          </a>
          <a className="buyer-nav-item" href="#">
            <span className="material-symbols-outlined">local_shipping</span>
            Logistics
          </a>
          <a className="buyer-nav-item" href="#">
            <span className="material-symbols-outlined">group</span>
            Suppliers
          </a>
          <a className="buyer-nav-item" href="#">
            <span className="material-symbols-outlined">analytics</span>
            Analytics
          </a>
          <button type="button" className={activeView === 'community' ? 'buyer-nav-item active' : 'buyer-nav-item'} onClick={() => setActiveView('community')}>
            <span className="material-symbols-outlined">forum</span>
            Community Chat
          </button>
        </nav>

        <div className="buyer-nav footer-nav">
          <a className="buyer-nav-item" href="#">
            <span className="material-symbols-outlined">settings</span>
            Settings
          </a>
          <button type="button" className="buyer-nav-item signout-item" onClick={onLogout}>
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className={isSidebarOpen ? 'buyer-main-panel' : 'buyer-main-panel nav-collapsed'}>
        <header className="buyer-topbar">
          <div className="buyer-topbar-left">
            <button
              type="button"
              className="sidebar-toggle buyer-toggle"
              aria-label="Toggle sidebar"
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen((open) => !open)}
            >
              <span className="menu-hamburger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <div>
              <h1>Habari za asubuhi, John! 📦</h1>
              <p>12 new maize listings in Mbeya region since yesterday.</p>
            </div>
          </div>

          <div className="buyer-header-actions">
            <button type="button" className="buyer-primary-button">
              <span className="material-symbols-outlined">add</span>
              New Request
            </button>
            <button type="button" className="buyer-icon-button" aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
              <span className="alert-dot" />
            </button>
          </div>
        </header>

        {activeView === 'community' ? (
          <CommunityChat onBackToDashboard={() => setActiveView('dashboard')} />
        ) : (
        <>
        <section className="buyer-overview-grid">
          <div className="buyer-stat-card">
            <div className="buyer-stat-icon orange"><span className="material-symbols-outlined">shopping_cart</span></div>
            <div className="buyer-stat-value">7</div>
            <div className="buyer-stat-label">Active Orders</div>
          </div>
          <div className="buyer-stat-card">
            <div className="buyer-stat-icon teal"><span className="material-symbols-outlined">account_balance_wallet</span></div>
            <div className="buyer-stat-value">TZS 12.4M</div>
            <div className="buyer-stat-label">Total Spent</div>
          </div>
          <div className="buyer-stat-card">
            <div className="buyer-stat-icon blue"><span className="material-symbols-outlined">store</span></div>
            <div className="buyer-stat-value">24</div>
            <div className="buyer-stat-label">Suppliers</div>
          </div>
          <div className="buyer-stat-card">
            <div className="buyer-stat-icon amber"><span className="material-symbols-outlined">local_shipping</span></div>
            <div className="buyer-stat-value">3</div>
            <div className="buyer-stat-label">Pending Deliveries</div>
          </div>
        </section>
        </>
        )}

        <section className="buyer-content-grid">
          <div className="buyer-panel buyer-market-panel">
            <div className="buyer-panel-header">
              <h2>Live Market Prices</h2>
              <span>TZS/KG</span>
            </div>

            <table className="buyer-market-table">
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th>Current Price</th>
                  <th>Trend (24h)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="commodity-name"><span className="dot yellow" />White Maize</td>
                  <td>650</td>
                  <td className="trend down">↓ -2.3%</td>
                  <td><button type="button">Buy</button></td>
                </tr>
                <tr>
                  <td className="commodity-name"><span className="dot green" />Mbeya Rice</td>
                  <td>2,100</td>
                  <td className="trend up">↑ +1.5%</td>
                  <td><button type="button">Buy</button></td>
                </tr>
                <tr>
                  <td className="commodity-name"><span className="dot red" />Red Beans</td>
                  <td>1,850</td>
                  <td className="trend flat">— 0.0%</td>
                  <td><button type="button">Buy</button></td>
                </tr>
                <tr>
                  <td className="commodity-name"><span className="dot orange" />Sorghum</td>
                  <td>900</td>
                  <td className="trend up">↑ +0.8%</td>
                  <td><button type="button">Buy</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="buyer-panel buyer-alert-panel">
            <div className="buyer-panel-header compact">
              <h3><span className="material-symbols-outlined">campaign</span>Alerts</h3>
              <span className="buyer-link">View All</span>
            </div>

            <div className="alert-list">
              <div className="alert-row">
                <span className="material-symbols-outlined alert-icon red">trending_down</span>
                <div>
                  <p>Price Drop: White Maize</p>
                  <small>Arusha market average dropped by 50 TZS/kg.</small>
                </div>
              </div>
              <div className="alert-row">
                <span className="material-symbols-outlined alert-icon green">verified</span>
                <div>
                  <p>Delivery Confirmed</p>
                  <small>Order #1042 (Red Beans) delivered to Dar es Salaam warehouse.</small>
                </div>
              </div>
              <div className="alert-row">
                <span className="material-symbols-outlined alert-icon blue">inventory</span>
                <div>
                  <p>Large Volume Listing</p>
                  <small>50 Tons of Rice available from Morogoro Coop.</small>
                </div>
              </div>
            </div>
          </div>

          <div className="buyer-panel buyer-orders-panel">
            <div className="buyer-panel-header compact">
              <h2>Recent Orders</h2>
              <a href="#">View All</a>
            </div>

            <div className="orders-list">
              <div className="order-row">
                <div className="order-icon beige"><span className="material-symbols-outlined">receipt</span></div>
                <div className="order-copy">
                  <div className="order-title">Order #1045 - 10T Maize</div>
                  <div className="order-meta">Juma Farmers Coop • TZS 6.5M</div>
                </div>
                <span className="status-tag escrow">Escrow Held</span>
              </div>

              <div className="order-row">
                <div className="order-icon amber"><span className="material-symbols-outlined">local_shipping</span></div>
                <div className="order-copy">
                  <div className="order-title">Order #1044 - 5T Rice</div>
                  <div className="order-meta">Mbeya Distributors • TZS 10.5M</div>
                </div>
                <span className="status-tag transit">In Transit</span>
              </div>

              <div className="order-row">
                <div className="order-icon green"><span className="material-symbols-outlined">done_all</span></div>
                <div className="order-copy">
                  <div className="order-title">Order #1042 - 2T Beans</div>
                  <div className="order-meta">Kigoma Growers • TZS 3.7M</div>
                </div>
                <span className="status-tag delivered">Delivered</span>
              </div>
            </div>
          </div>

          <div className="buyer-panel buyer-logistics-panel">
            <div className="buyer-panel-header compact logistics-header">
              <h2><span className="material-symbols-outlined">directions_car</span>Active Logistics (Usafiri)</h2>
            </div>

            <div className="logistics-body">
              <div className="logistics-map">
                <div className="map-pin pin-one" />
                <div className="map-pin pin-two" />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M20 50 Q40 25 60 35" />
                </svg>
                <div className="map-toggle">Live Tracking</div>
              </div>

              <div className="logistics-jobs">
                <div className="transport-item">
                  <span className="transport-dot red" />
                  <div>
                    <h4>Truck KCD 452G - 10T Maize</h4>
                    <p>Driver: Amos (0712 345 678)</p>
                    <strong>Status: Approaching Morogoro Weighbridge</strong>
                  </div>
                </div>
                <div className="transport-item muted">
                  <span className="transport-dot grey" />
                  <div>
                    <h4>Truck T 123 ABC - 5T Rice</h4>
                    <p>Scheduled for pickup tomorrow</p>
                    <strong>Status: Pending Loading</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
