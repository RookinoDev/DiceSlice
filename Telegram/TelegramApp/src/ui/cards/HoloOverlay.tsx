// Phase 2 WebGL holo tier (docs/CARD_SYSTEM_PLAN.md §3): a small full-card-quad shader laid
// over a holo card's artwork in the focused detail view. The rainbow band pattern is driven by
// a real authored texture (holofoil-mask-tile.png, a tileable 512x512 grayscale swirl - see
// §2's asset manifest) rather than pure sine math, matching the plan's own formula:
// "hue = dot(lightVec, uv-warp) * frequency + patternMask.r". Sparkle/sweep/edge layers stay
// procedural (hash-based) since those are discrete events, not a pattern to author. Only ever
// one of these is alive at a time (the one focused card), matching the "hard cap two WebGL
// contexts" budget in §8 alongside the object's own PlanetCanvas render.
import { useEffect, useRef, type RefObject } from 'react'
import { WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial, Vector2, DoubleSide, NormalBlending, TextureLoader, RepeatWrapping, LinearFilter } from 'three'
import type { CardRarity } from '../../game/cards/catalog'
import holofoilMaskUrl from '../../assets/cards/holofoil-mask-tile.png'

// Loaded once and shared across every HoloOverlay instance ever mounted (a card is opened and
// closed repeatedly over a session) - Three.js Textures are renderer-agnostic, so one decoded
// image can back many independent WebGLRenderers without re-fetching. Never disposed: it's a
// tiny (512x512) texture meant to live for the app's lifetime, same discipline as a sprite atlas.
const holofoilMask = new TextureLoader().load(holofoilMaskUrl)
holofoilMask.wrapS = RepeatWrapping
holofoilMask.wrapT = RepeatWrapping
holofoilMask.minFilter = LinearFilter
holofoilMask.magFilter = LinearFilter

export interface HoloLightVector {
  x: number
  y: number
}

interface HoloOverlayProps {
  rarity: CardRarity
  /** Mutable light-vector input (-1..1 per axis), written imperatively by the card's own drag-tilt handler - read every frame, never triggers a re-render. */
  lightRef: RefObject<HoloLightVector>
  className?: string
}

// Rarity -> holo strength/density (docs/CARD_SYSTEM_PLAN.md §3 rarity table): higher tiers get a
// brighter foil and denser sparkle field. Common/uncommon never render this component at all
// (holo is a per-instance mint roll - see cardsApi.ts's OwnedCard.holo - independent of rarity).
const INTENSITY: Record<CardRarity, number> = { common: 0.55, uncommon: 0.6, rare: 0.7, epic: 0.85, legendary: 1.0, ultra: 1.15 }
const SPARKLE_DENSITY: Record<CardRarity, number> = { common: 0.2, uncommon: 0.3, rare: 0.45, epic: 0.65, legendary: 0.85, ultra: 1.0 }

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Real foil is subtle: a slow, broad pastel gradient (not a busy rainbow), one soft glassy
// sweep as the actual "catching the light" moment, and rare, gentle glints - alpha-blended
// (NOT additive - additive is why an earlier version vanished on bright art: adding a rainbow
// to near-white pixels just makes more white) and capped well under full opacity so the card's
// own art always reads through clearly underneath the foil, not washed out by it.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec2 uLight;
uniform float uTime;
uniform float uIntensity;
uniform float uSparkleDensity;
uniform sampler2D uMaskTex;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  vec2 lightDir = length(uLight) > 0.001 ? normalize(uLight) : vec2(0.0, 1.0);
  float pos = dot(c, lightDir);

  // The authored swirl mask, warped by the light/tilt vector so the pattern itself seems to
  // shift under the card the way a real diffraction surface does, plus a slow independent
  // drift so it's never fully static at rest. Tiled 2.4x across the card (RepeatWrapping).
  vec2 maskUv = uv * 2.4 + lightDir * 0.35 + vec2(uTime * 0.015, -uTime * 0.011);
  float mask = texture2D(uMaskTex, maskUv).r;

  // Broad, slow color drift (low frequency = smooth wide bands, not busy stripes) - the mask
  // only nudges the phase gently so the swirl organizes it without dominating the gradient.
  float bandsFine = pos * 4.0 + uTime * 0.1;
  float bandsCoarse = pos * 1.6 - uTime * 0.035 + c.x * 1.1;
  float hue = fract(bandsFine * 0.32 + bandsCoarse * 0.24 + mask * 0.16);
  // Pastel, not neon: modest saturation, and always blended a little toward white for a
  // pearlescent rather than a saturated-rainbow read.
  vec3 rainbow = mix(hsv2rgb(vec3(hue, 0.4, 1.0)), vec3(1.0), 0.22);

  // One soft specular band glides across the card as the light angle changes - the single
  // "glassy lamination catching the light" moment, wide and gentle rather than a hard stripe.
  float sweepPos = fract(pos * 1.1 + dot(uLight, vec2(0.8, 0.5)) * 0.6 + uTime * 0.05);
  float sweep = pow(smoothstep(0.62, 0.0, abs(sweepPos - 0.5)), 1.6);

  // Sparse, soft glints - a rare catch-light, not a field of static.
  vec2 cell = floor(uv * (14.0 + uSparkleDensity * 20.0));
  float h = hash(cell);
  float twinklePhase = sin(uTime * 1.8 + h * 60.0 + dot(uLight, vec2(4.0, 2.3)));
  float twinkle = step(0.988, h) * smoothstep(0.7, 1.0, twinklePhase);
  float maskGlint = smoothstep(0.82, 0.97, mask) * (0.5 + 0.5 * sin(uTime * 2.0 + mask * 30.0));
  twinkle = max(twinkle * 0.7, maskGlint * uSparkleDensity * 0.4);

  // A faint base tint is always present (so the foil reads at rest, not only mid-drag), the
  // sweep and glints layer brighter moments on top - overall capped so art underneath survives.
  float alpha = clamp((0.13 + 0.18 * sweep + twinkle * 0.5) * uIntensity, 0.0, 0.62);
  vec3 col = mix(rainbow, vec3(1.0), sweep * 0.3 + twinkle * 0.6);
  gl_FragColor = vec4(col, alpha);
}
`

export function HoloOverlay({ rarity, lightRef, className }: HoloOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)

    const scene = new Scene()
    const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10)
    camera.position.z = 5

    const geometry = new PlaneGeometry(1, 1)
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uLight: { value: new Vector2(0, 0) },
        uTime: { value: 0 },
        uIntensity: { value: INTENSITY[rarity] },
        uSparkleDensity: { value: SPARKLE_DENSITY[rarity] },
        uMaskTex: { value: holofoilMask },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
    })
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)

    const resize = () => {
      const { clientWidth, clientHeight } = canvas
      if (clientWidth > 0 && clientHeight > 0) renderer.setSize(clientWidth, clientHeight, false)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    let raf = 0
    let t = 0
    let last = performance.now()
    const animate = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      t += dt
      material.uniforms.uTime.value = t
      const light = lightRef.current
      if (light) material.uniforms.uLight.value.set(light.x, light.y)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      material.dispose()
      geometry.dispose()
      renderer.dispose()
    }
  }, [rarity, lightRef])

  return <canvas ref={canvasRef} className={className} />
}
