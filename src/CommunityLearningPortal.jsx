import { useMemo, useState } from 'react';
import './CommunityLearningPortal.css';

const discussionPrompts = [
  { category: 'Crops', title: 'What field signs help distinguish nutrient stress from water stress?', icon: 'grass' },
  { category: 'Market', title: 'How are you preparing produce for storage after harvest?', icon: 'storefront' },
  { category: 'Equipment', title: 'What should farmers compare when choosing a small-scale irrigation pump?', icon: 'water_drop' },
];

const createId = () => globalThis.crypto?.randomUUID?.() || `learning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function CommunityLearningPortal({ profile, records, onRecordsChange, onNavigate }) {
  const [showLearningForm, setShowLearningForm] = useState(false);
  const [learningDraft, setLearningDraft] = useState({ title: '', details: '' });
  const [notice, setNotice] = useState('');
  const groups = Array.isArray(records.groups) ? records.groups : [];
  const activities = Array.isArray(records.activities) ? records.activities : [];
  const requests = Array.isArray(records.requests) ? records.requests : [];
  const learningNotes = useMemo(
    () => activities.filter((activity) => activity.module === 'training').sort((first, second) => String(second.date || '').localeCompare(String(first.date || ''))),
    [activities],
  );
  const groupActivities = activities.filter((activity) => activity.module === 'group-activity');
  const expertRequests = requests.filter((request) => request.module === 'experts');

  const saveLearningNote = (event) => {
    event.preventDefault();
    const title = learningDraft.title.trim();
    if (!title) return;
    const record = {
      id: createId(),
      module: 'training',
      title,
      details: learningDraft.details.trim(),
      date: new Date().toISOString().slice(0, 10),
      status: 'Saved',
    };
    onRecordsChange('activities', [...activities, record]);
    setLearningDraft({ title: '', details: '' });
    setShowLearningForm(false);
    setNotice('Learning note saved to your farmer records. It is not a course completion or credential.');
  };

  return (
    <main className="community-learning-portal" aria-label="Community and learning portal">
      <header className="community-learning-heading">
        <div>
          <span className="community-learning-eyebrow">FARMER COMMUNITY</span>
          <h1>Community &amp; Learning Portal</h1>
          <p>Find farmer groups, connect with support, and keep your learning activities together.</p>
        </div>
        <button type="button" className="community-learning-primary" onClick={() => setShowLearningForm((open) => !open)}>
          <span className="material-symbols-outlined">{showLearningForm ? 'close' : 'add'}</span>{showLearningForm ? 'Cancel' : 'New Learning Note'}
        </button>
      </header>

      {notice && <div className="community-learning-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      {showLearningForm && <form className="community-learning-note-form" onSubmit={saveLearningNote}>
        <div><span className="community-learning-eyebrow">YOUR FARMER RECORDS</span><h2>Add a learning note</h2><p>Save a topic, lesson, or follow-up for your own reference.</p></div>
        <label>Topic or lesson<input required maxLength={120} value={learningDraft.title} onChange={(event) => setLearningDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Soil health workshop notes" /></label>
        <label>Notes (optional)<textarea maxLength={1000} rows="2" value={learningDraft.details} onChange={(event) => setLearningDraft((current) => ({ ...current, details: event.target.value }))} placeholder="What would you like to remember?" /></label>
        <button type="submit" className="community-learning-primary"><span className="material-symbols-outlined">save</span>Save Note</button>
      </form>}

      <section className="community-learning-stats" aria-label="Your community and learning records">
        {[
          ['groups', groups.length, 'Groups on your account', 'groups'],
          ['school', learningNotes.length, 'Saved learning notes', 'learning notes'],
          ['support_agent', expertRequests.length, 'Saved expert requests', 'expert requests'],
          ['event_note', groupActivities.length, 'Group activities saved', 'group activities'],
        ].map(([icon, value, label, key]) => <article key={key}><span className="material-symbols-outlined">{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>)}
      </section>

      <div className="community-learning-grid">
        <section className="community-learning-panel community-learning-experts">
          <div className="community-learning-section-heading"><div><span className="community-learning-eyebrow">MSHAURI EXPERT HUB</span><h2>Expert support</h2><p>Explore the sample profile or save a general support request.</p></div><button type="button" className="community-learning-link" onClick={() => onNavigate('experts')}>Open expert hub<span className="material-symbols-outlined">arrow_forward</span></button></div>
          <article className="community-learning-expert-card">
            <div className="community-learning-expert-avatar"><span className="material-symbols-outlined">agriculture</span></div>
            <div className="community-learning-expert-copy"><span className="community-learning-sample-tag">SAMPLE PROFILE</span><h3>Dr. Richard Mgata</h3><p>Lead Agronomist &amp; Soil Specialist</p><div className="community-learning-expert-tags"><span>Soil health</span><span>Crop management</span><span>IPM</span></div></div>
            <button type="button" className="community-learning-outline" onClick={() => onNavigate('experts')}>Explore support</button>
          </article>
          <p className="community-learning-footnote">The expert profile and rating shown in the expert hub are illustrative. Session requests are not confirmed bookings.</p>
        </section>

        <section className="community-learning-panel community-learning-groups">
          <div className="community-learning-section-heading"><div><span className="community-learning-eyebrow">VIKUNDI</span><h2>Farmer groups</h2></div><button type="button" className="community-learning-link" onClick={() => onNavigate('groups')}>Open groups<span className="material-symbols-outlined">arrow_forward</span></button></div>
          {groups.length ? <div className="community-learning-group-list">{groups.slice(0, 3).map((group) => <article key={group.id || group.name}><span className="material-symbols-outlined">groups</span><div><strong>{group.name || 'Farmer group'}</strong><small>{group.region || profile?.region || 'Region not recorded'}</small></div></article>)}</div> : <div className="community-learning-empty"><span className="material-symbols-outlined">groups</span><strong>No groups recorded yet</strong><p>Explore the groups workspace to view group information.</p></div>}
          <button type="button" className="community-learning-solid" onClick={() => onNavigate('groups')}>Explore Vikundi &amp; activities</button>
        </section>

        <section className="community-learning-panel community-learning-academy">
          <div className="community-learning-section-heading"><div><span className="community-learning-eyebrow">MAFUNZO ACADEMY</span><h2>Your learning notes</h2><p>Your notes stay with your farmer records; course progress and completion records are saved separately on this browser.</p></div><button type="button" className="community-learning-link" onClick={() => onNavigate('training')}>Open learning workspace<span className="material-symbols-outlined">arrow_forward</span></button></div>
          {learningNotes.length ? <div className="community-learning-note-list">{learningNotes.slice(0, 3).map((note) => <article key={note.id}><span className="material-symbols-outlined">menu_book</span><div><strong>{note.title || note.course || 'Learning note'}</strong><p>{note.details || note.date || 'Saved to your farmer records'}</p></div></article>)}</div> : <div className="community-learning-empty"><span className="material-symbols-outlined">school</span><strong>Start your learning journal</strong><p>Save notes from a training, handbook, or lesson to keep them with your farmer records.</p><button type="button" className="community-learning-outline" onClick={() => setShowLearningForm(true)}>Add a learning note</button></div>}
        </section>

        <section className="community-learning-panel community-learning-forum">
          <div className="community-learning-section-heading"><div><span className="community-learning-eyebrow">FARMER FORUM</span><h2>Discussion starters</h2><p>Prompts to bring to the community chat, not live or ranked threads.</p></div><button type="button" className="community-learning-link" onClick={() => onNavigate('community')}>Open chat<span className="material-symbols-outlined">arrow_forward</span></button></div>
          <div className="community-learning-prompt-list">{discussionPrompts.map((prompt) => <button type="button" key={prompt.title} onClick={() => onNavigate('community')}><span className="community-learning-prompt-top"><span className="material-symbols-outlined">{prompt.icon}</span><small>{prompt.category} · Prompt</small></span><strong>{prompt.title}</strong><span className="community-learning-open-prompt">Discuss in community chat<span className="material-symbols-outlined">arrow_forward</span></span></button>)}</div>
        </section>

        <section className="community-learning-panel community-learning-student">
          <div className="community-learning-section-heading"><div><span className="community-learning-eyebrow">WANAFUNZI STUDENT HUB</span><h2>Learning &amp; opportunities</h2><p>Student internship, research, and grant listings are not currently connected.</p></div></div>
          <div className="community-learning-resources">
            <article><span className="material-symbols-outlined">work</span><div><strong>Internship opportunities</strong><p>No verified listings are available here. Check with participating institutions.</p></div></article>
            <article><span className="material-symbols-outlined">science</span><div><strong>Research &amp; field learning</strong><p>Use your learning notes to keep study topics and field observations together.</p></div></article>
            <article><span className="material-symbols-outlined">workspace_premium</span><div><strong>Grants &amp; scholarships</strong><p>Grant availability and eligibility are not verified in this workspace.</p></div></article>
          </div>
          <button type="button" className="community-learning-outline" onClick={() => onNavigate('training')}>Open learning workspace</button>
        </section>
      </div>
    </main>
  );
}
