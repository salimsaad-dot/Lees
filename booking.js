// Lee's Beauty Studio · booking form (free times → lock the slot → WhatsApp details)
import {
  todayISO, lastBookableISO, isOpenDay, slotsFor, timeLabel, dayLabel,
  watchTaken, book, SlotTakenError,
} from "./booking-store.js";

const WHATSAPP_NUMBER = "233508690377";

const form = document.getElementById("bookingForm");
const serviceSel = document.getElementById("service");
const dateInput = document.getElementById("date");
const slotsBox = document.getElementById("slots");
const areaField = document.getElementById("areaField");
const areaInput = document.getElementById("area");
const errorEl = document.getElementById("formError");
const bookBtn = document.getElementById("bookBtn");
const booked = document.getElementById("booked");

dateInput.min = todayISO();
dateInput.max = lastBookableISO();

/* ---------- Service cards pre-select the service ---------- */
document.querySelectorAll("[data-service]").forEach((link) =>
  link.addEventListener("click", () => { serviceSel.value = link.dataset.service; serviceSel.classList.remove("invalid"); })
);
serviceSel.addEventListener("change", () => serviceSel.classList.remove("invalid"));
form.elements.namedItem("name").addEventListener("input", (e) => e.target.classList.remove("invalid"));
form.phone.addEventListener("input", () => form.phone.classList.remove("invalid"));
areaInput.addEventListener("input", () => areaInput.classList.remove("invalid"));

/* ---------- Home service shows "your area" ---------- */
form.querySelectorAll('input[name="where"]').forEach((r) =>
  r.addEventListener("change", () => {
    const home = form.where.value === "Home service";
    areaField.classList.toggle("is-open", home);
    areaField.inert = !home;
    areaField.setAttribute("aria-hidden", String(!home));
    areaInput.required = home;
    if (!home) areaInput.classList.remove("invalid");
  })
);

/* ---------- Free times for the chosen day (live: updates if someone books meanwhile) ---------- */
let stopWatching = () => {};
let chosenTime = "";

const note = (text) => { slotsBox.innerHTML = `<p class="slots-note">${text}</p>`; };

function renderSlots(date, taken) {
  const list = slotsFor(date);
  const free = list.filter((s) => !s.tooSoon && !taken.has(s.time));
  if (!free.length) {
    chosenTime = "";
    note(list.every((s) => s.tooSoon) ? "No times left today. Please pick another day." : "This day is fully booked. Please pick another day.");
    return;
  }
  if (chosenTime && !free.some((s) => s.time === chosenTime)) {
    chosenTime = "";
    errorEl.textContent = "Sorry, the time you chose was just taken. Please pick another.";
  }
  slotsBox.innerHTML = `<div class="slot-grid">${list.map(({ time, tooSoon }) => {
    const off = tooSoon || taken.has(time);
    return `<label class="slot${off ? " is-off" : ""}">
      <input type="radio" name="time" value="${time}"${off ? " disabled" : ""}${time === chosenTime ? " checked" : ""} />
      <span>${timeLabel(time)}${off ? `<small>${tooSoon ? "Too soon" : "Taken"}</small>` : ""}</span>
    </label>`;
  }).join("")}</div>`;
}

function loadSlots() {
  stopWatching();
  chosenTime = "";
  dateInput.classList.remove("invalid");
  const date = dateInput.value;
  if (!date) return note("Pick a date to see the free times.");
  if (date < dateInput.min || date > dateInput.max) return note("Please pick a date within the next three months.");
  if (!isOpenDay(date)) return note(`Lisa is closed on ${dayLabel(date, { weekday: "long" })}s. Please pick another day.`);
  slotsBox.setAttribute("aria-busy", "true");
  note("Checking free times…");
  stopWatching = watchTaken(
    date,
    (taken) => { slotsBox.removeAttribute("aria-busy"); renderSlots(date, taken); },
    () => { slotsBox.removeAttribute("aria-busy"); note("Couldn't load the times. Check your connection, or message Lisa on WhatsApp."); }
  );
}
dateInput.addEventListener("change", loadSlots);
dateInput.addEventListener("input", loadSlots);

slotsBox.addEventListener("change", (e) => {
  if (e.target.name === "time") { chosenTime = e.target.value; slotsBox.classList.remove("invalid"); errorEl.textContent = ""; }
});

/* ---------- Book ---------- */
let busy = false;
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  errorEl.textContent = "";
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));

  const missing = [...form.querySelectorAll("input[required], select[required]")].filter((el) => !el.value.trim());
  if (!chosenTime && dateInput.value) {
    missing.push(slotsBox);
    missing.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }
  if (missing.length) {
    missing.forEach((el) => el.classList.add("invalid"));
    (missing[0] === slotsBox ? slotsBox.querySelector("input:not(:disabled)") || dateInput : missing[0]).focus();
    errorEl.textContent = missing.length === 1 && missing[0] === slotsBox ? "Please choose a time." : "Please fill in the highlighted fields.";
    return;
  }
  const phone = form.phone.value.trim();
  if (phone.replace(/\D/g, "").length < 9) {
    form.phone.classList.add("invalid");
    form.phone.focus();
    errorEl.textContent = "Please check your WhatsApp number.";
    return;
  }

  const where = form.where.value;
  const data = {
    date: dateInput.value,
    time: chosenTime,
    service: serviceSel.value,
    where,
    area: where === "Home service" ? areaInput.value.trim() : "",
    name: form.elements.namedItem("name").value.trim(),
    phone,
    notes: form.notes.value.trim(),
  };

  busy = true;
  bookBtn.disabled = true;
  bookBtn.textContent = "Booking…";
  try {
    await book(data);
    showBooked(data);
  } catch (err) {
    if (err instanceof SlotTakenError) {
      errorEl.textContent = "Sorry, someone just booked that time. Please pick another.";
      loadSlots();
    } else {
      console.error(err);
      errorEl.textContent = "Something went wrong. Please try again, or message Lisa on WhatsApp.";
    }
  } finally {
    busy = false;
    bookBtn.disabled = false;
    bookBtn.textContent = "Book this time";
  }
});

/* ---------- After booking: confirmation + WhatsApp message (a real link, so phones never block it) ---------- */
function showBooked(d) {
  stopWatching();
  const when = `${dayLabel(d.date)} at ${timeLabel(d.time)}`;
  const lines = [
    "Hi Lisa! I just booked an appointment on your website.",
    "",
    `*Service:* ${d.service}`,
    `*When:* ${when}`,
    `*Where:* ${d.where}${d.area ? ` (${d.area})` : ""}`,
    `*Name:* ${d.name}`,
  ];
  if (d.notes) lines.push(`*Notes:* ${d.notes}`);
  document.getElementById("bookedWhen").textContent = `${d.service} · ${when}`;
  document.getElementById("bookedWa").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  form.hidden = true;
  booked.hidden = false;
  booked.focus({ preventScroll: true });
  booked.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}

document.getElementById("bookAgain").addEventListener("click", () => {
  form.reset();
  areaField.classList.remove("is-open");
  areaField.inert = true;
  areaField.setAttribute("aria-hidden", "true");
  areaInput.required = false;
  chosenTime = "";
  note("Pick a date to see the free times.");
  booked.hidden = true;
  form.hidden = false;
  serviceSel.focus();
});
