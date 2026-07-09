// Fleet "Siege Orbit" engine (docs/FLEET_SIEGE_ORBIT_PLAN.md). Owned ships orbit the current
// planet and visibly fire on real ShipService.onShipHit events - strictly cosmetic, nothing
// here ever touches damage/rewards/cooldowns. One shared rAF loop writes ship transforms
// straight to DOM refs every frame (useCountUp.ts philosophy: no per-frame React state).
//
// Stacking trick: this hook's root layer is `position:absolute` with no z-index of its own, so
// its children's individual z-index values escape to CombatScreen's `.combat-planet-wrap`
// stacking context and interleave directly with `.combat-planet` (which is also z-index:auto) -
// one ship can render behind the sphere (z-index -1) while another renders in front (z-index 1)
// of that SAME sphere, with no wrapper tricks. Never add z-index/transform/filter/opacity to the
// root layer element itself or this breaks (it would trap children in its own context instead).
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import type { PlanetImpulseApi } from '../../planet/PlanetCanvas'
import { projectileSpecForShip, type FleetProjectileSpec } from './fleetProjectileSpecs'
import { useParticles, type ParticleSpec } from '../combatFx/useParticles'

const MAX_VISIBLE_SHIPS = 8
const VERTICAL_SQUASH = 0.34
const GOLDEN_ANGLE = 2.399963229728653 // radians; evenly spreads N phases around a circle
const ENTRANCE_MS = 700
const MAX_VISUAL_HITS_PER_SECOND = 8
const FLEET_SHAKE_MIN_GAP_MS = 900
const FLYBY_DURATION_S = 0.6

