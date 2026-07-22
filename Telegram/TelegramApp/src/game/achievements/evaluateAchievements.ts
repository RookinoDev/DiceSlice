// Pure achievement-progress logic. Deliberately kept OUTSIDE game/gameplay/ and never imported
// by GameSession: uniqueCardsOwned needs the owned-card collection, which lives only in
// GameShell's React state (server-fetched) - GameSession never sees cards at all (see
// docs/CARD_SYSTEM_PLAN.md's "cards never in SaveState" rule). Keeping this module a sibling of
// gameplay/ rather than inside it makes that boundary structurally obvious: nothing here can
// accidentally get imported into the headless engine.
import type { GameSession } from '../gameplay/GameSession'
import type { OwnedCard } from '../cards/cardsApi'
import { summarizeCollection } from '../cards/collectionSummary'
import { ACHIEVEMENTS, type AchievementCategory, type AchievementDefinition } from './AchievementDefinition'

export interface AchievementInput {
  planetsDestroyed: number
  bossesDefeated: number
  /** Distinct boss sectors ever cleared (floor(deepestBossCleared / bossStageInterval)), not a
   *  raw kill count - see LifetimeStats.ts's deepestBossCleared comment. */
  distinctBosses: number
  deepestStage: number
  prestigeCount: number
  uniqueCardsOwned: number
  dailyStreak: number
}

export function buildAchievementInput(session: GameSession, ownedCards: OwnedCard[]): AchievementInput {
  return {
    planetsDestroyed: session.stats.planetsDestroyed,
    bossesDefeated: session.stats.bossesDefeated,
    distinctBosses: Math.floor(session.stats.deepestBossCleared / session.bossStageInterval),
    deepestStage: Math.max(session.stats.deepestStage, session.stage.highestStage),
    prestigeCount: session.stats.prestigeCount,
    uniqueCardsOwned: summarizeCollection(ownedCards).size,
    dailyStreak: session.daily.streak,
  }
}

const FIELD_FOR_CATEGORY: Record<AchievementCategory, keyof AchievementInput> = {
  planetsDestroyed: 'planetsDestroyed',
  bossesDefeated: 'bossesDefeated',
  distinctBosses: 'distinctBosses',
  deepestStage: 'deepestStage',
  prestigeCount: 'prestigeCount',
  cardsCollected: 'uniqueCardsOwned',
  dailyStreak: 'dailyStreak',
}

export function valueFor(def: AchievementDefinition, input: AchievementInput): number {
  return input[FIELD_FOR_CATEGORY[def.category]]
}

export function isUnlocked(def: AchievementDefinition, input: AchievementInput): boolean {
  return valueFor(def, input) >= def.threshold
}

/** 0..1, clamped - for progress bars (same shape as MissionService.progress01). */
export function progress01(def: AchievementDefinition, input: AchievementInput): number {
  const frac = valueFor(def, input) / Math.max(1e-9, def.threshold)
  return Math.min(1, Math.max(0, frac))
}

export { ACHIEVEMENTS }
