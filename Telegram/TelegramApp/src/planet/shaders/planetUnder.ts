// Ported from Assets/PixelPlanets/Shaders/PlanetUnder.shader
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const planetUnderFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uLightBorder1;
uniform float uLightBorder2;
uniform vec4 uColors[3];

${commonNoiseFunctions}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
  float d_light = distance(uv, uLightOrigin);

  uv = spherify(uv);
  uv = rot(uv, uRotation);
  d_light += fbm(uv * uSize + vec2(uPlanetTime * uTimeSpeed, 0.0)) * 0.3;

  float t1 = smoothstep(uLightBorder1 - 0.025, uLightBorder1 + 0.025, d_light);
  float t2 = smoothstep(uLightBorder2 - 0.025, uLightBorder2 + 0.025, d_light);
  vec4 col = mix(uColors[0], uColors[1], t1);
  col = mix(col, uColors[2], t2);
  gl_FragColor = vec4(col.rgb, a * col.a);
}
`
