// Tracks which owned card (if any) sits in each unlocked Gem Socket talent node, and the
// resulting stat bonuses. Slot UNLOCK (is this tree node bought) rides TalentService's existing
// levels[]/buyNode machinery unchanged - this service only tracks slot CONTENTS (which card),
// mirroring the profile Showcase's own split: ownership lives server-side (see db.mjs's
// gem_sockets column / setGemSockets), the resulting bonus is derived client-side via
// gemAbility.ts, never computed or stored server-side.
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import { TalentEffect } from '../config/TalentDefinition'
import { gemAbilityForCard } from '../cards/gemAbility'
import type { CardVariant } from '../cards/variants'

export interface GemSocketAssignment {
  nodeId: string
  cardId: string
  variant: CardVariant
}

/** Gems' own contribution to crit chance, capped before GameSession sums it with Artifacts' and
 *  Talents' separately-capped contributions - same reasoning as TalentService's own
 *  TALENT_CRIT_CHANCE_CAP, just a third share of the shared ceiling. */
const GEM_CRIT_CHANCE_CAP = 0.3

export class GemSocketService {
  private readonly assignments = new Map<string, { cardId: string; variant: CardVariant }>()

  readonly onSocketsChanged = new Emitter<void>()

  /** Replace all assignments from a server/save payload (e.g. right after /api/collection
   *  resolves). Malformed entries are dropped rather than throwing - a card the player no longer
   *  owns by the time this loads just silently grants nothing (gemAbilityForCard still resolves
   *  it fine; ownership is enforced server-side on write, not read). */
  hydrate(sockets: GemSocketAssignment[] | undefined | null): void {
    this.assignments.clear()
    for (const s of sockets ?? []) {
      if (!s || typeof s.nodeId !== 'string' || typeof s.cardId !== 'string') continue
      this.assignments.set(s.nodeId, { cardId: s.cardId, variant: s.variant })
    }
    this.onSocketsChanged.emit()
  }

  cardAt(nodeId: string): { cardId: string; variant: CardVariant } | undefined {
    return this.assignments.get(nodeId)
  }

  /** Socket a card into a node. A card already socketed elsewhere is moved (one card can only
   *  ever occupy one socket at a time), same "one slot per base card" rule ShowcaseEditor
   *  enforces for showcase slots. */
  setSocket(nodeId: string, cardId: string, variant: CardVariant): void {
    for (const [existingNodeId, a] of this.assignments) {
      if (a.cardId === cardId && existingNodeId !== nodeId) this.assignments.delete(existingNodeId)
    }
    this.assignments.set(nodeId, { cardId, variant })
    this.onSocketsChanged.emit()
  }

  clearSocket(nodeId: string): void {
    this.assignments.delete(nodeId)
    this.onSocketsChanged.emit()
  }

  serialize(): GemSocketAssignment[] {
    return Array.from(this.assignments, ([nodeId, a]) => ({ nodeId, cardId: a.cardId, variant: a.variant }))
  }

  /** Same shape as TalentService.multiplier(): compounds 1+magnitude across every socketed card
   *  whose gem ability matches `effect`. */
  private multiplier(effect: TalentEffect): BigNumber {
    let mult = BigNumber.One
    for (const { cardId } of this.assignments.values()) {
      const ability = gemAbilityForCard(cardId)
      if (!ability || ability.effect !== effect) continue
      mult = mult.mul(new BigNumber(1 + ability.magnitude))
    }
    return mult
  }

  dpsMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.Dps)
  }
  goldMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.Gold)
  }
  tapDamageMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.TapDamage)
  }
  offlineRewardMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.OfflineReward)
  }
  relicGainMultiplier(): BigNumber {
    return this.multiplier(TalentEffect.RelicGain)
  }

  /** Crit chance is summed (not compounded), same shape as TalentService.critChanceFor. */
  private critChanceFor(effect: TalentEffect): number {
    let chance = 0
    for (const { cardId } of this.assignments.values()) {
      const ability = gemAbilityForCard(cardId)
      if (!ability || ability.effect !== effect) continue
      chance += ability.magnitude
    }
    return Math.min(GEM_CRIT_CHANCE_CAP, chance)
  }
  tapCritChance(): number {
    return this.critChanceFor(TalentEffect.TapCritChance)
  }
  shipCritChance(): number {
    return this.critChanceFor(TalentEffect.ShipCritChance)
  }

  /** Plain number, not BigNumber - same shape as TalentService.xpGainMultiplier(), which
   *  self-applies internally on every grantXp() call. GameSession pre-multiplies the raw XP
   *  amount by this before handing it to talents.grantXp() so a Wanderer-bucket Gem (comets,
   *  'Oumuamua) buffs talent XP the same way an XpGain talent node already does. */
  xpGainMultiplier(): number {
    let mult = 1
    for (const { cardId } of this.assignments.values()) {
      const ability = gemAbilityForCard(cardId)
      if (!ability || ability.effect !== TalentEffect.XpGain) continue
      mult *= 1 + ability.magnitude
    }
    return mult
  }
}
