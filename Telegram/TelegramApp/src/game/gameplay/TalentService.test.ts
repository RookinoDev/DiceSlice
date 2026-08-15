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

    t.buyNode(indexOf(t, 'warp-first-strike-protocol')) // Dps, same branch as the RelicGain node below
    expect(t.relicGainMultiplier().toNumber()).toBeCloseTo(1, 6) // unaffected - wrong effect

    t.buyNode(indexOf(t, 'warp-warp-navigation')) // RelicGain
    expect(t.relicGainMultiplier().toNumber()).toBeGreaterThan(1)
  })

  describe('Core Engine: real identity is active-skill cooldown/duration/power, not a placeholder', () => {
    it('skillCooldownReduction sums every SkillCooldown-tagged node, not just one', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      expect(t.skillCooldownReduction()).toBe(0)
      // Maxes tier 1's first node (expanded-reactor, SkillDuration) to exactly the tier-2
      // threshold - unlocks thermal-recycling without touching either SkillCooldown node below.
      grantBranchPoints(t, 'core', 5)
      t.buyNode(indexOf(t, 'core-flux-recharge')) // tier 1, SkillCooldown, still fresh
      const afterOne = t.skillCooldownReduction()
      expect(afterOne).toBeGreaterThan(0)
      t.buyNode(indexOf(t, 'core-thermal-recycling')) // tier 2, SkillCooldown, now unlocked
      expect(t.skillCooldownReduction()).toBeGreaterThan(afterOne) // a second node adds, isn't ignored
    })

    it('skillDurationMultiplier and skillPowerMultiplier only move on their own tagged nodes', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      expect(t.skillDurationMultiplier().toNumber()).toBeCloseTo(1, 6)
      expect(t.skillPowerMultiplier().toNumber()).toBeCloseTo(1, 6)

      t.buyNode(indexOf(t, 'core-flux-recharge')) // SkillCooldown, not Duration or Power
      expect(t.skillDurationMultiplier().toNumber()).toBeCloseTo(1, 6)
      expect(t.skillPowerMultiplier().toNumber()).toBeCloseTo(1, 6)

      t.buyNode(indexOf(t, 'core-expanded-reactor')) // SkillDuration
      expect(t.skillDurationMultiplier().toNumber()).toBeGreaterThan(1)
      expect(t.skillPowerMultiplier().toNumber()).toBeCloseTo(1, 6) // still untouched

      // Maxes expanded-reactor/flux-recharge and partially levels thermal-recycling to exactly
      // the tier-3 threshold - unlocks chain-reaction (SkillPower) without touching it.
      grantBranchPoints(t, 'core', 12)
      t.buyNode(indexOf(t, 'core-chain-reaction')) // SkillPower, still fresh
      expect(t.skillPowerMultiplier().toNumber()).toBeGreaterThan(1)
    })

    it("Infinite Core (CoreCapstone) tops up all three at once, same shape as the tree-wide Capstone sentinel", () => {
      const t = freshService()
      t.grantXp(1_000_000)
      grantBranchPoints(t, 'core', 35) // Infinite Core's unlock threshold
      const cooldownBefore = t.skillCooldownReduction()
      const durationBefore = t.skillDurationMultiplier().toNumber()
      const powerBefore = t.skillPowerMultiplier().toNumber()

      t.buyNode(indexOf(t, 'core-infinite-core'))

      expect(t.skillCooldownReduction()).toBeGreaterThan(cooldownBefore)
      expect(t.skillDurationMultiplier().toNumber()).toBeGreaterThan(durationBefore)
      expect(t.skillPowerMultiplier().toNumber()).toBeGreaterThan(powerBefore)
    })
  })

  describe('The 4 other branches: real sub-identities, not one flat stat repeated on every node', () => {
    it('Vanguard Cannon: tapCritDamageMultiplier only moves on TapCritDamage nodes, not TapDamage/TapCritChance', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      expect(t.tapCritDamageMultiplier().toNumber()).toBeCloseTo(1, 6)
      t.buyNode(indexOf(t, 'cannon-pulse-amplifier')) // TapDamage
      t.buyNode(indexOf(t, 'cannon-precision-optics')) // TapCritChance
      expect(t.tapCritDamageMultiplier().toNumber()).toBeCloseTo(1, 6) // untouched by either
      // Maxes tier 1 to exactly the tier-2 threshold - unlocks armor-fracture untouched.
      grantBranchPoints(t, 'cannon', 5)
      t.buyNode(indexOf(t, 'cannon-armor-fracture')) // TapCritDamage, tier 2
      expect(t.tapCritDamageMultiplier().toNumber()).toBeGreaterThan(1)
    })

    it('Autonomous Fleet: shipCritChance/shipCritDamageMultiplier only move on their own tagged nodes', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      expect(t.shipCritChance()).toBe(0)
      expect(t.shipCritDamageMultiplier().toNumber()).toBeCloseTo(1, 6)
      t.buyNode(indexOf(t, 'fleet-autonomous-turrets')) // Dps, neither
      expect(t.shipCritChance()).toBe(0)
      expect(t.shipCritDamageMultiplier().toNumber()).toBeCloseTo(1, 6)
      t.buyNode(indexOf(t, 'fleet-drone-hangar')) // ShipCritChance
      expect(t.shipCritChance()).toBeGreaterThan(0)
      expect(t.shipCritDamageMultiplier().toNumber()).toBeCloseTo(1, 6) // still untouched
      // Maxes tier 1 to exactly the tier-2 threshold - unlocks replicator-nanites untouched.
      grantBranchPoints(t, 'fleet', 5)
      t.buyNode(indexOf(t, 'fleet-replicator-nanites')) // ShipCritDamage, tier 2
      expect(t.shipCritDamageMultiplier().toNumber()).toBeGreaterThan(1)
    })

    it('Galactic Salvage: upgradeCostReduction sums every UpgradeCostReduction node, unaffected by Gold nodes', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      expect(t.upgradeCostReduction()).toBe(0)
      t.buyNode(indexOf(t, 'salvage-salvage-lasers')) // Gold, not a discount
      expect(t.upgradeCostReduction()).toBe(0)
      // Maxes tier 1 to exactly the tier-2 threshold - unlocks rare-signal-scanner untouched.
      grantBranchPoints(t, 'salvage', 5)
      t.buyNode(indexOf(t, 'salvage-rare-signal-scanner')) // UpgradeCostReduction, tier 2
      const afterOne = t.upgradeCostReduction()
      expect(afterOne).toBeGreaterThan(0)
      // Maxes through tier 2 to exactly the tier-3 threshold - unlocks recycling-forge untouched.
      grantBranchPoints(t, 'salvage', 12)
      t.buyNode(indexOf(t, 'salvage-recycling-forge')) // UpgradeCostReduction, tier 3
      expect(t.upgradeCostReduction()).toBeGreaterThan(afterOne) // a second node adds, isn't ignored
    })

    it('Warp Command: bossTimerMultiplier only moves on BossTimerBonus nodes, not RelicGain/Dps', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      expect(t.bossTimerMultiplier().toNumber()).toBeCloseTo(1, 6)
      t.buyNode(indexOf(t, 'warp-warp-navigation')) // RelicGain
      t.buyNode(indexOf(t, 'warp-first-strike-protocol')) // Dps
      expect(t.bossTimerMultiplier().toNumber()).toBeCloseTo(1, 6) // untouched by either
      // Maxes tier 1 to exactly the tier-2 threshold - unlocks gravity-snare untouched.
      grantBranchPoints(t, 'warp', 5)
      t.buyNode(indexOf(t, 'warp-gravity-snare')) // BossTimerBonus
      expect(t.bossTimerMultiplier().toNumber()).toBeGreaterThan(1)
    })
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

  describe('Eternal Drive: every purchase rolls a random passive perk instead of leveling a fixed stat', () => {
    it('buying it grants exactly one perk, emits onPerkGranted, and never runs out (unbounded)', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      const eternal = indexOf(t, 'eternal-drive')
      const granted: unknown[] = []
      t.onPerkGranted.on((p) => granted.push(p))

      expect(t.grantedPerks.length).toBe(0)
      expect(t.buyNode(eternal)).toBe(true)
      expect(t.grantedPerks.length).toBe(1)
      expect(granted.length).toBe(1)
      expect(t.grantedPerks[0]).toEqual(granted[0])

      for (let i = 0; i < 50; i++) expect(t.buyNode(eternal)).toBe(true) // never "maxed"
      expect(t.grantedPerks.length).toBe(51)
      expect(t.levelOf(eternal)).toBe(51) // still tracks purchase count, just not a bonus formula
    })

    it('buying a REGULAR node never grants a perk - only Eternal Drive does', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      t.buyNode(indexOf(t, 'cannon-pulse-amplifier'))
      expect(t.grantedPerks.length).toBe(0)
    })

    it('granted perks boost the matching stat, additively across many grants (not compounding per-perk)', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      const eternal = indexOf(t, 'eternal-drive')
      const before = t.dpsMultiplier().toNumber()
      for (let i = 0; i < 30; i++) t.buyNode(eternal)

      const after = t.dpsMultiplier().toNumber()
      expect(after).toBeGreaterThanOrEqual(before) // some of the 30 rolls should have hit Dps or Capstone
      // Additive, not compounding: every template caps at 5% (2.5% for Capstone-style ones), so
      // even if ALL 30 rolls hit Dps at their max, additive stays at 1 + 30*0.05 = 2.5. 30
      // INDEPENDENTLY MULTIPLYING rolls at the same rate would instead compound past 4x
      // (1.05^30 ≈ 4.32) - this bound is only reachable by the additive (safe) model.
      expect(after).toBeLessThanOrEqual(2.5 + 1e-9)
    })

    it('restorePerks round-trips exactly what was granted, without re-rolling', () => {
      const t = freshService()
      t.grantXp(1_000_000)
      const eternal = indexOf(t, 'eternal-drive')
      for (let i = 0; i < 5; i++) t.buyNode(eternal)
      const saved = t.grantedPerks.map((p) => ({ ...p }))

      const t2 = freshService()
      t2.restorePerks(saved)
      expect(t2.grantedPerks).toEqual(saved)
      expect(t2.dpsMultiplier().toNumber()).toBeCloseTo(t.dpsMultiplier().toNumber(), 10)
    })

    it('restorePerks drops malformed entries instead of throwing', () => {
      const t = freshService()
      // @ts-expect-error deliberately malformed to prove it's dropped, not thrown
      t.restorePerks([{ templateId: 'overcharged-thrusters', magnitude: 0.03 }, { templateId: 123, magnitude: 0.03 }, null, { magnitude: 'x' }])
      expect(t.grantedPerks.length).toBe(1)
    })
  })
})
