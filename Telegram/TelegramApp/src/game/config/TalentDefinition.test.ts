import { describe, expect, it } from 'vitest'
import { buildDefaultTalents, isTalentNodeUnlocked, talentBonusAt, CLUSTER_ORDER, TalentEffect } from './TalentDefinition'

describe('talent tree node catalog', () => {
  it('builds 6 clusters x 13 nodes (11 point + 2 gem) + 1 Grand Nexus = 79 nodes', () => {
    const defs = buildDefaultTalents()
    expect(defs.length).toBe(CLUSTER_ORDER.length * 13 + 1)
    for (const cluster of CLUSTER_ORDER) {
      const clusterDefs = defs.filter((d) => d.branch === cluster)
      expect(clusterDefs.length).toBe(13)
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

  it('every cluster root has no prerequisites, and every other node in the cluster does', () => {
    const defs = buildDefaultTalents()
    for (const cluster of CLUSTER_ORDER) {
      const root = defs.find((d) => d.id === `${cluster}-core`)!
      expect(root.prerequisites).toEqual([])
      for (const d of defs.filter((x) => x.branch === cluster && x.id !== root.id)) {
        expect(d.prerequisites.length).toBeGreaterThan(0)
      }
    }
  })

  it('a cluster keystone requires both fork-2 outputs AND both gem sockets (a real 4-way merge)', () => {
    const defs = buildDefaultTalents()
    for (const cluster of CLUSTER_ORDER) {
      const keystone = defs.find((d) => d.id === `${cluster}-keystone`)!
      expect(new Set(keystone.prerequisites)).toEqual(new Set([`${cluster}-d1`, `${cluster}-d2`, `${cluster}-gem-1`, `${cluster}-gem-2`]))
    }
  })

  it('the Grand Nexus requires every cluster keystone', () => {
    const defs = buildDefaultTalents()
    const nexus = defs.find((d) => d.id === 'nexus')!
    expect(new Set(nexus.prerequisites)).toEqual(new Set(CLUSTER_ORDER.map((c) => `${c}-keystone`)))
  })

  it('single-effect clusters (assault/armada/wealth/ascendant) tag every point node with one effect', () => {
    const defs = buildDefaultTalents()
    const expected: Record<string, TalentEffect> = {
      assault: TalentEffect.TapDamage,
      armada: TalentEffect.Dps,
      wealth: TalentEffect.Gold,
      ascendant: TalentEffect.XpGain,
    }
    for (const [cluster, effect] of Object.entries(expected)) {
      const pointNodes = defs.filter((d) => d.branch === cluster && d.effect !== TalentEffect.GemSocket)
      expect(pointNodes.length).toBe(11)
      for (const d of pointNodes) expect(d.effect).toBe(effect)
    }
  })

  it('split-effect clusters (precision/continuum) use both of their paired effects', () => {
    const defs = buildDefaultTalents()
    const precisionEffects = new Set(defs.filter((d) => d.branch === 'precision' && d.effect !== TalentEffect.GemSocket).map((d) => d.effect))
    expect(precisionEffects).toEqual(new Set([TalentEffect.TapCritChance, TalentEffect.ShipCritChance]))
    const continuumEffects = new Set(defs.filter((d) => d.branch === 'continuum' && d.effect !== TalentEffect.GemSocket).map((d) => d.effect))
    expect(continuumEffects).toEqual(new Set([TalentEffect.OfflineReward, TalentEffect.RelicGain]))
  })

  it('gem socket nodes carry no bonus of their own', () => {
    const defs = buildDefaultTalents()
    for (const d of defs.filter((x) => x.effect === TalentEffect.GemSocket)) {
      expect(talentBonusAt(d, 1)).toBe(0)
      expect(d.maxLevel).toBe(1)
    }
  })

  describe('isTalentNodeUnlocked', () => {
    it('every cluster root is always unlockable (no prior levels needed)', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      for (const cluster of CLUSTER_ORDER) {
        const i = defs.findIndex((d) => d.id === `${cluster}-core`)
        expect(isTalentNodeUnlocked(defs, levels, i)).toBe(true)
      }
    })

    it('a 2-way fork is blocked until its root is owned', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const root = defs.findIndex((d) => d.id === 'assault-core')
      const a1 = defs.findIndex((d) => d.id === 'assault-a1')

      expect(isTalentNodeUnlocked(defs, levels, a1)).toBe(false)
      levels[root] = 1
      expect(isTalentNodeUnlocked(defs, levels, a1)).toBe(true)
    })

    it('a merge node requires BOTH fork paths owned, not just one', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const a1 = defs.findIndex((d) => d.id === 'assault-a1')
      const b1 = defs.findIndex((d) => d.id === 'assault-b1')
      const ab = defs.findIndex((d) => d.id === 'assault-ab')

      expect(isTalentNodeUnlocked(defs, levels, ab)).toBe(false)
      levels[a1] = 1
      expect(isTalentNodeUnlocked(defs, levels, ab)).toBe(false) // only one of two prereqs owned
      levels[b1] = 1
      expect(isTalentNodeUnlocked(defs, levels, ab)).toBe(true)
    })

    it('a keystone requires all 4 of its prerequisites (3-way fork chain + both gems), in any order', () => {
      const defs = buildDefaultTalents()
      const levels = new Array(defs.length).fill(0)
      const keystone = defs.findIndex((d) => d.id === 'assault-keystone')
      const prereqIds = ['assault-d1', 'assault-d2', 'assault-gem-1', 'assault-gem-2']
      const prereqIndices = prereqIds.map((id) => defs.findIndex((d) => d.id === id))

      expect(isTalentNodeUnlocked(defs, levels, keystone)).toBe(false)
      for (let k = 0; k < prereqIndices.length - 1; k++) {
        levels[prereqIndices[k]] = 1
        expect(isTalentNodeUnlocked(defs, levels, keystone)).toBe(false) // still missing one
      }
      levels[prereqIndices[prereqIndices.length - 1]] = 1
      expect(isTalentNodeUnlocked(defs, levels, keystone)).toBe(true)
    })

    it('the Grand Nexus is blocked until every cluster keystone is owned, in any order', () => {
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
