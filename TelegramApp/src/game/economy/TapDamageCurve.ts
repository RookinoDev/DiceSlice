// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/TapDamageCurve.cs
import { BigNumber } from '../core/BigNumber'
import type { BalanceConfig } from '../config/BalanceConfig'

/**
 * Closed-form tap-damage curve. The per-level multiplier eases from `start`
 * (early) toward `end` (asymptotic):
 *
 *   ratio(L)  = end . (start/end)^(decay^(L-1))
 *   damage(L) = base . prod_{i=1..L-1} ratio(i)
 *             = base . end^(L-1) . (start/end)^( (1 - decay^(L-1)) / (1 - decay) )
 *
 * O(1), exact for arbitrarily large levels via BigNumber.
 */
export function tapDamageForLevel(level: number, baseDmg: number, start: number, end: number, decay: number): BigNumber {
  if (level <= 1) return new BigNumber(baseDmg)

  const n = level - 1
  const endPow = new BigNumber(end).pow(n)

  const g = (1 - Math.pow(decay, n)) / (1 - decay)
  const ratioPow = new BigNumber(start / end).pow(g)

  return new BigNumber(baseDmg).mul(endPow).mul(ratioPow)
}

export function tapDamageForLevelCfg(level: number, cfg: BalanceConfig): BigNumber {
  return tapDamageForLevel(level, cfg.tapDamageBase, cfg.tapGrowthStart, cfg.tapGrowthEnd, cfg.tapGrowthDecay)
}
