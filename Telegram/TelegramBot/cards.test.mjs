import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_POOL, METEOR_CARD_COUNT_WEIGHTS, PACK_TYPES, RARITY_ORDER, VARIANT_ORDER, craftCost, packQualityForStage, packTypeForBossStage, refineValue, rollPack, seededRng } from './cards.mjs'

const rank = (r) => RARITY_ORDER.indexOf(r)
const freshPity = () => ({ sinceEpic: 0, sinceLegendary: 0 })

/** Deterministic rng from a fixed sequence (cycles). */
function seqRng(values) {
  let i = 0
  return () => values[i++ % values.length]
}

test('card pool covers the full roster catalog and every rarity tier is stocked', () => {
  assert.ok(CARD_POOL.length > 5000, `pool unexpectedly small: ${CARD_POOL.length}`)
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
    const validCounts = spec.cardCountWeights ? Object.keys(spec.cardCountWeights).map(Number) : [spec.cards]
    for (let trial = 0; trial < 200; trial++) {
      const { cards } = rollPack(type, freshPity())
      assert.ok(validCounts.includes(cards.length), `${type} pack rolled an unexpected count: ${cards.length}`)
      assert.ok(
        cards.some((c) => rank(c.rarity) >= rank(spec.floor)),
        `${type} pack missed its ${spec.floor} floor`,
      )
    }
  }
})

test('epicvault and legendarycache guarantee their floor on EVERY slot, not just slot 0', () => {
  for (const type of ['epicvault', 'legendarycache']) {
    const spec = PACK_TYPES[type]
    assert.ok(spec.allSlotsFloor, `${type} should set allSlotsFloor`)
    for (let trial = 0; trial < 200; trial++) {
      const { cards } = rollPack(type, freshPity())
      for (const c of cards) {
        assert.ok(rank(c.rarity) >= rank(spec.allSlotsFloor), `${type} rolled a ${c.rarity} card below its ${spec.allSlotsFloor} floor`)
      }
    }
  }
})

test('standard packs (no allSlotsFloor) can roll below-floor cards outside slot 0', () => {
  // Sanity check for the opposite invariant - a pack WITHOUT allSlotsFloor should not
  // accidentally also guarantee every slot (that would silently make e.g. Stellar Packs as
  // strong as Epic Vault). Rolling enough trials should turn up at least one common/uncommon
  // card outside slot 0 for a pack type with no allSlotsFloor set.
  const spec = PACK_TYPES.stellar
  assert.ok(!spec.allSlotsFloor)
  let sawBelowFloor = false
  for (let trial = 0; trial < 300 && !sawBelowFloor; trial++) {
    const { cards } = rollPack('stellar', freshPity())
    if (cards.slice(1).some((c) => rank(c.rarity) < rank(spec.floor))) sawBelowFloor = true
  }
  assert.ok(sawBelowFloor, 'expected at least one below-floor card outside slot 0 across 300 stellar packs')
})

