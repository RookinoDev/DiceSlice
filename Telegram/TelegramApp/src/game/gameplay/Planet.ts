// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/Planet.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import { enemyHpForStage, enemyHpBossForStage } from '../economy/EnemyHp'
import type { BalanceConfig } from '../config/BalanceConfig'

/** Pure logic model of one destructible planet/enemy. HP is a BigNumber derived parametrically from the stage. */
export class Planet {
  readonly stage: number
  readonly maxHp: BigNumber
  readonly isBoss: boolean
  private _currentHp: BigNumber

  /** Fired exactly once when HP first reaches <= 0. overkill is how far the killing blow
   *  exceeded the remaining HP (0 for an exact/under kill) - exposed for destruction-intensity
   *  VFX, not a new stat: it's the same intermediate value applyDamage already computes below. */
  readonly onDestroyed = new Emitter<{ planet: Planet; overkill: BigNumber }>()

  constructor(stage: number, maxHp: BigNumber, isBoss = false) {
    this.stage = stage
    this.isBoss = isBoss
    this.maxHp = maxHp
    this._currentHp = maxHp
  }

  get currentHp(): BigNumber {
    return this._currentHp
  }

  get isDead(): boolean {
    return this._currentHp.lte(BigNumber.Zero)
  }

  /** Factory using the parametric enemy-HP curve from BalanceConfig. */
  static create(stage: number, cfg: BalanceConfig): Planet {
    return new Planet(stage, enemyHpForStage(stage, cfg.enemyHpBase, cfg.enemyHpGrowth))
  }

  static createBoss(stage: number, cfg: BalanceConfig, multiplier: number): Planet {
    return new Planet(stage, enemyHpBossForStage(stage, cfg.enemyHpBase, cfg.enemyHpGrowth, multiplier), true)
  }

  /** Apply tap/DPS damage. Fires onDestroyed once when HP hits zero. */
  applyDamage(damage: BigNumber): void {
    if (this.isDead) return

    this._currentHp = this._currentHp.sub(damage)
    if (this._currentHp.lte(BigNumber.Zero)) {
      const overkill = this._currentHp.neg()
      this._currentHp = BigNumber.Zero
      this.onDestroyed.emit({ planet: this, overkill })
    }
  }

  /** 0..1 remaining-HP fraction for health bars. */
  hpFraction01(): number {
    if (this.maxHp.lte(BigNumber.Zero)) return 0
    const f = this._currentHp.div(this.maxHp).toNumber()
    return f < 0 ? 0 : f > 1 ? 1 : f
  }
}
