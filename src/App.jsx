import { useEffect, useRef, useState } from 'react';
import api from './lib/api';
import { calculateFarmerTrust } from './lib/farmer-trust';
import { fetchWeatherData, geocodeSavedWeatherLocation, getSavedWeatherLocation } from './lib/weather';
import MarketplacePage from './MarketplacePage';
import RamaniMapPage from './RamaniMapPage';
import FarmerWorkspace from './FarmerWorkspace';
import FinanceHub from './FinanceHub';
import CrowdfundingWorkspace from './CrowdfundingWorkspace';
import CarbonCreditsWorkspace from './CarbonCreditsWorkspace';
import SustainabilityWorkspace from './SustainabilityWorkspace';
import JichoNdviWorkspace from './JichoNdviWorkspace';
import IrrigationWorkspace from './IrrigationWorkspace';
import GroupsDashboard from './GroupsDashboard';
import CommunityLearningPortal from './CommunityLearningPortal';
import LoanSpendingPage from './LoanSpendingPage';
import SmartLoanApplication from './SmartLoanApplication';
import LenderDashboard from './LenderDashboard';
import RoleWorkspace from './RoleWorkspace';
import RoleDashboard from './RoleDashboard';
import AdminDashboard from './AdminDashboard';
import SecuritySettings from './SecuritySettings';
import JichoGrowingGuide from './JichoGrowingGuide';
import JichoPestKnowledge from './JichoPestKnowledge';
import JichoSoilKnowledge from './JichoSoilKnowledge';
import ProcurementWorkspace from './ProcurementWorkspace';
import VerifiedActivityArchive from './VerifiedActivityArchive';
import ExpertBookingWorkspace from './ExpertBookingWorkspace';
import TransporterFleetWorkspace from './TransporterFleetWorkspace';
import TransporterRouteWorkspace from './TransporterRouteWorkspace';
import { personas } from '../shared/personas.json';
import roleModel from '../shared/role-model.json';

const personaById = new Map(personas.map((persona) => [persona.id, persona]));
const coreRoleById = new Map(roleModel.coreRoles.map((coreRole) => [coreRole.id, coreRole]));
const coreRoleByPersonaId = new Map(roleModel.coreRoles.flatMap((coreRole) => (
  coreRole.personas.map((personaId) => [personaId, coreRole.id])
)));

function clearLegacyAuthTokens() {
  window.localStorage.removeItem('agrinest-auth-token');
  window.sessionStorage.removeItem('agrinest-auth-token');
}

function AdminDashboardWithSecurity({ user, onLogout, onImpersonate }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <DashboardWithSecurity user={user} onLogout={onLogout}>
      <AdminDashboard user={user} onLogout={onLogout} onOpenSecurity={() => setIsOpen(true)} onImpersonate={onImpersonate} />
      {isOpen && <SecuritySettings user={user} onClose={() => setIsOpen(false)} onSignedOut={onLogout} />}
    </DashboardWithSecurity>
  );
}

function getPersonaDashboard(personaId) {
  const persona = personaById.get(personaId);
  if (!persona) return 'smallholder';
  return ({
    smallholder: 'smallholder',
    buyer: 'buyer',
    gov: 'gov',
    admin: 'admin',
    student: 'student',
    transporter: 'transporter',
    commercial: 'commercial',
    bank: 'bank',
    coop: 'coop',
    expert: 'expert',
  })[persona.dashboard] || persona.id;
}

function DashboardWithSecurity({ user, onLogout, children, impersonationInfo, impersonationError, onEndImpersonation }) {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!impersonationInfo) return undefined;
    document.body.classList.add('admin-impersonation-active');
    return () => document.body.classList.remove('admin-impersonation-active');
  }, [impersonationInfo]);

  return (
    <>
      {impersonationInfo && <div className="admin-impersonation-banner" role="status">
        <div><strong><span className="material-symbols-outlined">switch_account</span>Acting as {user?.name || user?.email || 'user'}</strong><span>Changes affect this account · session ends {new Date(impersonationInfo.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{impersonationError && <span className="admin-impersonation-error">{impersonationError}</span>}</div>
        <button type="button" onClick={onEndImpersonation}><span className="material-symbols-outlined">undo</span>Return to super admin</button>
      </div>}
      {children}
      {!user?.is_admin && <button type="button" className="account-security-launch" onClick={() => setIsOpen(true)}>Account security</button>}
      {isOpen && <SecuritySettings user={user} onClose={() => setIsOpen(false)} onSignedOut={onLogout} />}
    </>
  );
}

function getAuthErrorMessage(code) {
  const messages = {
    account_already_exists: 'An account with that phone or email already exists.',
    account_pending_approval: 'Your registration is awaiting approval. We will notify you when it is ready.',
    invalid_credentials: 'The phone/email or password is incorrect.',
    persona_core_role_mismatch: 'Choose a persona that belongs to the selected core role.',
    farmer_persona_requires_review: 'This farmer account type requires administrator approval. Register or contact support to request it.',
    staff_account_required: 'Staff Access is only available to invited AGRI-NEST staff accounts.',
    invalid_or_expired_invitation: 'That invitation is invalid or has expired.',
    invitation_required_for_persona: 'This persona requires an invitation from an administrator.',
    password_must_be_12_to_128_characters: 'Use a password between 12 and 128 characters.',
    pin_must_be_6_to_12_digits: 'Use a PIN between 6 and 12 digits.',
    invalid_pin: 'That PIN is incorrect. Try again.',
    invalid_pin_challenge: 'Your PIN check expired. Sign in again.',
    too_many_attempts: 'Too many attempts. Wait 15 minutes before trying again.',
    google_oauth_not_configured: 'Google sign-in is not configured for this deployment yet.',
    google_oauth_unavailable: 'Google sign-in is temporarily unavailable. Please try again later.',
    google_state_invalid: 'The secure Google sign-in session could not be verified. Enable cookies and start again from this page.',
    google_signin_cancelled: 'Google sign-in was cancelled. You can try again whenever you are ready.',
    google_signin_failed: 'Google could not complete sign-in. Please try again; if this keeps happening, contact support.',
    google_authorization_failed: 'Google could not verify the sign-in. The OAuth callback URL may need to be checked by the site administrator.',
    google_email_not_verified: 'Use a Google account with a verified email address.',
    google_identity_invalid: 'Google did not return a valid account identity. Please try again.',
    google_identity_mismatch: 'This Google account no longer matches the email linked to your AGRI-NEST account.',
    google_identity_already_linked: 'This email is already linked to a different Google account. Contact support for help.',
    invalid_or_expired_google_code: 'The Google sign-in link expired or was already used. Start again.',
    current_password_invalid: 'Your current password is incorrect.',
    recent_google_signin_required: 'Sign in again before changing your PIN.',
    admin_access_required: 'Administrator access is required for this action.',
    valid_phone_required: 'Enter a valid phone number with country code.',
    unknown_persona: 'Choose a valid persona and try again.',
    persona_not_available_for_registration: 'Choose a different account type to register.',
  };
  return messages[code] || String(code || 'Authentication failed. Please try again.').replaceAll('_', ' ');
}

function GoogleSignInButton({ label, onClick, disabled }) {
  return (
    <button type="button" className="google-signin-button" onClick={onClick} disabled={disabled}>
      <svg className="google-g-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.91 3.28-4.73 3.28-8.09Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84C3.96 20.48 7.7 23 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.1A7.2 7.2 0 0 1 5.46 12c0-.73.13-1.43.38-2.1V7.06H2.15A11 11 0 0 0 1 12c0 1.78.43 3.46 1.15 4.94l3.69-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.96 3.52 2.15 7.06l3.69 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

function ProfileAvatar({ src, name, className = '' }) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  useEffect(() => setImageUnavailable(false), [src]);
  if (src && !imageUnavailable) {
    return <img className={className} src={src} alt="" onError={() => setImageUnavailable(true)} />;
  }
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`profile-photo-placeholder ${className}`} aria-hidden="true">{initials || '?'}</span>;
}

function getFarmerTimeOfDay(date) {
  const hour = date.getHours();
  if (hour < 5 || hour >= 20) return 'night';
  if (hour < 7) return 'dawn';
  if (hour < 11) return 'morning';
  if (hour < 16) return 'noon';
  return 'evening';
}

function getFarmerGreeting(timeOfDay) {
  return ({
    dawn: ['Habari za alfajiri', '🌅'],
    morning: ['Habari za asubuhi', '☀️'],
    noon: ['Habari za mchana', '🌤️'],
    evening: ['Habari za jioni', '🌇'],
    night: ['Habari za usiku', '🌙'],
  })[timeOfDay];
}

const initialFarmerProfile = {
  name: 'Neema Mwangi',
  phone: '+255 712 345 678',
  phoneNumbers: [{ id: 'primary-phone', number: '+255 712 345 678' }],
  primaryPhoneId: 'primary-phone',
  email: '',
  location: 'Iringa, Tanzania',
  country: 'Tanzania',
  region: 'Iringa Region',
  city: 'Iringa',
  district: 'Iringa District',
  ward: '',
  street: '',
  nidaLast4: '',
  farm: 'Mtakuja Farm',
  farmSize: '3.5',
  crops: 'Maize, Beans, Sunflower',
  livestock: '0',
  landTenure: '',
  yearsFarming: '',
  cooperative: '',
  irrigation: '',
  certifications: '',
  latitude: '',
  longitude: '',
  bankAccounts: [],
  avatar: '',
  coverPhoto: '',
};

function getFarmerProfileStorageKey(userId) {
  return userId ? `agrinest-farmer-profile:${userId}` : 'agrinest-farmer-profile';
}

function getDefaultFarmerProfile(user = {}) {
  const region = user.region || '';
  return {
    ...initialFarmerProfile,
    name: user.name || initialFarmerProfile.name,
    email: user.email || '',
    phone: user.phone || '',
    phoneNumbers: user.phone ? [{ id: 'auth-primary-phone', number: user.phone }] : [],
    primaryPhoneId: user.phone ? 'auth-primary-phone' : '',
    region,
    location: region ? `${region}, Tanzania` : initialFarmerProfile.location,
    avatar: user.avatar_url || '',
  };
}

const LEGACY_FARMER_AVATAR_PREFIX = 'https://lh3.googleusercontent.com/aida-public/';

const tanzaniaRegions = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma',
  'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro', 'Mtwara', 'Mwanza',
  'Njombe', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe',
  'Tabora', 'Tanga', 'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West',
];

function createLocationDraft(profile) {
  return {
    country: profile.country || 'Tanzania',
    region: profile.region || '',
    city: profile.city || '',
    district: profile.district || '',
    ward: profile.ward || '',
    street: profile.street || profile.village || '',
    latitude: profile.latitude || '',
    longitude: profile.longitude || '',
  };
}

function normalizePhoneNumbers(profile) {
  const phoneNumbers = Array.isArray(profile.phoneNumbers)
    ? profile.phoneNumbers.map((entry, index) => ({
      id: entry.id || `saved-phone-${index}`,
      number: String(entry.number || '').trim(),
    })).filter((entry) => entry.number)
    : [];
  if (!phoneNumbers.length && profile.phone) {
    phoneNumbers.push({ id: 'saved-primary-phone', number: String(profile.phone).trim() });
  }
  const primaryPhoneId = phoneNumbers.some((entry) => entry.id === profile.primaryPhoneId)
    ? profile.primaryPhoneId
    : phoneNumbers[0]?.id || '';
  return { phoneNumbers, primaryPhoneId, phone: phoneNumbers.find((entry) => entry.id === primaryPhoneId)?.number || '' };
}

function resizeProfileImage(file, maxDimension) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image processing is unavailable in this browser.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/webp', 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Choose a valid image file.'));
    };
    image.src = objectUrl;
  });
}

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

const defaultChatViewer = {
  id: 'farmer-neema',
  name: initialFarmerProfile.name,
  role: 'Smallholder Farmer',
  avatar: initialFarmerProfile.avatar,
  location: initialFarmerProfile.location,
};

function readStoredFarmerProfile(userId, user = {}) {
  try {
    let saved = window.localStorage.getItem(getFarmerProfileStorageKey(userId));
    if (!saved && userId) {
      const ownerId = window.localStorage.getItem('agrinest-farmer-profile-owner');
      if (!ownerId || ownerId === userId) saved = window.localStorage.getItem('agrinest-farmer-profile');
    }
    if (!saved) return getDefaultFarmerProfile(user);
    const profile = { ...getDefaultFarmerProfile(user), ...JSON.parse(saved) };
    if (profile.avatar?.startsWith(LEGACY_FARMER_AVATAR_PREFIX)) profile.avatar = user.avatar_url || '';
    return profile;
  } catch {
    return getDefaultFarmerProfile(user);
  }
}

function loadDirectMessageThreads() {
  try {
    const threads = JSON.parse(window.localStorage.getItem('agrinest-direct-message-threads') || '[]');
    return Array.isArray(threads) ? threads.filter((thread) => Array.isArray(thread.participants) && Array.isArray(thread.messages)) : [];
  } catch {
    return [];
  }
}

function getCommunityPeople(farmerProfile, viewerProfile) {
  const farmerTrust = calculateFarmerTrust(farmerProfile);
  const people = [
    {
      id: 'farmer-neema',
      name: farmerProfile.name,
      role: 'Smallholder Farmer',
      avatar: farmerProfile.avatar,
      location: farmerProfile.location,
      summary: `${farmerProfile.farm || 'Smallholder farm'} growing ${farmerProfile.crops || 'mixed crops'}.`,
      details: [
        ['Farm', farmerProfile.farm],
        ['Area', `${farmerProfile.farmSize} acres`],
        ['Crops', farmerProfile.crops],
        ['Profile score', `${farmerTrust.score} / 1000`],
      ],
    },
    {
      id: 'student-david',
      name: 'David K.',
      role: 'Agronomy Student',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      location: 'Morogoro, Tanzania',
      summary: 'BSc Agronomy, Year 3. Interested in soil health and regenerative farming.',
      details: [['Programme', 'BSc Agronomy'], ['Year', 'Year 3'], ['Interests', 'Soil health, regenerative farming']],
    },
    {
      id: 'expert-richard',
      name: 'Dr. Richard Mgata',
      role: 'Agronomy Expert',
      avatar: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=200&q=80',
      location: 'Iringa, Tanzania',
      summary: 'Crop and soil advisor supporting smallholder farming communities.',
      details: [['Specialty', 'Crop and soil advisory'], ['Languages', 'English, Swahili']],
    },
    {
      id: 'buyer-john',
      name: 'John Mwakalinga',
      role: 'Produce Buyer',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
      location: 'Mbeya, Tanzania',
      summary: 'Sourcing consistent, traceable produce from regional farmers.',
      details: [['Interested in', 'Maize, beans, sunflower'], ['Region', 'Southern Highlands']],
    },
    {
      id: 'transporter-james',
      name: 'James Kweka',
      role: 'Transporter',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      location: 'Tanzania',
      summary: 'Moving agricultural produce between farms, markets, and collection hubs.',
      details: [['Service', 'Produce transport'], ['Coverage', 'Regional routes']],
    },
    {
      id: 'institution-kilimo',
      name: 'Kilimo Extension Office',
      role: 'Institution',
      avatar: null,
      icon: 'account_balance',
      location: 'Iringa, Tanzania',
      summary: 'Local agricultural extension and farmer support services.',
      details: [['Service', 'Extension support'], ['Region', 'Iringa']],
    },
  ];

  return people.filter((person) => person.id !== viewerProfile.id);
}

