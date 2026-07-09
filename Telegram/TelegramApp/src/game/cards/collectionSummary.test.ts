import { describe, expect, it } from 'vitest'
import { summarizeCollection } from './collectionSummary'
import type { OwnedCard } from './cardsApi'
import type { CardVariant } from './variants'

let nextInstance = 1
function owned(cardId: string, serial: number, variant: CardVariant = 'standard', mintedAtMs = 0): OwnedCard {
  return { instanceId: nextInstance++, cardId, variant, serial, mintedAtMs }
}

describe('summarizeCollection', () => {
  it('groups multiple copies of the same card, counting per variant', () => {
    const map = summarizeCollection([owned('mars', 10), owned('mars', 3, 'foil'), owned('venus', 1)])
    const mars = map.get('mars')
    expect(mars?.count).toBe(2)
    expect(mars?.variants).toEqual({ standard: 1, foil: 1 })
    expect(mars?.bestVariant).toBe('foil')
    expect(map.get('venus')?.count).toBe(1)
  })

  it('tracks the lowest serial as bestSerial regardless of arrival order', () => {
    const map = summarizeCollection([owned('earth', 50), owned('earth', 4), owned('earth', 999)])
    expect(map.get('earth')?.bestSerial).toBe(4)
  })

  it('bestVariant is the highest-prestige variant owned, not the newest', () => {
    const map = summarizeCollection([owned('jupiter', 1, 'polychrome'), owned('jupiter', 2, 'holo'), owned('jupiter', 3)])
    expect(map.get('jupiter')?.bestVariant).toBe('polychrome')
  })

  it('newestMintedAtMs powers the recent sort', () => {
    const map = summarizeCollection([owned('pluto', 1, 'standard', 100), owned('pluto', 2, 'standard', 900), owned('pluto', 3, 'standard', 500)])
    expect(map.get('pluto')?.newestMintedAtMs).toBe(900)
  })

  it('returns an empty map for an empty collection', () => {
    expect(summarizeCollection([]).size).toBe(0)
  })
})
