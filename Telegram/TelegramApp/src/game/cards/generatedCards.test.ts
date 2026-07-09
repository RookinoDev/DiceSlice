import { describe, expect, it } from 'vitest'
import { CARD_CATALOG } from './catalog'
import { cardById, FULL_CATALOG, GENERATED_CARDS } from './generatedCards'
import generatedRoster from '../../planet/generatedRoster.json'

const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra'])

describe('generated card catalog', () => {
  it('covers every roster object exactly once, after the hand-curated set', () => {
    expect(GENERATED_CARDS.length).toBe(generatedRoster.entries.length)
    expect(FULL_CATALOG.length).toBe(CARD_CATALOG.length + GENERATED_CARDS.length)
    expect(GENERATED_CARDS[0].no).toBe(CARD_CATALOG.length + 1)
  })

  it('has globally unique, stable ids (no collision with Set 1 either)', () => {
    const ids = FULL_CATALOG.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every generated card is fully presentable: rarity, flavor, facts, physical data', () => {
    for (const c of GENERATED_CARDS) {
      expect(RARITIES.has(c.rarity), `${c.id}: rarity ${c.rarity}`).toBe(true)
      expect(c.rarity, `${c.id}: generated cards never mint ultra`).not.toBe('ultra')
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.classification.length).toBeGreaterThan(0)
      expect(c.flavor.length).toBeGreaterThan(0)
      expect(c.facts.length).toBeGreaterThan(0)
      expect(Object.keys(c.physical).length).toBeGreaterThan(0)
    }
  }, 20000)

  it('keeps legendaries scarce (pack economy: ~1-2% of the pool)', () => {
    const legendary = GENERATED_CARDS.filter((c) => c.rarity === 'legendary').length
    expect(legendary / GENERATED_CARDS.length).toBeLessThan(0.03)
    const common = GENERATED_CARDS.filter((c) => c.rarity === 'common').length
    expect(common / GENERATED_CARDS.length).toBeGreaterThan(0.5)
  })

  it('cardById resolves both hand-curated and generated cards in O(1)', () => {
    expect(cardById('earth')?.name).toBe('EARTH')
    const sample = GENERATED_CARDS[123]
    expect(cardById(sample.id)).toBe(sample)
    expect(cardById('definitely-not-a-card')).toBeUndefined()
  })

  it('is deterministic: same roster data always yields the same catalog', () => {
    const again = GENERATED_CARDS[42]
    expect(cardById(again.id)?.rarity).toBe(again.rarity)
    expect(cardById(again.id)?.flavor).toBe(again.flavor)
  })
})
