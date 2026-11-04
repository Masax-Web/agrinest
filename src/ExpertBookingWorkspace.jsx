import { useEffect, useMemo, useState } from 'react';
import './ExpertBookingWorkspace.css';

const services = [
  {
    id: 'remote',
    title: 'Remote Video Consultation',
    description: '30-minute deep dive video call',
    price: 30000,
    priceNote: 'Instant link provided',
    icon: 'videocam',
  },
  {
    id: 'field',
    title: 'On-Farm Field Visit',
    description: 'In-person physical assessment',
    price: 75000,
    priceNote: '+ Transport fees',
    icon: 'location_on',
  },
];

const timeSlots = ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'];
const weekdays = [
  ['Monday', 'M'], ['Tuesday', 'T'], ['Wednesday', 'W'], ['Thursday', 'T'],
  ['Friday', 'F'], ['Saturday', 'S'], ['Sunday', 'S'],
];

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarDays(month) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function formatMonth(month) {
  return month.toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

function formatSelectedDate(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTzs(amount) {
  return `TZS ${amount.toLocaleString('en-TZ')}`;
}

function readBookingRequests(userId) {
  try {
    const requests = JSON.parse(window.localStorage.getItem(`agrinest-expert-session-requests:${userId || 'anonymous'}`) || '[]');
    return Array.isArray(requests) ? requests : [];
  } catch (error) {
    console.error('Could not read expert session requests from this browser:', error.message);
    return [];
  }
}

function ExpertStars({ value = 5 }) {
  return (
    <span className="expert-booking-stars" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className="material-symbols-outlined" aria-hidden="true">
          {index < value ? 'star' : 'star_border'}
        </span>
      ))}
    </span>
  );
}

