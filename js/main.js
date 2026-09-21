(function () {
  "use strict";

  /* ================= Particle background ================= */
  const canvas = document.getElementById("particle-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function initParticles() {
    const count = Math.round((W * H) / 22000);
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.4,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      a: Math.random() * 0.5 + 0.15,
    }));
  }

  function particleRGB() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--particle-rgb").trim();
    return v || "220, 225, 255";
  }
  let particleColor = particleRGB();

  // This canvas is the fallback background for browsers where the WebGL weave
  // never booted; once it has, CSS hides this one in either theme.
  function particlesHidden() {
    return document.documentElement.classList.contains("loom-active");
  }

  let tickRunning = false;
  function tick() {
    // Once the WebGL overlay takes over, this canvas is hidden via CSS but was
    // still burning a full requestAnimationFrame loop drawing into nothing.
    // Stop scheduling further frames once that happens.
    if (particlesHidden()) {
      tickRunning = false;
      return;
    }
    tickRunning = true;
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${particleColor}, ${p.a})`;
      ctx.fill();
    }
    if (!reduceMotion) requestAnimationFrame(tick);
    else tickRunning = false;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  resize();
  initParticles();
  requestAnimationFrame(tick);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      initParticles();
    }, 200);
  });

  /* ================= Theme toggle ================= */
  const themeToggle = document.getElementById("theme-toggle");
  const themeMeta = document.getElementById("theme-color-meta");
  const THEME_COLORS = { dark: "#060714", light: "#f4f5fb" };
  // The inline <head> script has already applied any stored choice; read it
  // back rather than re-deriving it, so the two can never disagree.
  let currentTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

  // The button says what the *next* tap does, in whichever language is active.
  function syncThemeLabel() {
    const key = currentTheme === "light" ? "theme.toDark" : "theme.toLight";
    const dict = I18N[currentLang] || I18N.en;
    const label = dict[key] || I18N.en[key];
    themeToggle.setAttribute("aria-label", label);
    themeToggle.setAttribute("title", label);
  }

  function applyTheme(theme, { animate = false, persist = true } = {}) {
    currentTheme = theme;
    if (persist) {
      try {
        localStorage.setItem("theme", theme);
      } catch (e) { /* storage blocked — the choice just won't persist */ }
    }

    if (animate) {
      document.documentElement.classList.add("theme-switching");
      clearTimeout(applyTheme._t);
      applyTheme._t = setTimeout(
        () => document.documentElement.classList.remove("theme-switching"),
        340
      );
    }

    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");

    if (themeMeta) themeMeta.setAttribute("content", THEME_COLORS[theme]);

    themeToggle.querySelectorAll(".theme-toggle__opt").forEach((opt) => {
      opt.classList.toggle("is-active", opt.getAttribute("data-theme") === theme);
    });
    syncThemeLabel();

    // Only matters on the no-WebGL fallback path, where this canvas is the
    // background and its dots have to flip contrast with the page.
    particleColor = particleRGB();
    if (!particlesHidden() && !tickRunning) requestAnimationFrame(tick);

    // Lets the WebGL overlay suspend/resume itself without importing anything.
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  themeToggle.addEventListener("click", () => {
    applyTheme(currentTheme === "light" ? "dark" : "light", { animate: true });
  });

  /* ================= Navbar scroll state ================= */
  const navbar = document.getElementById("navbar");
  const navbarRim = "var(--nav-rim)";
  window.addEventListener("scroll", () => {
    navbar.style.boxShadow = window.scrollY > 12
      ? `${navbarRim}, 0 12px 30px -20px rgba(0,0,0,0.35)`
      : navbarRim;
  });

  /* ================= Mobile nav toggle ================= */
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("is-open");
  });
  navLinks.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => navLinks.classList.remove("is-open"))
  );

  /* ================= Language toggle ================= */
  const langToggle = document.getElementById("lang-toggle");
  let currentLang = localStorage.getItem("lang") || "en";

  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const value = I18N[lang] && I18N[lang][key];
      if (value) el.textContent = value;
    });

    langToggle.querySelectorAll(".lang-toggle__opt").forEach((opt) => {
      opt.classList.toggle("is-active", opt.getAttribute("data-lang") === lang);
    });

    syncThemeLabel();
    renderProjects(lang);
  }

  langToggle.addEventListener("click", () => {
    applyLang(currentLang === "en" ? "fr" : "en");
  });

  /* ================= Tech stack render ================= */
  function renderTechStack() {
    const grid = document.getElementById("tech-grid");
    grid.innerHTML = TECH_STACK.map(
      (t, i) => `
      <div class="tech-item" data-reveal style="animation-delay:${(i % 6) * 0.35}s; --reveal-delay:${(i % 8) * 55}ms">
        <span class="tech-item__icon">
          <img src="${t.icon}" alt="${t.name}" loading="lazy" />
        </span>
        <span>${t.name}</span>
      </div>`
    ).join("");
  }

  /* ================= Projects render ================= */
  function renderProjects(lang) {
    const grid = document.getElementById("project-grid");
    grid.innerHTML = PROJECTS.map((p, i) => {
      const tags = p.tags
        .map((tag) => `<span style="color:${TAG_COLORS[tag] || "var(--cyan)"}">#${tag}</span>`)
        .join(" ");
      return `
      <article class="glass glow-border project-card" data-reveal style="--reveal-delay:${(i % 6) * 90}ms">
        <div class="project-card__cover" style="background: linear-gradient(150deg, var(--${p.accent}) -40%, var(--cover-base) 70%)">
          <div class="project-card__links">
            <a href="${p.github}" target="_blank" rel="noopener" aria-label="GitHub repository for ${p.title}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.77.12 3.06.74.8 1.19 1.83 1.19 3.09 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/></svg>
            </a>
            ${p.live ? `<a href="${p.live}" target="_blank" rel="noopener" aria-label="Open live Vercel deployment for ${p.title}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 1 21h22L12 3Z"/></svg>
            </a>` : ""}
          </div>
          ${p.title}
        </div>
        <h3>${p.title}</h3>
        <p>${p.desc[lang] || p.desc.en}</p>
        <div class="project-card__tags">${tags}</div>
      </article>`;
    }).join("");

    observeReveal();
  }

  /* ================= Scroll reveal ================= */
  let observer;
  function observeReveal() {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
    }
    document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => observer.observe(el));
  }

  /* ================= Footer year ================= */
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ================= Init ================= */
  applyTheme(currentTheme, { persist: false });
  renderTechStack();
  applyLang(currentLang);
  observeReveal();
})();
