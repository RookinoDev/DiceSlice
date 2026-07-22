import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from './AchievementDefinition'
import { isUnlocked, progress01, valueFor, type AchievementInput } from './evaluateAchievements'

const ZERO_INPUT: AchievementInput = {
  planetsDestroyed: 0,
  bossesDefeated: 0,
  distinctBosses: 0,
  deepestStage: 1,
  prestigeCount: 0,
  uniqueCardsOwned: 0,
  dailyStreak: 0,
}

describe('achievement catalog', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every definition is locked one below its threshold and unlocked at it', () => {
    for (const def of ACHIEVEMENTS) {
      const input: AchievementInput = { ...ZERO_INPUT, [fieldOf(def.category)]: def.threshold - 1 }
      expect(isUnlocked(def, input), `${def.id} should be locked at threshold-1`).toBe(false)

      const atThreshold: AchievementInput = { ...ZERO_INPUT, [fieldOf(def.category)]: def.threshold }
      expect(isUnlocked(def, atThreshold), `${def.id} should unlock at its threshold`).toBe(true)
    }
  })

  it('progress01 is clamped to 0..1 and matches the unlock boundary', () => {
    const def = ACHIEVEMENTS[0]
    const over: AchievementInput = { ...ZERO_INPUT, [fieldOf(def.category)]: def.threshold * 5 }
    expect(progress01(def, over)).toBe(1)
    expect(progress01(def, ZERO_INPUT)).toBe(0)
  })

  it('valueFor reads the field matching each category', () => {
    const input: AchievementInput = { ...ZERO_INPUT, uniqueCardsOwned: 42 }
    const cardsDef = ACHIEVEMENTS.find((a) => a.category === 'cardsCollected')!
    expect(valueFor(cardsDef, input)).toBe(42)
  })
})

function fieldOf(category: (typeof ACHIEVEMENTS)[number]['category']): keyof AchievementInput {
  const map: Record<string, keyof AchievementInput> = {
    planetsDestroyed: 'planetsDestroyed',
    bossesDefeated: 'bossesDefeated',
    distinctBosses: 'distinctBosses',
    deepestStage: 'deepestStage',
    prestigeCount: 'prestigeCount',
    cardsCollected: 'uniqueCardsOwned',
    dailyStreak: 'dailyStreak',
  }
  return map[category]
}
