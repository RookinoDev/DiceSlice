// Not a Unity port - new for the web app's Super Juice pass.
// Cracks Follow Tap Patterns (#65) + Real Phase Changes (#44): an overlay layer that draws
// fracture lines radiating from the actual recorded impact points (see PlanetCanvas's impulse
// API), stuck to the rotating surface. Above 50% hull they're dark fractures; below, they
// become pulsing magma fissures - a genuine rendering phase change, not a color swap.
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

/** Matches the fixed-size uniform array in the shader below and the ring buffer in PlanetCanvas. */
export const MAX_CRACK_IMPACTS = 16

export const planetCracksFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uHpFraction;
uniform vec2 uImpacts[${MAX_CRACK_IMPACTS}];
uniform int uImpactCount;

${commonNoiseFunctions}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float mask = 1.0 - smoothstep(0.48, 0.495, d_circle);
  if (mask <= 0.001) discard;

  // Same rot() the surface layers sample with, so cracks rotate with the terrain instead of
  // floating over it (impact points are stored pre-rotated into this same surface space).
  vec2 suv = rot(uv, uRotation);

  float crack = 0.0;
  for (int i = 0; i < ${MAX_CRACK_IMPACTS}; i++) {
    if (i >= uImpactCount) break;
    vec2 p = uImpacts[i];
    vec2 d = suv - p;
    float dist = length(d) + 1e-5;
    float ang = atan(d.y, d.x);
    // A few noisy radial arms per impact - phase offset from the point itself so every
    // impact fractures differently, fbm wobble so arms wander instead of staying straight.
    float wob = fbm(suv * uSize + p * 37.0) * 2.2;
    float arms = abs(sin(ang * 3.0 + p.x * 40.0 + p.y * 23.0 + wob));
    float line = smoothstep(0.82, 0.98, arms) * smoothstep(0.16, 0.015, dist);
    crack = max(crack, line);
  }

  float damage = clamp(1.0 - uHpFraction, 0.0, 1.0);
  float phase = smoothstep(0.5, 0.3, uHpFraction);
  float pulse = 0.7 + 0.3 * sin(uPlanetTime * uTimeSpeed * 30.0);
  vec3 darkCol = vec3(0.02, 0.02, 0.06);
  vec3 glowCol = vec3(1.0, 0.42, 0.10) * pulse;
  vec3 col = mix(darkCol, glowCol, phase);

  // Fresh planets show impacts faintly; accumulated damage deepens every crack.
  float alpha = crack * mask * (0.35 + 0.65 * damage);
  gl_FragColor = vec4(col, alpha);
}
`
