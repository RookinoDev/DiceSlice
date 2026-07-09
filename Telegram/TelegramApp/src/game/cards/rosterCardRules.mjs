// Pure, dependency-free rules mapping a generated roster entry (see
// src/planet/generatedRoster.json / scripts/genRoster.mjs) to its card identity: stable id,
// display classification, and deterministic base rarity derived from the object's REAL data.
//
// Plain .mjs (with rosterCardRules.d.ts for TypeScript) because BOTH sides import it:
// the app (generatedCards.ts) and the server pool generator (scripts/genCardPool.mjs) -
// one implementation, so client and server can never disagree about a card's rarity.

/** Stable card id from an object name: "COMET HALLEY" -> "comet-halley". Never rename. */
export function slugForName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** FNV-1a - the same deterministic hash family the roster mapping uses. */
export function nameHash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Display classification per roster class (star gets its real spectral letter). */
export function classificationForEntry(e) {
  switch (e.c) {
    case 'exoplanet':
      return (e.r ?? 1) >= 6 ? 'Giant exoplanet' : (e.r ?? 1) >= 1.8 ? 'Neptune-class exoplanet' : 'Rocky exoplanet'
    case 'asteroid':
      return 'Asteroid'
    case 'comet':
      return 'Comet'
    case 'star': {
      const letter = (e.s ?? '').match(/[OBAFGKMCS]/)?.[0]
      return letter ? `${letter}-class star` : 'Star'
    }
    case 'nebula':
      return 'Nebula'
    case 'galaxy':
      return 'Galaxy'
    default:
      return 'Celestial object'
  }
}

/**
 * Deterministic base rarity from the object's real characteristics. Commons dominate by
 * design (pack economy); legendary stays ~1% of the pool; ultra is reserved for the
 * hand-curated Set 1 cards (Earth, Sagittarius A*, ...) and never generated here.
 */
export function rarityForEntry(e) {
  switch (e.c) {
    case 'exoplanet': {
      const r = e.r ?? 1
      const t = e.t
      // Habitable-zone candidates are the collectible stars of the exoplanet pool.
      if (r >= 0.7 && r <= 1.6 && t != null && t >= 200 && t <= 330) return 'epic'
      if (r >= 6) return t != null && t >= 2000 ? 'rare' : 'uncommon'
      // Very nearby systems are notable (Proxima-like neighbors).
      if (e.d != null && e.d < 10) return 'uncommon'
      return 'common'
    }
    case 'asteroid': {
      const D = e.D ?? 0
      if (D >= 500) return 'rare'
      if (D >= 250) return 'uncommon'
      return 'common'
    }
    case 'comet':
      return 'uncommon'
    case 'star': {
      const v = e.v
      if (v != null && v <= 1.0) return 'legendary'
      if (v != null && v <= 2.0) return 'epic'
      if (v != null && v <= 3.5) return 'rare'
      return 'uncommon'
    }
    case 'nebula':
      return nameHash(e.n) % 4 === 0 ? 'legendary' : 'epic'
    case 'galaxy':
      return nameHash(e.n) % 10 < 3 ? 'epic' : 'legendary'
    default:
      return 'common'
  }
}
