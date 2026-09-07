# Tanjil Sarker Rafi — Portfolio

Personal portfolio site for Tanjil Sarker Rafi, a Computing Science student at the
University of Alberta. Built to showcase full-stack projects, technical experience,
and a resume in a fast, dependency-free static site.

**Live site:** _add deployed URL here_
**GitHub:** [github.com/TanjilRafi](https://github.com/TanjilRafi) · **LinkedIn:** [linkedin.com/in/tanjil-rafi](https://linkedin.com/in/tanjil-rafi-4b3b47391)

## Overview

A single-page portfolio with a space-themed aesthetic — glassmorphism cards, animated
gradient borders, a canvas particle background, and scroll-triggered reveal
animations. Dark by default with a light mode toggle, and fully bilingual
(English/French) via a client-side toggle, with no build step: open `index.html` and
it runs.

## Sections

- **Hero / About** — introduction and bio
- **Tech Stack** — React.js, Next.js, TypeScript, Java, Python, Express, SQL, Supabase, Git, macOS Terminal
- **Experience** — vertical timeline (Software Developer Intern @ Nexfolyo, Teaching Assistant @ University of Alberta)
- **Projects** — BeefStock, SpecAQI, DarkOrchid, AI Search Solvers
- **Contact** — email and social links

## Tech Stack (this repo)

Plain HTML5, CSS3, and vanilla JavaScript (ES6+) — no framework, no build tooling,
no dependencies to install. Icons are pulled from the [Devicon](https://devicon.dev/)
CDN at runtime.

## Project Structure

```
Mywebsite/
├── index.html          # page markup
├── css/
│   └── style.css        # all styling: layout, glassmorphism, animations, responsive
├── js/
│   ├── i18n.js           # English/French copy
│   ├── data.js            # tech stack + project content
│   └── main.js             # particles, nav, language toggle, scroll reveal
└── assets/
    └── resume/            # resume PDF (linked from the "View Resume" button)
```

## Running Locally

No build step required.

```bash
# Option 1 — just open it
open index.html

# Option 2 — serve it (needed if you extend the site with fetch() calls)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Notes

- Language and theme preferences persist via `localStorage`; the theme is applied by
  a small inline script in `<head>` so there is no flash of the wrong palette.
- Every themeable color is a CSS custom property on `:root`; the light palette
  re-points the same names under `:root[data-theme="light"]`.
- The Three.js "Interstitial Weave" background is additive glow on a near-black
  field, so it is dark-mode only — light mode hides it, suspends its render loop,
  and hands the background back to the 2D particle canvas.
- Scroll animations respect `prefers-reduced-motion`.
- Layout is responsive down to mobile, with a collapsible nav below 760px. The theme
  pill collapses to the current mode's icon below 1000px to keep the nav row on one
  line.

## License

© Tanjil Sarker Rafi. All rights reserved.
