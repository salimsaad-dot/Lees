// Lee's Beauty Studio

// Photos fade in once downloaded (no pop-in on slow mobile data). Already-cached ones show at once.
document.querySelectorAll(".fade-img, .arch-img").forEach((img) => {
  const show = () => img.classList.add("loaded");
  if (img.complete) {
    img.style.transition = "none";
    show();
    requestAnimationFrame(() => requestAnimationFrame(() => (img.style.transition = "")));
  } else {
    img.addEventListener("load", show, { once: true });
    img.addEventListener("error", show, { once: true });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const EASE = "cubic-bezier(.22, .8, .3, 1)"; // same curve as --ease in style.css

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
  shots.forEach((s, i) => { s.style.viewTransitionName = `shot-${i}`; });
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const f = chip.dataset.filter;
      const apply = () => {
        chips.forEach((c) => c.classList.toggle("is-active", c === chip));
        shots.forEach((s) => s.classList.toggle("is-hidden", f !== "all" && s.dataset.cat !== f));
      };
      // Animate the change where supported; otherwise switch instantly as before
      if (document.startViewTransition && !reduceMotion.matches) document.startViewTransition(apply);
      else apply();
    });
  });

  /* ---------- Lightbox ---------- */
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  let current = 0;
  const visibleShots = () => shots.filter((s) => !s.classList.contains("is-hidden"));
  // dir: 1 = next (new photo slides in from the right), -1 = previous, 0 = no animation
  let swapId = 0;
  const show = (i, dir = 0) => {
    const list = visibleShots();
    current = (i + list.length) % list.length;
    const img = list[current].querySelector("img");
    const set = () => { lbImg.src = img.src; lbImg.alt = img.alt; };
    if (!dir || reduceMotion.matches || !lbImg.animate) { set(); return; }

    const id = ++swapId; // a newer tap cancels this swap
    lbImg.getAnimations().forEach((a) => a.cancel());
    lbImg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-in", fill: "forwards" }).finished
      .then(() => { if (id !== swapId) return; set(); return lbImg.decode().catch(() => {}); })
      .then(() => {
        if (id !== swapId) return;
        lbImg.getAnimations().forEach((a) => a.cancel());
        lbImg.animate(
          [{ opacity: 0, transform: `translateX(${dir * 12}px)` }, { opacity: 1, transform: "none" }],
          { duration: 220, easing: EASE }
        );
      })
      .catch(() => {}); // cancelled by a newer swap
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
    if (action === "prev") show(current - 1, -1);
    if (action === "next") show(current + 1, 1);
  });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1, -1);
    if (e.key === "ArrowRight") show(current + 1, 1);
  });
  // Swipe on phones
  let touchX = null;
  lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { const dir = dx < 0 ? 1 : -1; show(current + dir, dir); }
    touchX = null;
  });

  /* ---------- Before / After slider ---------- */
  const ba = document.getElementById("beforeAfter");
  if (ba) {
    const range = ba.querySelector(".ba-range");
    const setPos = (v) => ba.style.setProperty("--pos", v + "%");
    range.addEventListener("input", () => setPos(range.value));

    // The first time the slider is properly in view, sweep it once (50 → 30 → 70 → 50)
    // so visitors see it can be dragged. Stops as soon as they touch it.
    if (!reduceMotion.matches && "IntersectionObserver" in window) {
      let raf = 0, stopped = false;
      const stop = () => { stopped = true; cancelAnimationFrame(raf); };
      ["pointerdown", "touchstart", "keydown"].forEach((ev) =>
        ba.addEventListener(ev, stop, { once: true, passive: true }));

      const sweep = () => {
        const keys = [50, 30, 70, 50];
        const seg = 1400 / 3; // ms per leg
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        let t0 = null;
        const step = (now) => {
          if (stopped) return;
          if (t0 === null) t0 = now;
          const elapsed = now - t0;
          const leg = Math.min(Math.floor(elapsed / seg), 2);
          const t = Math.min((elapsed - leg * seg) / seg, 1);
          const v = keys[leg] + (keys[leg + 1] - keys[leg]) * ease(t);
          setPos(v); range.value = v;
          if (elapsed < seg * 3) raf = requestAnimationFrame(step);
          else { setPos(50); range.value = 50; }
        };
        raf = requestAnimationFrame(step);
      };

      const io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setTimeout(() => { if (!stopped) sweep(); }, 500); // let the section's fade-in finish first
      }, { threshold: 0.6 });
      io.observe(ba);
    }
  }

  /* Booking form: see booking.js */

  /* ---------- Footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
});
