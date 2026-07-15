// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/TapController.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { DamageEvent } from './DamageEvent'
import type { EnemyController } from './EnemyController'
import type { TapDamageUpgrade } from './TapDamageUpgrade'

/** Flat bonus applied to a critical hit's damage (Voidglass Lens artifact, see #13). */
export const TAP_CRIT_DAMAGE_MULTIPLIER = 2

/**
 * Applies tap damage to the active planet and emits a damage event for the View
 * (floating numbers). Input source (pointer/touch) lives in the UI layer and just
 * calls tap(); this stays headless/testable.
 */
export class TapController {
  private readonly enemy: EnemyController
  private readonly tapDamage: TapDamageUpgrade
  /** optional skill/buff multiplier (x1 if undefined) */
  private readonly multiplier?: () => BigNumber
  /** optional crit-chance source (0..1, 0/undefined if the player has no crit artifact yet).
   * A real Math.random() roll - base damage stays fully deterministic, only this final,
   * clearly-isolated multiplier is chance-based (same class as the existing Secret Rare
   * Destruction cosmetic lottery in CombatScreen.tsx). */
  private readonly critChance?: () => number

  /** View hook for floating damage numbers. */
  readonly onDamageDealt = new Emitter<DamageEvent>()

  constructor(enemy: EnemyController, tapDamage: TapDamageUpgrade, multiplier?: () => BigNumber, critChance?: () => number) {
    this.enemy = enemy
    this.tapDamage = tapDamage
    this.multiplier = multiplier
    this.critChance = critChance
  }

  tap(): void {
    if (!this.enemy.current) return

    let dmg = this.tapDamage.currentDamage
    if (this.multiplier) dmg = dmg.mul(this.multiplier())
    const isCrit = Math.random() < (this.critChance?.() ?? 0)
    if (isCrit) dmg = dmg.mul(new BigNumber(TAP_CRIT_DAMAGE_MULTIPLIER))
    this.enemy.applyDamage(dmg)
    this.onDamageDealt.emit({ amount: dmg, isCrit })
  }
}
