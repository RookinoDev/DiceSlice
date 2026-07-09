// Phase 2 WebGL holo tier (docs/CARD_SYSTEM_PLAN.md §3): a small full-card-quad shader laid
// over a holo card's artwork in the focused detail view. Everything is procedural noise/hash
// math, not a packed pattern-mask texture - "no asset without a generator" (§2), and it means
// this is the first purely-code holo pattern, tunable per rarity without new art. Only ever one
// of these is alive at a time (the one focused card), matching the "hard cap two WebGL
// contexts" budget in §8 alongside the object's own PlanetCanvas render.
import { useEffect, useRef, type RefObject } from 'react'
import { WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial, Vector2, DoubleSide, AdditiveBlending } from 'three'
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

  // Rainbow foil band, angled by the light/tilt vector plus a slow idle drift.
  float band = dot(c, uLight) * 3.2 + uTime * 0.06;
  vec3 rainbow = hsv2rgb(vec3(fract(band), 0.85, 1.0));

  // Two broad specular sweeps at different rates - a fake dual-layer lamination.
  float sweep1 = smoothstep(0.42, 0.0, abs(fract(uv.x + uv.y * 0.3 - dot(uLight, vec2(0.6, 0.4)) * 0.6) - 0.5));
  float sweep2 = smoothstep(0.32, 0.0, abs(fract(uv.x * 0.7 - uv.y - dot(uLight, vec2(-0.4, 0.7)) * 0.6) - 0.5));

  // Discrete sparkle glints - a hashed grid popping in and out, not uniform glitter.
  vec2 cell = floor(uv * (16.0 + uSparkleDensity * 26.0));
  float h = hash(cell);
  float twinkle = step(0.965, h) * max(0.0, 0.5 + 0.5 * sin(uTime * 3.0 + h * 40.0 + dot(uLight, vec2(3.0, 1.7))));

  // Edge highlight that chases the light around the card border.
  float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float rim = smoothstep(0.055, 0.0, edgeDist) * (0.5 + 0.5 * dot(normalize(c), normalize(uLight + vec2(0.0001))));

  float alpha = (0.16 * sweep1 + 0.16 * sweep2 + 0.4 * twinkle + 0.35 * rim) * uIntensity;
  vec3 col = mix(rainbow, vec3(1.0), twinkle * 0.6 + rim * 0.3);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
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
      blending: AdditiveBlending,
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
