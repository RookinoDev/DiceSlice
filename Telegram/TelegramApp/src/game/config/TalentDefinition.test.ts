import { describe, expect, it } from 'vitest'
import { buildDefaultTalents, isTalentNodeUnlocked, branchPointsSpent, talentBonusAt, BRANCH_ORDER, TalentEffect } from './TalentDefinition'

describe('talent tree node catalog', () => {
  it('builds 5 branches x 11 nodes (8 tier + 1 capstone + 2 gem) + 5 combo talents = 60 nodes', () => {
    const defs = buildDefaultTalents()
    expect(defs.length).toBe(BRANCH_ORDER.length * 11 + 5)
    for (const branch of BRANCH_ORDER) {
      const branchDefs = defs.filter((d) => d.branch === branch)
      expect(branchDefs.length).toBe(11)
      expect(branchDefs.filter((d) => d.effect === TalentEffect.GemSocket).length).toBe(2)
      expect(branchDefs.filter((d) => d.isCapstone).length).toBe(1)
    }
    expect(defs.filter((d) => d.branch === 'combo').length).toBe(5)
  })

  it('every id is unique', () => {
    const defs = buildDefaultTalents()
    const ids = defs.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every unlock requirement references a real branch', () => {
    const defs = buildDefaultTalents()
    for (const d of defs) {
      for (const req of d.unlockRequirements) expect(BRANCH_ORDER.includes(req.branch)).toBe(true)
    }
  })

  it('every tier-1 talent in every branch is always unlockable (empty requirements)', () => {
    const defs = buildDefaultTalents()
    for (const branch of BRANCH_ORDER) {
      const branchDefs = defs.filter((d) => d.branch === branch)
      // The first 2 nodes pushed per branch are always tier 1 (see buildBranch's push order).
      expect(branchDefs[0].unlockRequirements).toEqual([])
      expect(branchDefs[1].unlockRequirements).toEqual([])
    }
  })

  it('tier thresholds climb 0/5/12/22 within a branch, capstone at 35', () => {
    const defs = buildDefaultTalents()
    const cannon = defs.filter((d) => d.branch === 'cannon')
    // Order matches buildBranch's push order: tier1 pair, tier2 pair, tier3 pair, tier4 pair, capstone, gem-1, gem-2.
    expect(cannon[2].unlockRequirements).toEqual([{ branch: 'cannon', points: 5 }])
    expect(cannon[4].unlockRequirements).toEqual([{ branch: 'cannon', points: 12 }])
    expect(cannon[6].unlockRequirements).toEqual([{ branch: 'cannon', points: 22 }])
    expect(cannon[8].unlockRequirements).toEqual([{ branch: 'cannon', points: 35 }])
    expect(cannon[8].isCapstone).toBe(true)
  })

  it('gem sockets unlock alongside tier 2 and tier 4 (5 and 22 points)', () => {
    const defs = buildDefaultTalents()
    const cannonGems = defs.filter((d) => d.branch === 'cannon' && d.effect === TalentEffect.GemSocket)
    expect(cannonGems.map((d) => d.unlockRequirements)).toEqual([[{ branch: 'cannon', points: 5 }], [{ branch: 'cannon', points: 22 }]])
  })

  it('each combo talent requires 12 points in BOTH of the two branches it bridges, and bridges every adjacent ring pair', () => {
    const defs = buildDefaultTalents()
    const combos = defs.filter((d) => d.branch === 'combo')
    expect(combos.length).toBe(5)
    for (const combo of combos) {
      expect(combo.unlockRequirements.length).toBe(2)
      for (const req of combo.unlockRequirements) expect(req.points).toBe(12)
    }
    for (let i = 0; i < BRANCH_ORDER.length; i++) {
      const a = BRANCH_ORDER[i]
      const b = BRANCH_ORDER[(i + 1) % BRANCH_ORDER.length]
      expect(defs.some((d) => d.id === `combo-${a}-${b}`)).toBe(true)
    }
  })

  it('combo talents run 3 ranks (matching the design doc), branch talents run 5 or 3, capstones run 1', () => {
    const defs = buildDefaultTalents()
    for (const combo of defs.filter((d) => d.branch === 'combo')) expect(combo.maxLevel).toBe(3)
    for (const capstone of defs.filter((d) => d.isCapstone)) expect(capstone.maxLevel).toBe(1)
  })

  it('every talent keeps its real flavor name (not a generic effect label) - this design wants personality', () => {
    const defs = buildDefaultTalents()
    expect(defs.find((d) => d.id === 'cannon-nova-lance')!.displayName).toBe('Nova Lance')
    expect(defs.find((d) => d.id === 'salvage-dyson-harvest')!.displayName).toBe('Dyson Harvest')
    expect(defs.find((d) => d.id === 'combo-cannon-fleet')!.displayName).toBe('Mirror Fire')
  })

  it('gem socket nodes carry no bonus of their own', () => {
    const defs = buildDefaultTalents()
    for (const d of defs.filter((x) => x.effect === TalentEffect.GemSocket)) {
      expect(talentBonusAt(d, 1)).toBe(0)
      expect(d.maxLevel).toBe(1)
    }
  })

  describe('branchPointsSpent', () => {
    it('sums levels of every node tagged with that branch, including gems, excluding other branches', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const cannonFirst = defs.findIndex((d) => d.branch === 'cannon')
      const fleetFirst = defs.findIndex((d) => d.branch === 'fleet')
      levels[cannonFirst] = 3
      levels[fleetFirst] = 5
      expect(branchPointsSpent(defs, levels, 'cannon')).toBe(3)
      expect(branchPointsSpent(defs, levels, 'fleet')).toBe(5)
      expect(branchPointsSpent(defs, levels, 'core')).toBe(0)
    })
  })

  describe('isTalentNodeUnlocked', () => {
    it('a tier-1 talent is always unlockable regardless of levels', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const i = defs.findIndex((d) => d.id === 'cannon-pulse-amplifier')
      expect(isTalentNodeUnlocked(defs, levels, i)).toBe(true)
    })

    it('a tier-2 talent is blocked until 5 points are spent in the SAME branch (any node, not a specific one)', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const combatRhythm = defs.findIndex((d) => d.id === 'cannon-combat-rhythm')
      const pulseAmp = defs.findIndex((d) => d.id === 'cannon-pulse-amplifier')
      const precisionOptics = defs.findIndex((d) => d.id === 'cannon-precision-optics')

      expect(isTalentNodeUnlocked(defs, levels, combatRhythm)).toBe(false)
      levels[pulseAmp] = 3
      expect(isTalentNodeUnlocked(defs, levels, combatRhythm)).toBe(false) // only 3 of 5
      levels[precisionOptics] = 2 // 3 + 2 = 5, from a DIFFERENT tier-1 node - still counts
      expect(isTalentNodeUnlocked(defs, levels, combatRhythm)).toBe(true)
    })

    it('points spent in a DIFFERENT branch never unlock this branch\'s tiers', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const combatRhythm = defs.findIndex((d) => d.id === 'cannon-combat-rhythm')
      const fleetFirst = defs.findIndex((d) => d.branch === 'fleet')
      levels[fleetFirst] = 5
      expect(isTalentNodeUnlocked(defs, levels, combatRhythm)).toBe(false)
    })

    it('a combo talent requires 12 points in BOTH bridged branches, not just one', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const combo = defs.findIndex((d) => d.id === 'combo-cannon-fleet')
      const cannonFirst = defs.findIndex((d) => d.branch === 'cannon')
      const fleetFirst = defs.findIndex((d) => d.branch === 'fleet')

      expect(isTalentNodeUnlocked(defs, levels, combo)).toBe(false)
      levels[cannonFirst] = 5 // cap is 5 for one node; spread across a couple to reach 12
      const cannonSecond = defs.findIndex((d, i) => d.branch === 'cannon' && i !== cannonFirst)
      levels[cannonSecond] = 5
      const cannonThird = defs.findIndex((d, i) => d.branch === 'cannon' && i !== cannonFirst && i !== cannonSecond)
      levels[cannonThird] = 2 // 5+5+2 = 12
      expect(isTalentNodeUnlocked(defs, levels, combo)).toBe(false) // cannon alone isn't enough
      levels[fleetFirst] = 5
      const fleetSecond = defs.findIndex((d, i) => d.branch === 'fleet' && i !== fleetFirst)
      levels[fleetSecond] = 5
      const fleetThird = defs.findIndex((d, i) => d.branch === 'fleet' && i !== fleetFirst && i !== fleetSecond)
      levels[fleetThird] = 2
      expect(isTalentNodeUnlocked(defs, levels, combo)).toBe(true)
    })

    it('a capstone requires 35 points in its own branch', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const capstone = defs.findIndex((d) => d.id === 'cannon-nova-lance')
      const cannonIdx = defs.map((d, i) => (d.branch === 'cannon' ? i : -1)).filter((i) => i >= 0)

      expect(isTalentNodeUnlocked(defs, levels, capstone)).toBe(false)
      // Max out enough regular tier nodes to reach 34 (just under threshold).
      let remaining = 34
      for (const i of cannonIdx) {
        if (defs[i].isCapstone || defs[i].effect === TalentEffect.GemSocket) continue
        const grant = Math.min(remaining, defs[i].maxLevel)
        levels[i] = grant
        remaining -= grant
        if (remaining <= 0) break
      }
      expect(isTalentNodeUnlocked(defs, levels, capstone)).toBe(false)
      levels[cannonIdx[0]] += 1 // push to 35
      expect(isTalentNodeUnlocked(defs, levels, capstone)).toBe(true)
    })
  })
})
