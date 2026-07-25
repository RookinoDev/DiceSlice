import { describe, expect, it } from 'vitest'
import { buildDefaultTalents, isTalentNodeUnlocked, BRANCH_ORDER, TIERS_PER_BRANCH } from './TalentDefinition'

describe('talent tree node catalog', () => {
  it('builds 4 branches x 6 tiers + 1 capstone, in a fixed, index-matching order', () => {
    const defs = buildDefaultTalents()
    expect(defs.length).toBe(BRANCH_ORDER.length * TIERS_PER_BRANCH + 1)
    // Every branch node's index-1 predecessor is the previous tier of the SAME branch -
    // isTalentNodeUnlocked relies on this (see its own comment) rather than an id lookup.
    for (const branch of BRANCH_ORDER) {
      const indices = defs.map((d, i) => ({ d, i })).filter(({ d }) => d.branch === branch)
      expect(indices.map(({ d }) => d.tier)).toEqual([1, 2, 3, 4, 5, 6])
      for (let k = 1; k < indices.length; k++) {
        expect(indices[k].i).toBe(indices[k - 1].i + 1)
      }
    }
    expect(defs[defs.length - 1].branch).toBe('capstone')
  })

  describe('isTalentNodeUnlocked', () => {
    it('tier 1 of every branch is always unlockable (no prior levels needed)', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      for (const branch of BRANCH_ORDER) {
        const i = defs.findIndex((d) => d.branch === branch && d.tier === 1)
        expect(isTalentNodeUnlocked(defs, levels, i)).toBe(true)
      }
    })

    it('tier 2 is blocked until tier 1 in the same branch is owned', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const tier1 = defs.findIndex((d) => d.branch === 'assault' && d.tier === 1)
      const tier2 = defs.findIndex((d) => d.branch === 'assault' && d.tier === 2)

      expect(isTalentNodeUnlocked(defs, levels, tier2)).toBe(false)
      levels[tier1] = 1
      expect(isTalentNodeUnlocked(defs, levels, tier2)).toBe(true)
    })

    it('the capstone is blocked until every branch\'s tier-6 node is owned, in any order', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const capstone = defs.length - 1
      const tier6Indices = BRANCH_ORDER.map((b) => defs.findIndex((d) => d.branch === b && d.tier === TIERS_PER_BRANCH))

      expect(isTalentNodeUnlocked(defs, levels, capstone)).toBe(false)
      for (let k = 0; k < tier6Indices.length - 1; k++) {
        levels[tier6Indices[k]] = 1
        expect(isTalentNodeUnlocked(defs, levels, capstone)).toBe(false) // still missing one branch
      }
      levels[tier6Indices[tier6Indices.length - 1]] = 1
      expect(isTalentNodeUnlocked(defs, levels, capstone)).toBe(true)
    })
  })
})
