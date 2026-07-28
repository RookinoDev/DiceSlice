import { describe, expect, it } from 'vitest'
import { createGameSession } from '../createGameSession'
import { buildMainViewModel } from './MainPresenter'

describe('showFleet', () => {
  it('is false before any planet has been destroyed and no ship is owned', () => {
    const session = createGameSession()
    expect(buildMainViewModel(session).showFleet).toBe(false)
  })

  it('turns on after the first kill (the reward floor guarantees the ship is affordable then)', () => {
    const session = createGameSession()
    session.begin()
    let kills = 0
    session.onReward.on(() => kills++)
    for (let i = 0; i < 100_000 && kills === 0; i++) session.tap()

    expect(kills).toBeGreaterThan(0)
    expect(session.wallet.balance.gte(session.ships.nextCost(0))).toBe(true)
    expect(buildMainViewModel(session).showFleet).toBe(true)
  })

  it('stays on even after spending below the ship cost - it must not flicker away before the player reaches the Fleet tab', () => {
    const session = createGameSession()
    session.begin()
    let kills = 0
    session.onReward.on(() => kills++)
    for (let i = 0; i < 100_000 && kills === 0; i++) session.tap()
    expect(buildMainViewModel(session).showFleet).toBe(true)

    // Spend the kill's reward on something else (the tap-upgrade tutorial step's own action) -
    // the wallet now sits below the ship's cost again.
    expect(session.upgradeTapDamage()).toBe(true)
    expect(session.wallet.balance.lt(session.ships.nextCost(0))).toBe(true)
    expect(buildMainViewModel(session).showFleet).toBe(true)
  })
})
