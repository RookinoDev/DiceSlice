import { describe, expect, it } from 'vitest'
import { summarizeCollection } from './collectionSummary'
import type { OwnedCard } from './cardsApi'

function owned(cardId: string, serial: number, holo = false): OwnedCard {
  return { cardId, holo, serial, mintedAtMs: 0 }
}

describe('summarizeCollection', () => {
  it('groups multiple copies of the same card, counting and tracking holo', () => {
    const map = summarizeCollection([owned('mars', 10), owned('mars', 3), owned('venus', 1)])
    expect(map.get('mars')).toEqual({ count: 2, hasHolo: false, bestSerial: 3 })
    expect(map.get('venus')).toEqual({ count: 1, hasHolo: false, bestSerial: 1 })
  })

  it('tracks the lowest serial as bestSerial regardless of arrival order', () => {
    const map = summarizeCollection([owned('earth', 50), owned('earth', 4), owned('earth', 999)])
    expect(map.get('earth')?.bestSerial).toBe(4)
  })

  it('marks hasHolo true if any copy is holo, even a single one among several', () => {
    const map = summarizeCollection([owned('jupiter', 1, false), owned('jupiter', 2, true), owned('jupiter', 3, false)])
    expect(map.get('jupiter')?.hasHolo).toBe(true)
  })

  it('returns an empty map for an empty collection', () => {
    expect(summarizeCollection([]).size).toBe(0)
  })
})
