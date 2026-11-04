import { useEffect, useMemo, useState } from 'react';
import './LearningTrainingWorkspace.css';

const courses = [
  {
    id: 'maize-production',
    title: 'Maize Production: Seed to Market',
    category: 'Crop production',
    provider: 'AGRI-NEST course guide',
    duration: 95,
    icon: 'grass',
    tone: 'maize',
    description: 'Plan a maize season from seed selection and field preparation through harvest handling and market readiness.',
    lessons: [
      { id: 'seed-selection', title: 'Choose quality seed', minutes: 18, summary: 'Compare seed sources, maturity periods, and varieties suited to your local conditions.' },
      { id: 'field-preparation', title: 'Prepare the field', minutes: 22, summary: 'Review spacing, planting depth, soil preparation, and a practical field checklist.' },
      { id: 'crop-care', title: 'Manage crop growth', minutes: 25, summary: 'Plan timely weeding, scouting, and nutrient management through the growing season.' },
      { id: 'harvest-market', title: 'Harvest and prepare for market', minutes: 30, summary: 'Recognise harvest readiness and protect grain quality during drying and storage.' },
    ],
  },
  {
    id: 'integrated-pest-management',
    title: 'Integrated Pest Management (IPM)',
    category: 'Crop protection',
    provider: 'AGRI-NEST course guide',
    duration: 80,
    icon: 'pest_control',
    tone: 'ipm',
    description: 'Build a practical scouting and prevention routine, then compare safe, locally appropriate pest-management options.',
    lessons: [
      { id: 'scouting', title: 'Scout and identify', minutes: 18, summary: 'Record crop stage, pest symptoms, beneficial insects, and the extent of damage before acting.' },
      { id: 'thresholds', title: 'Decide when to act', minutes: 20, summary: 'Use observation and local guidance to decide whether intervention is warranted.' },
      { id: 'prevention', title: 'Prevent and protect', minutes: 22, summary: 'Explore crop rotation, field hygiene, resistant varieties, and habitat for beneficial organisms.' },
      { id: 'safe-control', title: 'Choose a safe control', minutes: 20, summary: 'Compare control options and review label, protective equipment, and application safety.' },
    ],
  },
  {
    id: 'dairy-cattle-management',
    title: 'Dairy Cattle Management & Milk Quality',
    category: 'Livestock',
    provider: 'AGRI-NEST course guide',
    duration: 90,
    icon: 'pets',
    tone: 'dairy',
    description: 'Strengthen everyday herd care with practical guidance on feeding, hygiene, animal observation, and milk handling.',
    lessons: [
      { id: 'herd-observation', title: 'Observe herd health', minutes: 20, summary: 'Use a consistent daily check for appetite, movement, behaviour, and signs that need expert advice.' },
      { id: 'feed-water', title: 'Plan feed and water', minutes: 25, summary: 'Review clean water access, forage quality, and balanced feeding with local extension support.' },
      { id: 'milking-hygiene', title: 'Improve milking hygiene', minutes: 22, summary: 'Prepare clean equipment and a consistent routine to reduce contamination risks.' },
      { id: 'milk-storage', title: 'Handle and store milk', minutes: 23, summary: 'Protect milk quality through clean containers, timely cooling, and careful transport.' },
    ],
  },
  {
    id: 'farm-business-records',
    title: 'Farm Business Planning & Record Keeping',
    category: 'Agribusiness',
    provider: 'AGRI-NEST course guide',
    duration: 75,
    icon: 'monitoring',
    tone: 'business',
    description: 'Create a simple farm plan and keep useful records of costs, sales, production, and decisions.',
    lessons: [
      { id: 'set-goals', title: 'Set a seasonal goal', minutes: 15, summary: 'Turn a farm priority into a measurable target with a realistic season and resource plan.' },
      { id: 'record-costs', title: 'Record costs and inputs', minutes: 20, summary: 'Capture purchases, labour, dates, and field use in a simple ledger.' },
      { id: 'track-sales', title: 'Track harvest and sales', minutes: 20, summary: 'Compare quantity harvested, quantity sold, buyer, price, and remaining stock.' },
      { id: 'review-decisions', title: 'Review the season', minutes: 20, summary: 'Use records to compare your plan with actual results and choose a next step.' },
    ],
  },
];