const initialJichoScans = [
  { id: 'scan-cabbage', diagnosis: 'Cabbage Looper', confidence: 0.94, farm: 'Farm A', time: '2 hours ago', image: 'https://images.unsplash.com/photo-1598030343246-eec71cb4423f?auto=format&fit=crop&w=180&q=80', severity: 'low' },
  { id: 'scan-nitrogen', diagnosis: 'Nitrogen Deficiency', confidence: 0.87, farm: 'Farm B', time: 'Yesterday', image: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=180&q=80', severity: 'medium' },
  { id: 'scan-coffee', diagnosis: 'Coffee Berry Borer', confidence: 0.91, farm: 'Highland Sector', time: 'Oct 24', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=180&q=80', severity: 'high' },
];

function useNavScrollLock(isSidebarOpen, isStandalonePage = false) {
  useEffect(() => {
    const updateBodyScroll = () => {
      const shouldLockScroll = window.innerWidth <= 980 && isSidebarOpen && !isStandalonePage;
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
  }, [isSidebarOpen, isStandalonePage]);
}

function getInitialSidebarState() {
  return typeof window === 'undefined' || window.innerWidth > 980;
}

function App() {
  const [activeTab, setActiveTab] = useState('signin');
  const [selectedCoreRole, setSelectedCoreRole] = useState('farmer');
  const [selectedRole, setSelectedRole] = useState('smallholder_farmer');
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeDashboard, setActiveDashboard] = useState('smallholder');
  const [authUser, setAuthUser] = useState(null);
  const [impersonationInfo, setImpersonationInfo] = useState(null);
  const [impersonationError, setImpersonationError] = useState('');
  const [authPinChallenge, setAuthPinChallenge] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [staffAccessMode, setStaffAccessMode] = useState(false);
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showRegistrationPasswords, setShowRegistrationPasswords] = useState(false);
  const registrationFormRef = useRef(null);

  useEffect(() => {
    clearLegacyAuthTokens();
    const query = new URLSearchParams(window.location.search);
    const googleCode = query.get('google_code');
    const googleError = query.get('auth_error');
    if (googleCode || googleError) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }

    if (googleCode) {
      setAuthBusy(true);
      api.exchangeGoogleCode(googleCode)
        .then((result) => {
          if (result.status === 'pending_approval') {
            setAuthMessage('Your Google account registration is awaiting administrator approval. You can sign in after it is approved.');
            setActiveTab('signin');
            return;
          }
          if (result.pin_required) {
            setAuthPinChallenge({ token: result.challenge_token, user: result.user });
            return;
          }
          clearLegacyAuthTokens();
          setAuthUser(result.user);
          setSelectedCoreRole(result.user.role);
          setSelectedRole(result.user.persona_id || result.user.role);
          setActiveDashboard(getPersonaDashboard(result.user.persona_id || result.user.role));
          setImpersonationInfo(null);
          setLoggedIn(true);
        })
        .catch((error) => setAuthMessage(getAuthErrorMessage(error.message)))
        .finally(() => setAuthBusy(false));
      return;
    }
    if (googleError) setAuthMessage(getAuthErrorMessage(googleError));

    api.getAuthUser()
      .then(({ user, impersonation }) => {
        setAuthUser(user);
        setActiveDashboard(getPersonaDashboard(user.persona_id || user.role));
        setImpersonationInfo(impersonation || null);
        setLoggedIn(true);
      })
      .catch(() => clearLegacyAuthTokens());
  }, []);

  const completeLogin = (user) => {
    clearLegacyAuthTokens();
    setAuthPinChallenge(null);
    setAuthUser(user);
    setSelectedCoreRole(user.role);
    setSelectedRole(user.persona_id || user.role);
    setActiveDashboard(getPersonaDashboard(user.persona_id || user.role));
    setImpersonationInfo(null);
    setImpersonationError('');
    setLoggedIn(true);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.loginUser({
        identifier: form.get('identifier'),
        password: form.get('password'),
        staff_access: staffAccessMode,
        remember_me: form.get('remember') === 'on',
      });
      if (result.pin_required) {
        setAuthPinChallenge({ token: result.challenge_token, user: result.user });
      } else {
        completeLogin(result.user);
      }
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error.message));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const personaCoreRole = coreRoleByPersonaId.get(selectedRole);
    if (password !== form.get('confirm_password')) {
      setAuthMessage('The passwords do not match.');
      setAuthBusy(false);
      return;
    }
    if (personaCoreRole !== selectedCoreRole) {
      setAuthMessage('Choose an account type that belongs to the selected core role.');
      setAuthBusy(false);
      return;
    }
    try {
      const result = await api.registerUser({
        name: form.get('name'),
        phone: form.get('phone'),
        email: form.get('email'),
        password,
        core_role: personaCoreRole,
        persona_id: selectedRole,
        invitation_token: form.get('invitation_token') || undefined,
      });
      if (result.status === 'pending_approval') {
        setAuthMessage('Registration received. Your persona requires approval before you can sign in.');
        return;
      }
      completeLogin(result.user);
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error.message));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async (registration) => {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { authorization_url: authorizationUrl } = await api.startGoogleAuth(registration);
      window.location.assign(authorizationUrl);
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error.message));
      setAuthBusy(false);
    }
  };

  const handleGoogleRegistration = () => {
    const form = registrationFormRef.current;
    if (!form) return;
    const personaCoreRole = coreRoleByPersonaId.get(selectedRole);
    if (personaCoreRole !== selectedCoreRole) {
      setAuthMessage('Choose an account type that belongs to the selected core role.');
      return;
    }
    const values = new FormData(form);
    handleGoogleSignIn({
      core_role: personaCoreRole,
      persona_id: selectedRole,
      phone: values.get('phone'),
      invitation_token: values.get('invitation_token') || undefined,
    });
  };

  const handleEndImpersonation = async () => {
    try {
      const { user } = await api.endAdminImpersonation();
      setAuthUser(user);
      setSelectedCoreRole(user.role);
      setSelectedRole(user.persona_id || user.role);
      setActiveDashboard(getPersonaDashboard(user.persona_id || user.role));
      setImpersonationInfo(null);
      setImpersonationError('');
    } catch (error) {
      console.error('Could not end the admin impersonation session:', error.message);
      setImpersonationError('Could not return to the admin session. Retry or reload the page.');
    }
  };

  const handleStartImpersonation = async (account) => {
    setImpersonationError('');
    const result = await api.startAdminImpersonation(account.user_id);
    setAuthUser(result.user);
    setActiveDashboard(getPersonaDashboard(result.user.persona_id || result.user.role));
    setImpersonationInfo(result.impersonation);
    setLoggedIn(true);
  };

  useEffect(() => {
    if (!impersonationInfo?.expires_at) return undefined;
    const delay = Math.max(0, new Date(impersonationInfo.expires_at).getTime() - Date.now());
    const timeoutId = window.setTimeout(handleEndImpersonation, delay);
    return () => window.clearTimeout(timeoutId);
  }, [impersonationInfo]);

  const handleLogout = async () => {
    if (impersonationInfo) {
      await handleEndImpersonation();
      return;
    }
    try {
      await api.logoutUser();
    } catch (error) {
      console.warn('Logout request failed; the server may still have an active session:', error.message);
    }
    clearLegacyAuthTokens();
    setAuthUser(null);
    setAuthPinChallenge(null);
    setImpersonationInfo(null);
    setImpersonationError('');
    setLoggedIn(false);
    setActiveTab('signin');
    setAuthMessage('');
  };

  const handlePinVerification = async (event) => {
    event.preventDefault();
    if (!authPinChallenge?.token) return;
    const form = new FormData(event.currentTarget);
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const result = await api.verifyPin(authPinChallenge.token, String(form.get('pin') || ''));
      completeLogin(result.user);
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error.message));
    } finally {
      setAuthBusy(false);
    }
  };

  if (loggedIn && activeDashboard === 'admin') {
    return <AdminDashboardWithSecurity user={authUser} onLogout={handleLogout} onImpersonate={handleStartImpersonation} />;
  }

  if (loggedIn && activeDashboard === 'buyer') {
    return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><BuyerDashboard user={authUser} onLogout={handleLogout} /></DashboardWithSecurity>;
  }

  if (loggedIn && activeDashboard === 'gov') {
    return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><InstitutionalDashboard user={authUser} onLogout={handleLogout} /></DashboardWithSecurity>;
  }

  if (loggedIn && activeDashboard === 'student') {
    return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><StudentDashboard onLogout={handleLogout} /></DashboardWithSecurity>;
  }

  if (loggedIn && activeDashboard === 'transporter') {
    return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><TransporterDashboard onLogout={handleLogout} /></DashboardWithSecurity>;
  }

  if (loggedIn && activeDashboard === 'bank') {
    return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><LenderDashboard user={authUser} persona={personaById.get(authUser?.persona_id)} onLogout={handleLogout} /></DashboardWithSecurity>;
  }

  if (loggedIn && ['commercial', 'coop', 'expert'].includes(activeDashboard)) {
    return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><RoleDashboard key={`${authUser?.user_id}-${authUser?.persona_id}`} role={activeDashboard} persona={personaById.get(authUser?.persona_id)} user={authUser} onLogout={handleLogout} /></DashboardWithSecurity>;
  }

  if (loggedIn) {
    if (activeDashboard === 'smallholder') return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><SmallholderDashboard user={authUser} onLogout={handleLogout} /></DashboardWithSecurity>;
    return <DashboardWithSecurity user={authUser} onLogout={handleLogout} impersonationInfo={impersonationInfo} impersonationError={impersonationError} onEndImpersonation={handleEndImpersonation}><RoleDashboard key={`${authUser?.user_id}-${authUser?.persona_id}`} role={activeDashboard} persona={personaById.get(authUser?.persona_id)} user={authUser} onLogout={handleLogout} /></DashboardWithSecurity>;
  }

  return (
    <div className="agrinest-auth-shell">
      <div className="agrinest-visual-panel">
        <div className="agrinest-brand-row">
          <img className="agrinest-logo" src="/agrinest-logo.jpg" alt="Agri-Nest — Agricultural Operating System" />
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
        <div className="agrinest-mobile-brand">
          <img className="agrinest-logo" src="/agrinest-logo.jpg" alt="Agri-Nest — Agricultural Operating System" />
        </div>
        <div className="agrinest-auth-card">
          <div className="agrinest-header-row">
            <div className="agrinest-tabs">
              <button
                type="button"
                className={activeTab === 'signin' ? 'tab-button active' : 'tab-button'}
                onClick={() => { setActiveTab('signin'); setStaffAccessMode(false); setAuthMessage(''); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={activeTab === 'register' ? 'tab-button active' : 'tab-button'}
                onClick={() => { setActiveTab('register'); setStaffAccessMode(false); setAuthMessage(''); }}
              >
                Register
              </button>
            </div>

            <button type="button" className="staff-access-button" onClick={() => {
              setActiveTab('signin');
              setStaffAccessMode(true);
              setAuthMessage('');
            }}>
              <span className="inline-icon">admin_panel_settings</span>
              Staff Access
            </button>
          </div>

          {authPinChallenge ? (
            <div className="signin-panel">
              <div className="signin-heading">
                <h2>Verify your PIN</h2>
                <p>Enter your PIN to finish signing in{authPinChallenge.user?.email ? ` to ${authPinChallenge.user.email}` : ''}.</p>
              </div>
              <form className="signin-form" onSubmit={handlePinVerification}>
                <label className="field-label"><span>6–12 digit PIN</span><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength="6" maxLength="12" autoComplete="one-time-code" required autoFocus /></label>
                {authMessage && <p className="auth-feedback" role="alert">{authMessage}</p>}
                <button type="submit" className="primary-action" disabled={authBusy}>{authBusy ? 'Verifying…' : 'Verify PIN'}</button>
                <button type="button" className="security-settings-secondary" onClick={() => { setAuthPinChallenge(null); setAuthMessage(''); }}>Cancel and sign in again</button>
              </form>
            </div>
          ) : activeTab === 'signin' ? (
            <div className="signin-panel">
            <div className="signin-heading">
              <h2>{staffAccessMode ? 'Staff Access' : 'Welcome Back'}</h2>
              <p>{staffAccessMode ? 'Sign in with your invited AGRI-NEST staff account.' : 'Sign in to access your role-based dashboard.'}</p>
            </div>

            <form className="signin-form" onSubmit={handleLogin}>
              <label className="field-label">
                <span>Phone or Email Address</span>
                <div className="input-shell">
                  <span className="input-icon">person</span>
                  <input name="identifier" type="text" autoComplete="username" required placeholder="e.g., +255... or email@example.com" />
                </div>
              </label>

              <label className="field-label">
                <div className="password-label-row">
                  <span>Password</span>
                  <button type="button" onClick={() => setAuthMessage('Password recovery is not enabled yet. Contact AGRI-NEST support to verify your account and reset access.')}>Forgot?</button>
                </div>
                <div className="input-shell">
                  <span className="input-icon">lock</span>
                  <input name="password" type={showSigninPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Enter your password" />
                  <button type="button" className="visibility-button" aria-label={showSigninPassword ? 'Hide password' : 'Show password'} aria-pressed={showSigninPassword} onClick={() => setShowSigninPassword((visible) => !visible)}>
                    {showSigninPassword ? 'visibility' : 'visibility_off'}
                  </button>
                </div>
              </label>

              <label className="remember-row">
                <input name="remember" type="checkbox" />
                <span>Keep me signed in on this device</span>
              </label>

              {authMessage && <p className="auth-feedback" role="alert">{authMessage}</p>}
              <button type="submit" className="primary-action" disabled={authBusy}>
                {authBusy ? 'Signing in...' : staffAccessMode ? 'Staff Login' : 'Secure Login'}
                <span className="arrow-forward">arrow_forward</span>
              </button>

              <p className="signin-routing-note">Your workspace opens automatically based on your account.</p>
            </form>
            <div className="auth-divider" aria-hidden="true"><span>or continue with</span></div>
            <GoogleSignInButton label="Continue with Google" onClick={() => handleGoogleSignIn()} disabled={authBusy} />
            </div>
          ) : (
            <div className="register-panel">
            <div className="signin-heading">
              <h2>Join the Nest</h2>
              <p>Create your AGRI-NEST account.</p>
            </div>

            <form ref={registrationFormRef} className="register-box" onSubmit={handleRegister}>
              <label className="persona-select-label">
                <span>Core role</span>
                <select value={selectedCoreRole} onChange={(event) => {
                  const nextCoreRole = coreRoleById.get(event.target.value);
                  const nextPersonaId = nextCoreRole?.personas.find((personaId) => personaId !== 'super_admin') || '';
                  setSelectedCoreRole(event.target.value);
                  setSelectedRole(nextPersonaId);
                  setAuthMessage('');
                }}>
                  {roleModel.coreRoles.map((coreRole) => (
                    <option key={coreRole.id} value={coreRole.id}>{coreRole.label}</option>
                  ))}
                </select>
              </label>
              <label className="persona-select-label">
                <span>Account type</span>
                <select value={selectedRole} onChange={(event) => { setSelectedRole(event.target.value); setAuthMessage(''); }}>
                  {(coreRoleById.get(selectedCoreRole)?.personas || [])
                    .filter((personaId) => personaId !== 'super_admin')
                    .map((personaId) => personaById.get(personaId))
                    .filter(Boolean)
                    .map((persona) => (
                      <option key={persona.id} value={persona.id}>{persona.label}</option>
                    ))}
                </select>
              </label>
              <div className="register-row two-up">
                <label><span>Full Name</span><input name="name" type="text" autoComplete="name" required minLength="2" maxLength="120" placeholder="Your full name" /></label>
                <label><span>Phone</span><input name="phone" type="tel" autoComplete="tel" required placeholder="+255..." /></label>
              </div>
              <label className="field-label"><span>Email Address (optional)</span><input name="email" type="email" autoComplete="email" placeholder="name@example.com" /></label>
              <div className="register-row two-up">
                <label><span>Password</span><div className="register-password-shell"><input name="password" type={showRegistrationPasswords ? 'text' : 'password'} autoComplete="new-password" required minLength="12" maxLength="128" /><button type="button" aria-label={showRegistrationPasswords ? 'Hide passwords' : 'Show passwords'} aria-pressed={showRegistrationPasswords} onClick={() => setShowRegistrationPasswords((visible) => !visible)}>{showRegistrationPasswords ? 'visibility' : 'visibility_off'}</button></div></label>
                <label><span>Confirm Password</span><div className="register-password-shell"><input name="confirm_password" type={showRegistrationPasswords ? 'text' : 'password'} autoComplete="new-password" required minLength="12" maxLength="128" /></div></label>
              </div>
              <p className="password-requirement">Use 12 to 128 characters.</p>
              {personaById.get(selectedRole)?.registration === 'invite' && <label className="field-label"><span>Invitation Token</span><input name="invitation_token" type="text" required autoComplete="one-time-code" /></label>}
              <p className="persona-registration-note">
                {personaById.get(selectedRole)?.registration === 'invite'
                  ? 'This staff persona is invitation-only.'
                  : personaById.get(selectedRole)?.registration === 'review'
                      ? 'Your account will be activated after an administrator reviews your registration.'
                      : 'You can sign in as soon as your account is created.'}
              </p>
              {authMessage && <p className="auth-feedback" role="alert">{authMessage}</p>}
              <button type="submit" className="primary-action register-submit" disabled={authBusy}>
                {authBusy ? 'Submitting...' : 'Create Account'}
                <span className="arrow-forward">arrow_forward</span>
              </button>
            </form>
            <div className="auth-divider" aria-hidden="true"><span>or create an account with</span></div>
            <GoogleSignInButton label="Sign up with Google" onClick={handleGoogleRegistration} disabled={authBusy} />
            <p className="google-registration-note">Google sign-up uses the selected account type. Some types require administrator approval or an invitation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineProfileField({ label, value, onSave, type = 'text', className = '', displayValue, secret = false, placeholder, inputMode, maxLength, editRequest = 0 }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(secret ? '' : String(value ?? ''));

  useEffect(() => setDraft(secret ? '' : String(value ?? '')), [value, secret]);
  useEffect(() => {
    if (editRequest > 0) setIsEditing(true);
  }, [editRequest]);

  const commit = () => {
    const nextValue = secret ? draft.replace(/\D/g, '') : draft.trim();
    if ((!secret && nextValue === String(value ?? '')) || (secret && !nextValue)) {
      setIsEditing(false);
      return;
    }
    if (onSave(nextValue) !== false) setIsEditing(false);
  };

  if (isEditing) {
    if (secret) {
      return (
        <div className="nida-inline-editor">
          <NidaDigitsInput value={draft} onChange={setDraft} />
          <div className="nida-inline-actions">
            <button type="button" onClick={commit}>Save NIDA</button>
            <button type="button" onClick={() => { setDraft(''); setIsEditing(false); }}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <input
        autoFocus
        aria-label={`Edit ${label}`}
        className={`profile-inline-input ${className}`}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            setDraft(secret ? '' : String(value ?? ''));
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button type="button" className={`profile-inline-value ${className}`} aria-label={`Edit ${label}`} onClick={() => {
      setDraft(secret ? '' : String(value ?? ''));
      setIsEditing(true);
    }}>
      {value ? displayValue ? displayValue(value) : value : <span className="profile-inline-placeholder">Add {label}</span>}
      <span className="material-symbols-outlined profile-inline-pencil" aria-hidden="true">edit</span>
    </button>
  );
}

function NidaDigitsInput({ value, onChange }) {
  const inputRefs = useRef([]);
  const [isVisible, setIsVisible] = useState(true);
  const groups = String(value || '').split('-').slice(0, 4);
  while (groups.length < 4) groups.push('');

  const updateGroup = (index, nextValue) => {
    const nextGroups = [...groups];
    nextGroups[index] = nextValue.replace(/\D/g, '').slice(0, 5);
    onChange(nextGroups.join('-'));
    if (nextGroups[index].length === 5 && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const pasteDigits = (event) => {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 20);
    if (!pastedDigits) return;
    event.preventDefault();
    const nextGroups = Array.from({ length: 4 }, (_, index) => pastedDigits.slice(index * 5, (index + 1) * 5));
    onChange(nextGroups.join('-'));
    inputRefs.current[Math.min(3, Math.floor((pastedDigits.length - 1) / 5))]?.focus();
  };

  return (
    <div className="nida-entry-control">
      <div className="nida-digit-groups" role="group" aria-label="NIDA number, 20 digits">
        {groups.map((group, index) => (
          <input
            key={index}
            ref={(element) => { inputRefs.current[index] = element; }}
            type={isVisible ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            value={group}
            aria-label={`NIDA digits ${index * 5 + 1} to ${index * 5 + 5}`}
            placeholder="00000"
            onChange={(event) => updateGroup(index, event.target.value)}
            onPaste={pasteDigits}
          />
        ))}
      </div>
      <button type="button" className="nida-visibility-toggle" onClick={() => setIsVisible((visible) => !visible)} aria-label={isVisible ? 'Hide NIDA digits' : 'Show NIDA digits'} title={isVisible ? 'Hide NIDA digits' : 'Show NIDA digits'}>
        <span className="material-symbols-outlined" aria-hidden="true">{isVisible ? 'visibility_off' : 'visibility'}</span>
      </button>
    </div>
  );
}

function ProfileSettingsPage({ profile, isEditing, onEditingChange, onSave, onCommunity }) {
  const [draft, setDraft] = useState({ ...profile, nidaNumber: '' });
  const [uploadError, setUploadError] = useState('');
  const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState(() => createLocationDraft(profile));
  const [locationStatus, setLocationStatus] = useState('');
  const [isFindingLocation, setIsFindingLocation] = useState(false);

  useEffect(() => {
    setDraft({ ...profile, ...normalizePhoneNumbers(profile), nidaNumber: '' });
    setUploadError('');
    setLocationDraft(createLocationDraft(profile));
  }, [profile, isEditing]);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const viewProfile = isEditing
    ? { ...draft, nidaLast4: String(draft.nidaNumber || '').replace(/\D/g, '').slice(-4) || (draft.removeNida ? '' : draft.nidaLast4) }
    : profile;
  const trust = calculateFarmerTrust(viewProfile);

  const saveInlineField = (field, value) => {
    if (field !== 'phone') return onSave({ ...profile, [field]: value });
    const phoneNumbers = profile.phoneNumbers.map((entry) => entry.id === profile.primaryPhoneId ? { ...entry, number: value } : entry);
    return onSave({ ...profile, phone: value, phoneNumbers });
  };
  const saveLocation = () => {
    const normalizedLocation = Object.fromEntries(Object.entries(locationDraft).map(([key, value]) => [key, String(value || '').trim()]));
    const displayLocation = [
      normalizedLocation.street,
      normalizedLocation.ward,
      normalizedLocation.district,
      normalizedLocation.city,
      normalizedLocation.region,
      normalizedLocation.country,
    ].filter(Boolean).join(', ');

    if (!normalizedLocation.region && !normalizedLocation.city) {
      setLocationStatus('Add at least a region or city before saving.');
      return;
    }

    if (isEditing) {
      setDraft((current) => ({ ...current, ...normalizedLocation, location: displayLocation }));
      setIsLocationEditorOpen(false);
      setLocationStatus('');
      return;
    }

    const saved = onSave({ ...profile, ...normalizedLocation, location: displayLocation });
    if (saved !== false) {
      setIsLocationEditorOpen(false);
      setLocationStatus('');
    } else {
      setLocationStatus('Could not save this location on the device.');
    }
  };

  const openLocationEditor = () => {
    setLocationDraft(createLocationDraft(isEditing ? draft : profile));
    setLocationStatus('');
    setIsLocationEditorOpen(true);
  };

  const findCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS is not available in this browser. Enter the address fields manually.');
      return;
    }

    setIsFindingLocation(true);
    setLocationStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const latitude = Number(coords.latitude.toFixed(6));
      const longitude = Number(coords.longitude.toFixed(6));
      setLocationDraft((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }));
      setLocationStatus('GPS captured. Looking up the Tanzanian address…');

      try {
        const query = new URLSearchParams({
          format: 'jsonv2',
          addressdetails: '1',
          zoom: '18',
          lat: String(latitude),
          lon: String(longitude),
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, {
          headers: { 'Accept-Language': 'en,sw' },
        });
        if (!response.ok) throw new Error('Address lookup unavailable.');
        const result = await response.json();
        const address = result.address || {};
        const city = address.city || address.town || address.village || address.municipality || '';
        const region = address.state || address.region || '';
        const district = address.county || address.district || address.state_district || '';
        const ward = address.city_district || address.suburb || address.neighbourhood || address.quarter || '';
        const street = [address.house_number, address.road || address.pedestrian || address.path].filter(Boolean).join(' ');
        setLocationDraft((current) => ({
          ...current,
          country: address.country || current.country,
          region: region || current.region,
          city: city || current.city,
          district: district || current.district,
          ward: ward || current.ward,
          street: street || current.street,
        }));
        setLocationStatus('GPS and available address fields filled. Review before saving.');
      } catch {
        setLocationStatus('GPS coordinates captured. Fill any address fields the lookup could not find.');
      } finally {
        setIsFindingLocation(false);
      }
    }, (error) => {
      setIsFindingLocation(false);
      setLocationStatus(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. Enter the address fields manually.'
        : 'Could not get a GPS fix. Enter the address fields manually.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };
  const scrollToProfileSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const saveNidaNumber = (value) => {
    const digits = String(value).replace(/\D/g, '');
    if (digits.length !== 20) {
      setUploadError('Enter all 20 NIDA digits before saving.');
      return false;
    }
    setUploadError('');
    return onSave({ ...profile, nidaLast4: digits.slice(-4) });
  };

  const addBankAccountInline = () => onSave({
    ...profile,
    bankAccounts: [...profile.bankAccounts, {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      bank: '',
      holder: profile.name,
      last4: '',
    }],
  });

  const updateBankAccountInline = (id, field, value) => onSave({
    ...profile,
    bankAccounts: profile.bankAccounts.map((account) => account.id === id
      ? { ...account, [field]: field === 'last4' ? value.replace(/\D/g, '').slice(-4) : value }
      : account),
  });

  const removeBankAccountInline = (id) => onSave({
    ...profile,
    bankAccounts: profile.bankAccounts.filter((account) => account.id !== id),
  });

  const handleImageUpload = async (event, field, maxDimension) => {
    const [file] = event.target.files || [];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Choose an image file.');
      event.target.value = '';
      return;
    }
    try {
      const imageData = await resizeProfileImage(file, maxDimension);
      if (isEditing) updateDraft(field, imageData);
      else if (!onSave({ ...profile, [field]: imageData })) setUploadError('Could not save this image on the device.');
      else setUploadError('');
    } catch (error) {
      setUploadError(error.message);
    }
    event.target.value = '';
  };

  const addBankAccount = () => updateDraft('bankAccounts', [
    ...draft.bankAccounts,
    { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, bank: '', holder: draft.name, last4: '' },
  ]);

  const updateBankAccount = (id, field, value) => updateDraft('bankAccounts', draft.bankAccounts.map((account) => (
    account.id === id ? { ...account, [field]: value } : account
  )));

  const addPhoneNumber = () => updateDraft('phoneNumbers', [
    ...draft.phoneNumbers,
    { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, number: '' },
  ]);

  const updatePhoneNumber = (id, number) => updateDraft('phoneNumbers', draft.phoneNumbers.map((entry) => (
    entry.id === id ? { ...entry, number } : entry
  )));

  const removePhoneNumber = (id) => {
    const phoneNumbers = draft.phoneNumbers.filter((entry) => entry.id !== id);
    const primaryPhoneId = draft.primaryPhoneId === id ? phoneNumbers[0]?.id || '' : draft.primaryPhoneId;
    setDraft((current) => ({ ...current, phoneNumbers, primaryPhoneId }));
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const nidaDigits = String(draft.nidaNumber || '').replace(/\D/g, '');
    if (nidaDigits && nidaDigits.length !== 20) {
      setUploadError('Enter all 20 NIDA digits before saving.');
      return;
    }
    setUploadError('');
    const nextProfile = {
      ...draft,
      nidaLast4: nidaDigits ? nidaDigits.slice(-4) : draft.removeNida ? '' : profile.nidaLast4,
      location: draft.location,
      phoneNumbers: draft.phoneNumbers.map((entry) => ({ ...entry, number: entry.number.trim() })).filter((entry) => entry.number),
      bankAccounts: draft.bankAccounts
        .map((account) => ({
          id: account.id,
          bank: account.bank.trim(),
          holder: account.holder.trim(),
          last4: String(account.last4).replace(/\D/g, '').slice(-4),
        }))
        .filter((account) => account.bank && account.holder && account.last4.length === 4),
    };
      const primaryPhone = nextProfile.phoneNumbers.find((entry) => entry.id === draft.primaryPhoneId) || nextProfile.phoneNumbers[0];
      nextProfile.primaryPhoneId = primaryPhone?.id || '';
      nextProfile.phone = primaryPhone?.number || '';
    delete nextProfile.nidaNumber;
    delete nextProfile.removeNida;
    if (!onSave(nextProfile)) {
      setUploadError('Could not save this profile on the device. Try a smaller photo or free browser storage.');
    } else {
      setUploadError('');
      onEditingChange(false);
    }
  };

  return (
    <div className={isEditing ? 'profile-page-shell is-editing' : 'profile-page-shell'}>
      <main className="profile-main-panel">
        <div className={isEditing ? 'profile-content is-editing' : 'profile-content'}>
          {isEditing && (
            <form className="profile-card profile-edit-form" onSubmit={saveProfile}>
              <div className="profile-edit-heading">
                <div>
                  <span className="profile-eyebrow">FARMER RECORD</span>
                  <h2>Edit your profile</h2>
                  <p>Update your identity, farm, and financial details.</p>
                </div>
                <span className="material-symbols-outlined profile-edit-icon">manage_accounts</span>
              </div>

              <fieldset className="profile-edit-section">
                <legend>Profile photos</legend>
                <div className="profile-photo-fields">
                  <div className="profile-photo-control">
                    <ProfileAvatar src={draft.avatar} name={draft.name} className="profile-edit-avatar" />
                    <div>
                      <strong>Profile photo</strong>
                      <label className="profile-upload-btn">
                        <span className="material-symbols-outlined">photo_camera</span>Choose photo
                        <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'avatar', 512)} />
                      </label>
                    </div>
                  </div>
                  <div className="profile-cover-control">
                    <div className="profile-cover-preview" style={draft.coverPhoto ? { backgroundImage: `url(${draft.coverPhoto})` } : undefined} />
                    <div>
                      <strong>Cover photo</strong>
                      <label className="profile-upload-btn">
                        <span className="material-symbols-outlined">image</span>Choose cover
                        <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'coverPhoto', 1600)} />
                      </label>
                    </div>
                  </div>
                </div>
                {uploadError && <p className="profile-form-error" role="alert">{uploadError}</p>}
              </fieldset>

              <fieldset className="profile-edit-section">
                <legend>Personal and identity details</legend>
                <div className="profile-edit-grid">
                  <label>Full name<input required autoComplete="name" value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="Name as shown on your NIDA card" /></label>
                  <div className="phone-number-editor profile-edit-full-width">
                    <div className="phone-number-editor-heading"><span className="profile-field-label">Phone numbers</span><small>Add another number if needed, then choose your main contact.</small></div>
                    {draft.phoneNumbers.map((entry, index) => (
                      <div className="phone-number-row" key={entry.id}>
                        <label className="phone-number-input-label">{index === 0 ? 'Phone number' : `Additional number ${index + 1}`}<input type="tel" autoComplete={index === 0 ? 'tel' : 'off'} inputMode="tel" value={entry.number} onChange={(event) => updatePhoneNumber(entry.id, event.target.value)} placeholder="+255 7XX XXX XXX" /></label>
                        <label className="phone-primary-choice"><input type="radio" name="primary-phone" checked={draft.primaryPhoneId === entry.id} onChange={() => updateDraft('primaryPhoneId', entry.id)} disabled={!entry.number.trim()} />Main</label>
                        {draft.phoneNumbers.length > 1 && <button type="button" className="profile-remove-bank" aria-label={`Remove ${index === 0 ? 'phone number' : `additional number ${index + 1}`}`} onClick={() => removePhoneNumber(entry.id)}><span className="material-symbols-outlined">delete</span></button>}
                      </div>
                    ))}
                    <button type="button" className="profile-add-bank" onClick={addPhoneNumber}><span className="material-symbols-outlined">add</span>Add phone number</button>
                  </div>
                  <label>Email address<input type="email" autoComplete="email" value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} placeholder="name@example.co.tz" /></label>
                  <div className="profile-edit-full-width nida-edit-field">
                    <span className="profile-field-label">NIDA number</span>
                    <NidaDigitsInput value={draft.nidaNumber} onChange={(value) => updateDraft('nidaNumber', value)} />
                    <small>{profile.nidaLast4 ? `Saved ending ${profile.nidaLast4}. Enter all 20 digits to replace.` : 'Enter the 20 digits shown on your NIDA card.'}</small>
                  </div>
                  <button type="button" className="profile-add-bank profile-edit-full-width" onClick={openLocationEditor}><span className="material-symbols-outlined">location_on</span>Edit address and GPS details</button>
                </div>
                {profile.nidaLast4 && <button type="button" className="profile-clear-nida" onClick={() => updateDraft('removeNida', true)}>Remove saved NIDA reference</button>}
                <p className="profile-private-note">NIDA digits are visible while entering; use the eye button to mask them. For privacy, only the last four digits are saved on this device. NIDA and phone entries are not externally verified.</p>
              </fieldset>

              <fieldset className="profile-edit-section">
                <legend>Farm and farmer details</legend>
                <div className="profile-edit-grid">
                  <label>Farm name<input value={draft.farm} onChange={(event) => updateDraft('farm', event.target.value)} placeholder="e.g. Mlimani Farm" /></label>
                  <label>Farm area (acres)<input type="number" min="0" step="0.1" value={draft.farmSize} onChange={(event) => updateDraft('farmSize', event.target.value)} placeholder="e.g. 3.5" /></label>
                  <label>Main crops<input value={draft.crops} onChange={(event) => updateDraft('crops', event.target.value)} placeholder="Maize, beans, coffee" /></label>
                  <label>Livestock head count<input type="number" min="0" step="1" value={draft.livestock} onChange={(event) => updateDraft('livestock', event.target.value)} placeholder="e.g. 12" /></label>
                  <label>Land tenure<input value={draft.landTenure} onChange={(event) => updateDraft('landTenure', event.target.value)} placeholder="Owned, leased, family land" /></label>
                  <label>Years farming<input type="number" min="0" step="1" value={draft.yearsFarming} onChange={(event) => updateDraft('yearsFarming', event.target.value)} placeholder="e.g. 8" /></label>
                  <label>Cooperative / group<input value={draft.cooperative} onChange={(event) => updateDraft('cooperative', event.target.value)} placeholder="Group or cooperative name" /></label>
                  <label>Irrigation method<input value={draft.irrigation} onChange={(event) => updateDraft('irrigation', event.target.value)} placeholder="Rain-fed, drip, sprinkler" /></label>
                  <label className="profile-edit-full-width">Training and certifications<input value={draft.certifications} onChange={(event) => updateDraft('certifications', event.target.value)} placeholder="Separate entries with commas" /></label>
                </div>
              </fieldset>

              <fieldset className="profile-edit-section">
                <legend>Bank accounts</legend>
                <p className="profile-private-note">Add the bank, account holder, and last four digits only. This is a reference, not a bank or Visa/Mastercard connection. Never enter a full card or account number here.</p>
                <div className="profile-bank-list">
                  {draft.bankAccounts.map((account) => (
                    <div className="profile-bank-row" key={account.id}>
                      <label>Bank<input required value={account.bank} onChange={(event) => updateBankAccount(account.id, 'bank', event.target.value)} placeholder="e.g. NMB, CRDB, NBC" /></label>
                      <label>Account holder<input required value={account.holder} onChange={(event) => updateBankAccount(account.id, 'holder', event.target.value)} placeholder="Name registered with the bank" /></label>
                      <label>Last four digits<input required inputMode="numeric" maxLength="4" pattern="[0-9]{4}" value={account.last4} onChange={(event) => updateBankAccount(account.id, 'last4', event.target.value.replace(/\D/g, ''))} placeholder="1234" /></label>
                      <button type="button" className="profile-remove-bank" aria-label="Remove bank account" onClick={() => updateDraft('bankAccounts', draft.bankAccounts.filter((entry) => entry.id !== account.id))}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="profile-add-bank" onClick={addBankAccount}><span className="material-symbols-outlined">add</span>Add bank account</button>
              </fieldset>

              <section className="profile-score-preview" aria-live="polite">
                <div className="profile-score-preview-heading">
                  <div><strong>Profile trust score</strong><small>Updates as you complete your farmer record</small></div>
                  <strong>{trust.score}<small> / 1000 · {trust.tier}</small></strong>
                </div>
                <div className="profile-score-factors">
                  {trust.categories.map((category) => <span key={category.key}>{category.label}: <strong>{category.percent}%</strong></span>)}
                </div>
                <p>Completeness indicator only. It is not a credit rating or external identity/bank verification.</p>
              </section>

              <div className="profile-edit-actions">
                <button type="button" className="profile-cancel-btn" onClick={() => onEditingChange(false)}>Cancel</button>
                <button type="submit" className="profile-save-btn"><span className="material-symbols-outlined">save</span>Save changes</button>
              </div>
            </form>
          )}
          {isLocationEditorOpen && (
            <div className="location-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsLocationEditorOpen(false); }}>
              <section className="location-editor" role="dialog" aria-modal="true" aria-labelledby="location-editor-title">
                <div className="location-editor-heading">
                  <div>
                    <span className="profile-eyebrow">FARMER LOCATION</span>
                    <h2 id="location-editor-title">Edit location</h2>
                    <p>Use GPS to fill nearby address details, or enter them manually.</p>
                  </div>
                  <button type="button" className="location-editor-close" aria-label="Close location editor" onClick={() => setIsLocationEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
                </div>
                <button type="button" className="location-gps-button" onClick={findCurrentLocation} disabled={isFindingLocation}>
                  <span className="material-symbols-outlined">my_location</span>{isFindingLocation ? 'Finding location…' : 'Use current GPS location'}
                </button>
                <div className="location-edit-grid">
                  <label>Country<input value={locationDraft.country} onChange={(event) => setLocationDraft((current) => ({ ...current, country: event.target.value }))} placeholder="Tanzania" /></label>
                  <label>Region<input list="tanzania-region-options" value={locationDraft.region} onChange={(event) => setLocationDraft((current) => ({ ...current, region: event.target.value }))} placeholder="Select or type a region" /><datalist id="tanzania-region-options">{tanzaniaRegions.map((region) => <option value={`${region}${region.endsWith('Region') ? '' : ' Region'}`} key={region} />)}</datalist></label>
                  <label>City / town<input value={locationDraft.city} onChange={(event) => setLocationDraft((current) => ({ ...current, city: event.target.value }))} placeholder="e.g. Iringa" /></label>
                  <label>District / council<input value={locationDraft.district} onChange={(event) => setLocationDraft((current) => ({ ...current, district: event.target.value }))} placeholder="e.g. Iringa Municipal Council" /></label>
                  <label>Ward / kata<input value={locationDraft.ward} onChange={(event) => setLocationDraft((current) => ({ ...current, ward: event.target.value }))} placeholder="Enter ward name" /></label>
                  <label>Street / village<input value={locationDraft.street} onChange={(event) => setLocationDraft((current) => ({ ...current, street: event.target.value }))} placeholder="Street, village, or hamlet" /></label>
                  <label>GPS latitude<input type="number" min="-90" max="90" step="any" value={locationDraft.latitude} onChange={(event) => setLocationDraft((current) => ({ ...current, latitude: event.target.value }))} placeholder="e.g. -7.770000" /></label>
                  <label>GPS longitude<input type="number" min="-180" max="180" step="any" value={locationDraft.longitude} onChange={(event) => setLocationDraft((current) => ({ ...current, longitude: event.target.value }))} placeholder="e.g. 35.690000" /></label>
                </div>
                {locationStatus && <p className="location-editor-status" role="status">{locationStatus}</p>}
                <div className="location-editor-actions">
                  <button type="button" className="profile-cancel-btn" onClick={() => setIsLocationEditorOpen(false)}>Cancel</button>
                  <button type="button" className="profile-save-btn" onClick={saveLocation}><span className="material-symbols-outlined">save</span>Save location</button>
                </div>
              </section>
            </div>
          )}
          <section className="profile-hero-card" id="profile-overview">
            <div className="profile-cover-stage">
              <div className="profile-cover-art" style={viewProfile.coverPhoto ? { backgroundImage: `linear-gradient(135deg, rgba(31, 47, 38, 0.18), rgba(168, 110, 71, 0.08)), url(${viewProfile.coverPhoto})` } : undefined} />
              <label className="profile-cover-edit" aria-label="Replace cover photo" title="Replace cover photo">
                <span className="material-symbols-outlined">photo_camera</span>
                <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'coverPhoto', 1600)} />
              </label>
            </div>
            <div className="profile-identity-block">
              <div className="profile-avatar-large-wrap">
                <label className="profile-avatar-edit" aria-label="Replace profile photo" title="Replace profile photo">
                  <img alt={`${viewProfile.name} profile`} src={viewProfile.avatar} />
                  <span className="material-symbols-outlined">photo_camera</span>
                  <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'avatar', 512)} />
                </label>
              </div>

              <div className="profile-hero-copy">
                <h1><InlineProfileField label="full name" value={viewProfile.name} onSave={(value) => saveInlineField('name', value)} className="profile-inline-name" /></h1>
                <div className="profile-location-row">
                  <span className="material-symbols-outlined">location_on</span>
                  <button type="button" className="profile-location-edit-button" onClick={openLocationEditor} aria-label="Edit farmer location">{viewProfile.location}<span className="material-symbols-outlined" aria-hidden="true">edit</span></button>
                </div>
                <div className="profile-badges-row">
                  <button type="button" className="profile-status-chip" onClick={() => scrollToProfileSection('profile-records')}>
                    <span className="material-symbols-outlined">badge</span>{viewProfile.nidaLast4 ? `NIDA ending ${viewProfile.nidaLast4} · pending` : 'NIDA not added'}
                  </button>
                  <button type="button" className="profile-status-chip" aria-label="Edit location from status" title="Edit location" onClick={openLocationEditor}>
                    <span className="material-symbols-outlined">location_on</span>{viewProfile.latitude && viewProfile.longitude ? 'GPS mapped' : 'Location recorded'}
                  </button>
                </div>
                <div className="profile-contact-row">
                  <span><span className="material-symbols-outlined">call</span><InlineProfileField label="phone number" value={viewProfile.phone} onSave={(value) => saveInlineField('phone', value)} className="profile-inline-contact" /></span>
                  <span><span className="material-symbols-outlined">mail</span><InlineProfileField label="email address" value={viewProfile.email} onSave={(value) => saveInlineField('email', value)} className="profile-inline-contact" /></span>
                </div>
              </div>

              <div className="profile-hero-actions">
                <button type="button" className="profile-edit-details-btn" onClick={() => onEditingChange(true)}><span className="material-symbols-outlined">edit</span>Edit details</button>
                <button type="button" className="profile-message-btn" onClick={onCommunity}>Message</button>
              </div>
            </div>
          </section>
          {uploadError && <p className="profile-form-error" role="alert">{uploadError}</p>}

          <div className="profile-main-grid">
            <section className="profile-card profile-trust-card" id="profile-trust">
              <div className="profile-card-header">
                <span className="material-symbols-outlined">workspace_premium</span>
                <h3>Trust Score</h3>
              </div>

              <div className="profile-trust-body">
                <div className="trust-ring-wrap">
                  <svg viewBox="0 0 36 36" aria-hidden="true">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e7ddd8" strokeWidth="4" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#b96543" strokeWidth="4" strokeDasharray={`${trust.score / 10}, 100`} />
                  </svg>
                  <div className="trust-ring-value">
                    <strong>{trust.score}</strong>
                    <span>{trust.tier}</span>
                  </div>
                </div>

                <div className="trust-metrics">
                  {trust.categories.map((category, index) => (
                    <div className="trust-metric-row" key={category.key}>
                      <div className="trust-metric-head"><span>{category.label}</span><strong>{category.percent}%</strong></div>
                      <div className={`trust-meter trust-tone-${index}`}><span style={{ width: `${category.percent}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="trust-score-disclaimer">Profile completeness estimate from the details provided. NIDA, phone, and bank details are not externally verified.</p>
            </section>

            <aside className="profile-card profile-sidebar-card" id="profile-farm">
              <div className="profile-card-header profile-card-heading-row">
                <span className="material-symbols-outlined">agriculture</span>
                <h3>Farm Overview</h3>
              </div>

              <div className="farm-area-panel">
                <span>Farm name</span>
                <InlineProfileField label="farm name" value={viewProfile.farm} onSave={(value) => saveInlineField('farm', value)} className="profile-inline-farm" />
              </div>
              <div className="farm-area-panel">
                <span>Total Area</span>
                <strong><InlineProfileField label="farm area in acres" value={viewProfile.farmSize} type="number" onSave={(value) => saveInlineField('farmSize', value)} className="profile-inline-number" /> Acres</strong>
              </div>

              <div className="farm-crops-row">
                <span>Main Crops</span>
                <div className="crop-pills">
                  <InlineProfileField
                    label="main crops"
                    value={viewProfile.crops}
                    onSave={(value) => saveInlineField('crops', value)}
                    className="profile-inline-crops"
                    displayValue={(value) => String(value || '').split(',').map((crop) => crop.trim()).filter(Boolean).map((crop, index) => (
                      <span key={crop} className={`crop-pill crop-tone-${index % 3}`}>{crop}</span>
                    ))}
                  />
                </div>
              </div>

              <div className="farm-livestock-row">
                <span className="material-symbols-outlined">cruelty_free</span>
                <span>Livestock Head Count</span>
                <strong><InlineProfileField label="livestock head count" value={viewProfile.livestock} type="number" onSave={(value) => saveInlineField('livestock', value)} className="profile-inline-number" /></strong>
              </div>

            </aside>
          </div>

          <div className="profile-details-grid">
            <section className="profile-card profile-farmer-details">
              <div className="profile-card-header">
                <span className="material-symbols-outlined">person_pin_circle</span>
                <h3>Farmer details</h3>
              </div>
              <dl className="farmer-detail-list">
                {[
                  ['Land tenure', 'landTenure', 'text'],
                  ['Years farming', 'yearsFarming', 'number'],
                  ['Cooperative', 'cooperative', 'text'],
                  ['Irrigation', 'irrigation', 'text'],
                  ['Training', 'certifications', 'text'],
                ].map(([label, field, type]) => (
                  <div key={field}><dt>{label}</dt><dd><InlineProfileField label={label.toLowerCase()} value={viewProfile[field]} type={type} onSave={(value) => saveInlineField(field, value)} className="profile-inline-detail" /></dd></div>
                ))}
              </dl>
            </section>

            <section className="profile-card profile-records-card" id="profile-records">
              <div className="profile-card-header">
                <span className="material-symbols-outlined">account_balance</span>
                <h3>Accounts & identity records</h3>
              </div>
              <ul className="credential-list">
                <li className="credential-item">
                  <div className="credential-left">
                    <span className="material-symbols-outlined">badge</span>
                    <div>
                      <strong>NIDA number</strong>
                      <small>{viewProfile.nidaLast4 ? `Ending ${viewProfile.nidaLast4} · Not verified` : 'Not added · external verification unavailable'}</small>
                      <InlineProfileField
                        label="NIDA number"
                        value={viewProfile.nidaLast4}
                        secret
                        type="password"
                        inputMode="numeric"
                        maxLength={24}
                        placeholder="Enter NIDA number to add or replace"
                        onSave={saveNidaNumber}
                        className="profile-inline-detail"
                        displayValue={(last4) => `NIDA ending ${last4} · Replace`}
                      />
                    </div>
                  </div>
                  {viewProfile.nidaLast4 && <button type="button" className="profile-remove-bank" aria-label="Remove NIDA reference" onClick={() => onSave({ ...profile, nidaLast4: '' })}><span className="material-symbols-outlined">delete</span></button>}
                </li>
                {viewProfile.bankAccounts.map((account) => (
                  <li key={account.id} className="credential-item">
                    <div className="credential-left">
                      <span className="material-symbols-outlined">account_balance</span>
                      <div className="credential-account-fields">
                        <strong><InlineProfileField label="bank name" value={account.bank} onSave={(value) => updateBankAccountInline(account.id, 'bank', value)} className="profile-inline-detail" /></strong>
                        <small>Account holder: <InlineProfileField label="account holder" value={account.holder} onSave={(value) => updateBankAccountInline(account.id, 'holder', value)} className="profile-inline-detail" /></small>
                        <small>Ending <InlineProfileField label="account last four digits" value={account.last4} onSave={(value) => updateBankAccountInline(account.id, 'last4', value)} inputMode="numeric" maxLength={4} className="profile-inline-detail" /> · Not verified</small>
                      </div>
                    </div>
                    <button type="button" className="profile-remove-bank" aria-label="Remove bank account" onClick={() => removeBankAccountInline(account.id)}><span className="material-symbols-outlined">delete</span></button>
                  </li>
                ))}
                {!viewProfile.nidaLast4 && !viewProfile.bankAccounts.length && <li className="profile-empty-credentials">No bank references added yet.</li>}
              </ul>
              <button type="button" className="profile-add-bank" onClick={addBankAccountInline}><span className="material-symbols-outlined">add</span>Add bank account</button>
            </section>
          </div>

          <section className="profile-card profile-activity-card" id="profile-activity">
            <div className="profile-card-header">
              <span className="material-symbols-outlined">history</span>
              <h3>Farmer activity</h3>
            </div>
            <p className="profile-empty-activity">Verified marketplace, training, and community activity will appear here when those records are connected to this account.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

const legacyFarmerRecordsKey = 'agrinest-farmer-dashboard-records';

function normalizeFarmerRecords(records = {}) {
  const collection = (value) => Array.isArray(value)
    ? value.filter((record) => record && typeof record === 'object' && !Array.isArray(record))
    : [];
  const legacyCampaigns = collection(records.requests)
    .filter((record) => record.module === 'crowdfunding')
    .map((record) => ({
      id: `legacy-${record.id || record.date || 'campaign'}`,
      title: record.title || 'Community project',
      category: 'Community',
      location: '',
      goal: Number(record.amount) || 0,
      deadline: '',
      description: record.details || '',
      organizer: '',
      createdAt: record.date || '',
      status: 'active',
      raisedAmount: 0,
      pledges: [],
    }));
  return {
    fields: collection(records.fields),
    listings: collection(records.listings),
    income: collection(records.income),
    expenses: collection(records.expenses),
    crowdfunding: collection(records.crowdfunding).length ? collection(records.crowdfunding) : legacyCampaigns,
    carbon: collection(records.carbon),
    sustainability: collection(records.sustainability),
    ndvi: collection(records.ndvi),
    irrigationLogs: collection(records.irrigationLogs),
    irrigationSettings: collection(records.irrigationSettings),
    moistureReadings: collection(records.moistureReadings),
    livestock: collection(records.livestock),
    groups: Array.isArray(records.groups) ? collection(records.groups) : [{ id: 'iringa-women-farmers', name: 'Iringa Women Farmers', region: 'Iringa' }],
    activities: collection(records.activities),
    requests: collection(records.requests),
    payroll: collection(records.payroll),
  };
}

function mergeFarmerRecords(localRecords, remoteRecords) {
  const local = normalizeFarmerRecords(localRecords);
  const remote = normalizeFarmerRecords(remoteRecords);
  return Object.fromEntries(Object.keys(local).map((key) => {
    const recordsById = new Map(remote[key].map((record, index) => [record.id || `remote-${key}-${index}`, record]));
    local[key].forEach((record, index) => recordsById.set(record.id || `local-${key}-${index}`, record));
    return [key, [...recordsById.values()]];
  }));
}

function readStoredFarmerRecords(userId) {
  try {
    const accountKey = `${legacyFarmerRecordsKey}:${userId}`;
    let serialized = window.localStorage.getItem(accountKey);
    if (!serialized && window.localStorage.getItem('agrinest-farmer-profile-owner') === userId) {
      serialized = window.localStorage.getItem(legacyFarmerRecordsKey);
    }
    return normalizeFarmerRecords(serialized ? JSON.parse(serialized) : {});
  } catch {
    return normalizeFarmerRecords();
  }
}

function SmallholderDashboard({ user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarState);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [farmerProfile, setFarmerProfile] = useState(() => {
    const saved = readStoredFarmerProfile(user?.user_id, user);
    const legacyNida = String(saved.nidaNumber || '').replace(/\D/g, '');
    const profile = {
      ...getDefaultFarmerProfile(user),
      ...saved,
      avatar: saved.avatar?.startsWith(LEGACY_FARMER_AVATAR_PREFIX) ? user?.avatar_url || '' : saved.avatar,
      nidaLast4: legacyNida ? legacyNida.slice(-4) : saved.nidaLast4 || '',
      bankAccounts: Array.isArray(saved.bankAccounts)
        ? saved.bankAccounts.map((account, index) => ({
          id: account.id || `saved-bank-${index}`,
          bank: account.bank || '',
          holder: account.holder || '',
          last4: String(account.last4 || '').replace(/\D/g, '').slice(-4),
        }))
        : [],
      ...normalizePhoneNumbers({ ...saved, phone: saved.phone || '' }),
    };
    delete profile.nidaNumber;
    return profile;
  });
  const [profileSyncStatus, setProfileSyncStatus] = useState('loading');
  const profileRevisionRef = useRef(0);
  const profileSaveQueueRef = useRef(Promise.resolve());
  const [farmerRecords, setFarmerRecords] = useState(() => readStoredFarmerRecords(user?.user_id || ''));
  const [farmRecordsSyncStatus, setFarmRecordsSyncStatus] = useState('loading');
  const [farmRecordsCanSync, setFarmRecordsCanSync] = useState(false);
  const [farmRecordsSyncTrigger, setFarmRecordsSyncTrigger] = useState(0);
  const syncedFarmRecordsRef = useRef(null);
  const [liveListingCount, setLiveListingCount] = useState(0);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLocationStatus, setWeatherLocationStatus] = useState('Finding your farm location…');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useNavScrollLock(isSidebarOpen, activeView === 'experts');

  useEffect(() => {
    let active = true;
    let activeLocation = null;
    let gpsLocationFound = false;
    let latestRequest = 0;
    const loadWeather = async (location) => {
      const requestId = ++latestRequest;
      try {
        const liveWeather = await fetchWeatherData(location);
        if (active && requestId === latestRequest) {
          setWeatherData(liveWeather);
          setWeatherLocationStatus(location.source === 'gps'
            ? `GPS location${location.accuracy ? ` · accuracy ±${location.accuracy} m` : ''}`
            : 'Using saved farm location');
        }
      } catch (error) {
        console.warn('Weather request failed:', error);
        if (active && requestId === latestRequest) {
          setWeatherLocationStatus(weatherData ? 'Showing last available forecast' : 'Weather is temporarily unavailable');
        }
      }
    };

    const useSavedLocation = async () => {
      let location = getSavedWeatherLocation(farmerProfile);
      if (!location) {
        try {
          location = await geocodeSavedWeatherLocation(farmerProfile);
        } catch (error) {
          console.warn('Saved farm location lookup failed:', error);
        }
      }
      if (active && !gpsLocationFound) {
        if (location) {
          activeLocation = location;
          await loadWeather(location);
        } else {
          activeLocation = {
            latitude: -7.77,
            longitude: 35.69,
            location: 'Iringa, Tanzania (default)',
            source: 'default',
          };
          setWeatherLocationStatus('Saved location unavailable; using Iringa fallback');
          await loadWeather(activeLocation);
        }
      }
    };

    useSavedLocation();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        gpsLocationFound = true;
        activeLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          location: 'Current GPS location',
          source: 'gps',
          accuracy: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null,
        };
        if (active) loadWeather(activeLocation);
      }, () => {
        if (active && !activeLocation) useSavedLocation();
      }, { enableHighAccuracy: true, maximumAge: 15 * 60 * 1000, timeout: 12000 });
    }

    const intervalId = window.setInterval(() => {
      if (activeLocation) loadWeather(activeLocation);
    }, 5 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [farmerProfile.latitude, farmerProfile.longitude, farmerProfile.city, farmerProfile.district, farmerProfile.region, farmerProfile.location]);

  useEffect(() => {
    let active = true;
    const initialRevision = profileRevisionRef.current;
    setProfileSyncStatus('loading');
    api.getFarmerProfile().then(async ({ profile: remoteProfile, has_saved_profile: hasSavedProfile }) => {
      if (!active || profileRevisionRef.current !== initialRevision) return;
      const storageKey = getFarmerProfileStorageKey(user.user_id);
      let localProfile = window.localStorage.getItem(storageKey);
      let isLegacyProfile = false;
      if (!localProfile) {
        const ownerId = window.localStorage.getItem('agrinest-farmer-profile-owner');
        if (!ownerId || ownerId === user.user_id) {
          localProfile = window.localStorage.getItem('agrinest-farmer-profile');
          isLegacyProfile = Boolean(localProfile);
          if (localProfile) window.localStorage.setItem('agrinest-farmer-profile-owner', user.user_id);
        }
      }
      let nextProfile = hasSavedProfile
        ? { ...getDefaultFarmerProfile(user), ...remoteProfile }
        : localProfile
          ? { ...getDefaultFarmerProfile(user), ...JSON.parse(localProfile) }
          : { ...getDefaultFarmerProfile(user), ...remoteProfile };
      if (nextProfile.avatar?.startsWith(LEGACY_FARMER_AVATAR_PREFIX)) nextProfile.avatar = user.avatar_url || '';
      nextProfile = { ...nextProfile, ...normalizePhoneNumbers({ ...nextProfile, phone: nextProfile.phone || '' }) };
      delete nextProfile.nidaNumber;
      if (active) {
        const remoteFarmRecords = remoteProfile?.farmRecords;
        if (remoteFarmRecords && typeof remoteFarmRecords === 'object' && !Array.isArray(remoteFarmRecords)) {
          syncedFarmRecordsRef.current = normalizeFarmerRecords(remoteFarmRecords);
          setFarmerRecords((current) => mergeFarmerRecords(current, remoteFarmRecords));
        } else {
          syncedFarmRecordsRef.current = null;
        }
        setFarmRecordsSyncStatus('pending');
        setFarmRecordsCanSync(true);
        setFarmRecordsSyncTrigger((current) => current + 1);
        setFarmerProfile(nextProfile);
        window.localStorage.setItem(storageKey, JSON.stringify(nextProfile));
        setProfileSyncStatus(hasSavedProfile ? 'synced' : localProfile ? 'syncing' : 'ready');
      }
      if (!hasSavedProfile && localProfile) {
        try {
          await api.saveFarmerProfile(nextProfile);
          if (active) setProfileSyncStatus('synced');
        } catch (error) {
          console.error('Could not sync the saved farmer profile:', error.message);
          if (active) setProfileSyncStatus('local');
        }
      } else if (isLegacyProfile && active) {
        window.localStorage.setItem('agrinest-farmer-profile-owner', user.user_id);
      }
    }).catch((error) => {
      console.error('Could not load the farmer profile from the account:', error.message);
      if (active) {
        setProfileSyncStatus('local');
        setFarmRecordsSyncStatus('pending');
        setFarmRecordsCanSync(true);
        setFarmRecordsSyncTrigger((current) => current + 1);
      }
    });
    return () => { active = false; };
  }, [user.user_id, user.name, user.email, user.phone, user.avatar_url, user.region]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const saveFarmerProfile = (nextProfile, { onSyncResult } = {}) => {
    const profileToSave = { ...nextProfile };
    delete profileToSave.nidaNumber;
    try {
      const serialized = JSON.stringify(profileToSave);
      window.localStorage.setItem(getFarmerProfileStorageKey(user.user_id), serialized);
      const ownerId = window.localStorage.getItem('agrinest-farmer-profile-owner');
      if (!ownerId || ownerId === user.user_id) {
        window.localStorage.setItem('agrinest-farmer-profile-owner', user.user_id);
        window.localStorage.setItem('agrinest-farmer-profile', serialized);
      }
    } catch (error) {
      onSyncResult?.(false, error);
      return false;
    }
    setFarmerProfile(profileToSave);
    const revision = ++profileRevisionRef.current;
    setProfileSyncStatus('syncing');
    profileSaveQueueRef.current = profileSaveQueueRef.current.catch(() => {}).then(async () => {
      await api.saveFarmerProfile(profileToSave);
      if (profileRevisionRef.current === revision) setProfileSyncStatus('synced');
      onSyncResult?.(true);
    }).catch((error) => {
      console.error('Could not sync the farmer profile to the account:', error.message);
      if (profileRevisionRef.current === revision) setProfileSyncStatus('local');
      onSyncResult?.(false, error);
    });
    return true;
  };

  const updateFarmerRecords = (key, nextRecords) => {
    setFarmerRecords((current) => ({ ...current, [key]: nextRecords }));
    setFarmRecordsSyncStatus(navigator.onLine ? 'pending' : 'offline');
  };

  const farmerNavigationViews = {
    Dashboard: 'dashboard', 'Farm Profile': 'production', 'Digital Farm': 'fields', 'Harvest Prediction': 'harvest-prediction', 'Kadiria Maji': 'irrigation', 'Jicho AI': 'jicho', Livestock: 'livestock', 'Spray Diary': 'spray-diary',
    'Hesabu Yangu': 'income', 'Smart Loans': 'smart-loan', 'Loan Spending': 'loan-spending', Marketplace: 'marketplace', 'Feed Procurement': 'procurement', Transport: 'transport', 'Agrishop Network': 'agrishop',
    Experts: 'experts', Groups: 'groups', 'Community & Learning Portal': 'community-learning', 'Wanafunzi Hub': 'training', 'Community Chat': 'community',
    Insurance: 'insurance', 'Payroll & Labour': 'payroll', 'Ramani — Maps': 'ramani', 'Habari — Market News': 'market-news',
    Analytics: 'analytics', 'Farmer Forum': 'farmer-forum', 'Traceability & QR': 'traceability', 'Compliance & Export': 'compliance',
    'Farm ERP': 'farm-erp', 'Rentals & Labour': 'labour', 'Kupanga Nafasi': 'rent-space', 'Rent Space / Land': 'rent-space', 'Hire / Find Work': 'labour',
    'Rent Equipment': 'agrishop', 'Waste Exchange': 'waste', 'Carbon Credits': 'carbon', Sustainability: 'sustainability', Crowdfunding: 'crowdfunding',
    'AGRI-NEST Foundation': 'foundation',
  };
  const farmerActionViews = {
    'Sell Produce': 'marketplace', 'Scan Crop': 'jicho', 'Get Expert': 'experts',
    'Book Transport': 'transport', 'Log Activity': 'activity', 'Rent Space': 'rent-space', 'Hire Labour': 'labour',
    'Sell Waste': 'waste', 'Get Insurance': 'insurance', 'Apply Loan': 'smart-loan', 'Smart Loan': 'smart-loan',
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(`agrinest-farmer-dashboard-records:${user.user_id}`, JSON.stringify(farmerRecords));
    } catch {
      setStatus('Could not save dashboard records in this browser.');
    }
  }, [farmerRecords, user.user_id]);

  useEffect(() => {
    if (!farmRecordsCanSync) return;
    if (!navigator.onLine) {
      setFarmRecordsSyncStatus('offline');
      return;
    }

    const recordsSnapshot = normalizeFarmerRecords(farmerRecords);
    if (JSON.stringify(syncedFarmRecordsRef.current) === JSON.stringify(recordsSnapshot)) {
      setFarmRecordsSyncStatus('synced');
      return;
    }

    setFarmRecordsSyncStatus('syncing');
    saveFarmerProfile({ ...farmerProfile, farmRecords: recordsSnapshot }, {
      onSyncResult: (succeeded) => {
        if (succeeded) {
          syncedFarmRecordsRef.current = recordsSnapshot;
          setFarmRecordsSyncStatus('synced');
        } else {
          setFarmRecordsSyncStatus(navigator.onLine ? 'pending' : 'offline');
        }
      },
    });
  }, [farmerRecords, farmRecordsCanSync, farmRecordsSyncTrigger]);

  useEffect(() => {
    const onOnline = () => {
      setFarmRecordsSyncStatus('pending');
      setFarmRecordsSyncTrigger((current) => current + 1);
    };
    const onOffline = () => setFarmRecordsSyncStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    api.getListings().then((result) => {
      if (!isCurrent) return;
      const sellerListings = (Array.isArray(result.items) ? result.items : []).filter((listing) => listing.seller_name === farmerProfile.name);
      setLiveListingCount(sellerListings.length);
    }).catch(() => {});
    return () => { isCurrent = false; };
  }, [activeView, farmerProfile.name]);

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
        { label: 'Farm Profile', icon: 'eco' },
        { label: 'Digital Farm', icon: 'agriculture' },
        { label: 'Harvest Prediction', icon: 'event_upcoming' },
        { label: 'Kadiria Maji', icon: 'water_drop' },
        { label: 'Jicho AI', icon: 'psychology' },
        { label: 'Livestock', icon: 'pets' },
        { label: 'Spray Diary', icon: 'event_note' },
        { label: 'Hesabu Yangu', icon: 'calculate' },
        { label: 'Marketplace', icon: 'shopping_cart' },
        { label: 'Feed Procurement', icon: 'request_quote' },
        { label: 'Transport', icon: 'local_shipping' },
        { label: 'Agrishop Network', icon: 'storefront' },
        { label: 'Experts', icon: 'person_search' },
        { label: 'Groups', icon: 'groups' },
      ],
    },
    {
      heading: 'Learning & Training',
      items: [
        { label: 'Community & Learning Portal', icon: 'school' },
        { label: 'Wanafunzi Hub', icon: 'school' },
        { label: 'Community Chat', icon: 'forum' },
      ],
    },
    {
      heading: 'Finance Hub',
      items: [
        { label: 'Smart Loans', icon: 'payments' },
        { label: 'Loan Spending', icon: 'savings' },
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
        { label: 'Kupanga Nafasi', icon: 'landscape' },
        { label: 'Hire / Find Work', icon: 'work' },
        { label: 'Rent Equipment', icon: 'agriculture' },
        { label: 'Waste Exchange', icon: 'recycling' },
      ],
    },
    {
      heading: 'Green & Impact',
      items: [
        { label: 'Sustainability', icon: 'eco' },
        { label: 'Carbon Credits', icon: 'eco' },
        { label: 'Crowdfunding', icon: 'volunteer_activism' },
        { label: 'AGRI-NEST Foundation', icon: 'groups_2' },
      ],
    },
  ];

  const timeOfDay = getFarmerTimeOfDay(currentTime);
  const [greeting, greetingSymbol] = getFarmerGreeting(timeOfDay);
  const weatherCondition = weatherData?.current.conditions.toLowerCase() || '';
  const weatherEffect = weatherCondition.includes('thunder')
    ? 'storm'
    : weatherCondition.includes('rain') || weatherCondition.includes('drizzle')
      ? 'rain'
      : weatherCondition.includes('cloud') || weatherCondition.includes('fog')
        ? 'cloud'
        : 'clear';
  const localClock = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (activeView === 'experts') {
    return <ExpertBookingWorkspace
      user={user}
      records={farmerRecords}
      onRecordsChange={updateFarmerRecords}
      onBack={() => setActiveView('dashboard')}
      onNavigate={setActiveView}
    />;
  }

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
                const destination = farmerNavigationViews[item.label] || 'dashboard';
                const isActive = activeView === destination;
                return (
                <a
                  key={item.label}
                  className={isActive ? 'nav-item active' : 'nav-item'}
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveView(destination);
                    if (window.innerWidth <= 980) setIsSidebarOpen(false);
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
            {farmerProfile.name}
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
            {activeView === 'income' && <h2 className="topbar-page-title">Hesabu Yangu</h2>}
            {activeView === 'community-learning' && <h2 className="topbar-page-title">Community &amp; Learning Portal</h2>}
            {activeView === 'community' && <h2 className="topbar-page-title">Community Chat</h2>}
            {activeView === 'jicho' && <h2 className="topbar-page-title">Jicho AI</h2>}
            {activeView === 'marketplace' && <h2 className="topbar-page-title">Soko Marketplace</h2>}
            {activeView === 'market-news' && <h2 className="topbar-page-title">Habari Intelligence</h2>}
            {activeView === 'ramani' && <h2 className="topbar-page-title">Ramani GIS</h2>}
            {activeView === 'groups' && <h2 className="topbar-page-title">Vikundi — Farmer Groups</h2>}
            {activeView === 'smart-loan' && <h2 className="topbar-page-title">Smart Loan Application</h2>}
            {activeView === 'rent-space' && <h2 className="topbar-page-title">Kupanga Nafasi</h2>}
            <div className="search-shell">
              <span className="material-symbols-outlined">search</span>
              <input type="search" value={marketplaceSearch} onChange={(event) => setMarketplaceSearch(event.target.value)} placeholder={activeView === 'income' ? 'Search finance records...' : activeView === 'marketplace' ? 'Search livestock, products, or regions...' : activeView === 'agrishop' ? 'Search inputs, shops, dealers...' : activeView === 'market-news' ? 'Search crop, region, or news...' : activeView === 'ramani' ? 'Search parcels or coordinates...' : activeView === 'jicho' ? 'Search fields, crops, soils...' : activeView === 'livestock' ? 'Search animal IDs, breeds, species...' : activeView === 'rent-space' ? 'Search spaces...' : 'Search...'} aria-label={activeView === 'income' ? 'Search finance records' : activeView === 'marketplace' ? 'Search marketplace livestock, products, or regions' : activeView === 'agrishop' ? 'Search Agrishop inputs, shops, or dealers' : activeView === 'market-news' ? 'Search crops, regions, or news stories' : activeView === 'ramani' ? 'Search map coordinates or locations' : activeView === 'jicho' ? 'Search fields, crops, or soils' : activeView === 'livestock' ? 'Search livestock register' : activeView === 'rent-space' ? 'Search rental spaces' : 'Search AGRI-NEST'} />
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
              <ProfileAvatar src={farmerProfile.avatar} name={farmerProfile.name} className="topbar-profile-avatar" />
            </button>

            {isProfileMenuOpen && (
              <div className="profile-menu" role="dialog" aria-label="Profile details" onClick={() => {
                setActiveView('profile');
                setIsProfileMenuOpen(false);
              }}>
                <div className="profile-menu-header">
                  <div className="user-avatar-wrap large">
                    <ProfileAvatar src={farmerProfile.avatar} name={farmerProfile.name} className="topbar-profile-avatar" />
                  </div>
                  <div>
                    <div className="profile-menu-name">{farmerProfile.name}</div>
                    <div className="profile-menu-role">Smallholder Farmer</div>
                    <div className={`profile-sync-status profile-sync-${profileSyncStatus}`} role="status" aria-live="polite">
                      {profileSyncStatus === 'synced' ? 'Profile synced'
                        : profileSyncStatus === 'syncing' ? 'Syncing profile…'
                          : profileSyncStatus === 'loading' ? 'Loading profile…'
                            : profileSyncStatus === 'ready' ? 'Profile ready to sync'
                              : 'Saved on this device; sync unavailable'}
                    </div>
                  </div>
                </div>

                <div className="profile-menu-details">
                  <div>
                    <span>Phone</span>
                    <strong>{farmerProfile.phone}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>{farmerProfile.location}</strong>
                  </div>
                  <div>
                    <span>Farm</span>
                    <strong>{farmerProfile.farm}</strong>
                  </div>
                </div>

                <div className="profile-menu-actions">
                  <button
                    type="button"
                    className="profile-edit-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveView('profile');
                      setIsProfileEditing(true);
                      setIsProfileMenuOpen(false);
                    }}
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    className="profile-logout-btn"
                    onClick={(event) => {
                      event.stopPropagation();
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

        {activeView === 'profile' ? (
          <ProfileSettingsPage
            profile={farmerProfile}
            isEditing={isProfileEditing}
            onEditingChange={setIsProfileEditing}
            onSave={saveFarmerProfile}
            onCommunity={() => setActiveView('community')}
          />
        ) : activeView === 'notifications' ? (
          <NotificationCenter
            notifications={notifications}
            onNotificationsChange={setNotifications}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        ) : activeView === 'community-learning' ? (
          <CommunityLearningPortal
            profile={farmerProfile}
            records={farmerRecords}
            onRecordsChange={updateFarmerRecords}
            onNavigate={setActiveView}
          />
        ) : activeView === 'community' ? (
          <CommunityChat
            onBackToDashboard={() => setActiveView('dashboard')}
            viewerProfile={{ id: 'farmer-neema', name: farmerProfile.name, role: 'Smallholder Farmer', avatar: farmerProfile.avatar, location: farmerProfile.location }}
            farmerProfile={farmerProfile}
          />
        ) : activeView === 'jicho' ? (
          <JichoDiagnostic
            onBackToDashboard={() => setActiveView('dashboard')}
            onNavigate={setActiveView}
            profile={farmerProfile}
            records={farmerRecords}
            onRecordsChange={updateFarmerRecords}
            search={marketplaceSearch}
            onSearch={setMarketplaceSearch}
            onMap={() => {
              setMarketplaceSearch('');
              setActiveView('ramani');
            }}
            onMarketplace={(search) => {
              setMarketplaceSearch(search);
              setActiveView(search ? 'marketplace' : 'agrishop');
            }}
            onExpert={() => setActiveView('experts')}
          />
        ) : activeView === 'marketplace' ? (
          <MarketplacePage profile={farmerProfile} user={user} search={marketplaceSearch} onSearch={setMarketplaceSearch} onTransport={() => setActiveView('transport')} records={farmerRecords} onRecordsChange={updateFarmerRecords} />
        ) : activeView === 'procurement' ? (
          <ProcurementWorkspace user={user} profile={farmerProfile} />
        ) : activeView === 'ramani' ? (
          <RamaniMapPage profile={farmerProfile} search={marketplaceSearch} onSearch={setMarketplaceSearch} />
        ) : activeView === 'dashboard' ? (
        <main className="content-area">
          <section className="welcome-block">
            <div className="welcome-panel" data-time-of-day={timeOfDay} data-weather={weatherEffect}>
              <div className="welcome-glow glow-one" />
              <div className="welcome-glow glow-two" />
              <div className="welcome-weather-overlay" aria-hidden="true">{weatherData?.current.symbol || greetingSymbol}</div>
              <div className="welcome-inner">
                <h2>{greeting}, {farmerProfile.name || 'Mkulima'}! {greetingSymbol}</h2>
                <p>{timeOfDay === 'night'
                  ? 'Usiku mwema. Review your farm updates and plan for tomorrow.'
                  : timeOfDay === 'evening'
                    ? "Your evening farm summary is ready. Review today's activities."
                    : timeOfDay === 'noon'
                      ? 'Your midday farm update is ready. Check local weather before field work.'
                      : 'Your farm is ready for the day. Check the latest weather and field updates.'}</p>
                <div className="welcome-live-context">
                  <span>{weatherData ? `${weatherData.current.symbol} ${weatherData.current.temperature}°C · ${weatherData.current.conditions}` : 'Loading local weather…'}</span>
                  <span>{localClock} · {weatherLocationStatus}</span>
                </div>
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
              { icon: '🌾', value: farmerRecords.fields.length, label: 'Active Fields', view: 'fields' },
              { icon: '⭐', value: calculateFarmerTrust(farmerProfile).score, label: 'Trust Score', view: 'trust' },
              { icon: '🛒', value: Math.max(farmerRecords.listings.length, liveListingCount), label: 'Active Listings', view: 'listings' },
              { icon: '💰', value: `TZS ${farmerRecords.income.reduce((total, entry) => total + Number(entry.amount || 0), 0).toLocaleString('en-TZ')}`, label: 'Season Income', view: 'income' },
              { icon: '🐄', value: Number(farmerProfile.livestock || 0).toLocaleString(), label: 'Livestock Head', view: 'livestock' },
              { icon: '👥', value: farmerRecords.groups.length, label: 'My Groups', view: 'groups' },
            ].map((item) => (
              <button className="stat-card stat-card-button" key={item.label} type="button" aria-label={`${item.label}: ${item.value}. Open details`} onClick={() => setActiveView(item.view)}>
                <div className="stat-head">
                  <span>{item.icon}</span>
                </div>
                <div>
                  <p className="stat-value">{item.value}</p>
                  <p className="stat-label">{item.label}</p>
                </div>
              </button>
            ))}
          </section>

          <section className="action-row">
            {['Sell Produce', 'Scan Crop', 'Apply Loan', 'Get Expert', 'Book Transport', 'Log Activity', 'Rent Space', 'Hire Labour', 'Sell Waste', 'Get Insurance', 'Smart Loan'].map((item, index) => (
              <button key={item} className="action-pill" type="button" onClick={() => setActiveView(farmerActionViews[item])}>
                <span>{['🛒', '🔍', '🏦', '👨‍🌾', '🚛', '📸', '🏚️', '👷', '♻️', '☂️', '📊'][index]}</span>
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
                    <button type="button" onClick={() => setActiveView('jicho')}>View Jicho <span className="material-symbols-outlined">arrow_forward</span></button>
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
                {weatherData ? (
                  <>
                    <div className="weather-top">
                      <div>
                        <p>📍 {weatherData.location}</p>
                        <div className="weather-temp"><span>{weatherData.current.temperature}°</span><span className="temp-unit">C</span></div>
                        <p className="weather-clear">{weatherData.current.conditions}</p>
                        <p className="weather-location-status">{weatherLocationStatus}</p>
                      </div>
                      <span className="weather-symbol">{weatherData.current.symbol}</span>
                    </div>
                    <div className="weather-grid">
                      <div><p>Humidity</p><strong>{weatherData.current.humidity}%</strong></div>
                      <div><p>Wind</p><strong>{weatherData.current.wind}</strong></div>
                      <div><p>UV</p><strong>{weatherData.current.uv}</strong></div>
                      <div><p>Rain</p><strong>{weatherData.current.rain}</strong></div>
                    </div>
                    <div className="weather-footer"><span>🌾 Good field conditions today</span><span>{localClock} · updated {weatherData.updatedAt ? new Date(weatherData.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}</span></div>
                    <div className="forecast-row">
                      {weatherData.forecast.slice(0, 7).map((day) => (
                        <div className="forecast-day" key={`${day.day}-${day.temp}`}>
                          <p>{day.day}</p>
                          <div>{day.icon}</div>
                          <strong>{day.temp}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="weather-loading" role="status">
                    <span className="weather-symbol">🌦️</span>
                    <strong>{weatherLocationStatus.startsWith('Weather is temporarily') ? 'Weather unavailable' : 'Finding your farm weather'}</strong>
                    <span>{weatherLocationStatus}</span>
                  </div>
                )}
              </div>

              <div className="market-card">
                <div className="panel-header inline-header">
                  <h3><span className="material-symbols-outlined">monitoring</span>Live Market Prices</h3>
                  <button type="button" onClick={() => setActiveView('marketplace')}>All prices <span className="material-symbols-outlined">arrow_forward</span></button>
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
                <button type="button" className="ussd-button" onClick={() => setActiveView('ussd')}>📱 Try USSD Simulator</button>
              </div>
            </div>
          </section>
        </main>
        ) : activeView === 'smart-loan' ? (
          <SmartLoanApplication
            userId={user?.user_id}
            profile={farmerProfile}
            onBack={() => setActiveView('dashboard')}
            onOpenPlanner={() => setActiveView('loan-spending')}
          />
        ) : activeView === 'loan-spending' ? (
          <LoanSpendingPage userId={user?.user_id} onBack={() => setActiveView('dashboard')} />
        ) : activeView === 'income' ? (
          <FinanceHub
            profile={farmerProfile}
            records={farmerRecords}
            onRecordsChange={updateFarmerRecords}
            onNavigate={setActiveView}
            search={marketplaceSearch}
            syncStatus={farmRecordsSyncStatus}
          />
        ) : activeView === 'crowdfunding' ? (
          <CrowdfundingWorkspace
            profile={farmerProfile}
            campaigns={farmerRecords.crowdfunding}
            onCampaignsChange={(campaigns) => updateFarmerRecords('crowdfunding', campaigns)}
            search={marketplaceSearch}
          />
        ) : activeView === 'carbon' ? (
          <CarbonCreditsWorkspace
            profile={farmerProfile}
            records={farmerRecords.carbon}
            fields={farmerRecords.fields}
            onRecordsChange={(carbonRecords) => updateFarmerRecords('carbon', carbonRecords)}
            onNavigate={setActiveView}
          />
        ) : activeView === 'sustainability' ? (
          <SustainabilityWorkspace
            records={farmerRecords.sustainability}
            fields={farmerRecords.fields}
            carbonRecords={farmerRecords.carbon}
            activities={farmerRecords.activities}
            onRecordsChange={(sustainabilityRecords) => updateFarmerRecords('sustainability', sustainabilityRecords)}
          />
        ) : activeView === 'irrigation' ? (
          <IrrigationWorkspace
            fields={farmerRecords.fields}
            logs={farmerRecords.irrigationLogs}
            settings={farmerRecords.irrigationSettings}
            moistureReadings={farmerRecords.moistureReadings}
            weather={weatherData}
            weatherStatus={weatherLocationStatus}
            onLogsChange={(irrigationLogs) => updateFarmerRecords('irrigationLogs', irrigationLogs)}
            onSettingsChange={(irrigationSettings) => updateFarmerRecords('irrigationSettings', irrigationSettings)}
            onMoistureReadingsChange={(moistureReadings) => updateFarmerRecords('moistureReadings', moistureReadings)}
            onNavigate={setActiveView}
          />
        ) : activeView === 'groups' ? (
          <GroupsDashboard
            profile={farmerProfile}
            records={farmerRecords}
            onRecordsChange={updateFarmerRecords}
          />
        ) : (
          <FarmerWorkspace
            page={activeView}
            user={user}
            search={marketplaceSearch}
            onSearch={setMarketplaceSearch}
            profile={farmerProfile}
            records={farmerRecords}
            weather={weatherData}
            weatherStatus={weatherLocationStatus}
            farmRecordsSyncStatus={farmRecordsSyncStatus}
            onRetryFarmRecordsSync={() => {
              setFarmRecordsSyncStatus('pending');
              setFarmRecordsSyncTrigger((current) => current + 1);
            }}
            liveListingCount={liveListingCount}
            onRecordsChange={updateFarmerRecords}
            onProfileSave={saveFarmerProfile}
            onNavigate={setActiveView}
            onBack={() => setActiveView('dashboard')}
          />
        )}
      </div>
    </div>
  );
}

function JichoDiagnostic({ onBackToDashboard, onNavigate, onMarketplace, onExpert, search, onSearch, onMap, onRecordsChange, profile, records }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scans, setScans] = useState(initialJichoScans);
  const [result, setResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ndvi');
  const [expertRequested, setExpertRequested] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    api.getJichoScans().then((payload) => {
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
        {[['scan', 'document_scanner', 'AI Scan'], ['crops', 'agriculture', 'Crops'], ['soils', 'layers', 'Soils'], ['pests', 'bug_report', 'Pests & Diseases'], ['ndvi', 'sensors', 'Crops & NDVI']].map(([id, icon, label]) => (
          <button type="button" className={activeTab === id ? 'jicho-workspace-tab active' : 'jicho-workspace-tab'} key={id} onClick={() => setActiveTab(id)}>
            <span className="material-symbols-outlined">{icon}</span>{label}
          </button>
        ))}
      </div>
      {activeTab === 'crops' ? (
        <JichoGrowingGuide
          onScan={() => setActiveTab('scan')}
          onMarketplace={onMarketplace}
          onExpert={onExpert}
        />
      ) : activeTab === 'pests' ? (
        <JichoPestKnowledge
          search={search}
          onSearch={onSearch}
          onScan={() => setActiveTab('scan')}
          onMap={onMap}
        />
      ) : activeTab === 'soils' ? <JichoSoilKnowledge
        profile={profile}
        records={records}
        search={search}
        onSearch={onSearch}
        onMap={onMap}
        onExpert={onExpert}
      /> : activeTab === 'ndvi' ? <JichoNdviWorkspace
        fields={records.fields || []}
        observations={records.ndvi || []}
        profile={profile}
        search={search}
        onNavigate={(view) => {
          if (view === 'ramani') onMap();
          else onNavigate(view);
        }}
        onObservationsChange={onRecordsChange}
      /> : (
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

function JichoKnowledge({ title, icon, copy }) {
  const [opened, setOpened] = useState(false);
  return <div className="jicho-knowledge-panel"><span className="material-symbols-outlined">{icon}</span><h1>{title}</h1><p>{opened ? `The ${title.toLowerCase()} workspace is ready for your next field observation.` : copy}</p><button type="button" className="jicho-primary-button" onClick={() => setOpened((value) => !value)}>{opened ? 'Workspace Ready' : `Open ${title} workspace`}</button></div>;
}

function CommunityPublicProfile({ profile, onBack, onMessage }) {
  return (
    <div className="community-public-profile">
      <div className="community-public-profile-toolbar">
        <button type="button" className="community-profile-back" onClick={onBack}>
          <span className="material-symbols-outlined">arrow_back</span>People
        </button>
        <span className="community-profile-kicker">PUBLIC PROFILE</span>
      </div>
      <article className="community-profile-card">
        <div className="community-profile-cover" />
        <div className="community-profile-identity">
          {profile.avatar
            ? <img className="community-profile-avatar" src={profile.avatar} alt={`${profile.name} profile`} />
            : <span className="community-profile-avatar community-avatar-icon material-symbols-outlined">{profile.icon || 'person'}</span>}
          <div className="community-profile-copy">
            <h1>{profile.name}</h1>
            <p>{profile.role} · {profile.location}</p>
            <p>{profile.summary}</p>
          </div>
          <button type="button" className="community-profile-message" onClick={onMessage}>
            <span className="material-symbols-outlined">chat</span>Message
          </button>
        </div>
        {!!profile.details?.length && (
          <dl className="community-profile-details">
            {profile.details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
      </article>
      <p className="community-profile-privacy">Only public role and work details are shown here. Private identity and financial details are never shared.</p>
    </div>
  );
}

function CommunityChat({ onBackToDashboard, viewerProfile = defaultChatViewer, farmerProfile = readStoredFarmerProfile() }) {
  const [conversations, setConversations] = useState(initialChatConversations);
  const [directThreads, setDirectThreads] = useState(loadDirectMessageThreads);
  const [registeredPeople, setRegisteredPeople] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('iringa-women');
  const [searchTerm, setSearchTerm] = useState('');
  const [directoryMode, setDirectoryMode] = useState('chats');
  const [selectedPublicProfileId, setSelectedPublicProfileId] = useState(null);
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
  const samplePeople = getCommunityPeople(farmerProfile, viewerProfile);
  const sampleNames = new Set(samplePeople.map((person) => person.name.trim().toLowerCase()));
  const people = [...samplePeople, ...registeredPeople.filter((person) => (
    person.id !== viewerProfile.id && !sampleNames.has(person.name.trim().toLowerCase())
  ))];
  const directConversations = directThreads
    .filter((thread) => thread.participants.some((participant) => participant.id === viewerProfile.id))
    .map((thread) => {
      const otherParticipant = thread.participants.find((participant) => participant.id !== viewerProfile.id);
      if (!otherParticipant) return null;
      const lastMessage = thread.messages[thread.messages.length - 1];
      return {
        id: thread.id,
        name: otherParticipant.name,
        role: otherParticipant.role,
        avatar: otherParticipant.avatar,
        time: lastMessage?.time || 'New',
        preview: lastMessage?.body || lastMessage?.attachmentName || 'Start a conversation',
        messages: thread.messages.map((message) => ({
          ...message,
          author: message.senderId === viewerProfile.id ? 'You' : otherParticipant.name,
          incoming: message.senderId !== viewerProfile.id,
          avatar: message.senderId === viewerProfile.id ? undefined : otherParticipant.avatar,
        })),
        localDirect: true,
        otherParticipant,
      };
    })
    .filter(Boolean);
  const allConversations = [...directConversations, ...conversations];
  const selectedConversation = allConversations.find((conversation) => conversation.id === selectedConversationId) || allConversations[0];
  const selectedPublicProfile = people.find((person) => person.id === selectedPublicProfileId);
  const visibleConversations = allConversations.filter((conversation) => (
    `${conversation.name} ${conversation.role} ${conversation.preview}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));
  const visiblePeople = people.filter((person) => (
    `${person.name} ${person.role} ${person.location} ${person.summary}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  useEffect(() => {
    try {
      window.localStorage.setItem('agrinest-direct-message-threads', JSON.stringify(directThreads));
    } catch {
      // Keep the current session usable if browser storage is full.
    }
  }, [directThreads]);

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
    let active = true;
    api.getUsers()
      .then((payload) => {
        const publicUsers = Array.isArray(payload?.items) ? payload.items : [];
        if (!active) return;
        setRegisteredPeople(publicUsers
          .filter((user) => user.user_id && typeof user.name === 'string' && user.name.trim())
          .map((user) => {
            const role = String(user.role || 'user').toLowerCase();
            const persona = personaById.get(user.persona_id);
            const isFarmer = role === 'farmer';
            const roleLabel = persona?.label || role.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
            return {
              id: `registered-user-${user.user_id}`,
              name: user.name,
              role: roleLabel,
              avatar: user.avatar_url || null,
              icon: isFarmer ? 'agriculture' : 'person',
              location: user.region || 'Tanzania',
              summary: `${roleLabel} account on AGRI-NEST.`,
              details: [
                ...(user.region ? [['Region', user.region]] : []),
                ...(user.trust_score !== null && user.trust_score !== undefined ? [['Profile score', `${user.trust_score} / 1000`]] : []),
              ],
            };
          }));
      })
      .catch(() => {
        if (active) setRegisteredPeople([]);
      });
    return () => { active = false; };
  }, [farmerProfile.avatar]);

  useEffect(() => {
    if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [selectedConversationId, conversations, directThreads]);

  const startDirectMessage = (person) => {
    const participants = [viewerProfile, person].map(({ id, name, role, avatar, location, summary, details }) => ({
      id, name, role, avatar, location, summary, details,
    }));
    const threadId = `dm-${participants.map((participant) => participant.id).sort().join('--')}`;
    setDirectThreads((current) => current.some((thread) => thread.id === threadId)
      ? current
      : [...current, { id: threadId, participants, messages: [], updatedAt: new Date().toISOString() }]);
    setSelectedConversationId(threadId);
    setDirectoryMode('chats');
    setSelectedPublicProfileId(null);
    setSearchTerm('');
    setDraft('');
  };

  const sendMessage = () => {
    const body = draft.trim();
    const attachmentName = attachment?.name;
    if ((!body && !attachment && !location) || !selectedConversation) return;
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
    if (selectedConversation.localDirect) {
      setDirectThreads((current) => current.map((thread) => (
        thread.id === selectedConversation.id
          ? { ...thread, updatedAt: new Date().toISOString(), messages: [...thread.messages, { ...message, senderId: viewerProfile.id }] }
          : thread
      )));
    } else {
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
    }
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
          <div className="community-directory-heading"><h2>Community</h2><span>{viewerProfile.role}</span></div>
          <div className="community-search">
            <span className="material-symbols-outlined">search</span>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={directoryMode === 'chats' ? 'Search chats...' : 'Search people...'} aria-label={directoryMode === 'chats' ? 'Search chats' : 'Search people'} />
          </div>
          <div className="community-directory-tabs" role="tablist" aria-label="Community views">
            <button type="button" role="tab" aria-selected={directoryMode === 'chats'} className={directoryMode === 'chats' ? 'active' : ''} onClick={() => { setDirectoryMode('chats'); setSelectedPublicProfileId(null); }}>Chats</button>
            <button type="button" role="tab" aria-selected={directoryMode === 'people'} className={directoryMode === 'people' ? 'active' : ''} onClick={() => { setDirectoryMode('people'); setSelectedPublicProfileId(null); }}>People</button>
          </div>
          {directoryMode === 'chats' ? <div className="community-conversation-list">
            {visibleConversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={conversation.id === selectedConversation.id ? 'community-conversation active' : 'community-conversation'}
                onClick={() => { setSelectedConversationId(conversation.id); setSelectedPublicProfileId(null); }}
              >
                {conversation.avatar ? <img src={conversation.avatar} alt="" /> : <span className="community-avatar-icon material-symbols-outlined">{conversation.icon}</span>}
                <span className="community-conversation-copy">
                  <span className="community-conversation-title"><strong>{conversation.name} <small>({conversation.role})</small></strong><time>{conversation.time}</time></span>
                  <span>{conversation.preview}</span>
                </span>
              </button>
            ))}
            {!visibleConversations.length && <p className="community-empty">No conversations found.</p>}
          </div> : <div className="community-people-list">
            {visiblePeople.map((person) => (
              <button type="button" className="community-person-card" key={person.id} onClick={() => setSelectedPublicProfileId(person.id)}>
                {person.avatar ? <img src={person.avatar} alt="" /> : <span className="community-avatar-icon material-symbols-outlined">{person.icon || 'person'}</span>}
                <span className="community-person-copy"><strong>{person.name}</strong><small>{person.role}</small><small>{person.location}</small></span>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            ))}
            {!visiblePeople.length && <p className="community-empty">No people found.</p>}
          </div>}
        </section>

        <section className="community-thread">
          {selectedPublicProfile ? (
            <CommunityPublicProfile
              profile={selectedPublicProfile}
              onBack={() => setSelectedPublicProfileId(null)}
              onMessage={() => startDirectMessage(selectedPublicProfile)}
            />
          ) : (
          <>
          <header className="community-thread-header">
            <div>
              <strong>{selectedConversation.name}</strong>
              <small>{selectedConversation.role}</small>
            </div>
            {selectedConversation.localDirect && <button type="button" onClick={() => setSelectedPublicProfileId(selectedConversation.otherParticipant.id)}>View profile</button>}
          </header>
          <div className="community-security-banner">
            <span>🛡️</span>
            <p>Keep contact and payment details private. Direct messages are saved on this device in this demo.</p>
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
          </>
          )}
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

  const action = (message) => {
    const lowerMessage = message.toLowerCase();
    const destination = lowerMessage.includes('calling') ? 'trips' : lowerMessage.includes('bid') || message.includes(':') ? 'jobs' : 'route';
    const storageKey = 'agrinest-transporter-workspace-records';
    try {
      const savedRecords = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      const record = { id: `dispatch-${Date.now()}`, title: message, details: 'Follow-up saved from the fleet dashboard.', savedAt: new Date().toISOString() };
      window.localStorage.setItem(storageKey, JSON.stringify([record, ...(Array.isArray(savedRecords) ? savedRecords : [])]));
    } catch {
      setNotice('Could not save this dispatch action in the browser.');
      return;
    }
    setNotice(message);
    setActiveView(destination);
  };

  return (
    <div className="transporter-shell">
      <nav className="transporter-sidebar">
        <div className="transporter-brand"><span className="transporter-avatar">FM</span><div><strong>Fleet Dashboard</strong><small>Logistic Service Provider</small></div></div>
        <button type="button" className="transporter-post-button" onClick={() => setActiveView('availability')}>Post Availability</button>
        {[['dashboard', 'Home', 'home'], ['work_history', 'Open Jobs', 'jobs'], ['distance', 'Active Trips', 'trips'], ['local_shipping', 'Fleet Management', 'fleet'], ['account_balance_wallet', 'Earnings', 'earnings'], ['map', 'Route Intelligence', 'route'], ['forum', 'Community', 'community']].map(([icon, label, id]) => <button type="button" key={id} className={activeView === id ? 'transporter-nav-item active' : 'transporter-nav-item'} onClick={() => setActiveView(id)}><span className="material-symbols-outlined">{icon}</span>{label}</button>)}
        <div className="transporter-nav-bottom"><button type="button" className="transporter-nav-item" onClick={() => setActiveView('settings')}><span className="material-symbols-outlined">settings</span>Settings</button><button type="button" className="transporter-nav-item" onClick={onLogout}><span className="material-symbols-outlined">logout</span>Log Out</button></div>
      </nav>
      <main className="transporter-main">
        <header className="transporter-topbar"><h1>Agri-Nest Logistics</h1><div><button type="button" aria-label="Notifications" onClick={() => setActiveView('notifications')}><span className="material-symbols-outlined">notifications</span></button><button type="button" aria-label="Fleet support" onClick={() => setActiveView('support')}><span className="material-symbols-outlined">support</span></button><span className="transporter-mini-avatar">JK</span></div></header>
        {notice && <button type="button" className="transporter-notice" onClick={() => setNotice('')}>{notice}<span className="material-symbols-outlined">close</span></button>}
        {activeView === 'fleet' ? (
          <TransporterFleetWorkspace />
        ) : activeView === 'route' ? (
          <TransporterRouteWorkspace />
        ) : activeView === 'community' ? (
          <CommunityChat onBackToDashboard={() => setActiveView('home')} viewerProfile={{ id: 'transporter-james', name: 'James Kweka', role: 'Transporter', location: 'Tanzania', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' }} farmerProfile={readStoredFarmerProfile()} />
        ) : activeView === 'home' ? <>
          <section className="transporter-heading"><div><h2>Habari za asubuhi, James! 🚛</h2><p>Road conditions to Dar es Salaam are clear. You have <b>3 active bids</b> and <b>1 trip in progress</b>.</p></div></section>
          <section className="transporter-stats"><article><span className="material-symbols-outlined">account_balance_wallet</span><small>Wallet Balance</small><strong>TZS {wallet.toLocaleString()}</strong><button type="button" onClick={() => setActiveView('earnings')}>Withdraw</button></article><article><span className="material-symbols-outlined">route</span><small>Trips Done</small><strong>156</strong><p>Historical Total</p></article><article><span className="material-symbols-outlined">star</span><small>Avg Rating</small><strong>4.8 <em>★</em></strong><p className="transporter-badge">Verified Top Rated</p></article><article className="transporter-active-job"><small>Active Job</small><strong>Iringa →<br />Dar es Salaam</strong><span>Maize • In Transit</span></article></section>
          <section className="transporter-dashboard-grid"><article className="transporter-route-card"><div className="transporter-card-heading"><h3><span className="material-symbols-outlined">route</span>Active Route Overview</h3><span>ID: TRP-9284</span></div><div className="transporter-map"><div><small>DESTINATION</small><strong>Kariakoo Market</strong></div><span className="material-symbols-outlined">navigation</span></div><div className="transporter-route-details"><div><small>Status</small><strong>{tripProgress}% Complete</strong><p>ETA 2h 15m</p><span>📦 Cargo<br /><b>5,000kg Maize</b></span><span>👤 Client<br /><b>Mkulima Co-op</b></span></div><div><button type="button" onClick={() => action('Calling Mkulima Co-op...')}>☎ Contact Client</button><button type="button" onClick={() => setTripProgress((progress) => Math.min(100, progress + 10))}>↻ Update Status</button></div></div></article><aside className="transporter-right-column"><article className="transporter-jobs"><div className="transporter-card-heading"><h3>Open Jobs</h3><button type="button" onClick={() => setActiveView('jobs')}>View All</button></div>{jobs.map((job) => <div className="transporter-job" key={job.id}><div><strong>{job.route}</strong><span>{job.distance}</span></div><p>{job.cargo} • <b>👍 {job.trust} Trust</b></p><div><button type="button" onClick={() => action(`Quick bid started for ${job.route}.`)}>Quick Bid</button><button type="button" onClick={() => action(`${job.route}: ${job.cargo}`)}>Details</button></div></div>)}</article><article className="transporter-earnings"><div className="transporter-card-heading"><h3>Weekly Earnings</h3><small>This Week</small></div><div className="transporter-bars">{[30, 50, 90, 40, 60, 10, 5].map((height, index) => <i className={index === 2 ? 'peak' : ''} style={{ height: `${height}%` }} key={index} />)}</div></article><article className="transporter-alerts"><h3><span className="material-symbols-outlined">warning</span>Road Alerts</h3><button type="button" onClick={() => action('Route alert opened: heavy rain in Morogoro.')}><b>☁ Heavy rain in Morogoro</b><small>Expect 30m delays. Reported 1h ago.</small></button><button type="button" onClick={() => action('Route alert opened: weighbridge delay at Mikumi.')}><b>⚠ Weighbridge delay at Mikumi</b><small>Long queue. Reported 15m ago.</small></button></article></aside></section>
        </> : <RoleWorkspace role="transporter" page={activeView} onBack={() => setActiveView('home')} />}
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
      .then((studentDashboard) => {
        if (!studentDashboard || typeof studentDashboard.name !== 'string') {
          throw new Error('The student dashboard response is incomplete.');
        }
        setDashboard(studentDashboard);
      })
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
        {assignment && <div className="student-notice"><span>{assignment.name}</span><button type="button" onClick={submitAssignment}>Save submission</button></div>}
        {activeView === 'community' ? (
          <CommunityChat onBackToDashboard={() => setActiveView('dashboard')} viewerProfile={{ id: 'student-david', name: dashboard.name, role: 'Agronomy Student', location: 'Morogoro, Tanzania', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' }} farmerProfile={readStoredFarmerProfile()} />
        ) : activeView === 'dashboard' ? <>
          <section className="student-top-grid"><div className="student-progress-card"><h2>Academic Progress</h2><p>{dashboard.programme} - {dashboard.year}</p><div className="student-metric-grid">{[['school', dashboard.metrics.credits, 'Credits Earned'], ['workspace_premium', dashboard.metrics.certifications, 'Certifications'], ['science', dashboard.metrics.field_hours, 'Field Hours'], ['star', dashboard.metrics.trust_score, 'Trust Score']].map(([icon, value, label]) => <div key={label}><span className="material-symbols-outlined">{icon}</span><strong>{value}</strong><small>{label}</small></div>)}</div></div><div className="student-focus-card"><div><div className="student-focus-title"><h2>Current Focus</h2><span>{dashboard.focus.status}</span></div><h3>{dashboard.focus.title}</h3><p>{dashboard.focus.description}</p></div><button type="button" onClick={() => setActiveView('workspace')}>Open Workspace <span className="material-symbols-outlined">arrow_forward</span></button></div></section>
          <div className="student-content-grid"><div className="student-left-column"><section><div className="student-section-heading"><h2>Learning Path</h2><button type="button" onClick={() => setActiveView('learning-path')}>View All Courses</button></div><div className="student-course-list">{dashboard.courses.map((course) => <div className="student-course-card" key={course.id}><span className="student-course-icon material-symbols-outlined">{course.id === 'soil-science' ? 'grass' : 'water_drop'}</span><div><div className="student-course-title"><h3>{course.title}</h3><span>{course.progress}%</span></div><p>{course.module}</p><div className="student-course-track"><i style={{ width: `${course.progress}%` }} /></div></div><button type="button" onClick={() => updateProgress(course)} aria-label={`Continue ${course.title}`}><span className="material-symbols-outlined">play_arrow</span></button></div>)}</div></section><section><div className="student-section-heading"><h2>Research Hub</h2><button type="button" onClick={() => setNotice('New research paper workspace created.')}>+ New Paper</button></div><div className="student-research-grid"><article><span>Under Review</span><h3>Impact of Organic Mulching on Moisture Retention in Arid Regions</h3><p>Submitted to East African Journal of Agronomy.</p><small>◉ 12 &nbsp; ◌ 2 Peer Reviews</small></article><article><span>Draft</span><h3>Comparative Study of Local Seed Varieties vs GMO Yields</h3><p>Initial data collection phase completed.</p><small>Edited 2d ago</small></article></div></section></div><aside className="student-right-column"><section className="student-opportunities"><h2><span className="material-symbols-outlined">work</span>Opportunities</h2>{dashboard.opportunities.map((opportunity) => <article key={opportunity.id}><div><strong>{opportunity.title}</strong><p>{opportunity.organization} • {opportunity.location}</p></div><div>{opportunity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button type="button" disabled={dashboard.applications.some((item) => item.opportunity_id === opportunity.id)} onClick={() => applyNow(opportunity)}>{dashboard.applications.some((item) => item.opportunity_id === opportunity.id) ? 'Applied' : 'Apply Now'}</button></article>)}<button type="button" className="student-view-all" onClick={() => setNotice('Showing all available postings.')}>View All 14 Postings</button></section><section className="student-forum"><h2>Community Forum</h2><p>Answer questions to earn trust points.</p>{['What is the most organic way to handle aphids on young tomato shoots?', 'Seeking advice on setting up low-cost drip systems for a 1-acre plot.'].map((question) => <button type="button" key={question} onClick={() => setActiveView('community')}><span>Pest Control</span><strong>{question}</strong><small>Asked by Farmer Jane • +15 Trust Pts</small></button>)}</section></aside></div>
        </> : <RoleWorkspace role="student" page={activeView} onBack={() => setActiveView('dashboard')} />}
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

function InstitutionalDashboard({ user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarState);
  const [activeView, setActiveView] = useState('dashboard');

  useNavScrollLock(isSidebarOpen);

  if (activeView === 'evidence') {
    return <VerifiedActivityArchive user={user} onLogout={onLogout} onNavigate={setActiveView} />;
  }

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
          {[['dashboard', 'Dashboard'], ['programmes', 'Programmes'], ['beneficiaries', 'Beneficiaries'], ['reports', 'Impact Reports'], ['field-intel', 'Field Intelligence']].map(([view, label]) => <a href="#" key={view} className={activeView === view ? 'impact-main-link active' : 'impact-main-link'} onClick={(event) => { event.preventDefault(); setActiveView(view); }}>{label}</a>)}
        </nav>

        <div className="impact-actions">
          <button type="button" className="impact-icon-button" aria-label="Search" onClick={() => setActiveView('search')}>
            <span className="material-symbols-outlined">search</span>
          </button>
          <button type="button" className="impact-icon-button" aria-label="Notifications" onClick={() => setActiveView('notifications')}>
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button type="button" className="impact-icon-button" aria-label="Settings" onClick={() => setActiveView('settings')}>
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
            <a href="#" className={activeView === 'dashboard' ? 'impact-side-link active' : 'impact-side-link'} onClick={(event) => { event.preventDefault(); setActiveView('dashboard'); }}>
              <span className="material-symbols-outlined fill">dashboard</span>
              <span>Overview</span>
            </a>
            <a href="#" className={activeView === 'programmes' ? 'impact-side-link active' : 'impact-side-link'} onClick={(event) => { event.preventDefault(); setActiveView('programmes'); }}>
              <span className="material-symbols-outlined">account_tree</span>
              <span>Programmes</span>
            </a>
            <a href="#" className={activeView === 'beneficiaries' ? 'impact-side-link active' : 'impact-side-link'} onClick={(event) => { event.preventDefault(); setActiveView('beneficiaries'); }}>
              <span className="material-symbols-outlined">groups</span>
              <span>Beneficiaries</span>
            </a>
            <a href="#" className={activeView === 'reports' ? 'impact-side-link active' : 'impact-side-link'} onClick={(event) => { event.preventDefault(); setActiveView('reports'); }}>
              <span className="material-symbols-outlined">assessment</span>
              <span>Impact Reports</span>
            </a>
            <a href="#" className={activeView === 'field-intel' ? 'impact-side-link active' : 'impact-side-link'} onClick={(event) => { event.preventDefault(); setActiveView('field-intel'); }}>
              <span className="material-symbols-outlined">map</span>
              <span>Field Intel</span>
            </a>
            <button type="button" className={activeView === 'evidence' ? 'impact-side-link active action-button' : 'impact-side-link action-button'} onClick={() => setActiveView('evidence')}>
              <span className="material-symbols-outlined">verified</span>
              <span>Evidence Archive</span>
            </button>
            <button type="button" className={activeView === 'community' ? 'impact-side-link active action-button' : 'impact-side-link action-button'} onClick={() => setActiveView('community')}>
              <span className="material-symbols-outlined">forum</span>
              <span>Community Chat</span>
            </button>
          </nav>

          <div className="impact-sidebar-actions">
            <button type="button" className="impact-export-button" onClick={() => setActiveView('reports')}>
              <span className="material-symbols-outlined">download</span>
              Export Report
            </button>

            <a href="#" className="impact-side-link secondary-link" onClick={(event) => { event.preventDefault(); setActiveView('support'); }}>
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
          <CommunityChat onBackToDashboard={() => setActiveView('dashboard')} viewerProfile={{ id: 'institutional-demo', name: 'Impact Portfolio Team', role: 'Institution', location: 'Tanzania' }} />
        ) : activeView === 'dashboard' ? (
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
                <button type="button" onClick={() => setActiveView('programmes')}>View All</button>
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
        ) : (
          <RoleWorkspace role="institutional" page={activeView} onBack={() => setActiveView('dashboard')} />
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

function BuyerDashboard({ user, onLogout }) {
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
            <div className="buyer-profile-name">{user?.name || 'Buyer'}</div>
              <div className="buyer-role">Procurement · {personaById.get(user?.persona_id)?.label || 'Buyer'}</div>
          </div>
        </div>

        <nav className="buyer-nav">
          <a className={activeView === 'dashboard' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('dashboard'); }}>
            <span className="material-symbols-outlined">dashboard</span>
            Dashboard
          </a>
          <a className={activeView === 'marketplace' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('marketplace'); }}>
            <span className="material-symbols-outlined">storefront</span>
            Marketplace
          </a>
          <a className={activeView === 'procurement' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('procurement'); }}>
            <span className="material-symbols-outlined">request_quote</span>
            Feed Procurement
          </a>
          <a className={activeView === 'orders' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('orders'); }}>
            <span className="material-symbols-outlined">receipt_long</span>
            My Orders
          </a>
          <a className={activeView === 'logistics' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('logistics'); }}>
            <span className="material-symbols-outlined">local_shipping</span>
            Logistics
          </a>
          <a className={activeView === 'suppliers' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('suppliers'); }}>
            <span className="material-symbols-outlined">group</span>
            Suppliers
          </a>
          <a className={activeView === 'analytics' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('analytics'); }}>
            <span className="material-symbols-outlined">analytics</span>
            Analytics
          </a>
          <button type="button" className={activeView === 'community' ? 'buyer-nav-item active' : 'buyer-nav-item'} onClick={() => setActiveView('community')}>
            <span className="material-symbols-outlined">forum</span>
            Community Chat
          </button>
        </nav>

        <div className="buyer-nav footer-nav">
          <a className={activeView === 'settings' ? 'buyer-nav-item active' : 'buyer-nav-item'} href="#" onClick={(event) => { event.preventDefault(); setActiveView('settings'); }}>
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
              <h1>Habari za asubuhi, {user?.name || 'Buyer'}! 📦</h1>
              <p>Manage your sourcing requests, supplier quotes, and deliveries.</p>
            </div>
          </div>

          <div className="buyer-header-actions">
            <button type="button" className="buyer-primary-button" onClick={() => setActiveView('procurement')}>
              <span className="material-symbols-outlined">add</span>
              New Request
            </button>
            <button type="button" className="buyer-icon-button" aria-label="Notifications" onClick={() => setActiveView('alerts')}>
              <span className="material-symbols-outlined">notifications</span>
              <span className="alert-dot" />
            </button>
          </div>
        </header>

        {activeView === 'community' ? (
          <CommunityChat onBackToDashboard={() => setActiveView('dashboard')} viewerProfile={{ id: 'buyer-john', name: 'John Mwakalinga', role: 'Produce Buyer', location: 'Mbeya, Tanzania' }} />
        ) : activeView === 'dashboard' ? (
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
                  <td><button type="button" onClick={() => setActiveView('purchase')}>Buy</button></td>
                </tr>
                <tr>
                  <td className="commodity-name"><span className="dot green" />Mbeya Rice</td>
                  <td>2,100</td>
                  <td className="trend up">↑ +1.5%</td>
                  <td><button type="button" onClick={() => setActiveView('purchase')}>Buy</button></td>
                </tr>
                <tr>
                  <td className="commodity-name"><span className="dot red" />Red Beans</td>
                  <td>1,850</td>
                  <td className="trend flat">— 0.0%</td>
                  <td><button type="button" onClick={() => setActiveView('purchase')}>Buy</button></td>
                </tr>
                <tr>
                  <td className="commodity-name"><span className="dot orange" />Sorghum</td>
                  <td>900</td>
                  <td className="trend up">↑ +0.8%</td>
                  <td><button type="button" onClick={() => setActiveView('purchase')}>Buy</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="buyer-panel buyer-alert-panel">
            <div className="buyer-panel-header compact">
              <h3><span className="material-symbols-outlined">campaign</span>Alerts</h3>
              <button type="button" className="buyer-link" onClick={() => setActiveView('alerts')}>View All</button>
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
              <a href="#" onClick={(event) => { event.preventDefault(); setActiveView('orders'); }}>View All</a>
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
                <button type="button" className="map-toggle" onClick={() => setActiveView('logistics')}>Live Tracking</button>
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
        </>
        ) : activeView === 'marketplace' ? (
          <MarketplacePage profile={{ name: user?.name || 'Buyer', region: user?.region || '', city: user?.region || '', location: user?.region || '' }} user={user} onTransport={() => setActiveView('transport')} />
        ) : activeView === 'procurement' ? (
          <ProcurementWorkspace user={user} profile={{ name: user?.name, region: user?.region }} />
        ) : (
          <RoleWorkspace role="buyer" page={activeView} onBack={() => setActiveView('dashboard')} />
        )}
      </main>
    </div>
  );
}

export default App;
