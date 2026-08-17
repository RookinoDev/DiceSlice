import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
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

describe('ShipService: upgrading one ship stays bounded vs. diversifying (round-2 balance fix)', () => {
  // Regression test for a real player report: even after the level-50 cost breakpoint (see the
  // block above), it was STILL dramatically more efficient to keep dumping Stardust into ship 1
  // than to buy or level any other ship - the breakpoint fired far too late (the runaway was
  // already >10,000,000x by level 50 under the old level-50/1.25x tuning). Fixed by pulling the
  // breakpoint to level 12 and raising its growth to 1.52x (just above shipDamagePerLevel's
  // 1.5x), so the marginal efficiency of continuing one ship plateaus instead of compounding
  // without bound. This test locks in "plateaus" as a real, checked upper bound rather than a
  // one-off simulation result that can silently regress.
  it('marginal DPS-per-Stardust of leveling ship 0 stays within a sane multiple of buying ship 1 fresh, even at very high levels', () => {
    const s = createGameSession()
    const ship1FreshEfficiency = s.ships.nextLevelDps(1).toNumber() / s.ships.nextCost(1).toNumber()

    for (let i = 0; i < 150; i++) {
      s.wallet.add(s.ships.nextCost(0))
      s.ships.buyOrUpgrade(0, s.wallet)
    }
    expect(s.ships.levelOf(0)).toBe(150)

    const dpsBefore = s.ships.shipDps(0).toNumber()
    const nextCost = s.ships.nextCost(0).toNumber()
    s.wallet.add(s.ships.nextCost(0))
    s.ships.buyOrUpgrade(0, s.wallet)
    const dpsAfter = s.ships.shipDps(0).toNumber()

    const ship0MarginalEfficiency = (dpsAfter - dpsBefore) / nextCost
    // Pre-fix, this ratio was in the hundreds of millions by level 150. Post-fix it oscillates
    // (shipMilestoneLevels bumps cause periodic spikes) but never runs away - 500x is a generous
    // ceiling that would already fail loudly under the old level-50/1.25x tuning.
    expect(ship0MarginalEfficiency / ship1FreshEfficiency).toBeLessThan(500)
  })
})

describe("ShipService: setCostMultiplier (Galactic Salvage's upgrade discount)", () => {
  it('discounts nextCost and clamps to a max 60% off, never free', () => {
    const s = createGameSession()
    s.ships.buyOrUpgrade(0, s.wallet) // clear the free first purchase so nextCost is a real price
    const fullCost = s.ships.nextCost(0).toNumber()

    s.ships.setCostMultiplier(0.25)
    expect(s.ships.nextCost(0).toNumber()).toBeCloseTo(fullCost * 0.75, 6)

    s.ships.setCostMultiplier(5) // way over 1 - must clamp, never free or negative
    expect(s.ships.nextCost(0).toNumber()).toBeCloseTo(fullCost * 0.4, 6)
  })
})

describe("ShipService: critDamageMultiplier (Autonomous Fleet's real identity)", () => {
  it('stacks on top of the flat SHIP_CRIT_DAMAGE_MULTIPLIER only on a crit hit', () => {
    const s = createGameSession()
    s.ships.buyOrUpgrade(0, s.wallet)
    // critChance=1 forces every hit to crit, deterministically comparing the exact same tick twice.
    const base = s.ships.tick(10, s.enemy, BigNumber.One, 1, BigNumber.One).toNumber()
    const boosted = s.ships.tick(10, s.enemy, BigNumber.One, 1, new BigNumber(2)).toNumber()
    expect(boosted).toBeCloseTo(base * 2, 6)
  })
})
