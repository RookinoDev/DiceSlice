// The generated side of the card catalog: one Base Card per roster object beyond the
// hand-curated Set 1, derived AT RUNTIME from the already-bundled generatedRoster.json -
// ~5,800 definitions built once at module init (single-digit ms, a few MB peak), zero extra
// bundle weight beyond the roster data the combat renderer ships anyway.
//
// Identity (id / classification / rarity) comes from rosterCardRules.mjs, which the server
// pool generator (scripts/genCardPool.mjs) also imports - client and server always agree.
import generatedRoster from '../../planet/generatedRoster.json'
import { CARD_CATALOG, type CardDefinition } from './catalog'
import { classificationForEntry, nameHash, rarityForEntry, slugForName, type RosterEntryLike } from './rosterCardRules.mjs'

const PARSEC_TO_LY = 3.2616

function pick<T>(name: string, salt: number, pool: T[]): T {
  const h = (nameHash(name) ^ Math.imul(salt + 1, 2654435761)) >>> 0
  return pool[h % pool.length]
}

const FLAVOR: Record<string, string[]> = {
  exoplanet: [
    'A world no human eye has ever seen up close.',
    'Charted from a whisper of starlight.',
    'One more answer to "are we alone?" - still counting.',
    'Its sun is a stranger to ours.',
  ],
  asteroid: [
    'A leftover brick from the solar system under construction.',
    'Four billion years of drifting, uninterrupted.',
    'Small enough to ignore, big enough to matter.',
  ],
  comet: ['Ice, dust, and a tail full of drama.', 'It returns. It always returns.', 'A snowball with a flair for the dramatic.'],
  star: ['A furnace older than every map ever drawn.', 'Its light left home before you were born.', 'Navigators trusted it. So can you.'],
  nebula: ['A nursery where stars are born.', 'Stellar wreckage, arranged beautifully.', 'Gas and dust, posing for eternity.'],
  galaxy: ['An island of a hundred billion suns.', 'Every point of light is someone’s whole sky.', 'Too large to imagine. Collect it anyway.'],
}

function factsFor(e: RosterEntryLike): string[] {
  const facts: string[] = []
  switch (e.c) {
    case 'exoplanet': {
      if (e.y != null) facts.push(`Confirmed exoplanet, discovered in ${e.y}.`)
      if (e.d != null) facts.push(`Lies about ${Math.round(e.d * PARSEC_TO_LY).toLocaleString()} light-years from Earth.`)
      const r = e.r ?? 1
      if (r >= 0.7 && r <= 1.6 && e.t != null && e.t >= 200 && e.t <= 330) facts.push('Sits in the temperature range where liquid water is possible.')
      else if (e.r != null) facts.push(`${r < 1.8 ? 'A rocky world' : 'A gaseous world'} about ${r.toFixed(1)}× Earth's radius.`)
      break
    }
    case 'asteroid':
      if (e.D != null) facts.push(`Measures roughly ${Math.round(e.D)} km across - among the larger bodies of the asteroid belt.`)
      facts.push('Tracked by NASA/JPL’s Small-Body Database.')
      break
    case 'comet':
      facts.push('A periodic comet with a numbered designation - astronomers have watched it return.')
      if (e.D != null) facts.push(`Its nucleus measures about ${e.D.toFixed(1)} km across.`)
      break
    case 'star':
      if (e.s) facts.push(`Spectral type ${e.s}.`)
      if (e.v != null) facts.push(e.v <= 1.5 ? 'One of the brightest stars in Earth’s night sky.' : `Shines at visual magnitude ${e.v.toFixed(1)}.`)
      facts.push('Carries an official IAU proper name.')
      break
    case 'nebula':
      facts.push('A named nebula from the SIMBAD astronomical database.', 'Clouds of gas and dust spanning light-years.')
      break
    case 'galaxy':
      facts.push('A named galaxy from the SIMBAD astronomical database.', 'Contains billions of stars bound by gravity.')
      break
  }
  return facts.slice(0, 2)
}

function physicalFor(e: RosterEntryLike): Record<string, string> {
  const p: Record<string, string> = {}
  switch (e.c) {
    case 'exoplanet':
      if (e.r != null) p.Radius = `${e.r.toFixed(2)} R⊕`
      if (e.t != null) p.Temperature = `${Math.round(e.t)} K`
      if (e.d != null) p.Distance = `${Math.round(e.d * PARSEC_TO_LY).toLocaleString()} ly`
      if (e.y != null) p.Discovered = String(e.y)
      break
    case 'asteroid':
      if (e.D != null) p.Diameter = `${Math.round(e.D)} km`
      p.Region = 'Asteroid belt'
      break
    case 'comet':
      if (e.D != null) p.Nucleus = `${e.D.toFixed(1)} km`
      p.Type = 'Periodic comet'
      break
    case 'star':
      if (e.s) p['Spectral type'] = e.s
      if (e.v != null) p['V magnitude'] = e.v.toFixed(2)
      break
    case 'nebula':
      p.Class = 'Nebula'
      break
    case 'galaxy':
      p.Class = 'Galaxy'
      break
  }
  return p
}

const entries = (generatedRoster as { entries: RosterEntryLike[] }).entries

/** Cards 67..N: one per generated roster object, in the roster JSON's committed order. */
export const GENERATED_CARDS: CardDefinition[] = entries.map((e, i) => ({
  id: slugForName(e.n),
  no: CARD_CATALOG.length + i + 1,
  name: e.n,
  classification: classificationForEntry(e),
  rarity: rarityForEntry(e),
  flavor: pick(e.n, 7, FLAVOR[e.c] ?? FLAVOR.exoplanet),
  facts: factsFor(e),
  physical: physicalFor(e),
}))

/** Every Base Card in the game: hand-curated Set 1 first, then the generated extension. */
export const FULL_CATALOG: CardDefinition[] = [...CARD_CATALOG, ...GENERATED_CARDS]

const INDEX = new Map<string, CardDefinition>(FULL_CATALOG.map((c) => [c.id, c]))

/** O(1) definition lookup - the whole UI resolves cards through this, never .find(). */
export function cardById(id: string): CardDefinition | undefined {
  return INDEX.get(id)
}
