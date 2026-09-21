const DEVICON_BASE = "https://cdn.jsdelivr.net/npm/devicon@2.16.0/icons";

const TECH_STACK = [
  { name: "React.js",   icon: `${DEVICON_BASE}/react/react-original.svg` },
  { name: "Next.js",    icon: `${DEVICON_BASE}/nextjs/nextjs-original.svg` },
  { name: "TypeScript", icon: `${DEVICON_BASE}/typescript/typescript-original.svg` },
  { name: "Java",       icon: `${DEVICON_BASE}/java/java-plain.svg` },
  { name: "Python",     icon: `${DEVICON_BASE}/python/python-original.svg` },
  { name: "Express",    icon: `${DEVICON_BASE}/express/express-original.svg` },
  { name: "SQL",        icon: `${DEVICON_BASE}/mysql/mysql-original.svg` },
  { name: "Supabase",   icon: `${DEVICON_BASE}/supabase/supabase-original.svg` },
  { name: "Git",        icon: `${DEVICON_BASE}/git/git-original.svg` },
  { name: "macOS Terminal", icon: `${DEVICON_BASE}/apple/apple-original.svg` },
  { name: "Flutter",    icon: `${DEVICON_BASE}/flutter/flutter-original.svg` },
  { name: "XML",        icon: `${DEVICON_BASE}/xml/xml-original.svg` },
  { name: "SQLite",     icon: `${DEVICON_BASE}/sqlite/sqlite-original.svg` },
  { name: "MongoDB",    icon: `${DEVICON_BASE}/mongodb/mongodb-original.svg` },
  { name: "Bootstrap",  icon: `${DEVICON_BASE}/bootstrap/bootstrap-original.svg` },
  { name: "Linux",      icon: `${DEVICON_BASE}/linux/linux-original.svg` },
  { name: "C++",        icon: `${DEVICON_BASE}/cplusplus/cplusplus-original.svg` },
  { name: "C",          icon: `${DEVICON_BASE}/c/c-original.svg` },
  { name: "HTML5",      icon: `${DEVICON_BASE}/html5/html5-original.svg` },
  { name: "CSS3",       icon: `${DEVICON_BASE}/css3/css3-original.svg` },
  { name: "JavaScript", icon: `${DEVICON_BASE}/javascript/javascript-original.svg` },
  { name: "Vite",       icon: `${DEVICON_BASE}/vitejs/vitejs-original.svg` },
  { name: "Node.js",    icon: `${DEVICON_BASE}/nodejs/nodejs-original.svg` },
  { name: "Tailwind CSS", icon: `${DEVICON_BASE}/tailwindcss/tailwindcss-original.svg` },
  { name: "Jira",       icon: `${DEVICON_BASE}/jira/jira-original.svg` },
  { name: "Bitbucket",  icon: `${DEVICON_BASE}/bitbucket/bitbucket-original.svg` },
  { name: "Firebase",   icon: `${DEVICON_BASE}/firebase/firebase-original.svg` },
  { name: "Figma",      icon: `${DEVICON_BASE}/figma/figma-original.svg` },
  { name: "Android",    icon: `${DEVICON_BASE}/android/android-original.svg` },
];

