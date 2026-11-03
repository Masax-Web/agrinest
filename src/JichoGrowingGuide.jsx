import { useState } from 'react';
import './JichoGrowingGuide.css';

const lifecycleSections = [
  {
    id: 'land',
    number: '01',
    title: 'Land Preparation',
    content: (
      <>
        <div className="jicho-guide-facts">
          <div><span>Soil pH</span><strong>5.8 - 7.0 (Slightly Acidic)</strong></div>
          <div><span>Tillage</span><strong>Deep Ploughing (20-30cm)</strong></div>
        </div>
        <p>Ensure primary and secondary tillage are completed 2 weeks before planting. Focus on breaking the hardpan to allow deep root penetration of the 614 variety.</p>
      </>
    ),
  },
  {
    id: 'planting',
    number: '02',
    title: 'Planting Strategy',
    content: (
      <ul className="jicho-guide-bullets">
        <li><strong>Spacing:</strong> 75cm x 25cm (Inter x Intra row)</li>
        <li><strong>Seed Rate:</strong> 25kg per hectare</li>
        <li><strong>Target Population:</strong> 53,333 plants/ha</li>
      </ul>
    ),
  },
  {
    id: 'nutrition',
    number: '03',
    title: 'Fertilization & Nutrition',
    content: (
      <ul className="jicho-guide-bullets">
        <li><strong>At planting:</strong> Apply a phosphorus-rich basal fertilizer according to a soil test.</li>
        <li><strong>Top dressing:</strong> Split nitrogen application between early growth and knee-high stage.</li>
        <li><strong>Field check:</strong> Keep fertilizer away from direct contact with seed and stems.</li>
      </ul>
    ),
  },
  {
    id: 'harvest',
    number: '05',
    title: 'Harvesting & Post-Harvest',
    content: (
      <ul className="jicho-guide-bullets">
        <li>Harvest when husks are dry and grain moisture is suitable for storage.</li>
        <li>Dry maize on a clean surface and protect it from rain and ground moisture.</li>
        <li>Store clean, dry grain in a pest-proof, well-ventilated place.</li>
      </ul>
    ),
  },
];

const recommendations = [
  {
    icon: 'water_drop',
    title: 'Irrigation Alert',
    text: 'Moderate humidity (65%) forecast for next 72hrs. Suspend irrigation for 2 days.',
  },
  {
    icon: 'bug_report',
    title: 'Spraying Window',
    text: 'Wind speeds < 5km/h tomorrow 06:00 - 09:00. Optimal for foliar application.',
  },
];

const supplies = [
  { icon: 'shopping_cart', name: 'DK8031 Certified Seeds', detail: 'In Stock: Arusha Branch', search: 'DK8031' },
  { icon: 'inventory', name: 'YaraMila Fertilizer', detail: 'Bulk Discount Available', search: 'fertilizer' },
];

function GrowingGuideCard({ section, expanded, onToggle }) {
  const contentId = `growing-guide-${section.id}`;
  return (
    <section className="jicho-guide-section">
      <button
        type="button"
        className="jicho-guide-section-heading"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span className="jicho-guide-number">{section.number}</span>
        <span>{section.title}</span>
        <span className="material-symbols-outlined jicho-guide-chevron">expand_more</span>
      </button>
      {expanded && <div className="jicho-guide-section-content" id={contentId}>{section.content}</div>}
    </section>
  );
}

