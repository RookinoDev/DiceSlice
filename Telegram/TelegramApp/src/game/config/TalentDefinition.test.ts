import { describe, expect, it } from 'vitest'
import { buildDefaultTalents, isTalentNodeUnlocked, BRANCH_ORDER, TIERS_PER_BRANCH } from './TalentDefinition'

describe('talent tree node catalog', () => {
  it('builds 4 branches x 6 tiers + 1 capstone', () => {
    const defs = buildDefaultTalents()
    expect(defs.length).toBe(BRANCH_ORDER.length * TIERS_PER_BRANCH + 1)
    for (const branch of BRANCH_ORDER) {
      const tiers = defs.filter((d) => d.branch === branch).map((d) => d.tier)
      expect(tiers).toEqual([1, 2, 3, 4, 5, 6])
    }
    expect(defs[defs.length - 1].branch).toBe('capstone')
  })

  it('every prerequisite id resolves to a real node in the same catalog', () => {
    const defs = buildDefaultTalents()
    const ids = new Set(defs.map((d) => d.id))
    for (const d of defs) {
      for (const p of d.prerequisites) expect(ids.has(p)).toBe(true)
    }
  })

  it('tier 1 of every branch has no prerequisites; tier N>1 requires exactly tier N-1 of the same branch', () => {
    const defs = buildDefaultTalents()
    for (const branch of BRANCH_ORDER) {
      const tier1 = defs.find((d) => d.branch === branch && d.tier === 1)!
      expect(tier1.prerequisites).toEqual([])
      for (let tier = 2; tier <= TIERS_PER_BRANCH; tier++) {
        const d = defs.find((x) => x.branch === branch && x.tier === tier)!
        expect(d.prerequisites).toEqual([`${branch}-${tier - 1}`])
      }
    }
  })

  it('the capstone requires every branch\'s tier-6 node id', () => {
    const defs = buildDefaultTalents()
    const capstone = defs[defs.length - 1]
    expect(new Set(capstone.prerequisites)).toEqual(new Set(BRANCH_ORDER.map((b) => `${b}-${TIERS_PER_BRANCH}`)))
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

    it('supports a genuine merge node requiring 2+ unrelated prerequisites at once (new capability, not exercised by the linear default tree)', () => {
      const defs = buildDefaultTalents()
      const [a, b] = defs
      const merge = { ...a, id: 'merge-test', prerequisites: [a.id, b.id] }
      const all = [...defs, merge]
      const levels = new Array(all.length).fill(0)
      const mergeIdx = all.length - 1

      expect(isTalentNodeUnlocked(all, levels, mergeIdx)).toBe(false)
      levels[all.findIndex((d) => d.id === a.id)] = 1
      expect(isTalentNodeUnlocked(all, levels, mergeIdx)).toBe(false) // only one of two prereqs owned
      levels[all.findIndex((d) => d.id === b.id)] = 1
      expect(isTalentNodeUnlocked(all, levels, mergeIdx)).toBe(true)
    })
  })
})
