// Ported from Assets/PixelPlanets/Shaders/Asteroid.shader
// Self-contained (not using glsl/common's noise chunk): this shader's rand() has no tiling
// ("no tiling - infinite noise gives organic irregular edge") and it never spherifies the UV
// (single flat rock, not a sphere), unlike every other ported planet layer.
export const asteroidFragmentShader = /* glsl */ `
varying vec2 vUv;
uniform float uRotation;
uniform vec2 uLightOrigin;
uniform float uSize;
uniform float uSeed;
uniform vec4 uColors[3];

float rand(vec2 coord) {
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

float circleNoise(vec2 uv) {
  float uy = floor(uv.y);
  uv.x += uy * 0.31;
  vec2 f = fract(uv);
  float h = rand(vec2(floor(uv.x), floor(uy)));
  float m = length(f - 0.25 - h * 0.5);
  float r = h * 0.25;
  return smoothstep(r - 0.1 * r, r, m);
}

float crater(vec2 uv) {
  float c = 1.0;
  for (int i = 0; i < 2; i++) c *= circleNoise(uv * uSize + (float(i + 1) + 10.0));
  return 1.0 - c;
}

vec2 rot(vec2 v, float angle) {
  v -= 0.5;
  float c = cos(angle), s = sin(angle);
  return mat2(c, s, -s, c) * v + 0.5;
}

void main() {
  vec2 uv = vUv;
  float d = distance(uv, vec2(0.5, 0.5));
  vec2 lo = uLightOrigin;

  uv = rot(uv, uRotation);

  float n = fbm(uv * uSize);
  float n2 = fbm(uv * uSize + (rot(lo, uRotation) - 0.5) * 0.5);

  // Irregular rock boundary - smooth edge via fbm
  float ns = smoothstep(0.16, 0.24, n - d);
  float n2s = smoothstep(0.16, 0.24, n2 - d);
  float rel = (n2s + n2) - (ns + n);

  float c1 = crater(uv);
  float c2 = crater(uv + (lo - 0.5) * 0.03);

  // Toon 3-band shading
  float t_shadow = smoothstep(-0.08, -0.02, rel);
  float t_light = smoothstep(0.02, 0.08, rel);
  vec4 col = uColors[1];
  col = mix(col, uColors[0], t_shadow);
  col = mix(col, uColors[2], t_light);

  // Crater overlay
  if (c1 > 0.4) col = uColors[1];
  if (c2 < c1) col = mix(col, uColors[2], 0.6);

  // Smooth rock silhouette
  float alpha = smoothstep(0.14, 0.22, n - d);
  gl_FragColor = vec4(col.rgb, alpha * col.a);
}
`