export default function JichoGrowingGuide({ onScan, onMarketplace, onExpert }) {
  const [expandedSections, setExpandedSections] = useState(() => new Set(['land', 'planting']));

  const toggleSection = (sectionId) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  return (
    <div className="jicho-growing-guide">
      <section className="jicho-guide-hero" aria-labelledby="jicho-guide-title">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLXwcg0uX8_sOoOnkCb8Jlcqy6tHUcpYpBuAuJWCA4dOn6RDyHhkb9cWUU6EVPzCWHF6F42qHv2Tcdnkn1evm0Mp9ami4lENNeJeCDB-5qcGwAMD3tmkCPfWT4odiIJoO3Ljk5KtS7wH-mHHwgBGca2ek-i7et4C2hmlIYsF8EvAu2nwjAY1wL6OhrwOJidmTCZG0xqcHbOjEnEutFu48J4sklRJAe9SPtxkw-v5rA6x7w5YDVo8Zkiq4CNi9o7CL-0XLEx_VUeLQ"
          alt="Rows of green maize growing in a field"
        />
        <div className="jicho-guide-hero-content">
          <div>
            <span className="jicho-guide-badge">Premium Variety</span>
            <h1 id="jicho-guide-title">Maize (Hybrid 614)</h1>
            <p>Zea mays L.</p>
          </div>
          <div className="jicho-guide-hero-stats" aria-label="Maize variety details">
            <div><span>Maturity</span><strong>120-150 Days</strong></div>
            <div><span>Avg. Yield</span><strong>35 Bags/Acre</strong></div>
            <div><span>Market Price</span><strong>TZS 1,200/kg</strong></div>
          </div>
        </div>
        <button type="button" className="jicho-guide-new-analysis" onClick={onScan}>
          <span className="material-symbols-outlined">add</span>
          <span>New Analysis</span>
        </button>
      </section>

      <div className="jicho-guide-layout">
        <div className="jicho-guide-main-column">
          <section className="jicho-guide-season" aria-label="Current season status">
            <div className="jicho-guide-season-heading">
              <span className="jicho-guide-season-icon material-symbols-outlined">eco</span>
              <div><h2>Current Season Status</h2><p>Field ID: #NZ-2024-B</p></div>
              <div className="jicho-guide-stage"><strong>Vegetative Stage</strong><span>Week 8 of 20</span></div>
            </div>
            <div className="jicho-guide-progress" role="progressbar" aria-label="Growing season progress" aria-valuenow="45" aria-valuemin="0" aria-valuemax="100">
              <span />
            </div>
            <div className="jicho-guide-season-dates"><span>Planting (May 15)</span><span>Projected Harvest (Oct 10)</span></div>
          </section>

          <section className="jicho-guide-lifecycle" aria-labelledby="jicho-guide-lifecycle-title">
            <h2 id="jicho-guide-lifecycle-title">Institutional Lifecycle Guide</h2>
            <div className="jicho-guide-sections">
              {lifecycleSections.slice(0, 3).map((section) => (
                <GrowingGuideCard
                  key={section.id}
                  section={section}
                  expanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}

              <section className="jicho-guide-section jicho-guide-pest-section">
                <div className="jicho-guide-section-heading jicho-guide-pest-heading">
                  <span className="jicho-guide-number">04</span>
                  <span>Pest &amp; Disease Control</span>
                  <span className="material-symbols-outlined">warning</span>
                </div>
                <div className="jicho-guide-pest-content">
                  <div><strong>Fall Armyworm (FAW)</strong><p>Scout regularly for window-pane damage and follow local extension guidance for safe, approved control options.</p></div>
                  <div><strong>Maize Leaf Rust</strong><p>Monitor during high humidity. Seek agronomist advice if rust spreads across the field.</p></div>
                </div>
              </section>

              <GrowingGuideCard
                section={lifecycleSections[3]}
                expanded={expandedSections.has(lifecycleSections[3].id)}
                onToggle={() => toggleSection(lifecycleSections[3].id)}
              />
            </div>
          </section>
        </div>

        <aside className="jicho-guide-side-column">
          <section className="jicho-guide-recommendations">
            <h2><span className="material-symbols-outlined">bolt</span>Smart Recommendations</h2>
            {recommendations.map((recommendation) => (
              <div className="jicho-guide-recommendation" key={recommendation.title}>
                <span className="jicho-guide-recommendation-icon material-symbols-outlined">{recommendation.icon}</span>
                <div><strong>{recommendation.title}</strong><p>{recommendation.text}</p></div>
              </div>
            ))}
          </section>

          <section className="jicho-guide-shop">
            <div className="jicho-guide-card-heading"><h2>Agrishop Network</h2><button type="button" onClick={() => onMarketplace('')}>View All</button></div>
            {supplies.map((supply) => (
              <button type="button" className="jicho-guide-supply" key={supply.name} onClick={() => onMarketplace(supply.search)}>
                <span className="jicho-guide-supply-icon material-symbols-outlined">{supply.icon}</span>
                <span><strong>{supply.name}</strong><small>{supply.detail}</small></span>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            ))}
          </section>

          <section className="jicho-guide-experts">
            <h2>Regional Experts</h2>
            <button type="button" className="jicho-guide-expert" onClick={onExpert}>
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKbyTrFHSXORCrM7UTWY10xUKGTuXVdsjgInoDqpGb_9KWsvz6MAPaAiAd2NsBlV_KxzC5GKSr8K8d_shHEXXjkdlxGCfiwL0bLpMaA9aKc92r5x-0CnUBqICYbvBc9dpUnyH99IBM4JKKjBOizJN9D-xTZ0ynxc1Q3q6uWr9WzWwmYM-civ41mQ6sRCZS3mKXJtGOAKletrgCYgk98Z-axS9_cHTOYi4xzu8WJR5YsiAb6D2LsmZqEFM_KbjDWOjzhC0vOz6m16Y" alt="" />
              <span><strong>Dr. Richard Mgata</strong><small>Senior Maize Agronomist</small></span>
              <span className="material-symbols-outlined">chat</span>
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
