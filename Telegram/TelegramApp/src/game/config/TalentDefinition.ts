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
  /** Sentinel for the single tree-wide capstone node (Grand Nexus): never matched by the
   *  per-stat aggregation loops in TalentService (those loops filter defs by effect ===
   *  Dps/Gold/etc.), so its bonus is instead added explicitly to all of CAPSTONE_EFFECTS by
   *  TalentService's multiplier() method. */
  Capstone: 8,
  /** Sentinel for a Gem Socket slot: carries no bonus of its own (the socketed card's ability
   *  does, via a future GemSocketService - see docs/plan) - this only exists so the aggregation
   *  loops below correctly skip it, the same way they skip Capstone. */
  GemSocket: 9,
} as const

export type TalentEffect = (typeof TalentEffect)[keyof typeof TalentEffect]

/** Which stat multipliers the Grand Nexus's bonus applies to (not XpGain/crit chances - a flat
 *  "+5% to everything" reads oddly against a percentage-point crit stat, and XpGain was always
 *  excluded even in the original 4-branch tree). */
export const CAPSTONE_EFFECTS: TalentEffect[] = [TalentEffect.Dps, TalentEffect.Gold, TalentEffect.TapDamage, TalentEffect.OfflineReward, TalentEffect.RelicGain]

export type TalentCluster = 'assault' | 'armada' | 'wealth' | 'ascendant' | 'precision' | 'continuum'
export const CLUSTER_ORDER: TalentCluster[] = ['assault', 'armada', 'wealth', 'ascendant', 'precision', 'continuum']

export interface TalentDefinition {
  /** Stable id, e.g. 'assault-core', 'precision-gem-1', 'nexus' - never rename (it's the
   *  prerequisite graph's own vocabulary, not just a debug label). */
  id: string
  branch: TalentCluster | 'nexus'
  /** ALL listed ids must be owned (level>0) before this node unlocks. Empty = always unlockable.
   *  A node can require 2+ prerequisites at once (a real merge point) - see the cluster template
   *  below, where e.g. an "apex" node requires all 3 of its 3-way fork's outputs. */
  prerequisites: string[]
  /** Layout coordinate for the SVG tree renderer (TalentClusterPanel.tsx) - local to this node's
   *  own cluster panel, not a global page position. */
  pos: { col: number; row: number }
  effect: TalentEffect
  displayName: string
  description: string
  /** Bonus granted immediately at level 1 (e.g. 0.045 = +4.5%). 0 for a Gem Socket node - its
   *  "level" (0 or 1) only tracks whether the slot itself is unlocked, not a bonus of its own. */
  firstLevelBonus: number
  /** Additional bonus per level beyond level 1. */
  bonusPerLevel: number
  maxLevel: number
}

/**
 * Per-node-role bonus formula. Every cluster reuses the same 5 roles (see buildCluster below),
 * so power/investment tradeoffs read consistently across all 6 clusters: a root is a cheap, weak
 * opener; a fork is the familiar "original 25-tree" pace; a merge rewards converging two paths;
 * a keystone is one big single-level spike; a gem carries no bonus of its own (see TalentEffect.
 * GemSocket's own comment) - "level 1" just means the slot is unlocked, ready for a card.
 */
const ROLE_FORMULA = {
  root: { firstLevelBonus: 0.03, bonusPerLevel: 0.015, maxLevel: 4 },
  fork: { firstLevelBonus: 0.04, bonusPerLevel: 0.02, maxLevel: 5 },
  merge: { firstLevelBonus: 0.06, bonusPerLevel: 0.025, maxLevel: 5 },
  keystone: { firstLevelBonus: 0.12, bonusPerLevel: 0, maxLevel: 1 },
  gem: { firstLevelBonus: 0, bonusPerLevel: 0, maxLevel: 1 },
} as const
type NodeRole = keyof typeof ROLE_FORMULA

interface ClusterNodeSpec {
  /** Local id suffix - full id is `${cluster}-${localId}`. */
  localId: string
  role: NodeRole
  /** Local id(s) this node requires, or [] for the cluster's root. */
  prereqLocalIds: string[]
  pos: { col: number; row: number }
  /** Effect override for split-effect clusters (Precision/Continuum) - defaults to the
   *  cluster's primary effect. Ignored for gem-role nodes. */
  effect?: TalentEffect
  displayName: string
  description: string
}

