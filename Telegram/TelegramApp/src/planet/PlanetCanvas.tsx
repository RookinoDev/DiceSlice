// Three.js replacement for PixelPlanetGenerator's quad-stack + orthographic camera approach
// (Assets/PixelPlanets/Scripts/PixelPlanetGenerator.cs MakeLayer/MakeMat/Update).
import { useEffect, useRef } from 'react'
import { WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial, Vector2, Vector4, DoubleSide, type Material, type IUniform } from 'three'
import { planetVertexShader } from './glsl/common'
import { noAtmosphereFragmentShader } from './shaders/noAtmosphere'
import { planetCratersFragmentShader } from './shaders/planetCraters'
import { planetUnderFragmentShader } from './shaders/planetUnder'
import { planetLandmassFragmentShader } from './shaders/planetLandmass'
import { planetCloudsFragmentShader } from './shaders/planetClouds'
import { gasLayersFragmentShader } from './shaders/gasLayers'
import { planetRingFragmentShader } from './shaders/planetRing'
import { lavaRiversFragmentShader } from './shaders/lavaRivers'
import { asteroidFragmentShader } from './shaders/asteroid'
import { planetCracksFragmentShader, MAX_CRACK_IMPACTS } from './shaders/planetCracks'
import { RING_SCALE, planetMaxScale, type PlanetProfile } from './planetProfiles'
import type { RGB } from './themes'

// Matches PixelPlanetGenerator.TR(factor) = (2*round(50)/0.2)*factor = 500*factor, evaluated
// for the factors actually used in the generator (0.02 for most layers, 0.01 for clouds,
// 0.004 for gas bands). The ring's rate is its own literal constant in the Unity source
// (314.15*0.004), not derived from TR().
const TIME_RATE_BASE = 10
const TIME_RATE_CLOUD = 5
const TIME_RATE_GAS = 2
const TIME_RATE_RING = 314.15 * 0.004

function colorsToVec4(colors: RGB[]): Vector4[] {
  return colors.map(([r, g, b]) => new Vector4(r, g, b, 1))
}

interface LayerSpec {
  fragmentShader: string
  uniforms: Record<string, IUniform>
  timeRate: number
  renderOrder: number
  /** extra rotation added on top of the shared planet rotation (e.g. gas giant ring: +0.7 rad) */
  rotationOffset?: number
  /** quad scale relative to the planet (e.g. gas giant ring: 3x, matching MakeLayer's scaleMultiplier) */
  scale?: number
  /** Gas giant storm body: its animation time accelerates as real hull fraction drops (#44's gas-kind phase change). */
  isStorm?: boolean
  /** Cracks overlay (#65): receives recorded impact points via the impulse API. */
  isCracks?: boolean
}

