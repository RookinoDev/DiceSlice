import { describe, expect, it } from 'vitest'
import { upgradeCostShip } from './ShipCombat'

const BASE = 50
const GROWTH = 1.075
const BREAKPOINT_LEVEL = 50
const BREAKPOINT_GROWTH = 1.25

function cost(level: number): number {
  return upgradeCostShip(level, BASE, GROWTH, BREAKPOINT_LEVEL, BREAKPOINT_GROWTH).toNumber()
}

describe('upgradeCostShip', () => {
  it('the first purchase (level 1) always costs exactly baseCost, breakpoint or not', () => {
    expect(cost(1)).toBe(BASE)
  })

  it('below the breakpoint, matches plain exponential growth exactly (early/mid game unchanged)', () => {
    for (const level of [2, 5, 10, 25, BREAKPOINT_LEVEL]) {
      expect(cost(level)).toBeCloseTo(BASE * Math.pow(GROWTH, level - 1), 6)
    }
  })

  it('is continuous at the breakpoint - no sudden price jump, just a change in slope', () => {
    const atBreakpoint = cost(BREAKPOINT_LEVEL)
    const oneMore = cost(BREAKPOINT_LEVEL + 1)
    // The single step across the boundary costs the steeper rate, not a discontinuous multiple.
    expect(oneMore / atBreakpoint).toBeCloseTo(BREAKPOINT_GROWTH, 6)
  })

  it('past the breakpoint, grows at breakpointGrowth per level, far steeper than the base rate', () => {
    const step = cost(BREAKPOINT_LEVEL + 11) / cost(BREAKPOINT_LEVEL + 10)
    expect(step).toBeCloseTo(BREAKPOINT_GROWTH, 6)
  })

  it('reaching level 100 costs dramatically more than a flat continuation of the original curve would', () => {
    const withBreakpoint = cost(100)
    const flatContinuation = BASE * Math.pow(GROWTH, 99)
    expect(withBreakpoint).toBeGreaterThan(flatContinuation * 1000) // the whole point of the fix
  })
})
