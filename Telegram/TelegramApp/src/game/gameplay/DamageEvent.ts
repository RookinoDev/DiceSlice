// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/DamageEvent.cs
import type { BigNumber } from '../core/BigNumber'

/** Logic payload for a single damage application, used to drive floating damage numbers. */
export interface DamageEvent {
  amount: BigNumber
  isCrit: boolean
}
