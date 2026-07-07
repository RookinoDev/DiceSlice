// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/DailyRewardTable.cs
import { BigNumber } from '../core/BigNumber'
import type { BalanceConfig } from '../config/BalanceConfig'

export const CYCLE_LENGTH = 7

/** 1..7, looping after day 7 (streak 8 = day 1 again, etc). */
export function dayInCycle(streak: number): number {
  return ((Math.max(1, streak) - 1) % CYCLE_LENGTH) + 1
}

export function dailyGoldFor(streak: number, oneKillGold: BigNumber, cfg: BalanceConfig): BigNumber {
  const day = dayInCycle(streak)
  const table = cfg.dailyGoldKillMultiples
  const mult = table && table.length >= day ? table[day - 1] : 2 + day
  return oneKillGold.mul(new BigNumber(mult))
}

export function dailyGrantsRelic(streak: number, cfg: BalanceConfig): boolean {
  return dayInCycle(streak) === cfg.dailyRelicDay
}
