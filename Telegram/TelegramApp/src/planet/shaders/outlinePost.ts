// Ported from Assets/Toon/Shaders/OutlinePostEffect.shader (the CameraOutline post effect) -
// the piece of Unity's toon stack that actually gave PLANETS their ink outline. Unity combined
// depth+normal edges (solid meshes) with luminance edges (transparent quads = the planets);
// this renderer has no depth - everything is alpha-blended quads - so it keeps the luminance
// branch verbatim and adds an alpha-edge term for the silhouette, which Unity got for free as
// a luminance step against its opaque space background (ours is transparent).
export const outlinePostVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const outlinePostFragmentShader = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uTexel;

// Matches CameraOutline.cs defaults: thickness 1.2, color threshold 0.18, color weight 0.5,
// ink color (0.05, 0.05, 0.08). Baked as constants: they were scene-wide in Unity too, never
// varied per object.
const float THICKNESS = 1.2;
const float COLOR_THRESHOLD = 0.18;
const float COLOR_WEIGHT = 0.5;
const float ALPHA_THRESHOLD = 0.5;
const vec3 OUTLINE_COLOR = vec3(0.05, 0.05, 0.08);

void main() {
  vec2 t = uTexel * THICKNESS;

  // Roberts Cross: the same 4-tap diagonal layout as the Unity source.
  vec4 c00 = texture2D(uScene, vUv);
  vec4 c11 = texture2D(uScene, vUv + t);
  vec4 c10 = texture2D(uScene, vUv + vec2(t.x, 0.0));
  vec4 c01 = texture2D(uScene, vUv + vec2(0.0, t.y));

  const vec3 W = vec3(0.299, 0.587, 0.114);
  float cEdge = abs(dot(c00.rgb, W) - dot(c11.rgb, W)) + abs(dot(c10.rgb, W) - dot(c01.rgb, W));
  float aEdge = abs(c00.a - c11.a) + abs(c10.a - c01.a);

  float edge = step(ALPHA_THRESHOLD, aEdge) + step(COLOR_THRESHOLD, cEdge) * COLOR_WEIGHT;
  edge = clamp(edge, 0.0, 1.0);

  // Ink over the scene; edge pixels outside the silhouette gain alpha so the line can sit
  // just past the disc's rim instead of eating into it.
  gl_FragColor = vec4(mix(c00.rgb, OUTLINE_COLOR, edge), max(c00.a, edge));
}
`
