// Ported from Assets/PixelPlanets/Shaders/PlanetClouds.shader
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const planetCloudsFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uCloudCover;
uniform float uStretch;
uniform float uCloudCurve;
uniform float uLightBorder1;
uniform float uLightBorder2;
// Atmosphere Stripping (#67): 1.0 (default, fully intact) for undamaged planets; clouds thin
// out below ~55% hull and are effectively blasted away near death.
uniform float uHpFraction;
uniform vec4 uColors[4];

${commonNoiseFunctions}

float circleNoise(vec2 uv) {
  float uy = floor(uv.y);
  uv.x += uy * 0.31;
  vec2 f = fract(uv);
  float h = rand(vec2(floor(uv.x), floor(uy)));
  float m = length(f - 0.25 - h * 0.5);
  float r = h * 0.25;
  return smoothstep(0.0, r, m * 0.75);
}

// Always smooth puffy clouds - 3 large-scale layers only
float cloudAlpha(vec2 uv) {
  vec2 scroll = vec2(uPlanetTime * uTimeSpeed, 0.0);
  float cn = circleNoise(uv * uSize * 0.10 + 10.0 + scroll);
  cn += circleNoise(uv * uSize * 0.07 + 20.0 + scroll) * 0.5;
  cn += circleNoise(uv * uSize * 0.04 + 30.0 + scroll) * 0.25;
  float shape = fbm(uv * uSize * 0.18 + scroll);
  return cn * (0.45 + shape * 0.55);
}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
  float d_light = distance(uv, uLightOrigin);

  uv = rot(uv, uRotation);
  uv = spherify(uv);
  uv.y += smoothstep(0.0, uCloudCurve, abs(uv.x - 0.4));
  float c2 = cloudAlpha(uv * vec2(1.0, uStretch));

  float ld = d_light + c2 * 0.2;
  float t0 = smoothstep(uCloudCover + 0.01 - 0.025, uCloudCover + 0.01 + 0.025, c2);
  float t1 = smoothstep(uLightBorder1 - 0.025, uLightBorder1 + 0.025, ld);
  float t2 = smoothstep(uLightBorder2 - 0.025, uLightBorder2 + 0.025, ld);

  vec4 col = mix(uColors[1], uColors[0], t0);
  col = mix(col, uColors[2], t1);
  col = mix(col, uColors[3], t2);

  float cloudAlphaVal = smoothstep(uCloudCover - 0.10, uCloudCover + 0.10, c2);
  float stripped = smoothstep(0.08, 0.55, uHpFraction);
  gl_FragColor = vec4(col.rgb, cloudAlphaVal * a * col.a * stripped);
}
`
