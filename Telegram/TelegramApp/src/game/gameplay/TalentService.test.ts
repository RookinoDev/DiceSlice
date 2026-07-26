import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { buildDefaultTalents, TalentEffect } from '../config/TalentDefinition'
import { TalentService } from './TalentService'

function freshService(): TalentService {
  return new TalentService(buildDefaultTalents(), defaultBalanceConfig)
}

/** Every cluster's root node ('<cluster>-core') is always unlockable - a stable, id-based
 *  stand-in for "some always-unlocked node," since the tree's actual node ORDER is no longer a
 *  meaningful assumption to hardcode (that was the whole point of moving to an id-based graph -
 *  see TalentDefinition.ts). */
function indexOf(t: TalentService, id: string): number {
  for (let i = 0; i < t.count; i++) if (t.def(i).id === id) return i
  throw new Error(`no talent node with id ${id}`)
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

    t.grantXp(500) // crosses level 1->2->3->4 given the default curve (40, 113, 208 xp thresholds)

    expect(t.level).toBe(4)
    expect(t.unspentPoints).toBe(3) // exactly 1 point per level gained, not per XP grant
    expect(levelsSeen).toEqual([2, 3, 4])
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
      const root = indexOf(t, 'assault-core')
      expect(t.isUnlocked(root)).toBe(true)
      expect(t.buyNode(root)).toBe(false)
      expect(t.levelOf(root)).toBe(0)
    })

    it('refuses a locked node (prereq not met) even with points available', () => {
      const t = freshService()
      t.grantXp(1000) // several points banked
      const a1 = indexOf(t, 'assault-a1') // requires assault-core owned first
      expect(t.isUnlocked(a1)).toBe(false)
      expect(t.buyNode(a1)).toBe(false)
      expect(t.levelOf(a1)).toBe(0)
    })

    it('spends exactly 1 point per level, unlocking the next node in the chain as it goes', () => {
      const t = freshService()
      t.grantXp(1000)
      const pointsBefore = t.unspentPoints
      const root = indexOf(t, 'assault-core')
      const a1 = indexOf(t, 'assault-a1')
      expect(t.buyNode(root)).toBe(true)
      expect(t.levelOf(root)).toBe(1)
      expect(t.unspentPoints).toBe(pointsBefore - 1)
      expect(t.buyNode(a1)).toBe(true) // now unlocked: assault-core is owned
      expect(t.levelOf(a1)).toBe(1)
      expect(t.unspentPoints).toBe(pointsBefore - 2)
    })

    it('a merge node requires BOTH of its fork prerequisites owned, not just one', () => {
      const t = freshService()
      t.grantXp(1000)
      const root = indexOf(t, 'assault-core')
      const a1 = indexOf(t, 'assault-a1')
      const b1 = indexOf(t, 'assault-b1')
      const ab = indexOf(t, 'assault-ab')
      t.buyNode(root)
      t.buyNode(a1)
      expect(t.isUnlocked(ab)).toBe(false) // b1 not owned yet
      t.buyNode(b1)
      expect(t.isUnlocked(ab)).toBe(true)
      expect(t.buyNode(ab)).toBe(true)
    })

    it('refuses once a node is already at its max level', () => {
      const t = freshService()
      t.grantXp(100_000) // more than enough points to max one node several times over
      const root = indexOf(t, 'assault-core')
      const maxLevel = t.def(root).maxLevel
      for (let i = 0; i < maxLevel; i++) expect(t.buyNode(root)).toBe(true)
      expect(t.levelOf(root)).toBe(maxLevel)
      expect(t.buyNode(root)).toBe(false)
      expect(t.levelOf(root)).toBe(maxLevel)
    })

    it('a Gem Socket node behaves like any other node for unlock purposes (1 point, no bonus)', () => {
      const t = freshService()
      t.grantXp(1000)
      const root = indexOf(t, 'assault-core')
      const a1 = indexOf(t, 'assault-a1')
      const gem1 = indexOf(t, 'assault-gem-1')
      t.buyNode(root)
      expect(t.isUnlocked(gem1)).toBe(false) // requires assault-a1, not assault-core directly
      t.buyNode(a1)
      expect(t.isUnlocked(gem1)).toBe(true)
      expect(t.buyNode(gem1)).toBe(true)
      expect(t.levelOf(gem1)).toBe(1)
      expect(t.def(gem1).effect).toBe(TalentEffect.GemSocket)
    })
  })

  it('dpsMultiplier compounds across every owned Dps-tagged node (Armada cluster)', () => {
    const t = freshService()
    t.grantXp(100_000)
    expect(t.dpsMultiplier().toNumber()).toBeCloseTo(1, 6) // nothing bought yet
    const armadaRoot = indexOf(t, 'armada-core')
    t.buyNode(armadaRoot)
    expect(t.dpsMultiplier().toNumber()).toBeGreaterThan(1)
  })

  it('tapCritChance/shipCritChance sum Precision cluster nodes and cap below 1', () => {
    const t = freshService()
    t.grantXp(100_000)
    expect(t.tapCritChance()).toBe(0)
    expect(t.shipCritChance()).toBe(0)
    const root = indexOf(t, 'precision-core') // TapCritChance
    const b1 = indexOf(t, 'precision-b1') // ShipCritChance
    t.buyNode(root)
    t.buyNode(b1)
    expect(t.tapCritChance()).toBeGreaterThan(0)
    expect(t.shipCritChance()).toBeGreaterThan(0)
    expect(t.tapCritChance()).toBeLessThan(1)
    expect(t.shipCritChance()).toBeLessThan(1)
  })

  it('relicGainMultiplier only reflects Continuum nodes tagged RelicGain, not OfflineReward', () => {
    const t = freshService()
    t.grantXp(100_000)
    expect(t.relicGainMultiplier().toNumber()).toBeCloseTo(1, 6)
    const root = indexOf(t, 'continuum-core') // OfflineReward
    t.buyNode(root)
    expect(t.relicGainMultiplier().toNumber()).toBeCloseTo(1, 6) // unaffected - wrong effect
    expect(t.offlineRewardMultiplier().toNumber()).toBeGreaterThan(1)

    const b1 = indexOf(t, 'continuum-b1') // RelicGain
    t.buyNode(b1)
    expect(t.relicGainMultiplier().toNumber()).toBeGreaterThan(1)
  })
})
