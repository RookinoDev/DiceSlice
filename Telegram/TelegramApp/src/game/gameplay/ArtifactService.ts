// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/ArtifactService.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import { ArtifactEffect, artifactBonusAt, isArtifactUnlocked, type ArtifactDefinition } from '../config/ArtifactDefinition'
import type { CurrencyService } from '../economy/CurrencyService'
import { upgradeCostExponential } from '../economy/UpgradeCost'

/** Crit chance is a probability, not a stacking multiplier - hard-capped so it can never
 * reach a guaranteed-crit uptime even at very high artifact levels. */
const CRIT_CHANCE_CAP = 0.6

export interface ArtifactUnlockContext {
  highestStage: number
  prestigeCount: number
}

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

  /** ctx is required for the 3 locked artifacts (Sprint 6, #13) - the UI already hides their
   * purchase controls while locked, this is the defense-in-depth check underneath. */
  buyOrUpgrade(i: number, ctx: ArtifactUnlockContext): boolean {
    if (!isArtifactUnlocked(this.defs[i], ctx)) return false
    if (!this.relics.trySpend(this.nextCost(i))) return false
    this.levels[i]++
    this.onArtifactChanged.emit({ index: i, level: this.levels[i] })
    return true
  }

  /**
   * Upgrade artifact i as many times as Relics allow (real cost each step ->
   * cannot overspend). Returns levels bought. Capped for safety.
   */
  buyOrUpgradeMax(i: number, ctx: ArtifactUnlockContext, cap = 100_000): number {
    let n = 0
    while (n < cap && this.buyOrUpgrade(i, ctx)) n++
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
  offlineRewardMultiplier(): BigNumber {
    return this.multiplier(ArtifactEffect.OfflineReward)
  }

  /** Crit chance is a plain probability (0..1), read straight off whichever artifact carries
   * this effect - unlike the multipliers above, it doesn't compound across levels/artifacts,
   * it's a direct bonus with a hard ceiling (CRIT_CHANCE_CAP). */
  private critChanceFor(effect: ArtifactEffect): number {
    let chance = 0
    for (let i = 0; i < this.defs.length; i++) {
      if (this.defs[i].effect !== effect || this.levels[i] <= 0) continue
      chance += artifactBonusAt(this.defs[i], this.levels[i])
    }
    return Math.min(CRIT_CHANCE_CAP, chance)
  }
  tapCritChance(): number {
    return this.critChanceFor(ArtifactEffect.TapCritChance)
  }
  shipCritChance(): number {
    return this.critChanceFor(ArtifactEffect.ShipCritChance)
  }

  /** Whether artifact i's unlock condition is currently met (see ArtifactDefinition.ts). */
  isUnlocked(i: number, ctx: { highestStage: number; prestigeCount: number }): boolean {
    return isArtifactUnlocked(this.defs[i], ctx)
  }
}
