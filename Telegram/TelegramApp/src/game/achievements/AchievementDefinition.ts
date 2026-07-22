// Static catalog of milestone achievements. Display/recognition only - unlocking one grants
// no Stardust/Relics/power (unlike missions), so these thresholds are cosmetic judgment calls,
// not economy numbers.
export type AchievementCategory = 'planetsDestroyed' | 'bossesDefeated' | 'distinctBosses' | 'deepestStage' | 'prestigeCount' | 'cardsCollected' | 'dailyStreak'
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | null

export interface AchievementDefinition {
  id: string
  category: AchievementCategory
  tier: AchievementTier
  threshold: number
  name: string
  description: string
}

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  planetsDestroyed: 'PLANETS DESTROYED',
  bossesDefeated: 'BOSSES DEFEATED',
  distinctBosses: 'FRONTIER CLEARED',
  deepestStage: 'DEEPEST SECTOR',
  prestigeCount: 'STELLAR ASCENSIONS',
  cardsCollected: 'CARD COLLECTION',
  dailyStreak: 'DAILY STREAK',
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'planets-bronze', category: 'planetsDestroyed', tier: 'bronze', threshold: 100, name: 'Debris Field', description: 'Destroy 100 planets' },
  { id: 'planets-silver', category: 'planetsDestroyed', tier: 'silver', threshold: 1000, name: 'Planet Cracker', description: 'Destroy 1,000 planets' },
  { id: 'planets-gold', category: 'planetsDestroyed', tier: 'gold', threshold: 10000, name: 'World Ender', description: 'Destroy 10,000 planets' },
  { id: 'planets-platinum', category: 'planetsDestroyed', tier: 'platinum', threshold: 100000, name: 'Genesis Devourer', description: 'Destroy 100,000 planets' },

  { id: 'bosses-bronze', category: 'bossesDefeated', tier: 'bronze', threshold: 10, name: 'Boss Hunter', description: 'Defeat 10 bosses' },
  { id: 'bosses-silver', category: 'bossesDefeated', tier: 'silver', threshold: 50, name: 'Boss Slayer', description: 'Defeat 50 bosses' },
  { id: 'bosses-gold', category: 'bossesDefeated', tier: 'gold', threshold: 200, name: 'Boss Nemesis', description: 'Defeat 200 bosses' },

  { id: 'frontier-bronze', category: 'distinctBosses', tier: 'bronze', threshold: 5, name: 'Frontier Scout', description: 'Clear 5 distinct boss sectors, ever' },
  { id: 'frontier-silver', category: 'distinctBosses', tier: 'silver', threshold: 15, name: 'Frontier Breaker', description: 'Clear 15 distinct boss sectors, ever' },
  { id: 'frontier-gold', category: 'distinctBosses', tier: 'gold', threshold: 30, name: 'Frontier Legend', description: 'Clear 30 distinct boss sectors, ever' },

  { id: 'sector-bronze', category: 'deepestStage', tier: 'bronze', threshold: 25, name: 'Deep Space', description: 'Reach Sector 25' },
  { id: 'sector-silver', category: 'deepestStage', tier: 'silver', threshold: 100, name: 'Outer Rim', description: 'Reach Sector 100' },
  { id: 'sector-gold', category: 'deepestStage', tier: 'gold', threshold: 250, name: 'Edge of the Map', description: 'Reach Sector 250' },

  { id: 'ascension-bronze', category: 'prestigeCount', tier: 'bronze', threshold: 1, name: 'First Ascension', description: 'Prestige for the first time' },
  { id: 'ascension-silver', category: 'prestigeCount', tier: 'silver', threshold: 10, name: 'Reborn Ten Times', description: 'Prestige 10 times' },
  { id: 'ascension-gold', category: 'prestigeCount', tier: 'gold', threshold: 50, name: 'Stellar Veteran', description: 'Prestige 50 times' },

  { id: 'cards-bronze', category: 'cardsCollected', tier: 'bronze', threshold: 10, name: 'Curious Collector', description: 'Own 10 unique cards' },
  { id: 'cards-silver', category: 'cardsCollected', tier: 'silver', threshold: 50, name: 'Serious Collector', description: 'Own 50 unique cards' },
  { id: 'cards-gold', category: 'cardsCollected', tier: 'gold', threshold: 200, name: 'Master Archivist', description: 'Own 200 unique cards' },

  { id: 'streak-week', category: 'dailyStreak', tier: null, threshold: 7, name: 'Week One', description: 'Reach a 7-day login streak' },
]
