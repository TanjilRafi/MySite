// GLSL shader sources for the Interstitial Weave overlay.

// Ashima Arts / Stefan Gustavson simplex noise (public domain / MIT-style, widely reused in WebGL shaders)
export const snoise3 = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

export const latticeVertexShader = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uAttractor1;
uniform float uAttractor1Strength;
uniform vec3 uAttractor2;
uniform float uAttractor2Strength;
// 0 = dark theme (bright points added onto near-black),
// 1 = light theme (deep points laid over near-white).
uniform float uLight;

varying vec3 vColor;
varying float vAlpha;

${snoise3}

void main(){
  vec3 pos = position;

  float n1 = snoise(pos * 0.0025 + vec3(0.0, 0.0, uTime * 0.05));
  float n2 = snoise(pos * 0.006 - vec3(uTime * 0.035, 0.0, 0.0));
  float n3 = snoise(pos * 0.004 + vec3(0.0, uTime * 0.02, 0.0));

  pos.x += n1 * 46.0;
  pos.y += n2 * 34.0;
  pos.z += n3 * 60.0;

  vec3 toA1 = uAttractor1 - pos;
  float dA1 = length(toA1);
  float influence1 = smoothstep(700.0, 0.0, dA1) * uAttractor1Strength;
  pos += normalize(toA1 + 0.0001) * influence1 * 140.0;

  vec3 toA2 = uAttractor2 - pos;
  float dA2 = length(toA2);
  float influence2 = smoothstep(700.0, 0.0, dA2) * uAttractor2Strength;
  pos += normalize(toA2 + 0.0001) * influence2 * 140.0;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  float viewDist = max(-mvPosition.z, 1.0);
  // Dark mode lets distant points fall to sub-pixel: additive blending and the
  // bloom cascade still carry them. Light mode has neither, so a sub-pixel
  // point antialiases into nothing — hold a floor so the deep field survives.
  float minSize = mix(0.0, 1.9, uLight);
  gl_PointSize = clamp(uSize * uPixelRatio * (320.0 / viewDist), minSize, 40.0);
  gl_Position = projectionMatrix * mvPosition;

  float depthMix = clamp((n1 + 1.0) / 2.0, 0.0, 1.0);
  float influence = max(influence1, influence2);

  // Same three-stop ramp in both themes — near hue, far hue, attractor hue —
  // but light mode needs deep, saturated inks instead of neon, since the
  // points are alpha-blended over white rather than added onto black.
  vec3 near = mix(vec3(0.14, 0.32, 0.92), vec3(0.11, 0.20, 0.52), uLight);
  vec3 far  = mix(vec3(0.58, 0.38, 0.98), vec3(0.36, 0.18, 0.68), uLight);
  vec3 hot  = mix(vec3(0.55, 0.95, 0.92), vec3(0.02, 0.42, 0.40), uLight);

  vColor = mix(near, far, depthMix);
  vColor = mix(vColor, hot, influence);

  float pulse = sin(uTime * 1.6 + pos.x * 0.01);
  float darkAlpha  = 0.28 + 0.45 * influence + 0.14 * pulse;
  // Additive points compound where they overlap and bloom spreads them, so
  // dark mode reads dense at low alpha. Alpha-blended points do neither —
  // each one is only as visible as its own coverage, hence the higher floor.
  float lightAlpha = 0.42 + 0.40 * influence + 0.12 * pulse;

  // Holding a minimum point size costs light mode its main depth cue, since
  // distant points stop shrinking. Fade them instead, so the field still
  // recedes rather than reading as flat speckle.
  float depthFade = mix(1.0, 0.3 + 0.7 * smoothstep(4600.0, 600.0, viewDist), uLight);
  vAlpha = mix(darkAlpha, lightAlpha, uLight) * depthFade;
}
`;

export const latticeFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float glow = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, clamp(vAlpha, 0.0, 1.0) * glow);
}
`;

export const gpgpuParticleVertexShader = /* glsl */ `
uniform sampler2D texturePosition;
uniform float uSize;
uniform float uPixelRatio;
uniform float uLight;
attribute vec2 reference;
varying float vSpeed;

void main(){
  vec4 texPos = texture2D(texturePosition, reference);
  vec4 mvPosition = modelViewMatrix * vec4(texPos.xyz, 1.0);
  float viewDist = max(-mvPosition.z, 1.0);
  gl_PointSize = clamp(uSize * uPixelRatio * (280.0 / viewDist), mix(0.0, 1.9, uLight), 34.0);
  gl_Position = projectionMatrix * mvPosition;
  vSpeed = texPos.w;
}
`;

export const gpgpuParticleFragmentShader = /* glsl */ `
uniform float uLight;
varying float vSpeed;
void main(){
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float glow = smoothstep(0.5, 0.0, d);
  float speed = clamp(vSpeed / 30.0, 0.0, 1.0);
  vec3 slow = mix(vec3(0.36, 0.62, 0.98), vec3(0.12, 0.33, 0.72), uLight);
  vec3 fast = mix(vec3(0.72, 0.50, 0.99), vec3(0.40, 0.20, 0.76), uLight);
  gl_FragColor = vec4(mix(slow, fast, speed), glow * mix(0.75, 0.85, uLight));
}
`;

export const panelVertexShader = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const panelFragmentShader = /* glsl */ `
uniform sampler2D map;
uniform float uWeave;
uniform float uTime;
uniform vec3 uGlowColor;
uniform float uHasTexture;
uniform float uHoverT;
uniform float uBaseAlpha;
uniform float uLight;
varying vec2 vUv;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

void main(){
  // An untextured panel falls back to a flat navy fill. That disappears into a
  // near-black page but reads as a grey smudge on a light one, and the nav
  // ghosts are permanently untextured — they exist to catch hover raycasts,
  // not to be seen. Light mode draws nothing and lets them stay hit-targets.
  if (uHasTexture < 0.5 && uLight > 0.5) discard;

  vec4 tex = uHasTexture > 0.5 ? texture2D(map, vUv) : vec4(0.06, 0.07, 0.16, 1.0);
  float n = hash(floor(vUv * 140.0));
  float threshold = uWeave * 1.2 - 0.08;
  if (n > threshold) discard;
  float edge = smoothstep(threshold - 0.1, threshold, n);
  vec3 color = mix(tex.rgb, uGlowColor, clamp(edge * 0.85 + uHoverT * 0.5, 0.0, 1.0));
  float vignette = 1.0 - smoothstep(0.42, 0.5, length(vUv - 0.5));
  float alphaMul = mix(uBaseAlpha, 1.0, uHoverT);
  gl_FragColor = vec4(color, tex.a * vignette * alphaMul);
}
`;

export const postVertexShader = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const postFragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAberration;
uniform float uGrain;
uniform float uVignette;
varying vec2 vUv;

float grainHash(vec2 p){
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(){
  vec2 dir = vUv - 0.5;
  float dist = length(dir);
  vec2 offset = dir * dist * uAberration;

  float r = texture2D(tDiffuse, vUv - offset).r;
  float g = texture2D(tDiffuse, vUv).g;
  float b = texture2D(tDiffuse, vUv + offset).b;
  vec3 color = vec3(r, g, b);

  float grain = (grainHash(vUv * (uTime + 1.0)) - 0.5) * uGrain;
  color += grain;

  float vig = smoothstep(0.9, 0.25, dist * uVignette);
  color *= mix(1.0, vig, 0.5);

  gl_FragColor = vec4(color, 1.0);
}
`;
