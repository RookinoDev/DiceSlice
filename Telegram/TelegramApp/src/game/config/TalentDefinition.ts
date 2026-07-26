// Talent tree node catalog. Mirrors ArtifactDefinition.ts's def+formula shape: static data here,
// level-tracking + spending logic lives in gameplay/TalentService.ts.
export const TalentEffect = {
  Dps: 0,
  Gold: 1,
  TapDamage: 2,
  OfflineReward: 3,
  /** Buffs xpForPlanetKill's own future grants (see economy/TalentXp.ts) - self-reinforcing. */
  XpGain: 4,
  TapCritChance: 5,
  ShipCritChance: 6,
  /** Multiplies the Relics gained on a Stellar Ascension - see PrestigeService.prestige(). */
  RelicGain: 7,
  /** Sentinel for a small "boosts nearly everything" node (the shared trunk/wings the tree
   *  climbs out of, and the Grand Nexus at its top): never matched by the per-stat aggregation
   *  loop directly, but summed into every one of CAPSTONE_EFFECTS by TalentService.multiplier(). */
  Capstone: 8,
  /** Sentinel for a Gem Socket slot: carries no bonus of its own (the socketed card's ability
   *  does, via GemSocketService) - this only exists so the aggregation loop skips it. */
  GemSocket: 9,
} as const

export type TalentEffect = (typeof TalentEffect)[keyof typeof TalentEffect]

/** Which stat multipliers a Capstone-tagged node's bonus applies to (not XpGain/crit chances - a
 *  flat "+5% to everything" reads oddly against a percentage-point crit stat, and XpGain has
 *  always been excluded). */
export const CAPSTONE_EFFECTS: TalentEffect[] = [TalentEffect.Dps, TalentEffect.Gold, TalentEffect.TapDamage, TalentEffect.OfflineReward, TalentEffect.RelicGain]

/** The tree's 4 final branches (what you're actually climbing once you're out of the shared
 *  trunk) - purely an internal wiring/layout concept (which column, which prerequisite chain).
 *  Deliberately never surfaced as a named category in the UI: no legend, no branch-specific
 *  color - see talentTreeMeta.tsx. 'trunk' tags the shared foundation below the first fork. */
export type TalentCluster = 'combat' | 'precision' | 'economy' | 'continuum'
export const CLUSTER_ORDER: TalentCluster[] = ['combat', 'precision', 'economy', 'continuum']

export interface TalentDefinition {
  /** Stable id, e.g. 'trunk-1', 'combat-gem-1', 'nexus' - never rename (it's the prerequisite
   *  graph's own vocabulary, not just a debug label - also the Gem Socket save format's key). */
  id: string
  branch: TalentCluster | 'trunk' | 'nexus'
  /** ALL listed ids must be owned (level>0) before this node unlocks. Empty = always unlockable. */
  prerequisites: string[]
  /** Layout coordinate for the SVG tree renderer (TalentClusterPanel.tsx) - one shared coordinate
   *  space for the WHOLE tree: row 0 is the Grand Nexus at the very top, the highest row number
   *  is the trunk's first node at the very bottom - the tree reads bottom-to-top, widening from
   *  one shared trunk into 4 straight branches as it climbs. */
  pos: { col: number; row: number }
  effect: TalentEffect
  /** What this node actually does, e.g. "Tap Damage" - shown as the node's label instead of a
   *  flavor name, so a glance at the tree tells you what you're investing in. */
  displayName: string
  description: string
  /** Bonus granted immediately at level 1 (e.g. 0.045 = +4.5%). 0 for a Gem Socket node. */
  firstLevelBonus: number
  /** Additional bonus per level beyond level 1. */
  bonusPerLevel: number
  maxLevel: number
}

/** Per-node-role bonus formula, reused by every branch so power/investment tradeoffs read
 *  consistently: a root is a cheap, weak opener (the trunk); a fork is the main per-level pace
 *  (every regular branch node); a keystone is one big single-level spike (the top of each
 *  branch); a gem carries no bonus of its own - its "level" (0 or 1) only tracks whether the
 *  slot is unlocked. */
const ROLE_FORMULA = {
  root: { firstLevelBonus: 0.03, bonusPerLevel: 0.015, maxLevel: 4 },
  fork: { firstLevelBonus: 0.04, bonusPerLevel: 0.02, maxLevel: 5 },
  keystone: { firstLevelBonus: 0.12, bonusPerLevel: 0, maxLevel: 1 },
  gem: { firstLevelBonus: 0, bonusPerLevel: 0, maxLevel: 1 },
} as const
type NodeRole = keyof typeof ROLE_FORMULA

