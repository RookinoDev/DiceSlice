// Eternal Drive's payoff: every point spent on it rolls one random passive perk from this pool
// and adds it, forever, to the player's own running collection (see TalentService.grantedPerks).
// Deliberately additive, not multiplicative, per effect (see multiplier() in TalentService) - an
// unbounded number of grants each independently MULTIPLYING the same stat would compound into an
// absurd number within a few hundred purchases; summing magnitudes first and applying the total
// as one combined multiplier grows linearly instead, the same safe shape every other node in this
// tree already uses (capped level x flat per-level bonus).
import { TalentEffect, EFFECT_LABEL } from './TalentDefinition'

export interface PassivePerkTemplate {
  id: string
  displayName: string
  effect: TalentEffect
  minMagnitude: number
  maxMagnitude: number
}

export const PASSIVE_PERK_POOL: PassivePerkTemplate[] = [
  { id: 'overcharged-thrusters', displayName: 'Overcharged Thrusters', effect: TalentEffect.Dps, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'swarm-instinct', displayName: 'Swarm Instinct', effect: TalentEffect.Dps, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'reactive-plating', displayName: 'Reactive Plating', effect: TalentEffect.Dps, minMagnitude: 0.02, maxMagnitude: 0.05 },

  { id: 'salvage-instinct', displayName: 'Salvage Instinct', effect: TalentEffect.Gold, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'bulk-freight', displayName: 'Bulk Freight Contract', effect: TalentEffect.Gold, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'black-market-ties', displayName: 'Black Market Ties', effect: TalentEffect.Gold, minMagnitude: 0.02, maxMagnitude: 0.05 },

  { id: 'kinetic-focus', displayName: 'Kinetic Focus', effect: TalentEffect.TapDamage, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'trigger-discipline', displayName: 'Trigger Discipline', effect: TalentEffect.TapDamage, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'impact-lattice', displayName: 'Impact Lattice', effect: TalentEffect.TapDamage, minMagnitude: 0.02, maxMagnitude: 0.05 },

  { id: 'dormant-efficiency', displayName: 'Dormant Efficiency', effect: TalentEffect.OfflineReward, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'standby-protocol', displayName: 'Standby Protocol', effect: TalentEffect.OfflineReward, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'low-power-siege', displayName: 'Low-Power Siege Mode', effect: TalentEffect.OfflineReward, minMagnitude: 0.02, maxMagnitude: 0.05 },

  { id: 'quick-study', displayName: 'Quick Study', effect: TalentEffect.XpGain, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'combat-analytics', displayName: 'Combat Analytics', effect: TalentEffect.XpGain, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'veteran-instinct', displayName: "Veteran's Instinct", effect: TalentEffect.XpGain, minMagnitude: 0.02, maxMagnitude: 0.05 },

  { id: 'ascension-echo', displayName: 'Ascension Echo', effect: TalentEffect.RelicGain, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'stellar-residue', displayName: 'Stellar Residue', effect: TalentEffect.RelicGain, minMagnitude: 0.02, maxMagnitude: 0.05 },
  { id: 'temporal-surplus', displayName: 'Temporal Surplus', effect: TalentEffect.RelicGain, minMagnitude: 0.02, maxMagnitude: 0.05 },

  // Capstone sentinel: stacks into Dps/Gold/TapDamage/OfflineReward/RelicGain at once, same as
  // every other Capstone-tagged node in the tree (see CAPSTONE_EFFECTS) - a smaller magnitude
  // since it's really 5 bonuses in one.
  { id: 'harmonic-resonance', displayName: 'Harmonic Resonance', effect: TalentEffect.Capstone, minMagnitude: 0.01, maxMagnitude: 0.025 },
  { id: 'entropic-balance', displayName: 'Entropic Balance', effect: TalentEffect.Capstone, minMagnitude: 0.01, maxMagnitude: 0.025 },
  { id: 'unified-field', displayName: 'Unified Field', effect: TalentEffect.Capstone, minMagnitude: 0.01, maxMagnitude: 0.025 },
]

const PERK_BY_ID = new Map(PASSIVE_PERK_POOL.map((p) => [p.id, p]))

export function passivePerkTemplate(id: string): PassivePerkTemplate | undefined {
  return PERK_BY_ID.get(id)
}

/** A single granted perk instance - the rolled magnitude is stored, not re-rolled, so a reload
 *  never changes what a player already has. */
export interface GrantedPerk {
  templateId: string
  magnitude: number
}

export function rollRandomPerk(): GrantedPerk {
  const template = PASSIVE_PERK_POOL[Math.floor(Math.random() * PASSIVE_PERK_POOL.length)]
  const magnitude = template.minMagnitude + Math.random() * (template.maxMagnitude - template.minMagnitude)
  return { templateId: template.id, magnitude }
}

function formatPct(magnitude: number): string {
  return `${Math.round(magnitude * 1000) / 10}%`
}

/** Display label for a granted perk, e.g. "Overcharged Thrusters +3.8% Fleet DPS". Falls back
 *  gracefully for a templateId that no longer exists (pool changed after this was granted). */
export function grantedPerkLabel(perk: GrantedPerk): string {
  const template = PERK_BY_ID.get(perk.templateId)
  if (!template) return `Unknown Perk +${formatPct(perk.magnitude)}`
  return `${template.displayName} +${formatPct(perk.magnitude)} ${EFFECT_LABEL[template.effect]}`
}
