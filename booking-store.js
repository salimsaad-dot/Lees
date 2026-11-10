// Lee's Beauty Studio · booking data (shared by the site and Lisa's admin page)
//
// How a slot is "locked": every slot has one document, slots/2026-11-14_1000.
// Booking creates it inside a transaction; if someone else got there first the
// transaction fails and the visitor is asked to pick another time. Database
// rules (firestore.rules) also refuse to overwrite an existing slot.
// Public `slots` docs hold no personal details; names and numbers live in
// `bookings`, which only Lisa can read.

import { FIREBASE_CONFIG, FIREBASE_READY, SCHEDULE, USE_EMULATOR } from "./booking-config.js";

export { SCHEDULE, FIREBASE_READY };
export const DEMO = !FIREBASE_READY;

/* ---------- Slot maths (Ghana = UTC, so UTC dates are Ghana dates) ---------- */
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDaysISO = (iso, n) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const slotId = (date, time) => `${date}_${time.replace(":", "")}`;
export const slotStart = (date, time) => new Date(`${date}T${time}:00Z`);
export const isOpenDay = (date) => SCHEDULE.openDays.includes(new Date(date + "T12:00:00Z").getUTCDay());
export const lastBookableISO = () => addDaysISO(todayISO(), SCHEDULE.daysAhead);

/** Slots for a day: { time, tooSoon } (tooSoon = already started / inside the notice period) */
export function slotsFor(date) {
  const cutoff = Date.now() + SCHEDULE.minNoticeHours * 3600e3;
  return SCHEDULE.slots.map((time) => ({ time, tooSoon: slotStart(date, time).getTime() < cutoff }));
}

export function timeLabel(time) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function dayLabel(date, opts = { weekday: "long", day: "numeric", month: "long" }) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

export class SlotTakenError extends Error {
  constructor() { super("That time has just been taken."); this.code = "taken"; }
}

/* ---------- Firebase (loaded only when configured) ---------- */
const V = "10.12.2";
let fbPromise;
function firebase() {
  fbPromise ??= (async () => {
    const [{ initializeApp }, fs, au] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    const db = fs.getFirestore(app);
    const auth = au.getAuth(app);
    if (USE_EMULATOR) {
      fs.connectFirestoreEmulator(db, "127.0.0.1", 8080);
      au.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
    return { fs, au, db, auth };
  })();
  return fbPromise;
}

/* ---------- Demo mode (no Firebase yet): saved in this browser only ---------- */
const DEMO_KEY = "lees-demo-slots";
const demoRead = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || {}; } catch { return {}; } };
const demoWrite = (o) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(o)); } catch {} };
// A couple of sample "taken" slots per day, so the pitch shows how full days look
function demoSampleTaken(date) {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const n = SCHEDULE.slots.length;
  return new Set([SCHEDULE.slots[h % n], SCHEDULE.slots[(h >> 3) % n]]);
}

/* ---------- Public API (booking form) ---------- */

/** Calls cb(Set of taken "HH:MM") now and whenever it changes. Returns an unsubscribe function. */
export function watchTaken(date, cb, onError = () => {}) {
  if (DEMO) {
    const taken = demoSampleTaken(date);
    Object.values(demoRead()).forEach((s) => s.date === date && taken.add(s.time));
    cb(taken);
    return () => {};
  }
  let unsub = () => {}, cancelled = false;
  firebase().then(({ fs, db }) => {
    if (cancelled) return;
    const q = fs.query(fs.collection(db, "slots"), fs.where("date", "==", date));
    unsub = fs.onSnapshot(q, (snap) => cb(new Set(snap.docs.map((d) => d.data().time))), onError);
  }, onError);
  return () => { cancelled = true; unsub(); };
}

/** Books a slot. Rejects with SlotTakenError if it's gone. */
export async function book({ date, time, service, where, area, name, phone, notes }) {
  const details = { date, time, service, where, area, name, phone, notes };
  if (DEMO) {
    const all = demoRead(), id = slotId(date, time);
    if (all[id] || demoSampleTaken(date).has(time)) throw new SlotTakenError();
    all[id] = { date, time, kind: "booked" };
    demoWrite(all);
    return;
  }
  const { fs, db } = await firebase();
  const id = slotId(date, time);
  const slotRef = fs.doc(db, "slots", id);
  const bookingRef = fs.doc(db, "bookings", id);
  try {
    await fs.runTransaction(db, async (tx) => {
      if ((await tx.get(slotRef)).exists()) throw new SlotTakenError();
      const now = fs.serverTimestamp();
      tx.set(slotRef, { date, time, kind: "booked", start: fs.Timestamp.fromDate(slotStart(date, time)), createdAt: now });
      tx.set(bookingRef, { ...details, createdAt: now });
    });
  } catch (e) {
    // permission-denied here almost always means the slot was created a moment ago
    if (e instanceof SlotTakenError || e?.code === "permission-denied" || e?.code === "aborted") throw new SlotTakenError();
    throw e;
  }
}

/* ---------- Admin API (Lisa's page) ---------- */

export async function onAuth(cb) {
  const { au, auth } = await firebase();
  return au.onAuthStateChanged(auth, cb);
}
export async function signIn(email, password) {
  const { au, auth } = await firebase();
  return au.signInWithEmailAndPassword(auth, email, password);
}
export async function signOut() {
  const { au, auth } = await firebase();
  return au.signOut(auth);
}
export async function sendReset(email) {
  const { au, auth } = await firebase();
  return au.sendPasswordResetEmail(auth, email);
}

/** Live list of upcoming slots (booked + blocked) merged with booking details. cb(items, error) */
export async function watchUpcoming(cb) {
  const { fs, db } = await firebase();
  const from = todayISO();
  let slots = [], bookings = new Map();
  const emit = () => cb(slots.map((s) => ({ ...s, booking: bookings.get(s.id) || null })));
  const u1 = fs.onSnapshot(
    fs.query(fs.collection(db, "slots"), fs.where("date", ">=", from)),
    (snap) => { slots = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)); emit(); },
    (e) => cb(null, e)
  );
  const u2 = fs.onSnapshot(
    fs.query(fs.collection(db, "bookings"), fs.where("date", ">=", from)),
    (snap) => { bookings = new Map(snap.docs.map((d) => [d.id, d.data()])); emit(); },
    (e) => cb(null, e)
  );
  return () => { u1(); u2(); };
}

/** Cancel a booking or remove a block: frees the slot again. */
export async function freeSlot(id) {
  const { fs, db } = await firebase();
  const batch = fs.writeBatch(db);
  batch.delete(fs.doc(db, "bookings", id));
  batch.delete(fs.doc(db, "slots", id));
  await batch.commit();
}

/** Block times (walk-ins, days off). Skips times that are already taken. */
export async function blockTimes(date, times) {
  const { fs, db } = await firebase();
  const batch = fs.writeBatch(db);
  const existing = await fs.getDocs(fs.query(fs.collection(db, "slots"), fs.where("date", "==", date)));
  const taken = new Set(existing.docs.map((d) => d.data().time));
  let n = 0;
  for (const time of times) {
    if (taken.has(time)) continue;
    batch.set(fs.doc(db, "slots", slotId(date, time)), {
      date, time, kind: "blocked", start: fs.Timestamp.fromDate(slotStart(date, time)), createdAt: fs.serverTimestamp(),
    });
    n++;
  }
  if (n) await batch.commit();
  return n;
}
