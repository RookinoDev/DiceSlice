import { describe, expect, it } from 'vitest'
import { CARD_CATALOG } from '../../game/cards/catalog'
import { FULL_CATALOG } from '../../game/cards/generatedCards'
import { familyFor, starMapPosition } from './starMapPosition'

describe('familyFor', () => {
  it('buckets every hand-curated Set 1 classification into a sane family', () => {
    const expected: Record<string, string> = {
      Mercury: 'solarSystem',
      Luna: 'solarSystem',
      Ceres: 'solarSystem', // dwarf planet - "dwarf" is present but so is "planet"
      Vesta: 'smallBody',
      "Halley's comet": 'smallBody',
      "'Oumuamua": 'smallBody', // interstellar object
      Sedna: 'smallBody', // trans-neptunian object
      'Proxima Centauri b': 'exoplanet',
      'Wasp-12b': 'exoplanet', // hot jupiter
      'J1407 b': 'exoplanet', // ringed substellar object
      'The Sun': 'star',
      'Proxima Centauri': 'star', // red dwarf
      Aldebaran: 'star', // orange giant
      Betelgeuse: 'star', // red supergiant
      'Psr b1919+21': 'star', // pulsar
      'Orion Nebula': 'nebula',
      Andromeda: 'galaxy',
      'Sagittarius a*': 'blackHole',
    }
    const byLower = new Map(CARD_CATALOG.map((c) => [c.name.toLowerCase(), c]))
    for (const [name, family] of Object.entries(expected)) {
      const card = byLower.get(name.toLowerCase())
      expect(card, `fixture name "${name}" not found in CARD_CATALOG`).toBeDefined()
      expect(familyFor(card!.classification), `${card!.name} (${card!.classification})`).toBe(family)
    }
  })

  it('buckets every generated-roster classification shape correctly', () => {
    expect(familyFor('Giant exoplanet')).toBe('exoplanet')
    expect(familyFor('Neptune-class exoplanet')).toBe('exoplanet')
    expect(familyFor('Rocky exoplanet')).toBe('exoplanet')
    expect(familyFor('Asteroid')).toBe('smallBody')
    expect(familyFor('Comet')).toBe('smallBody')
    expect(familyFor('K-class star')).toBe('star')
    expect(familyFor('Star')).toBe('star')
    expect(familyFor('Nebula')).toBe('nebula')
    expect(familyFor('Galaxy')).toBe('galaxy')
  })
})

describe('starMapPosition', () => {
  it('is deterministic - same card always lands on the same spot', () => {
    const card = CARD_CATALOG[0]
    const a = starMapPosition(card)
    const b = starMapPosition(card)
    expect(a).toEqual(b)
  })

  it('every card in the full ~5,890 catalog lands within the unit disc with a valid family', () => {
    for (const card of FULL_CATALOG) {
      const p = starMapPosition(card)
      const r = Math.hypot(p.x, p.y)
      expect(r, `${card.name} radius ${r}`).toBeLessThan(1.1)
      expect(['solarSystem', 'smallBody', 'exoplanet', 'star', 'nebula', 'galaxy', 'blackHole']).toContain(p.family)
    }
  })

  it('different cards land at different spots (no mass collision from a weak hash)', () => {
    const positions = new Set(CARD_CATALOG.slice(0, 66).map((c) => JSON.stringify(starMapPosition(c))))
    expect(positions.size).toBe(66)
  })
})
