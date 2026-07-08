import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_POOL, PACK_TYPES, RARITY_ORDER, packTypeForBossStage, rollPack } from './cards.mjs'

const rank = (r) => RARITY_ORDER.indexOf(r)
const freshPity = () => ({ sinceEpic: 0, sinceLegendary: 0 })

/** Deterministic rng from a fixed sequence (cycles). */
function seqRng(values) {
  let i = 0
  return () => values[i++ % values.length]
}

test('card pool has all 66 cards and every rarity tier is stocked', () => {
  assert.equal(CARD_POOL.length, 66)
  for (const rarity of RARITY_ORDER) {
    assert.ok(CARD_POOL.some((c) => c.rarity === rarity), `${rarity} pool is empty`)
  }
})

test('pack types map to the boss escalation bands (interval 5, 30-boss cycle)', () => {
  assert.equal(packTypeForBossStage(5), 'meteor') // boss #1: Jupiter
  assert.equal(packTypeForBossStage(50), 'meteor') // boss #10: last giant
  assert.equal(packTypeForBossStage(55), 'stellar') // boss #11: the Sun
  assert.equal(packTypeForBossStage(105), 'deepsky') // boss #21: first nebula
  assert.equal(packTypeForBossStage(145), 'singularity') // boss #29: Sagittarius A*
  assert.equal(packTypeForBossStage(155), 'meteor') // cycle repeats
})

test('every pack honors its guaranteed rarity floor', () => {
  for (const [type, spec] of Object.entries(PACK_TYPES)) {
    for (let trial = 0; trial < 200; trial++) {
      const { cards } = rollPack(type, freshPity())
      assert.equal(cards.length, spec.cards)
      assert.ok(
        cards.some((c) => rank(c.rarity) >= rank(spec.floor)),
        `${type} pack missed its ${spec.floor} floor`,
      )
    }
  }
})

test('rolled card ids always exist in the pool', () => {
  const ids = new Set(CARD_POOL.map((c) => c.id))
  for (let trial = 0; trial < 100; trial++) {
    for (const card of rollPack('stellar', freshPity()).cards) {
      assert.ok(ids.has(card.cardId))
    }
  }
})

test('epic pity forces an epic+ card when overdue', () => {
  // rng near 0.99 rolls commons on the open table and low floor picks, no holo.
  const lowRng = seqRng([0.99])
  const { cards, pity } = rollPack('meteor', { sinceEpic: 9, sinceLegendary: 0 }, lowRng)
  assert.ok(cards.some((c) => rank(c.rarity) >= rank('epic')))
  assert.equal(pity.sinceEpic, 0)
})

test('legendary pity forces a legendary+ card and resets both counters', () => {
  const lowRng = seqRng([0.99])
  const { cards, pity } = rollPack('meteor', { sinceEpic: 3, sinceLegendary: 29 }, lowRng)
  assert.ok(cards.some((c) => rank(c.rarity) >= rank('legendary')))
  assert.equal(pity.sinceLegendary, 0)
  assert.equal(pity.sinceEpic, 0)
})

test('natural epic resets epic pity', () => {
  // rng at 0 always picks the top of each weight table segment = common... use a rigged rng:
  // first slot (floor uncommon): force epic via a value landing in the epic band.
  // Simpler: roll many packs and assert the invariant pity resets whenever an epic+ appears.
  for (let trial = 0; trial < 300; trial++) {
    const before = { sinceEpic: 5, sinceLegendary: 5 }
    const { cards, pity } = rollPack('deepsky', before)
    const hasLegendary = cards.some((c) => rank(c.rarity) >= rank('legendary'))
    const hasEpic = cards.some((c) => rank(c.rarity) >= rank('epic'))
    if (hasLegendary) {
      assert.equal(pity.sinceLegendary, 0)
      assert.equal(pity.sinceEpic, 0)
    } else if (hasEpic) {
      assert.equal(pity.sinceEpic, 0)
      assert.equal(pity.sinceLegendary, 6)
    }
  }
})

test('singularity packs guarantee legendary+', () => {
  for (let trial = 0; trial < 100; trial++) {
    const { cards } = rollPack('singularity', freshPity())
    assert.ok(cards.some((c) => rank(c.rarity) >= rank('legendary')))
  }
})
