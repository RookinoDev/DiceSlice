// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Config/ArtifactDefinition.cs
import type { BalanceConfig } from './BalanceConfig'

export const ArtifactEffect = {
  Dps: 0,
  Gold: 1,
  TapDamage: 2,
  /** Multiplies offline-earnings gold (see OfflineEarnings.ts). */
  OfflineReward: 3,
  /** Crit chance on tap hits (see TapController.ts) - not a stacking multiplier like the
   * others, read directly as a probability via ArtifactService.tapCritChance(). */
  TapCritChance: 4,
  /** Crit chance on ship hits (see ShipService.ts), same shape as TapCritChance. */
  ShipCritChance: 5,
} as const

export type ArtifactEffect = (typeof ArtifactEffect)[keyof typeof ArtifactEffect]

/** Sprint 6 (#13): the 3 originals are always buyable; the 3 new ones start locked behind a
 * real milestone (see LockedArtifactRow.tsx's former "coming soon" placeholders). */
export type ArtifactUnlockCondition = { type: 'always' } | { type: 'prestigeCount'; count: number } | { type: 'stage'; stage: number }

export interface ArtifactDefinition {
  effect: ArtifactEffect
  displayName: string
  description: string
  baseCost: number
  costGrowth: number
  /** Bonus granted immediately at level 1 (e.g. 0.20 = +20%) */
  firstLevelBonus: number
  /** Additional flat bonus per level beyond level 1 (smaller than the first-level jump) */
  bonusPerLevel: number
  unlock: ArtifactUnlockCondition
}

function createArtifact(
  effect: ArtifactEffect,
  displayName: string,
  baseCost: number,
  costGrowth: number,
  firstLevelBonus: number,
  bonusPerLevel: number,
  description = '',
  unlock: ArtifactUnlockCondition = { type: 'always' },
): ArtifactDefinition {
  return { effect, displayName, description, baseCost, costGrowth, firstLevelBonus, bonusPerLevel, unlock }
}

/** Whether def's unlock condition is currently met. Pure - callers supply whatever slice of
 * session state the condition needs (see GameSession.isArtifactUnlocked). */
export function isArtifactUnlocked(def: ArtifactDefinition, ctx: { highestStage: number; prestigeCount: number }): boolean {
  switch (def.unlock.type) {
    case 'always':
      return true
    case 'prestigeCount':
      return ctx.prestigeCount >= def.unlock.count
    case 'stage':
      return ctx.highestStage >= def.unlock.stage
  }
}

/** Human-readable unlock requirement for the locked-artifact row (see LockedArtifactRow.tsx). */
export function artifactUnlockLabel(def: ArtifactDefinition): string {
  switch (def.unlock.type) {
    case 'always':
      return ''
    case 'prestigeCount':
      return `Prestige ${def.unlock.count} times`
    case 'stage':
      return `Reach Sector ${def.unlock.stage}`
  }
}

/** Fractional bonus at a given level (0 for level <= 0). */
export function artifactBonusAt(def: ArtifactDefinition, level: number): number {
  return level <= 0 ? 0 : def.firstLevelBonus + (level - 1) * def.bonusPerLevel
}

export function buildDefaultArtifacts(c: BalanceConfig): ArtifactDefinition[] {
  return [
    createArtifact(
      ArtifactEffect.Dps,
      'Singularity Core',
      c.artifactBaseCost,
      c.artifactCostGrowth,
      c.artifactFirstLevelBonus,
      c.artifactBonusPerLevel,
      'Ancient reactor core. Increases total Fleet DPS.',
    ),
    createArtifact(
      ArtifactEffect.Gold,
      'Stellar Engine',
      c.artifactBaseCost * 1.5,
      c.artifactCostGrowth,
      c.artifactFirstLevelBonus,
      c.artifactBonusPerLevel,
      'Harvests dying stars. Increases Stardust gained.',
    ),
    createArtifact(
      ArtifactEffect.TapDamage,
      'Kinetic Lens',
      c.artifactBaseCost * 1.2,
      c.artifactCostGrowth,
      c.artifactFirstLevelBonus,
      c.artifactBonusPerLevel,
      'Focuses kinetic fire. Increases Tap Cannon damage.',
    ),
    // Sprint 6 (#13): the 3 previously-decorative "coming soon" locked artifacts, now real -
    // numbers approved by the user directly (unlock/cost/power for each proposed and confirmed).
    createArtifact(
      ArtifactEffect.OfflineReward,
      'Phoenix Cinders',
      25,
      c.artifactCostGrowth,
      0.35,
      0.05,
      'Embers of a reborn star. Increases Stardust earned while away.',
      { type: 'prestigeCount', count: 3 },
    ),
    createArtifact(
      ArtifactEffect.TapCritChance,
      'Voidglass Lens',
      20,
      c.artifactCostGrowth,
      0.05,
      0.01,
      'Focuses light through impossible geometry. Grants Tap Cannon critical hits.',
      { type: 'stage', stage: 50 },
    ),
    createArtifact(
      ArtifactEffect.ShipCritChance,
      'Ancestral Beacon',
      30,
      c.artifactCostGrowth,
      0.05,
      0.01,
      "Signal from the fleet's first captains. Grants Fleet critical hits.",
      { type: 'stage', stage: 75 },
    ),
  ]
}
