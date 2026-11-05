// Lee's Beauty Studio
const WHATSAPP_NUMBER = "233508690377"; // international format, no "+" or leading 0

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;

  /* ---------- Header: solid background after scrolling ---------- */
  const header = document.getElementById("siteHeader");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav");
  const setMenu = (open) => {
    body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Portfolio filter ---------- */
  const chips = document.querySelectorAll(".chip");
  const shots = [...document.querySelectorAll(".shot")];
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      const f = chip.dataset.filter;
      shots.forEach((s) => s.classList.toggle("is-hidden", f !== "all" && s.dataset.cat !== f));
    });
  });

  /* ---------- Lightbox ---------- */
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  let current = 0;
  const visibleShots = () => shots.filter((s) => !s.classList.contains("is-hidden"));
  const show = (i) => {
    const list = visibleShots();
    current = (i + list.length) % list.length;
    const img = list[current].querySelector("img");
    lbImg.src = img.src;
    lbImg.alt = img.alt;
  };
  shots.forEach((s) => {
    s.tabIndex = 0;
    s.setAttribute("role", "button");
    const open = () => { show(visibleShots().indexOf(s)); lb.showModal(); };
    s.addEventListener("click", open);
    s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  lb.addEventListener("click", (e) => {
    const action = e.target.closest("[data-lb]")?.dataset.lb;
    if (action === "close" || e.target === lb) lb.close();
    if (action === "prev") show(current - 1);
    if (action === "next") show(current + 1);
  });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  // Swipe on phones
  let touchX = null;
  lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  /* ---------- Before / After slider ---------- */
  const ba = document.getElementById("beforeAfter");
  if (ba) {
    const range = ba.querySelector(".ba-range");
    range.addEventListener("input", () => ba.style.setProperty("--pos", range.value + "%"));
  }

  /* ---------- Booking form → WhatsApp ---------- */
  const form = document.getElementById("bookingForm");
  const serviceSel = document.getElementById("service");
  const dateInput = document.getElementById("date");
  const areaField = document.getElementById("areaField");
  const areaInput = document.getElementById("area");
  const errorEl = document.getElementById("formError");

  // No past dates
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  dateInput.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // "Book" links on service cards pre-select that service
  document.querySelectorAll("[data-service]").forEach((link) => {
    link.addEventListener("click", () => { serviceSel.value = link.dataset.service; });
  });

  // Show "area" only for home service
  form.querySelectorAll('input[name="where"]').forEach((r) => {
    r.addEventListener("change", () => {
      const home = form.where.value === "Home service";
      areaField.hidden = !home;
      areaInput.required = home;
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));

    const required = [...form.querySelectorAll("[required]")].filter((el) => !el.value.trim());
    if (required.length) {
      required.forEach((el) => el.classList.add("invalid"));
      required[0].focus();
      errorEl.textContent = "Please fill in the highlighted fields.";
      return;
    }

    const d = new Date(dateInput.value + "T00:00");
    const niceDate = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    const where = form.where.value;

    const lines = [
      "Hi Lisa! I'd like to book an appointment at Lee's Beauty Studio.",
      "",
      `*Service:* ${serviceSel.value}`,
      `*Date:* ${niceDate}`,
      `*Time:* ${form.time.value}`,
      `*Where:* ${where}${where === "Home service" ? ` (${areaInput.value.trim()})` : ""}`,
      `*Name:* ${form.elements.namedItem("name").value.trim()}`,
    ];
    const notes = form.notes.value.trim();
    if (notes) lines.push(`*Notes:* ${notes}`);

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
  });

  /* ---------- Footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
});
