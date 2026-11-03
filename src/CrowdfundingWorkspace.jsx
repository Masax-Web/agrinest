import { useMemo, useState } from 'react';

const formatTzs = (amount) => `TZS ${Math.round(Number(amount) || 0).toLocaleString('en-TZ')}`;
const today = () => new Date().toISOString().slice(0, 10);
const campaignPledges = (campaign) => Array.isArray(campaign?.pledges) ? campaign.pledges : [];
const campaignCategories = ['Storage', 'Irrigation', 'Equipment', 'Community', 'Other'];

function createId() {
  return globalThis.crypto?.randomUUID?.() || `campaign-${Date.now()}`;
}

function CampaignDialog({ campaign, profile, onClose, onSave }) {
  const [values, setValues] = useState(campaign ? {
    amount: '',
    note: '',
  } : {
    title: '',
    category: campaignCategories[0],
    location: profile.location || '',
    goal: '',
    deadline: '',
    description: '',
  });

  const submit = (event) => {
    event.preventDefault();
    if (campaign) {
      const amount = Number(values.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      onSave({
        ...campaign,
        pledges: [...(campaign.pledges || []), {
          id: createId(),
          amount,
          note: String(values.note || '').trim(),
          date: today(),
          backer: profile.name || 'Farmer',
        }],
      });
    } else {
      const goal = Number(values.goal);
      if (!String(values.title || '').trim() || !Number.isFinite(goal) || goal <= 0) return;
      onSave({
        id: createId(),
        title: String(values.title).trim(),
        category: values.category,
        location: String(values.location || '').trim(),
        goal,
        deadline: values.deadline,
        description: String(values.description || '').trim(),
        organizer: profile.name || 'Farmer',
        createdAt: today(),
        status: 'active',
        raisedAmount: 0,
        pledges: [],
      });
    }
    onClose();
  };

  return (
    <div className="crowdfunding-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="crowdfunding-dialog" role="dialog" aria-modal="true" aria-labelledby="crowdfunding-dialog-title">
        <div className="crowdfunding-dialog-heading">
          <div><span className="crowdfunding-eyebrow">{campaign ? 'SUPPORT A PROJECT' : 'COMMUNITY FUNDING'}</span><h2 id="crowdfunding-dialog-title">{campaign ? 'Pledge your support' : 'Start a campaign'}</h2></div>
          <button type="button" className="crowdfunding-close" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        {campaign ? (
          <>
            <p className="crowdfunding-dialog-copy">Add a non-binding pledge of interest to <strong>{campaign.title}</strong>. This records your interest only; no payment is taken or transferred.</p>
            <form onSubmit={submit}>
              <label>Pledge interest (TZS)<input autoFocus required type="number" min="1" step="1" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} /></label>
              <label>Message <span>(optional)</span><textarea rows="3" value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} placeholder="Add a note for the campaign organizer" /></label>
              <div className="crowdfunding-dialog-actions"><button type="button" className="crowdfunding-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="crowdfunding-primary-button">Save pledge interest</button></div>
            </form>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>Project name<input autoFocus required maxLength="100" value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Community grain storage" /></label>
            <div className="crowdfunding-form-row">
              <label>Project type<select value={values.category} onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))}>{campaignCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Location<input maxLength="100" value={values.location} onChange={(event) => setValues((current) => ({ ...current, location: event.target.value }))} placeholder="District or region" /></label>
            </div>
            <div className="crowdfunding-form-row">
              <label>Funding goal (TZS)<input required type="number" min="1" step="1" value={values.goal} onChange={(event) => setValues((current) => ({ ...current, goal: event.target.value }))} /></label>
              <label>Target date<input type="date" min={today()} value={values.deadline} onChange={(event) => setValues((current) => ({ ...current, deadline: event.target.value }))} /></label>
            </div>
            <label>Project description<textarea required rows="4" maxLength="1000" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} placeholder="What will this project do for your community?" /></label>
            <p className="crowdfunding-dialog-note">This campaign is saved to your farmer account. Publishing it publicly and collecting payments are not enabled.</p>
            <div className="crowdfunding-dialog-actions"><button type="button" className="crowdfunding-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="crowdfunding-primary-button">Save campaign</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

function campaignGlyph(category) {
  if (category === 'Storage') return 'warehouse';
  if (category === 'Irrigation') return 'water';
  if (category === 'Equipment') return 'precision_manufacturing';
  return 'agriculture';
}

