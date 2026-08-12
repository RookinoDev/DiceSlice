import { describe, expect, it } from 'vitest'
import { cardLevelForCount, copiesForNextCardLevel } from './cardLevel'

describe('cardLevelForCount', () => {
  it('the first copy is level 1, zero copies is level 0', () => {
    expect(cardLevelForCount(0)).toBe(0)
    expect(cardLevelForCount(1)).toBe(1)
  })

  it('levels up on doubling thresholds: 2, 4, 8, 16', () => {
    expect(cardLevelForCount(2)).toBe(2)
    expect(cardLevelForCount(3)).toBe(2)
    expect(cardLevelForCount(4)).toBe(3)
    expect(cardLevelForCount(7)).toBe(3)
    expect(cardLevelForCount(8)).toBe(4)
    expect(cardLevelForCount(14)).toBe(4) // the real player report: 14 copies of Earth
    expect(cardLevelForCount(16)).toBe(5)
  })

  it('never decreases as count grows (monotonic)', () => {
    let prevLevel = 0
    for (let count = 0; count <= 200; count++) {
      const level = cardLevelForCount(count)
      expect(level).toBeGreaterThanOrEqual(prevLevel)
      prevLevel = level
    }
  })
})

describe('copiesForNextCardLevel', () => {
  it('matches the doubling thresholds cardLevelForCount uses', () => {
    expect(copiesForNextCardLevel(1)).toBe(2)
    expect(copiesForNextCardLevel(3)).toBe(4)
    expect(copiesForNextCardLevel(14)).toBe(16)
  })
})
