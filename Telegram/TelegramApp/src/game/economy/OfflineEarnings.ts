// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/OfflineEarnings.cs
import { BigNumber } from '../core/BigNumber'
import type { BalanceConfig } from '../config/BalanceConfig'

/** Offline reward from a timestamp delta: incomePerSecond * min(elapsed, cap) * rate. */
export function offlineCappedSeconds(lastUnix: number, nowUnix: number, capSeconds: number): number {
  const elapsed = Math.max(0, nowUnix - lastUnix)
  return Math.min(elapsed, capSeconds)
}

export function offlineEarningsFromConfig(
  lastUnix: number,
  nowUnix: number,
  incomePerSecond: BigNumber,
  cfg: BalanceConfig,
  /** Extra hours from the one-time offline cap shop purchase (see MonetizationBoosts). */
  bonusHours = 0,
): BigNumber {
  const cap = (cfg.offlineCapHours + bonusHours) * 3600
  const secs = offlineCappedSeconds(lastUnix, nowUnix, cap)
  return incomePerSecond.mul(new BigNumber(secs * cfg.offlineRate))
}
