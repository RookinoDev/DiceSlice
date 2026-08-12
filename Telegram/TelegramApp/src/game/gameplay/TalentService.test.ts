import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { buildDefaultTalents, TalentEffect, type TalentBranch } from '../config/TalentDefinition'
import { TalentService } from './TalentService'

function freshService(): TalentService {
  return new TalentService(buildDefaultTalents(), defaultBalanceConfig)
}

/** Id-based lookup - a stable stand-in for "some specific node," since the tree's actual node
 *  ORDER is no longer a meaningful assumption to hardcode. */
function indexOf(t: TalentService, id: string): number {
  for (let i = 0; i < t.count; i++) if (t.def(i).id === id) return i
  throw new Error(`no talent node with id ${id}`)
}

/** Directly grants `points` worth of levels in `branch` (spread across that branch's regular/
 *  special tier nodes - never the capstone or gems, so "points spent toward the capstone
 *  threshold" doesn't circularly involve leveling the capstone itself) via the existing
 *  save-restore path - a shortcut around buying through several real purchases by hand, to set
 *  up "N points already spent" test preconditions for tier/combo/capstone gating. */
function grantBranchPoints(t: TalentService, branch: TalentBranch, points: number): void {
  const levels = new Array(t.count).fill(0)
  // Preserve levels already set by earlier calls (e.g. seeding 2 branches for a combo test).
  for (let i = 0; i < t.count; i++) levels[i] = t.levelOf(i)
  let remaining = points - levels.reduce((sum, lvl, i) => (t.def(i).branch === branch ? sum + lvl : sum), 0)
  for (let i = 0; i < t.count && remaining > 0; i++) {
    const def = t.def(i)
    if (def.branch !== branch || def.isCapstone || def.effect === TalentEffect.GemSocket) continue
    const capacity = def.maxLevel - levels[i]
    if (capacity <= 0) continue
    const grant = Math.min(remaining, capacity)
    levels[i] += grant
    remaining -= grant
  }
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

    t.grantXp(2000) // crosses several levels given the default curve (12*L^1.7 per level)

    expect(t.level).toBeGreaterThan(1)
    expect(t.unspentPoints).toBe(t.level - 1) // exactly 1 point per level gained, not per XP grant
    expect(levelsSeen.length).toBe(t.level - 1)
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
      const tier1 = indexOf(t, 'cannon-pulse-amplifier')
      expect(t.isUnlocked(tier1)).toBe(true)
      expect(t.buyNode(tier1)).toBe(false)
      expect(t.levelOf(tier1)).toBe(0)
    })

    it('refuses a tier-2 talent (5 points required in-branch) even with points available, if the branch is empty', () => {
      const t = freshService()
      t.grantXp(1000) // several points banked
      const tier2 = indexOf(t, 'cannon-combat-rhythm')
      expect(t.isUnlocked(tier2)).toBe(false)
      expect(t.buyNode(tier2)).toBe(false)
      expect(t.levelOf(tier2)).toBe(0)
    })

    it('spends exactly 1 point per level, unlocking the next tier once enough branch points are spent', () => {
      const t = freshService()
      t.grantXp(1000)
      const pointsBefore = t.unspentPoints
      const tier1a = indexOf(t, 'cannon-pulse-amplifier')
      const tier1b = indexOf(t, 'cannon-precision-optics')
      const tier2 = indexOf(t, 'cannon-combat-rhythm')

      for (let i = 0; i < 5; i++) expect(t.buyNode(i % 2 === 0 ? tier1a : tier1b)).toBe(true)
      expect(t.unspentPoints).toBe(pointsBefore - 5)
      expect(t.isUnlocked(tier2)).toBe(true) // 5 points now spent in cannon, split across 2 nodes
      expect(t.buyNode(tier2)).toBe(true)
      expect(t.levelOf(tier2)).toBe(1)
    })

    it('a combo talent requires 12 points in BOTH bridged branches, not just one', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      const combo = indexOf(t, 'combo-cannon-fleet')

      expect(t.isUnlocked(combo)).toBe(false)
      grantBranchPoints(t, 'cannon', 12)
      expect(t.isUnlocked(combo)).toBe(false) // cannon alone isn't enough
      grantBranchPoints(t, 'fleet', 12)
      expect(t.isUnlocked(combo)).toBe(true)
      expect(t.buyNode(combo)).toBe(true)
      expect(t.def(combo).maxLevel).toBe(3) // combo talents run 3 ranks
    })

    it('a branch capstone requires 35 points in its own branch', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      const capstone = indexOf(t, 'cannon-nova-lance')

      expect(t.isUnlocked(capstone)).toBe(false)
      grantBranchPoints(t, 'cannon', 34)
      expect(t.isUnlocked(capstone)).toBe(false)
      grantBranchPoints(t, 'cannon', 35)
      expect(t.isUnlocked(capstone)).toBe(true)
      expect(t.buyNode(capstone)).toBe(true)
      expect(t.def(capstone).isCapstone).toBe(true)
    })

    it('refuses once a node is already at its max level', () => {
      const t = freshService()
      t.grantXp(1_000_000) // more than enough points to max one node several times over
      const tier1 = indexOf(t, 'cannon-pulse-amplifier')
      const maxLevel = t.def(tier1).maxLevel
      for (let i = 0; i < maxLevel; i++) expect(t.buyNode(tier1)).toBe(true)
      expect(t.levelOf(tier1)).toBe(maxLevel)
      expect(t.buyNode(tier1)).toBe(false)
      expect(t.levelOf(tier1)).toBe(maxLevel)
    })

    it('a Gem Socket node behaves like any other node for unlock purposes (1 point, no bonus), unlocking at 5 branch points', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      const gem = indexOf(t, 'cannon-gem-1')
      expect(t.isUnlocked(gem)).toBe(false)
      grantBranchPoints(t, 'cannon', 5)
      expect(t.isUnlocked(gem)).toBe(true)
      expect(t.buyNode(gem)).toBe(true)
      expect(t.levelOf(gem)).toBe(1)
      expect(t.def(gem).effect).toBe(TalentEffect.GemSocket)
    })
  })

  it('dpsMultiplier compounds across every owned Dps-tagged node', () => {
    const t = freshService()
    t.grantXp(1_000_000)
    expect(t.dpsMultiplier().toNumber()).toBeCloseTo(1, 6) // nothing bought yet
    expect(t.buyNode(indexOf(t, 'fleet-autonomous-turrets'))).toBe(true) // Dps, tier 1
    expect(t.dpsMultiplier().toNumber()).toBeGreaterThan(1)
  })

  it('tapCritChance sums every TapCritChance-tagged node and caps below 1; shipCritChance stays 0 (no Phase-1 node maps to it yet)', () => {
    const t = freshService()
    t.grantXp(1_000_000)
    expect(t.tapCritChance()).toBe(0)
    expect(t.shipCritChance()).toBe(0)
    t.buyNode(indexOf(t, 'cannon-precision-optics')) // TapCritChance, tier 1
    expect(t.tapCritChance()).toBeGreaterThan(0)
    expect(t.tapCritChance()).toBeLessThan(1)
    expect(t.shipCritChance()).toBe(0) // untouched - correct, not a bug
  })

  it('relicGainMultiplier only reflects RelicGain-tagged nodes, not Dps, in the same branch', () => {
    const t = freshService()
    t.grantXp(1_000_000)
    expect(t.relicGainMultiplier().toNumber()).toBeCloseTo(1, 6)
    // Seeds Core (Capstone-tagged, which DOES buff RelicGain - see CAPSTONE_EFFECTS) as owned,
    // so the baseline to compare against is whatever Core alone contributes, not 1.
    t.buyNode(indexOf(t, 'core-expanded-reactor'))
    const baseline = t.relicGainMultiplier().toNumber()
    expect(baseline).toBeGreaterThan(1) // Core's Capstone bonus alone already moved this

    t.buyNode(indexOf(t, 'warp-first-strike-protocol')) // Dps, same branch as the RelicGain node below
    expect(t.relicGainMultiplier().toNumber()).toBeCloseTo(baseline, 6) // unaffected - wrong effect

    t.buyNode(indexOf(t, 'warp-warp-navigation')) // RelicGain
    expect(t.relicGainMultiplier().toNumber()).toBeGreaterThan(baseline)
  })

  it('Core branch Capstone nodes each add their own bonus to CAPSTONE_EFFECTS stats, not just one', () => {
    const t = freshService()
    t.grantXp(1_000_000)
    const before = t.dpsMultiplier().toNumber()
    t.buyNode(indexOf(t, 'core-expanded-reactor'))
    const afterOne = t.dpsMultiplier().toNumber()
    expect(afterOne).toBeGreaterThan(before)
    t.buyNode(indexOf(t, 'core-flux-recharge'))
    const afterTwo = t.dpsMultiplier().toNumber()
    expect(afterTwo).toBeGreaterThan(afterOne) // a second Capstone node compounds, isn't ignored
  })

  describe('unspentPoints is derived, not stored (regression: a real reported bug)', () => {
    // A player's talent tree got reset (Eternal Drive shipped: 60 nodes -> 61, restoreLevels's
    // own "tree redesigned" rule wipes node allocation - see its comment) but their points never
    // came back: unspentPoints used to be its OWN persisted field, restored from the OLD save's
    // leftover-after-spending value - a small number for anyone who'd already spent most of what
    // they'd earned. The 200+ points that had been sitting in now-wiped node levels were simply
    // gone: not in a node, not spendable. Deriving unspentPoints from level - 1 - sum(levels)
    // instead means it can never desync from the levels array, by construction.
    it('after buying nodes, spent + unspent always sums to exactly level - 1', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      grantBranchPoints(t, 'cannon', 30)
      t.buyNode(indexOf(t, 'cannon-nova-lance')) // won't unlock without 35, harmless no-op either way
      const spent = Array.from({ length: t.count }, (_, i) => t.levelOf(i)).reduce((a, b) => a + b, 0)
      expect(t.unspentPoints + spent).toBe(t.level - 1)
    })

    it('a tree-redesign reset (restoreLevels bails on a node-count mismatch) still leaves every earned point spendable', () => {
      // Models the real production path: a load starts from a FRESH TalentService (levels all
      // 0, from createGameSession()), then restoreLevels() is handed the OLD save's node array.
      // With a length mismatch, restoreLevels bails out and leaves the already-zero levels alone
      // - it never "wipes" anything, it just never re-applies the old (now-incompatible) spend.
      const t = freshService()
      t.restoreLevels(new Array(t.count - 1).fill(1)) // one fewer node than the live tree - e.g. before Eternal Drive shipped
      for (let i = 0; i < t.count; i++) expect(t.levelOf(i)).toBe(0) // bailed out, nothing applied

      // The level itself restores fine (it's a separate, unaffected save field) - a real veteran
      // player who'd already spent most of what they'd earned, like the reported 200+ points.
      t.restoreProgress(211, 0)

      expect(t.unspentPoints).toBe(210) // every point is spendable again, not just whatever was left unspent
    })
  })
})