/**
 * The shared 13-node template (11 point + 2 gem) every cluster is built from: a root, a 2-way
 * fork that reconverges, two Gem Sockets branching off that fork, a 3-way fork off the merge
 * that reconverges again, a final 2-way fork, and a keystone requiring both the last fork AND
 * both gem sockets - so maxing a cluster means investing in every path, not just racing one.
 *
 *        core
 *        /  \
 *      a1    b1
 *        \  /
 *         ab
 *        /  \
 *   gem-1    gem-2      (branch off a1/b1, not off ab - unlocked earlier, alongside the fork)
 *        |    |
 *  a2 -- b2 -- c2   (3-way fork off ab)
 *        |
 *      apex
 *      /  \
 *    d1    d2
 *      \  /
 *    keystone  (requires d1, d2, gem-1, gem-2 - every path)
 */
function buildCluster(cluster: TalentCluster, primaryEffect: TalentEffect, nodes: ClusterNodeSpec[]): TalentDefinition[] {
  return nodes.map((n) => ({
    id: `${cluster}-${n.localId}`,
    branch: cluster,
    prerequisites: n.prereqLocalIds.map((id) => `${cluster}-${id}`),
    pos: n.pos,
    effect: n.role === 'gem' ? TalentEffect.GemSocket : (n.effect ?? primaryEffect),
    displayName: n.displayName,
    description: n.description,
    ...ROLE_FORMULA[n.role],
  }))
}

