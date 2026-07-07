// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/GoldReward.cs
import { BigNumber } from '../core/BigNumber'

/** Stardust awarded for destroying a planet at a stage. gold(stage) = base * growth^(stage-1). */
export function goldRewardForStage(stage: number, baseGold: number, growth: number): BigNumber {
  const steps = stage - 1
  if (steps <= 0) return new BigNumber(baseGold)
  return new BigNumber(baseGold).mul(new BigNumber(growth).pow(steps))
}
