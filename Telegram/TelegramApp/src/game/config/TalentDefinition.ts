// Talent tree node catalog. Mirrors ArtifactDefinition.ts's def+formula shape: static data here,
// level-tracking + spending logic lives in gameplay/TalentService.ts.
export const TalentEffect = {
  Dps: 0,
  Gold: 1,
  TapDamage: 2,
  OfflineReward: 3,
  /** Buffs xpForPlanetKill's own future grants (see economy/TalentXp.ts) - self-reinforcing. */
  XpGain: 4,
  /** Sentinel for the single capstone node: never matched by the per-stat aggregation loops in
   *  TalentService (those loops filter defs by effect === Dps/Gold/etc.), so its bonus is instead
   *  added explicitly to all 4 of CAPSTONE_EFFECTS by TalentService's multiplier() method. */
  Capstone: 5,
} as const

export type TalentEffect = (typeof TalentEffect)[keyof typeof TalentEffect]

/** Which stat multipliers the capstone's bonus applies to (not XpGain - see its own comment). */
export const CAPSTONE_EFFECTS: TalentEffect[] = [TalentEffect.Dps, TalentEffect.Gold, TalentEffect.TapDamage, TalentEffect.OfflineReward]

export type TalentBranch = 'assault' | 'fleet' | 'wealth' | 'ascendant'
export const BRANCH_ORDER: TalentBranch[] = ['assault', 'fleet', 'wealth', 'ascendant']
export const TIERS_PER_BRANCH = 6

export interface TalentDefinition {
  /** Stable id, e.g. 'assault-1'..'assault-6', 'capstone' - debug/test reference only; the
   *  prerequisite chain itself is index-based (see isTalentNodeUnlocked). */
  id: string
  branch: TalentBranch | 'capstone'
  /** 1..6 (position within its branch), 0 for the capstone. */
  tier: number
  effect: TalentEffect
  displayName: string
  description: string
  /** Bonus granted immediately at level 1 (e.g. 0.045 = +4.5%). */
  firstLevelBonus: number
  /** Additional bonus per level beyond level 1. */
  bonusPerLevel: number
  maxLevel: number
}

function node(branch: TalentBranch, tier: number, effect: TalentEffect, displayName: string, description: string): TalentDefinition {
  return { id: `${branch}-${tier}`, branch, tier, effect, displayName, description, firstLevelBonus: 0.045, bonusPerLevel: 0.02, maxLevel: 5 }
}

/**
 * 25 nodes: 4 branches x 6 nodes (linear chain - node i requires node i-1 in the same branch
 * owned) converging on 1 capstone (requires all 4 branches' tier-6 node owned). Every node
 * shares the same firstLevelBonus/bonusPerLevel/maxLevel(5) formula, tuned so a fully-maxed
 * 6-node branch compounds (multiplicatively, see TalentService.multiplier) to roughly +100%
 * (1.125^6 ~= 2.03) - Wealth's split (4 Gold + 2 OfflineReward) lands lower per-stat by design,
 * same total point cost either way. 4*6*5 + 1 = 121 points to fully max the whole tree.
 */
