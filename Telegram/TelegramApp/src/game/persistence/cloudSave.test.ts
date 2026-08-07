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

  describe('lifetime stats (real bug: relics/highestStage are not reliable progress signals)', () => {
    // Regression test for a real player report: hundreds of Stellar Ascensions in, they spent
    // relics on an Artifact (a completely normal action) and prestiged since their last cloud
    // sync. A stale cloud copy from before either of those - fewer prestiges, an unspent relics
    // balance that's now numerically HIGHER than local's post-spend balance, and a higher
    // highestStage from deep in that older run before it reset - used to win purely on relics,
    // silently rolling back everything (talent level, stage, relics) to that old snapshot.
    it('never rolls back to a stale cloud copy just because it has more UNSPENT relics', () => {
      const local = makeSave({
        relics: { mantissa: 3.6429, exponent: 2 }, // 364.29 - just spent a batch on an Artifact
        highestStage: 5, // just prestiged, current run has barely started
        talentLevel: 211,
        stats: { planetsDestroyed: 500_000, bossesDefeated: 12_000, prestigeCount: 269, deepestStage: 2230, deepestBossCleared: 2230, firstPlayedUnixSeconds: 1 },
      })
      const cloud = makeSave({
        relics: { mantissa: 2, exponent: 2 }, // 200 - stale, hadn't spent yet
        highestStage: 1800, // stale, from deep in a PREVIOUS run before it reset on prestige
        talentLevel: 118,
        stats: { planetsDestroyed: 240_000, bossesDefeated: 6_000, prestigeCount: 130, deepestStage: 1800, deepestBossCleared: 1800, firstPlayedUnixSeconds: 1 },
        lastSaveUnixSeconds: 999_999_999, // even "newer" by timestamp must not matter here
      })
      expect(pickBetterSave(local, cloud)).toBe(local)
    })

    it('still restores from the cloud when it genuinely has more lifetime progress (new device)', () => {
      const local = makeSave({
        relics: { mantissa: 5, exponent: 2 },
        talentLevel: 50,
        stats: { planetsDestroyed: 10_000, bossesDefeated: 200, prestigeCount: 5, deepestStage: 300, deepestBossCleared: 300, firstPlayedUnixSeconds: 1 },
      })
      const cloud = makeSave({
        relics: { mantissa: 1, exponent: 1 }, // fewer unspent relics, but genuinely more progress
        talentLevel: 80,
        stats: { planetsDestroyed: 40_000, bossesDefeated: 900, prestigeCount: 20, deepestStage: 900, deepestBossCleared: 900, firstPlayedUnixSeconds: 1 },
      })
      expect(pickBetterSave(local, cloud)).toBe(cloud)
    })

    it('falls back to talent level, then relics/highestStage/timestamp when prestigeCount and deepestStage tie', () => {
      const statsBase = { planetsDestroyed: 1, bossesDefeated: 1, prestigeCount: 10, deepestStage: 500, deepestBossCleared: 500, firstPlayedUnixSeconds: 1 }
      const local = makeSave({ talentLevel: 20, stats: statsBase })
      const cloud = makeSave({ talentLevel: 25, stats: statsBase })
      expect(pickBetterSave(local, cloud)).toBe(cloud)
    })

    it('legacy saves without stats (pre-profile-feature) still fall back to the old relics-first comparison', () => {
      const local = makeSave({ relics: { mantissa: 1, exponent: 1 } }) // no stats field
      const cloud = makeSave({ relics: { mantissa: 5, exponent: 1 } }) // no stats field
      expect(pickBetterSave(local, cloud)).toBe(cloud)
    })
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
