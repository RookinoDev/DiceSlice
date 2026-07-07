// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Config/ArtifactDefinition.cs
import type { BalanceConfig } from './BalanceConfig'

export const ArtifactEffect = {
  Dps: 0,
  Gold: 1,
  TapDamage: 2,
} as const

export type ArtifactEffect = (typeof ArtifactEffect)[keyof typeof ArtifactEffect]

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
}

function createArtifact(
  effect: ArtifactEffect,
  displayName: string,
  baseCost: number,
  costGrowth: number,
  firstLevelBonus: number,
  bonusPerLevel: number,
  description = '',
): ArtifactDefinition {
  return { effect, displayName, description, baseCost, costGrowth, firstLevelBonus, bonusPerLevel }
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
  ]
}
