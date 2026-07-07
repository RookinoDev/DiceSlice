// Ported from Assets/PixelPlanets/Shaders/GasLayers.shader
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const gasLayersFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uCloudCover;
uniform float uStretch;
uniform float uBands;
uniform vec4 uColors[3];
uniform vec4 uDarkColors[3];

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

float turbulence(vec2 uv) {
  vec2 scroll = vec2(uPlanetTime * uTimeSpeed, 0.0);
  float cn = 0.0;
  cn += circleNoise(uv * uSize * 0.12 + 10.0 + scroll);
  cn += circleNoise(uv * uSize * 0.08 + 20.0 + scroll) * 0.5;
  cn += circleNoise(uv * uSize * 0.05 + 30.0 + scroll) * 0.25;
  return cn;
}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
  float light_d = distance(uv, uLightOrigin);

  uv = rot(uv, uRotation);
  uv = spherify(uv);

  // uStretch elongates turbulence patterns horizontally (classic gas giant look)
  vec2 suv = vec2(uv.x * uStretch, uv.y);
  float band = fbm(vec2(0.0, uv.y * uSize * uBands));
  float turb = turbulence(suv);
  float f1 = fbm(suv * uSize);
  float f2 = fbm(suv * vec2(1.0, 2.0) * uSize + f1 + vec2(-uPlanetTime * uTimeSpeed, 0.0) + turb);
  f2 *= pow(band, 2.0) * 7.0;
  float light = f2 + light_d * 1.8;
  f2 += pow(light_d, 1.0) - 0.3;
  f2 = smoothstep(-0.2, 4.0 - f2, light);

  // Toon posterization: 4 smooth bands
  float post = floor(f2 * 4.0) / 2.0;
  post = clamp(post, 0.0, 2.0);

  // uCloudCover shifts light/dark band boundary
  vec4 col;
  if (f2 < uCloudCover) {
    int idx = clamp(int(post * 2.0), 0, 2);
    float blend = fract(post * 2.0);
    col = mix(uColors[idx], uColors[min(idx + 1, 2)], smoothstep(0.4, 0.6, blend));
  } else {
    float pp = clamp((post - 1.0) * 2.0, 0.0, 1.99);
    int idx = clamp(int(pp), 0, 2);
    float blend = fract(pp);
    col = mix(uDarkColors[idx], uDarkColors[min(idx + 1, 2)], smoothstep(0.4, 0.6, blend));
  }
  gl_FragColor = vec4(col.rgb, a * col.a);
}
`
