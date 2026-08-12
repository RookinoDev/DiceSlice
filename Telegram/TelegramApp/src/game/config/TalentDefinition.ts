// Talent tree node catalog. Mirrors ArtifactDefinition.ts's def+formula shape: static data here,
// level-tracking + spending logic lives in gameplay/TalentService.ts.
//
// Phase 1 of a larger design (see the "Stellar Breaker talent tree" design doc): 5 named,
// creatively-flavored branches (Cannon, Fleet, Core, Salvage, Warp) each with real identity, plus
// 5 cross-branch combo talents. Every talent's flavor/mechanic description matches the full
// design, but only the ones that map cleanly onto stats this game already tracks (tap damage,
// fleet DPS, gold, offline reward, crit chance, relic gain) carry a real numeric bonus in this
// phase - Core's whole branch (an energy-for-active-skills resource that doesn't exist yet) uses
// the Capstone sentinel as an honest "boosts a bit of everything for now" placeholder until that
// system is built. Combat Rhythm's real combo-counter, Armor Fracture's real debuff, Ricochet's
// real bounce, etc. are the same story: the node exists, is buyable, and does something useful
// today, but the bespoke mechanic in its description is a later phase.
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
  /** Sentinel for a small "boosts nearly everything" node - used here for the whole Core Engine
   *  branch, whose real payoff (an energy resource for active skills) doesn't exist yet: never
   *  matched by the per-stat aggregation loop directly, but summed into every one of
   *  CAPSTONE_EFFECTS by TalentService.multiplier(). */
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

/** The tree's 5 named branches - real identity here, unlike the previous uncategorized design:
 *  each is a distinct playstyle (see the design doc), shown to the player as a labeled section. */
export type TalentBranch = 'cannon' | 'fleet' | 'core' | 'salvage' | 'warp'
/** Ring order - also the order combo talents bridge (cannon-fleet, fleet-core, core-salvage,
 *  salvage-warp, warp-cannon wraps back to the start). */
export const BRANCH_ORDER: TalentBranch[] = ['cannon', 'fleet', 'core', 'salvage', 'warp']
export const BRANCH_LABEL: Record<TalentBranch, string> = {
  cannon: 'VANGUARD CANNON',
  fleet: 'AUTONOMOUS FLEET',
  core: 'CORE ENGINE',
  salvage: 'GALACTIC SALVAGE',
  warp: 'WARP COMMAND',
}
export const BRANCH_COLOR: Record<TalentBranch, string> = {
  cannon: '#FF6B6B',
  fleet: '#43DDEE',
  core: '#B07CFF',
  salvage: '#FFD873',
  warp: '#7CFFB2',
}

export interface TalentDefinition {
  /** Stable id, e.g. 'cannon-pulse-amplifier', 'combo-cannon-fleet' - never rename (also the Gem
   *  Socket save format's key). */
  id: string
  branch: TalentBranch | 'combo'
  /** Unlocked once TOTAL points spent in each listed branch reaches its threshold - not a
   *  prerequisite graph. A tier-1 node has an empty array (always unlockable); a combo talent
   *  lists both of the branches it bridges, each needing its own threshold. */
  unlockRequirements: Array<{ branch: TalentBranch; points: number }>
  effect: TalentEffect
  /** The talent's real, creative name (e.g. "Nova Lance") - the whole point of this design is
   *  each talent having real personality, not a generic effect label. */
  displayName: string
  /** The talent's full intended mechanic, even where the mechanic itself is a later phase - see
   *  the file header. */
  description: string
  /** Bonus granted immediately at level 1 (e.g. 0.045 = +4.5%). 0 for a Gem Socket node. */
  firstLevelBonus: number
  /** Additional bonus per level beyond level 1. */
  bonusPerLevel: number
  maxLevel: number
  /** True only for the 5 branch capstones (Nova Lance, Hive Carrier, ...) - the UI gives these a
   *  bigger, distinct treatment, same idea as the old single Grand Nexus card. */
  isCapstone: boolean
  /** 'sqrt' = firstLevelBonus + bonusPerLevel * sqrt(level - 1) instead of the normal linear
   *  formula - undefined/omitted means linear (every existing node). Only used by Eternal Drive
   *  (see below): a node with no real maxLevel needs sub-linear growth, or a player who dumps
   *  every future point into just this one node would eventually dwarf the rest of the tree. */
  curve?: 'sqrt'
  /** True only for Eternal Drive - maxLevel is a large placeholder, not a real ceiling; the UI
   *  hides the "/maxLevel" fraction and never shows it as maxed. */
  unbounded?: boolean
}

