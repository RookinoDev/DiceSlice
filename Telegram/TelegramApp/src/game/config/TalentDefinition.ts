// Talent tree node catalog. Mirrors ArtifactDefinition.ts's def+formula shape: static data here,
// level-tracking + spending logic lives in gameplay/TalentService.ts.
//
// 5 named branches (Cannon, Fleet, Core, Salvage, Warp), each with 2-3 REAL, mechanically
// distinct sub-identities rather than one flat stat repeated across every node - the tap/ship
// crit-damage multipliers, upgrade cost discount, and boss timer bonus below were all previously
// unused or hardcoded-flat hooks already sitting in the combat/economy code (TapController.ts's
// TAP_CRIT_DAMAGE_MULTIPLIER, ShipService.ts's SHIP_CRIT_DAMAGE_MULTIPLIER, StageManager.ts's
// flat bossTimerSeconds, and no cost-reduction hook at all before this), the same "find what's
// already there and wire it up" approach Core Engine's own redesign used. Combat Rhythm's real
// combo-counter, Armor Fracture's real debuff, Ricochet's real bounce, etc. are still a later
// phase - the node exists, is buyable, and does something useful today, but the bespoke mechanic
// named in its description is future work, same as before.
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
  /** Sentinel for a small "boosts nearly everything" node - not matched by the per-stat
   *  aggregation loop directly, but summed into every one of CAPSTONE_EFFECTS by
   *  TalentService.multiplier(). Still used by 3 of Eternal Drive's random perks (see
   *  PassivePerk.ts) even though no branch node carries it anymore. */
  Capstone: 8,
  /** Sentinel for a Gem Socket slot: carries no bonus of its own (the socketed card's ability
   *  does, via GemSocketService) - this only exists so the aggregation loop skips it. */
  GemSocket: 9,
  /** Core Engine's real identity: reduces every active skill's cooldown (see
   *  SkillService.setCooldownReduction, a hook that already existed but was never wired to
   *  anything). Aggregated by SUM, not the usual multiplicative stack - see
   *  TalentService.skillCooldownReduction()'s own comment for why. */
  SkillCooldown: 10,
  /** Multiplies every timed active skill's active-buff duration (SkillService.activate()). Has
   *  no effect on Meteor Call - it's instant, never enters the active-buff state this scales. */
  SkillDuration: 11,
  /** Multiplies every active skill's own effect magnitude - Overdrive's tap-damage %, Fleet
   *  Surge's DPS %, Golden Horizon's gold %, Drone Swarm's taps/sec, Meteor Call's instant
   *  damage - via SkillService.effectValue()/activate(), the one shared computation point every
   *  skill already runs through. */
  SkillPower: 12,
  /** Sentinel for Infinite Core (Core Engine's capstone) only: counts toward SkillCooldown,
   *  SkillDuration, AND SkillPower at once, mirroring Capstone/CAPSTONE_EFFECTS but scoped to
   *  just this branch's own 3 effects instead of the tree-wide 5. */
  CoreCapstone: 13,
  /** Multiplies TapController's TAP_CRIT_DAMAGE_MULTIPLIER, previously a hardcoded flat 2x with
   *  no talent hook at all - Vanguard Cannon's 2nd sub-identity alongside TapDamage/TapCritChance. */
  TapCritDamage: 14,
  /** Multiplies ShipService's SHIP_CRIT_DAMAGE_MULTIPLIER, same idea as TapCritDamage but for
   *  fleet hits - Autonomous Fleet's 2nd sub-identity alongside Dps. */
  ShipCritDamage: 15,
  /** Additive discount on every Tap Damage and Ship upgrade's Stardust cost (TapDamageUpgrade.ts/
   *  ShipService.ts's setCostMultiplier) - Galactic Salvage's 2nd sub-identity alongside Gold.
   *  Aggregated by SUM like SkillCooldown, not the usual multiplicative stack - a discount
   *  fraction isn't a growth multiplier. */
  UpgradeCostReduction: 16,
  /** Multiplies the boss fight timer (StageManager.ts's setBossTimerMultiplier, previously a flat
   *  bossTimerSeconds with no talent hook) - Warp Command's 2nd sub-identity alongside RelicGain. */
  BossTimerBonus: 17,
} as const

