// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/TapController.cs
import type { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { DamageEvent } from './DamageEvent'
import type { EnemyController } from './EnemyController'
import type { TapDamageUpgrade } from './TapDamageUpgrade'

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

  /** View hook for floating damage numbers. */
  readonly onDamageDealt = new Emitter<DamageEvent>()

  constructor(enemy: EnemyController, tapDamage: TapDamageUpgrade, multiplier?: () => BigNumber) {
    this.enemy = enemy
    this.tapDamage = tapDamage
    this.multiplier = multiplier
  }

  tap(): void {
    if (!this.enemy.current) return

    let dmg = this.tapDamage.currentDamage
    if (this.multiplier) dmg = dmg.mul(this.multiplier())
    this.enemy.applyDamage(dmg)
    this.onDamageDealt.emit({ amount: dmg, isCrit: false })
  }
}
