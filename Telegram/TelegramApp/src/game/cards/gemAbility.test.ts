import { describe, expect, it } from 'vitest'
import { TalentEffect } from '../config/TalentDefinition'
import { FULL_CATALOG } from './generatedCards'
import { gemAbilityForCard } from './gemAbility'

const VALID_EFFECTS = new Set<TalentEffect>([
  TalentEffect.Dps,
  TalentEffect.Gold,
  TalentEffect.TapDamage,
  TalentEffect.OfflineReward,
  TalentEffect.XpGain,
  TalentEffect.TapCritChance,
  TalentEffect.ShipCritChance,
  TalentEffect.RelicGain,
])

describe('gemAbilityForCard', () => {
  it('resolves an id that is not a real card to undefined', () => {
    expect(gemAbilityForCard('not-a-real-card-id')).toBeUndefined()
  })

  it('resolves every one of the 5,890 catalog cards to a defined, sane ability', () => {
    expect(FULL_CATALOG.length).toBeGreaterThan(5000) // sanity check the catalog itself loaded

    for (const card of FULL_CATALOG) {
      const ability = gemAbilityForCard(card.id)
      expect(ability, `card ${card.id} (${card.classification}) resolved to no ability`).toBeDefined()
      const a = ability!
      expect(VALID_EFFECTS.has(a.effect), `card ${card.id} resolved to an invalid effect ${a.effect}`).toBe(true)
      expect(a.magnitude).toBeGreaterThan(0)
      expect(a.magnitude).toBeLessThanOrEqual(0.5)
      expect(a.label.length).toBeGreaterThan(0)
    }
  })

  it('bespoke marquee cards resolve to their hand-authored ability, not the formula', () => {
    expect(gemAbilityForCard('earth')).toEqual({ effect: TalentEffect.OfflineReward, magnitude: 0.35, label: '+35% Offline Stardust' })
    expect(gemAbilityForCard('sagittarius-a-star')?.effect).toBe(TalentEffect.RelicGain)
    expect(gemAbilityForCard('m87-star')?.effect).toBe(TalentEffect.Dps)
  })

  it('higher rarity yields a strictly larger formula magnitude for the same bucket', () => {
    // ceres (Dwarf planet, uncommon) and makemake (Dwarf planet, common) share a bucket/effect
    const common = gemAbilityForCard('makemake')!
    const uncommon = gemAbilityForCard('ceres')!
    expect(common.effect).toBe(uncommon.effect)
    expect(uncommon.magnitude).toBeGreaterThan(common.magnitude)
  })

  it('crit-chance buckets (pulsar/nebula) stay within the tight crit magnitude range', () => {
    const eagleNebula = gemAbilityForCard('eagle-nebula')! // Emission nebula, epic
    expect(eagleNebula.effect).toBe(TalentEffect.ShipCritChance)
    expect(eagleNebula.magnitude).toBeLessThanOrEqual(0.1)
  })
})
