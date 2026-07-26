import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { buildDefaultTalents, TalentEffect } from '../config/TalentDefinition'
import { TalentService } from './TalentService'

function freshService(): TalentService {
  return new TalentService(buildDefaultTalents(), defaultBalanceConfig)
}

/** Id-based lookup - a stable stand-in for "some specific node," since the tree's actual node
 *  ORDER is no longer a meaningful assumption to hardcode (that's the whole point of the id/
 *  prerequisite graph - see TalentDefinition.ts). */
function indexOf(t: TalentService, id: string): number {
  for (let i = 0; i < t.count; i++) if (t.def(i).id === id) return i
  throw new Error(`no talent node with id ${id}`)
}

/** Seeds every ANCESTOR of `id` (walking the real prerequisite graph) as already owned, so `id`
 *  itself becomes immediately buyable - a shortcut around buying through a long chain by hand,
 *  built on the existing save-restore path (restoreLevels) rather than a new test-only backdoor. */
function unlockPathTo(t: TalentService, id: string): void {
  const levels = new Array(t.count).fill(0)
  const byId = new Map(Array.from({ length: t.count }, (_, i) => [t.def(i).id, i] as const))
  const visit = (nodeId: string) => {
    const i = byId.get(nodeId)!
    if (levels[i] > 0) return
    for (const p of t.def(i).prerequisites) visit(p)
    levels[i] = 1
  }
  for (const p of t.def(byId.get(id)!).prerequisites) visit(p)
  t.restoreLevels(levels)
}

