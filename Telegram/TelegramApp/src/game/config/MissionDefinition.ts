// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Config/MissionDefinition.cs
// Sprint 5 (fix-plan-2026-07-14.docx, item #10): expanded from a fixed 3-mission list to
// 6 templates x 30 escalating levels = 180 missions, generated rather than hand-authored.
// Numbers/formula approved by the user via the Sprint 5 proposal artifact.

export const MissionType = {
  DestroyPlanets: 0,
  TapDamageTotal: 1,
  ShipUpgrades: 2,
  DestroyBosses: 3,
  TapCount: 4,
  Prestige: 5,
} as const

export type MissionType = (typeof MissionType)[keyof typeof MissionType]

export interface MissionDefinition {
  type: MissionType
  /** 1..LEVELS, ascending difficulty within a template. */
  level: number
  displayName: string
  target: number
  /** Reward = oneKillGold * rewardMult, computed at claim time (see MissionService.claim) so
   * it scales with the player's current economy instead of going stale like a fixed number. */
  rewardMult: number
}

interface MissionTemplate {
  type: MissionType
  label: (target: number) => string
  target: (level: number) => number
  /** Reward multiplier at level 1; grows by LEVEL_GROWTH per additional level. */
  baseMult: number
}

const LEVELS = 30
/** Reward multiplier growth per level: mult(level) = baseMult * (1 + LEVEL_GROWTH * (level - 1)). */
const LEVEL_GROWTH = 0.15

const TEMPLATES: MissionTemplate[] = [
  { type: MissionType.DestroyPlanets, label: (n) => `Destroy ${n.toLocaleString()} Planets`, target: (lvl) => Math.round(10 * 1.28 ** (lvl - 1)), baseMult: 4 },
  { type: MissionType.DestroyBosses, label: (n) => `Defeat ${n.toLocaleString()} Bosses`, target: (lvl) => Math.round(1 * 1.13 ** (lvl - 1)), baseMult: 14 },
  { type: MissionType.TapCount, label: (n) => `Tap ${n.toLocaleString()} Times`, target: (lvl) => Math.round(50 * 1.25 ** (lvl - 1)), baseMult: 3 },
  { type: MissionType.TapDamageTotal, label: (n) => `Deal ${n.toLocaleString()} Total Tap Damage`, target: (lvl) => Math.round(2_000_000 * 1.35 ** (lvl - 1)), baseMult: 6 },
  { type: MissionType.ShipUpgrades, label: (n) => `Upgrade Any Ship ${n.toLocaleString()} Times`, target: (lvl) => Math.round(3 * 1.1 ** (lvl - 1)), baseMult: 8 },
  { type: MissionType.Prestige, label: (n) => `Prestige ${n.toLocaleString()} Times`, target: (lvl) => lvl, baseMult: 60 },
]

/** 6 templates x 30 levels, ordered template-by-template (level ascending within each). */
export function buildDefaultMissions(): MissionDefinition[] {
  const out: MissionDefinition[] = []
  for (const tpl of TEMPLATES) {
    for (let level = 1; level <= LEVELS; level++) {
      const target = tpl.target(level)
      out.push({
        type: tpl.type,
        level,
        displayName: tpl.label(target),
        target,
        rewardMult: tpl.baseMult * (1 + LEVEL_GROWTH * (level - 1)),
      })
    }
  }
  return out
}
