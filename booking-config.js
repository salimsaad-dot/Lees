// Lee's Beauty Studio · booking settings
// ------------------------------------------------------------------
// 1) FIREBASE: paste the web-app config from the Firebase console
//    (Project settings → Your apps → Web app → "firebaseConfig").
//    While apiKey is empty the site runs in DEMO MODE: slots work,
//    but bookings are only saved in the visitor's own browser.
// 2) SCHEDULE: Lisa's working days and appointment start times.
// ------------------------------------------------------------------

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDWpJw9i8Rr9jN4lrU92Opq5Ishk-Ny3VI",
  authDomain: "lees-beauty-studio.firebaseapp.com",
  projectId: "lees-beauty-studio",
  storageBucket: "lees-beauty-studio.firebasestorage.app",
  messagingSenderId: "809450705282",
  appId: "1:809450705282:web:4dab417ada604d94dd7f9b",
};

// 3) EMAIL ALERT: Lisa gets an email (→ phone notification) for every booking.
//    Free EmailJS account (emailjs.com): Email Services → service ID,
//    Email Templates → template ID, Account → Public key. Empty = no alert.
export const EMAIL_ALERT = {
  serviceId: "service_c4aimnj",
  templateId: "template_ihp5lcn",
  publicKey: "2xxYYCbrZCohZObtM",
};

export const SCHEDULE = {
  // Ghana is UTC+0 all year (no daylight saving), so times here are Ghana time.
  // TODO: confirm with Lisa. 0 = Sunday … 6 = Saturday.
  openDays: [1, 2, 3, 4, 5, 6],
  // Each start time is one appointment slot; one client per slot.
  // TODO: confirm slot length / times with Lisa (bridal may need two slots).
  slots: ["08:00", "10:00", "12:00", "14:00", "16:00"],
  daysAhead: 90,      // how far ahead clients can book (FAQ: brides book 2–3 months ahead)
  minNoticeHours: 2,  // no booking a slot that starts sooner than this
};

// ---- Testing only: http://localhost…/?emulator=1 talks to the local Firebase emulator ----
const params = new URLSearchParams(location.search);
export const USE_EMULATOR =
  params.has("emulator") && ["localhost", "127.0.0.1"].includes(location.hostname);
if (USE_EMULATOR) {
  Object.assign(FIREBASE_CONFIG, { apiKey: "demo-key", authDomain: "demo-lees.firebaseapp.com", projectId: "demo-lees", appId: "demo" });
}

export const FIREBASE_READY = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
