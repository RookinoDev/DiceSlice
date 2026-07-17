// Fleet "Siege Orbit" engine (docs/FLEET_SIEGE_ORBIT_PLAN.md). Owned ships orbit the current
// planet and visibly fire on real ShipService.onShipHit events - strictly cosmetic, nothing
// here ever touches damage/rewards/cooldowns. One shared rAF loop writes ship transforms
// straight to DOM refs every frame (useCountUp.ts philosophy: no per-frame React state).
//
// Orbit center: read directly from the planet's live getBoundingClientRect() every frame,
// converted into fleet-layer-local coordinates. This was previously derived from the fleet
// layer's OWN measured box size (a ResizeObserver reading, with a viewport-based fallback for
// when that measurement was unavailable) - the fallback used window.innerWidth/innerHeight,
// which has no relationship to where the layer actually sits on screen, so ships visibly
// orbited a phantom point instead of the sphere whenever it kicked in (confirmed live: it kicks
// in more than "never"). Reading the real planet element's rect is the single source of truth -
// automatically correct across any resolution, aspect ratio, planet scale (including the 3x
// ring-giant box), UI scaling, and mid-animation, with no separate "assumed size" bookkeeping
// that can go stale. getBoundingClientRect() forces a layout read, but it's only expensive when
// layout is actually dirty; nothing here invalidates the planet's layout every frame (only
// compositor-level transforms are written), so in steady state this is a cheap, already-cached
// read - a fair trade for "always correct" over "usually correct, sometimes badly wrong".
//
// Stacking trick: this hook's root layer is `position:absolute` with no z-index of its own, so
// its children's individual z-index values escape to CombatScreen's `.combat-planet-wrap`
// stacking context and interleave directly with `.combat-planet` (which is also z-index:auto) -
// one ship can render behind the sphere (z-index -1) while another renders in front (z-index 1)
// of that SAME sphere, with no wrapper tricks. Never add z-index/transform/filter/opacity to the
// root layer element itself or this breaks (it would trap children in its own context instead).
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { SkillType } from '../../game/config/SkillDefinition'
import type { PlanetImpulseApi } from '../../planet/PlanetCanvas'
import { projectileSpecForShip, type FleetProjectileSpec } from './fleetProjectileSpecs'
import { shipTierVisualForIndex } from '../shipTierVisuals'
import { useParticles, type ParticleSpec } from '../combatFx/useParticles'

const MAX_VISIBLE_SHIPS = 8
const VERTICAL_SQUASH = 0.34
const GOLDEN_ANGLE = 2.399963229728653 // radians; evenly spreads N phases around a circle
const ENTRANCE_MS = 700
const MAX_VISUAL_HITS_PER_SECOND = 8
const FLEET_SHAKE_MIN_GAP_MS = 900
const FLYBY_DURATION_S = 0.6

// -- Juice tuning (all cosmetic - never touches gameplay) --
const SPEED_WOBBLE_AMOUNT = 0.16 // +/-16% smooth per-ship speed variation, not frame-synced
const RADIUS_BREATH_AMOUNT = 0.06 // +/-6% orbit radius "breathing"
const BANK_DEG_PER_RAD_S = 13 // lean angle per rad/s of angular speed
const MAX_BANK_DEG = 16
const BURST_SPEED_MULT = 2.4
const BURST_DURATION_S = 0.55
const BURST_SCALE_PUNCH = 0.24
const BURST_INTERVAL_MIN_S = 7
const BURST_INTERVAL_MAX_S = 16
const TAP_RIPPLE_SPEED_MULT = 0.3
const TAP_RIPPLE_DURATION_S = 0.22
const BIG_HIT_RIPPLE_SPEED_MULT = 1.0
const BIG_HIT_RIPPLE_DURATION_S = 0.45
/** User-requested: ships orbit "several times faster" while Fleet Surge (SkillType.BattleCry) is
 * active - 3.5x read as merely "double speed" in practice, pushed higher. */
const FLEET_SURGE_SPEED_MULT = 6