export type TalentEffect = (typeof TalentEffect)[keyof typeof TalentEffect]

/** Which stat multipliers a Capstone-tagged node's bonus applies to (not XpGain/crit chances - a
 *  flat "+5% to everything" reads oddly against a percentage-point crit stat, and XpGain has
 *  always been excluded). */
export const CAPSTONE_EFFECTS: TalentEffect[] = [TalentEffect.Dps, TalentEffect.Gold, TalentEffect.TapDamage, TalentEffect.OfflineReward, TalentEffect.RelicGain]

/** Which of Core Engine's own effects a CoreCapstone-tagged node's bonus applies to - see
 *  TalentEffect.CoreCapstone's own comment. */
export const CORE_CAPSTONE_EFFECTS: TalentEffect[] = [TalentEffect.SkillCooldown, TalentEffect.SkillDuration, TalentEffect.SkillPower]

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
  [TalentEffect.SkillCooldown]: 'Skill Cooldown',
  [TalentEffect.SkillDuration]: 'Skill Duration',
  [TalentEffect.SkillPower]: 'Skill Power',
  [TalentEffect.CoreCapstone]: 'Skill Mastery',
  [TalentEffect.TapCritDamage]: 'Tap Crit Damage',
  [TalentEffect.ShipCritDamage]: 'Ship Crit Damage',
  [TalentEffect.UpgradeCostReduction]: 'Upgrade Discount',
  [TalentEffect.BossTimerBonus]: 'Boss Timer',
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

/** Vanguard Cannon's real identity: raw tap damage, tap crit chance (existing), and now tap crit
 *  DAMAGE too - TapController.ts's TAP_CRIT_DAMAGE_MULTIPLIER was a hardcoded flat 2x with no
 *  talent hook at all until this redesign. */
