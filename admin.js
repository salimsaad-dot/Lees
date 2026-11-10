// Lee's Beauty Studio · Lisa's bookings page
import {
  DEMO, SCHEDULE, todayISO, lastBookableISO, isOpenDay, slotsFor, timeLabel, dayLabel,
  onAuth, signIn, signOut, sendReset, watchUpcoming, freeSlot, blockTimes, watchTaken,
} from "./booking-store.js";

const $ = (id) => document.getElementById(id);
const msg = $("msg"), login = $("login"), panel = $("panel"), list = $("list");
// Client-typed text is never trusted as HTML
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// 024 123 4567 / +233 24… → 233241234567 (for wa.me and tel:)
const intl = (p) => { const d = String(p).replace(/\D/g, ""); return d.startsWith("0") ? "233" + d.slice(1) : d; };

if (DEMO) {
  msg.textContent = "This page isn't connected yet. Once the booking database is set up, Lisa signs in here to see her bookings.";
} else {
  let stop = () => {};
  onAuth((user) => {
    stop();
    $("signOut").hidden = !user;
    login.hidden = !!user;
    panel.hidden = true;
    msg.textContent = user ? "Loading bookings…" : "";
    if (user) watchUpcoming(render).then((u) => (stop = u));
  }).catch(() => (msg.textContent = "Couldn't connect. Check your internet and refresh."));
}

/* ---------- Sign in / out ---------- */
login.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("loginError");
  err.textContent = "";
  try {
    await signIn($("email").value.trim(), $("password").value);
    $("password").value = "";
  } catch (x) {
    err.textContent = /invalid|wrong|not-found|credential/.test(x.code || "") ? "That email or password isn't right." : "Couldn't sign in. Check your internet and try again.";
  }
});
$("forgot").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const err = $("loginError");
  if (!email) { err.textContent = "Type your email above first, then tap this again."; $("email").focus(); return; }
  try { await sendReset(email); err.textContent = "If that email has an account, a reset link is on its way."; }
  catch { err.textContent = "If that email has an account, a reset link is on its way."; }
});
$("signOut").addEventListener("click", () => signOut());

/* ---------- Upcoming list ---------- */
function render(items, error) {
  if (error) {
    panel.hidden = true;
    msg.textContent = error.code === "permission-denied"
      ? "This account can't see bookings. Ask Salim to give it access."
      : "Couldn't load bookings. Check your internet and refresh.";
    return;
  }
  msg.textContent = "";
  panel.hidden = false;
  const today = todayISO();
  const nowMs = Date.now();
  const upcoming = items.filter((s) => new Date(`${s.date}T${s.time}:00Z`).getTime() > nowMs - 3 * 3600e3);
  const booked = upcoming.filter((s) => s.kind === "booked");
  const todayCount = booked.filter((s) => s.date === today).length;
  $("count").textContent = `${booked.length} booked · ${todayCount} today`;

  if (!upcoming.length) {
    list.innerHTML = `<p class="empty">No bookings yet. New ones appear here by themselves.</p>`;
    return;
  }
  const byDay = Map.groupBy ? Map.groupBy(upcoming, (s) => s.date) : upcoming.reduce((m, s) => m.set(s.date, [...(m.get(s.date) || []), s]), new Map());
  list.innerHTML = [...byDay].map(([date, slots]) => `
    <div class="day${date === today ? " is-today" : ""}">
      <h3>${esc(dayLabel(date, { weekday: "long", day: "numeric", month: "long" }))}</h3>
      ${slots.map(card).join("")}
    </div>`).join("");
}

function card(s) {
  const time = `<div class="appt-time">${timeLabel(s.time)}</div>`;
  if (s.kind === "blocked") {
    return `<div class="appt is-blocked">${time}<div class="appt-main">
      <span class="appt-title">Blocked</span>
      <div class="appt-actions"><button type="button" data-free="${esc(s.id)}" data-what="unblock">Unblock</button></div>
    </div></div>`;
  }
  const b = s.booking;
  if (!b) return `<div class="appt">${time}<div class="appt-main"><span class="appt-title">Booked</span><span class="appt-meta">Loading details…</span></div></div>`;
  const wa = intl(b.phone);
  return `<div class="appt">${time}<div class="appt-main">
    <span class="appt-title">${esc(b.service)} · ${esc(b.name)}</span>
    <span class="appt-meta">${esc(b.where)}${b.area ? ` · ${esc(b.area)}` : ""} · ${esc(b.phone)}</span>
    ${b.notes ? `<span class="appt-notes">${esc(b.notes)}</span>` : ""}
    <div class="appt-actions">
      <a href="https://wa.me/${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Message</a>
      <a href="tel:+${wa}"><i class="fa-solid fa-phone" aria-hidden="true"></i> Call</a>
      <button type="button" class="danger" data-free="${esc(s.id)}" data-what="cancel" data-name="${esc(b.name)}">Cancel booking</button>
    </div>
  </div></div>`;
}

list.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-free]");
  if (!btn) return;
  const q = btn.dataset.what === "cancel"
    ? `Cancel ${btn.dataset.name}'s booking? The time becomes free on the website again.`
    : "Unblock this time? It becomes free on the website again.";
  if (!confirm(q)) return;
  btn.disabled = true;
  try { await freeSlot(btn.dataset.free); }
  catch { btn.disabled = false; alert("Couldn't do that. Check your internet and try again."); }
});

/* ---------- Block time off ---------- */
const blockDate = $("blockDate"), blockSlots = $("blockSlots"), blockError = $("blockError");
blockDate.min = todayISO();
blockDate.max = lastBookableISO();
let stopBlockWatch = () => {};

function loadBlock() {
  stopBlockWatch();
  blockError.textContent = "";
  const date = blockDate.value;
  if (!date) { blockSlots.innerHTML = `<p class="slots-note">Pick a day first.</p>`; return; }
  if (!isOpenDay(date)) { blockSlots.innerHTML = `<p class="slots-note">You're closed that day, so nobody can book it.</p>`; return; }
  stopBlockWatch = watchTaken(date, (taken) => {
    blockSlots.innerHTML = slotsFor(date).map(({ time }) => {
      const off = taken.has(time);
      return `<label class="slot${off ? " is-off" : ""}"><input type="checkbox" value="${time}"${off ? " disabled" : ""} />
        <span>${timeLabel(time)}${off ? "<small>Taken</small>" : ""}</span></label>`;
    }).join("");
  });
}
blockDate.addEventListener("change", loadBlock);

async function doBlock(all) {
  blockError.textContent = "";
  const date = blockDate.value;
  if (!date) { blockError.textContent = "Pick a day first."; blockDate.focus(); return; }
  const times = all ? SCHEDULE.slots : [...blockSlots.querySelectorAll("input:checked")].map((i) => i.value);
  if (!times.length) { blockError.textContent = "Tick the times to block, or use “Block whole day”."; return; }
  try {
    const n = await blockTimes(date, times);
    blockError.textContent = n ? "" : "Those times are already taken.";
  } catch {
    blockError.textContent = "Couldn't block those times. Check your internet and try again.";
  }
}
$("blockSel").addEventListener("click", () => doBlock(false));
$("blockDay").addEventListener("click", () => doBlock(true));