/** Deterministic 0..1 hash - same input always gives the same orbit, never Math.random(). */
function hash01(n: number): number {
  let h = (n + 1) * 2654435761
  h = Math.imul(h ^ (h >>> 16), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

interface OrbitParams {
  radiusFrac: number // fraction of the planet's own radius, e.g. 1.15..1.6
  angularSpeed: number // rad/s, signed (direction)
  phase: number
}

function orbitParamsForSlot(index: number): OrbitParams {
  return {
    radiusFrac: 1.15 + hash01(index * 3 + 1) * 0.55,
    angularSpeed: (0.28 + hash01(index * 3 + 2) * 0.22) * (hash01(index * 3 + 3) < 0.5 ? 1 : -1),
    phase: index * GOLDEN_ANGLE,
  }
}

interface ShipState {
  params: OrbitParams
  spec: FleetProjectileSpec
  angle: number
  entranceStart: number
  /** Last on-screen position in fleet-layer-local px, so a hit can fire from where the ship actually is. */
  x: number
  y: number
}

interface FormationTarget {
  radius: number
  speed: number
  squash: number
}

function formationTarget(bossActive: boolean, bossFinalPush: boolean): FormationTarget {
  if (!bossActive) return { radius: 1, speed: 1, squash: 1 }
  if (bossFinalPush) return { radius: 0.85, speed: 1.65, squash: 0.92 } // tighter, faster: closing in
  return { radius: 1.35, speed: 0.7, squash: 0.82 } // wider, flatter, slower: siege formation
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export interface FleetSiegeHandle {
  visibleIndices: number[]
  registerSprite: (index: number) => (el: HTMLDivElement | null) => void
  registerRoot: (el: HTMLDivElement | null) => void
  particlesRef: RefObject<HTMLDivElement | null>
}

interface Options {
  session: GameSession
  planetRef: RefObject<HTMLElement | null>
  impulseApiRef: RefObject<PlanetImpulseApi | null>
  triggerShake: (intensity: 'small' | 'big') => void
  planetScale: number
  bossActive: boolean
  bossSecondsLeft: number
  bossTimerSeconds: number
}

/** Highest-index (best) owned ships, capped - a stable, cheap-to-recompute signature. */
function computeVisibleIndices(s: GameSession): number[] {
  const owned: number[] = []
  for (let i = s.ships.count - 1; i >= 0 && owned.length < MAX_VISIBLE_SHIPS; i--) {
    if (s.ships.isOwned(i)) owned.push(i)
  }
  return owned.reverse()
}

export function useFleetSiegeOrbit({ session: s, planetRef, impulseApiRef, triggerShake, planetScale, bossActive, bossSecondsLeft, bossTimerSeconds }: Options): FleetSiegeHandle {
  // Live values read every frame via refs (avoids restarting the rAF effect on every re-render -
  // CombatScreen's body runs every tick, but this engine's own loop is independent, PlanetCanvas-style).
  const bossActiveRef = useRef(bossActive)
  bossActiveRef.current = bossActive
  const bossFinalPushRef = useRef(false)
  bossFinalPushRef.current = bossActive && bossSecondsLeft > 0 && bossSecondsLeft <= 10 && bossTimerSeconds > 10
  const planetScaleRef = useRef(planetScale)
  planetScaleRef.current = planetScale

  const rootElRef = useRef<HTMLDivElement | null>(null)
  const registerRoot = useRef((el: HTMLDivElement | null) => (rootElRef.current = el)).current
  const { containerRef: particlesRef, spawn } = useParticles()
  const shipsRef = useRef(new Map<number, ShipState>())
  // DOM element per ship index, tracked SEPARATELY from shipsRef. A sprite's ref callback fires
  // during commit, before the sync-effect below (a passive effect) has had a chance to create
  // that index's ShipState entry - looking up shipsRef.current.get(index) from inside the ref
  // callback would silently miss on every ship's first mount (confirmed: this was a real,
  // permanent bug, not a transient one - the ref callback is stable and never fires again once
  // missed). Keeping element refs in their own map that's never wholesale-replaced means it
  // doesn't matter which one - the ref callback or the sync effect - runs first.
  const elByIndexRef = useRef(new Map<number, HTMLDivElement | null>())
  const boxSizeRef = useRef({ w: 0, h: 0 })
  const formationRef = useRef<FormationTarget>({ radius: 1, speed: 1, squash: 1 })
  const flybyStartRef = useRef(0)
  const hitTimestampsRef = useRef<number[]>([])
  const lastFleetShakeRef = useRef(0)
  const reducedMotionRef = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  // Deliberately NOT memoized on `s` - the GameSession reference never changes for the life of
  // the app, so a `useMemo(..., [s])` would freeze at whatever was owned on first mount and
  // never notice later purchases. Recomputing is cheap (scans at most 19 booleans), and this
  // component already re-renders every game tick via CombatScreen, so nothing is lost.
  const visibleIndices = computeVisibleIndices(s)
  const visibleKey = visibleIndices.join(',')

  // Keep shipsRef in sync with which ships are currently visible (rare: only on purchase).
  useEffect(() => {
    const now = performance.now()
    const next = new Map<number, ShipState>()
    for (const i of visibleIndices) {
      const existing = shipsRef.current.get(i)
      if (existing) {
        next.set(i, existing)
        continue
      }
      const params = orbitParamsForSlot(i)
      next.set(i, {
        params,
        spec: projectileSpecForShip(i, s.ships.def(i)),
        angle: params.phase,
        entranceStart: now,
        x: 0,
        y: 0,
      })
    }
    shipsRef.current = next
    // Drop element refs for indices that dropped out of visibility (e.g. an unlikely top-8
    // eviction) so elByIndexRef doesn't accumulate stale entries forever.
    for (const i of elByIndexRef.current.keys()) {
      if (!next.has(i)) elByIndexRef.current.delete(i)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey])

  // Reduced-motion preference can change mid-session (OS setting) - stay current.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => (reducedMotionRef.current = mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Track box size via ResizeObserver (matches PlanetCanvas's own pattern) - avoids
  // getBoundingClientRect() every frame. Only ever overwrite boxSizeRef with a REAL (nonzero)
  // measurement: some layout timing paths (container-query ancestors settling, a viewport unit
  // not yet resolved on first paint) can report a transient 0x0 - if that briefly happens after
  // we already had a good reading, keep the good one instead of snapping ships to nothing.
  useEffect(() => {
    const el = rootElRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) boxSizeRef.current = { w, h }
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // The main rAF loop: independent of React re-renders, like PlanetCanvas's own animate().
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now

      const target = formationTarget(bossActiveRef.current, bossFinalPushRef.current)
      const smoothing = Math.min(1, dt * 2.5)
      formationRef.current.radius = lerp(formationRef.current.radius, target.radius, smoothing)
      formationRef.current.speed = lerp(formationRef.current.speed, target.speed, smoothing)
      formationRef.current.squash = lerp(formationRef.current.squash, target.squash, smoothing)

      const flybyDt = (now - flybyStartRef.current) / 1000
      const flyby = !reducedMotionRef.current && flybyDt >= 0 && flybyDt < FLYBY_DURATION_S ? 1 + 1.8 * Math.exp(-flybyDt / 0.18) : 1

      // boxSizeRef only ever holds a real (nonzero) ResizeObserver measurement (see that effect),
      // but nothing guarantees one has landed yet - fall back to a viewport-derived guess so the
      // fleet always animates from frame one instead of staying frozen until (or if) a real
      // measurement ever arrives. Any real measurement immediately takes over once it lands.
      const { w: measuredW, h: measuredH } = boxSizeRef.current
      const haveMeasurement = measuredW > 0 && measuredH > 0
      const fallback = Math.min(window.innerWidth, window.innerHeight) * 0.7
      const w = haveMeasurement ? measuredW : fallback
      const h = haveMeasurement ? measuredH : fallback
      const boxSize = Math.min(w, h)

      if (boxSize > 0) {
        const half = (boxSize * planetScaleRef.current) / 2

        for (const [index, ship] of shipsRef.current) {
          if (!reducedMotionRef.current) {
            ship.angle += dt * ship.params.angularSpeed * formationRef.current.speed * flyby
          }

          const entrance = reducedMotionRef.current ? 1 : Math.min(1, (now - ship.entranceStart) / ENTRANCE_MS)
          const radiusX = half * ship.params.radiusFrac * formationRef.current.radius
          const radiusY = radiusX * VERTICAL_SQUASH * formationRef.current.squash

          const x = Math.cos(ship.angle) * radiusX
          const y = Math.sin(ship.angle) * radiusY
          ship.x = w / 2 + x
          ship.y = h / 2 + y

          const depthT = (Math.sin(ship.angle) + 1) / 2 // 0 back .. 1 front
          const scale = lerp(0.5, 1.0, depthT) * (0.2 + 0.8 * entrance)
          const opacity = lerp(0.5, 1.0, depthT) * entrance
          const z = Math.sin(ship.angle) >= 0 ? 1 : -1

          const el = elByIndexRef.current.get(index)
          if (el) {
            // translate(-50%,-50%) centers the sprite's own box on (x,y) - translate order doesn't
            // affect the result (pure translates commute), matching .combat-planet's own convention.
            el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`
            el.style.opacity = String(opacity)
            el.style.zIndex = String(z)
          }
        }
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Celebratory flyby (#4): a kill briefly speeds every ship's orbit.
  useEffect(() => {
    return s.onReward.on(() => {
      if (!reducedMotionRef.current) flybyStartRef.current = performance.now()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // Firing (#3): a real ShipService hit recoils the sprite and, budget permitting, fires a
  // projectile with impact/impulse/shake per the ship's own spec. Gameplay damage already
  // happened in ShipService - this is purely the visual response, and only for ships currently
  // in the visible top-8 (an unseen ship's hits are invisible on purpose, never dropped).
  useEffect(() => {
    return s.ships.onShipHit.on(({ index }) => {
      const ship = shipsRef.current.get(index)
      const el = elByIndexRef.current.get(index)
      if (!ship || !el) return

      if (reducedMotionRef.current) return // static parked ships, no projectiles - per the plan

      const now = performance.now()
      hitTimestampsRef.current = hitTimestampsRef.current.filter((t) => now - t < 1000)
      if (hitTimestampsRef.current.length >= MAX_VISUAL_HITS_PER_SECOND) return
      hitTimestampsRef.current.push(now)

      el.classList.remove('siege-ship--recoil')
      void el.offsetWidth
      el.classList.add('siege-ship--recoil')

      fireProjectiles(ship, spawn, boxSizeRef.current, planetScaleRef.current)

      if (ship.spec.impulseStrength > 0) {
        const rect = planetRef.current?.getBoundingClientRect()
        if (rect) {
          const angle = Math.random() * Math.PI * 2
          const x = rect.width / 2 + Math.cos(angle) * rect.width * 0.15
          const y = rect.height / 2 + Math.sin(angle) * rect.height * 0.15
          impulseApiRef.current?.impulse(x, y, ship.spec.impulseStrength)
        }
      }
      if (ship.spec.shake && now - lastFleetShakeRef.current > FLEET_SHAKE_MIN_GAP_MS) {
        lastFleetShakeRef.current = now
        triggerShake('small')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // Memoized per-index so the ref callback identity is stable across renders - CombatScreen
  // (and therefore this component) re-renders every game tick, and an unstable ref identity
  // would make React detach+reattach every sprite's ref on every frame for nothing.
  const spriteRefCallbacks = useRef(new Map<number, (el: HTMLDivElement | null) => void>())
  const registerSprite = (index: number) => {
    let cb = spriteRefCallbacks.current.get(index)
    if (!cb) {
      cb = (el: HTMLDivElement | null) => elByIndexRef.current.set(index, el)
      spriteRefCallbacks.current.set(index, cb)
    }
    return cb
  }

  return {
    visibleIndices,
    registerSprite,
    registerRoot,
    particlesRef,
  }
}

function fireProjectiles(ship: ShipState, spawn: (spec: ParticleSpec) => void, box: { w: number; h: number }, planetScale: number) {
  const { spec } = ship
  const destBase = { x: box.w / 2, y: box.h / 2 }
  const jitterR = (Math.min(box.w, box.h) * planetScale) / 2 / 8

  for (let i = 0; i < spec.shots; i++) {
    const jAngle = Math.random() * Math.PI * 2
    const destX = destBase.x + Math.cos(jAngle) * jitterR * Math.random()
    const destY = destBase.y + Math.sin(jAngle) * jitterR * Math.random()
    const tx = destX - ship.x
    const ty = destY - ship.y
    const fireDelay = i * 55

    setTimeout(() => {
      if (spec.shape === 'beam') {
        const len = Math.hypot(tx, ty)
        const angleDeg = (Math.atan2(ty, tx) * 180) / Math.PI
        spawn({
          className: 'siege-proj-beam',
          x: ship.x,
          y: ship.y,
          durationMs: 260,
          style: { width: `${len}px`, background: spec.color, '--ang': `${angleDeg}deg` } as CSSProperties,
        })
      } else {
        spawn({
          className: `siege-proj siege-proj-${spec.shape}`,
          x: ship.x,
          y: ship.y,
          durationMs: spec.travelMs,
          style: { width: `${spec.sizePx}px`, height: `${spec.sizePx}px`, background: spec.color, boxShadow: `0 0 ${spec.sizePx}px ${spec.color}`, '--tx': `${tx}px`, '--ty': `${ty}px` } as CSSProperties,
        })
      }

      setTimeout(() => {
        if (spec.impact === 'flash') {
          spawn({ className: 'siege-impact-flash', x: destX, y: destY, durationMs: 260, style: { borderColor: spec.color } as CSSProperties })
        } else {
          spawn({ className: 'siege-impact-puff', x: destX, y: destY, durationMs: 200, style: { background: spec.color } as CSSProperties })
        }
      }, spec.shape === 'beam' ? 180 : spec.travelMs)
    }, fireDelay)
  }
}
