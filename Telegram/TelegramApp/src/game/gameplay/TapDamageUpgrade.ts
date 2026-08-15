// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/TapDamageUpgrade.cs
import { BigNumber } from '../core/BigNumber'
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
  /** Fed by GameSession from TalentService.upgradeCostReduction() (Galactic Salvage) - 1 = no
   *  discount. Clamped here, not at the talent layer, same reasoning as SkillService's own
   *  setCooldownReduction clamp. */
  private costMultiplier = 1

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

  /** discount: 0..1 fraction off the next upgrade's cost, clamped to a max 60% - upgrades should
   *  get cheaper, never free. */
  setCostMultiplier(discount: number): void {
    this.costMultiplier = 1 - (discount < 0 ? 0 : discount > 0.6 ? 0.6 : discount)
  }

  get nextCost(): BigNumber {
    return upgradeCostTapDamage(this._level, this.cfg).mul(new BigNumber(this.costMultiplier))
  }

  /** Whether the NEXT upgrade is actually free - see tryUpgrade's doc comment. The UI reads
   *  this to show "FREE" instead of nextCost, so the button doesn't look priced/unaffordable
   *  for a purchase that won't actually charge anything. */
  get nextIsFree(): boolean {
    return this._level === 1
  }

  /** Spend Stardust to raise the level by one. False if unaffordable. The very first upgrade
   *  (level 1 -> 2) is free - the tutorial teaches this action before a new player has had time
   *  to earn much Stardust, so it must never be blocked by cost. */
  tryUpgrade(wallet: CurrencyService): boolean {
    if (!this.nextIsFree && !wallet.trySpend(this.nextCost)) return false
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
