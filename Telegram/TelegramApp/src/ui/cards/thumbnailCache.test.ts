import { describe, expect, it } from 'vitest'
import { pickEvictions } from './thumbnailCache'

describe('pickEvictions', () => {
  it('evicts nothing when the incoming write still fits under the cap', () => {
    const records = [{ key: 'a', size: 10, lastAccess: 1 }]
    expect(pickEvictions(records, 5, 10, 100)).toEqual([])
  })

  it('evicts oldest-lastAccess first, only as many as needed to fit', () => {
    const records = [
      { key: 'old', size: 40, lastAccess: 1 },
      { key: 'mid', size: 40, lastAccess: 2 },
      { key: 'new', size: 40, lastAccess: 3 },
    ]
    // currentTotal 120 + incoming 10 = 130, cap 100 -> must free at least 30
    expect(pickEvictions(records, 10, 120, 100)).toEqual(['old'])
  })

  it('evicts multiple records if one is not enough', () => {
    const records = [
      { key: 'old', size: 10, lastAccess: 1 },
      { key: 'mid', size: 10, lastAccess: 2 },
      { key: 'new', size: 10, lastAccess: 3 },
    ]
    // total 30 + incoming 25 = 55, cap 40 -> free at least 15 -> both old (10) and mid (10)
    expect(pickEvictions(records, 25, 30, 40)).toEqual(['old', 'mid'])
  })

  it('evicts everything if even that is not enough (incoming alone exceeds the cap)', () => {
    const records = [{ key: 'a', size: 5, lastAccess: 1 }]
    expect(pickEvictions(records, 1000, 5, 100)).toEqual(['a'])
  })
})
