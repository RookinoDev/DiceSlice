import { describe, expect, it } from 'vitest'
import { CARD_CATALOG, cardById, cardByName } from './catalog'
import { realPlanetByName } from '../../planet/realPlanets'

describe('CARD_CATALOG', () => {
  it('has exactly 66 cards with unique, sequential collection numbers', () => {
    expect(CARD_CATALOG).toHaveLength(66)
    const numbers = CARD_CATALOG.map((c) => c.no).sort((a, b) => a - b)
    expect(numbers).toEqual(Array.from({ length: 66 }, (_, i) => i + 1))
  })

  it('has unique ids and names', () => {
    expect(new Set(CARD_CATALOG.map((c) => c.id)).size).toBe(66)
    expect(new Set(CARD_CATALOG.map((c) => c.name)).size).toBe(66)
  })

  // The card's artwork IS the live shader profile looked up by name (see CardArt.tsx) - if a
  // catalog name doesn't exactly match a realPlanets.ts entry, that card silently renders with
  // no art at all. This is the one invariant that must never regress.
  it('every card name resolves to real artwork via realPlanetByName', () => {
    for (const card of CARD_CATALOG) {
      expect(realPlanetByName(card.name), `${card.name} (${card.id}) has no matching shader profile`).toBeDefined()
    }
  })

  it('cardById and cardByName find every catalog entry', () => {
    for (const card of CARD_CATALOG) {
      expect(cardById(card.id)).toBe(card)
      expect(cardByName(card.name)).toBe(card)
    }
  })

  it('returns undefined for unknown ids/names rather than throwing', () => {
    expect(cardById('not-a-real-card')).toBeUndefined()
    expect(cardByName('NOT A REAL PLANET')).toBeUndefined()
  })
})