const makeWorkshops = () => {
  const dateAfterDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  };
  return [
    { id: 'soil-health-live', title: 'Soil Health Diagnostics Workshop', date: dateAfterDays(7), time: '10:00 AM', icon: 'compost', details: 'A practical session on soil observations and sampling questions to discuss with a local adviser.' },
    { id: 'drip-irrigation-masterclass', title: 'Drip Irrigation Setup Session', date: dateAfterDays(14), time: '2:00 PM', icon: 'water_drop', details: 'Review system layout, filtration, and maintenance checks for small-scale drip irrigation.' },
  ];
};

const emptyLearningState = { enrolledCourseIds: [], completedLessonIds: {}, enrolledWorkshopIds: [] };
const knownCourseIds = new Set(courses.map((course) => course.id));
const knownWorkshopIds = new Set(['soil-health-live', 'drip-irrigation-masterclass']);

function readLearningState(accountId) {
  try {
    const saved = window.localStorage.getItem(`agrinest-learning-academy:v1:${accountId || 'unknown-account'}`);
    if (!saved) return { state: emptyLearningState, warning: '' };
    const parsed = JSON.parse(saved);
    const enrolledCourseIds = Array.isArray(parsed.enrolledCourseIds)
      ? [...new Set(parsed.enrolledCourseIds.filter((id) => knownCourseIds.has(id)))]
      : [];
    const completedLessonIds = {};
    for (const course of courses) {
      const savedLessons = parsed.completedLessonIds?.[course.id];
      const knownLessonIds = new Set(course.lessons.map((lesson) => lesson.id));
      completedLessonIds[course.id] = Array.isArray(savedLessons)
        ? [...new Set(savedLessons.filter((id) => knownLessonIds.has(id)))]
        : [];
    }
    const enrolledWorkshopIds = Array.isArray(parsed.enrolledWorkshopIds)
      ? [...new Set(parsed.enrolledWorkshopIds.filter((id) => knownWorkshopIds.has(id)))]
      : [];
    return { state: { enrolledCourseIds, completedLessonIds, enrolledWorkshopIds }, warning: '' };
  } catch (error) {
    console.error('Could not load learning progress from this browser:', error);
    return { state: emptyLearningState, warning: 'Saved learning progress could not be read from this browser.' };
  }
}

function formatWorkshopDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export default function LearningTrainingWorkspace({ accountId, profile, embedded = false }) {
  const loaded = useMemo(() => readLearningState(accountId), [accountId]);
  const [learningState, setLearningState] = useState(loaded.state);
  const [notice, setNotice] = useState(loaded.warning);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeCourseId, setActiveCourseId] = useState('');
  const [activeLessonId, setActiveLessonId] = useState('');
  const workshops = useMemo(makeWorkshops, []);
  const activeCourse = courses.find((course) => course.id === activeCourseId);
  const activeLesson = activeCourse?.lessons.find((lesson) => lesson.id === activeLessonId);

  useEffect(() => {
    if (!activeCourseId) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActiveCourseId('');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeCourseId]);

  useEffect(() => {
    setLearningState(loaded.state);
    setNotice(loaded.warning);
  }, [loaded]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `agrinest-learning-academy:v1:${accountId || 'unknown-account'}`,
        JSON.stringify(learningState),
      );
    } catch (error) {
      console.error('Could not save learning progress to this browser:', error);
      setNotice('Your latest change could not be saved in this browser. Check available storage and try again.');
    }
  }, [accountId, learningState]);

  const completedCourseIds = courses
    .filter((course) => course.lessons.every((lesson) => learningState.completedLessonIds[course.id]?.includes(lesson.id)))
    .map((course) => course.id);
  const completedLessonCount = Object.values(learningState.completedLessonIds).reduce((total, lessonIds) => total + lessonIds.length, 0);
  const learningMinutes = courses.reduce((total, course) => total + course.lessons.reduce(
    (courseMinutes, lesson) => courseMinutes + (learningState.completedLessonIds[course.id]?.includes(lesson.id) ? lesson.minutes : 0),
    0,
  ), 0);

  const visibleCourses = courses.filter((course) => {
    const progress = course.lessons.filter((lesson) => learningState.completedLessonIds[course.id]?.includes(lesson.id)).length;
    const matchesFilter = filter === 'all'
      || (filter === 'in-progress' && progress > 0 && progress < course.lessons.length)
      || (filter === 'enrolled' && learningState.enrolledCourseIds.includes(course.id));
    const matchesQuery = `${course.title} ${course.category} ${course.description}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const setCourseEnrollment = (course) => {
    setLearningState((current) => ({
      ...current,
      enrolledCourseIds: current.enrolledCourseIds.includes(course.id)
        ? current.enrolledCourseIds
        : [...current.enrolledCourseIds, course.id],
    }));
    setActiveCourseId(course.id);
    setActiveLessonId(course.lessons.find((lesson) => !learningState.completedLessonIds[course.id]?.includes(lesson.id))?.id || course.lessons[0].id);
  };

  const markLessonComplete = () => {
    if (!activeCourse || !activeLesson) return;
    setLearningState((current) => ({
      ...current,
      enrolledCourseIds: current.enrolledCourseIds.includes(activeCourse.id)
        ? current.enrolledCourseIds
        : [...current.enrolledCourseIds, activeCourse.id],
      completedLessonIds: {
        ...current.completedLessonIds,
        [activeCourse.id]: [...new Set([...(current.completedLessonIds[activeCourse.id] || []), activeLesson.id])],
      },
    }));
    const nextLesson = activeCourse.lessons.find((lesson) => lesson.id !== activeLesson.id && !learningState.completedLessonIds[activeCourse.id]?.includes(lesson.id));
    setActiveLessonId(nextLesson?.id || activeLesson.id);
    setNotice('Lesson progress saved on this browser.');
  };

  const toggleWorkshopEnrollment = (workshop) => {
    const isEnrolled = learningState.enrolledWorkshopIds.includes(workshop.id);
    setLearningState((current) => ({
      ...current,
      enrolledWorkshopIds: isEnrolled
        ? current.enrolledWorkshopIds.filter((id) => id !== workshop.id)
        : [...current.enrolledWorkshopIds, workshop.id],
    }));
    setNotice(isEnrolled
      ? 'Workshop reminder removed from this browser.'
      : 'Workshop reminder saved on this browser. This does not reserve a place with the host.');
  };

  const AcademyContainer = embedded ? 'section' : 'main';

  return (
    <AcademyContainer className={`learning-academy${embedded ? ' learning-academy-embedded' : ''}`} aria-label="Mafunzo learning and training">
      <header className="learning-academy-heading">
        <div>
          <span className="learning-academy-eyebrow">MAFUNZO · LEARNING &amp; TRAINING</span>
          {embedded ? <h2>Mafunzo Academy</h2> : <h1>Mafunzo — Learning &amp; Training</h1>}
          <p>Build practical skills with guided lessons, expert workshops, and a learning record that grows with your farm.</p>
        </div>
        {profile?.name && <span className="learning-academy-welcome">Learning for {profile.name}</span>}
      </header>

      {notice && <div className="learning-academy-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><span className="material-symbols-outlined">close</span></button></div>}

      <section className="learning-academy-stats" aria-label="Your learning progress">
        {[
          ['school', completedCourseIds.length, 'Courses completed'],
          ['workspace_premium', completedCourseIds.length, 'Completion records'],
          ['groups', learningState.enrolledWorkshopIds.length, 'Workshop plans'],
          ['schedule', (learningMinutes / 60).toFixed(1), 'Learning hours'],
        ].map(([icon, value, label]) => <article key={label}><span className="material-symbols-outlined">{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>)}
      </section>

      <div className="learning-academy-layout">
        <div className="learning-academy-main">
          <section className="learning-path-card">
            <div className="learning-section-heading"><div><span className="learning-academy-eyebrow">YOUR PROGRESS</span><h2>Your learning path</h2></div><span>{completedLessonCount} lesson{completedLessonCount === 1 ? '' : 's'} completed</span></div>
            <div className="learning-path-steps">
              {courses.map((course, index) => {
                const done = completedCourseIds.includes(course.id);
                const started = learningState.enrolledCourseIds.includes(course.id);
                return <button type="button" key={course.id} className={`learning-path-step ${done ? 'is-complete' : started ? 'is-active' : ''}`} onClick={() => setCourseEnrollment(course)} aria-label={`Open ${course.title}`}>
                  <span className="learning-path-node"><span className="material-symbols-outlined">{done ? 'check' : started ? 'play_arrow' : course.icon}</span></span>
                  <span>{course.title}</span>
                  {index < courses.length - 1 && <i aria-hidden="true" />}
                </button>;
              })}
            </div>
          </section>

          <section className="learning-course-section">
            <div className="learning-section-heading learning-course-heading">
              <div><span className="learning-academy-eyebrow">LEARN AT YOUR PACE</span><h2>Recommended courses</h2></div>
              <button type="button" className="learning-text-button" onClick={() => { setFilter('all'); setQuery(''); }}>View all</button>
            </div>
            <div className="learning-course-controls">
              <label className="learning-course-search"><span className="material-symbols-outlined">search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses or topics" aria-label="Search courses or topics" /></label>
              <div className="learning-course-filters" aria-label="Filter courses">
                {[['all', 'All courses'], ['in-progress', 'In progress'], ['enrolled', 'Enrolled']].map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
              </div>
            </div>
            {visibleCourses.length ? <div className="learning-course-grid">
              {visibleCourses.map((course) => {
                const completedLessons = learningState.completedLessonIds[course.id] || [];
                const progress = Math.round(completedLessons.length / course.lessons.length * 100);
                const isEnrolled = learningState.enrolledCourseIds.includes(course.id);
                return <article className="learning-course-card" key={course.id}>
                  <div className={`learning-course-cover ${course.tone}`}><span className="material-symbols-outlined">{course.icon}</span><small>{course.category}</small></div>
                  <div className="learning-course-copy">
                    <span className="learning-course-provider">{course.provider}</span>
                    <h3>{course.title}</h3>
                    <p className="learning-course-description">{course.description}</p>
                    <div className="learning-course-meta"><span><span className="material-symbols-outlined">schedule</span>{Math.floor(course.duration / 60)}h {course.duration % 60 ? `${course.duration % 60}m` : ''}</span><span><span className="material-symbols-outlined">menu_book</span>{course.lessons.length} lessons</span></div>
                    {isEnrolled && <div className="learning-course-progress"><div><span>Progress</span><strong>{progress}%</strong></div><span className="learning-progress-track"><i style={{ width: `${progress}%` }} /></span></div>}
                    <button type="button" className={isEnrolled ? 'learning-course-action primary' : 'learning-course-action'} onClick={() => setCourseEnrollment(course)}>{completedCourseIds.includes(course.id) ? 'Review course' : isEnrolled ? 'Continue learning' : 'Enroll now'}<span className="material-symbols-outlined">{isEnrolled ? 'arrow_forward' : 'school'}</span></button>
                  </div>
                </article>;
              })}
            </div> : <div className="learning-academy-empty"><span className="material-symbols-outlined">search_off</span><strong>No courses match this view</strong><p>Try another search or choose a different course filter.</p><button type="button" onClick={() => { setFilter('all'); setQuery(''); }}>Show all courses</button></div>}
          </section>
        </div>

        <aside className="learning-academy-aside">
          <section className="learning-aside-card learning-workshops">
            <div className="learning-section-heading"><div><span className="learning-academy-eyebrow">LEARN TOGETHER</span><h2>Suggested workshops</h2></div><span className="material-symbols-outlined">event</span></div>
            <div className="learning-workshop-list">{workshops.map((workshop) => {
              const isEnrolled = learningState.enrolledWorkshopIds.includes(workshop.id);
              return <article key={workshop.id}>
                <span className="learning-workshop-date">Illustrative · {formatWorkshopDate(workshop.date)} · {workshop.time}</span>
                <h3>{workshop.title}</h3>
                <p>{workshop.details}</p>
                <button type="button" className={isEnrolled ? 'saved' : ''} onClick={() => toggleWorkshopEnrollment(workshop)}>{isEnrolled ? 'Plan saved' : 'Save workshop plan'}</button>
              </article>;
            })}</div>
            <p className="learning-local-disclaimer">Sample topics and dates only. Saving a plan keeps a personal record on this device; no host is booked or notified.</p>
          </section>

          <section className="learning-aside-card learning-certificates">
            <div className="learning-section-heading"><div><span className="learning-academy-eyebrow">YOUR RECORD</span><h2>My certificates</h2></div><span className="material-symbols-outlined">workspace_premium</span></div>
            {completedCourseIds.length ? <div className="learning-certificate-grid">{courses.filter((course) => completedCourseIds.includes(course.id)).map((course) => <article key={course.id}><span className="learning-certificate-icon"><span className="material-symbols-outlined">workspace_premium</span></span><strong>{course.title}</strong><small>Course completion record</small></article>)}</div> : <div className="learning-certificate-empty"><span className="material-symbols-outlined">workspace_premium</span><strong>No certificates yet</strong><p>Complete every lesson in a course to create a course completion record.</p></div>}
            <p className="learning-local-disclaimer">Completion records are stored in this browser and are not third-party accredited certificates.</p>
          </section>
        </aside>
      </div>

      {activeCourse && <div className="learning-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveCourseId(''); }}>
        <section className="learning-course-modal" role="dialog" aria-modal="true" aria-labelledby="learning-course-modal-title">
          <header><div><span className="learning-academy-eyebrow">{activeCourse.category} · {activeCourse.lessons.length} lessons</span><h2 id="learning-course-modal-title">{activeCourse.title}</h2><p>{activeCourse.description}</p></div><button type="button" onClick={() => setActiveCourseId('')} aria-label="Close course"><span className="material-symbols-outlined">close</span></button></header>
          <div className="learning-modal-content">
            <div className="learning-lesson-list"><h3>Course lessons</h3>{activeCourse.lessons.map((lesson, index) => {
              const isComplete = learningState.completedLessonIds[activeCourse.id]?.includes(lesson.id);
              return <button type="button" key={lesson.id} className={`${activeLessonId === lesson.id ? 'selected' : ''} ${isComplete ? 'complete' : ''}`} onClick={() => setActiveLessonId(lesson.id)}><span className="learning-lesson-number">{isComplete ? <span className="material-symbols-outlined">check</span> : index + 1}</span><span><strong>{lesson.title}</strong><small>{lesson.minutes} minutes {isComplete ? '· Completed' : ''}</small></span><span className="material-symbols-outlined">chevron_right</span></button>;
            })}</div>
            <article className="learning-lesson-detail">{activeLesson ? <>
              <span className="learning-academy-eyebrow">LESSON · {activeLesson.minutes} MIN</span><h3>{activeLesson.title}</h3><p>{activeLesson.summary}</p><p>Use this lesson as a starting point and adapt decisions to your local conditions. For crop or animal health concerns, confirm recommendations with a qualified local extension professional.</p>
              <button type="button" className="learning-course-action primary" disabled={learningState.completedLessonIds[activeCourse.id]?.includes(activeLesson.id)} onClick={markLessonComplete}>{learningState.completedLessonIds[activeCourse.id]?.includes(activeLesson.id) ? 'Lesson completed' : 'Mark lesson complete'}<span className="material-symbols-outlined">{learningState.completedLessonIds[activeCourse.id]?.includes(activeLesson.id) ? 'check' : 'done'}</span></button>
            </> : <p>Select a lesson to get started.</p>}</article>
          </div>
          {completedCourseIds.includes(activeCourse.id) && <div className="learning-course-complete" role="status"><span className="material-symbols-outlined">workspace_premium</span><span><strong>Course complete</strong><small>Your local course completion record is available under My certificates.</small></span></div>}
        </section>
      </div>}
    </AcademyContainer>
  );
}
