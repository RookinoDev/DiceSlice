// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/DailyRewardTable.cs
// Sprint 5 (fix-plan-2026-07-14.docx, item #11): extended from a 7-day loop to a 30-day one.
// Days 1-7 keep their original values so returning players see no change to what they already
// know; days 8-30 continue the same escalating/reset-per-week shape. Table + relic/pack days
// approved by the user via the Sprint 5 proposal artifact.
import { BigNumber } from '../core/BigNumber'
import type { BalanceConfig } from '../config/BalanceConfig'
import type { PackType } from '../cards/cardsApi'

export const CYCLE_LENGTH = 30

/** 1..CYCLE_LENGTH, looping after the last day (streak CYCLE_LENGTH+1 = day 1 again). */
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
  return cfg.dailyRelicDays.includes(dayInCycle(streak))
}

/** Card pack tier granted on this day-in-cycle, if any. Client-side preview only - the actual
 * grant is server-authoritative (see TelegramBot's daily_pack_claims), same trust boundary as
 * boss-kill packs. */
export function dailyGrantsPack(streak: number, cfg: BalanceConfig): PackType | null {
  return cfg.dailyPackDays[dayInCycle(streak)] ?? null
}
