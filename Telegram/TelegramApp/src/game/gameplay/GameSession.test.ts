import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
import { createGameSession } from '../createGameSession'
import { captureSave, applySave } from '../persistence/SaveBinder'

describe('GameSession integration', () => {
  it('begins with a full-health stage-1 planet', () => {
    const session = createGameSession()
    session.begin()
    expect(session.enemy.current).not.toBeNull()
    expect(session.enemy.current!.stage).toBe(1)
    expect(session.enemy.current!.hpFraction01()).toBeCloseTo(1, 6)
  })

  it('tapping damages the planet and eventually kills it, awarding Stardust', () => {
    const session = createGameSession()
    session.begin()
    const maxHp = session.enemy.current!.maxHp
    let kills = 0
    session.onReward.on(() => kills++)

    // Tap damage at level 1 is tiny relative to enemy HP, so tap enough times to guarantee a kill.
    for (let i = 0; i < 100_000 && kills === 0; i++) session.tap()

    expect(kills).toBeGreaterThan(0)
    expect(session.wallet.balance.gt(BigNumber.Zero)).toBe(true)
    expect(session.stage.currentStage).toBe(2)
    expect(maxHp.gt(BigNumber.Zero)).toBe(true)
  })

  it('the first kill always grants enough Stardust to afford the first Tap Damage upgrade (tutorial flow)', () => {
    const session = createGameSession()
    session.begin()
    let firstKillGold: BigNumber | null = null
    session.onReward.on(({ gold }) => {
      if (firstKillGold === null) firstKillGold = gold
    })
    for (let i = 0; i < 100_000 && firstKillGold === null; i++) session.tap()

    expect(firstKillGold).not.toBeNull()
    expect(session.wallet.balance.gte(session.tapUpgrade.nextCost)).toBe(true)
    expect(session.upgradeTapDamage()).toBe(true)
  })

  it('the first kill does not also force the full ship cost (that belongs to Tap Damage first)', () => {
    const session = createGameSession()
    session.begin()
    let kills = 0
    session.onReward.on(() => kills++)
    for (let i = 0; i < 100_000 && kills === 0; i++) session.tap()

    expect(kills).toBe(1)
    // Still guarantees the tap-upgrade floor (see the test above) - just not the larger ship
    // cost yet, so a new player naturally spends the first kill's reward there, as intended.
    expect(session.wallet.balance.gte(session.tapUpgrade.nextCost)).toBe(true)
  })

  it('from the second kill onward, Stardust is guaranteed to cover the first ship - even after spending some of the first kill on Tap Damage (tutorial flow)', () => {
    const session = createGameSession()
    session.begin()
    let kills = 0
    session.onReward.on(() => kills++)
    for (let i = 0; i < 100_000 && kills === 0; i++) session.tap()
    expect(kills).toBe(1)

    // Spend whatever the first kill granted, same as a real player following the tap-upgrade step.
    expect(session.upgradeTapDamage()).toBe(true)

    for (let i = 0; i < 100_000 && kills === 1; i++) session.tap()
    expect(kills).toBe(2)
    expect(session.wallet.balance.gte(session.ships.nextCost(0))).toBe(true)
    expect(session.buyShip(0)).toBe(true)
  })

  it('cannot afford a ship with zero Stardust', () => {
    // Ship 1, not 0 - see the previous test's comment: ship 0's first purchase is
    // intentionally free, so it's the wrong ship to prove "unaffordable" with.
    const session = createGameSession()
    expect(session.wallet.balance.eq(BigNumber.Zero)).toBe(true)
    expect(session.buyShip(1)).toBe(false)
  })

  it("ship 0's first purchase is free even with zero Stardust", () => {
    const session = createGameSession()
    expect(session.wallet.balance.eq(BigNumber.Zero)).toBe(true)
    expect(session.buyShip(0)).toBe(true)
    expect(session.wallet.balance.eq(BigNumber.Zero)).toBe(true) // still nothing charged
  })

  it('buying a ship deducts the exact next cost', () => {
    // Ship 1, not 0 - ship 0's very first purchase is intentionally free (the tutorial teaches
    // it before a new player has necessarily earned anything, see ShipService.nextIsFree), so
    // it can't exercise the "deducts exactly nextCost" invariant this test is actually after.
    const session = createGameSession()
    const cost = session.ships.nextCost(1)
    session.wallet.add(cost)
    expect(session.buyShip(1)).toBe(true)
    expect(session.wallet.balance.eq(BigNumber.Zero)).toBe(true)
    expect(session.ships.levelOf(1)).toBe(1)
  })

  it('prestige is locked before the unlock stage and grants no relics', () => {
    const session = createGameSession()
    expect(session.canPrestige()).toBe(false)
    expect(session.doPrestige().eq(BigNumber.Zero)).toBe(true)
  })

  it('save/restore round-trips currency, stage, and ship levels', () => {
    const session = createGameSession()
    session.wallet.add(new BigNumber(1234))
    session.buyShip(0)
    const saved = captureSave(session)

    const restored = createGameSession()
    applySave(restored, saved)

    expect(restored.wallet.balance.isClose(session.wallet.balance)).toBe(true)
    expect(restored.ships.levelOf(0)).toBe(session.ships.levelOf(0))
    expect(restored.stage.currentStage).toBe(session.stage.currentStage)
  })

  it('save/restore round-trips talent and artifact levels too', () => {
    const session = createGameSession()
    session.talents.grantXp(1_000_000)
    const tapNode = findTalentIndex(session, 'cannon-pulse-amplifier')
    session.buyTalentNode(tapNode)
    session.prestige.relics.add(new BigNumber(1_000_000))
    const kineticLens = findArtifactIndex(session, 'Kinetic Lens')
    session.buyArtifact(kineticLens)

    const saved = captureSave(session)
    const restored = createGameSession()
    applySave(restored, saved)

    expect(restored.talents.level).toBe(session.talents.level)
    expect(restored.talents.levelOf(tapNode)).toBe(session.talents.levelOf(tapNode))
    expect(restored.talents.unspentPoints).toBe(session.talents.unspentPoints)
    expect(restored.artifacts.levelOf(kineticLens)).toBe(session.artifacts.levelOf(kineticLens))
  })
})

