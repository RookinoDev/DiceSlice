// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/EnemyHp.cs
import { BigNumber } from '../core/BigNumber'

/** Parametric enemy HP curve. HP(stage) = base * growth^(stage-1). */
export function enemyHpForStage(stage: number, baseHp: number, growth: number): BigNumber {
  const steps = stage - 1
  if (steps <= 0) return new BigNumber(baseHp)
  return new BigNumber(baseHp).mul(new BigNumber(growth).pow(steps))
}

export function enemyHpBossForStage(stage: number, baseHp: number, growth: number, multiplier: number): BigNumber {
  return enemyHpForStage(stage, baseHp, growth).mul(new BigNumber(multiplier))
}
