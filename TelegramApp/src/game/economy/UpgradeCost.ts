// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/UpgradeCost.cs
import { BigNumber } from '../core/BigNumber'
import type { BalanceConfig } from '../config/BalanceConfig'

/**
 * Exponential, infinite upgrade cost: cost(level) = base * growth^(level-1),
 * where `level` is the CURRENT level (cost to go level -> level+1).
 */
export function upgradeCostExponential(currentLevel: number, baseCost: number, growth: number): BigNumber {
  const steps = currentLevel - 1
  if (steps <= 0) return new BigNumber(baseCost)
  return new BigNumber(baseCost).mul(new BigNumber(growth).pow(steps))
}

export function upgradeCostTapDamage(currentLevel: number, cfg: BalanceConfig): BigNumber {
  return upgradeCostExponential(currentLevel, cfg.tapUpgradeBaseCost, cfg.tapUpgradeCostGrowth)
}
