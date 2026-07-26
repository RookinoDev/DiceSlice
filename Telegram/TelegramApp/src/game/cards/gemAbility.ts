// Resolves any of the 5,890 Base Cards to a Gem Socket ability: which talent stat it buffs and
// by how much when socketed into a Talent Tree Gem node (see GemSocketService, planned). Two-tier
// resolution - a hand-authored override for ~30 marquee Set 1 cards (bespoke flavor matching
// their real-world identity), else a formula derived from the card's own classification + rarity,
// so every generated card (comets, exoplanets, stars, ...) resolves too with zero per-card
// special-casing. See gemAbility.test.ts for the completeness proof over the full catalog.
import { TalentEffect } from '../config/TalentDefinition'
import type { CardRarity } from './catalog'
import { cardById } from './generatedCards'

export interface GemAbility {
  effect: TalentEffect
  /** Fractional bonus, e.g. 0.2 = +20% (or +20 percentage points for a crit-chance effect). */
  magnitude: number
  /** Short display string, e.g. "+20% Fleet DPS". */
  label: string
}

type Bucket = 'rocky' | 'minor' | 'wanderer' | 'giant' | 'star' | 'pulsar' | 'nebula' | 'galaxy' | 'singularity'

/** Thematic bucket -> talent stat. Rocky worlds hit like a fist (TapDamage), giants/galaxies
 *  bring raw mass (Dps), minor bodies are salvage value (Gold), wanderers reward curiosity
 *  (XpGain), stars burn steady in the background (OfflineReward), pulsars/nebulae sharpen aim
 *  (crit chance), singularities bend spacetime around a Stellar Ascension (RelicGain). */
const BUCKET_EFFECT: Record<Bucket, TalentEffect> = {
  rocky: TalentEffect.TapDamage,
  giant: TalentEffect.Dps,
  minor: TalentEffect.Gold,
  wanderer: TalentEffect.XpGain,
  star: TalentEffect.OfflineReward,
  pulsar: TalentEffect.TapCritChance,
  nebula: TalentEffect.ShipCritChance,
  galaxy: TalentEffect.Dps,
  singularity: TalentEffect.RelicGain,
}

/** Exact classification -> bucket for Set 1's 25 distinct hand-written strings (catalog.ts). */
const SET1_CLASSIFICATION_BUCKET: Record<string, Bucket> = {
  'Terrestrial planet': 'rocky',
  'Natural satellite': 'rocky',
  'Dwarf planet': 'rocky',
  Exoplanet: 'rocky',
  Asteroid: 'minor',
  'Trans-Neptunian object': 'minor',
  Comet: 'wanderer',
  'Interstellar object': 'wanderer',
  'Gas giant': 'giant',
  'Ice giant': 'giant',
  'Hot Jupiter': 'giant',
  'Ringed substellar object': 'giant',
  'G-type main-sequence star': 'star',
  'Red dwarf': 'star',
  'A-type star + white dwarf': 'star',
  'A-type star': 'star',
  'Orange giant': 'star',
  'Red supergiant': 'star',
  'Blue supergiant': 'star',
  Pulsar: 'pulsar',
  'Emission nebula': 'nebula',
  'Supernova remnant': 'nebula',
  'Planetary nebula': 'nebula',
  'Spiral galaxy': 'galaxy',
  'Supermassive black hole': 'singularity',
}

/** Keyword fallback for the generated roster's own classification strings (rosterCardRules.mjs's
 *  classificationForEntry produces things like "Giant exoplanet", "G-class star", bare "Nebula"/
 *  "Galaxy", none of which are literal Set 1 strings) and a safety net for anything unrecognized.
 *  Order matters: most-specific keyword first, so e.g. "Giant exoplanet" resolves as a giant
 *  rather than falling through to the generic exoplanet->rocky rule. */
function fallbackBucket(classification: string): Bucket {
  const s = classification.toLowerCase()
  if (s.includes('black hole')) return 'singularity'
  if (s.includes('pulsar')) return 'pulsar'
  if (s.includes('nebula')) return 'nebula'
  if (s.includes('galaxy')) return 'galaxy'
  if (s.includes('comet') || s.includes('interstellar')) return 'wanderer'
  if (s.includes('asteroid') || s.includes('trans-neptunian')) return 'minor'
  if (s.includes('giant') || s.includes('jupiter')) return 'giant'
  if (s.includes('exoplanet') || s.includes('planet') || s.includes('satellite')) return 'rocky'
  if (s.includes('star')) return 'star'
  return 'rocky'
}

function bucketFor(classification: string): Bucket {
  return SET1_CLASSIFICATION_BUCKET[classification] ?? fallbackBucket(classification)
}

const CRIT_BUCKETS: ReadonlySet<Bucket> = new Set<Bucket>(['pulsar', 'nebula'])

/** Magnitude table for ordinary stat-multiplier effects - a common card's Gem is a small nudge,
 *  an ultra a real spike. Deliberately a much smaller range than Talent nodes themselves (which
 *  can be leveled repeatedly): a Gem is a single fixed slot, not an investable currency sink. */
