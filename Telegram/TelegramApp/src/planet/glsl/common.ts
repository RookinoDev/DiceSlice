// Shared GLSL ported from the noise/rotation/spherify helpers duplicated across
// Assets/PixelPlanets/Shaders/{NoAtmosphere,PlanetCraters,PlanetUnder,PlanetLandmass,PlanetClouds}.shader.
// Those Unity CGPROGRAM shaders are near-identical here (rand/noise/fbm/rot/spherify) - kept as
// one shared chunk instead of duplicating ~20 lines five times.
//
// Note on rot(): HLSL's `mul(v, float2x2(c,s,-s,c))` (row-vector * row-major matrix) produces the
// same result as GLSL's `mat2(c,s,-s,c) * v` (column-major constructor * column-vector) - the
// column-major/row-major conventions cancel out for this particular construction.

// Three.js ShaderMaterial auto-injects `uv`/`position` attributes and standard matrix uniforms,
// so the vertex shader body only needs to do the same UV flip the Unity vert() did.
export const planetVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** Shared uniforms every planet layer shader declares. Append layer-specific ones after this. */
export const commonUniformDeclarations = /* glsl */ `
uniform float uRotation;
uniform vec2 uLightOrigin;
uniform float uTimeSpeed;
uniform float uSize;
uniform float uSeed;
uniform float uPlanetTime;
// (1,1) for most layers; (2,1) for PlanetUnder/PlanetLandmass (see rand() in the Unity source).
uniform vec2 uRandMod;
`

export const commonNoiseFunctions = /* glsl */ `
vec2 glmod(vec2 x, vec2 y) { return x - y * floor(x / y); }

float rand(vec2 coord) {
  coord = glmod(coord, uRandMod * floor(uSize + 0.5));
  return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 15.5453 * uSeed);
}

float noiseFn(vec2 coord) {
  vec2 i = floor(coord);
  vec2 f = fract(coord);
  float a = rand(i), b = rand(i + vec2(1.0, 0.0)), c = rand(i + vec2(0.0, 1.0)), d = rand(i + vec2(1.0, 1.0));
  vec2 cu = f * f * (3.0 - 2.0 * f);
  return mix(a, b, cu.x) + (c - a) * cu.y * (1.0 - cu.x) + (d - b) * cu.x * cu.y;
}

float fbm(vec2 coord) {
  float v = 0.0, s = 0.5;
  for (int i = 0; i < 4; i++) {
    v += noiseFn(coord) * s;
    coord *= 2.0;
    s *= 0.5;
  }
  return v;
}

vec2 spherify(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  float z = sqrt(max(0.0, 1.0 - dot(c, c)));
  return (c / (z + 1.0)) * 0.5 + 0.5;
}

vec2 rot(vec2 coord, float angle) {
  coord -= 0.5;
  float c = cos(angle), s = sin(angle);
  return mat2(c, s, -s, c) * coord + 0.5;
}
`
