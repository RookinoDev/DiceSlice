// Talent tree: XP/level tracking + the 25-node tree itself, spent with Talent Points (1 per
// level-up, flat 1-point-per-node-level cost - see TalentDefinition.ts for the node data).
// Structurally a near-copy of ArtifactService.ts (defs + parallel levels array), plus the
// level/xp/points state that drives point-earning. Persists through Prestige, same as Artifacts.
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import { CAPSTONE_EFFECTS, TalentEffect, talentBonusAt, isTalentNodeUnlocked, type TalentDefinition } from '../config/TalentDefinition'
import { xpToNextLevel } from '../economy/TalentXp'

export class TalentService {
  private readonly defs: TalentDefinition[]
  private readonly cfg: BalanceConfig
  private readonly levels: number[]
  private _level = 1
  private _xp = 0
  private _unspentPoints = 0

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
  get unspentPoints(): number {
    return this._unspentPoints
  }

  xpToNextLevel(): number {
    return xpToNextLevel(this._level, this.cfg)
  }
  /** 0..1, for the XP bar. */
  xpFraction(): number {
    const need = this.xpToNextLevel()
    return need > 0 ? Math.min(1, this._xp / need) : 0
  }

  /** Grants XP for a kill (raw, un-scaled - the Ascendant branch's self-buff is applied here,
   *  not by callers), looping level-ups so one large grant can cross several levels correctly. */
  grantXp(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return
    this._xp += amount * this.xpGainMultiplier()
    while (this._xp >= this.xpToNextLevel()) {
      this._xp -= this.xpToNextLevel()
      this._level++
      this._unspentPoints++
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
    if (this._unspentPoints < 1) return false
    this._unspentPoints--
    this.levels[i]++
    this.onTalentChanged.emit({ index: i, level: this.levels[i] })
    return true
  }

  /** Restore node levels from a save (extra/short entries ignored) - same defensive clamping as
   *  ArtifactService.restoreLevels. */
  restoreLevels(levels: number[] | undefined | null): void {
    if (!levels) return
    const n = Math.min(levels.length, this.levels.length)
    for (let i = 0; i < n; i++) this.levels[i] = levels[i] < 0 ? 0 : levels[i]
  }
  /** Restore level/xp/points together (interdependent - set atomically). */
  restoreProgress(level: number, xp: number, points: number): void {
    this._level = Math.max(1, level)
    this._xp = Math.max(0, xp)
    this._unspentPoints = Math.max(0, points)
  }

  /** Aggregate multiplier for a stat = prod(1 + bonus(level)) across every owned node tagged
   *  with `effect`, PLUS the capstone's bonus if owned and this stat is one of CAPSTONE_EFFECTS
   *  (the capstone's own effect tag is the Capstone sentinel, so it's never double-counted by
   *  the main loop below). Same shape as ArtifactService.multiplier(). */
  multiplier(effect: TalentEffect): BigNumber {
    let mult = BigNumber.One
    for (let i = 0; i < this.defs.length; i++) {
      if (this.defs[i].effect !== effect || this.levels[i] <= 0) continue
      mult = mult.mul(new BigNumber(1 + talentBonusAt(this.defs[i], this.levels[i])))
    }
    if (CAPSTONE_EFFECTS.includes(effect)) {
      const capstoneIdx = this.defs.findIndex((d) => d.effect === TalentEffect.Capstone)
      if (capstoneIdx >= 0 && this.levels[capstoneIdx] > 0) {
        mult = mult.mul(new BigNumber(1 + talentBonusAt(this.defs[capstoneIdx], this.levels[capstoneIdx])))
      }
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
