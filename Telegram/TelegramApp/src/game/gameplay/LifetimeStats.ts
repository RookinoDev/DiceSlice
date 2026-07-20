/**
 * Lifetime counters that survive prestige - the raw material of the player Profile
 * (and later, achievement/trophy checks). Persisted as SaveState.stats; mostly purely
 * additive display instrumentation, EXCEPT deepestBossCleared (see its own comment below),
 * which the server's card-pack grant reads directly.
 */
export interface LifetimeStats {
  planetsDestroyed: number
  bossesDefeated: number
  /** Stellar Ascensions performed */
  prestigeCount: number
  /** highest sector ever reached across all runs (highestStage resets on prestige) */
  deepestStage: number
  /** Highest boss STAGE NUMBER ever actually cleared (not just reached/attempted) across all
   *  runs - like deepestStage, a lifetime high-water mark that survives prestige and never
   *  decreases, but updates only on stage.onBossCleared (a genuine win), not on merely
   *  entering or failing a boss fight. Since realPlanetForStage() maps a stage number to a
   *  boss deterministically, replaying the same early stage via a post-prestige run doesn't
   *  raise this number - which is exactly what TelegramBot/db.mjs's grantPacksFromSave keys
   *  the "one card pack per boss, ever" rule off: floor(deepestBossCleared / bossStageInterval)
   *  is the count of DISTINCT bosses ever cleared, immune to prestige-farming the same ones
   *  over and over. */
  deepestBossCleared: number
  firstPlayedUnixSeconds: number
}

export function newLifetimeStats(nowUnixSeconds: number): LifetimeStats {
  return { planetsDestroyed: 0, bossesDefeated: 0, prestigeCount: 0, deepestStage: 1, deepestBossCleared: 0, firstPlayedUnixSeconds: nowUnixSeconds }
}
