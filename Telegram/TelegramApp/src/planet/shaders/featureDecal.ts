// Not a Unity port - new for Phase 2's "Signature Features" layer (docs/CARD_SYSTEM_PLAN.md §1).
// Stamps up to MAX_FEATURES real landmarks (Jupiter's Great Red Spot, Mars' Valles Marineris...)
// onto the rotating surface as soft noise-wobbled ellipses. Mirrors planetCracks.ts's pattern:
// a fixed-size uniform array + count, sampled in the same rot(uv, uRotation) surface space so
// features track the body's spin for free.
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const MAX_FEATURES = 4

export const featureDecalFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform vec2 uFeatureUv[${MAX_FEATURES}];
uniform vec2 uFeatureRadius[${MAX_FEATURES}];
uniform float uFeatureAngle[${MAX_FEATURES}];
uniform vec4 uFeatureColor[${MAX_FEATURES}];
uniform int uFeatureCount;

${commonNoiseFunctions}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float mask = 1.0 - smoothstep(0.487, 0.5, d_circle);
  if (mask <= 0.001) discard;

  vec2 suv = rot(uv, uRotation);

  vec4 col = vec4(0.0);
  for (int i = 0; i < ${MAX_FEATURES}; i++) {
    if (i >= uFeatureCount) break;
    vec2 d = suv - uFeatureUv[i];
    float c = cos(uFeatureAngle[i]);
    float s = sin(uFeatureAngle[i]);
    vec2 rd = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    // Noise-wobbled edge so the ellipse reads as an organic storm/scar, not a clean shape.
    float wob = fbm(suv * 40.0 + float(i) * 11.0) * 0.18;
    float dist = length(rd / uFeatureRadius[i]) + wob;
    float edge = smoothstep(1.0, 0.55, dist);
    col = mix(col, uFeatureColor[i], edge * uFeatureColor[i].a);
  }
  gl_FragColor = vec4(col.rgb, col.a * mask);
}
`
