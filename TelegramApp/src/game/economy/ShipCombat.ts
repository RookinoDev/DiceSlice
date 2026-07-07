// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/ShipCombat.cs
import { BigNumber } from '../core/BigNumber'

/**
 * Cooldown-based ship combat math.
 *   HitDamage(level) = baseHit * 1.27^(level-1) * MilestoneMultiplier(level)
 *   Cooldown(level)  = max(min, baseCd * factor^(breakpoints passed))
 *   EffectiveDPS     = HitDamage / Cooldown
 */
export function milestoneMultiplier(level: number, levels: number[], multipliers: number[]): BigNumber {
  let m = BigNumber.One
  if (!levels || !multipliers) return m
  const n = Math.min(levels.length, multipliers.length)
  for (let i = 0; i < n; i++) {
    if (level >= levels[i]) m = m.mul(new BigNumber(multipliers[i]))
  }
  return m
}

export function breakpointsPassed(level: number, breakpoints: number[]): number {
  if (!breakpoints) return 0
  let c = 0
  for (const bp of breakpoints) if (level >= bp) c++
  return c
}

export function shipCooldown(level: number, baseCd: number, breakpoints: number[], factor: number, min: number): number {
  if (level <= 0) return baseCd
  const cd = baseCd * Math.pow(factor, breakpointsPassed(level, breakpoints))
  return cd < min ? min : cd
}

export function shipHitDamage(
  level: number,
  baseHit: number,
  damagePerLevel: number,
  milestoneLevels: number[],
  milestoneMults: number[],
): BigNumber {
  if (level <= 0) return BigNumber.Zero
  const dmg = new BigNumber(baseHit).mul(new BigNumber(damagePerLevel).pow(level - 1))
  return dmg.mul(milestoneMultiplier(level, milestoneLevels, milestoneMults))
}

export function shipEffectiveDps(
  level: number,
  baseHit: number,
  baseCd: number,
  damagePerLevel: number,
  breakpoints: number[],
  factor: number,
  min: number,
  milestoneLevels: number[],
  milestoneMults: number[],
): BigNumber {
  if (level <= 0) return BigNumber.Zero
  const hit = shipHitDamage(level, baseHit, damagePerLevel, milestoneLevels, milestoneMults)
  const cd = shipCooldown(level, baseCd, breakpoints, factor, min)
  return hit.div(new BigNumber(cd))
}