const CANNON: BranchSpec = {
  id: 'cannon',
  tiers: [
    [
      { localId: 'pulse-amplifier', displayName: 'Pulse Amplifier', description: 'Increases tap damage per rank.', effect: TalentEffect.TapDamage, role: 'regular' },
      { localId: 'precision-optics', displayName: 'Precision Optics', description: 'Increases tap crit chance per rank.', effect: TalentEffect.TapCritChance, role: 'regular' },
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
        description: 'Increases the damage multiplier on every critical tap per rank.',
        effect: TalentEffect.TapCritDamage,
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
        description: 'Further increases the damage multiplier on every critical tap per rank.',
        effect: TalentEffect.TapCritDamage,
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
        description: 'Further increases the damage multiplier on every critical tap per rank.',
        effect: TalentEffect.TapCritDamage,
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

/** Autonomous Fleet's real identity: fleet DPS, plus ship crit chance AND ship crit damage
 *  (ShipService.ts's SHIP_CRIT_DAMAGE_MULTIPLIER was a hardcoded flat 2x, same as tap's own -
 *  ShipCritChance itself already existed as an effect but no branch node used it until now). */
const FLEET: BranchSpec = {
  id: 'fleet',
  tiers: [
    [
      { localId: 'autonomous-turrets', displayName: 'Autonomous Turrets', description: "Increases the fleet's automatic damage per rank.", effect: TalentEffect.Dps, role: 'regular' },
      { localId: 'drone-hangar', displayName: 'Drone Hangar', description: 'Increases the chance for every fleet hit to critically strike, per rank.', effect: TalentEffect.ShipCritChance, role: 'regular' },
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
        description: 'Increases the damage multiplier on every critical fleet hit per rank.',
        effect: TalentEffect.ShipCritDamage,
        role: 'special',
      },
    ],
    [
      {
        localId: 'priority-targeting',
        displayName: 'Priority Targeting',
        description: 'Further increases the chance for every fleet hit to critically strike, per rank.',
        effect: TalentEffect.ShipCritChance,
        role: 'regular',
      },
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
        description: 'Further increases the damage multiplier on every critical fleet hit.',
        effect: TalentEffect.ShipCritDamage,
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

/** Core Engine's real identity: your 5 active skills (Overdrive Barrage, Fleet Surge, Meteor
 *  Call, Drone Swarm, Golden Horizon) come back faster, last longer, and hit harder. Every
 *  node's bonus is real and load-bearing today (see SkillService.ts) - no "Phase 2" placeholder
 *  language left in this branch. */
const CORE: BranchSpec = {
  id: 'core',
  tiers: [
    [
      { localId: 'expanded-reactor', displayName: 'Expanded Reactor', description: 'Increases the active duration of every timed skill per rank.', effect: TalentEffect.SkillDuration, role: 'regular' },
      { localId: 'flux-recharge', displayName: 'Flux Recharge', description: 'Reduces the cooldown of every active skill per rank.', effect: TalentEffect.SkillCooldown, role: 'regular' },
    ],
    [
      { localId: 'thermal-recycling', displayName: 'Thermal Recycling', description: 'Further reduces active skill cooldowns per rank.', effect: TalentEffect.SkillCooldown, role: 'regular' },
      { localId: 'sustained-overdrive', displayName: 'Sustained Overdrive', description: 'Further increases active skill duration per rank.', effect: TalentEffect.SkillDuration, role: 'regular' },
    ],
    [
      {
        localId: 'chain-reaction',
        displayName: 'Chain Reaction',
        description: 'Strengthens the effect of every active skill per rank.',
        effect: TalentEffect.SkillPower,
        role: 'regular',
      },
      {
        localId: 'emergency-cell',
        displayName: 'Emergency Cell',
        description: 'Further reduces active skill cooldowns per rank.',
        effect: TalentEffect.SkillCooldown,
        role: 'special',
      },
    ],
    [
      {
        localId: 'superconductive-grid',
        displayName: 'Superconductive Grid',
        description: 'Further strengthens the effect of every active skill per rank.',
        effect: TalentEffect.SkillPower,
        role: 'regular',
      },
      {
        localId: 'time-lock',
        displayName: 'Time Lock',
        description: 'Further increases active skill duration per rank.',
        effect: TalentEffect.SkillDuration,
        role: 'special',
      },
    ],
  ],
  capstone: {
    localId: 'infinite-core',
    displayName: 'Infinite Core',
    description: 'A permanent surge: reduces cooldowns, extends duration, and strengthens the effect of every active skill at once.',
    effect: TalentEffect.CoreCapstone,
    role: 'keystone',
  },
}

/** Galactic Salvage's real identity: Stardust income, plus an upgrade cost discount on Tap
 *  Damage and every ship's next level (TapDamageUpgrade.ts/ShipService.ts's setCostMultiplier -
 *  there was no cost-reduction hook anywhere in the economy before this). */
const SALVAGE: BranchSpec = {
  id: 'salvage',
  tiers: [
    [
      { localId: 'salvage-lasers', displayName: 'Salvage Lasers', description: 'Increases Stardust earned from every kill per rank.', effect: TalentEffect.Gold, role: 'regular' },
      { localId: 'tractor-array', displayName: 'Tractor Array', description: 'Auto-collects Stardust; chaining pickups increases their value (Phase 2: real loot chain).', effect: TalentEffect.Gold, role: 'regular' },
    ],
    [
      { localId: 'rare-signal-scanner', displayName: 'Rare Signal Scanner', description: 'Discounts every Tap Damage and ship upgrade\'s Stardust cost per rank.', effect: TalentEffect.UpgradeCostReduction, role: 'regular' },
      {
        localId: 'bounty-matrix',
        displayName: 'Bounty Matrix',
        description: 'Every 20 stages, a bounty target appears - killing it fast pays extra (Phase 2: real bounty targets).',
        effect: TalentEffect.Gold,
        role: 'regular',
      },
    ],
    [
      { localId: 'recycling-forge', displayName: 'Recycling Forge', description: 'Further discounts every Tap Damage and ship upgrade\'s Stardust cost per rank.', effect: TalentEffect.UpgradeCostReduction, role: 'regular' },
      { localId: 'efficient-assembly', displayName: 'Efficient Assembly', description: 'Further discounts every Tap Damage and ship upgrade\'s Stardust cost per rank.', effect: TalentEffect.UpgradeCostReduction, role: 'regular' },
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
        description: 'Further discounts every Tap Damage and ship upgrade\'s Stardust cost.',
        effect: TalentEffect.UpgradeCostReduction,
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

/** Warp Command's real identity: Relic Gain, plus a longer boss fight timer
 *  (StageManager.ts's setBossTimerMultiplier - bossTimerSeconds was flat, no talent hook, until
 *  this redesign) - matches what Gravity Snare's own flavor already promised. */
const WARP: BranchSpec = {
  id: 'warp',
  tiers: [
    [
      { localId: 'warp-navigation', displayName: 'Warp Navigation', description: 'Reduces the delay between stages per rank (Phase 2: real transition speed) - for now, boosts Relic Gain.', effect: TalentEffect.RelicGain, role: 'regular' },
      { localId: 'first-strike-protocol', displayName: 'First Strike Protocol', description: "Boosts all damage in an enemy's first 4 seconds per rank (Phase 2: real timing window) - for now, boosts fleet DPS.", effect: TalentEffect.Dps, role: 'regular' },
    ],
    [
      { localId: 'gravity-snare', displayName: 'Gravity Snare', description: 'Increases the boss timer per rank.', effect: TalentEffect.BossTimerBonus, role: 'regular' },
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
        description: 'Further increases the boss timer per rank.',
        effect: TalentEffect.BossTimerBonus,
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
    description: 'Activating any skill overcharges every drone for a few seconds (Phase 2: real overcharge window) - for now, boosts fleet DPS.',
    effect: TalentEffect.Dps,
  },
  {
    id: 'combo-core-salvage',
    branches: ['core', 'salvage'],
    displayName: 'Energy Arbitrage',
    description: "A skill's leftover cooldown reduction converts into a Stardust bonus on the boss kill that follows (Phase 2: real cooldown-to-gold conversion) - for now, boosts Stardust.",
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
 *  why it exists. Always unlocked (no requirements). Carries no bonus of its own (firstLevelBonus/
 *  bonusPerLevel are both 0) - every purchase instead rolls a random passive perk from
 *  PassivePerk.ts's pool and adds it to the player's own growing collection (see
 *  TalentService.grantedPerks/buyNode) rather than leveling up one fixed stat forever. */
const ETERNAL_DRIVE: TalentDefinition = {
  id: 'eternal-drive',
  branch: 'combo',
  unlockRequirements: [],
  effect: TalentEffect.Capstone,
  displayName: 'Eternal Drive',
  description: 'Every point spent here grants a random passive perk, forever - the place Talent Points go once every branch and combo is fully mastered. Long-press to see everything it\'s granted so far.',
  firstLevelBonus: 0,
  bonusPerLevel: 0,
  maxLevel: Number.MAX_SAFE_INTEGER,
  isCapstone: false,
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

/** Fractional bonus at a given level (0 for level <= 0) - same formula as artifactBonusAt. */
export function talentBonusAt(def: TalentDefinition, level: number): number {
  return level <= 0 ? 0 : def.firstLevelBonus + (level - 1) * def.bonusPerLevel
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