/** Per-node-role bonus formula. A regular talent runs 5 ranks at the main pace; a "special" runs
 *  only 3 (matching the design doc's own split) at a slightly punchier per-level rate, so its
 *  smaller rank count doesn't read as strictly weaker; a keystone is a branch's capstone - one
 *  big single-level payoff; a gem carries no bonus of its own - its "level" (0 or 1) only tracks
 *  whether the slot is unlocked. */
const ROLE_FORMULA = {
  regular: { firstLevelBonus: 0.04, bonusPerLevel: 0.02, maxLevel: 5 },
  special: { firstLevelBonus: 0.06, bonusPerLevel: 0.03, maxLevel: 3 },
  keystone: { firstLevelBonus: 0.15, bonusPerLevel: 0, maxLevel: 1 },
  gem: { firstLevelBonus: 0, bonusPerLevel: 0, maxLevel: 1 },
} as const
type NodeRole = keyof typeof ROLE_FORMULA

/** What each effect actually DOES, e.g. "Tap Damage" - the tree shows this as a node's primary
 *  label instead of its flavor name (see TalentNode.tsx), so a glance tells you what you're
 *  investing in. The flavor name (displayName) is still real data - used for e.g. Gem Socket's
 *  own label - just not what's shown on a regular talent's face. */
