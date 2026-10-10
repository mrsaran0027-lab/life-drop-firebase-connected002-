/**
 * LifeDrop - Blood Donation & Medical Appointments Platform
 * Pure HTML, CSS, JavaScript Implementation
 * Runs directly on local VS Code (Live Server) or any web server.
 */

// =========================================================================
// 1. ONLY ONE FUNCTION TO APPLY THE FIREBASE DATABASE CONNECTION
// =========================================================================
/**
 * Single function to configure and connect to the Firebase Firestore Database.
 * Connects to project: life-drop-d8a32
 * Includes automatic local cache fallback for offline testing in VS Code.
 */
function connectFirebaseDatabase() {
  const firebaseConfig = {
    apiKey: "AIzaSyDv7Lm4da4E_g8U31W4iqtr6O9shQJ9l7w",
    authDomain: "life-drop-d8a32.firebaseapp.com",
    projectId: "life-drop-d8a32",
    storageBucket: "life-drop-d8a32.firebasestorage.app",
    messagingSenderId: "562639032756",
    appId: "1:562639032756:web:5057677c5f7137966a62e1",
    measurementId: "G-TKQQVN5DXH"
  };

  try {
    // If Firebase SDK is loaded from CDN in browser
    if (typeof window !== 'undefined' && window.firebase && window.firebase.initializeApp) {
      const app = window.firebase.apps && window.firebase.apps.length 
        ? window.firebase.app() 
        : window.firebase.initializeApp(firebaseConfig);
      const db = window.firebase.firestore ? window.firebase.firestore() : null;
      console.log("✓ Firebase Database Connected Successfully:", firebaseConfig.projectId);
      return { isConnected: Boolean(db), projectId: firebaseConfig.projectId, db };
    }
  } catch (err) {
    console.warn("Firebase online connection notice (running with local cache):", err);
  }

  return { isConnected: false, projectId: firebaseConfig.projectId, db: null };
}

// Initialize the single Firebase connection
const firebaseStatus = connectFirebaseDatabase();

// =========================================================================
// 2. DATA PERSISTENCE & LOCAL CACHE (Works offline in VS Code)
// =========================================================================
const STORAGE = {
  USER: 'lifedrop_user',
  REQUESTS: 'lifedrop_requests',
  DONORS: 'lifedrop_donors',
  MATCHES: 'lifedrop_matches',
  GROUPS: 'lifedrop_groups',
  APPOINTMENTS: 'lifedrop_appointments'
};

function getLocal(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

const FIRESTORE_COLLECTIONS = {
  [STORAGE.REQUESTS]: 'patientRequests',
  [STORAGE.DONORS]: 'donors',
  [STORAGE.MATCHES]: 'matches',
  [STORAGE.GROUPS]: 'groups',
  [STORAGE.APPOINTMENTS]: 'appointments'
};

function setLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn("Storage error", e);
  }

  // Save profile data (this does not authenticate the user).
  if (key === STORAGE.USER && val && val.id && firebaseStatus.db) {
    firebaseStatus.db.collection('users').doc(String(val.id))
      .set(val, { merge: true })
      .catch((err) => {
        console.error('[Firebase] Failed to save user profile:', err);
        showFirebaseError(err);
      });
  }

  // Mirror application data to Firestore. Local storage is only a fallback/cache.
  const collectionName = FIRESTORE_COLLECTIONS[key];
  if (!collectionName || !firebaseStatus.db || !Array.isArray(val)) return;

  val.forEach((record) => {
    if (!record || !record.id) return;
    firebaseStatus.db.collection(collectionName).doc(String(record.id))
      .set(record, { merge: true })
      .catch((err) => {
        console.error(`[Firebase] Failed to save ${collectionName}/${record.id}:`, err);
        showFirebaseError(err);
      });
  });
}

function showFirebaseError(err) {
  const code = err && err.code ? err.code : 'unknown';
  if (code === 'permission-denied' || code === 'unauthenticated') {
    console.error('[Firebase] Firestore rules or authentication blocked this operation.');
  } else {
    console.error('[Firebase] Check your internet connection and Firebase project settings.');
  }
}

// Subscribe to remote changes so different browsers see the same Firestore data.
// Listener updates write directly to localStorage to avoid echoing the same changes back.
let firebaseRealtimeStarted = false;
function startFirebaseRealtimeSync() {
  if (firebaseRealtimeStarted) return;
  firebaseRealtimeStarted = true;
  if (!firebaseStatus.db) {
    console.warn('[Firebase] Firestore SDK unavailable. Running with browser-local data only.');
    return;
  }

  const subscriptions = [
    { key: STORAGE.REQUESTS, collectionName: 'patientRequests', stateKey: 'patientRequests' },
    { key: STORAGE.DONORS, collectionName: 'donors', stateKey: 'donors' },
    { key: STORAGE.MATCHES, collectionName: 'matches', stateKey: 'matches' },
    { key: STORAGE.GROUPS, collectionName: 'groups', stateKey: 'groups' },
    { key: STORAGE.APPOINTMENTS, collectionName: 'appointments', stateKey: 'appointments' }
  ];

  subscriptions.forEach(({ key, collectionName, stateKey }) => {
    firebaseStatus.db.collection(collectionName).onSnapshot((snapshot) => {
      // If Firestore has records, use the shared cloud copy.
      if (!snapshot.empty) {
        const records = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        }));
        state[stateKey] = records;
        try { localStorage.setItem(key, JSON.stringify(records)); } catch (e) {}
        if (typeof renderApp === 'function') renderApp();
      }
    }, (err) => {
      console.error(`[Firebase] Realtime listener failed for ${collectionName}:`, err);
      showFirebaseError(err);
    });
  });
}

// Default state matching uploaded screenshots
const DEFAULT_USER = {
  id: 'usr-saranhari',
  name: 'saran hari',
  email: 'saran.hari@lifedrop.org',
  role: 'user',
  phone: '90809786556',
  bloodGroup: 'O+',
  city: 'dindigul',
  isVerified: true
};

const DEFAULT_MATCHES = [
  {
    id: 'match-mv1bhreg',
    patientRequestId: 'req-kumar-1',
    donorId: 'dnr-saranraj-1',
    patientName: 'kumar',
    donorName: 'saranraj',
    bloodGroup: 'O+',
    units: 1,
    hospital: '3d3d3wd3333',
    estimatedArrivalMins: 14,
    receivingStatus: 'Ready for Transfusion',
    arrivalStatus: 'Donor in Transit',
    currentStep: 4,
    patientPhone: '9072490724',
    donorPhone: '9072490724',
    vehicleInfo: 'Direct Emergency Transit'
  }
];

// App Global State
const state = {
  currentUser: getLocal(STORAGE.USER, DEFAULT_USER),
  currentPage: 'home', // 'home' | 'patient-view' | 'donor-view' | 'matching' | 'groups' | 'appointments' | 'auth' | 'doctor'
  portalTab: 'user', // for Auth screen: 'doctor' | 'user'
  authMode: 'create', // for Auth screen: 'create' | 'signin'
  
  // Data collections
  patientRequests: getLocal(STORAGE.REQUESTS, []),
  donors: getLocal(STORAGE.DONORS, []),
  matches: getLocal(STORAGE.MATCHES, DEFAULT_MATCHES),
  groups: getLocal(STORAGE.GROUPS, []),
  appointments: getLocal(STORAGE.APPOINTMENTS, []),

  // Active Filters
  patientBloodFilter: 'All',
  donorUrgencyFilter: 'All',
  matchingTab: 'req', // 'req' | 'safety'

  // Modals
  showPatientRequestModal: false,
  showDonorAvailabilityModal: false,
  showBookingModal: false,
  bookingServiceType: 'doctor consultation',
  showTimeSlotModal: false,
  selectedApptForSlot: null,
  assignedSlot: 'Tomorrow 10:30 AM - Room 204'
};

// =========================================================================
// 3. SVG ICONS (Embedded for 100% Offline Reliability in VS Code)
// =========================================================================
const ICONS = {
  droplet: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  dropletOutline: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  home: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  heartHandshake: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  activity: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  users: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  calendar: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  logout: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
  check: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  clock: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  shieldCheck: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>`,
  building: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>`,
  arrowRight: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  stethoscope: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>`,
  user: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  lock: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  mail: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  phone: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  mapPin: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  filter: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  plus: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>`,
  close: `<svg class="w-current h-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>`
};