export default function ExpertBookingWorkspace({ user, records, onRecordsChange, onBack }) {
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const [page, setPage] = useState('network');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedService, setSelectedService] = useState('remote');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [requests, setRequests] = useState(() => readBookingRequests(user?.user_id));
  const [isSupportFormOpen, setIsSupportFormOpen] = useState(false);
  const [supportDraft, setSupportDraft] = useState({ title: '', details: '' });

  const selectedServiceDetails = services.find((service) => service.id === selectedService) || services[0];
  const platformFee = Math.round(selectedServiceDetails.price * 0.05);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  useEffect(() => {
    document.body.classList.add('expert-booking-active');
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('expert-booking-active');
  }, []);

  const changeMonth = (difference) => {
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + difference, 1);
    if (nextMonth < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setCalendarMonth(nextMonth);
  };

  const selectDate = (date) => {
    if (date < today || date.getMonth() !== calendarMonth.getMonth()) return;
    setSelectedDate(localDateKey(date));
  };

  const saveBookingRequest = () => {
    if (!selectedDate || !selectedTime) {
      setNotice('Choose an available date and time to prepare a session request.');
      return;
    }

    const nextRequests = [{
      id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`,
      expert: 'Dr. Richard Mgata',
      service: selectedServiceDetails.title,
      serviceId: selectedServiceDetails.id,
      serviceFeeTzs: selectedServiceDetails.price,
      platformFeeTzs: platformFee,
      date: selectedDate,
      time: selectedTime,
      status: 'Request saved locally — not booked',
      createdAt: new Date().toISOString(),
    }, ...requests];

    try {
      window.localStorage.setItem(`agrinest-expert-session-requests:${user?.user_id || 'anonymous'}`, JSON.stringify(nextRequests));
      setRequests(nextRequests);
      setNotice('');
      setConfirmation('Your session request is saved on this device. The expert has not been notified, the appointment is not reserved, and no payment or escrow transaction has occurred.');
    } catch (error) {
      console.error('Could not save the expert session request:', error.message);
      setNotice('This browser could not save the session request. No booking or payment was made.');
    }
  };

  const saveExpertHelpRequest = (event) => {
    event.preventDefault();
    const savedRequests = records?.requests || [];
    const request = {
      id: globalThis.crypto?.randomUUID?.() || `expert-request-${Date.now()}`,
      module: 'experts',
      title: supportDraft.title.trim(),
      details: supportDraft.details.trim(),
      date: localDateKey(new Date()),
      status: 'Saved',
    };
    onRecordsChange?.('requests', [...savedRequests, request]);
    setSupportDraft({ title: '', details: '' });
    setIsSupportFormOpen(false);
    setNotice('Expert support request saved to your farmer records on this device.');
  };

  const savedHelpRequests = (records?.requests || []).filter((request) => request.module === 'experts');

  return (
    <div className="expert-booking-app">
      <header className="expert-booking-shell-header">
        <button type="button" onClick={onBack} aria-label="Return to AGRI-NEST dashboard">
          <span className="material-symbols-outlined">arrow_back</span><strong>AGRI-NEST</strong>
        </button>
        <span>Expert support</span>
      </header>

      <main className="expert-booking-main">
        {page === 'network' ? (
          <>
            <header className="expert-network-header">
              <span className="expert-booking-eyebrow">COMMUNITY &amp; LEARNING</span>
              <h1>Expert Network</h1>
              <p>Find agricultural expertise and prepare a consultation request.</p>
            </header>
            <article className="expert-network-card">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKUILfajV9AWgMDOmbhVDQtLatcLfsFJe-p6g7or77cxPzDWt3HmIvpjrcpQ20RRwYNf4--qYupD6TjyvCbH_3steqOFtuKb-YAXIqM_6jRQXQS2BZlWrRrEZd7c5j5NHGioWD56RF30UcZzNe5lsSVhJ6ffbOipMaf5mhMEEQGRNB6V6Rl-3FV5qU_xcLDKyv-w9iyMzSkNJC5N8wHoLSACkDHemqCo4eiFhpkcU0wLmW4ljxK7sSEOy1XBxR5QA_kHshvAoUgVM" alt="Dr. Richard Mgata" />
              <div className="expert-network-card-copy">
                <span className="expert-booking-eyebrow">AGRONOMY · SOIL HEALTH</span>
                <h2>Dr. Richard Mgata <span className="material-symbols-outlined" aria-label="Profile listed in demo">verified</span></h2>
                <p>Lead Agronomist &amp; Soil Specialist</p>
                <div className="expert-booking-tags"><span>Maize Mastery</span><span>Soil Health Analytics</span><span>IPM Strategies</span></div>
                <div className="expert-network-rating"><ExpertStars value={5} /><strong>4.9</strong><span>128 consultations · Sample profile</span></div>
                <button type="button" className="expert-booking-primary" onClick={() => setPage('booking')}>Book Expert Session<span className="material-symbols-outlined">arrow_forward</span></button>
              </div>
            </article>
            <section className="expert-network-info">
              <h2>Session requests</h2>
              <p>Choose an expert, session type, and preferred time. Requests are saved in this browser only. They are not reservations, and AGRI-NEST does not process payments or escrow for expert sessions.</p>
              <div className="expert-network-request-count"><span className="material-symbols-outlined">event_note</span><span><strong>{requests.length}</strong> local request{requests.length === 1 ? '' : 's'} on this device</span></div>
              <button type="button" className="expert-support-toggle" aria-expanded={isSupportFormOpen} onClick={() => setIsSupportFormOpen((open) => !open)}>
                {isSupportFormOpen ? 'Close support request' : 'Request general expert help'}
              </button>
              {isSupportFormOpen && <form className="expert-support-form" onSubmit={saveExpertHelpRequest}>
                <label>Topic<input required maxLength={120} value={supportDraft.title} onChange={(event) => setSupportDraft((current) => ({ ...current, title: event.target.value }))} /></label>
                <label>What do you need help with?<textarea required maxLength={1000} rows="3" value={supportDraft.details} onChange={(event) => setSupportDraft((current) => ({ ...current, details: event.target.value }))} /></label>
                <button type="submit" className="expert-booking-primary">Save expert request</button>
              </form>}
              {savedHelpRequests.length > 0 && <div className="expert-saved-help-requests"><h3>Your saved expert requests</h3>{savedHelpRequests.map((request) => <article key={request.id}><strong>{request.title}</strong><p>{request.details}</p><small>{request.status || 'Saved'}{request.date ? ` · ${request.date}` : ''}</small></article>)}</div>}
            </section>
          </>
        ) : (
          <>
            <header className="expert-booking-page-header">
              <div>
                <button type="button" className="expert-booking-back" onClick={() => setPage('network')}><span className="material-symbols-outlined">arrow_back_ios</span>Back to Expert Network</button>
                <h1>Book Expert Session</h1>
              </div>
              <span className="expert-booking-protection"><span className="material-symbols-outlined">info</span>Booking request only</span>
            </header>

            <div className="expert-booking-layout">
              <div className="expert-booking-left">
                <section className="expert-profile-card">
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKUILfajV9AWgMDOmbhVDQtLatcLfsFJe-p6g7or77cxPzDWt3HmIvpjrcpQ20RRwYNf4--qYupD6TjyvCbH_3steqOFtuKb-YAXIqM_6jRQXQS2BZlWrRrEZd7c5j5NHGioWD56RF30UcZzNe5lsSVhJ6ffbOipMaf5mhMEEQGRNB6V6Rl-3FV5qU_xcLDKyv-w9iyMzSkNJC5N8wHoLSACkDHemqCo4eiFhpkcU0wLmW4ljxK7sSEOy1XBxR5QA_kHshvAoUgVM" alt="Dr. Richard Mgata" />
                  <div className="expert-profile-info">
                    <div className="expert-profile-heading">
                      <div><h2>Dr. Richard Mgata <span className="material-symbols-outlined" aria-label="Sample expert profile">verified</span></h2><p>Lead Agronomist &amp; Soil Specialist</p></div>
                      <div className="expert-profile-rating"><div><span className="material-symbols-outlined">star</span>4.9</div><small>128 Total<br />Consultations</small></div>
                    </div>
                    <div className="expert-booking-tags"><span>Maize Mastery</span><span>Soil Health Analytics</span><span>IPM Strategies</span></div>
                  </div>
                </section>

                <div className="expert-bio-reviews">
                  <section className="expert-booking-card expert-bio-card">
                    <h2><span className="material-symbols-outlined">history_edu</span>EXPERT BIO</h2>
                    <p>With over 15 years in regenerative agriculture across East Africa, Dr. Mgata specializes in maximizing yields through sustainable soil management. He has spearheaded large-scale maize optimization programs and is a recognized leader in Integrated Pest Management (IPM).</p>
                    <div className="expert-education"><strong>Education</strong><p>PhD in Soil Science - Sokoine University of Agriculture</p></div>
                  </section>
                  <section className="expert-booking-card expert-reviews-card">
                    <h2><span className="material-symbols-outlined">forum</span>FARMER REVIEWS</h2>
                    <blockquote><ExpertStars value={5} /><p>“The soil analysis Dr. Mgata provided saved my entire harvest this season. Professional and precise.”</p><cite>— Juma K., Morogoro</cite></blockquote>
                    <blockquote><ExpertStars value={4} /><p>“Very clear communication on pest control. My IPM strategy is now much more effective.”</p><cite>— Sarah L., Iringa</cite></blockquote>
                  </section>
                </div>

                <section className="expert-booking-card expert-service-card">
                  <h2><span className="material-symbols-outlined">list_alt</span>SELECT SERVICE TYPE</h2>
                  <div className="expert-service-options">
                    {services.map((service) => (
                      <label key={service.id} className={selectedService === service.id ? 'expert-service-option selected' : 'expert-service-option'}>
                        <input type="radio" name="expert-service" value={service.id} checked={selectedService === service.id} onChange={() => setSelectedService(service.id)} />
                        <span className="expert-service-icon material-symbols-outlined">{service.icon}</span>
                        <span className="expert-service-copy"><strong>{service.title}</strong><small>{service.description}</small></span>
                        <span className="expert-service-price"><strong>{formatTzs(service.price)}</strong><small>{service.priceNote}</small></span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="expert-booking-right">
                <section className="expert-booking-card expert-calendar-card">
                  <div className="expert-calendar-heading">
                    <h2>SELECT DATE &amp; TIME</h2>
                    <div>
                      <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} disabled={calendarMonth <= new Date(today.getFullYear(), today.getMonth(), 1)}><span className="material-symbols-outlined">chevron_left</span></button>
                      <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><span className="material-symbols-outlined">chevron_right</span></button>
                    </div>
                  </div>
                  <div className="expert-calendar-month" aria-live="polite">{formatMonth(calendarMonth)}</div>
                  <div className="expert-calendar-grid" role="grid" aria-label={formatMonth(calendarMonth)}>
                    {weekdays.map(([day, initial], index) => <span className="expert-weekday" key={`${day}-${index}`} role="columnheader" aria-label={day}>{initial}</span>)}
                    {calendarDays.map((date) => {
                      const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                      const isPast = date < today;
                      const isSelected = selectedDate === localDateKey(date);
                      return isCurrentMonth ? (
                        <button
                          key={localDateKey(date)}
                          type="button"
                          role="gridcell"
                          className={`${isPast ? 'past-date' : ''} ${isSelected ? 'selected' : ''}`}
                          aria-label={date.toLocaleDateString('en', { dateStyle: 'full' })}
                          aria-pressed={isSelected}
                          disabled={isPast}
                          onClick={() => selectDate(date)}
                        >
                          {date.getDate()}
                        </button>
                      ) : <span className="expert-calendar-day outside-month" key={localDateKey(date)} aria-hidden="true">{date.getDate()}</span>;
                    })}
                  </div>
                  <div className="expert-available-slots">
                    <h3>AVAILABLE SLOTS</h3>
                    {!selectedDate && <p className="expert-calendar-hint">Choose a date to select a preferred time.</p>}
                    <div className="expert-slot-grid">
                      {timeSlots.map((time) => (
                        <button key={time} type="button" className={selectedTime === time ? 'selected' : ''} disabled={!selectedDate} aria-pressed={selectedTime === time} onClick={() => setSelectedTime(time)}>{time}</button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="expert-order-summary">
                  <h2>ORDER SUMMARY</h2>
                  <div className="expert-fee-row"><span>Service Fee</span><strong>{formatTzs(selectedServiceDetails.price)}</strong></div>
                  <div className="expert-fee-row"><span>Platform Fee</span><strong>{formatTzs(platformFee)}</strong></div>
                  {selectedServiceDetails.id === 'field' && <p className="expert-transport-fee">Transport fee will be quoted separately.</p>}
                  <div className="expert-fee-total"><span>Estimated Total</span><strong>{formatTzs(selectedServiceDetails.price + platformFee)}</strong></div>
                  <div className="expert-escrow-notice"><span className="material-symbols-outlined">info</span><p>No payment or escrow service is connected. Submitting below only saves your preferred session details on this device.</p></div>
                  {selectedDate && <p className="expert-selected-appointment">{formatSelectedDate(selectedDate)}{selectedTime ? ` · ${selectedTime}` : ''}</p>}
                  <button type="button" className="expert-confirm-button" onClick={saveBookingRequest}>Save Session Request<span className="material-symbols-outlined">event_available</span></button>
                  <p className="expert-cancellation-note">This does not reserve a time, notify the expert, or charge your account.</p>
                </section>

                <button type="button" className="expert-concierge-card" onClick={() => setNotice('AgriOS Concierge is not connected in this preview. Your session request has not been sent.')}>
                  <span className="material-symbols-outlined">support_agent</span><span><strong>Need help with booking?</strong><small>Chat with AgriOS Concierge</small></span>
                </button>
              </aside>
            </div>
          </>
        )}
      </main>

      {notice && <div className="expert-booking-toast" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}
      {confirmation && <div className="expert-booking-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setConfirmation('');
      }}>
        <section className="expert-booking-confirmation" role="dialog" aria-modal="true" aria-labelledby="expert-confirmation-title">
          <span className="material-symbols-outlined">event_note</span>
          <h2 id="expert-confirmation-title">Request saved on this device</h2>
          <p>{confirmation}</p>
          <button type="button" onClick={() => { setConfirmation(''); setPage('network'); }}>Back to Expert Network</button>
        </section>
      </div>}
    </div>
  );
}
