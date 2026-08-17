// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Config/MissionDefinition.cs
// Sprint 5 (fix-plan-2026-07-14.docx, item #10): expanded from a fixed 3-mission list to
// 6 templates x 30 escalating levels = 180 missions, generated rather than hand-authored.
// Numbers/formula approved by the user via the Sprint 5 proposal artifact.
import { BigNumber, toBigNumberData, type BigNumberData } from '../core/BigNumber'
import { goldRewardForStage } from '../economy/GoldReward'

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
  /**
   * Stardust reward, fixed forever at catalog-build time - a pure function of (type, level),
   * never of live player/session state. It used to be `oneKillGold * rewardMult`, recomputed
   * from the player's CURRENT stage every time the sheet rendered - the same uncompleted
   * mission's previewed reward would swing wildly as the player moved between stages, and
   * spike ~9x while standing on a boss stage (StageManager.bossRewardMultiplier stacks
   * bossGoldMultiplier * sqrt(bossHpMultiplier) into "one kill gold"). See rewardForLevel below.
   */
  reward: BigNumberData
}

interface MissionTemplate {
  type: MissionType
  label: (target: number) => string
  target: (level: number) => number
  /** Relative reward weight vs the other templates (Prestige/DestroyBosses are rare, big
   *  events and pay far more per completion than a TapCount tick). Carried over unchanged
   *  from the previous rewardMult calibration. */
  weight: number
}

const LEVELS = 30

// Reward-scale anchor, DELIBERATELY independent of BalanceConfig/GoldReward's live tuning -
// a mission's payout must stay fixed even if the live stage economy gets rebalanced later.
const REWARD_STAGE_BASE = 5.0
const REWARD_STAGE_GROWTH = 1.15
/** Stages of "reference" gold-curve growth per mission level - by level 30 a mission reaches
 *  roughly the gold scale of a well-progressed (not endgame-trivializing) run. */
const REFERENCE_STAGE_PER_LEVEL = 4
/** Small, purely cosmetic ripple on top of the strictly-increasing base curve, per the design
 *  note: reward growth should feel like a rhythm, not a flat ramp, WITHOUT a harder level ever
 *  paying less than an easier one (verified in MissionDefinition.test.ts - the base curve's
 *  per-level growth, ~1.15^4, dwarfs this ripple by design). */
const WAVE_AMPLITUDE = 0.12
const WAVE_PERIOD_LEVELS = 7

const TEMPLATES: MissionTemplate[] = [
  { type: MissionType.DestroyPlanets, label: (n) => `Destroy ${n.toLocaleString()} Planets`, target: (lvl) => Math.round(10 * 1.28 ** (lvl - 1)), weight: 4 },
  { type: MissionType.DestroyBosses, label: (n) => `Defeat ${n.toLocaleString()} Bosses`, target: (lvl) => Math.round(1 * 1.13 ** (lvl - 1)), weight: 14 },
  { type: MissionType.TapCount, label: (n) => `Tap ${n.toLocaleString()} Times`, target: (lvl) => Math.round(50 * 1.25 ** (lvl - 1)), weight: 3 },
  { type: MissionType.TapDamageTotal, label: (n) => `Deal ${n.toLocaleString()} Total Tap Damage`, target: (lvl) => Math.round(2_000_000 * 1.35 ** (lvl - 1)), weight: 6 },
  { type: MissionType.ShipUpgrades, label: (n) => `Upgrade Any Ship ${n.toLocaleString()} Times`, target: (lvl) => Math.round(3 * 1.1 ** (lvl - 1)), weight: 8 },
  { type: MissionType.Prestige, label: (n) => `Prestige ${n.toLocaleString()} Times`, target: (lvl) => lvl, weight: 60 },
]

/** Fixed Stardust reward for one (weight, level) pair - deterministic, no live state. Exported
 *  so tests can check monotonicity/stability directly against the formula. */
export function rewardForLevel(weight: number, level: number): BigNumber {
  const referenceStage = 1 + (level - 1) * REFERENCE_STAGE_PER_LEVEL
  const base = goldRewardForStage(referenceStage, REWARD_STAGE_BASE, REWARD_STAGE_GROWTH)
  const wave = 1 + WAVE_AMPLITUDE * Math.sin((level * 2 * Math.PI) / WAVE_PERIOD_LEVELS)
  return base.mul(new BigNumber(weight * wave))
}

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
        reward: toBigNumberData(rewardForLevel(tpl.weight, level)),
      })
    }
  }
  return out
}
