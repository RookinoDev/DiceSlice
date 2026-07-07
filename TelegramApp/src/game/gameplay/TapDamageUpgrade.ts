// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/TapDamageUpgrade.cs
import type { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import type { CurrencyService } from '../economy/CurrencyService'
import { tapDamageForLevelCfg } from '../economy/TapDamageCurve'
import { upgradeCostTapDamage } from '../economy/UpgradeCost'

/**
 * The infinitely-upgradable tap-damage stat. Owns the level; computes current
 * damage and next cost from parametric curves; buys the next level via a wallet.
 */
export class TapDamageUpgrade {
  private readonly cfg: BalanceConfig
  private _level: number

  readonly onLevelChanged = new Emitter<number>()

  constructor(cfg: BalanceConfig, level = 1) {
    this.cfg = cfg
    this._level = level < 1 ? 1 : level
  }

  get level(): number {
    return this._level
  }

  get currentDamage(): BigNumber {
    return tapDamageForLevelCfg(this._level, this.cfg)
  }

  get nextCost(): BigNumber {
    return upgradeCostTapDamage(this._level, this.cfg)
  }

  /** Spend Stardust to raise the level by one. False if unaffordable. */
  tryUpgrade(wallet: CurrencyService): boolean {
    if (!wallet.trySpend(this.nextCost)) return false
    this._level++
    this.onLevelChanged.emit(this._level)
    return true
  }

  /**
   * Buy as many levels as the wallet allows (uses the real cost each step,
   * so it can never overspend). Returns how many levels were bought. Capped for safety.
   */
  upgradeMax(wallet: CurrencyService, cap = 100_000): number {
    let n = 0
    while (n < cap && this.tryUpgrade(wallet)) n++
    return n
  }

  /** Reset to a level (used by prestige). */
  reset(level = 1): void {
    this._level = level < 1 ? 1 : level
    this.onLevelChanged.emit(this._level)
  }
}
