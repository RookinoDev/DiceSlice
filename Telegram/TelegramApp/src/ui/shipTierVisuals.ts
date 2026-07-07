// Presentation-only 6-tier visual grouping for the 19 ships, matching the Claude Design
// system's TIER_META exactly (clip-path silhouette + color per tier). This does NOT touch
// game/config/ShipDefinition.ts's real cost/DPS/archetype data - ship index -> tier is a pure
// UI lookup, grouped 4/4/3/3/3/2 to match the design's Interceptor/Corvette/Frigate/Cruiser/
// Destroyer/Dreadnought+Titan bands.
export interface ShipTierVisual {
  tierLabel: string
  color: string
  clipPath: string
}

const TIERS: ShipTierVisual[] = [
  { tierLabel: 'Interceptor', color: '#8FE3FF', clipPath: 'polygon(50% 0%, 100% 100%, 50% 78%, 0% 100%)' },
  { tierLabel: 'Corvette', color: '#43DDEE', clipPath: 'polygon(50% 0%, 88% 68%, 100% 100%, 50% 80%, 0% 100%, 12% 68%)' },
  { tierLabel: 'Frigate', color: '#4FC3F7', clipPath: 'polygon(50% 0%, 78% 20%, 100% 55%, 78% 100%, 50% 82%, 22% 100%, 0% 55%, 22% 20%)' },
  { tierLabel: 'Cruiser', color: '#7C8CFF', clipPath: 'polygon(50% 0%, 85% 15%, 100% 50%, 85% 100%, 15% 100%, 0% 50%, 15% 15%)' },
  { tierLabel: 'Destroyer', color: '#B07CFF', clipPath: 'polygon(50% 0%, 100% 32%, 88% 100%, 50% 84%, 12% 100%, 0% 32%)' },
  { tierLabel: 'Dreadnought', color: '#E24FFF', clipPath: 'polygon(50% 0%, 95% 22%, 100% 62%, 70% 100%, 30% 100%, 0% 62%, 5% 22%)' },
]

/** Index boundaries (exclusive upper) for the 4/4/3/3/3/2 = 19 ship grouping. */
const TIER_BOUNDARIES = [4, 8, 11, 14, 17, 19]

export function shipTierVisualForIndex(index: number): ShipTierVisual {
  const tier = TIER_BOUNDARIES.findIndex((upper) => index < upper)
  return TIERS[tier === -1 ? TIERS.length - 1 : tier]
}
