// Ported from Assets/PixelPlanets/Shaders/PlanetLandmass.shader
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const planetLandmassFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uLightBorder1;
uniform float uLightBorder2;
uniform float uLandCutoff;
uniform vec4 uColors[4];

${commonNoiseFunctions}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
  float d_light = distance(uv, uLightOrigin);

  uv = rot(uv, uRotation);
  uv = spherify(uv);

  vec2 base = uv * uSize + vec2(uPlanetTime * uTimeSpeed, 0.0);
  vec2 lo = uLightOrigin;
  float f1 = fbm(base);
  float f2 = fbm(base - lo * f1);
  float f3 = fbm(base - lo * 1.5 * f1);
  float f4 = fbm(base - lo * 2.0 * f1);

  if (d_light < uLightBorder1) f4 *= 0.9;
  if (d_light > uLightBorder1) { f2 *= 1.05; f3 *= 1.05; f4 *= 1.05; }
  if (d_light > uLightBorder2) { f2 *= 1.3; f3 *= 1.4; f4 *= 1.8; }
  float dl = pow(d_light, 2.0) * 0.1;

  vec4 col = uColors[3];
  col = mix(col, uColors[2], smoothstep(f1 - dl - 0.02, f1 - dl + 0.02, f4));
  col = mix(col, uColors[1], smoothstep(f1 - dl - 0.02, f1 - dl + 0.02, f3));
  col = mix(col, uColors[0], smoothstep(f1 - dl - 0.02, f1 - dl + 0.02, f2));

  float landAlpha = smoothstep(uLandCutoff - 0.04, uLandCutoff + 0.04, f1);
  gl_FragColor = vec4(col.rgb, landAlpha * a * col.a);
}
`
