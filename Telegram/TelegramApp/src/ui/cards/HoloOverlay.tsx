// Phase 2 WebGL holo tier (docs/CARD_SYSTEM_PLAN.md §3): a small full-card-quad shader laid
// over a holo card's artwork in the focused detail view. Everything is procedural noise/hash
// math, not a packed pattern-mask texture - "no asset without a generator" (§2), and it means
// this is the first purely-code holo pattern, tunable per rarity without new art. Only ever one
// of these is alive at a time (the one focused card), matching the "hard cap two WebGL
// contexts" budget in §8 alongside the object's own PlanetCanvas render.
import { useEffect, useRef, type RefObject } from 'react'
import { WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial, Vector2, DoubleSide, NormalBlending } from 'three'
import type { CardRarity } from '../../game/cards/catalog'

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

// Real foil under light is a diffraction grating (fine parallel color bands that shift hue
// as the angle changes) plus a glassy specular sweep plus rare bright glints - three distinct
// visible layers, alpha-blended (NOT additive - additive is why the old version vanished on
// bright art: adding a rainbow to near-white pixels just makes more white) so the color reads
// as a real translucent tint over ANY artwork, dark or light.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec2 uLight;
uniform float uTime;
uniform float uIntensity;
uniform float uSparkleDensity;

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

  // Diffraction grating: fine + coarse bands at different speeds/angles so the hue cycles
  // richly across the surface instead of one smooth gradient - reads as an actual foil texture.
  float bandsFine = pos * 13.0 + uTime * 0.18;
  float bandsCoarse = pos * 3.5 - uTime * 0.06 + c.x * 2.0;
  float hue = fract(bandsFine * 0.12 + bandsCoarse * 0.4);
  vec3 rainbow = hsv2rgb(vec3(hue, 0.7, 1.0));

  // A bright specular band glides across the card as the light angle changes - the "glassy
  // lamination catching the light" read.
  float sweepPos = fract(pos * 1.2 + dot(uLight, vec2(0.8, 0.5)) * 0.6 + uTime * 0.05);
  float sweep = pow(smoothstep(0.5, 0.0, abs(sweepPos - 0.5)), 2.0);

  // Rare, small, bright glints - not a wash across the whole card.
  vec2 cell = floor(uv * (20.0 + uSparkleDensity * 34.0));
  float h = hash(cell);
  float twinklePhase = sin(uTime * 2.2 + h * 60.0 + dot(uLight, vec2(4.0, 2.3)));
  float twinkle = step(0.975, h) * smoothstep(0.55, 1.0, twinklePhase);

  // A base tint is always present (so the foil reads even before the player ever touches the
  // card), the sweep and glints layer brighter moments on top.
  float alpha = clamp((0.24 + 0.22 * sweep + twinkle * 0.9) * uIntensity, 0.0, 0.95);
  vec3 col = mix(rainbow, vec3(1.0), sweep * 0.35 + twinkle * 0.85);
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