function icon(name, className = 'w-4 h-4') {
  const svg = ICONS[name] || ICONS.droplet;
  return `<span class="inline-flex items-center justify-center shrink-0 ${className}">${svg}</span>`;
}

// =========================================================================
// 4. MAIN APPLICATION RENDER ENGINE
// =========================================================================
function navigateTo(page) {
  state.currentPage = page;
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderApp() {
  const appContainer = document.getElementById('app') || document.getElementById('root');
  if (!appContainer) return;

  // 1. If not logged in or explicitly on auth page, render Portal Switcher (Screenshots 9 & 10)
  if (!state.currentUser || state.currentPage === 'auth') {
    appContainer.innerHTML = renderAuthPage();
    attachAuthEvents();
    return;
  }

  // 2. If Doctor mode, render Doctor Dashboard
  if (state.currentUser.role === 'doctor' || state.currentPage === 'doctor') {
    appContainer.innerHTML = renderDoctorDashboard();
    attachDoctorEvents();
    return;
  }

  // 3. User Community App Shell (Screenshots 1 - 8)
  appContainer.innerHTML = `
    <div class="min-h-screen bg-[#F8F9FC] flex font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- LEFT SIDEBAR -->
      <aside class="w-64 bg-[#151D48] text-white flex flex-col justify-between shrink-0 sticky top-0 h-screen select-none z-30">
        <div class="p-5 space-y-6">
          <!-- Brand Logo -->
          <div onclick="window.appNav('home')" class="flex items-center gap-3 cursor-pointer">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
              ${icon('droplet', 'w-6 h-6 text-white')}
            </div>
            <div>
              <div class="text-xl font-extrabold tracking-tight text-white leading-tight">
                Life<span class="text-red-500">Drop</span>
              </div>
              <div class="text-[11px] text-slate-400 font-medium">Patient & Donor</div>
            </div>
          </div>

          <!-- Community Member Card -->
          <div class="p-3 bg-[#1B2559] rounded-2xl border border-white/10 space-y-2">
            <div className="flex items-center justify-between" style="display:flex; justify-content:space-between; align-items:center;">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                COMMUNITY MEMBER
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                ${icon('shieldCheck', 'w-3 h-3')}
                Verified
              </span>
            </div>

            <div class="flex items-center gap-2.5 pt-1">
              <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center font-mono shadow-xs shrink-0">
                ${state.currentUser.bloodGroup || 'O+'}
              </div>
              <div class="overflow-hidden">
                <div class="font-bold text-xs text-white truncate">${state.currentUser?.name || 'User'}</div>
                <div class="text-[11px] text-slate-400 truncate">
                  Blood Group: ${state.currentUser.bloodGroup || 'O+'}
                </div>
              </div>
            </div>
          </div>

          <!-- Navigation Items -->
          <nav class="space-y-1.5">
            ${renderNavItem('home', 'Home (U2)', 'home')}
            ${renderNavItem('patient-view', 'Patient View (U3.1)', 'dropletOutline')}
            ${renderNavItem('donor-view', 'Donor View (U3.2)', 'heartHandshake')}
            ${renderNavItem('matching', 'Matching (U4)', 'activity', 'Active')}
            ${renderNavItem('groups', 'Groups (U5)', 'users')}
            ${renderNavItem('appointments', 'Appointments (U6)', 'calendar')}
          </nav>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-5 border-t border-white/10 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Firebase: ${firebaseStatus.projectId}
            </span>
          </div>

          <button
            onclick="window.appLogout()"
            class="w-full py-2.5 px-3 border border-red-500/30 hover:border-red-500/60 text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            ${icon('logout', 'w-3.5 h-3.5')}
            <span>Sign Out (User)</span>
          </button>
        </div>
      </aside>

      <!-- MAIN CONTENT WRAPPER -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Top Bar -->
        <header class="h-16 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div class="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span class="font-bold text-slate-700">Patient & Donor Community</span>
            <span>•</span>
            <span class="font-semibold text-slate-600">${state.currentUser.city || 'dindigul'}</span>
          </div>

          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center font-mono">
              ${state.currentUser.bloodGroup || 'O+'}
            </div>
            <div class="text-right hidden sm:block">
              <div class="text-xs font-bold text-slate-900 leading-tight">${state.currentUser.name}</div>
              <div class="text-[11px] text-slate-500 font-medium">
                Blood Group: ${state.currentUser.bloodGroup || 'O+'}
              </div>
            </div>

            <button
              onclick="window.appLogout()"
              class="ml-2 flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              ${icon('logout', 'w-3.5 h-3.5')}
              <span>Log Out</span>
            </button>
          </div>
        </header>

        <!-- Active View Container -->
        <main class="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          ${renderCurrentPageView()}
        </main>
      </div>

      <!-- Modals Container -->
      <div id="modal-container">
        ${renderModals()}
      </div>
    </div>
  `;

  attachAppEvents();
}

function renderNavItem(pageKey, label, iconName, badge = null) {
  const isActive = state.currentPage === pageKey;
  return `
    <button
      onclick="window.appNav('${pageKey}')"
      class="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
        isActive
          ? 'bg-white text-[#151D48] shadow-md shadow-black/10'
          : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }"
    >
      <div class="flex items-center gap-3">
        ${icon(iconName, `w-4 h-4 ${isActive ? 'text-[#151D48]' : 'text-slate-400'}`)}
        <span>${label}</span>
      </div>
      ${badge ? `<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs">${badge}</span>` : ''}
    </button>
  `;
}

function renderCurrentPageView() {
  switch (state.currentPage) {
    case 'home':
      return renderUserHome();
    case 'patient-view':
      return renderPatientView();
    case 'donor-view':
      return renderDonorView();
    case 'matching':
      return renderMatching();
    case 'groups':
      return renderGroups();
    case 'appointments':
      return renderAppointments();
    default:
      return renderUserHome();
  }
}

// =========================================================================
// 5. PAGE: USER HOME (U2 - Matching screenshot_1.png)
// =========================================================================
function renderUserHome() {
  return `
    <div class="space-y-8 pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- HERO BANNER (Matches screenshot_1.png exactly) -->
      <section class="relative overflow-hidden rounded-[32px] border-[10px] border-[#131838] bg-[#162052] text-white p-7 sm:p-9 shadow-xl">
        <!-- Geometric Purple Circle (Matches screenshot_1.png) -->
        <div class="absolute right-0 top-0 -mr-6 -mt-10 w-96 h-96 rounded-full bg-[#412B80]/75 pointer-events-none"></div>

        <div class="relative z-10 max-w-3xl space-y-3.5">
          <!-- Header Tag & Welcome -->
          <div class="flex items-center gap-3">
            <span class="text-[11px] font-black uppercase tracking-wider bg-[#222E68] text-white px-3 py-1 rounded-full border border-white/20 shadow-2xs">
              U2 – USER HOME
            </span>
            <span class="text-xs text-slate-300 font-semibold">
              Welcome, ${state.currentUser.name || 'saran hari'}
            </span>
          </div>

          <!-- Heading (Breaks onto 2 lines with "Hub" below) -->
          <h1 class="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-white leading-[1.15]">
            Blood Transfusion & Donor Dispatch <br class="hidden sm:inline" />
            Hub
          </h1>

          <!-- Subtitle Paragraph -->
          <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal max-w-2xl">
            Every drop can save a life. Select whether you are seeking urgent blood for a patient or declaring your availability as a willing volunteer donor.
          </p>

          <!-- Bottom Registered Group Container (Full width below text, matching screenshot_1.png) -->
          <div class="pt-2">
            <div class="w-full bg-[#1B2664]/60 backdrop-blur-xs rounded-2xl border border-white/15 p-4 flex items-center gap-3.5 shadow-xs">
              <div class="w-12 h-12 rounded-xl bg-[#DC2626] text-white font-black text-sm flex items-center justify-center font-mono shrink-0 shadow-xs">
                ${state.currentUser.bloodGroup || 'O+'}
              </div>
              <div>
                <div class="font-extrabold text-sm text-white leading-tight">Registered Group</div>
                <div class="text-[11px] text-slate-300 mt-0.5">Universal Donor Safe</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- DUAL LARGE ACTION CARDS (Framed with thick rounded borders matching screenshot_1.png) -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- LEFT CARD: PATIENT REQUEST (NEED BLOOD URGENT) -->
        <div class="bg-white rounded-[32px] border-[10px] border-[#DCE1EA] shadow-xs p-7 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div class="space-y-4">
            <!-- Top Red Badge -->
            <div class="w-12 h-12 rounded-2xl bg-[#DC2626] text-white flex items-center justify-center shadow-md shadow-red-500/20">
              ${icon('droplet', 'w-7 h-7 text-white')}
            </div>

            <span class="inline-block text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-rose-50 text-red-600 border border-rose-100">
              NEED BLOOD URGENT
            </span>

            <div>
              <h2 class="text-2xl font-black text-slate-900 tracking-tight">Patient Request</h2>
              <span class="text-xs text-slate-500 font-bold block mt-0.5">(Request for Blood)</span>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                Create an emergency or standard patient blood request. Specify blood group, units, hospital facility, and urgency to search nearest available donors on the live map.
              </p>
            </div>

            <!-- Features List -->
            <div class="space-y-2.5 pt-2">
              <div class="p-3 bg-slate-50/90 rounded-2xl border border-slate-100 flex items-center gap-3 text-xs text-slate-700 font-medium">
                ${icon('check', 'w-4 h-4 text-emerald-600 shrink-0')}
                <span>Auto-scans verified donors within 15 km radius</span>
              </div>

              <div class="p-3 bg-slate-50/90 rounded-2xl border border-slate-100 flex items-center gap-3 text-xs text-slate-700 font-medium">
                ${icon('clock', 'w-4 h-4 text-rose-600 shrink-0')}
                <span>Instant dispatch notifications sent to O- and compatible groups</span>
              </div>
            </div>
          </div>

          <div class="pt-6 mt-4">
            <button
              onclick="window.openPatientModal()"
              class="w-full py-3.5 bg-[#DC2626] hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              ${icon('droplet', 'w-4 h-4 text-white')}
              <span>Publish Patient Request Form</span>
              ${icon('arrowRight', 'w-4 h-4')}
            </button>
          </div>
        </div>

        <!-- RIGHT CARD: DONOR AVAILABILITY (VOLUNTEER LIFESAVER) -->
        <div class="bg-white rounded-[32px] border-[10px] border-[#DCE1EA] shadow-xs p-7 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div class="space-y-4">
            <!-- Top Navy Badge -->
            <div class="w-12 h-12 rounded-2xl bg-[#151D48] text-white flex items-center justify-center shadow-md shadow-indigo-900/20">
              ${icon('heartHandshake', 'w-7 h-7 text-white')}
            </div>

            <span class="inline-block text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              VOLUNTEER LIFESAVER
            </span>

            <div>
              <h2 class="text-2xl font-black text-slate-900 tracking-tight">Donor Availability</h2>
              <span class="text-xs text-slate-500 font-bold block mt-0.5">(Willing to Donate Person)</span>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                Register yourself as ready to donate. View real incoming patient requests sorted by urgency and distance, accept a matched request, and monitor hospital arrival.
              </p>
            </div>

            <!-- Features List -->
            <div class="space-y-2.5 pt-2">
              <div class="p-3 bg-slate-50/90 rounded-2xl border border-slate-100 flex items-center gap-3 text-xs text-slate-700 font-medium">
                ${icon('shieldCheck', 'w-4 h-4 text-emerald-600 shrink-0')}
                <span>Verified donor credentials with safety screening check</span>
              </div>

              <div class="p-3 bg-slate-50/90 rounded-2xl border border-slate-100 flex items-center gap-3 text-xs text-slate-700 font-medium">
                ${icon('building', 'w-4 h-4 text-indigo-700 shrink-0')}
                <span>Direct coordination with hospital trauma & transfusion units</span>
              </div>
            </div>
          </div>

          <div class="pt-6 mt-4">
            <button
              onclick="window.openDonorModal()"
              class="w-full py-3.5 bg-[#151D48] hover:bg-[#0f1536] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md shadow-indigo-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              ${icon('heartHandshake', 'w-4 h-4')}
              <span>Register Donor Availability Form</span>
              ${icon('arrowRight', 'w-4 h-4')}
            </button>
          </div>
        </div>
      </section>

      <!-- SECONDARY ROW: Groups and Appointments -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div onclick="window.appNav('groups')" class="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              ${icon('users', 'w-5 h-5')}
            </div>
            <div>
              <h3 class="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">
                U5: Blood Groups & Networks
              </h3>
              <p class="text-[11px] text-slate-500">
                Join volunteer clusters tailored by blood phenotype or emergency response zone.
              </p>
            </div>
          </div>
          ${icon('arrowRight', 'w-4 h-4 text-slate-400 group-hover:text-indigo-700')}
        </div>

        <div onclick="window.appNav('appointments')" class="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              ${icon('calendar', 'w-5 h-5')}
            </div>
            <div>
              <h3 class="font-bold text-sm text-slate-900 group-hover:text-red-600 transition-colors">
                U6: Clinical Appointments
              </h3>
              <p class="text-[11px] text-slate-500">
                Book medical consultations, diagnostic blood tests, and lab reports.
              </p>
            </div>
          </div>
          ${icon('arrowRight', 'w-4 h-4 text-slate-400 group-hover:text-red-600')}
        </div>
      </section>
    </div>
  `;
}

// =========================================================================
// 6. PAGE: PATIENT VIEW (U3.1 - Screenshot 4)
// =========================================================================
function renderPatientView() {
  const bloodGroups = ['All', 'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  const patientBlood = state.currentUser.bloodGroup || 'O+';
  const filteredDonors = state.donors.filter(d => {
    if (state.patientBloodFilter === 'All') return true;
    return d.bloodGroup === state.patientBloodFilter;
  });

  return `
    <div class="space-y-6 pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- Top Banner (Screenshot 4) -->
      <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-red-600 border border-rose-100">
              U3 (3.1) – PATIENT VIEW
            </span>
            <span class="text-xs text-slate-500 font-medium">Sorted by Nearest Geographic Proximity</span>
          </div>

          <h1 class="text-2xl font-black text-slate-900 tracking-tight">Shows Donor Info for Patient</h1>

          <p class="text-xs text-slate-500 max-w-xl">
            Locate volunteer blood donors nearest to your hospital. Click <strong class="text-slate-800">Request</strong> to dispatch an emergency notification.
          </p>
        </div>

        <!-- Patient Blood Target Card (Screenshot 4) -->
        <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-center gap-3 shrink-0">
          <div class="w-10 h-10 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center font-mono shadow-xs">
            ${patientBlood}
          </div>
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">PATIENT BLOOD TARGET</div>
            <div class="text-xs font-extrabold text-[#151D48]">Showing Compatible Donors</div>
          </div>
        </div>
      </div>

      <!-- Filter Bar (Screenshot 4) -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2 text-slate-700 font-bold">
          ${icon('filter', 'w-4 h-4 text-slate-500')}
          <span>Filter Blood Group:</span>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          ${bloodGroups.map(bg => `
            <button
              onclick="window.setPatientBloodFilter('${bg}')"
              class="px-3 py-1.5 rounded-xl font-bold font-mono transition-all cursor-pointer ${
                state.patientBloodFilter === bg
                  ? 'bg-[#151D48] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }"
            >
              ${bg}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Content Area (Screenshot 4) -->
      ${filteredDonors.length === 0 ? `
        <div class="bg-white rounded-3xl p-16 text-center border border-slate-200/90 shadow-xs space-y-4">
          <div class="w-16 h-16 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200">
            ${icon('dropletOutline', 'w-8 h-8 text-slate-400')}
          </div>

          <div class="space-y-1">
            <h3 class="text-base font-extrabold text-slate-900">No Volunteer Donors Registered Yet</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto">
              When willing donors submit the Donor Availability form from User Home (U2), their profile and nearest distance will appear here.
            </p>
          </div>

          <div class="pt-2">
            <button
              onclick="window.openDonorModal()"
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#151D48] hover:bg-[#0f1536] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              ${icon('plus', 'w-4 h-4')}
              <span>Go to User Home (U2) to Register a Donor</span>
            </button>
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${filteredDonors.map(donor => `
            <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center font-mono">
                    ${donor.bloodGroup}
                  </div>
                  <div>
                    <h4 class="font-extrabold text-sm text-slate-900">${donor.donorName}</h4>
                    <span class="text-[11px] text-slate-500">${donor.distanceKm || 1.2} km away</span>
                  </div>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Available</span>
              </div>
              <div class="text-xs text-slate-600">
                <div>Location: ${donor.location || 'dindigul'}</div>
                <div>Availability: <strong>${donor.availability || 'Immediate'}</strong></div>
              </div>
              <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs font-mono text-slate-500">${donor.phone}</span>
                <button
                  onclick="window.requestDonorMatch('${donor.id}')"
                  class="px-4 py-2 bg-[#151D48] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Request Donor
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

// =========================================================================
// 7. PAGE: DONOR VIEW (U3.2 - Screenshot 5)
// =========================================================================
function renderDonorView() {
  const urgencyOptions = ['All', 'Emergency', 'Urgent', 'Standard'];
  const donorBlood = state.currentUser.bloodGroup || 'O+';
  const filteredRequests = state.patientRequests.filter(r => {
    if (state.donorUrgencyFilter === 'All') return true;
    return r.urgency === state.donorUrgencyFilter;
  });

  return `
    <div class="space-y-6 pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- Top Banner (Screenshot 5) -->
      <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-red-600 border border-rose-100">
              U3 (3.2) – DONOR VIEW
            </span>
            <span class="text-xs text-slate-500 font-medium">Incoming Hospital & Trauma Requests</span>
          </div>

          <h1 class="text-2xl font-black text-slate-900 tracking-tight">Shows Patient Info for Donor</h1>

          <p class="text-xs text-slate-500 max-w-xl">
            Patients needing blood in nearby hospitals. Review compatibility and click <strong class="text-slate-800">Accept</strong> to initiate emergency transport and matching.
          </p>
        </div>

        <!-- Active Donor Identity Card (Screenshot 5) -->
        <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-center gap-3 shrink-0">
          <div class="w-10 h-10 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center font-mono shadow-xs">
            ${donorBlood}
          </div>
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">ACTIVE DONOR IDENTITY</div>
            <div class="text-xs font-extrabold text-[#151D48]">${state.currentUser.name} (${donorBlood})</div>
          </div>
        </div>
      </div>

      <!-- Filter Bar (Screenshot 5) -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2 text-slate-700 font-bold">
          ${icon('filter', 'w-4 h-4 text-slate-500')}
          <span>Filter by Urgency:</span>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          ${urgencyOptions.map(urg => `
            <button
              onclick="window.setDonorUrgencyFilter('${urg}')"
              class="px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                state.donorUrgencyFilter === urg
                  ? 'bg-[#151D48] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }"
            >
              ${urg}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Content Area (Screenshot 5) -->
      ${filteredRequests.length === 0 ? `
        <div class="bg-white rounded-3xl p-16 text-center border border-slate-200/90 shadow-xs space-y-4">
          <div class="w-16 h-16 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200">
            ${icon('check', 'w-8 h-8 text-slate-400')}
          </div>

          <div class="space-y-1">
            <h3 class="text-base font-extrabold text-slate-900">No Patient Blood Requests Pending</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto">
              No open requests under "${state.donorUrgencyFilter}" filter.
            </p>
          </div>

          <div class="pt-2">
            <button
              onclick="window.openPatientModal()"
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              ${icon('plus', 'w-4 h-4')}
              <span>Go to User Home (U2) to Create Patient Request</span>
            </button>
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${filteredRequests.map(req => `
            <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center font-mono">
                    ${req.bloodGroup}
                  </div>
                  <div>
                    <h4 class="font-extrabold text-sm text-slate-900">${req.patientName}</h4>
                    <span class="text-[11px] text-slate-500">${req.hospital}</span>
                  </div>
                </div>
                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-red-700">
                  ${req.urgency}
                </span>
              </div>
              <div class="text-xs text-slate-600">
                <div>Units: <strong>${req.units} Units</strong></div>
                <div>Location: ${req.location || req.city}</div>
              </div>
              <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs font-mono text-slate-500">${req.contactNumber}</span>
                <button
                  onclick="window.acceptPatientRequest('${req.id}')"
                  class="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Accept & Match
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

// =========================================================================
// 8. PAGE: MATCHING PAGE (U4 - Screenshot 6)
// =========================================================================
function renderMatching() {
  const match = state.matches[0] || DEFAULT_MATCHES[0];

  return `
    <div class="space-y-6 pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- Top Banner (Screenshot 6) -->
      <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              U4 – MATCHING PAGE
            </span>
            <span class="text-xs text-slate-500 font-medium">Live Transfusion Logistics</span>
          </div>

          <h1 class="text-2xl font-black text-slate-900 tracking-tight">
            Matching Status (Same Blood Group Verified)
          </h1>

          <p class="text-xs text-slate-500 max-w-xl">
            Confirmed match between volunteer donor and recipient. Real-time ETA and step progress.
          </p>
        </div>

        <!-- Toggle Pills (Screenshot 6) -->
        <div class="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 shrink-0 text-xs font-bold">
          <button
            onclick="window.setMatchingTab('req')"
            class="px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              state.matchingTab === 'req'
                ? 'bg-[#151D48] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }"
          >
            Tab: Patient & Donor Req
          </button>
          <button
            onclick="window.setMatchingTab('safety')"
            class="px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              state.matchingTab === 'safety'
                ? 'bg-[#151D48] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }"
          >
            Clinical Safety Log
          </button>
        </div>
      </div>

      <!-- TWO CARDS SIDE BY SIDE (Screenshot 6) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- LEFT CARD: RECIPIENT PROFILE -->
        <div class="bg-white rounded-3xl p-7 border border-rose-200/90 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-rose-50 text-red-600 border border-rose-100">
              RECIPIENT PROFILE
            </span>
            <span class="text-xs font-mono text-slate-400">Match #${match.id}</span>
          </div>

          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Patient Matched</h2>
            <p class="text-xs text-slate-500 mt-0.5">Verified recipient receiving blood units</p>
          </div>

          <div class="space-y-3 pt-2 text-xs divide-y divide-slate-100">
            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Patient Name:</span>
              <span class="font-extrabold text-slate-900 text-sm">${match.patientName}</span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Blood Group Required:</span>
              <span class="px-2.5 py-0.5 rounded-lg bg-red-600 text-white font-black text-xs font-mono shadow-2xs">
                ${match.bloodGroup}
              </span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Units Demanded:</span>
              <span class="font-bold text-slate-800">${match.units} Units (PRBC)</span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Hospital Facility:</span>
              <span class="font-bold text-slate-800 font-mono">${match.hospital}</span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Contact Desk:</span>
              <span class="font-bold text-slate-800 font-mono">${match.patientPhone}</span>
            </div>
          </div>
        </div>

        <!-- RIGHT CARD: VOLUNTEER HERO -->
        <div class="bg-white rounded-3xl p-7 border border-indigo-200/90 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              VOLUNTEER HERO
            </span>
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              ${icon('shieldCheck', 'w-3.5 h-3.5')}
              Screened & Ready
            </span>
          </div>

          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Donor Found</h2>
            <p class="text-xs text-slate-500 mt-0.5">Accepted voluntary emergency donation</p>
          </div>

          <div class="space-y-3 pt-2 text-xs divide-y divide-slate-100">
            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Donor Name:</span>
              <span class="font-extrabold text-slate-900 text-sm">${match.donorName}</span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Donor Blood Group:</span>
              <span class="px-2.5 py-0.5 rounded-lg bg-[#1F2A6B] text-white font-black text-xs font-mono shadow-2xs">
                ${match.bloodGroup}
              </span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Transit Vehicle:</span>
              <span class="font-bold text-slate-800">${match.vehicleInfo || 'Direct Emergency Transit'}</span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Estimated Arrival Time:</span>
              <span class="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                ${icon('clock', 'w-3.5 h-3.5')}
                ~${match.estimatedArrivalMins} mins
              </span>
            </div>

            <div class="flex justify-between items-center pt-2">
              <span class="text-slate-500 font-medium">Direct Phone:</span>
              <span class="font-bold text-slate-800 font-mono">${match.donorPhone}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- BOTTOM SECTION: LIVE LOGISTICS & TRANSFUSION TRACKER (Screenshot 6) -->
      <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="font-black text-slate-900 text-sm">Live Logistics & Transfusion Tracker</h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Current receiving status: <strong class="text-slate-800">${match.receivingStatus}</strong>
          </p>
        </div>

        <!-- 1 2 3 4 5 Simulate Buttons -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500 font-medium">Simulate Dispatch Flow:</span>
          <div class="flex items-center gap-1.5">
            ${[1, 2, 3, 4, 5].map(stNum => `
              <button
                onclick="window.setMatchStep(${stNum})"
                class="w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  match.currentStep === stNum
                    ? 'bg-[#151D48] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }"
              >
                ${stNum}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// 9. PAGE: GROUPS (U5 - Screenshot 7)
// =========================================================================
function renderGroups() {
  return `
    <div class="space-y-6 pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- Top Banner (Screenshot 7) -->
      <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              U5 – COMMUNITY GROUPS
            </span>
            <span class="text-xs text-slate-500 font-medium">Verified Blood Networks & Rapid Squads</span>
          </div>

          <h1 class="text-2xl font-black text-slate-900 tracking-tight">
            To Create a New Group & Available Groups to Join
          </h1>

          <p class="text-xs text-slate-500 max-w-xl">
            Join volunteer clusters tailored by blood phenotype or emergency response zone. Verified members can found new donor battalions.
          </p>
        </div>

        <div class="bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 flex items-center gap-2 shrink-0">
          ${icon('shieldCheck', 'w-4 h-4 text-emerald-600')}
          <span class="text-xs font-bold text-slate-800">Status: Verified Creator</span>
        </div>
      </div>

      <!-- Two Columns (Screenshot 7) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- LEFT COLUMN: GROUP FOUNDER PORTAL -->
        <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              GROUP FOUNDER PORTAL
            </span>
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              ${icon('shieldCheck', 'w-3.5 h-3.5')}
              Verified Access
            </span>
          </div>

          <div>
            <h2 class="text-xl font-black text-slate-900 tracking-tight">To Create a New Group</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Create an official donor collective for your local hospital, neighborhood council, or rare antigen brigade.
            </p>
          </div>

          <form onsubmit="window.handleCreateGroup(event)" class="space-y-4 text-xs pt-2">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Group / Network Name</label>
              <input
                id="group-name-input"
                type="text"
                required
                placeholder="e.g. West District O+ Rapid Squad"
                class="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#151D48]"
              />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Network Category</label>
              <select
                id="group-cat-input"
                class="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl font-medium"
              >
                <option value="Emergency Vanguard">Emergency Vanguard (ER Trauma)</option>
                <option value="Rare Blood Network">Rare Blood Network (Rh Negative)</option>
                <option value="Hospital Auxiliary">Hospital Auxiliary</option>
                <option value="Community Lifesavers">Community Lifesavers</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Mission Description</label>
              <textarea
                id="group-desc-input"
                rows="3"
                placeholder="Describe call-up schedules, target blood groups, and participating medical centers..."
                class="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#151D48]"
              ></textarea>
            </div>

            <div class="pt-2">
              <button
                type="submit"
                class="w-full py-3.5 bg-[#151D48] hover:bg-[#0f1536] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                ${icon('plus', 'w-4 h-4')}
                <span>Create & Launch Group</span>
              </button>
            </div>
          </form>
        </div>

        <!-- RIGHT COLUMN: AVAILABLE GROUPS TO JOIN -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-black text-slate-900 tracking-tight">Available Groups to Join</h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Active certified networks responding to blood emergencies
              </p>
            </div>

            <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              ${state.groups.length} Groups Active
            </span>
          </div>

          ${state.groups.length === 0 ? `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-xs space-y-3">
              <div class="w-12 h-12 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200">
                ${icon('users', 'w-6 h-6 text-slate-400')}
              </div>
              <h3 class="font-extrabold text-sm text-slate-800">No Groups Active Yet</h3>
              <p class="text-xs text-slate-500 max-w-sm mx-auto">
                Use the Group Founder Portal on the left to launch the first donor squad for your area!
              </p>
            </div>
          ` : `
            <div class="space-y-3">
              ${state.groups.map(grp => `
                <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ${grp.category}
                    </span>
                    <span class="text-xs font-mono font-bold text-slate-600">${grp.memberCount || 1} members</span>
                  </div>
                  <h3 class="font-extrabold text-sm text-slate-900">${grp.name}</h3>
                  <p class="text-xs text-slate-500">${grp.description}</p>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// 10. PAGE: APPOINTMENTS (U6 - Screenshot 8)
// =========================================================================
function renderAppointments() {
  return `
    <div class="space-y-6 pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- Top Banner (Screenshot 8) -->
      <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs">
        <div class="space-y-1.5 max-w-3xl">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              U6 – CLINICAL APPOINTMENTS
            </span>
            <span class="text-xs text-slate-500 font-medium">Connected to Hospital Doctor Queues</span>
          </div>

          <h1 class="text-2xl font-black text-slate-900 tracking-tight">
            Request Doctor Consultations, Tests & Reports
          </h1>

          <p class="text-xs text-slate-500">
            Book medical services directly with verified hospitals. Hospital physicians review requests in their dashboard and confirm an exact clinical time slot.
          </p>
        </div>
      </div>

      <!-- TWO COLUMNS (Screenshot 8) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- LEFT COLUMN: AVAILABLE MEDICAL SERVICES -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-black text-slate-900 tracking-tight">Available Medical Services</h2>
            <span class="text-xs text-slate-400">Click to book</span>
          </div>

          <!-- CARD 1: DOCTOR CONSULTATION -->
          <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-[#1F2A6B] flex items-center justify-center">
                ${icon('stethoscope', 'w-6 h-6')}
              </div>
              <span class="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Specialist Consultation
              </span>
            </div>

            <div>
              <h3 class="text-xl font-black text-slate-900 tracking-tight">Doctor Consultation</h3>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                One-on-one session with clinical hematologists and transfusion physicians regarding pre-donation health checks or post-operative blood requirements.
              </p>
            </div>

            <div class="text-xs text-slate-500 flex items-center gap-2">
              ${icon('building', 'w-3.5 h-3.5 text-slate-400')}
              <span>St. Jude Outpatient Bay</span>
              <span>•</span>
              ${icon('clock', 'w-3.5 h-3.5 text-slate-400')}
              <span>Avg. 25 mins</span>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500">Immediate hospital queue</span>
              <button
                onclick="window.openBookingModal('doctor consultation')"
                class="px-5 py-2.5 bg-[#151D48] hover:bg-[#0f1536] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Book Consultation</span>
                ${icon('arrowRight', 'w-3.5 h-3.5')}
              </button>
            </div>
          </div>

          <!-- CARD 2: BLOOD TEST & SCREENING -->
          <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
              <div class="w-12 h-12 rounded-2xl bg-rose-50 text-red-600 flex items-center justify-center">
                ${icon('droplet', 'w-6 h-6 fill-red-600 text-red-600')}
              </div>
              <span class="text-[11px] font-bold px-3 py-1 rounded-full bg-rose-50 text-red-600 border border-rose-200">
                Diagnostic Lab
              </span>
            </div>

            <div>
              <h3 class="text-xl font-black text-slate-900 tracking-tight">Blood Test & Screening</h3>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                Complete Blood Count (CBC), ABO & Rh Cross-match, hemoglobin level evaluation, and infectious disease screening prior to transfusion or donation.
              </p>
            </div>

            <div class="text-xs text-slate-500 flex items-center gap-2">
              ${icon('building', 'w-3.5 h-3.5 text-slate-400')}
              <span>Clinical Pathology Lab</span>
              <span>•</span>
              ${icon('clock', 'w-3.5 h-3.5 text-slate-400')}
              <span>Fast 4-hr turnaround</span>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500">Standard phlebotomy</span>
              <button
                onclick="window.openBookingModal('blood test')"
                class="px-5 py-2.5 bg-[#DC2626] hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Request Blood Test</span>
                ${icon('arrowRight', 'w-3.5 h-3.5')}
              </button>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: STATUS PANEL -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-black text-slate-900 tracking-tight">
              Submitted Appointments Status Panel
            </h2>
            <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              ${state.appointments.length} Total
            </span>
          </div>

          <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-5">
            <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
              <span class="font-bold">ℹ</span>
              <span>
                Requests booked here are transmitted instantly to hospital doctors in D2. When a doctor accepts, their confirmed clinic time slot appears right below with an emerald badge.
              </span>
            </div>

            ${state.appointments.length === 0 ? `
              <div class="py-12 text-center space-y-3">
                <div class="w-16 h-16 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200">
                  ${icon('calendar', 'w-8 h-8 text-slate-400')}
                </div>
                <h3 class="font-extrabold text-base text-slate-900">No Appointments Booked Yet</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto">
                  Click on any of the medical service cards on the left to schedule a consultation, diagnostic blood test, or report.
                </p>
              </div>
            ` : `
              <div class="space-y-3">
                ${state.appointments.map(apt => `
                  <div class="p-4 rounded-2xl border ${
                    apt.status === 'Accepted'
                      ? 'bg-emerald-50/60 border-emerald-300'
                      : 'bg-amber-50/60 border-amber-300'
                  } space-y-1.5 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="font-bold uppercase tracking-wider text-slate-700">${apt.service}</span>
                      <span class="px-2 py-0.5 rounded-full font-bold ${
                        apt.status === 'Accepted' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                      }">
                        ${apt.status}
                      </span>
                    </div>
                    <div class="font-bold text-sm text-slate-900">${apt.patientName}</div>
                    <div class="text-slate-500">Requested: ${apt.requestedDate} (${apt.requestedTime})</div>
                    ${apt.acceptedTimeSlot ? `
                      <div class="p-2.5 bg-white rounded-xl border border-emerald-300 text-emerald-900">
                        <strong class="text-emerald-700">Confirmed Slot:</strong> ${apt.acceptedTimeSlot}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// 11. PAGE: AUTH & PORTAL SELECTOR (Screenshots 9 & 10)
// =========================================================================
function renderAuthPage() {
    if (!state.currentUser) {
    state.currentUser = {
      id: '',
      name: '',
      email: '',
      role: 'user',
      phone: '',
      city: '',
      bloodGroup: 'O+',
      isVerified: false
    };
  }
  const bloodGroups = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  const isDoctor = state.portalTab === 'doctor';

  return `
    <div class="min-h-screen bg-[#F8F9FC] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-['Plus_Jakarta_Sans',sans-serif]">
      <!-- Top Portal Switcher (Screenshots 9 & 10) -->
      <div class="w-full max-w-xl space-y-3 mb-6">
        <div class="bg-white p-1 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-1">
          <button
            type="button"
            onclick="window.setPortalTab('doctor')"
            class="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isDoctor
                ? 'bg-[#1F2A6B] text-white shadow-xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-50'
            }"
          >
            ${icon('stethoscope', `w-4 h-4 ${isDoctor ? 'text-white' : 'text-[#1F2A6B]'}`)}
            <span>Admin & Doctor Login</span>
          </button>

          <button
            type="button"
            onclick="window.setPortalTab('user')"
            class="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !isDoctor
                ? 'bg-[#1F2A6B] text-white shadow-xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-50'
            }"
          >
            ${icon('user', `w-4 h-4 ${!isDoctor ? 'text-white' : 'text-red-600'}`)}
            <span>Patient & User Login</span>
          </button>
        </div>

        <p class="text-center text-xs text-slate-500">
          Select your role portal to sign in. Once inside, portals are strictly separated for medical security.
        </p>
      </div>

      <!-- Main Card Container -->
      <div class="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        ${isDoctor ? `
          <!-- DOCTOR SIGN IN (Screenshot 9) -->
          <div>
            <div class="bg-[#151D48] text-white p-6 sm:p-7">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    D1 – VERIFIED MEDICAL PORTAL
                  </span>
                  <h2 class="text-xl sm:text-2xl font-black mt-1">Doctor & Hospital Sign In</h2>
                </div>
                <span class="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                  ${icon('shieldCheck', 'w-3.5 h-3.5')}
                  <span>Verified Access</span>
                </span>
              </div>
            </div>

            <form onsubmit="window.handleDoctorAuthSubmit(event)" class="p-6 sm:p-7 space-y-4 text-xs">
              <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                ${icon('building', 'w-5 h-5 text-[#1F2A6B] shrink-0 mt-0.5')}
                <div class="text-slate-600">
                  <strong class="text-slate-900 block font-bold">Verified Clinical Authority</strong>
                  Doctors and hospitals sign in to review patient appointments, confirm available consultation time slots, and supervise blood logistics.
                </div>
              </div>

              <div>
                <label class="block font-bold uppercase tracking-wider text-slate-700 mb-1.5">INSTITUTION TYPE</label>
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" class="py-2 px-3 font-bold rounded-xl bg-[#151D48] text-white">Hospital</button>
                  <button type="button" class="py-2 px-3 font-bold rounded-xl bg-slate-50 text-slate-700 border border-slate-200">Verified Doctor</button>
                  <button type="button" class="py-2 px-3 font-bold rounded-xl bg-slate-50 text-slate-700 border border-slate-200">Blood Bank</button>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Doctor Email / Hospital ID</label>
                <input
                  type="text"
                  required
                  value="dr.vance@stjudemedical.org"
                  class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Doctor Password</label>
                <input
                  type="password"
                  required
                  value="••••••••••••"
                  class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Medical License #</label>
                  <input
                    type="text"
                    required
                    value="MD-94021-TX"
                    class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Hospital Facility Code</label>
                  <input
                    type="text"
                    required
                    value="FAC-STJUDE-409"
                    class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                  />
                </div>
              </div>

              <div class="pt-2">
                <button
                  type="submit"
                  class="w-full py-3.5 bg-[#1F2A6B] hover:bg-[#161f50] text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Enter Doctor Dashboard (D2)</span>
                  ${icon('arrowRight', 'w-4 h-4')}
                </button>
              </div>
            </form>
          </div>
        ` : `
          <!-- USER SIGN IN / REGISTER (Screenshot 10) -->
          <div>
            <div class="bg-[#151D48] text-white p-6 sm:p-7 text-center space-y-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-300 block">
                U1 – COMMUNITY CARE PORTAL
              </span>
              <h2 class="text-xl sm:text-2xl font-black">Create LifeDrop Account</h2>
              <p class="text-xs text-slate-300 max-w-md mx-auto">
                Request emergency blood, register donor availability, join blood groups, or book appointments.
              </p>

              <div class="inline-flex p-1 bg-[#1A2355] rounded-xl border border-white/10 text-xs font-bold mt-2">
                <button type="button" class="px-4 py-1.5 rounded-lg text-slate-300 hover:text-white">Sign In</button>
                <button type="button" class="px-4 py-1.5 rounded-lg bg-[#DC2626] text-white shadow-xs">Create Account</button>
              </div>
            </div>

            <form onsubmit="window.handleUserAuthSubmit(event)" class="p-6 sm:p-7 space-y-4 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  id="user-name-input"
                  type="text"
                  required
                  value="${state.currentUser.name || 'saran hari'}"
                  placeholder="e.g. Emily Watson"
                  class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    id="user-phone-input"
                    type="tel"
                    required
                    value="${state.currentUser.phone || '90809786556'}"
                    class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">City / Region</label>
                  <input
                    id="user-city-input"
                    type="text"
                    required
                    value="${state.currentUser.city || 'dindigul'}"
                    class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                  />
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="font-bold text-slate-700">Your Blood Group</label>
                  <span class="text-[11px] font-bold text-red-600">Important for Matching</span>
                </div>
                <div class="grid grid-cols-4 gap-2">
                  ${bloodGroups.map(bg => `
                    <button
                      type="button"
                      onclick="window.selectUserBloodGroup('${bg}')"
                      class="py-2 font-black rounded-xl border transition-all cursor-pointer font-mono ${
                        (state.currentUser.bloodGroup || 'O+') === bg
                          ? 'bg-[#DC2626] text-white border-[#DC2626]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }"
                    >
                      ${bg}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Account Password</label>
                <input
                  type="password"
                  required
                  value="••••••••••••"
                  class="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                />
              </div>

              <div class="pt-2">
                <button
                  type="submit"
                  class="w-full py-3.5 bg-[#1F2A6B] hover:bg-[#161f50] text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Create Account & Enter Portal</span>
                  ${icon('arrowRight', 'w-4 h-4')}
                </button>
              </div>
            </form>
          </div>
        `}
      </div>
    </div>
  `;
}

// =========================================================================
// 12. PAGE: DOCTOR DASHBOARD (D2)
// =========================================================================
function renderDoctorDashboard() {
  return `
    <div class="min-h-screen bg-[#F8F9FC] p-6 max-w-7xl mx-auto font-['Plus_Jakarta_Sans',sans-serif] space-y-6">
      <div class="bg-[#151D48] text-white rounded-3xl p-7 flex items-center justify-between shadow-xl">
        <div class="space-y-1">
          <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            D2 – DOCTOR & HOSPITAL CLINICAL QUEUE
          </span>
          <h1 class="text-2xl font-black text-white">Doctor Dashboard</h1>
          <p class="text-xs text-slate-300">Dr. Arthur Vance, MD • St. Jude General Hospital</p>
        </div>
        <button
          onclick="window.appLogout()"
          class="px-4 py-2 border border-white/20 hover:bg-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Logout
        </button>
      </div>

      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-slate-900">Patient Appointments to Review (U6 Dual Sync)</h2>
          <span class="text-xs font-mono font-bold text-slate-600">${state.appointments.length} Appointments</span>
        </div>

        ${state.appointments.length === 0 ? `
          <div class="py-12 text-center text-xs text-slate-500">
            No pending patient appointment requests. Submissions in U6 will appear here in real-time.
          </div>
        ` : `
          <div class="space-y-3">
            ${state.appointments.map(apt => `
              <div class="p-4 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div class="font-bold text-sm text-slate-900">${apt.patientName}</div>
                  <div class="text-slate-500">${apt.service} • Requested: ${apt.requestedDate} (${apt.requestedTime})</div>
                  ${apt.acceptedTimeSlot ? `<div class="text-emerald-700 font-bold mt-1">Confirmed: ${apt.acceptedTimeSlot}</div>` : ''}
                </div>
                <div>
                  ${apt.status === 'Accepted' ? `
                    <span class="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full">Accepted</span>
                  ` : `
                    <button
                      onclick="window.openTimeSlotModal('${apt.id}')"
                      class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Accept & Assign Slot
                    </button>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

// =========================================================================
// 13. MODALS (Screenshots 2 & 3)
// =========================================================================
function renderModals() {
  const bloodGroups = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  let html = '';

  // 1. EMERGENCY BLOOD REQUEST MODAL (Screenshot 2)
  if (state.showPatientRequestModal) {
    html += `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
          <div class="bg-[#E60000] text-white px-6 py-4 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-red-200 block">
                PATIENT FORM • REQUEST BLOOD
              </span>
              <h3 class="text-lg font-black text-white mt-0.5">Emergency Blood Request</h3>
            </div>
            <button onclick="window.closeModals()" class="text-white/80 hover:text-white cursor-pointer">
              ${icon('close', 'w-5 h-5')}
            </button>
          </div>

          <form onsubmit="window.submitPatientRequestForm(event)" class="p-6 space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Patient Full Name</label>
              <input
                id="req-patient-name"
                type="text"
                required
                value="${state.currentUser.name || 'saran hari'}"
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Blood Group Required</label>
                <select id="req-blood-group" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold font-mono">
                  ${bloodGroups.map(bg => `<option value="${bg}" ${bg === 'O+' ? 'selected' : ''}>${bg}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Units Needed (Pints / PRBC)</label>
                <input
                  id="req-units"
                  type="number"
                  min="1"
                  max="10"
                  value="1"
                  class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Hospital / Medical Center</label>
              <input
                id="req-hospital"
                type="text"
                required
                placeholder="e.g. Metro Hospital Trauma Center"
                value="St. Jude Emergency Center"
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Urgency Level</label>
                <select id="req-urgency" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-medium">
                  <option value="Emergency">Emergency (Immediate)</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Standard">Standard</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  id="req-phone"
                  type="tel"
                  required
                  value="${state.currentUser.phone || '90809786556'}"
                  class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Location / Address for Dispatch</label>
              <input
                id="req-location"
                type="text"
                required
                value="${state.currentUser.city || 'dindigul'}"
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Clinical Notes (optional)</label>
              <textarea
                id="req-notes"
                rows="2"
                placeholder="Specify condition..."
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              ></textarea>
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onclick="window.closeModals()"
                class="px-4 py-2 font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-5 py-2.5 bg-[#E60000] hover:bg-red-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                ${icon('droplet', 'w-3.5 h-3.5 text-white')}
                <span>Publish Request & View Donors (U3.1)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 2. REGISTER DONOR AVAILABILITY MODAL (Screenshot 3)
  if (state.showDonorAvailabilityModal) {
    html += `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
          <div class="bg-[#151D48] text-white px-6 py-4 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                DONOR FORM • WILLING TO DONATE
              </span>
              <h3 class="text-lg font-black text-white mt-0.5">Register Donor Availability</h3>
            </div>
            <button onclick="window.closeModals()" class="text-white/80 hover:text-white cursor-pointer">
              ${icon('close', 'w-5 h-5')}
            </button>
          </div>

          <form onsubmit="window.submitDonorAvailabilityForm(event)" class="p-6 space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Donor Full Name</label>
              <input
                id="dnr-name"
                type="text"
                required
                value="${state.currentUser.name || 'saran hari'}"
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Your Blood Group</label>
                <select id="dnr-blood-group" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold font-mono">
                  ${bloodGroups.map(bg => `<option value="${bg}" ${bg === 'O+' ? 'selected' : ''}>${bg}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Last Donation Date</label>
                <input
                  id="dnr-date"
                  type="date"
                  class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Availability Window</label>
                <select id="dnr-availability" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-medium">
                  <option value="Immediate">Immediate (Within 1 hour)</option>
                  <option value="Today">Today</option>
                  <option value="Within 24h">Within 24 hours</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Direct Phone / Cell</label>
                <input
                  id="dnr-phone"
                  type="tel"
                  required
                  value="${state.currentUser.phone || '90809786556'}"
                  class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Current Location / Neighborhood</label>
              <input
                id="dnr-location"
                type="text"
                required
                value="${state.currentUser.city || 'dindigul'}"
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F2A6B]"
              />
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onclick="window.closeModals()"
                class="px-4 py-2 font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-5 py-2.5 bg-[#151D48] hover:bg-[#0f1536] text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                ${icon('heartHandshake', 'w-3.5 h-3.5')}
                <span>Register & View Patient Requests (U3.2)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 3. APPOINTMENT BOOKING MODAL (U6)
  if (state.showBookingModal) {
    html += `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
          <div class="bg-[#151D48] text-white px-6 py-4 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                HOSPITAL APPOINTMENT BOOKING
              </span>
              <h3 class="text-lg font-black text-white mt-0.5 capitalize">${state.bookingServiceType}</h3>
            </div>
            <button onclick="window.closeModals()" class="text-white/80 hover:text-white cursor-pointer">
              ${icon('close', 'w-5 h-5')}
            </button>
          </div>

          <form onsubmit="window.submitBookingForm(event)" class="p-6 space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Patient Full Name</label>
              <input
                id="apt-name"
                type="text"
                required
                value="${state.currentUser.name || 'saran hari'}"
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Preferred Date</label>
                <input
                  id="apt-date"
                  type="date"
                  required
                  value="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}"
                  class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Preferred Time</label>
                <select id="apt-time" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">
                  <option value="10:30 AM">10:30 AM (Morning)</option>
                  <option value="02:00 PM">02:00 PM (Afternoon)</option>
                  <option value="04:30 PM">04:30 PM (Evening)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Hospital Facility</label>
              <input
                id="apt-hospital"
                type="text"
                value="St. Jude General Hospital"
                class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" onclick="window.closeModals()" class="px-4 py-2 font-bold text-slate-600">Cancel</button>
              <button type="submit" class="px-5 py-2.5 bg-[#151D48] text-white font-extrabold rounded-xl">
                Submit to Doctor Queue (D2)
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 4. DOCTOR TIME SLOT PICKER MODAL (D2)
  if (state.showTimeSlotModal) {
    html += `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 class="font-extrabold text-base text-slate-900">Assign Clinical Time Slot</h3>
            <button onclick="window.closeModals()" class="text-slate-400 font-bold">✕</button>
          </div>
          <div class="space-y-3 text-xs">
            <label class="block font-bold text-slate-700">Quick Slot Presets</label>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="window.selectPresetSlot('Today 02:30 PM - Bay 1')" class="p-2 border rounded-xl hover:bg-slate-50 text-left">Today 02:30 PM</button>
              <button onclick="window.selectPresetSlot('Tomorrow 10:30 AM - Room 204')" class="p-2 border rounded-xl hover:bg-slate-50 text-left font-bold text-emerald-800 bg-emerald-50">Tomorrow 10:30 AM</button>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Confirmed Slot Description</label>
              <input id="slot-input" type="text" value="${state.assignedSlot}" class="w-full p-2 border rounded-xl" />
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t">
            <button onclick="window.closeModals()" class="px-3 py-1.5 text-xs text-slate-600">Cancel</button>
            <button onclick="window.confirmTimeSlot()" class="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl">Confirm Slot</button>
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

// =========================================================================
// 14. EVENT HANDLERS & GLOBAL WINDOW HELPERS
// =========================================================================
window.appNav = function(page) {
  navigateTo(page);
};

window.appLogout = function() {
  state.currentUser = null;
  setLocal(STORAGE.USER, null);
  navigateTo('auth');
};

window.setPortalTab = function(tab) {
  state.portalTab = tab;
  renderApp();
};

window.selectUserBloodGroup = function(bg) {
  state.currentUser.bloodGroup = bg;
  renderApp();
};

window.openPatientModal = function() {
  state.showPatientRequestModal = true;
  renderApp();
};

window.openDonorModal = function() {
  state.showDonorAvailabilityModal = true;
  renderApp();
};

window.openBookingModal = function(serviceType) {
  state.bookingServiceType = serviceType;
  state.showBookingModal = true;
  renderApp();
};

window.closeModals = function() {
  state.showPatientRequestModal = false;
  state.showDonorAvailabilityModal = false;
  state.showBookingModal = false;
  state.showTimeSlotModal = false;
  renderApp();
};

window.setPatientBloodFilter = function(bg) {
  state.patientBloodFilter = bg;
  renderApp();
};

window.setDonorUrgencyFilter = function(urg) {
  state.donorUrgencyFilter = urg;
  renderApp();
};

window.setMatchingTab = function(tab) {
  state.matchingTab = tab;
  renderApp();
};

window.setMatchStep = function(stepNum) {
  if (state.matches[0]) {
    state.matches[0].currentStep = stepNum;
    state.matches[0].estimatedArrivalMins = Math.max(0, (5 - stepNum) * 4);
    setLocal(STORAGE.MATCHES, state.matches);
    renderApp();
  }
};

window.submitPatientRequestForm = function(e) {
  e.preventDefault();
  const name = document.getElementById('req-patient-name')?.value || 'saran hari';
  const bg = document.getElementById('req-blood-group')?.value || 'O+';
  const units = Number(document.getElementById('req-units')?.value || 1);
  const hospital = document.getElementById('req-hospital')?.value || 'St. Jude Hospital';
  const urgency = document.getElementById('req-urgency')?.value || 'Emergency';
  const phone = document.getElementById('req-phone')?.value || '90809786556';
  const location = document.getElementById('req-location')?.value || 'dindigul';
  const notes = document.getElementById('req-notes')?.value || '';

  const newReq = {
    id: `req-${Date.now()}`,
    patientName: name,
    bloodGroup: bg,
    units,
    hospital,
    urgency,
    contactNumber: phone,
    location,
    city: location,
    notes,
    status: 'Open'
  };

  state.patientRequests.unshift(newReq);
  setLocal(STORAGE.REQUESTS, state.patientRequests);
  state.showPatientRequestModal = false;
  navigateTo('patient-view');
};

window.submitDonorAvailabilityForm = function(e) {
  e.preventDefault();
  const name = document.getElementById('dnr-name')?.value || 'saran hari';
  const bg = document.getElementById('dnr-blood-group')?.value || 'O+';
  const date = document.getElementById('dnr-date')?.value || '2024-08-01';
  const availability = document.getElementById('dnr-availability')?.value || 'Immediate';
  const phone = document.getElementById('dnr-phone')?.value || '90809786556';
  const location = document.getElementById('dnr-location')?.value || 'dindigul';

  const newDonor = {
    id: `dnr-${Date.now()}`,
    donorName: name,
    bloodGroup: bg,
    lastDonationDate: date,
    availability,
    phone,
    location,
    city: location,
    distanceKm: 0.8
  };

  state.donors.unshift(newDonor);
  setLocal(STORAGE.DONORS, state.donors);
  state.showDonorAvailabilityModal = false;
  navigateTo('donor-view');
};

window.submitBookingForm = function(e) {
  e.preventDefault();
  const name = document.getElementById('apt-name')?.value || 'saran hari';
  const date = document.getElementById('apt-date')?.value || '';
  const time = document.getElementById('apt-time')?.value || '10:30 AM';
  const hospital = document.getElementById('apt-hospital')?.value || 'St. Jude General Hospital';

  const newApt = {
    id: `apt-${Date.now()}`,
    patientName: name,
    service: state.bookingServiceType,
    requestedDate: date,
    requestedTime: time,
    hospital,
    status: 'Pending'
  };

  state.appointments.unshift(newApt);
  setLocal(STORAGE.APPOINTMENTS, state.appointments);
  state.showBookingModal = false;
  renderApp();
};

window.handleCreateGroup = function(e) {
  e.preventDefault();
  const name = document.getElementById('group-name-input')?.value || '';
  const cat = document.getElementById('group-cat-input')?.value || 'Emergency Vanguard';
  const desc = document.getElementById('group-desc-input')?.value || '';

  if (!name.trim()) return;

  const newGrp = {
    id: `grp-${Date.now()}`,
    name,
    category: cat,
    description: desc || 'Certified local blood network responding to hospital emergencies.',
    memberCount: 1
  };

  state.groups.unshift(newGrp);
  setLocal(STORAGE.GROUPS, state.groups);
  renderApp();
};

window.handleDoctorAuthSubmit = function(e) {
  e.preventDefault();
  state.currentUser = {
    id: 'doc-1',
    name: 'Dr. Arthur Vance, MD',
    email: 'dr.vance@stjudemedical.org',
    role: 'doctor',
    hospitalName: 'St. Jude General Hospital',
    licenseNumber: 'MD-94021-TX'
  };
  setLocal(STORAGE.USER, state.currentUser);
  navigateTo('doctor');
};

window.handleUserAuthSubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById('user-name-input')?.value || 'saran hari';
  const phone = document.getElementById('user-phone-input')?.value || '90809786556';
  const city = document.getElementById('user-city-input')?.value || 'dindigul';

  state.currentUser = {
    id: `usr-${Date.now()}`,
    name,
    role: 'user',
    phone,
    city,
    bloodGroup: state.currentUser.bloodGroup || 'O+',
    isVerified: true
  };
  setLocal(STORAGE.USER, state.currentUser);
  navigateTo('home');
};

window.openTimeSlotModal = function(aptId) {
  state.selectedApptForSlot = aptId;
  state.showTimeSlotModal = true;
  renderApp();
};

window.selectPresetSlot = function(slotStr) {
  state.assignedSlot = slotStr;
  const input = document.getElementById('slot-input');
  if (input) input.value = slotStr;
};

window.confirmTimeSlot = function() {
  const input = document.getElementById('slot-input');
  const slotVal = input ? input.value : state.assignedSlot;
  if (state.selectedApptForSlot) {
    const apt = state.appointments.find(a => a.id === state.selectedApptForSlot);
    if (apt) {
      apt.status = 'Accepted';
      apt.acceptedTimeSlot = slotVal;
      setLocal(STORAGE.APPOINTMENTS, state.appointments);
    }
  }
  state.showTimeSlotModal = false;
  renderApp();
};

window.requestDonorMatch = function(donorId) {
  navigateTo('matching');
};

window.acceptPatientRequest = function(reqId) {
  navigateTo('matching');
};

function attachAuthEvents() {}
function attachDoctorEvents() {}
function attachAppEvents() {}

// Initial Bootstrap on Page Load
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  startFirebaseRealtimeSync();
});
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  renderApp();
  startFirebaseRealtimeSync();
}

export { connectFirebaseDatabase, state, renderApp };
