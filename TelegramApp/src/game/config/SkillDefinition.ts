// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Config/SkillDefinition.cs
import type { BalanceConfig } from './BalanceConfig'

export const SkillType = {
  MeteorStrike: 'MeteorStrike', // instant: 70*(1+lvl)*tapDamage
  DroneSwarm: 'DroneSwarm', // 3*lvl+4 auto-taps/sec
  TargetingSystem: 'TargetingSystem', // +(3*lvl+41)% crit
  BattleCry: 'BattleCry', // +(50*lvl+100)% DPS
  Overdrive: 'Overdrive', // +(30*lvl+40)% tap damage
  MidasBeam: 'MidasBeam', // +(5*lvl+10)% gold
} as const

export type SkillType = (typeof SkillType)[keyof typeof SkillType]

/** One active skill: effect = coeffPerLevel*lvl + coeffBase (Meteor uses (1+lvl)). */
export interface SkillDefinition {
  type: SkillType
  displayName: string
  description: string
  unlockLevel: number
  /** seconds; 0 = instant */
  duration: number
  cooldown: number
  isInstant: boolean
  /** 'a' */
  coeffPerLevel: number
  /** 'b' */
  coeffBase: number
}

function createSkill(
  type: SkillType,
  displayName: string,
  unlockLevel: number,
  duration: number,
  cooldown: number,
  isInstant: boolean,
  coeffPerLevel: number,
  coeffBase: number,
  description = '',
): SkillDefinition {
  return { type, displayName, description, unlockLevel, duration, cooldown, isInstant, coeffPerLevel, coeffBase }
}

/**
 * Prototype skills (all wired to real effects), low tap-level unlocks.
 * Crit/Targeting is intentionally excluded (RNG would destabilise the deterministic
 * damage pipeline) - it stays in the full catalog for later.
 */
export function buildPrototypeSkills(c: BalanceConfig): SkillDefinition[] {
  return [
    createSkill(SkillType.Overdrive, 'Overdrive Barrage', 3, 10, 30, false, c.overdriveTapPerLvl, c.overdriveTapBase, 'Temporarily boosts Tap Cannon damage.'),
    createSkill(SkillType.BattleCry, 'Fleet Surge', 5, 10, 40, false, c.battleCryDpsPerLvl, c.battleCryDpsBase, 'Fleet Surge: temporarily boosts Fleet DPS.'),
    createSkill(SkillType.MeteorStrike, 'Meteor Call', 2, 0, 20, true, c.meteorPerLevel, 0, 'Meteor Call: instant massive damage to the target.'),
    createSkill(SkillType.DroneSwarm, 'Drone Swarm', 4, 10, 35, false, c.droneTapsPerLevel, c.droneTapsBase, 'Drone Swarm: launches drones for temporary auto-fire.'),
    createSkill(SkillType.MidasBeam, 'Golden Horizon', 6, 12, 45, false, c.midasGoldPerLvl, c.midasGoldBase, 'Golden Horizon: more Stardust from destroyed planets.'),
  ]
}

/** The full 6-skill catalog (includes TargetingSystem/crit) using BalanceConfig unlock levels. */
export function buildDefaultSkills(c: BalanceConfig): SkillDefinition[] {
  const u = c.skillUnlockLevels
  const U = (i: number) => (u && i < u.length ? u[i] : 50 * (i + 1))
  const dur = c.skillDurationSeconds
  const cd = c.skillDefaultCooldown

  return [
    createSkill(SkillType.MeteorStrike, 'Meteor Call', U(0), 0, cd, true, c.meteorPerLevel, 0, 'Instant massive damage to the target.'),
    createSkill(SkillType.DroneSwarm, 'Drone Swarm', U(1), dur, cd, false, c.droneTapsPerLevel, c.droneTapsBase, 'Launches drones for temporary auto-fire.'),
    createSkill(SkillType.TargetingSystem, 'Targeting Array', U(2), dur, cd, false, c.targetingCritPerLvl, c.targetingCritBase, 'Boosts critical-hit chance.'),
    createSkill(SkillType.BattleCry, 'Fleet Surge', U(3), dur, cd, false, c.battleCryDpsPerLvl, c.battleCryDpsBase, 'Temporarily boosts Fleet DPS.'),
    createSkill(SkillType.Overdrive, 'Overdrive Barrage', U(4), dur, cd, false, c.overdriveTapPerLvl, c.overdriveTapBase, 'Temporarily boosts Tap Cannon damage.'),
    createSkill(SkillType.MidasBeam, 'Golden Horizon', U(5), dur, cd, false, c.midasGoldPerLvl, c.midasGoldBase, 'Increases Stardust from destroyed planets.'),
  ]
}
