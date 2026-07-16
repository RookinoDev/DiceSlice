// Not a Unity port - new for the "Atmospheric fresnel rim" technique in
// docs/CARD_SYSTEM_PLAN.md §1: a soft glow hugging the limb, colored per object (derived from
// the body's own surface palette in PlanetCanvas.tsx's buildAtmosphereLayer, so Earth reads
// cyan, Mars a dusty pink, Titan orange, automatically - no per-object hand authoring needed).
// Same flat-disc quad as every other layer, entirely inside the disc mask (d <= 0.5): the base
// planet's own quad already fills the camera frustum edge-to-edge with zero margin (see
// PlanetCanvas.tsx), so there's no canvas room for a glow to bleed OUTWARD past the silhouette -
// this hugs the limb from the inside instead, brightening the surface right at the grazing edge
// (additive blending), the same look a fresnel rim light gets in most real-time renderers.
export const rimAtmosphereFragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec4 uRimColor;
uniform float uRimWidth;

void main() {
  float d = distance(vUv, vec2(0.5, 0.5));
  if (d > 0.5) discard;
  float rim = smoothstep(0.5 - uRimWidth, 0.5, d);
  if (rim <= 0.001) discard;
  gl_FragColor = vec4(uRimColor.rgb * rim, rim * uRimColor.a);
}
`
