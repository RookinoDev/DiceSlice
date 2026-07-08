import { describe, expect, it } from 'vitest'
import type { SaveState } from './SaveState'
import { pickBetterSave, sanitizeSave } from './cloudSave'

function makeSave(overrides: Partial<SaveState> = {}): SaveState {
  return {
    version: 1,
    stardust: { mantissa: 1, exponent: 2 },
    relics: { mantissa: 0, exponent: 0 },
    antimatter: { mantissa: 0, exponent: 0 },
    tapLevel: 5,
    shipLevels: [1, 0, 0],
    artifactLevels: [0, 0],
    missionProgress: [],
    missionClaimed: [],
    currentStage: 10,
    highestStage: 12,
    lastSaveUnixSeconds: 1_000_000,
    lastDailyClaimUnixSeconds: 0,
    dailyStreak: 0,
    ...overrides,
  }
}

describe('pickBetterSave', () => {
  it('returns the other side when one is null', () => {
    const s = makeSave()
    expect(pickBetterSave(null, s)).toBe(s)
    expect(pickBetterSave(s, null)).toBe(s)
    expect(pickBetterSave(null, null)).toBeNull()
  })

  it('prefers more relics regardless of stage or recency', () => {
    const local = makeSave({ relics: { mantissa: 1, exponent: 1 }, highestStage: 200, lastSaveUnixSeconds: 9_999_999 })
    const cloud = makeSave({ relics: { mantissa: 5, exponent: 1 }, highestStage: 3, lastSaveUnixSeconds: 1 })
    expect(pickBetterSave(local, cloud)).toBe(cloud)
    expect(pickBetterSave(cloud, local)).toBe(cloud)
  })

  it('compares relics by magnitude, not mantissa (BigNumber semantics)', () => {
    const local = makeSave({ relics: { mantissa: 9, exponent: 0 } })
    const cloud = makeSave({ relics: { mantissa: 1, exponent: 2 } })
    expect(pickBetterSave(local, cloud)).toBe(cloud)
  })

  it('breaks relic ties by highest stage', () => {
    const local = makeSave({ highestStage: 30 })
    const cloud = makeSave({ highestStage: 80, lastSaveUnixSeconds: 1 })
    expect(pickBetterSave(local, cloud)).toBe(cloud)
    expect(pickBetterSave(cloud, local)).toBe(cloud)
  })

  it('breaks full ties by newer timestamp', () => {
    const local = makeSave({ lastSaveUnixSeconds: 100 })
    const cloud = makeSave({ lastSaveUnixSeconds: 200 })
    expect(pickBetterSave(local, cloud)).toBe(cloud)
  })

  it('keeps local on a perfect tie (never swap the running session for an identical copy)', () => {
    const local = makeSave()
    const cloud = makeSave()
    expect(pickBetterSave(local, cloud)).toBe(local)
  })
})

describe('sanitizeSave', () => {
  it('accepts a well-formed current-version save', () => {
    const s = makeSave()
    expect(sanitizeSave(s)).toBe(s)
  })

  it('rejects null, non-objects, and arrays', () => {
    expect(sanitizeSave(null)).toBeNull()
    expect(sanitizeSave('json')).toBeNull()
    expect(sanitizeSave(42)).toBeNull()
  })

  it('rejects unknown versions (future format must not be half-applied)', () => {
    expect(sanitizeSave(makeSave({ version: 2 }))).toBeNull()
    expect(sanitizeSave({ ...makeSave(), version: undefined })).toBeNull()
  })

  it('rejects malformed currency or level fields', () => {
    expect(sanitizeSave({ ...makeSave(), relics: { mantissa: 'x', exponent: 0 } })).toBeNull()
    expect(sanitizeSave({ ...makeSave(), stardust: null })).toBeNull()
    expect(sanitizeSave({ ...makeSave(), tapLevel: Infinity })).toBeNull()
    expect(sanitizeSave({ ...makeSave(), shipLevels: 'not-an-array' })).toBeNull()
  })
})
