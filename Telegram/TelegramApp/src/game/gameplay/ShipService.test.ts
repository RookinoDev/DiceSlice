import { describe, expect, it } from 'vitest'
import { createGameSession } from '../createGameSession'

describe('ShipService: first ship is free', () => {
  it("ship 0's very first purchase succeeds with zero Stardust", () => {
    const s = createGameSession()
    expect(s.wallet.balance.toNumber()).toBe(0)
    expect(s.ships.nextIsFree(0)).toBe(true)
    expect(s.ships.buyOrUpgrade(0, s.wallet)).toBe(true)
    expect(s.ships.isOwned(0)).toBe(true)
    expect(s.wallet.balance.toNumber()).toBe(0) // nothing was charged
  })

  it("ship 0's second level (an upgrade, not the first purchase) costs normally", () => {
    const s = createGameSession()
    s.ships.buyOrUpgrade(0, s.wallet) // free first purchase
    expect(s.ships.nextIsFree(0)).toBe(false)
    expect(s.ships.buyOrUpgrade(0, s.wallet)).toBe(false) // still 0 Stardust, real cost now applies
    expect(s.ships.levelOf(0)).toBe(1)
  })

  it('ship 1 (not the tutorial ship) never gets the free-first treatment', () => {
    const s = createGameSession()
    expect(s.ships.nextIsFree(1)).toBe(false)
    expect(s.ships.buyOrUpgrade(1, s.wallet)).toBe(false) // 0 Stardust, real cost blocks it
    expect(s.ships.isOwned(1)).toBe(false)
  })
})
