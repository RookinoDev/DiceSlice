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
})
