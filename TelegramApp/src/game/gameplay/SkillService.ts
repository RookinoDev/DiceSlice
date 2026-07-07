// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/SkillService.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import { SkillType, type SkillDefinition } from '../config/SkillDefinition'

interface SkillState {
  level: number
  active: number
  cooldown: number
}

/**
 * Unlocks skills by player level, activates them (timed buff or instant Meteor),
 * tracks duration + cooldown, and exposes aggregate combat modifiers.
 */
export class SkillService {
  private readonly defs = new Map<SkillType, SkillDefinition>()
  private readonly state = new Map<SkillType, SkillState>()
  private readonly playerLevel: () => number
  private cooldownReduction = 0 // 0..1

  readonly onActivated = new Emitter<SkillType>()
  readonly onExpired = new Emitter<SkillType>()

  constructor(defs: SkillDefinition[], playerLevel: () => number) {
    this.playerLevel = playerLevel
    for (const d of defs) {
      this.defs.set(d.type, d)
      this.state.set(d.type, { level: 1, active: 0, cooldown: 0 })
    }
  }

  private def(t: SkillType): SkillDefinition {
    const d = this.defs.get(t)
    if (!d) throw new Error(`Unknown skill: ${t}`)
    return d
  }

  private st(t: SkillType): SkillState {
    const s = this.state.get(t)
    if (!s) throw new Error(`Unknown skill: ${t}`)
    return s
  }

  name(t: SkillType): string {
    return this.def(t).displayName
  }
  description(t: SkillType): string {
    return this.def(t).description
  }
  level(t: SkillType): number {
    return this.st(t).level
  }
  setLevel(t: SkillType, level: number): void {
    this.st(t).level = Math.max(1, level)
  }
  isUnlocked(t: SkillType): boolean {
    return this.playerLevel() >= this.def(t).unlockLevel
  }
  isActive(t: SkillType): boolean {
    return this.st(t).active > 0
  }
  cooldown(t: SkillType): number {
    return this.st(t).cooldown
  }
  activeTimeLeft(t: SkillType): number {
    return this.st(t).active
  }
  /** Full cooldown duration (not remaining) - for UI progress/wipe rendering. */
  fullCooldown(t: SkillType): number {
    return this.def(t).cooldown
  }
  /** Full active-buff duration (not remaining) - for UI progress/wipe rendering. */
  fullDuration(t: SkillType): number {
    return this.def(t).duration
  }

  canActivate(t: SkillType): boolean {
    const s = this.st(t)
    if (!this.isUnlocked(t) || s.cooldown > 0) return false
    if (!this.def(t).isInstant && s.active > 0) return false
    return true
  }

  setCooldownReduction(fraction: number): void {
    this.cooldownReduction = fraction < 0 ? 0 : fraction > 0.9 ? 0.9 : fraction
  }

  /** Raw effect value: a*lvl + b (NOT used for Meteor's instant damage). */
  effectValue(t: SkillType): number {
    const d = this.def(t)
    const lvl = this.st(t).level
    return d.coeffPerLevel * lvl + d.coeffBase
  }

  /** Activate a skill. Returns Meteor's instant damage (Zero for others). */
  activate(t: SkillType, tapDamage: BigNumber): BigNumber {
    if (!this.canActivate(t)) return BigNumber.Zero
    const d = this.def(t)
    const s = this.st(t)
    s.cooldown = d.cooldown * (1 - this.cooldownReduction)
    this.onActivated.emit(t)

    if (d.isInstant) {
      // Meteor Strike: 70*(1+lvl)*tapDamage
      if (t === SkillType.MeteorStrike) return new BigNumber(d.coeffPerLevel * (1 + s.level)).mul(tapDamage)
      return BigNumber.Zero
    }

    s.active = d.duration
    return BigNumber.Zero
  }

  tick(dt: number): void {
    for (const [type, s] of this.state) {
      if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt)
      if (s.active > 0) {
        s.active -= dt
        if (s.active <= 0) {
          s.active = 0
          this.onExpired.emit(type)
        }
      }
    }
  }

  // -- Aggregate modifiers (only while the relevant skill is active) --
  dpsMultiplier(): BigNumber {
    return new BigNumber(1 + (this.isActive(SkillType.BattleCry) ? this.effectValue(SkillType.BattleCry) / 100 : 0))
  }

  tapDamageMultiplier(): BigNumber {
    return new BigNumber(1 + (this.isActive(SkillType.Overdrive) ? this.effectValue(SkillType.Overdrive) / 100 : 0))
  }

  goldMultiplier(): BigNumber {
    return new BigNumber(1 + (this.isActive(SkillType.MidasBeam) ? this.effectValue(SkillType.MidasBeam) / 100 : 0))
  }

  /** Extra crit chance in percentage points (0 when inactive). */
  critChanceBonusPercent(): number {
    return this.isActive(SkillType.TargetingSystem) ? this.effectValue(SkillType.TargetingSystem) : 0
  }

  /** Drone auto-taps per second (0 when inactive). */
  droneTapsPerSecond(): number {
    return this.isActive(SkillType.DroneSwarm) ? this.effectValue(SkillType.DroneSwarm) : 0
  }
}
