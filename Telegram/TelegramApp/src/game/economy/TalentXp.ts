// Talent-tree XP curve, same small-pure-function idiom as OfflineEarnings.ts/UpgradeCost.ts.
import type { BalanceConfig } from '../config/BalanceConfig'

/** XP for killing a planet at this stage: deliberately linear (not exponential like Stardust/HP)
 *  so levels stay a comprehensible count rather than another BigNumber-scale curve. */
export function xpForPlanetKill(stage: number, cfg: BalanceConfig): number {
  return Math.round(cfg.talentXpBase + Math.max(1, stage) * cfg.talentXpPerStage)
}

/** XP required to go from `level` to `level+1` - a polynomial curve (not exponential), the
 *  standard smooth-and-bounded RPG leveling shape. */
export function xpToNextLevel(level: number, cfg: BalanceConfig): number {
  return Math.round(cfg.talentXpCurveBase * Math.pow(Math.max(1, level), cfg.talentXpCurvePower))
}
