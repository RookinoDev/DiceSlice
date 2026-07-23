import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
import { MonetizationBoosts } from './MonetizationBoosts'

const nowSeconds = () => Math.floor(Date.now() / 1000)

describe('MonetizationBoosts (vip_pass_30d + offline_cap_boost)', () => {
  it('gives no Stardust bonus before any VIP purchase', () => {
    const boosts = new MonetizationBoosts()
    expect(boosts.vipGoldMultiplier().eq(BigNumber.One)).toBe(true)
  })

  it('applies the VIP multiplier while vipExpiresUnixSeconds is in the future', () => {
    const boosts = new MonetizationBoosts()
    boosts.vipExpiresUnixSeconds = nowSeconds() + 100
    expect(boosts.vipGoldMultiplier().gt(BigNumber.One)).toBe(true)
  })

  it('stops applying the multiplier once vipExpiresUnixSeconds is in the past', () => {
    const boosts = new MonetizationBoosts()
    boosts.vipExpiresUnixSeconds = nowSeconds() - 100
    expect(boosts.vipGoldMultiplier().eq(BigNumber.One)).toBe(true)
  })

  it('offlineCapBonusHours defaults to 0 and is a plain additive field', () => {
    const boosts = new MonetizationBoosts()
    expect(boosts.offlineCapBonusHours).toBe(0)
    boosts.offlineCapBonusHours += 16
    expect(boosts.offlineCapBonusHours).toBe(16)
  })
})
