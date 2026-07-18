// Per-ship projectile visual identity for the Fleet Siege Orbit (docs/FLEET_SIEGE_ORBIT_PLAN.md
// requirement #2). Derived deterministically from each ship's real archetype, cooldown, and
// name - never randomized, so the same ship always fires the same way. Base shape follows
// archetype (Fast/Medium/Heavy = how often/how hard it hits); two names get an explicit "beam"
// override since they most literally call for one, matching the plan's own example.
import { ShipArchetype, type ShipDefinition } from '../../game/config/ShipDefinition'
import { shipTierVisualForIndex } from '../shipTierVisuals'

export type ProjectileShape = 'dart' | 'arc' | 'shard' | 'pulse' | 'orb' | 'beam'

export interface FleetProjectileSpec {
  shape: ProjectileShape
  color: string
  sizePx: number
  travelMs: number
  /** 'flash' = a proper impact burst at the planet, 'puff' = a tiny dot, matching the shot's weight. */
  impact: 'flash' | 'puff'
  /** Planet impulse strength on arrival; 0 = no nudge (only Heavy-archetype shots push the planet). */
  impulseStrength: number
  /** Faint screen shake on arrival - reserved for the very heaviest ships. */
  shake: boolean
  /** How many projectile puffs one hit spawns (pulse/shard fire in a cluster). */
  shots: number
  /** User-requested: every ship's shot reads as its own, not just its tier's - a small
   *  deterministic hue-rotate (applied as a CSS filter) on top of the tier color, so ships
   *  sharing a tier (and therefore a base color) still look distinct from each other. */
  hueShiftDeg: number
}

const BEAM_NAMES = new Set(['Worldbreaker', 'Starbreaker Prime'])
const SHAKE_NAMES = new Set(['Goliath', 'Worldbreaker', 'Starbreaker Prime'])

// The 6 Medium-archetype ships split across three sub-flavors so they don't all look identical.
const MEDIUM_SUBSHAPES: ProjectileShape[] = ['pulse', 'arc', 'shard']

export function projectileSpecForShip(index: number, def: ShipDefinition): FleetProjectileSpec {
  const tier = shipTierVisualForIndex(index)

  let shape: ProjectileShape
  if (BEAM_NAMES.has(def.shipName)) shape = 'beam'
  else if (def.archetype === ShipArchetype.Fast) shape = 'dart'
  else if (def.archetype === ShipArchetype.Heavy) shape = 'orb'
  // Bug fix: Medium ships sit at indices 1,4,7,10,13,16 (every 3rd slot) - `index % 3` was
  // therefore the SAME value for every one of them (1 % 3 always equals 1), so all six
  // "sub-flavors" collapsed onto a single shape despite the comment's intent. Dividing by 3
  // first turns that into a real 0..5 counter before cycling through the three sub-shapes.
  else shape = MEDIUM_SUBSHAPES[Math.floor(index / 3) % MEDIUM_SUBSHAPES.length]

  const isHeavy = def.archetype === ShipArchetype.Heavy || shape === 'beam'
  return {
    shape,
    color: tier.color,
    // Visible at a glance on a real phone screen, not just under a zoomed-in inspector - a
    // tiny 5px dot against a busy combat screen (floating numbers, combo glow, planet shader)
    // read as "no particle at all" in practice.
    sizePx: 9 + Math.min(11, index * 0.6),
    travelMs: def.archetype === ShipArchetype.Fast ? 260 : def.archetype === ShipArchetype.Heavy ? 480 : 360,
    impact: shape === 'orb' || shape === 'beam' ? 'flash' : 'puff',
    impulseStrength: isHeavy ? 0.025 : 0,
    shake: SHAKE_NAMES.has(def.shipName),
    shots: shape === 'pulse' ? 2 : shape === 'shard' ? 3 : 1,
    // Deterministic, evenly-spread across a tier's few ships (37 is coprime with the small tier
    // sizes here, so consecutive indices don't land near each other) - kept within +-45deg so it
    // stays a variant of the tier's color family rather than jumping to an unrelated hue.
    hueShiftDeg: ((index * 37) % 91) - 45,
  }
}