/** Short label + one-line description per effect - every node's displayName/description is
 *  derived from its own effect via this table, so authoring a node is just "pick an effect,
 *  everything else follows" rather than hand-writing dozens of unique flavor names. */
const EFFECT_LABEL: Record<TalentEffect, string> = {
  [TalentEffect.Dps]: 'Fleet DPS',
  [TalentEffect.Gold]: 'Stardust',
  [TalentEffect.TapDamage]: 'Tap Damage',
  [TalentEffect.OfflineReward]: 'Offline Stardust',
  [TalentEffect.XpGain]: 'XP Gain',
  [TalentEffect.TapCritChance]: 'Tap Crit Chance',
  [TalentEffect.ShipCritChance]: 'Ship Crit Chance',
  [TalentEffect.RelicGain]: 'Relic Gain',
  [TalentEffect.Capstone]: 'Core Systems',
  [TalentEffect.GemSocket]: 'Gem Socket',
}
const EFFECT_DESCRIPTION: Record<TalentEffect, string> = {
  [TalentEffect.Dps]: "Increases your fleet's automatic damage output.",
  [TalentEffect.Gold]: 'Increases Stardust earned from every kill.',
  [TalentEffect.TapDamage]: 'Increases the damage of every tap.',
  [TalentEffect.OfflineReward]: 'Increases Stardust earned while you were away.',
  [TalentEffect.XpGain]: 'Increases XP earned toward your next Talent Point.',
  [TalentEffect.TapCritChance]: 'Chance for a tap to land a critical hit.',
  [TalentEffect.ShipCritChance]: "Chance for your fleet's damage to critically strike.",
  [TalentEffect.RelicGain]: 'Increases Relics gained on your next Stellar Ascension.',
  [TalentEffect.Capstone]: 'A small boost to nearly everything.',
  [TalentEffect.GemSocket]: 'Socket an owned card here to channel its power.',
}

function node(id: string, branch: TalentDefinition['branch'], prerequisites: string[], pos: { col: number; row: number }, effect: TalentEffect, role: NodeRole): TalentDefinition {
  return { id, branch, prerequisites, pos, effect, displayName: EFFECT_LABEL[effect], description: EFFECT_DESCRIPTION[effect], ...ROLE_FORMULA[role] }
}

/** Every branch's own step pattern: 13 regular point nodes (alternating the branch's two paired
 *  effects) with 2 Gem Sockets spread through it, ending in a keystone - a long, plain climb, no
 *  internal forks or merges (those only happen once, on the way OUT of the shared trunk). */
const BRANCH_STEPS: Array<'point' | 'gem'> = ['point', 'point', 'point', 'point', 'gem', 'point', 'point', 'point', 'point', 'point', 'gem', 'point', 'point', 'point', 'point']

/**
 * A single straight climb from the fork that starts it to a keystone at the top - one of the
 * tree's 4 final branches. `startRow` is the branch's first (lowest, closest to the trunk) node;
 * each subsequent node is one row higher (numerically lower `row`).
 */
function buildBranch(id: TalentCluster, primary: TalentEffect, secondary: TalentEffect, col: number, wingPrereq: string, startRow: number): TalentDefinition[] {
  const defs: TalentDefinition[] = []
  let prev = wingPrereq
  let row = startRow
  let pointCount = 0
  let gemCount = 0
  for (const step of BRANCH_STEPS) {
    if (step === 'gem') {
      gemCount++
      const id_ = `${id}-gem-${gemCount}`
      defs.push(node(id_, id, [prev], { col, row }, TalentEffect.GemSocket, 'gem'))
      prev = id_
    } else {
      pointCount++
      const id_ = `${id}-${pointCount}`
      defs.push(node(id_, id, [prev], { col, row }, pointCount % 2 === 1 ? primary : secondary, 'fork'))
      prev = id_
    }
    row--
  }
  // Continues the same alternation one more step for the keystone (odd pointCount -> primary was
  // last used, so the next in line is secondary, and vice versa).
  const keystoneEffect = pointCount % 2 === 1 ? secondary : primary
  defs.push(node(`${id}-keystone`, id, [prev], { col, row }, keystoneEffect, 'keystone'))
  return defs
}

