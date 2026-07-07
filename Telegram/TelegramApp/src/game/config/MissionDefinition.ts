// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Config/MissionDefinition.cs

export const MissionType = {
  DestroyPlanets: 0,
  TapDamageTotal: 1,
  ShipUpgrades: 2,
} as const

export type MissionType = (typeof MissionType)[keyof typeof MissionType]

export interface MissionDefinition {
  type: MissionType
  displayName: string
  target: number
  goldReward: number
}

function createMission(type: MissionType, displayName: string, target: number, goldReward: number): MissionDefinition {
  return { type, displayName, target, goldReward }
}

/** The 3 missions from the datasheet/mockup. Fixed list, not randomized. */
export function buildDefaultMissions(): MissionDefinition[] {
  return [
    createMission(MissionType.DestroyPlanets, 'Destroy 40 Planets', 40, 15000),
    createMission(MissionType.TapDamageTotal, 'Deal 2,000,000 Tap Damage', 2_000_000, 40000),
    createMission(MissionType.ShipUpgrades, 'Upgrade any Ship 5 times', 5, 25000),
  ]
}
