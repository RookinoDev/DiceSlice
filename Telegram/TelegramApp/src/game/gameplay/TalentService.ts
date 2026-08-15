// Talent tree: XP/level tracking + the 25-node tree itself, spent with Talent Points (1 per
// level-up, flat 1-point-per-node-level cost - see TalentDefinition.ts for the node data).
// Structurally a near-copy of ArtifactService.ts (defs + parallel levels array), plus the
// level/xp/points state that drives point-earning. Persists through Prestige, same as Artifacts.
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import { CAPSTONE_EFFECTS, CORE_CAPSTONE_EFFECTS, TalentEffect, talentBonusAt, isTalentNodeUnlocked, type TalentDefinition } from '../config/TalentDefinition'
import { xpToNextLevel } from '../economy/TalentXp'
import { rollRandomPerk, passivePerkTemplate, type GrantedPerk } from '../config/PassivePerk'

/** Eternal Drive's own id (see TalentDefinition.ts) - buying it doesn't level up a fixed stat
 *  like every other node, it rolls a random passive perk instead (see buyNode/grantedPerks). */
const ETERNAL_DRIVE_ID = 'eternal-drive'

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
  /** Every perk Eternal Drive has ever rolled, oldest first - never removed, never re-rolled. */
  private _grantedPerks: GrantedPerk[] = []

  /** New level reached (fires once per level, even across a multi-level XP grant). */
  readonly onLevelUp = new Emitter<number>()
  readonly onTalentChanged = new Emitter<{ index: number; level: number }>()
  readonly onPerkGranted = new Emitter<GrantedPerk>()

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
  get grantedPerks(): readonly GrantedPerk[] {
    return this._grantedPerks
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
    if (this.defs[i].id === ETERNAL_DRIVE_ID) {
      const perk = rollRandomPerk()
      this._grantedPerks.push(perk)
      this.onPerkGranted.emit(perk)
    }
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
  /** Restore Eternal Drive's granted perks verbatim (each already rolled its magnitude once,
   *  at grant time - never re-rolled). Malformed entries are dropped rather than throwing. */
  restorePerks(perks: GrantedPerk[] | undefined | null): void {
    this._grantedPerks = (perks ?? []).filter((p) => p && typeof p.templateId === 'string' && Number.isFinite(p.magnitude))
  }

  /** Sum of every granted perk's magnitude that applies to `effect` (a Capstone-tagged perk
   *  counts for any of CAPSTONE_EFFECTS too, same rule as a Capstone-tagged node). Additive, not
   *  compounded per-perk - see PassivePerk.ts's own comment for why an unbounded grant count must
   *  never each multiply independently. */
  private perkBonusFor(effect: TalentEffect): number {
    const alsoCapstone = CAPSTONE_EFFECTS.includes(effect)
    let sum = 0
    for (const perk of this._grantedPerks) {
      const template = passivePerkTemplate(perk.templateId)
      if (!template) continue
      if (template.effect === effect || (alsoCapstone && template.effect === TalentEffect.Capstone)) sum += perk.magnitude
    }
    return sum
  }

  /** Aggregate multiplier for a stat = prod(1 + bonus(level)) across every owned node tagged
   *  with `effect`, PLUS every owned Capstone-tagged node if this stat is one of CAPSTONE_EFFECTS
   *  (the shared trunk/wings and the Grand Nexus all carry the Capstone sentinel, not a specific
   *  stat tag, so they're summed here rather than by the main per-effect check above - multiple
   *  Capstone nodes all count, not just one) and likewise every CoreCapstone-tagged node (just
   *  Infinite Core today) if this stat is one of CORE_CAPSTONE_EFFECTS, THEN the combined Eternal
   *  Drive perk bonus applied once as a single extra factor. Same shape as
   *  ArtifactService.multiplier(). */
  multiplier(effect: TalentEffect): BigNumber {
    let mult = BigNumber.One
    const alsoCapstone = CAPSTONE_EFFECTS.includes(effect)
    const alsoCoreCapstone = CORE_CAPSTONE_EFFECTS.includes(effect)
    for (let i = 0; i < this.defs.length; i++) {
      const matches =
        this.defs[i].effect === effect ||
        (alsoCapstone && this.defs[i].effect === TalentEffect.Capstone) ||
        (alsoCoreCapstone && this.defs[i].effect === TalentEffect.CoreCapstone)
      if (!matches || this.levels[i] <= 0) continue
      mult = mult.mul(new BigNumber(1 + talentBonusAt(this.defs[i], this.levels[i])))
    }
    const perkBonus = this.perkBonusFor(effect)
    if (perkBonus > 0) mult = mult.mul(new BigNumber(1 + perkBonus))
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
  /** Multiplies every timed active skill's active-buff duration - see SkillService.activate(). */
  skillDurationMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.SkillDuration)
  }
  /** Multiplies every active skill's own effect magnitude - see SkillService.effectValue(). */
  skillPowerMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.SkillPower)
  }
  /** Fed straight into SkillService.setCooldownReduction(), which itself clamps to a sane
   *  ceiling (0..0.9) - so this sums (not compounds) every SkillCooldown/CoreCapstone-tagged
   *  node's bonus, same shape as critChanceFor below, rather than the (1+bonus) compounding
   *  every other multiplier() consumer uses. A reduction fraction isn't a growth multiplier -
   *  compounding it the usual way would make no sense (and could exceed 100% on its own). */
  skillCooldownReduction(): number {
    let sum = 0
    for (let i = 0; i < this.defs.length; i++) {
      const matches = this.defs[i].effect === TalentEffect.SkillCooldown || this.defs[i].effect === TalentEffect.CoreCapstone
      if (matches && this.levels[i] > 0) sum += talentBonusAt(this.defs[i], this.levels[i])
    }
    return sum + this.perkBonusFor(TalentEffect.SkillCooldown)
  }
  /** Multiplies TapController's TAP_CRIT_DAMAGE_MULTIPLIER - see Vanguard Cannon's own comment
   *  in TalentDefinition.ts. */
  tapCritDamageMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.TapCritDamage)
  }
  /** Multiplies ShipService's SHIP_CRIT_DAMAGE_MULTIPLIER - see Autonomous Fleet's own comment
   *  in TalentDefinition.ts. */
  shipCritDamageMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.ShipCritDamage)
  }
  /** Multiplies the boss fight timer - see Warp Command's own comment in TalentDefinition.ts. */
  bossTimerMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.BossTimerBonus)
  }
  /** Fed straight into TapDamageUpgrade.setCostMultiplier()/ShipService.setCostMultiplier(),
   *  which each clamp to a sane ceiling - sums (not compounds) every UpgradeCostReduction-tagged
   *  node's bonus, same reasoning as skillCooldownReduction above (a discount fraction isn't a
   *  growth multiplier). See Galactic Salvage's own comment in TalentDefinition.ts. */
  upgradeCostReduction(): number {
    let sum = 0
    for (let i = 0; i < this.defs.length; i++) {
      if (this.defs[i].effect !== TalentEffect.UpgradeCostReduction || this.levels[i] <= 0) continue
      sum += talentBonusAt(this.defs[i], this.levels[i])
    }
    return sum + this.perkBonusFor(TalentEffect.UpgradeCostReduction)
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
    const perkBonus = this.perkBonusFor(TalentEffect.XpGain)
    if (perkBonus > 0) mult *= 1 + perkBonus
    return mult
  }
}
