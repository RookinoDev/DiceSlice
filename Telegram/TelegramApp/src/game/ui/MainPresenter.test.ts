import { describe, expect, it } from 'vitest'
import { createGameSession } from '../createGameSession'
import { buildMainViewModel } from './MainPresenter'

describe('showFleet', () => {
  it('is false before any planet has been destroyed and no ship is owned', () => {
    const session = createGameSession()
    expect(buildMainViewModel(session).showFleet).toBe(false)
  })

  it('turns on after the first kill (the sticky planetsDestroyed flag, not a live affordability check)', () => {
    const session = createGameSession()
    session.begin()
    let kills = 0
    session.onReward.on(() => kills++)
    for (let i = 0; i < 100_000 && kills === 0; i++) session.tap()

    expect(kills).toBeGreaterThan(0)
    // The ship's full cost isn't guaranteed yet after just one kill (see GameSession's reward
    // floor, which deliberately reserves the first kill for the Tap Damage upgrade) - showFleet
    // still turns on regardless, since it's a "you've made real progress" signal, not a
    // "you can afford it right now" one.
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
    // the wallet may now sit below the ship's cost, but showFleet must not flicker away for it.
    session.upgradeTapDamage()
    expect(buildMainViewModel(session).showFleet).toBe(true)
  })
})
