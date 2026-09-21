import { useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/markets', label: 'Markets' },
  { to: '/operations', label: 'Operations' },
  { to: '/finance', label: 'Finance' },
  { to: '/community', label: 'Community' },
];

const stats = [
  { value: '50K+', label: 'Active farmers' },
  { value: 'TZS 2.4B', label: 'Transactions' },
  { value: '99.9%', label: 'Uptime' },
  { value: '12 regions', label: 'Coverage' },
];

const roles = [
  { name: 'Farmer', label: 'Digital farm, AI, livestock', icon: 'agriculture', tone: 'green' },
  { name: 'Admin', label: 'Analytics, users, security', icon: 'admin_panel_settings', tone: 'dark' },
  { name: 'Buyer', label: 'Soko, orders, tracking', icon: 'shopping_cart', tone: 'amber' },
  { name: 'Transporter', label: 'Fleet, routes, wallet', icon: 'local_shipping', tone: 'teal' },
  { name: 'Lender', label: 'Loans, risk, portfolio', icon: 'account_balance', tone: 'slate' },
  { name: 'Processor', label: 'Supply, quality, QC', icon: 'factory', tone: 'green' },
  { name: 'Government', label: 'Alerts, compliance', icon: 'account_balance_wallet', tone: 'dark' },
  { name: 'Expert', label: 'Consultations, KB', icon: 'psychology', tone: 'amber' },
  { name: 'Student', label: 'Courses, learning', icon: 'school', tone: 'mint' },
  { name: 'Community', label: 'Groups, chat, news', icon: 'forum', tone: 'green' },
];

const marketPulse = [
  { crop: 'Maize', price: 'TZS 1,050/kg', trend: '+4.2%' },
  { crop: 'Tomatoes', price: 'TZS 1,780/kg', trend: '+8.1%' },
  { crop: 'Beans', price: 'TZS 1,450/kg', trend: '+3.7%' },
  { crop: 'Cassava', price: 'TZS 820/kg', trend: '+2.5%' },
];

const features = [
  { title: 'Smart market intelligence', description: 'Track crop pricing, trade flow, and regional demand in real time.', icon: '📈' },
  { title: 'Field operations', description: 'Plan irrigation, pest control, and harvest workflows with actionable insights.', icon: '🚜' },
  { title: 'Climate guidance', description: 'Monitor rainfall, soil conditions, and weather alerts for every farming zone.', icon: '🌦️' },
  { title: 'Finance & trade', description: 'Connect farmers to credits, logistics support, and crop procurement opportunities.', icon: '💸' },
  { title: 'Expert network', description: 'Book agronomists, advisors, and technical services when you need targeted help.', icon: '👩‍🌾' },
  { title: 'Community growth', description: 'Build trust through local groups, knowledge sharing, and verified supply chains.', icon: '🤝' },
];

const prompts = [
  'What is the market price in Dar es Salaam?',
  'Show me the best crops for this season',
  'How do I reduce post-harvest losses?',
];

const initialMessages = [
  { sender: 'assistant', text: 'Hello! I am your AGRI-NEST AI assistant. Ask for price guidance, farm advice, or trading support.' },
];

