import { describe, expect, it } from 'vitest'
import { buildDefaultTalents, isTalentNodeUnlocked, talentBonusAt, TalentEffect } from './TalentDefinition'

describe('talent tree node catalog', () => {
  it('builds the full 58-node lattice', () => {
    const defs = buildDefaultTalents()
    expect(defs.length).toBe(58)
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

  it('the trunk is a straight 5-node chain feeding both wings', () => {
    const defs = buildDefaultTalents()
    expect(defs.find((d) => d.id === 'trunk-2')!.prerequisites).toEqual(['trunk-1'])
    expect(defs.find((d) => d.id === 'trunk-5')!.prerequisites).toEqual(['trunk-4'])
    expect(defs.find((d) => d.id === 'wing-a')!.prerequisites).toEqual(['trunk-5'])
    expect(defs.find((d) => d.id === 'wing-b')!.prerequisites).toEqual(['trunk-5'])
  })

  it("Lane A forks partway up into a continuing path and a short dead end that terminates - nothing requires a-dead-2", () => {
    const defs = buildDefaultTalents()
    const forkPoint = defs.find((d) => d.id === 'a1-3')!
    expect(defs.find((d) => d.id === 'a2-1')!.prerequisites).toEqual([forkPoint.id])
    expect(defs.find((d) => d.id === 'a-dead-1')!.prerequisites).toEqual([forkPoint.id])
    const deadEnd = defs.find((d) => d.id === 'a-dead-2')!
    expect(defs.some((d) => d.prerequisites.includes(deadEnd.id))).toBe(false)
  })

  it('core-merge is a real 2-way merge requiring both lane tops, reducing 2 live paths back to 1', () => {
    const defs = buildDefaultTalents()
    const merge = defs.find((d) => d.id === 'core-merge')!
    expect(merge.prerequisites.length).toBe(2)
    expect(new Set(merge.prerequisites)).toEqual(new Set(['a2-5', 'b-8']))
  })

  it("merge-dead is a single terminal node right off the merge - take just it and stop, nothing above requires it", () => {
    const defs = buildDefaultTalents()
    const deadEnd = defs.find((d) => d.id === 'merge-dead')!
    expect(deadEnd.prerequisites).toEqual(['core-merge'])
    expect(defs.some((d) => d.prerequisites.includes('merge-dead'))).toBe(false)
  })

  it('the second fork off core-merge starts both long final climbs', () => {
    const defs = buildDefaultTalents()
    expect(defs.find((d) => d.id === 'final-a-1')!.prerequisites).toEqual(['core-merge'])
    expect(defs.find((d) => d.id === 'final-b-1')!.prerequisites).toEqual(['core-merge'])
  })

  it('the Grand Nexus requires both final keystones (a real 2-way merge at the very top)', () => {
    const defs = buildDefaultTalents()
    const nexus = defs.find((d) => d.id === 'nexus')!
    expect(new Set(nexus.prerequisites)).toEqual(new Set(['final-a-keystone', 'final-b-keystone']))
  })

  it('trunk/wing/merge/nexus nodes carry the Capstone sentinel (a small boost to nearly everything)', () => {
    const defs = buildDefaultTalents()
    for (const id of ['trunk-1', 'wing-a', 'wing-b', 'core-merge', 'nexus']) {
      expect(defs.find((d) => d.id === id)!.effect).toBe(TalentEffect.Capstone)
    }
  })

  it('each long climb cycles through 4 distinct effects (not just 2), each with 2 gem sockets', () => {
    const defs = buildDefaultTalents()
    const effectsOf = (branch: string) => new Set(defs.filter((d) => d.branch === branch && d.effect !== TalentEffect.GemSocket).map((d) => d.effect))
    const gemsOf = (branch: string) => defs.filter((d) => d.branch === branch && d.effect === TalentEffect.GemSocket)

    expect(effectsOf('final-a')).toEqual(new Set([TalentEffect.Dps, TalentEffect.RelicGain, TalentEffect.TapDamage, TalentEffect.OfflineReward]))
    expect(gemsOf('final-a').length).toBe(2)

    expect(effectsOf('final-b')).toEqual(new Set([TalentEffect.XpGain, TalentEffect.TapCritChance, TalentEffect.Gold, TalentEffect.ShipCritChance]))
    expect(gemsOf('final-b').length).toBe(2)

    // Lane A/B (pre-merge) also cycle 4 effects each - no gems there, those only start post-merge.
    expect(effectsOf('a')).toEqual(new Set([TalentEffect.TapDamage, TalentEffect.Dps, TalentEffect.TapCritChance, TalentEffect.ShipCritChance]))
    expect(effectsOf('b')).toEqual(new Set([TalentEffect.Gold, TalentEffect.XpGain, TalentEffect.OfflineReward, TalentEffect.RelicGain]))
  })

  it('a handful of nodes partway up each long climb use a cheaper single-level spike instead of the steady multi-level pace', () => {
    const defs = buildDefaultTalents()
    const spikes = defs.filter((d) => d.maxLevel === 1 && d.bonusPerLevel === 0 && d.firstLevelBonus === 0.09)
    expect(spikes.length).toBeGreaterThanOrEqual(4) // at least one per long climb (a2, b, final-a, final-b)
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

  it('the Nexus sits above both final keystones (a smaller row number, closer to the top)', () => {
    const defs = buildDefaultTalents()
    const nexus = defs.find((d) => d.id === 'nexus')!
    const keystoneA = defs.find((d) => d.id === 'final-a-keystone')!
    const keystoneB = defs.find((d) => d.id === 'final-b-keystone')!
    expect(nexus.pos.row).toBeLessThan(keystoneA.pos.row)
    expect(nexus.pos.row).toBeLessThan(keystoneB.pos.row)
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
      const wing = defs.findIndex((d) => d.id === 'wing-a')
      const trunk5 = defs.findIndex((d) => d.id === 'trunk-5')

      expect(isTalentNodeUnlocked(defs, levels, wing)).toBe(false)
      levels[trunk5] = 1
      expect(isTalentNodeUnlocked(defs, levels, wing)).toBe(true)
    })

    it('core-merge requires BOTH lane tops owned, not just one', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const merge = defs.findIndex((d) => d.id === 'core-merge')
      const a25 = defs.findIndex((d) => d.id === 'a2-5')
      const b8 = defs.findIndex((d) => d.id === 'b-8')

      expect(isTalentNodeUnlocked(defs, levels, merge)).toBe(false)
      levels[a25] = 1
      expect(isTalentNodeUnlocked(defs, levels, merge)).toBe(false) // only one of two
      levels[b8] = 1
      expect(isTalentNodeUnlocked(defs, levels, merge)).toBe(true)
    })

    it('the Grand Nexus is blocked until both final keystones are owned, in any order', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const nexus = defs.findIndex((d) => d.id === 'nexus')
      const keystoneA = defs.findIndex((d) => d.id === 'final-a-keystone')
      const keystoneB = defs.findIndex((d) => d.id === 'final-b-keystone')

      expect(isTalentNodeUnlocked(defs, levels, nexus)).toBe(false)
      levels[keystoneA] = 1
      expect(isTalentNodeUnlocked(defs, levels, nexus)).toBe(false)
      levels[keystoneB] = 1
      expect(isTalentNodeUnlocked(defs, levels, nexus)).toBe(true)
    })
  })
})