const ASSAULT: ClusterNodeSpec[] = [
  { localId: 'core', role: 'root', prereqLocalIds: [], pos: { col: 1, row: 0 }, displayName: 'Ignition Sequence', description: 'Every tap starts here. +Tap Damage.' },
  { localId: 'a1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 0, row: 1 }, displayName: 'Overcharge Trigger', description: 'Redlines the cannon coils for one massive hit. +Tap Damage.' },
  { localId: 'b1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 2, row: 1 }, displayName: 'Kinetic Discipline', description: 'Every strike lands exactly where aimed. +Tap Damage.' },
  { localId: 'ab', role: 'merge', prereqLocalIds: ['a1', 'b1'], pos: { col: 1, row: 2 }, displayName: 'Twin-Barrel Convergence', description: 'Burst and precision fire as one. +Tap Damage.' },
  { localId: 'gem-1', role: 'gem', prereqLocalIds: ['a1'], pos: { col: 0, row: 3 }, displayName: 'Overcharge Socket', description: 'Socket a card here to channel its power into every tap.' },
  { localId: 'gem-2', role: 'gem', prereqLocalIds: ['b1'], pos: { col: 2, row: 3 }, displayName: 'Discipline Socket', description: 'Socket a card here to channel its power into every tap.' },
  { localId: 'a2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 0, row: 4 }, displayName: 'Fracture Cascade', description: 'Each hit cracks deeper than the last. +Tap Damage.' },
  { localId: 'b2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 1, row: 4 }, displayName: 'Piercing Rounds', description: 'Rounds bore straight through armor plating. +Tap Damage.' },
  { localId: 'c2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 2, row: 4 }, displayName: 'Warhead Optimization', description: 'Denser payloads, same trigger pull. +Tap Damage.' },
  { localId: 'apex', role: 'merge', prereqLocalIds: ['a2', 'b2', 'c2'], pos: { col: 1, row: 5 }, displayName: 'Annihilation Protocol', description: 'Nothing survives a direct hit. +Tap Damage.' },
  { localId: 'd1', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 0, row: 6 }, displayName: 'Rapid Cycling', description: 'The cannon never truly cools down. +Tap Damage.' },
  { localId: 'd2', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 2, row: 6 }, displayName: 'Terminal Velocity', description: 'Every round arrives faster than the last. +Tap Damage.' },
  {
    localId: 'keystone',
    role: 'keystone',
    prereqLocalIds: ['d1', 'd2', 'gem-1', 'gem-2'],
    pos: { col: 1, row: 7 },
    displayName: 'Total War Doctrine',
    description: 'Every gun, every hand, one purpose. +Tap Damage.',
  },
]

const ARMADA: ClusterNodeSpec[] = [
  { localId: 'core', role: 'root', prereqLocalIds: [], pos: { col: 1, row: 0 }, displayName: 'Squadron Drills', description: 'Sharper reflexes across the fleet. +Fleet DPS.' },
  { localId: 'a1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 0, row: 1 }, displayName: 'Escort Formation', description: "Ships cover each other's firing arcs. +Fleet DPS." },
  { localId: 'b1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 2, row: 1 }, displayName: 'Broadside Volley', description: 'Synchronized salvos land harder. +Fleet DPS.' },
  { localId: 'ab', role: 'merge', prereqLocalIds: ['a1', 'b1'], pos: { col: 1, row: 2 }, displayName: 'Coordinated Assault', description: 'Fleet-wide targeting uplink. +Fleet DPS.' },
  { localId: 'gem-1', role: 'gem', prereqLocalIds: ['a1'], pos: { col: 0, row: 3 }, displayName: 'Escort Socket', description: 'Socket a card here to fold its power into the fleet.' },
  { localId: 'gem-2', role: 'gem', prereqLocalIds: ['b1'], pos: { col: 2, row: 3 }, displayName: 'Volley Socket', description: 'Socket a card here to fold its power into the fleet.' },
  { localId: 'a2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 0, row: 4 }, displayName: 'Armada Tactics', description: 'Doctrine forged across a hundred sectors. +Fleet DPS.' },
  { localId: 'b2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 1, row: 4 }, displayName: 'Flanking Maneuvers', description: 'No angle is ever undefended. +Fleet DPS.' },
  { localId: 'c2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 2, row: 4 }, displayName: 'Munitions Surplus', description: "The magazines never run dry. +Fleet DPS." },
  { localId: 'apex', role: 'merge', prereqLocalIds: ['a2', 'b2', 'c2'], pos: { col: 1, row: 5 }, displayName: 'Total War Doctrine', description: 'Every ship, every gun, one purpose. +Fleet DPS.' },
  { localId: 'd1', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 0, row: 6 }, displayName: 'Reactive Armor Plating', description: 'The fleet presses the attack undeterred. +Fleet DPS.' },
  { localId: 'd2', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 2, row: 6 }, displayName: 'Overdrive Thrusters', description: 'Every ship closes to optimal range faster. +Fleet DPS.' },
  {
    localId: 'keystone',
    role: 'keystone',
    prereqLocalIds: ['d1', 'd2', 'gem-1', 'gem-2'],
    pos: { col: 1, row: 7 },
    displayName: 'Armada Ascendant',
    description: 'A fleet that fights as a single mind. +Fleet DPS.',
  },
]

const WEALTH: ClusterNodeSpec[] = [
  { localId: 'core', role: 'root', prereqLocalIds: [], pos: { col: 1, row: 0 }, displayName: "Prospector's Eye", description: 'Spots the richest debris first. +Stardust.' },
  { localId: 'a1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 0, row: 1 }, displayName: 'Trade Route Mastery', description: 'Every haul sells for more. +Stardust.' },
  { localId: 'b1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 2, row: 1 }, displayName: 'Market Manipulation', description: 'The exchange bends to your favor. +Stardust.' },
  { localId: 'ab', role: 'merge', prereqLocalIds: ['a1', 'b1'], pos: { col: 1, row: 2 }, displayName: 'Golden Harvest', description: 'Nothing goes uncollected. +Stardust.' },
  { localId: 'gem-1', role: 'gem', prereqLocalIds: ['a1'], pos: { col: 0, row: 3 }, displayName: 'Trade Socket', description: 'Socket a card here to fold its value into every haul.' },
  { localId: 'gem-2', role: 'gem', prereqLocalIds: ['b1'], pos: { col: 2, row: 3 }, displayName: 'Market Socket', description: 'Socket a card here to fold its value into every haul.' },
  { localId: 'a2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 0, row: 4 }, displayName: 'Salvage Rights', description: 'Even the wreckage is worth something. +Stardust.' },
  { localId: 'b2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 1, row: 4 }, displayName: 'Bulk Contracts', description: 'Volume buyers never ask twice. +Stardust.' },
  { localId: 'c2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 2, row: 4 }, displayName: 'Insider Routes', description: 'The best prices never reach the public exchange. +Stardust.' },
  { localId: 'apex', role: 'merge', prereqLocalIds: ['a2', 'b2', 'c2'], pos: { col: 1, row: 5 }, displayName: 'Monopoly Doctrine', description: 'The sector economy answers to you. +Stardust.' },
  { localId: 'd1', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 0, row: 6 }, displayName: 'Compound Interest', description: 'Wealth that grows itself. +Stardust.' },
  { localId: 'd2', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 2, row: 6 }, displayName: 'Tax Haven Registry', description: 'Every haul, untouched by tariffs. +Stardust.' },
  {
    localId: 'keystone',
    role: 'keystone',
    prereqLocalIds: ['d1', 'd2', 'gem-1', 'gem-2'],
    pos: { col: 1, row: 7 },
    displayName: "Midas's Ledger",
    description: 'Everything you touch, eventually, pays out. +Stardust.',
  },
]

const ASCENDANT: ClusterNodeSpec[] = [
  { localId: 'core', role: 'root', prereqLocalIds: [], pos: { col: 1, row: 0 }, displayName: 'Quick Study', description: 'Lessons land faster. +XP gain.' },
  { localId: 'a1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 0, row: 1 }, displayName: 'Combat Instincts', description: 'Every fight teaches something new. +XP gain.' },
  { localId: 'b1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 2, row: 1 }, displayName: 'Battle Wisdom', description: 'Experience compounds on experience. +XP gain.' },
  { localId: 'ab', role: 'merge', prereqLocalIds: ['a1', 'b1'], pos: { col: 1, row: 2 }, displayName: "Veteran's Insight", description: 'Nothing about a kill goes unlearned. +XP gain.' },
  { localId: 'gem-1', role: 'gem', prereqLocalIds: ['a1'], pos: { col: 0, row: 3 }, displayName: 'Instinct Socket', description: 'Socket a card here to learn from its every lesson.' },
  { localId: 'gem-2', role: 'gem', prereqLocalIds: ['b1'], pos: { col: 2, row: 3 }, displayName: 'Wisdom Socket', description: 'Socket a card here to learn from its every lesson.' },
  { localId: 'a2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 0, row: 4 }, displayName: 'Transcendent Focus', description: 'Growth becomes second nature. +XP gain.' },
  { localId: 'b2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 1, row: 4 }, displayName: 'Field Analysis', description: 'Every encounter is data. +XP gain.' },
  { localId: 'c2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 2, row: 4 }, displayName: 'Adaptive Doctrine', description: 'Tactics rewrite themselves after every kill. +XP gain.' },
  { localId: 'apex', role: 'merge', prereqLocalIds: ['a2', 'b2', 'c2'], pos: { col: 1, row: 5 }, displayName: 'Enlightenment', description: 'Mastery breeds mastery. +XP gain.' },
  { localId: 'd1', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 0, row: 6 }, displayName: 'Total Recall', description: 'Every lesson, permanently retained. +XP gain.' },
  { localId: 'd2', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 2, row: 6 }, displayName: 'Synthesis', description: 'Old lessons combine into new ones. +XP gain.' },
  {
    localId: 'keystone',
    role: 'keystone',
    prereqLocalIds: ['d1', 'd2', 'gem-1', 'gem-2'],
    pos: { col: 1, row: 7 },
    displayName: 'Transcendence',
    description: 'There is nothing left this fleet cannot learn. +XP gain.',
  },
]

const PRECISION: ClusterNodeSpec[] = [
  { localId: 'core', role: 'root', prereqLocalIds: [], pos: { col: 1, row: 0 }, effect: TalentEffect.TapCritChance, displayName: 'Steady Hands', description: 'The first step toward a perfect strike. +Tap Crit Chance.' },
  { localId: 'a1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 0, row: 1 }, effect: TalentEffect.TapCritChance, displayName: 'Weak-Point Targeting', description: 'Every tap looks for the seam in the armor. +Tap Crit Chance.' },
  { localId: 'b1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 2, row: 1 }, effect: TalentEffect.ShipCritChance, displayName: 'Sensor Lock Doctrine', description: "The fleet's targeting arrays sharpen. +Ship Crit Chance." },
  { localId: 'ab', role: 'merge', prereqLocalIds: ['a1', 'b1'], pos: { col: 1, row: 2 }, effect: TalentEffect.TapCritChance, displayName: 'Unified Targeting Grid', description: 'Hand and hull aim as one. +Tap Crit Chance.' },
  { localId: 'gem-1', role: 'gem', prereqLocalIds: ['a1'], pos: { col: 0, row: 3 }, displayName: 'Precision Socket', description: 'Socket a card here to sharpen every tap.' },
  { localId: 'gem-2', role: 'gem', prereqLocalIds: ['b1'], pos: { col: 2, row: 3 }, displayName: 'Targeting Socket', description: "Socket a card here to sharpen the fleet's aim." },
  { localId: 'a2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 0, row: 4 }, effect: TalentEffect.TapCritChance, displayName: 'Vital Strike Training', description: 'Some hits simply land harder than others. +Tap Crit Chance.' },
  { localId: 'b2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 1, row: 4 }, effect: TalentEffect.TapCritChance, displayName: 'Flow State', description: 'Perfect strikes start to feel inevitable. +Tap Crit Chance.' },
  { localId: 'c2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 2, row: 4 }, effect: TalentEffect.ShipCritChance, displayName: 'Predictive Fire Control', description: "The fleet fires where the target WILL be. +Ship Crit Chance." },
  { localId: 'apex', role: 'merge', prereqLocalIds: ['a2', 'b2', 'c2'], pos: { col: 1, row: 5 }, effect: TalentEffect.TapCritChance, displayName: 'Perfect Aim', description: 'Every strike, exactly where it counts. +Tap Crit Chance.' },
  { localId: 'd1', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 0, row: 6 }, effect: TalentEffect.TapCritChance, displayName: 'Killing Blow Instinct', description: 'The finishing hit always finds its mark. +Tap Crit Chance.' },
  { localId: 'd2', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 2, row: 6 }, effect: TalentEffect.ShipCritChance, displayName: 'Coordinated Barrage', description: 'The whole fleet strikes true, together. +Ship Crit Chance.' },
  {
    localId: 'keystone',
    role: 'keystone',
    prereqLocalIds: ['d1', 'd2', 'gem-1', 'gem-2'],
    pos: { col: 1, row: 7 },
    effect: TalentEffect.TapCritChance,
    displayName: "Marksman's Apex",
    description: 'Hand and fleet alike, every shot a perfect one. +Tap Crit Chance.',
  },
]

const CONTINUUM: ClusterNodeSpec[] = [
  { localId: 'core', role: 'root', prereqLocalIds: [], pos: { col: 1, row: 0 }, effect: TalentEffect.OfflineReward, displayName: 'Dormant Vaults', description: "Wealth keeps compounding while you're away. +Offline Stardust." },
  { localId: 'a1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 0, row: 1 }, effect: TalentEffect.OfflineReward, displayName: 'Perpetual Yield', description: 'An engine that never stops earning. +Offline Stardust.' },
  { localId: 'b1', role: 'fork', prereqLocalIds: ['core'], pos: { col: 2, row: 1 }, effect: TalentEffect.RelicGain, displayName: 'Echoes of Ascension', description: 'Every reset leaves a little more behind. +Relic Gain.' },
  { localId: 'ab', role: 'merge', prereqLocalIds: ['a1', 'b1'], pos: { col: 1, row: 2 }, effect: TalentEffect.OfflineReward, displayName: 'Timeless Reserves', description: 'What was earned is never truly lost. +Offline Stardust.' },
  { localId: 'gem-1', role: 'gem', prereqLocalIds: ['a1'], pos: { col: 0, row: 3 }, displayName: 'Reserve Socket', description: 'Socket a card here to keep the vaults filling.' },
  { localId: 'gem-2', role: 'gem', prereqLocalIds: ['b1'], pos: { col: 2, row: 3 }, displayName: 'Echo Socket', description: 'Socket a card here to deepen the echo of every Ascension.' },
  { localId: 'a2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 0, row: 4 }, effect: TalentEffect.OfflineReward, displayName: 'Automated Harvesters', description: 'The fleet keeps working long after you log off. +Offline Stardust.' },
  { localId: 'b2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 1, row: 4 }, effect: TalentEffect.OfflineReward, displayName: 'Extended Uptime', description: 'The engine runs longer between visits. +Offline Stardust.' },
  { localId: 'c2', role: 'fork', prereqLocalIds: ['ab'], pos: { col: 2, row: 4 }, effect: TalentEffect.RelicGain, displayName: 'Residual Convergence', description: 'Each Ascension pulls a little more from the last. +Relic Gain.' },
  { localId: 'apex', role: 'merge', prereqLocalIds: ['a2', 'b2', 'c2'], pos: { col: 1, row: 5 }, effect: TalentEffect.OfflineReward, displayName: 'Eternal Engine', description: 'An economy that runs whether you watch it or not. +Offline Stardust.' },
  { localId: 'd1', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 0, row: 6 }, effect: TalentEffect.OfflineReward, displayName: 'Unbroken Chain', description: 'The vaults have never once gone empty. +Offline Stardust.' },
  { localId: 'd2', role: 'fork', prereqLocalIds: ['apex'], pos: { col: 2, row: 6 }, effect: TalentEffect.RelicGain, displayName: 'Ascension Momentum', description: 'Each reset carries more of the last one forward. +Relic Gain.' },
  {
    localId: 'keystone',
    role: 'keystone',
    prereqLocalIds: ['d1', 'd2', 'gem-1', 'gem-2'],
    pos: { col: 1, row: 7 },
    effect: TalentEffect.OfflineReward,
    displayName: 'Beyond the Horizon',
    description: 'Time itself works in your favor now. +Offline Stardust.',
  },
]

/**
 * 79 nodes: 6 clusters x 13 nodes (11 point + 2 Gem Socket) converging on 1 Grand Nexus, each
 * cluster its own fork-merge-fork-merge lattice (see buildCluster's own diagram) rather than a
 * straight chain - real branching, not just more of the same line. Assault/Armada/Wealth/
 * Ascendant each carry one effect throughout (TapDamage/Dps/Gold/XpGain respectively) with
 * curve-shape variety between fork paths instead of effect variety; Precision and Continuum
 * split their two fork paths across two related effects (tap-crit/ship-crit,
 * offline-reward/relic-gain) the same way Artifacts already pairs TapCritChance/ShipCritChance.
 * Full max (every point node + every gem slot + the Nexus), per cluster: 1 root(max4) + 7
 * fork(max5 each) + 2 merge(max5 each) + 1 keystone(max1) + 2 gem(max1 each) = 4+35+10+1+2 = 52.
 * 6*52 + 1 (Nexus) = 313 points - see BalanceConfig.ts's talentXpCurve* constants for the level
 * curve tuned to that target.
 */
export function buildDefaultTalents(): TalentDefinition[] {
  return [
    ...buildCluster('assault', TalentEffect.TapDamage, ASSAULT),
    ...buildCluster('armada', TalentEffect.Dps, ARMADA),
    ...buildCluster('wealth', TalentEffect.Gold, WEALTH),
    ...buildCluster('ascendant', TalentEffect.XpGain, ASCENDANT),
    ...buildCluster('precision', TalentEffect.TapCritChance, PRECISION),
    ...buildCluster('continuum', TalentEffect.OfflineReward, CONTINUUM),
    {
      id: 'nexus',
      branch: 'nexus',
      prerequisites: CLUSTER_ORDER.map((c) => `${c}-keystone`),
      pos: { col: 0, row: 0 },
      effect: TalentEffect.Capstone,
      displayName: 'Grand Nexus',
      description: 'All six disciplines converge - a lasting echo of total mastery. +Fleet DPS, Stardust, Tap Damage, Offline Stardust, and Relic Gain.',
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
 * merge nodes (2+ ids at once), not just a linear chain.
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
