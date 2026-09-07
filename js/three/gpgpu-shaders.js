import { snoise3 } from "./shaders.js";

export const gpgpuPositionShader = /* glsl */ `
uniform float uDelta;

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);

  pos.xyz += vel.xyz * uDelta;

  float boundX = 1400.0;
  float boundY = 900.0;
  if (pos.x > boundX) pos.x -= boundX * 2.0;
  if (pos.x < -boundX) pos.x += boundX * 2.0;
  if (pos.y > boundY) pos.y -= boundY * 2.0;
  if (pos.y < -boundY) pos.y += boundY * 2.0;
  if (pos.z > 400.0) pos.z -= 5600.0;
  if (pos.z < -5200.0) pos.z += 5600.0;

  pos.w = length(vel.xyz);

  gl_FragColor = pos;
}
`;

export const gpgpuVelocityShader = /* glsl */ `
uniform float uTime;
uniform float uDelta;
uniform vec3 uAttractor1;
uniform float uAttractor1Strength;
uniform vec3 uAttractor2;
uniform float uAttractor2Strength;
uniform vec3 uAttractor3;
uniform float uAttractor3Strength;

${snoise3}

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(texturePosition, uv).xyz;
  vec3 vel = texture2D(textureVelocity, uv).xyz;

  vec3 curl = vec3(
    snoise(pos * 0.0016 + vec3(0.0, uTime * 0.09, 0.0)),
    snoise(pos * 0.0016 + vec3(uTime * 0.09, 0.0, 100.0)),
    snoise(pos * 0.0016 + vec3(0.0, 100.0, uTime * 0.09))
  );
  vel += curl * 7.0 * uDelta;

  vec3 toA1 = uAttractor1 - pos;
  float dA1 = length(toA1);
  vel += normalize(toA1 + 0.0001) * smoothstep(950.0, 0.0, dA1) * uAttractor1Strength * uDelta;

  vec3 toA2 = uAttractor2 - pos;
  float dA2 = length(toA2);
  vel += normalize(toA2 + 0.0001) * smoothstep(950.0, 0.0, dA2) * uAttractor2Strength * uDelta;

  vec3 toA3 = uAttractor3 - pos;
  float dA3 = length(toA3);
  vel += normalize(toA3 + 0.0001) * smoothstep(1400.0, 0.0, dA3) * uAttractor3Strength * uDelta;

  vel *= 0.945;

  float speed = length(vel);
  float maxSpeed = 46.0;
  if (speed > maxSpeed) vel = normalize(vel) * maxSpeed;

  gl_FragColor = vec4(vel, 1.0);
}
`;
