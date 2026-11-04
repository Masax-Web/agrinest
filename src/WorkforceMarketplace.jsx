import { useEffect, useState } from 'react';
import api from './lib/api';
import './WorkforceMarketplace.css';

const today = () => new Date().toISOString().slice(0, 10);
const formatTzs = (amount) => `TZS ${Number(amount || 0).toLocaleString('en-TZ')}`;
const describeError = (error) => error instanceof Error ? error.message.replaceAll('_', ' ') : 'The request could not be completed.';

const emptyProfile = { skills: '', region: '', daily_rate: '', experience: '', bio: '', availability: 'available' };
const emptyJob = { title: '', skill: '', location: '', workersNeeded: '1', dailyRate: '', startDate: today(), durationDays: '1', details: '' };

export default function WorkforceMarketplace({ user, mode = 'farmer', section = 'jobs', profile, onBack }) {
  const isWorker = mode === 'worker';
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [workerProfile, setWorkerProfile] = useState(emptyProfile);
  const [jobDraft, setJobDraft] = useState({ ...emptyJob, location: profile?.location || profile?.region || '' });
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobApplications, setJobApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    setError('');
    setLoading(true);
    try {
      if (isWorker) {
        const [profileResult, jobsResult, applicationsResult] = await Promise.all([
          api.getWorkforceProfile(),
          api.getWorkforceJobs(),
          api.getWorkforceApplications(),
        ]);
        if (profileResult.profile) {
          setWorkerProfile({
            ...profileResult.profile,
            skills: Array.isArray(profileResult.profile.skills) ? profileResult.profile.skills.join(', ') : '',
            daily_rate: String(profileResult.profile.daily_rate || ''),
          });
        }
        setJobs(jobsResult.items);
        setApplications(applicationsResult.items);
      } else {
        const result = await api.getWorkforceJobs(true);
        setJobs(result.items);
      }
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setError('');
      setLoading(true);
      try {
        if (isWorker) {
          const [profileResult, jobsResult, applicationsResult] = await Promise.all([
            api.getWorkforceProfile(),
            api.getWorkforceJobs(),
            api.getWorkforceApplications(),
          ]);
          if (!active) return;
          if (profileResult.profile) {
            setWorkerProfile({
              ...profileResult.profile,
              skills: Array.isArray(profileResult.profile.skills) ? profileResult.profile.skills.join(', ') : '',
              daily_rate: String(profileResult.profile.daily_rate || ''),
            });
          }
          setJobs(jobsResult.items);
          setApplications(applicationsResult.items);
        } else {
          const result = await api.getWorkforceJobs(true);
          if (!active) return;
          setJobs(result.items);
        }
      } catch (loadError) {
        if (active) setError(describeError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };
    initialize();
    return () => { active = false; };
  }, [isWorker, user?.user_id]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const skills = workerProfile.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    try {
      const result = await api.saveWorkforceProfile({
        skills,
        region: workerProfile.region,
        dailyRate: Number(workerProfile.daily_rate),
        experience: workerProfile.experience,
        bio: workerProfile.bio,
        availability: workerProfile.availability,
      });
      setWorkerProfile({
        ...result.profile,
        skills: result.profile.skills.join(', '),
        daily_rate: String(result.profile.daily_rate),
      });
      setNotice('Your worker profile is saved. Employers will see it only when you apply to their jobs.');
    } catch (saveError) {
      setError(describeError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const createJob = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.createWorkforceJob({
        title: jobDraft.title,
        skill: jobDraft.skill,
        location: jobDraft.location,
        workersNeeded: Number(jobDraft.workersNeeded),
        dailyRate: Number(jobDraft.dailyRate),
        startDate: jobDraft.startDate,
        durationDays: Number(jobDraft.durationDays),
        details: jobDraft.details,
      });
      setJobDraft({ ...emptyJob, location: profile?.location || profile?.region || '' });
      setNotice('Your paid work opportunity is now visible to agricultural workers.');
      await loadData();
    } catch (createError) {
      setError(describeError(createError));
    } finally {
      setBusy(false);
    }
  };

  const apply = async (jobId) => {
    if (!workerProfile.skills || !workerProfile.region || !workerProfile.daily_rate) {
      setNotice('Complete your worker profile before applying. Your details are shared only with the employer for jobs you apply to.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.applyToWorkforceJob(jobId);
      setNotice('Application sent to the farmer. You can track its status in My Applications.');
      await loadData();
    } catch (applyError) {
      setError(describeError(applyError));
    } finally {
      setBusy(false);
    }
  };

  const openApplications = async (jobId) => {
    setSelectedJobId(jobId);
    setError('');
    try {
      const result = await api.getJobApplications(jobId);
      setJobApplications(result.items);
    } catch (applicationError) {
      setError(describeError(applicationError));
      setJobApplications([]);
    }
  };

  const updateApplication = async (applicationId, status) => {
    setBusy(true);
    setError('');
    try {
      await api.updateWorkforceApplication(applicationId, status);
      await openApplications(selectedJobId);
      await loadData();
      setNotice(status === 'accepted' ? 'Worker accepted. The listing closes when all requested positions are filled.' : 'Application declined.');
    } catch (updateError) {
      setError(describeError(updateError));
    } finally {
      setBusy(false);
    }
  };

  const hasApplied = new Set(applications.map((application) => application.job_id));

  return (
    <section className="workforce-marketplace">
      <header className="workforce-marketplace-heading">
        <div>
          <span className="workforce-eyebrow">{isWorker ? 'VIBARUA · WORKER ACCOUNT' : 'VIBARUA · FARM WORKFORCE'}</span>
          <h1>{isWorker ? section === 'profile' ? 'Worker profile' : section === 'applications' ? 'My applications' : 'Farm work opportunities' : 'Jobs and applicants'}</h1>
          <p>{isWorker ? 'Connect directly with farmers hiring for agricultural work.' : 'Post paid opportunities and review applications from agricultural workers.'}</p>
        </div>
        {onBack && <button type="button" className="workforce-quiet-button" onClick={onBack}>Back to tasks</button>}
      </header>

      <div className="workforce-disclosure" role="note">
        Worker profiles are shared with an employer only after you apply. Applications and job posts are stored in AGRI-NEST; wages and contracts are arranged directly between the parties.
      </div>
      {error && <p className="workforce-message is-error" role="alert">{error}</p>}
      {notice && <p className="workforce-message" role="status">{notice}</p>}

      {isWorker && section === 'profile' ? (
        <form className="workforce-panel workforce-form" onSubmit={saveProfile}>
          <h2>Your public application profile</h2>
          <p>These details are shown only to farmers whose jobs you apply for. Contact details are not shared by this feature.</p>
          <label>Skills, separated by commas<input required value={workerProfile.skills} onChange={(event) => setWorkerProfile((current) => ({ ...current, skills: event.target.value }))} placeholder="Harvesting, irrigation, livestock care" /></label>
          <label>Region or district<input required maxLength={120} value={workerProfile.region} onChange={(event) => setWorkerProfile((current) => ({ ...current, region: event.target.value }))} placeholder="e.g. Iringa" /></label>
          <label>Expected daily rate (TZS)<input required type="number" min="1" step="1" value={workerProfile.daily_rate} onChange={(event) => setWorkerProfile((current) => ({ ...current, daily_rate: event.target.value }))} /></label>
          <label>Experience<input maxLength={300} value={workerProfile.experience} onChange={(event) => setWorkerProfile((current) => ({ ...current, experience: event.target.value }))} /></label>
          <label>Short introduction<textarea maxLength={1000} rows="4" value={workerProfile.bio} onChange={(event) => setWorkerProfile((current) => ({ ...current, bio: event.target.value }))} /></label>
          <label>Availability<select value={workerProfile.availability} onChange={(event) => setWorkerProfile((current) => ({ ...current, availability: event.target.value }))}><option value="available">Available</option><option value="seasonal">Seasonal availability</option><option value="busy">Not available</option></select></label>
          <button type="submit" className="workforce-primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save worker profile'}</button>
        </form>
      ) : isWorker && section === 'applications' ? (
        <section className="workforce-panel">
          <h2>Application status</h2>
          {loading ? <p>Loading your applications…</p> : applications.length ? <div className="workforce-card-list">{applications.map((application) => <article className="workforce-card" key={application.application_id}>
            <div><span className={`workforce-status is-${application.application_status}`}>{application.application_status}</span><h3>{application.title}</h3><p>{application.skill} · {application.location}</p><small>Employer: {application.employer_name} · Start: {String(application.start_date).slice(0, 10)}</small></div>
            <strong>{formatTzs(application.daily_rate)} / day</strong>
          </article>)}</div> : <p>You have not applied to any jobs yet.</p>}
        </section>
      ) : isWorker ? (
        <section className="workforce-panel">
          <div className="workforce-section-heading"><h2>Open jobs near you</h2><button type="button" className="workforce-quiet-button" onClick={loadData} disabled={loading}>Refresh</button></div>
          {loading ? <p>Loading current opportunities…</p> : jobs.length ? <div className="workforce-card-list">{jobs.map((job) => <article className="workforce-card" key={job.job_id}>
            <div><span className="workforce-status is-open">Open</span><h3>{job.title}</h3><p>{job.skill} · {job.location}</p><small>{job.workers_needed} position{job.workers_needed === 1 ? '' : 's'} · {job.duration_days} day{job.duration_days === 1 ? '' : 's'} · Starts {String(job.start_date).slice(0, 10)}</small>{job.details && <p>{job.details}</p>}<small>Posted by {job.employer_name}</small></div>
            <div className="workforce-card-actions"><strong>{formatTzs(job.daily_rate)} / day</strong><button type="button" className="workforce-primary-button" disabled={busy || hasApplied.has(job.job_id) || workerProfile.availability === 'busy'} onClick={() => apply(job.job_id)}>{hasApplied.has(job.job_id) ? 'Applied' : workerProfile.availability === 'busy' ? 'Mark available to apply' : 'Apply for work'}</button></div>
          </article>)}</div> : <p>No open jobs yet. Check again later.</p>}
        </section>
      ) : (
        <>
          <form className="workforce-panel workforce-form" onSubmit={createJob}>
            <h2>Post a paid farm job</h2>
            <div className="workforce-form-grid">
              <label>Job title<input required maxLength={120} value={jobDraft.title} onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Maize harvest team" /></label>
              <label>Skill<input required maxLength={80} value={jobDraft.skill} onChange={(event) => setJobDraft((current) => ({ ...current, skill: event.target.value }))} placeholder="Harvesting" /></label>
              <label>Work location<input required maxLength={120} value={jobDraft.location} onChange={(event) => setJobDraft((current) => ({ ...current, location: event.target.value }))} /></label>
              <label>Workers needed<input required type="number" min="1" max="1000" step="1" value={jobDraft.workersNeeded} onChange={(event) => setJobDraft((current) => ({ ...current, workersNeeded: event.target.value }))} /></label>
              <label>Daily pay (TZS)<input required type="number" min="1" step="1" value={jobDraft.dailyRate} onChange={(event) => setJobDraft((current) => ({ ...current, dailyRate: event.target.value }))} /></label>
              <label>Start date<input required type="date" min={today()} value={jobDraft.startDate} onChange={(event) => setJobDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
              <label>Duration (days)<input required type="number" min="1" max="365" step="1" value={jobDraft.durationDays} onChange={(event) => setJobDraft((current) => ({ ...current, durationDays: event.target.value }))} /></label>
            </div>
            <label>Job details<textarea maxLength={2000} rows="3" value={jobDraft.details} onChange={(event) => setJobDraft((current) => ({ ...current, details: event.target.value }))} /></label>
            <button type="submit" className="workforce-primary-button" disabled={busy}>{busy ? 'Publishing…' : 'Publish job'}</button>
          </form>

          <section className="workforce-panel">
            <div className="workforce-section-heading"><h2>Your job posts</h2><button type="button" className="workforce-quiet-button" onClick={loadData} disabled={loading}>Refresh</button></div>
            {loading ? <p>Loading your job posts…</p> : jobs.length ? <div className="workforce-card-list">{jobs.map((job) => <article className="workforce-card workforce-employer-card" key={job.job_id}>
              <div><span className={`workforce-status is-${job.status}`}>{job.status}</span><h3>{job.title}</h3><p>{job.skill} · {job.location}</p><small>{job.workers_needed} position{job.workers_needed === 1 ? '' : 's'} · {job.duration_days} days · Starts {String(job.start_date).slice(0, 10)}</small></div>
              <div className="workforce-card-actions"><strong>{formatTzs(job.daily_rate)} / day</strong><button type="button" className="workforce-quiet-button" onClick={() => openApplications(job.job_id)}>View {job.applications_count} application{job.applications_count === 1 ? '' : 's'}</button></div>
            </article>)}</div> : <p>You have not posted any jobs yet.</p>}
          </section>

          {selectedJobId && <section className="workforce-panel">
            <div className="workforce-section-heading"><h2>Applicants</h2><button type="button" className="workforce-quiet-button" onClick={() => { setSelectedJobId(''); setJobApplications([]); }}>Close</button></div>
            {jobApplications.length ? <div className="workforce-card-list">{jobApplications.map((application) => <article className="workforce-card" key={application.application_id}>
              <div><span className={`workforce-status is-${application.status}`}>{application.status}</span><h3>{application.applicant_name}</h3><p>{(application.skills || []).join(', ')} · {application.region}</p><small>Expected {formatTzs(application.daily_rate)} / day{application.experience ? ` · ${application.experience}` : ''}</small>{application.bio && <p>{application.bio}</p>}{application.message && <p>{application.message}</p>}</div>
              {application.status === 'pending' && <div className="workforce-card-actions"><button type="button" className="workforce-primary-button" disabled={busy} onClick={() => updateApplication(application.application_id, 'accepted')}>Accept</button><button type="button" className="workforce-quiet-button" disabled={busy} onClick={() => updateApplication(application.application_id, 'declined')}>Decline</button></div>}
            </article>)}</div> : <p>No applications for this job yet.</p>}
          </section>}
        </>
      )}
    </section>
  );
}
