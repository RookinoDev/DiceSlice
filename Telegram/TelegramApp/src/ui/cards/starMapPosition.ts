// Deterministic placement for the Star Map view (StarMapView.tsx). No real sky coordinates
// (RA/Dec) exist anywhere in this project's data pipeline - the roster generator never fetched
// them (see scripts/genRoster.mjs's TAP/SBDB/SIMBAD queries), and the 66 hand-curated Set 1
// objects only ever had a shader seed, never a position. Rather than fake precision, every
// card's spot is a stable hash of its own name, arranged into concentric rings by "scale of the
// universe" (solar system objects closest to center, galaxies/black holes near the edge) - a
// deliberately stylized star chart, not a claim of real astronomical position.
import type { CardDefinition } from '../../game/cards/catalog'

export type StarMapFamily = 'solarSystem' | 'smallBody' | 'exoplanet' | 'star' | 'nebula' | 'galaxy' | 'blackHole'

/** Buckets a card's free-text classification (see catalog.ts's hand-written strings and
 *  rosterCardRules.mjs's generated ones - both flow through the same field) into a family ring.
 *  Order matters: more specific checks run before the broader ones they could otherwise be
 *  swallowed by (e.g. "Giant exoplanet" must hit the exoplanet check before a bare "giant" test
 *  could exist to catch it). */
export function familyFor(classification: string): StarMapFamily {
  const c = classification.toLowerCase()
  if (c.includes('black hole')) return 'blackHole'
  if (c.includes('galaxy')) return 'galaxy'
  if (c.includes('nebula')) return 'nebula'
  if (c.includes('exoplanet') || c.includes('jupiter') || c.includes('substellar')) return 'exoplanet'
  if (c.includes('asteroid') || c.includes('comet') || c.includes('trans-neptunian') || c.includes('interstellar')) return 'smallBody'
  if (c.includes('star') || c.includes('supergiant') || c.includes('pulsar') || c.includes('-class') || c === 'orange giant' || (c.includes('dwarf') && !c.includes('planet'))) return 'star'
  return 'solarSystem' // terrestrial planet, natural satellite, dwarf planet, gas/ice giant
}

// Ring radius per family, in the same 0..1 "world unit" space starMapPosition returns - roughly
// increasing scale of the universe, not a physical distance. smallBody shares the solar-system
// ring (asteroids/comets ARE solar-system objects); blackHole sits with nebula/galaxy since the
// only two are both galactic-scale.
const FAMILY_RING: Record<StarMapFamily, number> = {
  solarSystem: 0.16,
  smallBody: 0.16,
  exoplanet: 0.42,
  star: 0.58,
  nebula: 0.76,
  galaxy: 0.9,
  blackHole: 0.95,
}
const RING_JITTER = 0.12

/** FNV-1a-style string hash (same shape as rosterGen.ts's nameHash) -> 0..1, deterministic per
 *  (name, salt) pair so a card's ring-radius jitter and angle are independent draws that never
 *  collide with each other, but are always the same for that card on every run. */
function hash01(name: string, salt: string): number {
  let h = 0x811c9dc5
  const str = `${name}|${salt}`
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 100000) / 100000
}

export interface StarMapPoint {
  x: number
  y: number
  family: StarMapFamily
}

/** World-space position in roughly -1..1 (StarMapView.tsx applies its own pan/zoom/scale on
 *  top of this). Pure function of the card's own name+classification - same card, same spot,
 *  every time, across sessions and reloads. */
export function starMapPosition(card: CardDefinition): StarMapPoint {
  const family = familyFor(card.classification)
  const radius = FAMILY_RING[family] + (hash01(card.name, 'r') - 0.5) * RING_JITTER
  const angle = hash01(card.name, 'a') * Math.PI * 2
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, family }
}
