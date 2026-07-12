// Presentation-only rarity theme for the card UI - kept separate from game/cards/catalog.ts's
// data, matching how shipTierVisuals.ts separates fleet presentation from ShipDefinition.ts.
import type { CardRarity } from '../../game/cards/catalog'
import gemCommon from '../../assets/cards/gem-common.png'
import gemUncommon from '../../assets/cards/gem-uncommon.png'
import gemRare from '../../assets/cards/gem-rare.png'
import gemEpic from '../../assets/cards/gem-epic.png'
import gemLegendary from '../../assets/cards/gem-legendary.png'
import gemUltra from '../../assets/cards/gem-ultra.png'

export const RARITY_COLOR: Record<CardRarity, string> = {
  common: '#8b93ac',
  uncommon: '#3adc84',
  rare: '#43ddee',
  epic: '#e24fff',
  legendary: '#ffb238',
  ultra: '#fff2c9',
}

/** Faceted gem silhouette per tier (docs/CARD_SYSTEM_PLAN.md §2 "Rarity gems") - the collection-number line icon. Shape carries the tier read; color stays the art's own iridescent look rather than being tinted, so it doesn't fight RARITY_COLOR's border/glow use elsewhere. */
export const RARITY_GEM: Record<CardRarity, string> = {
  common: gemCommon,
  uncommon: gemUncommon,
  rare: gemRare,
  epic: gemEpic,
  legendary: gemLegendary,
  ultra: gemUltra,
}

/** Collection-number display, e.g. "023/066". */
export function collectionNo(no: number, total: number): string {
  return `${String(no).padStart(3, '0')}/${String(total).padStart(3, '0')}`
}