/**
 * One shared trunk (5 nodes) climbing to a first fork (2 "wings"), each wing forking again into
 * 2 of the tree's 4 final branches (16 nodes each: 13 point + 2 gem + 1 keystone - see
 * buildBranch), converging on 1 Grand Nexus at the very top. Reads bottom-to-top: one line at
 * the bottom, gradually branching, ending as 4 long parallel lines - a single legible shape with
 * no internal forks/merges once you're committed to a branch, and no named categories anywhere
 * in the UI (see talentTreeMeta.tsx).
 *
 *                    nexus
 *          combat  precision  economy  continuum   (keystones)
 *             |        |         |         |
 *          (14 more nodes each, straight up, 2 gem sockets spread through)
 *             |        |         |         |
 *          wing-combat         wing-economy
 *                \    /           \    /
 *                trunk-5 --------------
 *                   |
 *                  ...
 *                   |
 *                trunk-1
 *
 * Full max (every node, every gem, the Nexus): 5 root(max4) + 2 fork(max5, wings) + 4*(13
 * fork(max5) + 2 gem(max1) + 1 keystone(max1)) + 1 nexus(max1) = 20 + 10 + 4*68 + 1 = 303 points
 * - see BalanceConfig.ts's talentXpCurve* constants for the level curve tuned to that target.
 */
export function buildDefaultTalents(): TalentDefinition[] {
  return [
    node('trunk-1', 'trunk', [], { col: 1.5, row: 22 }, TalentEffect.Capstone, 'root'),
    node('trunk-2', 'trunk', ['trunk-1'], { col: 1.5, row: 21 }, TalentEffect.Capstone, 'root'),
    node('trunk-3', 'trunk', ['trunk-2'], { col: 1.5, row: 20 }, TalentEffect.Capstone, 'root'),
    node('trunk-4', 'trunk', ['trunk-3'], { col: 1.5, row: 19 }, TalentEffect.Capstone, 'root'),
    node('trunk-5', 'trunk', ['trunk-4'], { col: 1.5, row: 18 }, TalentEffect.Capstone, 'root'),
    node('wing-combat', 'trunk', ['trunk-5'], { col: 0.5, row: 17 }, TalentEffect.Capstone, 'fork'),
    node('wing-economy', 'trunk', ['trunk-5'], { col: 2.5, row: 17 }, TalentEffect.Capstone, 'fork'),
    ...buildBranch('combat', TalentEffect.TapDamage, TalentEffect.Dps, 0, 'wing-combat', 16),
    ...buildBranch('precision', TalentEffect.TapCritChance, TalentEffect.ShipCritChance, 1, 'wing-combat', 16),
    ...buildBranch('economy', TalentEffect.Gold, TalentEffect.XpGain, 2, 'wing-economy', 16),
    ...buildBranch('continuum', TalentEffect.OfflineReward, TalentEffect.RelicGain, 3, 'wing-economy', 16),
    {
      id: 'nexus',
      branch: 'nexus',
      prerequisites: CLUSTER_ORDER.map((c) => `${c}-keystone`),
      pos: { col: 1.5, row: 0 },
      effect: TalentEffect.Capstone,
      displayName: 'Grand Nexus',
      description: 'All four disciplines converge - a lasting echo of total mastery.',
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
 * Whether node i's prerequisites are met: every id in its `prerequisites` list must be owned
 * (level>0). A node with no prerequisites is always unlockable. Supports true multi-prerequisite
 * merge nodes (2+ ids at once, e.g. the Grand Nexus requiring all 4 keystones), not just a linear
 * chain.
 */
export function isTalentNodeUnlocked(defs: TalentDefinition[], levels: number[], i: number): boolean {
  const byId = new Map(defs.map((d, idx) => [d.id, idx]))
  return defs[i].prerequisites.every((id) => {
    const idx = byId.get(id)
    return idx !== undefined && levels[idx] > 0
  })
}

/** Human-readable prerequisite for a locked node's row (mirrors artifactUnlockLabel). */
export function talentUnlockLabel(defs: TalentDefinition[], i: number): string {
  const def = defs[i]
  if (def.prerequisites.length === 0) return ''
  const names = def.prerequisites.map((id) => defs.find((d) => d.id === id)?.displayName).filter((n): n is string => !!n)
  return `Requires ${names.join(' and ')}`
}