function buildLayers(profile: PlanetProfile): LayerSpec[] {
  const lightOrigin = new Vector2(profile.lightOrigin[0], profile.lightOrigin[1])

  if (profile.kind === 'noAtmosphere') {
    const ground: LayerSpec = {
      fragmentShader: noAtmosphereFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: 0.2 },
        uSize: { value: profile.terrainSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(1, 1) },
        uLightBorder1: { value: 0.4 },
        uLightBorder2: { value: 0.6 },
        uColors: { value: colorsToVec4(profile.groundColors) },
      },
      timeRate: TIME_RATE_BASE,
      renderOrder: 0,
    }
    const craters: LayerSpec = {
      fragmentShader: planetCratersFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: profile.craterTimeSpeed },
        uSize: { value: profile.craterSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(1, 1) },
        uLightBorder: { value: 0.4 },
        uCraterCutoff: { value: 0.5 },
        uCraterRadius: { value: 1.0 },
        uColors: { value: colorsToVec4(profile.craterColors) },
      },
      timeRate: TIME_RATE_BASE,
      renderOrder: 1,
    }
    return [ground, craters]
  }

  function underLayer(size: number, colors: RGB[], randMod: [number, number], renderOrder: number): LayerSpec {
    return {
      fragmentShader: planetUnderFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: 0.2 },
        uSize: { value: size },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(randMod[0], randMod[1]) },
        uLightBorder1: { value: 0.4 },
        uLightBorder2: { value: 0.6 },
        uColors: { value: colorsToVec4(colors) },
      },
      timeRate: TIME_RATE_BASE,
      renderOrder,
    }
  }

  function cloudLayer(size: number, speed: number, cover: number, stretch: number, curve: number, colors: RGB[], renderOrder: number): LayerSpec {
    return {
      fragmentShader: planetCloudsFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: speed },
        uSize: { value: size },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(1, 1) },
        uCloudCover: { value: cover },
        uStretch: { value: stretch },
        uCloudCurve: { value: curve },
        uLightBorder1: { value: 0.52 },
        uLightBorder2: { value: 0.62 },
        uHpFraction: { value: 1 },
        uColors: { value: colorsToVec4(colors) },
      },
      timeRate: TIME_RATE_CLOUD,
      renderOrder,
    }
  }

  if (profile.kind === 'terranWet') {
    const water = underLayer(profile.terrainSize, profile.waterColors, [2, 1], 0)
    const land: LayerSpec = {
      fragmentShader: planetLandmassFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: 0.2 },
        uSize: { value: profile.terrainSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(2, 1) },
        uLightBorder1: { value: 0.4 },
        uLightBorder2: { value: 0.5 },
        uLandCutoff: { value: profile.landCutoff },
        uColors: { value: colorsToVec4(profile.landColors) },
      },
      timeRate: TIME_RATE_BASE,
      renderOrder: 1,
    }
    return [water, land, cloudLayer(profile.cloudSize, profile.cloudSpeed, profile.cloudCover, profile.cloudStretch, profile.cloudCurve, profile.cloudColors, 2)]
  }

  if (profile.kind === 'iceWorld') {
    const land = underLayer(profile.terrainSize, profile.landColors, [2, 1], 0)
    const lakes = underLayer(profile.terrainSize, profile.lakeColors, [2, 1], 1)
    return [land, lakes, cloudLayer(profile.cloudSize, profile.cloudSpeed, profile.cloudCover, profile.cloudStretch, profile.cloudCurve, profile.cloudColors, 2)]
  }

  if (profile.kind === 'gasGiant') {
    const gas: LayerSpec = {
      fragmentShader: gasLayersFragmentShader,
      isStorm: true,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: profile.gasTimeSpeed },
        uSize: { value: profile.gasSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(2, 1) },
        uCloudCover: { value: profile.cloudCover },
        uStretch: { value: profile.stretch },
        uBands: { value: profile.bands },
        uColors: { value: colorsToVec4(profile.lightColors) },
        uDarkColors: { value: colorsToVec4(profile.darkColors) },
      },
      timeRate: TIME_RATE_GAS,
      renderOrder: 0,
    }
    const ring: LayerSpec = {
      fragmentShader: planetRingFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: 0.2 },
        uSize: { value: profile.gasSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(2, 1) },
        uRingWidth: { value: 0.1 },
        uRingPerspective: { value: 4 },
        uScaleRelPlanet: { value: 6 },
        uHpFraction: { value: 1 },
        uColors: { value: colorsToVec4(profile.lightColors) },
        uDarkColors: { value: colorsToVec4(profile.darkColors) },
      },
      timeRate: TIME_RATE_RING,
      renderOrder: 1,
      rotationOffset: 0.7,
      scale: RING_SCALE,
    }
    return profile.ring ? [gas, ring] : [gas]
  }

  if (profile.kind === 'lavaWorld') {
    const ground: LayerSpec = {
      fragmentShader: noAtmosphereFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: 0.2 },
        uSize: { value: profile.terrainSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(1, 1) },
        uLightBorder1: { value: 0.4 },
        uLightBorder2: { value: 0.6 },
        uColors: { value: colorsToVec4(profile.groundColors) },
      },
      timeRate: TIME_RATE_BASE,
      renderOrder: 0,
    }
    const craters: LayerSpec = {
      fragmentShader: planetCratersFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: profile.craterTimeSpeed },
        uSize: { value: profile.craterSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(1, 1) },
        uLightBorder: { value: 0.4 },
        uCraterCutoff: { value: 0.5 },
        uCraterRadius: { value: 1.0 },
        uColors: { value: colorsToVec4(profile.craterColors) },
      },
      timeRate: TIME_RATE_BASE,
      renderOrder: 1,
    }
    const lava: LayerSpec = {
      fragmentShader: lavaRiversFragmentShader,
      uniforms: {
        uRotation: { value: 0 },
        uLightOrigin: { value: lightOrigin },
        uTimeSpeed: { value: profile.lavaTimeSpeed },
        uSize: { value: profile.terrainSize },
        uSeed: { value: profile.seed },
        uPlanetTime: { value: 0 },
        uRandMod: { value: new Vector2(2, 1) },
        uLightBorder1: { value: 0.4 },
        uLightBorder2: { value: 0.5 },
        uRiverCutoff: { value: profile.riverCutoff },
        uColors: { value: colorsToVec4(profile.lavaColors) },
      },
      timeRate: TIME_RATE_BASE,
      renderOrder: 2,
    }
    return [ground, craters, lava]
  }

  // asteroid
  const rock: LayerSpec = {
    fragmentShader: asteroidFragmentShader,
    uniforms: {
      uRotation: { value: 0 },
      uLightOrigin: { value: lightOrigin },
      uSize: { value: profile.size },
      uSeed: { value: profile.seed },
      uColors: { value: colorsToVec4(profile.colors) },
    },
    timeRate: 0,
    renderOrder: 0,
  }
  return [rock]
}

