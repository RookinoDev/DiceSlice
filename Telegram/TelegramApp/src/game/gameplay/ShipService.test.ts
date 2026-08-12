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

describe('ShipService: late-game cost curve (see BalanceConfig.shipCostBreakpointLevel)', () => {
  it('nextCost matches plain exponential growth well below the breakpoint - early game unaffected', () => {
    const s = createGameSession()
    const before = s.ships.nextCost(0).toNumber()
    s.ships.buyOrUpgrade(0, s.wallet) // free first purchase, level 0 -> 1
    // Level 2's cost should be exactly baseCost * shipCostPerLevel (1.075) - the original curve,
    // since level 2 is nowhere near the level-50 breakpoint.
    expect(s.ships.nextCost(0).toNumber()).toBeCloseTo(before * 1.075, 6)
  })

  it("reaching a high level on one ship costs dramatically more than the pre-fix curve would have - the reported 'one ship carries the whole game' scenario", () => {
    const s = createGameSession()
    let total = 0
    for (let i = 0; i < 99; i++) {
      const cost = s.ships.nextCost(0)
      total += cost.toNumber()
      s.wallet.add(cost) // grant exactly enough, then buy
      s.ships.buyOrUpgrade(0, s.wallet)
    }
    // Levels 1-49 alone (all still the unchanged original rate) already cost real Stardust; the
    // total cost to reach level 100 must vastly exceed what the flat 1.075x/level curve alone
    // would have cost, proving the breakpoint is actually doing its job end-to-end through the
    // real ShipService/BalanceConfig wiring, not just the pure ShipCombat.ts formula in isolation.
    const flatContinuationOnly = 50 * (Math.pow(1.075, 99) - 1) / (1.075 - 1)
    expect(total).toBeGreaterThan(flatContinuationOnly * 100)
  })
})
