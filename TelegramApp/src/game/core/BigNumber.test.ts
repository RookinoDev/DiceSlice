import { describe, expect, it } from 'vitest'
import { BigNumber } from './BigNumber'

describe('BigNumber', () => {
  it('normalizes mantissa/exponent on construction', () => {
    const b = new BigNumber(12345)
    expect(b.mantissa).toBeCloseTo(1.2345, 9)
    expect(b.exponent).toBe(4)
  })

  it('adds across matching and differing exponents', () => {
    expect(new BigNumber(500).add(new BigNumber(500)).toNumber()).toBeCloseTo(1000, 6)
    // exponent diff of 10 (<=16) is significant and must be added exactly.
    expect(new BigNumber(1e10).add(new BigNumber(1)).toNumber()).toBeCloseTo(10_000_000_001, 6)
    // exponent diff > 16 is treated as negligible and dropped.
    expect(new BigNumber(1e20).add(new BigNumber(1)).toNumber()).toBeCloseTo(1e20, 0)
  })

  it('multiplies and divides', () => {
    expect(new BigNumber(2e3).mul(new BigNumber(3e3)).toNumber()).toBeCloseTo(6e6, 0)
    expect(new BigNumber(1e6).div(new BigNumber(1e3)).toNumber()).toBeCloseTo(1e3, 6)
  })

  it('raises to a power exactly like Math.pow for representable ranges', () => {
    expect(new BigNumber(1.15).pow(10).toNumber()).toBeCloseTo(Math.pow(1.15, 10), 6)
  })

  it('compares magnitudes correctly regardless of sign', () => {
    expect(new BigNumber(5).lt(new BigNumber(10))).toBe(true)
    expect(new BigNumber(-10).lt(new BigNumber(-5))).toBe(true)
    expect(new BigNumber(-5).lt(new BigNumber(5))).toBe(true)
  })

  it('formats short strings with Tap-Titans-style suffixes', () => {
    expect(new BigNumber(999).toShortString()).toBe('999')
    expect(new BigNumber(1_500).toShortString()).toBe('1.50K')
    expect(new BigNumber(2_500_000).toShortString()).toBe('2.50M')
    expect(new BigNumber(0).toShortString()).toBe('0')
  })

  it('handles the aa/ab suffix cycle past T', () => {
    // group 5 = 10^15 -> "aa"
    expect(new BigNumber(1e15).toShortString().endsWith('aa')).toBe(true)
  })
})
