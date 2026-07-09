// The 6-variant model. A variant is a VERSION of a Base Card (same planet, same catalog
// entry), never a separate card. Server-side mirror lives in TelegramBot/cards.mjs's
// VARIANT_* config - keep the ids in sync (they're stored in the card_instances DB rows).
export type CardVariant = 'standard' | 'foil' | 'holo' | 'fullart' | 'negative' | 'polychrome'

/** Ascending prestige order - also the order duplicate-progression crafting climbs (see docs). */
export const VARIANT_ORDER: CardVariant[] = ['standard', 'foil', 'holo', 'fullart', 'negative', 'polychrome']

export const VARIANT_LABEL: Record<CardVariant, string> = {
  standard: 'Standard',
  foil: 'Foil',
  holo: 'Holographic',
  fullart: 'Full Art',
  negative: 'Negative',
  polychrome: 'Polychrome',
}

/** Rank for sorting/compare: standard 0 .. polychrome 5. */
export function variantRank(v: CardVariant): number {
  return VARIANT_ORDER.indexOf(v)
}
