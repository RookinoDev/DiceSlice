// Tunable balance data, ported 1:1 from Assets/PixelPlanets/StellarBreaker/Scripts/Config/BalanceConfig.cs

export interface BalanceConfig {
  // Enemy HP: HP(stage) = base * growth^(stage-1)
  enemyHpBase: number
  enemyHpGrowth: number
  /** Repeating boss HP multiplier cycle; bossHP = enemyHP * multiplier */
  bossMultipliers: number[]

  // Tap damage: base at lvl1, per-level multiplier eases start -> end
  tapDamageBase: number
  tapGrowthStart: number
  tapGrowthEnd: number
  tapGrowthDecay: number

  // Stardust reward: gold(stage) = base * growth^(stage-1)
  goldBase: number
  goldGrowth: number
  bossGoldMultiplier: number

  // Tap-damage upgrade cost: cost(n) = base * growth^(n-1)
  tapUpgradeBaseCost: number
  tapUpgradeCostGrowth: number

  // Ships: cost(n) = base * perLevelGrowth^(n-1)
  shipBaseCost: number
  shipCostPerLevel: number
  shipBaseCostGrowthMin: number
  shipBaseCostGrowthMax: number
  shipCount: number

  // Ship combat: cooldown-based hits
  shipBaseDpsFirst: number
  shipDamagePerLevel: number
  /** Base cooldowns per archetype: Fast, Medium, Heavy (seconds) */
  shipArchetypeCooldowns: number[]

  // Ship cooldown breakpoints (speed-ups)
  shipCooldownBreakpoints: number[]
  shipCooldownFactor: number
  shipCooldownMin: number

  // Ship DPS milestones (per-level x multipliers)
  shipMilestoneLevels: number[]
  shipMilestoneMultipliers: number[]

  dpsTapShare: number

  // Bosses
  bossStageInterval: number
  bossTimerSeconds: number

  // Skills
  skillDefaultCooldown: number

  // Prestige unlock
  prestigeUnlockStage: number

  // Prestige / Relics
  relicStartStage: number
  relicScale: number
  relicPower: number

  // Artifacts
  artifactBaseCost: number
  artifactCostGrowth: number
  artifactFirstLevelBonus: number
  artifactBonusPerLevel: number

  // Offline
  offlineRate: number
  offlineCapHours: number

  // Monetization
  dailyResetHourUtc: number

  // Daily reward: day 1..7 cycle, loops after day 7
  dailyGoldKillMultiples: number[]
  dailyRelicDay: number

  // Skills - unlock levels & timing
  skillUnlockLevels: number[]
  skillDurationSeconds: number

  // Skill effect coefficients (effect = a*lvl + b)
  meteorPerLevel: number
  droneTapsPerLevel: number
  droneTapsBase: number
  targetingCritPerLvl: number
  targetingCritBase: number
  battleCryDpsPerLvl: number
  battleCryDpsBase: number
  overdriveTapPerLvl: number
  overdriveTapBase: number
  midasGoldPerLvl: number
  midasGoldBase: number
}

export const defaultBalanceConfig: BalanceConfig = {
  enemyHpBase: 29.0,
  enemyHpGrowth: 1.57,
  bossMultipliers: [2, 4, 6, 7, 10],

  tapDamageBase: 1.05,
  tapGrowthStart: 2.1,
  tapGrowthEnd: 1.15,
  tapGrowthDecay: 0.92,

  goldBase: 5.0,
  goldGrowth: 1.15,
  bossGoldMultiplier: 3.0,

  tapUpgradeBaseCost: 10.0,
  tapUpgradeCostGrowth: 1.12,

  shipBaseCost: 50.0,
  shipCostPerLevel: 1.075,
  shipBaseCostGrowthMin: 3.5,
  shipBaseCostGrowthMax: 8.9,
  shipCount: 19,

  shipBaseDpsFirst: 5.0,
  shipDamagePerLevel: 1.27,
  shipArchetypeCooldowns: [0.5, 1.0, 2.0],

  shipCooldownBreakpoints: [100, 200, 300, 400, 500],
  shipCooldownFactor: 0.85,
  shipCooldownMin: 0.2,

  shipMilestoneLevels: [25, 50, 100, 200, 400],
  shipMilestoneMultipliers: [2, 2, 3, 3, 5],

  dpsTapShare: 0.0,

  bossStageInterval: 5,
  bossTimerSeconds: 30,

  skillDefaultCooldown: 120,

  prestigeUnlockStage: 10,

  relicStartStage: 5,
  relicScale: 1.6,
  relicPower: 1.8,

  artifactBaseCost: 10.0,
  artifactCostGrowth: 1.5,
  artifactFirstLevelBonus: 0.2,
  artifactBonusPerLevel: 0.04,

  offlineRate: 0.5,
  offlineCapHours: 8.0,

  dailyResetHourUtc: 0,

  dailyGoldKillMultiples: [3, 4, 5, 6, 8, 10, 15],
  dailyRelicDay: 7,

  skillUnlockLevels: [50, 100, 200, 300, 400, 500],
  skillDurationSeconds: 30,

  meteorPerLevel: 70,
  droneTapsPerLevel: 3,
  droneTapsBase: 4,
  targetingCritPerLvl: 3,
  targetingCritBase: 41,
  battleCryDpsPerLvl: 50,
  battleCryDpsBase: 100,
  overdriveTapPerLvl: 30,
  overdriveTapBase: 40,
  midasGoldPerLvl: 5,
  midasGoldBase: 10,
}
