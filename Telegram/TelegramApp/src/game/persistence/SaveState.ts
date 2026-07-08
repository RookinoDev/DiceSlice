// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Persistence/SaveState.cs
import type { BigNumberData } from '../core/BigNumber'
import type { LifetimeStats } from '../gameplay/LifetimeStats'

/** Full serializable game state (BigNumbers stored as BigNumberData). */
export interface SaveState {
  version: number

  stardust: BigNumberData
  relics: BigNumberData
  /** premium currency (future monetization) */
  antimatter: BigNumberData

  tapLevel: number
  shipLevels: number[]
  artifactLevels: number[]

  missionProgress: BigNumberData[]
  missionClaimed: boolean[]

  currentStage: number
  highestStage: number

  lastSaveUnixSeconds: number
  lastDailyClaimUnixSeconds: number
  dailyStreak: number

  /** Lifetime profile counters. Optional: absent on pre-profile saves (still version 1). */
  stats?: LifetimeStats
}
