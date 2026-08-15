import { describe, expect, it } from 'vitest'
import { createGameSession } from '../createGameSession'

describe('TapDamageUpgrade: first upgrade is free', () => {
  it('the very first upgrade succeeds with zero Stardust', () => {
    const s = createGameSession()
    expect(s.wallet.balance.toNumber()).toBe(0)
    expect(s.tapUpgrade.nextIsFree).toBe(true)
    expect(s.tapUpgrade.tryUpgrade(s.wallet)).toBe(true)
    expect(s.tapUpgrade.level).toBe(2)
    expect(s.wallet.balance.toNumber()).toBe(0) // nothing was charged
  })

  it('the second upgrade costs normally and is blocked without enough Stardust', () => {
    const s = createGameSession()
    s.tapUpgrade.tryUpgrade(s.wallet) // free first upgrade
    expect(s.tapUpgrade.nextIsFree).toBe(false)
    expect(s.tapUpgrade.tryUpgrade(s.wallet)).toBe(false) // still 0 Stardust, real cost now applies
    expect(s.tapUpgrade.level).toBe(2)
  })
})

describe("TapDamageUpgrade: setCostMultiplier (Galactic Salvage's upgrade discount)", () => {
  it('discounts nextCost and clamps to a max 60% off, never free', () => {
    const s = createGameSession()
    s.tapUpgrade.tryUpgrade(s.wallet) // clear the free first upgrade so nextCost is a real price
    const fullCost = s.tapUpgrade.nextCost.toNumber()

    s.tapUpgrade.setCostMultiplier(0.25)
    expect(s.tapUpgrade.nextCost.toNumber()).toBeCloseTo(fullCost * 0.75, 6)

    s.tapUpgrade.setCostMultiplier(5) // way over 1 - must clamp, never free or negative
    expect(s.tapUpgrade.nextCost.toNumber()).toBeCloseTo(fullCost * 0.4, 6)
  })
})
