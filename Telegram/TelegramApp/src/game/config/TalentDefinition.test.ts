import { describe, expect, it } from 'vitest'
import { buildDefaultTalents, isTalentNodeUnlocked, talentBonusAt, CLUSTER_ORDER, TalentEffect } from './TalentDefinition'

describe('talent tree node catalog', () => {
  it('builds 5 trunk + 2 wings + 4 branches x 16 nodes + 1 Grand Nexus = 72 nodes', () => {
    const defs = buildDefaultTalents()
    expect(defs.length).toBe(5 + 2 + CLUSTER_ORDER.length * 16 + 1)
    expect(defs.filter((d) => d.branch === 'trunk').length).toBe(7) // 5 trunk + 2 wings
    for (const cluster of CLUSTER_ORDER) {
      const clusterDefs = defs.filter((d) => d.branch === cluster)
      expect(clusterDefs.length).toBe(16)
      expect(clusterDefs.filter((d) => d.effect === TalentEffect.GemSocket).length).toBe(2)
    }
    expect(defs.filter((d) => d.branch === 'nexus').length).toBe(1)
  })

  it('every id is unique', () => {
    const defs = buildDefaultTalents()
    const ids = defs.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every prerequisite id resolves to a real node in the same catalog', () => {
    const defs = buildDefaultTalents()
    const ids = new Set(defs.map((d) => d.id))
    for (const d of defs) {
      for (const p of d.prerequisites) expect(ids.has(p)).toBe(true)
    }
  })

  it('the tree has exactly one node with no prerequisites - the shared trunk root', () => {
    const defs = buildDefaultTalents()
    const roots = defs.filter((d) => d.prerequisites.length === 0)
    expect(roots.map((d) => d.id)).toEqual(['trunk-1'])
  })

  it('every branch is a straight chain (1 prerequisite each) from its wing to its keystone', () => {
    const defs = buildDefaultTalents()
    for (const cluster of CLUSTER_ORDER) {
      for (const d of defs.filter((x) => x.branch === cluster)) {
        expect(d.prerequisites.length).toBe(1)
      }
    }
  })

  it('the trunk is a straight 5-node chain feeding both wings', () => {
    const defs = buildDefaultTalents()
    expect(defs.find((d) => d.id === 'trunk-2')!.prerequisites).toEqual(['trunk-1'])
    expect(defs.find((d) => d.id === 'trunk-3')!.prerequisites).toEqual(['trunk-2'])
    expect(defs.find((d) => d.id === 'trunk-4')!.prerequisites).toEqual(['trunk-3'])
    expect(defs.find((d) => d.id === 'trunk-5')!.prerequisites).toEqual(['trunk-4'])
    const wingCombat = defs.find((d) => d.id === 'wing-combat')!
    const wingEconomy = defs.find((d) => d.id === 'wing-economy')!
    expect(wingCombat.prerequisites).toEqual(['trunk-5'])
    expect(wingEconomy.prerequisites).toEqual(['trunk-5'])
  })

  it('each wing feeds exactly 2 of the 4 final branches', () => {
    const defs = buildDefaultTalents()
    expect(defs.find((d) => d.id === 'combat-1')!.prerequisites).toEqual(['wing-combat'])
    expect(defs.find((d) => d.id === 'precision-1')!.prerequisites).toEqual(['wing-combat'])
    expect(defs.find((d) => d.id === 'economy-1')!.prerequisites).toEqual(['wing-economy'])
    expect(defs.find((d) => d.id === 'continuum-1')!.prerequisites).toEqual(['wing-economy'])
  })

  it('the Grand Nexus requires every branch keystone (a real 4-way merge)', () => {
    const defs = buildDefaultTalents()
    const nexus = defs.find((d) => d.id === 'nexus')!
    expect(new Set(nexus.prerequisites)).toEqual(new Set(CLUSTER_ORDER.map((c) => `${c}-keystone`)))
  })

  it('trunk/wing nodes carry the Capstone sentinel (a small boost to nearly everything, not yet committed to a branch)', () => {
    const defs = buildDefaultTalents()
    for (const d of defs.filter((x) => x.branch === 'trunk')) expect(d.effect).toBe(TalentEffect.Capstone)
  })

  it('each branch alternates between its own two paired effects, with 2 gem sockets spread through', () => {
    const defs = buildDefaultTalents()
    const expected: Record<string, [TalentEffect, TalentEffect]> = {
      combat: [TalentEffect.TapDamage, TalentEffect.Dps],
      precision: [TalentEffect.TapCritChance, TalentEffect.ShipCritChance],
      economy: [TalentEffect.Gold, TalentEffect.XpGain],
      continuum: [TalentEffect.OfflineReward, TalentEffect.RelicGain],
    }
    for (const [cluster, [a, b]] of Object.entries(expected)) {
      const pointEffects = new Set(defs.filter((d) => d.branch === cluster && d.effect !== TalentEffect.GemSocket).map((d) => d.effect))
      expect(pointEffects).toEqual(new Set([a, b]))
      const gemIds = defs.filter((d) => d.branch === cluster && d.effect === TalentEffect.GemSocket).map((d) => d.id)
      expect(new Set(gemIds)).toEqual(new Set([`${cluster}-gem-1`, `${cluster}-gem-2`]))
    }
  })

  it('every node label is derived from what it does, not a flavor name', () => {
    const defs = buildDefaultTalents()
    const dpsNode = defs.find((d) => d.effect === TalentEffect.Dps)!
    expect(dpsNode.displayName).toBe('Fleet DPS')
    const gemNode = defs.find((d) => d.effect === TalentEffect.GemSocket)!
    expect(gemNode.displayName).toBe('Gem Socket')
  })

  it('gem socket nodes carry no bonus of their own', () => {
    const defs = buildDefaultTalents()
    for (const d of defs.filter((x) => x.effect === TalentEffect.GemSocket)) {
      expect(talentBonusAt(d, 1)).toBe(0)
      expect(d.maxLevel).toBe(1)
    }
  })

  describe('isTalentNodeUnlocked', () => {
    it('the trunk root is always unlockable (no prior levels needed)', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const i = defs.findIndex((d) => d.id === 'trunk-1')
      expect(isTalentNodeUnlocked(defs, levels, i)).toBe(true)
    })

    it('a wing is blocked until the trunk is fully climbed', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const wing = defs.findIndex((d) => d.id === 'wing-combat')
      const trunk5 = defs.findIndex((d) => d.id === 'trunk-5')

      expect(isTalentNodeUnlocked(defs, levels, wing)).toBe(false)
      levels[trunk5] = 1
      expect(isTalentNodeUnlocked(defs, levels, wing)).toBe(true)
    })

    it('a branch is blocked until its wing is owned', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const combat1 = defs.findIndex((d) => d.id === 'combat-1')
      const wing = defs.findIndex((d) => d.id === 'wing-combat')

      expect(isTalentNodeUnlocked(defs, levels, combat1)).toBe(false)
      levels[wing] = 1
      expect(isTalentNodeUnlocked(defs, levels, combat1)).toBe(true)
    })

    it('the Grand Nexus is blocked until every branch keystone is owned, in any order', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const nexus = defs.findIndex((d) => d.id === 'nexus')
      const keystoneIndices = CLUSTER_ORDER.map((c) => defs.findIndex((d) => d.id === `${c}-keystone`))

      expect(isTalentNodeUnlocked(defs, levels, nexus)).toBe(false)
      for (let k = 0; k < keystoneIndices.length - 1; k++) {
        levels[keystoneIndices[k]] = 1
        expect(isTalentNodeUnlocked(defs, levels, nexus)).toBe(false)
      }
      levels[keystoneIndices[keystoneIndices.length - 1]] = 1
      expect(isTalentNodeUnlocked(defs, levels, nexus)).toBe(true)
    })
  })
})