test('meteor card count follows its published odds (95/4/0.9/0.1 for 1/2/3/5 cards)', () => {
  const counts = { 1: 0, 2: 0, 3: 0, 5: 0 }
  const trials = 20000
  const rng = seededRng(99)
  for (let i = 0; i < trials; i++) {
    const { cards } = rollPack('meteor', freshPity(), new Set(), 0, rng)
    counts[cards.length] = (counts[cards.length] ?? 0) + 1
  }
  assert.deepEqual(new Set(Object.keys(counts).map(Number)), new Set(Object.keys(METEOR_CARD_COUNT_WEIGHTS).map(Number)))
  for (const [count, weight] of Object.entries(METEOR_CARD_COUNT_WEIGHTS)) {
    const expected = (weight / 100) * trials
    const actual = counts[count]
    // Generous tolerance for the 0.1%-weight tail (5 cards, ~20 expected hits over 20000 trials)
    // while still catching a badly wrong table or a reordered/broken roll.
    assert.ok(Math.abs(actual - expected) < Math.max(30, expected * 0.5), `count=${count}: expected ~${expected}, got ${actual}`)
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
  // rng near 0.99 rolls commons on the open table and low floor picks, no variant upgrade.
  const lowRng = seqRng([0.99])
  const { cards, pity } = rollPack('meteor', { sinceEpic: 9, sinceLegendary: 0 }, new Set(), 0, lowRng)
  assert.ok(cards.some((c) => rank(c.rarity) >= rank('epic')))
  assert.equal(pity.sinceEpic, 0)
})

test('legendary pity forces a legendary+ card and resets both counters', () => {
  const lowRng = seqRng([0.99])
  const { cards, pity } = rollPack('meteor', { sinceEpic: 3, sinceLegendary: 29 }, new Set(), 0, lowRng)
  assert.ok(cards.some((c) => rank(c.rarity) >= rank('legendary')))
  assert.equal(pity.sinceLegendary, 0)
  assert.equal(pity.sinceEpic, 0)
})

test('every rolled card carries a valid variant', () => {
  for (let trial = 0; trial < 100; trial++) {
    for (const card of rollPack('singularity', freshPity()).cards) {
      assert.ok(VARIANT_ORDER.includes(card.variant), `bad variant ${card.variant}`)
    }
  }
})

test('seeded rng makes rolls fully deterministic (replayable)', () => {
  const a = rollPack('deepsky', freshPity(), new Set(), 0.5, seededRng(1234))
  const b = rollPack('deepsky', freshPity(), new Set(), 0.5, seededRng(1234))
  assert.deepEqual(a, b)
})

test('new-card weighting prefers unowned cards without banning duplicates', () => {
  // Own every legendary except one; singularity packs guarantee a legendary slot, so with
  // rerolls the lone unowned legendary should appear noticeably. The legendary pool is small
  // (~77) which keeps this statistically solid. Dupes must still occur (protection is
  // limited, not absolute).
  const legendaries = CARD_POOL.filter((c) => c.rarity === 'legendary')
  const target = legendaries[0].id
  const ownedIds = new Set(CARD_POOL.map((c) => c.id))
  ownedIds.delete(target)
  let hits = 0
  let dupes = 0
  const rng = seededRng(7)
  for (let i = 0; i < 400; i++) {
    for (const card of rollPack('singularity', freshPity(), ownedIds, 0, rng).cards) {
      if (card.cardId === target) hits++
      else dupes++
    }
  }
  assert.ok(hits >= 3, `the lone unowned legendary appeared only ${hits} times`)
  assert.ok(dupes > 0, 'duplicate protection must stay limited - dupes should still happen')
})

test('boss quality tilts rolls toward higher rarities', () => {
  const rngA = seededRng(42)
  const rngB = seededRng(42)
  let lowQ = 0
  let highQ = 0
  for (let i = 0; i < 600; i++) {
    for (const c of rollPack('meteor', freshPity(), new Set(), 0, rngA).cards) lowQ += rank(c.rarity)
    for (const c of rollPack('meteor', freshPity(), new Set(), 1, rngB).cards) highQ += rank(c.rarity)
  }
  assert.ok(highQ > lowQ, `quality=1 should out-rank quality=0 (${highQ} vs ${lowQ})`)
})

test('pack quality grows with stage depth and saturates at 1', () => {
  assert.equal(packQualityForStage(1), 0)
  assert.ok(packQualityForStage(100) > packQualityForStage(10))
  assert.equal(packQualityForStage(10 ** 9), 1)
})

test('refine/craft economics: variants multiply, crafting always costs more than refining', () => {
  assert.ok(refineValue('rare', 'polychrome') > refineValue('rare', 'standard'))
  for (const rarity of RARITY_ORDER) {
    for (const variant of VARIANT_ORDER) {
      assert.ok(craftCost(rarity, variant) > refineValue(rarity, variant))
    }
  }
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
