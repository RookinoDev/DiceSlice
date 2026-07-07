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

  it('cannot afford a ship with zero Stardust', () => {
    const session = createGameSession()
    expect(session.wallet.balance.eq(BigNumber.Zero)).toBe(true)
    expect(session.buyShip(0)).toBe(false)
  })

  it('buying a ship deducts the exact next cost', () => {
    const session = createGameSession()
    const cost = session.ships.nextCost(0)
    session.wallet.add(cost)
    expect(session.buyShip(0)).toBe(true)
    expect(session.wallet.balance.eq(BigNumber.Zero)).toBe(true)
    expect(session.ships.levelOf(0)).toBe(1)
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