// -- Engine trail pool: a fixed set of DOM nodes created once and only ever repositioned/
// recolored/faded, never created or destroyed per-emission (see registerTrail/step below). --
const TRAIL_POOL_SIZE = 56
const TRAIL_EMIT_INTERVAL_MS = 70
const TRAIL_LIFE_MS = 380

/** Deterministic 0..1 hash - same input always gives the same orbit, never Math.random(). */
function hash01(n: number): number {
  let h = (n + 1) * 2654435761
  h = Math.imul(h ^ (h >>> 16), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Smooth 0->1->0 ease over a [0,1] progress value - rises and falls with no sharp edges. */
const easeInOutPulse = (t: number) => Math.sin(clamp(t, 0, 1) * Math.PI)

interface OrbitParams {
  radiusFrac: number // fraction of the planet's own radius, e.g. 1.15..1.7
  angularSpeed: number // rad/s, signed (direction)
  phase: number
  wobbleFreq: number
  wobblePhase: number
  breathFreq: number
  breathPhase: number
}

function orbitParamsForSlot(index: number): OrbitParams {
  return {
    radiusFrac: 1.15 + hash01(index * 7 + 1) * 0.55,
    angularSpeed: (0.28 + hash01(index * 7 + 2) * 0.22) * (hash01(index * 7 + 3) < 0.5 ? 1 : -1),
    phase: index * GOLDEN_ANGLE,
    wobbleFreq: 0.15 + hash01(index * 7 + 4) * 0.2,
    wobblePhase: hash01(index * 7 + 5) * Math.PI * 2,
    breathFreq: 0.08 + hash01(index * 7 + 6) * 0.12,
    breathPhase: hash01(index * 7 + 7) * Math.PI * 2,
  }
}

interface ShipState {
  params: OrbitParams
  spec: FleetProjectileSpec
  color: string
  angle: number
  entranceStart: number
  /** Next scheduled speed-burst time (ms, performance.now() timebase); rescheduled after each burst ends. */
  nextBurstAt: number
  burstStart: number
  /** Accumulated ms since this ship's last engine-trail emission (throttle, not a per-frame spawn). */
  trailAccumMs: number
  /** Last on-screen position in fleet-layer-local px, so a hit (or a trail emission) fires from where the ship actually is. */
  x: number
  y: number
}

interface FormationTarget {
  radius: number
  speed: number
  squash: number
}

/** Writes into `out` instead of returning a new object - called every frame, so no per-frame allocation. */
function formationTarget(bossActive: boolean, bossFinalPush: boolean, out: FormationTarget): void {
  if (!bossActive) {
    out.radius = 1
    out.speed = 1
    out.squash = 1
  } else if (bossFinalPush) {
    out.radius = 0.85 // tighter, faster: closing in
    out.speed = 1.65
    out.squash = 0.92
  } else {
    out.radius = 1.35 // wider, flatter, slower: siege formation
    out.speed = 0.7
    out.squash = 0.82
  }
}

function randomBurstIntervalMs(): number {
  return (BURST_INTERVAL_MIN_S + Math.random() * (BURST_INTERVAL_MAX_S - BURST_INTERVAL_MIN_S)) * 1000
}

interface TrailParticle {
  el: HTMLDivElement | null
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  startedAt: number
  color: string
  size: number
  /** Matches the emitting ship's z-index at emission time, so a trail behind the sphere stays
   *  hidden behind it and a trail in front stays visible in front, like the ship itself. */
  z: number
}

function makeTrailPool(): TrailParticle[] {
  return Array.from({ length: TRAIL_POOL_SIZE }, () => ({ el: null, active: false, x: 0, y: 0, vx: 0, vy: 0, startedAt: 0, color: '#fff', size: 4, z: 1 }))
}

export interface FleetSiegeHandle {
  visibleIndices: number[]
  registerSprite: (index: number) => (el: HTMLElement | null) => void
  registerRoot: (el: HTMLDivElement | null) => void
  registerTrail: (index: number) => (el: HTMLDivElement | null) => void
  trailPoolSize: number
  particlesRef: RefObject<HTMLDivElement | null>
}

interface Options {
  session: GameSession
  planetRef: RefObject<HTMLElement | null>
  impulseApiRef: RefObject<PlanetImpulseApi | null>
  triggerShake: (intensity: 'small' | 'big') => void
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

export function useFleetSiegeOrbit({ session: s, planetRef, impulseApiRef, triggerShake, bossActive, bossSecondsLeft, bossTimerSeconds }: Options): FleetSiegeHandle {
  // Live values read every frame via refs (avoids restarting the rAF effect on every re-render -
  // CombatScreen's body runs every tick, but this engine's own loop is independent, PlanetCanvas-style).
  const bossActiveRef = useRef(bossActive)
  bossActiveRef.current = bossActive
  const bossFinalPushRef = useRef(false)
  bossFinalPushRef.current = bossActive && bossSecondsLeft > 0 && bossSecondsLeft <= 10 && bossTimerSeconds > 10

  const rootElRef = useRef<HTMLDivElement | null>(null)
  const registerRoot = useRef((el: HTMLDivElement | null) => (rootElRef.current = el)).current
  const { containerRef: particlesRef, spawn } = useParticles()
  const shipsRef = useRef(new Map<number, ShipState>())
  // DOM element per ship index, tracked SEPARATELY from shipsRef. A sprite's ref callback fires
  // during commit, before the sync-effect below (a passive effect) has had a chance to create
  // that index's ShipState entry - looking up shipsRef.current.get(index) from inside the ref
  // callback would silently miss on every ship's first mount. Keeping element refs in their own
  // map that's never wholesale-replaced means it doesn't matter which one - the ref callback or
  // the sync effect - runs first.
  const elByIndexRef = useRef(new Map<number, HTMLElement | null>())
  const trailPoolRef = useRef(makeTrailPool())
  const trailCursorRef = useRef(0)
  const formationRef = useRef<FormationTarget>({ radius: 1, speed: 1, squash: 1 })
  const flybyStartRef = useRef(0)
  const tapRippleStartRef = useRef(-Infinity)
  const bigHitRippleStartRef = useRef(-Infinity)
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
        color: shipTierVisualForIndex(i).color,
        angle: params.phase,
        entranceStart: now,
        nextBurstAt: now + hash01(i * 13 + 1) * BURST_INTERVAL_MAX_S * 1000,
        burstStart: -Infinity,
        trailAccumMs: hash01(i * 13 + 2) * TRAIL_EMIT_INTERVAL_MS, // desync initial emission phase
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

  // The main rAF loop: independent of React re-renders, like PlanetCanvas's own animate().
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const targetScratch: FormationTarget = { radius: 1, speed: 1, squash: 1 }

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now

      const planetEl = planetRef.current
      const layerEl = rootElRef.current
      if (!planetEl || !layerEl) {
        raf = requestAnimationFrame(step)
        return
      }
      // Orbit center + radius come straight from the real, currently-rendered planet box - see
      // the file header for why this replaced the old measured-layer-size approach.
      const planetRect = planetEl.getBoundingClientRect()
      const layerRect = layerEl.getBoundingClientRect()
      const centerX = planetRect.left + planetRect.width / 2 - layerRect.left
      const centerY = planetRect.top + planetRect.height / 2 - layerRect.top
      const planetRadius = Math.min(planetRect.width, planetRect.height) / 2
      if (planetRadius <= 0) {
        raf = requestAnimationFrame(step)
        return
      }

      formationTarget(bossActiveRef.current, bossFinalPushRef.current, targetScratch)
      const smoothing = Math.min(1, dt * 2.5)
      formationRef.current.radius = lerp(formationRef.current.radius, targetScratch.radius, smoothing)
      formationRef.current.speed = lerp(formationRef.current.speed, targetScratch.speed, smoothing)
      formationRef.current.squash = lerp(formationRef.current.squash, targetScratch.squash, smoothing)

      const flybyDt = (now - flybyStartRef.current) / 1000
      const flyby = !reducedMotionRef.current && flybyDt >= 0 && flybyDt < FLYBY_DURATION_S ? 1 + 1.8 * Math.exp(-flybyDt / 0.18) : 1

      // Reactions to the player's own actions (#Stronger effects when the player taps/damages
      // the planet, #Ships briefly react to powerful hits): two independently-decaying ripples,
      // a light one per tap and a stronger one for skill/drone instant damage.
      const tapRippleT = (now - tapRippleStartRef.current) / 1000 / TAP_RIPPLE_DURATION_S
      const tapRipple = tapRippleT < 1 ? 1 + TAP_RIPPLE_SPEED_MULT * easeInOutPulse(tapRippleT) : 1
      const bigHitRippleT = (now - bigHitRippleStartRef.current) / 1000 / BIG_HIT_RIPPLE_DURATION_S
      const bigHitRipple = bigHitRippleT < 1 ? 1 + BIG_HIT_RIPPLE_SPEED_MULT * easeInOutPulse(bigHitRippleT) : 1

      const nowSeconds = now / 1000
      // Fleet Surge (BattleCry) - session is a stable, live-mutable object across this loop's
      // lifetime (see effect dep below), so reading it fresh every frame needs no extra ref.
      const fleetSurgeMult = s.skills.isActive(SkillType.BattleCry) ? FLEET_SURGE_SPEED_MULT : 1

      for (const [index, ship] of shipsRef.current) {
        // Organic, non-robotic pacing: a smooth per-ship sine wobble on top of its own constant
        // base speed, plus an occasional scheduled speed burst (with a matching scale punch).
        const wobble = 1 + SPEED_WOBBLE_AMOUNT * Math.sin(nowSeconds * ship.params.wobbleFreq * Math.PI * 2 + ship.params.wobblePhase)

        if (!reducedMotionRef.current && now >= ship.nextBurstAt && now - ship.burstStart > BURST_DURATION_S * 1000) {
          ship.burstStart = now
          ship.nextBurstAt = now + BURST_DURATION_S * 1000 + randomBurstIntervalMs()
        }
        const burstT = (now - ship.burstStart) / 1000 / BURST_DURATION_S
        const burstPulse = burstT < 1 ? easeInOutPulse(burstT) : 0
        const burstSpeedMult = 1 + (BURST_SPEED_MULT - 1) * burstPulse
        const burstScalePunch = 1 + BURST_SCALE_PUNCH * burstPulse

        const effectiveSpeed = ship.params.angularSpeed * formationRef.current.speed * flyby * wobble * burstSpeedMult * tapRipple * bigHitRipple * fleetSurgeMult

        if (!reducedMotionRef.current) {
          ship.angle += dt * effectiveSpeed
        }

        const entrance = reducedMotionRef.current ? 1 : Math.min(1, (now - ship.entranceStart) / ENTRANCE_MS)
        const breathing = 1 + RADIUS_BREATH_AMOUNT * Math.sin(nowSeconds * ship.params.breathFreq * Math.PI * 2 + ship.params.breathPhase)
        const radiusX = planetRadius * ship.params.radiusFrac * formationRef.current.radius * breathing
        const radiusY = radiusX * VERTICAL_SQUASH * formationRef.current.squash

        const cosA = Math.cos(ship.angle)
        const sinA = Math.sin(ship.angle)
        const x = cosA * radiusX
        const y = sinA * radiusY
        ship.x = centerX + x
        ship.y = centerY + y

        const depthT = (sinA + 1) / 2 // 0 back .. 1 front
        const baseScale = lerp(0.5, 1.0, depthT) * (0.2 + 0.8 * entrance) * burstScalePunch
        const opacity = lerp(0.5, 1.0, depthT) * entrance
        const z = sinA >= 0 ? 1 : -1

        // Nose points where the ship is actually GOING, not at a fixed target - this is what
        // reads as a living squadron rather than icons sliding around a track. Velocity is the
        // angle-derivative of the position formula above, scaled by the signed angular speed (a
        // ship orbiting "backwards" naturally faces the opposite way through the same math, no
        // separate case needed). The sprite's clip-path shape (shipTierVisualForIndex) points
        // "up" at rotate(0) = screen angle -90deg, so facing angle + 90 aligns it exactly.
        const vx = -sinA * radiusX * effectiveSpeed
        const vy = cosA * radiusY * effectiveSpeed
        const facingDeg = (Math.atan2(vy, vx) * 180) / Math.PI + 90

        // Banking: a steady lean into the turn (this orbit IS a continuous turn), proportional
        // to how hard the ship is currently turning. A slight scaleY squash sells the same lean
        // as foreshortening, since a flat 2D sprite has no real depth axis to rotate into.
        const bankDeg = clamp(effectiveSpeed * BANK_DEG_PER_RAD_S, -MAX_BANK_DEG, MAX_BANK_DEG)
        const bankSquashY = 1 - (Math.abs(bankDeg) / MAX_BANK_DEG) * 0.15

        const el = elByIndexRef.current.get(index)
        if (el) {
          // translate(-50%,-50%) centers the sprite's own box on (x,y) - translate order doesn't
          // affect the result (pure translates commute), matching .combat-planet's own convention.
          el.style.transform = `translate3d(${ship.x}px, ${ship.y}px, 0) translate(-50%, -50%) rotate(${facingDeg + bankDeg}deg) scale(${baseScale}, ${baseScale * bankSquashY})`
          el.style.opacity = String(opacity)
          el.style.zIndex = String(z)
        }

        // Engine trail: throttled per-ship (not per-frame) emission from the pool - see
        // updateTrailPool below for the actual per-frame pool advance/fade, which always runs
        // regardless of emission so existing trail particles keep animating smoothly.
        if (!reducedMotionRef.current) {
          ship.trailAccumMs += dt * 1000
          if (ship.trailAccumMs >= TRAIL_EMIT_INTERVAL_MS) {
            ship.trailAccumMs = 0
            emitTrail(trailPoolRef.current, trailCursorRef, ship, vx, vy, z, now)
          }
        }
      }

      updateTrailPool(trailPoolRef.current, now)

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [planetRef])

  // Celebratory flyby (#4): a kill briefly speeds every ship's orbit.
  useEffect(() => {
    return s.onReward.on(() => {
      if (!reducedMotionRef.current) flybyStartRef.current = performance.now()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // Player-action reactions: every tap gives a light ripple, skill/drone instant damage (the
  // "powerful hits") gives a stronger one. Purely cosmetic - never reads the damage amount.
  useEffect(() => {
    const offTap = s.taps.onDamageDealt.on(() => {
      if (!reducedMotionRef.current) tapRippleStartRef.current = performance.now()
    })
    const offSkill = s.onSkillDamage.on(() => {
      if (!reducedMotionRef.current) bigHitRippleStartRef.current = performance.now()
    })
    return () => {
      offTap()
      offSkill()
    }
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

      // Same live-rect approach as the main loop (see file header): the destination a
      // projectile flies to is the planet's real current center, not an assumed one.
      const rect = planetRef.current?.getBoundingClientRect()
      const layerRect = rootElRef.current?.getBoundingClientRect()
      if (rect && layerRect) {
        const centerX = rect.left + rect.width / 2 - layerRect.left
        const centerY = rect.top + rect.height / 2 - layerRect.top
        const planetRadius = Math.min(rect.width, rect.height) / 2
        fireProjectiles(ship, spawn, centerX, centerY, planetRadius)

        if (ship.spec.impulseStrength > 0) {
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
  const spriteRefCallbacks = useRef(new Map<number, (el: HTMLElement | null) => void>())
  const registerSprite = (index: number) => {
    let cb = spriteRefCallbacks.current.get(index)
    if (!cb) {
      cb = (el: HTMLElement | null) => elByIndexRef.current.set(index, el)
      spriteRefCallbacks.current.set(index, cb)
    }
    return cb
  }

  const trailRefCallbacks = useRef(new Map<number, (el: HTMLDivElement | null) => void>())
  const registerTrail = (index: number) => {
    let cb = trailRefCallbacks.current.get(index)
    if (!cb) {
      cb = (el: HTMLDivElement | null) => {
        const p = trailPoolRef.current[index]
        if (p) p.el = el
      }
      trailRefCallbacks.current.set(index, cb)
    }
    return cb
  }

  return {
    visibleIndices,
    registerSprite,
    registerRoot,
    registerTrail,
    trailPoolSize: TRAIL_POOL_SIZE,
    particlesRef,
  }
}

/** Claims the next pool slot (round-robin - simple, no free-list search needed) and (re)initializes it in place. Zero allocation. */
function emitTrail(pool: TrailParticle[], cursorRef: { current: number }, ship: ShipState, shipVx: number, shipVy: number, z: number, now: number): void {
  const p = pool[cursorRef.current]
  cursorRef.current = (cursorRef.current + 1) % pool.length
  const speed = Math.hypot(shipVx, shipVy) || 1
  const backX = -shipVx / speed
  const backY = -shipVy / speed
  const jitter = (Math.random() - 0.5) * 18
  p.active = true
  p.x = ship.x
  p.y = ship.y
  p.vx = backX * 26 + jitter
  p.vy = backY * 26 + jitter
  p.startedAt = now
  p.color = ship.color
  p.size = 3 + Math.random() * 2.5
  p.z = z
}

/** Advances + fades every active pool slot in place. Runs every frame regardless of emission so already-live trail dots keep moving smoothly. */
function updateTrailPool(pool: TrailParticle[], now: number): void {
  for (const p of pool) {
    if (!p.active || !p.el) continue
    const age = now - p.startedAt
    if (age >= TRAIL_LIFE_MS) {
      p.active = false
      p.el.style.opacity = '0'
      continue
    }
    const t = age / TRAIL_LIFE_MS
    const x = p.x + p.vx * t * (TRAIL_LIFE_MS / 1000)
    const y = p.y + p.vy * t * (TRAIL_LIFE_MS / 1000)
    const opacity = (1 - t) * 0.8
    const scale = 1 - t * 0.4
    p.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`
    p.el.style.opacity = String(opacity)
    p.el.style.background = p.color
    p.el.style.width = `${p.size}px`
    p.el.style.height = `${p.size}px`
    p.el.style.boxShadow = `0 0 ${p.size * 2}px ${p.color}`
    p.el.style.zIndex = String(p.z)
  }
}

function fireProjectiles(ship: ShipState, spawn: (spec: ParticleSpec) => void, planetCenterX: number, planetCenterY: number, planetRadius: number) {
  const { spec } = ship
  const jitterR = planetRadius / 8

  // Muzzle flash: a bright ring punching outward right at the ship, so "this ship just fired"
  // is unmistakable even before the eye can track the (small, fast) projectile itself.
  spawn({
    className: 'siege-muzzle-flash',
    x: ship.x,
    y: ship.y,
    durationMs: 180,
    style: { borderColor: spec.color } as CSSProperties,
  })

  for (let i = 0; i < spec.shots; i++) {
    const jAngle = Math.random() * Math.PI * 2
    const destX = planetCenterX + Math.cos(jAngle) * jitterR * Math.random()
    const destY = planetCenterY + Math.sin(jAngle) * jitterR * Math.random()
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
          style: { width: `${len}px`, background: spec.color, boxShadow: `0 0 6px ${spec.color}`, '--ang': `${angleDeg}deg` } as CSSProperties,
        })
      } else {
        spawn({
          className: `siege-proj siege-proj-${spec.shape}`,
          x: ship.x,
          y: ship.y,
          durationMs: spec.travelMs,
          // .siege-proj has no fixed animation-duration (travelMs varies per ship archetype) -
          // same bug class as .fx-coin/.fx-pack-drop (see ui.css): without this, the animation
          // defaults to 0s and the projectile is invisible the entire time it exists.
          style: {
            width: `${spec.sizePx}px`,
            height: `${spec.sizePx}px`,
            background: spec.color,
            boxShadow: `0 0 ${spec.sizePx}px ${spec.color}`,
            '--tx': `${tx}px`,
            '--ty': `${ty}px`,
            animationDuration: `${spec.travelMs}ms`,
          } as CSSProperties,
        })
      }

      setTimeout(
        () => {
          if (spec.impact === 'flash') {
            spawn({ className: 'siege-impact-flash', x: destX, y: destY, durationMs: 260, style: { borderColor: spec.color } as CSSProperties })
          } else {
            spawn({ className: 'siege-impact-puff', x: destX, y: destY, durationMs: 200, style: { background: spec.color } as CSSProperties })
          }
        },
        spec.shape === 'beam' ? 180 : spec.travelMs,
      )
    }, fireDelay)
  }
}