/** Impulses this strong or stronger leave a permanent crack at the impact point (taps are
 *  0.045+, skills 0.11; the low-HP instability jitter at 0.03 deliberately doesn't scar). */
const CRACK_IMPACT_MIN_STRENGTH = 0.04

// Cracks Follow Tap Patterns (#65) - rendered on top of every solid-surface kind. Gas giants
// are excluded on purpose: gas has no surface to fracture; their damage story is the storm
// speeding up (isStorm) and the ring eroding (planetRing's uHpFraction) instead.
function buildCrackLayer(profile: PlanetProfile): LayerSpec {
  return {
    fragmentShader: planetCracksFragmentShader,
    isCracks: true,
    uniforms: {
      uRotation: { value: 0 },
      uLightOrigin: { value: new Vector2(0.39, 0.39) },
      uTimeSpeed: { value: 0.2 },
      uSize: { value: 8 },
      uSeed: { value: profile.seed },
      uPlanetTime: { value: 0 },
      uRandMod: { value: new Vector2(1, 1) },
      uHpFraction: { value: 1 },
      uImpacts: { value: Array.from({ length: MAX_CRACK_IMPACTS }, () => new Vector2(-10, -10)) },
      uImpactCount: { value: 0 },
    },
    timeRate: TIME_RATE_BASE,
    renderOrder: 3,
  }
}

/** Imperative handle for hit-reaction physics - see PlanetCanvas's onReady prop. */
export interface PlanetImpulseApi {
  /** Push the planet away from a tap/hit at (x,y) canvas-relative px. strength ~0.02 (light tap) to ~0.15 (big hit). */
  impulse(x: number, y: number, strength: number): void
}

// Underdamped spring constants for the displacement/rotation kick - SPRING_K pulls the
// offset back to center, DAMPING bleeds velocity. Deliberately a little under critical
// damping (2*sqrt(SPRING_K) ~= 30) for a touch of springy overshoot, not a dead stop.
const SPRING_K = 220
const DAMPING = 20
// Rotation-kick decay is much slower than the position spring, so repeated hits on one
// side visibly compound into a spin before it bleeds off (Planet Rotation from Repeated Hits).
const ROTATION_KICK_DECAY = 0.6

interface PlanetCanvasProps {
  profile: PlanetProfile
  className?: string
  /** Fires once the WebGL scene is ready, with a fresh impulse controller for this profile's mesh set. */
  onReady?: (api: PlanetImpulseApi) => void
  /** 0..1, real hull fraction. Undefined/1 = pristine. Drives every damage-storytelling shader
   *  effect: ring erosion (#69), atmosphere stripping (#67), crack depth/glow (#65, #44), storm speed-up. */
  hpFraction?: number
}