export function buildDefaultTalents(): TalentDefinition[] {
  return [
    node('assault', 1, TalentEffect.TapDamage, 'Focused Strike', 'Sharpens every tap. +Tap Damage.'),
    node('assault', 2, TalentEffect.TapDamage, 'Twin Cannons', 'Doubles up the Tap Cannon array. +Tap Damage.'),
    node('assault', 3, TalentEffect.TapDamage, 'Overcharged Barrels', 'Redlines the cannon coils. +Tap Damage.'),
    node('assault', 4, TalentEffect.TapDamage, 'Piercing Rounds', 'Rounds bore straight through armor plating. +Tap Damage.'),
    node('assault', 5, TalentEffect.TapDamage, 'Fracture Cascade', 'Each hit cracks deeper than the last. +Tap Damage.'),
    node('assault', 6, TalentEffect.TapDamage, 'Annihilation Protocol', 'Nothing survives a direct hit. +Tap Damage.'),

    node('fleet', 1, TalentEffect.Dps, 'Squadron Drills', 'Sharper reflexes across the fleet. +Fleet DPS.'),
    node('fleet', 2, TalentEffect.Dps, 'Escort Formation', 'Ships cover each other’s firing arcs. +Fleet DPS.'),
    node('fleet', 3, TalentEffect.Dps, 'Broadside Volley', 'Synchronized salvos land harder. +Fleet DPS.'),
    node('fleet', 4, TalentEffect.Dps, 'Coordinated Assault', 'Fleet-wide targeting uplink. +Fleet DPS.'),
    node('fleet', 5, TalentEffect.Dps, 'Armada Tactics', 'Doctrine forged across a hundred sectors. +Fleet DPS.'),
    node('fleet', 6, TalentEffect.Dps, 'Total War Doctrine', 'Every ship, every gun, one purpose. +Fleet DPS.'),

    node('wealth', 1, TalentEffect.Gold, 'Prospector’s Eye', 'Spots the richest debris first. +Stardust.'),
    node('wealth', 2, TalentEffect.Gold, 'Trade Route Mastery', 'Every haul sells for more. +Stardust.'),
    node('wealth', 3, TalentEffect.Gold, 'Market Manipulation', 'The exchange bends to your favor. +Stardust.'),
    node('wealth', 4, TalentEffect.Gold, 'Golden Harvest', 'Nothing goes uncollected. +Stardust.'),
    node('wealth', 5, TalentEffect.OfflineReward, 'Dormant Vaults', 'Wealth keeps compounding while you’re away. +Offline Stardust.'),
    node('wealth', 6, TalentEffect.OfflineReward, 'Perpetual Yield', 'An engine that never stops earning. +Offline Stardust.'),

    node('ascendant', 1, TalentEffect.XpGain, 'Quick Study', 'Lessons land faster. +XP gain.'),
    node('ascendant', 2, TalentEffect.XpGain, 'Combat Instincts', 'Every fight teaches something new. +XP gain.'),
    node('ascendant', 3, TalentEffect.XpGain, 'Battle Wisdom', 'Experience compounds on experience. +XP gain.'),
    node('ascendant', 4, TalentEffect.XpGain, 'Veteran’s Insight', 'Nothing about a kill goes unlearned. +XP gain.'),
    node('ascendant', 5, TalentEffect.XpGain, 'Transcendent Focus', 'Growth becomes second nature. +XP gain.'),
    node('ascendant', 6, TalentEffect.XpGain, 'Enlightenment', 'Mastery breeds mastery. +XP gain.'),

    {
      id: 'capstone',
      branch: 'capstone',
      tier: 0,
      effect: TalentEffect.Capstone,
      displayName: 'Stellar Convergence',
      description: 'The four paths converge - a lasting echo of mastery across every discipline. +Fleet DPS, Stardust, Tap Damage, and Offline Stardust.',
      firstLevelBonus: 0.05,
      bonusPerLevel: 0,
      maxLevel: 1,
    },
  ]
}

/** Fractional bonus at a given level (0 for level <= 0) - same formula as artifactBonusAt. */
export function talentBonusAt(def: TalentDefinition, level: number): number {
  return level <= 0 ? 0 : def.firstLevelBonus + (level - 1) * def.bonusPerLevel
}

/**
 * Whether node i's prerequisite is met. Defs are always built in the fixed order above (tier 1
 * first per branch, capstone last), so "the previous node in this branch" is simply defs[i-1] -
 * no id-based lookup needed. Tier 1 of every branch is always unlockable once the tree itself is
 * revealed (see MainPresenter's showTalents); the capstone (last def) requires every branch's
 * tier-6 node owned.
 */
export function isTalentNodeUnlocked(defs: TalentDefinition[], levels: number[], i: number): boolean {
  const def = defs[i]
  if (def.branch === 'capstone') {
    return BRANCH_ORDER.every((branch) => {
      const topIdx = defs.findIndex((d) => d.branch === branch && d.tier === TIERS_PER_BRANCH)
      return topIdx >= 0 && levels[topIdx] > 0
    })
  }
  if (def.tier <= 1) return true
  return levels[i - 1] > 0
}

/** Human-readable prerequisite for a locked node's row (mirrors artifactUnlockLabel). */
export function talentUnlockLabel(defs: TalentDefinition[], i: number): string {
  const def = defs[i]
  if (def.branch === 'capstone') return 'Max out the final node of every branch'
  return `Requires ${defs[i - 1].displayName}`
}
