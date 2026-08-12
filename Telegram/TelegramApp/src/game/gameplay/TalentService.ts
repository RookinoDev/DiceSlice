// Talent tree: XP/level tracking + the 25-node tree itself, spent with Talent Points (1 per
// level-up, flat 1-point-per-node-level cost - see TalentDefinition.ts for the node data).
// Structurally a near-copy of ArtifactService.ts (defs + parallel levels array), plus the
// level/xp/points state that drives point-earning. Persists through Prestige, same as Artifacts.
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import { CAPSTONE_EFFECTS, TalentEffect, talentBonusAt, isTalentNodeUnlocked, type TalentDefinition } from '../config/TalentDefinition'
import { xpToNextLevel } from '../economy/TalentXp'

/** Talents' own contribution to crit chance, capped before GameSession sums it with Artifacts'
 *  (and, once sockets exist, Gems') separately-capped contributions - same reasoning as
 *  ArtifactService's own CRIT_CHANCE_CAP, just a smaller share of the shared ceiling. */
const TALENT_CRIT_CHANCE_CAP = 0.3

export class TalentService {
  private readonly defs: TalentDefinition[]
  private readonly cfg: BalanceConfig
  private readonly levels: number[]
  private _level = 1
  private _xp = 0

  /** New level reached (fires once per level, even across a multi-level XP grant). */
  readonly onLevelUp = new Emitter<number>()
  readonly onTalentChanged = new Emitter<{ index: number; level: number }>()

  constructor(defs: TalentDefinition[], cfg: BalanceConfig) {
    this.defs = defs
    this.cfg = cfg
    this.levels = new Array(defs.length).fill(0)
  }

  get level(): number {
    return this._level
  }
  get xp(): number {
    return this._xp
  }
  /** Derived, not stored: 1 point per level ever earned, minus whatever's currently allocated
   *  across every node. This is the real fix for a bug that hit live players - unspentPoints used
   *  to be its own persisted field, which went stale the moment restoreLevels() reset node
   *  allocation (a tree redesign - see its own comment) without anyone recomputing how many points
   *  that freed back up. Deriving it can never desync from the levels array again, by construction. */
  get unspentPoints(): number {
    return this._level - 1 - this.levels.reduce((sum, l) => sum + l, 0)
  }

  xpToNextLevel(): number {
    return xpToNextLevel(this._level, this.cfg)
  }

  /** Grants XP for a kill (raw, un-scaled - the Ascendant branch's self-buff is applied here,
   *  not by callers), looping level-ups so one large grant can cross several levels correctly. */
  grantXp(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return
    this._xp += amount * this.xpGainMultiplier()
    while (this._xp >= this.xpToNextLevel()) {
      this._xp -= this.xpToNextLevel()
      this._level++
      this.onLevelUp.emit(this._level)
    }
  }

  get count(): number {
    return this.defs.length
  }
  def(i: number): TalentDefinition {
    return this.defs[i]
  }
  levelOf(i: number): number {
    return this.levels[i]
  }
  isUnlocked(i: number): boolean {
    return isTalentNodeUnlocked(this.defs, this.levels, i)
  }
  /** Always 1: talents spend flat Talent Points, no rising cost curve like Artifacts' Relics. */
  nextCost(_i: number): number {
    return 1
  }
  /** Current fractional bonus for node i (0 if unowned). UI-friendly. */
  levelBonus(i: number): number {
    return talentBonusAt(this.defs[i], this.levels[i])
  }

  buyNode(i: number): boolean {
    if (!this.isUnlocked(i)) return false
    if (this.levels[i] >= this.defs[i].maxLevel) return false
    if (this.unspentPoints < 1) return false
    this.levels[i]++
    this.onTalentChanged.emit({ index: i, level: this.levels[i] })
    return true
  }

  /** Restore node levels from a save. A length mismatch means the tree itself was redesigned
   *  since this save was written (e.g. 25 nodes -> 79) - unlike Artifacts' simple clamp, applying
   *  old values index-by-index here would silently misapply them onto UNRELATED new nodes (same
   *  index, different id/effect entirely), not just truncate extras. Safer to start that player's
   *  talent progress fresh in the new tree than to quietly wire old points into the wrong nodes. */
  restoreLevels(levels: number[] | undefined | null): void {
    if (!levels || levels.length !== this.levels.length) return
    for (let i = 0; i < levels.length; i++) this.levels[i] = levels[i] < 0 ? 0 : levels[i]
  }
  /** Restore level/xp together (interdependent - set atomically). unspentPoints is derived (see
   *  its own getter), so there's nothing to restore for it here - call this AFTER restoreLevels
   *  so the derived value reflects the levels that are actually about to be in effect. */
  restoreProgress(level: number, xp: number): void {
    this._level = Math.max(1, level)
    this._xp = Math.max(0, xp)
  }

  /** Aggregate multiplier for a stat = prod(1 + bonus(level)) across every owned node tagged
   *  with `effect`, PLUS every owned Capstone-tagged node if this stat is one of CAPSTONE_EFFECTS
   *  (the shared trunk/wings and the Grand Nexus all carry the Capstone sentinel, not a specific
   *  stat tag, so they're summed here rather than by the main per-effect check above - multiple
   *  Capstone nodes all count, not just one). Same shape as ArtifactService.multiplier(). */
  multiplier(effect: TalentEffect): BigNumber {
    let mult = BigNumber.One
    const alsoCapstone = CAPSTONE_EFFECTS.includes(effect)
    for (let i = 0; i < this.defs.length; i++) {
      const matches = this.defs[i].effect === effect || (alsoCapstone && this.defs[i].effect === TalentEffect.Capstone)
      if (!matches || this.levels[i] <= 0) continue
      mult = mult.mul(new BigNumber(1 + talentBonusAt(this.defs[i], this.levels[i])))
    }
    return mult
  }

  dpsMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.Dps)
  }
  goldMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.Gold)
  }
  tapDamageMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.TapDamage)
  }
  offlineRewardMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.OfflineReward)
  }
  /** Multiplies the Relics gained on a Stellar Ascension - see PrestigeService.prestige(). */
  relicGainMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.RelicGain)
  }
  /** Crit chance is a plain probability, not a stacking multiplier - summed (not compounded)
   *  across every owned node tagged with `effect`, same shape as ArtifactService.critChanceFor. */
  private critChanceFor(effect: TalentEffect): number {
    let chance = 0
    for (let i = 0; i < this.defs.length; i++) {
      if (this.defs[i].effect !== effect || this.levels[i] <= 0) continue
      chance += talentBonusAt(this.defs[i], this.levels[i])
    }
    return Math.min(TALENT_CRIT_CHANCE_CAP, chance)
  }
  tapCritChance(): number {
    return this.critChanceFor(TalentEffect.TapCritChance)
  }
  shipCritChance(): number {
    return this.critChanceFor(TalentEffect.ShipCritChance)
  }
  /** Plain number, not BigNumber - multiplies straight into xpForPlanetKill's result. */
  xpGainMultiplier(): number {
    let mult = 1
    for (let i = 0; i < this.defs.length; i++) {
      if (this.defs[i].effect !== TalentEffect.XpGain || this.levels[i] <= 0) continue
      mult *= 1 + talentBonusAt(this.defs[i], this.levels[i])
    }
    return mult
  }
}
