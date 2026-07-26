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
   *  climbs out of, the merge point, and the Grand Nexus at its top): never matched by the
   *  per-stat aggregation loop directly, but summed into every one of CAPSTONE_EFFECTS by
   *  TalentService.multiplier(). */
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

export interface TalentDefinition {
  /** Stable id, e.g. 'trunk-1', 'a-dead-2', 'nexus' - never rename (it's the prerequisite
   *  graph's own vocabulary, not just a debug label - also the Gem Socket save format's key). */
  id: string
  /** Purely an internal wiring tag (which hand-authored segment a node came from) - never
   *  surfaced to the player as a named category (no legend, no per-segment color; see
   *  talentTreeMeta.tsx, which colors/icons every regular node the same way regardless of this). */
  branch: string
  /** ALL listed ids must be owned (level>0) before this node unlocks. Empty = always unlockable. */
  prerequisites: string[]
  /** Layout coordinate for the SVG tree renderer (TalentClusterPanel.tsx) - one shared coordinate
   *  space for the WHOLE tree: row 0 is the Grand Nexus at the very top, the highest row number
   *  is the trunk's first node at the very bottom - the tree reads bottom-to-top. */
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

/** Per-node-role bonus formula: a root is a cheap, weak opener (the trunk); a fork is the main
 *  per-level pace (every regular climbing node); a merge rewards successfully converging two
 *  paths back into one with a stronger multi-level bonus; a keystone is one big single-level
 *  spike (used both for the top of a long climb AND for a short dead-end's own payoff - see
 *  buildDefaultTalents); a gem carries no bonus of its own - its "level" (0 or 1) only tracks
 *  whether the slot is unlocked. */
const ROLE_FORMULA = {
  root: { firstLevelBonus: 0.03, bonusPerLevel: 0.015, maxLevel: 4 },
  fork: { firstLevelBonus: 0.04, bonusPerLevel: 0.02, maxLevel: 5 },
  merge: { firstLevelBonus: 0.07, bonusPerLevel: 0.03, maxLevel: 5 },
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

function node(id: string, branch: string, prerequisites: string[], pos: { col: number; row: number }, effect: TalentEffect, role: NodeRole): TalentDefinition {
  return { id, branch, prerequisites, pos, effect, displayName: EFFECT_LABEL[effect], description: EFFECT_DESCRIPTION[effect], ...ROLE_FORMULA[role] }
}

type Step = { effect: TalentEffect } | { gem: true }

/** Alternates between two effects for `count` point nodes, dropping a Gem Socket in right after
 *  the point node at each index listed in `gemAfter` (1-based). */
function alternatingSteps(a: TalentEffect, b: TalentEffect, count: number, gemAfter: number[] = []): Step[] {
  const steps: Step[] = []
  for (let i = 1; i <= count; i++) {
    steps.push({ effect: i % 2 === 1 ? a : b })
    if (gemAfter.includes(i)) steps.push({ gem: true })
  }
  return steps
}

/** Builds a straight run of nodes from `steps`, chaining each to the previous (or to `prereq`
 *  for the first one), climbing one row per step. Returns the last node's id and the next free
 *  row so callers can continue the chain (a fork, a merge, another run) without hand-computing
 *  row numbers. */
function buildRun(idPrefix: string, branch: string, col: number, prereq: string, startRow: number, steps: Step[], role: NodeRole = 'fork'): { defs: TalentDefinition[]; lastId: string; nextRow: number } {
  const defs: TalentDefinition[] = []
  let prev = prereq
  let row = startRow
  let pointCount = 0
  let gemCount = 0
  for (const step of steps) {
    if ('gem' in step) {
      gemCount++
      const id = `${idPrefix}-gem-${gemCount}`
      defs.push(node(id, branch, [prev], { col, row }, TalentEffect.GemSocket, 'gem'))
      prev = id
    } else {
      pointCount++
      const id = `${idPrefix}-${pointCount}`
      defs.push(node(id, branch, [prev], { col, row }, step.effect, role))
      prev = id
    }
    row--
  }
  return { defs, lastId: prev, nextRow: row }
}

/**
 * A hand-authored lattice, not a single repeated template - the branch count moves both up AND
 * down as it climbs, and two short dead ends let a small investment stand on its own instead of
 * demanding the player commit all the way to the top:
 *
 *                                    nexus
 *                    final-a-keystone      final-b-keystone
 *                           |                     |
 *                  (12 nodes, 2 gems)     (12 nodes, 2 gems)
 *                           |                     |
 *                     final-a-1             final-b-1     merge-dead (single node, terminal -
 *                            \                  /           take just this one and stop)
 *                             \                /                  |
 *                              \              /                core-merge
 *                               \            /                 /
 *                                core-merge (requires BOTH lane tops)
 *                               /                            \
 *                        [lane A: 8 nodes]              [lane B: 8 nodes]
 *                         /         \                          |
 *                  a-dead-1,2   (continues, 5 more)             |
 *                  (terminal,    /                              |
 *                   2 nodes)    /                                |
 *                       (3 shared nodes)                         |
 *                           |                                    |
 *                        wing-a                               wing-b
 *                              \                              /
 *                               \____________ trunk-5 ________/
 *                                                 |
 *                                              trunk-1..4
 *
 * Branch count over the climb: 1 (trunk) -> 2 (wings) -> 3 (lane A's own early fork adds a third
 * live path, one of which - a-dead - terminates almost immediately) -> 1 (core-merge, a real
 * reconvergence, not just more forking) -> 3 again (final-a, final-b, and merge-dead, which also
 * terminates immediately) -> 2 (only final-a/final-b continue) -> 1 (nexus).
 */
export function buildDefaultTalents(): TalentDefinition[] {
  const defs: TalentDefinition[] = []

  // Trunk: 5 cheap nodes, shared by every path - nothing here commits you to anything yet.
  defs.push(node('trunk-1', 'trunk', [], { col: 3, row: 30 }, TalentEffect.Capstone, 'root'))
  defs.push(node('trunk-2', 'trunk', ['trunk-1'], { col: 3, row: 29 }, TalentEffect.Capstone, 'root'))
  defs.push(node('trunk-3', 'trunk', ['trunk-2'], { col: 3, row: 28 }, TalentEffect.Capstone, 'root'))
  defs.push(node('trunk-4', 'trunk', ['trunk-3'], { col: 3, row: 27 }, TalentEffect.Capstone, 'root'))
  defs.push(node('trunk-5', 'trunk', ['trunk-4'], { col: 3, row: 26 }, TalentEffect.Capstone, 'root'))

  // First fork: two wings.
  defs.push(node('wing-a', 'trunk', ['trunk-5'], { col: 1.5, row: 25 }, TalentEffect.Capstone, 'fork'))
  defs.push(node('wing-b', 'trunk', ['trunk-5'], { col: 4.5, row: 25 }, TalentEffect.Capstone, 'fork'))

  // Lane A: 3 shared nodes, THEN its own early fork into [continue, 5 more] + [a short dead
  // end, 2 nodes, terminal - a real "just take this one path and stop" option].
  const a1 = buildRun('a1', 'a', 1.5, 'wing-a', 24, alternatingSteps(TalentEffect.TapDamage, TalentEffect.TapCritChance, 3))
  defs.push(...a1.defs)
  const a2 = buildRun('a2', 'a', 0.8, a1.lastId, a1.nextRow, alternatingSteps(TalentEffect.TapCritChance, TalentEffect.TapDamage, 5))
  defs.push(...a2.defs)
  const aDead = buildRun('a-dead', 'a-dead', 2.3, a1.lastId, a1.nextRow, [{ effect: TalentEffect.ShipCritChance }], 'fork')
  defs.push(...aDead.defs)
  defs.push(node('a-dead-2', 'a-dead', [aDead.lastId], { col: 2.3, row: aDead.nextRow }, TalentEffect.ShipCritChance, 'keystone'))

  // Lane B: straight, no internal fork - the asymmetry with Lane A is deliberate.
  const b = buildRun('b', 'b', 4.5, 'wing-b', 24, alternatingSteps(TalentEffect.Gold, TalentEffect.XpGain, 8))
  defs.push(...b.defs)

  // Reconvergence: branch count drops from 2 live paths (a2, b) back to 1. A real merge, not
  // just more forking.
  defs.push(node('core-merge', 'merge', [a2.lastId, b.lastId], { col: 2.65, row: b.nextRow - 1 }, TalentEffect.Capstone, 'merge'))
  const afterMergeRow = b.nextRow - 2

  // Second fork, into 3: two long final climbs, plus another short dead end right off the merge.
  defs.push(node('merge-dead', 'merge-dead', ['core-merge'], { col: 2.65, row: afterMergeRow }, TalentEffect.OfflineReward, 'keystone'))

  const finalA = buildRun('final-a', 'final-a', 1.2, 'core-merge', afterMergeRow, alternatingSteps(TalentEffect.Dps, TalentEffect.OfflineReward, 12, [2, 5]))
  defs.push(...finalA.defs)
  defs.push(node('final-a-keystone', 'final-a', [finalA.lastId], { col: 1.2, row: finalA.nextRow }, TalentEffect.Dps, 'keystone'))

  const finalB = buildRun('final-b', 'final-b', 4.1, 'core-merge', afterMergeRow, alternatingSteps(TalentEffect.RelicGain, TalentEffect.XpGain, 12, [2, 5]))
  defs.push(...finalB.defs)
  defs.push(node('final-b-keystone', 'final-b', [finalB.lastId], { col: 4.1, row: finalB.nextRow }, TalentEffect.RelicGain, 'keystone'))

  const nexusRow = Math.min(finalA.nextRow, finalB.nextRow) - 1
  defs.push({
    id: 'nexus',
    branch: 'nexus',
    prerequisites: ['final-a-keystone', 'final-b-keystone'],
    pos: { col: 2.65, row: nexusRow },
    effect: TalentEffect.Capstone,
    displayName: 'Grand Nexus',
    description: 'Two hard-won paths converge - a lasting echo of total mastery.',
    firstLevelBonus: 0.05,
    bonusPerLevel: 0,
    maxLevel: 1,
  })

  return defs
}

/** Fractional bonus at a given level (0 for level <= 0) - same formula as artifactBonusAt. */
export function talentBonusAt(def: TalentDefinition, level: number): number {
  return level <= 0 ? 0 : def.firstLevelBonus + (level - 1) * def.bonusPerLevel
}

/**
 * Whether node i's prerequisites are met: every id in its `prerequisites` list must be owned
 * (level>0). A node with no prerequisites is always unlockable. Supports true multi-prerequisite
 * merge nodes (2+ ids at once, e.g. core-merge requiring both lane tops), not just a linear chain.
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