describe('TalentService', () => {
  it('starts at level 1 with 0 xp and 0 points', () => {
    const t = freshService()
    expect(t.level).toBe(1)
    expect(t.xp).toBe(0)
    expect(t.unspentPoints).toBe(0)
  })

  it('grantXp loops level-ups so one large grant crosses multiple levels, granting exactly 1 point each', () => {
    const t = freshService()
    const levelsSeen: number[] = []
    t.onLevelUp.on((lvl) => levelsSeen.push(lvl))

    t.grantXp(500) // crosses level 1->9 given the default curve (12, 24, 36, ... linear thresholds)

    expect(t.level).toBe(9)
    expect(t.unspentPoints).toBe(8) // exactly 1 point per level gained, not per XP grant
    expect(levelsSeen).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
    expect(t.xp).toBeGreaterThanOrEqual(0)
    expect(t.xp).toBeLessThan(t.xpToNextLevel()) // leftover xp never exceeds the next threshold
  })

  it('ignores non-positive or non-finite XP grants', () => {
    const t = freshService()
    t.grantXp(0)
    t.grantXp(-50)
    t.grantXp(Number.NaN)
    expect(t.level).toBe(1)
    expect(t.xp).toBe(0)
  })

  describe('buyNode', () => {
    it('refuses when the player has no unspent points, even on an unlocked node', () => {
      const t = freshService()
      const root = indexOf(t, 'trunk-1')
      expect(t.isUnlocked(root)).toBe(true)
      expect(t.buyNode(root)).toBe(false)
      expect(t.levelOf(root)).toBe(0)
    })

    it('refuses a locked node (prereq not met) even with points available', () => {
      const t = freshService()
      t.grantXp(1000) // several points banked
      const trunk2 = indexOf(t, 'trunk-2') // requires trunk-1 owned first
      expect(t.isUnlocked(trunk2)).toBe(false)
      expect(t.buyNode(trunk2)).toBe(false)
      expect(t.levelOf(trunk2)).toBe(0)
    })

    it('spends exactly 1 point per level, unlocking the next node in the chain as it goes', () => {
      const t = freshService()
      t.grantXp(1000)
      const pointsBefore = t.unspentPoints
      const trunk1 = indexOf(t, 'trunk-1')
      const trunk2 = indexOf(t, 'trunk-2')
      expect(t.buyNode(trunk1)).toBe(true)
      expect(t.levelOf(trunk1)).toBe(1)
      expect(t.unspentPoints).toBe(pointsBefore - 1)
      expect(t.buyNode(trunk2)).toBe(true) // now unlocked: trunk-1 is owned
      expect(t.levelOf(trunk2)).toBe(1)
      expect(t.unspentPoints).toBe(pointsBefore - 2)
    })

    it('the Grand Nexus (a real 4-way merge) requires ALL 4 branch keystones, not just some', () => {
      const t = freshService()
      const nexus = indexOf(t, 'nexus')
      const keystoneIds = ['combat-keystone', 'precision-keystone', 'economy-keystone', 'continuum-keystone']
      const keystoneIdx = keystoneIds.map((id) => indexOf(t, id))
      const levels = new Array(t.count).fill(0)

      expect(t.isUnlocked(nexus)).toBe(false)
      for (let k = 0; k < keystoneIdx.length - 1; k++) {
        levels[keystoneIdx[k]] = 1
        t.restoreLevels(levels)
        expect(t.isUnlocked(nexus)).toBe(false) // still missing one
      }
      levels[keystoneIdx[keystoneIdx.length - 1]] = 1
      t.restoreLevels(levels)
      expect(t.isUnlocked(nexus)).toBe(true)
    })

    it('refuses once a node is already at its max level', () => {
      const t = freshService()
      t.grantXp(100_000) // more than enough points to max one node several times over
      const root = indexOf(t, 'trunk-1')
      const maxLevel = t.def(root).maxLevel
      for (let i = 0; i < maxLevel; i++) expect(t.buyNode(root)).toBe(true)
      expect(t.levelOf(root)).toBe(maxLevel)
      expect(t.buyNode(root)).toBe(false)
      expect(t.levelOf(root)).toBe(maxLevel)
    })

    it('a Gem Socket node behaves like any other node for unlock purposes (1 point, no bonus)', () => {
      const t = freshService()
      t.grantXp(1000)
      const gem = indexOf(t, 'combat-gem-1')
      expect(t.isUnlocked(gem)).toBe(false)
      unlockPathTo(t, 'combat-gem-1') // seed combat-1..4 (and their own ancestors) as owned
      expect(t.isUnlocked(gem)).toBe(true)
      expect(t.buyNode(gem)).toBe(true)
      expect(t.levelOf(gem)).toBe(1)
      expect(t.def(gem).effect).toBe(TalentEffect.GemSocket)
    })
  })

  it('dpsMultiplier compounds across every owned Dps-tagged node (Combat branch)', () => {
    const t = freshService()
    t.grantXp(100_000)
    expect(t.dpsMultiplier().toNumber()).toBeCloseTo(1, 6) // nothing bought yet
    unlockPathTo(t, 'combat-2') // combat-2 is the branch's Dps-tagged node
    t.buyNode(indexOf(t, 'combat-2'))
    expect(t.dpsMultiplier().toNumber()).toBeGreaterThan(1)
  })

  it('tapCritChance/shipCritChance sum Precision branch nodes and cap below 1', () => {
    const t = freshService()
    t.grantXp(100_000)
    expect(t.tapCritChance()).toBe(0)
    expect(t.shipCritChance()).toBe(0)
    unlockPathTo(t, 'precision-2')
    t.buyNode(indexOf(t, 'precision-1')) // TapCritChance
    t.buyNode(indexOf(t, 'precision-2')) // ShipCritChance
    expect(t.tapCritChance()).toBeGreaterThan(0)
    expect(t.shipCritChance()).toBeGreaterThan(0)
    expect(t.tapCritChance()).toBeLessThan(1)
    expect(t.shipCritChance()).toBeLessThan(1)
  })

  it('relicGainMultiplier only reflects RelicGain-tagged nodes, not OfflineReward', () => {
    const t = freshService()
    t.grantXp(100_000)
    expect(t.relicGainMultiplier().toNumber()).toBeCloseTo(1, 6)
    // Seeds the shared trunk (Capstone-tagged, which DOES buff RelicGain - see CAPSTONE_EFFECTS)
    // as owned, so the baseline to compare against is whatever the trunk alone contributes, not 1.
    unlockPathTo(t, 'continuum-2')
    const baseline = t.relicGainMultiplier().toNumber()
    expect(baseline).toBeGreaterThan(1) // trunk's Capstone bonus alone already moved this

    t.buyNode(indexOf(t, 'continuum-1')) // OfflineReward
    expect(t.relicGainMultiplier().toNumber()).toBeCloseTo(baseline, 6) // unaffected - wrong effect
    expect(t.offlineRewardMultiplier().toNumber()).toBeGreaterThan(1)

    t.buyNode(indexOf(t, 'continuum-2')) // RelicGain
    expect(t.relicGainMultiplier().toNumber()).toBeGreaterThan(baseline)
  })

  it('trunk/wing Capstone nodes each add their own bonus to CAPSTONE_EFFECTS stats, not just one', () => {
    const t = freshService()
    t.grantXp(100_000)
    const before = t.dpsMultiplier().toNumber()
    t.buyNode(indexOf(t, 'trunk-1'))
    const afterOne = t.dpsMultiplier().toNumber()
    expect(afterOne).toBeGreaterThan(before)
    t.buyNode(indexOf(t, 'trunk-2'))
    const afterTwo = t.dpsMultiplier().toNumber()
    expect(afterTwo).toBeGreaterThan(afterOne) // a second Capstone node compounds, isn't ignored
  })
})
