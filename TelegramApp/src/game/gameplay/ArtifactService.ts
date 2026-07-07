// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/ArtifactService.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import { ArtifactEffect, artifactBonusAt, type ArtifactDefinition } from '../config/ArtifactDefinition'
import type { CurrencyService } from '../economy/CurrencyService'
import { upgradeCostExponential } from '../economy/UpgradeCost'

/**
 * Permanent artifacts bought with Relics. Each adds a multiplicative bonus to a stat.
 * Survives prestige (Relics + artifact levels are not reset).
 */
export class ArtifactService {
  private readonly defs: ArtifactDefinition[]
  private readonly relics: CurrencyService
  private readonly levels: number[]

  readonly onArtifactChanged = new Emitter<{ index: number; level: number }>()

  constructor(defs: ArtifactDefinition[], relicWallet: CurrencyService) {
    this.defs = defs
    this.relics = relicWallet
    this.levels = new Array(defs.length).fill(0)
  }

  get count(): number {
    return this.defs.length
  }
  levelOf(i: number): number {
    return this.levels[i]
  }
  def(i: number): ArtifactDefinition {
    return this.defs[i]
  }

  /** Restore artifact levels from a save (extra/short entries ignored). */
  restoreLevels(levels: number[] | undefined | null): void {
    if (!levels) return
    const n = Math.min(levels.length, this.levels.length)
    for (let i = 0; i < n; i++) this.levels[i] = levels[i] < 0 ? 0 : levels[i]
  }

  nextCost(i: number): BigNumber {
    return upgradeCostExponential(this.levels[i] + 1, this.defs[i].baseCost, this.defs[i].costGrowth)
  }

  buyOrUpgrade(i: number): boolean {
    if (!this.relics.trySpend(this.nextCost(i))) return false
    this.levels[i]++
    this.onArtifactChanged.emit({ index: i, level: this.levels[i] })
    return true
  }

  /**
   * Upgrade artifact i as many times as Relics allow (real cost each step ->
   * cannot overspend). Returns levels bought. Capped for safety.
   */
  buyOrUpgradeMax(i: number, cap = 100_000): number {
    let n = 0
    while (n < cap && this.buyOrUpgrade(i)) n++
    return n
  }

  /** Current fractional bonus for artifact i (0 if unowned). UI-friendly. */
  levelBonus(i: number): number {
    return artifactBonusAt(this.defs[i], this.levels[i])
  }

  /** Aggregate multiplier for a stat = prod (1 + bonus(level)). */
  multiplier(effect: ArtifactEffect): BigNumber {
    let mult = BigNumber.One
    for (let i = 0; i < this.defs.length; i++) {
      if (this.defs[i].effect !== effect || this.levels[i] <= 0) continue
      mult = mult.mul(new BigNumber(1 + artifactBonusAt(this.defs[i], this.levels[i])))
    }
    return mult
  }

  dpsMultiplier(): BigNumber {
    return this.multiplier(ArtifactEffect.Dps)
  }
  goldMultiplier(): BigNumber {
    return this.multiplier(ArtifactEffect.Gold)
  }
  tapDamageMultiplier(): BigNumber {
    return this.multiplier(ArtifactEffect.TapDamage)
  }
}