/** Locates a talent node by its stable id (see TalentDefinition.ts's own doc on why ids, not
 *  array position, are the thing that must never change). */
function findTalentIndex(s: ReturnType<typeof createGameSession>, id: string): number {
  for (let i = 0; i < s.talents.count; i++) if (s.talents.def(i).id === id) return i
  throw new Error(`talent node not found: ${id}`)
}
function findArtifactIndex(s: ReturnType<typeof createGameSession>, displayName: string): number {
  for (let i = 0; i < s.artifacts.count; i++) if (s.artifacts.def(i).displayName === displayName) return i
  throw new Error(`artifact not found: ${displayName}`)
}

// Regression coverage for a real player report: "talents don't seem to make me stronger" / "make
// sure prestige upgrades (Artifacts) definitely work." Audited every TalentEffect from
// TalentDefinition.ts through TalentService's aggregation, GameSession's consumption of each
// multiplier, and SaveBinder's persistence - found the wiring already correct (this codebase's
// own history shows several PRIOR "found a dead hook, wired it" fixes already landed: Core
// Engine's cooldownReduction, TapCritDamage/ShipCritDamage's hardcoded-2x replacements,
// UpgradeCostReduction, BossTimerBonus, offlineRewardMultiplier). These tests lock that in with
// real END-TO-END proof through GameSession (not just unit-testing TalentService/ArtifactService
// in isolation, which TalentService.test.ts/ArtifactDefinition already do well) - buying a node
// must measurably change actual tap damage / fleet DPS / gold, the exact things a player feels.
describe('GameSession: talent nodes and prestige-upgrade Artifacts measurably apply (not just store a level)', () => {
  it('buying a TapDamage talent node increases the raw damage a real tap() deals', () => {
    const session = createGameSession()
    session.begin()
    const before = tapDamageDealt(session)

    session.talents.grantXp(1_000_000)
    expect(session.talents.unspentPoints).toBeGreaterThan(0)
    expect(session.buyTalentNode(findTalentIndex(session, 'cannon-pulse-amplifier'))).toBe(true)

    const after = tapDamageDealt(session)
    expect(after).toBeGreaterThan(before)
  })

  it('buying a Dps talent node increases real idle fleet damage from ships.tick via session.tick', () => {
    const session = createGameSession()
    session.begin()
    session.buyShip(0) // ship 0's first purchase is free
    const before = idleDamageOverOneSecond(session)

    session.talents.grantXp(1_000_000)
    expect(session.buyTalentNode(findTalentIndex(session, 'fleet-autonomous-turrets'))).toBe(true)

    const after = idleDamageOverOneSecond(session)
    expect(after).toBeGreaterThan(before)
  })

  it('buying a Gold talent node increases the actual Stardust awarded for a kill', () => {
    // handleKill floors the FIRST-EVER kill's gold to at least tapUpgradeBaseCost (the tutorial
    // guarantee - see its own comment), and tops up every kill before ship 0 is owned toward the
    // first ship's cost - both floors would clamp a small talent bonus to the same value on
    // either run and hide it. Buy ship 0 (free) up front and measure the SECOND kill, past both
    // floors, to see the real, un-clamped multiplier.
    const fresh = () => {
      const s = createGameSession()
      s.begin()
      s.buyShip(0)
      return s
    }
    const goldFromSecondKill = (s: ReturnType<typeof createGameSession>) => {
      let kills = 0
      let secondKillGold = 0
      s.onReward.on((e) => {
        kills++
        if (kills === 2) secondKillGold = e.gold.toNumber()
      })
      for (let i = 0; i < 400_000 && kills < 2; i++) s.tap()
      return secondKillGold
    }

    const baseline = goldFromSecondKill(fresh())

    const boosted = fresh()
    boosted.talents.grantXp(1_000_000)
    expect(boosted.buyTalentNode(findTalentIndex(boosted, 'salvage-salvage-lasers'))).toBe(true)
    const boostedGold = goldFromSecondKill(boosted)

    expect(boostedGold).toBeGreaterThan(baseline)
  })

  it('buying a RelicGain talent node increases the previewed Stellar Ascension relic payout', () => {
    const session = createGameSession()
    // relicsForStage returns 0 below relicStartStage - climb past it first.
    for (let i = 0; i < 20; i++) session.stage.goToStage(session.stage.currentStage + 1)
    const before = session.previewRelics().toNumber()
    expect(before).toBeGreaterThan(0) // sanity: the baseline itself must be nonzero to prove a real increase

    session.talents.grantXp(1_000_000)
    expect(session.buyTalentNode(findTalentIndex(session, 'warp-warp-navigation'))).toBe(true)

    const after = session.previewRelics().toNumber()
    expect(after).toBeGreaterThan(before)
  })

  it('buying Kinetic Lens (a prestige-purchased Artifact) increases raw tap damage, same as a talent would', () => {
    const session = createGameSession()
    session.begin()
    const before = tapDamageDealt(session)

    session.prestige.relics.add(new BigNumber(1_000_000))
    expect(session.buyArtifact(findArtifactIndex(session, 'Kinetic Lens'))).toBe(true)

    const after = tapDamageDealt(session)
    expect(after).toBeGreaterThan(before)
  })

  it('buying Singularity Core (a prestige-purchased Artifact) increases real idle fleet damage', () => {
    const session = createGameSession()
    session.begin()
    session.buyShip(0)
    const before = idleDamageOverOneSecond(session)

    session.prestige.relics.add(new BigNumber(1_000_000))
    expect(session.buyArtifact(findArtifactIndex(session, 'Singularity Core'))).toBe(true)

    const after = idleDamageOverOneSecond(session)
    expect(after).toBeGreaterThan(before)
  })
})

/** One deterministic tap's damage (no crit talents/artifacts bought in these tests, so
 *  Math.random() < 0 is always false - no flakiness). */
function tapDamageDealt(s: ReturnType<typeof createGameSession>): number {
  let dmg = 0
  const off = s.taps.onDamageDealt.on((e) => (dmg = e.amount.toNumber()))
  s.tap()
  off()
  return dmg
}
/** Total ship-tick damage dealt over one simulated second - long enough for every owned ship's
 *  cooldown (fastest is 0.5s) to fire at least once. */
function idleDamageOverOneSecond(s: ReturnType<typeof createGameSession>): number {
  return s.tick(1).toNumber()
}
