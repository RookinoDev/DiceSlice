// Ported from Assets/PixelPlanets/Shaders/PlanetCraters.shader
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const planetCratersFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uLightBorder;
uniform float uCraterCutoff;
uniform float uCraterRadius;
uniform vec4 uColors[2];

${commonNoiseFunctions}

// Samples a 3x3 neighbourhood so a crater can bleed across cell borders. This keeps circles
// COMPLETE even when uCraterRadius is large (no half/quarter holes).
float circleNoise(vec2 uv) {
  float result = 1.0;
  vec2 ip = floor(uv);
  for (int yy = -1; yy <= 1; yy++) {
    for (int xx = -1; xx <= 1; xx++) {
      vec2 cell = ip + vec2(float(xx), float(yy));
      float h = rand(cell);
      float h2 = rand(cell + 17.0);
      vec2 center = cell + vec2(0.25 + h * 0.5, 0.25 + h2 * 0.5);
      float m = length(uv - center);
      float r = h * 0.25 * uCraterRadius; // uCraterRadius scales hole size only
      result = min(result, smoothstep(r - 0.1 * r, r, m));
    }
  }
  return result;
}

float crater(vec2 uv) {
  float c = 1.0;
  vec2 scroll = vec2(uPlanetTime * uTimeSpeed, 0.0);
  for (int i = 0; i < 2; i++) c *= circleNoise(uv * uSize + (float(i + 1) + 10.0) + scroll);
  return 1.0 - c;
}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
  float d_light = distance(uv, uLightOrigin);

  uv = rot(uv, uRotation);
  uv = spherify(uv);

  float c1 = crater(uv);
  float c2 = crater(uv + (uLightOrigin - 0.5) * 0.03);

  // uCraterCutoff: higher = more craters visible
  float craterAlpha = smoothstep((1.0 - uCraterCutoff) - 0.05, (1.0 - uCraterCutoff) + 0.05, c1);
  float shadow = smoothstep(0.0, 0.05, c1 - c2 - (0.5 - d_light) * 2.0);
  float lightShadow = smoothstep(uLightBorder - 0.03, uLightBorder + 0.03, d_light);

  vec4 col = mix(uColors[0], uColors[1], max(shadow, lightShadow));
  gl_FragColor = vec4(col.rgb, craterAlpha * a * col.a);
}
`
