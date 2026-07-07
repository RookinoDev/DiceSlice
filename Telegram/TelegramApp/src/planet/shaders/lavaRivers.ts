// Ported from Assets/PixelPlanets/Shaders/LavaRivers.shader
import { commonNoiseFunctions, commonUniformDeclarations } from '../glsl/common'

export const lavaRiversFragmentShader = /* glsl */ `
varying vec2 vUv;
${commonUniformDeclarations}
uniform float uLightBorder1;
uniform float uLightBorder2;
uniform float uRiverCutoff;
uniform vec4 uColors[3];

${commonNoiseFunctions}

void main() {
  vec2 uv = vUv;
  float d_circle = distance(uv, vec2(0.5, 0.5));
  float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
  float d_light = distance(uv, uLightOrigin);

  uv = rot(uv, uRotation);
  uv = spherify(uv);

  float f1 = fbm(uv * uSize + vec2(uPlanetTime * uTimeSpeed, 0.0));
  float river_fbm = fbm(uv + f1 * 2.5);

  float dl = pow(d_light, 2.0) * 0.4;
  dl -= dl * river_fbm;

  float t1 = smoothstep(uLightBorder1 - 0.025, uLightBorder1 + 0.025, dl);
  float t2 = smoothstep(uLightBorder2 - 0.025, uLightBorder2 + 0.025, dl);
  vec4 col = mix(uColors[0], uColors[1], t1);
  col = mix(col, uColors[2], t2);

  // Smooth river edge - glowing lava veins
  float riverAlpha = smoothstep(uRiverCutoff - 0.05, uRiverCutoff + 0.05, river_fbm);
  gl_FragColor = vec4(col.rgb, riverAlpha * a * col.a);
}
`
