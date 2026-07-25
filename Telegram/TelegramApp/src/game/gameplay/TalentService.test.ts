import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { buildDefaultTalents } from '../config/TalentDefinition'
import { TalentService } from './TalentService'

function freshService(): TalentService {
  return new TalentService(buildDefaultTalents(), defaultBalanceConfig)
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
      const tier1 = 0 // assault tier 1, always unlocked
      expect(t.isUnlocked(tier1)).toBe(true)
      expect(t.buyNode(tier1)).toBe(false)
      expect(t.levelOf(tier1)).toBe(0)
    })

    it('refuses a locked node (prereq not met) even with points available', () => {
      const t = freshService()
      t.grantXp(1000) // several points banked
      const tier2 = 1 // assault tier 2 - requires tier 1 (index 0) owned first
      expect(t.isUnlocked(tier2)).toBe(false)
      expect(t.buyNode(tier2)).toBe(false)
      expect(t.levelOf(tier2)).toBe(0)
    })

    it('spends exactly 1 point per level, in order down the chain', () => {
      const t = freshService()
      t.grantXp(1000)
      const pointsBefore = t.unspentPoints
      expect(t.buyNode(0)).toBe(true) // assault tier 1
      expect(t.levelOf(0)).toBe(1)
      expect(t.unspentPoints).toBe(pointsBefore - 1)
      expect(t.buyNode(1)).toBe(true) // now unlocked: assault tier 2
      expect(t.levelOf(1)).toBe(1)
      expect(t.unspentPoints).toBe(pointsBefore - 2)
    })

    it('refuses once a node is already at its max level', () => {
      const t = freshService()
      t.grantXp(100_000) // more than enough points to max one node several times over
      const tier1 = 0
      const maxLevel = t.def(tier1).maxLevel
      for (let i = 0; i < maxLevel; i++) expect(t.buyNode(tier1)).toBe(true)
      expect(t.levelOf(tier1)).toBe(maxLevel)
      expect(t.buyNode(tier1)).toBe(false)
      expect(t.levelOf(tier1)).toBe(maxLevel)
    })
  })

  it('dpsMultiplier compounds across every owned Dps-tagged node (Fleet Command branch)', () => {
    const t = freshService()
    t.grantXp(100_000)
    expect(t.dpsMultiplier().toNumber()).toBeCloseTo(1, 6) // nothing bought yet
    const fleetTier1 = t.count > 6 ? 6 : 0 // Fleet Command is the 2nd branch (indices 6..11)
    t.buyNode(fleetTier1)
    expect(t.dpsMultiplier().toNumber()).toBeGreaterThan(1)
  })
})
