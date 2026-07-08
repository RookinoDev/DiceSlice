/**
 * Lifetime counters that survive prestige - the raw material of the player Profile
 * (and later, achievement/trophy checks). Persisted as SaveState.stats; purely
 * additive instrumentation, never read by gameplay or economy logic.
 */
export interface LifetimeStats {
  planetsDestroyed: number
  bossesDefeated: number
  /** Stellar Ascensions performed */
  prestigeCount: number
  /** highest sector ever reached across all runs (highestStage resets on prestige) */
  deepestStage: number
  firstPlayedUnixSeconds: number
}

export function newLifetimeStats(nowUnixSeconds: number): LifetimeStats {
  return { planetsDestroyed: 0, bossesDefeated: 0, prestigeCount: 0, deepestStage: 1, firstPlayedUnixSeconds: nowUnixSeconds }
}