function daysRemaining(deadline) {
  if (!deadline) return null;
  const difference = new Date(`${deadline}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime();
  return Math.max(0, Math.ceil(difference / 86400000));
}

export default function CrowdfundingWorkspace({ profile, campaigns = [], onCampaignsChange, search = '' }) {
  const [dialogCampaign, setDialogCampaign] = useState(undefined);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState('');
  const normalizedCampaigns = useMemo(() => campaigns
    .filter((campaign) => campaign && typeof campaign === 'object')
    .filter((campaign) => !search.trim() || `${campaign.title} ${campaign.category} ${campaign.location} ${campaign.organizer} ${campaign.description}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))), [campaigns, search]);
  const activeCampaigns = normalizedCampaigns.filter((campaign) => campaign.status !== 'completed');
  const totalPledgeInterest = normalizedCampaigns.reduce((sum, campaign) => sum + campaignPledges(campaign).reduce((total, pledge) => total + Number(pledge.amount || 0), 0), 0);
  const backerCount = normalizedCampaigns.reduce((sum, campaign) => sum + campaignPledges(campaign).length, 0);
  const completedCampaigns = normalizedCampaigns.filter((campaign) => campaign.status === 'completed' && Number(campaign.raisedAmount) >= Number(campaign.goal) && Number(campaign.goal) > 0).length;
  const successRate = normalizedCampaigns.filter((campaign) => campaign.status === 'completed').length
    ? Math.round(completedCampaigns / normalizedCampaigns.filter((campaign) => campaign.status === 'completed').length * 100)
    : null;
  const visibleCampaigns = showAll ? activeCampaigns : activeCampaigns.slice(0, 4);
  const myPledges = normalizedCampaigns.flatMap((campaign) => campaignPledges(campaign).map((pledge) => ({ ...pledge, campaignTitle: campaign.title })));

  const saveCampaign = (updatedCampaign) => {
    const exists = campaigns.some((campaign) => campaign.id === updatedCampaign.id);
    onCampaignsChange(exists
      ? campaigns.map((campaign) => campaign.id === updatedCampaign.id ? updatedCampaign : campaign)
      : [updatedCampaign, ...campaigns]);
    setNotice(updatedCampaign.pledges?.length ? 'Pledge interest saved to your account. No payment was made.' : 'Campaign saved to your account. It is not publicly listed.');
  };

  return (
    <main className="crowdfunding-page" aria-label="Pamoja Tunaweza community crowdfunding">
      {dialogCampaign !== undefined && <CampaignDialog campaign={dialogCampaign} profile={profile} onClose={() => setDialogCampaign(undefined)} onSave={saveCampaign} />}
      {notice && <div className="crowdfunding-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <section className="crowdfunding-page-heading">
        <div><span className="crowdfunding-eyebrow">KILIMO BORA · COMMUNITY FUNDING</span><h1>Pamoja Tunaweza — Community Crowdfunding</h1><p>Bring local agricultural infrastructure and community projects to life, together.</p></div>
        <button type="button" className="crowdfunding-primary-button" onClick={() => setDialogCampaign(null)}><span className="material-symbols-outlined">add_circle</span>Start a campaign</button>
      </section>

      <div className="crowdfunding-disclaimer"><span className="material-symbols-outlined">info</span><span>Campaigns and pledge interests are saved to your account. Pledges are non-binding; payments and public campaign listings are not enabled.</span></div>

      <section className="crowdfunding-stats" aria-label="Your crowdfunding summary">
        <article className="crowdfunding-stat"><div><span>Pledge interest recorded</span><span className="material-symbols-outlined">payments</span></div><strong>{formatTzs(totalPledgeInterest)}</strong><small>Not confirmed or transferred funds</small></article>
        <article className="crowdfunding-stat"><div><span>Active campaigns</span><span className="material-symbols-outlined">campaign</span></div><strong>{activeCampaigns.length}</strong><small>Saved to your account</small></article>
        <article className="crowdfunding-stat"><div><span>Community backers</span><span className="material-symbols-outlined">groups</span></div><strong>{backerCount}</strong><small>Recorded pledge interests</small></article>
        <article className="crowdfunding-stat"><div><span>Campaign success rate</span><span className="material-symbols-outlined">trending_up</span></div><strong>{successRate === null ? '—' : `${successRate}%`}</strong><small>{successRate === null ? 'Available after completed campaigns' : 'From completed campaigns'}</small></article>
      </section>

      <div className="crowdfunding-layout">
        <section className="crowdfunding-campaigns">
          <div className="crowdfunding-section-heading"><div><span className="crowdfunding-eyebrow">YOUR COMMUNITY PROJECTS</span><h2>Active campaigns</h2></div>{activeCampaigns.length > 2 && <button type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show less' : 'View all'} <span className="material-symbols-outlined">arrow_forward</span></button>}</div>
          {visibleCampaigns.length ? (
            <div className="crowdfunding-campaign-grid">
              {visibleCampaigns.map((campaign, index) => {
                const pledges = campaignPledges(campaign);
                const pledgeInterest = pledges.reduce((sum, pledge) => sum + Number(pledge.amount || 0), 0);
                const goal = Number(campaign.goal) || 0;
                const interestProgress = goal ? Math.min(100, Math.round(pledgeInterest / goal * 100)) : 0;
                const remaining = daysRemaining(campaign.deadline);
                return (
                  <article className="crowdfunding-campaign-card" key={campaign.id}>
                    <div className={`crowdfunding-campaign-art art-${index % 4}`}><span className="material-symbols-outlined">{campaignGlyph(campaign.category)}</span><span className="crowdfunding-category">{campaign.category || 'Community'}</span><span className="crowdfunding-art-location">{campaign.location || 'Tanzania'}</span></div>
                    <div className="crowdfunding-campaign-content">
                      <div><h3>{campaign.title}</h3><p className="crowdfunding-organizer">By {campaign.organizer || profile.name || 'Community farmer'}</p></div>
                      <p className="crowdfunding-description">{campaign.description || 'A community-led project for a stronger local agriculture network.'}</p>
                      <div className="crowdfunding-progress-copy"><span>{interestProgress}% pledge interest</span><span>{formatTzs(goal)} goal</span></div>
                      <div className="crowdfunding-progress"><span style={{ width: `${interestProgress}%` }} /></div>
                      <div className="crowdfunding-campaign-meta"><div><strong>{remaining === null ? '—' : remaining}</strong><small>{remaining === null ? 'No target date' : remaining === 1 ? 'Day left' : 'Days left'}</small></div><i /><div><strong>{pledges.length}</strong><small>Pledge interests</small></div></div>
                      <button type="button" className="crowdfunding-back-button" onClick={() => setDialogCampaign(campaign)}>Pledge interest</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="crowdfunding-empty"><span className="material-symbols-outlined">volunteer_activism</span><h3>{search ? 'No campaigns match your search' : 'Your first community project starts here'}</h3><p>{search ? 'Try another campaign name, project type, or location.' : 'Create a campaign to describe the project, set a funding goal, and invite your community to express interest.'}</p>{!search && <button type="button" className="crowdfunding-primary-button" onClick={() => setDialogCampaign(null)}><span className="material-symbols-outlined">add_circle</span>Start a campaign</button>}</div>
          )}
        </section>

        <aside className="crowdfunding-sidebar">
          <section className="crowdfunding-idea-card"><span className="crowdfunding-eyebrow">GROW TOGETHER</span><h2>Have a project idea?</h2><p>Propose infrastructure improvements or equipment-sharing initiatives for your community.</p><button type="button" onClick={() => setDialogCampaign(null)}><span className="material-symbols-outlined">add_circle</span>Start a campaign</button></section>
          <section className="crowdfunding-impact-card"><h2><span className="material-symbols-outlined">eco</span>Your impact</h2><div className="crowdfunding-impact-row"><span>Pledge interests</span><strong>{formatTzs(totalPledgeInterest)}</strong></div><div className="crowdfunding-impact-row"><span>Projects supported</span><strong>{myPledges.length}</strong></div><div className="crowdfunding-impact-note"><span>YOUR CAMPAIGNS</span><strong>{activeCampaigns.length}</strong><small>Active projects saved in this account</small></div></section>
          <section className="crowdfunding-backers-card"><h2><span className="material-symbols-outlined">military_tech</span>Recent pledge interests</h2>{myPledges.length ? myPledges.slice(-4).reverse().map((pledge, index) => <div className="crowdfunding-backer" key={pledge.id || `${pledge.campaignTitle}-${index}`}><span className={`crowdfunding-avatar avatar-${index % 3}`}>{String(pledge.backer || profile.name || 'F').trim().slice(0, 1).toUpperCase()}</span><div><strong>{pledge.backer || profile.name || 'Farmer'}</strong><small>{pledge.campaignTitle}</small></div><b>{formatTzs(pledge.amount)}</b></div>) : <p>No pledge interests yet. Support a campaign to see your activity here.</p>}</section>
        </aside>
      </div>
    </main>
  );
}
