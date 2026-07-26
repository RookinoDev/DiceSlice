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

/** The tree's 4 final branches (what you're actually committing to once you've climbed out of
 *  the shared trunk). 'trunk' tags the shared foundation nodes below the first fork - not a
 *  final destination, just shared groundwork every path passes through. */
export type TalentCluster = 'combat' | 'precision' | 'economy' | 'continuum'
export const CLUSTER_ORDER: TalentCluster[] = ['combat', 'precision', 'economy', 'continuum']

export interface TalentDefinition {
  /** Stable id, e.g. 'trunk-1', 'combat-gem', 'nexus' - never rename (it's the prerequisite
   *  graph's own vocabulary, not just a debug label - also the Gem Socket save format's key). */
  id: string
  branch: TalentCluster | 'trunk' | 'nexus'
  /** ALL listed ids must be owned (level>0) before this node unlocks. Empty = always unlockable. */
  prerequisites: string[]
  /** Layout coordinate for the SVG tree renderer (TalentClusterPanel.tsx) - one shared coordinate
   *  space for the WHOLE tree now (not per-cluster-local): row 0 is the Grand Nexus at the very
   *  top, the highest row number is the trunk's first node at the very bottom - the tree reads
   *  bottom-to-top, widening from one shared trunk into 4 straight branches as it climbs. */
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
 *  (every other node); a keystone is one big single-level spike (the top of each branch); a gem
 *  carries no bonus of its own - its "level" (0 or 1) only tracks whether the slot is unlocked. */
const ROLE_FORMULA = {
  root: { firstLevelBonus: 0.03, bonusPerLevel: 0.015, maxLevel: 4 },
  fork: { firstLevelBonus: 0.04, bonusPerLevel: 0.02, maxLevel: 5 },
  keystone: { firstLevelBonus: 0.12, bonusPerLevel: 0, maxLevel: 1 },
  gem: { firstLevelBonus: 0, bonusPerLevel: 0, maxLevel: 1 },
} as const
type NodeRole = keyof typeof ROLE_FORMULA

/** Short label + one-line description per effect - every node's displayName/description is
 *  derived from its own effect via this table, so authoring a node is just "pick an effect,
 *  everything else follows" rather than hand-writing 42 unique flavor names. */
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

/**
 * A single straight climb from the fork that starts it to a keystone at the top - one of the
 * tree's 4 final branches. Alternates between two related effects node-to-node (mirroring how
 * Precision/Continuum already paired effects before this redesign) with one Gem Socket partway
 * up. `startRow` is the branch's first (lowest, closest to the trunk) node; each subsequent node
 * is one row higher (numerically lower `row`), ending at `startRow - 8` for the keystone.
 */
function buildBranch(id: TalentCluster, primary: TalentEffect, secondary: TalentEffect, col: number, wingPrereq: string, startRow: number): TalentDefinition[] {
  const r = (n: number) => startRow - n
  return [
    node(`${id}-1`, id, [wingPrereq], { col, row: r(0) }, primary, 'fork'),
    node(`${id}-2`, id, [`${id}-1`], { col, row: r(1) }, secondary, 'fork'),
    node(`${id}-3`, id, [`${id}-2`], { col, row: r(2) }, primary, 'fork'),
    node(`${id}-gem`, id, [`${id}-3`], { col, row: r(3) }, TalentEffect.GemSocket, 'gem'),
    node(`${id}-4`, id, [`${id}-gem`], { col, row: r(4) }, secondary, 'fork'),
    node(`${id}-5`, id, [`${id}-4`], { col, row: r(5) }, primary, 'fork'),
    node(`${id}-6`, id, [`${id}-5`], { col, row: r(6) }, secondary, 'fork'),
    node(`${id}-7`, id, [`${id}-6`], { col, row: r(7) }, primary, 'fork'),
    node(`${id}-keystone`, id, [`${id}-7`], { col, row: r(8) }, secondary, 'keystone'),
  ]
}

/**
 * 42 nodes: one shared trunk (3 nodes) climbing to a first fork (2 "wings"), each wing forking
 * again into 2 of the tree's 4 final branches (9 nodes each, straight climbs - see buildBranch),
 * converging on 1 Grand Nexus at the very top. Reads bottom-to-top: one line at the bottom,
 * gradually branching, ending as 4 parallel lines - replacing the old 6-independent-clusters
 * layout (each with its own root, forking AND re-merging internally) with a single legible shape.
 *
 *                    nexus
 *          combat  precision  economy  continuum   (keystones)
 *             |        |         |         |
 *           (7 more nodes each, straight up, 1 gem socket partway)
 *             |        |         |         |
 *          wing-combat         wing-economy
 *                \    /           \    /
 *                trunk-3 --------------
 *                   |
 *                trunk-2
 *                   |
 *                trunk-1
 *
 * Full max (every node, every gem, the Nexus): 3 root(max4) + 2 fork(max5, wings) + 4*(7
 * fork(max5) + 1 gem(max1) + 1 keystone(max1)) + 1 nexus(max1) = 12 + 10 + 4*(35+1+1) + 1 = 171
 * points - see BalanceConfig.ts's talentXpCurve* constants for the level curve tuned to that
 * (smaller, lighter) target.
 */
export function buildDefaultTalents(): TalentDefinition[] {
  return [
    node('trunk-1', 'trunk', [], { col: 1.5, row: 13 }, TalentEffect.Capstone, 'root'),
    node('trunk-2', 'trunk', ['trunk-1'], { col: 1.5, row: 12 }, TalentEffect.Capstone, 'root'),
    node('trunk-3', 'trunk', ['trunk-2'], { col: 1.5, row: 11 }, TalentEffect.Capstone, 'root'),
    node('wing-combat', 'trunk', ['trunk-3'], { col: 0.5, row: 10 }, TalentEffect.Capstone, 'fork'),
    node('wing-economy', 'trunk', ['trunk-3'], { col: 2.5, row: 10 }, TalentEffect.Capstone, 'fork'),
    ...buildBranch('combat', TalentEffect.TapDamage, TalentEffect.Dps, 0, 'wing-combat', 9),
    ...buildBranch('precision', TalentEffect.TapCritChance, TalentEffect.ShipCritChance, 1, 'wing-combat', 9),
    ...buildBranch('economy', TalentEffect.Gold, TalentEffect.XpGain, 2, 'wing-economy', 9),
    ...buildBranch('continuum', TalentEffect.OfflineReward, TalentEffect.RelicGain, 3, 'wing-economy', 9),
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
