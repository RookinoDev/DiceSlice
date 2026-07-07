// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/OfflineIncome.cs
import { BigNumber } from '../core/BigNumber'

/**
 * Estimates Stardust earned per second from idle combat:
 *   kills/sec ~ fleetDPS / enemyHP ;  income/sec = kills/sec * goldPerKill.
 * Returns 0 if there is no passive DPS (idle needs ships).
 */
export function offlineIncomePerSecond(fleetDps: BigNumber, enemyHp: BigNumber, goldPerKill: BigNumber): BigNumber {
  if (fleetDps.lte(BigNumber.Zero) || enemyHp.lte(BigNumber.Zero)) return BigNumber.Zero
  return fleetDps.div(enemyHp).mul(goldPerKill)
}
