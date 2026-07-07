// Ported from Assets/PixelPlanets/Shaders/PlanetRing.shader
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const planetRingFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uRingWidth;
uniform float uRingPerspective;
uniform float uScaleRelPlanet;
// Ring Destruction (#69): defaults to 1.0 (fully intact) for every planet. Only boss gas
// giants ever drive this down, eroding ring segments as real hull fraction drops.
uniform float uHpFraction;
uniform vec4 uColors[3];
uniform vec4 uDarkColors[3];

${commonNoiseFunctions}

void main() {
  vec2 uv = vUv;
  float light_d = distance(uv, uLightOrigin);
  uv = rot(uv, uRotation);

  vec2 uvc = uv - vec2(0.0, 0.5);
  uvc *= vec2(1.0, uRingPerspective);
  float cd = distance(uvc, vec2(0.5, 0.0));
  float ring = smoothstep(0.5 - uRingWidth * 2.0, 0.5 - uRingWidth, cd);
  ring *= smoothstep(cd - uRingWidth, cd, 0.4);

  // Planet occludes lower half of ring
  if (uv.y < 0.5) {
    ring *= smoothstep(1.0 / uScaleRelPlanet - 0.01, 1.0 / uScaleRelPlanet + 0.01, distance(uv, vec2(0.5, 0.5)));
  }

  uvc = rot(uvc + vec2(0.0, 0.5), uPlanetTime * uTimeSpeed);
  ring *= fbm(uvc * uSize);

  float post = floor((ring + pow(light_d, 2.0) * 2.0) * 4.0) / 4.0;
  post = clamp(post, 0.0, 2.0);

  vec4 col;
  if (post <= 1.0) {
    col = mix(uColors[min(2, int(post * 2.0))], uColors[min(2, int(post * 2.0) + 1)], smoothstep(0.4, 0.6, fract(post * 2.0)));
  } else {
    col = mix(uDarkColors[min(2, int((post - 1.0) * 2.0))], uDarkColors[min(2, int((post - 1.0) * 2.0) + 1)], smoothstep(0.4, 0.6, fract((post - 1.0) * 2.0)));
  }

  float ring_a = smoothstep(0.22, 0.32, ring);

  // Erode ring segments angularly as uHpFraction falls - a static per-angle hash so the same
  // segments crumble first each frame (reads as real damage, not flicker), fully gone at 0.
  float angle = atan(uvc.y, uvc.x - 0.5);
  float segHash = fract(sin(angle * 12.9898 + uSeed * 0.017) * 43758.5453);
  float segAlive = smoothstep(1.0 - uHpFraction - 0.06, 1.0 - uHpFraction, segHash);

  gl_FragColor = vec4(col.rgb, ring_a * col.a * segAlive);
}
`
