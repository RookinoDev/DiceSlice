import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { offlineCappedSeconds, offlineEarningsFromConfig } from './OfflineEarnings'

describe('offline cap bonus (offline_cap_boost shop item)', () => {
  const cfg = defaultBalanceConfig // offlineCapHours: 8, offlineRate: 0.5
  const income = new BigNumber(10)
  const HOUR = 3600

  it('caps at offlineCapHours when no bonus is applied (default param)', () => {
    const elapsed = 20 * HOUR // well past the 8h cap
    const earned = offlineEarningsFromConfig(0, elapsed, income, cfg)
    expect(earned.toNumber()).toBeCloseTo(10 * (8 * HOUR) * cfg.offlineRate, 3)
  })

  it('extends the cap by bonusHours', () => {
    const elapsed = 40 * HOUR // past both the un-boosted (8h) and boosted (24h) cap
    const earned = offlineEarningsFromConfig(0, elapsed, income, cfg, 16) // 8h -> 24h
    expect(earned.toNumber()).toBeCloseTo(10 * (24 * HOUR) * cfg.offlineRate, 3)
  })

  it('still respects real elapsed time even with a bonus (never pays for time not away)', () => {
    const elapsed = 5 * HOUR // short absence, well under even the un-boosted 8h cap
    const earned = offlineEarningsFromConfig(0, elapsed, income, cfg, 16)
    expect(earned.toNumber()).toBeCloseTo(10 * (5 * HOUR) * cfg.offlineRate, 3)
  })

  it('offlineCappedSeconds is the raw building block both branches share', () => {
    expect(offlineCappedSeconds(0, 5 * HOUR, 8 * HOUR)).toBe(5 * HOUR)
    expect(offlineCappedSeconds(0, 20 * HOUR, 8 * HOUR)).toBe(8 * HOUR)
    expect(offlineCappedSeconds(0, 20 * HOUR, 24 * HOUR)).toBe(20 * HOUR)
  })
})