export const EFFECT_LABEL: Record<TalentEffect, string> = {
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

interface TalentSpec {
  localId: string
  displayName: string
  description: string
  effect: TalentEffect
  role: Exclude<NodeRole, 'gem'>
}

interface BranchSpec {
  id: TalentBranch
  /** 4 tiers, 2 talents each - gated by cumulative points spent in THIS branch (0/5/12/22). */
  tiers: [TalentSpec, TalentSpec][]
  capstone: TalentSpec
}

const TIER_THRESHOLDS = [0, 5, 12, 22]
const CAPSTONE_THRESHOLD = 35
/** Two Gem Sockets per branch, unlocked alongside tier 2 and tier 4 - early and late access to
 *  card synergy as you climb. */
const GEM_THRESHOLDS = [5, 22]

function buildBranch(spec: BranchSpec): TalentDefinition[] {
  const defs: TalentDefinition[] = []
  spec.tiers.forEach((pair, tierIdx) => {
    const points = TIER_THRESHOLDS[tierIdx]
    for (const t of pair) {
      defs.push({
        id: `${spec.id}-${t.localId}`,
        branch: spec.id,
        unlockRequirements: points > 0 ? [{ branch: spec.id, points }] : [],
        effect: t.effect,
        displayName: t.displayName,
        description: t.description,
        isCapstone: false,
        ...ROLE_FORMULA[t.role],
      })
    }
  })
  defs.push({
    id: `${spec.id}-${spec.capstone.localId}`,
    branch: spec.id,
    unlockRequirements: [{ branch: spec.id, points: CAPSTONE_THRESHOLD }],
    effect: spec.capstone.effect,
    displayName: spec.capstone.displayName,
    description: spec.capstone.description,
    isCapstone: true,
    ...ROLE_FORMULA[spec.capstone.role],
  })
  GEM_THRESHOLDS.forEach((points, i) => {
    defs.push({
      id: `${spec.id}-gem-${i + 1}`,
      branch: spec.id,
      unlockRequirements: [{ branch: spec.id, points }],
      effect: TalentEffect.GemSocket,
      displayName: EFFECT_LABEL[TalentEffect.GemSocket],
      description: 'Socket an owned card here to channel its power.',
      isCapstone: false,
      ...ROLE_FORMULA.gem,
    })
  })
  return defs
}

const CANNON: BranchSpec = {
  id: 'cannon',
  tiers: [
    [
      { localId: 'pulse-amplifier', displayName: 'Pulse Amplifier', description: 'Increases tap damage per rank.', effect: TalentEffect.TapDamage, role: 'regular' },
      { localId: 'precision-optics', displayName: 'Precision Optics', description: 'Increases tap crit chance and crit damage per rank.', effect: TalentEffect.TapCritChance, role: 'regular' },
    ],
    [
      {
        localId: 'combat-rhythm',
        displayName: 'Combat Rhythm',
        description: 'Consecutive taps under 0.7s build a combo stack, each adding tap damage (Phase 2: real combo counter).',
        effect: TalentEffect.TapDamage,
        role: 'regular',
      },
      {
        localId: 'armor-fracture',
        displayName: 'Armor Fracture',
        description: "Every 15 taps, cracks the target's armor for 5s (Phase 2: real armor debuff) - for now, boosts tap damage.",
        effect: TalentEffect.TapDamage,
        role: 'regular',
      },
    ],
    [
      {
        localId: 'ricochet-protocol',
        displayName: 'Ricochet Protocol',
        description: 'Crits have a chance to bounce to another target (Phase 2: real ricochet) - for now, boosts crit chance.',
        effect: TalentEffect.TapCritChance,
        role: 'special',
      },
      {
        localId: 'core-lock',
        displayName: 'Core Lock',
        description: "5 crits in 3s exposes the enemy's core for 4s, boosting tap damage (Phase 2: real core-lock window).",
        effect: TalentEffect.TapDamage,
        role: 'regular',
      },
    ],
    [
      {
        localId: 'thermal-overrun',
        displayName: 'Thermal Overrun',
        description: 'Every ~30-40 taps, fires a huge heat-wave shot (Phase 2: real periodic burst) - for now, boosts tap damage.',
        effect: TalentEffect.TapDamage,
        role: 'special',
      },
      {
        localId: 'execution-beam',
        displayName: 'Execution Beam',
        description: 'Tap damage against targets under 25% HP is increased.',
        effect: TalentEffect.TapDamage,
        role: 'regular',
      },
    ],
  ],
  capstone: {
    localId: 'nova-lance',
    displayName: 'Nova Lance',
    description: 'Every 100 taps, charges a Nova shot: 5000% tap damage, always crits, exposes the core for 6s, banks up to 60 taps into the next stage (Phase 2: real charge-up). For now, a permanent tap damage spike.',
    effect: TalentEffect.TapDamage,
    role: 'keystone',
  },
}

const FLEET: BranchSpec = {
  id: 'fleet',
  tiers: [
    [
      { localId: 'autonomous-turrets', displayName: 'Autonomous Turrets', description: "Increases the fleet's automatic damage per rank.", effect: TalentEffect.Dps, role: 'regular' },
      { localId: 'drone-hangar', displayName: 'Drone Hangar', description: 'Increases drone damage per rank; adds a drone at ranks 3 and 5 (Phase 2: real drone count).', effect: TalentEffect.Dps, role: 'regular' },
    ],
    [
      {
        localId: 'synchronized-volley',
        displayName: 'Synchronized Volley',
        description: 'Every 8s, every drone fires at once (Phase 2: real timed volley) - for now, boosts fleet DPS.',
        effect: TalentEffect.Dps,
        role: 'regular',
      },
      {
        localId: 'replicator-nanites',
        displayName: 'Replicator Nanites',
        description: 'Chance to spawn a temporary drone on kill (Phase 2: real temp drones) - for now, boosts fleet DPS.',
        effect: TalentEffect.Dps,
        role: 'special',
      },
    ],
    [
      { localId: 'priority-targeting', displayName: 'Priority Targeting', description: 'Drones deal bonus damage to bosses and elites.', effect: TalentEffect.Dps, role: 'regular' },
      {
        localId: 'echo-command',
        displayName: 'Echo Command',
        description: 'Every 15 taps, drones fire a small volley (Phase 2: real tap-linked volley) - for now, boosts fleet DPS.',
        effect: TalentEffect.Dps,
        role: 'regular',
      },
    ],
    [
      {
        localId: 'adaptive-formation',
        displayName: 'Adaptive Formation',
        description: 'Choose a drone formation - Aggressive, Siege, or Patrol (Phase 2: real formation choice). For now, a flat fleet power boost.',
        effect: TalentEffect.Dps,
        role: 'keystone',
      },
      { localId: 'deep-space-patrol', displayName: 'Deep-Space Patrol', description: 'Increases offline earning duration and offline damage efficiency per rank.', effect: TalentEffect.OfflineReward, role: 'regular' },
    ],
  ],
  capstone: {
    localId: 'hive-carrier',
    displayName: 'Hive Carrier',
    description: 'Every 20s, drones merge into a mini-carrier for 6s: 2.5x drone damage, double volleys, boss targeting always on (Phase 2: real transform). For now, a permanent fleet DPS spike.',
    effect: TalentEffect.Dps,
    role: 'keystone',
  },
}

const CORE: BranchSpec = {
  id: 'core',
  tiers: [
    [
      { localId: 'expanded-reactor', displayName: 'Expanded Reactor', description: 'Increases max energy per rank (Phase 2: real energy pool).', effect: TalentEffect.Capstone, role: 'regular' },
      { localId: 'flux-recharge', displayName: 'Flux Recharge', description: 'Increases energy regen speed per rank (Phase 2: real energy pool).', effect: TalentEffect.Capstone, role: 'regular' },
    ],
    [
      { localId: 'thermal-recycling', displayName: 'Thermal Recycling', description: 'Reduces active skill cooldowns per rank.', effect: TalentEffect.Capstone, role: 'regular' },
      { localId: 'sustained-overdrive', displayName: 'Sustained Overdrive', description: 'Increases active skill duration per rank.', effect: TalentEffect.Capstone, role: 'regular' },
    ],
    [
      {
        localId: 'chain-reaction',
        displayName: 'Chain Reaction',
        description: 'Using two different skills within 4s empowers the second (Phase 2: real chain bonus) - for now, a small universal boost.',
        effect: TalentEffect.Capstone,
        role: 'regular',
      },
      {
        localId: 'emergency-cell',
        displayName: 'Emergency Cell',
        description: 'First time energy drops below 10% in a boss fight, refunds some energy (Phase 2: real energy pool) - for now, a small universal boost.',
        effect: TalentEffect.Capstone,
        role: 'special',
      },
    ],
    [
      {
        localId: 'superconductive-grid',
        displayName: 'Superconductive Grid',
        description: 'Each active skill used after the first strengthens all skills (Phase 2: real chain scaling) - for now, a small universal boost.',
        effect: TalentEffect.Capstone,
        role: 'regular',
      },
      {
        localId: 'time-lock',
        displayName: 'Time Lock',
        description: 'The first skill used in a boss fight briefly holds the boss timer (Phase 2: real time lock) - for now, a small universal boost.',
        effect: TalentEffect.Capstone,
        role: 'special',
      },
    ],
  ],
  capstone: {
    localId: 'infinite-core',
    displayName: 'Infinite Core',
    description: "If energy holds at 100% for 3s, triggers an 8s Infinite Core burst: free skill casts, 3x faster cooldowns, +25% skill power, once per 90s (Phase 2: real energy pool). For now, a permanent universal boost.",
    effect: TalentEffect.Capstone,
    role: 'keystone',
  },
}

const SALVAGE: BranchSpec = {
  id: 'salvage',
  tiers: [
    [
      { localId: 'salvage-lasers', displayName: 'Salvage Lasers', description: 'Increases Stardust earned from every kill per rank.', effect: TalentEffect.Gold, role: 'regular' },
      { localId: 'tractor-array', displayName: 'Tractor Array', description: 'Auto-collects Stardust; chaining pickups increases their value (Phase 2: real loot chain).', effect: TalentEffect.Gold, role: 'regular' },
    ],
    [
      { localId: 'rare-signal-scanner', displayName: 'Rare Signal Scanner', description: 'Increases rare drop chance and value per rank (Phase 2: real loot rarity).', effect: TalentEffect.Gold, role: 'regular' },
      {
        localId: 'bounty-matrix',
        displayName: 'Bounty Matrix',
        description: 'Every 20 stages, a bounty target appears - killing it fast pays extra (Phase 2: real bounty targets).',
        effect: TalentEffect.Gold,
        role: 'regular',
      },
    ],
    [
      { localId: 'recycling-forge', displayName: 'Recycling Forge', description: 'Duplicate parts convert to more Scrap; module upgrades cost less (Phase 2: real crafting economy).', effect: TalentEffect.Gold, role: 'regular' },
      { localId: 'efficient-assembly', displayName: 'Efficient Assembly', description: 'Reduces ship/module upgrade costs per rank (Phase 2: real upgrade discount).', effect: TalentEffect.Gold, role: 'regular' },
    ],
    [
      {
        localId: 'golden-route',
        displayName: 'Golden Route',
        description: 'After a boss kill, triggers a Gold Rush window: faster spawns, more Stardust (Phase 2: real Gold Rush event).',
        effect: TalentEffect.Gold,
        role: 'special',
      },
      {
        localId: 'smuggler-beacon',
        displayName: 'Smuggler Beacon',
        description: 'At the start of each Ascension, special offers appear, purchasable with that run\'s Stardust (Phase 2: real offer shop).',
        effect: TalentEffect.Gold,
        role: 'special',
      },
    ],
  ],
  capstone: {
    localId: 'dyson-harvest',
    displayName: 'Dyson Harvest',
    description: 'Every 50 stages, converts destroyed planets into an energy source: 3x income, +50% module drops, no stage transition delay, for the next 10 stages (Phase 2: real Dyson event). For now, a permanent Stardust spike.',
    effect: TalentEffect.Gold,
    role: 'keystone',
  },
}

const WARP: BranchSpec = {
  id: 'warp',
  tiers: [
    [
      { localId: 'warp-navigation', displayName: 'Warp Navigation', description: 'Reduces the delay between stages per rank (Phase 2: real transition speed) - for now, boosts Relic Gain.', effect: TalentEffect.RelicGain, role: 'regular' },
      { localId: 'first-strike-protocol', displayName: 'First Strike Protocol', description: "Boosts all damage in an enemy's first 4 seconds per rank (Phase 2: real timing window) - for now, boosts fleet DPS.", effect: TalentEffect.Dps, role: 'regular' },
    ],
    [
      { localId: 'gravity-snare', displayName: 'Gravity Snare', description: 'Increases the boss timer per rank.', effect: TalentEffect.RelicGain, role: 'regular' },
      {
        localId: 'hyperlane-momentum',
        displayName: 'Hyperlane Momentum',
        description: 'Clearing a stage in under 4s builds Momentum stacks, each boosting damage (Phase 2: real momentum system) - for now, boosts fleet DPS.',
        effect: TalentEffect.Dps,
        role: 'regular',
      },
    ],
    [
      {
        localId: 'rift-skip',
        displayName: 'Rift Skip',
        description: 'Chance to skip the next normal stage and still collect most of its reward (Phase 2: real stage skip) - for now, boosts Relic Gain.',
        effect: TalentEffect.RelicGain,
        role: 'regular',
      },
      {
        localId: 'temporal-insurance',
        displayName: 'Temporal Insurance',
        description: 'Losing to a boss retains a portion of your Warp Momentum (Phase 2: real momentum system) - for now, boosts Relic Gain.',
        effect: TalentEffect.RelicGain,
        role: 'special',
      },
    ],
    [
      {
        localId: 'anomaly-hunter',
        displayName: 'Anomaly Hunter',
        description: 'Every 25 stages, increases the chance of a rare event stage with bonus loot and Relics (Phase 2: real event stages) - for now, boosts Relic Gain.',
        effect: TalentEffect.RelicGain,
        role: 'regular',
      },
      {
        localId: 'paradox-echo',
        displayName: 'Paradox Echo',
        description: "After Ascension, a portion of last run's peak DPS carries over temporarily (Phase 2: real DPS echo) - for now, boosts Relic Gain.",
        effect: TalentEffect.RelicGain,
        role: 'special',
      },
    ],
  ],
  capstone: {
    localId: 'chrono-collapse',
    displayName: 'Chrono Collapse',
    description: 'Killing a boss with over 50% of its timer left instantly clears the next 2 normal stages with full rewards, keeping Warp Momentum - 45s cooldown (Phase 2: real instant-clear). For now, a permanent Relic Gain spike.',
    effect: TalentEffect.RelicGain,
    role: 'keystone',
  },
}

const BRANCH_SPECS: Record<TalentBranch, BranchSpec> = { cannon: CANNON, fleet: FLEET, core: CORE, salvage: SALVAGE, warp: WARP }

interface ComboSpec {
  id: string
  branches: [TalentBranch, TalentBranch]
  displayName: string
  description: string
  effect: TalentEffect
}

/** 5 combo talents, one per adjacent pair in the branch ring, each requiring 12 points already
 *  spent in BOTH neighboring branches - a real cross-branch investment, not just a deeper single
 *  branch. 3 ranks each, matching the design doc. */
const COMBO_REQUIRED_POINTS = 12
const COMBOS: ComboSpec[] = [
  {
    id: 'combo-cannon-fleet',
    branches: ['cannon', 'fleet'],
    displayName: 'Mirror Fire',
    description: 'Every 10-20 taps, all drones volley together; cannon crits also raise the volley\'s crit chance (Phase 2: real synergy) - for now, boosts fleet DPS.',
    effect: TalentEffect.Dps,
  },
  {
    id: 'combo-fleet-core',
    branches: ['fleet', 'core'],
    displayName: 'Charged Swarm',
    description: 'While energy is above 80%, drones deal bonus damage; using a skill overcharges drones for 2s (Phase 2: real energy synergy) - for now, boosts fleet DPS.',
    effect: TalentEffect.Dps,
  },
  {
    id: 'combo-core-salvage',
    branches: ['core', 'salvage'],
    displayName: 'Energy Arbitrage',
    description: 'After a boss kill, unused energy converts to Stardust, boosting the boss reward (Phase 2: real energy-to-gold conversion) - for now, boosts Stardust.',
    effect: TalentEffect.Gold,
  },
  {
    id: 'combo-salvage-warp',
    branches: ['salvage', 'warp'],
    displayName: 'Loot Wormhole',
    description: 'Stages skipped by Rift Skip or Chrono Collapse still pay most of their reward, and the Bounty counter survives the skip (Phase 2: real skip-loot retention) - for now, boosts Stardust.',
    effect: TalentEffect.Gold,
  },
  {
    id: 'combo-warp-cannon',
    branches: ['warp', 'cannon'],
    displayName: 'Chrono Trigger',
    description: "Combo doesn't reset between stages, and the first tap of each stage always crits for extra damage (Phase 2: real combo/crit synergy) - for now, boosts tap crit chance.",
    effect: TalentEffect.TapCritChance,
  },
]

function buildCombo(spec: ComboSpec): TalentDefinition {
  return {
    id: spec.id,
    branch: 'combo',
    unlockRequirements: spec.branches.map((branch) => ({ branch, points: COMBO_REQUIRED_POINTS })),
    effect: spec.effect,
    displayName: spec.displayName,
    description: spec.description,
    isCapstone: false,
    ...ROLE_FORMULA.special,
  }
}

/** The tree's only node with no real ceiling - see the doc comment on buildDefaultTalents for
 *  why it exists. Always unlocked (no requirements), tagged Capstone so it stacks into the same
 *  5 stats the Core branch's universal-boost nodes do. Sub-linear (curve: 'sqrt') growth keeps a
 *  player who dumps everything here from ever dwarfing the rest of the tree: the first point
 *  alone (+2%) is worse than any real branch node's first point, so a rational player only turns
 *  here once genuinely out of better places to spend - exactly the "overflow sink" it's for. */
const ETERNAL_DRIVE: TalentDefinition = {
  id: 'eternal-drive',
  branch: 'combo',
  unlockRequirements: [],
  effect: TalentEffect.Capstone,
  displayName: 'Eternal Drive',
  description: 'Keeps compounding forever, growing slower with every rank - the place Talent Points go once every branch and combo is fully mastered.',
  firstLevelBonus: 0.02,
  bonusPerLevel: 0.015,
  maxLevel: Number.MAX_SAFE_INTEGER,
  isCapstone: false,
  curve: 'sqrt',
  unbounded: true,
}

/**
 * 5 branches (11 nodes each: 8 tier talents + 1 capstone + 2 gem sockets = 55) + 5 cross-branch
 * combo talents (3 ranks each) = 60 nodes, plus Eternal Drive = 61 total. Unlike the previous
 * id/prerequisite graph, tiers are gated purely by cumulative points spent in that SAME branch
 * (0/5/12/22, capstone at 35) - no specific node-to-node dependency, so the 2 talents within a
 * tier are always siblings, pick either or both freely. Combo talents require 12 points in BOTH
 * of the two branches they bridge.
 *
 * Max points per branch (talents only, no gems): Cannon/Core/Salvage/Warp = 37, Fleet = 35 (one
 * fewer full-strength rank on Adaptive Formation, which is capped at 1 like a keystone). Plus 5
 * combos x3 + 10 gems x1 = 25. Grand total = 37*4 + 35 + 25 = 208 - deliberately far more than a
 * realistic playthrough earns (see BalanceConfig.ts's talentXpCurve* - tuned so ~70-80 points is
 * a real, achievable milestone while fully maxing every branch stays a distant long-term goal;
 * per the design doc, if everything is completable the choices stop mattering).
 *
 * That 208 ceiling turned out to matter for real: a level-210 player (unbounded, this is an idle
 * game) reported every branch fully maxed with points still piling up uselessly. Eternal Drive
 * is the fix - once the other 208 points are spent, the 209th+ still buys something, forever.
 */
export function buildDefaultTalents(): TalentDefinition[] {
  return [...BRANCH_ORDER.flatMap((b) => buildBranch(BRANCH_SPECS[b])), ...COMBOS.map(buildCombo), ETERNAL_DRIVE]
}

/** Fractional bonus at a given level (0 for level <= 0) - same formula as artifactBonusAt, plus
 *  an optional sub-linear curve for Eternal Drive (see its own comment for why). */
export function talentBonusAt(def: TalentDefinition, level: number): number {
  if (level <= 0) return 0
  if (def.curve === 'sqrt') return def.firstLevelBonus + def.bonusPerLevel * Math.sqrt(level - 1)
  return def.firstLevelBonus + (level - 1) * def.bonusPerLevel
}

/** Total points (summed levels) spent on nodes tagged with `branch` - the sole unlock currency
 *  in this design, not specific prerequisite nodes. Includes gem sockets (they're still an
 *  investment in that branch). */
export function branchPointsSpent(defs: TalentDefinition[], levels: number[], branch: TalentBranch): number {
  let sum = 0
  for (let i = 0; i < defs.length; i++) if (defs[i].branch === branch) sum += levels[i]
  return sum
}

/** Whether node i's unlock requirements are met: every listed branch must have at least that
 *  many points already spent in it (an empty list is always unlockable - every tier-1 talent). */
export function isTalentNodeUnlocked(defs: TalentDefinition[], levels: number[], i: number): boolean {
  return defs[i].unlockRequirements.every((req) => branchPointsSpent(defs, levels, req.branch) >= req.points)
}

/** Human-readable unlock requirement for a locked node's row (mirrors artifactUnlockLabel). */
export function talentUnlockLabel(defs: TalentDefinition[], i: number): string {
  const reqs = defs[i].unlockRequirements
  if (reqs.length === 0) return ''
  return `Requires ${reqs.map((r) => `${r.points} points in ${BRANCH_LABEL[r.branch]}`).join(' and ')}`
}