const RARITY_BONUS: Record<CardRarity, number> = {
  common: 0.03,
  uncommon: 0.05,
  rare: 0.08,
  epic: 0.12,
  legendary: 0.18,
  ultra: 0.3,
}

/** Tighter range for crit-chance effects (Pulsar/Nebula buckets) - crit chance is additive and
 *  shares a hard tree-wide cap (TalentService.TALENT_CRIT_CHANCE_CAP / GameSession.TOTAL_CRIT_CAP),
 *  so even an ultra card granting 30 percentage points on its own would be absurd. */
const CRIT_RARITY_BONUS: Record<CardRarity, number> = {
  common: 0.01,
  uncommon: 0.015,
  rare: 0.025,
  epic: 0.035,
  legendary: 0.05,
  ultra: 0.07,
}

const EFFECT_LABEL: Record<number, string> = {
  [TalentEffect.Dps]: 'Fleet DPS',
  [TalentEffect.Gold]: 'Stardust',
  [TalentEffect.TapDamage]: 'Tap Damage',
  [TalentEffect.OfflineReward]: 'Offline Stardust',
  [TalentEffect.XpGain]: 'XP Gain',
  [TalentEffect.TapCritChance]: 'Tap Crit Chance',
  [TalentEffect.ShipCritChance]: 'Ship Crit Chance',
  [TalentEffect.RelicGain]: 'Relic Gain',
}

function formatPct(magnitude: number): string {
  return `${Math.round(magnitude * 1000) / 10}%`
}

function abilityFor(effect: TalentEffect, magnitude: number): GemAbility {
  return { effect, magnitude, label: `+${formatPct(magnitude)} ${EFFECT_LABEL[effect]}` }
}

/** ~30 marquee Set 1 cards with a hand-authored ability instead of the formula - the cards a
 *  player already recognizes (Earth, Jupiter, Sagittarius A*, ...) get an ability matching their
 *  real identity, not just "rocky planet, epic rarity". Every id below is a real catalog.ts entry
 *  (id/classification/rarity all verified against the live file, not assumed). */
const BESPOKE_GEM_ABILITIES: Record<string, GemAbility> = {
  earth: abilityFor(TalentEffect.OfflineReward, 0.35),
  luna: abilityFor(TalentEffect.XpGain, 0.1),
  mars: abilityFor(TalentEffect.TapDamage, 0.1),
  jupiter: abilityFor(TalentEffect.Dps, 0.2),
  saturn: abilityFor(TalentEffect.Gold, 0.2),
  uranus: abilityFor(TalentEffect.Dps, 0.14),
  neptune: abilityFor(TalentEffect.Dps, 0.14),
  io: abilityFor(TalentEffect.TapDamage, 0.12),
  europa: abilityFor(TalentEffect.XpGain, 0.12),
  titan: abilityFor(TalentEffect.Gold, 0.12),
  enceladus: abilityFor(TalentEffect.XpGain, 0.12),
  pluto: abilityFor(TalentEffect.OfflineReward, 0.12),
  '16-psyche': abilityFor(TalentEffect.Gold, 0.14),
  'halleys-comet': abilityFor(TalentEffect.XpGain, 0.16),
  oumuamua: abilityFor(TalentEffect.XpGain, 0.2),
  'wasp-12b': abilityFor(TalentEffect.Dps, 0.16),
  '51-pegasi-b': abilityFor(TalentEffect.Dps, 0.22),
  'j1407-b': abilityFor(TalentEffect.Dps, 0.22),
  'the-sun': abilityFor(TalentEffect.OfflineReward, 0.4),
  sirius: abilityFor(TalentEffect.OfflineReward, 0.2),
  betelgeuse: abilityFor(TalentEffect.Dps, 0.24),
  'uy-scuti': abilityFor(TalentEffect.Dps, 0.26),
  'psr-b1919-21': abilityFor(TalentEffect.TapCritChance, 0.05),
  'orion-nebula': abilityFor(TalentEffect.ShipCritChance, 0.05),
  'crab-nebula': abilityFor(TalentEffect.ShipCritChance, 0.05),
  andromeda: abilityFor(TalentEffect.Dps, 0.3),
  'sagittarius-a-star': abilityFor(TalentEffect.RelicGain, 0.5),
  'm87-star': abilityFor(TalentEffect.Dps, 0.4),
}

/** Resolve a Base Card's Gem Socket ability. Every one of the 5,890 catalog cards resolves to a
 *  defined ability - bespoke table first, else the classification-bucket x rarity formula (see
 *  gemAbility.test.ts's completeness check over the full catalog). `undefined` only for an id
 *  that isn't a real card at all. */
export function gemAbilityForCard(cardId: string): GemAbility | undefined {
  const bespoke = BESPOKE_GEM_ABILITIES[cardId]
  if (bespoke) return bespoke

  const card = cardById(cardId)
  if (!card) return undefined

  const bucket = bucketFor(card.classification)
  const effect = BUCKET_EFFECT[bucket]
  const magnitude = CRIT_BUCKETS.has(bucket) ? CRIT_RARITY_BONUS[card.rarity] : RARITY_BONUS[card.rarity]
  return abilityFor(effect, magnitude)
}