export function PlanetCanvas({ profile, className, onReady, hpFraction }: PlanetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Read every frame from the animate() closure without retriggering the scene-setup effect.
  const hpFractionRef = useRef(hpFraction ?? 1)
  hpFractionRef.current = hpFraction ?? 1

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)

    const scene = new Scene()
    const layers = buildLayers(profile)
    if (profile.kind !== 'gasGiant') layers.push(buildCrackLayer(profile))
    const crackUniforms = layers.find((l) => l.isCracks)?.uniforms ?? null
    // Widen the frustum to the largest layer scale so a gas giant's ring is captured in full
    // instead of clipped at the frame edge. The canvas box itself doesn't change size (it's
    // already sized close to the available screen space), so the trade-off is that a
    // ring-bearing sphere renders proportionally smaller within that same box - the ring
    // physically needs ~3x the sphere's footprint, which the screen has no room to also add
    // on top of an already near-full-width sphere. Plain planets (max scale 1) are unaffected.
    const maxScale = planetMaxScale(profile)
    const camera = new OrthographicCamera(-maxScale, maxScale, maxScale, -maxScale, 0.1, 10)
    camera.position.z = 5

    const geometry = new PlaneGeometry(2, 2)
    const meshes = layers.map((layer) => {
      const material = new ShaderMaterial({
        vertexShader: planetVertexShader,
        fragmentShader: layer.fragmentShader,
        uniforms: layer.uniforms,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      })
      const mesh = new Mesh(geometry, material)
      mesh.renderOrder = layer.renderOrder
      if (layer.scale) mesh.scale.set(layer.scale, layer.scale, 1)
      scene.add(mesh)
      return mesh
    })
    const timeAccum = layers.map(() => Math.random() * 1000)

    const resize = () => {
      const { clientWidth, clientHeight } = canvas
      if (clientWidth > 0 && clientHeight > 0) renderer.setSize(clientWidth, clientHeight, false)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    // Hit-reaction physics state (Planet Impact Displacement / Rotation from Repeated Hits).
    const impulseOffset = { x: 0, y: 0 }
    const impulseVel = { x: 0, y: 0 }
    let rotationKickVel = 0
    let rotation = Math.random() * Math.PI * 2
    let impactCursor = 0

    onReady?.({
      impulse(px, py, strength) {
        const { clientWidth, clientHeight } = canvas
        if (!clientWidth || !clientHeight) return
        // Canvas-relative px -> world units (matches the camera's -maxScale..maxScale frustum).
        const worldX = (px / clientWidth - 0.5) * 2 * maxScale
        const worldY = -(py / clientHeight - 0.5) * 2 * maxScale
        const dist = Math.hypot(worldX, worldY) || 1
        // Push the planet away from the impact point, not toward it.
        impulseVel.x += (-worldX / dist) * strength
        impulseVel.y += (-worldY / dist) * strength
        rotationKickVel += (worldX >= 0 ? -1 : 1) * strength * 0.6

        // Record a permanent scar for the cracks layer (#65), stored in surface space: the
        // shader samples with rot(uv, uRotation), so applying the same rotation at the
        // current angle here puts stored point and sampled point in the same rotated frame.
        // Oldest impacts get overwritten ring-buffer style once the array is full.
        if (crackUniforms && strength >= CRACK_IMPACT_MIN_STRENGTH) {
          const cx = px / clientWidth - 0.5
          const cy = py / clientHeight - 0.5
          const c = Math.cos(rotation)
          const s = Math.sin(rotation)
          const impacts = crackUniforms.uImpacts.value as Vector2[]
          impacts[impactCursor % MAX_CRACK_IMPACTS].set(c * cx - s * cy + 0.5, s * cx + c * cy + 0.5)
          impactCursor++
          crackUniforms.uImpactCount.value = Math.min(impactCursor, MAX_CRACK_IMPACTS)
        }
      },
    })

    let raf = 0
    let last = performance.now()

    const animate = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now

      // Critically-underdamped spring pulling the impact offset back to center.
      impulseVel.x -= impulseOffset.x * SPRING_K * dt
      impulseVel.y -= impulseOffset.y * SPRING_K * dt
      const damp = Math.exp(-DAMPING * dt)
      impulseVel.x *= damp
      impulseVel.y *= damp
      impulseOffset.x += impulseVel.x * dt
      impulseOffset.y += impulseVel.y * dt
      rotationKickVel *= Math.exp(-ROTATION_KICK_DECAY * dt)

      rotation += dt * profile.rotationRate + rotationKickVel * dt

      const hpNow = hpFractionRef.current
      meshes.forEach((mesh, i) => {
        // Gas-giant phase change (#44): the storm bands visibly churn faster as hull drops.
        const stormBoost = layers[i].isStorm ? 1 + (1 - hpNow) * 2.5 : 1
        timeAccum[i] += dt * layers[i].timeRate * stormBoost
        mesh.position.set(impulseOffset.x, impulseOffset.y, 0)
        const uniforms = (mesh.material as ShaderMaterial).uniforms
        if (uniforms.uRotation) uniforms.uRotation.value = rotation + (layers[i].rotationOffset ?? 0)
        if (uniforms.uPlanetTime) uniforms.uPlanetTime.value = timeAccum[i]
        if (uniforms.uHpFraction) uniforms.uHpFraction.value = hpNow
      })

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      meshes.forEach((mesh) => (mesh.material as Material).dispose())
      geometry.dispose()
      renderer.dispose()
    }
  }, [profile])

  return <canvas ref={canvasRef} className={className} />
}
