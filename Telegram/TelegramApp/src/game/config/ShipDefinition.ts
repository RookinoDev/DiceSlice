// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Config/{ShipArchetype,ShipDefinition,ShipCatalog}.cs

/** Combat role; sets base cooldown. Pattern repeats Fast->Medium->Heavy across the 19 ships. */
export const ShipArchetype = {
  Fast: 0, // 0.5s - light, frequent hits
  Medium: 1, // 1.0s - balanced
  Heavy: 2, // 2.0s - big, slow burst (great vs bosses)
} as const

export type ShipArchetype = (typeof ShipArchetype)[keyof typeof ShipArchetype]

export interface ShipDefinition {
  shipName: string
  className: string
  baseCost: number
  archetype: ShipArchetype
  baseCooldown: number
  baseDps: number
  baseHitDamage: number
}

function createShip(
  name: string,
  baseCost: number,
  archetype: ShipArchetype,
  baseCooldown: number,
  baseDps: number,
  className = '',
): ShipDefinition {
  return { shipName: name, className, baseCost, archetype, baseCooldown, baseDps, baseHitDamage: baseDps * baseCooldown }
}

// Real datasheet base costs (Lvl-1 buy). aa = 1e15.
const BASE_COSTS = [
  50, 175, 674, 2_850, 13_300, 68_100, 384_000, 2_680_000, 23_800_000, 143_000_000, 694_000_000,
  6_840_000_000, 54_700_000_000, 820_000_000_000, 8_200_000_000_000, 164_000_000_000_000, 1.64e15,
  4.95e16, 2.46e17,
]

// User-reported: ships felt weak vs. tapping - bumped from 5.0 (see BalanceConfig.shipDamagePerLevel
// for the matching per-level growth change; that one's the *within-a-ship* upgrade curve).
const FIRST_DPS = 8.0
// Deliberately NOT tied to BalanceConfig.shipDamagePerLevel (1.5) - this one sets how much
// stronger each successive SHIP's starting DPS is (roster progression), not how a single owned
// ship scales as you level it up. Left at the original value so buffing ship upgrades doesn't
// also blow up the ship-to-ship escalation, which wasn't part of the reported complaint.
const DAMAGE_PER_LEVEL = 1.27
const CHAIN_LEVELS = 10 // "next ship ~ prev at lvl 10"
const CHAIN_FACTOR = Math.pow(DAMAGE_PER_LEVEL, CHAIN_LEVELS) // ~10.92
const COOLDOWNS = [0.5, 1.0, 2.0] // Fast, Medium, Heavy

const SHIP_NAMES = [
  'Recon Skiff', 'Pathfinder', 'Talon', 'Razorwing', 'Nighthawk',
  'Tempest', 'Ironside', 'Bulwark', 'Devastator', 'Annihilator',
  'Vanguard', 'Sovereign', 'Leviathan', 'Ark Carrier', 'Goliath',
  'Behemoth', 'Colossus', 'Worldbreaker', 'Starbreaker Prime',
]
const SHIP_CLASSES = [
  'Scout', 'Scout', 'Fighter', 'Fighter', 'Interceptor',
  'Interceptor', 'Frigate', 'Frigate', 'Destroyer', 'Destroyer',
  'Cruiser', 'Cruiser', 'Carrier', 'Carrier', 'Dreadnought',
  'Dreadnought', 'Titan', 'Titan', 'Starbreaker Class',
]

export function buildDefaultShips(): ShipDefinition[] {
  const list: ShipDefinition[] = []
  let dps = FIRST_DPS
  for (let k = 0; k < BASE_COSTS.length; k++) {
    const archetype = (k % 3) as ShipArchetype
    const cd = COOLDOWNS[k % 3]
    const name = k < SHIP_NAMES.length ? SHIP_NAMES[k] : `Ship ${k + 1}`
    const cls = k < SHIP_CLASSES.length ? SHIP_CLASSES[k] : 'Frigate'
    list.push(createShip(name, BASE_COSTS[k], archetype, cd, dps, cls))
    dps *= CHAIN_FACTOR
  }
  return list
}