const PROJECTS = [
  {
    id: "beefstock",
    title: "BeefStock",
    accent: "cyan",
    desc: {
      en: "A full-stack paper-trading education platform teaching market mechanics through RSI/MACD/SMA indicator math and $100,000 in risk-free paper trading — no real money, no personalized buy/sell advice. Ships a shared types layer between the React front end and Express API, plus an LLM-ready chatbot seam with safety guardrails enforced on every data and chat screen.",
      fr: "Une plateforme éducative full-stack de trading simulé enseignant la mécanique des marchés via les indicateurs RSI/MACD/SMA et 100 000 $ de trading fictif sans risque — sans argent réel ni conseils d'achat/vente personnalisés. Comprend une couche de types partagée entre le front-end React et l'API Express, ainsi qu'une intégration prête pour un chatbot LLM avec des garde-fous de sécurité sur chaque écran de données et de discussion."
    },
    tags: ["React", "TypeScript", "Express", "Supabase"],
    github: "https://github.com/TanjilRafi",
    live: "https://beef-stock.vercel.app"
  },
  {
    id: "specaqi",
    title: "SpecAQI",
    accent: "green",
    desc: {
      en: "Built at the HackED Hackathon (University of Alberta): a full-stack app reporting air quality for one specific place — a park, beach, campsite, or mall — rather than a city-wide average. Integrates the PurpleAir sensor network with an OpenWeatherMap fallback via secure server-side Next.js API routes, then estimates AQI at a chosen point using the Haversine formula and Inverse Distance Weighting.",
      fr: "Créé au hackathon HackED (Université de l'Alberta) : une application full-stack qui indique la qualité de l'air d'un lieu précis — parc, plage, camping ou centre commercial — plutôt qu'une moyenne à l'échelle de la ville. Intègre le réseau de capteurs PurpleAir avec un repli sur OpenWeatherMap via des routes API Next.js sécurisées côté serveur, puis estime l'IQA d'un point choisi avec la formule de Haversine et la pondération par distance inverse."
    },
    tags: ["Next.js", "React", "Tailwind", "Leaflet"],
    github: "https://github.com/TanjilRafi",
    live: "https://spec-aqi.vercel.app"
  },
  {
    id: "darkorchid",
    title: "DarkOrchid",
    accent: "purple",
    desc: {
      en: "A full team-based Agile application built with object-oriented design in Java, with progress reviewed through GitHub. Designed the Firestore data models and wrote JUnit unit and UI tests to validate features.",
      fr: "Une application complète développée en équipe Agile, avec une conception orientée objet en Java et un suivi de l'avancement via GitHub. Conception des modèles de données Firestore et rédaction de tests unitaires et d'interface JUnit pour valider les fonctionnalités."
    },
    tags: ["Java", "Android Studio", "Firebase", "JUnit"],
    github: "https://github.com/TanjilRafi",
    live: null
  },
  {
    id: "ai-search-solvers",
    title: "AI Search Solvers",
    accent: "cyan",
    desc: {
      en: "AI search and constraint-satisfaction algorithms — Levin Tree Search, backtracking, CSP — implemented with custom heuristics to evaluate decision-making and optimization strategies across problem instances.",
      fr: "Algorithmes de recherche en IA et de satisfaction de contraintes — Levin Tree Search, retour en arrière, CSP — implémentés avec des heuristiques personnalisées pour évaluer des stratégies de décision et d'optimisation sur différentes instances de problèmes."
    },
    tags: ["Python", "AI", "Algorithms"],
    github: "https://github.com/TanjilRafi",
    live: null
  },
  {
    id: "reminders",
    title: "Reminders",
    accent: "green",
    desc: {
      en: "A focus-friendly task and reminder dashboard for creating reminders, organizing them into lists, tracking scheduled and flagged tasks, and launching focus sessions.",
      fr: "Un tableau de bord de tâches et de rappels pensé pour la concentration, permettant de créer des rappels, d’organiser des listes, de suivre les tâches planifiées et prioritaires, et de lancer des sessions de concentration."
    },
    tags: ["Next.js", "React", "Tailwind"],
    github: "https://github.com/TanjilRafi",
    live: "https://my-reminer-app.vercel.app/"
  }
];

const TAG_COLORS = {
  "React": "var(--cyan)", "TypeScript": "var(--purple)", "Express": "var(--green)", "Supabase": "var(--cyan)",
  "Next.js": "var(--cyan)", "Tailwind": "var(--green)", "Leaflet": "var(--purple)",
  "Java": "var(--purple)", "Android Studio": "var(--green)", "Firebase": "var(--cyan)", "JUnit": "var(--purple)",
  "Python": "var(--green)", "AI": "var(--purple)", "Algorithms": "var(--cyan)"
};
