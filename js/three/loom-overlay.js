import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

import {
  latticeVertexShader,
  latticeFragmentShader,
  gpgpuParticleVertexShader,
  gpgpuParticleFragmentShader,
  panelVertexShader,
  panelFragmentShader,
  postVertexShader,
  postFragmentShader,
} from "./shaders.js";
import { gpgpuPositionShader, gpgpuVelocityShader } from "./gpgpu-shaders.js";
import { createLoomMaster } from "./loom-master.js";

const SECTION_SPACING = 900;
const PANEL_DEFS = [
  { id: "hero", selector: "#hero", x: 0, y: 30 },
  { id: "techstack", selector: "#techstack", x: -360, y: -70 },
  { id: "experience", selector: "#experience", x: 340, y: 30 },
  { id: "projects", selector: "#projects", x: -320, y: -40 },
  { id: "contact", selector: "#contact", x: 300, y: 10 },
];
const PANEL_BASE_WIDTH = 760;
const PANEL_BASE_HEIGHT = PANEL_BASE_WIDTH / 1.6;
const TOTAL_DEPTH = SECTION_SPACING * PANEL_DEFS.length + 400;

const LOOM_DORMANT_OFFSET = new THREE.Vector3(430, -130, -320);
const LOOM_ACTIVE_OFFSET = new THREE.Vector3(0, -15, -150);

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function animateValue(duration, onUpdate, easing, ffFlag) {
  return new Promise((resolve) => {
    let elapsed = 0;
    let last = null;
    function frame(now) {
      if (last === null) last = now;
      const rawDt = Math.min(now - last, 100);
      last = now;
      const speedMul = ffFlag.value ? 6 : 1;
      elapsed += rawDt * speedMul;
      const t = clamp01(elapsed / duration);
      onUpdate(easing(t), t);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function screenToWorld(ndcX, ndcY, camera, distance) {
  const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const dir = vec.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(dir, distance);
}

async function initLoomOverlay() {
  const canvas = document.getElementById("loom-canvas");
  if (!canvas || typeof WebGL2RenderingContext === "undefined") return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const smallScreen = window.innerWidth < 760;

  // ---------- Performance tier ----------
  // Static device signals only get us so far (deviceMemory is unavailable on
  // Safari/iOS, and core counts alone don't distinguish a flagship phone from
  // a budget one), so this is just a conservative starting point. A live FPS
  // watchdog in the render loop (see maybeAdaptQuality) can downgrade further
  // once we can actually measure how the device is coping.
  const TIER = (() => {
    const mem = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency || 4;
    if ((mem !== undefined && mem <= 2) || cores <= 2) return "minimal";
    if (coarsePointer || smallScreen || (mem !== undefined && mem <= 4) || cores <= 4) return "reduced";
    return "full";
  })();
  const TIER_PRESETS = {
    full: {
      latticeCount: 7200, latticeSize: 6.5,
      gpgpu: true, gpgpuSize: 128, particleSize: 5.5,
      antialias: true, pixelRatioCap: 1.9,
      bloom: true, bloomStrength: 0.6, postFX: true, aberration: 0.0028,
    },
    reduced: {
      latticeCount: 4000, latticeSize: 5.5,
      gpgpu: true, gpgpuSize: 64, particleSize: 4.5,
      antialias: false, pixelRatioCap: 1.4,
      bloom: true, bloomStrength: 0.35, postFX: true, aberration: 0.0015,
    },
    minimal: {
      latticeCount: 1800, latticeSize: 5,
      gpgpu: false, gpgpuSize: 0, particleSize: 4,
      antialias: false, pixelRatioCap: 1,
      bloom: false, bloomStrength: 0, postFX: false, aberration: 0,
    },
  };
  const cfg = TIER_PRESETS[TIER];

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: cfg.antialias,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (err) {
    console.warn("Interstitial Weave: WebGL unavailable, falling back to 2D background.", err);
    return;
  }

  const isWebGL2 = renderer.capabilities.isWebGL2;
  const gpgpuEnabled = isWebGL2 && !prefersReducedMotion && cfg.gpgpu;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x03040a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03040a, 0.00045);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 9000);
  camera.position.set(0, -20, 60);

  scene.add(new THREE.HemisphereLight(0x8a6bff, 0x0a0a18, 0.65));
  const keyLight = new THREE.DirectionalLight(0x5eead4, 0.5);
  keyLight.position.set(200, 300, 200);
  scene.add(keyLight);

  // ---------- Data lattice ----------
  // Pure random scatter (not a jittered grid): a regular grid viewed head-on
  // stacks additive point sprites into aligned columns that bloom blows out
  // into solid blobs. Randomizing every axis independently avoids that.
  const latticeCount = cfg.latticeCount;
  const latticeGeometry = (() => {
    const boundsX = 1300;
    const boundsY = 850;
    const minZ = -5200;
    const maxZ = -200;
    const positions = new Float32Array(latticeCount * 3);
    for (let i = 0; i < latticeCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2 * boundsX;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * boundsY;
      positions[i * 3 + 2] = minZ + Math.random() * (maxZ - minZ);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  })();

  const latticeMaterial = new THREE.ShaderMaterial({
    vertexShader: latticeVertexShader,
    fragmentShader: latticeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: cfg.latticeSize },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uAttractor1: { value: new THREE.Vector3(0, 0, -99999) },
      uAttractor1Strength: { value: 0 },
      uAttractor2: { value: new THREE.Vector3(0, 0, -99999) },
      uAttractor2Strength: { value: 0 },
    },
  });
  const latticePoints = new THREE.Points(latticeGeometry, latticeMaterial);
  latticePoints.frustumCulled = false;
  scene.add(latticePoints);

  // ---------- GPGPU swirling particle system ----------
  let gpgpu = null;
  let particlePoints = null;
  let positionVariable = null;
  let velocityVariable = null;

  if (gpgpuEnabled) {
    const size = cfg.gpgpuSize;
    const computation = new GPUComputationRenderer(size, size, renderer);

    const dtPosition = computation.createTexture();
    const dtVelocity = computation.createTexture();
    const posArr = dtPosition.image.data;
    const velArr = dtVelocity.image.data;
    for (let i = 0; i < posArr.length; i += 4) {
      posArr[i] = (Math.random() - 0.5) * 2600;
      posArr[i + 1] = (Math.random() - 0.5) * 1700;
      posArr[i + 2] = -Math.random() * 5200 + 300;
      posArr[i + 3] = 0;

      velArr[i] = (Math.random() - 0.5) * 4;
      velArr[i + 1] = (Math.random() - 0.5) * 4;
      velArr[i + 2] = (Math.random() - 0.5) * 4;
      velArr[i + 3] = 1;
    }

    positionVariable = computation.addVariable("texturePosition", gpgpuPositionShader, dtPosition);
    velocityVariable = computation.addVariable("textureVelocity", gpgpuVelocityShader, dtVelocity);
    computation.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
    computation.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);

    positionVariable.material.uniforms.uDelta = { value: 0 };
    velocityVariable.material.uniforms.uTime = { value: 0 };
    velocityVariable.material.uniforms.uDelta = { value: 0 };
    velocityVariable.material.uniforms.uAttractor1 = { value: new THREE.Vector3(0, 0, -99999) };
    velocityVariable.material.uniforms.uAttractor1Strength = { value: 0 };
    velocityVariable.material.uniforms.uAttractor2 = { value: new THREE.Vector3(0, 0, -99999) };
    velocityVariable.material.uniforms.uAttractor2Strength = { value: 0 };
    velocityVariable.material.uniforms.uAttractor3 = { value: new THREE.Vector3(0, 0, -99999) };
    velocityVariable.material.uniforms.uAttractor3Strength = { value: 0 };

    const initError = computation.init();
    if (initError !== null) {
      console.warn("Interstitial Weave: GPGPU init failed, disabling particle swarm.", initError);
      gpgpu = null;
    } else {
      gpgpu = computation;

      const count = size * size;
      const references = new Float32Array(count * 2);
      const dummyPositions = new Float32Array(count * 3);
      let p = 0;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          references[p * 2] = i / (size - 1);
          references[p * 2 + 1] = j / (size - 1);
          p++;
        }
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dummyPositions, 3));
      particleGeometry.setAttribute("reference", new THREE.Float32BufferAttribute(references, 2));

      const particleMaterial = new THREE.ShaderMaterial({
        vertexShader: gpgpuParticleVertexShader,
        fragmentShader: gpgpuParticleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          texturePosition: { value: null },
          uSize: { value: cfg.particleSize },
          uPixelRatio: { value: renderer.getPixelRatio() },
        },
      });

      particlePoints = new THREE.Points(particleGeometry, particleMaterial);
      particlePoints.frustumCulled = false;
      scene.add(particlePoints);
    }
  }

  // ---------- Loom Master ----------
  const loomMaster = createLoomMaster();
  loomMaster.scale.setScalar(1.4);
  scene.add(loomMaster);

  // ---------- Panels (live DOM woven onto 3D planes) ----------
  const panelGeometry = new THREE.PlaneGeometry(PANEL_BASE_WIDTH, PANEL_BASE_HEIGHT, 1, 1);
  const panelMeshes = new Map();

  PANEL_DEFS.forEach((def, index) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: panelVertexShader,
      fragmentShader: panelFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        map: { value: null },
        uWeave: { value: 1 },
        uTime: { value: 0 },
        uGlowColor: { value: new THREE.Color(0x7dd3fc) },
        uHasTexture: { value: 0 },
        uHoverT: { value: 0 },
        uBaseAlpha: { value: 0 },
      },
    });
    const mesh = new THREE.Mesh(panelGeometry, material);
    mesh.position.set(def.x, def.y, -index * SECTION_SPACING - 260);
    mesh.userData.def = def;
    mesh.userData.baseY = def.y;

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(panelGeometry),
      new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0 })
    );
    mesh.add(outline);
    mesh.userData.outline = outline;

    scene.add(mesh);
    panelMeshes.set(def.id, mesh);
  });

  // ---------- Nav "ghost" panels for hover raycasting ----------
  const navTargets = Array.from(document.querySelectorAll(".nav-links a"));
  const brandEl = document.querySelector(".brand");
  if (brandEl) navTargets.push(brandEl);

  // Pure mouse-hover eye candy — meaningless on touch, and building/updating
  // it was forcing a getBoundingClientRect() layout read per nav link on
  // every single frame regardless of device, even where it could never be
  // seen. Skip the whole feature (but keep navTargets itself, which the
  // click-to-weave-transition listeners below still need) on touch devices.
  const ghostTargets = coarsePointer ? [] : navTargets;
  const ghostMeshes = ghostTargets.map((el) => {
    // Unit plane, scaled per-frame in updateGhostPanels() to match the real
    // DOM element's actual on-screen size at its projected depth.
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: panelVertexShader,
      fragmentShader: panelFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        map: { value: null },
        uWeave: { value: 1 },
        uTime: { value: 0 },
        uGlowColor: { value: new THREE.Color(0x8a6bff) },
        uHasTexture: { value: 0 },
        uHoverT: { value: 0 },
        uBaseAlpha: { value: 0.16 },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.el = el;
    mesh.userData.hoverT = 0;
    mesh.renderOrder = 5;
    scene.add(mesh);
    return mesh;
  });

  // ---------- Post-processing ----------
  // Minimal tier skips the composer entirely: no bloom cascade, no full-screen
  // aberration/grain pass, no extra render targets — just a direct scene render.
  const usePostProcessing = cfg.bloom || cfg.postFX;
  let composer = null;
  let bloomPass = null;
  let postPass = null;
  if (usePostProcessing) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (cfg.bloom) {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        cfg.bloomStrength,
        0.55,
        0.35
      );
      composer.addPass(bloomPass);
    }
    postPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAberration: { value: cfg.aberration },
        uGrain: { value: 0.035 },
        uVignette: { value: 1.15 },
      },
      vertexShader: postVertexShader,
      fragmentShader: postFragmentShader,
    });
    postPass.renderToScreen = true;
    composer.addPass(postPass);
  }

  // ---------- html2canvas (dynamic import; lazy DOM->texture snapshots) ----------
  let html2canvas = null;
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js");
    html2canvas = mod.default || mod;
  } catch (err) {
    console.warn("Interstitial Weave: html2canvas unavailable, panels will render as glyph placeholders.", err);
  }

  async function snapshotToTexture(el) {
    if (!html2canvas || !el) return null;
    try {
      const canvasEl = await html2canvas(el, {
        backgroundColor: "#05060f",
        scale: TIER === "full" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1,
        useCORS: true,
        logging: false,
        ignoreElements: (node) => node.id === "loom-canvas" || node.id === "particle-canvas",
      });
      const texture = new THREE.CanvasTexture(canvasEl);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return { texture, aspect: canvasEl.width / canvasEl.height };
    } catch (err) {
      return null;
    }
  }

  function applySnapshotToPanel(mesh, snapshot) {
    if (!mesh || !snapshot) return;
    mesh.material.uniforms.map.value = snapshot.texture;
    mesh.material.uniforms.uHasTexture.value = 1;
    const targetHeight = PANEL_BASE_WIDTH / snapshot.aspect;
    mesh.scale.y = targetHeight / PANEL_BASE_HEIGHT;
  }

  async function refreshPanelSnapshot(def) {
    const el = document.querySelector(def.selector);
    const snapshot = await snapshotToTexture(el);
    applySnapshotToPanel(panelMeshes.get(def.id), snapshot);
  }

  // Nav ghosts intentionally stay untextured (see geometry comment above) —
  // only the ambient/hero-scale section panels get live DOM snapshots.
  async function primeSnapshots() {
    for (const def of PANEL_DEFS) {
      await refreshPanelSnapshot(def);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  setTimeout(() => primeSnapshots(), 900);

  // Re-snapshot a section shortly after its scroll-reveal elements settle.
  const revealDebounce = new Map();
  const revealObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName !== "class") continue;
      const target = m.target;
      if (!(target instanceof Element) || !target.hasAttribute("data-reveal")) continue;
      const section = target.closest(".section");
      if (!section) continue;
      const def = PANEL_DEFS.find((d) => d.id === section.id);
      if (!def) continue;
      clearTimeout(revealDebounce.get(def.id));
      revealDebounce.set(
        def.id,
        setTimeout(() => refreshPanelSnapshot(def), 550)
      );
    }
  });
  // Re-snapshotting on every scroll-reveal is a nice-to-have visual refresh,
  // not core functionality — skip it on minimal tier where html2canvas's CPU
  // cost is disproportionate to the benefit. The initial primeSnapshots()
  // pass above still runs on every tier.
  if (TIER !== "minimal") {
    revealObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class"] });
  }

  const langToggleEl = document.getElementById("lang-toggle");
  if (langToggleEl) {
    langToggleEl.addEventListener("click", () => {
      setTimeout(() => {
        PANEL_DEFS.forEach((def) => refreshPanelSnapshot(def));
      }, 400);
    });
  }

  // ---------- State ----------
  const state = {
    activeId: "hero",
    pendingTargetId: null,
    transitioning: false,
    loomActivation: 0,
    cameraKick: 0,
    hoveredGhost: null,
  };
  const AMBIENT_ALPHA = 0.26;

  // The panel for whichever section is on-screen in the live DOM stays fully
  // hidden (the real 2D content already covers it) so the woven duplicate
  // never ghosts behind the readable page. Other sections stay dimly visible
  // as environmental "data echoes" deeper in the lattice.
  function updatePanelAmbient() {
    panelMeshes.forEach((mesh, id) => {
      const isParticipant = state.transitioning && (id === state.activeId || id === state.pendingTargetId);
      const u = mesh.material.uniforms.uBaseAlpha;
      if (!isParticipant) {
        const target = id === state.activeId ? 0 : AMBIENT_ALPHA;
        u.value += (target - u.value) * 0.05;
      }
      if (mesh.userData.outline) {
        mesh.userData.outline.material.opacity = u.value * mesh.material.uniforms.uWeave.value * 1.2;
      }
    });
  }
  const ffFlag = { value: false };
  function onInterrupt() {
    ffFlag.value = true;
  }

  const attractorLoom = { position: new THREE.Vector3(0, 0, -99999), strength: 0 };
  const attractorHover = { position: new THREE.Vector3(0, 0, -99999), strength: 0 };

  // ---------- The Loom: click-triggered weave transition ----------
  async function triggerWeave(href) {
    if (state.transitioning) return;
    const targetEl = document.querySelector(href) || document.getElementById("hero");
    if (!targetEl) return;
    const targetSection = targetEl.closest(".section") || targetEl;
    const targetDef = PANEL_DEFS.find((d) => d.id === targetSection.id) || PANEL_DEFS[0];
    if (targetDef.id === state.activeId) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    state.transitioning = true;
    state.pendingTargetId = targetDef.id;
    ffFlag.value = false;
    document.addEventListener("wheel", onInterrupt, { passive: true });
    document.addEventListener("touchstart", onInterrupt, { passive: true });

    const outgoingPanel = panelMeshes.get(state.activeId);
    const incomingPanel = panelMeshes.get(targetDef.id);
    if (outgoingPanel) outgoingPanel.material.uniforms.uBaseAlpha.value = 1;
    if (incomingPanel) incomingPanel.material.uniforms.uBaseAlpha.value = 1;

    // Phase 1 — Loom Master activates and moves to the foreground.
    await animateValue(
      950,
      (e) => {
        state.loomActivation = e;
        state.cameraKick = -50 * e;
        attractorLoom.strength = e;
      },
      easeOutCubic,
      ffFlag
    );

    // Phase 2 — data threads swirl in; the old panel unweaves and rolls away.
    await animateValue(
      1300,
      (e) => {
        if (outgoingPanel) {
          outgoingPanel.material.uniforms.uWeave.value = 1 - e;
          outgoingPanel.position.y = outgoingPanel.userData.baseY + e * 140;
          outgoingPanel.rotation.x = e * 1.4;
        }
      },
      easeInOutCubic,
      ffFlag
    );

    // Phase 3 — a fresh thread is fetched live from the DOM and woven into a new panel.
    const snapshot = await snapshotToTexture(targetSection);
    if (incomingPanel) {
      applySnapshotToPanel(incomingPanel, snapshot);
      incomingPanel.rotation.x = 0;
      incomingPanel.position.y = incomingPanel.userData.baseY;
      incomingPanel.material.uniforms.uWeave.value = 0;
    }
    targetEl.scrollIntoView({ behavior: ffFlag.value ? "auto" : "smooth", block: "start" });

    await animateValue(
      1400,
      (e) => {
        if (incomingPanel) incomingPanel.material.uniforms.uWeave.value = e;
      },
      easeInOutCubic,
      ffFlag
    );

    // Phase 4 — the Loom Master retreats and hands control back to the viewer.
    await animateValue(
      700,
      (e) => {
        state.loomActivation = 1 - e;
        state.cameraKick = -50 * (1 - e);
        attractorLoom.strength = 1 - e;
        if (outgoingPanel) outgoingPanel.material.uniforms.uWeave.value = e;
      },
      easeInOutCubic,
      ffFlag
    );
    if (outgoingPanel) {
      outgoingPanel.rotation.x = 0;
      outgoingPanel.position.y = outgoingPanel.userData.baseY;
    }

    state.activeId = targetDef.id;
    state.pendingTargetId = null;
    state.transitioning = false;
    document.removeEventListener("wheel", onInterrupt);
    document.removeEventListener("touchstart", onInterrupt);
  }

  if (!prefersReducedMotion) {
    navTargets.forEach((el) => {
      el.addEventListener("click", (e) => {
        const href = el.getAttribute("href");
        if (!href || !href.startsWith("#")) return;
        e.preventDefault();
        triggerWeave(href);
      });
    });
  }

  // Track which section is nearest the viewport center for weave bookkeeping.
  let scrollTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTicking || state.transitioning) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        let closestId = state.activeId;
        let closestDist = Infinity;
        const centerY = window.innerHeight / 2;
        PANEL_DEFS.forEach((def) => {
          const el = document.getElementById(def.id);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const dist = Math.abs(rect.top + rect.height / 2 - centerY);
          if (dist < closestDist) {
            closestDist = dist;
            closestId = def.id;
          }
        });
        state.activeId = closestId;
      });
    },
    { passive: true }
  );

  // ---------- Mouse parallax + hover raycasting ----------
  const pointerNDC = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const hoverEnabled = !coarsePointer;

  if (hoverEnabled) {
    window.addEventListener(
      "mousemove",
      (e) => {
        pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      },
      { passive: true }
    );
  }

  function updateHover() {
    if (!hoverEnabled || state.transitioning) return;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(ghostMeshes, false);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== state.hoveredGhost) {
      if (state.hoveredGhost) state.hoveredGhost.userData.el.classList.remove("is-loom-hover");
      state.hoveredGhost = hit;
      if (hit) hit.userData.el.classList.add("is-loom-hover");
    }
  }

  function updateGhostPanels() {
    ghostMeshes.forEach((mesh) => {
      const el = mesh.userData.el;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const ndcX = (cx / window.innerWidth) * 2 - 1;
      const ndcY = -(cy / window.innerHeight) * 2 + 1;
      const isHover = mesh === state.hoveredGhost;
      const distance = 80 - (isHover ? 22 : 0);
      const targetPos = screenToWorld(ndcX, ndcY, camera, distance);
      mesh.position.lerp(targetPos, 0.22);
      mesh.quaternion.copy(camera.quaternion);
      mesh.userData.hoverT += ((isHover ? 1 : 0) - mesh.userData.hoverT) * 0.15;
      mesh.material.uniforms.uHoverT.value = mesh.userData.hoverT;

      // Match the ghost's on-screen footprint to the real DOM element's
      // actual pixel size at this depth, so it can never balloon into an
      // oversized glow that swamps the page (see fix history: an earlier
      // fixed-size plane at close depth covered ~half the viewport).
      const worldPerPixel =
        (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / window.innerHeight;
      const hoverGrow = 1 + mesh.userData.hoverT * 0.25;
      const targetW = rect.width * worldPerPixel * 1.2 * hoverGrow;
      const targetH = rect.height * worldPerPixel * 1.5 * hoverGrow;
      mesh.scale.x += (targetW - mesh.scale.x) * 0.25;
      mesh.scale.y += (targetH - mesh.scale.y) * 0.25;
    });

    if (state.hoveredGhost) {
      attractorHover.position.copy(state.hoveredGhost.position);
      attractorHover.strength += (1 - attractorHover.strength) * 0.12;
    } else {
      attractorHover.strength += (0 - attractorHover.strength) * 0.12;
    }
  }

  // ---------- Scroll-driven camera with parallax ----------
  const BASE_X = 0;
  const BASE_Y = -20;
  function getScrollProgress() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    return max > 0 ? THREE.MathUtils.clamp(window.scrollY / max, 0, 1) : 0;
  }
  function updateCamera() {
    const progress = getScrollProgress();
    const targetZ = 60 - progress * TOTAL_DEPTH + state.cameraKick;
    const parX = hoverEnabled ? pointerNDC.x * 55 : 0;
    const parY = hoverEnabled ? -pointerNDC.y * 28 : 0;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.07);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, BASE_X + parX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, BASE_Y + parY, 0.05);
    camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, hoverEnabled ? pointerNDC.x * 0.07 : 0, 0.05);
    camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, hoverEnabled ? -pointerNDC.y * 0.045 : 0, 0.05);
  }

  // ---------- Resize ----------
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w, h);
    latticeMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    if (particlePoints) particlePoints.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  window.addEventListener("resize", onResize, { passive: true });

  // ---------- Adaptive quality watchdog ----------
  // Static device signals can't tell a flagship phone from a budget one, so
  // this measures actual rolling frame time and progressively cuts the most
  // expensive effects if the device is visibly struggling. Two steps, each
  // tried once: (1) drop bloom + clamp pixel ratio to 1, (2) drop the GPGPU
  // particle swarm too. No-ops once already on the minimal tier.
  let adaptFrameTimes = [];
  let adaptStage = 0;
  const ADAPT_SAMPLE_SIZE = 90;
  const ADAPT_SLOW_FRAME_SECONDS = 1 / 30;
  function maybeAdaptQuality(delta) {
    if (TIER === "minimal" || adaptStage >= 2) return;
    adaptFrameTimes.push(delta);
    if (adaptFrameTimes.length < ADAPT_SAMPLE_SIZE) return;
    const avg = adaptFrameTimes.reduce((a, b) => a + b, 0) / adaptFrameTimes.length;
    adaptFrameTimes.length = 0;
    if (avg <= ADAPT_SLOW_FRAME_SECONDS) return;
    adaptStage++;
    if (adaptStage === 1) {
      if (bloomPass) bloomPass.enabled = false;
      renderer.setPixelRatio(1);
      latticeMaterial.uniforms.uPixelRatio.value = 1;
      if (particlePoints) particlePoints.material.uniforms.uPixelRatio.value = 1;
    } else if (adaptStage === 2) {
      gpgpu = null;
      if (particlePoints) particlePoints.visible = false;
    }
  }

  // ---------- Render loop ----------
  const clock = new THREE.Clock();
  const tmpOffset = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;

    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;

    maybeAdaptQuality(delta);
    updateCamera();
    updateHover();
    updateGhostPanels();
    updatePanelAmbient();

    attractorLoom.position.copy(loomMaster.position);

    latticeMaterial.uniforms.uTime.value = elapsed;
    latticeMaterial.uniforms.uAttractor1.value.copy(attractorLoom.position);
    latticeMaterial.uniforms.uAttractor1Strength.value = attractorLoom.strength;
    latticeMaterial.uniforms.uAttractor2.value.copy(attractorHover.position);
    latticeMaterial.uniforms.uAttractor2Strength.value = attractorHover.strength;

    if (gpgpu && positionVariable && velocityVariable) {
      velocityVariable.material.uniforms.uTime.value = elapsed;
      velocityVariable.material.uniforms.uDelta.value = delta;
      positionVariable.material.uniforms.uDelta.value = delta;
      velocityVariable.material.uniforms.uAttractor1.value.copy(attractorLoom.position);
      velocityVariable.material.uniforms.uAttractor1Strength.value = attractorLoom.strength;
      velocityVariable.material.uniforms.uAttractor2.value.copy(attractorHover.position);
      velocityVariable.material.uniforms.uAttractor2Strength.value = attractorHover.strength;
      gpgpu.compute();
      particlePoints.material.uniforms.texturePosition.value = gpgpu.getCurrentRenderTarget(positionVariable).texture;
    }

    loomMaster.userData.update(elapsed, state.loomActivation);
    tmpOffset.copy(LOOM_DORMANT_OFFSET).lerp(LOOM_ACTIVE_OFFSET, state.loomActivation);
    loomMaster.position.copy(camera.position).add(tmpOffset);

    panelMeshes.forEach((mesh) => {
      mesh.material.uniforms.uTime.value = elapsed;
    });

    if (postPass) postPass.uniforms.uTime.value = elapsed;

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  document.documentElement.classList.add("loom-active");
  requestAnimationFrame(frame);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initLoomOverlay().catch((err) => console.warn("Interstitial Weave overlay failed to start.", err));
  });
} else {
  initLoomOverlay().catch((err) => console.warn("Interstitial Weave overlay failed to start.", err));
}