function HomePage() {
  return (
    <>
      <section className="hero section-card">
        <div className="hero-copy">
          <span className="eyebrow-pill">Agribusiness platform</span>
          <h1>Connect farms, markets, finance, and expert support in one ecosystem.</h1>
          <p>
            AGRI-NEST helps farmers, traders, processors, and partners make faster, smarter decisions with data,
            guidance, and community-powered tools built for East Africa.
          </p>

          <div className="cta-row">
            <button type="button" className="primary-button">Explore platform</button>
            <button type="button" className="secondary-button">Book a demo</button>
          </div>

          <div className="metric-row">
            {stats.map((stat) => (
              <div key={stat.label} className="metric-box">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          <div className="panel-main section-card soft-card">
            <div className="panel-header">
              <span className="status-dot" />
              <span>Live market overview</span>
            </div>

            <div className="bar-chart" aria-label="Market improvement chart">
              <span style={{ height: '34%' }} />
              <span style={{ height: '48%' }} />
              <span style={{ height: '62%' }} />
              <span style={{ height: '76%' }} />
              <span style={{ height: '90%' }} />
              <span style={{ height: '72%' }} />
              <span style={{ height: '100%' }} />
            </div>

            <div className="panel-stats">
              <div>
                <small>Yield index</small>
                <strong>84.2</strong>
              </div>
              <div>
                <small>Rainfall</small>
                <strong>22 mm</strong>
              </div>
            </div>
          </div>

          <div className="mini-panel section-card soft-card">
            <span className="eyebrow-pill alt">Market alert</span>
            <p>Tomato prices are rising in northern hubs. This is the ideal window to sell this week.</p>
          </div>
        </div>
      </section>

      <section className="roles-section">
        <div className="section-heading">
          <span className="eyebrow-pill">Role access</span>
          <h2>Built for every part of the agricultural value chain</h2>
        </div>

        <div className="role-grid">
          {roles.map((role) => (
            <button key={role.name} type="button" className={`role-card ${role.tone}`}>
              <div className="role-icon">
                <span className="material-symbols">{role.icon}</span>
              </div>
              <h3>{role.name}</h3>
              <p>{role.label}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="solutions-section">
        <div className="section-heading">
          <span className="eyebrow-pill">Solutions</span>
          <h2>Powering growth from farm gate to market</h2>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card section-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="insights-layout">
        <div className="section-card chart-card">
          <div className="section-heading left">
            <span className="eyebrow-pill">Market snapshot</span>
            <h2>Today’s price movement</h2>
          </div>

          <table>
            <thead>
              <tr>
                <th>Crop</th>
                <th>Price</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {marketPulse.map((item) => (
                <tr key={item.crop}>
                  <td>{item.crop}</td>
                  <td>{item.price}</td>
                  <td className="trend positive">{item.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-card insight-card">
          <div className="section-heading left">
            <span className="eyebrow-pill">Operational view</span>
            <h2>Key recommendations</h2>
          </div>

          <ul className="check-list">
            <li>Plan irrigation around the next three-day rainfall forecast.</li>
            <li>Prioritize storage for maize before weekend demand peaks.</li>
            <li>Review buyer contracts for stronger margins and lower risk.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

function MarketsPage() {
  return (
    <section className="route-page section-card">
      <div className="page-header">
        <span className="eyebrow-pill">Market intelligence</span>
        <h2>Regional crop and trade overview</h2>
      </div>

      <div className="two-column-grid">
        <div className="stacked-panel">
          <h3>Live pricing board</h3>
          <table>
            <thead>
              <tr>
                <th>Commodity</th>
                <th>Avg. price</th>
                <th>Demand</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Maize</td><td>TZS 1,050/kg</td><td>High</td></tr>
              <tr><td>Tomatoes</td><td>TZS 1,780/kg</td><td>Very high</td></tr>
              <tr><td>Beans</td><td>TZS 1,450/kg</td><td>Rising</td></tr>
              <tr><td>Rice</td><td>TZS 2,100/kg</td><td>Stable</td></tr>
            </tbody>
          </table>
        </div>

        <div className="stacked-panel">
          <h3>Demand hotspots</h3>
          <ul className="detail-list">
            <li>Dar es Salaam: strong demand for fresh vegetables and grains.</li>
            <li>Morogoro: stable milling rice demand and growing buyer liquidity.</li>
            <li>Arusha: premium pricing for high-quality tomatoes and onions.</li>
            <li>Kilimanjaro: favorable export readiness for selected horticulture.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function OperationsPage() {
  return (
    <section className="route-page section-card">
      <div className="page-header">
        <span className="eyebrow-pill">Farm operations</span>
        <h2>Field planning and productivity dashboard</h2>
      </div>

      <div className="three-column-grid">
        <div className="stat-panel">
          <small>Field readiness</small>
          <strong>87%</strong>
          <span>Soil moisture and irrigation flow are in good condition.</span>
        </div>
        <div className="stat-panel">
          <small>Next harvest</small>
          <strong>12 days</strong>
          <span>Tomato harvest cluster predicted near the regional hub.</span>
        </div>
        <div className="stat-panel">
          <small>Risk alerts</small>
          <strong>2 active</strong>
          <span>Monitor pest activity and storage humidity during the week.</span>
        </div>
      </div>

      <div className="task-list">
        <div className="task-card">
          <h3>Irrigation schedule</h3>
          <p>Shift drip cycle to 6:00 AM for the northeast field cluster.</p>
        </div>
        <div className="task-card">
          <h3>Crop protection</h3>
          <p>Apply targeted foliar treatment to tomato blocks north of the main road.</p>
        </div>
        <div className="task-card">
          <h3>Logistics plan</h3>
          <p>Coordinate pickup windows with the transport partner for a Friday dispatch.</p>
        </div>
      </div>
    </section>
  );
}

function FinancePage() {
  return (
    <section className="route-page section-card">
      <div className="page-header">
        <span className="eyebrow-pill">Finance</span>
        <h2>Funding, risk, and trade support</h2>
      </div>

      <div className="finance-layout">
        <div className="stacked-panel">
          <h3>Funding products</h3>
          <ul className="detail-list compact">
            <li>Seasonal crop finance: TZS 5.5M with flexible repayment.</li>
            <li>Cold-storage loan: 8.5% fixed rate for post-harvest facilities.</li>
            <li>Input bundle credit: supply chain voucher for seed and fertilizer.</li>
          </ul>
        </div>
        <div className="stacked-panel">
          <h3>Wallet summary</h3>
          <div className="wallet-box">
            <span>Available balance</span>
            <strong>TZS 3,840,000</strong>
          </div>
          <div className="wallet-box muted">
            <span>Upcoming payouts</span>
            <strong>TZS 1,210,000</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommunityPage() {
  return (
    <section className="route-page section-card">
      <div className="page-header">
        <span className="eyebrow-pill">Community</span>
        <h2>Networks, knowledge, and support</h2>
      </div>

      <div className="three-column-grid">
        <div className="task-card">
          <h3>Farmer groups</h3>
          <p>12 active networks in the district are sharing seasonal advice and buyer contacts.</p>
        </div>
        <div className="task-card">
          <h3>Expert calls</h3>
          <p>Agri-specialists are available for crop planning, disease surveillance, and risk reviews.</p>
        </div>
        <div className="task-card">
          <h3>Training</h3>
          <p>New modules cover irrigation efficiency, handling methods, and market negotiation.</p>
        </div>
      </div>
    </section>
  );
}

function AppShell() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    const nextQuery = query.trim();
    if (!nextQuery) return;

    setMessages((current) => [...current, { sender: 'user', text: nextQuery }]);
    setQuery('');
    setLoading(true);

    window.setTimeout(() => {
      const answer = nextQuery.toLowerCase().includes('price')
        ? 'Current market pricing suggests strong demand for maize and tomatoes in major urban hubs. Review storage timing to maximize margins before the weekend rush.'
        : nextQuery.toLowerCase().includes('crop')
          ? 'For this season, maize, beans, and tomatoes remain the strongest options in high-demand zones, especially when paired with irrigation planning.'
          : 'The best next step is to review local weather conditions, reduce post-harvest risk, and compare nearby buyer demand before dispatching stock.';

      setMessages((current) => [...current, { sender: 'assistant', text: answer }]);
      setLoading(false);
    }, 650);
  };

  return (
    <div className="agri-shell">
      <header className="topbar">
        <div className="brand-box" aria-label="AGRI-NEST brand">
          <div className="brand-mark">A</div>
          <div className="brand-copy">
            <span className="brand-word">AGRI-NEST</span>
          </div>
        </div>

        <div className="location-pill">
          <span className="location-pin">◉</span>
          <span>Tanzania</span>
          <span className="chevron">›</span>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-button active' : 'nav-button')}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="user-actions">
          <button type="button" className="currency-button">TZS</button>
          <button type="button" className="icon-button" aria-label="Notifications">🔔</button>
          <button type="button" className="profile-button" aria-label="Open profile">A</button>
        </div>
      </header>

      <main className="page-body">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/community" element={<CommunityPage />} />
        </Routes>
      </main>

      <footer className="footer-bar">
        <div>
          <strong>AGRI-NEST</strong>
          <span>Digital agriculture for resilient communities.</span>
        </div>
        <button type="button" className="primary-button small-button">Contact sales</button>
      </footer>

      <aside className={`assistant-panel ${assistantOpen ? 'open' : ''}`}>
        <div className="assistant-header">
          <div>
            <p className="eyebrow">AI advisor</p>
            <h4>AGRI-NEST assistant</h4>
          </div>
          <button type="button" className="secondary-button tiny-button" onClick={() => setAssistantOpen(false)}>Close</button>
        </div>

        <div className="chat-box">
          {messages.map((message, index) => (
            <div key={`${message.sender}-${index}`} className={`chat-bubble ${message.sender}`}>
              {message.text}
            </div>
          ))}
          {loading && <div className="chat-bubble assistant loading">Thinking...</div>}
        </div>

        <div className="chat-input-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask the AI assistant..."
            aria-label="Ask the AGRI-NEST assistant"
          />
          <button type="button" className="primary-button tiny-button" onClick={handleSend} disabled={loading}>Send</button>
        </div>

        <div className="suggestion-row">
          {prompts.map((item) => (
            <button key={item} type="button" className="suggestion-chip" onClick={() => setQuery(item)}>
              {item}
            </button>
          ))}
        </div>
      </aside>

      <button type="button" className="assistant-fab" onClick={() => setAssistantOpen((current) => !current)}>
        {assistantOpen ? 'Hide AI' : 'Ask AI'}
      </button>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
