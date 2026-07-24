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

  /** Permanent hours added to BalanceConfig.offlineCapHours by the one-time offline cap shop
   *  purchase. Optional: absent on saves from before that item existed (defaults to 0). */
  offlineCapBonusHours?: number

  /** Unix seconds the VIP pass's passive Stardust bonus expires, 0/absent if never bought. */
  vipExpiresUnixSeconds?: number

  /** Ids of first-time-player tutorial steps already shown/dismissed (see useTutorial.ts).
   *  Absent entirely distinguishes "never initialized" (a save from before this feature, or a
   *  genuinely brand-new one) from "initialized but empty" ([]) - useTutorial tells those apart
   *  to retroactively skip the whole sequence for players who already have progress. */
  tutorialSeen?: string[]
}
